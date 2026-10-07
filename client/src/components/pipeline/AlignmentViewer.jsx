import React, { useState } from 'react';
import { Link2, AlertTriangle, CheckCircle2, XCircle, ArrowRight, Mic, FileText, ShieldAlert } from 'lucide-react';

export default function AlignmentViewer({ alignmentGraph = {}, alignmentWarning = null, unalignedDocuments = [] }) {
  const [filter, setFilter] = useState('ALL'); // 'ALL' | 'ALIGNED' | 'UNALIGNED'

  const links = Object.entries(alignmentGraph || {}).map(([key, val]) => ({
    concept: key,
    ...val
  }));

  const relationshipColor = (rel) => {
    switch (rel) {
      case 'CLOSELY_ALIGNED': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'DIFFERENT_EXPLANATION': return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'SUPPORTING_ARTIFACT': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'PARTIALLY_ALIGNED_SECTION': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'COMPLETELY_UNRELATED': return 'bg-rose-50 text-rose-700 border-rose-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-4">
      {/* Warning banner if cross-material warning exists */}
      {alignmentWarning && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 text-amber-900">
          <ShieldAlert size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed">
            <strong className="block font-black text-amber-800 uppercase tracking-wider mb-0.5">
              Cross-Material Grounding Guard (Policy C+B):
            </strong>
            {alignmentWarning}
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
            <Link2 size={16} />
          </div>
          <div>
            <h4 className="text-sm font-black text-slate-900">Cross-Material Alignment Graph</h4>
            <p className="text-xs text-slate-500">Bidirectional semantic mapping between spoken lecture and documents</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-md border border-indigo-200">
            {links.length} Aligned Node(s)
          </span>
          {unalignedDocuments.length > 0 && (
            <span className="text-xs font-mono font-bold px-2.5 py-1 bg-rose-50 text-rose-700 rounded-md border border-rose-200">
              {unalignedDocuments.length} Unaligned Suppressed
            </span>
          )}
        </div>
      </div>

      {/* Alignment Nodes List */}
      {links.length > 0 ? (
        <div className="space-y-3">
          {links.map((link, idx) => (
            <div key={idx} className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="font-mono text-xs font-black text-slate-900 bg-slate-100 px-2.5 py-1 rounded">
                  {link.concept}
                </span>
                <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${relationshipColor(link.relationship || 'CLOSELY_ALIGNED')}`}>
                  {link.relationship || 'ALIGNED'}
                </span>
              </div>

              {/* Source -> Target Visual Mapping */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-lg border border-slate-100">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                    <Mic size={12} className="text-orange-500" />
                    Teacher Spoken Authority
                  </span>
                  <p className="text-slate-800 font-medium">
                    {link.spokenText || link.voiceConcept || `Teaching emphasis detected in lecture audio`}
                  </p>
                </div>

                <div className="space-y-1 sm:border-l sm:border-slate-200 sm:pl-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                    <FileText size={12} className="text-sky-500" />
                    Supporting Document Artifact
                  </span>
                  <p className="text-slate-800 font-medium">
                    {link.documentRef || link.docSection || `Corroborating formula/text in companion material`}
                  </p>
                </div>
              </div>

              {/* Footer priority */}
              <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                <span>Priority: Level {link.priority || 2}</span>
                {link.confidence && <span>Confidence: {(link.confidence * 100).toFixed(0)}%</span>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center text-slate-500">
          <p className="text-sm font-semibold">Single Modality Session</p>
          <p className="text-xs text-slate-400 mt-1">
            Cross-material alignment is active when both spoken audio and companion documents/slides are uploaded.
          </p>
        </div>
      )}

      {/* Unaligned documents list if any */}
      {unalignedDocuments.length > 0 && (
        <div className="border border-rose-200 bg-rose-50/50 rounded-xl p-4 space-y-2">
          <h5 className="text-xs font-black uppercase tracking-wider text-rose-800 flex items-center gap-1.5">
            <XCircle size={14} className="text-rose-600" />
            Unaligned Materials (Safely Suppressed):
          </h5>
          <ul className="text-xs text-rose-900 space-y-1 pl-5 list-disc">
            {unalignedDocuments.map((doc, i) => (
              <li key={i}>
                <strong>{doc.name || doc}:</strong> Content completely unrelated to lecture transcript — suppressed to prevent foreign question contamination.
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
