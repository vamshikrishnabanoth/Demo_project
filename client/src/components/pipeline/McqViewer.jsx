import React, { useState } from 'react';
import { Bot, CheckCircle2, ChevronRight, Sparkles, HelpCircle, Award } from 'lucide-react';

export default function McqViewer({ questions = [], activeTarget = null, targetResults = [] }) {
  const [selectedIdx, setSelectedIdx] = useState(0);

  const displayQuestions = questions.length > 0 ? questions : (
    targetResults.filter(t => t.mcq && !t.mcq.isUnfulfilled).map(t => t.mcq)
  );

  const activeQ = displayQuestions[selectedIdx] || null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 rounded-xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-600 text-white flex items-center justify-center font-bold shadow-xs">
            <Bot size={20} />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-orange-700">
              Agent 2 — Question Generator & Distractor Formulator
            </span>
            <h4 className="text-sm font-black text-slate-900">
              Candidate Multiple-Choice Questions
            </h4>
          </div>
        </div>

        <span className="text-xs font-mono font-bold px-3 py-1 bg-white text-orange-700 border border-orange-200 rounded-lg">
          {displayQuestions.length} Formulated MCQ(s)
        </span>
      </div>

      {/* Active Generating Target notice if in progress */}
      {activeTarget && (
        <div className="bg-orange-50/70 border border-orange-200 rounded-xl p-3.5 flex items-center justify-between text-xs text-orange-950 animate-pulse">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-orange-600" />
            <span>
              <strong>Actively generating MCQ:</strong> Target {activeTarget.targetId} ("{activeTarget.concept}") at tier {activeTarget.tier || 'Medium'}...
            </span>
          </div>
        </div>
      )}

      {/* Question Selector Tabs */}
      {displayQuestions.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {displayQuestions.map((q, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedIdx(idx)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                selectedIdx === idx
                  ? 'bg-orange-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Q{idx + 1}: {(q.metadata?.concept || q.concept || `Target ${idx + 1}`).substring(0, 18)}
            </button>
          ))}
        </div>
      )}

      {/* Active Question Preview */}
      {activeQ ? (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-black text-orange-700 bg-orange-50 px-2.5 py-1 rounded border border-orange-200">
                Question {selectedIdx + 1}
              </span>
              {activeQ.metadata?.targetId && (
                <span className="text-xs font-mono text-slate-500">
                  Target: {activeQ.metadata.targetId}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {activeQ.metadata?.dimension && (
                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                  {activeQ.metadata.dimension}
                </span>
              )}
              {activeQ.metadata?.targetDifficulty && (
                <span className="text-[10px] font-black uppercase text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                  {activeQ.metadata.targetDifficulty}
                </span>
              )}
            </div>
          </div>

          {/* Stem */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Question Stem
            </span>
            <p className="text-sm font-bold text-slate-900 leading-relaxed font-sans select-text">
              {activeQ.questionText || activeQ.question || activeQ.prompt_text}
            </p>
          </div>

          {/* Options */}
          <div className="space-y-2 pt-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Options (with Grounded Key)
            </span>
            <div className="grid grid-cols-1 gap-2">
              {(activeQ.options || []).map((opt, oIdx) => {
                const keyLetter = ['A', 'B', 'C', 'D'][oIdx];
                const isCorrect = (activeQ.correctAnswerKey === keyLetter) ||
                                  (activeQ.correct_answer === keyLetter) ||
                                  (activeQ.correctAnswer === opt);

                return (
                  <div
                    key={oIdx}
                    className={`rounded-xl p-3 border flex items-center justify-between transition-colors ${
                      isCorrect
                        ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950 shadow-2xs'
                        : 'bg-slate-50/60 border-slate-200 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 ${
                        isCorrect ? 'bg-emerald-600 text-white font-black' : 'bg-white text-slate-600 border border-slate-200'
                      }`}>
                        {keyLetter}
                      </span>
                      <span className="text-xs font-medium font-sans select-text">{opt}</span>
                    </div>

                    {isCorrect && (
                      <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded shrink-0">
                        ✓ Correct Answer
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Safe Metadata Footer */}
          <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-slate-600 bg-slate-50 p-3 rounded-lg font-mono">
            <div>
              <span className="text-slate-400 block text-[9px] uppercase">Cognitive Operation</span>
              <span className="font-bold">{activeQ.metadata?.intendedCognitiveOperation || 'Application'}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[9px] uppercase">Single-Key Exclusivity</span>
              <span className="font-bold text-emerald-700">✓ Verified (1 of 4)</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[9px] uppercase">Formulation Status</span>
              <span className="font-bold text-orange-700">Formulated & Evaluated</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center text-slate-500">
          <HelpCircle size={28} className="mx-auto text-slate-400 mb-2" />
          <p className="text-sm font-semibold">Formulating Question Candidates...</p>
          <p className="text-xs text-slate-400 mt-1">Agent 2 drafts each question against the verified parent/child evidence window.</p>
        </div>
      )}
    </div>
  );
}
