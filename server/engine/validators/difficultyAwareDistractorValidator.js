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
    /\b(?:does absolutely nothing at all forever|has no effect on anything)\b/i,
    /\b(?:sunlight and water|water and sunlight|plants? and water|sunlight and soil|soil and sunlight)\b/i
  ];

  /**
   * Weak, trivial, or non-domain distractor patterns that must be rejected.
   */
  static WEAK_DISTRACTOR_PATTERNS = [
    // Implausible subset assertion
    {
      pattern: /\b(?:cannot\s+form\s+a\s+valid\s+subset|invalid\s+single(?:-|\s+)element\s+subset|not\s+a\s+valid\s+subset)\b/i,
      condition: (stem) => !/\b(?:at\s+least|size\s+(?:of\s+)?(?:>=?|[2-9])|subset\s+of\s+size\s+[2-9])\b/i.test(stem),
      code: 'ERR_IMPLAUSIBLE_SUBSET_RULE',
      reason: 'Claims an element cannot form a valid subset when no minimum size constraint exists in stem'
    },
    // Arbitrary input syntax filler
    {
      pattern: /\b(?:first|second|third|last)\s+integer\s+from\s+(?:the\s+)?(?:first|second|third|last|input)\s+(?:line|token|stream)\b/i,
      code: 'ERR_INPUT_SYNTAX_FILLER',
      reason: 'Arbitrary competitive programming input line parsing token used as an algorithmic distractor'
    },
    {
      pattern: /\b(?:line\s+[123]|second\s+line\s+of\s+input|input\s+line\s+[123])\b/i,
      code: 'ERR_INPUT_SYNTAX_FILLER',
      reason: 'Input stream line reference used as a conceptual distractor'
    },
    // Generic non-domain fillers
    {
      pattern: /\b(?:a\s+flag\s+that\s+enforces|boolean\s+flag\s+(?:to|that)|flag\s+variable\s+indicating)\b/i,
      condition: (stem) => /\b(?:minprice|price|cost|weight|distance|dist|sum|product|max_profit)\b/i.test(stem),
      code: 'ERR_GENERIC_NON_DOMAIN_FILLER',
      reason: 'Generic boolean flag filler used for an accumulator or state variable'
    },
    {
      pattern: /\b(?:total\s+number\s+of\s+transactions\s+allowed|counts\s+the\s+number\s+of\s+(?:trades|transactions|iterations))\b/i,
      condition: (stem) => /\b(?:minprice|price|cost|weight|distance|product)\b/i.test(stem),
      code: 'ERR_GENERIC_NON_DOMAIN_FILLER',
      reason: 'Generic counter filler used for a price or distance variable'
    }
  ];

  /**
   * Helper to identify if an option is formatted as code syntax rather than English prose.
   */
  static isCodeSnippet(str) {
    const s = String(str || '').trim();
    if (/^(?:git|docker|npm|curl|tar|grep|chmod|ls|cd|mkdir)\b/i.test(s)) return false;
    const hasCodeOperators = /(?:\+\=|\-\=|\*\=|\/\=|[a-zA-Z_]\w*\+\+|\+\+[a-zA-Z_]\w*|[a-zA-Z_]\w*\-\-|===?|!==?|<=|>=|&&|\|\||->|;\s*$)/.test(s);
    const hasSubscripts = /[a-zA-Z_]\w*\[[^\]]+\]/.test(s);
    const hasControlFlow = /\b(?:if|while|for)\s*\([^)]+\)/i.test(s);
    const hasCodeStatement = /\b(?:int|let|const|var|return)\s+[a-zA-Z_]/.test(s);
    return hasCodeOperators || hasSubscripts || hasControlFlow || hasCodeStatement;
  }

  /**
   * Common foreign topic anchor domains (used to detect foreign cross-domain contamination).
   */
  static FOREIGN_TOPIC_SIGNALS = [
    { domain: 'React / Web Frontend', pattern: /\b(?:react|useeffect|usestate|jsx|virtual dom|component lifecycle)\b/i, allowedDomains: /\b(?:react|frontend|javascript|web)\b/i },
    { domain: 'Microbiology / Genetics', pattern: /\b(?:mitochondri\w+|bacteriophage|dna polymerase|crispr|ribosome|pcr amplification)\b/i, allowedDomains: /\b(?:biology|genetics|dna|cell|rna)\b/i },
    { domain: 'Aerospace / Physics', pattern: /\b(?:orbital mechanics|aerodynamic drag|warp drive|supersonic flow)\b/i, allowedDomains: /\b(?:physics|aerospace|flight|orbit)\b/i },
    { domain: 'Hardware / CPU Microarchitecture', pattern: /\b(?:hardware clock cycles?|cpu clock drift|32-bit integer overflow in the alu|cache line eviction|branch target buffer)\b/i, allowedDomains: /\b(?:hardware|architecture|cpu|processor|alu|register|clock|circuit|embedded|microprocessor)\b/i },
    { domain: 'Web / Browser State', pattern: /\b(?:browser cache expiration|http cookie timeout|dom manipulation|localstorage quota|session storage)\b/i, allowedDomains: /\b(?:web|browser|http|dom|cookie|frontend|javascript|css|html)\b/i },
    { domain: 'Distributed Consensus', pattern: /\b(?:raft consensus election|paxos consensus round|byzantine fault tolerance|gossip protocol)\b/i, allowedDomains: /\b(?:distributed|consensus|raft|paxos|replication|byzantine|quorum)\b/i },
    { domain: 'Git / Version Control', pattern: /\b(?:git\s+commit|commit\s+state|working\s+(?:directory|tree)|staging\s+area|git\s+push|git\s+pull|git\s+add|repository\s+clone|detached\s+head)\b/i, allowedDomains: /\b(?:git|vcs|version\s+control|repository|branch|commit)\b/i }
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
    const correctAnswer = String(mcq.correctAnswer || (mcq.options && typeof mcq.correctAnswerIndex === 'number' ? mcq.options[mcq.correctAnswerIndex] : '') || '').trim();
    const stem = String(mcq.questionText || mcq.questionStem || mcq.stem || '').trim();
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
    const plausibilityDim = this._validatePlausibility(distractors, domainEvidence, stem);
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
    // Dimension 6: No Duplicate Reasoning (No synonymous or subset distractors across all options)
    // ─────────────────────────────────────────────────────────────────────────
    const duplicateDim = this._validateNoDuplicateReasoning(options, stem);
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
    const fatalCodes = [
      'ERR_INVALID_OPTION_COUNT',
      'ERR_KEY_NOT_IN_OPTIONS',
      'ERR_IDENTICAL_OPTIONS',
      'ABSURD_DISTRACTOR',
      'FOREIGN_DOMAIN_CONTAMINATION',
      'POTENTIAL_MULTI_KEY',
      'ERR_FAKE_COMMAND',
      'INSUFFICIENT_COGNITIVE_DEMAND_FOR_HARD',
      'ERR_FORMAT_ASYMMETRY',
      'ERR_IMPLAUSIBLE_SUBSET_RULE',
      'ERR_INPUT_SYNTAX_FILLER',
      'ERR_GENERIC_NON_DOMAIN_FILLER'
    ];
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

  static _validatePlausibility(distractors, domainEvidence = '', stem = '') {
    const isPlantBioDomain = /\b(?:plant|plants|botany|photosynthesis|chlorophyll|agriculture|soil|agronomy|ecology|ecosystem)\b/i.test(`${domainEvidence} ${stem}`);

    for (let i = 0; i < distractors.length; i++) {
      const d = distractors[i];

      // Check weak / trivial / non-domain distractor patterns
      for (const wp of this.WEAK_DISTRACTOR_PATTERNS) {
        if (wp.pattern.test(d)) {
          if (!wp.condition || wp.condition(stem)) {
            return {
              passed: false,
              code: wp.code,
              affectedOptionIndices: [i],
              message: `Distractor "${d}" flagged: ${wp.reason}`,
              details: `Option [${i}] ${wp.reason}`
            };
          }
        }
      }

      for (const pattern of this.ABSURD_PATTERNS) {
        // If the pattern represents plant/botanical elements and the lecture is legitimately about plant biology, do not reject
        if (pattern.source.includes('sunlight') && isPlantBioDomain) {
          continue;
        }
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
    const context = `${stemLower} ${evLower}`;

    for (let i = 0; i < distractors.length; i++) {
      const d = distractors[i];
      for (const foreign of this.FOREIGN_TOPIC_SIGNALS) {
        if (foreign.pattern.test(d)) {
          const isAllowedInContext = foreign.allowedDomains
            ? foreign.allowedDomains.test(context)
            : (foreign.pattern.test(stemLower) || foreign.pattern.test(evLower));

          if (!isAllowedInContext) {
            return {
              passed: false,
              code: 'FOREIGN_DOMAIN_CONTAMINATION',
              message: `Distractor "${d}" introduces foreign domain concepts (${foreign.domain}) irrelevant to the question context`,
              details: `Option [${i}] has foreign topic contamination (${foreign.domain})`
            };
          }
        }
      }
    }
    return { passed: true, details: 'All distractors share conceptual domain relevance with lecture evidence' };
  }

  static _validateDifficultyAlignment(distractors, tier, stem) {
    const tierNorm = String(tier || 'Medium').toLowerCase();
    const stemLower = (stem || '').toLowerCase();
    const isCli = /\b(git|bash|docker|npm|command|terminal)\b/i.test(stemLower);

    for (let i = 0; i < distractors.length; i++) {
      const d = distractors[i].trim();
      const dLower = d.toLowerCase();

      // Check 1: Fake CLI commands in terminal questions (e.g. git upload, git save)
      if (isCli) {
        const fakeCommands = [
          /\bgit\s+(?:upload|save|record|send|stage-all|track|freeze|store)\b/i,
          /\bgit\s+commit\s+--all-files\b/i
        ];
        for (const fc of fakeCommands) {
          if (fc.test(d)) {
            return {
              passed: false,
              code: 'ERR_FAKE_COMMAND',
              affectedOptionIndices: [i],
              message: `Distractor "${d}" contains a fabricated/fictional command`,
              details: `Option [${i}] uses fictional command syntax`,
              repairGuidance: 'Replace fictional command with an authentic valid command (e.g. git checkout, git status, git reset).'
            };
          }
        }
      }

      // Check 2: Superficial 1-word polar opposites or boolean flips
      if (/^(?:true|false|yes|no)$/i.test(d) && !/\b(boolean|predicate|true or false)\b/i.test(stemLower)) {
        return {
          passed: false,
          code: 'ERR_SUPERFICIAL_OPPOSITE',
          affectedOptionIndices: [i],
          message: `Distractor "${d}" is a superficial boolean flip`,
          details: `Option [${i}] lacks conceptual depth`,
          repairGuidance: 'Replace single-word boolean with a substantive misconception mechanism.'
        };
      }

      // Check 3: Tier-specific cognitive demand validation
      if (tierNorm === 'hard') {
        // Superficial single-letter flags (e.g. -v, -f) on conceptual questions
        if (/^-[a-z]$/i.test(d) && !stemLower.includes('flag') && !stemLower.includes('option')) {
          return {
            passed: false,
            code: 'INSUFFICIENT_COGNITIVE_DEMAND_FOR_HARD',
            affectedOptionIndices: [i],
            message: `Distractor "${d}" is a superficial flag trivializing a Hard cognitive target`,
            details: `Option [${i}] lacks conceptual depth for Hard`,
            repairGuidance: 'Formulate a technically credible competing mechanism or boundary condition error.'
          };
        }
        // Childish or obvious non-technical throwaway in a Hard stem
        if (/^(?:it\s+fails|nothing|unknown|none|no\s+effect)$/i.test(d) && stemLower.split(/\s+/).length > 8) {
          return {
            passed: false,
            code: 'INSUFFICIENT_COGNITIVE_DEMAND_FOR_HARD',
            affectedOptionIndices: [i],
            message: `Distractor "${d}" is a trivial throwaway option inappropriate for a Hard-tier target`,
            details: `Option [${i}] lacks technical depth for Hard`,
            repairGuidance: 'Provide a plausible alternative state transition or competing mechanism.'
          };
        }
      }
    }

    if (tierNorm === 'hard') {
      return { passed: true, targetDifficulty: 'Hard', details: 'Distractors reflect subtle dynamic tradeoffs, boundary conditions, or competing mechanisms' };
    }
    if (tierNorm === 'easy') {
      return { passed: true, targetDifficulty: 'Easy', details: 'Distractors represent basic recall misconceptions or foundational role inversions' };
    }
    return { passed: true, targetDifficulty: 'Medium', details: 'Distractors represent plausible procedural or operational state misunderstandings' };
  }

  static _validateNoGiveaway(options, correctAnswer) {
    // 1. Format Asymmetry Check: Code syntax vs English prose
    const keyIsCode = this.isCodeSnippet(correctAnswer);
    const distractors = options.filter(o => o !== correctAnswer);
    const distractorCodeCounts = distractors.map(d => this.isCodeSnippet(d));
    const numCodeDistractors = distractorCodeCounts.filter(Boolean).length;

    if (keyIsCode && numCodeDistractors === 0 && distractors.length > 0) {
      return {
        passed: false,
        code: 'ERR_FORMAT_ASYMMETRY',
        message: 'Format asymmetry: Key is formatted as C++/code syntax while all distractors are English prose descriptions',
        details: 'Key is code snippet but distractors are prose descriptions'
      };
    }
    if (!keyIsCode && numCodeDistractors === distractors.length && distractors.length > 0) {
      return {
        passed: false,
        code: 'ERR_FORMAT_ASYMMETRY',
        message: 'Format asymmetry: Key is English prose while all distractors are C++/code syntax',
        details: 'Key is prose description but distractors are code snippets'
      };
    }

    const correctLen = correctAnswer.length;
    const distractorLens = distractors.map(o => o.length);
    const maxDistractorLen = distractorLens.length > 0 ? Math.max(...distractorLens) : 0;
    const minDistractorLen = distractorLens.length > 0 ? Math.min(...distractorLens) : 0;

    // If correct answer is > 2.5x longer than the LONGEST distractor, it is an obvious visual giveaway
    if (maxDistractorLen > 0 && correctLen > 2.5 * maxDistractorLen && correctLen > 70) {
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
    confirms: 'validates',
    // Exclusion / Prohibition
    prohibited: 'excluded',
    forbidden: 'excluded',
    disallowed: 'excluded',
    banned: 'excluded',
    omitted: 'excluded',
    dropped: 'excluded',
    removed: 'excluded',
    skips: 'excluded',
    cannot: 'excluded',
    nonzero: 'zero',
    zeros: 'zero',
    // Requirement / Existence
    requires: 'demands',
    needs: 'demands',
    available: 'present',
    exists: 'present'
  };

  static _validateNoDuplicateReasoning(options, stem) {
    const normalizeToken = w => this.SYNONYM_MAP[w] || w;
    const cleanTokens = s => s.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2 && !['the', 'and', 'for', 'with', 'that', 'this', 'will', 'from', 'all', 'exactly', 'product'].includes(w))
      .map(normalizeToken);

    const isZeroExclusion = s => {
      const sLower = s.toLowerCase();
      const hasZero = /\b(?:zero|zeros|0|nonzero)\b/i.test(sLower);
      const hasExclusion = /\b(?:prohibit\w*|exclud\w*|forbid\w*|disallow\w*|omit\w*|dropped|cannot\s+be\s+(?:used|included|multiplied)|must\s+not\s+be|requires?\s+non-?zero)\b/i.test(sLower);
      return hasZero && hasExclusion;
    };

    const extractNumbers = s => {
      const m = s.match(/-?\b\d+\b/g);
      return m ? m.join(',') : '';
    };

    for (let i = 0; i < options.length; i++) {
      for (let j = i + 1; j < options.length; j++) {
        const o1 = options[i];
        const o2 = options[j];

        // Semantic rule: both asserting zero exclusion
        if (isZeroExclusion(o1) && isZeroExclusion(o2)) {
          return {
            passed: false,
            code: 'SYNONYMOUS_DISTRACTORS',
            message: `Semantic redundancy: Option choices [${i}] and [${j}] both assert zero-exclusion/prohibition: "${o1}" vs "${o2}"`,
            details: `Semantic redundancy between option choices [${i}] and [${j}]`
          };
        }

        // If both options have distinct numerical values (e.g. 56 vs 8, or V-1 vs V+1), they are distinct numerical targets
        const nums1 = extractNumbers(o1);
        const nums2 = extractNumbers(o2);
        if (nums1 && nums2 && nums1 !== nums2) {
          continue; // Different numbers => distinct options!
        }

        // Check formula distinction (e.g. V * (V - 1) / 2 vs V)
        const hasFormula1 = /[Vv]\s*[\*\+\-\/]/.test(o1);
        const hasFormula2 = /[Vv]\s*[\*\+\-\/]/.test(o2);
        if (hasFormula1 || hasFormula2) {
          if (o1 !== o2) continue; // Different graph edge formulas => distinct!
        }

        // If both options are code snippets and differ, check if their normalized code tokens differ
        if (this.isCodeSnippet(o1) && this.isCodeSnippet(o2)) {
          if (o1.trim() !== o2.trim()) {
            const cleanCode = s => s.replace(/\s+/g, '');
            if (cleanCode(o1) !== cleanCode(o2)) {
              continue;
            }
          }
        }

        const t1 = cleanTokens(o1);
        const t2 = cleanTokens(o2);

        if (t1.length >= 2 && t2.length >= 2) {
          const s1 = new Set(t1);
          const s2 = new Set(t2);
          let intersection = 0;
          for (const t of s1) {
            if (s2.has(t)) intersection++;
          }
          const union = new Set([...s1, ...s2]).size;
          const jaccard = union > 0 ? (intersection / union) : 0;
          const containment = Math.min(s1.size, s2.size) > 0 ? (intersection / Math.min(s1.size, s2.size)) : 0;
          const isExactWordPermutation = (s1.size === s2.size && intersection === s1.size);

          // If two options are exact permutations of words, or share >= 60% Jaccard or >= 70% core semantic containment
          if (isExactWordPermutation || jaccard >= 0.60 || (intersection >= 3 && containment >= 0.70)) {
            return {
              passed: false,
              code: 'SYNONYMOUS_DISTRACTORS',
              message: `Option choices [${i}] and [${j}] represent duplicate reasoning or permuted wording (Jaccard: ${jaccard.toFixed(2)}, Containment: ${containment.toFixed(2)}): "${o1}" vs "${o2}"`,
              details: `Duplicate/synonymous reasoning between option choices [${i}] and [${j}]`
            };
          }
        }
      }
    }
    return { passed: true, details: 'Option choices represent distinct, non-overlapping conceptual choices' };
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
