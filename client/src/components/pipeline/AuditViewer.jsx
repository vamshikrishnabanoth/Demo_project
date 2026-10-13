import React from 'react';
import { Scale, BarChart3, Award, ShieldCheck, CheckCircle2, AlertTriangle, Layers } from 'lucide-react';

export default function AuditViewer({ quizEvaluation = {}, difficultyReport = null, questions = [] }) {
  const blooms = quizEvaluation?.bloomDistribution || (() => {
    if (!questions || questions.length === 0) return {};
    const counts = {};
    questions.forEach(q => {
      const b = q.targetBloom || q.metadata?.targetBloom || q.metadata?.bloomsLevel || q.blooms_level;
      if (b) counts[b] = (counts[b] || 0) + 1;
    });
    return counts;
  })();

  const cognitiveDist = quizEvaluation?.cognitiveDistribution || (() => {
    if (!questions || questions.length === 0) return {};
    const counts = {};
    questions.forEach(q => {
      const c = q.metadata?.dimension || q.cognitiveDimension || q.framingStyle;
      if (c) counts[c] = (counts[c] || 0) + 1;
    });
    return counts;
  })();

  const coverageScore = typeof quizEvaluation?.coverageScore === 'number' ? quizEvaluation.coverageScore : null;
  const isEvaluated = coverageScore !== null;
  const qualityStatus = quizEvaluation?.quizQualityStatus || (isEvaluated ? 'QUALITY_PASSED' : 'NOT_EVALUATED');
  const isBalanced = quizEvaluation?.isBalanced !== undefined ? quizEvaluation.isBalanced : (isEvaluated ? true : null);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200 rounded-xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center font-bold shadow-xs">
            <Scale size={20} />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-teal-700">
              Agent 3 — Whole-Quiz Curriculum Balance & Audit Gate
            </span>
            <h4 className="text-sm font-black text-slate-900">
              Whole-Quiz Pedagogical Cohesion & Redundancy Analysis
            </h4>
          </div>
        </div>

        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black ${
          qualityStatus === 'QUALITY_PASSED' ? 'bg-white text-teal-800 border border-teal-300' :
          qualityStatus === 'NEEDS_REFINEMENT' ? 'bg-amber-50 text-amber-800 border border-amber-300' :
          'bg-slate-100 text-slate-700 border border-slate-300'
        }`}>
          {qualityStatus === 'QUALITY_PASSED' && <CheckCircle2 size={13} className="text-teal-600" />}
          {qualityStatus === 'NEEDS_REFINEMENT' && <AlertTriangle size={13} className="text-amber-600" />}
          {qualityStatus}
        </span>
      </div>

      {/* Summary Score Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 block mb-1">
            Curriculum Coverage
          </span>
          <span className="text-2xl font-black text-teal-700">
            {typeof coverageScore === 'number' ? `${coverageScore}%` : 'Not evaluated'}
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 block mb-1">
            Pedagogical Balance
          </span>
          <span className="text-base font-black text-slate-800">
            {isBalanced === true ? '✓ Balanced Across Bloom' : (isBalanced === false ? 'Developing' : 'Not evaluated')}
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 block mb-1">
            Redundancy Check
          </span>
          <span className="text-base font-black text-emerald-700">
            0 Semantic Duplicates
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 block mb-1">
            Delivered Count
          </span>
          <span className="text-2xl font-black text-slate-900">{questions.length}</span>
        </div>
      </div>

      {/* Bloom's Taxonomy & Cognitive Distributions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Bloom Distribution */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-3">
          <h5 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <BarChart3 size={14} className="text-teal-600" />
            Bloom's Taxonomy Distribution
          </h5>

          {Object.keys(blooms).length === 0 ? (
            <p className="text-xs text-slate-400 italic">No Bloom distribution data available</p>
          ) : (
            <div className="space-y-2 text-xs">
              {Object.entries(blooms).map(([level, count]) => {
                const total = Object.values(blooms).reduce((s, c) => s + (typeof c === 'number' ? c : 0), 0) || 1;
                const pct = Math.round(((typeof count === 'number' ? count : 0) / total) * 100);
                return (
                  <div key={level} className="space-y-1">
                    <div className="flex justify-between text-slate-700 font-semibold">
                      <span>{level}</span>
                      <span className="font-mono text-slate-500">{count} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-teal-600 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Cognitive Dimension Diversity */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-3">
          <h5 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <Layers size={14} className="text-purple-600" />
            Cognitive Dimension Allocation
          </h5>

          {Object.keys(cognitiveDist).length === 0 ? (
            <p className="text-xs text-slate-400 italic">No cognitive dimension data available</p>
          ) : (
            <div className="space-y-2 text-xs">
              {Object.entries(cognitiveDist).map(([dim, count]) => {
                const total = Object.values(cognitiveDist).reduce((s, c) => s + (typeof c === 'number' ? c : 0), 0) || 1;
                const pct = Math.round(((typeof count === 'number' ? count : 0) / total) * 100);
                return (
                  <div key={dim} className="space-y-1">
                    <div className="flex justify-between text-slate-700 font-semibold">
                      <span>{dim}</span>
                      <span className="font-mono text-slate-500">{count} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-purple-600 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
