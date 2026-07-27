import { useEffect, useRef, useState, useCallback } from 'react';
import socket from '../utils/socket';
import toast from 'react-hot-toast';
import { showError } from '../utils/alerts';

/**
 * useExamProctoring — Centralised Exam Security & Proctoring Hook.
 *
 * Requirements Met:
 *  1. Strict Fullscreen Enforcement (quiz available only in fullscreen mode)
 *  2. 1-Pixel Screen Reduction & Split-Screen Detection (monitored & logged)
 *  3. Tab-switch limit: max 2 switches → auto-submits & terminates student to report page
 *  4. Continuous Focus Loss: 30s warning, 60s (1 min) auto-submits & terminates student to report page
 *  5. DevTools & Screenshot shortcut blocking
 *  6. Copy/Paste/Cut/ContextMenu blocking
 */
export default function useExamProctoring({
    enabled = false,
    quizId = '',
    userId = '',
    maxTabSwitches = 2,
    onAutoSubmit = null,
} = {}) {
    const [tabSwitchCount, setTabSwitchCount] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(true);
    const [isSplitScreen, setIsSplitScreen] = useState(false);
    const [lostFocusSeconds, setLostFocusSeconds] = useState(0);
    const [isTerminated, setIsTerminated] = useState(false);

    const autoSubmittedRef = useRef(false);

    // Trigger auto-submit once & terminate student session
    const triggerAutoSubmit = useCallback((reason) => {
        if (autoSubmittedRef.current) return;
        autoSubmittedRef.current = true;
        setIsTerminated(true);

        if (quizId && userId) {
            socket.emit('student_cheated_alert', {
                quizId,
                studentId: userId,
                action: 'auto_submit_terminated',
                reason,
                timestamp: new Date(),
            });
        }

        if (typeof onAutoSubmit === 'function') {
            onAutoSubmit(reason);
        }
    }, [quizId, userId, onAutoSubmit]);

    // ─── 1. Fullscreen Mode & 1-Pixel Screen Reduction / Split Screen Detection ───
    const requestFullscreenMode = useCallback(async () => {
        try {
            if (!document.fullscreenElement) {
                await document.documentElement.requestFullscreen();
                setIsFullscreen(true);
            }
        } catch (e) {
            console.warn('Fullscreen request failed:', e);
        }
    }, []);

    useEffect(() => {
        if (!enabled || isTerminated) return;

        // Automatically request fullscreen on mount
        requestFullscreenMode();

        const checkScreenIntegrity = () => {
            const inFS = !!document.fullscreenElement;
            setIsFullscreen(inFS);

            // Detect if screen width or height is reduced by even 1 pixel
            const widthDiff = window.screen.availWidth - window.innerWidth;
            const heightDiff = window.screen.availHeight - window.innerHeight;
            const splitDetected = !inFS || widthDiff > 15 || heightDiff > 35;

            setIsSplitScreen(splitDetected);

            if (splitDetected && quizId && userId) {
                socket.emit('student_cheated_alert', {
                    quizId,
                    studentId: userId,
                    action: 'split_screen_detected',
                    details: {
                        widthDiff: Math.max(0, widthDiff),
                        heightDiff: Math.max(0, heightDiff),
                        isFullscreen: inFS,
                    },
                    timestamp: new Date(),
                });
            }
        };

        checkScreenIntegrity();
        window.addEventListener('resize', checkScreenIntegrity);
        document.addEventListener('fullscreenchange', checkScreenIntegrity);

        return () => {
            window.removeEventListener('resize', checkScreenIntegrity);
            document.removeEventListener('fullscreenchange', checkScreenIntegrity);
        };
    }, [enabled, isTerminated, requestFullscreenMode, quizId, userId]);

    // ─── 2. Tab Switch Integrity Monitoring (Max 2 Switches) ──────────────────
    useEffect(() => {
        if (!enabled || isTerminated) return;

        const handleVisibilityChange = () => {
            if (document.hidden) {
                setTabSwitchCount((prevCount) => {
                    const newCount = prevCount + 1;

                    if (quizId && userId) {
                        socket.emit('student_cheated_alert', {
                            quizId,
                            studentId: userId,
                            action: 'tab_switch',
                            switchCount: newCount,
                            timestamp: new Date(),
                        });
                    }

                    if (newCount >= maxTabSwitches) {
                        toast.error(`🚨 Tab switch limit reached (${newCount}/${maxTabSwitches})! Auto-submitting & terminating exam...`, {
                            duration: 5000,
                            id: 'tab-switch-terminate',
                            style: { background: '#7f1d1d', color: '#ffffff', fontWeight: 'bold' }
                        });
                        triggerAutoSubmit(`Tab switch limit reached (${newCount}/${maxTabSwitches})`);
                    } else {
                        toast.error(`⚠️ Integrity Warning: Tab switch detected! (${newCount}/${maxTabSwitches}). Switching tabs 1 more time will terminate your exam!`, {
                            duration: 5000,
                            id: 'tab-switch-warning',
                            style: { background: '#991b1b', color: '#ffffff', fontWeight: 'bold' }
                        });
                    }

                    return newCount;
                });
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [enabled, isTerminated, maxTabSwitches, quizId, userId, triggerAutoSubmit]);

    // ─── 3. Consecutive 1-Minute Focus Loss (30s Warning, 60s Auto-Submit) ───
    useEffect(() => {
        if (!enabled || isTerminated) return;

        let intervalId = null;

        const startFocusTimer = () => {
            if (!intervalId) {
                intervalId = setInterval(() => {
                    setLostFocusSeconds((prevSec) => {
                        const newSec = prevSec + 1;

                        // 30-Second Warning
                        if (newSec === 30) {
                            toast.error(`⚠️ FOCUS WARNING: Exam lost focus for 30s! Auto-submitting in 30s if focus is not restored!`, {
                                duration: 8000,
                                id: 'focus-30s-warning',
                                style: { background: '#b45309', color: '#ffffff', fontWeight: 'bold' }
                            });

                            if (quizId && userId) {
                                socket.emit('student_cheated_alert', {
                                    quizId,
                                    studentId: userId,
                                    action: 'window_blur_30s',
                                    timestamp: new Date(),
                                });
                            }
                        }

                        // 60-Second (1 Minute Consecutively) -> Auto Submit
                        if (newSec >= 60) {
                            toast.error(`🚨 Focus lost for 1 minute consecutively! Auto-submitting & terminating exam...`, {
                                duration: 5000,
                                id: 'focus-60s-terminate',
                                style: { background: '#7f1d1d', color: '#ffffff', fontWeight: 'bold' }
                            });

                            if (quizId && userId) {
                                socket.emit('student_cheated_alert', {
                                    quizId,
                                    studentId: userId,
                                    action: 'window_blur_60s_terminated',
                                    timestamp: new Date(),
                                });
                            }

                            triggerAutoSubmit('Lost focus for 1 minute consecutively');
                        }

                        return newSec;
                    });
                }, 1000);
            }
        };

        const stopFocusTimer = () => {
            if (intervalId) {
                clearInterval(intervalId);
                intervalId = null;
            }
            setLostFocusSeconds(0);
        };

        const handleBlur = () => {
            startFocusTimer();
            if (quizId && userId) {
                socket.emit('student_cheated_alert', {
                    quizId,
                    studentId: userId,
                    action: 'window_blur',
                    timestamp: new Date(),
                });
            }
        };

        const handleFocus = () => {
            stopFocusTimer();
        };

        window.addEventListener('blur', handleBlur);
        window.addEventListener('focus', handleFocus);

        // Check initial state
        if (!document.hasFocus() || document.hidden) {
            startFocusTimer();
        }

        return () => {
            window.removeEventListener('blur', handleBlur);
            window.removeEventListener('focus', handleFocus);
            stopFocusTimer();
        };
    }, [enabled, isTerminated, quizId, userId, triggerAutoSubmit]);

    // ─── 4. DevTools & Screenshot Shortcut Interception ──────────────────────
    useEffect(() => {
        if (!enabled || isTerminated) return;

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
                const label = isPrintScreen || isScreenshotCombo ? 'Screenshot captures are prohibited!' : 'Developer tools are disabled during examinations!';

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
    }, [enabled, isTerminated, quizId, userId]);

    // ─── 5. Clipboard & Context Menu Blocking ────────────────────────────────
    useEffect(() => {
        if (!enabled || isTerminated) return;

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
    }, [enabled, isTerminated]);

    return {
        tabSwitchCount,
        isFullscreen,
        isSplitScreen,
        lostFocusSeconds,
        isTerminated,
        requestFullscreenMode
    };
}

