/**
 * server/engine/evidence/embeddingCache.js
 *
 * Content-Hash Embedding Cache.
 * Keyed by SHA-256(chunk_content).
 * Prevents expensive repeated embedding generation across identical document chunks.
 */

'use strict';

const crypto = require('crypto');
const providerConfig = require('../../config/providerConfig');
const productionMetrics = require('../../utils/productionMetrics');

class EmbeddingCache {
  constructor(maxSize = 5000, ttlMs = providerConfig.embedding.cacheTtlMs) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  computeHash(text = '') {
    return crypto.createHash('sha256').update(String(text).trim(), 'utf8').digest('hex');
  }

  get(text) {
    const hash = this.computeHash(text);
    const entry = this.cache.get(hash);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(hash);
      return null;
    }

    // Refresh LRU order
    this.cache.delete(hash);
    this.cache.set(hash, entry);
    return entry.embedding;
  }

  set(text, embedding) {
    if (!text || !embedding) return;

    const hash = this.computeHash(text);

    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(hash, {
      embedding,
      expiresAt: Date.now() + this.ttlMs
    });
  }

  /**
   * Embed or retrieve chunk embedding.
   * @param {string} text
   * @param {Function} embeddingGeneratorFn
   * @returns {Promise<Array<number>>}
   */
  async getOrCompute(text, embeddingGeneratorFn) {
    productionMetrics.inc('embedding_requests_total');
    const cached = this.get(text);
    if (cached) {
      return cached;
    }

    const embedding = await embeddingGeneratorFn(text);
    if (embedding) {
      this.set(text, embedding);
    }
    return embedding;
  }

  clear() {
    this.cache.clear();
  }

  size() {
    return this.cache.size;
  }
}

module.exports = new EmbeddingCache();
