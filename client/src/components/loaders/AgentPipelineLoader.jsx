import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Standard generation stages (topic / PDF / text) ──────────────────────────
const STAGES = [
    { label: 'Generating Questions',  sub: 'AI crafting questions from your source…',          icon: '✦' },
    { label: 'Agent Reviewing',       sub: 'Critic Agent checking quality across the quiz…',   icon: '◈' },
    { label: 'Optimising Quality',    sub: 'Refiner improving low-scoring questions…',         icon: '◎' },
    { label: 'Preparing Final Quiz',  sub: 'Assembling your polished quiz…',                   icon: '✓' },
];

// ── Extended voice stages ─────────────────────────────────────────────────────
const VOICE_STAGES = [
    { label: 'Uploading Audio',       sub: 'Sending your recording to the server…',           icon: '📤' },
    { label: 'Transcribing',          sub: 'AI converting your speech to text…',              icon: '🎙️' },
    { label: 'Extracting Topics',     sub: 'Identifying key concepts from lecture…',          icon: '🔍' },
    { label: 'Generating Questions',  sub: 'Creating questions from your lecture content…',   icon: '✦' },
    { label: 'Agent Reviewing',       sub: 'Critic Agent checking quality across the quiz…',  icon: '◈' },
    { label: 'Optimising Quality',    sub: 'Refiner improving low-scoring questions…',        icon: '◎' },
    { label: 'Finalizing',            sub: 'Assembling your polished quiz…',                  icon: '✓' },
    { label: 'Ready',                 sub: 'Your quiz is ready for review!',                  icon: '🚀' },
];

// Voice stage label → index mapping for backend stageLabel strings
const VOICE_STAGE_MAP = {
    'Transcribing Audio':    1,
    'Generating Questions':  3,
    'Reviewing Questions':   4,
    'Improving Questions':   5,
    'Preparing Final Quiz':  6,
};

// Standard stage label → index mapping
const STAGE_MAP = {
    'Generating Questions': 0,
    'Reviewing Questions':  1,
    'Improving Questions':  2,
    'Preparing Final Quiz': 3,
};

const NODES = [
    { x: 50, y: 50 },
    { x: 20, y: 20 }, { x: 80, y: 20 },
    { x: 10, y: 60 }, { x: 50, y: 85 }, { x: 90, y: 60 },
    { x: 35, y: 40 }, { x: 65, y: 40 },
];
const CONNECTIONS = [
    [0, 1], [0, 2], [0, 3], [0, 4], [0, 5],
    [1, 6], [2, 7], [6, 3], [7, 4], [6, 7],
];

/**
 * AgentPipelineLoader
 *
 * Props:
 *   stage       {number}  Current stage index (controlled by parent via polling)
 *   stageLabel  {string}  Optional label string from server to auto-map to index
 *   isVoice     {boolean} Use the extended voice stage list
 *   elapsed     {number}  Elapsed seconds (optional, for "still working" hint)
 */
