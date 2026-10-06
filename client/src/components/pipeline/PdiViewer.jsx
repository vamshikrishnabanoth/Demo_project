import React, { useState } from 'react';
import { GitBranch, CheckCircle2, AlignLeft, LayoutTemplate, Combine, Code2, ListTree } from 'lucide-react';

export default function PdiViewer({
  representationMode = 'UNIFIED',
  routerReason = '',
  summaryContent = '',
  blueprintContent = null,
  unifiedContent = '',
  inputConditions = {}
}) {
  const [blueprintViewTab, setBlueprintViewTab] = useState('tree'); // 'tree' | 'json'

  const MODES = [
    {
      id: 'SUMMARY',
      label: 'Summary Representation',
      icon: AlignLeft,
      desc: 'Pure spoken transcript narrative representation path'
    },
    {
      id: 'BLUEPRINT',
      label: 'Blueprint Representation',
      icon: LayoutTemplate,
      desc: 'Structural blueprint schema representation path for slides/code'
    },
    {
      id: 'UNIFIED',
      label: 'Unified Representation',
      icon: Combine,
      desc: 'Dual-source authority: Spoken cues guide intent; documents supply exact artifacts'
    }
  ];

  return (
    <div className="space-y-5">
      {/* PDI Router Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center font-bold">
              <GitBranch size={16} />
            </div>
            <div>
              <h4 className="text-sm font-black text-slate-900">Adaptive PDI Representation Router</h4>
              <p className="text-xs text-slate-500">Pedagogical Delivery Index & Modality Decision Engine</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-orange-50 text-orange-700 border border-orange-200">
            <CheckCircle2 size={13} />
            Mode: {representationMode}
          </span>
        </div>

        {/* Input Conditions */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Spoken Audio</span>
            <span className="font-bold text-slate-800">
              {inputConditions.hasVoice ? 'Present' : 'None / Not Provided'}
            </span>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Companion Docs</span>
            <span className="font-bold text-slate-800">
              {inputConditions.docCount ? `${inputConditions.docCount} Document(s)` : 'None'}
            </span>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Code Artifacts</span>
            <span className="font-bold text-slate-800">
              {inputConditions.hasCode ? 'Detected' : 'None'}
            </span>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Selected Route</span>
            <span className="font-bold text-orange-700">{representationMode}</span>
          </div>
        </div>

        {/* Structured Decision Reason */}
        {routerReason && (
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-lg p-3 text-xs text-amber-900 leading-relaxed">
            <strong className="block text-[10px] uppercase font-black tracking-wider text-amber-800 mb-0.5">
              Routing Rationale:
            </strong>
            {routerReason}
          </div>
        )}

        {/* Mode Selector / Indicator */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          {MODES.map((m) => {
            const isSelected = representationMode === m.id;
            const Icon = m.icon;
            return (
              <div
                key={m.id}
                className={`p-3.5 rounded-xl border transition-all ${
                  isSelected
                    ? 'border-orange-500 bg-orange-50/50 shadow-xs ring-1 ring-orange-500'
                    : 'border-slate-200 bg-slate-50/50 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <Icon size={16} className={isSelected ? 'text-orange-600' : 'text-slate-400'} />
                    <span className="text-xs font-bold text-slate-900">{m.id}</span>
                  </div>
                  {isSelected && (
                    <span className="text-[10px] font-black uppercase text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded">
                      ✓ SELECTED
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-600 leading-snug">{m.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Actual Selected Representation Output Display */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
        <h5 className="text-xs font-black uppercase tracking-wider text-slate-700">
          Actual Output for Selected Route ({representationMode})
        </h5>

        {/* Case 1: SUMMARY */}
        {representationMode === 'SUMMARY' && (
          <div className="bg-slate-900 text-slate-100 rounded-lg p-4 font-mono text-xs leading-relaxed max-h-80 overflow-y-auto">
            {summaryContent ? (
              <pre className="whitespace-pre-wrap break-words">{summaryContent}</pre>
            ) : (
              <p className="italic text-slate-400">Pure transcript narrative representation compiled from lecture audio.</p>
            )}
          </div>
        )}

        {/* Case 2: BLUEPRINT */}
        {representationMode === 'BLUEPRINT' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
              <button
                onClick={() => setBlueprintViewTab('tree')}
                className={`px-3 py-1 rounded text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                  blueprintViewTab === 'tree' ? 'bg-orange-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <ListTree size={13} /> Tree View
              </button>
              <button
                onClick={() => setBlueprintViewTab('json')}
                className={`px-3 py-1 rounded text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                  blueprintViewTab === 'json' ? 'bg-orange-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Code2 size={13} /> JSON View
              </button>
            </div>

            {blueprintViewTab === 'tree' ? (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 font-mono text-xs text-slate-800 max-h-80 overflow-y-auto space-y-2">
                {blueprintContent && typeof blueprintContent === 'object' ? (
                  Object.entries(blueprintContent).map(([k, v]) => (
                    <div key={k} className="border-l-2 border-orange-400 pl-3 py-1">
                      <span className="font-bold text-orange-700">{k}:</span>{' '}
                      <span className="text-slate-700">
                        {typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v)}
                      </span>
                    </div>
                  ))
                ) : (
                  <pre className="whitespace-pre-wrap">{JSON.stringify(blueprintContent || { status: 'Schema verified', blueprint: 'Syllabus / Slide Structural Hierarchy' }, null, 2)}</pre>
                )}
              </div>
            ) : (
              <div className="bg-slate-900 text-slate-100 rounded-lg p-4 font-mono text-xs max-h-80 overflow-y-auto">
                <pre>{JSON.stringify(blueprintContent || { mode: 'BLUEPRINT', status: 'READY' }, null, 2)}</pre>
              </div>
            )}
          </div>
        )}

        {/* Case 3: UNIFIED */}
        {representationMode === 'UNIFIED' && (
          <div className="bg-slate-900 text-slate-100 rounded-lg p-4 font-mono text-xs leading-relaxed max-h-80 overflow-y-auto">
            {unifiedContent ? (
              <pre className="whitespace-pre-wrap break-words">{unifiedContent}</pre>
            ) : (
              <p className="italic text-slate-400">Multi-source unified representation linking spoken audio intent to document formulas and code artifacts.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
