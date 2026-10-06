import { X, Award, AlertTriangle, CheckCircle, Lightbulb, Zap, BookOpen, Check, Tag } from 'lucide-react';

export default function TeachingScoreModal({
    isOpen,
    onClose,
    lectureDepth,
    detectedFocus = [],
    whatWasTaught = '',
    recommendedQuestions = '',
    recommendedQuestionCount = null,
    onApplyQuestionCount = null
}) {
    if (!isOpen) return null;

    const score = lectureDepth?.score ?? 0;
    const rating = lectureDepth?.rating || 'Developing';
    const breakdown = lectureDepth?.breakdown || {};
    const earnedRubric = breakdown.earnedRubric || [];
    const deductions = breakdown.deductions || [];
    const totalLostPoints = breakdown.totalLostPoints ?? Math.max(0, 100 - score);
    const coveredAspects = breakdown.coveredAspects || [];
    const missingAspects = breakdown.missingAspects || [];
    const actionableTips = breakdown.actionableTips || [];
    const recCount = recommendedQuestionCount || breakdown.recommendedQuestionCount || 5;

    const getRatingBadge = (r, s) => {
        if (s >= 80) {
            return {
                bg: 'bg-emerald-50',
                border: 'border-emerald-200',
                text: 'text-emerald-800',
                label: 'Comprehensive / Exemplary',
                desc: 'Thorough coverage across conceptual definitions, causal reasoning, worked traces, and procedures.'
            };
        }
        if (s >= 65) {
            return {
                bg: 'bg-blue-50',
                border: 'border-blue-200',
                text: 'text-blue-800',
                label: 'Proficient / Substantive',
                desc: 'Solid collegiate depth covering core topics, with opportunity for deeper causal reasoning or traces.'
            };
        }
        if (s >= 50) {
            return {
                bg: 'bg-amber-50',
                border: 'border-amber-200',
                text: 'text-amber-800',
                label: 'Developing / Foundational',
                desc: 'Covers core concepts briefly. Recommended to include worked examples and step-by-step sequencing.'
            };
        }
        return {
            bg: 'bg-rose-50',
            border: 'border-rose-200',
            text: 'text-rose-800',
            label: 'Introductory / Brief',
            desc: 'Limited assessable content detected. Elaborate on definitions, causal invariants, and mechanisms.'
        };
    };

    const ratingInfo = getRatingBadge(rating, score);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div 
                className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-5 bg-gradient-to-r from-orange-50 via-amber-50 to-white border-b border-orange-200/70 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-600 shadow-xs">
                            <Award size={22} />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                                <span>Teaching Depth Rubric & Score Breakdown</span>
                            </h2>
                            <p className="text-xs text-slate-500 font-medium">
                                Objective collegiate rubric measuring definitions, reasoning, examples, and procedural progression.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                        title="Close Modal"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body Content */}
                <div className="p-6 overflow-y-auto space-y-6 text-slate-800">
                    
                    {/* Hero Score Gauge */}
                    <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl p-5 shadow-md flex flex-col sm:flex-row items-center justify-between gap-5">
                        <div className="flex items-center gap-5">
                            <div className="relative w-20 h-20 rounded-full border-4 border-orange-500/30 flex items-center justify-center bg-slate-900/80 shadow-inner">
                                <div className="text-center">
                                    <span className="text-2xl font-black text-white">{score}</span>
                                    <span className="text-[10px] block font-mono text-orange-400">/ 100</span>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${ratingInfo.bg} ${ratingInfo.text} ${ratingInfo.border}`}>
                                    {ratingInfo.label}
                                </span>
                                <h3 className="text-sm font-bold text-slate-100">
                                    Teaching Depth Score
                                </h3>
                                <p className="text-xs text-slate-300 max-w-md leading-relaxed">
                                    {ratingInfo.desc}
                                </p>
                            </div>
                        </div>

                        <div className="flex sm:flex-col gap-3 shrink-0 text-center sm:text-right border-t sm:border-t-0 sm:border-l border-white/10 pt-3 sm:pt-0 sm:pl-5">
                            <div>
                                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Earned</p>
                                <p className="text-lg font-black text-emerald-400">+{score} pts</p>
                            </div>
                            <div>
                                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Deductions</p>
                                <p className="text-lg font-black text-rose-400">-{totalLostPoints} pts</p>
                            </div>
                        </div>
                    </div>

                    {/* Section 1: Why Was The Score Not 100? (Deductions Breakdown) */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-rose-500" />
                                Why was the score not 100? ({deductions.length} Rubric Deduction{deductions.length === 1 ? '' : 's'})
                            </h4>
                            <span className="text-[11px] font-mono font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                                Total lost: -{totalLostPoints} points
                            </span>
                        </div>

                        {deductions.length === 0 ? (
                            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-3">
                                <CheckCircle className="text-emerald-600 shrink-0" size={24} />
                                <div>
                                    <p className="font-bold text-sm">Flawless 100/100 Teaching Depth Score!</p>
                                    <p className="text-xs text-emerald-700">Zero deductions. Every pedagogical criterion (definitions, causal invariants, worked traces, procedural sequencing) is fully demonstrated.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-2.5">
                                {deductions.map((d, idx) => (
                                    <div key={idx} className="p-4 rounded-2xl bg-white border-2 border-rose-100 hover:border-rose-200 shadow-xs transition-all space-y-2">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-center gap-2">
                                                <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                                                    {idx + 1}
                                                </span>
                                                <h5 className="font-bold text-xs text-slate-900">
                                                    {d.factor}
                                                </h5>
                                            </div>
                                            <span className="px-2 py-0.5 rounded-lg bg-rose-100 text-rose-700 font-black text-xs shrink-0">
                                                -{d.lostPoints} pts
                                            </span>
                                        </div>

                                        <p className="text-xs text-slate-600 pl-7 leading-relaxed">
                                            <strong className="text-slate-800">Reason:</strong> {d.reason}
                                        </p>

                                        {d.actionableTip && (
                                            <div className="ml-7 p-2.5 rounded-xl bg-amber-50/80 border border-amber-200/70 flex items-start gap-2 text-xs text-amber-900">
                                                <Lightbulb size={14} className="text-amber-600 shrink-0 mt-0.5" />
                                                <span>
                                                    <strong className="font-bold">How to earn back these points:</strong> {d.actionableTip}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Section 2: Earned Rubric Breakdown */}
                    <div className="space-y-3">
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            Rubric Criteria Performance ({earnedRubric.length} Dimensions)
                        </h4>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {earnedRubric.map((r, i) => {
                                const pct = Math.round((r.earned / r.max) * 100);
                                const isFull = r.earned === r.max;
                                return (
                                    <div key={i} className={`p-3.5 rounded-2xl border ${isFull ? 'bg-emerald-50/40 border-emerald-200' : 'bg-slate-50 border-slate-200'} space-y-2`}>
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="font-bold text-slate-800">{r.category}</span>
                                            <span className={`font-mono font-black ${isFull ? 'text-emerald-700' : 'text-slate-600'}`}>
                                                {r.earned}/{r.max} pts
                                            </span>
                                        </div>
                                        <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                            <div 
                                                className={`h-full rounded-full transition-all duration-500 ${isFull ? 'bg-emerald-500' : 'bg-orange-500'}`}
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                        <p className="text-[11px] text-slate-600 leading-snug">
                                            {r.description}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Section 3: Covered vs Missing Aspects */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* What was covered */}
                        <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200 space-y-2">
                            <p className="text-xs font-black text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                                <CheckCircle size={15} className="text-emerald-600" />
                                What was covered well
                            </p>
                            <ul className="space-y-1.5 text-xs text-emerald-950">
                                {coveredAspects.length > 0 ? (
                                    coveredAspects.map((aspect, i) => (
                                        <li key={i} className="flex items-start gap-1.5">
                                            <Check size={14} className="text-emerald-600 font-bold shrink-0 stroke-[2.5] mt-0.5" />
                                            <span>{aspect}</span>
                                        </li>
                                    ))
                                ) : (
                                    <li className="text-slate-500 italic">No strong pedagogical aspects identified yet.</li>
                                )}
                            </ul>
                        </div>

                        {/* What was missing */}
                        <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200 space-y-2">
                            <p className="text-xs font-black text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                                <AlertTriangle size={15} className="text-amber-600" />
                                What could be expanded
                            </p>
                            <ul className="space-y-1.5 text-xs text-amber-950">
                                {missingAspects.length > 0 ? (
                                    missingAspects.map((aspect, i) => (
                                        <li key={i} className="flex items-start gap-1.5">
                                            <span className="text-amber-600 font-bold shrink-0">•</span>
                                            <span>{aspect}</span>
                                        </li>
                                    ))
                                ) : (
                                    <li className="text-emerald-700 font-semibold">Everything is thoroughly covered!</li>
                                )}
                            </ul>
                        </div>
                    </div>

                    {/* Section 4: What Was Taught & Key Concepts */}
                    {(whatWasTaught || (detectedFocus && detectedFocus.length > 0)) && (
                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                            <p className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                                <BookOpen size={15} className="text-orange-600" />
                                What Was Taught (Pedagogical Extraction)
                            </p>
                            {whatWasTaught && (
                                <p className="text-xs text-slate-700 leading-relaxed font-medium">
                                    {whatWasTaught}
                                </p>
                            )}
                            {detectedFocus && detectedFocus.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                    {detectedFocus.map((concept, i) => (
                                        <span key={i} className="text-[11px] font-bold bg-white text-slate-800 border border-slate-200 px-2.5 py-1 rounded-full shadow-2xs inline-flex items-center gap-1.5">
                                            <Tag size={12} className="text-orange-600 shrink-0" />
                                            <span>{concept}</span>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Section 5: Recommended Questions Banner */}
                    <div className="p-4 rounded-2xl bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-orange-500/5 border-2 border-orange-300 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
                        <div className="space-y-0.5 text-center sm:text-left">
                            <p className="text-[10px] font-black uppercase tracking-wider text-orange-900 flex items-center justify-center sm:justify-start gap-1.5">
                                <Zap size={14} className="text-orange-600 fill-orange-500" />
                                Pedagogically Recommended Question Count
                            </p>
                            <p className="text-xs font-bold text-slate-900">
                                {recommendedQuestions || `${recCount} Questions (Optimal evidence balance)`}
                            </p>
                        </div>
                        {onApplyQuestionCount && (
                            <button
                                type="button"
                                onClick={() => {
                                    onApplyQuestionCount(recCount);
                                    onClose();
                                }}
                                className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer shrink-0"
                            >
                                <Zap size={14} />
                                Apply {recCount} Questions
                            </button>
                        )}
                    </div>
                </div>

                {/* Modal Footer */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                    <p className="text-[11px] text-slate-500">
                        Evaluated by <strong>Agent 3 Multimodal Grounding Engine</strong>
                    </p>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer active:scale-95"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
