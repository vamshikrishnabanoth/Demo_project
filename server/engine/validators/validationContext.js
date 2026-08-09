const { VALIDATOR_CONFIG } = require('../../config/validatorConfig');

/**
 * Decoupled Validation Context Factory
 * Creates lightweight references for validation pipeline stages.
 */
function createValidationContext(params = {}) {
  const {
    cleanedContent = '',
    targetDifficulty = 'Balanced',
    targetBloom = 'UNDERSTAND',
    expectedFraming = 'Direct Recall',
    concept = 'Core Concept',
    conceptGraph = null,
    extractedConcepts = [],
    acceptedQuestionIndex = new Map(),
    embeddingProvider = null,
    config = VALIDATOR_CONFIG
  } = params;

  return {
    cleanedContent,
    plannerHints: {
      targetDifficulty,
      targetBloom,
      expectedFraming,
      concept
    },
    conceptGraph,
    extractedConcepts: Array.isArray(extractedConcepts) ? extractedConcepts : [],
    acceptedQuestionIndex: acceptedQuestionIndex instanceof Map ? acceptedQuestionIndex : new Map(),
    embeddingProvider: embeddingProvider || {
      getEmbedding: async (_text) => [0.1, 0.2, 0.3],
      calculateSimilarity: (_vecA, _vecB) => 0.15
    },
    config
  };
}

module.exports = {
  createValidationContext
};
