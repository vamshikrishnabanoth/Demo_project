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
const DifficultyAwareDistractorValidator = require('./difficultyAwareDistractorValidator');
const disfluencySanitizer = require('../intelligence/disfluencySanitizer');

const SCHEMA_PLACEHOLDER_OPTIONS = new Set([
  'contrasting algorithmic approach or property',
  'technically precise correct formulation',
  'boundary condition or complexity trap',
  'plausible engineering alternative misconception',
  'plausible engineering alternative',
  'boundary condition trap',
  'plausible alternative concept',
  'distinct contrasting mechanism',
  'valid factual formulation',
  'common conceptual misconception',
  'crisp 1 2 sentence question',
  'identical to questiontext'
]);

class DeterministicValidator {
  constructor() {
    this.OPTION_SET_CONTRACT = OPTION_SET_CONTRACT;
  }

  /**
   * Exact case and whitespace normalized option string.
   */
  isSchemaPlaceholderOption(str) {
    if (typeof str !== 'string') return false;
    const norm = str
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!norm) return false;
    return SCHEMA_PLACEHOLDER_OPTIONS.has(norm);
  }

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
    const allowedPattern = this.OPTION_SET_CONTRACT.allowedSingleCharPattern || /^[0-9a-zA-Z+\-*\/%^=<>&|!~]$/;
    options.forEach((opt, idx) => {
      const isString = typeof opt === 'string';
      const trimmed = isString ? opt.trim() : '';
      const isAllowedSingle = isString && trimmed.length === 1 && allowedPattern.test(trimmed);

      if (!isString || (trimmed.length < this.OPTION_SET_CONTRACT.minOptionLength && !isAllowedSingle)) {
        errors.push({
          code: this.OPTION_SET_CONTRACT.hardRejectionCodes.EMPTY_OR_SHORT_OPTION,
          message: `Option at index ${idx} is empty or shorter than ${this.OPTION_SET_CONTRACT.minOptionLength} characters: "${opt}"`,
          details: { index: idx, value: opt }
        });
      }
    });

    // 2b. Prohibited prompt schema archetype placeholder options
    options.forEach((opt, idx) => {
      if (this.isSchemaPlaceholderOption(opt)) {
        errors.push({
          code: this.OPTION_SET_CONTRACT.hardRejectionCodes.SCHEMA_PLACEHOLDER_OPTION || 'SCHEMA_PLACEHOLDER_OPTION',
          message: `Option at index ${idx} is a prohibited prompt schema archetype placeholder: "${opt}"`,
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
        // Permuted list duplicate or identical bag-of-words
        else {
          // If both options are code snippets and differ, check if their normalized code tokens differ
          if (DifficultyAwareDistractorValidator.isCodeSnippet(options[i]) && DifficultyAwareDistractorValidator.isCodeSnippet(options[j])) {
            const cleanCode = s => s.replace(/\s+/g, '');
            if (cleanCode(options[i]) !== cleanCode(options[j])) {
              continue; // Distinct code expressions with different operators, variables, or constants!
            }
          }

          const t1 = this._tokenize(options[i]);
          const t2 = this._tokenize(options[j]);
          if (t1.size >= 2 && t2.size >= 2) {
            let intersection = 0;
            for (const token of t1) {
              if (t2.has(token)) intersection++;
            }
            const isExactWordPermutation = (t1.size === t2.size && intersection === t1.size);
            const unionSize = new Set([...t1, ...t2]).size;
            const jaccard = unionSize > 0 ? (intersection / unionSize) : 0;

            if (isExactWordPermutation) {
              const isDistinctOps = this._isDistinctOperationalPair(options[i], options[j], stem);
              if (!isDistinctOps) {
                errors.push({
                  code: this.OPTION_SET_CONTRACT.hardRejectionCodes.PERMUTED_DUPLICATE_OPTION || 'PERMUTED_DUPLICATE_OPTION',
                  message: `Permuted duplicate option choices detected: "${options[i]}" and "${options[j]}" contain identical words in permuted order`,
                  details: { indexA: i, indexB: j, optionA: options[i], optionB: options[j] }
                });
              }
            } else {
              const hasSharedComplexity = [...t1].some(t => t.startsWith('complexity_') && t2.has(t));
              const isSynonymousThreshold = jaccard >= 0.60 ||
                (intersection >= 3 && (intersection / Math.min(t1.size, t2.size)) >= 0.65) ||
                (hasSharedComplexity && intersection >= 3 && (intersection / Math.min(t1.size, t2.size)) >= 0.50);

              if (isSynonymousThreshold) {
                const isDistinctOps = this._isDistinctOperationalPair(options[i], options[j], stem);
                if (!isDistinctOps) {
                  const containment = intersection / Math.min(t1.size, t2.size);
                  errors.push({
                    code: this.OPTION_SET_CONTRACT.hardRejectionCodes.SYNONYMOUS_DISTRACTOR_OPTION || 'SYNONYMOUS_DISTRACTOR_OPTION',
                    message: `Synonymous duplicate option choices detected: "${options[i]}" and "${options[j]}" share ${(containment * 100).toFixed(0)}% core vocabulary`,
                    details: { indexA: i, indexB: j, optionA: options[i], optionB: options[j], jaccard, containment }
                  });
                }
              }
            }
          }
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

    // 7. Interrogative Mood & Option Alignment Check (Advisory alignment check)
    if (stem && typeof stem === 'string') {
      const stemLower = stem.trim().toLowerCase();
      const isWhyQuestion = /\bwhy\s+(?:does|is|must|do|should|would|did|can)\b/i.test(stemLower);
      if (isWhyQuestion) {
        const imperativeStarts = /^(?:start|begin|run|execute|call|push|add|commit|reset|print|loop|increment|decrement)\b/i;
        const nonReasonCount = options.filter(opt => {
          const t = String(opt || '').trim();
          return imperativeStarts.test(t) && !/^(?:to|because|in order to|by|since|for)\b/i.test(t);
        }).length;
        if (nonReasonCount >= 2) {
          warnings.push({
            code: 'INTERROGATIVE_MOOD_MISMATCH',
            message: `Question asks "${stem.slice(0, 45)}..." (Why question), but ${nonReasonCount} option(s) are framed as imperative actions rather than causal reasons.`
          });
        }
      }

      // 8. Stem-Option Comparison Alignment Check
      // Catches distinction/contrast stems paired with isolated single-entity definition options
      const comparisonMatch = stem.match(/\b(?:distinguish(?:es)?|contrast(?:s)?|difference between)\s+(?:a|an|the)?\s*([a-zA-Z0-9_\s-]+?)\s+(?:from|and|with)\s+(?:a|an|the)?\s*([a-zA-Z0-9_\s-]+?)(?:\?|\.|\s|$)/i);
      if (comparisonMatch && correctAnswer && typeof correctAnswer === 'string') {
        const rawEntityA = comparisonMatch[1].trim().toLowerCase();
        const rawEntityB = comparisonMatch[2].trim().toLowerCase();
        const cleanEntity = (str) => str.replace(/^(?:a|an|the)\s+/, '').trim();
        const entityA = cleanEntity(rawEntityA);
        const entityB = cleanEntity(rawEntityB);

        if (entityA.length >= 3 && entityB.length >= 3 && entityA !== entityB) {
          const ansLower = correctAnswer.toLowerCase();
          const tokensA = entityA.split(/\s+/).filter(w => w.length >= 4);
          const tokensB = entityB.split(/\s+/).filter(w => w.length >= 4);

          const mentionsA = ansLower.includes(entityA) || (tokensA.length > 0 && tokensA.some(t => ansLower.includes(t)));
          const mentionsB = ansLower.includes(entityB) || (tokensB.length > 0 && tokensB.some(t => ansLower.includes(t)));

          const hasComparativeMarkers = /\b(?:whereas|while|unlike|compared to|in contrast|differs|different|only|instead of|rather than|conversely|vice versa|but)\b/i.test(correctAnswer) ||
            /;\s+/i.test(correctAnswer);

          const isRelationalComparison = (mentionsA && mentionsB) || hasComparativeMarkers;

          if (!isRelationalComparison) {
            errors.push({
              code: 'STEM_COMPARISON_MISALIGNMENT',
              message: `Question stem asks to distinguish "${entityA}" from "${entityB}", but the correct option provides only an isolated single-entity description without comparative relation.`
            });
          }
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

    // Normalize and synchronize prompt text across question, questionText, stem, prompt
    const prompt = String(mcq.question || mcq.questionText || mcq.stem || mcq.prompt || '').trim();
    mcq.question = prompt;
    mcq.questionText = prompt;
    mcq.stem = prompt;

    // Normalize correctAnswer before validating
    this.normalizeCorrectAnswer(mcq);

    if (!prompt || prompt.length < 10) {
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

    // Explicit disfluency contamination pre-check
    const disfluencyCheck = disfluencySanitizer.detectDisfluencyViolation(
      mcq.questionText || mcq.stem || '',
      mcq.options || []
    );
    if (disfluencyCheck.hasViolation) {
      errors.push(`CONVERSATIONAL_DISFLUENCY_CONTAMINATION: ${disfluencyCheck.reason}`);
    }

    // Deterministic technical invariants check
    const invariantCheck = this.validateTechnicalInvariants(mcq);
    if (!invariantCheck.isValid) {
      errors.push(...invariantCheck.errors);
    }

    return {
      isValid: errors.length === 0,
      errors: errors,
      warnings: warnings,
      optionMetrics: optionSetResult.metrics,
      detailedErrors: optionSetResult.errors
    };
  }

  /**
   * Evaluates deterministic technical invariants for recognized mathematical and domain rules.
   *
   * @param {Object} mcq - MCQ object with stem/questionText, options, and correctAnswer
   * @returns {Object} { isValid: boolean, errors: Array<string> }
   */
  validateTechnicalInvariants(mcq) {
    const errors = [];
    if (!mcq || typeof mcq !== 'object') return { isValid: true, errors: [] };

    const stem = String(mcq.questionText || mcq.stem || '');
    const key = String(mcq.correctAnswer || '').trim();

    // Check for explicit attribution safe harbor
    const isAttributed = /\b(?:according to (?:the )?(?:lecture|instructor|teacher)|in the (?:classroom )?(?:analogy|metaphor|illustration|story)|as explained by the instructor)\b/i.test(stem);
    if (isAttributed) {
      return { isValid: true, errors: [] };
    }

    // 1. N-gram Markov context length invariant (off-by-one check)
    if (/\b(?:n-gram|bigram|trigram|markov)\b/i.test(stem) && /\b(?:how many|number of)\s+(?:preceding|previous|prior)\s+(?:words|tokens)/i.test(stem)) {
      if (/^n$/i.test(key) || /\b(?:uses?|exactly)\s+n\s+(?:preceding|previous|prior)\b/i.test(key) || /^\s*n\s*$/i.test(key)) {
        errors.push('DETERMINISTIC_INVARIANT_VIOLATION: In an N-gram language model, predicting the next word conditions on N - 1 preceding words, not N.');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
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
    if (word.endsWith('ically') && word.length > 7) return word.slice(0, -6);
    if (word.endsWith('ly') && word.length > 4) return word.slice(0, -2);
    return word;
  }

  /**
   * Normalizes number words to standardized digit representations
   * so that e.g. "8" and "eight", "1" and "one", "20" and "30" evaluate as distinct, preserved numeric tokens.
   */
  _normalizeNumberWords(text = '') {
    const numMap = {
      'zero': 'num_0', 'one': 'num_1', 'two': 'num_2', 'three': 'num_3', 'four': 'num_4',
      'five': 'num_5', 'six': 'num_6', 'seven': 'num_7', 'eight': 'num_8', 'nine': 'num_9', 'ten': 'num_10'
    };
    let normalized = String(text || '').replace(/\b(zero|one|two|three|four|five|six|seven|eight|nine|ten)\b/gi, (m) => {
      const lower = m.toLowerCase();
      return numMap[lower] || m;
    });
    // Normalize all numeric digits so node identifiers like 20, 30 are preserved as num_20, num_30 rather than dropped by length <= 2
    normalized = normalized.replace(/\b\d+\b/g, m => `num_${m}`);
    return normalized;
  }

  /**
   * Domain-aware operational distinction check:
   * Determines whether high token overlap represents genuine mutually exclusive operational choices
   * (e.g. Left vs Right rotation, operation sequence permutation, distinct node numbers)
   * while rejecting semantic duplicates (e.g. relational inversions A < B vs B > A, commutative formulas).
   */
  _isDistinctOperationalPair(optA, optB, stem = '') {
    const a = String(optA || '').toLowerCase();
    const b = String(optB || '').toLowerCase();

    // 1. Relational Inversion Guard (NEGATIVE CASE):
    // "left subtree < root" vs "root > left subtree" are identical claims.
    const isRelationalA = /\b(?:less than|greater than|smaller than|larger than)\b/i.test(a);
    const isRelationalB = /\b(?:less than|greater than|smaller than|larger than)\b/i.test(b);
    if (isRelationalA && isRelationalB) {
      const hasLessA = /\b(?:less than|smaller than)\b/i.test(a);
      const hasGreaterA = /\b(?:greater than|larger than)\b/i.test(a);
      const hasLessB = /\b(?:less than|smaller than)\b/i.test(b);
      const hasGreaterB = /\b(?:greater than|larger than)\b/i.test(b);
      if ((hasLessA && hasGreaterB) || (hasGreaterA && hasLessB)) {
        return false; // Inverted relational statements are semantically equivalent duplicates -> FAIL
      }
    }

    // 2. Commutative Formula Equivalence Guard (NEGATIVE CASE):
    // "N + 2" vs "2 + N"
    const normFormula = s => s.replace(/\s+/g, '').replace(/(\w+)\+(\w+)/g, (m, p1, p2) => [p1, p2].sort().join('+'));
    if (normFormula(a) === normFormula(b)) {
      return false; // Semantically identical formula -> FAIL
    }

    // 3. Operational Sequencing (e.g. LR vs RL rotation order: "left... then right..." vs "right... then left..."):
    const seqConnectors = /\b(then|after|followed by|first|second)\b/i;
    if (seqConnectors.test(a) && seqConnectors.test(b)) {
      const dirA = (a.match(/\b(left|right|clockwise|counter-clockwise)\b/gi) || []).join('->');
      const dirB = (b.match(/\b(left|right|clockwise|counter-clockwise)\b/gi) || []).join('->');
      if (dirA && dirB && dirA !== dirB) {
        return true; // Mutually exclusive sequence of operations -> PASS
      }
    }

    // 4. Directional Rotation Operation (Left vs Right):
    const hasRotate = /\b(rotat\w*)\b/i.test(a) && /\b(rotat\w*)\b/i.test(b);
    if (hasRotate) {
      const hasLeftA = /\bleft\b/i.test(a);
      const hasRightA = /\bright\b/i.test(a);
      const hasLeftB = /\bleft\b/i.test(b);
      const hasRightB = /\bright\b/i.test(b);
      if ((hasLeftA && !hasRightA && !hasLeftB && hasRightB) || (!hasLeftA && hasRightA && hasLeftB && !hasRightB)) {
        return true; // Single left vs single right rotation: mutually exclusive -> PASS
      }
    }

    // 5. Distinct Target Node Identifiers / Numbers from fixture:
    const numTokensA = a.match(/\bnum_\d+\b/g) || a.match(/\b\d+\b/g) || [];
    const numTokensB = b.match(/\bnum_\d+\b/g) || b.match(/\b\d+\b/g) || [];
    if (numTokensA.length > 0 && numTokensB.length > 0 && numTokensA.join(',') !== numTokensB.join(',')) {
      return true; // Refers to different node values or parameters in the problem fixture -> PASS
    }

    return false;
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

    let normalized = this._normalizeNumberWords(text);

    // Canonicalize standard algorithmic asymptotic complexity notations to detect paraphrased duplicates
    normalized = normalized
      .replace(/\b(?:o\s*\(\s*log\s*n\s*\)|logarithmic(?:ally)?\b)/gi, 'complexity_log_n')
      .replace(/\b(?:o\s*\(\s*n\s*\)|linear(?:ly)?\b)/gi, 'complexity_linear_n')
      .replace(/\b(?:o\s*\(\s*1\s*\)|constant(?:ly)?\b)/gi, 'complexity_constant_1');

    return new Set(
      normalized
        .toLowerCase()
        .replace(/[^a-z0-9_\s]/g, ' ')
        .split(/\s+/)
        .filter(w => (w.length > 2 || /^num_\d+$/.test(w) || /^complexity_/.test(w)) && !stopwords.has(w))
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

    const normAnswer = (ans) => {
      if (!ans || typeof ans !== 'string') return '';
      let cleaned = ans.toLowerCase().trim()
        .replace(/^(?:it|the|a|an)\s+/i, '')
        .replace(/^(?:integer|value|number|constant)\s+/i, '')
        .replace(/[,;:(].*$/, '')
        .replace(/\s+(?:indicating|meaning|signifying|whereby|because|since)\b.*$/i, '')
        .replace(/[.,;!?]+$/, '')
        .replace(/\s+/g, ' ')
        .trim();
      const numWords = { 'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4' };
      return numWords[cleaned] || cleaned;
    };

    const candidateNormAns = normAnswer(candidateMCQ.correctAnswer);
    const candText = (candidateMCQ.questionText || '').toLowerCase();

    for (const existing of existingQuestions) {
      const existingText = (existing.questionText || '').toLowerCase();
      const sim = this.calculateSimilarity(candidateMCQ.questionText, existing.questionText || '');
      const existingNormAns = normAnswer(existing.correctAnswer);

      const exactAnswerMatch = candidateNormAns.length > 0 && candidateNormAns === existingNormAns;
      const ansSim = (candidateNormAns && existingNormAns) ? this.calculateSimilarity(candidateNormAns, existingNormAns) : 0;
      const semanticAnswerMatch = exactAnswerMatch || (ansSim >= 0.75 && candidateNormAns.length > 10);

      const normalizeConcept = (c) => {
        if (!c || typeof c !== 'string') return '';
        return c.toLowerCase()
          .replace(/&/g, ' and ')
          .replace(/[^a-z0-9\s]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      };
      const normCandConcept = normalizeConcept(candidateMCQ.concept || candidateMCQ.metadata?.concept || currentTarget.concept || '');
      const normExistConcept = normalizeConcept(existing.concept || existing.metadata?.concept || '');
      const sameConcept = normCandConcept.length > 3 && (
        normCandConcept === normExistConcept ||
        this.calculateSimilarity(normCandConcept, normExistConcept) >= 0.70
      );

      // 1. Extreme verbatim duplicate stem OR Comparative-frame duplicate (threshold 0.65)
      const isComparativeFrame = (text) => {
        return /\b(?:fundamentally differ|differ from|differ between|in contrast to|compared to|comparative tradeoff|how do (?:their|they) differ|when comparing)\b/i.test(text);
      };
      const isComparativePair = isComparativeFrame(candText) && isComparativeFrame(existingText);

      if (sim >= 0.70 || (isComparativePair && sim >= 0.45)) {
        return {
          isDuplicate: true,
          similarity: sim,
          reason: isComparativePair && sim < 0.70
            ? `COMPARATIVE_STEM_DUPLICATE: Comparative-frame text similarity (${(sim * 100).toFixed(1)}%) exceeds 0.45 threshold`
            : 'VERBATIM_DUPLICATE: Text similarity exceeds 0.70',
          duplicateWith: existing.questionText
        };
      }

      // 2. Terminal Contract / Non-Profit Output Equivalence (Boundary Return Value Duplication)
      // Detects equivalent terminal non-profit output questions (e.g. Q7 and Q12) assessing identical boundary return specification
      const isTerminalOutputAsk = (text) => {
        const lower = String(text || '').toLowerCase();
        const hasOutputAsk = /\b(?:what (?:integer|value|result|number|output) (?:must be |is )?(?:printed|returned|produced|output)|what is the (?:final )?(?:return value|output|result))\b/i.test(lower);
        const hasNonProfitCondition = /\b(?:no profit|zero profit|non-profit|strictly decreases?|decreasing|non-increasing|loss only|cannot (?:make|realize) a? ?profit)\b/i.test(lower);
        return hasOutputAsk && hasNonProfitCondition;
      };

      const hasZeroAnswer = (ans) => /\b(?:0|zero)\b/i.test(String(ans || ''));
      const isTerminalMatch = isTerminalOutputAsk(candText) && isTerminalOutputAsk(existingText) &&
        (semanticAnswerMatch || (hasZeroAnswer(candidateMCQ.correctAnswer) && hasZeroAnswer(existing.correctAnswer)));

      if (isTerminalMatch) {
        return {
          isDuplicate: true,
          similarity: 1.0,
          reason: 'TERMINAL_CONTRACT_DUPLICATE: Equivalent terminal non-profit output question assessing identical boundary return specification',
          duplicateWith: existing.questionText
        };
      }

      // 2b. Direct/semantic answer collision with significant stem overlap (DIMENSION-INDEPENDENT)
      if (semanticAnswerMatch && sim >= 0.25) {
        return {
          isDuplicate: true,
          similarity: sim,
          reason: 'ANSWER_COLLISION_DUPLICATE: Equivalent correct answer with significant stem similarity',
          duplicateWith: existing.questionText
        };
      }

      // 3. Core definition duplication (e.g. repeated GCD definitions across different dimensions)
      const isGcdDefCand = (candText.includes('gcd') || candText.includes('greatest common divisor') || candText.includes('greatest common factor')) &&
        (candText.includes('define') || candText.includes('definition') || candText.includes('what is the gcd') || candText.includes('what is the greatest') || candText.includes('stands for') || candText.includes('meaning of'));
      const isGcdDefExist = (existingText.includes('gcd') || existingText.includes('greatest common divisor') || existingText.includes('greatest common factor')) &&
        (existingText.includes('define') || existingText.includes('definition') || existingText.includes('what is the gcd') || existingText.includes('what is the greatest') || existingText.includes('stands for') || existingText.includes('meaning of'));
      if (isGcdDefCand && isGcdDefExist && (semanticAnswerMatch || (candidateNormAns.includes('divid') && existingNormAns.includes('divid')))) {
        return {
          isDuplicate: true,
          similarity: sim,
          reason: 'CORE_DEFINITION_DUPLICATE: Multiple questions testing identical GCD definition',
          duplicateWith: existing.questionText
        };
      }

      // 4. Repeated equality operator (==) questions
      const hasDoubleEqualCand = candText.includes('==') || candText.includes('double-equal') || candText.includes('double equal') || candText.includes('equality operator');
      const hasDoubleEqualExist = existingText.includes('==') || existingText.includes('double-equal') || existingText.includes('double equal') || existingText.includes('equality operator');
      if (hasDoubleEqualCand && hasDoubleEqualExist && (semanticAnswerMatch || (candidateNormAns.includes('equal') && existingNormAns.includes('equal')) || (candidateNormAns.includes('compar') && existingNormAns.includes('compar')))) {
        return {
          isDuplicate: true,
          similarity: sim,
          reason: 'OPERATOR_REPETITION_DUPLICATE: Multiple questions testing identical equality operator (==)',
          duplicateWith: existing.questionText
        };
      }

      // 5. Pedagogical duplicate: same concept + substantial stem overlap (DIMENSION-INDEPENDENT)
      if (sameConcept && (sim >= 0.35 || (semanticAnswerMatch && sim >= 0.20))) {
        return {
          isDuplicate: true,
          similarity: sim,
          reason: 'PEDAGOGICAL_REDUNDANCY: High similarity testing identical concept and reasoning task',
          duplicateWith: existing.questionText
        };
      }

      // 5b. Comparative Algorithmic Cluster Duplication (Tradeoff Redundancy)
      const isComparativeCand = /\b(tradeoff|compare|advantage|limitation|drawback|alternative|instead of|rather than)\b/i.test(candText);
      const isComparativeExist = /\b(tradeoff|compare|advantage|limitation|drawback|alternative|instead of|rather than)\b/i.test(existingText);
      if (isComparativeCand && isComparativeExist && sameConcept && (sim >= 0.25 || semanticAnswerMatch)) {
        return {
          isDuplicate: true,
          similarity: sim,
          reason: 'COMPARATIVE_CLUSTER_DUPLICATE: Redundant comparative tradeoff question on identical algorithmic concept',
          duplicateWith: existing.questionText
        };
      }

      // 5c. Functional Mechanism & Component Duplicate (Stem Overlap on Core Architectural Mechanisms)
      const MECHANISM_PATTERNS = [
        /\bouter\s+(?:for\s+)?loop\b/i,
        /\binner\s+(?:for\s+)?loop\b/i,
        /\bnested\s+loops?\b/i,
        /\btwo\s+loops\b/i,
        /\bfrequency\s+array\b/i,
        /\blinear\s+search\b/i,
        /\bvisited\s+array\b/i,
        /\bspanning\s+tree\b/i
      ];

      for (const mechPat of MECHANISM_PATTERNS) {
        if (mechPat.test(candText) && mechPat.test(existingText)) {
          const stemSim = this.calculateSimilarity(candidateMCQ.questionText, existing.questionText || '');
          const ansSim = this.calculateSimilarity(candidateMCQ.correctAnswer || '', existing.correctAnswer || '');

          // Check 5c.1: Surface token similarity on same mechanism (Jaccard >= 0.28)
          if (stemSim >= 0.28) {
            return {
              isDuplicate: true,
              similarity: stemSim,
              reason: `FUNCTIONAL_MECHANISM_DUPLICATE: Stem similarity (${(stemSim * 100).toFixed(0)}%) on identical architectural mechanism (${mechPat.source})`,
              duplicateWith: existing.questionText
            };
          }

          // Check 5c.2: Functional Target Duplicate (rephrased stems asking for role/purpose/necessity of loop structure in frequency counting)
          const isRoleOrPurposeInquiry = /\b(?:role|purpose|why|necessary|require|function|logic)\b/i.test(candidateMCQ.questionText) &&
                                        /\b(?:role|purpose|why|necessary|require|function|logic)\b/i.test(existing.questionText);
          const candExplainsDualRole = /\b(?:outer|first|repeat|iterat|select|pick|compar|every\s+element|each\s+(?:target\s+)?element|all\s+elements)\b/i.test(candidateMCQ.correctAnswer || '') &&
                                       /\b(?:inner|second|scans?|counts?|evaluat|check|frequency|occurrences)\b/i.test(candidateMCQ.correctAnswer || '');
          const existExplainsDualRole = /\b(?:outer|first|repeat|iterat|select|pick|compar|every\s+element|each\s+(?:target\s+)?element|all\s+elements)\b/i.test(existing.correctAnswer || '') &&
                                        /\b(?:inner|second|scans?|counts?|evaluat|check|frequency|occurrences)\b/i.test(existing.correctAnswer || '');

          if (isRoleOrPurposeInquiry && candExplainsDualRole && existExplainsDualRole && (stemSim >= 0.14 || ansSim >= 0.20)) {
            return {
              isDuplicate: true,
              similarity: stemSim,
              reason: `FUNCTIONAL_TARGET_DUPLICATE: Rephrased inquiry testing identical architectural role (${mechPat.source}) with matching operational answer mechanism`,
              duplicateWith: existing.questionText
            };
          }
        }
      }

      // 5d. Subsumptive Learning Objective Collision (Same Component Entity & Identical Core Competency Assertion)
      const entities = ['generator', 'discriminator', 'transformer', 'attention', 'autoencoder', 'rnn', 'lstm', 'rule-based nlp'];
      const sharedEntity = entities.find(e => candText.includes(e) && existingText.includes(e));

      if (sharedEntity) {
        // EXPLICIT COMPETENCY SEPARATION SHIELD:
        // If one question assesses mathematical loss/gradient dynamics and the other assesses functional role, THEY MUST COEXIST.
        const isMathLossDynamics = qText => /\b(?:loss|gradient|vanishing|saturat\w+|derivative|formula|backprop|divergence|minimax)\b/i.test(qText);
        const candIsMath = isMathLossDynamics(candText + ' ' + (candidateMCQ.correctAnswer || ''));
        const existIsMath = isMathLossDynamics(existingText + ' ' + (existing.correctAnswer || ''));

        if (candIsMath === existIsMath) {
          // CONFIRMATION CHECK: Only reject when both stems ask for high-level functional purpose
          // AND both correct answers assert the identical operational competency
          const isFunctionalGoal = qText => /\b(?:role|purpose|objective|goal|aim|win|converge|success)\b/i.test(qText);
          if (isFunctionalGoal(candText) && isFunctionalGoal(existingText)) {
            const assertsDeceivingDiscriminator = ans => /\b(?:fool|deceiv\w+|cannot\s+(?:identif\w*|distinguish\w*)|trick|mislead|synthetic\s+data\s+to)\b/i.test(ans);
            const assertsDimensionalityReduction = ans => /\b(?:compress\w*|bottleneck|latent\s+space|dimensionality\s+reduction)\b/i.test(ans);

            const candDeceives = assertsDeceivingDiscriminator(candidateMCQ.correctAnswer || '');
            const existDeceives = assertsDeceivingDiscriminator(existing.correctAnswer || '');

            const candCompresses = assertsDimensionalityReduction(candidateMCQ.correctAnswer || '');
            const existCompresses = assertsDimensionalityReduction(existing.correctAnswer || '');

            if ((candDeceives && existDeceives) || (candCompresses && existCompresses)) {
              return {
                isDuplicate: true,
                similarity: 0.85,
                reason: 'SUBSUMPTIVE_LEARNING_OBJECTIVE_DUPLICATE: Both questions assess identical operational competency for ' + sharedEntity + '.',
                duplicateWith: existing.questionText
              };
            }
          }
        }
      }

      // 5e. Same-Concept High-Level Functional Purpose Collision (with Strict Cognitive Protection)
      if (sameConcept) {
        // High-level functional inquiry detector
        const isFunctionalAsk = (text) => {
          return /\b(?:primary (?:function|role|purpose|objective)|main purpose|what is the (?:primary )?function|what does it do)\b/i.test(text) ||
                 /\bhow does (?:the )?[a-z\s]+ fundamentally (?:alter|change|transform|improve) (?:information processing|processing|architecture|learning)\b/i.test(text);
        };

        // COGNITIVE PROTECTION SHIELD:
        // Discrete operational tasks on the same data structure / topic MUST COEXIST:
        // 1. Ordering / property vs search vs deletion vs rotation vs code trace
        const isDiscreteOperation = (text) => {
          return /\b(?:ordering|valid(?:ity)?|invariant|search(?:ing)?|lookup|worst-case|delete|deletion|successor|predecessor|rotat\w+|balance\s+factor|avl|red-black|code|snippet|trace|iteration|loop)\b/i.test(text);
        };

        // 2. Mathematical loss / formula vs architectural / functional role
        const isMathDynamics = (text, ans) => {
          return /\b(?:loss|gradient|vanishing|saturat\w+|derivative|formula|backprop|divergence|minimax|arithmetic|calculate|algebra)\b/i.test((text || '') + ' ' + (ans || ''));
        };

        const candIsMath = isMathDynamics(candText, candidateMCQ.correctAnswer);
        const existIsMath = isMathDynamics(existingText, existing.correctAnswer);

        const candIsDiscrete = isDiscreteOperation(candText);
        const existIsDiscrete = isDiscreteOperation(existingText);

        // Only consider for functional duplicate if NEITHER tests a discrete operation AND NEITHER differs in math vs architecture
        if (!candIsDiscrete && !existIsDiscrete && (candIsMath === existIsMath)) {
          if (isFunctionalAsk(candText) && isFunctionalAsk(existingText)) {
            // Check if both correct answers assert identical operational mechanism
            // For Attention: both asserting modeling / computing relationships across tokens / input elements
            const assertsAttentionRelation = (ans) => {
              return /\b(?:model|comput\w+|captur\w+|evaluat\w+|connect\w*)\s+(?:relationship\w*|dependenc\w*|interaction\w*)\s+(?:across|between|among)\s+(?:tokens|elements|words|inputs)\b/i.test(ans) ||
                     /\b(?:relationships? (?:between|across)|context across (?:tokens|elements))\b/i.test(ans);
            };

            const candAnsRel = assertsAttentionRelation(candidateMCQ.correctAnswer || '');
            const existAnsRel = assertsAttentionRelation(existing.correctAnswer || '');

            const ansSim = this.calculateSimilarity(candidateMCQ.correctAnswer || '', existing.correctAnswer || '');

            if ((candAnsRel && existAnsRel) || ansSim >= 0.40) {
              return {
                isDuplicate: true,
                similarity: sim,
                reason: `SAME_CONCEPT_FUNCTIONAL_DUPLICATE: Both questions test identical high-level functional purpose and operational mechanism for "${normCandConcept}"`,
                duplicateWith: existing.questionText
              };
            }
          }
        }
      }

      // 5f. Cross-Concept Operational Competency Collision
      // Detects when questions across related / divergent labels test the identical runtime mechanism and outcome
      const isModelForwardAsk = (text) => {
        return /\b(?:what happens|what occurs|what is the (?:primary )?(?:outcome|result)|how does the system respond)\b/i.test(text) &&
               /\bmodel\b/i.test(text) &&
               /\bforward(?:ed|ing)?\b/i.test(text);
      };

      const assertsModelShaping = (ans) => {
        return /\b(?:shape|shapes|shaping|dimension)\b/i.test(ans);
      };

      if (isModelForwardAsk(candText) && isModelForwardAsk(existingText)) {
        if (assertsModelShaping(candidateMCQ.correctAnswer || '') && assertsModelShaping(existing.correctAnswer || '')) {
          return {
            isDuplicate: true,
            similarity: sim,
            reason: 'OPERATIONAL_COMPETENCY_DUPLICATE: Both questions assess identical runtime outcome (dynamic layer/tensor shaping) upon model forwarding',
            duplicateWith: existing.questionText
          };
        }
      }

      // General cross-concept token generation competency check (Next-token prediction vs Text generation)
      const isTokenGenAsk = (text) => {
        return /\b(?:how does (?:token|text) generation|standard text generation|next-token prediction)\b/i.test(text) &&
               /\b(?:large language models?|llms?)\b/i.test(text);
      };
      const assertsSequentialProbability = (ans) => {
        return /\b(?:iterative|sequential|step-by-step)\b/i.test(ans) &&
               /\b(?:probability|probabilities)\b/i.test(ans) &&
               /\b(?:token|word|prediction)\b/i.test(ans);
      };

      if (isTokenGenAsk(candText) && isTokenGenAsk(existingText)) {
        if (assertsSequentialProbability(candidateMCQ.correctAnswer || '') && assertsSequentialProbability(existing.correctAnswer || '')) {
          return {
            isDuplicate: true,
            similarity: sim,
            reason: 'OPERATIONAL_COMPETENCY_DUPLICATE: Both questions assess identical operational competency (sequential probability-based token generation)',
            duplicateWith: existing.questionText
          };
        }
      }

      // 5g. Cross-Concept Output Layer & Convergence Invariant Duplicate Check
      // Catches when candidate and existing questions both assess converging 8 hidden neurons into 1 output signal
      const isOutputLayerAsk = (text, concept) => {
        return /\b(?:output layer|output unit|final layer|output signal)\b/i.test(`${text} ${concept}`) &&
               /\b(?:neuron|signal|unit|connect|converge|preceding|hidden)\b/i.test(text);
      };
      const assertsOutputConvergence = (ans) => {
        const norm = this._normalizeNumberWords(String(ans || '').toLowerCase());
        const has8Neurons = /\bnum_8\s+(?:hidden\s+)?neurons?\b/i.test(norm) || (/\bnum_8\b/i.test(norm) && /\bneurons?\b/i.test(norm));
        const has1Signal = /\bnum_1\s+(?:output\s+)?(?:signal|unit|neuron)\b/i.test(norm) || (/\bnum_1\b/i.test(norm) && /\bsignal\b/i.test(norm));
        const hasConvergenceVerb = /\b(?:connect\w*|converge\w*|map\w*|combin\w*|join\w*)\b/i.test(norm);
        return has8Neurons && has1Signal && hasConvergenceVerb;
      };

      if (isOutputLayerAsk(candText, normCandConcept) && isOutputLayerAsk(existingText, normExistConcept)) {
        if (assertsOutputConvergence(candidateMCQ.correctAnswer || '') && assertsOutputConvergence(existing.correctAnswer || '')) {
          return {
            isDuplicate: true,
            similarity: Math.max(sim, 0.45),
            reason: 'OPERATIONAL_COMPETENCY_DUPLICATE: Both questions assess identical architectural invariant (converging 8 hidden neurons into 1 output signal)',
            duplicateWith: existing.questionText
          };
        }
      }

      // 5h. Autoregressive Sequence Appending & Token Generation Invariant Duplicate Check
      const isAutoregressiveAsk = (text, concept) => {
        return /\b(?:autoregressive|next-token|token generation|generates? a (?:multi-word )?sentence|multi-token output)\b/i.test(`${text} ${concept}`) &&
               /\b(?:evolve|input sequence|predict(?:ing)? (?:the )?next|operational mechanism|append)\b/i.test(text);
      };
      const assertsTokenAppending = (ans) => {
        const norm = String(ans || '').toLowerCase();
        const hasAppend = /\b(?:append\w*|add\w*|feed\w*|re-feed\w*|combin\w*)\b/i.test(norm);
        const hasTokenInput = /\b(?:token|word|output)\b/i.test(norm) && /\b(?:input|sequence)\b/i.test(norm);
        const hasNextPredict = /\b(?:predict\w*|next\w*|iteration|re-process\w*)\b/i.test(norm);
        return hasAppend && hasTokenInput && hasNextPredict;
      };

      if (isAutoregressiveAsk(candText, normCandConcept) && isAutoregressiveAsk(existingText, normExistConcept)) {
        if (assertsTokenAppending(candidateMCQ.correctAnswer || '') && assertsTokenAppending(existing.correctAnswer || '')) {
          return {
            isDuplicate: true,
            similarity: Math.max(sim, 0.45),
            reason: 'OPERATIONAL_COMPETENCY_DUPLICATE: Both questions assess identical autoregressive mechanism (appending generated token to input to predict next token)',
            duplicateWith: existing.questionText
          };
        }
      }

      // 5i. Transformer Attention vs Sequential Processing Invariant Duplicate Check
      const isTransformerVsSequentialAsk = (text, concept) => {
        const hasTransformer = /\b(?:transformer|self-attention|attention mechanism)\b/i.test(`${text} ${concept}`);
        const hasSequential = /\b(?:sequential|rnn|recurrent|traditional)\b/i.test(text);
        const hasComparison = /\b(?:differ|contrast|overcome|bottleneck|versus|vs)\b/i.test(text);
        return hasTransformer && hasSequential && hasComparison;
      };
      const assertsParallelComputation = (ans) => {
        const norm = String(ans || '').toLowerCase();
        const hasParallel = /\b(?:parallel|simultaneous\w*|matrix)\b/i.test(norm);
        const hasComputeTokens = /\b(?:comput\w*|process\w*|relat\w*|sequence|token)\b/i.test(norm);
        return hasParallel && hasComputeTokens;
      };

      if (isTransformerVsSequentialAsk(candText, normCandConcept) && isTransformerVsSequentialAsk(existingText, normExistConcept)) {
        if (assertsParallelComputation(candidateMCQ.correctAnswer || '') && assertsParallelComputation(existing.correctAnswer || '')) {
          return {
            isDuplicate: true,
            similarity: Math.max(sim, 0.45),
            reason: 'OPERATIONAL_COMPETENCY_DUPLICATE: Both questions assess identical comparative invariant (Transformer parallel matrix self-attention vs sequential token processing)',
            duplicateWith: existing.questionText
          };
        }
      }
    }

    return { isDuplicate: false, similarity: 0 };
  }/**
   * Check for distractor collisions against existing passing questions in the quiz.
   * Ensures high pedagogical diversity and prevents distractor set exhaustion across the quiz:
   * 1. Multi-distractor set overlap: Candidate question shares 2 or more identical distractors with any single existing question.
   * 2. Substantive verbatim collision: A long distractor (>= 4 words or >= 20 chars) is repeated verbatim in an existing question.
   *
   * @param {Object} candidateMCQ - Candidate MCQ object
   * @param {Array<Object>} existingQuestions - Array of already accepted quiz questions
   * @returns {Object} { hasCollision: boolean, type: string|null, reason: string|null, collidedWith: string|null, sharedDistractors: string[] }
   */
  checkDistractorCollision(candidateMCQ, existingQuestions = []) {
    if (!candidateMCQ || !Array.isArray(candidateMCQ.options) || !Array.isArray(existingQuestions) || existingQuestions.length === 0) {
      return { hasCollision: false, type: null, reason: null, collidedWith: null, sharedDistractors: [] };
    }

    const candidateKey = String(candidateMCQ.correctAnswer || '').trim().toLowerCase();
    const candidateDistractors = candidateMCQ.options
      .map(o => String(o || '').trim())
      .filter(o => o.toLowerCase() !== candidateKey && o.length > 0);

    const norm = (str) => this.stripSuperficialFormatting(str).toLowerCase();

    for (let qIdx = 0; qIdx < existingQuestions.length; qIdx++) {
      const existing = existingQuestions[qIdx];
      if (!existing || !Array.isArray(existing.options)) continue;

      const existingKey = String(existing.correctAnswer || '').trim().toLowerCase();
      const existingDistractors = existing.options
        .map(o => String(o || '').trim())
        .filter(o => o.toLowerCase() !== existingKey && o.length > 0);

      const shared = [];
      for (const cd of candidateDistractors) {
        const normCd = norm(cd);
        for (const ed of existingDistractors) {
          const normEd = norm(ed);
          if (normCd === normEd && normCd.length > 0) {
            shared.push(cd);
            break;
          }
        }
      }

      // Case 1: Multiple shared distractors (2 or more)
      if (shared.length >= 2) {
        return {
          hasCollision: true,
          type: 'DISTRACTOR_SET_COLLISION',
          reason: `Candidate question shares ${shared.length} identical distractors (${shared.map(s => `"${s}"`).join(', ')}) with Question ${qIdx + 1}`,
          collidedWith: existing.questionText || `Question ${qIdx + 1}`,
          sharedDistractors: shared
        };
      }

      // Case 2: Substantive verbatim distractor collision (Conservative handling)
      // Per safeguard: Do not reject questions merely because they share a plausible distractor.
      // Only reject if:
      // (a) The shared distractor is an extensive verbatim boilerplate template (>= 8 words AND >= 45 chars)
      // (b) OR the two questions also share significant stem similarity (stemSim >= 0.25)
      for (const s of shared) {
        const wordCount = s.split(/\s+/).filter(Boolean).length;
        const stemSim = this.calculateSimilarity(candidateMCQ.questionText || '', existing.questionText || '');
        const isLongBoilerplate = s.length >= 45 && wordCount >= 8;
        const isSharedWithStemContext = (s.length >= 25 || wordCount >= 5) && stemSim >= 0.25;

        if (isLongBoilerplate || isSharedWithStemContext) {
          return {
            hasCollision: true,
            type: 'VERBATIM_DISTRACTOR_COLLISION',
            reason: `Substantive distractor "${s}" exhibits verbatim redundancy with Question ${qIdx + 1} (stem similarity: ${(stemSim * 100).toFixed(0)}%)`,
            collidedWith: existing.questionText || `Question ${qIdx + 1}`,
            sharedDistractors: [s]
          };
        }
      }
    }

    return { hasCollision: false, type: null, reason: null, collidedWith: null, sharedDistractors: [] };
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

    // Invariant: Distractors must be mutually distinct from the correct answer
    for (let dIdx = 0; dIdx < distractorTexts.length; dIdx++) {
      const dText = distractorTexts[dIdx];
      if (dText.toLowerCase() === exactCorrectText.toLowerCase()) {
        const err = new Error('KEY_ASSIGNMENT_INTEGRITY_ERROR: A distractor is identical to the correct answer');
        err.code = 'KEY_ASSIGNMENT_INTEGRITY_ERROR';
        throw err;
      }
      const t1 = this._tokenize(exactCorrectText);
      const t2 = this._tokenize(dText);
      if (t1.size >= 2 && t2.size >= 2) {
        let intersection = 0;
        for (const token of t1) {
          if (t2.has(token)) intersection++;
        }
        if (t1.size === t2.size && intersection === t1.size) {
          const err = new Error(`KEY_ASSIGNMENT_INTEGRITY_ERROR: Distractor "${dText}" is a permuted duplicate of the correct answer "${exactCorrectText}"`);
          err.code = 'KEY_ASSIGNMENT_INTEGRITY_ERROR';
          throw err;
        }
      }
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
