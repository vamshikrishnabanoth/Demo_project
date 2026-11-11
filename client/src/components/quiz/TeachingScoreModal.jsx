import { useEffect } from 'react';
import { X, CheckCircle2, Lightbulb, Quote, ShieldCheck, HelpCircle } from 'lucide-react';

/**
 * TeachingScoreModal
 *
 * Explains the evidence-based teaching score from the shared lecture model:
 *  - overall score (average of the rubric dimensions that could be judged) and confidence,
 *  - each dimension: rating, what the evidence shows, quoted + timestamped evidence, one specific suggestion,
 *  - dimensions with too little evidence are shown as such (never filled in).
 * No hardcoded or fallback numbers: if the score is unavailable the modal says why.
 */

const RATING_WORD = { 1: 'Needs work', 2: 'Developing', 3: 'Good', 4: 'Excellent' };

function barColor(rating) {
    if (!rating) return 'bg-slate-300';
    if (rating >= 4) return 'bg-emerald-500';
    if (rating === 3) return 'bg-lime-500';
    if (rating === 2) return 'bg-amber-500';
    return 'bg-rose-500';
}

export default function TeachingScoreModal({ isOpen, onClose, teaching = null, model = null }) {
    useEffect(() => {
        if (!isOpen) return undefined;
        const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, onClose]);

    if (!isOpen) return null;
    const t = teaching || model?.teaching || null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="teaching-score-title">
            <div className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-slate-100 px-5 py-4 flex items-start justify-between gap-3 z-10">
                    <div>
                        <h2 id="teaching-score-title" className="text-base font-black text-slate-900">Teaching score</h2>
                        <p className="text-xs text-slate-600">{model?.title || 'This lecture'}{t?.level ? ` · ${t.level.charAt(0) + t.level.slice(1).toLowerCase()} level` : ''}</p>
                    </div>
                    <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 cursor-pointer" aria-label="Close">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-5 space-y-5">
                    {!t || (!t.available && !(t.dimensions && t.dimensions.length)) ? (
                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-sm text-slate-700 flex gap-2">
                            <HelpCircle size={18} className="shrink-0 text-slate-500" />
                            <span>{t?.reason || 'No teaching score is available for this input yet.'}</span>
                        </div>
                    ) : (
                        <>
                            {/* Overall */}
                            <div className="flex items-center gap-4">
                                <div className={`w-20 h-20 rounded-2xl text-white flex flex-col items-center justify-center shrink-0 ${t.available ? (t.overall >= 80 ? 'bg-emerald-600' : t.overall >= 60 ? 'bg-amber-500' : 'bg-rose-500') : 'bg-slate-400'}`}>
                                    <span className="text-3xl font-black leading-none">{t.available ? t.overall : '–'}</span>
                                    <span className="text-[10px] font-bold opacity-80">/ 100</span>
                                </div>
                                <div className="text-xs text-slate-700 space-y-1">
                                    {t.intent && <p><span className="font-bold text-slate-900">What this lecture set out to teach:</span> {t.intent}</p>}
                                    <p className="flex items-center gap-1.5">
                                        <ShieldCheck size={13} className="text-slate-500" />
                                        <span><span className="font-bold capitalize">{String(t.confidence || '').toLowerCase()} confidence</span> — {t.confidenceReason}</span>
                                    </p>
                                    {!t.available && t.reason && <p className="text-amber-700 font-bold">{t.reason}</p>}
                                </div>
                            </div>

                            {/* Strengths / improvements */}
                            <div className="grid sm:grid-cols-2 gap-3">
                                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200">
                                    <p className="text-[11px] font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1.5 mb-1.5"><CheckCircle2 size={13} /> Taught well</p>
                                    <ul className="space-y-1.5 text-xs text-slate-800">
                                        {(t.strengths || []).map((s, i) => <li key={i}>• {s}</li>)}
                                        {(!t.strengths || t.strengths.length === 0) && <li className="text-slate-500">No specific strengths identified.</li>}
                                    </ul>
                                </div>
                                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200">
                                    <p className="text-[11px] font-black uppercase tracking-wider text-amber-800 flex items-center gap-1.5 mb-1.5"><Lightbulb size={13} /> Could improve</p>
                                    <ul className="space-y-1.5 text-xs text-slate-800">
                                        {(t.improvements || []).map((s, i) => <li key={i}>• {s}</li>)}
                                        {(!t.improvements || t.improvements.length === 0) && <li className="text-slate-500">No specific improvements identified.</li>}
                                    </ul>
                                </div>
                            </div>

                            {/* Dimensions */}
                            <div className="space-y-3">
                                <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">How the score was reached</p>
                                {(t.dimensions || []).map((d) => (
                                    <div key={d.key} className="p-3.5 rounded-2xl border border-slate-200 space-y-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="text-sm font-black text-slate-900">{d.label}</p>
                                                <p className="text-[11px] text-slate-500">{d.question}</p>
                                            </div>
                                            <span className="text-right shrink-0">
                                                <span className="block text-sm font-black text-slate-900">{d.rating ? `${d.score}` : '—'}</span>
                                                <span className="block text-[10px] font-bold text-slate-500">{d.rating ? RATING_WORD[d.rating] : 'Not enough evidence'}</span>
                                            </span>
                                        </div>
                                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div className={`h-full rounded-full ${barColor(d.rating)}`} style={{ width: `${d.rating ? d.rating * 25 : 0}%` }} />
                                        </div>
                                        <p className="text-xs text-slate-700">{d.finding}</p>
                                        {d.evidence && d.evidence.length > 0 && (
                                            <ul className="space-y-1">
                                                {d.evidence.slice(0, 3).map((e, i) => (
                                                    <li key={i} className="text-[11px] text-slate-600 flex gap-1.5">
                                                        <Quote size={11} className="shrink-0 mt-0.5 text-slate-400" />
                                                        <span>
                                                            {e.where && <span className="font-mono font-bold text-slate-700 mr-1">{e.where}</span>}
                                                            “{e.quote}”
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                        {d.improvement && (
                                            <p className="text-xs text-amber-900 bg-amber-50 border border-amber-100 rounded-xl px-2.5 py-1.5 flex gap-1.5">
                                                <Lightbulb size={13} className="shrink-0 mt-0.5" /> {d.improvement}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <p className="text-[11px] text-slate-500 leading-relaxed border-t border-slate-100 pt-3">
                                {t.method} {t.caveat}
                            </p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
