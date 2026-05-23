/**
 * AgentQualityBadge.jsx
 *
 * Displays a full Agent Execution Summary + structured per-question review.
 * Shows: Generator ✅ → Critic ✅ → Refiner ✅ + quality diff + View Changes modal.
 */

/* eslint-disable no-unused-vars */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronDown, ChevronUp, AlertTriangle, CheckCircle, RotateCw,
    Info, ArrowRight, TrendingUp, Lock, Eye, X,
} from 'lucide-react';

// ─── Verdict config ────────────────────────────────────────────────────────────
const VERDICT_CONFIG = {
    excellent: {
        label: 'Agent Verified — Quality: Excellent',
        badge: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
        glow:  'shadow-emerald-500/20',
        icon:  <CheckCircle size={16} className="text-emerald-400" />,
    },
    good: {
        label: 'Agent Verified — Quality: Good',
        badge: 'text-sky-400 bg-sky-500/10 border-sky-500/30',
        glow:  'shadow-sky-500/20',
        icon:  <CheckCircle size={16} className="text-sky-400" />,
    },
    review: {
        label: 'Manual Review Recommended',
        badge: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
        glow:  'shadow-amber-500/20',
        icon:  <AlertTriangle size={16} className="text-amber-400" />,
    },
};

// ─── View Changes Modal ───────────────────────────────────────────────────────
function ViewChangesModal({ diff, onClose }) {
    if (!diff) return null;
    const changed = diff.modified;
    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-[var(--bg-secondary,#0f1929)] border border-white/10 rounded-3xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-8 space-y-6 shadow-2xl"
            >
                <div className="flex items-center justify-between">
                    <h3 className="font-black text-lg text-white uppercase tracking-wider">
                        Question {diff.questionId} — {changed ? 'Modified by Refiner' : 'No Changes Made'}
                    </h3>
                    <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {changed ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Before */}
                        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 space-y-3">
                            <p className="text-[10px] font-black text-red-400/70 uppercase tracking-widest">Before Refinement</p>
                            <p className="text-sm text-white/80 font-bold">{diff.before.question}</p>
                            <ul className="space-y-1">
                                {diff.before.options.map((o, i) => (
                                    <li key={i} className={`text-xs px-3 py-1.5 rounded-lg font-bold ${o === diff.before.answer ? 'bg-red-500/20 text-red-300' : 'text-white/40'}`}>
                                        {String.fromCharCode(65 + i)}. {o}
                                    </li>
                                ))}
                            </ul>
                            {diff.before.explanation && (
                                <p className="text-xs text-white/30 italic mt-2">
                                    {diff.before.explanation || '(no explanation)'}
                                </p>
                            )}
                        </div>
                        {/* After */}
                        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-3">
                            <p className="text-[10px] font-black text-emerald-400/70 uppercase tracking-widest">After Refinement</p>
                            <p className="text-sm text-white/80 font-bold">{diff.after.question}</p>
                            <ul className="space-y-1">
                                {diff.after.options.map((o, i) => (
                                    <li key={i} className={`text-xs px-3 py-1.5 rounded-lg font-bold ${o === diff.after.answer ? 'bg-emerald-500/20 text-emerald-300' : 'text-white/40'}`}>
                                        {String.fromCharCode(65 + i)}. {o}
                                    </li>
                                ))}
                            </ul>
                            <p className="text-xs text-white/50 italic mt-2">{diff.after.explanation}</p>
                        </div>
                    </div>
                ) : (
                    <div className="rounded-2xl border border-sky-500/20 bg-sky-500/5 p-6 text-center text-sky-400/70 text-sm font-bold">
                        This question scored highly and was not modified by the Refiner.
                    </div>
                )}

                {/* Critic feedback that prompted refinement */}
                {diff.criticFeedback && diff.criticFeedback.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">Critic Feedback</p>
                        <ul className="space-y-1">
                            {diff.criticFeedback.map((fb, i) => (
                                <li key={i} className="text-xs text-amber-300/70 font-bold flex items-start gap-2">
                                    <span className="flex-shrink-0 mt-0.5">→</span>
                                    <span>{fb}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </motion.div>
        </div>
    );
}

// ─── Structured per-question issue row ───────────────────────────────────────
function IssueRow({ issueData }) {
    const { issue, actionTaken, fixed } = issueData;
    return (
        <div className="space-y-1 text-[11px]">
            <div className="flex items-start gap-2 text-amber-300/80 font-bold">
                <span className="flex-shrink-0 mt-0.5">⚠</span>
                <span><span className="text-white/40 uppercase tracking-wider text-[9px]">Issue Found →</span> {issue}</span>
            </div>
            <div className="flex items-start gap-2 text-white/40 font-bold pl-4">
                <ArrowRight size={10} className="flex-shrink-0 mt-0.5" />
                <span><span className="text-white/30 uppercase tracking-wider text-[9px]">Action →</span> {actionTaken}</span>
            </div>
            <div className={`flex items-start gap-2 font-black pl-4 ${fixed ? 'text-emerald-400' : 'text-red-400'}`}>
                <span className="flex-shrink-0 mt-0.5">{fixed ? '✅' : '⚠'}</span>
                <span>{fixed ? 'Fixed' : 'Teacher Attention Required'}</span>
            </div>
        </div>
    );
}

// ─── Refiner status config ────────────────────────────────────────────────────
const REFINER_STATUS_CONFIG = {
    refined: {
        icon: '✏️', label: (n) => `Refiner ✅ — ${n} question${n !== 1 ? 's' : ''} improved`,
        color: 'text-emerald-400',
    },
    early_exit: {
        icon: '✏️', label: () => 'Refiner ✅ — Skipped · Questions already excellent',
        color: 'text-emerald-400',
    },
    no_change: {
        icon: '✏️', label: () => 'Refiner ℹ — No valid content improvements found',
        color: 'text-sky-400',
    },
    unavailable: {
        icon: '✏️', label: () => 'Refiner ⚠ — Groq API key not configured',
        color: 'text-amber-400',
    },
    timeout: {
        icon: '✏️', label: () => 'Refiner ⚠ — Timed out · Best version returned',
        color: 'text-amber-400',
    },
};

// ─── Agent Execution Summary Banner ──────────────────────────────────────────
function AgentExecutionSummary({ report }) {
    if (!report) return null;
    const {
        criticExecuted, refinerStatus, questionsChanged,
        scoreBefore, scoreAfter, qualityBefore, qualityAfter,
        generated,
    } = report;

    const rCfg = REFINER_STATUS_CONFIG[refinerStatus] || REFINER_STATUS_CONFIG.no_change;
    const refinerLabel = rCfg.label(questionsChanged ?? 0);

    // Build the pipeline steps with contextual Refiner state
    const steps = [
        { label: 'Generator ✅', color: 'text-emerald-400', icon: '⚡' },
        { label: `Critic ${criticExecuted ? '✅' : '—'}`, color: criticExecuted ? 'text-emerald-400' : 'text-white/30', icon: '🔍' },
        { label: refinerLabel, color: rCfg.color, icon: rCfg.icon },
    ];

    // Explain Improved = 0 honestly
    const noChangeReason = questionsChanged === 0
        ? refinerStatus === 'early_exit'  ? '✅ No content changes needed — questions already met the quality bar.'
        : refinerStatus === 'no_change'   ? 'ℹ Refiner ran but found no content to improve. Review issues manually if any remain.'
        : refinerStatus === 'unavailable' ? '⚠ Refinement disabled — add a GROQ_API_KEY to enable automatic improvements.'
        : refinerStatus === 'timeout'     ? '⚠ Refinement timed out — increase AGENT_TIMEOUT_MS or reduce question count.'
        : null
        : null;

    return (
        <div className="rounded-2xl border border-sky-500/20 bg-sky-500/5 p-5 space-y-4">
            <p className="text-[10px] font-black text-sky-400/60 uppercase tracking-widest">Agent Execution Summary</p>

            {/* Pipeline steps */}
            <div className="flex items-center gap-3 flex-wrap">
                {steps.map((step, i) => (
                    <React.Fragment key={i}>
                        <div className={`flex items-center gap-1.5 text-xs font-black uppercase tracking-widest ${step.color}`}>
                            <span>{step.icon}</span>
                            <span>{step.label}</span>
                        </div>
                        {i < steps.length - 1 && (
                            <ArrowRight size={12} className="text-white/20" />
                        )}
                    </React.Fragment>
                ))}
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl bg-white/5 px-3 py-2 text-center">
                    <p className="text-[9px] font-black text-white/30 uppercase tracking-widest">Generated</p>
                    <p className="text-lg font-black text-white">{generated || '—'}</p>
                </div>
                <div className="rounded-xl bg-white/5 px-3 py-2 text-center">
                    <p className="text-[9px] font-black text-white/30 uppercase tracking-widest">Improved</p>
                    <p className={`text-lg font-black ${questionsChanged > 0 ? 'text-emerald-400' : 'text-white/40'}`}>
                        {questionsChanged ?? '—'}
                    </p>
                </div>
                <div className="rounded-xl bg-white/5 px-3 py-2 text-center">
                    <p className="text-[9px] font-black text-white/30 uppercase tracking-widest">Quality Before</p>
                    <p className="text-xs font-black text-amber-400">{qualityBefore || '—'}</p>
                </div>
                <div className="rounded-xl bg-white/5 px-3 py-2 text-center">
                    <p className="text-[9px] font-black text-white/30 uppercase tracking-widest">Quality After</p>
                    <p className="text-xs font-black text-emerald-400">{qualityAfter || '—'}</p>
                </div>
            </div>

            {/* Honest "why" banner when nothing changed */}
            {noChangeReason && (
                <div className={`flex items-start gap-2 text-[11px] font-bold rounded-xl px-3 py-2
                    ${refinerStatus === 'early_exit' ? 'bg-emerald-500/10 text-emerald-300/80' :
                      refinerStatus === 'unavailable' || refinerStatus === 'timeout' ? 'bg-amber-500/10 text-amber-300/80' :
                      'bg-sky-500/10 text-sky-300/80'}`}>
                    <Info size={12} className="flex-shrink-0 mt-0.5" />
                    <span>{noChangeReason}</span>
                </div>
            )}
        </div>
    );
}


// ─── Main Component ───────────────────────────────────────────────────────────
export default function AgentQualityBadge({ agentReport, onRegenerateQuestion }) {
    const [expanded, setExpanded] = useState(false);
    const [viewChangesIdx, setViewChangesIdx] = useState(null);

    if (!agentReport) return null;

    const verdict    = agentReport.verdict || 'review';
    const cfg        = VERDICT_CONFIG[verdict] || VERDICT_CONFIG.review;
    const perQ       = agentReport.perQuestion || [];
    const diffs      = agentReport.questionDiffs || [];
    const timedOut   = agentReport.timedOut;
    const isFallback = agentReport.fallback;

    return (
        <div className="mb-8 space-y-3">
            {/* ── Agent Execution Summary ─────────────────────────────────── */}
            <AgentExecutionSummary report={agentReport} />

            {/* ── Top verdict badge ─────────────────────────────────────── */}
            <div className={`flex items-center justify-between px-5 py-3.5 rounded-2xl border ${cfg.badge} shadow-lg ${cfg.glow} gap-3`}>
                <div className="flex items-center gap-2.5">
                    {cfg.icon}
                    <span className="font-black text-sm uppercase tracking-widest">{cfg.label}</span>
                </div>
                <div className="flex items-center gap-3">
                    {agentReport.totalRetries > 0 && (
                        <span className="hidden sm:flex items-center gap-1 text-[10px] font-bold opacity-60 uppercase tracking-wider">
                            <RotateCw size={10} />
                            {agentReport.totalRetries} refinement{agentReport.totalRetries !== 1 ? 's' : ''}
                        </span>
                    )}
                    {timedOut && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-amber-400/70 uppercase tracking-wider">
                            <Info size={10} /> Timeout — best version returned
                        </span>
                    )}
                    {perQ.length > 0 && (
                        <button
                            onClick={() => setExpanded(x => !x)}
                            className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest opacity-70 hover:opacity-100 transition-opacity"
                        >
                            {expanded ? 'Hide Review' : 'Show Review'}
                            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </button>
                    )}
                </div>
            </div>

            {/* ── Quiz-level issues ─────────────────────────────────────── */}
            {(agentReport.quizIssues || []).length > 0 && (
                <div className="px-5 py-3 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-1">
                    <p className="text-[10px] font-black text-amber-400/70 uppercase tracking-widest mb-2">
                        Quiz-level observations
                    </p>
                    {agentReport.quizIssues.map((issue, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-amber-300/70 font-bold">
                            <span className="mt-0.5 flex-shrink-0">⚠</span>
                            <span>{issue}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Expandable per-question structured review ──────────────── */}
            <AnimatePresence>
                {expanded && perQ.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                    >
                        <div className="pt-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {perQ.map((pq, i) => {
                                const isGood    = pq.verdict === 'excellent' || pq.verdict === 'good';
                                const isLocked  = pq.locked;
                                const diff      = diffs.find(d => d.questionId === i + 1);
                                const structured = pq.structuredIssues || [];

                                return (
                                    <div
                                        key={i}
                                        className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 space-y-3"
                                    >
                                        {/* Header */}
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="text-base">
                                                    {isGood ? '🟢' : '🔴'}
                                                </span>
                                                <span className="text-xs font-black text-white/50 uppercase tracking-widest">
                                                    Question {i + 1}
                                                </span>
                                                {isLocked && (
                                                    <span className="flex items-center gap-0.5 text-[9px] font-bold text-emerald-400/60 uppercase tracking-widest">
                                                        <Lock size={9} /> Locked
                                                    </span>
                                                )}
                                                {pq.retries > 0 && (
                                                    <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest flex items-center gap-0.5">
                                                        <RotateCw size={8} />
                                                        {pq.retries}× refined
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {/* View Changes button */}
                                                {diff && (
                                                    <button
                                                        onClick={() => setViewChangesIdx(i)}
                                                        className="text-[10px] font-black uppercase tracking-wider text-sky-400 hover:opacity-80 transition-opacity flex items-center gap-1"
                                                    >
                                                        <Eye size={10} />
                                                        {diff.modified ? 'View Changes' : 'View'}
                                                    </button>
                                                )}
                                                {/* Regenerate button */}
                                                {pq.verdict === 'review' && onRegenerateQuestion && (
                                                    <button
                                                        onClick={() => onRegenerateQuestion(i)}
                                                        className="text-[10px] font-black uppercase tracking-wider text-[var(--bg-accent)] hover:opacity-80 transition-opacity flex items-center gap-1"
                                                    >
                                                        <RotateCw size={10} />
                                                        Regenerate
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Structured issues or clean state */}
                                        {structured.length === 0 ? (
                                            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400/80 font-bold">
                                                <CheckCircle size={11} />
                                                Strong distractors · Clear wording · Correct alignment
                                            </div>
                                        ) : (
                                            <div className="space-y-3 divide-y divide-white/5">
                                                {structured.map((issueData, j) => (
                                                    <div key={j} className={j > 0 ? 'pt-3' : ''}>
                                                        <IssueRow issueData={issueData} />
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Remaining unfixed issues */}
                                        {pq.issues && pq.issues.length > 0 && (
                                            <div className="pt-2 border-t border-white/5">
                                                <p className="text-[9px] font-black text-red-400/60 uppercase tracking-widest mb-1">Still Requires Attention</p>
                                                <ul className="space-y-1">
                                                    {pq.issues.map((issue, j) => (
                                                        <li key={j} className="flex items-start gap-1.5 text-[11px] text-red-300/70 font-bold">
                                                            <span className="flex-shrink-0 mt-0.5">⚠</span>
                                                            <span>{issue}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* View Changes Modal */}
            <AnimatePresence>
                {viewChangesIdx !== null && (
                    <ViewChangesModal
                        diff={diffs[viewChangesIdx]}
                        onClose={() => setViewChangesIdx(null)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
