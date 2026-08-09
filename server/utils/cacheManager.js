const fs = require('fs');
const path = require('path');
const config = require('../config/cacheConfig');
const metricsManager = require('./metricsManager');

/**
 * FUTURE ENHANCEMENT ROADMAP:
 * - Distributed Singleflight: Replace in-process Map with Redis distributed locks for multi-instance deployments.
 * - Cache Warming: Pre-load popular subjects/lectures into L1 on server startup.
 * - Background Compaction: Asynchronous cron worker for batch eviction of expired L2 keys.
 */

// L2 Storage Directory Setup
const L2_CACHE_DIR = path.join(__dirname, '..', 'data', 'cache');
if (!fs.existsSync(L2_CACHE_DIR)) {
  fs.mkdirSync(L2_CACHE_DIR, { recursive: true });
}

class LRUCache {
  constructor(maxEntries = config.L1_CACHE_MAX_ENTRIES) {
    this.maxEntries = maxEntries;
    this.cache = new Map();
  }

  get(key) {
    if (!this.cache.has(key)) return null;
    const value = this.cache.get(key);
    // Refresh position for O(1) LRU
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxEntries) {
      // Evict oldest entry O(1)
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    this.cache.set(key, value);
  }

  delete(key) {
    this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }
}

class CacheManager {
  constructor() {
    this.l1 = new LRUCache(config.L1_CACHE_MAX_ENTRIES);
    this.singleflightLocks = new Map(); // In-process request coalescing
  }

  getL2Path(key) {
    const safeKey = String(key).replace(/[^a-zA-Z0-9_\-:]/g, '_');
    return path.join(L2_CACHE_DIR, `${safeKey}.json`);
  }

  /**
   * Helper: Calculate JSON payload size in bytes
   */
  getByteSize(data) {
    try {
      return Buffer.byteLength(JSON.stringify(data));
    } catch (_) {
      return 0;
    }
  }

  /**
   * Non-Blocking Asynchronous Stale Cleanup
   */
  asyncEvictStaleKey(key, reqId = 'default') {
    setImmediate(() => {
      try {
        this.l1.delete(key);
        const l2Path = this.getL2Path(key);
        if (fs.existsSync(l2Path)) {
          fs.unlinkSync(l2Path);
        }
        console.log(`[ReqID: ${reqId}] 🧹 [ASYNC CLEANUP] Evicted stale cache key: ${key}`);
      } catch (err) {
        console.warn(`[ReqID: ${reqId}] ⚠️ Async stale eviction failed for ${key}: ${err.message}`);
      }
    });
  }

  /**
   * 4A. CACHE READ PRIORITY ORDER
   * 1. L1 Memory Cache Check
   * 2. L2 Persistent Store Check
   * 3. Return payload if valid, else Miss
   */
  get(key, reqId = 'default') {
    // 1. L1 Memory Cache Check
    const l1Wrapper = this.l1.get(key);
    if (l1Wrapper) {
      if (this.isValidWrapper(l1Wrapper)) {
        l1Wrapper.hitCount = (l1Wrapper.hitCount || 0) + 1;
        l1Wrapper.lastAccessedAt = Date.now();
        const savedMs = l1Wrapper.measuredProcessingTimeMs || 0;
        const bytesSaved = this.getByteSize(l1Wrapper.data);

        metricsManager.recordL1Hit(reqId, savedMs, bytesSaved);
        console.log(`[ReqID: ${reqId}] [CACHE READ] ⚡ L1 HIT | Key: ${key} | Saved: ${savedMs}ms`);
        return l1Wrapper.data;
      } else {
        // Stale entry -> Non-blocking async cleanup
        metricsManager.recordMiss(reqId);
        this.asyncEvictStaleKey(key, reqId);
        return null;
      }
    }

    // 2. L2 Persistent Store Check
    const l2Path = this.getL2Path(key);
    if (fs.existsSync(l2Path)) {
      try {
        const raw = fs.readFileSync(l2Path, 'utf8');
        const l2Wrapper = JSON.parse(raw);

        if (this.isValidWrapper(l2Wrapper)) {
          l2Wrapper.hitCount = (l2Wrapper.hitCount || 0) + 1;
          l2Wrapper.lastAccessedAt = Date.now();
          const savedMs = l2Wrapper.measuredProcessingTimeMs || 0;
          const bytesSaved = this.getByteSize(l2Wrapper.data);

          // Populate L1 Memory Cache
          this.l1.set(key, l2Wrapper);

          // Asynchronously update L2 access metadata
          setImmediate(() => {
            try { fs.writeFileSync(l2Path, JSON.stringify(l2Wrapper), 'utf8'); } catch (_) {}
          });

          metricsManager.recordL2Hit(reqId, savedMs, bytesSaved);
          console.log(`[ReqID: ${reqId}] [CACHE READ] ⚡ L2 HIT | Key: ${key} | Saved: ${savedMs}ms`);
          return l2Wrapper.data;
        } else {
          // Stale L2 entry -> Non-blocking async cleanup
          metricsManager.recordMiss(reqId);
          this.asyncEvictStaleKey(key, reqId);
          return null;
        }
      } catch (err) {
        console.warn(`[ReqID: ${reqId}] ⚠️ Failed to read L2 cache for key ${key}: ${err.message}`);
      }
    }

    // 3. Compute (Cache Miss)
    metricsManager.recordMiss(reqId);
    console.log(`[ReqID: ${reqId}] [CACHE READ] ❌ MISS | Key: ${key} | Executing Pipeline...`);
    return null;
  }

