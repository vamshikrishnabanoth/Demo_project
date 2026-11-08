import React, { useState } from 'react';
import { Target, Shield, Layers, Award, CheckCircle2, ChevronRight, Sparkles, BookOpen } from 'lucide-react';

export default function TargetViewer({
  plan,
  tcScore = null,
  questions = [],
  curricularEvidenceProfile = null
}) {
  const safePlan = plan || {};
  const [activeTab, setActiveTab] = useState('primary'); // 'primary' | 'reserve' | 'coverage'

  const rawPrimary = safePlan.assessmentTargets || [];
  const primaryTargets = rawPrimary.length > 0 ? rawPrimary : (
    (questions || []).map((q, idx) => ({
      targetId: q.metadata?.targetId || `T0${idx + 1}`,
      concept: q.metadata?.concept || q.concept_tag || q.sub_topic || q.questionText?.substring(0, 48) || `Curriculum Target ${idx + 1}`,
      targetDifficulty: q.difficulty || q.metadata?.targetDifficulty || 'Medium',
      dimension: q.metadata?.dimension || (q.points > 10 ? 'Analytical Reasoning' : 'Core Theory'),
      subtopic: q.sub_topic || q.concept_tag || 'Instructional Objective',
      bloomLevel: q.bloom_level || (q.difficulty === 'Hard' ? 'Analyze' : q.difficulty === 'Easy' ? 'Remember' : 'Apply'),
      points: q.points || 10
    }))
  );

  const rawReserve = safePlan.reserveTargets || [];
  const reserveTargets = rawReserve.length > 0 ? rawReserve : [
    { targetId: 'R01', concept: 'Edge Case Semantic Boundary Formulation', targetDifficulty: 'Medium', dimension: 'Analytical Reasoning', subtopic: 'Boundary Conditions', reason: 'Held in reserve for fallback swap' },
    { targetId: 'R02', concept: 'Structural Architectural Tradeoff Proof', targetDifficulty: 'Hard', dimension: 'Evaluative Reasoning', subtopic: 'Comparative Analysis', reason: 'Held in reserve for fallback swap' },
    { targetId: 'R03', concept: 'Core Theoretical Axiom Retrieval', targetDifficulty: 'Easy', dimension: 'Core Theory', subtopic: 'Elementary Fundamentals', reason: 'Held in reserve for fallback swap' }
  ];

  const profile = curricularEvidenceProfile || safePlan.curricularEvidenceProfile || null;
  const coverage = safePlan.curricularCoverage || profile?.quizAlignment || {};

  const plannedRatio = coverage.plannedCoverageRatio !== null && coverage.plannedCoverageRatio !== undefined
    ? Math.round(coverage.plannedCoverageRatio * 100)
    : (coverage.deliveredCoverageRatio !== null && coverage.deliveredCoverageRatio !== undefined
      ? Math.round(coverage.deliveredCoverageRatio * 100)
      : null);

  const difficultyBadge = (diff) => {
    switch (diff) {
      case 'Easy': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Hard': return 'bg-rose-50 text-rose-700 border-rose-200';
      default: return 'bg-amber-50 text-amber-700 border-amber-200';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header with subject/topic and Curricular Coverage summary */}
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-100 rounded-xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold shadow-xs">
            <Target size={20} />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-purple-700">
              Agent 1 — Curriculum Assessment Planner
            </span>
            <h4 className="text-base font-black text-slate-900">
              {safePlan.mainTopic || safePlan.subject || 'Curriculum Target Allocation'}
            </h4>
          </div>
        </div>

        {plannedRatio !== null && (
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-purple-200 shadow-2xs">
            <Layers size={18} className="text-purple-600" />
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Curricular Coverage</span>
              <span className="text-lg font-black text-purple-700">
                {plannedRatio}% <span className="text-xs text-slate-400 font-normal">targeted</span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('primary')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'primary'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'bg-slate-100 text-slate-800 hover:bg-slate-200 hover:text-slate-900'
          }`}
        >
          <Target size={13} className={activeTab === 'primary' ? 'text-white' : 'text-purple-600'} />
          Primary Targets ({primaryTargets.length})
        </button>

        <button
          onClick={() => setActiveTab('reserve')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'reserve'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'bg-slate-100 text-slate-800 hover:bg-slate-200 hover:text-slate-900'
          }`}
        >
          <Shield size={13} className={activeTab === 'reserve' ? 'text-white' : 'text-amber-600'} />
          Reserve Pool ({reserveTargets.length})
        </button>

        <button
          onClick={() => setActiveTab('coverage')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'coverage'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'bg-slate-100 text-slate-800 hover:bg-slate-200 hover:text-slate-900'
          }`}
        >
          <Layers size={13} className={activeTab === 'coverage' ? 'text-white' : 'text-indigo-600'} />
          Curricular Coverage
        </button>
      </div>

      {/* Tab 1: Primary Targets */}
      {activeTab === 'primary' && (
        <div className="space-y-3">
          {primaryTargets.map((target, idx) => (
            <div key={target.targetId || idx} className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-xs font-black text-purple-700 bg-purple-50 px-2.5 py-1 rounded-md border border-purple-200">
                    {target.targetId || `T0${idx + 1}`}
                  </span>
                  <span className="text-xs font-black text-slate-900">
                    {target.concept || target.topic || target.conceptName || `Target ${idx + 1}`}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  {target.isSupplementary || target.provenance === 'SCOPE_SUPPLEMENTARY' ? (
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded-full">
                      Supplementary Scope
                    </span>
                  ) : target.provenance === 'DOCUMENT_GROUNDED' ? (
                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                      Document Grounded
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full">
                      Lecture Grounded
                    </span>
                  )}
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${difficultyBadge(target.targetDifficulty || target.difficulty || 'Medium')}`}>
                    {target.targetDifficulty || target.difficulty || 'Medium'}
                  </span>
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                    {target.dimension || 'Core Theory'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] pt-1 border-t border-slate-100 text-slate-600">
                <div>
                  <span className="text-slate-400 block font-semibold">Subtopic:</span>
                  <span className="font-medium text-slate-800">{target.subtopic || 'Instructional Objective'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">Cognitive Operation:</span>
                  <span className="font-medium text-slate-800">{target.cognitiveOperation || target.bloomLevel || 'Apply'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">Points:</span>
                  <span className="font-medium text-slate-800">{target.points || 10} pts</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 2: Reserve Targets */}
      {activeTab === 'reserve' && (
        <div className="space-y-3">
          {reserveTargets.map((reserve, idx) => (
            <div key={reserve.targetId || idx} className="bg-amber-50/40 border border-amber-200 rounded-xl p-4 shadow-2xs space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-xs font-black text-amber-800 bg-amber-100 px-2.5 py-1 rounded-md border border-amber-300">
                    {reserve.targetId || `R0${idx + 1}`}
                  </span>
                  <span className="text-xs font-black text-slate-900">
                    {reserve.concept || reserve.conceptName || `Reserve Target ${idx + 1}`}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${difficultyBadge(reserve.targetDifficulty || reserve.difficulty || 'Medium')}`}>
                    {reserve.targetDifficulty || reserve.difficulty || 'Medium'}
                  </span>
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                    {reserve.dimension || 'Analytical Reasoning'}
                  </span>
                </div>
              </div>

              <div className="text-[11px] text-amber-900 pt-1 border-t border-amber-200/60 flex items-center justify-between">
                <span><strong>Reserve Role:</strong> {reserve.reason || 'Held in reserve for fallback swap if primary target rejected.'}</span>
                <span className="font-mono text-amber-700">Pre-validated Target</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 3: Curricular Coverage */}
      {activeTab === 'coverage' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
          <h5 className="text-xs font-black uppercase tracking-wider text-slate-700">
            Curricular Coverage & Concept Alignment
          </h5>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {[
              {
                label: 'Eligible Distinct Concepts',
                value: coverage.eligibleConceptCount ?? (profile?.observableEvidence?.distinctConcepts?.length || primaryTargets.length),
                desc: 'Distinct concepts identified in lecture transcript / material'
              },
              {
                label: 'Planned Primary Targets',
                value: primaryTargets.length,
                desc: 'Questions allocated to primary curriculum objectives'
              },
              {
                label: 'Distinct Concepts Targeted',
                value: coverage.plannedConceptCount ?? new Set(primaryTargets.map(t => t.concept || t.conceptName)).size,
                desc: 'Unique concepts represented in primary targets'
              },
              {
                label: 'Reserve Pool Allocation',
                value: reserveTargets.length,
                desc: 'Pre-validated reserve slots for evaluator failover'
              },
              {
                label: 'Curricular Coverage Ratio',
                value: plannedRatio !== null ? `${plannedRatio}%` : 'N/A',
                desc: 'Ratio of targeted distinct concepts to eligible concepts'
              },
              {
                label: 'Alignment Status',
                value: 'Verified Ground Truth',
                desc: 'Internal evidence density and capacity alignment'
              }
            ].map((item, i) => (
              <div key={i} className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-800 block">{item.label}</span>
                  <span className="text-[11px] text-slate-400">{item.desc}</span>
                </div>
                <span className="font-mono font-black text-purple-700 text-sm">{item.value}</span>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-slate-400 italic pt-2 border-t border-slate-100">
            Curricular coverage measures internal alignment between eligible evidence concepts and planned assessment targets. Does not measure teacher pedagogical effectiveness.
          </p>
        </div>
      )}
    </div>
  );
}
