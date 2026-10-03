/**
 * experiments/experiment_5_teaching_adequacy/runner/test_structural_reliability.js
 *
 * Unit Test Harness for Structural Reliability & Output Completeness (Step 1A)
 *
 * Verifies:
 *   1. Structural Fault Injection: Missing keys marked STRUCTURAL_OUTPUT_INCOMPLETE, NOT actionable gaps.
 *   2. Genuine Pedagogical Zero Depth: True zeroes with valid output correctly distinguished from structural omissions.
 *   3. 3-Way Reliability Measure: Distinguishes 'valid_first_response', 'valid_after_retry', and 'incomplete_after_retry'.
 *   4. Malformed JSON / Non-Object Handling: Resilient error trapping without unhandled exceptions.
 *   5. Normative Tier Policy Separation: RECOMMENDED omissions marked SECONDARY_ADVISORY_GAP, isolated from core gaps.
 *   6. Dimension-Level Exclusion: Incomplete dimensions excluded from TP/FP/FN/TN; valid dimensions preserved.
 */

'use strict';

const assert = require('assert');
const {
  validateAndCompleteDiagnosticMatrix,
  EXPECTED_DIMENSIONS,
  VALID_STATUSES
} = require('./p5_3_coverage_gap_analyzer');

let totalTests = 0;
let passedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  [PASS] Test ${totalTests}: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] Test ${totalTests}: ${name}`);
    console.error(`         Error: ${err.message}`);
  }
}

console.log('='.repeat(75));
console.log('🧪 RUNNING STEP 1A STRUCTURAL RELIABILITY & FAULT INJECTION SUITE');
console.log('='.repeat(75));

// Synthetic Mock P5.1 Normative Package
const mockP51Pkg = {
  topic: 'Mock Concurrency & Resource Allocation',
  expected_dimensions: {
    IDENTIFICATION: { level: 2, alignment: 'REQUIRED' },
    MEANING: { level: 4, alignment: 'REQUIRED' },
    STRUCTURE_COMPONENTS: { level: 5, alignment: 'REQUIRED' },
    RELATIONSHIPS_MECHANISM: { level: 5, alignment: 'REQUIRED' },
    JUSTIFICATION_WHY: { level: 6, alignment: 'REQUIRED' },
    APPLICATION_INTERPRETATION: { level: 6, alignment: 'REQUIRED' },
    BOUNDARIES_EXCEPTIONS: { level: 4, alignment: 'RECOMMENDED' },
    TRANSFER_SYNTHESIS: { level: 2, alignment: 'OPTIONAL' }
  }
};

// ============================================================================
// SUITE 1: STRUCTURAL FAULT INJECTION (MISSING KEYS)
// ============================================================================
console.log('\n--- Suite 1: Structural Fault Injection (Missing Keys) ---');

runTest('Missing keys must be marked STRUCTURAL_OUTPUT_INCOMPLETE and observed_depth: null', () => {
  const truncatedParsed = {
    diagnostic_matrix: {
      IDENTIFICATION: { observed_depth: 2, status: 'COVERED', evidence_synthesis: 'Valid naming.' },
      MEANING: { observed_depth: 4, status: 'COVERED', evidence_synthesis: 'Valid meaning.' }
      // The remaining 6 dimensions are omitted by the LLM
    }
  };

  validateAndCompleteDiagnosticMatrix(truncatedParsed, mockP51Pkg, 'test_pkg_trunc');

  // Verify missing REQUIRED dimension
  const missingReq = truncatedParsed.diagnostic_matrix.STRUCTURE_COMPONENTS;
  assert.strictEqual(missingReq.status, 'STRUCTURAL_OUTPUT_INCOMPLETE', 'Status must be STRUCTURAL_OUTPUT_INCOMPLETE');
  assert.strictEqual(missingReq.observed_depth, null, 'Observed depth must be null, NOT zero');
  assert.strictEqual(missingReq.confidence, 'STRUCTURAL_FAILURE');

  // Verify missing RECOMMENDED dimension
  const missingRec = truncatedParsed.diagnostic_matrix.BOUNDARIES_EXCEPTIONS;
  assert.strictEqual(missingRec.status, 'STRUCTURAL_OUTPUT_INCOMPLETE');
  assert.strictEqual(missingRec.observed_depth, null);
});

runTest('Structural omissions must NEVER be classified as ACTIONABLE_COVERAGE_GAP', () => {
  const truncatedParsed = {
    diagnostic_matrix: {
      IDENTIFICATION: { observed_depth: 2, status: 'COVERED', evidence_synthesis: 'Valid' }
      // 7 dimensions missing
    }
  };

  validateAndCompleteDiagnosticMatrix(truncatedParsed, mockP51Pkg, 'test_pkg_trunc');

  // Verify actionable_gaps contains 0 entries
  assert.strictEqual(truncatedParsed.actionable_gaps.length, 0, 'actionable_gaps must be 0 for purely structural dropouts');
  assert.strictEqual(truncatedParsed.summary_diagnosis.actionable_gap_count, 0);

  // Verify structural_incompletes contains 7 entries
  assert.strictEqual(truncatedParsed.structural_incompletes.length, 7);
  assert.strictEqual(truncatedParsed.summary_diagnosis.structural_incomplete_count, 7);
});

// ============================================================================
// SUITE 2: GENUINE PEDAGOGICAL ZERO DEPTH VS. STRUCTURAL INCOMPLETE
// ============================================================================
console.log('\n--- Suite 2: Genuine Pedagogical Zero Depth vs. Structural Incomplete ---');

runTest('Genuine pedagogical zero with complete JSON must be classified as NOT_OBSERVED or ACTIONABLE_COVERAGE_GAP', () => {
  const completeParsedWithZero = {
    diagnostic_matrix: {
      IDENTIFICATION: { observed_depth: 2, status: 'COVERED', evidence_synthesis: 'Named.' },
      MEANING: { observed_depth: 4, status: 'COVERED', evidence_synthesis: 'Defined.' },
      STRUCTURE_COMPONENTS: { observed_depth: 5, status: 'COVERED', evidence_synthesis: 'Components covered.' },
      RELATIONSHIPS_MECHANISM: { observed_depth: 5, status: 'COVERED', evidence_synthesis: 'Flow covered.' },
      JUSTIFICATION_WHY: { observed_depth: 0, status: 'ACTIONABLE_COVERAGE_GAP', evidence_synthesis: 'Lecturer gave zero proof.' },
      APPLICATION_INTERPRETATION: { observed_depth: 6, status: 'COVERED', evidence_synthesis: 'Worked trace.' },
      BOUNDARIES_EXCEPTIONS: { observed_depth: 0, status: 'SECONDARY_ADVISORY_GAP', evidence_synthesis: 'No boundary discussed.' },
      TRANSFER_SYNTHESIS: { observed_depth: 0, status: 'PERMISSIBLE_SCOPE_OMISSION', evidence_synthesis: 'No transfer discussed.' }
    }
  };

  validateAndCompleteDiagnosticMatrix(completeParsedWithZero, mockP51Pkg, 'test_pkg_true_zero');

  // Verify genuine zero on REQUIRED tier
  const justEntry = completeParsedWithZero.diagnostic_matrix.JUSTIFICATION_WHY;
  assert.strictEqual(justEntry.observed_depth, 0, 'True zero must have observed_depth = 0');
  assert.strictEqual(justEntry.status, 'ACTIONABLE_COVERAGE_GAP');
  assert.strictEqual(completeParsedWithZero.summary_diagnosis.actionable_gap_count, 1);
  assert.strictEqual(completeParsedWithZero.summary_diagnosis.structural_incomplete_count, 0);

  // Verify genuine zero on OPTIONAL tier
  const transEntry = completeParsedWithZero.diagnostic_matrix.TRANSFER_SYNTHESIS;
  assert.strictEqual(transEntry.observed_depth, 0);
  assert.strictEqual(transEntry.status, 'PERMISSIBLE_SCOPE_OMISSION');
});

runTest('True zero (observed_depth = 0) and structural omission (observed_depth = null) are distinguishable', () => {
  const mixedParsed = {
    diagnostic_matrix: {
      IDENTIFICATION: { observed_depth: 2, status: 'COVERED', evidence_synthesis: 'OK' },
      JUSTIFICATION_WHY: { observed_depth: 0, status: 'NOT_OBSERVED', evidence_synthesis: 'Explicitly searched and missing' }
      // STRUCTURE_COMPONENTS omitted entirely
    }
  };

  validateAndCompleteDiagnosticMatrix(mixedParsed, mockP51Pkg, 'test_pkg_mixed');

  assert.strictEqual(mixedParsed.diagnostic_matrix.JUSTIFICATION_WHY.observed_depth, 0);
  assert.strictEqual(mixedParsed.diagnostic_matrix.STRUCTURE_COMPONENTS.observed_depth, null);
  assert.notStrictEqual(
    mixedParsed.diagnostic_matrix.JUSTIFICATION_WHY.status,
    mixedParsed.diagnostic_matrix.STRUCTURE_COMPONENTS.status
  );
});

// ============================================================================
// SUITE 3: 3-WAY RELIABILITY MEASURE TRACKING
// ============================================================================
console.log('\n--- Suite 3: 3-Way Reliability Measure Tracking ---');

runTest('Simulated 3-way reliability tracking correctly classifies response outcomes', () => {
  function classifyReliability(initialMissing, repairMissing) {
    if (initialMissing.length === 0) return 'valid_first_response';
    if (repairMissing.length === 0) return 'valid_after_retry';
    return 'incomplete_after_retry';
  }

  assert.strictEqual(classifyReliability([], []), 'valid_first_response');
  assert.strictEqual(classifyReliability(['MEANING'], []), 'valid_after_retry');
  assert.strictEqual(classifyReliability(['MEANING', 'JUSTIFICATION_WHY'], ['JUSTIFICATION_WHY']), 'incomplete_after_retry');
});

// ============================================================================
// SUITE 4: MALFORMED / NON-OBJECT INPUT RESILIENCE
// ============================================================================
console.log('\n--- Suite 4: Malformed / Non-Object Input Resilience ---');

runTest('Throws clear error on non-object root and initializes empty matrix cleanly', () => {
  assert.throws(() => {
    validateAndCompleteDiagnosticMatrix('invalid_string', mockP51Pkg, 'bad_pkg');
  }, /not an object/);

  const emptyObj = {};
  validateAndCompleteDiagnosticMatrix(emptyObj, mockP51Pkg, 'empty_pkg');
  assert.strictEqual(Object.keys(emptyObj.diagnostic_matrix).length, 8);
  assert.strictEqual(emptyObj.summary_diagnosis.structural_incomplete_count, 8);
});

// ============================================================================
// SUITE 5: NORMATIVE TIER POLICY SEPARATION (SECONDARY_ADVISORY_GAP)
// ============================================================================
console.log('\n--- Suite 5: Normative Tier Policy Separation ---');

runTest('RECOMMENDED tier under-coverage is assigned SECONDARY_ADVISORY_GAP, isolated from actionable_gaps', () => {
  const parsedWithRecGap = {
    diagnostic_matrix: {
      IDENTIFICATION: { observed_depth: 2, status: 'COVERED', evidence_synthesis: 'Named.' },
      MEANING: { observed_depth: 4, status: 'COVERED', evidence_synthesis: 'Defined.' },
      STRUCTURE_COMPONENTS: { observed_depth: 5, status: 'COVERED', evidence_synthesis: 'Components.' },
      RELATIONSHIPS_MECHANISM: { observed_depth: 5, status: 'COVERED', evidence_synthesis: 'Flow.' },
      JUSTIFICATION_WHY: { observed_depth: 6, status: 'COVERED', evidence_synthesis: 'Proof.' },
      APPLICATION_INTERPRETATION: { observed_depth: 6, status: 'COVERED', evidence_synthesis: 'Trace.' },
      BOUNDARIES_EXCEPTIONS: { observed_depth: 1, evidence_synthesis: 'Superficial mention of boundary.' }, // Expected is 4 (RECOMMENDED)
      TRANSFER_SYNTHESIS: { observed_depth: 2, status: 'COVERED', evidence_synthesis: 'Transfer.' }
    }
  };

  validateAndCompleteDiagnosticMatrix(parsedWithRecGap, mockP51Pkg, 'test_rec');

  const boundEntry = parsedWithRecGap.diagnostic_matrix.BOUNDARIES_EXCEPTIONS;
  assert.strictEqual(boundEntry.status, 'SECONDARY_ADVISORY_GAP', 'RECOMMENDED under-coverage must be SECONDARY_ADVISORY_GAP');
  assert.strictEqual(parsedWithRecGap.actionable_gaps.length, 0, 'Core actionable_gaps must NOT include advisory gaps');
  assert.strictEqual(parsedWithRecGap.secondary_advisory_gaps.length, 1, 'Advisory gaps list must include it');
  assert.strictEqual(parsedWithRecGap.summary_diagnosis.secondary_advisory_gap_count, 1);
});

// ============================================================================
// SUITE 6: DIMENSION-LEVEL EXCLUSION IN EVALUATION LOGIC
// ============================================================================
console.log('\n--- Suite 6: Dimension-Level Exclusion in Evaluation Logic ---');

runTest('Evaluation logic excludes only the incomplete dimension, retaining valid dimensions in pedagogical metrics', () => {
  const predMatrix = {
    IDENTIFICATION: { observed_depth: 2, status: 'COVERED' },
    MEANING: { observed_depth: 4, status: 'COVERED' },
    STRUCTURE_COMPONENTS: { observed_depth: 5, status: 'COVERED' },
    RELATIONSHIPS_MECHANISM: { observed_depth: 5, status: 'COVERED' },
    JUSTIFICATION_WHY: { observed_depth: 6, status: 'COVERED' },
    APPLICATION_INTERPRETATION: { observed_depth: 6, status: 'COVERED' },
    BOUNDARIES_EXCEPTIONS: { observed_depth: null, status: 'STRUCTURAL_OUTPUT_INCOMPLETE' }, // Incomplete
    TRANSFER_SYNTHESIS: { observed_depth: 0, status: 'PERMISSIBLE_SCOPE_OMISSION' }
  };

  const gtMatrix = {
    IDENTIFICATION: { status: 'COVERED' },
    MEANING: { status: 'COVERED' },
    STRUCTURE_COMPONENTS: { status: 'COVERED' },
    RELATIONSHIPS_MECHANISM: { status: 'COVERED' },
    JUSTIFICATION_WHY: { status: 'COVERED' },
    APPLICATION_INTERPRETATION: { status: 'COVERED' },
    BOUNDARIES_EXCEPTIONS: { status: 'ACTIONABLE_COVERAGE_GAP' }, // GT had a gap here
    TRANSFER_SYNTHESIS: { status: 'PERMISSIBLE_SCOPE_OMISSION' }
  };

  let validDims = 0;
  let structIncomplete = 0;
  let gapTP = 0, gapFP = 0, gapFN = 0, gapTN = 0;

  for (const dim of EXPECTED_DIMENSIONS) {
    const pred = predMatrix[dim];
    const gt = gtMatrix[dim];

    if (pred.status === 'STRUCTURAL_OUTPUT_INCOMPLETE') {
      structIncomplete++;
      continue; // Exclude from pedagogical confusion matrix
    }

    validDims++;
    const predIsGap = (pred.status === 'ACTIONABLE_COVERAGE_GAP');
    const gtIsGap = (gt.status === 'ACTIONABLE_COVERAGE_GAP');

    if (predIsGap && gtIsGap) gapTP++;
    else if (predIsGap && !gtIsGap) gapFP++;
    else if (!predIsGap && gtIsGap) gapFN++;
    else gapTN++;
  }

  assert.strictEqual(structIncomplete, 1, 'Exactly 1 dimension must be structurally incomplete');
  assert.strictEqual(validDims, 7, 'Exactly 7 dimensions must be valid and evaluated');
  assert.strictEqual(gapFP, 0, 'Structural dropout must NOT be counted as FP');
  assert.strictEqual(gapFN, 0, 'Excluded dimension must NOT be counted as FN');
  assert.strictEqual(gapTN, 7, 'All 7 valid covered dimensions correctly counted as TN');
});

// ============================================================================
// SUMMARY
// ============================================================================
console.log('\n' + '='.repeat(75));
console.log(`TEST SUITE RESULTS: ${passedTests} / ${totalTests} TESTS PASSED`);
console.log('='.repeat(75));

if (passedTests === totalTests) {
  console.log('✅ ALL STRUCTURAL RELIABILITY & FAULT INJECTION TESTS PASSED CLEANLY.\n');
  process.exit(0);
} else {
  console.error(`❌ ${totalTests - passedTests} TESTS FAILED.`);
  process.exit(1);
}
