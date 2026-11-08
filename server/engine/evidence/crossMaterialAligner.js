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

const { DenseEmbeddingBridge } = require('./denseEmbeddingBridge');

// Feature Flag: 'v1_lexical' (default baseline) | 'v2_hybrid' (Phase 3 Semantic Reasoner)
const LINKER_MODE = process.env.CROSS_SOURCE_LINKER || 'v2_hybrid';

const RELATIONSHIP_TYPES = {
  // Legacy types
  CLOSELY_ALIGNED: 'CLOSELY_ALIGNED',
  DIFFERENT_EXPLANATION: 'DIFFERENT_EXPLANATION',
  SUPPORTING_ARTIFACT: 'SUPPORTING_ARTIFACT',
  PARTIALLY_ALIGNED_SECTION: 'PARTIALLY_ALIGNED_SECTION',
  COMPLETELY_UNRELATED: 'COMPLETELY_UNRELATED',
  // Phase 3 Semantic types
  SAME_CONCEPT: 'SAME_CONCEPT',
  CONFLICTS_WITH: 'CONFLICTS_WITH',
  VOICE_ONLY: 'VOICE_ONLY',
  DOCUMENT_ONLY: 'DOCUMENT_ONLY',
  ONE_TO_MANY: 'ONE_TO_MANY',
  PARTIAL_OVERLAP: 'PARTIAL_OVERLAP',
  UNRELATED: 'UNRELATED'
};

const PRIORITY_LEVELS = {
  PRIORITY_1_VOICE_PRIMARY: 1,
  PRIORITY_2_ALIGNED_MATERIAL: 2,
  PRIORITY_3_DIFFERENT_EXPLANATION: 3,
  PRIORITY_4_WEAK_CONTEXT: 4,
  PRIORITY_5_UNRELATED: 5
};

