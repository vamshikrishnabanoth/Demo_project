import React from 'react';
import { Clock, Loader2, CheckCircle2, XCircle, RefreshCw, Minus } from 'lucide-react';

/**
 * Reusable stage status badge with text + icon indicator.
 * States: WAITING | PROCESSING | COMPLETED | FAILED | RETRYING | SKIPPED
 */
export default function StageStatusBadge({ status, className = '' }) {
  const norm = (status || 'WAITING').toUpperCase();

  if (norm === 'COMPLETED' || norm === 'DONE' || norm === 'PASS') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 ${className}`}>
        <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
        <span>✓ Completed</span>
      </span>
    );
  }

  if (norm === 'PROCESSING' || norm === 'RUNNING' || norm === 'ACTIVE') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-orange-50 text-orange-700 border border-orange-200 animate-pulse ${className}`}>
        <Loader2 size={13} className="text-orange-600 animate-spin shrink-0" />
        <span>● Processing</span>
      </span>
    );
  }

  if (norm === 'FAILED' || norm === 'FAIL' || norm === 'ERROR') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 ${className}`}>
        <XCircle size={13} className="text-rose-600 shrink-0" />
        <span>✕ Failed</span>
      </span>
    );
  }

  if (norm === 'RETRYING' || norm === 'REPAIRING') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 ${className}`}>
        <RefreshCw size={13} className="text-amber-600 animate-spin shrink-0" />
        <span>↻ Retrying</span>
      </span>
    );
  }

  if (norm === 'SKIPPED') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200 ${className}`}>
        <Minus size={13} className="text-slate-400 shrink-0" />
        <span>— Skipped</span>
      </span>
    );
  }

  // WAITING (default)
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-50 text-slate-500 border border-slate-200 ${className}`}>
      <Clock size={13} className="text-slate-400 shrink-0" />
      <span>○ Waiting</span>
    </span>
  );
}
