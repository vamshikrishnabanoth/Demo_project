/**
 * Comprehensive Inter-Rater Reliability (IRR) & Psychometric Calculation Engine
 * 
 * Implemented Formulations:
 * 1. Quadratic Weighted Cohen's Kappa (\kappa_w) for Ordinal Scales:
 *    - Question Correctness (Tiers 1–4)
 *    - Question Clarity (Tiers 1–4)
 *    - Bloom's Cognitive Taxonomy (Tiers 1–3)
 *    - Distractor Plausibility Index (Tiers 1–4)
 *    - Difficulty Calibration (Declared Difficulty [1–3] vs Reviewer Bloom [1–3])
 * 2. Unweighted Cohen's Kappa (\kappa) for Categorical / Nominal Scales:
 *    - Contextual Grounding (Binary: 0 / 1)
 *    - Syllabus Subtopic Assignment (Nominal: SUB_01, SUB_02, SUB_03, SUB_04)
 *    - Item Acceptance Decision (Binary: ACCEPT / REJECT)
 * 3. Operational Difficulty Calibration Mapping:
 *    - Easy   -> Bloom Tier 1 (Recall / Remember)
 *    - Medium -> Bloom Tier 2 (Understand / Comprehend)
 *    - Hard   -> Bloom Tier 3 (Apply / Analyze / Evaluate)
 *    *NOTE: Strictly an operational mapping for empirical calibration testing,
 *           NOT an inherent pedagogical equivalence between item difficulty
 *           and cognitive demand.*
 * 4. Adjudicated Instructional Attention Fidelity (IAF):
 *    IAF = 1 - 0.5 * sum(|(n_k / N_delivered) - w_k^*|)
 */

/**
 * Operational Mapping of Declared Difficulty to Bloom Cognitive Tiers
 * Explicitly labeled as an OPERATIONAL MAPPING for calibration analysis.
 */
function mapDeclaredDifficultyToBloomTier(declaredDifficulty) {
  const norm = String(declaredDifficulty || '').trim().toLowerCase();
  if (norm === 'easy') return 1;
  if (norm === 'medium' || norm === 'balanced' || norm === 'intermediate') return 2;
  if (norm === 'hard' || norm === 'advanced') return 3;
  return null;
}

/**
 * Unweighted Cohen's Kappa for Nominal / Categorical Scales
 * Handles edge case: when expected agreement Pe == 1.0 (zero category variance),
 * kappa is mathematically UNDEFINED (0/0) and returns null with an explicit diagnostic.
 */
function calculateUnweightedKappa(ratings1, ratings2) {
  if (!Array.isArray(ratings1) || !Array.isArray(ratings2) || ratings1.length !== ratings2.length || ratings1.length === 0) {
    throw new Error('Ratings arrays must be non-empty and of identical length');
  }
  const n = ratings1.length;
  const categories = Array.from(new Set([...ratings1, ...ratings2])).sort();
  const k = categories.length;

  // Edge case 1: Single category present across all raters
  if (k <= 1) {
    return {
      kappa: null,
      isDefined: false,
      status: 'UNDEFINED_ZERO_VARIANCE',
      observedAgreement: 1.0,
      expectedAgreement: 1.0,
      description: 'Kappa is mathematically undefined (0/0) because all ratings fall into a single category (zero variance).'
    };
  }

  const catToIndex = {};
  categories.forEach((cat, idx) => { catToIndex[cat] = idx; });

  const matrix = Array.from({ length: k }, () => Array(k).fill(0));
  for (let i = 0; i < n; i++) {
    const row = catToIndex[ratings1[i]];
    const col = catToIndex[ratings2[i]];
    matrix[row][col]++;
  }

  let observedAgreement = 0;
  for (let i = 0; i < k; i++) {
    observedAgreement += matrix[i][i];
  }
  const po = observedAgreement / n;

  let pe = 0;
  for (let i = 0; i < k; i++) {
    const rowSum = matrix[i].reduce((sum, val) => sum + val, 0);
    const colSum = matrix.reduce((sum, row) => sum + row[i], 0);
    pe += (rowSum * colSum) / (n * n);
  }

  // Edge case 2: Zero expected disagreement (Pe == 1.0)
  if (Math.abs(pe - 1.0) < 1e-9) {
    return {
      kappa: null,
      isDefined: false,
      status: 'UNDEFINED_ZERO_VARIANCE',
      observedAgreement: Number(po.toFixed(4)),
      expectedAgreement: Number(pe.toFixed(4)),
      description: 'Kappa is mathematically undefined (0/0) because expected agreement equals 1.0 (zero expected disagreement).'
    };
  }

  const kappa = (po - pe) / (1 - pe);
  return {
    kappa: Number(kappa.toFixed(4)),
    isDefined: true,
    status: 'COMPUTED',
    observedAgreement: Number(po.toFixed(4)),
    expectedAgreement: Number(pe.toFixed(4))
  };
}

