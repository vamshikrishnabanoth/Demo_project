/**
 * server/engine/evidence/hybridRetriever.js
 *
 * Content-Type-Aware Dual-Lexical Hybrid Retriever.
 * Fuses Sparse Okapi BM25 and Lexical Term-Frequency (TF) Cosine Similarity
 * using Reciprocal Rank Fusion (RRF): RRF_score = 1 / (60 + rank).
 * (Note: Uses lexical sparse bag-of-words cosine matching, not dense semantic embeddings).
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

/**
 * Computes cosine similarity between sparse term-frequency (TF) bag-of-words vectors.
 * Truthfully labeled: lexical sparse term matching, not dense vector embedding.
 */
function computeLexicalCosineScore(queryTokens, docTokens) {
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

// Backward-compatibility alias
const computeDenseVectorScore = computeLexicalCosineScore;

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

    // Distinct table query check: avoid false positives on CS domain terms like "page table", "hash table", "routing table"
    const isCurricularTableTerm = /\b(page table|hash table|routing table|symbol table|truth table|vector table)\b/i.test(queryText);
    const isTableQuery = requiredType === 'table' || (!isCurricularTableTerm && /\b(data table|comparison table|tabular|rows and columns)\b/i.test(queryText));
    const isVisualQuery = requiredType === 'chart' || requiredType === 'diagram' || /\b(chart|graph|diagram|flowchart)\b/i.test(queryText);

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

    // 2. Lexical Term-Frequency Cosine Retrieval (Sparse TF Vector Matching)
    const lexicalScores = children.map(child => {
      const cTokens = tokenize(child.text || '');
      let sim = computeLexicalCosineScore(qTokens, cTokens);

      // Boost if exact concept name appears in text
      if (concept && child.text && child.text.toLowerCase().includes(concept.toLowerCase())) {
        sim *= 1.3;
      }

      return {
        child,
        score: sim
      };
    });

    lexicalScores.sort((a, b) => b.score - a.score);
    const lexicalRanks = new Map();
    lexicalScores.forEach((res, idx) => {
      const id = res.child.evidenceId || res.child.childId;
      lexicalRanks.set(id, idx + 1);
    });

    // 3. Reciprocal Rank Fusion (RRF) with Content-Type Boost
    const fusedScores = [];

    for (const child of children) {
      const id = child.evidenceId || child.childId;
      const rankLexical = lexicalRanks.get(id) || (children.length + 1);
      const rankBM25 = bm25Ranks.get(id) || (children.length + 1);

      let rrfScore = (1 / (rrfK + rankLexical)) + (1 / (rrfK + rankBM25));

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
        rankLexicalCosine: rankLexical,
        rankDense: rankLexical, // backward-compatibility alias for existing callers
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

HybridRetriever.computeLexicalCosineScore = computeLexicalCosineScore;
HybridRetriever.computeDenseVectorScore = computeDenseVectorScore;

module.exports = HybridRetriever;
