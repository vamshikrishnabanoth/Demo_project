/**
 * Centralized Validator Configuration & Machine-Readable Error Codes
 * Engine Version: 5.8.0
 */

class ValidationAbortedError extends Error {
  constructor(message = "Validation Execution Aborted") {
    super(message);
    this.name = "ValidationAbortedError";
  }
}

function deepFreeze(obj) {
  Object.freeze(obj);
  Object.values(obj).forEach(value => {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  });
  return obj;
}

function deepMerge(target, source) {
  const result = { ...(target || {}) };
  for (const key of Object.keys(source || {})) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      target &&
      target[key] &&
      typeof target[key] === 'object'
    ) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

const BASE_VALIDATOR_PROPERTIES = {
  VERSIONS: {
    VALIDATOR: process.env.VALIDATOR_VERSION || "5.8.0",
    PIPELINE: process.env.CACHE_PIPELINE_VERSION || "4.1.0"
  },
  TIMEOUT_MS: parseInt(process.env.VALIDATOR_TIMEOUT_MS || "500", 10),
  CONCURRENCY_LIMIT: parseInt(process.env.VALIDATOR_CONCURRENCY || "5", 10),
  MAX_REGEX_EVIDENCE_CHARS: 1000,
  QUALITY_WEIGHTS: {
    BLOOM: 0.30,
    DISTRACTORS: 0.30,
    DUPLICATION: 0.20,
    AMBIGUITY: 0.20
  },
  THRESHOLDS: {
    MIN_QUALITY_SCORE: parseFloat(process.env.VALIDATOR_MIN_QUALITY || "0.75"),
    BLOOM_MIN_SCORE: 0.70,
    DISTRACTOR_MIN_SCORE: 0.70,
    DUPLICATION_MAX_SIMILARITY: 0.70,
    AMBIGUITY_LEVENSHTEIN_MIN: 0.15,
    JACCARD_DUPLICATE_HIGH: parseFloat(process.env.VALIDATOR_JACCARD_HIGH || "0.70"),
    JACCARD_BORDERLINE_MIN: parseFloat(process.env.VALIDATOR_JACCARD_MIN || "0.40"),
    COSINE_DUPLICATE: parseFloat(process.env.VALIDATOR_COSINE_THRESHOLD || "0.75"),
    GROUNDING_FUZZY: parseFloat(process.env.GROUNDING_FUZZY_THRESHOLD || "0.85"),
    GROUNDING_SEARCH_WINDOW_CHARS: parseInt(process.env.GROUNDING_WINDOW_CHARS || "2000", 10),
    OPTION_LEVENSHTEIN_RATIO: parseFloat(process.env.OPTION_LEVENSHTEIN_THRESHOLD || "0.15")
  },
  FAILURE_STAGES: {
    STRUCTURAL: "STRUCTURAL",
    GROUNDING: "GROUNDING",
    EDUCATIONAL: "EDUCATIONAL",
    TIMEOUT: "TIMEOUT",
    INTERNAL_ERROR: "INTERNAL_ERROR"
  },
  REPAIR_HINTS: {
    REGENERATE_DISTRACTORS: "REGENERATE_DISTRACTORS",
    IMPROVE_BLOOM_ALIGNMENT: "IMPROVE_BLOOM_ALIGNMENT",
    REDUCE_OPTION_AMBIGUITY: "REDUCE_OPTION_AMBIGUITY",
    REWRITE_DUPLICATE_STEM: "REWRITE_DUPLICATE_STEM",
    REWRITE_SELF_CONTAINED_QUESTION: "REWRITE_SELF_CONTAINED_QUESTION",
    REWRITE_DOMAIN_SPECIFIC_DISTRACTORS: "REWRITE_DOMAIN_SPECIFIC_DISTRACTORS",
    REWRITE_ROTATED_FRAMING: "REWRITE_ROTATED_FRAMING",
    FULL_REGENERATE: "FULL_REGENERATE"
  },
  PASS_CODES: {
    STRUCTURAL: "STRUCT_000",
    GROUNDING: "GROUND_000",
    EDUCATIONAL: "EDU_000"
  },
  CODES: {
    STRUCT_001_INVALID_SCHEMA: { code: "STRUCT_001", message: "Invalid JSON schema, missing choices array, or non-string/empty choice options." },
    STRUCT_002_ANSWER_MISMATCH: { code: "STRUCT_002", message: "Correct answer string does not match any of the 4 option choices verbatim." },
    STRUCT_003_DUPLICATE_CHOICES: { code: "STRUCT_003", message: "Option choices contain duplicate strings." },
    STRUCT_004_FORBIDDEN_META_PHRASE: { code: "STRUCT_004", message: "Options contain forbidden meta-choices (e.g., 'All of the above')." },
    GROUND_001_MISSING_EVIDENCE: { code: "GROUND_001", message: "Verbatim evidence text could not be located in source material." },
    GROUND_002_EXPLANATION_CONTRADICTION: { code: "GROUND_002", message: "Explanation contradicts key concepts in the source evidence." },
    EDU_001_SEMANTIC_DUPLICATE: { code: "EDU_001", message: "Question stem is a semantic duplicate of a previously accepted question." },
    EDU_002_BLOOM_MISALIGNMENT: { code: "EDU_002", message: "Question framing and reasoning depth do not match PlannerHints target Bloom level." },
    EDU_003_IMPLAUSIBLE_DISTRACTOR: { code: "EDU_003", message: "Distractors lack domain relevance to lecture concepts." },
    EDU_004_OPTION_AMBIGUITY_TYPO: { code: "EDU_004", message: "Option choices exhibit extreme typographical similarity or subset ambiguity." },
    EDU_005_META_REFERENCE: { code: "EDU_005", message: "Question contains document-level meta-references (e.g. 'Scenario 1', 'Paragraph X', 'Assignment 1'). Must be rewritten as a self-contained domain question." },
    EDU_006_OUT_OF_DOMAIN: { code: "EDU_006", message: "Options contain out-of-domain technical distractors unrelated to the uploaded document domain." },
    EDU_007_LOW_CONCEPT_COVERAGE: { code: "EDU_007", message: "Portfolio weighted concept coverage is below required 70% threshold." },
    EDU_008_LOW_ALIGNMENT: { code: "EDU_008", message: "Question framing lacks alignment with target practical learning objective." },
    EDU_009_LOW_PRACTICALITY: { code: "EDU_009", message: "Question practical utility score is below required 0.70 threshold for practical assignment." },
    EDU_010_INVALID_EXECUTABLE_SYNTAX: { code: "EDU_010", message: "Code option does not conform strictly to target language family syntax or contains invented plain-text keys." },
    EDU_011_PROFILE_CONTRACT_VIOLATION: { code: "EDU_011", message: "Question item diverges from Stage 1.5 Canonical Document Profile contract (e.g. unapproved raw phrase synthesized into code operator)." },
    VAL_000_TIMEOUT_EXCEEDED: { code: "VAL_000", message: "Validation execution time exceeded maximum allowed threshold." },
    VAL_500_INTERNAL_FAILURE: { code: "VAL_500", message: "Unexpected internal exception encountered during validation." }
  }
};

const VALIDATOR_CONFIG = deepFreeze(BASE_VALIDATOR_PROPERTIES);

module.exports = {
  ValidationAbortedError,
  VALIDATOR_CONFIG,
  deepFreeze,
  deepMerge
};
