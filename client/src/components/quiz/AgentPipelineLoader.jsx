import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Inbox, Network, Ruler, Scale, Search, ShieldCheck, Zap, Rocket } from 'lucide-react';

const PIPELINE_STAGES = [
    { label: 'Ingesting & Analyzing Material',             sub: 'Verifying inputs, removing noise, and validating content structure…',     icon: Inbox },
    { label: 'Packaging Evidence & Knowledge Graph',        sub: 'Extracting concepts, key claims, formulas, and artifacts…',              icon: Network },
    { label: 'Assessment Planning & TC Analysis',           sub: 'Calibrating depth, cognitive levels, and planning targets…',             icon: Ruler },
    { label: 'Generating Questions via AI',                 sub: 'Formulating evidence-grounded candidate questions from concept graph…',  icon: Zap },
    { label: 'Validating Options & Deterministic Schema',   sub: 'Enforcing 4 distinct options and multi-factor anti-redundancy checks…',  icon: ShieldCheck },
    { label: 'Auditing Derivability & Pedagogical Quality', sub: 'Auditing 5-tier derivability, student answerability, and distractors…', icon: Search },
    { label: 'Reviewing Balance & Curriculum Coverage',     sub: 'Reviewing cognitive distribution, cluster balance, and curriculum…',     icon: Scale },
    { label: 'Grounding Gate & Final Audit',                sub: 'Verifying source evidence citations and assembling final quiz…',         icon: Rocket },
];

