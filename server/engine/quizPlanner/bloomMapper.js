const { PLANNER_CONFIG } = require('../../config/plannerConfig');

/**
 * Pass 2: Mathematical Depth & Bloom Distribution (bloomMapper.js)
 */
function mapBloomAndDifficulty(requestedCount, userDifficulty = "Balanced") {
  const normDiff = String(userDifficulty).toUpperCase().replace(/[^A-Z_]/g, '');
  let profileKey = "BALANCED";
  
  if (normDiff.includes("LOW")) profileKey = "LOW";
  else if (normDiff.includes("MODERATE")) profileKey = "MODERATE";
  else if (normDiff.includes("VERY_HIGH") || normDiff.includes("VERYHIGH")) profileKey = "VERY_HIGH";
  else if (normDiff.includes("HIGH")) profileKey = "HIGH";
  else profileKey = "BALANCED";

  const profile = PLANNER_CONFIG.DEPTH_PROFILES[profileKey] || PLANNER_CONFIG.DEPTH_PROFILES.BALANCED;

  // Hamilton integer distribution for EASY, MEDIUM, HARD
  const easyQuota = requestedCount * profile.EASY;
  const medQuota = requestedCount * profile.MEDIUM;
  const hardQuota = requestedCount * profile.HARD;

  let easyCount = Math.floor(easyQuota);
  let medCount = Math.floor(medQuota);
  let hardCount = Math.floor(hardQuota);

  let allocatedTotal = easyCount + medCount + hardCount;
  let remainderCount = requestedCount - allocatedTotal;

  const remainders = [
    { level: "EASY", val: easyQuota - easyCount },
    { level: "MEDIUM", val: medQuota - medCount },
    { level: "HARD", val: hardQuota - hardCount }
  ].sort((a, b) => b.val - a.val);

  let rIdx = 0;
  while (remainderCount > 0) {
    const target = remainders[rIdx % remainders.length].level;
    if (target === "EASY") easyCount++;
    else if (target === "MEDIUM") medCount++;
    else if (target === "HARD") hardCount++;
    remainderCount--;
    rIdx++;
  }

  const slotDistributions = [];
  for (let i = 0; i < easyCount; i++) {
    slotDistributions.push({ targetDifficulty: "EASY", targetBloom: PLANNER_CONFIG.BLOOM_MAPPING.EASY.level });
  }
  for (let i = 0; i < medCount; i++) {
    slotDistributions.push({ targetDifficulty: "MEDIUM", targetBloom: PLANNER_CONFIG.BLOOM_MAPPING.MEDIUM.level });
  }
  for (let i = 0; i < hardCount; i++) {
    slotDistributions.push({ targetDifficulty: "HARD", targetBloom: PLANNER_CONFIG.BLOOM_MAPPING.HARD.level });
  }

  return {
    profileKey,
    distributionSummary: { EASY: easyCount, MEDIUM: medCount, HARD: hardCount },
    slotDistributions
  };
}

module.exports = {
  mapBloomAndDifficulty
};
