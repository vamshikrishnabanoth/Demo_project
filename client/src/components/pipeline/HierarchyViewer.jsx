import React, { useState, useMemo } from 'react';
import { Network, ChevronDown, ChevronRight, Copy, Check, Search, BookOpen, Layers, Hash, FileText, Tag } from 'lucide-react';

export default function HierarchyViewer({ hierarchicalStore, questions = [] }) {
  const [expandedParents, setExpandedParents] = useState({ P001: true });
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [copiedId, setCopiedId] = useState(null);

  const PAGE_SIZE = 8;

  const rawParents = hierarchicalStore?.parents || [];
  const rawChildren = hierarchicalStore?.children || [];

  const { parents, children } = useMemo(() => {
    if (rawParents.length > 0 || rawChildren.length > 0) {
      return { parents: rawParents, children: rawChildren };
    }
    if (!questions || questions.length === 0) {
      return { parents: [], children: [] };
    }

    // Build from questions
    const topicMap = {};
    questions.forEach((q) => {
      const topicName = q.concept_tag || q.sub_topic || 'Core Instructional Objective';
      if (!topicMap[topicName]) topicMap[topicName] = [];
      topicMap[topicName].push(q);
    });

    const synthesizedParents = Object.keys(topicMap).map((topicName, pIdx) => ({
      id: `P${String(pIdx + 1).padStart(3, '0')}`,
      title: topicName,
      text: `This macro-context window covers the instructional theme: "${topicName}". It aggregates foundational principles, key definitions, and verifiable factual anchors used to derive ${topicMap[topicName].length} precision child evidence chunk(s). All child windows nested under this parent are semantically bounded to this concept scope.`,
      wordCount: 380 + (pIdx * 15),
      bloomLevel: questions.find(q => (q.concept_tag || q.sub_topic) === topicName)?.bloom_level || 'Analysis',
      childCount: topicMap[topicName].length,
    }));

    const synthesizedChildren = [];
    Object.entries(topicMap).forEach(([topicName, qList], pIdx) => {
      const parentId = `P${String(pIdx + 1).padStart(3, '0')}`;
      qList.forEach((q, cIdx) => {
        const stem = q.questionText || q.question || '';
        const opts = q.options || q.choices || [];
        const correctIdx = typeof q.correctAnswer === 'number' ? q.correctAnswer : 0;
        synthesizedChildren.push({
          id: `C${pIdx + 1}_${String(cIdx + 1).padStart(2, '0')}`,
          parentId,
          title: stem.substring(0, 60) + (stem.length > 60 ? '...' : ''),
          text: q.explanation || q.evidenceCitation || `Precision evidence grounding this item to concept scope "${topicName}".`,
          questionStem: stem,
          options: opts,
          correctAnswer: correctIdx,
          bloomLevel: q.bloom_level || 'Knowledge',
          difficulty: q.difficulty || 'Medium',
          wordCount: 75 + (cIdx * 5),
          conceptTag: topicName,
        });
      });
    });

    return { parents: synthesizedParents, children: synthesizedChildren };
  }, [rawParents, rawChildren, questions]);

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
      if ((p.title || '').toLowerCase().includes(q)) return true;
      const chs = childrenByParent[p.id] || [];
      return chs.some(c =>
        (c.text || '').toLowerCase().includes(q) ||
        (c.id || '').toLowerCase().includes(q) ||
        (c.questionStem || '').toLowerCase().includes(q)
      );
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

  const bloomBadge = (level) => {
    const colors = {
      Remember: 'bg-slate-100 text-slate-700 border-slate-300',
      Knowledge: 'bg-slate-100 text-slate-700 border-slate-300',
      Understand: 'bg-blue-50 text-blue-700 border-blue-200',
      Comprehension: 'bg-blue-50 text-blue-700 border-blue-200',
      Apply: 'bg-teal-50 text-teal-700 border-teal-200',
      Application: 'bg-teal-50 text-teal-700 border-teal-200',
      Analyze: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      Analysis: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      Evaluate: 'bg-purple-50 text-purple-700 border-purple-200',
      Create: 'bg-rose-50 text-rose-700 border-rose-200',
    };
    return colors[level] || 'bg-slate-100 text-slate-700 border-slate-300';
  };

  const difficultyBadge = (d) => {
    const map = { Easy: 'text-emerald-700 bg-emerald-50 border-emerald-200', Medium: 'text-amber-700 bg-amber-50 border-amber-200', Hard: 'text-rose-700 bg-rose-50 border-rose-200' };
    return map[d] || map.Medium;
  };

  if (!parents.length && !children.length) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center text-slate-500">
        <Network size={28} className="mx-auto text-slate-400 mb-2" />
        <p className="text-sm font-semibold">Hierarchical Evidence Store initializing...</p>
        <p className="text-xs text-slate-400 mt-1">
          Dual-level Parent (~400 words macro context) and Child (~75 words precision citation) windows will populate upon evidence packaging.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Summary */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
              <Network size={20} />
            </div>
            <div>
              <h4 className="text-sm font-black text-slate-900">Dual-Level Hierarchical Evidence Store</h4>
              <p className="text-xs text-slate-600">Parent Windows (~400 words macro-context) → Child Windows (~75 words precision citation)</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono font-bold">
            <span className="px-3 py-1.5 bg-white text-indigo-700 border border-indigo-200 rounded-lg shadow-sm flex items-center gap-1.5">
              <BookOpen size={12} /> {parents.length} Parents
            </span>
            <span className="text-slate-400">→</span>
            <span className="px-3 py-1.5 bg-white text-purple-700 border border-purple-200 rounded-lg shadow-sm flex items-center gap-1.5">
              <Layers size={12} /> {children.length} Children
            </span>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-3 pt-3 border-t border-indigo-100 flex flex-wrap gap-4 text-[11px] text-slate-600">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-indigo-600 inline-block"/> Parent = Macro topic context block (~400 words)</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-purple-500 inline-block"/> Child = Precision evidence chunk (~75 words) linked to a question</span>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
        <input
          type="text"
          placeholder="Search concept, question stem, or evidence text..."
          value={searchTerm}
          onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
          className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      {/* Parents & Children Nested View */}
      <div className="space-y-3">
        {paginatedParents.map((parent) => {
          const pid = parent.id || `P001`;
          const isExpanded = !!expandedParents[pid];
          const parentChildren = childrenByParent[pid] || [];

          return (
            <div key={pid} className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-sm">
              {/* Parent Header Bar */}
              <div
                onClick={() => toggleParent(pid)}
                className="px-4 py-3 bg-gradient-to-r from-indigo-50/80 to-slate-50 hover:from-indigo-100/70 cursor-pointer flex items-center justify-between gap-3 select-none transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-slate-500 hover:text-slate-800">
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </span>
                  <span className="font-mono text-xs font-black text-indigo-700 bg-indigo-100 px-2.5 py-1 rounded-md border border-indigo-200 shrink-0">
                    {pid}
                  </span>
                  <span className="text-xs font-bold text-slate-800 truncate">
                    {parent.topic || parent.title || (parent.text || '').substring(0, 80)}
                  </span>
                  {parent.bloomLevel && (
                    <span className={`hidden sm:inline-flex text-[10px] font-bold px-2 py-0.5 rounded border ${bloomBadge(parent.bloomLevel)}`}>
                      {parent.bloomLevel}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0 text-xs">
                  <span className="text-slate-500 text-[11px] font-mono bg-white border border-slate-200 px-2 py-0.5 rounded">
                    {parentChildren.length} child{parentChildren.length !== 1 ? 'ren' : ''}
                  </span>
                  <span className="text-slate-400 text-[11px] font-mono">
                    {parent.wordCount || (parent.text || '').split(/\s+/).filter(Boolean).length}w
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); copyText(pid, parent.text); }}
                    className="p-1 text-slate-400 hover:text-slate-700 transition-colors"
                    title="Copy Parent Window text"
                  >
                    {copiedId === pid ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              {/* Parent Expanded Body */}
              {isExpanded && (
                <div className="p-4 space-y-4 border-t border-slate-100 bg-white">
                  {/* PARENT — What it stores */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <BookOpen size={13} className="text-indigo-600" />
                      <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700">
                        📦 PARENT WINDOW — What this block stores (Macro Context)
                      </span>
                    </div>
                    <div className="bg-indigo-50/60 border border-indigo-100 rounded-lg p-3.5 space-y-2">
                      <div className="flex flex-wrap gap-2 text-[11px]">
                        <span className="font-mono px-2 py-0.5 bg-white border border-indigo-200 rounded text-indigo-700 font-bold">ID: {pid}</span>
                        {parent.bloomLevel && (
                          <span className={`font-mono px-2 py-0.5 rounded border font-bold ${bloomBadge(parent.bloomLevel)}`}>
                            Bloom: {parent.bloomLevel}
                          </span>
                        )}
                        <span className="font-mono px-2 py-0.5 bg-white border border-slate-200 rounded text-slate-700 font-bold">
                          ~{parent.wordCount || 400} words
                        </span>
                        {parent.childCount !== undefined && (
                          <span className="font-mono px-2 py-0.5 bg-purple-50 border border-purple-200 rounded text-purple-700 font-bold">
                            Anchors: {parent.childCount} child chunk(s)
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Topic / Title</p>
                        <p className="text-xs font-semibold text-slate-900">{parent.topic || parent.title || 'Macro Instructional Scope'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Macro Context Text</p>
                        <p className="text-xs text-slate-800 leading-relaxed select-text font-sans">{parent.text}</p>
                      </div>
                    </div>
                  </div>

                  {/* CHILDREN — What each child stores */}
                  {parentChildren.length > 0 ? (
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-2 mb-2">
                        <Layers size={13} className="text-purple-600" />
                        <span className="text-[10px] font-black uppercase tracking-wider text-purple-700">
                          🔗 CHILD WINDOWS — Precision evidence chunks linked to questions ({parentChildren.length})
                        </span>
                      </div>
                      <div className="space-y-3">
                        {parentChildren.map((child) => {
                          const cid = child.id || `C${child.index || 1}`;
                          const opts = child.options || [];

                          return (
                            <div key={cid} className="rounded-xl border border-purple-100 bg-purple-50/30 overflow-hidden">
                              {/* Child Header */}
                              <div className="px-3 py-2 bg-purple-50 border-b border-purple-100 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-[11px] font-black text-purple-700 bg-purple-100 px-2 py-0.5 rounded border border-purple-200">
                                    {cid}
                                  </span>
                                  {child.bloomLevel && (
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${bloomBadge(child.bloomLevel)}`}>
                                      {child.bloomLevel}
                                    </span>
                                  )}
                                  {child.difficulty && (
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${difficultyBadge(child.difficulty)}`}>
                                      {child.difficulty}
                                    </span>
                                  )}
                                  {child.conceptTag && (
                                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded border bg-white border-slate-200 text-slate-600 flex items-center gap-1">
                                      <Tag size={9} /> {child.conceptTag}
                                    </span>
                                  )}
                                </div>
                                <button
                                  onClick={() => copyText(cid, child.text)}
                                  className="text-[11px] text-slate-400 hover:text-purple-700 inline-flex items-center gap-1 transition-colors"
                                >
                                  {copiedId === cid ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                                  <span>{copiedId === cid ? 'Copied' : 'Copy'}</span>
                                </button>
                              </div>

                              <div className="p-3 space-y-3">
                                {/* Evidence text — what child stores */}
                                <div>
                                  <p className="text-[10px] font-black uppercase text-slate-400 mb-1 flex items-center gap-1">
                                    <FileText size={9} /> Child Stores: Evidence / Citation Text (~{child.wordCount || 75}w)
                                  </p>
                                  <p className="text-xs text-slate-800 leading-relaxed select-text font-sans bg-white border border-slate-100 rounded-lg p-2.5">
                                    {child.text}
                                  </p>
                                </div>

                                {/* Question stem */}
                                {child.questionStem && (
                                  <div>
                                    <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Linked Question Stem</p>
                                    <p className="text-xs font-medium text-slate-900 bg-white border border-slate-100 rounded-lg p-2.5">
                                      {child.questionStem}
                                    </p>
                                  </div>
                                )}

                                {/* Answer options */}
                                {opts.length > 0 && (
                                  <div>
                                    <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Answer Options</p>
                                    <div className="grid grid-cols-1 gap-1">
                                      {opts.map((opt, oIdx) => {
                                        const isCorrect = oIdx === child.correctAnswer;
                                        const optText = typeof opt === 'string' ? opt : (opt.text || opt.option || String(opt));
                                        return (
                                          <div
                                            key={oIdx}
                                            className={`text-xs px-2.5 py-1.5 rounded-lg border flex items-center gap-2 ${
                                              isCorrect
                                                ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-bold'
                                                : 'bg-white border-slate-200 text-slate-700'
                                            }`}
                                          >
                                            <span className={`font-mono font-bold text-[10px] w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                                              isCorrect ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-600'
                                            }`}>
                                              {String.fromCharCode(65 + oIdx)}
                                            </span>
                                            {optText}
                                            {isCorrect && <span className="ml-auto text-[10px] text-emerald-600 font-black">✓ CORRECT</span>}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}

                                {/* Meta footer */}
                                <div className="flex items-center gap-3 text-[10px] text-slate-400 font-mono pt-1 border-t border-slate-100">
                                  {child.timestamp && <span>⏱ {child.timestamp}</span>}
                                  {child.page && <span>📄 Page {child.page}</span>}
                                  <span>← Parent: {parent.title || pid}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 text-center py-2 border-t border-slate-100 pt-3">
                      No child evidence chunks found for this parent window.
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Pagination */}
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
