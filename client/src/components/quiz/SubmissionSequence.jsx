import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';

// Pre-calculated static random offsets to ensure 100% pure rendering and avoid any Math.random checks
const STATIC_PARTICLES = Array.from({ length: 24 }).map((_, i) => {
    const angle = (i * 360) / 24;
    const rad = (angle * Math.PI) / 180;
    // Generate deterministic pseudo-random distance, size, and delay
    const pseudoRand1 = Math.sin(i * 12.9898) * 43758.5453;
    const randDistance = pseudoRand1 - Math.floor(pseudoRand1);
    
    const pseudoRand2 = Math.sin(i * 78.233) * 43758.5453;
    const randSize = pseudoRand2 - Math.floor(pseudoRand2);

    const pseudoRand3 = Math.sin(i * 45.164) * 43758.5453;
    const randDelay = pseudoRand3 - Math.floor(pseudoRand3);

    const distance = 80 + randDistance * 60;
    return {
        x: Math.cos(rad) * distance,
        y: Math.sin(rad) * distance,
        size: 6 + randSize * 8,
        delay: randDelay * 0.1
    };
});

export default function SubmissionSequence({ 
    selectedOption = "A", 
    questionText = "Question complete.",
    timeTaken = null,
    onComplete 
}) {
    const [progress, setProgress] = useState(0);
    const [showCheck, setShowCheck] = useState(false);
    const [showConfetti, setShowConfetti] = useState(false);
    const [crashed, setCrashed] = useState(false);

    // Determine responsiveness tier based on timeTaken (seconds)
    const getResponseTier = () => {
        if (timeTaken === null) return 'normal';
        if (timeTaken <= 5) return 'lightning';
        if (timeTaken <= 12) return 'fast';
        if (timeTaken <= 25) return 'normal';
        return 'slow';
    };
    const tier = getResponseTier();

    const tierConfig = {
        lightning: {
            label: 'LIGHTNING REFLEXES',
            headline: 'Blazing Fast! ⚡',
            sub: 'You locked in before most even read the question!',
            color: 'text-cyan-400',
            badge: 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300',
        },
        fast: {
            label: 'SHARP RESPONSE',
            headline: 'Fast & Focused 🎯',
            sub: 'Excellent reaction — you were ahead of the curve!',
            color: 'text-green-400',
            badge: 'bg-green-500/15 border-green-500/30 text-green-300',
        },
        normal: {
            label: 'ANSWER LOCKED',
            headline: 'Steady & Sure ✅',
            sub: 'Deliberate choice submitted to the ledger.',
            color: 'text-[var(--text-accent,#D7AC28)]',
            badge: 'bg-[var(--bg-accent,#D7AC28)]/10 border-[var(--bg-accent,#D7AC28)]/30 text-[var(--text-accent,#D7AC28)]',
        },
        slow: {
            label: 'LATE RESPONSE',
            headline: 'Submitted! Keep Pace 🐢',
            sub: 'Answer received — try to respond faster next time!',
            color: 'text-amber-400',
            badge: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
        },
    };
    const tc = tierConfig[tier];

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
            setTimeout(() => {
                setCrashed(true);
                onComplete();
            }, 0);
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
        'var(--neural-sub, #60a5fa)',
        'var(--neural-neutral, #a78bfa)'
    ];



    return (
        <div 
            className="fixed inset-0 z-[4000] flex flex-col items-center justify-center bg-black/85 backdrop-blur-md p-6"
            role="dialog" 
            aria-modal="true" 
            aria-label="Submission progress overlay"
        >
            <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="relative w-full max-w-md bg-[var(--bg-secondary,#161618)] rounded-[2.5rem] border border-white/10 p-8 sm:p-10 text-center shadow-2xl flex flex-col items-center"
            >
                {/* Header section */}
                <div className="mb-6">
                    <p className="text-[10px] font-black text-[var(--text-accent,#D7AC28)] uppercase tracking-[0.4em] mb-1">Sequence Dispatch</p>
                    <h2 className="text-2xl sm:text-3xl font-black text-white italic uppercase tracking-tighter">SECURE TRANSMISSION</h2>
                </div>

                {/* Progress Ring / Checkmark Drawing area */}
                <div className="relative w-32 h-32 flex items-center justify-center mb-6">
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
                            stroke={`var(--bg-accent, #D7AC28)`}
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
                                    className="w-14 h-14" 
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
                </div>

                {/* Responsiveness response card — positioned BELOW the ring, not overlapping */}
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25, duration: 0.4 }}
                    className={`w-full border rounded-2xl p-4 mb-5 text-left relative overflow-hidden ${tc.badge}`}
                >
                    <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-1">{tc.label}</p>
                    <h3 className={`text-base font-black italic uppercase tracking-tight leading-snug mb-1 ${tc.color}`}>
                        {tc.headline}
                    </h3>
                    <p className="text-xs font-semibold text-white/50 leading-snug">{tc.sub}</p>
                    {/* Selected option chip */}
                    <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-xl">
                        <span className="text-[9px] font-black uppercase tracking-widest text-white/30">You chose:</span>
                        <span className="text-xs font-mono font-black text-white">{selectedOption}</span>
                    </div>
                </motion.div>

                {/* Subtitle status messages */}
                <div className="space-y-0.5">
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
