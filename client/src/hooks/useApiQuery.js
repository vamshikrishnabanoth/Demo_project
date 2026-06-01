import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';

/**
 * useApiQuery — Enterprise Data Orchestration Hook
 * Features:
 *  - Automated AbortController management (prevents race conditions)
 *  - Stale-While-Revalidate (SWR) Caching
 *  - Background Polling support
 *  - Silent re-fetching
 *  - Optimistic Data Injection
 */
const cache = new Map();
const DEFAULT_TTL = 30_000;

export function useApiQuery(url, {
    immediate = true,
    showErrorToast = true,
    cacheTtl = DEFAULT_TTL,
    pollingInterval = 0, // ms, 0 = disabled
} = {}) {
    const [data, setData] = useState(() => cache.get(url)?.data || null);
    const [loading, setLoading] = useState(immediate && !cache.get(url));
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);
    const abortRef = useRef(null);

    const executeFetch = useCallback(async (isSilent = false) => {
        if (!isSilent) setLoading(true);
        else setRefreshing(true);
        
        setError(null);
        abortRef.current?.abort();
        abortRef.current = new AbortController();

        try {
            const res = await api.get(url, { signal: abortRef.current.signal });
            const result = res.data;

            cache.set(url, { data: result, timestamp: Date.now() });
            setData(result);
            setLastUpdated(Date.now());
            return result;
        } catch (err) {
            if (err.name === 'CanceledError' || err.name === 'AbortError') return;
            const msg = err.response?.data?.msg || err.response?.data?.message || err.response?.data?.error || 'Network Link Failure';
            setError(msg);
            if (showErrorToast) toast.error(msg);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [url, showErrorToast]);

    useEffect(() => {
        if (immediate) executeFetch();
        
        let intervalId;
        if (pollingInterval > 0) {
            intervalId = setInterval(() => executeFetch(true), pollingInterval);
        }

        return () => {
            abortRef.current?.abort();
            if (intervalId) clearInterval(intervalId);
        };
    }, [url, immediate, pollingInterval, executeFetch]);

    const refetch = useCallback(() => executeFetch(true), [executeFetch]);
    const setOptimisticData = useCallback((newData) => setData(newData), []);

    return { data, loading, refreshing, error, lastUpdated, refetch, setOptimisticData };
}

export function invalidateCache(url) {
    if (url) cache.delete(url);
    else cache.clear();
}

export default useApiQuery;
