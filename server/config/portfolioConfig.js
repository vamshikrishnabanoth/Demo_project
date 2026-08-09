/**
 * Centralized Portfolio Assembly & Global Quiz Reviewer Configuration
 * Version: 1.8.1
 */

function deepFreeze(obj) {
  Object.freeze(obj);
  Object.values(obj).forEach(value => {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  });
  return obj;
}

const PORTFOLIO_CONFIG = deepFreeze({
  VERSION: "1.8.1",
  DEFAULT_QUIZ_SIZE: 10,
  MAX_STEM_FRAMING_REPETITION_RATIO: 0.30, // Max 30% of questions can share the same opening stem phrase
  BLOOM_ORDER: {
    RECALL: 1,
    REMEMBER: 1,
    UNDERSTANDING: 2,
    UNDERSTAND: 2,
    APPLICATION: 3,
    APPLY: 3,
    ANALYSIS: 4,
    ANALYZE: 4,
    EVALUATION: 5,
    EVALUATE: 5,
    CREATION: 6,
    CREATE: 6
  },
  DIFFICULTY_ORDER: {
    EASY: 1,
    MEDIUM: 2,
    HARD: 3
  }
});

module.exports = {
  PORTFOLIO_CONFIG,
  deepFreeze
};
