const { PORTFOLIO_CONFIG } = require('../../config/portfolioConfig');

/**
 * 6. BLOOM-FIRST PEDAGOGICAL RAMP SORTER
 * Orders selected items using Bloom rank primary, Difficulty rank secondary.
 */
function sortBloomFirstPedagogicalRamp(items = []) {
  return [...items].sort((a, b) => {
    const bloomA = PORTFOLIO_CONFIG.BLOOM_ORDER[(a.targetBloom || '').toUpperCase()] || 2;
    const bloomB = PORTFOLIO_CONFIG.BLOOM_ORDER[(b.targetBloom || '').toUpperCase()] || 2;

    if (bloomA !== bloomB) {
      return bloomA - bloomB;
    }

    const diffA = PORTFOLIO_CONFIG.DIFFICULTY_ORDER[(a.targetDifficulty || '').toUpperCase()] || 2;
    const diffB = PORTFOLIO_CONFIG.DIFFICULTY_ORDER[(b.targetDifficulty || '').toUpperCase()] || 2;

    return diffA - diffB;
  });
}

module.exports = {
  sortBloomFirstPedagogicalRamp
};
