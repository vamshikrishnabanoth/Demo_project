import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';

export default function SubmissionSequence({ 
    selectedOption = "A", 
    questionText = "Question complete.",
    onComplete 
}) {
    const [progress, setProgress] = useState(0);
    const [showCheck, setShowCheck] = useState(false);
    const [showConfetti, setShowConfetti] = useState(false);
    const [crashed, setCrashed] = useState(false);

    // Reduced Motion Detection
    const shouldReduceMotion = typeof window !== 'undefined' 
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches 
        : false;

    // Safety Timeout - max 2500ms
    useEffect(() => {
        if (shouldReduceMotion) {
            onComplete();
            return;
        }

        const safetyTimer = setTimeout(() => {
            onComplete();
        }, 2500);

        return () => clearTimeout(safetyTimer);
    }, [onComplete, shouldReduceMotion]);

    // Keyboard support - Escape key to skip directly
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                onComplete();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onComplete]);

    // Animation timeline control
    useEffect(() => {
        if (shouldReduceMotion || crashed) return;

        try {
            // Animate progress ring 0 -> 100 over 1200ms
            const startTime = performance.now();
            const duration = 1200;

            const animateRing = (now) => {
                const elapsed = now - startTime;
                const pct = Math.min(elapsed / duration, 1);
                setProgress(pct * 100);

                if (pct < 1) {
                    requestAnimationFrame(animateRing);
                } else {
                    // Start checkmark drawing & confetti burst
                    setShowCheck(true);
                    setTimeout(() => setShowConfetti(true), 150);
                    // Complete sequence in another 800ms
                    setTimeout(() => {
                        onComplete();
                    }, 800);
                }
            };
            requestAnimationFrame(animateRing);
        } catch (err) {
            console.error("Submission animation failed, skipping:", err);
            setCrashed(true);
            onComplete(); // Skip immediately on crash
        }
    }, [shouldReduceMotion, crashed, onComplete]);

    if (shouldReduceMotion || crashed) {
        return null;
    }

    // SVG parameters
    const radius = 50;
    const strokeWidth = 8;
    const normalizedRadius = radius - strokeWidth * 2;
    const circumference = normalizedRadius * 2 * Math.PI;
    const strokeDashoffset = circumference - (progress / 100) * circumference;

    // Confetti particles definition (Strictly derived from theme colors)
    const particleColors = [
        'var(--bg-accent, #D7AC28)',
        'var(--success-bg, #22c55e)',
        'var(--text-accent, #D7AC28)',
        '#60a5fa', // Neural sub
        '#a78bfa'  // Celestial sub
    ];

    const particles = Array.from({ length: 24 }).map((_, i) => {
        const angle = (i * 360) / 24;
        const rad = (angle * Math.PI) / 180;
        const distance = 80 + Math.random() * 60;
        return {
            x: Math.cos(rad) * distance,
            y: Math.sin(rad) * distance,
            color: particleColors[i % particleColors.length],
            size: 6 + Math.random() * 8,
            delay: Math.random() * 0.1
        };
    });

    return (
        <div 
            className="fixed inset-0 z-[4000] flex items-center justify-center bg-black/85 backdrop-blur-md p-6"
            role="dialog" 
            aria-modal="true" 
            aria-label="Submission progress overlay"
        >
            <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="relative w-full max-w-lg bg-[var(--bg-secondary,#161618)] rounded-[2.5rem] border border-white/10 p-8 sm:p-12 text-center shadow-2xl flex flex-col items-center"
            >
                {/* Header section */}
                <div className="mb-8">
                    <p className="text-[10px] font-black text-[var(--text-accent,#D7AC28)] uppercase tracking-[0.4em] mb-2">Sequence Dispatch</p>
                    <h2 className="text-2xl sm:text-3xl font-black text-white italic uppercase tracking-tighter">SECURE TRANSMISSION</h2>
                </div>

                {/* Selected option highlight card */}
                <div className="w-full bg-white/5 border border-white/5 rounded-3xl p-5 mb-8 text-left relative overflow-hidden">
                    <p className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-2">Selected Action</p>
                    <p className="text-sm font-bold text-white leading-relaxed line-clamp-1 mb-3">{questionText}</p>
                    <div className="inline-flex items-center gap-3 px-4 py-2 bg-[var(--bg-accent,#D7AC28)]/10 border border-[var(--bg-accent,#D7AC28)]/30 rounded-xl text-[var(--text-accent,#D7AC28)] font-black text-xs uppercase tracking-widest">
                        Option Selected: <span className="text-white font-mono">{selectedOption}</span>
                    </div>
                </div>

                {/* Progress Ring / Checkmark Drawing area */}
                <div className="relative w-40 h-40 flex items-center justify-center mb-8">
                    <svg 
                        className="w-full h-full -rotate-90"
                        viewBox={`0 0 ${radius * 2} ${radius * 2}`}
                        aria-hidden="true"
                    >
                        {/* Background track circle */}
                        <circle
                            stroke="rgba(255, 255, 255, 0.05)"
                            fill="transparent"
                            strokeWidth={strokeWidth}
                            r={normalizedRadius}
                            cx={radius}
                            cy={radius}
                        />
                        {/* Animated progress circle */}
                        <motion.circle
                            stroke="var(--bg-accent, #D7AC28)"
                            fill="transparent"
                            strokeWidth={strokeWidth}
                            strokeDasharray={circumference + ' ' + circumference}
                            style={{ strokeDashoffset }}
                            r={normalizedRadius}
                            cx={radius}
                            cy={radius}
                            strokeLinecap="round"
                            transition={{ ease: "easeOut" }}
                        />
                    </svg>

                    {/* Checkmark overlay */}
                    <AnimatePresence>
                        {showCheck && (
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.5 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                className="absolute inset-0 flex items-center justify-center text-[var(--success-bg,#22c55e)]"
                            >
                                <motion.svg 
                                    className="w-16 h-16" 
                                    viewBox="0 0 24 24" 
                                    fill="none" 
                                    stroke="currentColor" 
                                    strokeWidth="4" 
                                    strokeLinecap="round" 
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                >
                                    <motion.path 
                                        d="M20 6L9 17L4 12"
                                        initial={{ pathLength: 0 }}
                                        animate={{ pathLength: 1 }}
                                        transition={{ duration: 0.35, ease: "easeOut" }}
                                    />
                                </motion.svg>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Particle Confetti Burst */}
                    {showConfetti && (
                        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
                            {particles.map((p, idx) => (
                                <motion.div
                                    key={idx}
                                    className="absolute left-1/2 top-1/2 rounded-full"
                                    style={{
                                        width: p.size,
                                        height: p.size,
                                        backgroundColor: p.color,
                                        marginLeft: -p.size / 2,
                                        marginTop: -p.size / 2
                                    }}
                                    initial={{ x: 0, y: 0, opacity: 1 }}
                                    animate={{ 
                                        x: p.x, 
                                        y: p.y, 
                                        opacity: 0,
                                        scale: 0.2
                                    }}
                                    transition={{ 
                                        duration: 0.65, 
                                        ease: "easeOut",
                                        delay: p.delay 
                                    }}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Subtitle status messages */}
                <div className="space-y-1">
                    <p className="text-sm font-black text-white uppercase tracking-widest">
                        {showCheck ? "TRANSMITTED SUCCESSFULLY ✓" : "ENCRYPTING ANSWER PACKET..."}
                    </p>
                    <p className="text-xs font-bold text-white/40 uppercase tracking-[0.2em] italic">
                        {showCheck ? "Redirecting to mission debrief..." : "Locking options to immutable ledger..."}
                    </p>
                </div>
            </motion.div>
        </div>
    );
}
