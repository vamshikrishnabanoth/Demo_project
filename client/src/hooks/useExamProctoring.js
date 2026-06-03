import { useEffect, useRef, useState, useCallback } from 'react';
import socket from '../utils/socket';
import toast from 'react-hot-toast';

/**
 * useExamProctoring — Centralised exam-integrity hook.
 *
 * Features:
 *  1. Strict fullscreen mode (request on mount, re-request on exit)
 *  2. Tab-switch counter with auto-submit when limit exceeded
 *  3. DevTools keyboard shortcut blocking (F12, Ctrl+Shift+I/J/C, Ctrl+U)
 *  4. Window size-change heuristic (outerHeight − innerHeight > threshold)
 *  5. Copy / Paste / Cut / ContextMenu blocking
 *
 * @param {Object}   opts
 * @param {boolean}  opts.enabled        – Activate proctoring (false during review/result/loading)
 * @param {string}   opts.quizId         – Current quiz ID (for socket events)
 * @param {string}   opts.userId         – Current user ID (for socket events)
 * @param {number}  [opts.maxTabSwitches=2] – Auto-submit after this many tab switches
 * @param {Function} opts.onAutoSubmit   – Callback invoked when tab-switch limit is reached
 *
 * @returns {{ tabSwitchCount: number, isFullscreen: boolean }}
 */
