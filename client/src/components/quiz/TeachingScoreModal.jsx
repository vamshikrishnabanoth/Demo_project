import { useEffect, useState } from 'react';
import { X, CheckCircle2, ArrowRight, Quote, ChevronDown, ChevronUp, HelpCircle, Loader2 } from 'lucide-react';

/**
 * Teaching score, readable in ~10 seconds:
 *   score + one-word verdict + confidence → 3 "keep doing" / 3 "try next" →
 *   compact rubric rows (tap a row for its quoted, timestamped evidence and suggestion).
 * Nothing is hardcoded: if the score is not available the window says why.
 */

const WORD = { 1: 'Needs work', 2: 'Developing', 3: 'Good', 4: 'Excellent' };
const verdict = (v) => (v >= 85 ? 'Excellent' : v >= 70 ? 'Good' : v >= 55 ? 'Developing' : 'Needs work');
const colorFor = (v) => (v === null || v === undefined ? '#94a3b8' : v >= 80 ? '#16a34a' : v >= 60 ? '#d97706' : '#e11d48');

function Dots({ rating }) {
    return (
        <span className="flex gap-1" aria-label={rating ? `${rating} of 4` : 'not judged'}>
            {[1, 2, 3, 4].map(i => (
                <span key={i} className="w-2.5 h-2.5 rounded-full" style={{ background: rating && i <= rating ? colorFor(rating * 25) : '#e2e8f0' }} />
            ))}
        </span>
    );
}

export default function TeachingScoreModal({ isOpen, onClose, teaching = null, model = null }) {
    const [open, setOpen] = useState(null);
    const [showHow, setShowHow] = useState(false);
    useEffect(() => {
        if (!isOpen) return undefined;
        const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, onClose]);
    if (!isOpen) return null;
    const t = teaching || model?.teaching || null;
    const score = t && t.available ? t.overall : null;
    const ringC = 2 * Math.PI * 34;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="ts-title">
            <div className="bg-white w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-start justify-between gap-3 px-5 pt-5">
                    <div className="min-w-0">
                        <h2 id="ts-title" className="text-base font-black text-slate-900">Teaching score</h2>
                        <p className="text-xs text-slate-500 truncate">{model?.title || 'This lecture'}</p>
                    </div>
                    <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 cursor-pointer" aria-label="Close"><X size={18} /></button>
                </div>

                <div className="p-5 space-y-4">
                    {!t || t.pending ? (
                        <p className="text-sm text-slate-600 flex items-center gap-2">
                            {t && t.pending ? <><Loader2 size={16} className="animate-spin" /> Preparing the teaching review…</> : <><HelpCircle size={16} /> No teaching score for this input.</>}
                        </p>
                    ) : (
                        <>
                            {/* Score + verdict */}
                            <div className="flex items-center gap-4">
                                <span className="relative w-20 h-20 shrink-0">
                                    <svg viewBox="0 0 80 80" className="w-20 h-20 -rotate-90" aria-hidden="true">
                                        <circle cx="40" cy="40" r="34" fill="none" stroke="#f1f5f9" strokeWidth="8" />
                                        <circle cx="40" cy="40" r="34" fill="none" stroke={colorFor(score)} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${score === null ? 0 : (score / 100) * ringC} ${ringC}`} />
                                    </svg>
                                    <span className="absolute inset-0 flex flex-col items-center justify-center">
                                        <span className="text-2xl font-black text-slate-900 leading-none">{score ?? '–'}</span>
                                        <span className="text-[9px] font-bold text-slate-400">/ 100</span>
                                    </span>
                                </span>
                                <div className="min-w-0 space-y-1">
                                    <p className="text-lg font-black" style={{ color: colorFor(score) }}>{score === null ? 'Not enough evidence' : verdict(score)}</p>
                                    <span className="inline-block text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600" title={t.confidenceReason}>
                                        {String(t.confidence || 'low').toLowerCase()} confidence
                                    </span>
                                    {t.intent && <p className="text-xs text-slate-600 line-clamp-2">{t.intent}</p>}
                                </div>
                            </div>

                            {/* Keep doing / Try next */}
                            <div className="grid sm:grid-cols-2 gap-3">
                                <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-3">
                                    <p className="text-[11px] font-black uppercase tracking-wider text-emerald-800 mb-1.5">Keep doing</p>
                                    <ul className="space-y-1.5">
                                        {(t.strengths || []).slice(0, 3).map((s, i) => <li key={i} className="text-xs text-slate-800 flex gap-1.5"><CheckCircle2 size={13} className="text-emerald-600 shrink-0 mt-0.5" /><span className="line-clamp-3">{s}</span></li>)}
                                    </ul>
                                </div>
                                <div className="rounded-2xl bg-amber-50 border border-amber-100 p-3">
                                    <p className="text-[11px] font-black uppercase tracking-wider text-amber-800 mb-1.5">Try next class</p>
                                    <ul className="space-y-1.5">
                                        {(t.improvements || []).slice(0, 3).map((s, i) => <li key={i} className="text-xs text-slate-800 flex gap-1.5"><ArrowRight size={13} className="text-amber-600 shrink-0 mt-0.5" /><span className="line-clamp-3">{s}</span></li>)}
                                    </ul>
                                </div>
                            </div>

                            {/* Rubric rows */}
                            <div className="rounded-2xl border border-slate-200 divide-y divide-slate-100">
                                {(t.dimensions || []).map((d) => (
                                    <div key={d.key}>
                                        <button type="button" onClick={() => setOpen(open === d.key ? null : d.key)} className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left cursor-pointer hover:bg-slate-50">
                                            <span className="text-xs font-bold text-slate-800">{d.label}</span>
                                            <span className="flex items-center gap-2 shrink-0">
                                                <Dots rating={d.rating} />
                                                <span className="text-[11px] font-bold text-slate-500 w-20 text-right">{d.rating ? WORD[d.rating] : 'Not judged'}</span>
                                                {open === d.key ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                                            </span>
                                        </button>
                                        {open === d.key && (
                                            <div className="px-3 pb-3 space-y-1.5">
                                                <p className="text-xs text-slate-700">{d.finding}</p>
                                                {(d.evidence || []).slice(0, 2).map((e, i) => (
                                                    <p key={i} className="text-[11px] text-slate-500 flex gap-1.5"><Quote size={11} className="shrink-0 mt-0.5" /><span>{e.where && <span className="font-mono font-bold text-slate-600 mr-1">{e.where}</span>}“{e.quote}”</span></p>
                                                ))}
                                                {d.improvement && <p className="text-[11px] text-amber-900 bg-amber-50 rounded-lg px-2 py-1 flex gap-1.5"><ArrowRight size={11} className="shrink-0 mt-0.5" />{d.improvement}</p>}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <button type="button" onClick={() => setShowHow(v => !v)} className="text-[11px] font-bold text-slate-500 underline cursor-pointer">How this score works</button>
                            {showHow && <p className="text-[11px] text-slate-500 leading-relaxed">{t.method} {t.confidenceReason ? `Confidence: ${t.confidenceReason}.` : ''} {t.caveat}</p>}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
