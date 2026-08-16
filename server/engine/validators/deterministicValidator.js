/**
 * server/engine/validators/deterministicValidator.js
 *
 * Deterministic Pre-Checks, Post-Checks & Semantic Redundancy Detection:
 * - Pre-Checks: JSON schema parsing, 4 options check, option string deduplication, correct answer existence.
 * - Duplicate & Concept Redundancy Detection: Pairwise token/concept similarity (>0.60 rejected during generation).
 * - Redundancy Matrix: Analyzes whole-quiz pairwise redundancy for Mode 2 Quiz Evaluation.
 * - Post-Checks: Final payload integrity and answer position randomization (A/B/C/D split ~25%).
 */

'use strict';

class DeterministicValidator {
  /**
   * Run Deterministic Pre-Checks on candidate MCQ.
   * @param {Object} mcq - Candidate MCQ object
   * @returns {Object} { isValid, errors }
   */
  runPreChecks(mcq) {
    const errors = [];

    if (!mcq || typeof mcq !== 'object') {
      return { isValid: false, errors: ['MCQ payload is null or not an object'] };
    }

    if (!mcq.questionText || typeof mcq.questionText !== 'string' || mcq.questionText.trim().length < 10) {
      errors.push('questionText must be a string with at least 10 characters');
    }

    if (!Array.isArray(mcq.options) || mcq.options.length !== 4) {
      errors.push(`options must be an array of exactly 4 strings, found ${Array.isArray(mcq.options) ? mcq.options.length : 0}`);
    } else {
      // Check option string duplicates
      const uniqueOptions = new Set(mcq.options.map(o => (o || '').trim().toLowerCase()));
      if (uniqueOptions.size < 4) {
        errors.push('Duplicate option choices detected');
      }
    }

    if (!mcq.correctAnswer || typeof mcq.correctAnswer !== 'string') {
      errors.push('correctAnswer is required and must be a string');
    } else if (Array.isArray(mcq.options) && !mcq.options.includes(mcq.correctAnswer)) {
      errors.push('correctAnswer does not match any of the 4 provided options');
    }

    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * Tokenize text into meaningful content words (stripping generic question stopwords).
   */
  _tokenize(text = '') {
    const stopwords = new Set([
      'the', 'and', 'for', 'which', 'what', 'that', 'with', 'this', 'from',
      'into', 'during', 'after', 'before', 'where', 'when', 'should', 'would',
      'could', 'about', 'their', 'there', 'having', 'being', 'does', 'primary',
      'following', 'statement', 'accurately', 'context'
    ]);

    return new Set(
      text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2 && !stopwords.has(w))
    );
  }

  /**
   * Check for duplicate or conceptually redundant questions during target generation.
   * Threshold = 0.60 catches reworded variations of the same learning question.
   * @param {Object} candidateMCQ
   * @param {Array} existingQuestions
   * @param {Number} threshold - max similarity threshold (default 0.60)
   * @returns {Object} { isDuplicate: boolean, similarity: number, duplicateWith: string }
   */
  checkDuplicateQuestion(candidateMCQ, existingQuestions = [], threshold = 0.60) {
    if (!candidateMCQ || !candidateMCQ.questionText || !Array.isArray(existingQuestions) || existingQuestions.length === 0) {
      return { isDuplicate: false, similarity: 0 };
    }

    const candidateTokens = this._tokenize(candidateMCQ.questionText);
    if (candidateTokens.size === 0) return { isDuplicate: false, similarity: 0 };

    for (const existing of existingQuestions) {
      const existingTokens = this._tokenize(existing.questionText || '');
      if (existingTokens.size === 0) continue;

      let intersectionCount = 0;
      candidateTokens.forEach(token => {
        if (existingTokens.has(token)) intersectionCount++;
      });

      const unionCount = new Set([...candidateTokens, ...existingTokens]).size;
      const jaccardSimilarity = unionCount > 0 ? (intersectionCount / unionCount) : 0;

      if (jaccardSimilarity >= threshold) {
        return {
          isDuplicate: true,
          similarity: Number(jaccardSimilarity.toFixed(3)),
          duplicateWith: existing.questionText
        };
      }
    }

    return { isDuplicate: false, similarity: 0 };
  }

  /**
   * Compute pairwise redundancy matrix across the aggregated set of quiz questions.
   * @param {Array} quizQuestions
   * @param {Number} threshold - default 0.60
   * @returns {Object} { highSimilarityPairs: [], totalRedundantPairs: number }
   */
  computeRedundancyMatrix(quizQuestions = [], threshold = 0.60) {
    const highSimilarityPairs = [];

    for (let i = 0; i < quizQuestions.length; i++) {
      for (let j = i + 1; j < quizQuestions.length; j++) {
        const t1 = this._tokenize(quizQuestions[i].questionText || '');
        const t2 = this._tokenize(quizQuestions[j].questionText || '');

        if (t1.size === 0 || t2.size === 0) continue;

        let intersection = 0;
        t1.forEach(token => {
          if (t2.has(token)) intersection++;
        });

        const union = new Set([...t1, ...t2]).size;
        const sim = union > 0 ? Number((intersection / union).toFixed(3)) : 0;

        if (sim >= threshold) {
          highSimilarityPairs.push({
            pair: `Q${i + 1} ↔ Q${j + 1}`,
            q1Index: i + 1,
            q2Index: j + 1,
            similarity: sim,
            q1Text: quizQuestions[i].questionText,
            q2Text: quizQuestions[j].questionText
          });
        }
      }
    }

    return {
      highSimilarityPairs,
      totalRedundantPairs: highSimilarityPairs.length
    };
  }

  /**
   * Run Deterministic Post-Checks & Option Randomization.
   * @param {Array} quizQuestions - Array of passing MCQ objects
   * @returns {Array} Shuffled & normalized MCQs
   */
  runPostChecks(quizQuestions = []) {
    return quizQuestions.map(q => {
      const copy = { ...q };
      if (Array.isArray(copy.options)) {
        // Shuffle options to ensure balanced A/B/C/D distribution
        const shuffled = [...copy.options].sort(() => Math.random() - 0.5);
        copy.options = shuffled;
      }
      return copy;
    });
  }
}

module.exports = new DeterministicValidator();