/**
 * Quadratic Weighted Cohen's Kappa for Ordinal Scales
 * Handles edge case: when expected disagreement sumWeightExpected == 0,
 * kappa is mathematically UNDEFINED (0/0) and returns null with an explicit diagnostic.
 */
function calculateQuadraticWeightedKappa(ratings1, ratings2, minTier = 1, maxTier = 4) {
  if (!Array.isArray(ratings1) || !Array.isArray(ratings2) || ratings1.length !== ratings2.length || ratings1.length === 0) {
    throw new Error('Ratings arrays must be non-empty and of identical length');
  }
  const n = ratings1.length;
  const k = maxTier - minTier + 1;

  // Observed confusion matrix O
  const O = Array.from({ length: k }, () => Array(k).fill(0));
  for (let i = 0; i < n; i++) {
    const r1 = Math.round(ratings1[i]) - minTier;
    const r2 = Math.round(ratings2[i]) - minTier;
    if (r1 >= 0 && r1 < k && r2 >= 0 && r2 < k) {
      O[r1][r2]++;
    }
  }

  // Marginals
  const rMarginal = Array(k).fill(0);
  const cMarginal = Array(k).fill(0);
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) {
      rMarginal[i] += O[i][j];
      cMarginal[j] += O[i][j];
    }
  }

  // Expected matrix E
  const E = Array.from({ length: k }, () => Array(k).fill(0));
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) {
      E[i][j] = (rMarginal[i] * cMarginal[j]) / n;
    }
  }

  // Quadratic weights w_ij = (i - j)^2 / (k - 1)^2
  let sumWeightObserved = 0;
  let sumWeightExpected = 0;

  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) {
      const weight = Math.pow(i - j, 2) / Math.pow(k - 1, 2);
      sumWeightObserved += weight * O[i][j];
      sumWeightExpected += weight * E[i][j];
    }
  }

  // Edge case: when all ratings fall in a single cell, expected disagreement is 0
  if (Math.abs(sumWeightExpected) < 1e-9) {
    return {
      kappa: null,
      isDefined: false,
      status: 'UNDEFINED_ZERO_DISAGREEMENT',
      observedDisagreement: Number(sumWeightObserved.toFixed(4)),
      expectedDisagreement: Number(sumWeightExpected.toFixed(4)),
      description: 'Weighted kappa is mathematically undefined (0/0) because expected disagreement is 0 (all ratings in single category).'
    };
  }

  const kw = 1 - (sumWeightObserved / sumWeightExpected);
  return {
    kappa: Number(kw.toFixed(4)),
    isDefined: true,
    status: 'COMPUTED',
    observedDisagreement: Number(sumWeightObserved.toFixed(4)),
    expectedDisagreement: Number(sumWeightExpected.toFixed(4))
  };
}

/**
 * Difficulty Calibration Analysis: Declared Difficulty vs Reviewer Bloom Level
 * Maps declared difficulty string to Bloom Tier (1-3) and computes Quadratic Weighted Kappa.
 */
function calculateDifficultyCalibration(declaredDifficulties, reviewerBloomTiers) {
  const numericDeclared = declaredDifficulties.map(d => mapDeclaredDifficultyToBloomTier(d));
  const validPairs = [];
  for (let i = 0; i < declaredDifficulties.length; i++) {
    if (numericDeclared[i] !== null && typeof reviewerBloomTiers[i] === 'number') {
      validPairs.push({ declared: numericDeclared[i], bloom: reviewerBloomTiers[i] });
    }
  }

  const decArr = validPairs.map(p => p.declared);
  const bloomArr = validPairs.map(p => p.bloom);

  return calculateQuadraticWeightedKappa(decArr, bloomArr, 1, 3);
}

function calculateAdjudicatedIAF(deliveredSubtopics, groundTruthWeights) {
  const nDelivered = deliveredSubtopics.length;
  if (nDelivered === 0) return 0.0;

  const counts = {};
  Object.keys(groundTruthWeights).forEach(sub => { counts[sub] = 0; });
  deliveredSubtopics.forEach(sub => {
    counts[sub] = (counts[sub] || 0) + 1;
  });

  let totalAbsoluteDeviation = 0;
  for (const [subId, targetWeight] of Object.entries(groundTruthWeights)) {
    const allocatedShare = counts[subId] / nDelivered;
    totalAbsoluteDeviation += Math.abs(allocatedShare - targetWeight);
  }

  const iaf = 1 - 0.5 * totalAbsoluteDeviation;
  return Number(iaf.toFixed(4));
}

