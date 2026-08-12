import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const AGENT_STAGES = [
    { label: 'Agent 1: Ingestion & Noise Filtering', sub: 'Sanitizing text, removing boilerplate…',   icon: '🧹' },
    { label: 'Agent 2: Knowledge Graph & Evidence', sub: 'Extracting key concepts & quotes…',         icon: '🕸️' },
    { label: 'Agent 3: 5D Quiz Planning',          sub: 'Designing Bloom taxonomy blueprint…',        icon: '📐' },
    { label: 'Agent 4: Prompt Architect',           sub: 'Formulating zero-leakage prompts…',           icon: '✍️' },
    { label: 'Agent 5: LLM Gateway Execution',      sub: 'Generating candidate questions…',             icon: '⚡' },
    { label: 'Agent 6: Quality & Grounding Validator', sub: 'Checking distractors & grounding…',      icon: '🛡️' },
    { label: 'Agent 7: Self-Healing Repair',        sub: 'Repairing any flawed items…',                icon: '🔧' },
    { label: 'Agent 8: Portfolio Assembly',         sub: 'Finalizing quiz studio…',                    icon: '🚀' },
];

const VOICE_STAGES = [
    { label: 'Agent 1: Ingestion & Noise Filtering', sub: 'Transcribing voice & cleaning audio…', icon: '🎙️' },
    { label: 'Agent 2: Knowledge Graph & Evidence', sub: 'Extracting key concepts & quotes…',     icon: '🕸️' },
    { label: 'Agent 3: 5D Quiz Planning',          sub: 'Designing Bloom taxonomy blueprint…',    icon: '📐' },
    { label: 'Agent 4: Prompt Architect',           sub: 'Formulating zero-leakage prompts…',       icon: '✍️' },
    { label: 'Agent 5: LLM Gateway Execution',      sub: 'Generating candidate questions…',         icon: '⚡' },
    { label: 'Agent 6: Quality & Grounding Validator', sub: 'Checking distractors & grounding…',  icon: '🛡️' },
    { label: 'Agent 7: Self-Healing Repair',        sub: 'Repairing any flawed items…',            icon: '🔧' },
    { label: 'Agent 8: Portfolio Assembly',         sub: 'Finalizing quiz studio…',                icon: '🚀' },
];

const STAGE_MAP = {
    'Generating Questions': 4,
    'Reviewing Questions':  5,
    'Improving Questions':   6,
    'Preparing Final Quiz':  7,
};

// Advance auto stage every 3.5 seconds if prop stage is not updated from server
const STAGE_INTERVAL_MS = 3500;

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

export default function AgentPipelineLoader({ stage = 0, stageLabel, isVoice = false, elapsed = 0 }) {
    const stageList = isVoice ? VOICE_STAGES : AGENT_STAGES;

    const [activeStage, setActiveStage] = useState(stage);

    useEffect(() => {
        let resolvedStage = stage;
        if (stageLabel && STAGE_MAP[stageLabel] !== undefined) {
            resolvedStage = STAGE_MAP[stageLabel];
        }
        if (resolvedStage > activeStage) {
            setActiveStage(Math.min(resolvedStage, stageList.length - 1));
        }
    }, [stage, stageLabel, stageList.length]);

    useEffect(() => {
        const timer = setInterval(() => {
            setActiveStage(s => Math.min(s + 1, stageList.length - 1));
        }, STAGE_INTERVAL_MS);
        return () => clearInterval(timer);
    }, [stageList.length]);

    const pct = Math.round(((activeStage + 1) / stageList.length) * 100);

    return (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#E6F0FA] overflow-hidden select-none">

            {/* Ambient Background Glow */}
            <motion.div
                animate={{ opacity: [0.15, 0.35, 0.15] }}
                transition={{ duration: 3.5, repeat: Infinity }}
                className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,#133E87_0%,transparent_65%)] opacity-15"
            />

            {/* Original Light Theme Stage Container Card */}
            <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="relative max-w-md w-full mx-4 bg-white/90 backdrop-blur-md border-2 border-[#9cbcd8] rounded-[2.5rem] p-8 sm:p-10 shadow-xl flex flex-col items-center justify-center text-center overflow-hidden"
            >
                {/* Neural Network Visualization */}
                <div className="relative w-44 h-44 sm:w-52 sm:h-52 mb-2">
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
                        key={activeStage}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-1.5 px-2 max-w-xs"
                    >
                        <div className="flex items-center justify-center gap-2">
                            <span className="text-xl">{stageList[activeStage].icon}</span>
                            <h2 className="text-base sm:text-lg font-black uppercase tracking-tight text-[#0f172a]" style={{ color: '#0f172a' }}>
                                {stageList[activeStage].label}
                            </h2>
                        </div>
                        <p className="text-[11px] font-bold tracking-wider text-[#334155] leading-relaxed" style={{ color: '#334155' }}>
                            {stageList[activeStage].sub}
                        </p>
                    </motion.div>
                </AnimatePresence>

                {/* Stage Dots */}
                <div className="flex items-center gap-1.5 mt-5 mb-3">
                    {stageList.map((s, i) => (
                        <motion.div
                            key={i}
                            animate={{
                                width:   i <= activeStage ? 16 : 6,
                                opacity: i <= activeStage ? 1  : 0.35,
                            }}
                            transition={{ duration: 0.3 }}
                            className={`h-2 rounded-full ${i <= activeStage ? 'bg-[#133E87]' : 'bg-slate-300'}`}
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
                        Multi-Agent Pipeline · Agent {activeStage + 1} of {stageList.length}
                    </p>
                </div>
            </motion.div>
        </div>
    );
}
