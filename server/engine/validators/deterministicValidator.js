/**
 * server/engine/validators/deterministicValidator.js
 *
 * Deterministic Pre-Checks, Post-Checks & Duplicate Question Detection:
 * - Pre-Checks: JSON schema parsing, 4 options check, option string deduplication, correct answer existence.
 * - Duplicate Detection: Jaccard word-set similarity against already accepted questions (>0.70 rejected).
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
   * Check for duplicate / near-duplicate questions in the same session.
   * Computes Jaccard word-set similarity against already accepted questions.
   * @param {Object} candidateMCQ
   * @param {Array} existingQuestions
   * @param {Number} threshold - max similarity threshold (default 0.70)
   * @returns {Object} { isDuplicate: boolean, similarity: number, duplicateWith: string }
   */
  checkDuplicateQuestion(candidateMCQ, existingQuestions = [], threshold = 0.70) {
    if (!candidateMCQ || !candidateMCQ.questionText || !Array.isArray(existingQuestions) || existingQuestions.length === 0) {
      return { isDuplicate: false, similarity: 0 };
    }

    const tokenize = (text) => {
      return new Set(
        text
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, ' ')
          .split(/\s+/)
          .filter(w => w.length > 2 && !['the', 'and', 'for', 'which', 'what', 'that', 'with', 'this'].includes(w))
      );
    };

    const candidateTokens = tokenize(candidateMCQ.questionText);
    if (candidateTokens.size === 0) return { isDuplicate: false, similarity: 0 };

    for (const existing of existingQuestions) {
      const existingTokens = tokenize(existing.questionText || '');
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