const STAGE_MAP = {
    'Ingesting & Analyzing Material': 0,
    'Packaging Evidence & Knowledge Graph': 1,
    'Assessment Planning & TC Analysis': 2,
    'Generating Questions via AI': 3,
    'Validating Options & Deterministic Schema': 4,
    'Auditing Derivability & Pedagogical Quality': 5,
    'Reviewing Balance & Curriculum Coverage': 6,
    'Grounding Gate & Final Audit': 7,
    'Generating Questions': 3,
    'Reviewing Questions': 5,
    'Improving Questions': 6,
    'Preparing Final Quiz': 7,
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

export default function AgentPipelineLoader({ stage = 0, stageLabel, isVoice = false, elapsed = 0, representationMode = null }) {
    const stageList = PIPELINE_STAGES;

    const [activeStage, setActiveStage] = useState(() => {
        if (stageLabel && STAGE_MAP[stageLabel] !== undefined) {
            return STAGE_MAP[stageLabel];
        }
        return typeof stage === 'number' ? Math.min(Math.max(0, stage), stageList.length - 1) : 0;
    });

    useEffect(() => {
        let resolvedStage = stage;
        if (stageLabel && STAGE_MAP[stageLabel] !== undefined) {
            resolvedStage = STAGE_MAP[stageLabel];
        }
        if (typeof resolvedStage === 'number' && resolvedStage >= 0) {
            setActiveStage(Math.min(resolvedStage, stageList.length - 1));
        }
    }, [stage, stageLabel, stageList.length]);

    const pct = Math.round(((activeStage + 1) / stageList.length) * 100);

    return (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[var(--bg-secondary)] overflow-hidden select-none">
            <motion.div
                animate={{ opacity: [0.12, 0.24, 0.12] }}
                transition={{ duration: 3.5, repeat: Infinity }}
                className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,rgba(17,17,17,0.08),transparent_68%)]"
            />

            <motion.div
                initial={{ opacity: 0, scale: 0.97, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: 12 }}
                className="relative max-w-md w-full mx-4 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-[2.2rem] p-7 sm:p-8 shadow-[0_18px_40px_rgba(15,23,42,0.08)] flex flex-col items-center justify-center text-center overflow-hidden"
            >
                <div className="relative w-40 h-40 sm:w-44 sm:h-44 mb-4">
                    <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full">
                        {CONNECTIONS.map(([a, b], i) => (
                            <motion.line
                                key={i}
                                x1={NODES[a].x} y1={NODES[a].y}
                                x2={NODES[b].x} y2={NODES[b].y}
                                stroke="var(--text-accent)"
                                strokeWidth="0.8"
                                animate={{ opacity: [0.2, 0.7, 0.2] }}
                                transition={{ duration: 2.8, repeat: Infinity, delay: i * 0.2 }}
                            />
                        ))}
                        {NODES.map((node, i) => (
                            <g key={i}>
                                <motion.circle
                                    cx={node.x} cy={node.y}
                                    fill="none" stroke="var(--text-accent)"
                                    strokeWidth="0.8"
                                    initial={{ r: i === 0 ? 6 : 3 }}
                                    animate={{ r: [i === 0 ? 6 : 3, i === 0 ? 7.5 : 4, i === 0 ? 6 : 3], opacity: [0.45, 1, 0.45] }}
                                    transition={{ duration: 2.2, repeat: Infinity, delay: i * 0.2 }}
                                />
                                <motion.circle
                                    cx={node.x} cy={node.y} r={i === 0 ? 2.6 : 1.4}
                                    fill="var(--text-accent)"
                                    animate={{ opacity: [0.6, 1, 0.6] }}
                                    transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.15 }}
                                />
                            </g>
                        ))}
                    </svg>
                </div>

                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeStage}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.25 }}
                        className="space-y-2 px-2 w-full"
                    >
                        <div className="flex items-center justify-center gap-2.5">
                            <span className="text-[var(--text-accent)]" aria-hidden="true">
                                {React.createElement(stageList[activeStage].icon, { size: 20, strokeWidth: 2.5 })}
                            </span>
                            <h2 className="text-base sm:text-lg font-black uppercase tracking-[-0.02em] text-[var(--text-primary)]">
                                {stageList[activeStage].label}
                            </h2>
                        </div>

                        {stageLabel && stageLabel !== stageList[activeStage].label && (
                            <div className="mx-auto inline-flex items-center justify-center rounded-full border border-[var(--border-color)] bg-[var(--bg-secondary)] px-2.5 py-1">
                                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--text-secondary)]">
                                    {stageLabel.includes('(') ? stageLabel.replace(/^.*?\((.*?)\).*$/, '$1') : stageLabel}
                                </p>
                            </div>
                        )}

                        <p className="text-[11px] font-medium tracking-[0.02em] text-[var(--text-secondary)] leading-relaxed px-2">
                            {stageList[activeStage].sub}
                        </p>

                        <div className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-[var(--bg-accent)]/80" />
                            {elapsed > 0 ? <><Clock size={12} aria-hidden="true" /> {Math.floor(elapsed / 60)}:{(elapsed % 60).toString().padStart(2, '0')} elapsed</> : 'System live'}
                        </div>
                    </motion.div>
                </AnimatePresence>

                <div className="flex items-center gap-1.5 my-4 w-full max-w-[220px]">
                    {stageList.map((s, i) => (
                        <motion.div
                            key={i}
                            animate={{
                                width: i <= activeStage ? 18 : 7,
                                opacity: i <= activeStage ? 1 : 0.35,
                            }}
                            transition={{ duration: 0.3 }}
                            className={`h-2 rounded-full ${i <= activeStage ? 'bg-[var(--bg-accent)]' : 'bg-[var(--border-color)]'}`}
                        />
                    ))}
                </div>

                <div className="w-full max-w-[220px] h-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-full overflow-hidden shadow-inner">
                    <motion.div
                        className="h-full bg-[var(--bg-accent)] rounded-full"
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.45, ease: 'easeInOut' }}
                    />
                </div>

                <div className="mt-4 flex flex-col items-center gap-2">
                    <div className="px-3 py-1.5 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-color)]">
                        <p className="text-[9px] font-black uppercase tracking-[0.26em] text-[var(--text-primary)]">
                            ARCHITECTURE E · STAGE {activeStage + 1} OF {stageList.length}
                        </p>
                    </div>
                    <div className="px-3 py-1 rounded-md bg-[var(--bg-secondary)] border border-[var(--border-color)]">
                        <p className="text-[8px] font-bold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                            REPRESENTATION PATH: <span className="text-[var(--text-primary)] font-black">{representationMode || 'DETERMINING...'}</span>
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
