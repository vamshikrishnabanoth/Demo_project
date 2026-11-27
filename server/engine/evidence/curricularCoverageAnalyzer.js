/**
 * server/engine/evidence/curricularCoverageAnalyzer.js
 *
 * PRE-GENERATION CURRICULAR COVERAGE ANALYZER
 *
 * Core Research Question for Step 5:
 * "What concepts do I legitimately have enough instructional evidence to ask questions about?"
 *
 * Key Invariants:
 * 1. SEPARATION OF CONCERNS:
 *    - Coverage Analyzer evaluates assessability & evidence breadth: Sufficient vs. Inadequate vs. No Coverage.
 *    - Difficulty Feasibility remains strictly inside IntentRelativeReasoner (v2 engine).
 *    - CurricularCoverageAnalyzer produces NO eligibleDifficulties field.
 * 2. MENTIONED != TAUGHT != SUFFICIENTLY ASSESSABLE:
 *    - Passing name-drops, future teasers ("we'll discuss that later"), or rhetorical mentions
 *      without explanatory substance are classified as MENTIONED_ONLY (No coverage).
 *    - Isolated single facts without mechanisms or depth are classified as INADEQUATE.
 *    - Substantive explanations with mechanisms, rules, or tradeoffs are classified as SUFFICIENT.
 * 3. EXPLICIT EXCLUSION HANDLING:
 *    - Explicitly excluded concepts (e.g. "Don't worry about coding or PyTorch") are classified
 *      as EXPLICITLY_EXCLUDED (No coverage) and cannot be targeted.
 */

'use strict';

class CurricularCoverageAnalyzer {
  /**
   * Internal coverage states.
   */
  static INTERNAL_STATUS = {
    SUFFICIENT: 'SUFFICIENT',
    INADEQUATE: 'INADEQUATE',
    MENTIONED_ONLY: 'MENTIONED_ONLY',
    ABSENT: 'ABSENT',
    EXPLICITLY_EXCLUDED: 'EXPLICITLY_EXCLUDED'
  };

  /**
   * User-facing coverage states.
   */
  static USER_STATUS = {
    SUFFICIENT: 'Sufficient',
    INADEQUATE: 'Inadequate',
    NO_COVERAGE: 'No coverage'
  };

