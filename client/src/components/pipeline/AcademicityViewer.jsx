import React from 'react';
import { GraduationCap, CheckCircle2, XCircle, AlertCircle, Sparkles, BookOpen, Layers } from 'lucide-react';

export default function AcademicityViewer({
  isAcademic = true,
  failureReason = null,
  lectureDepth = null,
  detectedFocus = [],
  curricularEvidenceProfile = null
}) {
  const profile = curricularEvidenceProfile || lectureDepth?.curricularEvidenceProfile || null;
  const academicGate = profile?.prerequisiteGates?.academicContentGate;
  const sufficiencyGate = profile?.prerequisiteGates?.evidenceSufficiency;

  const academicStatus = academicGate?.status || (isAcademic ? 'PASS' : 'FAIL');
  const sufficiencyStatus = sufficiencyGate?.status || (isAcademic ? 'SUFFICIENT' : 'INSUFFICIENT_EVIDENCE');
  const distinctConcepts = profile?.observableEvidence?.distinctConcepts || detectedFocus || [];

  return (
    <div className="space-y-4">
      {/* Prerequisite Gate Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Gate 1: Academic Content Gate */}
        <div className={`rounded-xl border p-5 ${
          academicStatus === 'PASS'
            ? 'bg-emerald-50/50 border-emerald-200 text-emerald-950'
            : academicStatus === 'UNCERTAIN'
            ? 'bg-amber-50/50 border-amber-200 text-amber-950'
            : 'bg-rose-50/50 border-rose-200 text-rose-950'
        }`}>
          <div className="flex items-center justify-between pb-3 border-b border-slate-200/60">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold shadow-xs ${
                academicStatus === 'PASS' ? 'bg-emerald-600 text-white' : academicStatus === 'UNCERTAIN' ? 'bg-amber-600 text-white' : 'bg-rose-600 text-white'
              }`}>
                <GraduationCap size={18} />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-900">Academic Content Gate</h4>
                <p className="text-xs text-slate-600">Educational curriculum verification</p>
              </div>
            </div>

            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black border ${
              academicStatus === 'PASS'
                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                : academicStatus === 'UNCERTAIN'
                ? 'bg-amber-100 text-amber-800 border-amber-300'
                : 'bg-rose-100 text-rose-800 border-rose-300'
            }`}>
              {academicStatus === 'PASS' && <CheckCircle2 size={13} className="text-emerald-700" />}
              {academicStatus === 'UNCERTAIN' && <AlertCircle size={13} className="text-amber-700" />}
              {academicStatus === 'FAIL' && <XCircle size={13} className="text-rose-700" />}
              {academicStatus}
            </span>
          </div>

          <div className="mt-3 text-xs leading-relaxed">
            {academicStatus === 'PASS' ? (
              <p className="text-slate-700">
                {academicGate?.evidenceAnchor || 'Content verified as academic subject matter with objective curriculum concepts.'}
              </p>
            ) : (
              <p className="font-mono text-rose-800 bg-white/80 p-2.5 rounded border border-rose-200">
                {academicGate?.failureReason || failureReason || 'Material lacks educational curriculum concepts or is non-academic.'}
              </p>
            )}
          </div>
        </div>

        {/* Gate 2: Evidence Sufficiency Gate */}
        <div className={`rounded-xl border p-5 ${
          sufficiencyStatus === 'SUFFICIENT'
            ? 'bg-blue-50/50 border-blue-200 text-blue-950'
            : sufficiencyStatus === 'UNCERTAIN'
            ? 'bg-amber-50/50 border-amber-200 text-amber-950'
            : 'bg-rose-50/50 border-rose-200 text-rose-950'
        }`}>
          <div className="flex items-center justify-between pb-3 border-b border-slate-200/60">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold shadow-xs ${
                sufficiencyStatus === 'SUFFICIENT' ? 'bg-blue-600 text-white' : sufficiencyStatus === 'UNCERTAIN' ? 'bg-amber-600 text-white' : 'bg-rose-600 text-white'
              }`}>
                <Layers size={18} />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-900">Evidence Sufficiency</h4>
                <p className="text-xs text-slate-600">Observable assessment capacity</p>
              </div>
            </div>

            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black border ${
              sufficiencyStatus === 'SUFFICIENT'
                ? 'bg-blue-100 text-blue-800 border-blue-300'
                : sufficiencyStatus === 'UNCERTAIN'
                ? 'bg-amber-100 text-amber-800 border-amber-300'
                : 'bg-rose-100 text-rose-800 border-rose-300'
            }`}>
              {sufficiencyStatus === 'SUFFICIENT' && <CheckCircle2 size={13} className="text-blue-700" />}
              {sufficiencyStatus === 'UNCERTAIN' && <AlertCircle size={13} className="text-amber-700" />}
              {sufficiencyStatus === 'INSUFFICIENT_EVIDENCE' && <XCircle size={13} className="text-rose-700" />}
              {sufficiencyStatus}
            </span>
          </div>

          <div className="mt-3 text-xs leading-relaxed">
            <p className="text-slate-700">
              {sufficiencyGate?.reason || (sufficiencyStatus === 'SUFFICIENT' ? 'Observable evidence supports quiz question generation.' : 'Evidence volume is insufficient for defensible assessment targets.')}
            </p>
          </div>
        </div>
      </div>

      {/* Honest Observational Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
            Distinct Verified Concepts
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{distinctConcepts.length}</span>
            <span className="text-xs text-slate-400">concepts</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
            Assessable Evidence Volume
          </span>
          <span className="text-base font-black text-blue-700">
            {sufficiencyGate?.assessableEvidenceVolume || (isAcademic ? 'MODERATE' : 'NONE')}
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
            Pipeline Assessment Status
          </span>
          <span className="text-base font-black text-slate-800">
            {academicStatus === 'PASS' && sufficiencyStatus === 'SUFFICIENT' ? 'Fully Assessable' : 'Pipeline Blocked'}
          </span>
        </div>
      </div>

      {/* Verified Concepts Breadth */}
      {distinctConcepts.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-2">
          <h5 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <Sparkles size={13} className="text-orange-500" />
            Verified Curricular Concepts ({distinctConcepts.length}):
          </h5>
          <div className="flex flex-wrap gap-2 pt-1">
            {distinctConcepts.map((topic, i) => (
              <span key={i} className="text-xs px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                {topic}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-[11px] text-slate-400 italic">
        Automated software estimate derived strictly from transcript text and uploaded materials. Evaluates internal evidence density and assessment capacity. Does NOT measure teacher pedagogical efficacy, delivery quality, or student learning outcomes.
      </p>
    </div>
  );
}
