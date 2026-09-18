/**
 * server/engine/evidence/crossMaterialAligner.js
 *
 * Faithful port of Speech_To_Text/production_engine/experimental/cross_modal/cross_material_aligner.py.
 * Establishes bi-directional semantic edges between Spoken Audio Chunks and Slide/Document/Code Chunks
 * to prevent modality dropping and link spoken explanations to formal slides/formulas.
 * - Jaccard token overlap across modalities
 * - Concept expansion heuristics (e.g. "squeeze/bottleneck" <-> "latent dimension", "divergence" <-> "KL loss")
 * - Bidirectional graph: Audio <-> Slide / Document / Code
 */

'use strict';

const STOPWORDS = new Set([
  'this', 'that', 'with', 'from', 'have', 'were', 'what', 'when', 'where',
  'which', 'there', 'their', 'about', 'would', 'could', 'should', 'going'
]);

function tokenize(text = '') {
  if (!text) return new Set();
  const words = text.toLowerCase().match(/\b[a-zA-Z_]{3,}\b/g) || [];
  return new Set(words.filter(w => !STOPWORDS.has(w)));
}

class CrossMaterialAligner {
  /**
   * Build bidirectional alignment graph between audio chunks and slide/code chunks.
   * @param {Object} store - HierarchicalEvidenceStore
   * @param {Number} threshold - Minimum similarity threshold (default: 0.12)
   * @returns {Object} alignmentMap: { [evidenceId]: string[] }
   */
  static buildAlignmentGraph(store, threshold = 0.12) {
    if (!store || !Array.isArray(store.children)) {
      return {};
    }

    const audioChunks = store.children.filter(c => c.sourceType === 'TRANSCRIPT');
    const slideChunks = store.children.filter(c => c.sourceType === 'SLIDE' || c.sourceType === 'CODE');

    const alignmentMap = {};

    for (const a of audioChunks) {
      const aEid = a.evidenceId;
      const aTokens = tokenize(a.text);
      if (aTokens.size === 0) continue;

      const scoredSlides = [];

      for (const s of slideChunks) {
        const sEid = s.evidenceId;
        const sTokens = tokenize(s.text);
        if (sTokens.size === 0) continue;

        // Jaccard similarity
        let overlap = 0;
        for (const t of aTokens) {
          if (sTokens.has(t)) overlap++;
        }
        const unionSize = new Set([...aTokens, ...sTokens]).size;
        const jaccard = overlap / Math.max(1, unionSize);

        // Concept expansion heuristics: map spoken colloquial terms to formal slide terms
        let expandedMatch = false;
        if ((aTokens.has('bottleneck') || aTokens.has('squeeze')) && (sTokens.has('latent') || sTokens.has('dimension'))) {
          expandedMatch = true;
        }
        if ((aTokens.has('divergence') || aTokens.has('kl') || aTokens.has('loss')) && (sTokens.has('kl') || sTokens.has('regularization'))) {
          expandedMatch = true;
        }
        if ((aTokens.has('reparameterization') || aTokens.has('sample')) && (sTokens.has('sampling') || sTokens.has('epsilon'))) {
          expandedMatch = true;
        }

        const score = jaccard + (expandedMatch ? 0.25 : 0.0);
        if (score >= threshold) {
          scoredSlides.push({ score, sEid });
        }
      }

      scoredSlides.sort((x, y) => y.score - x.score);
      alignmentMap[aEid] = scoredSlides.slice(0, 2).map(item => item.sEid);
    }

    // Reverse mapping: Slide / Code -> Audio
    for (const s of slideChunks) {
      const sEid = s.evidenceId;
      const linkedAudio = [];
      for (const [aEid, sEids] of Object.entries(alignmentMap)) {
        if (sEids.includes(sEid)) {
          linkedAudio.push(aEid);
        }
      }
      alignmentMap[sEid] = linkedAudio.slice(0, 2);
    }

    return alignmentMap;
  }

  /**
   * Expand retrieved evidence IDs with cross-modal alignment links to prevent modality dropping.
   * @param {Object} store - HierarchicalEvidenceStore
   * @param {Array<string>} retrievedEvidenceIds - IDs of child chunks retrieved
   * @param {Object} alignmentGraph - Bipartite alignment map
   * @returns {Array<string>} Unique list of expanded evidence IDs
   */
  static expandEvidenceWithAlignment(store, retrievedEvidenceIds = [], alignmentGraph = {}) {
    if (!retrievedEvidenceIds || retrievedEvidenceIds.length === 0) {
      return [];
    }

    const expandedIds = [...retrievedEvidenceIds];

    const hasAudio = retrievedEvidenceIds.some(eid => {
      const c = store?.childMap?.[eid];
      return c ? c.sourceType === 'TRANSCRIPT' : eid.startsWith('E_C') || eid.startsWith('E_CHILD');
    });

    const hasSlide = retrievedEvidenceIds.some(eid => {
      const c = store?.childMap?.[eid];
      return c ? (c.sourceType === 'SLIDE' || c.sourceType === 'CODE') : (eid.startsWith('E_SLIDE') || eid.startsWith('E_CODE'));
    });

    if (hasAudio && !hasSlide) {
      // Inject top linked slide for the primary audio chunk
      const primaryAudio = retrievedEvidenceIds.find(eid => {
        const c = store?.childMap?.[eid];
        return c ? c.sourceType === 'TRANSCRIPT' : eid.startsWith('E_C') || eid.startsWith('E_CHILD');
      });
      if (primaryAudio && alignmentGraph[primaryAudio] && alignmentGraph[primaryAudio].length > 0) {
        expandedIds.push(alignmentGraph[primaryAudio][0]);
      }
    } else if (hasSlide && !hasAudio) {
      // Inject top linked audio for the primary slide chunk
      const primarySlide = retrievedEvidenceIds.find(eid => {
        const c = store?.childMap?.[eid];
        return c ? (c.sourceType === 'SLIDE' || c.sourceType === 'CODE') : (eid.startsWith('E_SLIDE') || eid.startsWith('E_CODE'));
      });
      if (primarySlide && alignmentGraph[primarySlide] && alignmentGraph[primarySlide].length > 0) {
        expandedIds.push(alignmentGraph[primarySlide][0]);
      }
    }

    return Array.from(new Set(expandedIds));
  }
}

module.exports = {
  CrossMaterialAligner,
  tokenize
};
