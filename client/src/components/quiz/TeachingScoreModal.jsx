import { X, Award, AlertTriangle, CheckCircle, Lightbulb, Zap, BookOpen, Check, Tag, Quote, Sparkles } from 'lucide-react';

export default function TeachingScoreModal({
    isOpen,
    onClose,
    lectureDepth,
    detectedFocus = [],
    whatWasTaught = '',
    recommendedQuestions = '',
    recommendedQuestionCount = null,
    onApplyQuestionCount = null,
    lectureIntel = null
}) {
    if (!isOpen) return null;

    // 1. Extract signals from lecture depth and lecture intelligence
    const chars = lectureDepth?.characteristics || {};
    const critique = lectureIntel?.pedagogicalCritique || {};
    const chapters = lectureIntel?.chapters || [];
    const evidenceQuotes = critique?.evidenceQuotes || [];

    // 2. Compute 4 Pedagogical Rings (0 - 25 pts each = 100 max)
    // Ring 1: Conceptual Framing & Precision (0 - 25)
    let ring1 = 14;
    if (chars.conceptExplanation === 'Strong') ring1 = 25;
    else if (chars.conceptExplanation === 'Moderate') ring1 = 19;
    else if (detectedFocus.length >= 3) ring1 = 22;
    else if (detectedFocus.length >= 1) ring1 = 17;
    if (lectureDepth?.rating === 'Non-Academic') ring1 = 3;

    // Ring 2: Analytical & Causal Rigor (0 - 25)
    let ring2 = 12;
    if (chars.reasoning === 'Strong') ring2 = 25;
    else if (chars.reasoning === 'Moderate') ring2 = 18;
    else if (critique?.reasoningDepth?.includes('INVARIANT_AND_CAUSAL')) ring2 = 23;
    else if (critique?.reasoningDepth?.includes('MOTIVATION_PROVIDED')) ring2 = 17;
    if (lectureDepth?.rating === 'Non-Academic') ring2 = 2;

    // Ring 3: Illustrative Scaffolding & Traces (0 - 25)
    let ring3 = 12;
    if (chars.examples === 'Present' || critique?.practicalDemonstrations?.includes('WORKED_TRACE_OR_CODE')) ring3 = 25;
    else if (critique?.practicalDemonstrations?.includes('CONCEPTUAL_ANALOGY')) ring3 = 19;
    else if (chars.examples === 'None') ring3 = 13;
    if (lectureDepth?.rating === 'Non-Academic') ring3 = 2;

    // Ring 4: Curricular Cohesion & Pacing (0 - 25)
    let ring4 = 14;
    if (chars.procedures === 'Strong' || chapters.length >= 2) ring4 = 25;
    else if (chars.procedures === 'Moderate' || chapters.length === 1) ring4 = 19;
    if (lectureDepth?.rating === 'Non-Academic') ring4 = 3;

    const idiScore = Math.min(100, Math.max(10, ring1 + ring2 + ring3 + ring4));

    // Secret Sauce Quote: The teacher's verbatim best explanation
    const highlightQuote = (evidenceQuotes && evidenceQuotes.length > 0 && evidenceQuotes[0].length > 15)
        ? evidenceQuotes[0]
        : null;

    const breakdown = lectureDepth?.breakdown || {};
    const coveredAspects = breakdown.coveredAspects || [];
    const missingAspects = breakdown.missingAspects || [];
    const actionableTips = breakdown.actionableTips || [];
    const recCount = recommendedQuestionCount || breakdown.recommendedQuestionCount || 5;

    const getProfileBadge = (s) => {
        if (s >= 82) {
            return {
                bg: 'bg-emerald-50',
                border: 'border-emerald-200',
                text: 'text-emerald-800',
                label: 'Exemplary Collegiate Delivery',
                desc: 'Comprehensive coverage across conceptual definitions, analytical reasoning, illustrative traces, and sequential pacing.'
            };
        }
        if (s >= 68) {
            return {
                bg: 'bg-blue-50',
                border: 'border-blue-200',
                text: 'text-blue-800',
                label: 'Substantive & Engaging',
                desc: 'Solid instructional depth covering core syllabus topics with clear definitions and structured flow.'
            };
        }
        if (s >= 50) {
            return {
                bg: 'bg-amber-50',
                border: 'border-amber-200',
                text: 'text-amber-800',
                label: 'Foundational Delivery',
                desc: 'Covers core principles clearly. Consider expanding on practical traces and causal invariants.'
            };
        }
        return {
            bg: 'bg-rose-50',
            border: 'border-rose-200',
            text: 'text-rose-800',
            label: 'Introductory / Brief',
            desc: 'Brief instructional material. Elaborate on operational mechanisms to support higher question capacity.'
        };
    };

    const profileInfo = getProfileBadge(idiScore);

    return (
        <div className="modal-overlay">
            <div className="modal-backdrop" onClick={onClose} />
            <div 
                className="modal-card w-full max-w-3xl animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="modal-header bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white border-b border-white/10 p-5 rounded-t-3xl">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-orange-400 shadow-xs">
                            <Award size={22} />
                        </div>
                        <div>
                            <h2 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                                <span>Instructional Delivery & Assessment Digest</span>
                            </h2>
                            <p className="text-xs text-slate-300 font-medium">
                                Objective pedagogical observation measuring conceptual framing, analytical depth, scaffolding, and pacing.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                        title="Close Modal"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body Content */}
                <div className="modal-body p-6 space-y-6 text-slate-800 max-h-[80vh] overflow-y-auto">
                    
                    {/* Hero Section: Instructional Delivery Index */}
                    <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl p-5 shadow-md flex flex-col sm:flex-row items-center justify-between gap-5 border border-white/10">
                        <div className="flex items-center gap-5">
                            <div className="relative w-20 h-20 rounded-full border-4 border-orange-500/40 flex items-center justify-center bg-slate-950/80 shadow-inner shrink-0">
                                <div className="text-center">
                                    <span className="text-2xl font-black text-white">{idiScore}</span>
                                    <span className="text-[10px] block font-mono text-orange-400">/ 100</span>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${profileInfo.bg} ${profileInfo.text} ${profileInfo.border}`}>
                                    {profileInfo.label}
                                </span>
                                <h3 className="text-sm font-bold text-slate-100">
                                    Instructional Delivery Index
                                </h3>
                                <p className="text-xs text-slate-300 max-w-md leading-relaxed">
                                    {profileInfo.desc}
                                </p>
                            </div>
                        </div>

                        <div className="text-center sm:text-right border-t sm:border-t-0 sm:border-l border-white/10 pt-3 sm:pt-0 sm:pl-5 shrink-0">
                            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Defensible MCQs</p>
                            <p className="text-lg font-black text-emerald-400">{recCount} Questions</p>
                            <span className="text-[10px] text-slate-400 font-mono">Balanced Bloom Depth</span>
                        </div>
                    </div>

                    {/* Section 1: The 4 Pedagogical Rings */}
                    <div className="space-y-3">
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                            <Sparkles size={14} className="text-orange-600" />
                            Pedagogical Delivery Dimensions (4 Core Pillars)
                        </h4>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* Ring 1 */}
                            <div className="p-3.5 rounded-2xl bg-white border-2 border-slate-100 hover:border-slate-200 shadow-2xs space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                                        <span>🏛️ Conceptual Framing & Precision</span>
                                    </span>
                                    <span className="font-mono font-black text-orange-600">{ring1} / 25</span>
                                </div>
                                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full bg-orange-500 transition-all duration-500" style={{ width: `${(ring1 / 25) * 100}%` }} />
                                </div>
                                <p className="text-[11px] text-slate-500 leading-snug">
                                    {ring1 >= 22 ? 'Comprehensive definitions and clear terminology grounding.' : 'Core concepts introduced; opportunities for deeper definitions.'}
                                </p>
                            </div>

                            {/* Ring 2 */}
                            <div className="p-3.5 rounded-2xl bg-white border-2 border-slate-100 hover:border-slate-200 shadow-2xs space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                                        <span>🔬 Analytical & Causal Rigor</span>
                                    </span>
                                    <span className="font-mono font-black text-indigo-600">{ring2} / 25</span>
                                </div>
                                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full bg-indigo-500 transition-all duration-500" style={{ width: `${(ring2 / 25) * 100}%` }} />
                                </div>
                                <p className="text-[11px] text-slate-500 leading-snug">
                                    {ring2 >= 22 ? 'Explicit causal explanations of why rules and invariants apply.' : 'Foundational mechanisms explained; causal links can be deepened.'}
                                </p>
                            </div>

                            {/* Ring 3 */}
                            <div className="p-3.5 rounded-2xl bg-white border-2 border-slate-100 hover:border-slate-200 shadow-2xs space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                                        <span>🛠️ Illustrative Scaffolding & Traces</span>
                                    </span>
                                    <span className="font-mono font-black text-emerald-600">{ring3} / 25</span>
                                </div>
                                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${(ring3 / 25) * 100}%` }} />
                                </div>
                                <p className="text-[11px] text-slate-500 leading-snug">
                                    {ring3 >= 22 ? 'Practical code traces, queries, or worked examples demonstrated.' : 'Theory explained; adding sample traces enables scenario MCQs.'}
                                </p>
                            </div>

                            {/* Ring 4 */}
                            <div className="p-3.5 rounded-2xl bg-white border-2 border-slate-100 hover:border-slate-200 shadow-2xs space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                                        <span>📐 Curricular Cohesion & Pacing</span>
                                    </span>
                                    <span className="font-mono font-black text-blue-600">{ring4} / 25</span>
                                </div>
                                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full bg-blue-500 transition-all duration-500" style={{ width: `${(ring4 / 25) * 100}%` }} />
                                </div>
                                <p className="text-[11px] text-slate-500 leading-snug">
                                    {ring4 >= 22 ? 'Multi-phase sequential pacing across cohesive lecture chapters.' : 'Single-block flow; structured transitions enhance pacing.'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Section 2: The Secret Sauce Quote Spotlight */}
                    {highlightQuote && (
                        <div className="p-4.5 rounded-2xl bg-amber-50/80 border-2 border-amber-200/80 shadow-2xs space-y-2">
                            <div className="flex items-center gap-2 text-amber-900 font-black text-xs uppercase tracking-wider">
                                <Quote size={16} className="text-amber-600 shrink-0" />
                                <span>Notable Pedagogical Highlight</span>
                            </div>
                            <blockquote className="text-xs font-semibold text-slate-800 italic pl-3 border-l-2 border-amber-400 leading-relaxed">
                                &ldquo;{highlightQuote}&rdquo;
                            </blockquote>
                            <p className="text-[10px] text-amber-700 font-medium pt-0.5">
                                An authentic moment of instructional clarity extracted directly from your spoken lecture narrative.
                            </p>
                        </div>
                    )}

                    {/* Section 3: Personalized Instructional Observations */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-2">
                            <p className="text-xs font-black text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                                <CheckCircle size={15} className="text-emerald-600" />
                                Demonstrated Instructional Strengths
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
                                    <li className="text-slate-500 italic">Core syllabus concepts clearly communicated.</li>
                                )}
                            </ul>
                        </div>

                        <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200 space-y-2">
                            <p className="text-xs font-black text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                                <Lightbulb size={15} className="text-blue-600" />
                                Pedagogical Opportunities for Quiz Depth
                            </p>
                            <ul className="space-y-1.5 text-xs text-blue-950">
                                {actionableTips.length > 0 ? (
                                    actionableTips.slice(0, 2).map((tip, i) => (
                                        <li key={i} className="flex items-start gap-1.5">
                                            <span className="text-blue-600 font-bold shrink-0">•</span>
                                            <span>{tip}</span>
                                        </li>
                                    ))
                                ) : (
                                    <li className="text-emerald-700 font-semibold">Thoroughly substantiated across all core assessment dimensions.</li>
                                )}
                            </ul>
                        </div>
                    </div>

                    {/* Section 4: What Was Taught & Key Concepts */}
                    {(whatWasTaught || (detectedFocus && detectedFocus.length > 0)) && (
                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                            <p className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                                <BookOpen size={15} className="text-orange-600" />
                                Instructional Topics Recognized
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

                    {/* Section 5: Recommended Questions Action Banner */}
                    <div className="p-4 rounded-2xl bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-orange-500/5 border-2 border-orange-300 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
                        <div className="space-y-0.5 text-center sm:text-left">
                            <p className="text-[10px] font-black uppercase tracking-wider text-orange-900 flex items-center justify-center sm:justify-start gap-1.5">
                                <Zap size={14} className="text-orange-600 fill-orange-500" />
                                Defensible Assessment Quota
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
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between rounded-b-3xl">
                    <p className="text-[11px] text-slate-500">
                        Derived from <strong>Lecture Intelligence Evidence Grounding</strong>
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
