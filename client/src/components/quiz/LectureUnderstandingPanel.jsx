import { useMemo, useState } from 'react';
import { Loader2, AlertCircle, RefreshCw, Mic, FileText, Link2, AlertTriangle, BookOpen, ChevronDown, ChevronUp, Clock } from 'lucide-react';

/**
 * Glanceable summary of what the system understood (from the shared lecture model):
 *   header (title, length, level, score ring) → 2-line summary → lecture map (proportional bar + key parts)
 *   → topic chips (untick to leave out) → one-line question capacity.
 * Details stay one tap away so a teacher can read it in a few seconds.
 */

const TOPIC_COLORS = ['#ea580c', '#2563eb', '#16a34a', '#9333ea', '#db2777', '#0891b2', '#ca8a04', '#4f46e5', '#059669', '#dc2626'];
const SOURCE_ICON = { SPOKEN: Mic, MATERIAL: FileText, BOTH: Link2, TOPIC: BookOpen };
const SOURCE_TITLE = { SPOKEN: 'Taught in speech', MATERIAL: 'Only in your material', BOTH: 'Spoken and in your material', TOPIC: 'Topic' };

function ScoreRing({ teaching, onClick }) {
    const pending = teaching && teaching.pending;
    const value = teaching && teaching.available ? teaching.overall : null;
    const color = value === null ? '#94a3b8' : value >= 80 ? '#16a34a' : value >= 60 ? '#d97706' : '#e11d48';
    const r = 20, c = 2 * Math.PI * r, dash = value === null ? 0 : (value / 100) * c;
    return (
        <button type="button" onClick={onClick} disabled={pending} title="Why this score?"
            className="shrink-0 flex items-center gap-2 rounded-2xl px-2 py-1.5 hover:bg-white/80 transition-colors cursor-pointer disabled:cursor-default">
            <span className="relative w-12 h-12">
                <svg viewBox="0 0 48 48" className="w-12 h-12 -rotate-90" aria-hidden="true">
                    <circle cx="24" cy="24" r={r} fill="none" stroke="#f1f5f9" strokeWidth="5" />
                    <circle cx="24" cy="24" r={r} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeDasharray={`${dash} ${c}`} />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-sm font-black text-slate-900">
                    {pending ? <Loader2 size={14} className="animate-spin text-slate-400" /> : (value ?? '–')}
                </span>
            </span>
            <span className="text-left leading-tight">
                <span className="block text-[10px] font-black uppercase tracking-wider text-slate-500">Teaching score</span>
                <span className="block text-[11px] font-bold" style={{ color: pending ? '#64748b' : '#c2410c' }}>
                    {pending ? 'Preparing…' : value === null ? 'Not enough evidence' : 'See why →'}
                </span>
            </span>
        </button>
    );
}

