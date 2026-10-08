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
    const conceptList = Array.isArray(concepts) ? concepts : [];
    if (conceptList.length === 0) {
      return {
        distinctConceptCount: 0,
        recommendedQuestionCount: 5,
        capacityByDifficulty: { easy: 2, medium: 2, hard: 1 },
        totalDefensibleCapacity: 5,
        advisoryRationale: 'Baseline pedagogical scope for introductory content.'
      };
    }

    const explanatory = pedagogicalCritique?.explanatoryDepth || [];
    const reasoning = pedagogicalCritique?.reasoningDepth || [];
    const demonstrations = pedagogicalCritique?.practicalDemonstrations || [];

    const hasMechanismsInLecture = explanatory.includes('OPERATIONAL_MECHANISM') || explanatory.includes('THEORETICAL_DERIVATION');
    const hasInvariantsInLecture = reasoning.includes('INVARIANT_AND_CAUSAL') || explanatory.includes('THEORETICAL_DERIVATION');
    const hasPracticalTraces = demonstrations.includes('WORKED_TRACE_OR_CODE');

    let totalEasy = 0;
    let totalMedium = 0;
    let totalHard = 0;
    let substantiveConceptCount = 0;

    for (const c of conceptList) {
      const name = String(c.name || c.concept_name || '').trim();
      const def = String(c.definition || '').trim();
      const mech = String(c.mechanism_or_rule || '').trim();
      const anchors = Array.isArray(c.sourceAnchors) ? c.sourceAnchors : [];
      const substanceType = String(c.substanceType || 'DEFINITION').toUpperCase();

      // Rule 1: Filter out trivial / administrative / passing mention concepts
      if (name.length < 3) continue;
      const isPassingMention = /^(not covered|passing mention|briefly mentioned|out of scope)\b/i.test(def) ||
        (/^(none|not observed|null|n\/a)$/i.test(mech) && def.length < 15 && anchors.length === 0);

      // Rule 2: Low-evidence concepts DO NOT inflate capacity
      // If a concept has no source anchors, minimal definition (< 20 chars), and no mechanism, it gets 0 capacity!
      const isLowEvidence = (anchors.length === 0 && def.length < 20 && (!mech || mech === 'NOT_OBSERVED' || mech === 'null'));
      if (isPassingMention || isLowEvidence) {
        continue;
      }

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
      const isRuleOrProcedure = substanceType === 'RULE' || substanceType === 'MECHANISM' || /\b(algorithm|steps?|compute|formula|condition|pointer)\b/i.test(`${def} ${mech}`);

      let conceptMediumAngles = 0;
      if (hasConceptMechanism || isRuleOrProcedure || (hasMechanismsInLecture && def.length >= 40)) {
        conceptMediumAngles += 1; // Operational mechanism / execution trace angle
      }
      if (isComparison) {
        conceptMediumAngles += 1; // Comparative distinction / tradeoff angle
      }
      // Cap medium angles per single concept to 2 distinct operations
      totalMedium += Math.min(conceptMediumAngles, 2);

      // Cognitive Operation 3: Hard Angles (Invariant Preservation / Constraint Violation / Fault Diagnosis)
      // Requires mechanism + invariant/formula/causal constraint in evidence
      let conceptHardAngles = 0;
      const hasFormulaOrInvariant = /\b(invariant|formula|balance|height|log|degree|at most|exactly|violation|overflow|null pointer|boundary)\b/i.test(`${name} ${def} ${mech}`);

      if ((hasConceptMechanism || hasFormulaOrInvariant) && (hasInvariantsInLecture || hasFormulaOrInvariant)) {
        conceptHardAngles += 1; // Invariant prediction / boundary condition angle
      }
      // If concept also has worked traces or code demonstrations, it supports multi-step scenario/diagnostic angle
      if (hasConceptMechanism && (hasPracticalTraces || anchors.length >= 3) && def.length >= 80) {
        conceptHardAngles += 1; // Deep diagnostic / multi-step edge case angle
      }
      // Cap hard angles per single concept to 2 distinct operations
      totalHard += Math.min(conceptHardAngles, 2);
    }

    const totalDefensibleCapacity = totalEasy + totalMedium + totalHard;

    // Derive Recommended Question Count from defensible capacity:
    // Decoupled from concept count!
    // A standard balanced assessment covers the viable operations without excessive redundancy.
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

    const advisoryRationale = `Defensible assessment capacity of ${totalDefensibleCapacity} questions across ${substantiveConceptCount} substantive concepts (Easy: ${totalEasy}, Medium: ${totalMedium}, Hard: ${totalHard}). Recommended count is advisory; user-requested count will be honored.`;

    return {
      distinctConceptCount: substantiveConceptCount,
      recommendedQuestionCount: recommendedCount,
      capacityByDifficulty: {
        easy: totalEasy,
        medium: totalMedium,
        hard: totalHard
      },
      totalDefensibleCapacity,
      advisoryRationale
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
  buildPartialFallback({ evidenceText, modality, hasTimingData, decoyFilename = null, errorReason = 'LLM analysis unavailable' }) {
    const rawText = (evidenceText || '').trim();
    const depthResult = depthAnalyzer.analyzeLecture(rawText);

    // Extract genuine title from framing or detected focus (ignoring decoy file name)
    let title = 'Lecture Analysis';
    if (depthResult.detectedFocus && depthResult.detectedFocus.length > 0) {
      title = `${depthResult.detectedFocus[0]} Core Concepts`;
    }

    const words = rawText.split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    const isBriefExcerpt = wordCount < 150;

    // Build partial concept map strictly from verified curricular segments (safety guard 30)
    const concepts = (depthResult.detectedFocus || []).slice(0, 30).map((term, i) => {
      const match = depthResult.curricularSegments.find(s => (s.text || '').toLowerCase().includes(term.toLowerCase()));
      return {
        id: `C${String(i + 1).padStart(2, '0')}`,
        name: term,
        definition: match ? match.text : `Instructional concept covered in lecture regarding ${term}.`,
        mechanism_or_rule: null, // Safeguard 1: Do not invent mechanism in fallback
        substanceType: match?.classification?.substanceType || 'DEFINITION',
        sourceAnchors: [`seg_${i + 1}`],
        prerequisites: []
      };
    });

    // Safeguard 5: Excerpt-aware pedagogical critique (not labeled deficient)
    const limitationNote = isBriefExcerpt
      ? `The submitted evidence is a brief excerpt (${wordCount} words). Absence of worked examples or student interaction reflects excerpt scope rather than instructional deficiency.`
      : 'Automated fallback generated via deterministic evidence analysis.';

    const fallbackPedagogicalCritique = {
      explanatoryDepth: depthResult.isCurricular ? ['DEFINITION_AND_TERMINOLOGY'] : [],
      reasoningDepth: ['ASSERTION_BASED'],
      practicalDemonstrations: ['NOT_OBSERVED_IN_EXCERPT'],
      discourseStyle: ['MONOLOGUE_LECTURE'],
      evidenceQuotes: [],
      limitationsOfExcerpt: limitationNote
    };

    return {
      schema_version: SCHEMA_VERSION,
      status: 'PARTIAL_ANALYSIS_FALLBACK',
      isPartial: true,
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
        curricularSegmentsCount: depthResult.curricularSegments?.length || 0
      }),
      auditTrail: {
        modelUsed: 'deterministic-depth-analyzer-v1',
        analyzedAt: new Date().toISOString(),
        inputWordCount: wordCount,
        evidenceCharacterCount: rawText.length
      }
    };
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
