import { Activity, Clock3, FileQuestion, GraduationCap, Play, RadioTower, ShieldCheck, Users } from 'lucide-react';
import { motion } from 'framer-motion';

const chessPieces = ['♔', '♕', '♘', '♖', '♗', '♙', '♔', '♕'];
const avatarColors = [
    'var(--text-accent)',
    'var(--neural-sub)',
    'var(--success-bg)',
    'var(--bg-accent)',
    'var(--text-primary)',
    'var(--neural-neutral)'
];

function EnergyCore() {
    return (
        <motion.div
            animate={{
                scale: [0.96, 1.06, 0.96],
                boxShadow: [
                    '0 0 28px var(--bg-accent-glow), inset 0 0 18px rgba(255,255,255,0.10)',
                    '0 0 62px var(--bg-accent-glow), inset 0 0 30px rgba(255,255,255,0.18)',
                    '0 0 28px var(--bg-accent-glow), inset 0 0 18px rgba(255,255,255,0.10)'
                ]
            }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            className="relative z-10 h-24 w-24 rounded-full bg-gradient-to-tr from-[var(--bg-accent)] to-[var(--text-accent)]/80 border border-white/20 flex items-center justify-center"
        >
            <GraduationCap className="text-[var(--text-on-accent)] drop-shadow" size={42} strokeWidth={2.4} />
            <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 7, repeat: Infinity, ease: 'linear' }}
                className="absolute -inset-5 rounded-full border border-dashed border-[var(--bg-accent)]/40"
            />
        </motion.div>
    );
}