  /**
   * Wrapper Version Metadata Validator
   */
  isValidWrapper(wrapper) {
    if (!wrapper || typeof wrapper !== 'object') return false;
    if (wrapper.schemaVersion !== config.SCHEMA_VERSION) return false;
    if (!wrapper.versionMetadata) return false;

    const { pipeline, validator } = wrapper.versionMetadata;
    if (pipeline && pipeline !== config.PIPELINE_VERSION) return false;
    if (validator && validator !== config.VALIDATOR_VERSION) return false;

    return true;
  }

  /**
   * 4B. CACHE WRITE PRIORITY ORDER & STRICT NEGATIVE CACHE POLICY
   */
  set(key, data, metadata = {}, reqId = 'default') {
    const { 
      measuredProcessingTimeMs = 0, 
      qualityScore = 1.0, 
      category = 'quiz' 
    } = metadata;

    // Strict Negative Cache Policy: Never cache if quality score < threshold or data is invalid
    if (qualityScore < config.MIN_CACHEABLE_QUALITY_SCORE) {
      metricsManager.recordSkip(reqId);
      console.log(`[ReqID: ${reqId}] [CACHE WRITE SKIPPED] Quality score (${qualityScore.toFixed(2)}) < threshold (${config.MIN_CACHEABLE_QUALITY_SCORE})`);
      return false;
    }

    if (!data) {
      metricsManager.recordSkip(reqId);
      console.log(`[ReqID: ${reqId}] [CACHE WRITE SKIPPED] Empty or invalid result data.`);
      return false;
    }

    // Payload Size Cap Verification
    const byteSize = this.getByteSize(data);
    let maxAllowedBytes = config.MAX_CACHE_QUIZ_BYTES;
    if (category === 'asset' || category === 'transcript') maxAllowedBytes = config.MAX_CACHE_TRANSCRIPT_BYTES;
    else if (category === 'analysis' || category === 'concept') maxAllowedBytes = config.MAX_CACHE_CONCEPT_BYTES;

    if (byteSize > maxAllowedBytes) {
      metricsManager.recordSkip(reqId);
      console.warn(`[ReqID: ${reqId}] ⚠️ [CACHE WRITE SKIPPED] Payload size (${(byteSize / 1024).toFixed(1)} KB) exceeds limit (${(maxAllowedBytes / 1024).toFixed(1)} KB)`);
      return false;
    }

    // Construct Standardized Metadata Wrapper
    const wrapper = {
      data,
      schemaVersion: config.SCHEMA_VERSION,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      hitCount: 0,
      measuredProcessingTimeMs,
      versionMetadata: {
        pipeline: config.PIPELINE_VERSION,
        validator: config.VALIDATOR_VERSION,
        ocr: config.OCR_VERSION,
        whisper: config.WHISPER_VERSION
      }
    };

    // Store to L2 Persistent Store
    try {
      const l2Path = this.getL2Path(key);
      fs.writeFileSync(l2Path, JSON.stringify(wrapper), 'utf8');
    } catch (err) {
      console.warn(`[ReqID: ${reqId}] ⚠️ Failed to write L2 persistent cache for ${key}: ${err.message}`);
    }

    // Store to L1 Memory Cache
    this.l1.set(key, wrapper);

    console.log(`[ReqID: ${reqId}] [CACHE WRITE] ✅ CACHED | Key: ${key} | Size: ${(byteSize / 1024).toFixed(1)} KB`);
    return true;
  }

  /**
   * Singleflight Request Coalescing
   * Coalesces concurrent identical async computations into a single execution stream
   */
  async fetchCoalesced(key, computeFn, reqId = 'default') {
    // 1. Check Cache Read Priority first
    const cached = this.get(key, reqId);
    if (cached !== null) return cached;

    // 2. In-Process Singleflight Coalescing Lock Check
    if (this.singleflightLocks.has(key)) {
      console.log(`[ReqID: ${reqId}] 🔒 [SINGLEFLIGHT COALESCING] Coalescing request for key: ${key}`);
      return await this.singleflightLocks.get(key);
    }

    // 3. Compute with singleflight lock
    const computePromise = (async () => {
      try {
        const result = await computeFn();
        return result;
      } finally {
        this.singleflightLocks.delete(key);
      }
    })();

    this.singleflightLocks.set(key, computePromise);
    return await computePromise;
  }
}

module.exports = new CacheManager();
