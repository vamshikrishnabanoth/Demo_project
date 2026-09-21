import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Clock, Inbox, Network, Ruler, Scale, Search, ShieldCheck, Zap, Rocket,
    CheckCircle2, LoaderCircle, Sparkles
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
    { x: 50, y: 50 },
    { x: 20, y: 20 }, { x: 80, y: 20 },
    { x: 10, y: 60 }, { x: 50, y: 85 }, { x: 90, y: 60 },
    { x: 35, y: 40 }, { x: 65, y: 40 },
];
const CONNECTIONS = [
    [0, 1], [0, 2], [0, 3], [0, 4], [0, 5],
    [1, 6], [2, 7], [6, 3], [7, 4], [6, 7],
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
        <div className="fixed inset-0 z-[200] overflow-y-auto bg-[var(--bg-secondary)] select-none">
            <motion.div
                animate={{ opacity: [0.06, 0.14, 0.06] }}
                transition={{ duration: 4, repeat: Infinity }}
                className="fixed inset-0 pointer-events-none"
                style={{ background: "radial-gradient(ellipse 70% 50% at 50% 30%, rgba(99,102,241,0.10), transparent)" }}
            />

            <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center px-4 py-10 sm:py-16">

                {/* Page header */}
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="text-center mb-8 sm:mb-10"
                >
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-indigo-200 bg-indigo-50 mb-4">
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }}>
                            <Sparkles size={13} className="text-indigo-500" />
                        </motion.div>
                        <span className="text-[10px] font-black uppercase tracking-[0.28em] text-indigo-600">AI Processing</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] italic uppercase tracking-tight leading-tight">
                        Generating Your Quiz
                    </h1>
                    <p className="mt-2 text-sm text-[var(--text-secondary)] font-medium max-w-sm mx-auto leading-relaxed">
                        AI is analyzing your material and building the assessment. This takes 1-3 minutes.
                    </p>
                </motion.div>

                {/* Main processing workspace */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, delay: 0.1 }}
                    className="w-full max-w-5xl"
                >
                    <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-[2rem] shadow-[0_20px_48px_rgba(15,23,42,0.07)] overflow-hidden">

                        {/* Two-column grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[var(--border-color)]">

                            {/* LEFT: Visual + Current Stage */}
                            <div className="flex flex-col items-center justify-center p-8 sm:p-10 gap-6">

                                {/* Network animation */}
                                <div className="relative w-36 h-36 sm:w-44 sm:h-44 shrink-0">
                                    <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full">
                                        {CONNECTIONS.map(([a, b], i) => (
                                            <motion.line
                                                key={i}
                                                x1={NODES[a].x} y1={NODES[a].y}
                                                x2={NODES[b].x} y2={NODES[b].y}
                                                stroke="rgb(99,102,241)"
                                                strokeWidth="0.7"
                                                animate={{ opacity: [0.15, 0.55, 0.15] }}
                                                transition={{ duration: 2.8, repeat: Infinity, delay: i * 0.22 }}
                                            />
                                        ))}
                                        {NODES.map((node, i) => (
                                            <g key={i}>
                                                <motion.circle
                                                    cx={node.x} cy={node.y}
                                                    fill="none" stroke="rgb(99,102,241)" strokeWidth="0.7"
                                                    initial={{ r: i === 0 ? 6 : 3 }}
                                                    animate={{
                                                        r: [i === 0 ? 6 : 3, i === 0 ? 8 : 4.2, i === 0 ? 6 : 3],
                                                        opacity: [0.3, 0.85, 0.3],
                                                    }}
                                                    transition={{ duration: 2.2, repeat: Infinity, delay: i * 0.2 }}
                                                />
                                                <motion.circle
                                                    cx={node.x} cy={node.y}
                                                    r={i === 0 ? 2.8 : 1.6}
                                                    fill="rgb(99,102,241)"
                                                    animate={{ opacity: [0.5, 1, 0.5] }}
                                                    transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.15 }}
                                                />
                                            </g>
                                        ))}
                                    </svg>
                                    <motion.div
                                        animate={{ scale: [1, 1.35, 1], opacity: [0.4, 0, 0.4] }}
                                        transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut" }}
                                        className="absolute inset-0 m-auto w-10 h-10 rounded-full border-2 border-indigo-400"
                                        style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", margin: 0, width: "2.5rem", height: "2.5rem" }}
                                    />
                                </div>

                                {/* Active stage detail */}
                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={activeStage}
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -8 }}
                                        transition={{ duration: 0.28 }}
                                        className="text-center space-y-3 w-full"
                                    >
                                        <div className="flex items-center justify-center gap-2.5">
                                            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0">
                                                <CurrentIcon size={18} className="text-indigo-500" />
                                            </div>
                                            <div className="text-left min-w-0">
                                                <p className="text-[9px] font-black uppercase tracking-[0.28em] text-indigo-400 mb-0.5">Currently Processing</p>
                                                <h2 className="text-sm sm:text-base font-black uppercase tracking-tight text-[var(--text-primary)] leading-tight">
                                                    {currentStage.shortLabel}
                                                </h2>
                                            </div>
                                        </div>

                                        <p className="text-[11px] sm:text-xs text-[var(--text-secondary)] font-medium leading-relaxed max-w-xs mx-auto">
                                            {currentStage.sub}
                                        </p>

                                        {subLabel && (
                                            <div className="inline-flex items-center justify-center rounded-full border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-1">
                                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-secondary)]">{subLabel}</p>
                                            </div>
                                        )}

                                        <div className="flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)]">
                                            <span className="flex items-center gap-1.5">
                                                <motion.span
                                                    animate={{ opacity: [1, 0.3, 1] }}
                                                    transition={{ duration: 1.2, repeat: Infinity }}
                                                    className="inline-flex h-2 w-2 rounded-full bg-emerald-500"
                                                />
                                                System Live
                                            </span>
                                            {elapsed > 0 && (
                                                <>
                                                    <span className="opacity-30">|</span>
                                                    <span className="flex items-center gap-1">
                                                        <Clock size={11} />
                                                        {fmtElapsed(elapsed)}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </motion.div>
                                </AnimatePresence>
                            </div>

                            {/* RIGHT: Progress + Pipeline */}
                            <div className="flex flex-col divide-y divide-[var(--border-color)]">

                                {/* Section A: Progress */}
                                <div className="p-7 sm:p-8 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-[9px] font-black uppercase tracking-[0.32em] text-[var(--text-secondary)] mb-1">Generation Progress</p>
                                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)]">
                                                Stage {activeStage + 1} of {stageList.length}
                                            </p>
                                        </div>
                                        <motion.div
                                            key={pct}
                                            initial={{ scale: 0.85, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            className="text-3xl font-black text-[var(--text-primary)] italic tabular-nums"
                                        >
                                            {pct}%
                                        </motion.div>
                                    </div>

                                    <div className="h-2.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-full overflow-hidden">
                                        <motion.div
                                            className="h-full rounded-full"
                                            style={{ background: "linear-gradient(to right, rgb(99,102,241), rgb(129,140,248))" }}
                                            animate={{ width: `${pct}%` }}
                                            transition={{ duration: 0.5, ease: "easeInOut" }}
                                        />
                                    </div>

                                    <div className="flex items-center gap-1 pt-0.5">
                                        {stageList.map((_, i) => (
                                            <motion.div
                                                key={i}
                                                animate={{
                                                    width: i === activeStage ? 20 : i < activeStage ? 14 : 6,
                                                    opacity: i <= activeStage ? 1 : 0.28,
                                                }}
                                                transition={{ duration: 0.3 }}
                                                style={{
                                                    height: "6px",
                                                    borderRadius: "9999px",
                                                    backgroundColor: i < activeStage ? "rgb(52,211,153)" : i === activeStage ? "rgb(99,102,241)" : "var(--border-color)"
                                                }}
                                            />
                                        ))}
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2 pt-1">
                                        <div className="px-2.5 py-1 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-color)]">
                                            <p className="text-[9px] font-black uppercase tracking-[0.24em] text-[var(--text-primary)]">
                                                Architecture E - Stage {activeStage + 1}
                                            </p>
                                        </div>
                                        {representationMode && (
                                            <div className="px-2.5 py-1 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-color)]">
                                                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                                                    Path: <span className="text-[var(--text-primary)]">{representationMode}</span>
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Section B: Pipeline */}
                                <div className="p-7 sm:p-8">
                                    <p className="text-[9px] font-black uppercase tracking-[0.32em] text-[var(--text-secondary)] mb-4">Processing Pipeline</p>
                                    <div className="space-y-1">
                                        {stageList.map((s, i) => {
                                            const isCompleted = i < activeStage;
                                            const isActive = i === activeStage;
                                            const SIcon = s.icon;
                                            return (
                                                <div
                                                    key={i}
                                                    className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-colors ${isActive ? "border border-indigo-100" : "border border-transparent"}`}
                                                    style={isActive ? { backgroundColor: "rgb(238,242,255)" } : {}}
                                                >
                                                    <div className="flex-shrink-0 w-5 flex items-center justify-center">
                                                        {isCompleted && <CheckCircle2 size={14} className="text-emerald-500" />}
                                                        {isActive && (
                                                            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}>
                                                                <LoaderCircle size={14} className="text-indigo-500" />
                                                            </motion.div>
                                                        )}
                                                        {!isCompleted && !isActive && (
                                                            <div className="w-3 h-3 rounded-full border-2 border-[var(--border-color)]" />
                                                        )}
                                                    </div>
                                                    <SIcon
                                                        size={12}
                                                        className={`flex-shrink-0 ${isCompleted ? "text-emerald-400" : isActive ? "text-indigo-500" : "text-[var(--text-secondary)] opacity-30"}`}
                                                    />
                                                    <span className={`text-xs leading-tight flex-1 ${isCompleted ? "text-[var(--text-secondary)] line-through opacity-50" : isActive ? "text-indigo-700 font-black" : "text-[var(--text-secondary)] opacity-40 font-medium"}`}>
                                                        {s.shortLabel}
                                                    </span>
                                                    {isActive && (
                                                        <motion.div
                                                            animate={{ opacity: [1, 0.2, 1] }}
                                                            transition={{ duration: 1, repeat: Infinity }}
                                                            className="w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0"
                                                        />
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="border-t border-[var(--border-color)] bg-[var(--bg-secondary)] px-7 py-3 flex items-center justify-between flex-wrap gap-3">
                            <div className="flex items-center gap-2">
                                <motion.span
                                    animate={{ opacity: [1, 0.3, 1] }}
                                    transition={{ duration: 1.2, repeat: Infinity }}
                                    className="inline-flex h-2 w-2 rounded-full bg-emerald-400"
                                />
                                <span className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--text-secondary)]">AI Pipeline Active</span>
                            </div>
                            <span className="text-[10px] font-bold text-[var(--text-secondary)] opacity-70">
                                Do not close this tab - generation is in progress
                            </span>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}