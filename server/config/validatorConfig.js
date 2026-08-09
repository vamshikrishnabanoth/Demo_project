/**
 * Centralized Validator Configuration & Machine-Readable Error Codes
 * Engine Version: 4.2.0
 */

const VALIDATOR_CONFIG = {
  VERSIONS: {
    VALIDATOR: "4.2.0",
    PIPELINE: process.env.CACHE_PIPELINE_VERSION || "4.1.0"
  },
  TIMEOUT_MS: 500, // Hard cap per question validation execution
  CAPABILITIES: {
    supportsEmbeddings: true,
    supportsTFIDF: true,
    supportsGroundingRepair: true,
    supportsBoundedFuzzy: true
  },
  THRESHOLDS: {
    JACCARD_DUPLICATE_HIGH: parseFloat(process.env.VALIDATOR_JACCARD_HIGH || "0.70"),
    JACCARD_BORDERLINE_MIN: parseFloat(process.env.VALIDATOR_JACCARD_MIN || "0.40"),
    COSINE_DUPLICATE: parseFloat(process.env.VALIDATOR_COSINE_THRESHOLD || "0.75"),
    GROUNDING_FUZZY: parseFloat(process.env.GROUNDING_FUZZY_THRESHOLD || "0.85"),
    GROUNDING_SEARCH_WINDOW_CHARS: parseInt(process.env.GROUNDING_WINDOW_CHARS || "2000", 10),
    OPTION_LEVENSHTEIN_RATIO: parseFloat(process.env.OPTION_LEVENSHTEIN_THRESHOLD || "0.15")
  },
  CODES: {
    STRUCT_001_INVALID_SCHEMA: { code: "STRUCT_001", message: "Invalid JSON schema, missing choices array, or empty stem." },
    STRUCT_002_ANSWER_MISMATCH: { code: "STRUCT_002", message: "Correct answer string does not match any of the 4 option choices verbatim." },
    STRUCT_003_DUPLICATE_CHOICES: { code: "STRUCT_003", message: "Option choices contain duplicate strings." },
    STRUCT_004_FORBIDDEN_META_PHRASE: { code: "STRUCT_004", message: "Options contain forbidden meta-choices (e.g., 'All of the above')." },
    GROUND_001_MISSING_EVIDENCE: { code: "GROUND_001", message: "Verbatim evidence text could not be located in source material." },
    GROUND_002_EXPLANATION_CONTRADICTION: { code: "GROUND_002", message: "Explanation contradicts key concepts in the source evidence." },
    EDU_001_SEMANTIC_DUPLICATE: { code: "EDU_001", message: "Question stem is a semantic duplicate of a previously accepted question." },
    EDU_002_BLOOM_MISALIGNMENT: { code: "EDU_002", message: "Question framing and reasoning depth do not match PlannerHints target Bloom level." },
    EDU_003_IMPLAUSIBLE_DISTRACTOR: { code: "EDU_003", message: "Distractors lack domain relevance to lecture concepts." },
    EDU_004_OPTION_AMBIGUITY_TYPO: { code: "EDU_004", message: "Option choices exhibit extreme typographical similarity or subset ambiguity." },
    VAL_000_TIMEOUT_EXCEEDED: { code: "VAL_000", message: "Validation execution time exceeded maximum allowed 500ms threshold." }
  }
};

module.exports = {
  VALIDATOR_CONFIG
};
