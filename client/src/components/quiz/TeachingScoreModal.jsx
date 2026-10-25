import React, { useMemo } from 'react';
import {
    X,
    Award,
    CheckCircle2,
    Lightbulb,
    Sparkles,
    Scale,
    ArrowRight,
    BookOpen,
    Layers,
    Cpu,
    Check
} from 'lucide-react';

/**
 * TeachingScoreModal
 *
 * Concise, visual, 1-screen teaching quality scorecard.
 * Displays:
 *  1. Overall quality score out of 100 with clear rating tier.
 *  2. 4 visual progress bars (Concept Clarity, Depth of Explanation, Examples & Practice, Lecture Structure).
 *  3. Neat point-wise highlights: What Was Taught, Key Strengths, and 1 Actionable Tip to reach 100.
 *  4. Quick 1-click button to apply recommended question count to Input 3.
 *
 * Honest & Transparent:
 *  - NO fake comparisons to previous lectures ("+4 from last lecture").
 *  - NO fake quotes or fabricated timestamps.
 *  - NO confusing multi-accordion text blocks.
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
    keyTopics = []
}) {
    if (!isOpen) return null;

    const chars = lectureDepth?.characteristics || {};
    const breakdown = lectureDepth?.breakdown || {};
    const isNonAcademic = lectureDepth?.rating === 'Non-Academic';

    // 1. Overall Score out of 100
    const rawScore = lectureDepth?.score !== undefined ? lectureDepth.score : 85;
    const score = isNonAcademic ? Math.min(15, rawScore) : Math.min(100, Math.max(10, rawScore));

    // Rating Label & Color
    let ratingLabel = 'Comprehensive';
    let ratingColor = 'text-blue-600 bg-blue-50 border-blue-200';
    let scoreRingColor = '#3b82f6';
    if (isNonAcademic) {
        ratingLabel = 'Non-Academic';
        ratingColor = 'text-rose-600 bg-rose-50 border-rose-200';
        scoreRingColor = '#f43f5e';
    } else if (score >= 90) {
        ratingLabel = 'Exemplary';
        ratingColor = 'text-emerald-700 bg-emerald-50 border-emerald-200';
        scoreRingColor = '#10b981';
    } else if (score >= 75) {
        ratingLabel = 'Comprehensive';
        ratingColor = 'text-blue-700 bg-blue-50 border-blue-200';
        scoreRingColor = '#3b82f6';
    } else if (score >= 60) {
        ratingLabel = 'Solid';
        ratingColor = 'text-amber-700 bg-amber-50 border-amber-200';
        scoreRingColor = '#f59e0b';
    } else {
        ratingLabel = 'Developing';
        ratingColor = 'text-orange-700 bg-orange-50 border-orange-200';
        scoreRingColor = '#f97316';
    }

    // 2. Compute 4 Pillar Scores (out of 25 each = 100 max)
    let clarityScore = 18;
    if (chars.conceptExplanation === 'Strong') clarityScore = 25;
    else if (chars.conceptExplanation === 'Moderate') clarityScore = 19;
    else if (chars.conceptExplanation === 'Developing') clarityScore = 14;
    if (isNonAcademic) clarityScore = 3;

    let depthScore = 16;
    if (chars.reasoning === 'Strong') depthScore = 25;
    else if (chars.reasoning === 'Moderate') depthScore = 18;
    else if (chars.reasoning === 'Light') depthScore = 12;
    if (isNonAcademic) depthScore = 2;

    let examplesScore = 14;
    if (chars.examples === 'Present') examplesScore = 25;
    else if (chars.examples === 'Light') examplesScore = 13;
    if (isNonAcademic) examplesScore = 2;

    let structureScore = 17;
    if (chars.procedures === 'Strong') structureScore = 25;
    else if (chars.procedures === 'Moderate') structureScore = 19;
    else if (chars.procedures === 'Light') structureScore = 13;
    if (isNonAcademic) structureScore = 3;

    const pillars = [
        {
            title: 'Concept Clarity',
            subtitle: 'Definitions & core terminology',
            score: clarityScore,
            max: 25,
            color: 'bg-emerald-500',
            trackColor: 'bg-emerald-100',
            textColor: 'text-emerald-700'
        },
        {
            title: 'Depth of Explanation',
            subtitle: 'Causal reasoning & underlying mechanisms',
            score: depthScore,
            max: 25,
            color: 'bg-indigo-500',
            trackColor: 'bg-indigo-100',
            textColor: 'text-indigo-700'
        },
        {
            title: 'Examples & Practice',
            subtitle: 'Practical commands, traces & demonstrations',
            score: examplesScore,
            max: 25,
            color: 'bg-blue-500',
            trackColor: 'bg-blue-100',
            textColor: 'text-blue-700'
        },
        {
            title: 'Lecture Structure',
            subtitle: 'Procedural flow & step-by-step pacing',
            score: structureScore,
            max: 25,
            color: 'bg-amber-500',
            trackColor: 'bg-amber-100',
            textColor: 'text-amber-700'
        }
    ];

    // 3. Extract Clean Concepts for "What Was Taught"
    const concepts = useMemo(() => {
        const pool = [
            ...(Array.isArray(keyTopics) ? keyTopics : []),
            ...(Array.isArray(detectedFocus) ? detectedFocus : []),
            ...(lectureIntel?.conceptMap?.map(c => c.name || c.concept_name) || [])
        ].filter(Boolean);

        const seen = new Set();
        const unique = [];
        for (const item of pool) {
            const clean = String(item).trim();
            const lower = clean.toLowerCase();
            if (clean.length >= 3 && clean.length <= 40 && !seen.has(lower) && !lower.includes('instructional content')) {
                seen.add(lower);
                unique.push(clean);
            }
        }
        return unique.slice(0, 6);
    }, [keyTopics, detectedFocus, lectureIntel]);

    // 4. Strengths Observed
    const strengths = useMemo(() => {
        const list = [];
        if (breakdown.coveredAspects && breakdown.coveredAspects.length > 0) {
            list.push(...breakdown.coveredAspects.slice(0, 2));
        } else {
            if (clarityScore >= 20) list.push('Clear foundational definitions and consistent domain terminology.');
            if (structureScore >= 20) list.push('Structured procedural sequence and step-by-step algorithmic pacing.');
            if (examplesScore >= 20) list.push('Practical technical demonstrations and concrete worked examples.');
            if (depthScore >= 20) list.push('Causal reasoning explaining why core mechanisms behave as they do.');
        }
        if (list.length === 0) {
            list.push('Identified assessable subject matter curriculum.');
        }
        return list.slice(0, 2);
    }, [breakdown.coveredAspects, clarityScore, structureScore, examplesScore, depthScore]);

    // 5. Actionable Tip to reach 100
    const actionableTip = useMemo(() => {
        if (breakdown.actionableTips && breakdown.actionableTips.length > 0) {
            return breakdown.actionableTips[0];
        }
        // Fallback to lowest pillar
        const sorted = [...pillars].sort((a, b) => a.score - b.score);
        const lowest = sorted[0];
        if (lowest.title === 'Depth of Explanation') {
            return 'Explain why edge cases occur and contrast standard execution with a boundary failure to reinforce invariants.';
        } else if (lowest.title === 'Examples & Practice') {
            return 'Include a concrete worked example or CLI command output showing variable state transitions.';
        } else if (lowest.title === 'Lecture Structure') {
            return 'Add a brief 30-second summary recap between foundational rules and complex procedures.';
        }
        return 'Ensure explicit definitions are provided for all prerequisite terms before introducing syntax.';
    }, [breakdown.actionableTips, pillars]);

    // 6. Recommended Question Count
    const recCount = recommendedQuestionCount || breakdown.recommendedQuestionCount || recommendedByDifficulty?.balanced || 5;

    return (
        <div className="fixed inset-0 z-[200] overflow-y-auto bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 select-none animate-in fade-in duration-200">
            <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden relative flex flex-col my-auto">

                {/* HEADER */}
                <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-[var(--bg-accent)]/10 text-[var(--text-accent)] flex items-center justify-center">
                            <Award size={18} />
                        </div>
                        <div>
                            <h2 className="text-base font-black text-slate-900 tracking-tight">Teaching Quality Scorecard</h2>
                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Automated Pedagogical Analysis</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* MODAL BODY */}
                <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(85vh-8rem)]">

                    {/* TOP SCORE BANNER */}
                    <div className="bg-gradient-to-br from-slate-50 to-indigo-50/30 border border-slate-200/80 rounded-2xl p-5 flex items-center justify-between gap-4">
                        <div className="space-y-1.5 flex-1">
                            <div className="flex items-center gap-2">
                                <span className={`text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full border ${ratingColor}`}>
                                    {ratingLabel}
                                </span>
                                {lectureWordCount > 0 && (
                                    <span className="text-xs font-bold text-slate-400">
                                        • ~{lectureWordCount.toLocaleString()} words
                                    </span>
                                )}
                            </div>
                            <h3 className="text-lg font-black text-slate-900 leading-tight">
                                {score >= 80 ? 'Well-Structured Lecture Delivery' : 'Curriculum Substance Detected'}
                            </h3>
                            <p className="text-xs font-medium text-slate-600 line-clamp-2">
                                {whatWasTaught || 'Assessed for concept clarity, explanatory reasoning, practical examples, and procedural progression.'}
                            </p>
                        </div>

                        {/* Circular Score Badge */}
                        <div className="shrink-0 flex flex-col items-center justify-center w-24 h-24 rounded-2xl bg-white border-2 border-slate-200 shadow-sm">
                            <span className="text-3xl font-black text-slate-900 tracking-tight leading-none" style={{ color: scoreRingColor }}>
                                {score}
                            </span>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">out of 100</span>
                        </div>
                    </div>

                    {/* 4 PILLARS (GRAPHICAL PROGRESS BARS) */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                <Layers size={14} className="text-slate-400" />
                                Pedagogical Breakdown
                            </h4>
                            <span className="text-[11px] font-bold text-slate-400">25 pts each</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {pillars.map((pillar) => {
                                const pct = Math.round((pillar.score / pillar.max) * 100);
                                return (
                                    <div key={pillar.title} className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2 shadow-xs">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="font-bold text-slate-800">{pillar.title}</span>
                                            <span className={`font-black ${pillar.textColor}`}>{pillar.score}/{pillar.max}</span>
                                        </div>
                                        {/* Progress Bar */}
                                        <div className={`w-full h-2 rounded-full overflow-hidden ${pillar.trackColor}`}>
                                            <div
                                                className={`h-full rounded-full transition-all duration-500 ${pillar.color}`}
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                        <p className="text-[10px] text-slate-500 font-medium leading-tight truncate">
                                            {pillar.subtitle}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* WHAT WAS TAUGHT (CONCEPT PILLS) */}
                    {concepts.length > 0 && (
                        <div className="space-y-2">
                            <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                <BookOpen size={14} className="text-slate-400" />
                                Concepts Detected in Lecture
                            </h4>
                            <div className="flex flex-wrap gap-1.5">
                                {concepts.map((concept) => (
                                    <span
                                        key={concept}
                                        className="text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200/80 px-2.5 py-1 rounded-lg"
                                    >
                                        {concept}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* KEY STRENGTHS & ACTIONABLE TIP */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Strengths */}
                        <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4 space-y-2">
                            <div className="flex items-center gap-1.5 text-emerald-800 text-xs font-black uppercase tracking-wider">
                                <CheckCircle2 size={15} className="text-emerald-600" />
                                Key Strengths
                            </div>
                            <ul className="space-y-1.5 text-xs text-slate-700">
                                {strengths.map((str, idx) => (
                                    <li key={idx} className="flex items-start gap-1.5">
                                        <span className="text-emerald-600 font-black">•</span>
                                        <span className="font-medium leading-relaxed">{str}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Actionable Tip */}
                        <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-4 space-y-2">
                            <div className="flex items-center gap-1.5 text-amber-800 text-xs font-black uppercase tracking-wider">
                                <Lightbulb size={15} className="text-amber-600" />
                                Tip to Reach 100
                            </div>
                            <p className="text-xs text-slate-700 font-medium leading-relaxed">
                                {actionableTip}
                            </p>
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

                    {onApplyQuestionCount && recCount > 0 && !isNonAcademic && (
                        <button
                            type="button"
                            onClick={() => {
                                onApplyQuestionCount(recCount, 'Balanced');
                                onClose();
                            }}
                            className="px-4.5 py-2.5 rounded-xl bg-[var(--bg-accent)] hover:opacity-90 text-white font-black text-xs uppercase tracking-wider shadow-md flex items-center gap-2 cursor-pointer active:scale-95 transition-all"
                            style={{ backgroundColor: 'var(--bg-accent)', color: 'var(--text-on-accent)' }}
                        >
                            <Sparkles size={14} />
                            Apply Recommended ({recCount} Qs)
                            <ArrowRight size={14} />
                        </button>
                    )}
                </div>

            </div>
        </div>
    );
}
