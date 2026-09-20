/**
 * server/engine/evidence/crossMaterialAligner.js
 *
 * Faithful port of Speech_To_Text/production_engine/experimental/cross_modal/cross_material_aligner.py
 * enhanced with Architecture E Relationship Classification & 5-Tier Priority Hierarchy:
 * - Case 1: Closely Aligned -> LINK + COMBINE (Priority 2)
 * - Case 2: Same Concept, Different Explanation -> LINK + ENRICH (Priority 3)
 * - Case 3: Supporting Code/Data/Diagram -> LINK + SUPPORT (Priority 2/3)
 * - Case 4: Partially Related Document -> Section-level evaluation (Aligned sections = Priority 2, Unaligned = Priority 5)
 * - Case 5: Completely Unrelated -> Priority 5 (Lowest Priority; safely suppressed from target planning without deletion)
 * - Priority Hierarchy: Priority 1 (Voice) > Priority 2 (Aligned Docs) > Priority 3 (Different Explanations) > Priority 4 (Weak Context) > Priority 5 (Unrelated)
 */

'use strict';

const RELATIONSHIP_TYPES = {
  CLOSELY_ALIGNED: 'CLOSELY_ALIGNED',
  DIFFERENT_EXPLANATION: 'DIFFERENT_EXPLANATION',
  SUPPORTING_ARTIFACT: 'SUPPORTING_ARTIFACT',
  PARTIALLY_ALIGNED_SECTION: 'PARTIALLY_ALIGNED_SECTION',
  COMPLETELY_UNRELATED: 'COMPLETELY_UNRELATED'
};

const PRIORITY_LEVELS = {
  PRIORITY_1_VOICE_PRIMARY: 1,
  PRIORITY_2_ALIGNED_MATERIAL: 2,
  PRIORITY_3_DIFFERENT_EXPLANATION: 3,
  PRIORITY_4_WEAK_CONTEXT: 4,
  PRIORITY_5_UNRELATED: 5
};

const STOPWORDS = new Set([
  'this', 'that', 'with', 'from', 'have', 'were', 'what', 'when', 'where',
  'which', 'there', 'their', 'about', 'would', 'could', 'should', 'going',
  'because', 'these', 'those', 'being', 'other', 'the', 'and', 'for', 'are',
  'all', 'not', 'but', 'into', 'than', 'then', 'also', 'each', 'can', 'will',
  'just', 'such', 'only', 'more', 'some', 'any', 'been', 'has', 'had', 'does',
  'did', 'doing', 'our', 'you', 'your', 'they', 'them', 'who', 'how', 'why',
  'today', 'discuss', 'talk', 'learn', 'well', 'here', 'first', 'second',
  'must', 'may', 'might', 'shall', 'ought', 'need', 'used', 'make', 'made',
  'good', 'morning', 'everyone', 'remember', 'rule', 'rules', 'one', 'two', 'three',
  'take', 'taken', 'give', 'given', 'look', 'see', 'let'
]);

function tokenize(text = '') {
  if (!text) return new Set();
  const normalized = String(text).replace(/([a-z])([A-Z])/g, '$1 $2');
  const words = normalized.toLowerCase().match(/\b[a-zA-Z_]{3,}\b/g) || [];
  return new Set(words.filter(w => !STOPWORDS.has(w)));
}

