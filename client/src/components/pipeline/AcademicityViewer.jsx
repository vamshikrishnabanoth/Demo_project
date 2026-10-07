import React from 'react';
import { GraduationCap, CheckCircle2, XCircle, AlertCircle, Sparkles, BookOpen } from 'lucide-react';

export default function AcademicityViewer({ isAcademic = true, failureReason = null, lectureDepth = null, detectedFocus = [] }) {
  const depthScore = lectureDepth?.score || (isAcademic ? 85 : 20);
  const depthRating = lectureDepth?.rating || (isAcademic ? 'Substantive' : 'Non-Curricular');

  return (
    <div className="space-y-4">
      {/* Main Gate Card */}
      <div className={`rounded-xl border p-5 ${
        isAcademic
          ? 'bg-emerald-50/50 border-emerald-200 text-emerald-950'
          : 'bg-rose-50 border-rose-200 text-rose-950'
      }`}>
        <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-emerald-200/60">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shadow-xs ${
              isAcademic ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
            }`}>
              <GraduationCap size={20} />
            </div>
            <div>
              <h4 className="text-sm font-black text-slate-900">Curricular & Academic Content Gate</h4>
              <p className="text-xs text-slate-600">Verification of assessable pedagogy and syllabus depth</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAcademic ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                <CheckCircle2 size={14} className="text-emerald-700" />
                ✓ PASS — Valid Academic Content
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-300">
                <XCircle size={14} className="text-rose-700" />
                ✕ FAILED — Insufficient Academic Depth
              </span>
            )}
          </div>
        </div>

        {/* Reason / Narrative */}
        <div className="mt-4 text-xs leading-relaxed space-y-2">
          {isAcademic ? (
            <p className="text-slate-700">
              The submitted lecture audio and documents contain rigorous, assessable academic subject matter.
              Conceptual definitions, functional mechanisms, and factual structures were successfully verified.
            </p>
          ) : (
            <div className="p-3 bg-white/80 rounded-lg border border-rose-200 font-mono text-rose-800">
              <strong>Failure Cause:</strong> {failureReason || 'Content lacks assessable educational concepts or is non-academic banter.'}
            </div>
          )}
        </div>
      </div>

      {/* Lecture Depth Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
            Instructional Depth Score
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{depthScore}</span>
            <span className="text-xs text-slate-400">/ 100</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
            Pedagogical Rating
          </span>
          <span className="text-base font-black text-emerald-700">{depthRating}</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
            Assessability Status
          </span>
          <span className="text-base font-black text-slate-800">
            {isAcademic ? 'Fully Assessable' : 'Pipeline Blocked'}
          </span>
        </div>
      </div>

      {/* Focus Topics if detected */}
      {detectedFocus && detectedFocus.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-2">
          <h5 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <Sparkles size={13} className="text-orange-500" />
            Detected Syllabus Focus Points:
          </h5>
          <div className="flex flex-wrap gap-2 pt-1">
            {detectedFocus.map((topic, i) => (
              <span key={i} className="text-xs px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                {topic}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
