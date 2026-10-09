import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Clock, Inbox, Network, Ruler, Scale, Search, ShieldCheck, Zap, Rocket,
    CheckCircle2, Loader2, Sparkles, Activity, Cpu, Shield, ArrowRight, Terminal
} from "lucide-react";
import PipelineInspectorDrawer from "../pipeline/PipelineInspectorDrawer";

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

const STAGE_VISUAL_METRICS = [
    {
        agent: "DOC INGESTION",
        cardTitle: "INPUT STREAM",
        badge1: { icon: Inbox, text: "DOCKET SAFE" },
        badge2: { icon: Sparkles, text: "NOISE FILTERED" },
        badge3: { icon: ShieldCheck, text: "STRUCTURE OK" }
    },
    {
        agent: "KNOWLEDGE GRAPH",
        cardTitle: "EVIDENCE STORE",
        badge1: { icon: Network, text: "CMA ALIGNED" },
        badge2: { icon: Sparkles, text: "16 CHUNKS" },
        badge3: { icon: ShieldCheck, text: "VECTOR EMBED" }
    },
    {
        agent: "AGENT 1 (PLANNER)",
        cardTitle: "TARGET MATRIX",
        badge1: { icon: Ruler, text: "TC SCORE 0.94" },
        badge2: { icon: Sparkles, text: "BLOOM CURVE" },
        badge3: { icon: ShieldCheck, text: "10 TARGETS" }
    },
    {
        agent: "AGENT 2 (GENERATOR)",
        cardTitle: "MCQ SYNTHESIS",
        badge1: { icon: ShieldCheck, text: "GROUNDED 100%" },
        badge2: { icon: Sparkles, text: "BLOOM: L3/L4" },
        badge3: { icon: CheckCircle2, text: "4 OPTIONS · 1 KEY" }
    },
    {
        agent: "DETERMINISTIC ENGINE",
        cardTitle: "SCHEMA VALIDATION",
        badge1: { icon: ShieldCheck, text: "NO ALL/NONE" },
        badge2: { icon: Sparkles, text: "JACCARD < 0.70" },
        badge3: { icon: CheckCircle2, text: "DISTINCT KEYS" }
    },
    {
        agent: "AGENT 3 (CRITIC)",
        cardTitle: "QUALITY AUDIT",
        badge1: { icon: Search, text: "5-TIER DERIVABLE" },
        badge2: { icon: Sparkles, text: "0 AMBIGUITY" },
        badge3: { icon: ShieldCheck, text: "STANDBY READY" }
    },
    {
        agent: "BALANCE ENGINE",
        cardTitle: "CURRICULUM REVIEW",
        badge1: { icon: Scale, text: "KEY ENTROPY 0.99" },
        badge2: { icon: Sparkles, text: "LENGTH BIAS: 0" },
        badge3: { icon: CheckCircle2, text: "25% PER OPTION" }
    },
    {
        agent: "GROUNDING GATE",
        cardTitle: "SEALED ASSESSMENT",
        badge1: { icon: Rocket, text: "CITATIONS 7-PT" },
        badge2: { icon: Sparkles, text: "SHA-256 SEAL" },
        badge3: { icon: ShieldCheck, text: "ZERO-HALLUCINATED" }
    }
];

