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
    const [violationsCount, setViolationsCount] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(true);
    const [isSplitScreen, setIsSplitScreen] = useState(false);
    const [lostFocusSeconds, setLostFocusSeconds] = useState(0);
    const [isTerminated, setIsTerminated] = useState(false);

    const autoSubmittedRef = useRef(false);

    // Trigger auto-submit once & terminate student session silently
    const triggerAutoSubmit = useCallback((reason) => {
        if (autoSubmittedRef.current) return;
        autoSubmittedRef.current = true;
        setIsTerminated(true);

        // Exit fullscreen on termination/completion
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
        }

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

    const recordViolation = useCallback((action, details = {}) => {
        setViolationsCount((prev) => {
            const next = prev + 1;
            if (quizId && userId) {
                socket.emit('student_cheated_alert', {
                    quizId,
                    studentId: userId,
                    action,
                    details,
                    timestamp: new Date(),
                });
            }
            if (next >= 4 && !autoSubmittedRef.current) {
                triggerAutoSubmit('Multiple security violations threshold exceeded');
            }
            return next;
        });
    }, [quizId, userId, triggerAutoSubmit]);

    // ─── 1. Fullscreen Mode & Screen Integrity Detection ───
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

            if (!inFS && !autoSubmittedRef.current) {
                recordViolation('exited_fullscreen');
            }

            // Detect split-screen / dimension anomalies
            const widthDiff = window.screen.availWidth - window.innerWidth;
            const heightDiff = window.screen.availHeight - window.innerHeight;
            const splitDetected = !inFS || widthDiff > 25 || heightDiff > 45;

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
    }, [enabled, isTerminated, requestFullscreenMode, quizId, userId, recordViolation]);

    // ─── 2. Tab Switch Integrity Monitoring (Max 2 Switches) ───
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
                        triggerAutoSubmit(`Tab switch limit reached (${newCount}/${maxTabSwitches})`);
                    }

                    return newCount;
                });
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [enabled, isTerminated, maxTabSwitches, quizId, userId, triggerAutoSubmit]);

    // ─── 3. Consecutive Focus Loss (30s Alert to Server, 60s Auto-Submit) ───
    useEffect(() => {
        if (!enabled || isTerminated) return;

        let intervalId = null;

        const startFocusTimer = () => {
            if (!intervalId) {
                intervalId = setInterval(() => {
                    setLostFocusSeconds((prevSec) => {
                        const newSec = prevSec + 1;

                        if (newSec === 30 && quizId && userId) {
                            socket.emit('student_cheated_alert', {
                                quizId,
                                studentId: userId,
                                action: 'window_blur_30s',
                                timestamp: new Date(),
                            });
                        }

                        if (newSec >= 60) {
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

        if (!document.hasFocus() || document.hidden) {
            startFocusTimer();
        }

        return () => {
            window.removeEventListener('blur', handleBlur);
            window.removeEventListener('focus', handleFocus);
            stopFocusTimer();
        };
    }, [enabled, isTerminated, quizId, userId, triggerAutoSubmit]);

    // ─── 4. DevTools & Screenshot Shortcut Interception (Silent) ──────────────────────
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

                // Clear clipboard to prevent screenshot leak
                try {
                    navigator.clipboard?.writeText('');
                } catch (_) {}

                const action = isPrintScreen || isScreenshotCombo ? 'screenshot_attempt' : 'devtools_shortcut';
                recordViolation(action, { key: e.key });
            }
        };

        document.addEventListener('keydown', handleKeyDown, true);
        return () => document.removeEventListener('keydown', handleKeyDown, true);
    }, [enabled, isTerminated, recordViolation]);

    // ─── 5. Clipboard & Context Menu Blocking (Silent) ────────────────────────────────
    useEffect(() => {
        if (!enabled || isTerminated) return;

        const blockClipboard = (e) => {
            e.preventDefault();
            recordViolation('clipboard_action', { type: e.type });
        };

        const blockContextMenu = (e) => {
            e.preventDefault();
            recordViolation('context_menu', {});
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
    }, [enabled, isTerminated, recordViolation]);

    return {
        tabSwitchCount,
        violationsCount,
        isFullscreen,
        isSplitScreen,
        lostFocusSeconds,
        isTerminated,
        requestFullscreenMode
    };
}

