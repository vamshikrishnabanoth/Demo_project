import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Activity, GraduationCap, RadioTower, ShieldCheck, Users, Zap, CheckCircle2, Sparkles, Award } from 'lucide-react';

const microMessages = [
    "Get ready...",
    "Think fast...",
    "Incoming challenge...",
    "Prepare your strategy...",
    "Next round loading..."
];

function EnergyCore() {
    return (
        <div className="relative flex items-center justify-center">
            {/* Outer smooth ambient glow */}
            <motion.div
                animate={{ scale: [1, 1.15, 1], opacity: [0.15, 0.35, 0.15] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute w-44 h-44 rounded-full bg-[var(--bg-accent)]/20 blur-2xl"
            />

            {/* Pulsing ring */}
            <motion.div
                animate={{ scale: [0.95, 1.08, 0.95], rotate: [0, 180, 360] }}
                transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute w-36 h-36 rounded-full border-2 border-dashed border-[var(--bg-accent)]/40"
            />

            {/* Core Icon Badge */}
            <motion.div
                animate={{ scale: [0.98, 1.04, 0.98] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                className="relative z-10 w-24 h-24 rounded-3xl bg-[var(--bg-accent)] flex items-center justify-center shadow-xl border-2 border-white/30 text-white"
            >
                <GraduationCap size={44} strokeWidth={2.2} className="drop-shadow-sm" />
            </motion.div>
        </div>
    );
}

function OrbitingStudentAvatars({ count = 6 }) {
    const avatarIcons = [GraduationCap, Users, Sparkles, Award, Zap, ShieldCheck];
    const avatars = Array.from({ length: Math.min(Math.max(3, count), 8) });

    return (
        <div className="relative h-64 w-64 sm:h-72 sm:w-72 flex items-center justify-center" aria-hidden="true">
            <EnergyCore />

            {avatars.map((_, idx) => {
                const angle = (idx / avatars.length) * 360;
                const radius = 110;
                const IconComp = avatarIcons[idx % avatarIcons.length];

                return (
                    <motion.div
                        key={idx}
                        className="absolute left-1/2 top-1/2 h-10 w-10 -ml-5 -mt-5 rounded-xl border-2 border-white bg-white flex items-center justify-center shadow-md text-[var(--bg-accent)]"
                        animate={{ rotate: angle + 360 }}
                        transition={{ duration: 16 + idx * 1.5, repeat: Infinity, ease: 'linear' }}
                        transformTemplate={({ rotate }) => `rotate(${rotate}) translateX(${radius}px) rotate(-${rotate})`}
                    >
                        <IconComp size={18} strokeWidth={2.2} />
                        <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
                    </motion.div>
                );
            })}
        </div>
    );
}

function AnswerSyncMatrix() {
    const answers = [
        { label: 'A', x: -80, y: -70 },
        { label: 'B', x: 80, y: -70 },
        { label: 'C', x: -80, y: 70 },
        { label: 'D', x: 80, y: 70 }
    ];

    return (
        <div className="relative h-64 w-64 flex items-center justify-center" aria-hidden="true">
            <div className="absolute inset-4 rounded-3xl border-2 border-[var(--border-color)] bg-white/80 backdrop-blur-md shadow-lg" />
            
            {answers.map((answer, i) => (
                <motion.div
                    key={answer.label}
                    className="absolute left-1/2 top-1/2 h-12 w-12 -ml-6 -mt-6 rounded-xl border-2 border-[var(--bg-accent)] bg-white flex items-center justify-center text-lg font-black text-[var(--bg-accent)] shadow-md"
                    animate={{
                        x: [answer.x, answer.x * 0.8, answer.x],
                        y: [answer.y, answer.y * 0.8, answer.y],
                        scale: [0.95, 1.08, 0.95]
                    }}
                    transition={{ duration: 2, repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' }}
                >
                    {answer.label}
                </motion.div>
            ))}
            
            <div className="relative z-10 h-20 w-20 rounded-2xl bg-[var(--bg-accent)] flex flex-col items-center justify-center shadow-lg text-white">
                <ShieldCheck size={36} strokeWidth={2} />
                <span className="text-[8px] font-black uppercase tracking-widest mt-0.5">Sync</span>
            </div>
        </div>
    );
}

function EqualizerWave() {
    const barHeights = [40, 70, 45, 80, 55, 75];
    
    return (
        <div className="flex items-end justify-center w-[200px] h-[90px] border-2 border-[var(--border-color)] rounded-2xl bg-white p-4 gap-3 shadow-md">
            {barHeights.map((h, idx) => (
                <motion.div
                    key={idx}
                    animate={{ height: [12, h, 12] }}
                    transition={{
                        duration: 0.8 + (idx % 3) * 0.2,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: idx * 0.12
                    }}
                    className="w-3 rounded-full bg-[var(--bg-accent)] shadow-xs"
                />
            ))}
        </div>
    );
}

function ReconnectingVisual() {
    return (
        <div className="relative h-56 w-56 flex items-center justify-center" aria-hidden="true">
            <motion.div
                animate={{ scale: [0.9, 1.1, 0.9] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                className="relative z-10 h-24 w-24 rounded-full bg-amber-50 border-2 border-amber-300 flex items-center justify-center text-amber-600 shadow-md"
            >
                <RadioTower size={40} />
            </motion.div>
            
            {[0, 1].map((idx) => (
                <motion.div
                    key={idx}
                    animate={{ scale: [0.8, 1.6], opacity: [0.6, 0] }}
                    transition={{ duration: 2, repeat: Infinity, delay: idx * 0.7, ease: "easeOut" }}
                    className="absolute h-32 w-32 rounded-full border-2 border-amber-400/40"
                />
            ))}
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
    const randomMessage = React.useMemo(() => {
        const idx = Math.floor(Math.random() * microMessages.length);
        return microMessages[idx];
    }, []);

    const copy = {
        'waiting-room': {
            title: title || 'Waiting for Host...',
            subtitle: subtitle || 'Session active — quiz will start when teacher begins.',
            detail: detail || `${readyCount} ready${joiningCount ? `, ${joiningCount} joining` : ''}`,
            visual: <OrbitingStudentAvatars count={readyCount + joiningCount || 6} />,
            icon: <Users size={16} />
        },
        'synchronizing-answers': {
            title: title || 'Answer Verification',
            subtitle: subtitle || 'Waiting for teacher to advance to next question...',
            detail: detail || 'Synchronizing responses...',
            visual: <AnswerSyncMatrix />,
            icon: <RadioTower size={16} />
        },
        'between-questions': {
            title: randomMessage,
            subtitle: subtitle || 'Recalculating leaderboard standings...',
            detail: 'NEXT QUESTION INCOMING',
            visual: <EqualizerWave />,
            icon: <Zap size={16} className="text-[var(--bg-accent)]" />
        },
        'reconnecting': {
            title: reconnectState === 'recovered' ? 'Connection Restored' : 'Reconnecting...',
            subtitle: reconnectState === 'recovered' ? 'Synchronizing state...' : 'Re-establishing live session. Please wait.',
            detail: reconnectState === 'recovered' 
                ? 'RECONNECTED ✓' 
                : (offlineDuration > 10 
                    ? `Attempting reconnect (${offlineDuration}s)...` 
                    : 'Your answers are safe — do not refresh'),
            visual: reconnectState === 'recovered' ? (
                <div className="h-56 w-56 flex flex-col items-center justify-center bg-emerald-50 border-2 border-emerald-300 rounded-full text-emerald-600 shadow-md">
                    <CheckCircle2 size={56} />
                </div>
            ) : (
                <ReconnectingVisual />
            ),
            icon: reconnectState === 'recovered' ? <CheckCircle2 size={16} /> : <RadioTower size={16} />
        }
    }[variant] || {
        title: title || 'Waiting...',
        subtitle: subtitle || 'Processing session...',
        detail: detail || 'Connecting...',
        visual: <OrbitingStudentAvatars count={6} />,
        icon: <Activity size={16} />
    };

    return (
        <div 
            className="relative flex flex-col items-center text-center focus:outline-none py-4"
            role="status" 
            aria-live="polite"
        >
            <div className="relative">
                {copy.visual}
            </div>
            
            <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="mt-6 flex flex-col items-center gap-4"
            >
                <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-color)] bg-white px-5 py-2 text-[var(--bg-accent)] shadow-sm font-black text-[11px] uppercase tracking-wider">
                    {copy.icon}
                    <span>{copy.detail}</span>
                </div>
                <div className="space-y-1.5">
                    <h2 className="text-3xl sm:text-4xl font-black italic uppercase tracking-tight text-[#111111]">
                        {copy.title}
                    </h2>
                    <p className="max-w-md text-xs sm:text-sm font-bold uppercase tracking-wider text-[#555555]">
                        {copy.subtitle}
                    </p>
                </div>
            </motion.div>
        </div>
    );
}

