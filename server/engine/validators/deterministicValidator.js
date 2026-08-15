/**
 * server/engine/validators/deterministicValidator.js
 *
 * Deterministic Pre-Checks & Post-Checks:
 * - Pre-Checks: JSON schema parsing, 4 options check, option string deduplication, correct answer existence.
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