  /**
   * Meta-discourse regex patterns indicating passing or future mentions (MENTIONED_ONLY).
   */
  static PASSING_MENTION_PATTERNS = [
    /\b(?:we'll|we will) (?:discuss|cover|look at|get into|explain) (?:that|this|it) (?:later|next|tomorrow|in the next|down the line)\b/i,
    /\b(?:next (?:week|lecture|session|time)|save (?:that|this) for later)\b/i,
    /\b(?:you may have heard of|some of you might know|just (?:mentioning|touching on)|briefly mention(?:ed)?|in passing)\b/i,
    /\b(?:won't|will not) (?:get into|cover|worry about|explore|dive into) (?:that|this) today\b/i,
    /\b(?:beyond (?:the|our) scope|outside (?:the|our) scope|not part of today's lecture)\b/i
  ];

  static EXPLANATORY_CONNECTIVES = [
    /\bbecause\b/i, /\bmeans that\b/i, /\bcauses\b/i, /\bleads to\b/i,
    /\bworks by\b/i, /\bfunctions to\b/i, /\bis defined as\b/i, /\bin order to\b/i,
    /\bconsequence is\b/i, /\btrade-?off\b/i, /\bmechanism\b/i, /\bhow it operates\b/i,
    /\bwhat happens (?:if|when)\b/i, /\bexplore (?:what|how)\b/i, /\bthink of it as\b/i,
    /\bfeedback\b/i, /\bvanishing\b/i, /\bgradient[s]?\b/i, /\binteraction\b/i,
    /\bdynamics?\b/i, /\boperation\b/i, /\bpointer\b/i
  ];

  /**
   * Analyze Curricular Coverage for an entire session evidence package.
   *
   * @param {Object} evidencePackage - Session evidence package from EvidencePackager
   * @param {Array<string>} [customCandidateConcepts=null] - Optional explicit list of concepts to evaluate
   * @returns {Object} Structured Curricular Coverage Profile
   */
  static analyzeCoverage(evidencePackage, customCandidateConcepts = null) {
    if (!evidencePackage) {
      return this._createEmptyProfile();
    }

    const voiceText = evidencePackage.voiceAnalysis?.rawText || evidencePackage.unifiedRawContent || '';
    const cleanDocsText = evidencePackage.docAnalysis?.rawText || '';
    const negativeBoundaries = evidencePackage.negativeBoundaries || evidencePackage.instructionalProfile?.negativeBoundaries || [];
    const explicitInstructions = evidencePackage.voiceEmphasis?.explicitInstructions || [];

    // 1. Gather Candidate Concepts
    const candidateConcepts = customCandidateConcepts && Array.isArray(customCandidateConcepts) && customCandidateConcepts.length > 0
      ? customCandidateConcepts
      : this._extractCandidateConcepts(evidencePackage);

    // 2. Evaluate Coverage for each candidate concept
    const conceptProfiles = candidateConcepts.map(concept => {
      return this.evaluateConceptCoverage(concept, evidencePackage);
    });

    // 3. Compute Aggregates
    const sufficient = conceptProfiles.filter(c => c.internalStatus === this.INTERNAL_STATUS.SUFFICIENT);
    const inadequate = conceptProfiles.filter(c => c.internalStatus === this.INTERNAL_STATUS.INADEQUATE);
    const noCoverage = conceptProfiles.filter(c => 
      c.internalStatus === this.INTERNAL_STATUS.MENTIONED_ONLY ||
      c.internalStatus === this.INTERNAL_STATUS.ABSENT ||
      c.internalStatus === this.INTERNAL_STATUS.EXPLICITLY_EXCLUDED
    );

    return {
      summary: {
        totalConcepts: conceptProfiles.length,
        sufficientCount: sufficient.length,
        inadequateCount: inadequate.length,
        noCoverageCount: noCoverage.length,
        sufficientRatio: conceptProfiles.length > 0 ? (sufficient.length / conceptProfiles.length).toFixed(2) : '0.00'
      },
      concepts: conceptProfiles,
      sufficientConcepts: sufficient.map(c => c.concept),
      inadequateConcepts: inadequate.map(c => c.concept),
      excludedOrUncoveredConcepts: noCoverage.map(c => ({
        concept: c.concept,
        status: c.internalStatus,
        reason: c.exclusionReason
      }))
    };
  }

  /**
   * Evaluate Curricular Coverage for a single individual concept.
   *
   * @param {string} conceptName - Name / phrase of the concept
   * @param {Object} evidencePackage - Session evidence package
   * @returns {Object} Individual Concept Coverage Record
   */
  static evaluateConceptCoverage(conceptName, evidencePackage) {
    const rawConcept = String(conceptName || '').trim();
    if (!rawConcept) {
      return this._createDefaultRecord('Unknown Concept', this.INTERNAL_STATUS.ABSENT, 'Concept name empty');
    }

    const voiceText = evidencePackage.voiceAnalysis?.rawText || evidencePackage.unifiedRawContent || '';
    const cleanDocsText = evidencePackage.docAnalysis?.rawText || '';
    const negativeBoundaries = evidencePackage.negativeBoundaries || evidencePackage.instructionalProfile?.negativeBoundaries || [];
    const explicitInstructions = evidencePackage.voiceEmphasis?.explicitInstructions || [];
    const curricularSegments = evidencePackage.curricularSegments || [];

    // Step A: Check Explicit Exclusions (Negative Boundaries & Verbal Instructions)
    const exclusion = this._checkExplicitExclusion(rawConcept, negativeBoundaries, explicitInstructions, voiceText);
    if (exclusion.isExcluded) {
      return {
        concept: rawConcept,
        evidenceStrength: 'NONE',
        taughtDepth: 'SURFACE',
        teacherEmphasis: 'LOW',
        coverageStatus: this.USER_STATUS.NO_COVERAGE,
        internalStatus: this.INTERNAL_STATUS.EXPLICITLY_EXCLUDED,
        evidenceSource: 'NONE',
        evidenceSpans: exclusion.spans || [],
        explicitlyExcluded: true,
        exclusionReason: exclusion.reason
      };
    }

    // Step B: Extract Evidence Spans & Provenance
    const voiceSpans = this._extractSpansForConcept(rawConcept, voiceText, 'VOICE');
    const docSpans = this._extractSpansForConcept(rawConcept, cleanDocsText, 'DOCUMENT');
    const allSpans = [...voiceSpans, ...docSpans];

    if (allSpans.length === 0) {
      return {
        concept: rawConcept,
        evidenceStrength: 'NONE',
        taughtDepth: 'SURFACE',
        teacherEmphasis: 'LOW',
        coverageStatus: this.USER_STATUS.NO_COVERAGE,
        internalStatus: this.INTERNAL_STATUS.ABSENT,
        evidenceSource: 'NONE',
        evidenceSpans: [],
        explicitlyExcluded: false,
        exclusionReason: 'No matching evidence found in voice transcript or document materials'
      };
    }

    const evidenceSource = voiceSpans.length > 0 && docSpans.length > 0
      ? 'DUAL_SOURCE'
      : (voiceSpans.length > 0 ? 'VOICE_PRIMARY' : 'DOC_PRIMARY');

    const totalWords = allSpans.reduce((acc, s) => acc + s.split(/\s+/).length, 0);

    // Step C: Check MENTIONED_ONLY (Passing name-drop, future pointer, no explanation)
    const isPassingMention = this._isMentionedOnly(rawConcept, allSpans, voiceText);
    if (isPassingMention.matched) {
      return {
        concept: rawConcept,
        evidenceStrength: 'WEAK',
        taughtDepth: 'SURFACE',
        teacherEmphasis: 'LOW',
        coverageStatus: this.USER_STATUS.NO_COVERAGE,
        internalStatus: this.INTERNAL_STATUS.MENTIONED_ONLY,
        evidenceSource,
        evidenceSpans: allSpans.map(s => s.trim()),
        explicitlyExcluded: false,
        exclusionReason: isPassingMention.reason
      };
    }

    // Step D: Check INADEQUATE vs SUFFICIENT
    // Calculate explanatory substance
    let hasExplanatoryConnective = false;
    for (const span of allSpans) {
      for (const pattern of this.EXPLANATORY_CONNECTIVES) {
        if (pattern.test(span)) {
          hasExplanatoryConnective = true;
          break;
        }
      }
      if (hasExplanatoryConnective) break;
    }

    // Teacher emphasis
    let teacherEmphasis = 'LOW';
    if (voiceSpans.length >= 3 || (evidencePackage.voiceEmphasis?.primaryCues || []).some(cue => cue.toLowerCase().includes(rawConcept.toLowerCase()))) {
      teacherEmphasis = 'HIGH';
    } else if (voiceSpans.length >= 1) {
      teacherEmphasis = 'MEDIUM';
    }

    // Taught depth
    let taughtDepth = 'LOW';
    if (totalWords >= 75 && hasExplanatoryConnective) {
      taughtDepth = 'HIGH';
    } else if (totalWords >= 40 || hasExplanatoryConnective) {
      taughtDepth = 'MEDIUM';
    }

    // If word count is small (< 25 words) or lacks explanatory connectives, mark INADEQUATE
    if (totalWords < 25 || (!hasExplanatoryConnective && totalWords < 50)) {
      return {
        concept: rawConcept,
        evidenceStrength: totalWords < 20 ? 'WEAK' : 'MODERATE',
        taughtDepth: 'LOW',
        teacherEmphasis,
        coverageStatus: this.USER_STATUS.INADEQUATE,
        internalStatus: this.INTERNAL_STATUS.INADEQUATE,
        evidenceSource,
        evidenceSpans: allSpans.map(s => s.trim()),
        explicitlyExcluded: false,
        exclusionReason: 'Concept has brief or isolated factual mention lacking operational explanation, mechanism, or depth for grounded assessment targets'
      };
    }

    // Otherwise: SUFFICIENT
    return {
      concept: rawConcept,
      evidenceStrength: allSpans.length >= 2 || totalWords >= 60 ? 'STRONG' : 'MODERATE',
      taughtDepth,
      teacherEmphasis,
      coverageStatus: this.USER_STATUS.SUFFICIENT,
      internalStatus: this.INTERNAL_STATUS.SUFFICIENT,
      evidenceSource,
      evidenceSpans: allSpans.map(s => s.trim()),
      explicitlyExcluded: false,
      exclusionReason: null
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Internal Helper Methods
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Check if a concept matches explicit negative boundaries or verbal exclusions.
   */
  static _checkExplicitExclusion(concept, negativeBoundaries, explicitInstructions, voiceText) {
    const cLower = concept.toLowerCase();

    // 1. Boundary match
    if (negativeBoundaries.includes('NO_CODE_IMPLEMENTATION')) {
      if (/\b(?:code|coding|syntax|implementation|pytorch|tensorflow|python script|function call|class definition)\b/i.test(cLower)) {
        return {
          isExcluded: true,
          reason: 'Excluded by negative boundary: NO_CODE_IMPLEMENTATION',
          spans: ['Teacher explicitly excluded code implementation and syntax from assessment scope']
        };
      }
    }

    if (negativeBoundaries.includes('NO_MATHEMATICAL_DERIVATION')) {
      if (/\b(?:derivation|formal proof|calculus|differential|math proof|formula proof|proof)\b/i.test(cLower)) {
        return {
          isExcluded: true,
          reason: 'Excluded by negative boundary: NO_MATHEMATICAL_DERIVATION',
          spans: ['Teacher explicitly excluded formal mathematical proofs and derivations']
        };
      }
    }

    if (negativeBoundaries.includes('NO_VENDOR_SPECIFIC_CLI')) {
      if (/\b(?:docker|cisco|aws cli|router command|vendor command|cli syntax)\b/i.test(cLower)) {
        return {
          isExcluded: true,
          reason: 'Excluded by negative boundary: NO_VENDOR_SPECIFIC_CLI',
          spans: ['Teacher explicitly excluded vendor-specific command-line invocations']
        };
      }
    }

    // 2. Direct verbal instruction match: must be in the direct object of the exclusion verb
    // e.g. "don't worry about coding", "skip the proof", "omit chapter 4"
    const vLower = (voiceText || '').toLowerCase();
    const directExclusionRegex = new RegExp(
      `\\b(?:don't worry about|skip|omit|outside (?:the|our) scope of|won't be asking about|not covering)\\s+(?:any\\s+)?(?:[\\w-]+\\s+){0,4}\\b${this._escapeRegex(cLower)}\\b`,
      'i'
    );
    if (directExclusionRegex.test(vLower)) {
      const match = vLower.match(directExclusionRegex);
      return {
        isExcluded: true,
        reason: `Explicitly excluded by spoken instructor directive: "${match[0]}"`,
        spans: [match[0]]
      };
    }

    return { isExcluded: false };
  }

  /**
   * Check if a concept is only mentioned in passing or as a future teaser.
   */
  static _isMentionedOnly(concept, spans, voiceText) {
    const cLower = concept.toLowerCase();

    // Find the specific sentences that actually mention the concept
    const mentionSentences = [];
    for (const span of spans) {
      const sentences = span.split(/(?<=[.?!])\s+/);
      for (const sent of sentences) {
        if (sent.toLowerCase().includes(cLower)) {
          mentionSentences.push(sent);
        }
      }
    }
    const targetText = mentionSentences.length > 0 ? mentionSentences.join(' ') : spans.join(' ');
    const fullText = spans.join(' ');
    const totalWords = fullText.split(/\s+/).filter(Boolean).length;

    // Check passing mention patterns strictly on the target sentences containing the concept
    for (const pattern of this.PASSING_MENTION_PATTERNS) {
      if (pattern.test(targetText)) {
        return {
          matched: true,
          reason: `Mentioned only in passing or deferred to future lecture: matches "${pattern.source}"`
        };
      }
    }

    // Check if it's a bare name-drop without any definition, mechanism, or explanatory term
    const hasDefinition = /\b(?:is an?|are|refers to|means|defined as|consists of)\b/i.test(fullText);
    const hasExplanatoryTerm = this.EXPLANATORY_CONNECTIVES.some(p => p.test(fullText));
    if (!hasDefinition && !hasExplanatoryTerm && totalWords <= 20) {
      return {
        matched: true,
        reason: `Mentioned in passing as bare keyword without definition or explanation (${totalWords} words)`
      };
    }

    return { matched: false };
  }

  /**
   * Extract distinct, clean evidence spans for a concept.
   */
  static _extractSpansForConcept(concept, sourceText, modality) {
    if (!sourceText || !concept) return [];

    const cleanSource = sourceText.replace(/\[(?:VOICE TRANSCRIPT|DOCUMENT CONTENT|CODE SNIPPETS|BOARD OCR)\]/g, '');
    const words = concept.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    if (words.length === 0) return [];

    // Split text into candidate sentences
    const sentences = cleanSource
      .split(/(?<=[.?!])\s+|\n+/)
      .map(s => s.trim())
      .filter(s => s.length >= 8);

    const matchingSpans = [];

    for (let i = 0; i < sentences.length; i++) {
      const sent = sentences[i];
      const sentLower = sent.toLowerCase();
      // Require either the full concept phrase or all major words
      const fullPhraseMatch = sentLower.includes(concept.toLowerCase());
      const wordMatchCount = words.filter(w => sentLower.includes(w)).length;
      const isSubstantialMatch = fullPhraseMatch || (words.length > 1 && wordMatchCount === words.length);

      if (isSubstantialMatch) {
        const spanSents = [];

        // If the matching sentence starts with an anaphoric reference ("that's", "this", "it"),
        // include the immediate antecedent sentence i-1 (and i-2 if i-1 was very short like "None!")
        const isAnaphoric = /^(?:that(?:'s|\s+is)?|this|it|these|those|such)\b/i.test(sent);
        if (isAnaphoric && i - 1 >= 0 && sentences[i - 1].length >= 5) {
          if (i - 2 >= 0 && sentences[i - 1].split(/\s+/).length <= 4) {
            spanSents.push(sentences[i - 2]);
          }
          spanSents.push(sentences[i - 1]);
        }

        spanSents.push(sent);

        // Include following sentence if it continues the explanation (anaphoric, connective, or elaboration)
        if (i + 1 < sentences.length && sentences[i + 1].length >= 5) {
          const nextSent = sentences[i + 1];
          const nextIsContinuation = /^(?:that|this|it|these|those|such|think|for example|explore|because|when|if|in order)\b/i.test(nextSent) ||
            this.EXPLANATORY_CONNECTIVES.some(p => p.test(nextSent));
          if (nextIsContinuation) {
            spanSents.push(nextSent);
          }
        }

        matchingSpans.push(spanSents.join(' '));
        if (matchingSpans.length >= 4) break;
      }
    }

    return matchingSpans;
  }

  /**
   * Extract candidate concepts from an evidence package.
   */
  static _extractCandidateConcepts(evidencePackage) {
    const concepts = new Set();

    // 1. Detected focus from primary analysis
    if (Array.isArray(evidencePackage.detectedFocus)) {
      evidencePackage.detectedFocus.forEach(f => {
        if (typeof f === 'string' && f.trim().length > 2) {
          concepts.add(f.trim());
        }
      });
    }

    // 2. Curricular segments concept anchors
    if (Array.isArray(evidencePackage.curricularSegments)) {
      evidencePackage.curricularSegments.forEach(seg => {
        const anchor = seg.classification?.conceptAnchor || seg.classification?.anchor;
        if (anchor && typeof anchor === 'string' && anchor.trim().length > 2 && !anchor.startsWith('Spoken Concept')) {
          concepts.add(anchor.trim());
        }
      });
    }

    // 3. Concept evidence graph nodes
    if (evidencePackage.conceptEvidenceGraph && Array.isArray(evidencePackage.conceptEvidenceGraph.nodes)) {
      evidencePackage.conceptEvidenceGraph.nodes.forEach(node => {
        if (node.conceptAnchor && !node.conceptAnchor.startsWith('Spoken Concept')) {
          concepts.add(node.conceptAnchor.trim());
        }
      });
    }

    // If still empty or minimal, extract key noun phrases from unified raw content
    if (concepts.size < 3) {
      const raw = evidencePackage.unifiedRawContent || '';
      const matches = raw.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
      matches.slice(0, 8).forEach(m => {
        if (m.length > 3 && !['The', 'This', 'That', 'These', 'Those', 'When', 'What', 'Where'].includes(m)) {
          concepts.add(m);
        }
      });
    }

    return Array.from(concepts);
  }

  static _createEmptyProfile() {
    return {
      summary: {
        totalConcepts: 0,
        sufficientCount: 0,
        inadequateCount: 0,
        noCoverageCount: 0,
        sufficientRatio: '0.00'
      },
      concepts: [],
      sufficientConcepts: [],
      inadequateConcepts: [],
      excludedOrUncoveredConcepts: []
    };
  }

  static _createDefaultRecord(concept, status, reason) {
    const isExcluded = status === this.INTERNAL_STATUS.EXPLICITLY_EXCLUDED;
    const userStatus = status === this.INTERNAL_STATUS.SUFFICIENT
      ? this.USER_STATUS.SUFFICIENT
      : (status === this.INTERNAL_STATUS.INADEQUATE ? this.USER_STATUS.INADEQUATE : this.USER_STATUS.NO_COVERAGE);

    return {
      concept,
      evidenceStrength: 'NONE',
      taughtDepth: 'SURFACE',
      teacherEmphasis: 'LOW',
      coverageStatus: userStatus,
      internalStatus: status,
      evidenceSource: 'NONE',
      evidenceSpans: [],
      explicitlyExcluded: isExcluded,
      exclusionReason: reason
    };
  }
  static _escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

module.exports = CurricularCoverageAnalyzer;