function OrbitingStudentAvatars({ count = 6 }) {
    const avatars = Array.from({ length: Math.max(4, Math.min(count || 6, 8)) });

    return (
        <div className="relative h-72 w-72 sm:h-80 sm:w-80 flex items-center justify-center">
            <motion.div
                animate={{ scale: [1, 1.18, 1], opacity: [0.18, 0.34, 0.18] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute inset-8 rounded-full bg-[var(--bg-accent)]/20 blur-3xl"
            />
            <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-5 rounded-full border border-[var(--bg-accent)]/15"
            />
            <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-12 rounded-full border border-dashed border-white/10"
            />
            <EnergyCore />
            {avatars.map((_, idx) => {
                const angle = (idx / avatars.length) * 360;
                const radius = 124 + (idx % 2) * 12;
                return (
                    <motion.div
                        key={idx}
                        className="absolute left-1/2 top-1/2 h-12 w-12 -ml-6 -mt-6 rounded-2xl border border-white/15 bg-white/10 backdrop-blur-md flex items-center justify-center shadow-2xl text-3xl font-black leading-none"
                        style={{ color: avatarColors[idx % avatarColors.length] }}
                        initial={{ rotate: angle }}
                        animate={{ rotate: angle + 360 }}
                        transition={{ duration: 10 + idx * 0.7, repeat: Infinity, ease: 'linear' }}
                        transformTemplate={({ rotate }) => `rotate(${rotate}) translateX(${radius}px) rotate(-${rotate})`}
                    >
                        <span className="drop-shadow-[0_0_12px_var(--bg-accent-glow)]">{chessPieces[idx % chessPieces.length]}</span>
                        <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-[var(--success-bg)] ring-2 ring-[var(--bg-secondary)]" />
                    </motion.div>
                );
            })}
        </div>
    );
}

function AnswerSyncMatrix() {
    const answers = [
        { label: 'A', x: -96, y: -82, delay: 0 },
        { label: 'B', x: 96, y: -82, delay: 0.18 },
        { label: 'C', x: -96, y: 82, delay: 0.36 },
        { label: 'D', x: 96, y: 82, delay: 0.54 }
    ];
    const arcSegments = Array.from({ length: 18 });

    return (
        <div className="relative h-72 w-72 sm:h-80 sm:w-80 flex items-center justify-center">
            <motion.div
                animate={{ scale: [0.94, 1.08, 0.94], opacity: [0.14, 0.34, 0.14] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute inset-8 rounded-full bg-[var(--bg-accent)]/15 blur-3xl"
            />
            <div className="absolute inset-7 rounded-[2.25rem] border border-[var(--bg-accent)]/20 bg-[var(--bg-secondary)]/45 backdrop-blur-xl" />
            <div className="absolute inset-0">
                {answers.map((answer) => (
                    <motion.div
                        key={`beam-${answer.label}`}
                        className="absolute left-1/2 top-1/2 h-px w-24 origin-left bg-gradient-to-r from-[var(--bg-accent)] to-transparent"
                        style={{ rotate: `${Math.atan2(answer.y, answer.x) * 180 / Math.PI}deg` }}
                        animate={{ scaleX: [0, 1, 0], opacity: [0, 0.55, 0] }}
                        transition={{ duration: 2.1, repeat: Infinity, delay: answer.delay, ease: 'easeInOut' }}
                    />
                ))}
            </div>
            {arcSegments.map((_, idx) => (
                <motion.div
                    key={idx}
                    className="absolute left-1/2 top-1/2 h-2 w-8 origin-[0_50%] rounded-full bg-[var(--bg-accent)]"
                    style={{ rotate: `${idx * 20}deg`, translate: '0 -4px' }}
                    animate={{ opacity: [0.12, 0.85, 0.12] }}
                    transition={{ duration: 1.8, repeat: Infinity, delay: idx * 0.035, ease: 'easeInOut' }}
                    transformTemplate={({ rotate, translate }) => `rotate(${rotate}) translateX(122px) ${translate}`}
                />
            ))}
            {answers.map((answer) => (
                <motion.div
                    key={answer.label}
                    className="absolute left-1/2 top-1/2 h-14 w-14 -ml-7 -mt-7 rounded-2xl border border-[var(--bg-accent)]/25 bg-[var(--bg-secondary)]/90 backdrop-blur-xl flex items-center justify-center text-lg font-black text-[var(--text-accent)] shadow-[0_0_28px_var(--bg-accent-glow)]"
                    animate={{
                        x: [answer.x, answer.x * 0.68, answer.x],
                        y: [answer.y, answer.y * 0.68, answer.y],
                        scale: [0.96, 1.08, 0.96],
                        opacity: [0.64, 1, 0.64]
                    }}
                    transition={{ duration: 2.4, repeat: Infinity, delay: answer.delay, ease: 'easeInOut' }}
                >
                    {answer.label}
                </motion.div>
            ))}
            <div className="relative z-10 h-28 w-28 rounded-[2rem] bg-[var(--bg-secondary)] border border-[var(--bg-accent)]/35 backdrop-blur-xl flex flex-col items-center justify-center shadow-[0_0_56px_var(--bg-accent-glow)]">
                <motion.div
                    animate={{ scale: [1, 1.12, 1] }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                    className="text-[var(--text-accent)]"
                >
                    <ShieldCheck size={48} strokeWidth={2.3} />
                </motion.div>
                <span className="mt-2 text-[9px] font-black uppercase tracking-[0.25em] text-[var(--text-secondary)]/65">Locked</span>
            </div>
            {[0, 1].map((idx) => (
                <motion.div
                    key={idx}
                    animate={{ scale: [0.76, 1.42], opacity: [0.32, 0] }}
                    transition={{ duration: 2.2, repeat: Infinity, delay: idx * 0.55, ease: 'easeOut' }}
                    className="absolute h-36 w-36 rounded-[2rem] border border-[var(--bg-accent)]/30"
                />
            ))}
        </div>
    );
}

function QuizStartLaunchDial({ timeLeft }) {
    const safeTime = Number.isFinite(timeLeft) ? timeLeft : 3;
    const label = safeTime > 0 ? String(Math.min(safeTime, 99)) : 'GO';
    const ticks = Array.from({ length: 32 });
    const checklist = ['Link', 'Rules', 'Begin'];

    return (
        <div className="relative h-72 w-72 sm:h-80 sm:w-80 flex items-center justify-center">
            <motion.div
                animate={{ scale: [1, 1.16, 1], opacity: [0.12, 0.34, 0.12] }}
                transition={{ duration: 2.3, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute inset-10 rounded-full bg-[var(--bg-accent)]/20 blur-3xl"
            />
            <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-7 rounded-full border border-[var(--bg-accent)]/25"
            />
            <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 13, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-16 rounded-full border border-dashed border-[var(--text-secondary)]/20"
            />
            {ticks.map((_, idx) => (
                <motion.div
                    key={idx}
                    className="absolute left-1/2 top-1/2 h-3 w-1 origin-[0_50%] rounded-full bg-[var(--bg-accent)]"
                    style={{
                        rotate: `${idx * 11.25}deg`
                    }}
                    animate={{ opacity: idx % 4 === 0 ? [0.35, 1, 0.35] : [0.12, 0.36, 0.12] }}
                    transition={{ duration: 1.4, repeat: Infinity, delay: idx * 0.025, ease: 'easeInOut' }}
                    transformTemplate={({ rotate }) => `rotate(${rotate}) translateX(136px)`}
                />
            ))}
            {[0, 1, 2].map((idx) => (
                <motion.div
                    key={`scan-${idx}`}
                    animate={{ rotate: 360, opacity: [0.22, 0.48, 0.22] }}
                    transition={{ rotate: { duration: 2.8 + idx, repeat: Infinity, ease: 'linear' }, opacity: { duration: 1.8, repeat: Infinity, delay: idx * 0.2 } }}
                    className="absolute h-px w-32 origin-left bg-gradient-to-r from-[var(--bg-accent)] to-transparent"
                />
            ))}
            <motion.div
                key={label}
                initial={{ scale: 0.78, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 380, damping: 18 }}
                className="relative z-10 h-32 w-32 rounded-full bg-[var(--bg-accent)] text-[var(--text-on-accent)] flex flex-col items-center justify-center shadow-[0_0_74px_var(--bg-accent-glow)]"
            >
                <Play size={30} fill="currentColor" />
                <span className="text-4xl font-black italic leading-none">{label}</span>
            </motion.div>
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 grid w-52 grid-cols-3 gap-2">
                {checklist.map((item, idx) => (
                    <motion.div
                        key={idx}
                        animate={{ opacity: [0.32, 1, 0.32] }}
                        transition={{ duration: 1.2, repeat: Infinity, delay: idx * 0.28, ease: 'easeInOut' }}
                        className="rounded-full border border-[var(--bg-accent)]/25 bg-[var(--table-row-hover)] px-2 py-1 text-[8px] font-black uppercase tracking-[0.18em] text-[var(--text-accent)]"
                    >
                        {item}
                    </motion.div>
                ))}
            </div>
        </div>
    );
}

function SlidingQuestionCardTransition() {
    return (
        <div className="relative h-72 w-72 sm:h-80 sm:w-80 flex items-center justify-center overflow-hidden">
            {[0, 1, 2].map((idx) => (
                <motion.div
                    key={idx}
                    initial={false}
                    animate={{
                        x: ['130%', '0%', '-130%'],
                        rotate: [8, 0, -8],
                        opacity: [0, 1, 0]
                    }}
                    transition={{ duration: 2.6, repeat: Infinity, delay: idx * 0.55, ease: 'easeInOut' }}
                    className="absolute h-40 w-56 rounded-3xl border border-[var(--bg-accent)]/25 bg-[var(--bg-secondary)] shadow-2xl shadow-black/40 p-5"
                >
                    <div className="mb-5 flex items-center gap-3 text-[var(--text-accent)]">
                        <FileQuestion size={24} />
                        <div className="h-2 w-20 rounded-full bg-[var(--bg-accent)]/50" />
                    </div>
                    <div className="space-y-3">
                        <div className="h-3 rounded-full bg-white/20" />
                        <div className="h-3 w-4/5 rounded-full bg-white/10" />
                        <div className="grid grid-cols-2 gap-2 pt-3">
                            <div className="h-8 rounded-xl bg-[var(--bg-accent)]/20" />
                            <div className="h-8 rounded-xl bg-white/10" />
                        </div>
                    </div>
                </motion.div>
            ))}
            <motion.div
                animate={{ opacity: [0.25, 0.75, 0.25] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute bottom-8 h-1 w-40 rounded-full bg-gradient-to-r from-transparent via-[var(--bg-accent)] to-transparent"
            />
        </div>
    );
}

function LiveProgressWave({ answeredCount = 0, totalStudents = 0 }) {
    const total = Math.max(totalStudents, 1);
    const progress = Math.min(100, Math.round((answeredCount / total) * 100));
    const bars = Array.from({ length: 18 });

    return (
        <div className="relative h-72 w-72 sm:h-80 sm:w-80 flex items-center justify-center">
            <motion.div
                animate={{ scale: [1, 1.2, 1], opacity: [0.14, 0.32, 0.14] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute inset-10 rounded-full bg-[var(--success-bg)]/10 blur-3xl"
            />
            <div className="absolute bottom-16 left-8 right-8 flex h-28 items-end justify-center gap-2">
                {bars.map((_, idx) => (
                    <motion.div
                        key={idx}
                        animate={{ height: [18, 78 - Math.abs(9 - idx) * 4, 28], opacity: [0.35, 1, 0.45] }}
                        transition={{ duration: 1.25, repeat: Infinity, delay: idx * 0.055, ease: 'easeInOut' }}
                        className="w-2 rounded-full bg-gradient-to-t from-[var(--bg-accent)] to-[var(--success-bg)]"
                    />
                ))}
            </div>
            <div className="relative z-10 h-32 w-32 rounded-full bg-white/5 border border-white/15 backdrop-blur-xl flex flex-col items-center justify-center shadow-2xl">
                <Activity className="text-[var(--success-bg)] mb-2" size={30} />
                <span className="text-4xl font-black italic text-white">{progress}%</span>
                <span className="text-[9px] font-black uppercase tracking-[0.25em] text-white/35">Live</span>
            </div>
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
    answeredCount = 0,
    totalStudents = 0,
    timeLeft
}) {
    const copy = {
        'waiting-room': {
            title: title || 'Waiting for Host...',
            subtitle: subtitle || 'Orbiting student avatars around the live quiz core.',
            detail: detail || `${readyCount} ready${joiningCount ? `, ${joiningCount} joining` : ''}`,
            visual: <OrbitingStudentAvatars count={readyCount + joiningCount || 6} />,
            icon: <Users size={18} />
        },
        'synchronizing-answers': {
            title: title || 'Strict Mode',
            subtitle: subtitle || 'Answer stream verification active.',
            detail: detail || 'Waiting for teacher to move to the next question...',
            visual: <AnswerSyncMatrix />,
            icon: <RadioTower size={18} />
        },
        'loading-next-question': {
            title: title || 'Loading Next Question',
            subtitle: subtitle || 'Sliding question card transition armed.',
            detail: detail || 'Awaiting host command...',
            visual: <SlidingQuestionCardTransition />,
            icon: <FileQuestion size={18} />
        },
        'quiz-starting': {
            title: title || 'Quiz Starting',
            subtitle: subtitle || 'Launch gate countdown active.',
            detail: detail || 'Locking into the first question...',
            visual: <QuizStartLaunchDial timeLeft={timeLeft} />,
            icon: <Clock3 size={18} />
        },
        'waiting-submissions': {
            title: title || 'Waiting for Submissions',
            subtitle: subtitle || 'Live progress wave tracking the room.',
            detail: detail || `${answeredCount} of ${totalStudents || 0} answered`,
            visual: <LiveProgressWave answeredCount={answeredCount} totalStudents={totalStudents} />,
            icon: <Activity size={18} />
        }
    }[variant];

    return (
        <div className="relative flex flex-col items-center text-center">
            {copy.visual}
            <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="mt-8 flex flex-col items-center gap-5"
            >
                <div className="inline-flex items-center gap-2 rounded-full border border-[var(--bg-accent)]/25 bg-[var(--table-row-hover)] px-5 py-2 text-[var(--text-accent)] shadow-[0_0_28px_var(--bg-accent-glow)]">
                    {copy.icon}
                    <span className="text-[10px] font-black uppercase tracking-[0.22em]">{copy.detail}</span>
                </div>
                <div className="space-y-3">
                    <h2 className="text-4xl sm:text-5xl font-black italic uppercase tracking-tight text-[var(--text-primary)] leading-none">
                        {copy.title}
                    </h2>
                    <p className="max-w-lg text-sm sm:text-base font-black uppercase tracking-[0.22em] leading-relaxed text-[var(--text-secondary)] opacity-70">
                        {copy.subtitle}
                    </p>
                </div>
            </motion.div>
        </div>
    );
}
