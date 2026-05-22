/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const STAGES = [
    { label: 'Generating Questions',   sub: 'AI crafting questions from your source…',    icon: '✦' },
    { label: 'Agent Reviewing',        sub: 'Critic Agent checking quality across the quiz…', icon: '◈' },
    { label: 'Optimising Quality',     sub: 'Refiner improving low-scoring questions…',   icon: '◎' },
    { label: 'Preparing Final Quiz',   sub: 'Assembling your polished quiz…',             icon: '✓' },
];

// Advance a stage every N ms while loading is true
const STAGE_INTERVAL_MS = 4500;

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

export default function AgentPipelineLoader() {
    const [stage, setStage] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setStage(s => Math.min(s + 1, STAGES.length - 1));
        }, STAGE_INTERVAL_MS);
        return () => clearInterval(timer);
    }, []);

    const pct = Math.round(((stage + 1) / STAGES.length) * 100);

    return (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[var(--bg-primary)] overflow-hidden">

            {/* Glow */}
            <motion.div
                animate={{ opacity: [0.05, 0.18, 0.05] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="absolute inset-0 pointer-events-none"
                style={{ background: 'radial-gradient(ellipse at center, var(--bg-accent) 0%, transparent 65%)' }}
            />

            {/* Neural network */}
            <div className="relative w-64 h-64">
                <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full">
                    {CONNECTIONS.map(([a, b], i) => (
                        <motion.line
                            key={i}
                            x1={NODES[a].x} y1={NODES[a].y}
                            x2={NODES[b].x} y2={NODES[b].y}
                            stroke="var(--bg-accent)" strokeWidth="0.4"
                            animate={{ opacity: [0.1, 0.7, 0.1] }}
                            transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.25 }}
                        />
                    ))}
                    {CONNECTIONS.map(([a, b], i) => (
                        <motion.circle
                            key={`p-${i}`}
                            r={1.5} fill="var(--bg-accent)"
                            animate={{
                                cx: [NODES[a].x, NODES[b].x, NODES[a].x],
                                cy: [NODES[a].y, NODES[b].y, NODES[a].y],
                                opacity: [0, 1, 0],
                            }}
                            transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.2 }}
                        />
                    ))}
                    {NODES.map((node, i) => (
                        <g key={i}>
                            <motion.circle
                                cx={node.x} cy={node.y} r={i === 0 ? 5 : 3}
                                fill="none" stroke="var(--bg-accent)" strokeWidth="0.6"
                                animate={{ r: [i === 0 ? 5 : 3, i === 0 ? 6.5 : 4, i === 0 ? 5 : 3], opacity: [0.4, 1, 0.4] }}
                                transition={{ duration: 2, repeat: Infinity, delay: i * 0.25 }}
                            />
                            <motion.circle
                                cx={node.x} cy={node.y} r={i === 0 ? 2.5 : 1.2}
                                fill="var(--bg-accent)"
                                animate={{ opacity: [0.5, 1, 0.5] }}
                                transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                            />
                        </g>
                    ))}
                </svg>
            </div>

            {/* Stage label */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={stage}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.4 }}
                    className="mt-6 text-center space-y-2 px-6"
                >
                    <div className="flex items-center justify-center gap-3">
                        <span
                            className="text-2xl font-black"
                            style={{ color: 'var(--bg-accent)' }}
                        >
                            {STAGES[stage].icon}
                        </span>
                        <h2
                            className="text-xl font-black uppercase italic tracking-widest"
                            style={{ color: 'var(--text-primary)' }}
                        >
                            {STAGES[stage].label}
                        </h2>
                    </div>
                    <p
                        className="text-xs font-bold uppercase tracking-[0.3em]"
                        style={{ color: 'var(--text-secondary)' }}
                    >
                        {STAGES[stage].sub}
                    </p>
                </motion.div>
            </AnimatePresence>

            {/* Stage dots */}
            <div className="flex items-center gap-3 mt-8">
                {STAGES.map((s, i) => (
                    <motion.div
                        key={i}
                        animate={{
                            width:   i <= stage ? 24 : 8,
                            opacity: i <= stage ? 1  : 0.3,
                        }}
                        transition={{ duration: 0.4 }}
                        className="h-2 rounded-full"
                        style={{ background: 'var(--bg-accent)' }}
                    />
                ))}
            </div>

            {/* Progress bar */}
            <div className="mt-6 w-72 h-1 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                    className="h-full rounded-full"
                    style={{ background: 'var(--bg-accent)' }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6, ease: 'easeInOut' }}
                />
            </div>

            <p
                className="mt-3 text-[10px] font-black uppercase tracking-[0.4em]"
                style={{ color: 'var(--text-secondary)', opacity: 0.5 }}
            >
                Agent Pipeline · Stage {stage + 1} of {STAGES.length}
            </p>
        </div>
    );
}
//hi
