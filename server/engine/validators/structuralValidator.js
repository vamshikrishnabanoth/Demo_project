const { VALIDATOR_CONFIG } = require('../../config/validatorConfig');

/**
 * GATE 1: STRUCTURAL VALIDATOR — HARD GATE
 * Performs fast, deterministic schema and syntax checks.
 * Early stops immediately on first critical failure.
 */
function runStructuralValidation(mcqItem, validationContext = {}) {
  const CODES = validationContext.config?.CODES || VALIDATOR_CONFIG.CODES;

  const stem = mcqItem?.question || mcqItem?.questionText;
  const options = mcqItem?.options;
  const correctAnswer = mcqItem?.correctAnswer || mcqItem?.correct_answer;

  // 1. Schema Check (STRUCT_001)
  if (!stem || typeof stem !== 'string' || stem.trim().length === 0 || !Array.isArray(options) || options.length !== 4 || !correctAnswer) {
    return {
      passed: false,
      code: CODES.STRUCT_001_INVALID_SCHEMA.code,
      errorDetail: CODES.STRUCT_001_INVALID_SCHEMA
    };
  }

  const cleanStem = stem.trim();
  const cleanAnswer = String(correctAnswer).trim();

  // 2. Choice Grounding (STRUCT_002)
  const verbatimMatch = options.some(opt => String(opt).trim() === cleanAnswer);
  if (!verbatimMatch) {
    return {
      passed: false,
      code: CODES.STRUCT_002_ANSWER_MISMATCH.code,
      errorDetail: CODES.STRUCT_002_ANSWER_MISMATCH
    };
  }

  // 3. Choice Uniqueness (STRUCT_003)
  const uniqueChoices = new Set(options.map(opt => String(opt).trim().toLowerCase()));
  if (uniqueChoices.size !== 4) {
    return {
      passed: false,
      code: CODES.STRUCT_003_DUPLICATE_CHOICES.code,
      errorDetail: CODES.STRUCT_003_DUPLICATE_CHOICES
    };
  }

  // 4. Forbidden Meta-Phrases (STRUCT_004)
  const forbiddenRegex = /all of the above|none of the above|both a and b|both b and c|neither/i;
  const hasForbiddenPhrase = options.some(opt => forbiddenRegex.test(String(opt)));
  if (hasForbiddenPhrase) {
    return {
      passed: false,
      code: CODES.STRUCT_004_FORBIDDEN_META_PHRASE.code,
      errorDetail: CODES.STRUCT_004_FORBIDDEN_META_PHRASE
    };
  }

  return {
    passed: true,
    code: "PASS",
    errorDetail: null,
    cleanedStem: cleanStem,
    cleanedAnswer: cleanAnswer
  };
}

module.exports = {
  runStructuralValidation
};
