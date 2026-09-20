/**
 * server/engine/evidence/rerankerService.js
 *
 * Reranker Service for Multimodal Evidence Candidates.
 * Performs cross-scoring of retrieved candidate chunks against the target assessment intent.
 * Evaluates exact term coverage, technical entity preservation, and content-type alignment.
 * Generates structured, citation-rich evidence blocks for the prompt generator.
 */

'use strict';

class RerankerService {
  /**
   * Rerank retrieved evidence candidates and format them for prompting.
   * @param {Array<Object>} candidates - Output from HybridRetriever
   * @param {Object} target - Assessment target ({ concept, instruction, contentType })
   * @param {Object} options - { topN: 3 }
   * @returns {{ reranked: Array<Object>, evidenceContextString: string, citationTags: Array<string> }}
   */
  static rerank(candidates = [], target = {}, options = {}) {
    if (!Array.isArray(candidates) || candidates.length === 0) {
      return {
        reranked: [],
        evidenceContextString: '',
        citationTags: []
      };
    }

    const topN = options?.topN || 3;
    const safeTarget = target || {};
    const concept = (safeTarget.concept || safeTarget.concept_name || '').toLowerCase().trim();
    const instruction = (safeTarget.instruction || safeTarget.what_taught || '').toLowerCase().trim();
    const targetWords = new Set(
      `${concept} ${instruction}`
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2)
    );

    const scored = candidates.map(item => {
      const childText = (item.child?.text || '').toLowerCase();
      const parentText = (item.parent?.fullText || '').toLowerCase();
      const combinedText = `${childText} ${parentText}`;

      // 1. Base score from Hybrid RRF
      let score = item.rrfScore || 0;

      // 2. Term coverage reward
      let matchedTerms = 0;
      for (const w of targetWords) {
        if (combinedText.includes(w)) matchedTerms++;
      }
      const termCoverage = targetWords.size > 0 ? (matchedTerms / targetWords.size) : 0;
      score += termCoverage * 0.5;

      // 3. Exact concept exact string match reward
      if (concept && combinedText.includes(concept)) {
        score += 0.3;
      }

      // 4. Boost if structured table or visual block has non-trivial content
      if (item.contentType === 'TABLE' || item.contentType === 'CHART' || item.contentType === 'DIAGRAM') {
        score += 0.2;
      }

      return {
        ...item,
        finalScore: Math.round(score * 10000) / 10000
      };
    });

    scored.sort((a, b) => b.finalScore - a.finalScore);
    const topResults = scored.slice(0, topN);

    // Format structured evidence context string
    const citationTags = [];
    const formattedBlocks = topResults.map((res, idx) => {
      const c = res.child || {};
      const p = res.parent || {};
      const blockType = (res.contentType || 'TEXT').toUpperCase();
      const pageNum = res.pageNumber || 1;
      const section = res.section || 'Reference Material';
      const citationTag = `[EVIDENCE ${idx + 1}]`;
      citationTags.push(citationTag);

      const content = c.text || p.fullText || '';

      return `${citationTag} Type: ${blockType} | Page: ${pageNum} | Section: "${section}"\n${content}`;
    });

    return {
      reranked: topResults,
      evidenceContextString: formattedBlocks.join('\n\n'),
      citationTags
    };
  }
}

module.exports = RerankerService;
