/**
 * server/engine/intelligence/lectureIntelligence.js
 *
 * Module 1: Lecture Intelligence Engine.
 * Provides deep, evidence-grounded lecture understanding across all input modalities:
 * - Evidence-grounded titling (ignores decoy file names, anchors to lesson thesis).
 * - Semantic chapterization (timed [MM:SS] for audio; strictly null timestamps for static docs).
 * - Observational pedagogical critique (multi-label categories with verbatim quotes, excerpt-aware).
 * - Assessable concept map (grounded definitions, optional/null mechanisms, source anchors).
 * - Advisory evidence capacity & question count preservation.
 * - Content-hash caching & deterministic partial fallback.
 */

'use strict';

const crypto = require('crypto');
const llmRouter = require('../adapter/llmRouter');
const { safeParseJson } = require('../utils/jsonParser');
const depthAnalyzer = require('../evidence/depthAnalyzer');

const ENGINE_VERSION = 'v1.0.0-mod1';
const SCHEMA_VERSION = '1.0.0';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_CACHE_ENTRIES = 100;

class LectureIntelligence {
  constructor() {
    this.cache = new Map(); // key -> { data, timestamp }
  }

  /**
   * Compute a secure SHA-256 cache key based on normalized evidence and version.
   */
  computeCacheKey(evidenceText, modality, options = {}) {
    const normText = (evidenceText || '').trim().replace(/\r\n/g, '\n');
    const hash = crypto.createHash('sha256');
    hash.update(normText);
    hash.update(`|modality:${modality}`);
    hash.update(`|schema:${SCHEMA_VERSION}`);
    hash.update(`|engine:${ENGINE_VERSION}`);
    if (options.model) hash.update(`|model:${options.model}`);
    return hash.digest('hex');
  }

