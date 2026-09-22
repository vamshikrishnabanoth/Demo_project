import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Clock, Inbox, Network, Ruler, Scale, Search, ShieldCheck, Zap, Rocket,
    CheckCircle2, Loader2, Sparkles, Activity, Cpu, Shield, ArrowRight
} from "lucide-react";

const PIPELINE_STAGES = [
    { label: "Ingesting & Analyzing Material",             sub: "Verifying inputs, removing noise, and validating content structure...",     icon: Inbox,       shortLabel: "Input Analysis" },
    { label: "Packaging Evidence & Knowledge Graph",        sub: "Extracting concepts, key claims, formulas, and artifacts...",              icon: Network,     shortLabel: "Knowledge Graph" },
    { label: "Assessment Planning & TC Analysis",           sub: "Calibrating depth, cognitive levels, and planning targets...",             icon: Ruler,       shortLabel: "TC Analysis" },
    { label: "Generating Questions via AI",                 sub: "Formulating evidence-grounded candidate questions from concept graph...",  icon: Zap,         shortLabel: "Generating Questions" },
    { label: "Validating Options & Deterministic Schema",   sub: "Enforcing 4 distinct options and multi-factor anti-redundancy checks...",  icon: ShieldCheck, shortLabel: "Validating Options" },
    { label: "Auditing Derivability & Pedagogical Quality", sub: "Auditing 5-tier derivability, student answerability, and distractors...", icon: Search,      shortLabel: "Quality Audit" },
    { label: "Reviewing Balance & Curriculum Coverage",     sub: "Reviewing cognitive distribution, cluster balance, and curriculum...",     icon: Scale,       shortLabel: "Balance Review" },
    { label: "Grounding Gate & Final Audit",                sub: "Verifying source evidence citations and assembling final quiz...",         icon: Rocket,      shortLabel: "Final Assembly" },
];

const STAGE_MAP = {
    "Ingesting & Analyzing Material": 0,
    "Packaging Evidence & Knowledge Graph": 1,
    "Assessment Planning & TC Analysis": 2,
    "Generating Questions via AI": 3,
    "Validating Options & Deterministic Schema": 4,
    "Auditing Derivability & Pedagogical Quality": 5,
    "Reviewing Balance & Curriculum Coverage": 6,
    "Grounding Gate & Final Audit": 7,
    "Generating Questions": 3,
    "Reviewing Questions": 5,
    "Improving Questions": 6,
    "Preparing Final Quiz": 7,
};

const NODES = [
    { x: 50, y: 50, radius: 7, label: "Core", primary: true },
    { x: 22, y: 24, radius: 4.5 },
    { x: 78, y: 24, radius: 4.5 },
    { x: 14, y: 64, radius: 4.5 },
    { x: 50, y: 86, radius: 5 },
    { x: 86, y: 64, radius: 4.5 },
    { x: 34, y: 38, radius: 4 },
    { x: 66, y: 38, radius: 4 },
];

const CONNECTIONS = [
    [0, 1], [0, 2], [0, 3], [0, 4], [0, 5],
    [1, 6], [2, 7], [6, 3], [7, 4], [6, 7],
    [1, 2], [3, 4], [4, 5]
];

