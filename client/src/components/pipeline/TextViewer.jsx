import React, { useState } from 'react';
import { Copy, Check, Search, FileText, Mic, Hash } from 'lucide-react';

export default function TextViewer({ title = 'Extracted Text', sources = [], defaultText = '', stats = null }) {
  const [selectedSourceIdx, setSelectedSourceIdx] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [copied, setCopied] = useState(false);

  const activeSource = sources[selectedSourceIdx] || null;
  const currentText = activeSource?.content || activeSource?.snippet || defaultText || '';

  const handleCopy = () => {
    if (!currentText) return;
    navigator.clipboard?.writeText(currentText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const wordCount = currentText.trim().split(/\s+/).filter(Boolean).length;
  const charCount = currentText.length;

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
      {/* Header bar */}
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-orange-600" />
          <h4 className="text-sm font-bold text-slate-800">{title}</h4>
          {sources.length > 1 && (
            <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-semibold">
              {sources.length} sources
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
          <span>{wordCount.toLocaleString()} words</span>
          <span>•</span>
          <span>{charCount.toLocaleString()} chars</span>
          <button
            onClick={handleCopy}
            className="ml-2 inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-medium cursor-pointer transition-colors"
            title="Copy text to clipboard"
          >
            {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* Source selector tabs if multiple sources */}
      {sources.length > 1 && (
        <div className="px-4 py-2 bg-slate-50/60 border-b border-slate-200 flex items-center gap-2 overflow-x-auto">
          {sources.map((s, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedSourceIdx(idx)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
                selectedSourceIdx === idx
                  ? 'bg-orange-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {(s.type === 'voice' || s.type === 'audio') ? <Mic size={12} /> : <FileText size={12} />}
              <span>{s.name || s.source_name || `Source ${idx + 1}`}</span>
            </button>
          ))}
        </div>
      )}

      {/* Search filter bar */}
      <div className="p-3 bg-white border-b border-slate-100 flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search within extracted content..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
          />
        </div>
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1"
          >
            Clear
          </button>
        )}
      </div>

      {/* Content body */}
      <div className="p-4 max-h-96 overflow-y-auto bg-slate-900 text-slate-100 font-mono text-xs leading-relaxed">
        {currentText ? (
          <pre className="whitespace-pre-wrap break-words font-mono select-text">
            {currentText}
          </pre>
        ) : (
          <div className="text-slate-500 italic py-8 text-center">
            No extracted text available for this item.
          </div>
        )}
      </div>

      {/* Statistics footer if available */}
      {stats && (
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center gap-4 text-xs text-slate-600">
          {stats.pagesProcessed !== undefined && (
            <span><strong>Pages:</strong> {stats.pagesProcessed}</span>
          )}
          {stats.formulasCount !== undefined && (
            <span><strong>Formulas Detected:</strong> {stats.formulasCount}</span>
          )}
          {stats.codeBlocksCount !== undefined && (
            <span><strong>Code Blocks:</strong> {stats.codeBlocksCount}</span>
          )}
          {stats.hasVoice !== undefined && (
            <span><strong>Spoken Transcript:</strong> {stats.hasVoice ? 'Yes' : 'No'}</span>
          )}
        </div>
      )}
    </div>
  );
}
