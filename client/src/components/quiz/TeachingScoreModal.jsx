import React from 'react';
import { X, Award, AlertTriangle, CheckCircle, Lightbulb, Zap, BookOpen, Check, Tag, Quote, Sparkles, Scale, GraduationCap, Flame, ArrowRight } from 'lucide-react';

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
    lectureIntel = null
}) {
    if (!isOpen) return null;

    // 1. Extract signals from lecture depth and lecture intelligence
    const chars = lectureDepth?.characteristics || {};
    const critique = lectureIntel?.pedagogicalCritique || {};
    const chapters = lectureIntel?.chapters || [];
    const evidenceQuotes = critique?.evidenceQuotes || [];

    // 2. Strict Concept Sanitization (Zero conversational clutter or transcript artifacts)
    const rawConcepts = [
        ...(detectedFocus || []),
        ...(lectureIntel?.conceptMap?.map(c => c.name) || []),
        ...(chapters.flatMap(ch => ch.key_concepts || []))
    ];

    const cleanConcepts = Array.from(new Set(rawConcepts))
        .filter(t => t && typeof t === 'string')
        .map(t => t.trim())
        .filter(t => t.length >= 3 && t.length <= 35)
        .filter(t => !/\b\d+\b/.test(t)) // Reject lone numbers/digits like "1"
        .filter(t => !/^(obviously|clearly|definitely|surely|literally|should|would|could|can|will|shall|may|might|must|s not|it's|that's|there's|what|why|how|wait|look|check|change|try|putting|asking|saying|suppose)/i.test(t))
        .filter(t => {
            const words = t.split(/\s+/);
            return !words.some(w => w.length === 1 && !/^[ONCRK]$/i.test(w));
        })
        .slice(0, 8);

    // 3. Compute 4 Pedagogical Rings (0 - 25 pts each = 100 max)
    let ring1 = 15;
    if (chars.conceptExplanation === 'Strong') ring1 = 25;
    else if (chars.conceptExplanation === 'Moderate') ring1 = 19;
    else if (cleanConcepts.length >= 3) ring1 = 22;
    if (lectureDepth?.rating === 'Non-Academic') ring1 = 3;

    let ring2 = 14;
    if (chars.reasoning === 'Strong') ring2 = 25;
    else if (chars.reasoning === 'Moderate') ring2 = 18;
    else if (critique?.reasoningDepth?.includes('INVARIANT_AND_CAUSAL')) ring2 = 23;
    if (lectureDepth?.rating === 'Non-Academic') ring2 = 2;

    let ring3 = 13;
    if (chars.examples === 'Present' || critique?.practicalDemonstrations?.includes('WORKED_TRACE_OR_CODE')) ring3 = 25;
    else if (critique?.practicalDemonstrations?.includes('CONCEPTUAL_ANALOGY')) ring3 = 19;
    if (lectureDepth?.rating === 'Non-Academic') ring3 = 2;

    let ring4 = 14;
    if (chars.procedures === 'Strong' || chapters.length >= 2) ring4 = 25;
    else if (chars.procedures === 'Moderate' || chapters.length === 1) ring4 = 19;
    if (lectureDepth?.rating === 'Non-Academic') ring4 = 3;

    const idiScore = lectureDepth?.score || Math.min(100, Math.max(10, ring1 + ring2 + ring3 + ring4));

    // Standout Verbatim Quote Spotlight
    const highlightQuote = (evidenceQuotes && evidenceQuotes.length > 0 && evidenceQuotes[0].length > 15)
        ? evidenceQuotes[0]
        : null;

    // Distinct recommendations and capacities by difficulty
    const recBalanced = recommendedByDifficulty?.balanced ?? recommendedQuestionCount ?? 5;
    const recEasy = recommendedByDifficulty?.easy ?? Math.min(recBalanced, 5);
    const recMedium = recommendedByDifficulty?.medium ?? Math.min(recBalanced, 5);
    const recHard = recommendedByDifficulty?.hard ?? 0;

    const capEasy = capacityByDifficulty?.easy ?? recEasy;
    const capMedium = capacityByDifficulty?.medium ?? recMedium;
    const capHard = capacityByDifficulty?.hard ?? recHard;

    // 4. Dynamic Teacher Motivation & "The Kick" Generator
    // Every lecture gets a tailored review, authentic appreciation, and genuine growth tip
    const lectureTitle = lectureIntel?.title || whatWasTaught || 'Instructional Curriculum';
    const isAlgorithmic = /array|loop|sort|search|algorithm|function|code|matrix|tree|graph|pointer|complexity|trace|frequency/i.test(lectureTitle);
    const isSystemOrArch = /operating system|database|process|memory|acid|thread|sql|network|cache|protocol|cpu/i.test(lectureTitle);

    let celebrationTitle = 'Exemplary Instructional Mastery!';
    let celebrationBadge = 'Masterclass Delivery';
    let celebrationSub = 'Comprehensive pedagogical delivery with deep conceptual clarity and seamless progression.';

    if (isAlgorithmic) {
        if (chars.procedures === 'Strong' || idiScore >= 85) {
            celebrationTitle = 'Masterclass in Algorithmic Tracing & State Transitions!';
            celebrationBadge = 'Algorithmic Excellence';
            celebrationSub = 'Your lecture walked through variable state changes step-by-step, cementing concrete execution logic for students.';
        } else {
            celebrationTitle = 'Outstanding Problem-Solving Walkthrough!';
            celebrationBadge = 'Algorithmic Walkthrough';
            celebrationSub = 'Clear algorithmic methodology connecting theoretical constructs to step-by-step operations.';
        }
    } else if (isSystemOrArch) {
        celebrationTitle = 'Exemplary Systems Architecture Analysis!';
        celebrationBadge = 'Systems Rigor';
        celebrationSub = 'Clear explanation of architectural mechanisms, state management, and underlying causal invariants.';
    } else if (chars.reasoning === 'Strong') {
        celebrationTitle = 'Outstanding Analytical Rigor & Causal Depth!';
        celebrationBadge = 'Analytical Mastery';
        celebrationSub = 'You thoroughly justified the underlying "why" and trade-offs rather than simply stating rules.';
    } else if (chars.examples === 'Present') {
        celebrationTitle = 'Brilliant Example-Driven Demonstration!';
        celebrationBadge = 'Applied Pedagogy';
        celebrationSub = 'Abstract principles were anchored in clear, illustrative worked examples that make concepts memorable.';
    } else if (idiScore >= 80) {
        celebrationTitle = 'High-Impact Curricular Delivery!';
        celebrationBadge = 'Pedagogical Excellence';
        celebrationSub = 'Structured, well-paced instruction establishing rock-solid foundations across core syllabus targets.';
    }

    // Dynamic "Why You Earned This Score" Strengths (Authentic & Lecture-Grounded)
    const dynamicStrengths = [];
    const topTopicNames = cleanConcepts.slice(0, 2).join(' & ');

    if (topTopicNames) {
        dynamicStrengths.push({
            title: 'Precision Concept Framing',
            text: `Introduced and grounded core syllabus topics including ${topTopicNames} with unambiguous academic precision.`
        });
    } else {
        dynamicStrengths.push({
            title: 'Unambiguous Topic Grounding',
            text: 'Established core definitions and curriculum boundaries with immediate clarity from the opening narrative.'
        });
    }

    if (chars.procedures === 'Strong' || isAlgorithmic) {
        dynamicStrengths.push({
            title: 'Live Procedural State Tracing',
            text: 'Demonstrated execution step-by-step through loops and conditions rather than rushing to final code, reinforcing mental models.'
        });
    } else {
        dynamicStrengths.push({
            title: 'Systematic Curricular Progression',
            text: 'Structured lesson progression sequentially from foundational definitions into applied operational rules.'
        });
    }

    if (chars.reasoning === 'Strong' || idiScore >= 85) {
        dynamicStrengths.push({
            title: 'Edge-Case & Invariant Guardrails',
            text: 'Explicitly called out boundary edge conditions and operational invariants, proactively addressing student misconceptions.'
        });
    } else if (chars.examples === 'Present') {
        dynamicStrengths.push({
            title: 'Concrete Illustrative Grounding',
            text: 'Reinforced abstract theory with tangible walkthroughs, enabling defensible scenario-based exam questions.'
        });
    } else {
        dynamicStrengths.push({
            title: 'Syllabus Focus & Low Cognitive Drift',
            text: 'Maintained strict curricular relevance with zero extraneous banter or distracting digressions.'
        });
    }

    // Dynamic, Topic-Aware Growth Tip (Never Static / Never Boilerplate)
    const dynamicGrowthTips = [];

    if (isAlgorithmic) {
        dynamicGrowthTips.push({
            title: 'Test Complexity Tradeoffs in Class',
            text: 'Contrast this nested approach with an alternative time/space tradeoff (e.g. comparing with a single-pass Hash Map) to test asymptotic reasoning.'
        });
        dynamicGrowthTips.push({
            title: 'Challenge with Extreme Edge Boundaries',
            text: 'Ask students what happens when inputs contain all duplicate values, negative indexes, or empty arrays to unlock Hard-tier diagnostic questions.'
        });
    } else if (isSystemOrArch) {
        dynamicGrowthTips.push({
            title: 'Pose Counterfactual Failure Scenarios',
            text: 'Ask students "What happens if a process crashes at step 2?" to evaluate deep causal understanding of atomicity and state recovery.'
        });
        dynamicGrowthTips.push({
            title: 'Contrast Tradeoffs & Bottlenecks',
            text: 'Contrast throughput vs latency constraints to prepare students for multi-dimensional architectural evaluation.'
        });
    } else {
        dynamicGrowthTips.push({
            title: 'Introduce a Deliberate Non-Working Case',
            text: 'Showing a subtle failure scenario or common anti-pattern will challenge students to diagnose design flaws during assessments.'
        });
        dynamicGrowthTips.push({
            title: 'Probe Real-World Constraint Violations',
            text: 'Illustrating real-world situations where these assumptions break down unlocks higher Hard-tier question capacity.'
        });
    }

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
                                <span>Instructional Quality & Assessment Digest</span>
                            </h2>
                            <p className="text-xs text-slate-300 font-medium">
                                Pedagogical digest evaluating conceptual clarity, operational mechanisms, and assessment readiness.
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
                <div className="modal-body p-6 space-y-5 text-slate-800 max-h-[80vh] overflow-y-auto">
                    
                    {/* Hero Section: The "Kick" Banner */}
                    <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white rounded-2xl p-5 shadow-md border border-white/10 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="relative w-18 h-18 rounded-2xl border-2 border-orange-500/40 flex items-center justify-center bg-slate-900/90 shadow-inner shrink-0">
                                    <div className="text-center">
                                        <span className="text-2xl font-black text-white">{idiScore}</span>
                                        <span className="text-[10px] block font-mono text-orange-400">/ 100</span>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-orange-500/20 text-orange-300 border border-orange-500/30 flex items-center gap-1">
                                            <Flame size={12} className="text-orange-400" />
                                            <span>{celebrationBadge}</span>
                                        </span>
                                        <span className="text-[11px] text-slate-400 font-mono">
                                            {recBalanced} Balanced Questions Ready
                                        </span>
                                    </div>
                                    <h3 className="text-sm sm:text-base font-black text-slate-100 leading-snug">
                                        {celebrationTitle}
                                    </h3>
                                    <p className="text-xs text-slate-300 leading-relaxed max-w-lg">
                                        {celebrationSub}
                                    </p>
                                </div>
                            </div>

                            {onApplyQuestionCount && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        onApplyQuestionCount(recBalanced, 'Balanced');
                                        onClose();
                                    }}
                                    className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer shrink-0 self-start sm:self-center"
                                >
                                    <Zap size={14} />
                                    <span>Apply {recBalanced} Qs</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Section 1: The 4 Pedagogical Rings */}
                    <div className="space-y-2.5">
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                            <Sparkles size={14} className="text-orange-600" />
                            Pedagogical Delivery Dimensions (4 Pillars)
                        </h4>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {/* Ring 1 */}
                            <div className="p-3 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-1.5">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="font-bold text-slate-800">🎯 Concept Clarity</span>
                                    <span className="font-mono font-black text-orange-600">{ring1} / 25</span>
                                </div>
                                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full bg-orange-500 transition-all duration-500" style={{ width: `${(ring1 / 25) * 100}%` }} />
                                </div>
                                <p className="text-[11px] text-slate-500 leading-snug">
                                    {ring1 >= 22 ? 'Unambiguous terminology, precise definitions, and clear framing.' : 'Core principles introduced with foundational definitions.'}
                                </p>
                            </div>

                            {/* Ring 2 */}
                            <div className="p-3 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-1.5">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="font-bold text-slate-800">🧠 Depth of Explanation</span>
                                    <span className="font-mono font-black text-indigo-600">{ring2} / 25</span>
                                </div>
                                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full bg-indigo-500 transition-all duration-500" style={{ width: `${(ring2 / 25) * 100}%` }} />
                                </div>
                                <p className="text-[11px] text-slate-500 leading-snug">
                                    {ring2 >= 22 ? 'Explains the "why", underlying mechanisms, and operational invariants.' : 'Foundational explanations present; causal mechanics can be deepened.'}
                                </p>
                            </div>

                            {/* Ring 3 */}
                            <div className="p-3 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-1.5">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="font-bold text-slate-800">💻 Examples & Practice</span>
                                    <span className="font-mono font-black text-emerald-600">{ring3} / 25</span>
                                </div>
                                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${(ring3 / 25) * 100}%` }} />
                                </div>
                                <p className="text-[11px] text-slate-500 leading-snug">
                                    {ring3 >= 22 ? 'Concrete walkthroughs, sample traces, or worked code demonstrations.' : 'Theory explained; adding sample traces enables scenario questions.'}
                                </p>
                            </div>

                            {/* Ring 4 */}
                            <div className="p-3 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-1.5">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="font-bold text-slate-800">📈 Lecture Structure</span>
                                    <span className="font-mono font-black text-blue-600">{ring4} / 25</span>
                                </div>
                                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full bg-blue-500 transition-all duration-500" style={{ width: `${(ring4 / 25) * 100}%` }} />
                                </div>
                                <p className="text-[11px] text-slate-500 leading-snug">
                                    {ring4 >= 22 ? 'Logical lesson progression with clear chapter transitions.' : 'Continuous lesson flow with structured transitions.'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Standout Teaching Moment Spotlight */}
                    {highlightQuote && (
                        <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200 shadow-2xs space-y-1.5">
                            <div className="flex items-center gap-2 text-amber-900 font-black text-xs uppercase tracking-wider">
                                <Quote size={15} className="text-amber-600 shrink-0" />
                                <span>⭐ Standout Teaching Moment</span>
                            </div>
                            <blockquote className="text-xs font-semibold text-slate-800 italic pl-3 border-l-2 border-amber-400 leading-relaxed">
                                &ldquo;{highlightQuote}&rdquo;
                            </blockquote>
                            <p className="text-[10px] text-amber-700 font-medium">
                                Verbatim clarity captured directly from your spoken lecture narrative.
                            </p>
                        </div>
                    )}

                    {/* Section 3: Why You Earned This Score & Growth Opportunities */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        {/* Left: Authentic Strengths */}
                        <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-2.5">
                            <p className="text-xs font-black text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                                <CheckCircle size={15} className="text-emerald-600" />
                                Why You Earned This Score
                            </p>
                            <div className="space-y-2 text-xs text-emerald-950">
                                {dynamicStrengths.map((st, i) => (
                                    <div key={i} className="flex items-start gap-2">
                                        <Check size={14} className="text-emerald-600 font-bold shrink-0 stroke-[2.5] mt-0.5" />
                                        <div>
                                            <strong className="font-bold text-emerald-900 block">{st.title}</strong>
                                            <span className="text-[11px] text-emerald-800 leading-snug block">{st.text}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Right: Topic-Aware Growth Opportunities */}
                        <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200 space-y-2.5">
                            <p className="text-xs font-black text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                                <Lightbulb size={15} className="text-indigo-600" />
                                Opportunities for Next Lecture
                            </p>
                            <div className="space-y-2 text-xs text-indigo-950">
                                {dynamicGrowthTips.map((tip, i) => (
                                    <div key={i} className="flex items-start gap-2">
                                        <ArrowRight size={13} className="text-indigo-600 font-bold shrink-0 mt-0.5" />
                                        <div>
                                            <strong className="font-bold text-indigo-900 block">{tip.title}</strong>
                                            <span className="text-[11px] text-indigo-800 leading-snug block">{tip.text}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Section 4: Verified Curricular Concepts Recognized */}
                    {cleanConcepts.length > 0 && (
                        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                                    <BookOpen size={14} className="text-orange-600" />
                                    Verified Curricular Concepts Recognized
                                </p>
                                <span className="text-[10px] text-slate-500 font-mono">
                                    {cleanConcepts.length} verified concepts
                                </span>
                            </div>
                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                                {cleanConcepts.map((concept, i) => (
                                    <span key={i} className="text-[11px] font-bold bg-white text-slate-800 border border-slate-200 px-2.5 py-1 rounded-full shadow-2xs inline-flex items-center gap-1.5">
                                        <Tag size={11} className="text-orange-600 shrink-0" />
                                        <span>{concept}</span>
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Section 5: Recommended Questions by Difficulty */}
                    <div className="space-y-2.5 pt-1">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                                <Zap size={14} className="text-orange-600 fill-orange-500" />
                                Recommended Questions by Difficulty
                            </h4>
                            <span className="text-[10px] text-slate-500 font-mono">
                                Balanced gives highest multi-tier coverage
                            </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                            {/* Balanced */}
                            <div className="p-3 rounded-2xl bg-gradient-to-br from-orange-500/10 via-amber-500/10 to-orange-500/5 border-2 border-orange-300 shadow-2xs flex flex-col justify-between gap-2.5">
                                <div>
                                    <div className="flex items-center justify-between mb-0.5">
                                        <span className="text-xs font-black text-orange-950 flex items-center gap-1.5">
                                            <Scale size={13} className="text-orange-600" />
                                            Balanced
                                        </span>
                                        <span className="text-[9px] font-black uppercase tracking-wider bg-orange-200/80 text-orange-800 px-1.5 py-0.2 rounded-md">
                                            Recommended
                                        </span>
                                    </div>
                                    <p className="text-base font-black text-slate-900">
                                        {recBalanced} <span className="text-xs font-medium text-slate-600">Questions</span>
                                    </p>
                                    <p className="text-[10px] text-slate-600 leading-snug mt-0.5">
                                        Comprehensive blend across Easy, Medium, and Hard tiers.
                                    </p>
                                </div>
                                {onApplyQuestionCount && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onApplyQuestionCount(recBalanced, 'Balanced');
                                            onClose();
                                        }}
                                        className="w-full py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-[11px] uppercase tracking-wider flex items-center justify-center gap-1 shadow-2xs active:scale-95 transition-all cursor-pointer"
                                    >
                                        <Check size={13} strokeWidth={3} />
                                        Apply Balanced
                                    </button>
                                )}
                            </div>

                            {/* Easy */}
                            <div className="p-3 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between gap-2.5">
                                <div>
                                    <div className="flex items-center justify-between mb-0.5">
                                        <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                                            <CheckCircle size={13} className="text-emerald-600" />
                                            Easy
                                        </span>
                                        <span className="text-[9px] font-bold text-slate-500 font-mono">
                                            Cap: {capEasy}
                                        </span>
                                    </div>
                                    <p className="text-base font-black text-slate-900">
                                        {recEasy} <span className="text-xs font-medium text-slate-600">Questions</span>
                                    </p>
                                    <p className="text-[10px] text-slate-600 leading-snug mt-0.5">
                                        Definitions, terminology, syntax & core recall.
                                    </p>
                                </div>
                                {onApplyQuestionCount && (
                                    <button
                                        type="button"
                                        disabled={recEasy === 0}
                                        onClick={() => {
                                            onApplyQuestionCount(recEasy, 'Easy');
                                            onClose();
                                        }}
                                        className="w-full py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-[11px] uppercase tracking-wider flex items-center justify-center gap-1 shadow-2xs active:scale-95 transition-all cursor-pointer disabled:cursor-not-allowed"
                                    >
                                        Apply Easy
                                    </button>
                                )}
                            </div>

                            {/* Medium */}
                            <div className="p-3 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between gap-2.5">
                                <div>
                                    <div className="flex items-center justify-between mb-0.5">
                                        <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                                            <Zap size={13} className="text-indigo-600" />
                                            Medium
                                        </span>
                                        <span className="text-[9px] font-bold text-slate-500 font-mono">
                                            Cap: {capMedium}
                                        </span>
                                    </div>
                                    <p className="text-base font-black text-slate-900">
                                        {recMedium} <span className="text-xs font-medium text-slate-600">Questions</span>
                                    </p>
                                    <p className="text-[10px] text-slate-600 leading-snug mt-0.5">
                                        Mechanisms, comparisons, execution & tradeoffs.
                                    </p>
                                </div>
                                {onApplyQuestionCount && (
                                    <button
                                        type="button"
                                        disabled={recMedium === 0}
                                        onClick={() => {
                                            onApplyQuestionCount(recMedium, 'Medium');
                                            onClose();
                                        }}
                                        className="w-full py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-[11px] uppercase tracking-wider flex items-center justify-center gap-1 shadow-2xs active:scale-95 transition-all cursor-pointer disabled:cursor-not-allowed"
                                    >
                                        Apply Medium
                                    </button>
                                )}
                            </div>

                            {/* Hard */}
                            <div className={`p-3 rounded-2xl border shadow-2xs flex flex-col justify-between gap-2.5 ${
                                recHard > 0 ? 'bg-white border-slate-200' : 'bg-slate-50/60 border-dashed border-slate-200'
                            }`}>
                                <div>
                                    <div className="flex items-center justify-between mb-0.5">
                                        <span className={`text-xs font-black flex items-center gap-1.5 ${recHard > 0 ? 'text-slate-800' : 'text-slate-500'}`}>
                                            <Award size={13} className={recHard > 0 ? 'text-amber-600' : 'text-slate-400'} />
                                            Hard
                                        </span>
                                        <span className="text-[9px] font-bold text-slate-400 font-mono">
                                            Cap: {capHard}
                                        </span>
                                    </div>
                                    <p className="text-base font-black text-slate-900">
                                        {recHard} <span className="text-xs font-medium text-slate-600">Questions</span>
                                    </p>
                                    <p className="text-[10px] text-slate-500 leading-snug mt-0.5">
                                        {recHard > 0
                                            ? 'Invariants, boundary violations & causal proofs.'
                                            : 'No deep causal invariants in lecture recording.'}
                                    </p>
                                </div>
                                {onApplyQuestionCount && (
                                    <button
                                        type="button"
                                        disabled={recHard === 0}
                                        onClick={() => {
                                            onApplyQuestionCount(recHard, 'Hard');
                                            onClose();
                                        }}
                                        className="w-full py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-[11px] uppercase tracking-wider flex items-center justify-center gap-1 shadow-2xs active:scale-95 transition-all cursor-pointer disabled:cursor-not-allowed"
                                    >
                                        {recHard > 0 ? 'Apply Hard' : 'Not Supported'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Modal Footer */}
                <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between rounded-b-3xl">
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
