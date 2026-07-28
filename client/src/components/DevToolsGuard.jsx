import { useEffect } from 'react';
import socket from '../utils/socket';

/**
 * DevToolsGuard — Global Security Shield (Silent Protection)
 * 
 * Prevents unauthorized access to DevTools and source inspection:
 * 1. Silently blocks right-click context menu globally
 * 2. Silently blocks F12, Ctrl+Shift+I/J/C, Ctrl+U, Cmd+Option+I/J/C keyboard shortcuts
 * 3. Silently monitors window resize heuristics for DevTools opening and emits cheating alert to server without popups
 */
export default function DevToolsGuard() {
    useEffect(() => {
        let lastReportTime = 0;

        const reportDevToolsEvent = (action, details = {}) => {
            const now = Date.now();
            if (now - lastReportTime > 4000) {
                lastReportTime = now;
                // Emit silent cheat alert to socket if connected
                if (socket && socket.connected) {
                    try {
                        socket.emit('student_cheated_alert', {
                            action,
                            details,
                            timestamp: new Date()
                        });
                    } catch (e) {
                        // ignore socket errors silently
                    }
                }
            }
        };

        // 1. Block Context Menu (Right Click) silently (No Toast Popups)
        const handleContextMenu = (e) => {
            e.preventDefault();
        };

        // 2. Block Keyboard Shortcuts (F12, Ctrl+Shift+I/J/C, Ctrl+U, etc.) silently
        const handleKeyDown = (e) => {
            const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
            const metaKey = isMac ? e.metaKey : e.ctrlKey;

            const isF12 = e.key === 'F12' || e.keyCode === 123;
            const isInspectShortcut = e.shiftKey && metaKey && (
                e.key === 'I' || e.key === 'i' ||
                e.key === 'J' || e.key === 'j' ||
                e.key === 'C' || e.key === 'c' ||
                e.key === 'K' || e.key === 'k'
            );
            const isViewSourceShortcut = metaKey && (e.key === 'U' || e.key === 'u' || e.key === 'S' || e.key === 's');
            const isShiftF10 = e.shiftKey && (e.key === 'F10' || e.keyCode === 121);

            if (isF12 || isInspectShortcut || isViewSourceShortcut || isShiftF10) {
                e.preventDefault();
                e.stopPropagation();
                reportDevToolsEvent('devtools_shortcut', { key: e.key });
                return false;
            }
        };

        // 3. DevTools Open Detection via Dimension Heuristics (Silent)
        const checkDevToolsResize = () => {
            const THRESHOLD = 180;
            const widthDiff = window.outerWidth - window.innerWidth;
            const heightDiff = window.outerHeight - window.innerHeight;

            if (widthDiff > THRESHOLD || heightDiff > THRESHOLD) {
                reportDevToolsEvent('devtools_panel_opened', { widthDiff, heightDiff });
            }
        };

        // Attach listeners with capture phase
        document.addEventListener('contextmenu', handleContextMenu, true);
        window.addEventListener('keydown', handleKeyDown, true);
        window.addEventListener('resize', checkDevToolsResize);

        const checkInterval = setInterval(checkDevToolsResize, 2500);

        return () => {
            document.removeEventListener('contextmenu', handleContextMenu, true);
            window.removeEventListener('keydown', handleKeyDown, true);
            window.removeEventListener('resize', checkDevToolsResize);
            clearInterval(checkInterval);
        };
    }, []);

    return null;
}