function interpretKappa(res) {
  if (!res || !res.isDefined) {
    return 'UNDEFINED (Zero category variance across ratings; perfect observed agreement with zero expected disagreement)';
  }
  const kappa = res.kappa;
  if (kappa >= 0.80) return `Almost Perfect / Excellent Agreement (\kappa = ${kappa})`;
  if (kappa >= 0.75) return `Substantial Agreement - Meets Publication Standard (\kappa = ${kappa})`;
  if (kappa >= 0.60) return `Moderate-High Agreement - Requires Reconciling Discrepancies (\kappa = ${kappa})`;
  if (kappa >= 0.40) return `Moderate Agreement - Substantial Disagreement (\kappa = ${kappa})`;
  if (kappa >= 0.20) return `Fair Agreement (\kappa = ${kappa})`;
  return `Slight / Poor Agreement (\kappa = ${kappa})`;
}

function runSelfVerification() {
  console.log('====================================================================');
  console.log('IRR & PSYCHOMETRIC ENGINE MATHEMATICAL VERIFICATION');
  console.log('====================================================================\n');

  // Test 1: Standard Ordinal Agreement (Bloom 1-3)
  const b1 = [1, 2, 3, 2, 1, 3, 2, 2, 3, 1];
  const b2 = [1, 2, 3, 2, 1, 2, 2, 3, 3, 1];
  const resBloom = calculateQuadraticWeightedKappa(b1, b2, 1, 3);
  console.log(`Test 1 (Standard Ordinal Bloom Kappa_w): ${resBloom.kappa} -> ${interpretKappa(resBloom)}`);

  // Test 2: Perfect Agreement across multiple categories (Kappa = 1.0)
  const p1 = [1, 2, 3, 1, 2, 3];
  const p2 = [1, 2, 3, 1, 2, 3];
  const resPerfect = calculateQuadraticWeightedKappa(p1, p2, 1, 3);
  console.log(`Test 2 (Multi-Category Perfect Agreement): ${resPerfect.kappa} -> ${interpretKappa(resPerfect)}`);

  // Test 3: Edge Case - Identical ratings in single category (Zero variance, Undefined Kappa)
  const id1 = [1, 1, 1, 1, 1];
  const id2 = [1, 1, 1, 1, 1];
  const resZeroVarUnweighted = calculateUnweightedKappa(id1, id2);
  console.log(`Test 3a (Edge Case: Single-category unweighted kappa): Defined: ${resZeroVarUnweighted.isDefined}, Kappa: ${resZeroVarUnweighted.kappa} (${resZeroVarUnweighted.status})`);
  const resZeroVarWeighted = calculateQuadraticWeightedKappa(id1, id2, 1, 3);
  console.log(`Test 3b (Edge Case: Single-category weighted kappa): Defined: ${resZeroVarWeighted.isDefined}, Kappa: ${resZeroVarWeighted.kappa} (${resZeroVarWeighted.status})`);

  // Test 4: Operational Difficulty Calibration Mapping
  const declaredDiffs = ['Easy', 'Medium', 'Hard', 'Medium', 'Easy', 'Hard'];
  const reviewerBlooms = [1, 2, 3, 2, 1, 2];
  const resCalib = calculateDifficultyCalibration(declaredDiffs, reviewerBlooms);
  console.log(`Test 4 (Operational Difficulty Calibration Kappa_w): ${resCalib.kappa} -> ${interpretKappa(resCalib)}`);

  // Test 5: Adjudicated IAF on Deadlocks Case Study
  const adjudicatedSubtopics = [
    'SUB_01', 'SUB_01',
    'SUB_02', 'SUB_02',
    'SUB_03', 'SUB_03',
    'SUB_04', 'SUB_04', 'SUB_04', 'SUB_04'
  ];
  const osWeights = { SUB_01: 0.25, SUB_02: 0.20, SUB_03: 0.20, SUB_04: 0.35 };
  const iaf = calculateAdjudicatedIAF(adjudicatedSubtopics, osWeights);
  console.log(`Test 5 (Adjudicated IAF): ${iaf} (Expected: 0.9500) -> ${iaf === 0.95 ? 'PASS' : 'FAIL'}`);
}

if (require.main === module) {
  runSelfVerification();
}

module.exports = {
  mapDeclaredDifficultyToBloomTier,
  calculateUnweightedKappa,
  calculateQuadraticWeightedKappa,
  calculateDifficultyCalibration,
  calculateAdjudicatedIAF,
  interpretKappa
};