class CrossMaterialAligner {
  static get RELATIONSHIP_TYPES() { return RELATIONSHIP_TYPES; }
  static get PRIORITY_LEVELS() { return PRIORITY_LEVELS; }

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
        if ((aTokens.has('cycle') || aTokens.has('kruskal')) && (sTokens.has('disjoint') || sTokens.has('dsu') || sTokens.has('union'))) {
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
      const primaryAudio = retrievedEvidenceIds.find(eid => {
        const c = store?.childMap?.[eid];
        return c ? c.sourceType === 'TRANSCRIPT' : eid.startsWith('E_C') || eid.startsWith('E_CHILD');
      });
      if (primaryAudio && alignmentGraph[primaryAudio] && alignmentGraph[primaryAudio].length > 0) {
        expandedIds.push(alignmentGraph[primaryAudio][0]);
      }
    } else if (hasSlide && !hasAudio) {
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

  /**
   * Evaluate section-level alignment for multi-section documents (Case 6).
   * Splits document into sections/blocks; evaluates each section independently against voice.
   * @param {string} voiceText - Spoken transcript
   * @param {string} docText - Document content
   * @param {Object} [options]
   * @returns {Array<Object>} Evaluated sections with individual priorities
   */
  static evaluateSectionAlignment(voiceText = '', docText = '', options = {}) {
    if (!docText || !voiceText) return [];
    const vTokens = tokenize(voiceText);
    if (vTokens.size === 0) return [];

    // Split by page marker '--- Page X ---' or double newlines into meaningful blocks (>= 60 chars)
    const rawBlocks = String(docText)
      .split(/\n\s*---\s*Page\s*\d+\s*---\s*\n|\n{2,}/)
      .map(b => b.trim())
      .filter(b => b.length >= 60);

    if (rawBlocks.length <= 1) {
      const bTokens = tokenize(docText);
      const shared = [];
      for (const t of vTokens) {
        if (bTokens.has(t)) shared.push(t);
      }
      const isAligned = shared.length >= (options.minSharedTokens || 4);
      return [{
        sectionIndex: 0,
        text: docText,
        sharedTokens: shared,
        priority: isAligned ? PRIORITY_LEVELS.PRIORITY_2_ALIGNED_MATERIAL : PRIORITY_LEVELS.PRIORITY_5_UNRELATED,
        relationship: isAligned ? RELATIONSHIP_TYPES.CLOSELY_ALIGNED : RELATIONSHIP_TYPES.COMPLETELY_UNRELATED
      }];
    }

    return rawBlocks.map((block, idx) => {
      const bTokens = tokenize(block);
      const shared = [];
      for (const t of vTokens) {
        if (bTokens.has(t)) shared.push(t);
      }

      const minTokenSize = Math.min(vTokens.size, bTokens.size);
      const overlapRatio = minTokenSize > 0 ? (shared.length / minTokenSize) : 0;
      const unionSize = new Set([...vTokens, ...bTokens]).size;
      const jaccard = unionSize > 0 ? (shared.length / unionSize) : 0;

      const isAligned = shared.length >= 3 && (overlapRatio >= 0.12 || jaccard >= 0.05);

      return {
        sectionIndex: idx,
        text: block,
        sharedTokens: shared,
        overlapRatio,
        jaccard,
        priority: isAligned ? PRIORITY_LEVELS.PRIORITY_2_ALIGNED_MATERIAL : PRIORITY_LEVELS.PRIORITY_5_UNRELATED,
        relationship: isAligned ? RELATIONSHIP_TYPES.CLOSELY_ALIGNED : RELATIONSHIP_TYPES.COMPLETELY_UNRELATED
      };
    });
  }

  /**
   * Classify the semantic relationship between spoken voice and supporting material
   * using Architecture E's 5-relationship model and 5-tier priority hierarchy.
   * @param {string} voiceText - Spoken lecture transcript
   * @param {string} docText - Uploaded document / notes text
   * @param {Object} [options]
   * @returns {Object} Relationship decision & priority metadata
   */
  static classifyRelationship(voiceText = '', docText = '', options = {}) {
    const vTokens = tokenize(voiceText);
    const dTokens = tokenize(docText);

    if (vTokens.size === 0 || dTokens.size === 0) {
      return {
        relationship: RELATIONSHIP_TYPES.COMPLETELY_UNRELATED,
        priority: PRIORITY_LEVELS.PRIORITY_5_UNRELATED,
        isAligned: false,
        sharedTokens: [],
        overlapRatio: 0,
        jaccard: 0,
        hasArtifacts: false,
        sections: [],
        reason: 'Insufficient meaningful tokens in voice or document.'
      };
    }

    const shared = [];
    for (const t of vTokens) {
      if (dTokens.has(t)) shared.push(t);
    }

    const minTokenSize = Math.min(vTokens.size, dTokens.size);
    const overlapRatio = minTokenSize > 0 ? (shared.length / minTokenSize) : 0;
    const unionSize = new Set([...vTokens, ...dTokens]).size;
    const jaccard = unionSize > 0 ? (shared.length / unionSize) : 0;

    // Detect technical artifacts (code blocks, equations, tabular tokens)
    const hasCode = /\b(?:def|class|function|const|let|var|import|return|void|public|static)\b|\bfor\s*\(|\bwhile\s*\(/i.test(docText);
    const hasMath = /\\frac|\\sum|\\int|\\sqrt|\\alpha|\\beta|\\theta|\bloss\s*=|entropy|divergence|\bE\s*\[|\bP\(|\bargmax/i.test(docText);
    const hasDiagramHint = /\b(?:figure|diagram|chart|graph|architecture|pipeline|flowchart|table\s*\d+)\b/i.test(docText);
    const hasArtifacts = hasCode || hasMath || hasDiagramHint;

    // Concept expansion heuristics
    let conceptExpansionHit = false;
    if ((vTokens.has('bottleneck') || vTokens.has('squeeze')) && (dTokens.has('latent') || dTokens.has('dimension'))) conceptExpansionHit = true;
    if ((vTokens.has('divergence') || vTokens.has('kl') || vTokens.has('loss')) && (dTokens.has('kl') || dTokens.has('regularization'))) conceptExpansionHit = true;
    if ((vTokens.has('reparameterization') || vTokens.has('sample')) && (dTokens.has('sampling') || dTokens.has('epsilon'))) conceptExpansionHit = true;
    if ((vTokens.has('cycle') || vTokens.has('kruskal')) && (dTokens.has('disjoint') || dTokens.has('dsu') || dTokens.has('union'))) conceptExpansionHit = true;

    // Section-level alignment evaluation for multi-section documents
    const sections = this.evaluateSectionAlignment(voiceText, docText, options);
    const alignedSections = sections.filter(s => s.priority <= 3);
    const hasAlignedSections = alignedSections.length > 0;
    const hasUnrelatedSections = sections.some(s => s.priority === 5);

    let relationship;
    let priority;
    let reason;

    if (hasArtifacts && (shared.length >= 2 || conceptExpansionHit)) {
      relationship = RELATIONSHIP_TYPES.SUPPORTING_ARTIFACT;
      priority = PRIORITY_LEVELS.PRIORITY_2_ALIGNED_MATERIAL;
      reason = `Supporting artifact detected (code/math/diagram) aligned with spoken concepts (${shared.length} shared tokens).`;
    } else if (hasAlignedSections && hasUnrelatedSections) {
      relationship = RELATIONSHIP_TYPES.PARTIALLY_ALIGNED_SECTION;
      priority = PRIORITY_LEVELS.PRIORITY_2_ALIGNED_MATERIAL;
      reason = `Partially related document: ${alignedSections.length}/${sections.length} sections align with lecture; unrelated sections deprioritized to Priority 5.`;
    } else if (shared.length >= 8 && (overlapRatio >= 0.25 || jaccard >= 0.15)) {
      relationship = RELATIONSHIP_TYPES.CLOSELY_ALIGNED;
      priority = PRIORITY_LEVELS.PRIORITY_2_ALIGNED_MATERIAL;
      reason = `Closely aligned: ${shared.length} shared concepts across voice and material (overlap: ${(overlapRatio * 100).toFixed(1)}%).`;
    } else if (conceptExpansionHit || (shared.length >= 4 && overlapRatio >= 0.15)) {
      relationship = RELATIONSHIP_TYPES.DIFFERENT_EXPLANATION;
      priority = PRIORITY_LEVELS.PRIORITY_3_DIFFERENT_EXPLANATION;
      reason = `Same concept with different surface explanation: ${shared.length} shared domain anchors with complementary phrasing.`;
    } else {
      relationship = RELATIONSHIP_TYPES.COMPLETELY_UNRELATED;
      priority = PRIORITY_LEVELS.PRIORITY_5_UNRELATED;
      reason = `Completely unrelated material: only ${shared.length} shared tokens. Assigned Priority 5 (Lowest Priority).`;
    }

    const isAligned = priority <= 3;

    return {
      relationship,
      priority,
      isAligned,
      sharedTokens: shared,
      overlapRatio,
      jaccard,
      hasArtifacts,
      sections,
      reason
    };
  }

  /**
   * Evaluate semantic alignment between spoken audio transcript and an uploaded document/material.
   * Backward-compatible with existing callers in EvidencePackager.
   */
  static evaluateDocumentAlignment(voiceText = '', docText = '', options = {}) {
    const classification = this.classifyRelationship(voiceText, docText, options);
    return {
      isAligned: classification.isAligned,
      sharedTokens: classification.sharedTokens,
      overlapRatio: classification.overlapRatio,
      jaccard: classification.jaccard,
      score: classification.jaccard,
      relationship: classification.relationship,
      priority: classification.priority,
      sections: classification.sections,
      reason: classification.reason
    };
  }
}

module.exports = {
  CrossMaterialAligner,
  tokenize,
  RELATIONSHIP_TYPES,
  PRIORITY_LEVELS
};
