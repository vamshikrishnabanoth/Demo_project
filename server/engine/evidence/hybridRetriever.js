/**
 * server/engine/evidence/hybridRetriever.js
 *
 * Content-Type-Aware Hybrid Retriever.
 * Fuses Dense (semantic term vector) and Sparse (Okapi BM25) retrieval using
 * Reciprocal Rank Fusion (RRF): RRF_score = 1 / (60 + rank).
 * Applies a 1.3x - 1.5x ranking boost for required content types (tables, charts, diagrams).
 * Expands retrieved child chunks to enclosing parent narrative contexts.
 */

'use strict';

const BM25Retriever = require('./bm25Retriever');
const { BlockTypes } = require('../documentRouter/commonDocumentModel');

function tokenize(text = '') {
  if (!text) return [];
  return (text.toLowerCase().match(/\b\w{3,}\b/g) || []);
}

function computeDenseVectorScore(queryTokens, docTokens) {
  if (queryTokens.length === 0 || docTokens.length === 0) return 0;

  const qFreq = new Map();
  for (const t of queryTokens) qFreq.set(t, (qFreq.get(t) || 0) + 1);

  const dFreq = new Map();
  for (const t of docTokens) dFreq.set(t, (dFreq.get(t) || 0) + 1);

  let dotProduct = 0;
  let qMag = 0;
  let dMag = 0;

  for (const count of qFreq.values()) qMag += count * count;
  for (const count of dFreq.values()) dMag += count * count;

  for (const [term, count] of qFreq.entries()) {
    if (dFreq.has(term)) {
      dotProduct += count * dFreq.get(term);
    }
  }

  const denominator = Math.sqrt(qMag) * Math.sqrt(dMag);
  return denominator > 0 ? dotProduct / denominator : 0;
}

class HybridRetriever {
  /**
   * Perform content-type-aware hybrid retrieval for an assessment target.
   * @param {Object} store - HierarchicalEvidenceStore ({ parents, children, parentMap, childMap })
   * @param {Object} target - Assessment target ({ concept, instruction, contentType, subtopic, ... })
   * @param {Object} options - { topK: 3, rrfK: 60, boostFactor: 1.4 }
   * @returns {Array<Object>} Ranked retrieved evidence items
   */
  static retrieveForTarget(store, target = {}, options = {}) {
    if (!store || !Array.isArray(store.children) || store.children.length === 0) {
      return [];
    }

    const topK = options.topK || 3;
    const rrfK = options.rrfK || 60;
    const boostFactor = options.boostFactor || 1.4;

    const concept = (target.concept || target.concept_name || '').trim();
    const instruction = (target.instruction || target.what_taught || target.supportingEvidence || '').trim();
    const subtopic = (target.subtopic || target.why_assessed || '').trim();
    const requiredType = (target.contentType || target.content_type || '').toLowerCase();

    // Check if query implies tabular or visual requirement
    const queryText = `${concept} ${instruction} ${subtopic}`.trim();
    const isTableQuery = requiredType === 'table' || /\b(table|row|column|dataset|metrics|comparison)\b/i.test(queryText);
    const isVisualQuery = requiredType === 'chart' || requiredType === 'diagram' || /\b(chart|graph|diagram|figure|flowchart)\b/i.test(queryText);

    const children = store.children;
    const qTokens = tokenize(queryText);

    // 1. Sparse Retrieval with Okapi BM25
    const bm25 = new BM25Retriever();
    bm25.index(children);
    const bm25Results = bm25.search(queryText, children.length);
    const bm25Ranks = new Map();
    bm25Results.forEach((res, idx) => {
      const id = res.document.evidenceId || res.document.childId;
      bm25Ranks.set(id, idx + 1);
    });

    // 2. Dense Semantic Vector Retrieval
    const denseScores = children.map(child => {
      const cTokens = tokenize(child.text || '');
      let sim = computeDenseVectorScore(qTokens, cTokens);

      // Boost if exact concept name appears in text
      if (concept && child.text && child.text.toLowerCase().includes(concept.toLowerCase())) {
        sim *= 1.3;
      }

      return {
        child,
        score: sim
      };
    });

    denseScores.sort((a, b) => b.score - a.score);
    const denseRanks = new Map();
    denseScores.forEach((res, idx) => {
      const id = res.child.evidenceId || res.child.childId;
      denseRanks.set(id, idx + 1);
    });

    // 3. Reciprocal Rank Fusion (RRF) with Content-Type Boost
    const fusedScores = [];

    for (const child of children) {
      const id = child.evidenceId || child.childId;
      const rankDense = denseRanks.get(id) || (children.length + 1);
      const rankBM25 = bm25Ranks.get(id) || (children.length + 1);

      let rrfScore = (1 / (rrfK + rankDense)) + (1 / (rrfK + rankBM25));

      // Content-type-aware ranking boost
      const cType = (child.contentType || '').toLowerCase();
      let appliedBoost = 1.0;

      if (isTableQuery && (cType === BlockTypes.TABLE || cType.includes('table'))) {
        appliedBoost = boostFactor;
        rrfScore *= appliedBoost;
      } else if (isVisualQuery && (cType === BlockTypes.CHART || cType === BlockTypes.DIAGRAM || cType === BlockTypes.IMAGE)) {
        appliedBoost = boostFactor;
        rrfScore *= appliedBoost;
      }

      // Enclosing parent context
      const parent = (child.parentId && store.parentMap) ? store.parentMap[child.parentId] : null;

      fusedScores.push({
        child,
        parent,
        rrfScore: Math.round(rrfScore * 100000) / 100000,
        rankDense,
        rankBM25,
        appliedBoost,
        contentType: child.contentType || BlockTypes.PARAGRAPH,
        pageNumber: child.pageNumber || (parent?.pageNumber) || 1,
        section: child.section || parent?.section || 'General Content',
        documentId: child.documentId || parent?.documentId || null
      });
    }

    fusedScores.sort((a, b) => b.rrfScore - a.rrfScore);

    return fusedScores.slice(0, topK);
  }
}

module.exports = HybridRetriever;
