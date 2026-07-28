import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Clock3, FileQuestion, GraduationCap, Play, RadioTower, ShieldCheck, Users, Zap, CheckCircle2, Sparkles, Award } from 'lucide-react';

const motionDiv = motion;
const avatarIcons = [GraduationCap, Users, Sparkles, Award, Zap, ShieldCheck];
const avatarColors = [
    'var(--text-accent, #FFB700)',
    '#38bdf8',
    '#22c55e',
    '#a855f7',
    '#f43f5e',
    '#fbbf24'
];

const microMessages = [
    "Get ready...",
    "Think fast...",
    "Incoming challenge...",
    "Prepare your strategy...",
    "Next round loading..."
];

function EnergyCore({ lowPerformanceMode }) {
    return (
        <motionDiv.div
            animate={lowPerformanceMode ? {} : {
                scale: [0.96, 1.08, 0.96],
                boxShadow: [
                    '0 0 35px var(--bg-accent-glow, rgba(255, 183, 0, 0.35)), inset 0 0 20px rgba(255,255,255,0.15)',
                    '0 0 75px var(--bg-accent-glow, rgba(255, 183, 0, 0.55)), inset 0 0 35px rgba(255,255,255,0.25)',
                    '0 0 35px var(--bg-accent-glow, rgba(255, 183, 0, 0.35)), inset 0 0 20px rgba(255,255,255,0.15)'
                ]
            }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            className="relative z-10 h-28 w-28 rounded-full bg-gradient-to-tr from-[var(--bg-accent,#FFB700)] to-[var(--text-accent,#FFB700)] border-2 border-white/30 flex items-center justify-center shadow-2xl backdrop-blur-lg"
            aria-hidden="true"
        >
            <GraduationCap className="text-[var(--text-on-accent,#0F0529)] drop-shadow-lg" size={48} strokeWidth={2.4} />
            
            {/* Double Outer Pulsing Energy Rings */}
            <motionDiv.div
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                className="absolute -inset-4 rounded-full border-2 border-dashed border-[var(--bg-accent,#FFB700)]/40"
            />
            <motionDiv.div
                animate={{ rotate: -360 }}
                transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
                className="absolute -inset-8 rounded-full border border-white/15"
            />
        </motionDiv.div>
    );
}

function OrbitingStudentAvatars({ count = 6, lowPerformanceMode, showCoins = false }) {
    const isMobile = typeof window !== 'undefined' ? window.innerWidth < 768 : false;
    const maxElements = lowPerformanceMode ? (isMobile ? 3 : 6) : (isMobile ? 6 : 12);
    const finalCount = Math.min(count || 6, maxElements);
    const avatars = Array.from({ length: Math.max(3, finalCount) });

    return (
        <div className="relative h-72 w-72 sm:h-84 sm:w-84 flex items-center justify-center" aria-hidden="true">
            {!lowPerformanceMode && (
                <motionDiv.div
                    animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
                    transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute inset-4 rounded-full bg-[var(--bg-accent,#FFB700)]/20 blur-3xl"
                />
            )}
            
            {/* Concentric Orbit Paths */}
            <motionDiv.div
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-4 rounded-full border border-[var(--bg-accent,#FFB700)]/20"
            />
            <motionDiv.div
                animate={{ rotate: -360 }}
                transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-10 rounded-full border border-dashed border-white/15"
            />
            
            <EnergyCore lowPerformanceMode={lowPerformanceMode} />

            {/* Continuous Coins / Particle Burst */}
            {!lowPerformanceMode && showCoins && (
                <div className="absolute inset-0 pointer-events-none z-0" aria-hidden="true">
                    {Array.from({ length: 16 }).map((_, idx) => {
                        const angle = (idx * 360) / 16;
                        const rad = (angle * Math.PI) / 180;
                        const size = 8 + (idx % 3) * 4;
                        const distance = 95 + (idx % 2) * 45;
                        const x = Math.cos(rad) * distance;
                        const y = Math.sin(rad) * distance;
                        const delay = (idx % 4) * 0.4;
                        
                        return (
                            <motionDiv.div
                                key={idx}
                                className="absolute left-1/2 top-1/2 rounded-full"
                                style={{
                                    width: size,
                                    height: size,
                                    backgroundColor: avatarColors[idx % avatarColors.length],
                                    boxShadow: `0 0 ${size * 2}px ${avatarColors[idx % avatarColors.length]}`,
                                    x: -size / 2,
                                    y: -size / 2,
                                }}
                                animate={{
                                    x: [0, x],
                                    y: [0, y],
                                    opacity: [0, 1, 0],
                                    scale: [0.5, 1.4, 0.2]
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
                const radius = 126 + (idx % 2) * 12;
                const IconComp = avatarIcons[idx % avatarIcons.length];

                return (
                    <motionDiv.div
                        key={idx}
                        className="absolute left-1/2 top-1/2 h-12 w-12 -ml-6 -mt-6 rounded-2xl border-2 border-white/20 bg-[var(--bg-secondary)]/90 backdrop-blur-md flex items-center justify-center shadow-xl text-xl font-black leading-none"
                        style={{ color: avatarColors[idx % avatarColors.length] }}
                        initial={{ rotate: angle }}
                        animate={{ rotate: angle + 360 }}
                        transition={{ duration: 12 + idx * 0.8, repeat: Infinity, ease: 'linear' }}
                        transformTemplate={({ rotate }) => `rotate(${rotate}) translateX(${radius}px) rotate(-${rotate})`}
                    >
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
                            <IconComp size={22} strokeWidth={2.4} />
                            <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-[var(--bg-secondary)]" />
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

    return (
        <div className="relative h-72 w-72 sm:h-80 sm:w-80 flex items-center justify-center" aria-hidden="true">
            {!lowPerformanceMode && (
                <motionDiv.div
                    animate={{ scale: [0.94, 1.1, 0.94], opacity: [0.15, 0.38, 0.15] }}
                    transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute inset-6 rounded-full bg-[var(--bg-accent,#FFB700)]/20 blur-3xl"
                />
            )}
            <div className="absolute inset-6 rounded-[2.5rem] border-2 border-[var(--bg-accent,#FFB700)]/30 bg-[var(--bg-secondary)]/80 backdrop-blur-2xl shadow-2xl" />
            
            {answers.map((answer) => (
                <motionDiv.div
                    key={answer.label}
                    className="absolute left-1/2 top-1/2 h-14 w-14 -ml-7 -mt-7 rounded-2xl border-2 border-[var(--bg-accent,#FFB700)]/40 bg-[var(--bg-secondary)] backdrop-blur-xl flex items-center justify-center text-xl font-black text-[var(--text-accent,#FFB700)] shadow-[0_0_30px_var(--bg-accent-glow,rgba(255,183,0,0.35))]"
                    animate={{
                        x: [answer.x, answer.x * 0.72, answer.x],
                        y: [answer.y, answer.y * 0.72, answer.y],
                        scale: [0.96, 1.1, 0.96],
                        opacity: [0.7, 1, 0.7]
                    }}
                    transition={{ duration: 2.4, repeat: Infinity, delay: answer.delay, ease: 'easeInOut' }}
                >
                    {answer.label}
                </motionDiv.div>
            ))}
            
            <div className="relative z-10 h-28 w-28 rounded-[2rem] bg-gradient-to-tr from-[var(--bg-secondary)] to-[var(--bg-primary)] border-2 border-[var(--bg-accent,#FFB700)]/50 backdrop-blur-xl flex flex-col items-center justify-center shadow-[0_0_60px_var(--bg-accent-glow,rgba(255,183,0,0.4))]">
                <motionDiv.div
                    animate={{ scale: [1, 1.15, 1] }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                    className="text-[var(--text-accent,#FFB700)]"
                >
                    <ShieldCheck size={48} strokeWidth={2.4} />
                </motionDiv.div>
                <span className="mt-1 text-[9px] font-black uppercase tracking-[0.25em] text-white/70">Verified</span>
            </div>
        </div>
    );
}

function EqualizerWave({ lowPerformanceMode }) {
    const barCount = 6;
    const heights = [50, 80, 45, 75, 60, 85];
    const delays = [0, 0.2, 0.4, 0.1, 0.3, 0.25];
    const durations = [0.8, 1.1, 0.7, 1.0, 0.9, 1.05];
    
    return (
        <div 
            className="flex items-end justify-center w-[220px] h-[110px] border-2 border-white/10 rounded-3xl bg-[var(--bg-secondary)]/80 backdrop-blur-xl relative overflow-hidden shadow-2xl px-6 py-4 gap-4"
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
                    className="w-3 rounded-full bg-gradient-to-t from-[var(--bg-accent,#FFB700)] to-[var(--text-accent,#FFB700)] shadow-[0_0_15px_var(--bg-accent-glow,rgba(255,183,0,0.4))]"
                    style={{ maxHeight: '85px' }}
                />
            ))}
        </div>
    );
}

function ReconnectingVisual({ lowPerformanceMode }) {
    return (
        <div className="relative h-72 w-72 flex items-center justify-center" aria-hidden="true">
            <div className="relative z-10 h-28 w-28 rounded-full bg-[var(--bg-accent)]/15 border-2 border-[var(--bg-accent)]/40 flex items-center justify-center shadow-2xl">
                <motionDiv.div
                    animate={{ scale: [0.95, 1.1, 0.95] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="text-[var(--bg-accent)]"
                >
                    <RadioTower size={48} />
                </motionDiv.div>
            </div>
            
            {!lowPerformanceMode && [0, 1, 2].map((idx) => (
                <motionDiv.div
                    key={idx}
                    animate={{ scale: [0.8, 1.7], opacity: [0.5, 0] }}
                    transition={{ duration: 2.2, repeat: Infinity, delay: idx * 0.6, ease: "easeOut" }}
                    className="absolute h-36 w-36 rounded-full border-2 border-[var(--bg-accent)]/30"
                />
            ))}
        </div>
    );
}

function BouncingDotsWave() {
    return (
        <div className="flex items-center gap-2 justify-center mb-1" aria-hidden="true">
            {[0, 1, 2].map((idx) => (
                <motionDiv.div
                    key={idx}
                    animate={{ y: [0, -8, 0] }}
                    transition={{ duration: 0.6, repeat: Infinity, delay: idx * 0.15 }}
                    className="w-3 h-3 rounded-full bg-[var(--bg-accent)] shadow-[0_0_10px_var(--bg-accent-glow)]"
                />
            ))}
        </div>
    );
}

function RepeatingFillBar() {
    return (
        <div className="w-52 h-1.5 bg-white/10 rounded-full overflow-hidden relative shadow-inner" aria-hidden="true">
            <motionDiv.div
                animate={{ x: ['-100%', '100%'] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 bg-gradient-to-r from-transparent via-[var(--bg-accent)] to-transparent"
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

    const randomMessage = React.useMemo(() => {
        const idx = Math.floor(Math.random() * microMessages.length);
        return microMessages[idx];
    }, []);

    const copy = {
        'waiting-room': {
            title: title || 'Waiting for Host...',
            subtitle: subtitle || 'Orbiting student session matrix active.',
            detail: detail || `${readyCount} ready${joiningCount ? `, ${joiningCount} joining` : ''}`,
            visual: <OrbitingStudentAvatars count={readyCount + joiningCount || 6} lowPerformanceMode={lowPerformanceMode} showCoins={true} />,
            icon: <Users size={18} />
        },
        'synchronizing-answers': {
            title: title || 'Strict Mode',
            subtitle: subtitle || 'Answer stream verification active.',
            detail: detail || 'Waiting for teacher to move to next question...',
            visual: <AnswerSyncMatrix lowPerformanceMode={lowPerformanceMode} />,
            icon: <RadioTower size={18} />
        },
        'between-questions': {
            title: randomMessage,
            subtitle: subtitle || 'System recalculating leaderboard standings.',
            detail: 'NEXT QUESTION INCOMING',
            visual: <EqualizerWave lowPerformanceMode={lowPerformanceMode} />,
            icon: <Zap size={18} className="animate-bounce text-[var(--text-accent,#FFB700)]" />
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
                <div className="h-72 w-72 flex flex-col items-center justify-center bg-emerald-500/10 border-2 border-emerald-500/30 rounded-full text-emerald-400 shadow-2xl" aria-hidden="true">
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
        visual: <OrbitingStudentAvatars count={6} lowPerformanceMode={lowPerformanceMode} showCoins={false} />,
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
                <div className="inline-flex items-center gap-2 rounded-full border border-[var(--bg-accent,#FFB700)]/30 bg-[var(--bg-secondary)] px-6 py-2.5 text-[var(--text-accent,#FFB700)] shadow-[0_0_30px_var(--bg-accent-glow,rgba(255,183,0,0.3))]">
                    {copy.icon}
                    <span className="text-[11px] font-black uppercase tracking-[0.25em]">{copy.detail}</span>
                </div>
                <div className="space-y-3">
                    <h2 className="text-4xl sm:text-5xl font-black italic uppercase tracking-tight text-[var(--text-primary,#FFFFFF)] leading-none drop-shadow-md">
                        {copy.title}
                    </h2>
                    <p className="max-w-lg text-sm sm:text-base font-black uppercase tracking-[0.22em] leading-relaxed text-[var(--text-secondary,#E9D5FF)] opacity-80">
                        {copy.subtitle}
                    </p>
                </div>
            </motionDiv.div>
        </div>
    );
}
