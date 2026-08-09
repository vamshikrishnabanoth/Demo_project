function norm(str) {
  return typeof str === 'string' ? str.normalize("NFKC").trim().toLowerCase() : "";
}

/**
 * 7. GLOBAL PORTFOLIO REVIEWER WITH EXACT EQUALITY AUDIT
 * Executes a 7-point audit verifying slot coverage, stem uniqueness, structural validity,
 * and exact equality plan-vs-actual distribution alignment.
 */
function reviewGlobalPortfolio(questions = [], quizPlan = {}, exactQuotasMet = true) {
  const audit = {
    passed: true,
    checks: {
      noDuplicateStems: true,
      slotCoveragePercent: 100,
      conceptCount: 0,
      bloomDistributionMatch: true,
      difficultyDistributionMatch: true,
      answerKeyDistributionValid: exactQuotasMet,
      structuralIntegrity: true
    },
    planVsActual: {
      bloom: { expected: {}, actual: {} },
      difficulty: { expected: {}, actual: {} }
    },
    missingSlotIds: [],
    issues: []
  };

  const stems = new Set();
  const concepts = new Set();
  const actualBlooms = {};
  const actualDifficulties = {};

  // 1. Derive Planned Target Distributions from QuizPlan
  const plannedSlots = Array.isArray(quizPlan?.slots) ? quizPlan.slots : [];
  const plannedSlotIds = plannedSlots.map(s => s.slotId).filter(Boolean);
  const expectedBlooms = {};
  const expectedDifficulties = {};

  plannedSlots.forEach(s => {
    const eb = (s.targetBloom || s.expectedFraming || 'UNKNOWN').toUpperCase();
    const ed = (s.targetDifficulty || 'UNKNOWN').toUpperCase();
    expectedBlooms[eb] = (expectedBlooms[eb] || 0) + 1;
    expectedDifficulties[ed] = (expectedDifficulties[ed] || 0) + 1;
  });

  // 2. Precise Slot-by-Slot Coverage Audit
  const actualSlotIds = new Set(questions.map(q => q.slotId).filter(Boolean));
  if (plannedSlotIds.length > 0) {
    const missing = plannedSlotIds.filter(sId => !actualSlotIds.has(sId));
    audit.missingSlotIds = missing;
    audit.checks.slotCoveragePercent = Math.round(
      ((plannedSlotIds.length - missing.length) / plannedSlotIds.length) * 100
    );
    if (missing.length > 0) {
      audit.issues.push(`Quiz plan coverage incomplete: missing ${missing.length} planned slot(s) [${missing.join(', ')}]`);
    }
  }

  // 3. Question-Level Audits & Actual Count Aggregation
  questions.forEach((q, idx) => {
    // Stem Duplication Check
    const normStem = norm(q.stem || q.question || q.questionText);
    if (stems.has(normStem)) {
      audit.checks.noDuplicateStems = false;
      audit.issues.push(`Duplicate stem found at question #${idx + 1}`);
    }
    stems.add(normStem);

    if (q.conceptId) concepts.add(q.conceptId);

    const b = (q.targetBloom || 'UNKNOWN').toUpperCase();
    actualBlooms[b] = (actualBlooms[b] || 0) + 1;

    const d = (q.targetDifficulty || 'UNKNOWN').toUpperCase();
    actualDifficulties[d] = (actualDifficulties[d] || 0) + 1;

    // Structural Integrity Check
    const choices = Array.isArray(q.options) ? q.options.map(norm) : [];
    const ans = norm(q.correctAnswer || q.correct_answer);
    if (choices.length !== 4 || !choices.includes(ans)) {
      audit.checks.structuralIntegrity = false;
      audit.issues.push(`Malformed options/answer at question #${idx + 1}`);
    }
  });

  // 4. Exact Equality Plan-vs-Actual Distribution Comparison Audit
  audit.planVsActual.bloom = { expected: expectedBlooms, actual: actualBlooms };
  audit.planVsActual.difficulty = { expected: expectedDifficulties, actual: actualDifficulties };

  if (plannedSlots.length > 0) {
    // Check Bloom exact equality
    const allBloomKeys = new Set([...Object.keys(expectedBlooms), ...Object.keys(actualBlooms)]);
    for (const bLevel of allBloomKeys) {
      const expCount = expectedBlooms[bLevel] || 0;
      const actCount = actualBlooms[bLevel] || 0;
      if (actCount !== expCount) {
        audit.checks.bloomDistributionMatch = false;
        audit.issues.push(`Bloom distribution mismatch for ${bLevel}: expected ${expCount}, got ${actCount}`);
      }
    }

    // Check Difficulty exact equality
    const allDiffKeys = new Set([...Object.keys(expectedDifficulties), ...Object.keys(actualDifficulties)]);
    for (const dLevel of allDiffKeys) {
      const expCount = expectedDifficulties[dLevel] || 0;
      const actCount = actualDifficulties[dLevel] || 0;
      if (actCount !== expCount) {
        audit.checks.difficultyDistributionMatch = false;
        audit.issues.push(`Difficulty distribution mismatch for ${dLevel}: expected ${expCount}, got ${actCount}`);
      }
    }
  }

  audit.checks.conceptCount = concepts.size;

  if (!exactQuotasMet) {
    audit.issues.push("Answer key distribution could not satisfy exact balanced quotas.");
  }

  audit.passed = audit.checks.noDuplicateStems &&
    audit.checks.structuralIntegrity &&
    audit.checks.answerKeyDistributionValid &&
    audit.checks.bloomDistributionMatch &&
    audit.checks.difficultyDistributionMatch &&
    audit.issues.length === 0;

  return audit;
}

module.exports = {
  reviewGlobalPortfolio
};
