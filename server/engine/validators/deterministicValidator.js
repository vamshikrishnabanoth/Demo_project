/**
 * server/engine/validators/deterministicValidator.js
 *
 * Deterministic Pre-Checks, Post-Checks & Pedagogical Redundancy Detection:
 * - Pre-Checks: JSON schema parsing, 4 options check, option string deduplication, correct answer existence.
 * - Similarity Signal: Token similarity with basic stemming flags candidates for pedagogical investigation.
 * - Multi-Factor Redundancy: Rejects only if High Similarity + Same Concept + Same Cognitive Dimension + Same Answer.
 * - Post-Checks: Final payload integrity and answer position randomization (A/B/C/D split ~25%).
 */

'use strict';

const crypto = require('crypto');
const { OPTION_SET_CONTRACT } = require('../contracts/pipelineContracts');

class DeterministicValidator {
  constructor() {
    this.OPTION_SET_CONTRACT = OPTION_SET_CONTRACT;
  }

  /**
   * Exact case and whitespace normalized option string.
   */
  normalizeExactOption(str) {
    if (typeof str !== 'string') return '';
    return str.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  /**
   * Superficial formatting strip: removes trailing punctuation, wrapping quotes/backticks,
   * markdown formatting, and option label prefixes ("A.", "A)", "Option A:").
   */
  stripSuperficialFormatting(str) {
    if (typeof str !== 'string') return '';
    return str
      .trim()
      .toLowerCase()
      // Remove option label prefixes: "Option A:", "A.", "A)", "(A)", "1.", "1)"
      .replace(/^(?:option\s+[a-d1-4]|(?:\(?[a-d1-4]\)?[\.\:\s\-]+))\s*/i, '')
      // Remove enclosing quotes, backticks, asterisks/markdown formatting
      .replace(/^[`'"*]+|[`'"*]+$/g, '')
      // Strip trailing punctuation (. , ; : ! ? -)
      .replace(/[\.\,\;\:\!\?\-\s]+$/g, '')
      // Strip leading punctuation
      .replace(/^[\.\,\;\:\!\?\-\s]+/g, '')
      // Collapse multiple whitespace
      .replace(/\s+/g, ' ')
      .trim();
  }

  normalizeCorrectAnswer(mcq) {
    if (!mcq || !Array.isArray(mcq.options) || mcq.options.length === 0 || !mcq.correctAnswer) {
      return;
    }
    const ans = String(mcq.correctAnswer).trim();

    // 1. Exact match
    if (mcq.options.includes(ans)) {
      mcq.correctAnswer = ans;
      return;
    }

    // 2. Letter / Index prefix: "Option A", "A", "A)", "(A)", "Option 1", "1"
    const letterMatch = ans.match(/^(?:option\s+)?([a-d1-4])(?:\)|\.|\:|\s|$)/i);
    if (letterMatch) {
      const char = letterMatch[1].toUpperCase();
      const map = { 'A': 0, '1': 0, 'B': 1, '2': 1, 'C': 2, '3': 2, 'D': 3, '4': 3 };
      const idx = map[char];
      if (idx !== undefined && mcq.options[idx]) {
        mcq.correctAnswer = mcq.options[idx];
        return;
      }
    }

    // 3. Case-insensitive or trimmed match
    const lowerAns = ans.toLowerCase();
    const matchedOpt = mcq.options.find(o => (o || '').trim().toLowerCase() === lowerAns);
    if (matchedOpt) {
      mcq.correctAnswer = matchedOpt;
      return;
    }

    // 4. Substring without letter prefix
    const strippedAns = ans.replace(/^(?:option\s+[a-d1-4]|(?:[a-d1-4][\)\.\:\s]+))\s*/i, '').trim().toLowerCase();
    if (strippedAns) {
      const subMatch = mcq.options.find(o => (o || '').trim().toLowerCase() === strippedAns);
      if (subMatch) {
        mcq.correctAnswer = subMatch;
        return;
      }
    }
  }

  /**
   * Module 2 Option Set Validator (Deterministic Option Contract).
   * Validates options array according to OPTION_SET_CONTRACT:
   * - Count must be exactly 4 (INVALID_OPTION_COUNT)
   * - Options must not be empty or shorter than 2 chars (EMPTY_OR_SHORT_OPTION)
   * - Options must not be exact duplicates after whitespace/case normalization (EXACT_DUPLICATE_OPTION)
   * - Options must not be superficial/punctuation/formatting variants (SUPERFICIAL_VARIANT_OPTION)
   * - Options must not form unconstrained subset command/parameter chains (SUBSET_COMMAND_CHAIN)
   * - Options must not exhibit extreme length disparity (>2.5x and diff >= 20 chars) (EXTREME_LENGTH_IMBALANCE)
   * - Pairwise token similarity > 0.80 flags an advisory warning (HIGH_SEMANTIC_SIMILARITY)
   *
   * @param {Array<String>} options - Array of option strings
   * @param {String} [stem=''] - Optional question stem
   * @param {String} [correctAnswer=''] - Optional correct answer
   * @returns {Object} { isValid, errors, warnings, metrics }
   */
  validateOptionSet(options, stem = '', correctAnswer = '') {
    const errors = [];
    const warnings = [];

    // 1. Array and count validation
    if (!Array.isArray(options) || options.length !== this.OPTION_SET_CONTRACT.requiredCount) {
      const err = {
        code: this.OPTION_SET_CONTRACT.hardRejectionCodes.INVALID_OPTION_COUNT,
        message: `Options must be an array of exactly ${this.OPTION_SET_CONTRACT.requiredCount} strings, found ${Array.isArray(options) ? options.length : 0}`
      };
      return {
        isValid: false,
        errors: [err],
        warnings: [],
        metrics: null
      };
    }

    // 2. Empty / Short options check
    options.forEach((opt, idx) => {
      if (typeof opt !== 'string' || opt.trim().length < this.OPTION_SET_CONTRACT.minOptionLength) {
        errors.push({
          code: this.OPTION_SET_CONTRACT.hardRejectionCodes.EMPTY_OR_SHORT_OPTION,
          message: `Option at index ${idx} is empty or shorter than ${this.OPTION_SET_CONTRACT.minOptionLength} characters: "${opt}"`,
          details: { index: idx, value: opt }
        });
      }
    });

    // 3. Exact duplicates and superficial variants
    const exactNormalized = options.map(o => this.normalizeExactOption(o));
    const superficialNormalized = options.map(o => this.stripSuperficialFormatting(o));

    for (let i = 0; i < options.length; i++) {
      for (let j = i + 1; j < options.length; j++) {
        // Exact duplicate
        if (exactNormalized[i] && exactNormalized[i] === exactNormalized[j]) {
          errors.push({
            code: this.OPTION_SET_CONTRACT.hardRejectionCodes.EXACT_DUPLICATE_OPTION,
            message: `Duplicate option choices detected: "${options[i]}" and "${options[j]}" are identical after normalization`,
            details: { indexA: i, indexB: j, optionA: options[i], optionB: options[j] }
          });
        }
        // Superficial variant (only if not already an exact duplicate)
        else if (superficialNormalized[i] && superficialNormalized[i] === superficialNormalized[j]) {
          errors.push({
            code: this.OPTION_SET_CONTRACT.hardRejectionCodes.SUPERFICIAL_VARIANT_OPTION,
            message: `Superficial variant detected: "${options[i]}" and "${options[j]}" differ only by punctuation, formatting, or labels`,
            details: { indexA: i, indexB: j, optionA: options[i], optionB: options[j] }
          });
        }
      }
    }

    // 4. Subset command / parameter chains (unconstrained nesting)
    const ambiguityCheck = this.detectOptionAmbiguity(stem, options, correctAnswer);
    if (ambiguityCheck.classification === 'POTENTIAL_MULTI_KEY') {
      errors.push({
        code: this.OPTION_SET_CONTRACT.hardRejectionCodes.SUBSET_COMMAND_CHAIN,
        message: `SUBSET_COMMAND_CHAIN: ${ambiguityCheck.reason}`,
        details: { offendingPair: ambiguityCheck.offendingPair }
      });
    }

    // 5. Extreme length imbalance
    const lengths = options.map(o => (typeof o === 'string' ? o.trim().length : 0));
    const minLen = Math.min(...lengths);
    const maxLen = Math.max(...lengths);
    const charDiff = maxLen - minLen;
    const ratio = minLen > 0 ? Number((maxLen / minLen).toFixed(2)) : Infinity;

    if (charDiff >= this.OPTION_SET_CONTRACT.lengthDisparityAbsoluteCharMin && ratio > this.OPTION_SET_CONTRACT.lengthDisparityRatioThreshold) {
      errors.push({
        code: this.OPTION_SET_CONTRACT.hardRejectionCodes.EXTREME_LENGTH_IMBALANCE,
        message: `Extreme option length imbalance: longest option (${maxLen} chars) is ${ratio}x shortest option (${minLen} chars, diff: ${charDiff} chars >= ${this.OPTION_SET_CONTRACT.lengthDisparityAbsoluteCharMin})`,
        details: { minLen, maxLen, ratio, charDiff }
      });
    }

    // 6. Semantic similarity warning signal (> 0.80)
    let maxSimilarity = 0;
    for (let i = 0; i < options.length; i++) {
      for (let j = i + 1; j < options.length; j++) {
        if (typeof options[i] !== 'string' || typeof options[j] !== 'string') continue;
        const sim = this.calculateSimilarity(options[i], options[j]);
        if (sim > maxSimilarity) maxSimilarity = sim;
        if (sim > this.OPTION_SET_CONTRACT.similarityWarningThreshold) {
          warnings.push({
            code: this.OPTION_SET_CONTRACT.warningCodes.HIGH_SEMANTIC_SIMILARITY,
            message: `Options at indices ${i} and ${j} exhibit high token similarity (${sim.toFixed(2)} > ${this.OPTION_SET_CONTRACT.similarityWarningThreshold})`,
            details: {
              indexA: i,
              indexB: j,
              optionA: options[i],
              optionB: options[j],
              similarity: sim
            }
          });
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      metrics: {
        lengths,
        minLen,
        maxLen,
        ratio: isFinite(ratio) ? ratio : null,
        charDiff,
        maxSimilarity
      }
    };
  }

  /**
   * Run Deterministic Pre-Checks on candidate MCQ.
   * @param {Object} mcq - Candidate MCQ object
   * @returns {Object} { isValid, errors, warnings, optionMetrics, detailedErrors }
   */
  runPreChecks(mcq) {
    const errors = [];
    const warnings = [];

    if (!mcq || typeof mcq !== 'object') {
      return { isValid: false, errors: ['MCQ payload is null or not an object'], warnings: [] };
    }

    // Normalize correctAnswer before validating
    this.normalizeCorrectAnswer(mcq);

    if (!mcq.questionText || typeof mcq.questionText !== 'string' || mcq.questionText.trim().length < 10) {
      errors.push('questionText must be a string with at least 10 characters');
    }

    // Validate options set using formal contract & deterministic checks
    const optionSetResult = this.validateOptionSet(
      mcq.options,
      mcq.questionText || mcq.stem || '',
      mcq.correctAnswer || ''
    );

    if (!optionSetResult.isValid) {
      for (const err of optionSetResult.errors) {
        errors.push(err.message || `${err.code}: Option validation failed`);
      }
    }
    if (optionSetResult.warnings && optionSetResult.warnings.length > 0) {
      warnings.push(...optionSetResult.warnings);
    }

    if (!mcq.correctAnswer || typeof mcq.correctAnswer !== 'string') {
      errors.push('correctAnswer is required and must be a string');
    } else if (Array.isArray(mcq.options) && !mcq.options.includes(mcq.correctAnswer)) {
      errors.push('correctAnswer does not match any of the 4 provided options');
    }

    return {
      isValid: errors.length === 0,
      errors: errors,
      warnings: warnings,
      optionMetrics: optionSetResult.metrics,
      detailedErrors: optionSetResult.errors
    };
  }

  _extractFlags(cmdStr) {
    const tokens = String(cmdStr || '').split(/\s+/);
    return tokens.filter(t => t.startsWith('-')).map(t => t.split('=')[0]);
  }

  /**
   * Phase 3.3: Deterministic Option-Relationship Ambiguity Detector.
   * Classifies option sets into:
   * - 'NO_NESTING': Options are mutually distinct without additive parameter/flag subsumption.
   *   (NOTE: Does NOT mean zero textual overlap; means containment is non-additive, e.g. math/code subexpressions).
   * - 'EXPLICITLY_DISCRIMINATED': Contained option is explicitly distinguished by criteria in the stem.
   * - 'POTENTIAL_MULTI_KEY': Contained option exhibits unconstrained nesting risking dual valid keys.
   * - 'UNCERTAIN': Ambiguous or complex overlap, deferred to Agent 3.
   *
   * @param {String} stem - Question stem text
   * @param {Array<String>} options - Array of 4 option strings
   * @param {String} correctAnswer - Target correct answer string
   * @returns {Object} { classification, reason, offendingPair }
   */
  detectOptionAmbiguity(stem = '', options = [], correctAnswer = '') {
    if (!Array.isArray(options) || options.length < 2) {
      return { classification: 'NO_NESTING', reason: 'Insufficient options to evaluate', offendingPair: null };
    }

    const cleanStem = String(stem || '').toLowerCase();
    const stemTokens = cleanStem
      .replace(/[^a-z0-9]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 3);

    const nestedPairs = [];

    for (let i = 0; i < options.length; i++) {
      for (let j = 0; j < options.length; j++) {
        if (i === j) continue;
        const o1 = String(options[i] || '').trim();
        const o2 = String(options[j] || '').trim();
        if (!o1 || !o2 || o1 === o2) continue;
        if (o1.length < 5 || o2.length <= o1.length) continue;

        const o1Lower = o1.toLowerCase();
        const o2Lower = o2.toLowerCase();

        // 1. Command Flag Subsumption (Generic CLI Invariant)
        // Same command executable with dash-prefixed flags where o1 flags are a strict subset of o2 flags
        const o1Words = o1.split(/\s+/);
        const o2Words = o2.split(/\s+/);
        const hasFlags = (o1.includes('--') || o1.includes(' -')) && (o2.includes('--') || o2.includes(' -'));

        if (o1Words[0].toLowerCase() === o2Words[0].toLowerCase() && hasFlags) {
          const flags1 = this._extractFlags(o1);
          const flags2 = this._extractFlags(o2);
          const f1Lower = flags1.map(f => f.toLowerCase());
          const f2Lower = flags2.map(f => f.toLowerCase());

          if (flags1.length > 0 && flags2.length > flags1.length) {
            const isFlagSubset = f1Lower.every(f => f2Lower.includes(f));
            if (isFlagSubset) {
              const extraFlags = flags2.filter(f => !f1Lower.includes(f.toLowerCase()));
              const rawDiffTokens = extraFlags
                .map(f => f.replace(/^\-+/, '').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().split(/[\s_\-]+/))
                .flat()
                .filter(w => w.length >= 3);

              const o1Tokens = new Set(o1Lower.replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(w => w.length >= 3));
              const distinctDiffTokens = [...new Set(rawDiffTokens)].filter(t => !o1Tokens.has(t));
              const diffTokens = distinctDiffTokens.length > 0 ? distinctDiffTokens : [...new Set(rawDiffTokens)];

              nestedPairs.push({ shortOpt: o1, longOpt: o2, diffTokens, type: 'FLAG_SUBSUMPTION' });
              continue;
            }
          }
        }

        // 2. Whitespace-separated prefix flag/parameter extension (e.g. 'git init' -> 'git init --bare', 'git add' -> 'git add .')
        if (o2Lower.startsWith(o1Lower) && /\s/.test(o2Lower[o1Lower.length])) {
          const remainder = o2.substring(o1Lower.length).trim();
          // Exclude arithmetic operator chains like '+ z' or '- z'
          const isArithmeticChain = /^[\+\*\/\%\^]/.test(remainder) || /^\-\s/.test(remainder);

          // Additive parameter extension requires remainder to be a flag, structured parameter, dot/path, or quoted argument
          const isFlagExtension = remainder.startsWith('--') || /^\-[a-zA-Z0-9]/.test(remainder);
          const isSyntaxSymbol = remainder === '.' || remainder.startsWith('./') || remainder === '*' || remainder.startsWith('..') || /^["'`]/.test(remainder);
          const isStructuredParameter = isFlagExtension || isSyntaxSymbol;

          if (!isArithmeticChain && isStructuredParameter) {
            let rawTokens = remainder
              .replace(/([a-z])([A-Z])/g, '$1 $2')
              .toLowerCase()
              .replace(/[^a-z0-9]/g, ' ')
              .split(/\s+/)
              .filter(w => w.length >= 3);

            // For symbolic parameters like '.' or '*' that yield no length>=3 word tokens,
            // provide semantic anchor tokens so discrimination check can evaluate stem
            if (rawTokens.length === 0 && (remainder === '.' || remainder.startsWith('./') || remainder === '*')) {
              rawTokens = ['dot', 'period', 'all', 'current', 'directory', 'working'];
            }

            const o1Tokens = new Set(o1Lower.replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(w => w.length >= 3));
            const distinctDiffTokens = [...new Set(rawTokens)].filter(t => !o1Tokens.has(t));
            const diffTokens = distinctDiffTokens.length > 0 ? distinctDiffTokens : [...new Set(rawTokens)];

            nestedPairs.push({
              shortOpt: o1,
              longOpt: o2,
              diffTokens: diffTokens.length > 0 ? diffTokens : [...new Set(rawTokens)],
              type: isFlagExtension ? 'PREFIX_ADDITIVE_EXTENSION' : 'PREFIX_PARAMETER_EXTENSION'
            });
          }
        }
      }
    }

    if (nestedPairs.length === 0) {
      return {
        classification: 'NO_NESTING',
        reason: 'No additive option/parameter subsumption detected',
        offendingPair: null
      };
    }

    // Evaluate each nested pair against the stem
    for (const pair of nestedPairs) {
      const { shortOpt, longOpt, diffTokens } = pair;
      const isDiscriminated = diffTokens.length > 0 && diffTokens.some(dt => {
        return stemTokens.some(st => {
          if (st === dt) return true;
          if (st.length >= 4 && dt.length >= 4 && st.startsWith(dt)) return true;
          return false;
        });
      });

      if (!isDiscriminated) {
        return {
          classification: 'POTENTIAL_MULTI_KEY',
          reason: `Options "${shortOpt}" and "${longOpt}" exhibit unconstrained nesting; the distinguishing parameter (${diffTokens.join(', ') || 'unspecified difference'}) is not constrained in the stem`,
          offendingPair: [shortOpt, longOpt]
        };
      }
    }

    return {
      classification: 'EXPLICITLY_DISCRIMINATED',
      reason: 'Contained options are explicitly distinguished by criteria in the stem',
      offendingPair: null
    };
  }

  _stem(word) {
    if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
    if (word.endsWith('es')) return word.slice(0, -2);
    if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
    if (word.endsWith('ing') && word.length > 5) return word.slice(0, -3);
    if (word.endsWith('ed') && word.length > 4) return word.slice(0, -2);
    return word;
  }

  /**
   * Tokenize text into meaningful content words with basic stemming.
   */
  _tokenize(text = '') {
    const stopwords = new Set([
      'the', 'and', 'for', 'which', 'what', 'that', 'with', 'this', 'from',
      'into', 'during', 'after', 'before', 'where', 'when', 'should', 'would',
      'could', 'about', 'their', 'there', 'having', 'being', 'does', 'primary',
      'following', 'statement', 'accurately', 'context', 'main', 'basic', 'how',
      'why', 'can', 'are', 'were'
    ]);

    return new Set(
      String(text || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2 && !stopwords.has(w))
        .map(w => this._stem(w))
    );
  }

  /**
   * Calculate Jaccard word-set similarity between two texts.
   */
  calculateSimilarity(textA = '', textB = '') {
    const t1 = this._tokenize(textA);
    const t2 = this._tokenize(textB);
    if (t1.size === 0 || t2.size === 0) return 0;

    let intersection = 0;
    t1.forEach(token => {
      if (t2.has(token)) intersection++;
    });

    const union = new Set([...t1, ...t2]).size;
    return union > 0 ? Number((intersection / union).toFixed(3)) : 0;
  }

  /**
   * Pedagogical Redundancy Check:
   * Similarity is an investigation signal. A question is rejected ONLY if:
   * - Extreme verbatim similarity (>= 0.80) OR
   * - High similarity (>= 0.35) AND same concept AND same cognitive dimension AND same answer.
   * Questions testing the same concept across DIFFERENT cognitive dimensions (e.g. Definition vs Scenario) are KEPT!
   */
  checkDuplicateQuestion(candidateMCQ, existingQuestions = [], currentTarget = {}) {
    if (!candidateMCQ || !candidateMCQ.questionText || !Array.isArray(existingQuestions) || existingQuestions.length === 0) {
      return { isDuplicate: false, similarity: 0 };
    }

    for (const existing of existingQuestions) {
      const sim = this.calculateSimilarity(candidateMCQ.questionText, existing.questionText || '');

      const candidateDim = candidateMCQ.metadata?.dimension || currentTarget.dimension || 'Conceptual';
      const existingDim = existing.metadata?.dimension || 'Conceptual';
      const sameDimension = candidateDim === existingDim;

      const candidateConcept = candidateMCQ.metadata?.concept || currentTarget.concept || '';
      const existingConcept = existing.metadata?.concept || '';
      const sameConcept = candidateConcept.toLowerCase() === existingConcept.toLowerCase();

      const candidateAns = (candidateMCQ.correctAnswer || '').trim().toLowerCase();
      const existingAns = (existing.correctAnswer || '').trim().toLowerCase();
      const sameAnswer = candidateAns.length > 0 && candidateAns === existingAns;

      // 1. Extreme verbatim duplicate
      if (sim >= 0.80) {
        return {
          isDuplicate: true,
          similarity: sim,
          reason: 'VERBATIM_DUPLICATE: Text similarity exceeds 0.80',
          duplicateWith: existing.questionText
        };
      }

      // 2. Pedagogical duplicate: same concept + same cognitive operation + same answer
      if (sameDimension && (sameConcept || sameAnswer) && sim >= 0.30) {
        return {
          isDuplicate: true,
          similarity: sim,
          reason: 'PEDAGOGICAL_REDUNDANCY: High similarity testing identical cognitive operation and answer',
          duplicateWith: existing.questionText
        };
      }
    }

    return { isDuplicate: false, similarity: 0 };
  }

  /**
   * Compute whole-quiz pairwise redundancy matrix.
   */
  computeRedundancyMatrix(quizQuestions = []) {
    const highSimilarityPairs = [];

    for (let i = 0; i < quizQuestions.length; i++) {
      for (let j = i + 1; j < quizQuestions.length; j++) {
        const q1 = quizQuestions[i];
        const q2 = quizQuestions[j];
        const sim = this.calculateSimilarity(q1.questionText || '', q2.questionText || '');

        if (sim >= 0.35) {
          const dim1 = q1.metadata?.dimension || 'Conceptual';
          const dim2 = q2.metadata?.dimension || 'Conceptual';
          const sameDimension = dim1 === dim2;

          const concept1 = (q1.metadata?.concept || '').toLowerCase();
          const concept2 = (q2.metadata?.concept || '').toLowerCase();
          const sameConcept = concept1.length > 0 && concept1 === concept2;

          const isTrueRedundant = sim >= 0.75 || (sim >= 0.35 && sameDimension && sameConcept);

          highSimilarityPairs.push({
            pair: `Q${i + 1} ↔ Q${j + 1}`,
            q1Index: i + 1,
            q2Index: j + 1,
            similarity: sim,
            sameDimension,
            sameConcept,
            isTrueRedundant,
            decision: isTrueRedundant ? 'REDUNDANT' : 'KEEP (Different Dimension)',
            q1Text: q1.questionText,
            q2Text: q2.questionText
          });
        }
      }
    }

    const trueRedundantCount = highSimilarityPairs.filter(p => p.isTrueRedundant).length;

    return {
      highSimilarityPairs,
      totalRedundantPairs: trueRedundantCount,
      totalSimilarPairs: highSimilarityPairs.length
    };
  }

  /**
   * Evaluate a single pair for pedagogical redundancy vs cognitive variation.
   */
  checkPedagogicalPairRedundancy(q1, q2) {
    const sim = this.calculateSimilarity(q1.questionText || '', q2.questionText || '');
    const dim1 = q1.metadata?.dimension || 'Conceptual';
    const dim2 = q2.metadata?.dimension || 'Conceptual';
    const sameDimension = dim1 === dim2;

    const ans1 = (q1.correctAnswer || '').trim().toLowerCase();
    const ans2 = (q2.correctAnswer || '').trim().toLowerCase();
    const sameAnswer = ans1.length > 0 && ans1 === ans2;

    if (sim >= 0.80) {
      return { verdict: 'REJECT_REDUNDANT', similarity: sim, reason: 'Verbatim duplicate' };
    }

    if (sim >= 0.30 && sameDimension && sameAnswer) {
      return { verdict: 'REJECT_REDUNDANT', similarity: sim, reason: 'Identical cognitive operation and answer' };
    }

    if (sim >= 0.30 && !sameDimension) {
      return { verdict: 'KEEP_COGNITIVE_VARIATION', similarity: sim, reason: 'Different cognitive dimension (e.g. Conceptual vs Scenario)' };
    }

    return { verdict: 'KEEP_DISTINCT', similarity: sim, reason: 'Low similarity distinct question' };
  }

  /**
   * In-place Fisher-Yates shuffle using cryptographic randomness.
   * @param {Array} array
   * @returns {Array} Shuffled array
   */
  shuffleArrayCrypto(array) {
    if (!Array.isArray(array) || array.length <= 1) return array;
    for (let i = array.length - 1; i > 0; i--) {
      const j = crypto.randomInt(0, i + 1);
      const temp = array[i];
      array[i] = array[j];
      array[j] = temp;
    }
    return array;
  }

  /**
   * Normalizes raw MCQ into authoritative semantic representation:
   * { correctAnswerText, distractorTexts }
   * Enforces strict contract: 4 options, exactly one match for correctAnswer, exactly 3 distinct distractors.
   * Idempotence-safe: If already assigned (__positionAssigned === true), returns as-is.
   *
   * @param {Object} mcq - Candidate MCQ object
   * @returns {Object} Normalized MCQ with mcq.semanticIdentity
   */
  normalizeSemanticMCQ(mcq) {
    if (!mcq || typeof mcq !== 'object') {
      const err = new Error('KEY_ASSIGNMENT_INTEGRITY_ERROR: MCQ payload is null or not an object');
      err.code = 'KEY_ASSIGNMENT_INTEGRITY_ERROR';
      throw err;
    }

    // Idempotence guard: if already positioned and verified, return as-is
    if (mcq.__positionAssigned === true && mcq.semanticIdentity) {
      return mcq;
    }

    if (!Array.isArray(mcq.options) || mcq.options.length !== 4) {
      const err = new Error(`KEY_ASSIGNMENT_INTEGRITY_ERROR: Expected exactly 4 options, found ${Array.isArray(mcq.options) ? mcq.options.length : 0}`);
      err.code = 'KEY_ASSIGNMENT_INTEGRITY_ERROR';
      throw err;
    }

    // Normalize string representations before semantic extraction
    this.normalizeCorrectAnswer(mcq);

    const rawAns = (mcq.correctAnswerText || mcq.correctAnswer || '').toString().trim();
    if (!rawAns) {
      const err = new Error('KEY_ASSIGNMENT_INTEGRITY_ERROR: Missing correctAnswer in candidate MCQ');
      err.code = 'KEY_ASSIGNMENT_INTEGRITY_ERROR';
      throw err;
    }

    const normOptions = mcq.options.map(o => String(o || '').trim());

    // Find all matches for correctAnswerText in options
    const matchingIndices = [];
    normOptions.forEach((opt, idx) => {
      if (opt === rawAns || opt.toLowerCase() === rawAns.toLowerCase()) {
        matchingIndices.push(idx);
      }
    });

    // Strict Contract: Exactly ONE option must match correctAnswerText
    if (matchingIndices.length !== 1) {
      const err = new Error(`KEY_ASSIGNMENT_INTEGRITY_ERROR: Expected exactly one match for correctAnswer "${rawAns}", found ${matchingIndices.length}`);
      err.code = 'KEY_ASSIGNMENT_INTEGRITY_ERROR';
      throw err;
    }

    const exactCorrectText = normOptions[matchingIndices[0]];
    const distractorTexts = normOptions.filter((_, idx) => idx !== matchingIndices[0]);

    // Invariant: Exactly three distractors
    if (distractorTexts.length !== 3) {
      const err = new Error(`KEY_ASSIGNMENT_INTEGRITY_ERROR: Expected exactly 3 distractors, found ${distractorTexts.length}`);
      err.code = 'KEY_ASSIGNMENT_INTEGRITY_ERROR';
      throw err;
    }

    // Invariant: Distractors must be mutually distinct (no duplicate choices)
    const uniqueDistractors = new Set(distractorTexts.map(d => d.toLowerCase()));
    if (uniqueDistractors.size !== 3) {
      const err = new Error('KEY_ASSIGNMENT_INTEGRITY_ERROR: Distractors contain duplicate choices');
      err.code = 'KEY_ASSIGNMENT_INTEGRITY_ERROR';
      throw err;
    }

    mcq.semanticIdentity = {
      correctAnswerText: exactCorrectText,
      distractorTexts: distractorTexts
    };

    return mcq;
  }

  /**
   * Balanced Target-Key Allocation Planner.
   * Computes the most even possible distribution across {A, B, C, D}:
   *   max(count) - min(count) <= 1
   * Cryptographically selects which keys receive the extra remainder slots,
   * and cryptographically permutes the final target sequence to prevent repeating patterns.
   *
   * @param {number} quizCount - Number of questions (N)
   * @returns {Array<string>} Array of N target keys (e.g. ['C', 'A', 'D', 'B', 'A'])
   */
  planBalancedKeyDistribution(quizCount) {
    const N = parseInt(quizCount, 10);
    if (isNaN(N) || N <= 0) {
      return [];
    }

    const KEYS = ['A', 'B', 'C', 'D'];
    const baseCount = Math.floor(N / 4);
    const remainder = N % 4;

    // Initialize counts with base quota
    const counts = { A: baseCount, B: baseCount, C: baseCount, D: baseCount };

    // If remainder > 0, randomly choose which remainder keys receive +1
    if (remainder > 0) {
      const shuffledKeys = this.shuffleArrayCrypto([...KEYS]);
      for (let i = 0; i < remainder; i++) {
        counts[shuffledKeys[i]] += 1;
      }
    }

    // Assert mathematical invariant: max(count) - min(count) <= 1
    const countValues = Object.values(counts);
    const maxCount = Math.max(...countValues);
    const minCount = Math.min(...countValues);
    if (maxCount - minCount > 1) {
      const err = new Error(`KEY_PLANNER_INVARIANT_VIOLATION: max(${maxCount}) - min(${minCount}) > 1 for N=${N}`);
      err.code = 'KEY_PLANNER_INVARIANT_VIOLATION';
      throw err;
    }

    // Build target sequence
    const plannedKeys = [];
    for (const key of KEYS) {
      for (let c = 0; c < counts[key]; c++) {
        plannedKeys.push(key);
      }
    }

    // Cryptographically permute the target sequence to eliminate fixed positional patterns
    this.shuffleArrayCrypto(plannedKeys);

    return plannedKeys;
  }

  /**
   * Assigns question to target presentation key and verifies post-assignment integrity.
   * 1. Target key placement (options[targetIndex] = correctAnswerText).
   * 2. Crypto Fisher-Yates permutation of the 3 distractors across the remaining 3 slots.
   * 3. Hard post-assignment reference integrity assertions.
   * 4. Exclusivity re-verification ensuring single-key validity is preserved.
   * Idempotence-safe: If already assigned (__positionAssigned === true), returns as-is.
   *
   * @param {Object} mcq - Candidate MCQ object
   * @param {String} targetKey - Target presentation key ('A', 'B', 'C', or 'D')
   * @returns {Object} Transformed, synchronized MCQ
   */
  assignAndVerifyKeyPositions(mcq, targetKey) {
    if (!mcq || typeof mcq !== 'object') {
      const err = new Error('KEY_ASSIGNMENT_INTEGRITY_ERROR: Invalid MCQ');
      err.code = 'KEY_ASSIGNMENT_INTEGRITY_ERROR';
      throw err;
    }

    // Idempotence guard: if already positioned, return without re-assignment
    if (mcq.__positionAssigned === true) {
      return mcq;
    }

    const KEY_TO_INDEX = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };
    const targetIndex = KEY_TO_INDEX[targetKey];
    if (targetIndex === undefined) {
      const err = new Error(`KEY_ASSIGNMENT_INTEGRITY_ERROR: Invalid targetKey "${targetKey}"`);
      err.code = 'KEY_ASSIGNMENT_INTEGRITY_ERROR';
      throw err;
    }

    // Normalize semantic identity
    this.normalizeSemanticMCQ(mcq);

    const { correctAnswerText, distractorTexts } = mcq.semanticIdentity;

    // Pre-assignment exclusivity check
    const preAmbiguity = this.detectOptionAmbiguity(mcq.questionText || mcq.stem, mcq.options, mcq.correctAnswer);

    // Permute the 3 distractors cryptographically
    const shuffledDistractors = this.shuffleArrayCrypto([...distractorTexts]);

    // Assemble presentation options array
    const newOptions = new Array(4);
    newOptions[targetIndex] = correctAnswerText;

    let dIdx = 0;
    for (let i = 0; i < 4; i++) {
      if (i !== targetIndex) {
        newOptions[i] = shuffledDistractors[dIdx++];
      }
    }

    // Post-Assignment Hard Integrity Assertions
    if (newOptions.length !== 4) {
      const err = new Error('KEY_ASSIGNMENT_INTEGRITY_ERROR: Output options length is not 4');
      err.code = 'KEY_ASSIGNMENT_INTEGRITY_ERROR';
      throw err;
    }

    if (newOptions[targetIndex] !== correctAnswerText) {
      const err = new Error(`KEY_ASSIGNMENT_INTEGRITY_ERROR: Target slot ${targetKey} (${targetIndex}) does not match correctAnswerText`);
      err.code = 'KEY_ASSIGNMENT_INTEGRITY_ERROR';
      throw err;
    }

    const matchCount = newOptions.filter(o => o === correctAnswerText).length;
    if (matchCount !== 1) {
      const err = new Error(`KEY_ASSIGNMENT_INTEGRITY_ERROR: Exactly one option must match correctAnswerText, found ${matchCount}`);
      err.code = 'KEY_ASSIGNMENT_INTEGRITY_ERROR';
      throw err;
    }

    const uniqueCount = new Set(newOptions.map(o => String(o).trim().toLowerCase())).size;
    if (uniqueCount !== 4) {
      const err = new Error('KEY_ASSIGNMENT_INTEGRITY_ERROR: Assigned options are not distinct');
      err.code = 'KEY_ASSIGNMENT_INTEGRITY_ERROR';
      throw err;
    }

    // Post-assignment exclusivity re-verification
    const postAmbiguity = this.detectOptionAmbiguity(mcq.questionText || mcq.stem, newOptions, correctAnswerText);
    if (preAmbiguity.classification !== 'POTENTIAL_MULTI_KEY' && postAmbiguity.classification === 'POTENTIAL_MULTI_KEY') {
      const err = new Error(`KEY_ASSIGNMENT_INTEGRITY_ERROR: Positional assignment created unexpected option ambiguity: ${postAmbiguity.reason}`);
      err.code = 'KEY_ASSIGNMENT_INTEGRITY_ERROR';
      throw err;
    }

    // Synchronize fields for all downstream consumers
    mcq.options = newOptions;
    mcq.correctAnswer = correctAnswerText; // full text string for Stage 07 & Grading Layer 1
    mcq.correctAnswerText = correctAnswerText; // authoritative semantic identity
    mcq.correctAnswerKey = targetKey; // presentation key
    mcq.correct_answer = targetKey; // presentation key for benchmark M8 & UI
    mcq.correct_answer_text = correctAnswerText; // explicit benchmark compatibility
    mcq.__positionAssigned = true; // idempotence guard

    return mcq;
  }

  /**
   * Whole-quiz balanced key assignment coordinator.
   * Plans balanced key allocation for quiz length N (max - min <= 1),
   * assigns each question to its target slot, and validates reference integrity.
   *
   * @param {Array} quizQuestions - Array of passing candidate MCQs
   * @returns {Array} Balanced, transformed MCQs
   */
  balanceAndAssignKeyPositions(quizQuestions = []) {
    if (!Array.isArray(quizQuestions) || quizQuestions.length === 0) {
      return [];
    }

    const N = quizQuestions.length;
    const plannedKeys = this.planBalancedKeyDistribution(N);

    const assignedQuestions = quizQuestions.map((q, idx) => {
      const copy = { ...q };
      const targetKey = plannedKeys[idx];
      return this.assignAndVerifyKeyPositions(copy, targetKey);
    });

    return assignedQuestions;
  }

  /**
   * Run Deterministic Post-Checks & Option Randomization (Stable Stage 06 Interface).
   * @param {Array} quizQuestions - Array of passing MCQ objects
   * @returns {Array} Balanced & normalized MCQs
   */
  runPostChecks(quizQuestions = []) {
    return this.balanceAndAssignKeyPositions(quizQuestions);
  }
}

module.exports = new DeterministicValidator();
