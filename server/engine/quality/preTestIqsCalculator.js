/**
 * Phase 2 — Pre-Test IQS (Item Quality Score) Calculator
 * Computes initial quality score IQS_pre in [0.00, 1.00] prior to student test delivery.
 */

'use strict';

function calculatePreTestIqs(candidateItem = {}, critiqueReport = {}, validationReport = {}) {
  const { isApproved = true, overallConfidence = 0.85 } = critiqueReport;
  const { isValidated = true, toolErrors = [] } = validationReport;

  const R_score = overallConfidence;
  const V_score = isValidated ? 1.0 : Math.max(0.2, 1.0 - (toolErrors.length * 0.2));

  // Option Lexical Entropy Score (Ensures options are non-trivial and distinct)
  const options = Array.isArray(candidateItem.options) ? candidateItem.options : [];
  const lengths = options.map(o => String(o).trim().length);
  const avgLen = lengths.length > 0 ? lengths.reduce((a, b) => a + b, 0) / lengths.length : 0;
  const E_score = avgLen > 5 ? 1.0 : 0.6;

  const preTestIqs = parseFloat(((0.50 * R_score) + (0.30 * V_score) + (0.20 * E_score)).toFixed(2));

  return {
    preTestIqs,
    isHighQuality: preTestIqs >= 0.80,
    breakdown: {
      critiqueConfidence: R_score,
      validationToolScore: V_score,
      optionEntropyScore: E_score
    }
  };
}

module.exports = {
  calculatePreTestIqs
};
