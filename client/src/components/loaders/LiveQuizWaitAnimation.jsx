import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Clock3, FileQuestion, GraduationCap, Play, RadioTower, ShieldCheck, Users, Zap, CheckCircle2 } from 'lucide-react';

const motionDiv = motion;
const chessPieces = ['♔', '♕', '♘', '♖', '♗', '♙', '♔', '♕'];
const avatarColors = [
    'var(--text-accent, #FFB700)',
    'var(--neural-sub, #c084fc)',
    'var(--success-bg, #22c55e)',
    'var(--bg-accent, #FFB700)',
    'var(--text-primary, #FFFFFF)',
    'var(--neural-neutral, #a78bfa)'
];

const microMessages = [
    "Get ready...",
    "Think fast...",
    "Incoming challenge...",
    "Prepare your strategy...",
    "Next round loading..."
];

function EnergyCore({ lowPerformanceMode }) {
    const coreShadow = lowPerformanceMode 
        ? { boxShadow: 'inset 0 0 10px rgba(255,255,255,0.1)' } 
        : {};

    return (
        <motionDiv.div
            animate={lowPerformanceMode ? {} : {
                scale: [0.96, 1.06, 0.96],
                boxShadow: [
                    '0 0 28px var(--bg-accent-glow, rgba(255, 183, 0, 0.3)), inset 0 0 18px rgba(255,255,255,0.10)',
                    '0 0 62px var(--bg-accent-glow, rgba(255, 183, 0, 0.3)), inset 0 0 30px rgba(255,255,255,0.18)',
                    '0 0 28px var(--bg-accent-glow, rgba(255, 183, 0, 0.3)), inset 0 0 18px rgba(255,255,255,0.10)'
                ]
            }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            className={`relative z-10 h-24 w-24 rounded-full bg-gradient-to-tr from-[var(--bg-accent,#FFB700)] to-[var(--text-accent,#FFB700)]/80 border border-white/20 flex items-center justify-center`}
            style={coreShadow}
            aria-hidden="true"
        >
            <GraduationCap className="text-[var(--text-on-accent,#0F0529)] drop-shadow" size={42} strokeWidth={2.4} />
            <motionDiv.div
                animate={{ rotate: 360 }}
                transition={{ duration: 7, repeat: Infinity, ease: 'linear' }}
                className="absolute -inset-5 rounded-full border border-dashed border-[var(--bg-accent,#FFB700)]/40"
            />
        </motionDiv.div>
    );
}

function OrbitingStudentAvatars({ count = 6, lowPerformanceMode }) {
    const isMobile = typeof window !== 'undefined' ? window.innerWidth < 768 : false;
    const maxElements = lowPerformanceMode ? (isMobile ? 3 : 6) : (isMobile ? 6 : 12);
    const finalCount = Math.min(count || 6, maxElements);
    const avatars = Array.from({ length: Math.max(3, finalCount) });

    return (
        <div className="relative h-72 w-72 sm:h-80 sm:w-80 flex items-center justify-center" aria-hidden="true">
            {!lowPerformanceMode && (
                <motionDiv.div
                    animate={{ scale: [1, 1.18, 1], opacity: [0.18, 0.34, 0.18] }}
                    transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute inset-8 rounded-full bg-[var(--bg-accent,#FFB700)]/20 blur-3xl"
                />
            )}
            <motionDiv.div
                animate={{ rotate: 360 }}
                transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-5 rounded-full border border-[var(--bg-accent,#FFB700)]/15"
            />
            <motionDiv.div
                animate={{ rotate: -360 }}
                transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-12 rounded-full border border-dashed border-white/10"
            />
            <EnergyCore lowPerformanceMode={lowPerformanceMode} />

            {/* Dynamic Continuous Coins Particle Burst Animation */}
            {!lowPerformanceMode && (
                <div className="absolute inset-0 pointer-events-none z-0" aria-hidden="true">
                    {Array.from({ length: 16 }).map((_, idx) => {
                        const angle = (idx * 360) / 16;
                        const rad = (angle * Math.PI) / 180;
                        const size = 6 + (idx % 3) * 3;
                        const distance = 90 + (idx % 2) * 50;
                        const x = Math.cos(rad) * distance;
                        const y = Math.sin(rad) * distance;
                        const delay = (idx % 4) * 0.4;
                        const particleColors = [
                            'var(--bg-accent, #FFB700)',
                            '#22c55e',
                            '#FFB700',
                            '#60a5fa',
                            '#a78bfa'
                        ];
                        
                        return (
                            <motionDiv.div
                                key={idx}
                                className="absolute left-1/2 top-1/2 rounded-full"
                                style={{
                                    width: size,
                                    height: size,
                                    backgroundColor: particleColors[idx % particleColors.length],
                                    x: -size / 2,
                                    y: -size / 2,
                                }}
                                animate={{
                                    x: [0, x],
                                    y: [0, y],
                                    opacity: [0, 1, 0],
                                    scale: [0.5, 1.2, 0.2]
                                }}
                                transition={{
                                    duration: 2.2,
                                    repeat: Infinity,
                                    ease: "easeOut",
                                    delay: delay
                                }}
                            />
                        );
                    })}
                </div>
            )}
            
            {avatars.map((_, idx) => {
                const angle = (idx / avatars.length) * 360;
                const radius = 124 + (idx % 2) * 12;
                return (
                    <motionDiv.div
                        key={idx}
                        className="absolute left-1/2 top-1/2 h-12 w-12 -ml-6 -mt-6 rounded-2xl border border-white/15 bg-white/10 backdrop-blur-md flex items-center justify-center shadow-2xl text-3xl font-black leading-none"
                        style={{ color: avatarColors[idx % avatarColors.length] }}
                        initial={{ rotate: angle }}
                        animate={{ rotate: angle + 360 }}
                        transition={{ duration: 10 + idx * 0.7, repeat: Infinity, ease: 'linear' }}
                        transformTemplate={({ rotate }) => `rotate(${rotate}) translateX(${radius}px) rotate(-${rotate})`}
                    >
                        {/* Hardware-Accelerated 3D Sway / Parallax */}
                        <motionDiv.div
                            animate={lowPerformanceMode ? {} : {
                                y: [-4 - (idx % 3) * 2, 4 + (idx % 3) * 2, -4 - (idx % 3) * 2],
                                x: [-2 - (idx % 2) * 2, 2 + (idx % 2) * 2, -2 - (idx % 2) * 2]
                            }}
                            transition={{
                                duration: 2.8 + idx * 0.4,
                                repeat: Infinity,
                                ease: "easeInOut",
                                delay: idx * 0.2
                            }}
                            className="w-full h-full flex items-center justify-center relative"
                        >
                            <span className="drop-shadow-[0_0_12px_var(--bg-accent-glow,rgba(255,183,0,0.3))]">{chessPieces[idx % chessPieces.length]}</span>
                            <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-[var(--success-bg,#22c55e)] ring-2 ring-[var(--bg-secondary,#0F0529)]" />
                        </motionDiv.div>
                    </motionDiv.div>
                );
            })}
        </div>
    );
}

function AnswerSyncMatrix({ lowPerformanceMode }) {
    const answers = [
        { label: 'A', x: -96, y: -82, delay: 0 },
        { label: 'B', x: 96, y: -82, delay: 0.18 },
        { label: 'C', x: -96, y: 82, delay: 0.36 },
        { label: 'D', x: 96, y: 82, delay: 0.54 }
    ];
    const arcSegments = Array.from({ length: lowPerformanceMode ? 8 : 18 });

    return (
        <div className="relative h-72 w-72 sm:h-80 sm:w-80 flex items-center justify-center" aria-hidden="true">
            {!lowPerformanceMode && (
                <motionDiv.div
                    animate={{ scale: [0.94, 1.08, 0.94], opacity: [0.14, 0.34, 0.14] }}
                    transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute inset-8 rounded-full bg-[var(--bg-accent,#FFB700)]/15 blur-3xl"
                />
            )}
            <div className="absolute inset-7 rounded-[2.25rem] border border-[var(--bg-accent,#FFB700)]/20 bg-[var(--bg-secondary,#0F0529)]/45 backdrop-blur-xl" />
            <div className="absolute inset-0">
                {answers.map((answer) => (
                    <motionDiv.div
                        key={`beam-${answer.label}`}
                        className="absolute left-1/2 top-1/2 h-px w-24 origin-left bg-gradient-to-r from-[var(--bg-accent,#FFB700)] to-transparent"
                        style={{ rotate: `${Math.atan2(answer.y, answer.x) * 180 / Math.PI}deg` }}
                        animate={{ scaleX: [0, 1, 0], opacity: [0, 0.55, 0] }}
                        transition={{ duration: 2.1, repeat: Infinity, delay: answer.delay, ease: 'easeInOut' }}
                    />
                ))}
            </div>
            {arcSegments.map((_, idx) => (
                <motionDiv.div
                    key={idx}
                    className="absolute left-1/2 top-1/2 h-2 w-8 origin-[0_50%] rounded-full bg-[var(--bg-accent,#FFB700)]"
                    style={{ rotate: `${idx * (lowPerformanceMode ? 45 : 20)}deg`, translate: '0 -4px' }}
                    animate={{ opacity: [0.12, 0.85, 0.12] }}
                    transition={{ duration: 1.8, repeat: Infinity, delay: idx * 0.035, ease: 'easeInOut' }}
                    transformTemplate={({ rotate, translate }) => `rotate(${rotate}) translateX(122px) ${translate}`}
                />
            ))}
            {answers.map((answer) => (
                <motionDiv.div
                    key={answer.label}
                    className="absolute left-1/2 top-1/2 h-14 w-14 -ml-7 -mt-7 rounded-2xl border border-[var(--bg-accent,#FFB700)]/25 bg-[var(--bg-secondary,#0F0529)]/90 backdrop-blur-xl flex items-center justify-center text-lg font-black text-[var(--text-accent,#FFB700)] shadow-[0_0_28px_var(--bg-accent-glow,rgba(255,183,0,0.3))]"
                    animate={{
                        x: [answer.x, answer.x * 0.68, answer.x],
                        y: [answer.y, answer.y * 0.68, answer.y],
                        scale: [0.96, 1.08, 0.96],
                        opacity: [0.64, 1, 0.64]
                    }}
                    transition={{ duration: 2.4, repeat: Infinity, delay: answer.delay, ease: 'easeInOut' }}
                >
                    {answer.label}
                </motionDiv.div>
            ))}
            <div className="relative z-10 h-28 w-28 rounded-[2rem] bg-[var(--bg-secondary,#0F0529)] border border-[var(--bg-accent,#FFB700)]/35 backdrop-blur-xl flex flex-col items-center justify-center shadow-[0_0_56px_var(--bg-accent-glow,rgba(255,183,0,0.3))]">
                <motionDiv.div
                    animate={{ scale: [1, 1.12, 1] }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                    className="text-[var(--text-accent,#FFB700)]"
                >
                    <ShieldCheck size={48} strokeWidth={2.3} />
                </motionDiv.div>
                <span className="mt-2 text-[9px] font-black uppercase tracking-[0.25em] text-[var(--text-secondary,#E9D5FF)]/65">Locked</span>
            </div>
        </div>
    );
}

function EqualizerWave({ lowPerformanceMode }) {
    const barCount = 5;
    const heights = [60, 80, 45, 75, 50];
    const delays = [0, 0.2, 0.4, 0.1, 0.3];
    const durations = [0.8, 1.1, 0.7, 1.0, 0.9];
    
    return (
        <div 
            className="flex items-end justify-center w-[200px] h-[100px] border border-white/5 rounded-3xl bg-white/5 backdrop-blur-md relative overflow-hidden"
            style={{ gap: '28px' }} // Strict 28px gap
            aria-hidden="true"
        >
            {Array.from({ length: barCount }).map((_, idx) => (
                <motionDiv.div
                    key={idx}
                    animate={lowPerformanceMode ? {
                        height: [20, heights[idx] * 0.6, 20]
                    } : {
                        height: [15, heights[idx], 15]
                    }}
                    transition={{
                        duration: durations[idx],
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: delays[idx]
                    }}
                    className="w-2 rounded-full bg-[var(--bg-accent,#FFB700)]"
                    style={{ maxHeight: '80px' }} // Max height 80px
                />
            ))}
        </div>
    );
}

function ReconnectingVisual({ lowPerformanceMode }) {
    return (
        <div className="relative h-72 w-72 flex items-center justify-center" aria-hidden="true">
            {/* Wi-Fi Icon base */}
            <div className="relative z-10 h-28 w-28 rounded-full bg-[var(--bg-accent)]/10 border border-[var(--bg-accent)]/30 flex items-center justify-center">
                <motionDiv.div
                    animate={{ scale: [0.95, 1.05, 0.95] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="text-[var(--bg-accent)]"
                >
                    <RadioTower size={48} />
                </motionDiv.div>
            </div>
            
            {/* Signal Rings */}
            {!lowPerformanceMode && [0, 1, 2].map((idx) => (
                <motionDiv.div
                    key={idx}
                    animate={{ scale: [0.8, 1.6], opacity: [0.4, 0] }}
                    transition={{ duration: 2, repeat: Infinity, delay: idx * 0.6, ease: "easeOut" }}
                    className="absolute h-36 w-36 rounded-full border border-[var(--bg-accent)]/20"
                />
            ))}
        </div>
    );
}

function BouncingDotsWave() {
    return (
        <div className="flex items-center gap-1.5 justify-center mb-1" aria-hidden="true">
            {[0, 1, 2].map((idx) => (
                <motionDiv.div
                    key={idx}
                    animate={{ y: [0, -6, 0] }}
                    transition={{ duration: 0.6, repeat: Infinity, delay: idx * 0.15 }}
                    className="w-2.5 h-2.5 rounded-full bg-[var(--bg-accent)]"
                />
            ))}
        </div>
    );
}

function RepeatingFillBar() {
    return (
        <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden relative" aria-hidden="true">
            <motionDiv.div
                animate={{ x: ['-100%', '100%'] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 bg-[var(--bg-accent)]"
            />
        </div>
    );
}

export default function LiveQuizWaitAnimation({
    variant = 'waiting-room',
    title,
    subtitle,
    detail,
    readyCount = 0,
    joiningCount = 0,
    offlineDuration = 0,
    reconnectState = "disconnected"
}) {
    // Dynamic FPS Throttling System
    const [lowPerformanceMode, setLowPerformanceMode] = useState(false);
    
    useEffect(() => {
        let lastTime = performance.now();
        let frames = 0;
        let animId;
        const checkFps = (time) => {
            frames++;
            if (time > lastTime + 1000) {
                const fps = (frames * 1000) / (time - lastTime);
                if (fps < 45) {
                    setLowPerformanceMode(true);
                }
                frames = 0;
                lastTime = time;
            }
            animId = requestAnimationFrame(checkFps);
        };
        animId = requestAnimationFrame(checkFps);
        return () => cancelAnimationFrame(animId);
    }, []);

    // Pick a static micro message that doesn't repeat consecutively
    const randomMessage = React.useMemo(() => {
        const idx = Math.floor(Math.random() * microMessages.length);
        return microMessages[idx];
    }, []);

    // Wait variants mapping
    const copy = {
        'waiting-room': {
            title: title || 'Waiting for Host...',
            subtitle: subtitle || 'Orbiting student avatars around the live quiz core.',
            detail: detail || `${readyCount} ready${joiningCount ? `, ${joiningCount} joining` : ''}`,
            visual: <OrbitingStudentAvatars count={readyCount + joiningCount || 6} lowPerformanceMode={lowPerformanceMode} />,
            icon: <Users size={18} />
        },
        'synchronizing-answers': {
            title: title || 'Strict Mode',
            subtitle: subtitle || 'Answer stream verification active.',
            detail: detail || 'Waiting for teacher to move to the next question...',
            visual: <AnswerSyncMatrix lowPerformanceMode={lowPerformanceMode} />,
            icon: <RadioTower size={18} />
        },
        'between-questions': {
            title: randomMessage,
            subtitle: subtitle || 'Tactical system recalculating leaderboard permutations.',
            detail: 'NEXT QUESTION INCOMING',
            visual: <EqualizerWave lowPerformanceMode={lowPerformanceMode} />,
            icon: <Zap size={18} className="animate-bounce text-[var(--bg-accent,#FFB700)]" />
        },
        'reconnecting': {
            title: reconnectState === 'recovered' ? 'Connection Restored' : 'Link Severed',
            subtitle: reconnectState === 'recovered' ? 'Synchronizing workspace state...' : 'Auto-recovering live feed. Please stand by.',
            detail: reconnectState === 'recovered' 
                ? 'CONNECTION RESTORED ✓' 
                : (offlineDuration > 10 
                    ? `Still reconnecting... Attempt ${Math.floor((offlineDuration - 10) / 2.4) + 1}` 
                    : 'Your answers are safe — don\'t refresh'),
            visual: reconnectState === 'recovered' ? (
                <div className="h-72 w-72 flex flex-col items-center justify-center bg-[var(--success-bg)]/10 border border-[var(--success-bg)]/30 rounded-full text-[var(--success-bg)]" aria-hidden="true">
                    <CheckCircle2 className="animate-bounce" size={72} />
                </div>
            ) : (
                <div className="flex flex-col items-center gap-4">
                    <ReconnectingVisual lowPerformanceMode={lowPerformanceMode} />
                    <BouncingDotsWave />
                    <RepeatingFillBar />
                </div>
            ),
            icon: reconnectState === 'recovered' ? <CheckCircle2 size={18} /> : <RadioTower size={18} />
        }
    }[variant] || {
        title: title || 'Waiting...',
        subtitle: subtitle || 'Orbiting parameters...',
        detail: detail || 'Awaiting telemetry...',
        visual: <OrbitingStudentAvatars count={6} lowPerformanceMode={lowPerformanceMode} />,
        icon: <Activity size={18} />
    };

    return (
        <div 
            className="relative flex flex-col items-center text-center focus:outline-none"
            role="status" 
            aria-live="polite"
            tabIndex={0}
        >
            <div className="relative">
                {copy.visual}
            </div>
            
            <motionDiv.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="mt-8 flex flex-col items-center gap-5"
            >
                <div className="inline-flex items-center gap-2 rounded-full border border-[var(--bg-accent,#FFB700)]/25 bg-[var(--table-row-hover,rgba(255,183,0,0.1))] px-5 py-2 text-[var(--text-accent,#FFB700)] shadow-[0_0_28px_var(--bg-accent-glow,rgba(255,183,0,0.3))]">
                    {copy.icon}
                    <span className="text-[10px] font-black uppercase tracking-[0.22em]">{copy.detail}</span>
                </div>
                <div className="space-y-3">
                    <h2 className="text-4xl sm:text-5xl font-black italic uppercase tracking-tight text-[var(--text-primary,#FFFFFF)] leading-none">
                        {copy.title}
                    </h2>
                    <p className="max-w-lg text-sm sm:text-base font-black uppercase tracking-[0.22em] leading-relaxed text-[var(--text-secondary,#E9D5FF)] opacity-70">
                        {copy.subtitle}
                    </p>
                </div>
            </motionDiv.div>
        </div>
    );
}
