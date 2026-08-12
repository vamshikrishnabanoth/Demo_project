import React, { useState, useRef } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { 
    Terminal, Cpu, Sparkles, CheckCircle2, ShieldCheck, Wrench, 
    FileText, Layers, Clock, X, ChevronDown, ChevronUp, ArrowRight, 
    RefreshCw, Download, Database, BookOpen, AlertCircle, Play, Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ── PRESET DRY-RUN SCENARIOS FOR DEEP INSPECTION ─────────────────────────────
const SCENARIOS = {
    os_memory: {
        id: 'os_memory',
        title: 'Operating Systems: Virtual Memory & Page Tables',
        requestId: 'req_os_mem_9821',
        model: 'Groq Llama-3 8B Instant (v1.8.1)',
        timestamp: '2026-08-13 00:17:41',
        totalLatencyMs: 3820,
        throughput: '782 tokens/sec',
        agents: [
            {
                id: 'ingest',
                stepNum: '01',
                name: 'Ingestion & Noise Filtering Agent',
                shortCmd: 'ingest',
                role: 'Cleans administrative noise, page headers, OCR artifacts, and prepares source text.',
                why: 'Strips out unneeded layout fluff, boilerplate disclaimers, and OCR scanning noise so downstream AI models receive clean, high-density educational text.',
                inputState: `RAW_PAYLOAD: {\n  files: ["os_silberschatz_ch9.pdf"],\n  textPrompt: "OS Memory Management & Paging",\n  startPage: 14,\n  endPage: 38\n}`,
                outputState: `CLEAN_DOC_PAYLOAD: {\n  rawInputChars: 18200,\n  sanitizedCharCount: 14850,\n  noiseReductionPct: "18.4%",\n  cleanTextHash: "sha256:e3b0c442..."\n}`,
                duration: '420ms',
                metrics: {
                    rawChars: 18200,
                    cleanChars: 14850,
                    noiseRemovedPct: '18.4%',
                    strippedArtifacts: ['Header: "Silberschatz OS 10th Ed"', 'Page Numbers [14..38]', 'University Library Stamp', 'Watermark OCR noise']
                }
            },
            {
                id: 'knowledge_graph',
                stepNum: '02',
                name: 'Knowledge Graph & Evidence Agent',
                shortCmd: 'knowledge_graph',
                role: 'Maps core educational concepts and extracts verbatim text evidence.',
                why: 'Extracts core academic entities and maps exact textbook quotes to ensure every single generated question is 100% grounded in factual evidence.',
                inputState: `CLEAN_TEXT: "Virtual memory uses page tables to translate virtual addresses to physical RAM frames. TLB speeds up lookup..."`,
                outputState: `KNOWLEDGE_GRAPH: {\n  conceptNodes: 12,\n  evidenceQuotes: 8,\n  canonicalTags: ["Virtual Memory", "Page Tables", "TLB Cache", "Page Faults"]\n}`,
                duration: '650ms',
                entities: [
                    { tag: 'Page Table Entry (PTE)', count: 4, page: 'p. 18' },
                    { tag: 'Translation Lookaside Buffer (TLB)', count: 3, page: 'p. 22' },
                    { tag: 'Demand Paging & Page Fault', count: 5, page: 'p. 29' }
                ],
                evidenceQuotes: [
                    { quote: '"The page table maps virtual page numbers (VPN) to physical page frame numbers (PFN)."', source: 'os_silberschatz_ch9.pdf (p.18)' },
                    { quote: '"A TLB hit allows address translation to complete in a single clock cycle without accessing main memory page tables."', source: 'os_silberschatz_ch9.pdf (p.22)' }
                ]
            },
            {
                id: 'quiz_plan',
                stepNum: '03',
                name: '5D Quiz Planning Agent',
                shortCmd: 'quiz_plan',
                role: 'Calculates Bloom\'s taxonomy depth, difficulty distribution, and question slot blueprints.',
                why: 'Architects the structural blueprint of the quiz, balancing theoretical concepts, code debugging, and scenario-based problem solving.',
                inputState: `PLAN_REQUEST: {\n  difficulty: "Balanced",\n  targetCount: 10,\n  conceptNodes: 12\n}`,
                outputState: `BLUEPRINT_SLOTS: {\n  theoryRatio: 0.4,\n  scenarioRatio: 0.3,\n  calculationRatio: 0.3,\n  targetBloomLevels: ["Remember", "Apply", "Analyze", "Evaluate"]\n}`,
                duration: '380ms',
                bloomMatrix: [
                    { level: 'Remember / Understand', pct: 40, slots: 'Slots 1-4' },
                    { level: 'Apply (Calculations)', pct: 30, slots: 'Slots 5-7' },
                    { level: 'Analyze / Evaluate (Scenarios)', pct: 30, slots: 'Slots 8-10' }
                ]
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
                duration: '290ms',
                promptRules: [
                    'STRICT_JSON_OBJECT schema enforcement',
                    'Zero answer leakage between sibling questions',
                    'Exact 4 options per question with 1 unambiguous correct key',
                    'Include verbatim source evidence quote per question'
                ]
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
                duration: '1.42s',
                gatewayLogs: {
                    modelId: 'llama-3.1-8b-instant',
                    ttftMs: 180,
                    totalTokens: 1110,
                    httpStatus: '200 OK'
                }
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
                duration: '540ms',
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
                duration: '410ms',
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
                duration: '310ms',
                questions: [
                    {
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
                    },
                    {
                        questionText: 'Which component accelerates virtual address translation by caching recent page table entries?',
                        options: [
                            'Translation Lookaside Buffer (TLB)',
                            'Direct Memory Access (DMA) Controller',
                            'Interrupt Vector Table (IVT)',
                            'Memory Management Unit (MMU) Register Array'
                        ],
                        correctAnswer: 'Translation Lookaside Buffer (TLB)',
                        conceptTag: 'TLB Cache Architecture',
                        sourceEvidence: '"A Translation Lookaside Buffer (TLB) is a hardware cache that memory management hardware uses to improve virtual address translation speed."'
                    }
                ]
            }
        ]
    }
};

export default function PipelineDebugger() {
    const scenario = SCENARIOS.os_memory;
    const [expandedAgents, setExpandedAgents] = useState({ 0: true, 5: true, 6: true, 7: true });
    const cardRefs = useRef({});

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

    const handleDownloadTraceJSON = () => {
        const jsonStr = JSON.stringify(scenario, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pipeline_trace_${scenario.requestId}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <DashboardLayout role="teacher">
            <div className="min-h-screen bg-[#0b0f19] text-slate-100 font-sans p-4 sm:p-8 space-y-8 select-none">
                {/* Ambient Background Grid */}
                <div className="fixed inset-0 bg-[linear-gradient(to_right,#1f293d15_1px,transparent_1px),linear-gradient(to_bottom,#1f293d15_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none" />

                <div className="max-w-6xl mx-auto space-y-8 relative z-10">

                    {/* ── 1. RUN HEADER ────────────────────────────────────────────────────────── */}
                    <div className="bg-[#131b2e] border-2 border-[#243356] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 uppercase tracking-widest font-bold">
                                    <Terminal size={16} />
                                    <span>Standalone Agent Execution Debugger</span>
                                </div>
                                <h1 className="text-2xl sm:text-4xl font-black italic tracking-tight text-white font-sans">
                                    Multi-Agent AI Pipeline <span className="text-cyan-400">Trace View</span>
                                </h1>
                                <p className="text-slate-300 text-xs sm:text-sm max-w-3xl font-medium leading-relaxed">
                                    Step-by-step dry run trace of all 8 AI Agents across Ingestion, Knowledge Graph, 5D Blueprinting, Prompting, LLM Inference, Validation, Healing, and Portfolio Assembly.
                                </p>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                                <button
                                    onClick={handleDownloadTraceJSON}
                                    className="px-5 py-3 rounded-2xl bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg flex items-center gap-2 cursor-pointer transition-all border-none outline-none font-mono"
                                >
                                    <Download size={16} />
                                    <span>Export Trace JSON</span>
                                </button>
                            </div>
                        </div>

                        {/* Metadata Pills Bar */}
                        <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-[#1e293b] text-xs font-mono text-slate-300">
                            <span className="px-3.5 py-2 rounded-xl bg-[#0e1626] border border-[#1f2d4a]">
                                <strong className="text-slate-400">Request ID:</strong> {scenario.requestId}
                            </span>
                            <span className="px-3.5 py-2 rounded-xl bg-[#0e1626] border border-[#1f2d4a]">
                                <strong className="text-slate-400">Model:</strong> {scenario.model}
                            </span>
                            <span className="px-3.5 py-2 rounded-xl bg-[#0e1626] border border-[#1f2d4a]">
                                <strong className="text-slate-400">Total Latency:</strong> {scenario.totalLatencyMs} ms
                            </span>
                            <span className="px-3.5 py-2 rounded-xl bg-[#0e1626] border border-[#1f2d4a]">
                                <strong className="text-slate-400">Throughput:</strong> {scenario.throughput}
                            </span>
                            <span className="px-3.5 py-2 rounded-xl bg-emerald-950 text-emerald-400 border border-emerald-500/40 font-bold">
                                Verdict: 100% APPROVED
                            </span>
                        </div>

                        {/* Segmented Progress Bar */}
                        <div className="space-y-2 pt-2">
                            <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                                <span>Pipeline Execution Completeness</span>
                                <span className="text-emerald-400 font-bold">8 / 8 Agents Passed (100%)</span>
                            </div>
                            <div className="grid grid-cols-8 gap-2 h-2.5 bg-[#0e1626] p-0.5 rounded-full border border-[#1f2d4a]">
                                {scenario.agents.map((_, idx) => (
                                    <div
                                        key={idx}
                                        className="h-full rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"
                                    />
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* ── 2. UNIX PIPE COMMAND BAR AT TOP ──────────────────────────────────────── */}
                    <div className="bg-[#0e1626] border-2 border-[#1f2d4a] rounded-2xl p-5 shadow-xl space-y-3">
                        <div className="flex items-center gap-2 text-xs font-mono text-slate-300 font-bold">
                            <Terminal size={16} className="text-cyan-400" />
                            <span>Unix Pipe Chain Execution Trace (Click segment to jump to step):</span>
                        </div>

                        {/* Unix Pipe Horizontal Scroll */}
                        <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-1 font-mono text-xs scrollbar-thin scrollbar-thumb-slate-700">
                            {scenario.agents.map((agent, idx) => (
                                <React.Fragment key={agent.id}>
                                    {idx > 0 && <span className="text-slate-600 font-bold select-none text-base">|</span>}
                                    <button
                                        onClick={() => scrollToAgent(idx)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                scrollToAgent(idx);
                                            }
                                        }}
                                        tabIndex={0}
                                        className="px-3.5 py-2 rounded-xl border border-emerald-500/50 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/50 font-mono text-xs whitespace-nowrap transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-400"
                                    >
                                        <span className="opacity-60">{agent.stepNum}.</span> {agent.shortCmd}
                                    </button>
                                </React.Fragment>
                            ))}
                        </div>
                    </div>

                    {/* ── 3. VERTICAL NUMBERED STEPPER (CARD PER AGENT) ───────────────────────── */}
                    <div className="relative pl-6 sm:pl-12 space-y-8">

                        {/* Dotted Vertical Spine Line */}
                        <div className="absolute left-3 sm:left-6 top-6 bottom-6 w-0.5 border-l-2 border-dashed border-[#243356] pointer-events-none" />

                        {scenario.agents.map((agent, idx) => {
                            const isExpanded = !!expandedAgents[idx];

                            return (
                                <div
                                    key={agent.id}
                                    ref={el => cardRefs.current[idx] = el}
                                    className="relative group"
                                >
                                    {/* Spine Node Badge */}
                                    <div className="absolute -left-6 sm:-left-12 top-6 -translate-x-1/2 flex items-center justify-center">
                                        <div className="w-9 h-9 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-black text-xs shadow-[0_0_12px_rgba(16,185,129,0.6)]">
                                            ✓
                                        </div>
                                    </div>

                                    {/* Agent Main Card */}
                                    <div 
                                        className="rounded-3xl border-2 border-[#243356] bg-[#131b2e] hover:border-emerald-500/50 transition-all duration-300 overflow-hidden shadow-xl"
                                    >
                                        {/* Collapsed Header Bar */}
                                        <div
                                            onClick={() => toggleAgent(idx)}
                                            onKeyDown={(e) => handleKeyDown(e, idx)}
                                            tabIndex={0}
                                            role="button"
                                            aria-expanded={isExpanded}
                                            className="p-6 flex items-center justify-between gap-4 cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-400 transition-all select-none"
                                        >
                                            <div className="flex items-center gap-4 min-w-0 flex-1">
                                                <span className="font-mono text-xs font-bold text-slate-500">
                                                    STEP {agent.stepNum}
                                                </span>
                                                
                                                <h3 className="font-sans font-black text-base sm:text-lg text-white tracking-tight italic min-w-0 truncate">
                                                    {agent.name}
                                                </h3>

                                                {/* Status Pill */}
                                                <span className="px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider font-bold shrink-0 bg-emerald-950/80 text-emerald-400 border border-emerald-500/40">
                                                    DONE
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-4 shrink-0">
                                                <span className="font-mono text-xs text-slate-400 flex items-center gap-1.5">
                                                    <Clock size={14} />
                                                    {agent.duration}
                                                </span>

                                                {isExpanded ? (
                                                    <ChevronUp size={20} className="text-slate-400" />
                                                ) : (
                                                    <ChevronDown size={20} className="text-slate-400" />
                                                )}
                                            </div>
                                        </div>

                                        {/* Plain Language One-Line Role */}
                                        <div className="px-6 pb-4 -mt-2">
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
                                                    className="border-t border-[#1e293b] p-6 sm:p-8 space-y-6 bg-[#0e1626]/60"
                                                >
                                                    {/* a) Why this agent exists */}
                                                    <div className="bg-[#131b2e] border border-[#243356] rounded-2xl p-5 space-y-1.5">
                                                        <div className="flex items-center gap-2 text-xs font-mono text-amber-400 font-bold uppercase">
                                                            <Sparkles size={15} />
                                                            <span>Why this agent exists</span>
                                                        </div>
                                                        <p className="text-xs font-sans text-slate-300 leading-relaxed font-medium">
                                                            {agent.why}
                                                        </p>
                                                    </div>

                                                    {/* b) INPUT ➔ OUTPUT Flow Row (Side-by-side or stacked on mobile) */}
                                                    <div className="space-y-3">
                                                        <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400 block">
                                                            State Transformation Flow (stdin ➔ stdout)
                                                        </span>

                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch font-mono text-xs">
                                                            {/* Input Box */}
                                                            <div className="bg-[#0a0e17] border border-[#1e2d4a] rounded-2xl p-5 space-y-2 flex flex-col justify-between">
                                                                <div className="flex items-center justify-between text-[10px] text-cyan-400 font-bold uppercase tracking-wider">
                                                                    <span>INPUT STATE RECEIVED</span>
                                                                    <span className="text-slate-500">stdin</span>
                                                                </div>
                                                                <pre className="text-slate-300 text-xs whitespace-pre-wrap leading-relaxed overflow-x-auto">
                                                                    {agent.inputState}
                                                                </pre>
                                                            </div>

                                                            {/* Output Box */}
                                                            <div className="bg-[#0a0e17] border border-[#1e2d4a] rounded-2xl p-5 space-y-2 flex flex-col justify-between relative">
                                                                <div className="flex items-center justify-between text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                                                                    <span>OUTPUT STATE PRODUCED</span>
                                                                    <span className="text-slate-500">stdout</span>
                                                                </div>
                                                                <pre className="text-emerald-300/90 text-xs whitespace-pre-wrap leading-relaxed overflow-x-auto">
                                                                    {agent.outputState}
                                                                </pre>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* c) Agent-Specific Deep Internal Data & Telemetry */}
                                                    
                                                    {/* Agent 1 Metrics */}
                                                    {agent.id === 'ingest' && agent.metrics && (
                                                        <div className="bg-[#131b2e] border border-[#243356] rounded-2xl p-5 space-y-3">
                                                            <div className="flex items-center justify-between text-xs font-mono font-bold uppercase text-cyan-400">
                                                                <span>Ingestion Sanitization Summary</span>
                                                                <span className="text-emerald-400">{agent.metrics.noiseRemovedPct} NOISE STRIPPED</span>
                                                            </div>
                                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                                                                <div className="bg-[#0a0e17] p-3 rounded-xl border border-[#1f2d4a]">
                                                                    <span className="text-slate-500 block text-[10px]">RAW INPUT</span>
                                                                    <span className="font-bold text-white">{agent.metrics.rawChars} chars</span>
                                                                </div>
                                                                <div className="bg-[#0a0e17] p-3 rounded-xl border border-[#1f2d4a]">
                                                                    <span className="text-slate-500 block text-[10px]">CLEAN OUTPUT</span>
                                                                    <span className="font-bold text-emerald-400">{agent.metrics.cleanChars} chars</span>
                                                                </div>
                                                            </div>
                                                            <div className="space-y-1 pt-1">
                                                                <span className="text-[10px] font-mono text-slate-400 uppercase font-bold block">Stripped Administrative Noise:</span>
                                                                <div className="flex flex-wrap gap-2">
                                                                    {agent.metrics.strippedArtifacts.map((art, aIdx) => (
                                                                        <span key={aIdx} className="px-2.5 py-1 rounded-lg bg-[#0a0e17] border border-[#1f2d4a] text-[11px] font-mono text-slate-300">
                                                                            {art}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Agent 2 Entities & Evidence Quotes */}
                                                    {agent.id === 'knowledge_graph' && agent.evidenceQuotes && (
                                                        <div className="bg-[#131b2e] border border-[#243356] rounded-2xl p-5 space-y-4">
                                                            <span className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-400 block">
                                                                Mapped Textbook Evidence &amp; Concept Graph
                                                            </span>
                                                            <div className="space-y-2 font-mono text-xs">
                                                                {agent.evidenceQuotes.map((eq, eqIdx) => (
                                                                    <div key={eqIdx} className="bg-[#0a0e17] border border-[#1f2d4a] rounded-xl p-3.5 space-y-1">
                                                                        <span className="text-amber-400 text-[10px] font-bold block uppercase">{eq.source}</span>
                                                                        <p className="text-slate-300 italic">{eq.quote}</p>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Agent 6: Quality & Grounding Validator */}
                                                    {agent.id === 'validator' && agent.checklist && (
                                                        <div className="bg-[#131b2e] border border-[#243356] rounded-2xl p-6 space-y-4">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                                                                    <ShieldCheck size={18} /> Quality &amp; Grounding Checklist
                                                                </span>
                                                                <span className="px-3 py-1 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-500/40 text-xs font-mono font-bold">
                                                                    VERDICT: PASSED (94/100)
                                                                </span>
                                                            </div>

                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                                                {agent.checklist.map((item, cIdx) => (
                                                                    <div key={cIdx} className="bg-[#0a0e17] border border-[#1f2d4a] rounded-xl p-4 space-y-1">
                                                                        <div className="flex items-center gap-2 text-xs font-bold text-white">
                                                                            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                                                                            <span>{item.label}</span>
                                                                        </div>
                                                                        <p className="text-xs font-sans text-slate-400">
                                                                            {item.detail}
                                                                        </p>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Agent 7: Self-Healing Repair */}
                                                    {agent.id === 'repair' && agent.repairData && (
                                                        <div className="bg-[#131b2e] border border-[#243356] rounded-2xl p-6 space-y-4">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                                                                    <Wrench size={18} /> Self-Healing Patch Diff
                                                                </span>
                                                                <span className="px-3 py-1 rounded-lg bg-amber-950 text-amber-300 border border-amber-500/40 text-xs font-mono font-bold">
                                                                    {agent.repairData.queueCount} ITEM REPAIRED
                                                                </span>
                                                            </div>

                                                            <div className="bg-[#0a0e17] border border-[#1f2d4a] rounded-xl p-5 font-mono text-xs space-y-3">
                                                                <div className="text-xs text-amber-400 font-bold">
                                                                    Trigger: {agent.repairData.triggerReason}
                                                                </div>
                                                                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/40 text-rose-300">
                                                                    {agent.repairData.diff.removed}
                                                                </div>
                                                                <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/40 text-emerald-300">
                                                                    {agent.repairData.diff.added}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Agent 8: Portfolio Assembly (Renders Live Question Card) */}
                                                    {agent.id === 'portfolio_assembly' && agent.questions && (
                                                        <div className="bg-[#131b2e] border border-[#243356] rounded-2xl p-6 space-y-4">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                                                                    <FileText size={18} /> Final Validated Question Card Render
                                                                </span>
                                                                <span className="px-3 py-1 rounded-lg bg-cyan-950 text-cyan-300 border border-cyan-500/40 text-xs font-mono font-bold">
                                                                    100% GROUNDED &amp; VERIFIED
                                                                </span>
                                                            </div>

                                                            {/* Real Question Cards */}
                                                            <div className="space-y-4">
                                                                {agent.questions.map((q, qIdx) => (
                                                                    <div key={qIdx} className="bg-[#0a0e17] border-2 border-cyan-500/40 rounded-2xl p-6 space-y-4 text-left">
                                                                        <div className="flex items-center justify-between gap-2">
                                                                            <span className="px-3 py-1 rounded-lg bg-cyan-950 text-cyan-300 border border-cyan-500/30 text-xs font-mono font-bold uppercase">
                                                                                Concept: {q.conceptTag}
                                                                            </span>
                                                                            <span className="text-xs font-mono text-slate-400 font-bold">
                                                                                10 Points
                                                                            </span>
                                                                        </div>

                                                                        <h4 className="font-sans font-extrabold text-white text-base sm:text-lg leading-snug">
                                                                            {q.questionText}
                                                                        </h4>

                                                                        {/* Options List */}
                                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-sans">
                                                                            {q.options.map((opt, oIdx) => {
                                                                                const isCorrect = opt === q.correctAnswer;
                                                                                const optionLetter = String.fromCharCode(65 + oIdx);
                                                                                return (
                                                                                    <div
                                                                                        key={oIdx}
                                                                                        className={`p-3.5 rounded-xl border text-xs font-bold flex items-start gap-3 transition-all ${
                                                                                            isCorrect
                                                                                                ? 'bg-emerald-950/70 border-emerald-500 text-emerald-200 ring-1 ring-emerald-500/50'
                                                                                                : 'bg-[#131b2e] border-[#1e293b] text-slate-300'
                                                                                        }`}
                                                                                    >
                                                                                        <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-mono text-xs font-black shrink-0 ${
                                                                                            isCorrect ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                                                                                        }`}>
                                                                                            {optionLetter}
                                                                                        </span>
                                                                                        <span className="flex-1 leading-relaxed">{opt}</span>
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>

                                                                        {/* Source Evidence Quote */}
                                                                        <div className="pt-3 border-t border-[#1e293b]">
                                                                            <p className="text-xs font-mono text-slate-400 italic">
                                                                                <strong className="text-cyan-400 not-italic uppercase tracking-wider text-[10px] block mb-1">
                                                                                    Verbatim Source Evidence:
                                                                                </strong>
                                                                                {q.sourceEvidence}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                ))}
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
        </DashboardLayout>
    );
}
