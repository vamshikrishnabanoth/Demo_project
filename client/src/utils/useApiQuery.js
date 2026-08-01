import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../services/api';

// Global In-Memory SWR Cache Store
const queryCache = new Map();
const cacheListeners = new Map();

function notifyListeners(key) {
    const listeners = cacheListeners.get(key);
    if (listeners) {
        listeners.forEach(cb => cb());
    }
}

/**
 * Prefetch API endpoint into memory cache on hover/mount
 */
export function prefetchApi(endpoint) {
    if (!endpoint) return;
    api.get(endpoint).then(res => {
        queryCache.set(endpoint, { data: res.data, timestamp: Date.now() });
        notifyListeners(endpoint);
    }).catch(err => {
        console.warn(`[PrefetchApi] Error prefetching ${endpoint}:`, err);
    });
}

/**
 * Invalidate a cached API endpoint
 */
export function invalidateApiQuery(endpoint) {
    if (!endpoint) return;
    queryCache.delete(endpoint);
    notifyListeners(endpoint);
}

/**
 * Custom SWR Hook — Renders cached data in 0ms & updates in background
 */
export function useApiQuery(endpoint, options = {}) {
    const { enabled = true, ttl = 60000 } = options;
    const cachedEntry = endpoint ? queryCache.get(endpoint) : null;

    const [data, setData] = useState(cachedEntry?.data || null);
    const [loading, setLoading] = useState(!cachedEntry);
    const [error, setError] = useState(null);

    const isMountedRef = useRef(true);

    const refetch = useCallback(async (isSilent = false) => {
        if (!endpoint || !enabled) return;
        if (!isSilent && !queryCache.has(endpoint)) {
            setLoading(true);
        }
        try {
            const res = await api.get(endpoint);
            queryCache.set(endpoint, { data: res.data, timestamp: Date.now() });
            if (isMountedRef.current) {
                setData(res.data);
                setError(null);
                setLoading(false);
            }
            notifyListeners(endpoint);
        } catch (err) {
            if (isMountedRef.current) {
                setError(err);
                setLoading(false);
            }
        }
    }, [endpoint, enabled]);

    useEffect(() => {
        isMountedRef.current = true;
        if (!enabled || !endpoint) return;

        // Subscribe to cache updates
        if (!cacheListeners.has(endpoint)) {
            cacheListeners.set(endpoint, new Set());
        }
        const listener = () => {
            const entry = queryCache.get(endpoint);
            if (entry && isMountedRef.current) {
                setData(entry.data);
            }
        };
        cacheListeners.get(endpoint).add(listener);

        // If cache is fresh, render cached data immediately, then revalidate silently
        const entry = queryCache.get(endpoint);
        if (entry) {
            setData(entry.data);
            setLoading(false);
            const isStale = Date.now() - entry.timestamp > ttl;
            if (isStale) {
                refetch(true);
            }
        } else {
            refetch(false);
        }

        return () => {
            isMountedRef.current = false;
            const listeners = cacheListeners.get(endpoint);
            if (listeners) {
                listeners.delete(listener);
            }
        };
    }, [endpoint, enabled, refetch, ttl]);

    return { data, loading, error, refetch };
}
