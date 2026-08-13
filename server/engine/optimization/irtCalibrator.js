/**
 * Phase 4 — IRT 2PL Calibration Engine & Distractor Efficiency Analyzer
 * Computes Item Response Theory (IRT) difficulty (b_i), discrimination (a_i),
 * and Distractor Efficiency Index (DE_j) from student response matrices.
 */

'use strict';

function calibrateItemParameters(questionId, responseMatrix = []) {
  if (!Array.isArray(responseMatrix) || responseMatrix.length === 0) {
    return {
      questionId,
      sampleSize: 0,
      discriminationA: 1.0,
      difficultyB: 0.0,
      distractorEfficiency: 1.0,
      nonFunctionalOptions: []
    };
  }

  const sampleSize = responseMatrix.length;
  const correctCount = responseMatrix.filter(r => r.isCorrect).length;
  const pValue = correctCount / sampleSize;

  // Classical Test Theory Difficulty (P-value mapped to Logit scale for b_i)
  // b_i = -ln(P / (1 - P))
  const clampedP = Math.max(0.01, Math.min(0.99, pValue));
  const difficultyB = parseFloat((-Math.log(clampedP / (1 - clampedP))).toFixed(2));

  // Upper/Lower Cohort Discrimination Index (a_i)
  // Sort responses by total student score (ability proxy)
  const sorted = [...responseMatrix].sort((a, b) => (b.studentTotalScore || 0) - (a.studentTotalScore || 0));
  const topQuarter = sorted.slice(0, Math.max(1, Math.floor(sampleSize * 0.27)));
  const bottomQuarter = sorted.slice(-Math.max(1, Math.floor(sampleSize * 0.27)));

  const pUpper = topQuarter.filter(r => r.isCorrect).length / topQuarter.length;
  const pLower = bottomQuarter.filter(r => r.isCorrect).length / bottomQuarter.length;

  const rawDiscrimination = pUpper - pLower;
  // Map raw D index to 2PL a_i scale [0.2, 2.5]
  const discriminationA = parseFloat(Math.max(0.2, Math.min(2.5, 1.0 + (rawDiscrimination * 2.0))).toFixed(2));

  // Distractor Efficiency Analysis (Identify options chosen by < 5% of low-scoring students)
  const optionCounts = {};
  bottomQuarter.forEach(r => {
    const opt = String(r.selectedOption || '').trim();
    if (opt) optionCounts[opt] = (optionCounts[opt] || 0) + 1;
  });

  const nonFunctionalOptions = [];
  const totalLow = bottomQuarter.length;
  for (const [opt, count] of Object.entries(optionCounts)) {
    const freq = count / totalLow;
    if (freq < 0.05) {
      nonFunctionalOptions.push(opt);
    }
  }

  const distractorEfficiency = parseFloat((1.0 - (nonFunctionalOptions.length * 0.25)).toFixed(2));

  return {
    questionId,
    sampleSize,
    pValue: parseFloat(pValue.toFixed(2)),
    discriminationA,
    difficultyB,
    distractorEfficiency,
    nonFunctionalOptions
  };
}

module.exports = {
  calibrateItemParameters
};
