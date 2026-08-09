/**
 * Centralized Quiz Planner Engine Configuration
 * Version: 1.3.0
 */

const PLANNER_CONFIG = {
  VERSION: "1.3.0",
  ALLOCATION_WEIGHTS: {
    IMPORTANCE: 0.40,
    CENTRALITY: 0.25,
    TRAVERSAL_PRIORITY: 0.20,
    CLUSTER_COVERAGE_BONUS: 0.15
  },
  MAX_SINGLE_CONCEPT_SLOT_SHARE: 0.25, // Max share of total slots for one concept (unless nodes < requestedCount)
  DEPTH_PROFILES: {
    LOW:       { EASY: 0.70, MEDIUM: 0.30, HARD: 0.00 },
    MODERATE:  { EASY: 0.50, MEDIUM: 0.40, HARD: 0.10 },
    HIGH:      { EASY: 0.30, MEDIUM: 0.40, HARD: 0.30 },
    VERY_HIGH: { EASY: 0.20, MEDIUM: 0.40, HARD: 0.40 },
    BALANCED:  { EASY: 0.33, MEDIUM: 0.34, HARD: 0.33 }
  },
  BLOOM_MAPPING: {
    EASY:   { level: "RECALL",   verbs: ["Identify", "Define", "Recall", "State"] },
    MEDIUM: { level: "APPLY",    verbs: ["Apply", "Demonstrate", "Illustrate", "Execute"] },
    HARD:   { level: "ANALYZE",  verbs: ["Analyze", "Evaluate", "Compare", "Diagnose"] }
  },
  FRAMING_PROFILES: {
    DEFINITION: {
      allowNumerical: false,
      requiresEvidence: true,
      allowCode: false,
      maxStemLength: 150,
      distractorStyle: "peer_concept"
    },
    SCENARIO: {
      allowNumerical: false,
      requiresEvidence: true,
      allowCode: false,
      maxStemLength: 220,
      distractorStyle: "plausible_misconception"
    },
    COMPARATIVE: {
      allowNumerical: false,
      requiresEvidence: true,
      allowCode: false,
      maxStemLength: 180,
      distractorStyle: "contrasting_concept"
    },
    CALCULATION: {
      allowNumerical: true,
      requiresEvidence: true,
      allowCode: true,
      maxStemLength: 200,
      distractorStyle: "computational_error"
    },
    TROUBLESHOOTING: {
      allowNumerical: false,
      requiresEvidence: true,
      allowCode: true,
      maxStemLength: 250,
      distractorStyle: "diagnostic_flaw"
    }
  }
};

module.exports = {
  PLANNER_CONFIG
};