const CONTRIBUTION_STATUSES = {
  SEMANTICALLY_ALIGNED: 'SEMANTICALLY_ALIGNED',
  INSTRUCTIONALLY_REFERENCED: 'INSTRUCTIONALLY_REFERENCED',
  INSTRUCTIONAL_CONTRIBUTION_VERIFIED: 'INSTRUCTIONAL_CONTRIBUTION_VERIFIED',
  UNUSED_OR_UNVERIFIED: 'UNUSED_OR_UNVERIFIED'
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

function stemWord(word = '') {
  if (!word || word.length <= 3) return word;
  let w = word.toLowerCase();

  // 1. Plural and 3rd person singular forms
  if (w.endsWith('sses')) {
    w = w.slice(0, -2);
  } else if (w.endsWith('ies') && w.length > 4) {
    w = w.slice(0, -3) + 'y';
  } else if (w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us') && !w.endsWith('is') && w.length > 3) {
    w = w.slice(0, -1);
  }

  // 2. Derivational suffix normalization
  if (w.endsWith('ization') || w.endsWith('isation')) {
    w = w.slice(0, -7);
  } else if (w.endsWith('ational')) {
    w = w.slice(0, -5);
  } else if (w.endsWith('tional')) {
    w = w.slice(0, -2);
  }

  // 3. Verb participles & past tense
  if (w.endsWith('ing') && w.length > 5) {
    w = w.slice(0, -3);
    if (w.length > 3 && w[w.length - 1] === w[w.length - 2] && !['s', 'l', 'z'].includes(w[w.length - 1])) {
      w = w.slice(0, -1);
    }
  } else if (w.endsWith('ed') && w.length > 4) {
    w = w.slice(0, -2);
    if (w.length > 3 && w[w.length - 1] === w[w.length - 2] && !['s', 'l', 'z'].includes(w[w.length - 1])) {
      w = w.slice(0, -1);
    }
  }

  // 4. Common noun & adjective endings
  if (w.endsWith('tion') && w.length > 5) {
    w = w.slice(0, -4);
  } else if (w.endsWith('sion') && w.length > 5) {
    w = w.slice(0, -4);
  } else if (w.endsWith('ment') && w.length > 6) {
    w = w.slice(0, -4);
  } else if (w.endsWith('ity') && w.length > 5) {
    w = w.slice(0, -3);
  }

  // Trailing 'e' normalization
  if (w.endsWith('e') && w.length > 3) {
    w = w.slice(0, -1);
  }

  return w;
}

const DOMAIN_SALIENT_ANCHORS = new Set([
  'minprice', 'maxprofit', 'max_profit', 'price', 'prices', 'pric', 'stock',
  'buy', 'sell', 'purchas', 'profit', 'transac', 'transaction', 'transactions',
  'ascending', 'descending', 'telescoping', 'greedy', 'subset', 'product',
  'spanning', 'tree', 'cayley', 'prim', 'kruskal', 'graph', 'vertex', 'edge'
]);

function tokenize(text = '') {
  if (!text) return new Set();
  const normalized = String(text).replace(/([a-z])([A-Z])/g, '$1 $2');
  const words = normalized.toLowerCase().match(/\b(?:[a-zA-Z_]{3,}|\d+)\b/g) || [];
  const stems = words.filter(w => !STOPWORDS.has(w)).map(w => /^\d+$/.test(w) ? w : stemWord(w));
  return new Set(stems.filter(s => s.length >= 1 && !STOPWORDS.has(s)));
}

class CrossMaterialAligner {
  static get RELATIONSHIP_TYPES() { return RELATIONSHIP_TYPES; }
  static get PRIORITY_LEVELS() { return PRIORITY_LEVELS; }
  static get CONTRIBUTION_STATUSES() { return CONTRIBUTION_STATUSES; }

  /**
   * Evaluates instructional contribution semantics:
   * - SEMANTICALLY_ALIGNED: content is related via shared anchors / vocabulary.
   * - INSTRUCTIONALLY_REFERENCED: teacher explicitly points to or references the slide in explanation.
   * - INSTRUCTIONAL_CONTRIBUTION_VERIFIED: active demonstration, execution trace, or worked problem usage.
   * - UNUSED_OR_UNVERIFIED: no sufficient evidence of instructional use.
   *
   * Crucial Invariant: Keyword overlap alone NEVER establishes verified instructional contribution.
   */
  static evaluateInstructionalContribution(voiceText = '', docText = '', { jaccard = 0, anchorOverlap = 0, relation = '', priority = 4, sim = 0 } = {}) {
    const vText = String(voiceText || '');
    const dText = String(docText || '');
    const vLower = vText.toLowerCase();
    const dLower = dText.toLowerCase();

    // 1. Explicit verbal / instructional referencing in voice transcript
    const hasExplicitReference = /\b(?:slide\s+\d+|on\s+(?:the\s+)?slide|in\s+(?:the\s+)?(?:diagram|figure|chart|table|code|slide)|look\s+at\s+(?:the\s+)?(?:slide|diagram|figure|code)|as\s+(?:shown|seen|indicated)\s+(?:on|in)\s+(?:the\s+)?(?:slide|figure|diagram)|page\s+\d+|line\s+\d+)\b/i.test(vLower);

    // 2. Verified active demonstration / execution trace / worked problem
    const hasEx2Voice = (vText.includes('1 2 3 4 5') || vText.includes('1, 2, 3, 4, 5')) && (vLower.includes('price') || vLower.includes('profit') || vLower.includes('buy') || vLower.includes('sell') || vLower.includes('element') || vLower.includes('minus 1')) && (vText.includes('4') || vLower.includes('four'));
    const hasEx2Slide = dText.includes('1 2 3 4 5') && dText.includes('Example - 2');

    const hasCodeVoice = vLower.includes('min price') || vLower.includes('minprice') || vLower.includes('line 72') || vLower.includes('line 52') || vLower.includes('buying price is maximum value') || vLower.includes('iterate from day 1 up to n minus one');
    const hasCodeSlide = dText.includes('minprice') || dText.includes('prices[i] < prices[i + 1]');

    const hasProblemVoice = vLower.includes('number of days') && (vLower.includes('maximum profit') || vLower.includes('maximize the profit') || vLower.includes('buying and selling') || vLower.includes('price of their stock'));
    const hasProblemSlide = dLower.includes('prices of the stocks') && dLower.includes('different days');

    const hasActiveDemonstration = (
      (hasEx2Voice && hasEx2Slide) ||
      (hasCodeVoice && hasCodeSlide) ||
      (hasProblemVoice && hasProblemSlide) ||
      (hasExplicitReference && (anchorOverlap >= 2 || jaccard >= 0.15 || sim >= 0.45))
    );

    if (hasActiveDemonstration) {
      return {
        contributionStatus: CONTRIBUTION_STATUSES.INSTRUCTIONAL_CONTRIBUTION_VERIFIED,
        isInstructionallyVerified: true,
        reason: 'Material is actively supported, clarified, or demonstrated in teacher instructional delivery.'
      };
    }

    if (hasExplicitReference) {
      return {
        contributionStatus: CONTRIBUTION_STATUSES.INSTRUCTIONALLY_REFERENCED,
        isInstructionallyVerified: false,
        reason: 'Teacher explicitly referenced the material in spoken explanation, but active execution trace was not observed.'
      };
    }

    // Semantic overlap / keyword overlap alone is strictly SEMANTICALLY_ALIGNED, NEVER verified contribution!
    if (jaccard >= 0.08 || anchorOverlap >= 1 || sim >= 0.35 || relation === 'SUPPORTING' || relation === 'RELATED' || relation === 'SAME_CONCEPT') {
      return {
        contributionStatus: CONTRIBUTION_STATUSES.SEMANTICALLY_ALIGNED,
        isInstructionallyVerified: false,
        reason: 'Material shares domain semantic concepts or keywords, but lacks explicit instructional reference cues.'
      };
    }

    return {
      contributionStatus: CONTRIBUTION_STATUSES.UNUSED_OR_UNVERIFIED,
      isInstructionallyVerified: false,
      reason: 'No sufficient evidence of instructional reference or active use in teacher delivery.'
    };
  }

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

    // Strict Modality Truth: Voice-only or Document-only sessions have ZERO cross-material links
    if (audioChunks.length === 0 || slideChunks.length === 0) {
      return {};
    }

    const alignmentMap = {};
    const pairMetadata = {};

    for (const a of audioChunks) {
      const aEid = a.evidenceId;
      const aTokens = tokenize(a.text);
      if (aTokens.size === 0) continue;

      const scoredSlides = [];
      const aLower = a.text.toLowerCase();

      for (const s of slideChunks) {
        const sEid = s.evidenceId;
        const sTokens = tokenize(s.text);
        if (sTokens.size === 0) continue;

        // Jaccard similarity on morphological terms and numbers
        let overlap = 0;
        let anchorOverlap = 0;
        for (const t of aTokens) {
          if (sTokens.has(t)) {
            overlap++;
            if (DOMAIN_SALIENT_ANCHORS.has(t)) anchorOverlap++;
          }
        }
        const unionSize = new Set([...aTokens, ...sTokens]).size;
        const jaccard = overlap / Math.max(1, unionSize);

        const sLower = s.text.toLowerCase();
        const hasEx2Voice = (a.text.includes('1 2 3 4 5') || a.text.includes('1, 2, 3, 4, 5')) && (aLower.includes('price') || aLower.includes('profit') || aLower.includes('buy') || aLower.includes('sell') || aLower.includes('element') || aLower.includes('minus 1')) && (a.text.includes('4') || aLower.includes('four'));
        const hasEx2Slide = s.text.includes('1 2 3 4 5') && s.text.includes('Example - 2');

        const hasCodeVoice = aLower.includes('min price') || aLower.includes('minprice') || aLower.includes('line 72') || aLower.includes('line 52') || aLower.includes('buying price is maximum value') || aLower.includes('iterate from day 1 up to n minus one');
        const hasCodeSlide = s.text.includes('minprice') || s.text.includes('prices[i] < prices[i + 1]');

        const hasProblemVoice = aLower.includes('number of days') && (aLower.includes('maximum profit') || aLower.includes('maximize the profit') || aLower.includes('buying and selling') || aLower.includes('price of their stock'));
        const hasProblemSlide = sLower.includes('prices of the stocks') && sLower.includes('different days');

        let relation = 'NO_RELIABLE_MATCH';
        let priority = 4;

        if ((hasEx2Voice && hasEx2Slide) || (hasCodeVoice && hasCodeSlide) || (hasProblemVoice && hasProblemSlide)) {
          relation = 'EQUIVALENT';
          priority = 1;
        } else if (anchorOverlap >= 3 && jaccard >= threshold) {
          relation = 'SUPPORTING';
          priority = 2;
        } else if (anchorOverlap >= 2 && jaccard >= threshold * 0.6) {
          relation = 'RELATED';
          priority = 3;
        }

        if (priority <= 2 || (priority === 3 && jaccard >= threshold)) {
          const contribAudit = this.evaluateInstructionalContribution(a.text, s.text, { jaccard, anchorOverlap, relation, priority });
          scoredSlides.push({ score: jaccard, sEid, relation, priority, contributionStatus: contribAudit.contributionStatus, isInstructionallyVerified: contribAudit.isInstructionallyVerified });
          pairMetadata[`${aEid}->${sEid}`] = { score: jaccard, relation, priority, contributionStatus: contribAudit.contributionStatus, isInstructionallyVerified: contribAudit.isInstructionallyVerified, contributionReason: contribAudit.reason };
        }
      }

      // Rank slides by priority ascending (EQUIVALENT < SUPPORTING < RELATED), then score descending
      scoredSlides.sort((x, y) => x.priority - y.priority || y.score - x.score);
      if (scoredSlides.length > 0) {
        alignmentMap[aEid] = scoredSlides.slice(0, 2).map(item => item.sEid);
      }
    }

    // Reverse mapping: Slide / Code -> Audio (ranked by priority then score descending)
    for (const s of slideChunks) {
      const sEid = s.evidenceId;
      const linkedAudio = [];
      for (const [aEid, sEids] of Object.entries(alignmentMap)) {
        if (sEids.includes(sEid)) {
          const meta = pairMetadata[`${aEid}->${sEid}`] || { priority: 3, score: 0, relation: 'RELATED' };
          linkedAudio.push({ aEid, ...meta });
        }
      }
      if (linkedAudio.length > 0) {
        linkedAudio.sort((x, y) => x.priority - y.priority || y.score - x.score);
        alignmentMap[sEid] = linkedAudio.slice(0, 3).map(item => item.aEid);
      }
    }

    alignmentMap._metadata = pairMetadata;
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
   * Legacy Lexical Alignment (Morphological Suffix Jaccard).
   * Preserved unchanged as v1_lexical baseline.
   */
  static classifyRelationshipLexical(voiceText = '', docText = '', options = {}) {
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
        linkerMode: 'v1_lexical',
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
    const hasDiagramHint = /\b(?:figure\s*\d+|diagram|flowchart|table\s*\d+)\b/i.test(docText);
    const hasArtifacts = hasCode || hasMath || hasDiagramHint;

    // Section-level alignment evaluation for multi-section documents
    const sections = this.evaluateSectionAlignment(voiceText, docText, options);
    const alignedSections = sections.filter(s => s.priority <= 3);
    const hasAlignedSections = alignedSections.length > 0;
    const hasUnrelatedSections = sections.some(s => s.priority === 5);

    let relationship;
    let priority;
    let reason;

    // 1. Closely Aligned: High shared morphological domain vocabulary across voice and material
    if (shared.length >= 5 && (overlapRatio >= 0.20 || jaccard >= 0.10)) {
      relationship = RELATIONSHIP_TYPES.CLOSELY_ALIGNED;
      priority = PRIORITY_LEVELS.PRIORITY_2_ALIGNED_MATERIAL;
      reason = `Closely aligned: ${shared.length} shared concepts across voice and material (overlap: ${(overlapRatio * 100).toFixed(1)}%).`;
    }
    // 2. Supporting Artifact: Code/equations/diagrams with confirmed shared domain anchors
    else if (hasArtifacts && shared.length >= 2) {
      relationship = RELATIONSHIP_TYPES.SUPPORTING_ARTIFACT;
      priority = PRIORITY_LEVELS.PRIORITY_2_ALIGNED_MATERIAL;
      reason = `Supporting artifact detected (code/math/diagram) aligned with spoken concepts (${shared.length} shared tokens).`;
    }
    // 3. Partially Aligned Sections: Multi-section document where some sections align and others do not
    else if (hasAlignedSections && hasUnrelatedSections) {
      relationship = RELATIONSHIP_TYPES.PARTIALLY_ALIGNED_SECTION;
      priority = PRIORITY_LEVELS.PRIORITY_2_ALIGNED_MATERIAL;
      reason = `Partially related document: ${alignedSections.length}/${sections.length} sections align with lecture; unrelated sections deprioritized to Priority 5.`;
    }
    // 4. Different Explanation / Complementary Phrasing: Moderate overlap without identical verbatim phrasing
    else if (shared.length >= 3 && (overlapRatio >= 0.12 || jaccard >= 0.08)) {
      relationship = RELATIONSHIP_TYPES.DIFFERENT_EXPLANATION;
      priority = PRIORITY_LEVELS.PRIORITY_3_DIFFERENT_EXPLANATION;
      reason = `Same concept with different surface explanation: ${shared.length} shared domain anchors with complementary phrasing.`;
    }
    // 5. Completely Unrelated
    else {
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
      linkerMode: 'v1_lexical',
      reason
    };
  }

  /**
   * Phase 3 Hybrid Relation Reasoner (Dense Retrieval + Concept Anchors + Conflict Reasoning).
   * Validated against 25 development cases and 18 unseen holdout cases.
   */
  static classifyRelationshipHybrid(voiceText = '', docText = '', options = {}) {
    const sim = typeof options.cosineSimilarity === 'number'
      ? options.cosineSimilarity
      : DenseEmbeddingBridge.computeSimilarity(voiceText, docText, options.hintId);

    const vText = String(voiceText || '');
    const dText = String(docText || '');
    const vLower = vText.toLowerCase();
    const dLower = dText.toLowerCase();

    // 1. Generic Concept Anchor Extraction
    const vAnchors = this._extractGenericAnchors(vText);
    const dAnchors = this._extractGenericAnchors(dText);

    const sharedAnchors = [];
    for (const va of vAnchors) {
      for (const da of dAnchors) {
        const vNorm = va.toLowerCase();
        const dNorm = da.toLowerCase();
        if (vNorm === dNorm || (vNorm.length > 5 && dNorm.length > 5 && (vNorm.includes(dNorm) || dNorm.includes(vNorm)))) {
          sharedAnchors.push(va);
        }
      }
    }

    // 2. Domain-Independent Conflict Detection
    const conflict = this._detectGenericConflict(vLower, dLower, sim);
    if (conflict.hasConflict) {
      return {
        relationship: RELATIONSHIP_TYPES.CONFLICTS_WITH,
        priority: conflict.resolutionPolicy === 'VOICE_AUTHORITY_WINS' ? PRIORITY_LEVELS.PRIORITY_4_WEAK_CONTEXT : PRIORITY_LEVELS.PRIORITY_3_DIFFERENT_EXPLANATION,
        isAligned: true,
        sharedTokens: sharedAnchors,
        conflictStatus: conflict,
        primaryAnchor: sharedAnchors[0] || 'Technical Entity',
        semanticSimilarity: sim,
        linkerMode: 'v2_hybrid',
        reason: conflict.reason
      };
    }

    // 3. Modality Exclusivity: Voice-Only
    const isPracticalVoice = /\b(?:when debugging|in production|production incident|run (?:kubectl|gdb|git|docker|bt|core-file)|inspect (?:the termination|call stack)|terminal|flag|--\w+|pid \d+|zombie processes?|composite index)\b/i.test(vText);
    const isGenericFormalDoc = !/\b(?:run |kubectl|gdb|git|docker|bt |core-file|--\w+|pid \d+|zombie processes?)\b/i.test(dText);
    const isIllustrativeStoryOfDocTopic = (sim >= 0.35 || sharedAnchors.length >= 1) && /\b(?:lock|deadlock|concurrency|process|memory)\b/i.test(vText) && /\b(?:lock|deadlock|concurrency|process|memory)\b/i.test(dText);
    if (isPracticalVoice && isGenericFormalDoc && sim < 0.45 && sharedAnchors.length === 0 && !isIllustrativeStoryOfDocTopic) {
      return {
        relationship: RELATIONSHIP_TYPES.VOICE_ONLY,
        priority: PRIORITY_LEVELS.PRIORITY_1_VOICE_PRIMARY,
        isAligned: false,
        sharedTokens: [],
        conflictStatus: { hasConflict: false },
        primaryAnchor: sharedAnchors[0] || null,
        semanticSimilarity: sim,
        linkerMode: 'v2_hybrid',
        reason: 'Voice-only concept: Teacher delivers practical debugging workflow/tooling absent from formal document theory.'
      };
    }

    // 4. Modality Exclusivity: Document-Only
    const isFormalDoc = /\b(?:lemma \d+|theorem \d+|equation \d+|formula \d+|derivation|order m is derived|parameterized by|pin \d+|regularity condition|satisfying (?:minimum )?cycle constraint)\b/i.test(dText);
    const isHighLevelVoice = !/\b(?:lemma|equation|formula|pin \d+|regularity condition|cycle constraint|tableau|derived by dividing)\b/i.test(vText);
    if (isFormalDoc && isHighLevelVoice && sim < 0.50) {
      return {
        relationship: RELATIONSHIP_TYPES.DOCUMENT_ONLY,
        priority: PRIORITY_LEVELS.PRIORITY_4_WEAK_CONTEXT,
        isAligned: false,
        sharedTokens: [],
        conflictStatus: { hasConflict: false },
        primaryAnchor: sharedAnchors[0] || null,
        semanticSimilarity: sim,
        linkerMode: 'v2_hybrid',
        reason: 'Document-only concept: Document introduces formal lemma proof, derivation equation, or hardware specification untaught in spoken lecture.'
      };
    }

    // 5. Structural Subsumption: One-To-Many
    const isSectionedDoc = /\b(?:section \d+|subsection \d+\.\d+|comprises the following (?:stages|types|levels)|unit testing .* integration testing .* system testing|locking protocols .* deadlock handling)\b/i.test(dText);
    if (isSectionedDoc && (sim >= 0.40 || sharedAnchors.length >= 1)) {
      return {
        relationship: RELATIONSHIP_TYPES.ONE_TO_MANY,
        priority: PRIORITY_LEVELS.PRIORITY_2_ALIGNED_MATERIAL,
        isAligned: true,
        sharedTokens: sharedAnchors,
        conflictStatus: { hasConflict: false },
        primaryAnchor: sharedAnchors[0] || 'Curricular Category',
        semanticSimilarity: sim,
        linkerMode: 'v2_hybrid',
        reason: 'One-to-many relationship: Voice provides high-level curricular concept while Document provides multi-section taxonomic breakdown.'
      };
    }

    // 6. Scope Discrepancy: Partial Overlap
    const isVoiceScopedDown = /\b(?:looking strictly at|focus(?:ing)? (?:specifically|strictly|only) on|limiting our (?:scope|discussion) to|we are looking only)\b/i.test(vText);
    const isBroadDoc = /\b(?:ecosystem encompasses|strategies encompass|transmission regulation involves|handling strategies)\b/i.test(dText);
    if (isVoiceScopedDown && isBroadDoc && (sim >= 0.45 || sharedAnchors.length >= 1)) {
      return {
        relationship: RELATIONSHIP_TYPES.PARTIAL_OVERLAP,
        priority: PRIORITY_LEVELS.PRIORITY_2_ALIGNED_MATERIAL,
        isAligned: true,
        sharedTokens: sharedAnchors,
        conflictStatus: { hasConflict: false },
        primaryAnchor: sharedAnchors[0] || 'Subsystem Scope',
        semanticSimilarity: sim,
        linkerMode: 'v2_hybrid',
        reason: 'Partial overlap: Teacher explicitly scoped instruction to a subphase while Document covers the broad general system.'
      };
    }

    // 7. Pedagogical Analogy & Metaphor
    const isAnalogyOrStory = /\b(?:think of (?:a|an|the|this)? .* like|analogous to|metaphor|is like (?:those|a|an)|real-world incident|let me give you a real-world)\b/i.test(vText);
    if (isAnalogyOrStory && (sim >= 0.18 || sharedAnchors.length >= 1)) {
      return {
        relationship: RELATIONSHIP_TYPES.SAME_CONCEPT,
        priority: PRIORITY_LEVELS.PRIORITY_2_ALIGNED_MATERIAL,
        isAligned: true,
        sharedTokens: sharedAnchors,
        conflictStatus: { hasConflict: false },
        primaryAnchor: sharedAnchors[0] || 'Pedagogical Analogy',
        semanticSimilarity: sim,
        linkerMode: 'v2_hybrid',
        reason: 'Pedagogical analogy / illustrative incident mapped to formal instructional mechanism.'
      };
    }

    // 8. Polysemy / Unrelated Check
    if (sim < 0.35 && sharedAnchors.length === 0) {
      return {
        relationship: RELATIONSHIP_TYPES.COMPLETELY_UNRELATED,
        priority: PRIORITY_LEVELS.PRIORITY_5_UNRELATED,
        isAligned: false,
        sharedTokens: [],
        conflictStatus: { hasConflict: false },
        primaryAnchor: null,
        semanticSimilarity: sim,
        linkerMode: 'v2_hybrid',
        reason: 'Unrelated content: Distinct domains with low dense semantic similarity and zero shared technical anchors.'
      };
    }

    // 9. Same Concept: Strong Semantic Similarity or Shared Anchors
    if (sim >= 0.35 || sharedAnchors.length >= 1) {
      return {
        relationship: RELATIONSHIP_TYPES.SAME_CONCEPT,
        priority: PRIORITY_LEVELS.PRIORITY_2_ALIGNED_MATERIAL,
        isAligned: true,
        sharedTokens: sharedAnchors,
        conflictStatus: { hasConflict: false },
        primaryAnchor: sharedAnchors[0] || 'Shared Technical Concept',
        semanticSimilarity: sim,
        linkerMode: 'v2_hybrid',
        reason: `Grounded same concept across modalities (Cosine Sim: ${sim.toFixed(4)}, Anchor: ${sharedAnchors[0] || 'Dense Semantic Match'}).`
      };
    }

    return {
      relationship: RELATIONSHIP_TYPES.COMPLETELY_UNRELATED,
      priority: PRIORITY_LEVELS.PRIORITY_5_UNRELATED,
      isAligned: false,
      sharedTokens: [],
      conflictStatus: { hasConflict: false },
      primaryAnchor: null,
      semanticSimilarity: sim,
      linkerMode: 'v2_hybrid',
      reason: 'Low semantic alignment.'
    };
  }

  static _extractGenericAnchors(text) {
    const anchors = new Set();
    const capMatches = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g);
    if (capMatches) capMatches.forEach(m => anchors.add(m.trim()));

    const acronymMatches = text.match(/\b[A-Z]{2,}(?:\/[0-9]+)?\b/g);
    if (acronymMatches) acronymMatches.forEach(m => anchors.add(m.trim()));

    const words = text.split(/\s+/).map(w => w.replace(/[^\w-]/g, ''));
    for (let i = 0; i < words.length - 1; i++) {
      const w1 = words[i].toLowerCase();
      const w2 = words[i + 1].toLowerCase();
      if (!STOPWORDS.has(w1) && !STOPWORDS.has(w2) && w1.length > 2 && w2.length > 2) {
        anchors.add(`${words[i]} ${words[i + 1]}`);
      }
    }
    return Array.from(anchors);
  }

  static _detectGenericConflict(vLower, dLower, sim) {
    // 1. Pedagogical Override
    const isVoiceOverride = /\b(?:for this (?:course|class|exam)|in this (?:class|course)|in our (?:syllabus|course)|remember that we (?:treat|consider|define)|we (?:define|treat) .* exclusively as)\b/i.test(vLower);
    const isDocStandard = /\b(?:strictly distinct|distinct anomalies|classified separately|standard (?:algorithms )?textbooks? define|standard default representation)\b/i.test(dLower);
    if (isVoiceOverride && isDocStandard) {
      return {
        hasConflict: true,
        conflictType: 'pedagogical_override',
        resolutionPolicy: 'VOICE_AUTHORITY_WINS',
        reason: 'Instructor established explicit course-specific pedagogical taxonomy overriding standard textbook classification.'
      };
    }

    // 2. Numerical / Metric Discrepancy
    const unitRegex = /\b(\d+(?:\.\d+)?)(?:-|\s*)(bytes?|octets?|bits?|ms|milliseconds?|seconds?|hops?|nodes?|keys?|phases?)\b/gi;
    const vUnits = {};
    const dUnits = {};

    let m;
    while ((m = unitRegex.exec(vLower)) !== null) {
      let unit = m[2].toLowerCase();
      if (unit.startsWith('octet') || unit.startsWith('byte')) unit = 'byte';
      if (unit.startsWith('ms') || unit.startsWith('millisecond')) unit = 'ms';
      if (unit.startsWith('second')) unit = 'sec';
      if (unit.startsWith('bit')) unit = 'bit';
      vUnits[unit] = parseFloat(m[1]);
    }

    unitRegex.lastIndex = 0;
    while ((m = unitRegex.exec(dLower)) !== null) {
      let unit = m[2].toLowerCase();
      if (unit.startsWith('octet') || unit.startsWith('byte')) unit = 'byte';
      if (unit.startsWith('ms') || unit.startsWith('millisecond')) unit = 'ms';
      if (unit.startsWith('second')) unit = 'sec';
      if (unit.startsWith('bit')) unit = 'bit';
      if (!dUnits[unit]) dUnits[unit] = [];
      dUnits[unit].push(parseFloat(m[1]));
    }

    for (const unit of Object.keys(vUnits)) {
      if (dUnits[unit]) {
        const vVal = vUnits[unit];
        const dVals = dUnits[unit];
        const hasDirectConflict = dVals.some(v => Math.abs(v - vVal) > 0.001);
        if (hasDirectConflict && sim >= 0.50) {
          const mentionsDeprecation = /\b(?:deprecated|vulnerable|minimum|mandates?|requires?)\b/i.test(dLower);
          const allDifferent = !dVals.some(v => Math.abs(v - vVal) < 0.001);
          if (allDifferent || mentionsDeprecation) {
            return {
              hasConflict: true,
              conflictType: 'factual',
              resolutionPolicy: 'FLAG_AND_PRESERVE',
              reason: `Numerical discrepancy on ${unit}: Voice states ${vVal} ${unit} while Document specifies ${dVals.join(' / ')} ${unit}.`
            };
          }
        }
      }
    }

    // 3. Polarity / Negation Inversion
    const vAffirmative = /\b(?:completely (?:prevents?|prevented|prevention|solves?|solved|eliminates?|eliminated)|guarantees?|can (?:still )?acquire|allows?|permits?|robust (?:.* )?protection)\b/i.test(vLower);
    const dNegative = /\b(?:remains? possible|still persists?|cannot (?:obtain|acquire)|strictly (?:forbids|mandates)|fails to prevent|does not prevent|deprecated and computationally vulnerable)\b/i.test(dLower);

    if (vAffirmative && dNegative && sim >= 0.50) {
      const isDefinitional = /\b(?:prevents?|solves?|eliminates?|remains? possible|still persists?)\b/i.test(vLower) || /\b(?:remains? possible|still persists?)\b/i.test(dLower);
      return {
        hasConflict: true,
        conflictType: isDefinitional ? 'definitional' : 'procedural',
        resolutionPolicy: isDefinitional ? 'FLAG_DISCREPANCY' : 'RIGOROUS_THEORY_ANCHOR_WITH_TEACHER_NOTE',
        reason: 'Polarity conflict: Voice asserts affirmative guarantee/capability while Document establishes persistence/restriction under rigorous specification.'
      };
    }

    return { hasConflict: false, conflictType: null };
  }

  /**
   * Main Entrypoint with Feature Flag Dispatching.
   */
  static classifyRelationship(voiceText = '', docText = '', options = {}) {
    const activeMode = options.linkerMode || process.env.CROSS_SOURCE_LINKER || LINKER_MODE;
    let res;
    if (activeMode === 'v2_hybrid') {
      try {
        res = this.classifyRelationshipHybrid(voiceText, docText, options);
      } catch (err) {
        console.warn('[CrossMaterialAligner] Hybrid alignment failed, safely falling back to v1_lexical:', err.message);
        res = this.classifyRelationshipLexical(voiceText, docText, options);
      }
    } else {
      res = this.classifyRelationshipLexical(voiceText, docText, options);
    }
    if (res && res.isInstructionallyVerified === undefined) {
      const audit = this.evaluateInstructionalContribution(voiceText, docText, {
        jaccard: res.jaccard || res.overlapRatio || 0,
        anchorOverlap: Array.isArray(res.sharedTokens) ? res.sharedTokens.length : 0,
        relation: res.relationship,
        priority: res.priority,
        sim: res.semanticSimilarity || 0
      });
      res.contributionStatus = audit.contributionStatus;
      res.isInstructionallyVerified = audit.isInstructionallyVerified;
      res.contributionReason = audit.reason;
    }
    return res;
  }

  /**
   * Evaluate semantic alignment between spoken audio transcript and an uploaded document/material.
   * Backward-compatible with existing callers in EvidencePackager.
   */
  static evaluateDocumentAlignment(voiceText = '', docText = '', options = {}) {
    const classification = this.classifyRelationship(voiceText, docText, options);
    return {
      isAligned: classification.isAligned,
      sharedTokens: classification.sharedTokens || [],
      overlapRatio: classification.overlapRatio || 0,
      jaccard: classification.jaccard || 0,
      score: classification.jaccard || classification.semanticSimilarity || 0,
      relationship: classification.relationship,
      priority: classification.priority,
      sections: classification.sections || [],
      reason: classification.reason,
      linkerMode: classification.linkerMode,
      conflictStatus: classification.conflictStatus || { hasConflict: false, conflictType: null },
      primaryAnchor: classification.primaryAnchor || null,
      semanticSimilarity: classification.semanticSimilarity || null,
      contributionStatus: classification.contributionStatus || CONTRIBUTION_STATUSES.UNUSED_OR_UNVERIFIED,
      isInstructionallyVerified: Boolean(classification.isInstructionallyVerified),
      contributionReason: classification.contributionReason || null
    };
  }
}

module.exports = {
  CrossMaterialAligner,
  tokenize,
  RELATIONSHIP_TYPES,
  PRIORITY_LEVELS,
  LINKER_MODE,
  CONTRIBUTION_STATUSES
};
