/**
 * AgentQualityBadge.jsx
 *
 * Displays a full Agent Execution Summary + structured per-question review.
 * Shows generator, critic, and refiner status with quality differences.
 */

import React from 'react';
import {
    AlertTriangle, ArrowRight, CheckCircle, Info, Pencil, Search, Zap
} from 'lucide-react';

// ─── Verdict config ────────────────────────────────────────────────────────────
const VERDICT_CONFIG = {
    approved: {
        label: 'Agent Verified — Quality: Approved',
        badge: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
        glow:  'shadow-emerald-500/20',
        icon:  <CheckCircle size={14} className="text-emerald-400" />,
    },
    excellent: {
        label: 'Agent Verified — Quality: Excellent',
        badge: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
        glow:  'shadow-emerald-500/20',
        icon:  <CheckCircle size={14} className="text-emerald-400" />,
    },
    good: {
        label: 'Agent Verified — Quality: Good',
        badge: 'text-sky-400 bg-sky-500/10 border-sky-500/30',
        glow:  'shadow-sky-500/20',
        icon:  <CheckCircle size={14} className="text-sky-400" />,
    },
    review: {
        label: 'Manual Review Recommended',
        badge: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
        glow:  'shadow-amber-500/20',
        icon:  <AlertTriangle size={14} className="text-amber-400" />,
    },
    not_evaluated: {
        label: 'Quality Audit: Not Evaluated',
        badge: 'text-slate-400 bg-slate-500/10 border-slate-500/30',
        glow:  'shadow-slate-500/20',
        icon:  <Info size={14} className="text-slate-400" />,
    }
};

// ─── Refiner status config ────────────────────────────────────────────────────
const REFINER_STATUS_CONFIG = {
    refined: {
        icon: <Pencil size={14} aria-hidden="true" />, label: (n) => `Refiner — ${n} question${n !== 1 ? 's' : ''} improved`,
        color: 'text-emerald-400',
    },
    early_exit: {
        icon: <Pencil size={14} aria-hidden="true" />, label: () => 'Refiner — Skipped · Questions already excellent',
        color: 'text-emerald-400',
    },
    no_change: {
        icon: <Info size={14} aria-hidden="true" />, label: () => 'Refiner — No valid content improvements found',
        color: 'text-sky-400',
    },
    unavailable: {
        icon: <AlertTriangle size={14} aria-hidden="true" />, label: () => 'Refiner — Groq API key not configured',
        color: 'text-amber-400',
    },
    timeout: {
        icon: <AlertTriangle size={14} aria-hidden="true" />, label: () => 'Refiner — Timed out · Best version returned',
        color: 'text-amber-400',
    },
};

// ─── Agent Execution Summary Banner ──────────────────────────────────────────
function AgentExecutionSummary({ report }) {
    if (!report) return null;
    const {
        criticExecuted, refinerStatus, questionsChanged,
        scoreBefore, scoreAfter, qualityBefore, qualityAfter,
        generated, avgScore, evaluationStatus, verdict
    } = report;

    const rCfg = REFINER_STATUS_CONFIG[refinerStatus] || REFINER_STATUS_CONFIG.no_change;
    const refinerLabel = rCfg.label(questionsChanged ?? 0);

    const activeVerdictKey = (evaluationStatus === 'NOT_EVALUATED' && (avgScore === null || avgScore === undefined))
        ? 'not_evaluated'
        : (verdict || (typeof avgScore === 'number' && avgScore >= 70 ? 'approved' : 'review'));
    const vCfg = VERDICT_CONFIG[activeVerdictKey] || VERDICT_CONFIG.not_evaluated;

    // Build the pipeline steps with contextual Refiner state
    const steps = [
        { label: 'Generator', color: 'text-emerald-400', icon: <Zap size={14} aria-hidden="true" /> },
        { label: `Critic${criticExecuted ? '' : ' —'}`, color: criticExecuted ? 'text-emerald-400' : 'text-white/30', icon: <Search size={14} aria-hidden="true" /> },
        { label: refinerLabel, color: rCfg.color, icon: rCfg.icon },
    ];

    // Explain Improved = 0 honestly
    let noChangeReason = null;
    if (questionsChanged === 0) {
        if (refinerStatus === 'early_exit') {
            noChangeReason = 'No content changes needed — questions already met the quality bar.';
        } else if (refinerStatus === 'no_change') {
            noChangeReason = 'Refiner ran but found no content to improve. Review issues manually if any remain.';
        } else if (refinerStatus === 'unavailable') {
            noChangeReason = 'Refinement disabled — add a GROQ_API_KEY to enable automatic improvements.';
        } else if (refinerStatus === 'timeout') {
            noChangeReason = 'Refinement timed out — increase AGENT_TIMEOUT_MS or reduce question count.';
        }
    }

    return (
        <div className="rounded-2xl border border-sky-500/20 bg-sky-500/5 p-5 space-y-4">
            <div className="flex items-center justify-between pb-1 border-b border-white/5">
                <p className="text-[10px] font-black text-sky-400/60 uppercase tracking-widest">Agent Execution Summary</p>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black border ${vCfg.badge}`}>
                    {vCfg.icon}
                    {vCfg.label}
                </span>
            </div>

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
                    <p className="text-[9px] font-black text-white/30 uppercase tracking-widest">Questions</p>
                    <p className="text-lg font-black text-white">{(generated !== undefined && generated !== null) ? generated : '—'}</p>
                </div>
                <div className="rounded-xl bg-white/5 px-3 py-2 text-center">
                    <p className="text-[9px] font-black text-white/30 uppercase tracking-widest">Improved</p>
                    <p className={`text-lg font-black ${(questionsChanged ?? 0) > 0 ? 'text-emerald-400' : 'text-white/40'}`}>
                        {questionsChanged ?? '—'}
                    </p>
                </div>
                <div className="rounded-xl bg-white/5 px-3 py-2 text-center">
                    <p className="text-[9px] font-black text-white/30 uppercase tracking-widest">Audit Status</p>
                    <p className={`text-xs font-black ${evaluationStatus === 'NOT_EVALUATED' ? 'text-slate-400' : 'text-emerald-400'}`}>
                        {evaluationStatus || (typeof avgScore === 'number' ? 'EVALUATED' : 'NOT_EVALUATED')}
                    </p>
                </div>
                <div className="rounded-xl bg-white/5 px-3 py-2 text-center">
                    <p className="text-[9px] font-black text-white/30 uppercase tracking-widest">Quality Score</p>
                    <p className={`text-xs font-black ${typeof avgScore === 'number' ? (avgScore >= 70 ? 'text-emerald-400' : 'text-amber-400') : 'text-slate-400'}`}>
                        {typeof avgScore === 'number' ? `${avgScore}%` : 'Not evaluated'}
                    </p>
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
export default function AgentQualityBadge({ agentReport }) {
    if (!agentReport) return null;
    return <AgentExecutionSummary report={agentReport} />;
}
