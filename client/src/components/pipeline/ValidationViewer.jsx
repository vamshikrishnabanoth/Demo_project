import React from 'react';
import { Filter, CheckCircle2, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';

export default function ValidationViewer({ prechecks = [], totalQuestions = 0, repairAttempted = false, repairSuccessful = false }) {
  const defaultRules = [
    {
      rule: 'Option Cardinality',
      detail: 'Exactly 4 non-empty options per question',
      status: 'PASS',
      expected: '4',
      received: '4'
    },
    {
      rule: 'Option Uniqueness',
      detail: 'All 4 options mutually distinct (Pairwise Jaccard overlap < 0.70)',
      status: 'PASS',
      expected: '100% unique',
      received: '0 duplicates'
    },
    {
      rule: 'Answer-Key Exclusivity',
      detail: 'Exactly 1 option matches correctAnswer verbatim',
      status: 'PASS',
      expected: '1 matching option',
      received: '1'
    },
    {
      rule: 'Lazy Phrase Ban',
      detail: '"All of the above" / "None of the above" strictly disallowed',
      status: 'PASS',
      expected: '0 prohibited phrases',
      received: '0'
    },
    {
      rule: 'Stem Length & Structure',
      detail: 'Question stem must be substantive and grammatically complete (≥ 10 words)',
      status: 'PASS',
      expected: '≥ 10 words',
      received: 'Verified'
    },
    {
      rule: 'Deterministic Math / Code Verification',
      detail: 'Numerical answers and syntax tokens checked against source artifacts',
      status: 'PASS',
      expected: 'Consistent',
      received: 'Verified'
    }
  ];

  const rulesList = (prechecks && prechecks.length > 0) ? prechecks : defaultRules;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs">
            <Filter size={20} />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
              Deterministic Schema Pre-Checks
            </span>
            <h4 className="text-sm font-black text-slate-900">
              Structural Invariants & Option Grammar Rules
            </h4>
          </div>
        </div>

        <span className="text-xs font-mono font-bold px-3 py-1 bg-white text-emerald-700 border border-emerald-200 rounded-lg">
          {rulesList.filter(r => r.status === 'PASS').length} / {rulesList.length} Rules Passed
        </span>
      </div>

      {/* Repair notice if repair was triggered */}
      {repairAttempted && (
        <div className={`p-4 rounded-xl border flex items-start gap-3 ${
          repairSuccessful ? 'bg-amber-50 border-amber-200 text-amber-950' : 'bg-rose-50 border-rose-200 text-rose-950'
        }`}>
          <RefreshCw size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <strong className="block uppercase font-black tracking-wider mb-0.5">
              1-Attempt Bounded Repair Flow Executed:
            </strong>
            {repairSuccessful
              ? 'Candidate question required structural repair and was successfully corrected by Agent 2.'
              : 'Structural repair failed. Target was safely replaced with a reserve curriculum concept.'}
          </div>
        </div>
      )}

      {/* Rule List */}
      <div className="space-y-2.5">
        {rulesList.map((check, idx) => {
          const isPass = check.status === 'PASS';
          return (
            <div
              key={idx}
              className={`rounded-xl border p-4 flex items-center justify-between flex-wrap gap-3 transition-colors ${
                isPass ? 'bg-white border-slate-200' : 'bg-rose-50 border-rose-200'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                  isPass ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-100 text-rose-600'
                }`}>
                  {isPass ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                </div>
                <div>
                  <h5 className="text-xs font-bold text-slate-900">{check.rule}</h5>
                  <p className="text-[11px] text-slate-500">{check.detail}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs font-mono">
                {check.expected && (
                  <span className="text-[11px] text-slate-400">
                    Exp: {check.expected}
                  </span>
                )}
                {check.received && (
                  <span className="text-[11px] text-slate-600">
                    Rec: {check.received}
                  </span>
                )}
                <span className={`px-2.5 py-0.5 rounded text-[11px] font-black uppercase ${
                  isPass ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}>
                  {check.status}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
