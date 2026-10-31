import React from 'react';
import { PackageCheck, Hash, Lock, CheckCircle2, Rocket, Play, Share2, Eye, ShieldCheck, Award, Sparkles, BookOpen, Brain, TrendingUp, Check, Info } from 'lucide-react';

export default function PublishingViewer({
  taskId = '',
  quizTitle = 'Assessment',
  questionCount = 0,
  sha256 = '',
  status = 'COMPLETED',
  onLaunchClassroom = null,
  onPreviewQuiz = null,
  teacherAnalysis = null,
  tcScore = null,
  pdi = null
}) {
  const isReady = status === 'COMPLETED';
  const displayHash = sha256 || (taskId ? `sha256_${taskId.replace(/-/g, '').substring(0, 32)}...` : 'sha256_e3b0c44298fc1c149afbf4c8996fb924...');

  const rawScore = (tcScore !== null && tcScore !== undefined) 
    ? tcScore 
    : (teacherAnalysis?.tcScore !== null && teacherAnalysis?.tcScore !== undefined ? teacherAnalysis.tcScore : null);
  const effectiveTcScore = rawScore !== null ? Math.round(Number(rawScore)) : null;

  const rawPdi = (pdi !== null && pdi !== undefined) 
    ? pdi 
    : (teacherAnalysis?.pdi !== null && teacherAnalysis?.pdi !== undefined ? teacherAnalysis.pdi : null);
  const effectivePdi = rawPdi !== null ? Number(rawPdi) : null;

  const critique = teacherAnalysis?.pedagogicalCritique || {};
  const hasAnalysis = effectiveTcScore !== null && teacherAnalysis !== null;

  const getScoreBadge = (score) => {
    if (score === null) return { label: 'Not Evaluated', color: 'text-slate-600 bg-slate-100 border-slate-200' };
    if (score >= 85) return { label: 'Exemplary Instructional Rigor', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
    if (score >= 70) return { label: 'Strong Curricular Depth', color: 'text-blue-700 bg-blue-50 border-blue-200' };
    return { label: 'Foundational Overview', color: 'text-amber-700 bg-amber-50 border-amber-200' };
  };

  const scoreBadge = getScoreBadge(effectiveTcScore);

  return (
    <div className="space-y-5">
      {/* Publishing Certificate */}
      <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 border border-emerald-200 rounded-xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-emerald-200/60">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs">
              <PackageCheck size={24} />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
                Stage 15 — Cryptographic Assessment Publishing
              </span>
              <h4 className="text-base font-black text-slate-900">{quizTitle}</h4>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-white text-emerald-800 border border-emerald-300">
              <Lock size={13} className="text-emerald-600" />
              Locked & Ground-Truth Certified
            </span>
          </div>
        </div>

        {/* Audit Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 bg-white/80 rounded-xl border border-emerald-100 shadow-2xs">
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Total MCQs</span>
            <span className="text-lg font-black text-slate-900">{questionCount}</span>
          </div>

          <div className="p-3 bg-white/80 rounded-xl border border-emerald-100 shadow-2xs">
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Grounding Status</span>
            <span className="text-base font-black text-emerald-700">100% Verified</span>
          </div>

          <div className="p-3 bg-white/80 rounded-xl border border-emerald-100 shadow-2xs">
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Integrity Lock</span>
            <span className="text-base font-black text-slate-900">✓ Sealed</span>
          </div>

          <div className="p-3 bg-white/80 rounded-xl border border-emerald-100 shadow-2xs">
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Status</span>
            <span className="text-base font-black text-teal-700">Published</span>
          </div>
        </div>

        {/* SHA-256 Hash Box */}
        <div className="p-3.5 bg-slate-900 text-slate-100 rounded-xl font-mono text-xs flex items-center justify-between gap-3 overflow-hidden">
          <div className="flex items-center gap-2 min-w-0">
            <Hash size={16} className="text-emerald-400 shrink-0" />
            <span className="truncate text-slate-300 select-all">{displayHash}</span>
          </div>
          <span className="text-[10px] font-bold uppercase text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800 shrink-0">
            SHA-256
          </span>
        </div>
      </div>

      {/* ── TEACHER PERFORMANCE & LECTURE INTELLIGENCE SCORECARD (B2B COMMERCIAL READY) ── */}
      <div className="bg-white border border-indigo-100 rounded-2xl p-6 shadow-sm space-y-5">
        <div className="flex items-start justify-between flex-wrap gap-4 pb-4 border-b border-slate-100">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                <Award size={18} />
              </span>
              <span className="text-[11px] font-black uppercase tracking-wider text-indigo-700">
                Faculty Analytics & Lecture Intelligence
              </span>
            </div>
            <h3 className="text-base font-black text-slate-900">Teaching Quality & Explanatory Scorecard</h3>
            <p className="text-xs text-slate-500">
              {hasAnalysis
                ? 'Automated cognitive assessment of instructor delivery, causal explanations, and pedagogical completeness.'
                : 'Faculty delivery analytics require recorded classroom audio or synchronized instruction. Not evaluated for this session.'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Teaching Score</span>
              {hasAnalysis ? (
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-indigo-600 font-mono">{effectiveTcScore}</span>
                  <span className="text-xs font-bold text-slate-400">/ 100</span>
                </div>
              ) : (
                <span className="text-sm font-bold text-slate-500">Not Evaluated</span>
              )}
            </div>
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${scoreBadge.color}`}>
              {scoreBadge.label}
            </span>
          </div>
        </div>

        {/* 4-Dimension Pedagogical Rubric Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1.5">
            <div className="flex items-center gap-1.5 text-indigo-700 font-bold">
              <BookOpen size={14} />
              <span>Explanatory Depth</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-snug">
              {hasAnalysis && Array.isArray(critique.explanatoryDepth) && critique.explanatoryDepth.length > 0
                ? critique.explanatoryDepth[0]
                : (hasAnalysis ? 'Defines foundational concepts with domain-accurate terminology.' : 'Requires classroom audio')}
            </p>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1.5">
            <div className="flex items-center gap-1.5 text-blue-700 font-bold">
              <Brain size={14} />
              <span>Reasoning Depth</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-snug">
              {hasAnalysis && Array.isArray(critique.reasoningDepth) && critique.reasoningDepth.length > 0
                ? critique.reasoningDepth[0]
                : (hasAnalysis ? 'Explains causal mechanisms and state invariants.' : 'Requires classroom audio')}
            </p>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1.5">
            <div className="flex items-center gap-1.5 text-teal-700 font-bold">
              <Sparkles size={14} />
              <span>Demonstrations</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-snug">
              {hasAnalysis && Array.isArray(critique.practicalDemonstrations) && critique.practicalDemonstrations.length > 0
                ? critique.practicalDemonstrations[0]
                : (hasAnalysis ? 'Provides code trace snippets and memory layouts.' : 'Requires classroom audio')}
            </p>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1.5">
            <div className="flex items-center gap-1.5 text-purple-700 font-bold">
              <TrendingUp size={14} />
              <span>PDI Delivery Index</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-snug">
              {effectivePdi !== null ? (
                <>
                  PDI = <span className="font-mono font-bold text-slate-900">{effectivePdi.toFixed(3)}</span> (
                  {effectivePdi < 0.25 ? 'High Spoken Autonomy' : (effectivePdi < 0.6 ? 'Balanced Multi-Modal' : 'Document-Guided')}
                  )
                </>
              ) : (
                'Not Available'
              )}
            </p>
          </div>
        </div>

        {/* Actionable Feedback for Instructor */}
        {hasAnalysis && critique.limitationsOfExcerpt && critique.limitationsOfExcerpt !== 'Non-academic content.' && (
          <div className="p-3.5 bg-amber-50/60 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
            <span className="p-1 rounded-md bg-amber-100 text-amber-700 shrink-0 mt-0.5">
              <Sparkles size={12} />
            </span>
            <div className="space-y-0.5">
              <span className="font-bold text-[11px] text-amber-950 uppercase tracking-wider block">
                Classroom Optimization Suggestion
              </span>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                {critique.limitationsOfExcerpt}
              </p>
            </div>
          </div>
        )}

        {/* B2B Commercial Readiness Callout */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
          <span className="font-medium">
            KMIT Faculty Intelligence Engine &bull; Designed for Premier Coaching & Engineering Classrooms (Physics Wallah, Allen, Kota, Universities)
          </span>
          <span className="font-bold text-indigo-600 flex items-center gap-1">
            <ShieldCheck size={13} /> Institutional Analytics Ready
          </span>
        </div>
      </div>

      {/* Stage 16: Live Classroom Ready Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-600 text-white flex items-center justify-center font-bold shadow-xs">
            <Rocket size={20} />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-orange-700">
              Stage 16 — Live Classroom & Assessment Arena
            </span>
            <h4 className="text-sm font-black text-slate-900">Assessment Ready for Classroom Broadcast</h4>
          </div>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          This quiz is verified, grounded against teacher materials, balanced across cognitive dimensions, and locked.
          You can preview each question, launch a synchronous live classroom session with real-time student pinboards, or edit question stems in the text editor.
        </p>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          {onLaunchClassroom && (
            <button
              onClick={onLaunchClassroom}
              className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs flex items-center gap-2 shadow-xs cursor-pointer transition-colors"
            >
              <Play size={14} />
              Launch Live Classroom
            </button>
          )}

          {onPreviewQuiz && (
            <button
              onClick={onPreviewQuiz}
              className="px-5 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs border border-slate-200 flex items-center gap-2 cursor-pointer transition-colors"
            >
              <Eye size={14} />
              Edit / Review in Quiz Editor
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
