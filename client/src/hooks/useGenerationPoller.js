/**
 * useGenerationPoller.js
 *
 * Custom hook that polls GET /quiz/generate/status/:taskId until
 * the task is COMPLETED or FAILED.
 *
 * Returns:
 *   { polling, stage, stageLabel, elapsed, error, result }
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../utils/api';

const POLL_INTERVAL_MS = 1500; // poll every 1.5s

export default function useGenerationPoller() {
    const [taskId,     setTaskId]     = useState(null);
    const [polling,    setPolling]    = useState(false);
    const [stage,      setStage]      = useState(0);
    const [stageLabel, setStageLabel] = useState('Generating Questions');
    const [elapsed,    setElapsed]    = useState(0);
    const [error,      setError]      = useState(null);
    const [result,     setResult]     = useState(null);

    const intervalRef  = useRef(null);
    const startTimeRef = useRef(null);
    const onCompleteRef = useRef(null);
    const onErrorRef   = useRef(null);

    const stopPolling = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        setPolling(false);
    }, []);

    const startPolling = useCallback((newTaskId, { onComplete, onError } = {}) => {
        setTaskId(newTaskId);
        setPolling(true);
        setStage(0);
        setStageLabel('Generating Questions');
        setElapsed(0);
        setError(null);
        setResult(null);
        startTimeRef.current = Date.now();
        onCompleteRef.current = onComplete;
        onErrorRef.current    = onError;
    }, []);

    // Elapsed timer
    useEffect(() => {
        if (!polling) return;
        const timer = setInterval(() => {
            setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
        }, 1000);
        return () => clearInterval(timer);
    }, [polling]);

    // Poll loop
    useEffect(() => {
        if (!polling || !taskId) return;

        const doPoll = async () => {
            try {
                const res = await api.get(`/quiz/generate/status/${taskId}`);
                const { status, stage: s, stageLabel: sl, result: r, error: e } = res.data;

                if (s !== undefined) setStage(s);
                if (sl)              setStageLabel(sl);

                if (status === 'COMPLETED' && r) {
                    stopPolling();
                    setResult(r);
                    if (onCompleteRef.current) onCompleteRef.current(r);
                } else if (status === 'FAILED') {
                    stopPolling();
                    const msg = e || 'Generation failed. Please try again.';
                    setError(msg);
                    if (onErrorRef.current) onErrorRef.current(msg);
                } else if (status === 'EXPIRED' || status === 'NOT_FOUND') {
                    stopPolling();
                    const msg = 'Task expired. Please regenerate.';
                    setError(msg);
                    if (onErrorRef.current) onErrorRef.current(msg);
                }
                // RUNNING: continue polling
            } catch (err) {
                // Network error: don't stop — keep retrying
                console.warn('[Poller] Poll error:', err.message);
            }
        };

        intervalRef.current = setInterval(doPoll, POLL_INTERVAL_MS);
        doPoll(); // immediate first poll

        return () => clearInterval(intervalRef.current);
    }, [polling, taskId, stopPolling]);

    return { polling, stage, stageLabel, elapsed, error, result, startPolling, stopPolling };
}
