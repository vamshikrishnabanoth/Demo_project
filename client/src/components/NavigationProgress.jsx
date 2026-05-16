import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * NavigationProgress
 * A YouTube/GitHub-style thin top progress bar.
 * Fires on every route change, gives instant visual feedback.
 * Completes after the new component has had time to mount.
 */
const NavigationProgress = () => {
    const location  = useLocation();
    const [state, setState] = useState({ active: false, progress: 0 });
    const timers    = useRef([]);

    const clearTimers = () => {
        timers.current.forEach(clearTimeout);
        timers.current = [];
    };

    const schedule = (fn, delay) => {
        const id = setTimeout(fn, delay);
        timers.current.push(id);
    };

    useEffect(() => {
        clearTimers();

        // Instantly show bar at 0 and begin rapid fill
        setState({ active: true, progress: 0 });

        schedule(() => setState(s => ({ ...s, progress: 25 })),  30);
        schedule(() => setState(s => ({ ...s, progress: 55 })), 150);
        schedule(() => setState(s => ({ ...s, progress: 75 })), 300);
        schedule(() => setState(s => ({ ...s, progress: 88 })), 500);

        // Complete: new page has mounted, snap to 100 then fade out
        schedule(() => setState(s => ({ ...s, progress: 100 })), 650);
        schedule(() => setState({ active: false, progress: 0 }),  950);

        return clearTimers;
    }, [location.pathname]);

    return (
        <AnimatePresence>
            {state.active && (
                <motion.div
                    key="nav-progress"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, transition: { duration: 0.3 } }}
                    className="fixed top-0 left-0 right-0 z-[9999] h-[2px] pointer-events-none"
                    style={{ background: 'transparent' }}
                >
                    {/* Main fill bar */}
                    <motion.div
                        className="h-full origin-left"
                        style={{ background: 'var(--bg-accent)' }}
                        animate={{ scaleX: state.progress / 100 }}
                        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                    />
                    {/* Glow effect at the tip */}
                    <motion.div
                        className="absolute top-0 right-0 w-24 h-full"
                        style={{
                            background: 'linear-gradient(to left, var(--bg-accent), transparent)',
                            opacity: state.progress < 100 ? 0.8 : 0,
                            filter: 'blur(4px)',
                        }}
                        animate={{ opacity: state.progress < 100 ? 0.8 : 0 }}
                        transition={{ duration: 0.2 }}
                    />
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default NavigationProgress;
