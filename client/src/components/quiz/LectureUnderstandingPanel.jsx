import { useState } from 'react';
import { Loader2, AlertCircle, RefreshCw, Clock, Layers, Target, Info, ChevronDown, ChevronUp, Mic, FileText, Link2, AlertTriangle, BookOpen } from 'lucide-react';

/**
 * Shows the teacher what the system understood from their input, built from the shared
 * lecture model (server/engine/intelligence/lectureModel.js): summary, real timestamped
 * segments, topics, question capacity and the teaching score entry point.
 */

const SOURCE_LABEL = {
    SPOKEN: { label: 'Spoken', icon: Mic, cls: 'bg-sky-50 text-sky-800 border-sky-200' },
    MATERIAL: { label: 'Material only', icon: FileText, cls: 'bg-slate-50 text-slate-700 border-slate-200' },
    BOTH: { label: 'Spoken + slides', icon: Link2, cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
    TOPIC: { label: 'Topic', icon: BookOpen, cls: 'bg-slate-50 text-slate-700 border-slate-200' }
};

const DEPTH_LABEL = { DEMONSTRATED: 'Demonstrated', EXPLAINED: 'Explained', MENTIONED: 'Mentioned' };

function scoreColor(score) {
    if (score === null || score === undefined) return 'bg-slate-400';
    if (score >= 80) return 'bg-emerald-600';
    if (score >= 60) return 'bg-amber-500';
    return 'bg-rose-500';
}

export default function LectureUnderstandingPanel({ model, loading, error, onRetry, onOpenScore, excludedTopics = [], onToggleTopic = null }) {
    const [showAllSegments, setShowAllSegments] = useState(false);

    if (loading) {
        return (
            <div className="p-4 bg-orange-50/60 border border-orange-200/70 rounded-3xl text-xs text-orange-900 space-y-1.5" role="status" aria-live="polite">
                <div className="flex items-center gap-2 font-bold">
                    <Loader2 size={16} className="animate-spin text-[#ea580c]" />
                    <span>Reading your whole lecture…</span>
                </div>
                <p className="text-[11px] text-orange-800/80 pl-6">Finding topics, timestamps, question opportunities and teaching evidence. This usually takes under a minute.</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 bg-amber-50/90 border border-amber-200 rounded-3xl flex items-center justify-between gap-3 text-xs text-amber-900">
                <div className="flex items-center gap-2">
                    <AlertCircle size={16} className="text-amber-600 shrink-0" />
                    <span>We couldn't finish reading this input. You can retry; generation will still read the material itself.</span>
                </div>
                <button type="button" onClick={onRetry} className="px-3 py-1.5 bg-white border border-amber-300 rounded-xl font-bold hover:bg-amber-100 text-[11px] flex items-center gap-1.5 cursor-pointer">
                    <RefreshCw size={12} /> Retry
                </button>
            </div>
        );
    }

    if (!model) return null;

    if (model.isTopicOnly) {
        return (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-3xl text-xs text-slate-700 space-y-1">
                <p className="font-black text-slate-900 flex items-center gap-1.5"><BookOpen size={14} /> Topic only: {model.title}</p>
                <p>{model.summary}</p>
            </div>
        );
    }

    const teaching = model.teaching || {};
    const excludedSet = new Set(excludedTopics);
    const fullCap = model.capacity || { byDifficulty: { easy: 0, medium: 0, hard: 0 }, total: 0, recommended: {} };
    // Capacity follows the topics the teacher keeps ticked (same rule the server uses when planning).
    const cap = excludedSet.size === 0 || !Array.isArray(model.units) ? fullCap : (() => {
        const by = { easy: 0, medium: 0, hard: 0 };
        const kept = model.units.filter(u => !excludedSet.has(u.topic));
        kept.forEach(u => (u.angles || []).forEach(a => { if (by[a.difficulty] !== undefined) by[a.difficulty]++; }));
        const total = by.easy + by.medium + by.hard;
        return { byDifficulty: by, total, unitCount: kept.length, recommended: { balanced: Math.min(30, total <= 4 ? total : Math.max(3, Math.round(total * 0.75))) } };
    })();
    const segments = model.segments || [];
    const visibleSegments = showAllSegments ? segments : segments.slice(0, 6);
    const hasTiming = Boolean(model.hasTiming);
    const topics = model.topics || [];

    return (
        <div className="p-4 bg-[#fff8f3] border-2 border-[#f5d0b5] rounded-3xl space-y-3.5 shadow-xs">
            {/* Header: what was understood + teaching score */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-[#f5d0b5]/70">
                <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-wider text-[#c2410c]">What we understood</p>
                    <p className="text-sm font-black text-slate-900 leading-snug">{model.title}</p>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                        {model.inputDescription}
                        {model.level ? ` · ${model.level.charAt(0) + model.level.slice(1).toLowerCase()} level` : ''}
                    </p>
                </div>
                {model.isTopicNotes ? (
                    <span className="shrink-0 text-[11px] font-bold text-slate-600 bg-white border border-slate-200 rounded-2xl px-3 py-2 max-w-[220px]">
                        Topic only — no teaching score. Add your class recording or notes to get one.
                    </span>
                ) : (
                <button
                    type="button"
                    onClick={onOpenScore}
                    className="shrink-0 flex items-center gap-2.5 bg-white border border-[#f5d0b5] hover:border-orange-400 rounded-2xl px-3 py-2 text-left cursor-pointer transition-colors"
                    title="See why this score was given"
                >
                    <span className={`w-11 h-11 rounded-xl text-white flex flex-col items-center justify-center ${scoreColor(teaching.available ? teaching.overall : null)}`}>
                        <span className="text-base font-black leading-none">{teaching.available ? teaching.overall : '–'}</span>
                        <span className="text-[8px] font-bold opacity-80 leading-none mt-0.5">/100</span>
                    </span>
                    <span>
                        <span className="block text-[10px] font-black uppercase tracking-wider text-[#9a3412]">{hasTiming ? 'Teaching score' : 'Teaching score (material)'}</span>
                        <span className="block text-[11px] font-bold text-slate-700">
                            {teaching.available ? `${teaching.confidence?.toLowerCase()} confidence` : 'Not enough evidence'}
                        </span>
                        <span className="block text-[10px] font-bold text-[#c2410c] underline">See why →</span>
                    </span>
                </button>
                )}
            </div>

            {model.incomplete && (
                <div className="bg-amber-50 p-3 rounded-2xl border border-amber-200 text-xs text-amber-900 flex items-center justify-between gap-2">
                    <span className="flex gap-1.5"><AlertTriangle size={13} className="shrink-0 mt-0.5" /> {model.incomplete.message}</span>
                    {onRetry && <button type="button" onClick={onRetry} className="px-2.5 py-1 bg-white border border-amber-300 rounded-lg font-bold text-[11px] cursor-pointer shrink-0">Retry</button>}
                </div>
            )}

            {/* Summary */}
            {model.summary && (
                <p className="text-xs text-slate-700 leading-relaxed">{model.summary}</p>
            )}

            {/* Timestamped segments */}
            {segments.length > 0 && (
                <div className="bg-white/95 p-3 rounded-2xl border border-orange-200/70 space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-wider text-[#c2410c] flex items-center gap-1.5">
                        <Clock size={13} /> {hasTiming ? 'Lecture timeline' : 'Sections of your material'}
                    </p>
                    <ol className="space-y-1.5">
                        {visibleSegments.map((s, i) => (
                            <li key={i} className="flex gap-2.5 text-xs">
                                <span className="shrink-0 w-[86px] text-[10px] font-mono font-bold text-slate-700 bg-slate-100 rounded-md px-1.5 py-0.5 h-fit text-center">
                                    {s.time || (s.slides && s.slides.length ? `Slide ${s.slides[0]}${s.slides.length > 1 ? `–${s.slides[s.slides.length - 1]}` : ''}` : `Part ${i + 1}`)}
                                </span>
                                <span className="min-w-0">
                                    <span className="font-bold text-slate-900">{s.title}</span>
                                    {s.description && <span className="text-slate-600"> — {s.description}</span>}
                                </span>
                            </li>
                        ))}
                    </ol>
                    {segments.length > 6 && (
                        <button type="button" onClick={() => setShowAllSegments(v => !v)} className="text-[11px] font-bold text-[#c2410c] flex items-center gap-1 cursor-pointer">
                            {showAllSegments ? <><ChevronUp size={12} /> Show less</> : <><ChevronDown size={12} /> Show all {segments.length} parts</>}
                        </button>
                    )}
                </div>
            )}

            {/* Topics */}
            {topics.length > 0 && (
                <div className="bg-white/95 p-3 rounded-2xl border border-orange-200/70 space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-wider text-[#c2410c] flex items-center gap-1.5">
                        <Layers size={13} /> Topics taught ({topics.length}){onToggleTopic ? <span className="normal-case font-bold text-slate-500 tracking-normal"> · untick any you don't want in the quiz</span> : null}
                    </p>
                    <ul className="space-y-2">
                        {topics.map((t, i) => {
                            const src = SOURCE_LABEL[t.source] || SOURCE_LABEL.MATERIAL;
                            const SrcIcon = src.icon;
                            return (
                                <li key={i} className="text-xs">
                                    <div className="flex items-center justify-between gap-2">
                                        <label className={`flex items-center gap-2 min-w-0 ${onToggleTopic ? 'cursor-pointer' : ''}`}>
                                            {onToggleTopic && (
                                                <input type="checkbox" className="accent-[#ea580c] shrink-0" checked={!excludedSet.has(t.name)} onChange={() => onToggleTopic(t.name)} aria-label={`Include ${t.name} in the quiz`} />
                                            )}
                                            <span className={`font-bold min-w-0 truncate ${excludedSet.has(t.name) ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{t.name}</span>
                                        </label>
                                        <span className="flex items-center gap-1.5 shrink-0">
                                            <span className="text-[10px] font-bold text-slate-600">{DEPTH_LABEL[t.depth] || ''}</span>
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border flex items-center gap-1 ${src.cls}`}>
                                                <SrcIcon size={10} /> {src.label}
                                            </span>
                                        </span>
                                    </div>
                                    <div className="h-1.5 bg-orange-100 rounded-full mt-1 overflow-hidden" aria-label={`${t.share}% of the lecture`}>
                                        <div className="h-full bg-[#ea580c] rounded-full" style={{ width: `${Math.max(3, t.share || 0)}%` }} />
                                    </div>
                                    {t.subtopics && t.subtopics.length > 0 && (
                                        <p className="text-[11px] text-slate-600 mt-1 leading-snug">{t.subtopics.slice(0, 8).join(' · ')}{t.subtopics.length > 8 ? ' …' : ''}</p>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}

            {/* Slide/speech disagreements */}
            {Array.isArray(model.contradictions) && model.contradictions.length > 0 && (
                <div className="bg-amber-50 p-3 rounded-2xl border border-amber-200 text-xs text-amber-900 space-y-1">
                    <p className="font-black flex items-center gap-1.5"><AlertTriangle size={13} /> Slides and speech disagree</p>
                    {model.contradictions.slice(0, 3).map((c, i) => <p key={i}>• {c.note}</p>)}
                </div>
            )}

            {/* Question capacity */}
            <div className="bg-white/95 p-3 rounded-2xl border border-orange-200/80 space-y-2">
                <p className="text-[10px] font-black uppercase tracking-wider text-[#c2410c] flex items-center gap-1.5">
                    <Target size={13} /> Questions this input can support
                </p>
                <div className="grid grid-cols-4 gap-2 text-center">
                    {[
                        ['Easy', cap.byDifficulty.easy, 'bg-emerald-50 border-emerald-200 text-emerald-800'],
                        ['Medium', cap.byDifficulty.medium, 'bg-blue-50 border-blue-200 text-blue-800'],
                        ['Hard', cap.byDifficulty.hard, 'bg-purple-50 border-purple-200 text-purple-800'],
                        ['Total', cap.total, 'bg-orange-50 border-orange-200 text-orange-900']
                    ].map(([label, n, cls]) => (
                        <div key={label} className={`p-2 rounded-xl border ${cls}`}>
                            <span className="text-[9px] font-black uppercase tracking-wider block">{label}</span>
                            <span className="text-base font-black text-slate-900 block">{n}</span>
                        </div>
                    ))}
                </div>
                <p className="text-[11px] text-slate-600 leading-snug flex gap-1.5">
                    <Info size={12} className="shrink-0 mt-0.5 text-slate-400" />
                    <span>
                        Counted from distinct things that were taught ({cap.unitCount} teaching points).
                        {cap.byDifficulty.hard === 0 ? ' This input has no material for genuinely hard questions (edge cases or multi-step reasoning), so Hard is not available.' : ''}
                        {cap.total > 0 ? ` Recommended for a balanced quiz: ${cap.recommended?.balanced ?? cap.total}.` : ''}
                    </span>
                </p>
            </div>
        </div>
    );
}