export default function useExamProctoring({
    enabled = false,
    quizId = '',
    userId = '',
    maxTabSwitches = 2,
    onAutoSubmit,
} = {}) {
    const [tabSwitchCount, setTabSwitchCount] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Refs to survive across re-renders without stale closures
    const tabSwitchRef = useRef(0);
    const autoSubmitRef = useRef(onAutoSubmit);
    const hasAutoSubmitted = useRef(false);

    // Keep the callback ref current
    useEffect(() => {
        autoSubmitRef.current = onAutoSubmit;
    }, [onAutoSubmit]);

    // Reset state when proctoring is toggled off/on (e.g. new quiz)
    useEffect(() => {
        if (!enabled) {
            tabSwitchRef.current = 0;
            hasAutoSubmitted.current = false;
            setTabSwitchCount(0);
        }
    }, [enabled]);

    // ─── 1. Strict Fullscreen ────────────────────────────────────────────────
    useEffect(() => {
        if (!enabled) return;

        const requestFS = () => {
            const el = document.documentElement;
            if (!document.fullscreenElement) {
                el.requestFullscreen?.().catch(() => {
                    // Fullscreen refused (mobile / user denied)
                    toast.error(
                        'Fullscreen mode is required during examinations. Some browsers may not support this feature.',
                        { id: 'fs-denied-toast', duration: 6000 }
                    );
                });
            }
        };

        // Initial request (small delay so the page renders first)
        const initTimer = setTimeout(requestFS, 600);

        const onFSChange = () => {
            const inFS = !!document.fullscreenElement;
            setIsFullscreen(inFS);
            if (!inFS && enabled) {
                toast.error(
                    '⚠️ SECURITY: You exited fullscreen! Re-entering fullscreen mode…',
                    { id: 'fs-exit-toast', duration: 4000 }
                );
                // Emit alert to teacher
                if (quizId && userId) {
                    socket.emit('student_cheated_alert', {
                        quizId,
                        studentId: userId,
                        action: 'fullscreen_exit',
                        timestamp: new Date(),
                    });
                }
                // Re-request after a brief pause (browsers require user gesture sometimes)
                setTimeout(requestFS, 800);
            }
        };

        document.addEventListener('fullscreenchange', onFSChange);
        // Set initial state
        setIsFullscreen(!!document.fullscreenElement);

        return () => {
            clearTimeout(initTimer);
            document.removeEventListener('fullscreenchange', onFSChange);
            // Exit fullscreen on unmount
            if (document.fullscreenElement) {
                document.exitFullscreen?.().catch(() => {});
            }
        };
    }, [enabled, quizId, userId]);

    // ─── 2. Tab-Switch Counter + Auto-Submit ─────────────────────────────────
    useEffect(() => {
        if (!enabled) return;

        const handleVisibility = () => {
            if (!document.hidden) return; // Only count when leaving

            tabSwitchRef.current += 1;
            const count = tabSwitchRef.current;
            setTabSwitchCount(count);

            // Emit cheat alert to server
            if (quizId && userId) {
                socket.emit('student_cheated_alert', {
                    quizId,
                    studentId: userId,
                    action: 'tab_switch',
                    count,
                    timestamp: new Date(),
                });
            }

            if (count >= maxTabSwitches) {
                toast.error(
                    `🚨 CRITICAL: Tab-switch limit (${maxTabSwitches}) exceeded! Your quiz is being auto-submitted.`,
                    { id: 'tab-limit-toast', duration: 8000 }
                );
                if (!hasAutoSubmitted.current && autoSubmitRef.current) {
                    hasAutoSubmitted.current = true;
                    autoSubmitRef.current();
                }
            } else {
                const remaining = maxTabSwitches - count;
                toast.error(
                    `⚠️ Tab Switch Detected! ${remaining} chance${remaining > 1 ? 's' : ''} remaining before auto-submit.`,
                    { id: 'tab-warn-toast', duration: 5000 }
                );
            }
        };

        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener('visibilitychange', handleVisibility);
    }, [enabled, quizId, userId, maxTabSwitches]);

    // ─── 3. DevTools Keyboard Shortcut Blocking ──────────────────────────────
    useEffect(() => {
        if (!enabled) return;

        const handleKeyDown = (e) => {
            const blocked =
                e.key === 'F12' ||
                (e.ctrlKey && e.shiftKey && ['I', 'i', 'J', 'j', 'C', 'c'].includes(e.key)) ||
                (e.ctrlKey && ['U', 'u'].includes(e.key));

            if (blocked) {
                e.preventDefault();
                e.stopPropagation();
                toast.error(
                    '🔒 SECURITY: Developer tools are disabled during examinations!',
                    { id: 'devtools-block-toast', duration: 4000 }
                );
                // Emit alert
                if (quizId && userId) {
                    socket.emit('student_cheated_alert', {
                        quizId,
                        studentId: userId,
                        action: 'devtools_shortcut',
                        key: e.key,
                        timestamp: new Date(),
                    });
                }
            }
        };

        // Use capture phase to intercept before any other handler
        document.addEventListener('keydown', handleKeyDown, true);
        return () => document.removeEventListener('keydown', handleKeyDown, true);
    }, [enabled, quizId, userId]);

    // ─── 4. Window Size-Change Heuristic (DevTools detection) ────────────────
    useEffect(() => {
        if (!enabled) return;

        const THRESHOLD = 200; // px difference between outer and inner height
        let lastWarned = 0;

        const checkSize = () => {
            const diff = window.outerHeight - window.innerHeight;
            const widthDiff = window.outerWidth - window.innerWidth;
            if (diff > THRESHOLD || widthDiff > THRESHOLD) {
                const now = Date.now();
                // Throttle warnings to once every 10 seconds
                if (now - lastWarned < 10000) return;
                lastWarned = now;

                toast.error(
                    '⚠️ SECURITY: Unusual window size detected! DevTools may be open. This activity is being monitored.',
                    { id: 'resize-heuristic-toast', duration: 6000 }
                );
                if (quizId && userId) {
                    socket.emit('student_cheated_alert', {
                        quizId,
                        studentId: userId,
                        action: 'devtools_resize',
                        heightDiff: diff,
                        widthDiff,
                        timestamp: new Date(),
                    });
                }
            }
        };

        // Check on resize events and periodically
        window.addEventListener('resize', checkSize);
        const intervalId = setInterval(checkSize, 1000);

        return () => {
            window.removeEventListener('resize', checkSize);
            clearInterval(intervalId);
        };
    }, [enabled, quizId, userId]);

    // ─── 5. Copy / Paste / Cut / Context Menu Blocking ──────────────────────
    useEffect(() => {
        if (!enabled) return;

        const blockClipboard = (e) => {
            e.preventDefault();
            toast.error(
                '🔒 SECURITY: Copy/Paste/Cut is disabled during examinations!',
                { id: 'clipboard-block-toast' }
            );
        };

        const blockContextMenu = (e) => {
            e.preventDefault();
            toast.error(
                '🔒 SECURITY: Right-click is disabled during examinations!',
                { id: 'context-block-toast' }
            );
        };

        document.addEventListener('copy', blockClipboard);
        document.addEventListener('paste', blockClipboard);
        document.addEventListener('cut', blockClipboard);
        document.addEventListener('contextmenu', blockContextMenu);

        return () => {
            document.removeEventListener('copy', blockClipboard);
            document.removeEventListener('paste', blockClipboard);
            document.removeEventListener('cut', blockClipboard);
            document.removeEventListener('contextmenu', blockContextMenu);
        };
    }, [enabled]);

    return { tabSwitchCount, isFullscreen };
}
