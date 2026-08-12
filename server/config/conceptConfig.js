/**
 * Centralized Concept Graph Builder & Normalizer Configuration
 * Version: 2.6.0
 */

const CONCEPT_CONFIG = {
  VERSION: {
    GRAPH: "2.6.0",
    EXTRACTORS: "2.4.0",
    NORMALIZER: "1.2.0"
  },
  PERFORMANCE: {
    MAX_DOCUMENT_LENGTH_CHARS: 500000,
    SNIPPET_RADIUS_CHARS: 120,
    SEARCH_WINDOW_CHARS: 2000,
    TARGET_COMPLEXITY: "O(n + c^2)" // n = text length, c = retained concepts
  },
  RETAINED_CONCEPTS_BOUNDS: {
    DEFAULT: 30,
    MIN: 15,
    MAX: 50,
    SCALING_FACTOR: 3.5 // retained = clamp(min, Math.round(Math.sqrt(candidateCount) * SCALING_FACTOR), max)
  },
  PRUNING_THRESHOLDS: {
    ORPHAN_MIN_IMPORTANCE: 0.35,
    ORPHAN_MAX_FREQUENCY: 1
  },
  NOISE_STOPWORDS: [
    "chapter", "lecture", "slide", "page", "section", "overview", "introduction",
    "summary", "conclusion", "example", "exercise", "homework", "professor", "university",
    "cse", "csm", "csd", "it", "ece", "eee", "rkr21", "rkr", "unit", "topic", "software engineering"
  ],
  CONCEPT_TYPES: [
    "PROTOCOL", "ALGORITHM", "DATA_STRUCTURE", "API", "CLASS", "METHOD",
    "FORMULA", "VARIABLE", "COMMAND", "NETWORK_COMPONENT", "DESIGN_PATTERN",
    "SECURITY_MECHANISM", "DATABASE_OBJECT", "GENERAL_CONCEPT"
  ],
  WEIGHT_MULTIPLIERS: {
    HEADER_PROMINENCE: 2.5,
    CODE_OR_MATH_ASSOCIATED: 2.0,
    ACRONYM_OR_IDENTIFIER: 1.8,
    DEFINITION_PATTERN: 1.5,
    MULTI_WORD_NOUN_PHRASE: 1.4,
    BODY_FREQUENCY: 1.0
  }
};

module.exports = {
  CONCEPT_CONFIG
};
