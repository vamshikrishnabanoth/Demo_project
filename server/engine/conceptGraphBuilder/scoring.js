const { CONCEPT_CONFIG } = require('../../config/conceptConfig');

/**
 * Pass 3: Adaptive Retention Calculation & Importance Scoring
 */
function calculateAdaptiveRetentionLimit(candidateCount) {
  const BOUNDS = CONCEPT_CONFIG.RETAINED_CONCEPTS_BOUNDS;
  const rawLimit = Math.round(Math.sqrt(candidateCount) * BOUNDS.SCALING_FACTOR);
  return Math.min(BOUNDS.MAX, Math.max(BOUNDS.MIN, rawLimit));
}

function calculateImportanceScore(node) {
  const WEIGHTS = CONCEPT_CONFIG.WEIGHT_MULTIPLIERS;
  let score = 0;

  const sources = Array.from(node.sources || []);
  if (sources.includes('HEADER')) score += WEIGHTS.HEADER_PROMINENCE;
  if (sources.includes('CODE_OR_MATH') || node.hasCodeOrMath) score += WEIGHTS.CODE_OR_MATH_ASSOCIATED;
  if (sources.includes('ACRONYM')) score += WEIGHTS.ACRONYM_OR_IDENTIFIER;
  if (sources.includes('DEFINITION_PATTERN')) score += WEIGHTS.DEFINITION_PATTERN;
  if (sources.includes('MULTI_WORD_NOUN_PHRASE')) score += WEIGHTS.MULTI_WORD_NOUN_PHRASE;

  // Add frequency contribution
  score += Math.min(3.0, (node.frequency || 1) * WEIGHTS.BODY_FREQUENCY * 0.3);

  // Normalize score to 0.0 - 1.0 range
  const normalized = Math.min(1.0, Math.max(0.1, Number((score / 5.0).toFixed(2))));
  return normalized;
}

module.exports = {
  calculateAdaptiveRetentionLimit,
  calculateImportanceScore
};
