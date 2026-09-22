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
        <div className="fixed inset-0 z-[200] overflow-y-auto bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 md:p-8 select-none">
            {/* Ambient Background Glow */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute -top-[20%] left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-indigo-500/15 rounded-full blur-[140px]" />
                <div className="absolute -bottom-[20%] left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-amber-500/10 rounded-full blur-[140px]" />
            </div>

            {/* Production Grade Modal Card */}
            <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="w-full max-w-5xl bg-white border-2 border-slate-200/90 rounded-[2.5rem] shadow-[0_30px_90px_rgba(15,23,42,0.28)] overflow-hidden relative z-10 flex flex-col my-auto"
            >
                {/* Top Subtle Status Strip */}
                <div className="bg-slate-50 border-b border-slate-100 px-6 sm:px-8 py-4 flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200/80 shadow-xs">
                            <Sparkles size={13} className="text-indigo-600 animate-spin" style={{ animationDuration: '4s' }} />
                            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-indigo-700">AI Assessment Studio</span>
                        </div>
                        <span className="hidden sm:inline-block text-xs font-bold text-slate-400">·</span>
                        <span className="hidden sm:inline-block text-xs font-bold text-slate-500">Autonomous Neural Pipeline</span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] font-bold text-slate-500">
                        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-black uppercase tracking-wider text-[10px]">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            Live
                        </span>
                        {elapsed > 0 && (
                            <span className="flex items-center gap-1 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-mono text-[11px]">
                                <Clock size={12} className="text-slate-400" />
                                {fmtElapsed(elapsed)}
                            </span>
                        )}
                    </div>
                </div>

                {/* Main Content Area: 2 Columns */}
                <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">

                    {/* LEFT COLUMN: Futuristic AI Reactor & Active Target Card (5 Cols) */}
                    <div className="lg:col-span-5 p-6 sm:p-8 flex flex-col items-center justify-center gap-6 bg-gradient-to-b from-slate-50/50 via-white to-slate-50/30">
                        
                        {/* High-Tech Neural Constellation & Quantum Core */}
                        <div className="relative w-48 h-48 sm:w-56 sm:h-56 flex items-center justify-center">
                            
                            {/* Outer Slow Rotating Orbital Ring */}
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
                                className="absolute inset-2 rounded-full border border-dashed border-indigo-300/60 pointer-events-none"
                            />

                            {/* Inner Counter-Rotating Ring with Satellite dots */}
                            <motion.div
                                animate={{ rotate: -360 }}
                                transition={{ duration: 16, repeat: Infinity, ease: "linear" }}
                                className="absolute inset-8 rounded-full border border-slate-200/80 pointer-events-none"
                            >
                                <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
                                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                            </motion.div>

                            {/* Radar Scan Sweep Line */}
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
                                className="absolute inset-0 rounded-full pointer-events-none"
                                style={{
                                    background: "conic-gradient(from 0deg, transparent 0deg, transparent 300deg, rgba(99,102,241,0.14) 360deg)",
                                    borderRadius: "50%"
                                }}
                            />

                            {/* Neural Network SVG */}
                            <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full p-3">
                                <defs>
                                    <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" stopColor="#6366f1" stopOpacity="0.7" />
                                        <stop offset="100%" stopColor="#a855f7" stopOpacity="0.7" />
                                    </linearGradient>
                                    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                                        <feGaussianBlur stdDeviation="2" result="blur" />
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
                                            stroke="#e2e8f0"
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
                                            {/* Pulsing Ripple Halo for nodes */}
                                            <motion.circle
                                                cx={node.x}
                                                cy={node.y}
                                                r={isCenter ? 12 : 7}
                                                fill="none"
                                                stroke={isCenter ? "#6366f1" : "#a855f7"}
                                                strokeWidth="1"
                                                animate={{
                                                    r: isCenter ? [10, 18, 10] : [5, 9, 5],
                                                    opacity: [0.6, 0, 0.6],
                                                }}
                                                transition={{ duration: 2.2, repeat: Infinity, delay: i * 0.2 }}
                                            />
                                            {/* Solid Node Core */}
                                            <circle
                                                cx={node.x}
                                                cy={node.y}
                                                r={node.radius}
                                                fill={isCenter ? "#4f46e5" : "#6366f1"}
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

                            {/* Central Core Pulse Badge */}
                            <motion.div
                                animate={{ scale: [1, 1.1, 1] }}
                                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                                className="w-10 h-10 rounded-2xl bg-indigo-600/90 text-white flex items-center justify-center shadow-lg shadow-indigo-500/40 relative z-20"
                            >
                                <Zap size={20} className="fill-white" />
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
                                className="w-full bg-white border-2 border-indigo-100 rounded-2xl p-5 shadow-sm text-center space-y-2.5"
                            >
                                <div className="inline-flex items-center justify-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200">
                                    <CurrentIcon size={14} className="text-indigo-600" />
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-700">
                                        Stage {activeStage + 1} of {stageList.length}
                                    </span>
                                </div>

                                <h2 className="text-base sm:text-lg font-black uppercase tracking-tight text-slate-900 leading-snug">
                                    {currentStage.label}
                                </h2>

                                <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-sm mx-auto">
                                    {currentStage.sub}
                                </p>

                                {subLabel && (
                                    <div className="inline-block mt-1 px-3 py-1 rounded-lg bg-slate-100 border border-slate-200 text-[10px] font-mono font-bold text-slate-700">
                                        {subLabel}
                                    </div>
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    {/* RIGHT COLUMN: Progress Telemetry & Live Step Breakdown (7 Cols) */}
                    <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between gap-6">

                        {/* Header Title in Right Pane */}
                        <div>
                            <div className="flex items-end justify-between mb-3">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Pipeline Execution</p>
                                    <h3 className="text-xl sm:text-2xl font-black italic uppercase tracking-tight text-slate-900 mt-0.5">
                                        Synthesizing Assessment
                                    </h3>
                                </div>
                                <motion.div
                                    key={pct}
                                    initial={{ scale: 0.85, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    className="text-4xl sm:text-5xl font-black text-indigo-600 italic tabular-nums leading-none tracking-tight"
                                >
                                    {pct}%
                                </motion.div>
                            </div>

                            {/* Progress Bar with Shimmer */}
                            <div className="h-3.5 bg-slate-100 border border-slate-200 rounded-full overflow-hidden p-0.5 relative shadow-inner">
                                <motion.div
                                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500 relative overflow-hidden"
                                    animate={{ width: `${pct}%` }}
                                    transition={{ duration: 0.5, ease: "easeInOut" }}
                                >
                                    {/* Shimmer traversal */}
                                    <motion.div
                                        animate={{ x: ["-100%", "200%"] }}
                                        transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
                                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent w-1/2"
                                    />
                                </motion.div>
                            </div>

                            {/* Tags under progress */}
                            <div className="flex flex-wrap items-center gap-2 mt-3">
                                <div className="px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-700">
                                    Architecture E · Production Frozen
                                </div>
                                {representationMode && (
                                    <div className="px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-[10px] font-black uppercase tracking-wider text-indigo-700">
                                        Path: {representationMode}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Pipeline Step Checklist */}
                        <div className="space-y-1.5 my-auto">
                            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 mb-2">Stage Checklist</p>
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
                                                    ? "bg-indigo-50/90 border-indigo-300 shadow-sm ring-1 ring-indigo-200"
                                                    : isCompleted
                                                    ? "bg-emerald-50/60 border-emerald-200/80 text-emerald-800"
                                                    : "bg-slate-50/70 border-slate-200/60 text-slate-400 opacity-60"
                                            }`}
                                        >
                                            <div className="flex-shrink-0">
                                                {isCompleted ? (
                                                    <CheckCircle2 size={15} className="text-emerald-600 fill-emerald-100" />
                                                ) : isActive ? (
                                                    <Loader2 size={15} className="text-indigo-600 animate-spin" />
                                                ) : (
                                                    <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-300" />
                                                )}
                                            </div>

                                            <span className={`text-xs leading-tight truncate ${
                                                isActive
                                                    ? "font-black text-indigo-950"
                                                    : isCompleted
                                                    ? "font-bold text-slate-700"
                                                    : "font-medium text-slate-500"
                                            }`}>
                                                {s.shortLabel}
                                            </span>

                                            {isActive && (
                                                <span className="ml-auto w-2 h-2 rounded-full bg-indigo-600 animate-ping flex-shrink-0" />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Bottom Informational Bar */}
                        <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-400">
                            <span className="flex items-center gap-1.5 text-slate-600">
                                <Shield size={13} className="text-emerald-500" />
                                Zero-Hallucination Verified
                            </span>
                            <span>Do not refresh or close</span>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}