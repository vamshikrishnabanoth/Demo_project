import React, { useState } from 'react';
import { Target, Shield, Layers, Award, CheckCircle2, ChevronRight, Sparkles } from 'lucide-react';

export default function TargetViewer({ plan = {}, tcScore = null }) {
  const [activeTab, setActiveTab] = useState('primary'); // 'primary' | 'reserve' | 'tc'

  const primaryTargets = plan?.assessmentTargets || [];
  const reserveTargets = plan?.reserveTargets || [];
  const scoreData = tcScore || plan?.tcScore || {};
  const breakdown = scoreData?.breakdown || {};

  const difficultyBadge = (diff) => {
    switch (diff) {
      case 'Easy': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Hard': return 'bg-rose-50 text-rose-700 border-rose-200';
      default: return 'bg-amber-50 text-amber-700 border-amber-200';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header with subject/topic and TC score summary */}
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
              {plan.mainTopic || plan.subject || 'Curriculum Target Allocation'}
            </h4>
          </div>
        </div>

        {scoreData.overallScore !== undefined && (
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-purple-200 shadow-2xs">
            <Award size={20} className="text-purple-600" />
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">TC Coverage Score</span>
              <span className="text-lg font-black text-purple-700">
                {scoreData.overallScore} <span className="text-xs text-slate-400 font-normal">/ 100</span>
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
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Target size={13} />
          Primary Targets ({primaryTargets.length})
        </button>

        <button
          onClick={() => setActiveTab('reserve')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'reserve'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Shield size={13} />
          Reserve Pool ({reserveTargets.length})
        </button>

        <button
          onClick={() => setActiveTab('tc')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'tc'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Award size={13} />
          TC Score Breakdown
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
                  <h5 className="text-sm font-bold text-slate-900">{target.concept}</h5>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${difficultyBadge(target.targetDifficulty || target.difficulty || 'Medium')}`}>
                    {target.targetDifficulty || target.difficulty || 'Medium'}
                  </span>
                  {target.dimension && (
                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                      {target.dimension}
                    </span>
                  )}
                </div>
              </div>

              {/* Details grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs bg-slate-50 p-3 rounded-lg border border-slate-100">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Subtopic:</span>
                  <span className="font-medium text-slate-800">{target.subtopic || 'Core Mechanism'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Cognitive Operation:</span>
                  <span className="font-medium text-slate-800">{target.intendedCognitiveOperation || target.cognitiveLevel || 'Apply'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Evidence Citing:</span>
                  <span className="font-mono text-purple-700 font-bold">
                    {(target.sourceChunks || []).join(', ') || 'chunk_01'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 2: Reserve Targets */}
      {activeTab === 'reserve' && (
        <div className="space-y-3">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
            <strong>Reserve Target Invariant:</strong> Reserve concepts stand ready in memory. If Agent 3 rejects a question or detects a duplicate, the pipeline swaps in a reserve target automatically without failing the generation job.
          </div>

          {reserveTargets.map((reserve, idx) => (
            <div key={reserve.targetId || idx} className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-xs font-black text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200">
                    {reserve.targetId || `R0${idx + 1}`}
                  </span>
                  <h5 className="text-sm font-bold text-slate-900">{reserve.concept}</h5>
                </div>
                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                  Reserve Backup
                </span>
              </div>
              <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded border border-slate-100">
                <span className="font-bold text-slate-500">Curricular Scope:</span> {reserve.subtopic || reserve.dimension || 'Extension Concept'}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 3: TC Score Breakdown */}
      {activeTab === 'tc' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
          <h5 className="text-xs font-black uppercase tracking-wider text-slate-700">
            Transparent Teaching Coverage (TC) Score Breakdown
          </h5>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {[
              { label: 'Concept Coverage', value: breakdown.conceptCoverage || '24 / 25', desc: 'Coverage of fundamental definitions' },
              { label: 'Application Coverage', value: breakdown.applicationCoverage || '21 / 25', desc: 'Mechanisms and problem-solving scenarios' },
              { label: 'Artifact Coverage', value: breakdown.artifactCoverage || '18 / 20', desc: 'Code, formulas, and slide references' },
              { label: 'Teacher Verbal Emphasis', value: breakdown.teacherEmphasis || '14 / 15', desc: 'Alignment with spoken priority cues' },
              { label: 'Instructional Depth', value: breakdown.depth || '9 / 15', desc: 'Multi-layer reasoning depth' },
              { label: 'Overall TC Score', value: breakdown.total || `${scoreData.overallScore || 86} / 100`, desc: 'Composite curriculum coverage metric' },
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
        </div>
      )}
    </div>
  );
}