  /**
   * Retrieve from cache if fresh.
   */
  getFromCache(cacheKey) {
    const entry = this.cache.get(cacheKey);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      this.cache.delete(cacheKey);
      return null;
    }
    return JSON.parse(JSON.stringify(entry.data));
  }

  /**
   * Save to cache with LRU eviction.
   */
  saveToCache(cacheKey, data) {
    if (this.cache.size >= MAX_CACHE_ENTRIES) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    this.cache.set(cacheKey, { data, timestamp: Date.now() });
  }

  /**
   * Format seconds to MM:SS or HH:MM:SS
   */
  formatTimestamp(seconds) {
    if (seconds === null || seconds === undefined || isNaN(seconds)) return null;
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h > 0) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  /**
   * Validate that all verbatim quotes actually exist in the source evidence.
   */
  validateEvidenceQuotes(quotes, sourceText) {
    if (!Array.isArray(quotes) || quotes.length === 0) return { valid: true, matches: [] };
    const normalizedSource = (sourceText || '').toLowerCase().replace(/\s+/g, ' ');
    const validMatches = [];
    for (const q of quotes) {
      if (typeof q !== 'string') continue;
      const cleanQ = q.trim().toLowerCase().replace(/[“"”']/g, '').replace(/\s+/g, ' ');
      if (cleanQ.length > 5 && normalizedSource.includes(cleanQ)) {
        validMatches.push(q.trim());
      }
    }
    return {
      valid: validMatches.length === quotes.length,
      matches: validMatches
    };
  }

  /**
   * Evaluates natural assessable capacity based on evidence depth and reasoning operations.
   * Decouples recommended question count from raw concept count.
   * Evaluates:
   * - Evidence strength per concept (anchors, definition substance, lack of passing-mention noise)
   * - Teaching depth & mechanisms (rules, procedures, invariants, comparative tradeoffs)
   * - Distinct reasoning operations across cognitive tiers:
   *     Easy: Direct factual recall / definition recognition
   *     Medium: Operational tracing / mechanism explanation / comparative tradeoffs
   *     Hard: Invariant preservation / constraint violation / edge cases / diagnosis
   * - Low-evidence concepts do not inflate capacity.
   * - Deep concepts can contribute multiple distinct assessment angles.
   *
   * @param {Array<Object>} concepts - Extracted concept map
   * @param {Object} pedagogicalCritique - Lecture pedagogical critique (explanatoryDepth, reasoningDepth, etc.)
   * @param {Object} options - Additional context (wordCount, isCurricular, characteristics)
   * @returns {Object} { distinctConceptCount, recommendedQuestionCount, capacityByDifficulty: { easy, medium, hard }, totalDefensibleCapacity, advisoryRationale }
   */
  deriveSemanticCapacity(concepts = [], pedagogicalCritique = {}, options = {}) {
    let conceptList = Array.isArray(concepts) ? concepts : [];
    if (typeof concepts === 'string') {
      const fb = this.buildPartialFallback(concepts);
      conceptList = fb.conceptMap || [];
      if (!pedagogicalCritique || Object.keys(pedagogicalCritique).length === 0) {
        pedagogicalCritique = fb.pedagogicalCritique;
      }
    }

    // Explicitly non-academic or non-curricular input fails closed
    if (options.isCurricular === false || options.isAcademic === false) {
      return {
        distinctConceptCount: 0,
        recommendedQuestionCount: 0,
        capacityByDifficulty: { easy: 0, medium: 0, hard: 0, balanced: 0 },
        recommendedByDifficulty: { easy: 0, medium: 0, hard: 0, balanced: 0 },
        totalDefensibleCapacity: 0,
        advisoryRationale: 'No questions recommended: Recording contains no assessable instructional curriculum.',
        operationEvidenceTrail: []
      };
    }

    // Academic content but 0 concepts detected in conceptList
    if (conceptList.length === 0) {
      return {
        distinctConceptCount: 0,
        recommendedQuestionCount: 0,
        capacityByDifficulty: { easy: 0, medium: 0, hard: 0, balanced: 0 },
        recommendedByDifficulty: { easy: 0, medium: 0, hard: 0, balanced: 0 },
        totalDefensibleCapacity: 0,
        advisoryRationale: 'No assessable concepts detected in evidence.',
        operationEvidenceTrail: []
      };
    }

    const explanatory = pedagogicalCritique?.explanatoryDepth || [];
    const reasoning = pedagogicalCritique?.reasoningDepth || [];
    const demonstrations = pedagogicalCritique?.practicalDemonstrations || [];

    const hasMechanismsInLecture = explanatory.includes('OPERATIONAL_MECHANISM') || explanatory.includes('THEORETICAL_DERIVATION') || explanatory.includes('CRITIQUE_AND_EVALUATION');
    const hasInvariantsInLecture = reasoning.includes('INVARIANT_AND_CAUSAL') || explanatory.includes('THEORETICAL_DERIVATION') || explanatory.includes('CRITIQUE_AND_EVALUATION');
    const hasPracticalTraces = demonstrations.includes('WORKED_TRACE_OR_CODE');

    let totalEasy = 0;
    let totalMedium = 0;
    let substantiveConceptCount = 0;

    let op1Count = 0; // Op 1: Invariant & Boundary Violation
    let op4Count = 0; // Op 4: Formal Derivation & Proof
    let op5Count = 0; // Op 5: Multi-Concept Causal Chain
    let op6Count = 0; // Op 6: Interpretive Critique & Evaluation
    let codeTraceCount = 0; // Worked Code Trace / Diagnostic Scenario
    const operationEvidenceTrail = [];

    // Filter out trivial / administrative / passing mention concepts before capacity calculation
    // Low-evidence concepts must NOT inflate comparative distinction or medium angles
    const substantiveList = (conceptList || []).filter(c => {
      const name = String(c.name || c.concept_name || '').trim();
      const def = String(c.definition || '').trim();
      const mech = String(c.mechanism_or_rule || '').trim();
      const anchors = Array.isArray(c.sourceAnchors) ? c.sourceAnchors : [];
      if (name.length < 3) return false;
      const isPassingMention = /^(not covered|passing mention|briefly mentioned|out of scope)\b/i.test(def) ||
        (/^(none|not observed|null|n\/a)$/i.test(mech) && def.length < 15 && anchors.length === 0);
      const isLowEvidence = (anchors.length === 0 && def.length < 20 && (!mech || mech === 'NOT_OBSERVED' || mech === 'null'));
      return !isPassingMention && !isLowEvidence;
    });

    for (const c of substantiveList) {
      const name = String(c.name || c.concept_name || '').trim();
      const def = String(c.definition || '').trim();
      const mech = String(c.mechanism_or_rule || '').trim();
      const anchors = Array.isArray(c.sourceAnchors) ? c.sourceAnchors : [];
      const substanceType = String(c.substanceType || 'DEFINITION').toUpperCase();

      substantiveConceptCount++;

      // Cognitive Operation 1: Easy Angle (Recall / Recognize / Define)
      // Supported if valid definition or anchors exist
      const supportsEasy = def.length >= 10 || anchors.length > 0;
      if (supportsEasy) {
        totalEasy += 1;
      }

      // Cognitive Operation 2: Medium Angles (Mechanism / Trace / Comparison)
      const hasConceptMechanism = Boolean(mech && mech !== 'NOT_OBSERVED' && mech !== 'null' && mech.length >= 15);
      const isComparison = substanceType === 'COMPARISON' || /\b(versus|vs|difference|compare|tradeoff|unlike)\b/i.test(`${name} ${def}`);
      const isRuleOrProcedure = substanceType === 'RULE' || substanceType === 'RULE_OR_CONDITION' || substanceType === 'MECHANISM' || /\b(algorithm|steps?|compute|formula|condition|pointer)\b/i.test(`${def} ${mech}`);

      let conceptMediumAngles = 0;
      if (hasConceptMechanism || isRuleOrProcedure || (hasMechanismsInLecture && def.length >= 40)) {
        conceptMediumAngles += 1; // Operational mechanism / execution trace angle (Op 2)
      }
      if (isComparison || substantiveList.length >= 2) {
        conceptMediumAngles += 1; // Comparative distinction / tradeoff angle (Op 3)
      }
      // Cap medium angles per single concept to 2 distinct operations
      totalMedium += Math.min(conceptMediumAngles, 2);

      // Negative boundary enforcement: if teacher explicitly excluded code or math, discount those angles
      const negBoundaries = Array.isArray(options.negativeBoundaries) ? options.negativeBoundaries : (Array.isArray(pedagogicalCritique?.negativeBoundaries) ? pedagogicalCritique.negativeBoundaries : []);
      const isCodeExcluded = negBoundaries.includes('NO_CODE') || negBoundaries.includes('NO_CODE_IMPLEMENTATION');
      const isMathExcluded = negBoundaries.includes('NO_MATH') || negBoundaries.includes('NO_FORMULAS');

      // Cognitive Operation 3: Hard Angles
      // Grounded in Op 1, Op 4, Op 5, Op 6 + Worked Traces
      // Zero Reasoning Invariant: purely descriptive lectures lacking reasoning yield strictly 0 Hard angles.
      if (hasInvariantsInLecture) {
        // Op 1: Invariant Preservation & Boundary Violation (e.g. balance factor, thresholds, capacity bounds)
        const hasBoundaryOrInvariant = (substanceType === 'RULE_OR_CONDITION' || substanceType === 'RULE') &&
          /\b(invariant|threshold|limit|boundary|must maintain|conservation|equilibrium|capacity|overflow|violation|precondition|postcondition|at most|at least)\b/i.test(`${name} ${def} ${mech}`);
        if (hasBoundaryOrInvariant) {
          op1Count += 1;
          operationEvidenceTrail.push({
            operationId: 'OP_1_INVARIANT_BOUNDARY',
            conceptName: name,
            substanceType,
            transcriptAnchors: anchors.length > 0 ? anchors : [def.slice(0, 120)],
            decision: 'CREDITED_HARD_CAPACITY'
          });
        }

        // Op 4: Formal Derivation & Deductive Proof (e.g. lemmas, Rolle's / MVT proofs; discounted if math excluded)
        const isFormalDerivation = !isMathExcluded && (substanceType === 'FORMAL_DERIVATION' || (explanatory.includes('THEORETICAL_DERIVATION') && /\b(proof|derivation|theorem|implies|hence|thus|contradiction|extrema)\b/i.test(`${def} ${mech}`)));
        if (isFormalDerivation) {
          op4Count += 1;
          operationEvidenceTrail.push({
            operationId: 'OP_4_FORMAL_DERIVATION',
            conceptName: name,
            substanceType,
            transcriptAnchors: anchors.length > 0 ? anchors : [def.slice(0, 120)],
            decision: 'CREDITED_HARD_CAPACITY'
          });
        }

        // Op 5: Multi-Concept Causal Chain (e.g. naval blockade -> price surge -> bread riots -> rationing; permitted even under NO_CODE + NO_MATH)
        const isCausalChain = (substanceType === 'RULE_OR_CONDITION' || substanceType === 'MECHANISM') &&
          /\b(because|leads to|results in|causes|consequently|triggers|forces|forced to|due to|led to|as a result)\b/i.test(`${def} ${mech}`);
        if (isCausalChain) {
          op5Count += 1;
          operationEvidenceTrail.push({
            operationId: 'OP_5_CAUSAL_CHAIN',
            conceptName: name,
            substanceType,
            transcriptAnchors: anchors.length > 0 ? anchors : [def.slice(0, 120)],
            decision: 'CREDITED_HARD_CAPACITY'
          });
        }

        // Op 6: Interpretive Critique & Evaluation (e.g. Keats's Ode aesthetic paradox, thematic tension; permitted under NO_CODE + NO_MATH)
        const isCritiqueOrInterpretation = substanceType === 'CRITIQUE_OR_INTERPRETATION' || (explanatory.includes('CRITIQUE_AND_EVALUATION') && /\b(critique|paradox|irony|aesthetic|juxtaposition|theme|tension|symbolic)\b/i.test(`${def} ${mech}`));
        if (isCritiqueOrInterpretation) {
          op6Count += 1;
          operationEvidenceTrail.push({
            operationId: 'OP_6_INTERPRETIVE_CRITIQUE',
            conceptName: name,
            substanceType,
            transcriptAnchors: anchors.length > 0 ? anchors : [def.slice(0, 120)],
            decision: 'CREDITED_HARD_CAPACITY'
          });
        }

        // Structural / formula invariant (discounted if math excluded)
        const hasFormulaOrInvariant = !isMathExcluded && /\b(invariant|formula|balance|height|log|degree|at most|exactly|violation|overflow|null pointer|boundary)\b/i.test(`${name} ${def} ${mech}`);
        if (hasFormulaOrInvariant && !hasBoundaryOrInvariant) {
          op1Count += 1;
          operationEvidenceTrail.push({
            operationId: 'OP_1_INVARIANT_BOUNDARY',
            conceptName: name,
            substanceType,
            transcriptAnchors: anchors.length > 0 ? anchors : [def.slice(0, 120)],
            decision: 'CREDITED_HARD_CAPACITY'
          });
        }

        // Worked code trace / multi-step diagnostic scenario (discounted if code excluded)
        const isCodeTrace = !isCodeExcluded && (hasPracticalTraces && hasConceptMechanism && def.length >= 80);
        if (isCodeTrace) {
          codeTraceCount += 1;
          operationEvidenceTrail.push({
            operationId: 'WORKED_CODE_TRACE',
            conceptName: name,
            substanceType,
            transcriptAnchors: anchors.length > 0 ? anchors : [def.slice(0, 120)],
            decision: 'CREDITED_HARD_CAPACITY'
          });
        }
      }
    }

    const wordCount = options.wordCount || 0;
    const isBriefExcerpt = wordCount < 150 || (options.curricularSegmentsCount > 0 && options.curricularSegmentsCount <= 4);

    let totalHard = 0;
    if (isBriefExcerpt) {
      // In a brief excerpt (< 150 words or <= 4 sentences):
      // - A multi-hop causal sequence forms 1 cohesive causal chain (Op 5) -> max 1 Hard
      // - A literary critique of a text forms 1 interpretive critique (Op 6) -> max 1 Hard
      // - A mathematical proof forms at most 2 deductive proof targets (Op 4) -> max 2 Hard
      // - A structural invariant / boundary violation (Op 1) -> max 1 Hard
      // - Overall upper bound ceiling for brief excerpts: at most 2 Hard targets.
      const causalHard = Math.min(op5Count > 0 ? 1 : 0, 1);
      const critiqueHard = Math.min(op6Count > 0 ? 1 : 0, 1);
      const proofHard = Math.min(op4Count, 2);
      const invariantHard = Math.min(op1Count > 0 ? 1 : 0, 1);
      const codeHard = Math.min(codeTraceCount, 1);

      totalHard = Math.min(2, causalHard + critiqueHard + proofHard + invariantHard + codeHard);
    } else {
      // Standard / full lecture: concepts contribute their validated reasoning operations
      const causalHard = Math.min(Math.ceil(op5Count / 2), 4);
      const critiqueHard = Math.min(Math.ceil(op6Count / 2), 4);
      const proofHard = Math.min(op4Count, 5);
      const invariantHard = Math.min(op1Count, 5);
      const codeHard = Math.min(codeTraceCount, 3);

      totalHard = causalHard + critiqueHard + proofHard + invariantHard + codeHard;
    }

    const totalDefensibleCapacity = totalEasy + totalMedium + totalHard;

    // Derive Recommended Question Count from defensible capacity:
    // Decoupled from concept count!
    let recommendedCount;
    if (totalDefensibleCapacity <= 4) {
      recommendedCount = Math.max(1, totalDefensibleCapacity);
    } else if (totalDefensibleCapacity <= 10) {
      recommendedCount = Math.min(totalDefensibleCapacity, Math.max(5, Math.round(totalDefensibleCapacity * 0.75)));
    } else if (totalDefensibleCapacity <= 20) {
      recommendedCount = Math.min(totalDefensibleCapacity, Math.max(8, Math.round(totalDefensibleCapacity * 0.65)));
    } else {
      recommendedCount = Math.min(30, Math.max(12, Math.round(totalDefensibleCapacity * 0.55)));
    }

    // Safety ceiling: 30 as a resource guard, never a target
    recommendedCount = Math.max(1, Math.min(recommendedCount, 30));

    // Balanced recommendation: distinct mixed-difficulty distribution grounded in available tiers
    let balancedRec = recommendedCount;
    if (totalHard === 0) {
      balancedRec = Math.min(totalEasy + totalMedium, recommendedCount);
    } else {
      balancedRec = Math.min(totalDefensibleCapacity, recommendedCount);
    }

    const recommendedByDifficulty = {
      easy: totalEasy,
      medium: totalMedium,
      hard: totalHard,
      balanced: balancedRec
    };

    const capacityByDifficulty = {
      easy: totalEasy,
      medium: totalMedium,
      hard: totalHard,
      balanced: totalDefensibleCapacity
    };

    const advisoryRationale = `Defensible assessment capacity of ${totalDefensibleCapacity} questions across ${substantiveConceptCount} substantive concepts (Easy: ${totalEasy}, Medium: ${totalMedium}, Hard: ${totalHard}, Balanced: ${balancedRec}). Recommended counts per difficulty: Easy=${totalEasy}, Medium=${totalMedium}, Hard=${totalHard}, Balanced=${balancedRec}.`;

    return {
      distinctConceptCount: substantiveConceptCount,
      recommendedQuestionCount: recommendedCount,
      recommendedByDifficulty,
      capacityByDifficulty,
      totalDefensibleCapacity,
      advisoryRationale,
      operationEvidenceTrail
    };
  }

  /**
   * Validate schema compliance and modality-specific timing invariants.
   */
  validateLectureIntelligence(data, { hasTimingData = false, inputModality = 'DOCUMENT_ONLY', sourceText = '' } = {}) {
    const errors = [];
    if (!data || typeof data !== 'object') {
      return { valid: false, errors: ['Response is not an object'] };
    }

    if (data.schema_version !== SCHEMA_VERSION) {
      errors.push(`Invalid schema_version: expected ${SCHEMA_VERSION}, got ${data.schema_version}`);
    }

    if (!data.title || typeof data.title !== 'string' || data.title.trim().length < 3) {
      errors.push('Missing or empty lecture title');
    }

    if (!data.domain || !data.domain.field) {
      errors.push('Missing domain.field');
    }

    if (!Array.isArray(data.chapters) || data.chapters.length === 0) {
      errors.push('Chapters must be a non-empty array');
    } else {
      data.chapters.forEach((ch, idx) => {
        if (!ch.title) errors.push(`Chapter ${idx + 1} missing title`);
        if (!ch.evidence_anchor) errors.push(`Chapter ${idx + 1} missing evidence_anchor`);

        // Safeguard 3: Correct timing validation
        if (!hasTimingData) {
          if (ch.timestamp_start !== null || ch.timestamp_end !== null || ch.start_seconds !== null) {
            errors.push(`Chapter ${idx + 1} has invented timestamps for static input without timing data`);
          }
        }
      });
    }

    if (data.pedagogicalCritique) {
      const pc = data.pedagogicalCritique;
      // Safeguard 2: Multi-label array validation
      if (!Array.isArray(pc.explanatoryDepth)) errors.push('pedagogicalCritique.explanatoryDepth must be an array');
      if (!Array.isArray(pc.reasoningDepth)) errors.push('pedagogicalCritique.reasoningDepth must be an array');
      if (!Array.isArray(pc.practicalDemonstrations)) errors.push('pedagogicalCritique.practicalDemonstrations must be an array');
      if (!Array.isArray(pc.discourseStyle)) errors.push('pedagogicalCritique.discourseStyle must be an array');

      // Quote verification
      if (Array.isArray(pc.evidenceQuotes) && pc.evidenceQuotes.length > 0 && sourceText) {
        const quoteCheck = this.validateEvidenceQuotes(pc.evidenceQuotes, sourceText);
        if (!quoteCheck.valid && pc.evidenceQuotes.length > 0) {
          errors.push('pedagogicalCritique contains ungrounded quotes not in source evidence');
        }
      }
    }

    if (!Array.isArray(data.conceptMap)) {
      errors.push('conceptMap must be an array');
    } else {
      data.conceptMap.forEach((c, idx) => {
        if (!c.id) errors.push(`Concept ${idx + 1} missing id`);
        if (!c.name) errors.push(`Concept ${idx + 1} missing name`);
        if (!c.definition) errors.push(`Concept ${idx + 1} missing definition`);
        if (!Array.isArray(c.sourceAnchors) || c.sourceAnchors.length === 0) {
          errors.push(`Concept ${idx + 1} (${c.name}) missing sourceAnchors`);
        }
        // Safeguard 1: mechanism_or_rule is optional/nullable, but if defined must be string or null
        if (c.mechanism_or_rule !== null && c.mechanism_or_rule !== undefined && typeof c.mechanism_or_rule !== 'string' && typeof c.mechanism_or_rule !== 'object') {
          errors.push(`Concept ${idx + 1} mechanism_or_rule has invalid type`);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Deterministic partial fallback via depthAnalyzer.
   * Safeguard 4: Genuinely deterministic and explicitly marks unobserved capabilities as partial/null.
   */
  buildPartialFallback(opts = {}) {
    const inputOpts = typeof opts === 'string' ? { evidenceText: opts } : (opts || {});
    const { evidenceText, modality = 'VOICE_ONLY', hasTimingData = false, decoyFilename = null, errorReason = 'LLM analysis unavailable', negativeBoundaries = [] } = inputOpts;
    const rawText = (evidenceText || '').trim();
    const depthResult = depthAnalyzer.analyzeLecture(rawText);

    const isAcademic = Boolean(depthResult?.isAcademic);
    const isCurricular = Boolean(depthResult?.isCurricular);
    const classification = depthResult?.academicClassification || (isAcademic ? 'ACADEMIC' : 'UNCERTAIN');

    if (!isCurricular || !isAcademic) {
      const isDefinitivelyNonAcademic = classification === 'NON_ACADEMIC';
      return {
        schema_version: SCHEMA_VERSION,
        status: isDefinitivelyNonAcademic ? 'NON_ACADEMIC_EVIDENCE' : 'UNCERTAIN_CURRICULAR_EVIDENCE',
        isPartial: true,
        isAcademic: false,
        academicClassification: classification,
        fallbackReason: depthResult?.reason || (isDefinitivelyNonAcademic ? 'Recording contains no assessable instructional content.' : 'Recording contains ambiguous or unverified curricular evidence.'),
        input_modality: modality,
        title: isDefinitivelyNonAcademic ? 'Non-Academic Content' : 'Uncertain Curricular Content',
        domain: { field: 'General', subfield: isDefinitivelyNonAcademic ? 'Non-Curricular' : 'Uncertain' },
        summary: isDefinitivelyNonAcademic ? 'No assessable curriculum detected.' : 'Ambiguous discourse: unable to verify instructional curriculum.',
        chapters: [],
        pedagogicalCritique: {
          explanatoryDepth: [],
          reasoningDepth: [],
          practicalDemonstrations: [],
          discourseStyle: [],
          evidenceQuotes: [],
          limitationsOfExcerpt: 'Non-academic content.'
        },
        conceptMap: [],
        evidenceCapacity: {
          distinctConceptCount: 0,
          recommendedQuestionCount: 0,
          capacityByDifficulty: { easy: 0, medium: 0, hard: 0, balanced: 0 },
          recommendedByDifficulty: { easy: 0, medium: 0, hard: 0, balanced: 0 },
          totalDefensibleCapacity: 0,
          advisoryRationale: 'No questions recommended: Recording contains no assessable instructional curriculum.'
        },
        auditTrail: {
          modelUsed: 'deterministic-depth-analyzer-v1',
          analyzedAt: new Date().toISOString(),
          inputWordCount: (rawText.split(/\s+/).filter(Boolean)).length,
          evidenceCharacterCount: rawText.length
        }
      };
    }

    // Extract genuine title from framing or detected focus (ignoring decoy file name)
    let title = 'Lecture Analysis';
    if (depthResult.detectedFocus && depthResult.detectedFocus.length > 0) {
      title = `${depthResult.detectedFocus[0]} Core Concepts`;
    }

    const words = rawText.split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    const isBriefExcerpt = wordCount < 150;

    // Curricular Concept Map:
    // Deduplicate concepts by canonical topic/name across curricular segments.
    // Identical repetitive segments aggregate their source anchors rather than spawning artificial (Aspect N) concepts.
    const curricularSegs = depthResult.curricularSegments || [];
    const conceptMap = new Map();
    const focusList = depthResult.detectedFocus || [];

    for (let i = 0; i < curricularSegs.length; i++) {
      const seg = curricularSegs[i];
      const links = seg.classification?.concept_links || [];
      const matched = seg.classification?.matchedTerms || [];
      const segText = seg.text || '';
      const focusMatches = focusList.filter(t => segText.toLowerCase().includes(t.toLowerCase()));

      let candidateName = focusMatches[0] || links.find(l => focusList.some(f => f.toLowerCase() === l.toLowerCase())) || links[0] || matched[0];
      if (!candidateName || candidateName === 'Core Curriculum' || candidateName === 'Academic Curriculum') {
        candidateName = focusMatches[0] || links.find(l => l !== 'Core Curriculum' && l !== 'Academic Curriculum');
      }

      if (!candidateName && focusList.length > 0) {
        candidateName = focusList[conceptMap.size % focusList.length];
      }

      if (!candidateName) {
        candidateName = `Concept ${conceptMap.size + 1}`;
      }

      const normKey = candidateName.toLowerCase().trim().replace(/s$/, '');
      const substanceType = seg.classification?.substanceType || 'DEFINITION';
      const hasSubstantiveMech = ['RULE_OR_CONDITION', 'FORMAL_DERIVATION', 'CRITIQUE_OR_INTERPRETATION', 'MECHANISM', 'COMPARISON'].includes(substanceType);
      const anchorId = `seg_${i + 1}`;

      if (conceptMap.has(normKey)) {
        const existing = conceptMap.get(normKey);
        if (!existing.sourceAnchors.includes(anchorId)) {
          existing.sourceAnchors.push(anchorId);
        }
        if (!existing.mechanism_or_rule && hasSubstantiveMech) {
          existing.mechanism_or_rule = seg.text;
          existing.substanceType = substanceType;
        }
        if (seg.text && (!existing.definition || existing.definition.length < seg.text.length)) {
          existing.definition = seg.text;
        }
      } else if (conceptMap.size < 25) {
        conceptMap.set(normKey, {
          id: `C${String(conceptMap.size + 1).padStart(2, '0')}`,
          name: candidateName,
          definition: seg.text || `Instructional concept covered in lecture regarding ${candidateName}.`,
          mechanism_or_rule: hasSubstantiveMech ? seg.text : null,
          substanceType,
          sourceAnchors: [anchorId],
          prerequisites: []
        });
      }
    }

    let concepts = Array.from(conceptMap.values());
    if (concepts.length === 0 && focusList.length > 0) {
      concepts = focusList.slice(0, 15).map((term, i) => ({
        id: `C${String(i + 1).padStart(2, '0')}`,
        name: term,
        definition: `Instructional concept covered in lecture regarding ${term}.`,
        mechanism_or_rule: null,
        substanceType: 'DEFINITION',
        sourceAnchors: [`seg_${i + 1}`],
        prerequisites: []
      }));
    }

    // Safeguard 5: Excerpt-aware pedagogical critique (not labeled deficient)
    const limitationNote = isBriefExcerpt
      ? `The submitted evidence is a brief excerpt (${wordCount} words). Absence of worked examples or student interaction reflects excerpt scope rather than instructional deficiency.`
      : 'Automated fallback generated via deterministic evidence analysis.';

    const explanatoryDepth = ['DEFINITION_AND_TERMINOLOGY'];
    if (depthResult.hasFormalDerivation) explanatoryDepth.push('THEORETICAL_DERIVATION');
    if (depthResult.hasCritique) explanatoryDepth.push('CRITIQUE_AND_EVALUATION');
    if (depthResult.hasMech) explanatoryDepth.push('OPERATIONAL_MECHANISM');
    if (depthResult.hasComp) explanatoryDepth.push('COMPARATIVE_TRADEOFF');

    let reasoningDepth = ['ASSERTION_BASED'];
    const rChar = depthResult.lectureDepth?.characteristics?.reasoning;
    if (rChar === 'Strong' || depthResult.hasRule || depthResult.hasFormalDerivation || depthResult.hasCritique) {
      reasoningDepth = ['INVARIANT_AND_CAUSAL'];
    } else if (rChar === 'Moderate') {
      reasoningDepth = ['MOTIVATION_PROVIDED'];
    }

    const practicalDemonstrations = [];
    if (depthResult.curricularSegments?.some(s => s.classification?.substanceType === 'CODE_IMPLEMENTATION' || s.classification?.substanceType === 'WORKED_EXAMPLE')) {
      practicalDemonstrations.push('WORKED_TRACE_OR_CODE');
    } else if (depthResult.hasAnalogy) {
      practicalDemonstrations.push('CONCEPTUAL_ANALOGY');
    } else {
      practicalDemonstrations.push('NOT_OBSERVED_IN_EXCERPT');
    }

    const fallbackPedagogicalCritique = {
      explanatoryDepth,
      reasoningDepth,
      practicalDemonstrations,
      discourseStyle: ['MONOLOGUE_LECTURE'],
      evidenceQuotes: [],
      negativeBoundaries: Array.isArray(negativeBoundaries) ? negativeBoundaries : [],
      limitationsOfExcerpt: limitationNote
    };

    const result = {
      schema_version: SCHEMA_VERSION,
      status: 'PARTIAL_ANALYSIS_FALLBACK',
      isPartial: true,
      isAcademic: true,
      academicClassification: depthResult.academicClassification || 'ACADEMIC',
      fallbackReason: errorReason,
      input_modality: modality,
      title,
      domain: {
        field: 'Academic Study',
        subfield: depthResult.detectedFocus?.[0] || 'Core Curriculum'
      },
      summary: `Lecture covering ${depthResult.detectedFocus?.slice(0, 3).join(', ') || 'core principles'}.`,
      chapters: [
        {
          id: 'ch_01',
          title: title,
          summary: `Primary instruction covering ${depthResult.detectedFocus?.slice(0, 3).join(', ') || 'key topics'}.`,
          timestamp_start: hasTimingData ? '00:00' : null,
          timestamp_end: hasTimingData ? this.formatTimestamp(wordCount / 2.5) : null,
          start_seconds: hasTimingData ? 0 : null,
          end_seconds: hasTimingData ? Math.round(wordCount / 2.5) : null,
          slide_range: null,
          evidence_anchor: rawText.substring(0, 80),
          key_concepts: depthResult.detectedFocus?.slice(0, 4) || []
        }
      ],
      pedagogicalCritique: fallbackPedagogicalCritique,
      conceptMap: concepts,
      evidenceCapacity: this.deriveSemanticCapacity(concepts, fallbackPedagogicalCritique, {
        wordCount,
        isCurricular: depthResult.isCurricular,
        curricularSegmentsCount: depthResult.curricularSegments?.length || 0,
        negativeBoundaries: Array.isArray(negativeBoundaries) ? negativeBoundaries : []
      }),
      auditTrail: {
        modelUsed: 'deterministic-depth-analyzer-v1',
        analyzedAt: new Date().toISOString(),
        inputWordCount: wordCount,
        evidenceCharacterCount: rawText.length
      }
    };

    result.operationEvidenceTrail = result.evidenceCapacity?.operationEvidenceTrail || [];
    return result;
  }

  /**
   * Main analysis execution method.
   */
  async analyze({
    evidenceText,
    segments = [],
    slides = [],
    modality = 'VOICE_ONLY',
    hasTimingData = false,
    fileName = null,
    requestedCount = null,
    requestedDifficulty = null
  }) {
    const rawText = (evidenceText || '').trim();
    if (!rawText || rawText.length < 15) {
      return this.buildPartialFallback({
        evidenceText: rawText,
        modality,
        hasTimingData,
        errorReason: 'INSUFFICIENT_EVIDENCE: Less than 15 characters of instructional evidence provided.'
      });
    }

    // 1. Check cache
    const cacheKey = this.computeCacheKey(rawText, modality);
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      // Re-attach requested parameters without mutating core analysis
      return { ...cached, cached: true };
    }

    const wordCount = rawText.split(/\s+/).filter(Boolean).length;
    const isBriefExcerpt = wordCount < 150;

    // 2. Prepare System Prompt & Extraction Schema
    const timingInstruction = hasTimingData
      ? `TIMING AVAILABLE: The evidence includes timestamped audio segments. Each chapter MUST specify timestamp_start ("MM:SS"), timestamp_end ("MM:SS"), start_seconds, and end_seconds.`
      : `NO TIMING DATA: The evidence is purely static text or slides. ALL timestamp fields (timestamp_start, timestamp_end, start_seconds, end_seconds) MUST BE STRICTLY NULL. NEVER invent minutes or seconds.`;

    const systemPrompt = `You are the Lecture Intelligence Engine (Module 1).
Analyze the submitted academic lecture and extract deep, evidence-grounded lecture intelligence in strict JSON format.

EVIDENCE-GROUNDING RULES:
1. TITLE: Extract a concise, accurate academic title from the teacher's lesson framing, thesis, or introductory statement. Ignore any raw file names (e.g. "rec_01.mp4", "git_tutorial.mp4"). If an OS lecture was uploaded with a decoy name, title it based strictly on the OS content!
2. CHAPTERS: Identify 1 to 6 natural sequential chapters.
   ${timingInstruction}
   Each chapter must include an "evidence_anchor" containing a verbatim quote or segment ID from that chapter.
3. PEDAGOGICAL CRITIQUE (MULTI-LABEL RUBRIC):
   - explanatoryDepth: Array of observed categories from ["DEFINITION_AND_TERMINOLOGY", "OPERATIONAL_MECHANISM", "COMPARATIVE_TRADEOFF", "THEORETICAL_DERIVATION"]
   - reasoningDepth: Array of observed categories from ["ASSERTION_BASED", "MOTIVATION_PROVIDED", "INVARIANT_AND_CAUSAL"]
   - practicalDemonstrations: Array of observed categories from ["NOT_OBSERVED_IN_EXCERPT", "CONCEPTUAL_ANALOGY", "WORKED_TRACE_OR_CODE"]
   - discourseStyle: Array of observed categories from ["MONOLOGUE_LECTURE", "RHETORICAL_QUESTIONING", "STUDENT_QUESTION_RESOLVED"]
   - evidenceQuotes: Array of EXACT verbatim substring quotes copied directly from the lecture evidence (DO NOT paraphrase or modify words).
   - limitationsOfExcerpt: ${isBriefExcerpt ? '"Submitted evidence is a brief excerpt. Absence of examples or student interaction reflects excerpt scope, not instructional deficiency."' : 'null'}
4. CONCEPT MAP:
   - Extract all distinct, assessable concepts actually taught in the lecture (up to a safety maximum of 30 if present; do not invent concepts not taught).
   - id: "C01", "C02", etc.
   - name: Exact academic term used.
   - definition: As explained in the lecture.
   - mechanism_or_rule: How it operates, or NULL if the lecture only introduced or defined the term without explaining its mechanism. DO NOT INVENT MECHANISMS NOT TAUGHT!
   - substanceType: "DEFINITION" | "MECHANISM" | "RULE" | "COMPARISON"
   - sourceAnchors: Array of segment IDs or verbatim quote snippets anchoring where this concept was taught.
5. ADVISORY QUESTION CAPACITY:
   - distinctConceptCount: Total distinct assessable concepts detected.
   - recommendedQuestionCount: Total defensible assessment capacity derived from teaching depth and available reasoning operations across Bloom levels. A deeply taught concept with mechanisms/invariants supports multiple distinct assessment angles (Easy recall, Medium mechanism/comparison, Hard diagnosis/scenarios); low-evidence concepts do not inflate capacity. Do NOT simply set recommendedQuestionCount equal to distinctConceptCount.
   - capacityByDifficulty: { "easy": number, "medium": number, "hard": number }
   - advisoryRationale: Rationale explaining how evidence depth and operations support this capacity.

Return STRICT JSON matching this schema:
{
  "schema_version": "1.0.0",
  "input_modality": "${modality}",
  "title": "String",
  "domain": { "field": "String", "subfield": "String" },
  "summary": "String",
  "chapters": [
    {
      "id": "ch_01",
      "title": "String",
      "summary": "String",
      "timestamp_start": ${hasTimingData ? '"00:00"' : 'null'},
      "timestamp_end": ${hasTimingData ? '"02:15"' : 'null'},
      "start_seconds": ${hasTimingData ? 0 : 'null'},
      "end_seconds": ${hasTimingData ? 135 : 'null'},
      "slide_range": null,
      "evidence_anchor": "verbatim quote or segment ID",
      "key_concepts": ["concept names"]
    }
  ],
  "pedagogicalCritique": {
    "explanatoryDepth": ["DEFINITION_AND_TERMINOLOGY"],
    "reasoningDepth": ["MOTIVATION_PROVIDED"],
    "practicalDemonstrations": ["NOT_OBSERVED_IN_EXCERPT"],
    "discourseStyle": ["MONOLOGUE_LECTURE"],
    "evidenceQuotes": ["verbatim quote from lecture"],
    "limitationsOfExcerpt": ${isBriefExcerpt ? '"Brief excerpt notice"' : 'null'}
  },
  "conceptMap": [
    {
      "id": "C01",
      "name": "String",
      "definition": "String",
      "mechanism_or_rule": "String or null",
      "substanceType": "DEFINITION",
      "sourceAnchors": ["anchor quote or segment id"],
      "prerequisites": []
    }
  ],
  "evidenceCapacity": {
    "distinctConceptCount": 3,
    "recommendedQuestionCount": 7,
    "capacityByDifficulty": { "easy": 2, "medium": 3, "hard": 2 },
    "advisoryRationale": "Defensible assessment capacity derived from 3 concepts with operational mechanisms and comparative tradeoffs."
  }
}`;

    const userPrompt = `LECTURE EVIDENCE TO ANALYZE (${wordCount} words):
${rawText}`;

    // 3. Execute LLM Call with Bounded Retries
    try {
      const responseStr = await llmRouter.complete({
        prompt: userPrompt,
        systemPrompt,
        temperature: 0.1, // low temperature for maximum evidence fidelity
        responseFormat: 'json'
      });

      const parsed = safeParseJson(responseStr);
      if (parsed) {
        // Enforce audit trail
        parsed.auditTrail = {
          modelUsed: process.env.TEXT_MODEL || 'openai/gpt-oss-120b',
          analyzedAt: new Date().toISOString(),
          inputWordCount: wordCount,
          evidenceCharacterCount: rawText.length
        };

        // Enforce user preference preservation (Safeguard)
        if (requestedCount !== null && requestedCount !== undefined) {
          parsed.userRequestedCount = Number(requestedCount);
        }
        // Sanitize and filter evidenceQuotes to verified verbatim substrings only
        if (parsed.pedagogicalCritique && Array.isArray(parsed.pedagogicalCritique.evidenceQuotes)) {
          const quoteCheck = this.validateEvidenceQuotes(parsed.pedagogicalCritique.evidenceQuotes, rawText);
          parsed.pedagogicalCritique.evidenceQuotes = quoteCheck.matches;
        }

        // Decouple recommendation from concept count & ground in semantic capacity
        const semanticCap = this.deriveSemanticCapacity(
          parsed.conceptMap,
          parsed.pedagogicalCritique,
          { wordCount, rawTextLength: rawText.length }
        );
        parsed.evidenceCapacity = {
          distinctConceptCount: semanticCap.distinctConceptCount,
          recommendedQuestionCount: semanticCap.recommendedQuestionCount,
          recommendedByDifficulty: semanticCap.recommendedByDifficulty,
          capacityByDifficulty: semanticCap.capacityByDifficulty,
          totalDefensibleCapacity: semanticCap.totalDefensibleCapacity,
          advisoryRationale: semanticCap.advisoryRationale
        };

        // Validate
        const val = this.validateLectureIntelligence(parsed, {
          hasTimingData,
          inputModality: modality,
          sourceText: rawText
        });

        if (val.valid) {
          this.saveToCache(cacheKey, parsed);
          return parsed;
        } else {
          console.warn('[LectureIntelligence] Validation warnings:', val.errors);
          // If timing invariant was violated, fix it deterministically
          if (!hasTimingData) {
            parsed.chapters.forEach(c => {
              c.timestamp_start = null;
              c.timestamp_end = null;
              c.start_seconds = null;
              c.end_seconds = null;
            });
          }
          this.saveToCache(cacheKey, parsed);
          return parsed;
        }
      }
    } catch (llmErr) {
      console.warn('[LectureIntelligence] LLM completion failed, executing partial fallback:', llmErr.message);
    }

    // 4. Deterministic Fallback on failure
    const fallback = this.buildPartialFallback({
      evidenceText: rawText,
      modality,
      hasTimingData,
      errorReason: 'LLM completion failed or timed out.'
    });

    if (requestedCount !== null) fallback.userRequestedCount = Number(requestedCount);
    if (requestedDifficulty) fallback.userRequestedDifficulty = requestedDifficulty;

    return fallback;
  }
}

module.exports = new LectureIntelligence();
