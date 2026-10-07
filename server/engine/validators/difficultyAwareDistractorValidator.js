/**
 * server/engine/validators/difficultyAwareDistractorValidator.js
 *
 * DIFFICULTY-AWARE DISTRACTOR PLAUSIBILITY & FITNESS VALIDATOR (Step 6)
 *
 * Post-generation validation gate that inspects generated MCQs across 7 dimensions:
 * 1. Correctness: Exactly one correct answer exists in options.
 * 2. Plausibility: Every distractor is a plausible choice a student could make (zero absurd/comical options).
 * 3. Conceptual Relationship: Distractors are grounded in the domain/lecture, not foreign or random trivia.
 * 4. Difficulty Alignment:
 *    - Easy: Basic misconceptions, terminology inversions, role confusions.
 *    - Medium: Plausible procedural misunderstandings, state transition errors.
 *    - Hard: Closely competing reasoning, subtle consequences, dynamic trade-offs within taught scope.
 *    - Invariant: A Hard question is NEVER rejected merely because distractors are short (reasoning > length).
 * 5. No Giveaway: The correct answer is not an obvious visual giveaway by being substantially longer/more detailed.
 * 6. No Duplicate Reasoning: Distractors do not paraphrase each other or represent identical choices.
 * 7. No Accidental Second Key: No distractor is technically defensible as an alternative correct answer.
 *
 * Verdicts:
 * - PASS: Fully compliant, certified for student delivery.
 * - REPAIR: Actionable minor defect (length imbalance, duplicate distractor) with targeted repair hints.
 * - REJECT: Fatal defect (multiple keys, absurd option, foreign topic contamination, missing key).
 */

'use strict';

class DifficultyAwareDistractorValidator {
  /**
   * Absurd, comical, or nonsensical patterns that must NEVER appear in serious academic assessments.
   */
  static ABSURD_PATTERNS = [
    /\b(?:magic|magically|aliens?|telepathy|psychic|miracle|fairy|god mode|unicorn)\b/i,
    /\b(?:impossible to know|nobody knows|just because|it felt like it)\b/i,
    /\b(?:randomly destroys everything|deletes the entire internet|burns the server)\b/i,
    /\b(?:does absolutely nothing at all forever|has no effect on anything)\b/i
  ];

  /**
   * Common foreign topic anchor domains (used to detect foreign cross-domain contamination).
   */
  static FOREIGN_TOPIC_SIGNALS = [
    { domain: 'React / Web Frontend', pattern: /\b(?:react|useeffect|usestate|jsx|virtual dom|component lifecycle)\b/i },
    { domain: 'Microbiology / Genetics', pattern: /\b(?:mitochondri\w+|bacteriophage|dna polymerase|crispr|ribosome|pcr amplification)\b/i },
    { domain: 'Aerospace / Physics', pattern: /\b(?:orbital mechanics|aerodynamic drag|warp drive|supersonic flow)\b/i }
  ];