function fmtElapsed(secs) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}m ${String(s).padStart(2, "0")}s` : `${s}s`;
}

export default function AgentPipelineLoader({
    stage = 0,
    stageLabel,
    isVoice = false,
    elapsed = 0,
    representationMode = null,
}) {
    const stageList = PIPELINE_STAGES;

    const [activeStage, setActiveStage] = useState(() => {
        if (stageLabel && STAGE_MAP[stageLabel] !== undefined) {
            return STAGE_MAP[stageLabel];
        }
        return typeof stage === "number" ? Math.min(Math.max(0, stage), stageList.length - 1) : 0;
    });

    useEffect(() => {
        let resolvedStage = stage;
        if (stageLabel && STAGE_MAP[stageLabel] !== undefined) {
            resolvedStage = STAGE_MAP[stageLabel];
        }
        if (typeof resolvedStage === "number" && resolvedStage >= 0) {
            setActiveStage(Math.min(resolvedStage, stageList.length - 1));
        }
    }, [stage, stageLabel, stageList.length]);

    const pct = Math.round(((activeStage + 1) / stageList.length) * 100);
    const currentStage = stageList[activeStage];
    const CurrentIcon = currentStage.icon;

    const subLabel = stageLabel && STAGE_MAP[stageLabel] !== undefined
        ? null
        : stageLabel && stageLabel !== currentStage.label
            ? stageLabel.replace(/^.*?\((.*?)\).*$/, "$1") || stageLabel
            : null;

    return (
        <div className="fixed inset-0 z-[200] overflow-y-auto bg-slate-950/85 backdrop-blur-xl flex items-center justify-center p-3 sm:p-6 md:p-8 select-none">
            {/* Ambient Background Glow Spotlights */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute -top-[20%] left-1/2 -translate-x-1/2 w-[900px] h-[550px] bg-indigo-600/20 rounded-full blur-[160px]" />
                <div className="absolute -bottom-[20%] left-1/3 w-[750px] h-[450px] bg-amber-500/15 rounded-full blur-[150px]" />
                <div className="absolute top-1/2 right-10 w-[450px] h-[450px] bg-emerald-500/10 rounded-full blur-[140px]" />
            </div>

            {/* Production Grade Dark Glass Modal Card */}
            <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="w-full max-w-5xl bg-slate-950/95 border border-slate-800/90 rounded-[2.5rem] shadow-[0_30px_100px_rgba(0,0,0,0.8)] overflow-hidden relative z-10 flex flex-col my-auto"
            >
                {/* Top Status Bar */}
                <div className="bg-slate-900/80 border-b border-slate-800 px-6 sm:px-8 py-4 flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 shadow-xs">
                            <Sparkles size={13} className="text-indigo-400 animate-spin" style={{ animationDuration: '4s' }} />
                            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-indigo-300">AI Assessment Studio</span>
                        </div>
                        <span className="hidden sm:inline-block text-xs font-bold text-slate-700">·</span>
                        <span className="hidden sm:inline-block text-xs font-bold text-slate-400">Autonomous Neural Pipeline</span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] font-bold text-slate-300">
                        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-black uppercase tracking-wider text-[10px]">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                            Live Processing
                        </span>
                        {elapsed > 0 && (
                            <span className="flex items-center gap-1 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-300 font-mono text-[11px]">
                                <Clock size={12} className="text-indigo-400" />
                                {fmtElapsed(elapsed)}
                            </span>
                        )}
                    </div>
                </div>

                {/* Main Content Area: 2 Columns */}
                <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-800/80">

                    {/* LEFT COLUMN: Futuristic AI Reactor & Active Target Card (5 Cols) */}
                    <div className="lg:col-span-5 p-6 sm:p-8 flex flex-col items-center justify-center gap-6 bg-gradient-to-b from-slate-900/40 via-slate-950 to-slate-900/30">
                        
                        {/* High-Tech Neural Constellation & Quantum Core */}
                        <div className="relative w-48 h-48 sm:w-56 sm:h-56 flex items-center justify-center">
                            
                            {/* Outer Orbit Ring */}
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
                                className="absolute inset-2 rounded-full border border-dashed border-indigo-500/40 pointer-events-none"
                            />

                            {/* Inner Counter-Rotating Ring */}
                            <motion.div
                                animate={{ rotate: -360 }}
                                transition={{ duration: 16, repeat: Infinity, ease: "linear" }}
                                className="absolute inset-8 rounded-full border border-slate-800 pointer-events-none"
                            >
                                <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-indigo-400 shadow-[0_0_12px_rgba(129,140,248,0.9)]" />
                                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]" />
                            </motion.div>

                            {/* Radar Scan Sweep Line */}
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
                                className="absolute inset-0 rounded-full pointer-events-none"
                                style={{
                                    background: "conic-gradient(from 0deg, transparent 0deg, transparent 300deg, rgba(99,102,241,0.2) 360deg)",
                                    borderRadius: "50%"
                                }}
                            />

                            {/* Neural Network SVG */}
                            <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full p-3">
                                <defs>
                                    <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" stopColor="#818cf8" stopOpacity="0.8" />
                                        <stop offset="100%" stopColor="#c084fc" stopOpacity="0.8" />
                                    </linearGradient>
                                    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                                        <feGaussianBlur stdDeviation="2.5" result="blur" />
                                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                                    </filter>
                                </defs>

                                {/* Connections */}
                                {CONNECTIONS.map(([a, b], i) => (
                                    <g key={`conn-${i}`}>
                                        <line
                                            x1={NODES[a].x}
                                            y1={NODES[a].y}
                                            x2={NODES[b].x}
                                            y2={NODES[b].y}
                                            stroke="#334155"
                                            strokeWidth="1.2"
                                        />
                                        <motion.line
                                            x1={NODES[a].x}
                                            y1={NODES[a].y}
                                            x2={NODES[b].x}
                                            y2={NODES[b].y}
                                            stroke="url(#lineGrad)"
                                            strokeWidth="1.8"
                                            strokeDasharray="4 8"
                                            animate={{ strokeDashoffset: [24, 0] }}
                                            transition={{ duration: 1.8, repeat: Infinity, ease: "linear", delay: i * 0.1 }}
                                        />
                                    </g>
                                ))}

                                {/* Nodes */}
                                {NODES.map((node, i) => {
                                    const isCenter = node.primary;
                                    return (
                                        <g key={`node-${i}`}>
                                            <motion.circle
                                                cx={node.x}
                                                cy={node.y}
                                                r={isCenter ? 12 : 7}
                                                fill="none"
                                                stroke={isCenter ? "#818cf8" : "#c084fc"}
                                                strokeWidth="1"
                                                animate={{
                                                    r: isCenter ? [10, 18, 10] : [5, 9, 5],
                                                    opacity: [0.6, 0, 0.6],
                                                }}
                                                transition={{ duration: 2.2, repeat: Infinity, delay: i * 0.2 }}
                                            />
                                            <circle
                                                cx={node.x}
                                                cy={node.y}
                                                r={node.radius}
                                                fill={isCenter ? "#6366f1" : "#818cf8"}
                                                filter={isCenter ? "url(#glow)" : undefined}
                                            />
                                            <circle
                                                cx={node.x}
                                                cy={node.y}
                                                r={node.radius * 0.45}
                                                fill="#ffffff"
                                            />
                                        </g>
                                    );
                                })}
                            </svg>

                            {/* Central Core Badge */}
                            <motion.div
                                animate={{ scale: [1, 1.1, 1] }}
                                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                                className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 via-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/50 relative z-20"
                            >
                                <Zap size={22} className="fill-white" />
                            </motion.div>
                        </div>

                        {/* Active Stage Card */}
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={activeStage}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.25 }}
                                className="w-full bg-slate-900/80 border border-indigo-500/30 rounded-2xl p-5 shadow-xl text-center space-y-2.5 backdrop-blur-md"
                            >
                                <div className="inline-flex items-center justify-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30">
                                    <CurrentIcon size={14} className="text-indigo-400" />
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300">
                                        Stage {activeStage + 1} of {stageList.length}
                                    </span>
                                </div>

                                <h2 className="text-base sm:text-lg font-black uppercase tracking-tight text-white leading-snug">
                                    {currentStage.label}
                                </h2>

                                <p className="text-xs text-slate-300 font-medium leading-relaxed max-w-sm mx-auto">
                                    {currentStage.sub}
                                </p>

                                {subLabel && (
                                    <div className="inline-block mt-1 px-3 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[10px] font-mono font-bold text-amber-400">
                                        {subLabel}
                                    </div>
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    {/* RIGHT COLUMN: Progress Telemetry & Live Step Breakdown (7 Cols) */}
                    <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between gap-6 bg-slate-950">

                        {/* Header Title in Right Pane */}
                        <div>
                            <div className="flex items-end justify-between mb-3">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Pipeline Execution</p>
                                    <h3 className="text-xl sm:text-2xl font-black italic uppercase tracking-tight text-white mt-0.5">
                                        Synthesizing Assessment
                                    </h3>
                                </div>
                                <motion.div
                                    key={pct}
                                    initial={{ scale: 0.85, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    className="text-4xl sm:text-5xl font-black italic tabular-nums leading-none tracking-tight bg-gradient-to-r from-amber-400 via-indigo-400 to-emerald-400 bg-clip-text text-transparent"
                                >
                                    {pct}%
                                </motion.div>
                            </div>

                            {/* Progress Bar with Shimmer */}
                            <div className="h-3.5 bg-slate-900 border border-slate-800 rounded-full overflow-hidden p-0.5 relative shadow-inner">
                                <motion.div
                                    className="h-full rounded-full bg-gradient-to-r from-amber-500 via-indigo-500 to-emerald-500 relative overflow-hidden shadow-[0_0_12px_rgba(99,102,241,0.5)]"
                                    animate={{ width: `${pct}%` }}
                                    transition={{ duration: 0.5, ease: "easeInOut" }}
                                >
                                    {/* Shimmer traversal */}
                                    <motion.div
                                        animate={{ x: ["-100%", "200%"] }}
                                        transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
                                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent w-1/2"
                                    />
                                </motion.div>
                            </div>

                            {/* Tags under progress */}
                            <div className="flex flex-wrap items-center gap-2 mt-3">
                                <div className="px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-400">
                                    Architecture E · Deterministic Mode
                                </div>
                                {representationMode && (
                                    <div className="px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-[10px] font-black uppercase tracking-wider text-indigo-300">
                                        Path: {representationMode}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Pipeline Step Checklist */}
                        <div className="space-y-1.5 my-auto">
                            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 mb-2">Stage Checklist</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {stageList.map((s, i) => {
                                    const isCompleted = i < activeStage;
                                    const isActive = i === activeStage;
                                    const SIcon = s.icon;
                                    return (
                                        <div
                                            key={i}
                                            className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border transition-all ${
                                                isActive
                                                    ? "bg-indigo-950/70 border-indigo-500/70 shadow-lg shadow-indigo-500/20 ring-1 ring-indigo-500/40 text-white"
                                                    : isCompleted
                                                    ? "bg-emerald-950/30 border-emerald-500/30 text-emerald-300"
                                                    : "bg-slate-900/40 border-slate-800/60 text-slate-600 opacity-60"
                                            }`}
                                        >
                                            <div className="flex-shrink-0">
                                                {isCompleted ? (
                                                    <CheckCircle2 size={15} className="text-emerald-400 fill-emerald-950" />
                                                ) : isActive ? (
                                                    <Loader2 size={15} className="text-indigo-400 animate-spin" />
                                                ) : (
                                                    <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-700" />
                                                )}
                                            </div>

                                            <span className={`text-xs leading-tight truncate ${
                                                isActive
                                                    ? "font-black text-white"
                                                    : isCompleted
                                                    ? "font-bold text-slate-300"
                                                    : "font-medium text-slate-500"
                                            }`}>
                                                {s.shortLabel}
                                            </span>

                                            {isActive && (
                                                <span className="ml-auto w-2 h-2 rounded-full bg-indigo-400 animate-ping flex-shrink-0" />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Bottom Informational Bar */}
                        <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-bold text-slate-400">
                            <span className="flex items-center gap-1.5 text-emerald-400">
                                <Shield size={13} className="text-emerald-400" />
                                Zero-Hallucination Grounded
                            </span>
                            <span className="text-slate-500">Do not refresh or close</span>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}