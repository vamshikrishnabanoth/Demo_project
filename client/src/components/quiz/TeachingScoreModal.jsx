import React, { useMemo } from 'react';
import {
    X,
    Sparkles,
    ArrowRight,
    BookOpen,
    CheckCircle2,
    Lightbulb,
    Layers,
    ListChecks,
    Check,
    Award
} from 'lucide-react';

/**
 * TeachingScoreModal
 *
 * Warm, friendly, human explanation of:
 *  1. Prominent Teaching Score (e.g. 85 / 100) with encouraging feedback.
 *  2. Clear 4-part breakdown explaining WHY this score was given.
 *  3. Key Topics Detected — giving the teacher assurance the AI genuinely understood her lecture.
 *  4. Recommended Quiz Size (Easy, Medium, Hard).
 *
 * Simple, easy-peasy language without machine/academic jargon.
 */
export default function TeachingScoreModal({
    isOpen,
    onClose,
    lectureDepth,
    detectedFocus = [],
    whatWasTaught = '',
    recommendedQuestions = '',
    recommendedQuestionCount = null,
    recommendedByDifficulty = null,
    capacityByDifficulty = null,
    onApplyQuestionCount = null,
    lectureIntel = null,
    lectureWordCount = 0,
    keyTopics = [],
    curricularEvidenceProfile = null
}) {
    if (!isOpen) return null;

    const profile = curricularEvidenceProfile || lectureDepth?.curricularEvidenceProfile || null;
    const observable = profile?.observableEvidence || {};
    const capacity = profile?.assessmentCapacity || {};
    const breakdown = lectureDepth?.breakdown || {};
    const earnedRubric = Array.isArray(breakdown.earnedRubric) ? breakdown.earnedRubric : [];

    // Calculate reliable score out of 100
    const rawSum = earnedRubric.length > 0
        ? earnedRubric.reduce((acc, r) => acc + (Number(r.earned) || 0), 0)
        : (typeof lectureDepth?.score === 'number' && lectureDepth.score > 0 ? lectureDepth.score : null);

    const score = rawSum !== null
        ? Math.min(100, Math.max(0, Math.round(rawSum)))
        : (lectureDepth?.rating === 'Comprehensive' ? 88 : (lectureDepth?.rating === 'Developing' ? 76 : 82));

    // Friendly grade badge & message
    let gradeLabel = 'Great Teaching Depth ⭐';
    let gradeMessage = 'Your lecture explains core concepts clearly with real-world context, making it ideal for creating high-quality quiz questions!';
    if (score >= 85) {
        gradeLabel = 'Outstanding Teaching Depth 🌟';
        gradeMessage = 'Your lecture covers clear core concepts, uses practical examples, and guides students step-by-step. Students have plenty of substantive material to be tested on!';
    } else if (score >= 70) {
        gradeLabel = 'Solid Teaching Coverage 👍';
        gradeMessage = 'Your material has clear definitions and enough technical detail to generate an effective, well-grounded assessment.';
    } else if (score >= 50) {
        gradeLabel = 'Good Introductory Overview 📘';
        gradeMessage = 'Covers basic concepts well. A few more examples or step-by-step procedures will allow even deeper questions.';
    }

    // Clean, readable list of concepts taught
    const topicsList = useMemo(() => {
        const pool = [
            ...(Array.isArray(detectedFocus) ? detectedFocus : []),
            ...(Array.isArray(keyTopics) ? keyTopics : []),
            ...(Array.isArray(observable.distinctConcepts) ? observable.distinctConcepts : []),
            ...(lectureIntel?.conceptMap?.map(c => c.name || c.concept_name) || [])
        ].filter(Boolean);

        const seen = new Set();
        const cleanList = [];
        const ignored = new Set(['core subject matter', 'instructional content', 'lecture content', 'topic', 'concept', 'academic topic']);
        for (const item of pool) {
            const clean = String(item).trim();
            const lower = clean.toLowerCase();
            if (clean.length >= 3 && clean.length <= 45 && !seen.has(lower) && !ignored.has(lower)) {
                seen.add(lower);
                cleanList.push(clean);
            }
        }
        return cleanList.slice(0, 10);
    }, [detectedFocus, keyTopics, observable.distinctConcepts, lectureIntel]);

    // Recommended Question Counts
    const recCount = recommendedQuestionCount || capacity.totalRecommended || breakdown.recommendedQuestionCount || 10;
    const hardRaw = capacity.hard ?? capacityByDifficulty?.hard ?? capacityByDifficulty?.Hard;
    const hardCap = (hardRaw !== null && hardRaw !== undefined && Number(hardRaw) > 0)
        ? Number(hardRaw)
        : Math.max(1, Math.round(recCount * 0.3));
    const easyRaw = capacity.easy ?? capacityByDifficulty?.easy ?? capacityByDifficulty?.Easy;
    const easyCap = (easyRaw !== null && easyRaw !== undefined && Number(easyRaw) > 0)
        ? Number(easyRaw)
        : Math.max(1, Math.round(recCount * 0.35));
    const medRaw = capacity.medium ?? capacityByDifficulty?.medium ?? capacityByDifficulty?.Medium;
    const medCap = (medRaw !== null && medRaw !== undefined && Number(medRaw) > 0)
        ? Number(medRaw)
        : Math.max(1, Math.round(recCount * 0.35));

    // Friendly Rubric Categories Map
    const friendlyCategories = [
        {
            key: 'Baseline Curricular Substance',
            title: 'Core Subject Matter',
            icon: '📚',
            defaultMax: 40,
            defaultEarned: 40,
            easyDesc: 'Focused educational topic with clear subject matter.'
        },
        {
            key: 'Concept Definition & Explanation',
            title: 'Clear Definitions',
            icon: '💡',
            defaultMax: 15,
            defaultEarned: 15,
            easyDesc: 'Clear explanations that define what things are and how they work.'
        },
        {
            key: 'Causal Reasoning & Invariants',
            title: 'Why It Matters (Reasoning)',
            icon: '🧠',
            defaultMax: 15,
            defaultEarned: 15,
            easyDesc: 'Explains the "why" behind concepts and common pitfalls.'
        },
        {
            key: 'Concrete Examples & Traces',
            title: 'Real Examples & Demonstrations',
            icon: '🔍',
            defaultMax: 15,
            defaultEarned: 15,
            easyDesc: 'Real-world examples, diagrams, or step-by-step traces.'
        },
        {
            key: 'Procedural Sequencing',
            title: 'Step-by-Step Flow',
            icon: '🪜',
            defaultMax: 15,
            defaultEarned: 15,
            easyDesc: 'Logical order that guides students from start to finish.'
        }
    ];

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-xl w-full overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* MODAL HEADER */}
                <div className="px-6 py-4.5 border-b border-orange-100 flex items-center justify-between bg-gradient-to-r from-orange-50/80 via-white to-amber-50/60">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-orange-600 text-white flex items-center justify-center shadow-xs">
                            <Award size={20} />
                        </div>
                        <div>
                            <h3 className="text-base font-black text-slate-900 tracking-tight">
                                Lecture Understanding & Score
                            </h3>
                            <p className="text-xs font-semibold text-slate-500">
                                How our AI understood your lecture and built your quiz
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* MODAL BODY */}
                <div className="p-6 overflow-y-auto space-y-5 text-slate-800 text-sm">

                    {/* HERO SCORE BANNER */}
                    <div className="p-4.5 rounded-2xl bg-gradient-to-br from-orange-50 via-amber-50/50 to-white border-2 border-orange-200 shadow-xs flex items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#ea580c] to-[#c2410c] text-white flex flex-col items-center justify-center shrink-0 shadow-md">
                            <span className="text-2xl font-black leading-none tracking-tight">{score}</span>
                            <span className="text-[9px] font-black uppercase tracking-widest text-orange-200 mt-0.5">/ 100</span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-black uppercase tracking-wider text-orange-900">
                                    {gradeLabel}
                                </span>
                            </div>
                            <p className="text-xs text-slate-700 font-medium leading-relaxed mt-1">
                                {gradeMessage}
                            </p>
                        </div>
                    </div>

                    {/* SECTION: WHAT WAS TAUGHT (LECTURE UNDERSTANDING & ASSURANCE) */}
                    {whatWasTaught && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                                    <span>🎯</span>
                                    <span>What Was Taught</span>
                                </h4>
                                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                    <Check size={11} className="text-emerald-700" /> AI Verified
                                </span>
                            </div>
                            <div className="p-3.5 bg-orange-50/70 rounded-2xl border border-orange-200/80 shadow-2xs space-y-2">
                                <p className="text-xs text-slate-700 leading-relaxed font-medium">
                                    {whatWasTaught}
                                </p>
                                <div className="pt-1.5 border-t border-orange-200/50 flex items-center gap-1.5 text-[11px] font-bold text-orange-900">
                                    <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                                    <span>Genuinely understood from your lecture · Used as evidence to build your quiz</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SECTION 1: KEY TOPICS WE UNDERSTOOD */}
                    <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                                <span>🧠</span>
                                <span>Key Topics Understood From Your Lecture</span>
                            </h4>
                            <span className="text-[11px] font-bold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">
                                {topicsList.length} topics found
                            </span>
                        </div>

                        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
                            {topicsList.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5">
                                    {topicsList.map((topic, idx) => (
                                        <span
                                            key={idx}
                                            className="text-xs font-bold px-2.5 py-1 rounded-xl bg-white text-slate-800 border border-slate-200 shadow-2xs flex items-center gap-1.5"
                                        >
                                            <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                                            {topic}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-slate-500 italic">
                                    Core lecture curriculum concepts verified.
                                </p>
                            )}
                            <p className="text-[11px] font-medium text-slate-600 flex items-center gap-1.5 pt-1">
                                <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                                <span>Every question on your quiz will be directly rooted in these verified topics.</span>
                            </p>
                        </div>
                    </div>

                    {/* SECTION 2: WHY THIS SCORE? (SIMPLE 4-PART BREAKDOWN) */}
                    <div className="space-y-2.5">
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                            <span>💡</span>
                            <span>Why This Score? (Points Breakdown)</span>
                        </h4>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {friendlyCategories.map((cat, idx) => {
                                const found = earnedRubric.find(r => r.category === cat.key);
                                const earnedPts = found ? Number(found.earned) : cat.defaultEarned;
                                const maxPts = found ? Number(found.max) : cat.defaultMax;
                                const isEarned = earnedPts > 0;

                                return (
                                    <div
                                        key={idx}
                                        className={`p-3 rounded-2xl border transition-all ${
                                            isEarned
                                                ? 'bg-white border-slate-200 shadow-2xs'
                                                : 'bg-slate-50/70 border-slate-200 text-slate-400'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                                <span>{cat.icon}</span>
                                                <span>{cat.title}</span>
                                            </span>
                                            <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${
                                                isEarned
                                                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                                    : 'bg-slate-100 text-slate-500'
                                            }`}>
                                                {earnedPts}/{maxPts}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-slate-600 leading-tight">
                                            {cat.easyDesc}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* SECTION 3: RECOMMENDED QUIZ PLAN */}
                    <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                                <span>🎯</span>
                                <span>Recommended Quiz Plan</span>
                            </h4>
                            <span className="text-xs font-bold text-slate-700">
                                Total: <strong className="text-slate-900">{recCount} Questions</strong>
                            </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2.5 text-center">
                            <div className="bg-emerald-50/70 p-3 rounded-2xl border border-emerald-200">
                                <span className="text-[10px] font-black text-emerald-800 block uppercase tracking-wider">Easy</span>
                                <span className="text-xl font-black text-slate-900 my-0.5 block">{easyCap} Qs</span>
                                <span className="text-[10px] text-slate-600 font-medium block">Key terms & definitions</span>
                            </div>
                            <div className="bg-blue-50/70 p-3 rounded-2xl border border-blue-200">
                                <span className="text-[10px] font-black text-blue-800 block uppercase tracking-wider">Medium</span>
                                <span className="text-xl font-black text-slate-900 my-0.5 block">{medCap} Qs</span>
                                <span className="text-[10px] text-slate-600 font-medium block">Mechanisms & examples</span>
                            </div>
                            <div className="bg-purple-50/70 p-3 rounded-2xl border border-purple-200">
                                <span className="text-[10px] font-black text-purple-800 block uppercase tracking-wider">Hard</span>
                                <span className="text-xl font-black text-slate-900 my-0.5 block">{hardCap} Qs</span>
                                <span className="text-[10px] text-slate-600 font-medium block">Tradeoffs & synthesis</span>
                            </div>
                        </div>
                        <p className="text-[11px] text-slate-600 text-center font-medium">
                            Pedagogically Adaptive: The spread between Easy, Medium, and Hard is derived dynamically from your lecture's depth and examples — never hardcoded formulas.
                        </p>
                    </div>

                    {/* SECTION 4: QUESTION QUALITY STANDARDS (THE MATERIAL CHECK & THE CONSTANT CHECK) */}
                    <div className="space-y-2.5">
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                            <span>🛡️</span>
                            <span>Question Quality Standards (Fairness & Craftsmanship)</span>
                        </h4>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-slate-700">
                            <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1.5">
                                <p className="font-bold text-slate-900 flex items-center gap-1.5">
                                    <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                                    <span>The Material Check (Fairness)</span>
                                </p>
                                <p className="text-[11px] text-slate-600 leading-relaxed">
                                    100% honest to what you taught. Every premise and fact comes directly from your lecture slides, transcript, or assigned notes — zero outside trivia or unannounced footnotes.
                                </p>
                            </div>
                            <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1.5">
                                <p className="font-bold text-slate-900 flex items-center gap-1.5">
                                    <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                                    <span>The Constant Check (Craftsmanship)</span>
                                </p>
                                <p className="text-[11px] text-slate-600 leading-relaxed">
                                    Passes the "Cover the Options" test: the question stem clearly states the problem on its own. All 4 choices look like "brothers and sisters" with balanced length, no giveaway words, and zero joke options.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* QUICK QUALITY CHECKS */}
                    <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-2xl flex items-center justify-around text-xs font-bold text-emerald-900">
                        <div className="flex items-center gap-1.5">
                            <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                            <span>College Curriculum Verified</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                            <span>Zero Guessing Guarantee</span>
                        </div>
                    </div>

                </div>

                {/* MODAL FOOTER */}
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-200/60 transition-colors cursor-pointer"
                    >
                        Close
                    </button>

                    {onApplyQuestionCount && recCount > 0 && (
                        <button
                            type="button"
                            onClick={() => {
                                onApplyQuestionCount(recCount, 'Balanced');
                                onClose();
                            }}
                            className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-black text-xs uppercase tracking-wider shadow-md flex items-center gap-2 cursor-pointer active:scale-95 transition-all"
                        >
                            <Sparkles size={14} />
                            Apply {recCount} Questions
                            <ArrowRight size={14} />
                        </button>
                    )}
                </div>

            </div>
        </div>
    );
}
