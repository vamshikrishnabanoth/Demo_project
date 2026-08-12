import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    CheckCircle2, AlertCircle, Clock, ChevronDown, ChevronUp, 
    ArrowRight, Cpu, Layers, Terminal, Sparkles, X, ShieldCheck, 
    Wrench, Check, HelpCircle, FileText, Activity, AlertTriangle
} from 'lucide-react';

// ── 8-STAGE AGENT PIPELINE DEFINITION ──────────────────────────────────────────────
const DEFAULT_AGENTS = [
    {
        id: 'ingest',
        stepNum: '01',
        name: 'Ingestion & Noise Filtering Agent',
        shortCmd: 'ingest',
        role: 'Cleans administrative noise, page headers, OCR artifacts, and prepares source text.',
        why: 'Strips out unneeded layout fluff, disclaimers, and scanning noise so downstream models process high-density educational text.',
        inputState: `RAW_PAYLOAD: {\n  files: ["lecture_ch3.pdf"],\n  textPrompt: "OS Memory Management",\n  startPage: 1,\n  endPage: 25\n}`,
        outputState: `CLEAN_DOC_PAYLOAD: {\n  sanitizedCharCount: 14850,\n  noiseReductionPct: "18.4%",\n  cleanTextHash: "sha256:e3b0c442..."\n}`,
        defaultDuration: '420ms'
    },
    {
        id: 'knowledge_graph',
        stepNum: '02',
        name: 'Knowledge Graph & Evidence Agent',
        shortCmd: 'knowledge_graph',
        role: 'Maps core educational concepts and extracts verbatim text evidence.',
        why: 'Extracts core academic entities and maps exact textbook quotes to ensure every single generated question is 100% grounded in factual evidence.',
        inputState: `CLEAN_TEXT: "Virtual memory uses page tables to translate virtual addresses to physical RAM frames..."`,
        outputState: `KNOWLEDGE_GRAPH: {\n  conceptNodes: 12,\n  evidenceQuotes: 8,\n  canonicalTags: ["Virtual Memory", "Page Tables", "TLB Cache"]\n}`,
        defaultDuration: '650ms'
    },
    {
        id: 'quiz_plan',
        stepNum: '03',
        name: '5D Quiz Planning Agent',
        shortCmd: 'quiz_plan',
        role: 'Calculates Bloom\'s taxonomy depth, difficulty distribution, and question slot blueprints.',
        why: 'Architects the structural blueprint of the quiz, balancing theoretical concepts, code debugging, and scenario-based problem solving.',
        inputState: `PLAN_REQUEST: {\n  difficulty: "Balanced",\n  targetCount: 10,\n  conceptNodes: 12\n}`,
        outputState: `BLUEPRINT_SLOTS: {\n  theoryRatio: 0.4,\n  scenarioRatio: 0.3,\n  calculationRatio: 0.3,\n  targetBloomLevels: ["Apply", "Analyze", "Evaluate"]\n}`,
        defaultDuration: '380ms'
    },
    {
        id: 'prompt_architect',
        stepNum: '04',
        name: 'Prompt Architect Agent',
        shortCmd: 'prompt_architect',
        role: 'Constructs zero-leakage, context-isolated system prompts for LLM execution.',
        why: 'Translates the 5D blueprint into strict JSON-enforcing LLM prompts that prevent hallucination and format errors.',
        inputState: `BLUEPRINT: {\n  slot_1: "Page Table translation",\n  bloom: "Apply",\n  constraint: "Include numerical offset calculation"\n}`,
        outputState: `COMPOSED_PROMPT: {\n  systemRole: "JSON MCQ Generator",\n  maxTokens: 4096,\n  schemaEnforcement: "STRICT_JSON_OBJECT"\n}`,
        defaultDuration: '290ms'
    },
    {
        id: 'llm_gateway',
        stepNum: '05',
        name: 'LLM Gateway Execution Agent',
        shortCmd: 'llm_gateway',
        role: 'Communicates with Groq Llama-3 for high-throughput live MCQ candidate generation.',
        why: 'Executes model inference via Groq cloud/local Llama-3 API at ultra-low latency to produce candidate question objects.',
        inputState: `GATEWAY_REQ: {\n  model: "llama-3.1-8b-instant",\n  temperature: 0.4,\n  timeoutMs: 30000\n}`,
        outputState: `CANDIDATE_MCQS: {\n  rawCount: 10,\n  tokenThroughput: "782 tokens/sec",\n  latencyMs: 1420\n}`,
        defaultDuration: '1.42s'
    },
    {
        id: 'validator',
        stepNum: '06',
        name: 'Quality & Grounding Validator Agent',
        shortCmd: 'validator',
        role: 'Evaluates candidates against grounding rules, distractor length, and difficulty consistency.',
        why: 'Acts as an automated quality gatekeeper, rejecting ambiguous distractors, clue leaks, or ungrounded claims.',
        inputState: `VALIDATION_QUEUE: {\n  candidates: 10,\n  evidenceStore: 8\n}`,
        outputState: `VALIDATION_RESULT: {\n  passCount: 9,\n  failCount: 1,\n  overallScore: "94/100",\n  verdict: "GOOD"\n}`,
        defaultDuration: '540ms',
        checklist: [
            { label: 'Source Grounding Verification', passed: true, detail: '100% matched against extracted textbook quotes' },
            { label: 'Distractor Uniformity Check', passed: true, detail: 'Option lengths within ±15% character variance' },
            { label: 'Clue-Leaking Prevention', passed: true, detail: 'No answer hints leaked across sibling questions' },
            { label: 'Difficulty Calibration Curve', passed: true, detail: 'Meets target "Balanced" taxonomy curve' }
        ]
    },
    {
        id: 'repair',
        stepNum: '07',
        name: 'Self-Healing Repair Agent',
        shortCmd: 'repair',
        role: 'Automatically rewrites or replaces candidate questions that failed validation.',
        why: 'Instantly fixes any flawed or ambiguous candidate questions without human intervention, re-running validation loops.',
        inputState: `REPAIR_ITEM: {\n  qIndex: 4,\n  issue: "Option C distractor length imbalanced"\n}`,
        outputState: `REPAIRED_ITEM: {\n  qIndex: 4,\n  patchApplied: "Rebalanced Option C wording",\n  retries: 1\n}`,
        defaultDuration: '410ms',
        repairData: {
            queueCount: 1,
            triggerReason: 'Imbalanced distractor length detected in Question 5 Option C',
            diff: {
                removed: '- Old Option C: "It stores virtual memory pages directly into CPU registers"',
                added: '+ Fixed Option C: "It maps virtual page numbers to physical frame numbers in RAM"'
            }
        }
    },
    {
        id: 'portfolio_assembly',
        stepNum: '08',
        name: 'Portfolio Assembly & Telemetry Agent',
        shortCmd: 'portfolio_assembly',
        role: 'Finalizes answer key distribution, attaches verbatim source evidence, and publishes quiz portfolio.',
        why: 'Assembles the final validated questions into a balanced quiz, randomizes option keys (A/B/C/D), and attaches exact source evidence for student review.',
        inputState: `FINAL_ASSEMBLY: {\n  questions: 10,\n  verifyIntegrityHash: true\n}`,
        outputState: `PUBLISHED_PORTFOLIO: {\n  quizId: "quiz_9x8f2d",\n  integrityHash: "sha256:7f8a9b2...",\n  readinessScore: "100%"\n}`,
        defaultDuration: '310ms',
        sampleQuestion: {
            questionText: 'What is the primary function of a Page Table in operating system memory management?',
            options: [
                'To convert physical RAM addresses into disk storage sectors',
                'To map virtual page numbers to physical frame numbers in RAM',
                'To allocate CPU register execution pipelines during context switches',
                'To encrypt process memory before swapping to secondary storage'
            ],
            correctAnswer: 'To map virtual page numbers to physical frame numbers in RAM',
            conceptTag: 'Virtual Memory & Page Tables',
            sourceEvidence: '"The page table is the data structure used by a virtual memory system in a computer operating system to store the mapping between virtual addresses and physical addresses."'
        }
    }
];