function AssessmentSynthesisVisual({ activeStage, currentStage }) {
    const StageIcon = currentStage.icon;
    const meta = STAGE_VISUAL_METRICS[activeStage] || STAGE_VISUAL_METRICS[3];
    const Badge1Icon = meta.badge1.icon;
    const Badge2Icon = meta.badge2.icon;
    const Badge3Icon = meta.badge3.icon;

    return (
        <div className="relative w-56 h-56 sm:w-60 sm:h-60 flex items-center justify-center my-1 select-none">
            {/* Ambient Multi-Hue Soft Glow Backdrop */}
            <div className="absolute inset-2 bg-gradient-to-tr from-indigo-500/15 via-purple-500/10 to-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

            {/* Precision Outer Calibration Ring (Slow Graceful Rotation) */}
            <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 48, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 rounded-full border border-slate-200/80 pointer-events-none"
            >
                {/* Micro Cardinal Calibration Marks */}
                <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_6px_rgba(99,102,241,0.6)]" />
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-slate-300" />
                <span className="absolute top-1/2 -left-1 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-slate-300" />
                <span className="absolute top-1/2 -right-1 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
            </motion.div>

            {/* Precision Secondary Concentric Ring with Orbiting Telemetry Particles */}
            <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 32, repeat: Infinity, ease: "linear" }}
                className="absolute inset-4 rounded-full border border-dashed border-indigo-200/60 pointer-events-none"
            >
                {/* Orbiting Telemetry Data Packet Beads */}
                <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
            </motion.div>

            {/* Central Floating Assessment Specimen Card */}
            <motion.div
                animate={{ y: [-3, 3, -3] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="relative z-10 w-44 h-48 sm:w-48 sm:h-52 bg-white/95 backdrop-blur-md rounded-2xl border-2 border-indigo-100 shadow-[0_12px_32px_rgba(99,102,241,0.12),0_2px_8px_rgba(15,23,42,0.06)] p-3 sm:p-3.5 flex flex-col justify-between overflow-hidden"
            >
                {/* Laser Scanning Line Sweeping Vertically */}
                <motion.div
                    animate={{ y: ["-10%", "420%"] }}
                    transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-500/70 to-transparent pointer-events-none z-20 shadow-[0_0_8px_rgba(99,102,241,0.8)]"
                />

                {/* Card Top Header: Stage Glyphs & Runtime Tag */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                    <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-md bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-xs">
                            <StageIcon size={11} className="text-white" />
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-800">
                            {meta.cardTitle}
                        </span>
                    </div>

                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[8px] font-mono font-bold text-emerald-700">LIVE</span>
                    </div>
                </div>

                {/* Question Stem Generation Simulation (Shimmering AI Lines) */}
                <div className="space-y-1 py-1">
                    <div className="flex items-center justify-between">
                        <span className="text-[8px] font-mono font-bold text-indigo-600 uppercase tracking-wider">
                            STEM SYNTHESIS
                        </span>
                        <span className="text-[8px] font-mono text-slate-400">Q#{activeStage + 1}</span>
                    </div>
                    {/* Stem Line 1 */}
                    <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden relative">
                        <motion.div
                            animate={{ x: ["-100%", "200%"] }}
                            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                            className="absolute inset-0 bg-gradient-to-r from-transparent via-indigo-300 to-transparent w-1/2"
                        />
                    </div>
                    {/* Stem Line 2 */}
                    <div className="h-1.5 w-4/5 rounded-full bg-slate-100 overflow-hidden relative">
                        <motion.div
                            animate={{ x: ["-100%", "200%"] }}
                            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
                            className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-300 to-transparent w-1/2"
                        />
                    </div>
                </div>

                {/* 4-Option Multiple Choice Engine (A, B, C, D) */}
                <div className="space-y-1 pt-1 border-t border-slate-100">
                    {/* Option A (Distractor 1) */}
                    <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-slate-50 border border-slate-200/80">
                        <span className="w-3.5 h-3.5 rounded bg-slate-200 text-slate-600 text-[8px] font-mono font-bold flex items-center justify-center flex-shrink-0">
                            A
                        </span>
                        <div className="h-1.5 w-14 rounded-full bg-slate-200/70 overflow-hidden relative flex-1">
                            <motion.div
                                animate={{ x: ["-100%", "200%"] }}
                                transition={{ duration: 2, repeat: Infinity, ease: "linear", delay: 0.3 }}
                                className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-300 to-transparent w-1/2"
                            />
                        </div>
                    </div>

                    {/* Option B (Validated Correct Key with Check) */}
                    <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-emerald-50/90 border border-emerald-200/90 shadow-xs">
                        <span className="w-3.5 h-3.5 rounded bg-emerald-600 text-white text-[8px] font-mono font-black flex items-center justify-center flex-shrink-0">
                            B
                        </span>
                        <div className="h-1.5 flex-1 rounded-full bg-emerald-200/80 overflow-hidden relative">
                            <motion.div
                                animate={{ x: ["-100%", "200%"] }}
                                transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
                                className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-400 to-transparent w-1/2"
                            />
                        </div>
                        <CheckCircle2 size={10} className="text-emerald-600 flex-shrink-0" />
                    </div>

                    {/* Option C (Distractor 2) */}
                    <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-slate-50 border border-slate-200/80">
                        <span className="w-3.5 h-3.5 rounded bg-slate-200 text-slate-600 text-[8px] font-mono font-bold flex items-center justify-center flex-shrink-0">
                            C
                        </span>
                        <div className="h-1.5 w-12 rounded-full bg-slate-200/70 overflow-hidden relative flex-1">
                            <motion.div
                                animate={{ x: ["-100%", "200%"] }}
                                transition={{ duration: 2.2, repeat: Infinity, ease: "linear", delay: 0.6 }}
                                className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-300 to-transparent w-1/2"
                            />
                        </div>
                    </div>

                    {/* Option D (Distractor 3) */}
                    <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-slate-50 border border-slate-200/80">
                        <span className="w-3.5 h-3.5 rounded bg-slate-200 text-slate-600 text-[8px] font-mono font-bold flex items-center justify-center flex-shrink-0">
                            D
                        </span>
                        <div className="h-1.5 w-16 rounded-full bg-slate-200/70 overflow-hidden relative flex-1">
                            <motion.div
                                animate={{ x: ["-100%", "200%"] }}
                                transition={{ duration: 2.4, repeat: Infinity, ease: "linear", delay: 0.8 }}
                                className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-300 to-transparent w-1/2"
                            />
                        </div>
                    </div>
                </div>

                {/* Micro Footer inside Card */}
                <div className="flex items-center justify-between text-[7px] font-mono text-slate-400 pt-1 border-t border-slate-100">
                    <span>CARDINALITY: 4/4</span>
                    <span className="text-emerald-600 font-bold">1 KEY IDENTIFIED</span>
                </div>
            </motion.div>

            {/* Floating Satellite Telemetry Micro-Pills */}
            {/* 1. Grounded Pill (Top-Left) */}
            <motion.div
                animate={{ y: [-2, 3, -2], x: [-1, 1, -1] }}
                transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -top-1 -left-2 sm:-left-3 z-20 flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/95 border border-emerald-200 shadow-sm text-emerald-800 text-[9px] font-mono font-bold"
            >
                <Badge1Icon size={10} className="text-emerald-600" />
                <span>{meta.badge1.text}</span>
            </motion.div>

            {/* 2. Bloom Taxonomy Pill (Top-Right) */}
            <motion.div
                animate={{ y: [3, -2, 3], x: [1, -1, 1] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
                className="absolute top-1 -right-2 sm:-right-3 z-20 flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/95 border border-indigo-200 shadow-sm text-indigo-800 text-[9px] font-mono font-bold"
            >
                <Badge2Icon size={10} className="text-indigo-600" />
                <span>{meta.badge2.text}</span>
            </motion.div>

            {/* 3. Anti-Redundancy Pill (Bottom-Right) */}
            <motion.div
                animate={{ y: [-3, 2, -3] }}
                transition={{ duration: 4.4, repeat: Infinity, ease: "easeInOut", delay: 0.7 }}
                className="absolute -bottom-2 -right-1 sm:-right-2 z-20 flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/95 border border-purple-200 shadow-sm text-purple-800 text-[9px] font-mono font-bold"
            >
                <Badge3Icon size={10} className="text-purple-600" />
                <span>{meta.badge3.text}</span>
            </motion.div>
        </div>
    );
}

const STAGE_TELEMETRY = [
    [
        "Groq Whisper-large-v3 streaming audio frames...",
        "Docket limits validated: 1/5 docs, 1/1 audio (Safe)",
        "Coordinate line-clustering parsed slide reading order",
        "Layout tables detected and converted to Markdown"
    ],
    [
        "StructureAwareChunker: 16 semantic slide boundaries formed",
        "Sparse BM25 + Dense BGE embeddings vectorized",
        "Cross-Material Aligner (CMA): 8 multimodal edges created",
        "PDI Router: Aligned Fusion path selected"
    ],
    [
        "Agent 1 (Assessment Planner) active at T=0.10",
        "Bloom's taxonomy curve: 30% Recall, 50% Conceptual, 20% Application",
        "Calibrated target pool: 10 primary targets + 2 reserve items",
        "Curriculum Topic Coverage (TC) score: 0.94 / 1.00"
    ],
    [
        "Agent 2 (Question Generator): Bounded Concurrency = 2 engaged",
        "Worker Stream A & B generating question pairs (400ms delay)",
        "Distractor Engineering: 3 pedagogical distractors per stem",
        "Prompt injection defense: 0 delimiter escape violations"
    ],
    [
        "Stage 05 Deterministic Pre-Checks in Node.js runtime",
        "Regex Rule: Verified exactly 4 distinct options per candidate",
        "Forbidden Phrase Scan: 0 occurrences of 'All/None of the above'",
        "Jaccard similarity J < 0.70 verified (Execution time: 0.05ms | Cost: $0.00)"
    ],
    [
        "Agent 3 (Adversarial Critic) active at T=0.00",
        "5-Tier Derivability Gate: Blind-solving candidates from evidence",
        "Competing Keys Check: 0 questions with ambiguous keys",
        "Reserve Swapping Module: Hot standby ready"
    ],
    [
        "Evaluating whole-quiz cognitive pacing & fatigue curve",
        "Option Balancer: Permuting correct keys to target ~25% A/B/C/D",
        "Longest-option regularizer: Answer length bias neutralized",
        "Uniform key entropy achieved: 0.998"
    ],
    [
        "Grounding Gate: Stamping 7-point provenance citation ledger",
        "Slide & audio timestamp hashes linked to explanations",
        "Quiz state finalized for teacher review at /create-quiz/text",
        "Ready for Live Room broadcast & Assessment dispatch"
    ]
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
    sessionId = null,
}) {
    const stageList = PIPELINE_STAGES;
    const [isInspectorOpen, setIsInspectorOpen] = useState(false);

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
                        
                        {/* Dynamic Assessment Synthesis Visualizer */}
                        <AssessmentSynthesisVisual
                            activeStage={activeStage}
                            currentStage={currentStage}
                            stageList={stageList}
                        />

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

                        {/* Bottom Informational Bar & Outside Inspection Action */}
                        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] font-bold text-slate-400">
                            <div className="flex items-center gap-3">
                                <span className="flex items-center gap-1.5 text-slate-600">
                                    <Shield size={13} className="text-emerald-500" />
                                    Zero-Hallucination Verified
                                </span>
                                <span className="hidden sm:inline text-slate-300">•</span>
                                <span>Do not refresh or close</span>
                            </div>

                            <button
                                type="button"
                                onClick={() => setIsInspectorOpen(true)}
                                className="px-5 py-2.5 rounded-xl bg-[#ea580c] hover:bg-[#c2410c] active:scale-95 text-white font-black text-xs uppercase tracking-wider shadow-[0_4px_14px_rgba(234,88,12,0.28)] flex items-center gap-2 cursor-pointer transition-all border-none outline-none shrink-0"
                                title="Inspect stage outputs & live telemetry without interrupting generation"
                            >
                                <Activity size={15} className="animate-pulse text-white" />
                                <span>Inspect Stage Outputs &amp; Telemetry</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Real-Time Observability & Live Telemetry Panel Overlay */}
                <PipelineInspectorDrawer
                    isOpen={isInspectorOpen}
                    onClose={() => setIsInspectorOpen(false)}
                    sessionId={sessionId || 'live-session'}
                    isVoice={isVoice}
                    representationMode={representationMode}
                    currentStageIndex={activeStage}
                    currentStageLabel={stageLabel || stageList[activeStage]?.label}
                    elapsedSeconds={elapsed}
                />
            </motion.div>
        </div>
    );
}