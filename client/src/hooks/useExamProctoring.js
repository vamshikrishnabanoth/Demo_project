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
 *
 * CRITICAL GUARDS:
 *  - Never log violations on initial mount / before fullscreen is first confirmed
 *  - Only log split-screen after user has been confirmed in fullscreen at least once
 *  - Only log fullscreen exit after user was previously IN fullscreen (not on load)
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

    // ── Guard Refs ────────────────────────────────────────────────────────────
    // hasEnteredFullscreen: true only after the student has been CONFIRMED in fullscreen at least once.
    // Prevents false positives on initial page load where browser is not in fullscreen yet.
    const hasEnteredFullscreenRef = useRef(false);

    // isInitialCheckRef: true during the very first checkScreenIntegrity call on mount.
    // We skip violation logging on the very first check (the "baseline" check).
    const isInitialCheckRef = useRef(true);

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
                hasEnteredFullscreenRef.current = true;
            }
        } catch (e) {
            console.warn('Fullscreen request failed:', e);
        }
    }, []);

    useEffect(() => {
        if (!enabled || isTerminated) return;

        // Request fullscreen on mount — only triggers when enabled (quiz started, not during lobby)
        requestFullscreenMode();

        // Reset the initial check guard for this mount
        isInitialCheckRef.current = true;

        const checkScreenIntegrity = () => {
            const inFS = !!document.fullscreenElement;
            setIsFullscreen(inFS);

            // Track when student first enters fullscreen
            if (inFS && !hasEnteredFullscreenRef.current) {
                hasEnteredFullscreenRef.current = true;
            }

            // ── FULLSCREEN EXIT VIOLATION ──────────────────────────────────
            // Only log if:
            //   a) NOT the very first check (isInitialCheckRef)
            //   b) Student WAS previously in fullscreen (hasEnteredFullscreenRef)
            //   c) Quiz has not been auto-submitted
            if (!inFS && !autoSubmittedRef.current) {
                if (!isInitialCheckRef.current && hasEnteredFullscreenRef.current) {
                    recordViolation('exited_fullscreen');
                }
            }

            // Clear the initial check flag after first run
            isInitialCheckRef.current = false;

            // ── SPLIT-SCREEN / RESIZE VIOLATION ───────────────────────────
            // Detect split-screen / dimension anomalies
            // Only flag if student HAS been in fullscreen before (not on initial load)
            const widthDiff = window.screen.availWidth - window.innerWidth;
            const heightDiff = window.screen.availHeight - window.innerHeight;
            // Split detected only when student left fullscreen AND window is significantly reduced
            const splitDetected = !inFS && hasEnteredFullscreenRef.current && (widthDiff > 25 || heightDiff > 45);

            setIsSplitScreen(splitDetected);

            if (splitDetected && quizId && userId && !isInitialCheckRef.current) {
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

        // Small delay before the initial check so requestFullscreen() can resolve first
        // This prevents a race where checkScreenIntegrity fires before the async requestFullscreen completes
        const initialCheckTimer = setTimeout(() => {
            checkScreenIntegrity();
        }, 500);

        window.addEventListener('resize', checkScreenIntegrity);
        document.addEventListener('fullscreenchange', checkScreenIntegrity);

        return () => {
            clearTimeout(initialCheckTimer);
            window.removeEventListener('resize', checkScreenIntegrity);
            document.removeEventListener('fullscreenchange', checkScreenIntegrity);
        };
    }, [enabled, isTerminated, requestFullscreenMode, quizId, userId, recordViolation]);

    // ─── 2. Tab Switch Integrity Monitoring (Max 2 Switches) ───
    useEffect(() => {
        if (!enabled || isTerminated) return;

        const handleVisibilityChange = () => {
            if (document.hidden) {
                // Only record tab switches after quiz has started (hasEnteredFullscreen = true for live)
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

        // Only start focus timer if window is ALREADY not focused when effect runs
        // (and only after quiz is active, which is guaranteed by `enabled` gate)
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
