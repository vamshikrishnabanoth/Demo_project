/**
 * server/engine/evidence/evidenceCache.js
 *
 * In-memory LRU cache for deterministic session evidence preprocessing.
 * Avoids re-running concept extraction, hierarchical chunking, and CMA graph
 * construction when teachers regenerate, retry, or adjust question count/difficulty.
 */

'use strict';

const crypto = require('crypto');

const CACHE_TTL_MS = 60 * 60 * 1000; // 60 minutes
const MAX_CACHE_ENTRIES = 100;

class EvidenceCache {
  constructor() {
    this.cache = new Map();
  }

  /**
   * Compute a deterministic SHA-256 fingerprint from session inputs.
   */
  computeFingerprint(sessionInputs = {}) {
    const voice = (sessionInputs.voiceTranscript || '').trim();
    const docs = (sessionInputs.documentTexts || []).join('::');
    const docNames = (sessionInputs.documentNames || []).join('::');
    const code = (sessionInputs.codeSnippets || '').trim();
    const images = (sessionInputs.imageTexts || []).join('::');

    const raw = `V:${voice}##D:${docs}##DN:${docNames}##C:${code}##I:${images}`;
    return crypto.createHash('sha256').update(raw, 'utf8').digest('hex');
  }

  /**
   * Retrieve cached evidence package data if available and fresh.
   */
  get(sessionInputs = {}) {
    const key = this.computeFingerprint(sessionInputs);
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      this.cache.delete(key);
      return null;
    }

    // Refresh LRU order
    this.cache.delete(key);
    this.cache.set(key, entry);

    // Return a shallow clone of package fields with a new sessionId
    const cloned = { ...entry.data };
    cloned.sessionId = sessionInputs.sessionId || 'cached_session_' + Date.now();
    cloned.isCacheHit = true;
    return cloned;
  }

  /**
   * Cache a packaged evidence payload.
   */
  set(sessionInputs = {}, packageData = {}) {
    if (!packageData || !packageData.isAcademic) return;

    const key = this.computeFingerprint(sessionInputs);

    // Evict oldest if exceeding capacity
    if (this.cache.size >= MAX_CACHE_ENTRIES) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      timestamp: Date.now(),
      data: {
        authoritySummary: packageData.authoritySummary,
        voiceEmphasis: packageData.voiceEmphasis,
        artifacts: packageData.artifacts,
        isAcademic: packageData.isAcademic,
        isCurricular: packageData.isCurricular,
        academicFailureReason: packageData.academicFailureReason,
        lectureDepth: packageData.lectureDepth,
        detectedFocus: packageData.detectedFocus,
        curricularSegments: packageData.curricularSegments,
        pedagogicalSegments: packageData.pedagogicalSegments,
        adminSegments: packageData.adminSegments,
        curricularContent: packageData.curricularContent,
        categoryWeights: packageData.categoryWeights,
        hasExcludedMaterials: packageData.hasExcludedMaterials,
        unalignedDocuments: packageData.unalignedDocuments,
        alignmentWarning: packageData.alignmentWarning,
        hasAlignedDocs: packageData.hasAlignedDocs,
        unifiedRawContent: packageData.unifiedRawContent,
        hierarchicalStore: packageData.hierarchicalStore,
        alignmentGraph: packageData.alignmentGraph
      }
    });
  }

  clear() {
    this.cache.clear();
  }
}

module.exports = new EvidenceCache();
