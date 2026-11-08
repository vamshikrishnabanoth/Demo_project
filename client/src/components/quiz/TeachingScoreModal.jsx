import React, { useMemo } from 'react';
import {
    X,
    CheckCircle2,
    XCircle,
    AlertCircle,
    Sparkles,
    Scale,
    ArrowRight,
    BookOpen,
    Layers,
    Code,
    Check,
    FileText
} from 'lucide-react';

/**
 * TeachingScoreModal (CurricularEvidenceProfile)
 *
 * Evidence-grounded 4-section scorecard:
 *  1. Prerequisite Gates (Academic Content Gate & Evidence Sufficiency Gate)
 *  2. Observable Evidence Signals (Distinct concepts, formal definitions, worked traces, code, comparative reasoning)
 *  3. Assessment Capacity (Easy, Medium, Hard, and transparent deficit warnings)
 *  4. Curricular Coverage & Alignment (Eligible vs delivered concepts & coverage ratio)
 *
 * Honest & Non-Evaluative:
 *  - NO fake composite percentages (retired from active scoring).
 *  - NO claims of measuring teacher pedagogical efficacy or student learning.
 *  - Clear disclaimers and transparent capacity accounting.
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
    const academicGate = profile?.prerequisiteGates?.academicContentGate;
    const sufficiencyGate = profile?.prerequisiteGates?.evidenceSufficiency;
    const observable = profile?.observableEvidence || {};
    const capacity = profile?.assessmentCapacity || {};
    const alignment = profile?.quizAlignment || {};

    const isNonAcademic = academicGate?.status === 'FAIL' || lectureDepth?.rating === 'Non-Academic';

    // 1. Prerequisite Gate Statuses
    const academicStatus = academicGate?.status || (isNonAcademic ? 'FAIL' : 'PASS');
    const sufficiencyStatus = sufficiencyGate?.status || (isNonAcademic ? 'INSUFFICIENT_EVIDENCE' : 'SUFFICIENT');

    // 2. Observable Concepts
    const concepts = useMemo(() => {
        if (Array.isArray(observable.distinctConcepts) && observable.distinctConcepts.length > 0) {
            return observable.distinctConcepts;
        }
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
        return unique.slice(0, 12);
    }, [observable.distinctConcepts, keyTopics, detectedFocus, lectureIntel]);

    // 3. Recommended Questions & Capacity
    const breakdown = lectureDepth?.breakdown || {};
    const recCount = recommendedQuestionCount || capacity.totalRecommended || breakdown.recommendedQuestionCount || (isNonAcademic ? 0 : 3);
    const easyCap = capacity.easy ?? capacityByDifficulty?.Easy ?? 1;
    const medCap = capacity.medium ?? capacityByDifficulty?.Medium ?? 2;
    const hardCap = capacity.hard ?? capacityByDifficulty?.Hard ?? 0;
    const hardDeficit = capacity.unsupportedHardDeficit ?? 0;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* MODAL HEADER */}
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold shadow-xs">
                            <BookOpen size={18} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-base font-black text-slate-900 tracking-tight">
                                    Curricular Evidence Profile
                                </h3>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                                    Automated Assessment
                                </span>
                            </div>
                            <p className="text-xs text-slate-600">
                                Internal evidence density & assessment capacity audit
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 flex items-center justify-center transition-colors cursor-pointer"
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* MODAL BODY */}
                <div className="p-6 overflow-y-auto space-y-5 text-slate-800 text-sm">

                    {/* Non-Evaluative Disclaimer */}
                    <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl text-[11px] leading-relaxed text-slate-600">
                        <strong>Evaluation Disclaimer:</strong> Automated software estimate derived strictly from transcript text and uploaded materials. Evaluates internal evidence density and assessment capacity. Does <strong>NOT</strong> measure teacher pedagogical efficacy, delivery quality, or student learning outcomes.
                    </div>

                    {/* Section 1: Prerequisite Gates */}
                    <div className="space-y-2">
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
                            1. Prerequisite Gates (Non-Compensatory)
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* Academic Content Gate */}
                            <div className={`p-3.5 rounded-xl border ${
                                academicStatus === 'PASS'
                                    ? 'bg-emerald-50/50 border-emerald-200'
                                    : academicStatus === 'UNCERTAIN'
                                    ? 'bg-amber-50/50 border-amber-200'
                                    : 'bg-rose-50/50 border-rose-200'
                            }`}>
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-xs font-bold text-slate-900">Academic Content Gate</span>
                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                                        academicStatus === 'PASS'
                                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                            : academicStatus === 'UNCERTAIN'
                                            ? 'bg-amber-100 text-amber-800 border-amber-300'
                                            : 'bg-rose-100 text-rose-800 border-rose-300'
                                    }`}>
                                        {academicStatus}
                                    </span>
                                </div>
                                <p className="text-[11px] text-slate-600 leading-tight">
                                    {academicGate?.evidenceAnchor || academicGate?.failureReason || (academicStatus === 'PASS' ? 'Verified academic subject matter.' : 'Lacks assessable curriculum.')}
                                </p>
                            </div>

                            {/* Evidence Sufficiency Gate */}
                            <div className={`p-3.5 rounded-xl border ${
                                sufficiencyStatus === 'SUFFICIENT'
                                    ? 'bg-blue-50/50 border-blue-200'
                                    : sufficiencyStatus === 'UNCERTAIN'
                                    ? 'bg-amber-50/50 border-amber-200'
                                    : 'bg-rose-50/50 border-rose-200'
                            }`}>
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-xs font-bold text-slate-900">Evidence Sufficiency</span>
                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                                        sufficiencyStatus === 'SUFFICIENT'
                                            ? 'bg-blue-100 text-blue-800 border-blue-300'
                                            : sufficiencyStatus === 'UNCERTAIN'
                                            ? 'bg-amber-100 text-amber-800 border-amber-300'
                                            : 'bg-rose-100 text-rose-800 border-rose-300'
                                    }`}>
                                        {sufficiencyStatus}
                                    </span>
                                </div>
                                <p className="text-[11px] text-slate-600 leading-tight">
                                    {sufficiencyGate?.reason || (sufficiencyStatus === 'SUFFICIENT' ? 'Evidence supports defensible questions.' : 'Insufficient evidence volume.')}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Observable Evidence Signals */}
                    <div className="space-y-2">
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
                            2. Observable Evidence Signals
                        </h4>
                        <div className="bg-slate-50/60 border border-slate-200 rounded-xl p-3.5 space-y-3">
                            <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                                <span className="font-bold text-slate-700">Verified Concepts Breadth:</span>
                                <span className="font-mono font-bold text-slate-900">{concepts.length} distinct concepts</span>
                            </div>
                            {concepts.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                    {concepts.map((c, i) => (
                                        <span key={i} className="text-[11px] px-2 py-0.5 rounded-md bg-white text-slate-700 font-semibold border border-slate-200 shadow-2xs">
                                            {c}
                                        </span>
                                    ))}
                                </div>
                            )}

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200/60 text-center">
                                <div className="bg-white p-2 rounded-lg border border-slate-200">
                                    <span className="text-[10px] text-slate-500 block">Formal Definitions</span>
                                    <span className="text-sm font-black text-slate-800">
                                        {observable.formalDefinitions?.length ?? 0}
                                    </span>
                                </div>
                                <div className="bg-white p-2 rounded-lg border border-slate-200">
                                    <span className="text-[10px] text-slate-500 block">Worked Traces</span>
                                    <span className="text-sm font-black text-slate-800">
                                        {observable.workedTraces?.length ?? 0}
                                    </span>
                                </div>
                                <div className="bg-white p-2 rounded-lg border border-slate-200">
                                    <span className="text-[10px] text-slate-500 block">Code Sequencing</span>
                                    <span className="text-sm font-black text-slate-800">
                                        {observable.algorithmicCodeSequencing?.detected ? 'Detected' : 'None'}
                                    </span>
                                </div>
                                <div className="bg-white p-2 rounded-lg border border-slate-200">
                                    <span className="text-[10px] text-slate-500 block">Comparative Logic</span>
                                    <span className="text-sm font-black text-slate-800">
                                        {observable.comparativeReasoning?.detected ? 'Detected' : 'None'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section 3: Assessment Capacity */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
                                3. Assessment Capacity
                            </h4>
                            <span className="text-xs font-bold text-slate-700">
                                Total Recommended: <span className="font-black text-slate-900">{recCount} Qs</span>
                            </span>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
                                <span className="text-[10px] font-bold text-emerald-700 block uppercase">Easy</span>
                                <span className="text-lg font-black text-slate-900">{easyCap}</span>
                                <span className="text-[10px] text-slate-400 block">Recall / Concepts</span>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
                                <span className="text-[10px] font-bold text-blue-700 block uppercase">Medium</span>
                                <span className="text-lg font-black text-slate-900">{medCap}</span>
                                <span className="text-[10px] text-slate-400 block">Logic / Tracing</span>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
                                <span className="text-[10px] font-bold text-purple-700 block uppercase">Hard</span>
                                <span className="text-lg font-black text-slate-900">{hardCap}</span>
                                <span className="text-[10px] text-slate-400 block">Multi-constraint</span>
                            </div>
                        </div>

                        {hardDeficit > 0 && (
                            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2">
                                <AlertCircle size={14} className="mt-0.5 shrink-0 text-amber-600" />
                                <div>
                                    <strong>Capacity Warning:</strong> {hardDeficit} requested Hard target(s) exceed defensible evidence capacity and were safely reallocated.
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Section 4: Curricular Coverage & Alignment */}
                    <div className="space-y-2">
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
                            4. Curricular Coverage & Quiz Alignment
                        </h4>
                        <div className="p-3.5 bg-slate-50/60 rounded-xl border border-slate-200 text-xs space-y-1.5">
                            <div className="flex items-center justify-between">
                                <span className="text-slate-600">Eligible Concepts:</span>
                                <span className="font-bold text-slate-900">{alignment.eligibleConceptCount ?? concepts.length}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-slate-600">Delivered / Represented Concepts:</span>
                                <span className="font-bold text-slate-900">{alignment.deliveredConceptCount ?? alignment.plannedConceptCount ?? 'Pending generation'}</span>
                            </div>
                            <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                                <span className="font-bold text-slate-700">Delivered Coverage Ratio:</span>
                                <span className="font-mono font-black text-slate-900">
                                    {alignment.deliveredCoverageRatio !== null && alignment.deliveredCoverageRatio !== undefined
                                        ? `${Math.round(alignment.deliveredCoverageRatio * 100)}%`
                                        : (alignment.plannedCoverageRatio !== null && alignment.plannedCoverageRatio !== undefined
                                            ? `${Math.round(alignment.plannedCoverageRatio * 100)}% (Planned)`
                                            : 'N/A')}
                                </span>
                            </div>
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
                            className="px-4.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-wider shadow-md flex items-center gap-2 cursor-pointer active:scale-95 transition-all"
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
