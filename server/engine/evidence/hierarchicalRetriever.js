/**
 * server/engine/evidence/hierarchicalRetriever.js
 *
 * Faithful port of Speech_To_Text/production_engine/experimental/hierarchical_rag/hierarchical_retriever.py.
 * Retrieves target evidence by scoring child chunks and expanding to parent context windows.
 * - Precision Child Matching: Jaccard token overlap + 1.5x target concept boost
 * - Macro Narrative Context: Expands matched children into enclosing parent context windows
 */

'use strict';

function tokenize(text = '') {
  if (!text) return [];
  return (text.toLowerCase().match(/\b\w{3,}\b/g) || []);
}

class HierarchicalRetriever {
  /**
   * Retrieve hierarchical evidence for a specific assessment target.
   * @param {Object} store - HierarchicalEvidenceStore
   * @param {Object} target - Assessment target ({ concept, subtopic, instruction, supportingEvidence, targetId })
   * @param {Number} topKChildren - Number of child chunks to retrieve (default: 2)
   * @returns {Object|null} HierarchicalRetrievedEvidence
   */
  static retrieveForTarget(store, target = {}, topKChildren = 2) {
    if (!store || !Array.isArray(store.children) || store.children.length === 0) {
      return null;
    }

    const conceptName = (target.concept || target.concept_name || '').trim();
    const whatTaught = (target.instruction || target.what_taught || target.supportingEvidence || '').trim();
    const whyAssessed = (target.subtopic || target.why_assessed || '').trim();

    const queryText = `${conceptName} ${whatTaught} ${whyAssessed}`.trim();
    const qTokens = tokenize(queryText);
    const qSet = new Set(qTokens);

    if (qSet.size === 0) {
      return null;
    }

    const scoredChildren = [];

    for (const child of store.children) {
      const cTokens = tokenize(child.text);
      if (cTokens.length === 0) continue;

      const cSet = new Set(cTokens);
      let overlap = 0;
      for (const t of cTokens) {
        if (qSet.has(t)) overlap++;
      }

      const unionSize = new Set([...cTokens, ...qTokens]).size;
      const jaccard = overlap / Math.max(1, unionSize);

      // Boost if exact concept name appears in child text
      const boost = (conceptName.length > 2 && child.text.toLowerCase().includes(conceptName.toLowerCase())) ? 1.5 : 1.0;
      const score = Math.round(jaccard * boost * 10000) / 10000;

      scoredChildren.push({ score, child });
    }

    scoredChildren.sort((a, b) => b.score - a.score);

    // Filter to positive-scoring matches if available, else top candidate
    let topChildren = scoredChildren.filter(item => item.score > 0).slice(0, topKChildren).map(item => item.child);

    if (topChildren.length === 0 && store.children.length > 0) {
      // If no positive token match, take the highest scoring child
      topChildren = [scoredChildren[0].child];
    }

    const matchedChildEids = topChildren.map(c => c.evidenceId);

    // Identify unique parent contexts preserving order
    const parentEids = [];
    for (const c of topChildren) {
      if (c.parentId && store.parentMap && store.parentMap[c.parentId]) {
        if (!parentEids.includes(c.parentId)) {
          parentEids.push(c.parentId);
        }
      }
    }

    // Build precise citation spans
    const citationSpans = [];
    for (const c of topChildren) {
      if (c.timeSpan && typeof c.timeSpan.start === 'number' && typeof c.timeSpan.end === 'number') {
        const s = c.timeSpan.start;
        const e = c.timeSpan.end;
        const sMin = Math.floor(s / 60);
        const sSec = Math.floor(s % 60);
        const eMin = Math.floor(e / 60);
        const eSec = Math.floor(e % 60);
        citationSpans.push(`${c.evidenceId} (${sMin}m${String(sSec).padStart(2, '0')}s - ${eMin}m${String(eSec).padStart(2, '0')}s)`);
      } else {
        citationSpans.push(c.evidenceId);
      }
    }

    // Assemble prompt context: Parent macro-narrative with explicit context framing
    const promptSections = [];
    let totalParentWords = 0;
    let totalChildWords = 0;

    for (const c of topChildren) {
      totalChildWords += c.wordCount || 0;
    }

    for (const pEid of parentEids) {
      const parentObj = store.parentMap[pEid];
      totalParentWords += parentObj.wordCount || 0;

      promptSections.push(
        `=== [PARENT CONTEXT: ${parentObj.title} (${parentObj.evidenceId})] ===\n` +
        `${parentObj.fullText}\n` +
        `=== [END PARENT CONTEXT] ===`
      );
    }

    const combinedPromptContent = promptSections.join('\n\n');
    const topScore = scoredChildren.length > 0 ? scoredChildren[0].score : 0.0;

    return {
      targetId: target.targetId || target.target_id || 'T_UNKNOWN',
      conceptName: conceptName,
      matchedChildIds: matchedChildEids,
      parentContextIds: parentEids,
      citationSpansText: citationSpans.join(' | '),
      retrievedContent: combinedPromptContent,
      relevanceScore: topScore,
      parentContextLengthWords: totalParentWords,
      childEvidenceLengthWords: totalChildWords
    };
  }
}

module.exports = {
  HierarchicalRetriever,
  tokenize
};
