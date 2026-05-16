/**
 * useApiQuery — lightweight data fetching hook.
 * Provides: loading state, error state, data, refetch, and simple in-memory caching.
 * 
 * This eliminates the copy-paste pattern of useState+useEffect+api.get across 10+ pages.
 * 
 * Usage:
 *   const { data, loading, error, refetch } = useApiQuery('/quiz/stats');
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';

// Simple in-memory cache: { url: { data, timestamp } }
const cache = new Map();
const CACHE_TTL = 30_000; // 30 seconds

export function useApiQuery(url, {
    immediate = true,       // auto-fetch on mount
    showErrorToast = true,  // show user-visible toast on failure
    cacheTtl = CACHE_TTL,   // ms before cache is stale
} = {}) {
    const [data,    setData]    = useState(null);
    const [loading, setLoading] = useState(immediate);
    const [error,   setError]   = useState(null);
    const abortRef = useRef(null);

    const fetch = useCallback(async (silent = false) => {
        // Check cache first (unless silent = forced refetch)
        if (!silent && cacheTtl > 0) {
            const cached = cache.get(url);
            if (cached && Date.now() - cached.timestamp < cacheTtl) {
                setData(cached.data);
                setLoading(false);
                return cached.data;
            }
        }

        if (!silent) setLoading(true);
        setError(null);

        // Cancel any in-flight request for the same URL
        abortRef.current?.abort();
        abortRef.current = new AbortController();

        try {
            const res = await api.get(url, { signal: abortRef.current.signal });
            const result = res.data;

            // Update cache
            cache.set(url, { data: result, timestamp: Date.now() });

            setData(result);
            return result;
        } catch (err) {
            if (err.name === 'CanceledError' || err.name === 'AbortError') return;

            const msg = err.response?.data?.msg || err.message || 'Something went wrong';
            setError(msg);

            if (showErrorToast) {
                toast.error(msg, {
                    style: {
                        background: '#1e293b',
                        color: '#fff',
                        borderRadius: '1rem',
                        border: '1px solid rgba(239,68,68,0.2)',
                    },
                });
            }
        } finally {
            setLoading(false);
        }
    }, [url, cacheTtl, showErrorToast]);

    useEffect(() => {
        if (immediate) fetch();
        return () => abortRef.current?.abort();
    }, [url, immediate]);

    const refetch = useCallback(() => fetch(true), [fetch]);

    return { data, loading, error, refetch };
}

/**
 * Invalidate cache for a specific URL (use after mutations)
 * e.g., invalidateCache('/quiz/stats') after creating a quiz
 */
export function invalidateCache(url) {
    if (url) cache.delete(url);
    else cache.clear();
}

export default useApiQuery;
