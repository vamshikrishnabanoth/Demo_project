/**
 * AgentQualityBadge.jsx
 *
 * Hybrid UI badge for the teacher review screen:
 *   - Top-level verdict badge (no raw scores)
 *   - Expandable "View AI Review" section with per-question dots + issues
 *   - Actions: Edit / Regenerate / Approve All / Finalize
 */

/* eslint-disable no-unused-vars */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, AlertTriangle, CheckCircle, RotateCw, Info } from 'lucide-react';

// ─── Verdict config ────────────────────────────────────────────────────────────
const VERDICT_CONFIG = {
    excellent: {
        label:    'Agent Verified — Avg Quality: Excellent',
        badge:    'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
        glow:     'shadow-emerald-500/20',
        icon:     <CheckCircle size={16} className="text-emerald-400" />,
        dot:      'bg-emerald-400',
    },
    good: {
        label:    'Agent Verified — Quality: Good',
        badge:    'text-sky-400 bg-sky-500/10 border-sky-500/30',
        glow:     'shadow-sky-500/20',
        icon:     <CheckCircle size={16} className="text-sky-400" />,
        dot:      'bg-sky-400',
    },
    review: {
        label:    'Manual Review Recommended',
        badge:    'text-amber-400 bg-amber-500/10 border-amber-500/30',
        glow:     'shadow-amber-500/20',
        icon:     <AlertTriangle size={16} className="text-amber-400" />,
        dot:      'bg-amber-400',
    },
};

const PER_Q_CONFIG = {
    excellent: { dot: 'bg-emerald-400', label: '🟢' },
    good:      { dot: 'bg-sky-400',     label: '🟡' },
    review:    { dot: 'bg-red-400',     label: '🔴' },
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function AgentQualityBadge({ agentReport, onRegenerateQuestion }) {
    const [expanded, setExpanded] = useState(false);

    if (!agentReport) return null;

    const verdict = agentReport.verdict || 'review';
    const cfg = VERDICT_CONFIG[verdict] || VERDICT_CONFIG.review;
    const perQ = agentReport.perQuestion || [];
    const isFallback = agentReport.fallback;
    const timedOut   = agentReport.timedOut;

    return (
        <div className="mb-8 space-y-3">

            {/* ── Top badge ─────────────────────────────────────────────── */}
            <div className={`flex items-center justify-between px-5 py-3.5 rounded-2xl border ${cfg.badge} shadow-lg ${cfg.glow} gap-3`}>

                <div className="flex items-center gap-2.5">
                    {cfg.icon}
                    <span className="font-black text-sm uppercase tracking-widest">
                        {cfg.label}
                    </span>
                </div>

                <div className="flex items-center gap-3">
                    {/* Agent meta */}
                    {agentReport.totalRetries > 0 && (
                        <span className="hidden sm:flex items-center gap-1 text-[10px] font-bold opacity-60 uppercase tracking-wider">
                            <RotateCw size={10} />
                            {agentReport.totalRetries} refinement{agentReport.totalRetries !== 1 ? 's' : ''}
                        </span>
                    )}
                    {isFallback && !timedOut && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-amber-400/70 uppercase tracking-wider">
                            <Info size={10} />
                            Refinement unavailable — using validated questions
                        </span>
                    )}
                    {timedOut && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-amber-400/70 uppercase tracking-wider">
                            <Info size={10} />
                            Timeout — best version returned
                        </span>
                    )}

                    {/* Expand toggle */}
                    {perQ.length > 0 && (
                        <button
                            onClick={() => setExpanded(x => !x)}
                            className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest opacity-70 hover:opacity-100 transition-opacity"
                        >
                            {expanded ? 'Hide Review' : 'View AI Review'}
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

            {/* ── Expandable per-question review ────────────────────────── */}
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
                                const pqCfg = PER_Q_CONFIG[pq.verdict] || PER_Q_CONFIG.review;
                                return (
                                    <div
                                        key={i}
                                        className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 space-y-2"
                                    >
                                        {/* Question header */}
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="text-base">{pqCfg.label}</span>
                                                <span className="text-xs font-black text-white/50 uppercase tracking-widest">
                                                    Question {i + 1}
                                                </span>
                                                {pq.retries > 0 && (
                                                    <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest flex items-center gap-0.5">
                                                        <RotateCw size={8} />
                                                        {pq.retries}×
                                                    </span>
                                                )}
                                            </div>
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

                                        {/* Issues */}
                                        {pq.issues.length === 0 ? (
                                            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400/80 font-bold">
                                                <CheckCircle size={11} />
                                                Strong distractors · Clear wording · Correct alignment
                                            </div>
                                        ) : (
                                            <ul className="space-y-1">
                                                {pq.issues.map((issue, j) => (
                                                    <li key={j} className="flex items-start gap-1.5 text-[11px] text-amber-300/70 font-bold">
                                                        <span className="flex-shrink-0 mt-0.5">⚠</span>
                                                        <span>{issue}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
// hi