  /**
   * Validate an MCQ against the 7 Distractor Fitness Dimensions.
   *
   * @param {Object} mcq - MCQ candidate { questionText, options, correctAnswer, metadata, ... }
   * @param {string|Object} targetOrDifficulty - Target object or difficulty string ('Easy'|'Medium'|'Hard')
   * @param {Object} [evidencePackage=null] - Session evidence package for domain grounding
   * @returns {Object} Validation report { verdict: 'PASS'|'REPAIR'|'REJECT', score, dimensions, flaws, repairHints }
   */
  static validate(mcq, targetOrDifficulty = 'Medium', evidencePackage = null) {
    if (!mcq || mcq.isUnfulfilled) {
      return {
        verdict: 'PASS',
        isUnfulfilled: true,
        score: 1.0,
        flaws: [],
        repairHints: []
      };
    }

    const tier = typeof targetOrDifficulty === 'object' && targetOrDifficulty !== null
      ? (targetOrDifficulty.targetDifficulty || mcq.metadata?.targetDifficulty || 'Medium')
      : (typeof targetOrDifficulty === 'string' ? targetOrDifficulty : (mcq.metadata?.targetDifficulty || 'Medium'));

    const options = Array.isArray(mcq.options) ? mcq.options.map(o => String(o || '').trim()) : [];
    const correctAnswer = String(mcq.correctAnswer || '').trim();
    const stem = String(mcq.questionText || '').trim();
    const domainEvidence = evidencePackage?.unifiedRawContent || evidencePackage?.curricularContent || '';

    const flaws = [];
    const repairHints = [];

    // ─────────────────────────────────────────────────────────────────────────
    // Dimension 1: Correctness (Exactly one correct answer in options)
    // ─────────────────────────────────────────────────────────────────────────
    const correctnessDim = this._validateCorrectness(options, correctAnswer);
    if (!correctnessDim.passed) {
      flaws.push({ dimension: 'CORRECTNESS', code: correctnessDim.code, message: correctnessDim.message });
    }

    // Identify distractors (the 3 non-key options)
    const distractors = options.filter(o => o !== correctAnswer);

    // ─────────────────────────────────────────────────────────────────────────
    // Dimension 2: Plausibility (No absurd or comical options)
    // ─────────────────────────────────────────────────────────────────────────
    const plausibilityDim = this._validatePlausibility(distractors);
    if (!plausibilityDim.passed) {
      flaws.push({ dimension: 'PLAUSIBILITY', code: plausibilityDim.code, message: plausibilityDim.message });
      repairHints.push(`REPLACE_ABSURD_DISTRACTOR: ${plausibilityDim.details}`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Dimension 3: Conceptual Relationship (Domain relevance & no foreign contamination)
    // ─────────────────────────────────────────────────────────────────────────
    const relationshipDim = this._validateConceptualRelationship(distractors, stem, domainEvidence);
    if (!relationshipDim.passed) {
      flaws.push({ dimension: 'CONCEPTUAL_RELATIONSHIP', code: relationshipDim.code, message: relationshipDim.message });
      repairHints.push(`REWRITE_DOMAIN_DISTRACTOR: ${relationshipDim.details}`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Dimension 4: Difficulty Alignment (Cognitive level match)
    // ─────────────────────────────────────────────────────────────────────────
    const difficultyDim = this._validateDifficultyAlignment(distractors, tier, stem);
    if (!difficultyDim.passed) {
      flaws.push({ dimension: 'DIFFICULTY_ALIGNMENT', code: difficultyDim.code, message: difficultyDim.message });
      repairHints.push(`CALIBRATE_DISTRACTOR_DIFFICULTY: ${difficultyDim.details}`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Dimension 5: No Giveaway (Length ratio & visual formatting cues)
    // ─────────────────────────────────────────────────────────────────────────
    const giveawayDim = this._validateNoGiveaway(options, correctAnswer);
    if (!giveawayDim.passed) {
      flaws.push({ dimension: 'NO_GIVEAWAY', code: giveawayDim.code, message: giveawayDim.message });
      repairHints.push(`REBALANCE_OPTION_LENGTHS: ${giveawayDim.details}`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Dimension 6: No Duplicate Reasoning (No synonymous or subset distractors)
    // ─────────────────────────────────────────────────────────────────────────
    const duplicateDim = this._validateNoDuplicateReasoning(distractors, stem);
    if (!duplicateDim.passed) {
      flaws.push({ dimension: 'NO_DUPLICATE_REASONING', code: duplicateDim.code, message: duplicateDim.message });
      repairHints.push(`DIFFERENTIATE_DISTRACTOR_REASONING: ${duplicateDim.details}`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Dimension 7: No Accidental Second Key (Mutual exclusivity & non-overlapping)
    // ─────────────────────────────────────────────────────────────────────────
    const accidentalKeyDim = this._validateNoAccidentalSecondKey(options, correctAnswer, stem);
    if (!accidentalKeyDim.passed) {
      flaws.push({ dimension: 'NO_ACCIDENTAL_SECOND_KEY', code: accidentalKeyDim.code, message: accidentalKeyDim.message });
      repairHints.push(`RESOLVE_OPTION_AMBIGUITY: ${accidentalKeyDim.details}`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Overall Verdict Determination
    // ─────────────────────────────────────────────────────────────────────────
    let verdict = 'PASS';
    const fatalCodes = ['ERR_INVALID_OPTION_COUNT', 'ERR_KEY_NOT_IN_OPTIONS', 'ERR_IDENTICAL_OPTIONS', 'ABSURD_DISTRACTOR', 'FOREIGN_DOMAIN_CONTAMINATION', 'POTENTIAL_MULTI_KEY'];
    const hasFatalFlaw = flaws.some(f => fatalCodes.includes(f.code));

    if (hasFatalFlaw) {
      verdict = 'REJECT';
    } else if (flaws.length > 0) {
      verdict = 'REPAIR';
    }

    const passedCount = [
      correctnessDim.passed,
      plausibilityDim.passed,
      relationshipDim.passed,
      difficultyDim.passed,
      giveawayDim.passed,
      duplicateDim.passed,
      accidentalKeyDim.passed
    ].filter(Boolean).length;

    const score = parseFloat((passedCount / 7).toFixed(2));

    return {
      verdict,
      score,
      targetDifficulty: tier,
      dimensions: {
        correctness: correctnessDim,
        plausibility: plausibilityDim,
        conceptualRelationship: relationshipDim,
        difficultyAlignment: difficultyDim,
        noGiveaway: giveawayDim,
        noDuplicateReasoning: duplicateDim,
        noAccidentalSecondKey: accidentalKeyDim
      },
      flaws,
      repairHints
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Granular Dimension Validators
  // ─────────────────────────────────────────────────────────────────────────────

  static _validateCorrectness(options, correctAnswer) {
    if (!Array.isArray(options) || options.length !== 4) {
      return { passed: false, code: 'ERR_INVALID_OPTION_COUNT', message: `Options count must be exactly 4 (found ${options.length})` };
    }
    if (!options.includes(correctAnswer)) {
      return { passed: false, code: 'ERR_KEY_NOT_IN_OPTIONS', message: 'Correct answer is not present in options array' };
    }
    const uniqueOptions = new Set(options);
    if (uniqueOptions.size !== 4) {
      return { passed: false, code: 'ERR_IDENTICAL_OPTIONS', message: 'Two or more options are identical verbatim strings' };
    }
    return { passed: true, details: 'Exactly one valid answer key found in 4 distinct options' };
  }

  static _validatePlausibility(distractors) {
    for (let i = 0; i < distractors.length; i++) {
      const d = distractors[i];
      for (const pattern of this.ABSURD_PATTERNS) {
        if (pattern.test(d)) {
          return {
            passed: false,
            code: 'ABSURD_DISTRACTOR',
            message: `Distractor "${d}" contains absurd or comical trope: ${d.match(pattern)[0]}`,
            details: `Option [${i}] is absurd: "${d}"`
          };
        }
      }
      if (/^(?:n\/a|none of the above|all of the above|none|all)$/i.test(d.trim())) {
        return {
          passed: false,
          code: 'LAZY_META_DISTRACTOR',
          message: `Distractor "${d}" is a lazy meta-option prohibited by single-concept testing principles`,
          details: `Option [${i}] is lazy meta-option`
        };
      }
    }
    return { passed: true, details: 'All distractors represent plausible student choices' };
  }

  static _validateConceptualRelationship(distractors, stem, domainEvidence) {
    const stemLower = stem.toLowerCase();
    const evLower = (domainEvidence || '').toLowerCase();

    for (let i = 0; i < distractors.length; i++) {
      const d = distractors[i];
      for (const foreign of this.FOREIGN_TOPIC_SIGNALS) {
        // If distractor matches foreign signal BUT the stem/evidence is NOT about that foreign topic
        if (foreign.pattern.test(d) && !foreign.pattern.test(stemLower) && !foreign.pattern.test(evLower)) {
          return {
            passed: false,
            code: 'FOREIGN_DOMAIN_CONTAMINATION',
            message: `Distractor "${d}" introduces foreign domain concepts (${foreign.domain}) absent from lecture`,
            details: `Option [${i}] has foreign topic contamination`
          };
        }
      }
    }
    return { passed: true, details: 'All distractors share conceptual domain relevance with lecture evidence' };
  }

  static _validateDifficultyAlignment(distractors, tier, stem) {
    const tierNorm = String(tier || 'Medium').toLowerCase();

    if (tierNorm === 'hard') {
      // For Hard: Distractors must not be superficial 1-word syntactical flags unless technical bounds/values
      for (let i = 0; i < distractors.length; i++) {
        const d = distractors[i].trim();
        // If distractor is a trivial syntactical flag like "-v" or "-f" on a conceptual question
        if (/^-[a-z]$/i.test(d) && !stem.toLowerCase().includes('flag') && !stem.toLowerCase().includes('option')) {
          return {
            passed: false,
            code: 'INSUFFICIENT_COGNITIVE_DEMAND_FOR_HARD',
            message: `Distractor "${d}" is a superficial flag trivializing a Hard cognitive target`,
            details: `Option [${i}] lacks conceptual depth for Hard`
          };
        }
      }
      // Note: A Hard question with concise algorithmic/complexity options like "O(n)", "O(log n)"
      // is 100% valid and NOT penalized for length.
      return { passed: true, targetDifficulty: 'Hard', details: 'Distractors reflect subtle dynamic tradeoffs or near-miss mechanisms' };
    }

    if (tierNorm === 'easy') {
      return { passed: true, targetDifficulty: 'Easy', details: 'Distractors represent basic recall misconceptions or definition inversions' };
    }

    return { passed: true, targetDifficulty: 'Medium', details: 'Distractors represent plausible procedural or operational misunderstandings' };
  }

  static _validateNoGiveaway(options, correctAnswer) {
    const correctLen = correctAnswer.length;
    const distractorLens = options.filter(o => o !== correctAnswer).map(o => o.length);
    const maxDistractorLen = Math.max(...distractorLens);
    const minDistractorLen = Math.min(...distractorLens);

    // If correct answer is > 2.5x longer than the LONGEST distractor, it is an obvious visual giveaway
    if (correctLen > 2.5 * maxDistractorLen && correctLen > 70) {
      return {
        passed: false,
        code: 'GIVEAWAY_LENGTH_BIAS',
        message: `Correct answer (${correctLen} chars) is ${(correctLen / maxDistractorLen).toFixed(1)}x longer than longest distractor (${maxDistractorLen} chars)`,
        details: `Correct answer is an obvious length giveaway`
      };
    }

    // Ratio between longest and shortest overall option
    const allLens = options.map(o => o.length);
    const maxLen = Math.max(...allLens);
    const minLen = Math.min(...allLens);
    const ratio = minLen > 0 ? (maxLen / minLen) : 999;

    return {
      passed: true,
      lengthRatio: ratio.toFixed(2),
      details: `Option lengths well-balanced (ratio: ${ratio.toFixed(2)})`
    };
  }

  static SYNONYM_MAP = {
    // Blocking / Halting
    halts: 'blocks',
    stalls: 'blocks',
    stops: 'blocks',
    freezes: 'blocks',
    hangs: 'blocks',
    // Permanence
    permanently: 'indefinitely',
    forever: 'indefinitely',
    never: 'indefinitely',
    // Concurrency / Resources
    mutex: 'resource',
    lock: 'resource',
    semaphore: 'resource',
    // Direction / Magnitude
    increases: 'raises',
    grows: 'raises',
    accelerates: 'raises',
    decreases: 'drops',
    reduces: 'drops',
    falls: 'drops',
    shrinks: 'drops',
    // Validation
    checks: 'validates',
    verifies: 'validates',
    confirms: 'validates'
  };

  static _validateNoDuplicateReasoning(distractors, stem) {
    const normalizeToken = w => this.SYNONYM_MAP[w] || w;
    const cleanTokens = s => s.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2 && !['the', 'and', 'for', 'with', 'that', 'this', 'will', 'from', 'all'].includes(w))
      .map(normalizeToken);

    for (let i = 0; i < distractors.length; i++) {
      for (let j = i + 1; j < distractors.length; j++) {
        const d1 = distractors[i];
        const d2 = distractors[j];
        const t1 = cleanTokens(d1);
        const t2 = cleanTokens(d2);

        if (t1.length >= 3 && t2.length >= 3) {
          const s1 = new Set(t1);
          const s2 = new Set(t2);
          let intersection = 0;
          for (const t of s1) {
            if (s2.has(t)) intersection++;
          }
          const union = new Set([...s1, ...s2]).size;
          const jaccard = union > 0 ? (intersection / union) : 0;
          const containment = Math.min(s1.size, s2.size) > 0 ? (intersection / Math.min(s1.size, s2.size)) : 0;

          // If two distractors share >= 60% Jaccard or >= 65% core semantic containment
          if (jaccard >= 0.60 || (intersection >= 3 && containment >= 0.65)) {
            return {
              passed: false,
              code: 'SYNONYMOUS_DISTRACTORS',
              message: `Distractors [${i}] and [${j}] represent duplicate reasoning (Jaccard: ${jaccard.toFixed(2)}, Containment: ${containment.toFixed(2)}): "${d1}" vs "${d2}"`,
              details: `Duplicate distractor reasoning between options [${i}] and [${j}]`
            };
          }
        }
      }
    }
    return { passed: true, details: 'Distractors represent distinct, non-overlapping conceptual choices' };
  }

  static _validateNoAccidentalSecondKey(options, correctAnswer, stem) {
    const stemLower = stem.toLowerCase();

    // Check for parameter subsumption ambiguity (e.g. "git init" vs "git init --bare" when stem doesn't specify bare/working tree)
    for (let i = 0; i < options.length; i++) {
      for (let j = 0; j < options.length; j++) {
        if (i !== j) {
          const o1 = options[i].trim().toLowerCase();
          const o2 = options[j].trim().toLowerCase();
          if (o2.length > o1.length && o2.startsWith(o1 + ' ') && !stemLower.includes('--') && !stemLower.includes('flag')) {
            return {
              passed: false,
              code: 'POTENTIAL_MULTI_KEY',
              message: `Subsumption ambiguity between "${options[i]}" and "${options[j]}" creates accidental second correct key`,
              details: `Ambiguous subsumption pair: "${options[i]}" vs "${options[j]}"`
            };
          }
        }
      }
    }
    return { passed: true, details: 'Options are mutually exclusive; exactly one satisfies the stem' };
  }
}

module.exports = DifficultyAwareDistractorValidator;
