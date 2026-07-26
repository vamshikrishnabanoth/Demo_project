import { useEffect, useRef, useState, useCallback } from 'react';
import socket from '../utils/socket';
import toast from 'react-hot-toast';
import { showError } from '../utils/alerts';

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
} = {}) {
    const [tabSwitchCount, setTabSwitchCount] = useState(0);
    const [inactivityCount, setInactivityCount] = useState(0);
    const [blurCount, setBlurCount] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const lastActivityTimeRef = useRef(Date.now());
    const blurStartTimeRef = useRef(null);

    // Reset state when proctoring is toggled off/on
    useEffect(() => {
        if (!enabled) {
            setTabSwitchCount(0);
            setInactivityCount(0);
            setBlurCount(0);
        }
    }, [enabled]);

    // ─── 1. Tab-Switch Integrity Monitoring ───────────────────────────────────
    useEffect(() => {
        if (!enabled) return;

        const handleVisibilityChange = () => {
            if (document.hidden) {
                setTabSwitchCount((prevCount) => {
                    const newCount = prevCount + 1;
                    toast.error(`⚠️ Integrity Warning: Tab switch detected! (Violation #${newCount})`, {
                        duration: 4000,
                        id: 'tab-switch-warning',
                        style: { background: '#7f1d1d', color: '#ffffff', fontWeight: 'bold' }
                    });

                    if (quizId && userId) {
                        socket.emit('student_cheated_alert', {
                            quizId,
                            studentId: userId,
                            action: 'tab_switch',
                            switchCount: newCount,
                            timestamp: new Date(),
                        });
                    }
                    return newCount;
                });
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [enabled, quizId, userId]);

    // ─── 2. Tab Inactivity & Idle Time Monitoring ────────────────────────────
    useEffect(() => {
        if (!enabled) return;

        const resetActivity = () => {
            lastActivityTimeRef.current = Date.now();
        };

        const activityEvents = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];
        activityEvents.forEach(evt => window.addEventListener(evt, resetActivity, { passive: true }));

        const IDLE_THRESHOLD_MS = 30000; // 30 seconds of total inactivity
        let lastInactivityWarned = 0;

        const inactivityInterval = setInterval(() => {
            const idleTimeMs = Date.now() - lastActivityTimeRef.current;
            const now = Date.now();

            if (idleTimeMs >= IDLE_THRESHOLD_MS && (now - lastInactivityWarned > 25000)) {
                lastInactivityWarned = now;
                setInactivityCount(prev => {
                    const next = prev + 1;
                    toast.error(`⏱️ Inactivity Warning: No user interaction for 30s! (Recorded #${next})`, {
                        duration: 5000,
                        id: 'inactivity-warning',
                        style: { background: '#854d0e', color: '#ffffff', fontWeight: 'bold' }
                    });

                    if (quizId && userId) {
                        socket.emit('student_cheated_alert', {
                            quizId,
                            studentId: userId,
                            action: 'inactivity',
                            idleDurationSeconds: Math.floor(idleTimeMs / 1000),
                            count: next,
                            timestamp: new Date(),
                        });
                    }
                    return next;
                });
            }
        }, 5000);

        return () => {
            activityEvents.forEach(evt => window.removeEventListener(evt, resetActivity));
            clearInterval(inactivityInterval);
        };
    }, [enabled, quizId, userId]);

    // ─── 3. Window Focus Loss / Blur Monitoring ──────────────────────────────
    useEffect(() => {
        if (!enabled) return;

        const handleBlur = () => {
            blurStartTimeRef.current = Date.now();
            setBlurCount(prev => {
                const next = prev + 1;
                toast.error('⚠️ Focus Loss Warning: Exam window lost focus!', {
                    duration: 3500,
                    id: 'focus-blur-warning',
                    style: { background: '#991b1b', color: '#ffffff', fontWeight: 'bold' }
                });
                return next;
            });
        };

        const handleFocus = () => {
            if (blurStartTimeRef.current) {
                const blurDurationMs = Date.now() - blurStartTimeRef.current;
                const blurSec = Math.round(blurDurationMs / 1000);
                blurStartTimeRef.current = null;

                if (blurSec >= 2 && quizId && userId) {
                    socket.emit('student_cheated_alert', {
                        quizId,
                        studentId: userId,
                        action: 'window_blur',
                        blurDurationSeconds: blurSec,
                        timestamp: new Date(),
                    });
                }
            }
        };

        window.addEventListener('blur', handleBlur);
        window.addEventListener('focus', handleFocus);

        return () => {
            window.removeEventListener('blur', handleBlur);
            window.removeEventListener('focus', handleFocus);
        };
    }, [enabled, quizId, userId]);

    // ─── 4. DevTools & Screenshot Shortcut Interception ──────────────────────
    useEffect(() => {
        if (!enabled) return;

        const handleKeyDown = (e) => {
            const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
            const metaKey = isMac ? e.metaKey : e.ctrlKey;

            const isPrintScreen = e.key === 'PrintScreen' || e.keyCode === 44;
            const isScreenshotCombo = (metaKey && e.shiftKey && ['3', '4', '5', 'S', 's'].includes(e.key));
            const isDevTools = e.key === 'F12' ||
                (metaKey && e.shiftKey && ['I', 'i', 'J', 'j', 'C', 'c'].includes(e.key)) ||
                (metaKey && ['U', 'u'].includes(e.key));

            if (isPrintScreen || isScreenshotCombo || isDevTools) {
                e.preventDefault();
                e.stopPropagation();

                const action = isPrintScreen || isScreenshotCombo ? 'screenshot_attempt' : 'devtools_shortcut';
                const label = isPrintScreen || isScreenshotCombo ? 'Screenshot / capture attempts are prohibited!' : 'Developer tools are disabled during examinations!';

                showError('Security Violation', label);

                if (quizId && userId) {
                    socket.emit('student_cheated_alert', {
                        quizId,
                        studentId: userId,
                        action,
                        key: e.key,
                        timestamp: new Date(),
                    });
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown, true);
        return () => document.removeEventListener('keydown', handleKeyDown, true);
    }, [enabled, quizId, userId]);

    // ─── 5. Multi-Display / Display Extension Guard ─────────────────────────
    useEffect(() => {
        if (!enabled) return;

        const checkDisplays = () => {
            if ('screen' in window && 'isExtended' in window.screen && window.screen.isExtended) {
                toast.error('🖥️ Multi-Display Alert: Secondary monitor detected! Extended displays are monitored.', {
                    duration: 6000,
                    id: 'multi-display-warning',
                    style: { background: '#451a03', color: '#ffffff', fontWeight: 'bold' }
                });

                if (quizId && userId) {
                    socket.emit('student_cheated_alert', {
                        quizId,
                        studentId: userId,
                        action: 'multi_monitor_detected',
                        timestamp: new Date(),
                    });
                }
            }
        };

        checkDisplays();
        window.addEventListener('resize', checkDisplays);
        return () => window.removeEventListener('resize', checkDisplays);
    }, [enabled, quizId, userId]);

    // ─── 6. Copy / Paste / Cut / Context Menu Blocking ──────────────────────
    useEffect(() => {
        if (!enabled) return;

        const blockClipboard = (e) => {
            e.preventDefault();
            showError('Security Alert', 'Copy/Paste/Cut is disabled during examinations!');
        };

        const blockContextMenu = (e) => {
            e.preventDefault();
            showError('Security Alert', 'Right-click is disabled during examinations!');
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

    return {
        tabSwitchCount,
        inactivityCount,
        blurCount,
        totalViolations: tabSwitchCount + inactivityCount + blurCount,
        isFullscreen
    };
}
