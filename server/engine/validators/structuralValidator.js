const { VALIDATOR_CONFIG, ValidationAbortedError } = require('../../config/validatorConfig');

function norm(str) {
  return typeof str === 'string' ? str.normalize("NFKC").trim() : "";
}

/**
 * GATE 1: UNICODE NFKC STRUCTURAL VALIDATOR — HARD GATE
 */
function runStructuralValidation(mcqItem, validationContext = {}, signal) {
  if (signal?.aborted) throw new ValidationAbortedError();

  const { stem, question, questionText, options, correctAnswer, correct_answer } = mcqItem || {};
  const rawStem = stem || question || questionText;
  const rawAns = correctAnswer || correct_answer;

  const isStemValid = typeof rawStem === 'string' && norm(rawStem).length > 0;
  const areOptionsValid = Array.isArray(options) &&
    options.length === 4 &&
    options.every(opt => typeof opt === 'string' && norm(opt).length > 0);

  if (!isStemValid || !areOptionsValid || (typeof rawAns !== 'string' && typeof rawAns !== 'number')) {
    return {
      passed: false,
      code: VALIDATOR_CONFIG.CODES.STRUCT_001_INVALID_SCHEMA.code,
      errorDetail: VALIDATOR_CONFIG.CODES.STRUCT_001_INVALID_SCHEMA
    };
  }

  const normalizedAnswer = norm(String(rawAns));
  const normalizedChoices = options.map(norm);

  if (!normalizedChoices.includes(normalizedAnswer)) {
    return {
      passed: false,
      code: VALIDATOR_CONFIG.CODES.STRUCT_002_ANSWER_MISMATCH.code,
      errorDetail: VALIDATOR_CONFIG.CODES.STRUCT_002_ANSWER_MISMATCH
    };
  }

  const uniqueChoices = new Set(normalizedChoices.map(c => c.toLowerCase()));
  if (uniqueChoices.size !== 4) {
    return {
      passed: false,
      code: VALIDATOR_CONFIG.CODES.STRUCT_003_DUPLICATE_CHOICES.code,
      errorDetail: VALIDATOR_CONFIG.CODES.STRUCT_003_DUPLICATE_CHOICES
    };
  }

  const mockContaminationRegex = /Primary Protocol Mechanism|Unrelated Network Protocol|Secondary Interface Command|Database Table Operation|Legacy database table query definition|Alternative secondary protocol/i;
  if (normalizedChoices.some(c => mockContaminationRegex.test(c)) || mockContaminationRegex.test(norm(rawStem))) {
    return {
      passed: false,
      code: "STRUCT_MOCK_CONTAMINATION",
      errorDetail: { code: "STRUCT_MOCK_CONTAMINATION", msg: "Reject options or stems containing hardcoded mock template strings." }
    };
  }

  const metaRegex = /all of the above|none of the above|both a and b|both b and c|neither/i;
  if (normalizedChoices.some(c => metaRegex.test(c))) {
    return {
      passed: false,
      code: VALIDATOR_CONFIG.CODES.STRUCT_004_FORBIDDEN_META_PHRASE.code,
      errorDetail: VALIDATOR_CONFIG.CODES.STRUCT_004_FORBIDDEN_META_PHRASE
    };
  }

  return {
    passed: true,
    code: VALIDATOR_CONFIG.PASS_CODES.STRUCTURAL
  };
}

module.exports = {
  runStructuralValidation
};