export default function LectureUnderstandingPanel({ model, loading, error, onRetry, onOpenScore, excludedTopics = [], onToggleTopic = null }) {
    const [showParts, setShowParts] = useState(false);
    const [showSummary, setShowSummary] = useState(false);
    const [activeSeg, setActiveSeg] = useState(null);
    const excludedSet = useMemo(() => new Set(excludedTopics), [excludedTopics]);

    const topicColor = useMemo(() => {
        const map = {};
        (model?.topics || []).forEach((t, i) => { map[t.name] = TOPIC_COLORS[i % TOPIC_COLORS.length]; });
        return map;
    }, [model]);

    const cap = useMemo(() => {
        if (!model || !Array.isArray(model.units)) return model?.capacity?.byDifficulty ? { ...model.capacity.byDifficulty, total: model.capacity.total } : null;
        const by = { easy: 0, medium: 0, hard: 0 };
        model.units.filter(u => !excludedSet.has(u.topic)).forEach(u => (u.angles || []).forEach(a => { if (by[a.difficulty] !== undefined) by[a.difficulty]++; }));
        return { ...by, total: by.easy + by.medium + by.hard };
    }, [model, excludedSet]);

    if (loading) {
        return (
            <div className="p-4 bg-orange-50/60 border border-orange-200/70 rounded-3xl text-xs text-orange-900" role="status" aria-live="polite">
                <div className="flex items-center gap-2 font-bold"><Loader2 size={16} className="animate-spin text-[#ea580c]" /> Reading your lecture…</div>
                <p className="text-[11px] text-orange-800/80 pl-6 mt-0.5">About 20–60 seconds for an hour of class. The teaching score follows a few seconds later.</p>
            </div>
        );
    }
    if (error) {
        return (
            <div className="p-3.5 bg-amber-50/90 border border-amber-200 rounded-3xl flex items-center justify-between gap-3 text-xs text-amber-900">
                <span className="flex items-center gap-2"><AlertCircle size={16} className="text-amber-600 shrink-0" /> Couldn't finish reading this input. Retry, or generate anyway.</span>
                <button type="button" onClick={onRetry} className="px-3 py-1.5 bg-white border border-amber-300 rounded-xl font-bold text-[11px] flex items-center gap-1.5 cursor-pointer"><RefreshCw size={12} /> Retry</button>
            </div>
        );
    }
    if (!model) return null;
    if (model.isTopicOnly) {
        return (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-3xl text-xs text-slate-700">
                <span className="font-black text-slate-900 flex items-center gap-1.5"><BookOpen size={14} /> Topic only: {model.title}</span>
                <span className="block mt-0.5">Questions come from general knowledge of this topic, not from your class.</span>
            </div>
        );
    }

    const segments = model.segments || [];
    const timed = Boolean(model.hasTiming) && segments.some(s => s.start != null && s.end != null);
    const totalSec = timed ? Math.max(1, (segments[segments.length - 1].end || 0) - (segments[0].start || 0)) : 1;
    const keyParts = segments.slice(0, showParts ? segments.length : 4);
    const topics = model.topics || [];
    const lengthChip = model.durationLabel || (model.wordCount ? `${model.wordCount.toLocaleString()} words` : null);

    return (
        <div className="p-4 bg-[#fff8f3] border-2 border-[#f5d0b5] rounded-3xl space-y-3 shadow-xs">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-wider text-[#c2410c]">What we understood</p>
                    <p className="text-sm font-black text-slate-900 leading-snug truncate" title={model.title}>{model.title}</p>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                        {lengthChip && <span className="text-[10px] font-bold text-slate-700 bg-white border border-slate-200 rounded-full px-2 py-0.5 flex items-center gap-1"><Clock size={10} />{lengthChip}</span>}
                        {model.level && <span className="text-[10px] font-bold text-slate-700 bg-white border border-slate-200 rounded-full px-2 py-0.5">{model.level.charAt(0) + model.level.slice(1).toLowerCase()}</span>}
                        <span className="text-[10px] font-bold text-slate-700 bg-white border border-slate-200 rounded-full px-2 py-0.5">{topics.length} topic{topics.length === 1 ? '' : 's'}</span>
                    </div>
                </div>
                {model.isTopicNotes
                    ? <span className="shrink-0 text-[10px] font-bold text-slate-500 max-w-[140px] text-right">Topic only — no teaching score</span>
                    : <ScoreRing teaching={model.teaching} onClick={onOpenScore} />}
            </div>

            {model.incomplete && (
                <div className="text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-2.5 py-1.5 flex items-center justify-between gap-2">
                    <span className="flex gap-1.5"><AlertTriangle size={12} className="shrink-0 mt-0.5" />Part of the input wasn't read (service busy).</span>
                    {onRetry && <button type="button" onClick={onRetry} className="font-bold underline cursor-pointer shrink-0">Retry</button>}
                </div>
            )}

            {/* Summary (2 lines, expandable) */}
            {model.summary && (
                <button type="button" onClick={() => setShowSummary(v => !v)} className="text-left w-full cursor-pointer">
                    <p className={`text-xs text-slate-700 leading-relaxed ${showSummary ? '' : 'line-clamp-2'}`}>{model.summary}</p>
                </button>
            )}

            {/* Lecture map */}
            {segments.length > 0 && (
                <div className="bg-white/90 rounded-2xl border border-orange-200/60 p-2.5 space-y-2">
                    {timed && (
                        <div className="flex h-3 rounded-full overflow-hidden bg-slate-100" role="img" aria-label="Lecture timeline by topic">
                            {segments.map((s, i) => {
                                const w = Math.max(1.5, ((s.end - s.start) / totalSec) * 100);
                                const col = topicColor[(s.topics || [])[0]] || '#cbd5e1';
                                return (
                                    <button key={i} type="button" onMouseEnter={() => setActiveSeg(i)} onFocus={() => setActiveSeg(i)} onClick={() => setActiveSeg(i)}
                                        className="h-full border-r border-white/70 last:border-r-0 cursor-pointer" style={{ width: `${w}%`, background: col, opacity: activeSeg === null || activeSeg === i ? 1 : 0.45 }}
                                        title={`${s.time} · ${s.title}`} aria-label={`${s.time} ${s.title}`} />
                                );
                            })}
                        </div>
                    )}
                    {activeSeg !== null && segments[activeSeg] && (
                        <p className="text-[11px] text-slate-700"><span className="font-mono font-bold">{segments[activeSeg].time || ''}</span> <span className="font-bold">{segments[activeSeg].title}</span>{segments[activeSeg].description ? ` — ${segments[activeSeg].description}` : ''}</p>
                    )}
                    <ol className="space-y-1">
                        {keyParts.map((s, i) => (
                            <li key={i} className="flex items-center gap-2 text-[11px]">
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: topicColor[(s.topics || [])[0]] || '#cbd5e1' }} />
                                <span className="font-mono font-bold text-slate-500 w-[74px] shrink-0">{s.time ? s.time.split('–')[0] : (s.slides && s.slides.length ? `Slide ${s.slides[0]}` : `Part ${i + 1}`)}</span>
                                <span className="font-bold text-slate-800 truncate" title={s.description || s.title}>{s.title}</span>
                            </li>
                        ))}
                    </ol>
                    {segments.length > 4 && (
                        <button type="button" onClick={() => setShowParts(v => !v)} className="text-[11px] font-bold text-[#c2410c] flex items-center gap-1 cursor-pointer">
                            {showParts ? <><ChevronUp size={12} /> Less</> : <><ChevronDown size={12} /> All {segments.length} parts</>}
                        </button>
                    )}
                </div>
            )}

            {/* Topics */}
            {topics.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {topics.map((t, i) => {
                        const Icon = SOURCE_ICON[t.source] || FileText;
                        const off = excludedSet.has(t.name);
                        return (
                            <button key={i} type="button" disabled={!onToggleTopic} onClick={() => onToggleTopic && onToggleTopic(t.name)}
                                title={`${SOURCE_TITLE[t.source] || ''}${t.share ? ` · ${t.share}% of the lecture` : ''}${onToggleTopic ? (off ? ' · tap to include' : ' · tap to leave out of the quiz') : ''}`}
                                className={`text-[11px] font-bold px-2.5 py-1 rounded-full border flex items-center gap-1.5 transition-colors ${off ? 'bg-slate-100 text-slate-400 line-through border-slate-200' : 'bg-white text-slate-800 border-orange-200 hover:border-orange-400'} ${onToggleTopic ? 'cursor-pointer' : 'cursor-default'}`}>
                                <span className="w-2 h-2 rounded-full" style={{ background: off ? '#cbd5e1' : topicColor[t.name] }} />
                                {t.name}
                                {t.share ? <span className="text-slate-400 font-medium">{t.share}%</span> : null}
                                <Icon size={10} className="text-slate-400" />
                            </button>
                        );
                    })}
                </div>
            )}

            {Array.isArray(model.contradictions) && model.contradictions.length > 0 && (
                <p className="text-[11px] text-amber-900 flex gap-1.5"><AlertTriangle size={12} className="shrink-0 mt-0.5" />Slides and speech disagree: {model.contradictions[0].note}</p>
            )}

            {/* Capacity */}
            {cap && (
                <p className="text-[11px] text-slate-700 flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 border-t border-orange-200/60">
                    <span className="font-black text-slate-900">Up to {cap.total} questions</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />{cap.easy} easy</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" />{cap.medium} medium</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500" />{cap.hard} hard</span>
                </p>
            )}
        </div>
    );
}
