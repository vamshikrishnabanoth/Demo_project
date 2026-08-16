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
      text
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