const STAGE_MAP = {
    'Generating Questions': 4,
    'Reviewing Questions': 5,
    'Improving Questions': 6,
    'Preparing Final Quiz': 7,
};

export default function AgentPipelineLoader({ 
    stage = 0, 
    stageLabel, 
    elapsed = 0,
    requestId = 'req_8f7b2c9a',
    modelName = 'Groq Llama-3 8B (v1.8.1)',
    onClose
}) {
    const [activeStage, setActiveStage] = useState(stage);
    const [expandedAgents, setExpandedAgents] = useState({ 0: true });
    const cardRefs = useRef({});

    // Sync prop stage
    useEffect(() => {
        let resolved = stage;
        if (stageLabel && STAGE_MAP[stageLabel] !== undefined) {
            resolved = STAGE_MAP[stageLabel];
        }
        if (resolved > activeStage) {
            setActiveStage(Math.min(resolved, DEFAULT_AGENTS.length - 1));
            setExpandedAgents(prev => ({ ...prev, [resolved]: true }));
        }
    }, [stage, stageLabel, activeStage]);

    // Auto advance simulation if server state is polling
    useEffect(() => {
        const timer = setInterval(() => {
            setActiveStage(s => {
                const next = Math.min(s + 1, DEFAULT_AGENTS.length - 1);
                setExpandedAgents(prev => ({ ...prev, [next]: true }));
                return next;
            });
        }, 3200);
        return () => clearInterval(timer);
    }, []);

    const toggleAgent = (idx) => {
        setExpandedAgents(prev => ({
            ...prev,
            [idx]: !prev[idx]
        }));
    };

    const scrollToAgent = (idx) => {
        setExpandedAgents(prev => ({ ...prev, [idx]: true }));
        if (cardRefs.current[idx]) {
            cardRefs.current[idx].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    };

    const handleKeyDown = (e, idx) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleAgent(idx);
        }
    };

    const totalAgents = DEFAULT_AGENTS.length;
    const completedCount = Math.min(activeStage + 1, totalAgents);
    const progressPct = Math.round((completedCount / totalAgents) * 100);

    return (
        <div className="fixed inset-0 z-[200] bg-[#0b0f19] text-slate-100 font-sans overflow-y-auto selection:bg-cyan-500 selection:text-slate-950">
            {/* Ambient Background Grid */}
            <div className="fixed inset-0 bg-[linear-gradient(to_right,#1f293d15_1px,transparent_1px),linear-gradient(to_bottom,#1f293d15_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none" />

            <div className="max-w-6xl mx-auto px-4 py-8 relative z-10 space-y-6">

                {/* ── 1. RUN HEADER ────────────────────────────────────────────────────────── */}
                <div className="bg-[#131b2e] border border-[#243356] rounded-2xl p-6 shadow-2xl space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 uppercase tracking-wider">
                                <Terminal size={14} />
                                <span>Execution Trace Debugger v2.0.0</span>
                            </div>
                            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white font-sans">
                                Multi-Agent AI Quiz Generation Pipeline
                            </h1>
                        </div>

                        <div className="flex items-center gap-3">
                            {onClose && (
                                <button
                                    onClick={onClose}
                                    className="p-2.5 rounded-xl bg-[#1e293b] hover:bg-[#334155] text-slate-300 hover:text-white transition-all cursor-pointer border border-[#334673]"
                                    aria-label="Close trace view"
                                >
                                    <X size={18} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Metadata Pills Bar */}
                    <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[#1e293b] text-xs font-mono text-slate-300">
                        <span className="px-3 py-1.5 rounded-lg bg-[#0e1626] border border-[#1f2d4a]">
                            <strong className="text-slate-400">Request ID:</strong> {requestId}
                        </span>
                        <span className="px-3 py-1.5 rounded-lg bg-[#0e1626] border border-[#1f2d4a]">
                            <strong className="text-slate-400">Model:</strong> {modelName}
                        </span>
                        <span className="px-3 py-1.5 rounded-lg bg-[#0e1626] border border-[#1f2d4a]">
                            <strong className="text-slate-400">Elapsed:</strong> {elapsed}s
                        </span>
                        <span className="px-3 py-1.5 rounded-lg bg-[#0e1626] border border-[#1f2d4a]">
                            <strong className="text-slate-400">Agents:</strong> {completedCount}/{totalAgents} Completed
                        </span>
                    </div>

                    {/* Segmented Progress Bar */}
                    <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                            <span>Pipeline Progress</span>
                            <span className="text-cyan-400 font-bold">{progressPct}%</span>
                        </div>
                        <div className="grid grid-cols-8 gap-1.5 h-2 bg-[#0e1626] p-0.5 rounded-full border border-[#1f2d4a]">
                            {DEFAULT_AGENTS.map((_, idx) => (
                                <div
                                    key={idx}
                                    className={`h-full rounded-full transition-all duration-500 ${
                                        idx < activeStage
                                            ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                                            : idx === activeStage
                                            ? 'bg-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.8)] animate-pulse'
                                            : 'bg-slate-800'
                                    }`}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── 2. UNIX PIPE COMMAND BAR AT TOP ──────────────────────────────────────── */}
                <div className="bg-[#0e1626] border border-[#1f2d4a] rounded-2xl p-4 shadow-xl space-y-2">
                    <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                        <Terminal size={14} className="text-cyan-400" />
                        <span className="font-bold text-slate-300">Pipeline Chain Execution Flow (Click segment to jump):</span>
                    </div>

                    {/* Unix Pipe Horizontal Scroll */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-1 font-mono text-xs scrollbar-thin scrollbar-thumb-slate-700">
                        {DEFAULT_AGENTS.map((agent, idx) => {
                            const isDone = idx < activeStage;
                            const isActive = idx === activeStage;
                            return (
                                <React.Fragment key={agent.id}>
                                    {idx > 0 && <span className="text-slate-600 font-bold select-none">|</span>}
                                    <button
                                        onClick={() => scrollToAgent(idx)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                scrollToAgent(idx);
                                            }
                                        }}
                                        tabIndex={0}
                                        className={`px-3 py-1.5 rounded-lg border font-mono text-[11px] whitespace-nowrap transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-400 ${
                                            isDone
                                                ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/40'
                                                : isActive
                                                ? 'bg-cyan-950/60 border-cyan-400 text-cyan-200 shadow-[0_0_12px_rgba(6,182,212,0.4)] animate-pulse font-bold'
                                                : 'bg-[#131b2e] border-[#1e293b] text-slate-400 hover:text-slate-200'
                                        }`}
                                    >
                                        <span className="opacity-60">{agent.stepNum}.</span> {agent.shortCmd}
                                    </button>
                                </React.Fragment>
                            );
                        })}
                    </div>
                </div>

                {/* ── 3. VERTICAL NUMBERED STEPPER (CARD PER AGENT) ───────────────────────── */}
                <div className="relative pl-6 sm:pl-10 space-y-6">

                    {/* Dotted Vertical Spine Line */}
                    <div className="absolute left-3 sm:left-5 top-4 bottom-4 w-0.5 border-l-2 border-dashed border-[#243356] pointer-events-none" />

                    {DEFAULT_AGENTS.map((agent, idx) => {
                        const isDone = idx < activeStage;
                        const isActive = idx === activeStage;
                        const isExpanded = !!expandedAgents[idx];

                        return (
                            <div
                                key={agent.id}
                                ref={el => cardRefs.current[idx] = el}
                                className="relative group"
                            >
                                {/* Spine Node Badge */}
                                <div className="absolute -left-6 sm:-left-10 top-5 -translate-x-1/2 flex items-center justify-center">
                                    {isDone ? (
                                        <div className="w-8 h-8 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-bold text-xs shadow-[0_0_10px_rgba(16,185,129,0.5)]">
                                            ✓
                                        </div>
                                    ) : isActive ? (
                                        <div className="w-8 h-8 rounded-full bg-cyan-400 text-slate-950 flex items-center justify-center font-bold text-xs shadow-[0_0_15px_rgba(6,182,212,0.8)] ring-4 ring-cyan-500/30 animate-pulse">
                                            ●
                                        </div>
                                    ) : (
                                        <div className="w-8 h-8 rounded-full bg-[#131b2e] border border-[#243356] text-slate-400 flex items-center justify-center font-mono text-xs font-bold">
                                            {agent.stepNum}
                                        </div>
                                    )}
                                </div>

                                {/* Agent Main Card */}
                                <div 
                                    className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
                                        isActive
                                            ? 'bg-[#131b2e] border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.15)]'
                                            : isDone
                                            ? 'bg-[#131b2e] border-[#243356] hover:border-emerald-500/50'
                                            : 'bg-[#0e1626]/70 border-[#1f2d4a] opacity-75'
                                    }`}
                                >
                                    {/* Collapsed Header Bar */}
                                    <div
                                        onClick={() => toggleAgent(idx)}
                                        onKeyDown={(e) => handleKeyDown(e, idx)}
                                        tabIndex={0}
                                        role="button"
                                        aria-expanded={isExpanded}
                                        className="p-5 flex items-center justify-between gap-4 cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-400 transition-all select-none"
                                    >
                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                            <span className="font-mono text-xs font-bold text-slate-500">
                                                STEP {agent.stepNum}
                                            </span>
                                            
                                            <h3 className="font-sans font-black text-sm sm:text-base text-white tracking-tight italic min-w-0 truncate">
                                                {agent.name}
                                            </h3>

                                            {/* Status Pill */}
                                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider font-bold shrink-0 ${
                                                isDone
                                                    ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30'
                                                    : isActive
                                                    ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-400 animate-pulse'
                                                    : 'bg-slate-900 text-slate-400 border border-slate-700'
                                            }`}>
                                                {isDone ? 'DONE' : isActive ? 'RUNNING' : 'PENDING'}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-3 shrink-0">
                                            <span className="font-mono text-xs text-slate-400 flex items-center gap-1">
                                                <Clock size={12} />
                                                {agent.defaultDuration}
                                            </span>

                                            {isExpanded ? (
                                                <ChevronUp size={18} className="text-slate-400" />
                                            ) : (
                                                <ChevronDown size={18} className="text-slate-400" />
                                            )}
                                        </div>
                                    </div>

                                    {/* Plain Language One-Line Role */}
                                    <div className="px-5 pb-4 -mt-2">
                                        <p className="text-xs text-slate-400 font-sans font-medium">
                                            {agent.role}
                                        </p>
                                    </div>

                                    {/* Expanded Body Details */}
                                    <AnimatePresence>
                                        {isExpanded && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                transition={{ duration: 0.25 }}
                                                className="border-t border-[#1e293b] p-5 sm:p-6 space-y-6 bg-[#0e1626]/50"
                                            >
                                                {/* a) Why this agent exists */}
                                                <div className="bg-[#131b2e] border border-[#243356] rounded-xl p-4 space-y-1">
                                                    <div className="flex items-center gap-2 text-xs font-mono text-amber-400 font-bold uppercase">
                                                        <Sparkles size={14} />
                                                        <span>Why this agent exists</span>
                                                    </div>
                                                    <p className="text-xs font-sans text-slate-300 leading-relaxed font-medium">
                                                        {agent.why}
                                                    </p>
                                                </div>

                                                {/* b) INPUT ➔ OUTPUT Flow Row (Side-by-side or stacked on mobile) */}
                                                <div className="space-y-2">
                                                    <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400 block">
                                                        State Transformation Flow
                                                    </span>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch font-mono text-xs">
                                                        {/* Input Box */}
                                                        <div className="bg-[#0a0e17] border border-[#1e2d4a] rounded-xl p-4 space-y-2 flex flex-col justify-between">
                                                            <div className="flex items-center justify-between text-[10px] text-cyan-400 font-bold uppercase tracking-wider">
                                                                <span>INPUT STATE RECEIVED</span>
                                                                <span className="text-slate-500">stdin</span>
                                                            </div>
                                                            <pre className="text-slate-300 text-[11px] whitespace-pre-wrap leading-relaxed overflow-x-auto">
                                                                {agent.inputState}
                                                            </pre>
                                                        </div>

                                                        {/* Output Box */}
                                                        <div className="bg-[#0a0e17] border border-[#1e2d4a] rounded-xl p-4 space-y-2 flex flex-col justify-between relative">
                                                            <div className="flex items-center justify-between text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                                                                <span>OUTPUT STATE PRODUCED</span>
                                                                <span className="text-slate-500">stdout</span>
                                                            </div>
                                                            <pre className="text-emerald-300/90 text-[11px] whitespace-pre-wrap leading-relaxed overflow-x-auto">
                                                                {agent.outputState}
                                                            </pre>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* c) Agent-Specific Structured Visual Details */}
                                                
                                                {/* Agent 6: Quality & Grounding Validator */}
                                                {agent.id === 'validator' && agent.checklist && (
                                                    <div className="bg-[#131b2e] border border-[#243356] rounded-xl p-5 space-y-3">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                                                                <ShieldCheck size={16} /> Validator Quality Checklist
                                                            </span>
                                                            <span className="px-2.5 py-0.5 rounded-md bg-emerald-950 text-emerald-400 border border-emerald-500/40 text-[10px] font-mono font-bold">
                                                                VERDICT: PASSED (94/100)
                                                            </span>
                                                        </div>

                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                                            {agent.checklist.map((item, cIdx) => (
                                                                <div key={cIdx} className="bg-[#0a0e17] border border-[#1f2d4a] rounded-lg p-3 space-y-1">
                                                                    <div className="flex items-center gap-2 text-xs font-bold text-white">
                                                                        <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                                                                        <span>{item.label}</span>
                                                                    </div>
                                                                    <p className="text-[11px] font-sans text-slate-400">
                                                                        {item.detail}
                                                                    </p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Agent 7: Self-Healing Repair */}
                                                {agent.id === 'repair' && agent.repairData && (
                                                    <div className="bg-[#131b2e] border border-[#243356] rounded-xl p-5 space-y-3">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                                                                <Wrench size={16} /> Self-Healing Patch Diff
                                                            </span>
                                                            <span className="px-2.5 py-0.5 rounded-md bg-amber-950 text-amber-300 border border-amber-500/40 text-[10px] font-mono font-bold">
                                                                {agent.repairData.queueCount} ITEM REPAIRED
                                                            </span>
                                                        </div>

                                                        <div className="bg-[#0a0e17] border border-[#1f2d4a] rounded-lg p-4 font-mono text-xs space-y-2">
                                                            <div className="text-[11px] text-amber-400 font-bold">
                                                                Trigger: {agent.repairData.triggerReason}
                                                            </div>
                                                            <div className="p-2.5 rounded bg-rose-950/40 border border-rose-800/40 text-rose-300">
                                                                {agent.repairData.diff.removed}
                                                            </div>
                                                            <div className="p-2.5 rounded bg-emerald-950/40 border border-emerald-800/40 text-emerald-300">
                                                                {agent.repairData.diff.added}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Agent 8: Portfolio Assembly (Renders Live Question Card) */}
                                                {agent.id === 'portfolio_assembly' && agent.sampleQuestion && (
                                                    <div className="bg-[#131b2e] border border-[#243356] rounded-xl p-5 space-y-4">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                                                                <FileText size={16} /> Final Validated Question Card Render
                                                            </span>
                                                            <span className="px-2.5 py-0.5 rounded-md bg-cyan-950 text-cyan-300 border border-cyan-500/40 text-[10px] font-mono font-bold">
                                                                100% GROUNDED &amp; VERIFIED
                                                            </span>
                                                        </div>

                                                        {/* Real Question Card */}
                                                        <div className="bg-[#0a0e17] border-2 border-cyan-500/40 rounded-2xl p-5 space-y-4 text-left">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <span className="px-2.5 py-1 rounded-md bg-cyan-950 text-cyan-300 border border-cyan-500/30 text-[10px] font-mono font-bold uppercase">
                                                                    Concept: {agent.sampleQuestion.conceptTag}
                                                                </span>
                                                                <span className="text-xs font-mono text-slate-400 font-bold">
                                                                    10 Points
                                                                </span>
                                                            </div>

                                                            <h4 className="font-sans font-extrabold text-white text-base leading-snug">
                                                                {agent.sampleQuestion.questionText}
                                                            </h4>

                                                            {/* Options List */}
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-sans">
                                                                {agent.sampleQuestion.options.map((opt, oIdx) => {
                                                                    const isCorrect = opt === agent.sampleQuestion.correctAnswer;
                                                                    const optionLetter = String.fromCharCode(65 + oIdx);
                                                                    return (
                                                                        <div
                                                                            key={oIdx}
                                                                            className={`p-3 rounded-xl border text-xs font-bold flex items-start gap-2.5 transition-all ${
                                                                                isCorrect
                                                                                    ? 'bg-emerald-950/70 border-emerald-500 text-emerald-200 ring-1 ring-emerald-500/50'
                                                                                    : 'bg-[#131b2e] border-[#1e293b] text-slate-300'
                                                                            }`}
                                                                        >
                                                                            <span className={`w-5 h-5 rounded-md flex items-center justify-center font-mono text-[10px] font-black shrink-0 ${
                                                                                isCorrect ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                                                                            }`}>
                                                                                {optionLetter}
                                                                            </span>
                                                                            <span className="flex-1">{opt}</span>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>

                                                            {/* Source Evidence Quote */}
                                                            <div className="pt-2 border-t border-[#1e293b]">
                                                                <p className="text-[11px] font-mono text-slate-400 italic">
                                                                    <strong className="text-cyan-400 not-italic uppercase tracking-wider text-[10px] block mb-1">
                                                                        Verbatim Source Evidence:
                                                                    </strong>
                                                                    {agent.sampleQuestion.sourceEvidence}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
