import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Multi-Agent System Pipeline Stages (Agent 1 through Agent 8) ──────────────
const AGENT_STAGES = [
    { label: 'Agent 1: Ingestion & Noise Filtering Agent 🧹', sub: 'Cleans administrative noise and prepares source text…', icon: '🧹' },
    { label: 'Agent 2: Knowledge Graph & Evidence Agent 🎯',  sub: 'Identifies core concepts and maps exact source evidence…', icon: '🎯' },
    { label: 'Agent 3: 5D Quiz Planning Agent 📐',           sub: 'Designs quiz depth, Bloom levels, and slot blueprints…', icon: '📐' },
    { label: 'Agent 4: Prompt Architect Agent ✍️',            sub: 'Writes strict prompts enforcing self-contained domain context…', icon: '✍️' },
    { label: 'Agent 5: LLM Gateway Execution Agent 🤖',       sub: 'Communicates with Groq Llama-3 for live MCQ generation…', icon: '🤖' },
    { label: 'Agent 6: Quality & Grounding Validator Agent 🛡️', sub: 'Evaluates candidates against grounding & quality rules…', icon: '🛡️' },
    { label: 'Agent 7: Self-Healing Repair Agent 🛠️',        sub: 'Automatically reruns and rewrites any flagged questions…', icon: '🛠️' },
    { label: 'Agent 8: Portfolio Assembly Agent 🚀',          sub: 'Balances answer keys (A/B/C/D) and finalizes quiz studio…', icon: '🚀' },
];

const VOICE_STAGES = [
    { label: 'Uploading Audio',       sub: 'Sending your recording to the server…',           icon: '📤' },
    { label: 'Transcribing',          sub: 'AI converting your speech to text…',              icon: '🎙️' },
    { label: 'Extracting Topics',     sub: 'Identifying key concepts from lecture…',          icon: '🔍' },
    { label: 'Agent 1: Ingestion Agent 🧹', sub: 'Cleans administrative noise…',              icon: '🧹' },
    { label: 'Agent 2: Concept Graph Agent 🎯', sub: 'Building knowledge graph…',             icon: '🎯' },
    { label: 'Agent 5: LLM Generator 🤖', sub: 'Generating questions from lecture…',         icon: '🤖' },
    { label: 'Agent 6: Quality Validator 🛡️', sub: 'Checking quality across quiz…',          icon: '🛡️' },
    { label: 'Agent 8: Portfolio Assembly 🚀', sub: 'Finalizing quiz studio…',              icon: '🚀' },
];

const STAGE_MAP = {
    'Generating Questions': 4,
    'Reviewing Questions':  5,
    'Improving Questions':   6,
    'Preparing Final Quiz':  7,
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

export default function AgentPipelineLoader({ stage = 0, stageLabel, isVoice = false, elapsed = 0 }) {
    const stageList = isVoice ? VOICE_STAGES : AGENT_STAGES;

    let resolvedStage = stage;
    if (stageLabel && STAGE_MAP[stageLabel] !== undefined) {
        resolvedStage = STAGE_MAP[stageLabel];
    }
    resolvedStage = Math.min(resolvedStage, stageList.length - 1);

    const pct = Math.round(((resolvedStage + 1) / stageList.length) * 100);

    return (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-md overflow-hidden select-none">
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative max-w-md w-full mx-4 bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl flex flex-col items-center justify-center text-center overflow-hidden text-slate-100"
            >
                {/* Neural Network Node Animation */}
                <div className="relative w-40 h-40 mb-2">
                    <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full">
                        {CONNECTIONS.map(([a, b], i) => (
                            <motion.line
                                key={i}
                                x1={NODES[a].x} y1={NODES[a].y}
                                x2={NODES[b].x} y2={NODES[b].y}
                                stroke="#6366f1" strokeWidth="1"
                                animate={{ opacity: [0.2, 0.9, 0.2] }}
                                transition={{ duration: 2, repeat: Infinity, delay: i * 0.2 }}
                            />
                        ))}
                        {NODES.map((node, i) => (
                            <motion.circle
                                key={i}
                                cx={node.x} cy={node.y} r={i === 0 ? 4 : 2.5}
                                fill="#818cf8"
                                animate={{ opacity: [0.5, 1, 0.5] }}
                                transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.15 }}
                            />
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
                        transition={{ duration: 0.2 }}
                        className="space-y-2 px-2"
                    >
                        <div className="flex items-center justify-center gap-2">
                            <span className="text-2xl">{stageList[resolvedStage].icon}</span>
                            <h2 className="text-base font-extrabold text-white tracking-tight">
                                {stageList[resolvedStage].label}
                            </h2>
                        </div>
                        <p className="text-xs font-medium text-slate-400">
                            {stageList[resolvedStage].sub}
                        </p>
                    </motion.div>
                </AnimatePresence>

                {/* Multi-Agent Progress Bar */}
                <div className="w-full max-w-xs h-2 bg-slate-950 border border-slate-800 rounded-full overflow-hidden shadow-inner my-5">
                    <motion.div
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                    />
                </div>

                {/* Agent Badge */}
                <div className="px-4 py-1.5 rounded-full bg-slate-950 border border-slate-800">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">
                        Multi-Agent Pipeline • Agent {resolvedStage + 1} of {stageList.length}
                    </p>
                </div>
            </motion.div>
        </div>
    );
}
