import { useEffect, useRef, useState, useCallback } from 'react';
import socket from '../utils/socket';
import toast from 'react-hot-toast';
import Swal from 'sweetalert2';
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

    // ─── 1. Fullscreen Mode Removed ──────────────────────────────────────────
    // (Fullscreen is no longer requested or enforced)

    // ─── 2. Tab-Switch Monitoring Removed ─────────────────────────────────────
    // (Tab switches are no longer monitored or reported)

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
                if (!Swal.isVisible()) {
                    showError(
                        'Security Alert',
                        'Developer tools are disabled during examinations!'
                    );
                }
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

                if (!Swal.isVisible()) {
                    showError(
                        'Security Alert',
                        'Unusual window size detected! DevTools may be open. This activity is being monitored.'
                    );
                }
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
            if (!Swal.isVisible()) {
                showError(
                    'Security Alert',
                    'Copy/Paste/Cut is disabled during examinations!'
                );
            }
        };

        const blockContextMenu = (e) => {
            e.preventDefault();
            if (!Swal.isVisible()) {
                showError(
                    'Security Alert',
                    'Right-click is disabled during examinations!'
                );
            }
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
