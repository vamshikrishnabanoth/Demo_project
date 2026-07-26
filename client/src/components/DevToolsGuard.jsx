import { useEffect } from 'react';
import toast from 'react-hot-toast';

/**
 * DevToolsGuard — Global Security Shield
 * 
 * Prevents unauthorized access to DevTools and source inspection:
 * 1. Blocks right-click context menu globally
 * 2. Blocks F12, Ctrl+Shift+I/J/C, Ctrl+U, Cmd+Option+I/J/C keyboard shortcuts
 * 3. Monitors window resize heuristics associated with detached/docked DevTools
 */
export default function DevToolsGuard() {
    useEffect(() => {
        let lastWarnTime = 0;

        const showSecurityWarning = (msg) => {
            const now = Date.now();
            if (now - lastWarnTime > 3000) {
                lastWarnTime = now;
                toast.error(`🔒 ${msg}`, {
                    duration: 3000,
                    id: 'devtools-security-warning',
                    style: {
                        borderRadius: '1rem',
                        background: '#0f172a',
                        color: '#ffffff',
                        fontWeight: 'bold',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                    }
                });
            }
        };

        // 1. Block Context Menu (Right Click)
        const handleContextMenu = (e) => {
            e.preventDefault();
            showSecurityWarning('Right-click inspect is disabled for application security.');
        };

        // 2. Block Keyboard Shortcuts (F12, Ctrl+Shift+I/J/C, Ctrl+U, etc.)
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
                showSecurityWarning('Developer tools shortcuts are disabled for application security.');
                return false;
            }
        };

        // 3. DevTools Open Detection via Dimension Heuristics
        const checkDevToolsResize = () => {
            const THRESHOLD = 180;
            const widthDiff = window.outerWidth - window.innerWidth;
            const heightDiff = window.outerHeight - window.innerHeight;

            if (widthDiff > THRESHOLD || heightDiff > THRESHOLD) {
                showSecurityWarning('Developer tools panel detected. Activity is monitored.');
            }
        };

        // Attach listeners with capture phase to prevent bypasses
        document.addEventListener('contextmenu', handleContextMenu, true);
        window.addEventListener('keydown', handleKeyDown, true);
        window.addEventListener('resize', checkDevToolsResize);

        const checkInterval = setInterval(checkDevToolsResize, 2000);

        return () => {
            document.removeEventListener('contextmenu', handleContextMenu, true);
            window.removeEventListener('keydown', handleKeyDown, true);
            window.removeEventListener('resize', checkDevToolsResize);
            clearInterval(checkInterval);
        };
    }, []);

    return null;
}
