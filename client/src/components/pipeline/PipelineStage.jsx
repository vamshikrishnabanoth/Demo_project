import React from 'react';
import StageStatusBadge from './StageStatusBadge';
import { ChevronRight, Clock } from 'lucide-react';

export default function PipelineStage({
  order = '01',
  name = 'Stage Name',
  subtitle = '',
  status = 'WAITING',
  summary = null,
  durationMs = null,
  icon: Icon = null,
  color = '#ea580c',
  isSelected = false,
  executionMode = 'SEQUENTIAL',
  engine = null,
  isFallback = false,
  onClick = null
}) {
  const isCompleted = status === 'COMPLETED' || status === 'DONE' || status === 'PASS';
  const isProcessing = status === 'PROCESSING' || status === 'RUNNING' || status === 'ACTIVE';
  const isFailed = status === 'FAILED' || status === 'FAIL' || status === 'ERROR';

  return (
    <div
      onClick={onClick}
      className={`group relative rounded-xl border p-3.5 cursor-pointer transition-all ${
        isSelected
          ? 'bg-white border-orange-500 shadow-md ring-2 ring-orange-500/20'
          : 'bg-white border-slate-200/90 hover:border-slate-300 hover:shadow-xs'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Left: Icon + Order + Titles */}
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${
              isProcessing
                ? 'bg-orange-600 text-white shadow-xs animate-pulse'
                : isCompleted
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : isFailed
                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                : 'bg-slate-50 text-slate-400 border border-slate-200'
            }`}
          >
            {Icon && <Icon size={18} />}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="font-mono text-[10px] font-black uppercase text-slate-400">
                {order}
              </span>
              <span className="text-[10px] text-slate-300">•</span>
              <h4 className={`text-xs font-bold truncate ${isSelected ? 'text-orange-950 font-black' : 'text-slate-800'}`}>
                {name}
              </h4>
            </div>

            {subtitle && (
              <p className="text-[11px] text-slate-500 truncate leading-snug">
                {subtitle}
              </p>
            )}

            {/* Execution Nature & Model Provenance Badges */}
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded flex items-center gap-0.5 ${executionMode === 'PARALLEL' ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                {executionMode === 'PARALLEL' ? '⚡ Parallel' : '➔ Sequential'}
              </span>

              {isFallback ? (
                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-0.5">
                  ⚠️ Fallback Active
                </span>
              ) : null}

              {engine && (
                <span className="text-[9px] font-mono text-slate-400 truncate max-w-[130px]" title={engine}>
                  {engine}
                </span>
              )}
            </div>

            {summary && (
              <div className="mt-1.5 text-[11px] text-slate-600 font-medium line-clamp-1 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                {summary}
              </div>
            )}
          </div>
        </div>

        {/* Right: Status badge & Duration */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          <StageStatusBadge status={status} />
          {durationMs !== null && durationMs > 0 && (
            <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
              <Clock size={10} />
              {(durationMs / 1000).toFixed(1)}s
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
