import React, { useState, useMemo } from 'react';
import { Network, ChevronDown, ChevronRight, Copy, Check, Search, BookOpen, Layers } from 'lucide-react';

export default function HierarchyViewer({ hierarchicalStore }) {
  const [expandedParents, setExpandedParents] = useState({ P001: true });
  const [selectedChild, setSelectedChild] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [copiedId, setCopiedId] = useState(null);

  const PAGE_SIZE = 10;

  const parents = hierarchicalStore?.parents || [];
  const children = hierarchicalStore?.children || [];

  // Group children by parentId
  const childrenByParent = useMemo(() => {
    const map = {};
    children.forEach(c => {
      const pid = c.parentId || 'P001';
      if (!map[pid]) map[pid] = [];
      map[pid].push(c);
    });
    return map;
  }, [children]);

  // Filter parents by search term
  const filteredParents = useMemo(() => {
    if (!searchTerm.trim()) return parents;
    const q = searchTerm.toLowerCase();
    return parents.filter(p => {
      if ((p.id || '').toLowerCase().includes(q)) return true;
      if ((p.text || '').toLowerCase().includes(q)) return true;
      const chs = childrenByParent[p.id] || [];
      return chs.some(c => (c.text || '').toLowerCase().includes(q) || (c.id || '').toLowerCase().includes(q));
    });
  }, [parents, childrenByParent, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredParents.length / PAGE_SIZE));
  const paginatedParents = filteredParents.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleParent = (pid) => {
    setExpandedParents(prev => ({ ...prev, [pid]: !prev[pid] }));
  };

  const copyText = (id, text) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!parents.length && !children.length) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center text-slate-500">
        <Network size={28} className="mx-auto text-slate-400 mb-2" />
        <p className="text-sm font-semibold">Hierarchical Evidence Store initializing...</p>
        <p className="text-xs text-slate-400 mt-1">Dual-level Parent (400 words) and Child (75 words) windows will populate upon evidence packaging.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Summary */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-xs">
            <Network size={20} />
          </div>
          <div>
            <h4 className="text-sm font-black text-slate-900">Dual-Level Hierarchical Evidence Store</h4>
            <p className="text-xs text-slate-600">
              Parent Windows (~400 words macro-context) • Child Windows (~75 words precision citation)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono font-bold">
          <span className="px-3 py-1.5 bg-white text-indigo-700 border border-indigo-200 rounded-lg shadow-2xs">
            {parents.length} Parents
          </span>
          <span className="px-3 py-1.5 bg-white text-purple-700 border border-purple-200 rounded-lg shadow-2xs">
            {children.length} Children
          </span>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search concept or chunk text across parent and child windows..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Parents & Children Nested View */}
      <div className="space-y-3">
        {paginatedParents.map((parent) => {
          const pid = parent.id || `P${parent.index || 1}`;
          const isExpanded = !!expandedParents[pid];
          const parentChildren = childrenByParent[pid] || [];

          return (
            <div key={pid} className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-2xs">
              {/* Parent Window Bar */}
              <div
                onClick={() => toggleParent(pid)}
                className="px-4 py-3 bg-slate-50 hover:bg-slate-100/70 cursor-pointer flex items-center justify-between gap-3 select-none transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <button className="text-slate-500 hover:text-slate-800">
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                  <span className="font-mono text-xs font-black text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-200 shrink-0">
                    {pid}
                  </span>
                  <span className="text-xs font-semibold text-slate-800 truncate">
                    {parent.topic || parent.title || (parent.text || '').substring(0, 90) + '...'}
                  </span>
                </div>

                <div className="flex items-center gap-3 shrink-0 text-xs">
                  <span className="text-slate-500 text-[11px] font-mono">
                    {parentChildren.length} children
                  </span>
                  <span className="text-slate-400 text-[11px] font-mono">
                    {parent.wordCount || (parent.text || '').split(/\s+/).filter(Boolean).length}w
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); copyText(pid, parent.text); }}
                    className="p-1 text-slate-400 hover:text-slate-700"
                    title="Copy Parent Window text"
                  >
                    {copiedId === pid ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              {/* Parent Expanded Body */}
              {isExpanded && (
                <div className="p-4 space-y-4 border-t border-slate-100 bg-white">
                  {/* Parent Full Context */}
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
                        <BookOpen size={12} />
                        Macro Context Window (Parent: {pid})
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        ~400 Words Macro Narrative
                      </span>
                    </div>
                    <p className="text-xs text-slate-800 leading-relaxed font-sans select-text">
                      {parent.text}
                    </p>
                  </div>

                  {/* Child Chunks Section */}
                  {parentChildren.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <p className="text-[10px] font-black uppercase tracking-wider text-purple-700 flex items-center gap-1.5">
                        <Layers size={12} />
                        Linked Child Windows ({parentChildren.length} micro-evidence chunks)
                      </p>

                      <div className="grid grid-cols-1 gap-2">
                        {parentChildren.map((child) => {
                          const cid = child.id || `C${child.index || 1}`;
                          const isChildSelected = selectedChild === cid;

                          return (
                            <div
                              key={cid}
                              className={`rounded-lg border p-3 transition-colors ${
                                isChildSelected
                                  ? 'bg-purple-50/80 border-purple-300 shadow-2xs'
                                  : 'bg-white border-slate-200 hover:border-purple-200'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-[11px] font-black text-purple-700 bg-purple-100 px-2 py-0.5 rounded">
                                    {cid}
                                  </span>
                                  {child.timestamp && (
                                    <span className="text-[10px] text-slate-400 font-mono">
                                      {child.timestamp}
                                    </span>
                                  )}
                                  {child.page && (
                                    <span className="text-[10px] text-slate-400 font-mono">
                                      Page {child.page}
                                    </span>
                                  )}
                                </div>
                                <button
                                  onClick={() => copyText(cid, child.text)}
                                  className="text-[11px] text-slate-400 hover:text-purple-700 inline-flex items-center gap-1"
                                >
                                  {copiedId === cid ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                                  <span>{copiedId === cid ? 'Copied' : 'Copy Citation'}</span>
                                </button>
                              </div>
                              <p className="text-xs text-slate-700 leading-relaxed select-text font-sans">
                                {child.text}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 text-xs text-slate-600">
          <span>
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredParents.length)} of {filteredParents.length} parents
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-2.5 py-1 rounded border border-slate-200 bg-white disabled:opacity-40 hover:bg-slate-50 cursor-pointer"
            >
              Previous
            </button>
            <span className="font-mono px-2 font-bold">{page} / {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-2.5 py-1 rounded border border-slate-200 bg-white disabled:opacity-40 hover:bg-slate-50 cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