export default function AgentPipelineLoader({ stage = 0, stageLabel, isVoice = false, elapsed = 0 }) {
    const stageList = isVoice ? VOICE_STAGES : STAGES;

    // Map server label string → stage index if provided
    let resolvedStage = stage;
    if (stageLabel) {
        const map = isVoice ? VOICE_STAGE_MAP : STAGE_MAP;
        if (map[stageLabel] !== undefined) resolvedStage = map[stageLabel];
    }
    resolvedStage = Math.min(resolvedStage, stageList.length - 1);

    const pct = Math.round(((resolvedStage + 1) / stageList.length) * 100);
    const showWarning = elapsed > 120; // > 2 minutes

    return (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#E6F0FA] overflow-hidden select-none">

            {/* Ambient Background Glow */}
            <motion.div
                animate={{ opacity: [0.15, 0.35, 0.15] }}
                transition={{ duration: 3.5, repeat: Infinity }}
                className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,#133E87_0%,transparent_65%)] opacity-15"
            />

            {/* Differentiated Animation & Stage Container Card */}
            <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="relative max-w-md w-full mx-4 bg-white/90 backdrop-blur-md border-2 border-[#9cbcd8] rounded-[2.5rem] p-8 sm:p-10 shadow-xl flex flex-col items-center justify-center text-center overflow-hidden"
            >
                {/* Neural Network Visualization */}
                <div className="relative w-48 h-48 sm:w-56 sm:h-56 mb-2">
                    <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full">
                        {CONNECTIONS.map(([a, b], i) => (
                            <motion.line
                                key={i}
                                x1={NODES[a].x} y1={NODES[a].y}
                                x2={NODES[b].x} y2={NODES[b].y}
                                stroke="#133E87" strokeWidth="0.8"
                                animate={{ opacity: [0.2, 0.85, 0.2] }}
                                transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.25 }}
                            />
                        ))}
                        {CONNECTIONS.map(([a, b], i) => (
                            <motion.circle
                                key={`p-${i}`}
                                cx={NODES[a].x}
                                cy={NODES[a].y}
                                r={1.8} fill="#133E87"
                                initial={{ cx: NODES[a].x, cy: NODES[a].y }}
                                animate={{
                                    cx: [NODES[a].x, NODES[b].x, NODES[a].x],
                                    cy: [NODES[a].y, NODES[b].y, NODES[a].y],
                                    opacity: [0.1, 1, 0.1],
                                }}
                                transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.2 }}
                            />
                        ))}
                        {NODES.map((node, i) => (
                            <g key={i}>
                                <motion.circle
                                    cx={node.x} cy={node.y}
                                    fill="none" stroke="#133E87" strokeWidth="0.8"
                                    initial={{ r: i === 0 ? 5 : 3 }}
                                    animate={{ r: [i === 0 ? 5 : 3, i === 0 ? 6.5 : 4, i === 0 ? 5 : 3], opacity: [0.5, 1, 0.5] }}
                                    transition={{ duration: 2, repeat: Infinity, delay: i * 0.25 }}
                                />
                                <motion.circle
                                    cx={node.x} cy={node.y} r={i === 0 ? 2.5 : 1.4}
                                    fill="#133E87"
                                    animate={{ opacity: [0.6, 1, 0.6] }}
                                    transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                                />
                            </g>
                        ))}
                    </svg>
                </div>

                {/* Stage Label */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={resolvedStage}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-1.5 px-2 max-w-xs"
                    >
                        <div className="flex items-center justify-center gap-2">
                            <span className="text-xl font-black text-[#133E87]">
                                {stageList[resolvedStage].icon}
                            </span>
                            <h2 className="text-lg sm:text-xl font-black uppercase italic tracking-tight text-[#0f172a]" style={{ color: '#0f172a' }}>
                                {stageList[resolvedStage].label}
                            </h2>
                        </div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-[#334155] leading-relaxed" style={{ color: '#334155' }}>
                            {stageList[resolvedStage].sub}
                        </p>
                    </motion.div>
                </AnimatePresence>

                {/* Stage Dots */}
                <div className="flex items-center gap-2 mt-5 mb-3">
                    {stageList.map((s, i) => (
                        <motion.div
                            key={i}
                            animate={{
                                width:   i <= resolvedStage ? 20 : 8,
                                opacity: i <= resolvedStage ? 1  : 0.35,
                            }}
                            transition={{ duration: 0.3 }}
                            className={`h-2 rounded-full ${i <= resolvedStage ? 'bg-[#133E87]' : 'bg-slate-300'}`}
                        />
                    ))}
                </div>

                {/* Progress Bar */}
                <div className="w-full max-w-xs h-2 bg-slate-100 border border-slate-300 rounded-full overflow-hidden shadow-inner my-2">
                    <motion.div
                        className="h-full bg-[var(--bg-saffron)] rounded-full"
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.5, ease: 'easeInOut' }}
                    />
                </div>

                {/* Stage Badge */}
                <div className="mt-2 px-3 py-1 rounded-full bg-[var(--accent-sand)] border border-[var(--border-color)]">
                    <p className="text-[9px] font-black uppercase tracking-[0.25em] text-[var(--text-accent)]">
                        Agent Pipeline · Stage {resolvedStage + 1} of {stageList.length}
                    </p>
                </div>

                {/* "Still working" Warning */}
                {showWarning && (
                    <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-3 px-4 py-2 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 text-[11px] font-bold uppercase tracking-wider text-center max-w-xs"
                    >
                        ⚠ Still working — do not close this page
                    </motion.div>
                )}
            </motion.div>
        </div>
    );
}
