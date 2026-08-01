/**
 * High-Concurrency Multi-Tier Hybrid Caching Engine
 * Tier 1: In-Memory LRU Cache (0ms latency, zero external setup, 0 cost)
 * Tier 2: Redis / Upstash HTTP REST Fallback (if REDIS_URL or UPSTASH_REDIS_REST_URL is configured)
 */

const axios = require('axios');

class LRUCache {
    constructor(maxSize = 1000, defaultTtlMs = 60000) {
        this.maxSize = maxSize;
        this.defaultTtlMs = defaultTtlMs;
        this.cache = new Map();
    }

    get(key) {
        const item = this.cache.get(key);
        if (!item) return null;

        // Expiration check
        if (Date.now() > item.expiresAt) {
            this.cache.delete(key);
            return null;
        }

        // Move to top (most recently used)
        this.cache.delete(key);
        this.cache.set(key, item);
        return item.value;
    }

    set(key, value, ttlMs = this.defaultTtlMs) {
        if (this.cache.has(key)) {
            this.cache.delete(key);
        } else if (this.cache.size >= this.maxSize) {
            // Evict oldest entry
            const oldestKey = this.cache.keys().next().value;
            this.cache.delete(oldestKey);
        }

        this.cache.set(key, {
            value,
            expiresAt: Date.now() + ttlMs
        });
    }

    delete(key) {
        this.cache.delete(key);
    }

    clearPattern(pattern) {
        for (const key of this.cache.keys()) {
            if (key.includes(pattern)) {
                this.cache.delete(key);
            }
        }
    }
}

// Global Tier 1 Cache Instance
const memoryCache = new LRUCache(2000, 60000);

// Redis Cloud / Upstash HTTP Integration
const isRedisConfigured = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

async function getCache(key) {
    // 1. Try Tier 1 Local Memory (<1ms)
    const localVal = memoryCache.get(key);
    if (localVal !== null) return localVal;

    // 2. Try Tier 2 Upstash Redis if configured
    if (isRedisConfigured) {
        try {
            const url = `${process.env.UPSTASH_REDIS_REST_URL}/get/${encodeURIComponent(key)}`;
            const res = await axios.get(url, {
                headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` },
                timeout: 1000
            });
            if (res.data?.result) {
                const parsed = JSON.parse(res.data.result);
                memoryCache.set(key, parsed, 30000); // Warm local memory
                return parsed;
            }
        } catch (err) {
            console.warn('[Cache] Upstash Redis GET warning:', err.message);
        }
    }

    return null;
}

async function setCache(key, value, ttlMs = 60000) {
    // 1. Set Tier 1 Local Memory
    memoryCache.set(key, value, ttlMs);

    // 2. Set Tier 2 Upstash Redis if configured
    if (isRedisConfigured) {
        try {
            const ttlSeconds = Math.ceil(ttlMs / 1000);
            const valStr = JSON.stringify(value);
            const url = `${process.env.UPSTASH_REDIS_REST_URL}/set/${encodeURIComponent(key)}/${encodeURIComponent(valStr)}?EX=${ttlSeconds}`;
            await axios.get(url, {
                headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` },
                timeout: 1000
            });
        } catch (err) {
            console.warn('[Cache] Upstash Redis SET warning:', err.message);
        }
    }
}

function invalidateCache(keyOrPattern) {
    memoryCache.clearPattern(keyOrPattern);
}

module.exports = {
    getCache,
    setCache,
    invalidateCache,
    memoryCache
};
