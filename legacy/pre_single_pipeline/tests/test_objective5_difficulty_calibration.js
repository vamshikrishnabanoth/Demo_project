/**
 * server/test/test_objective5_difficulty_calibration.js
 *
 * REGRESSION & VERIFICATION SUITE: OBJECTIVE 5 DIFFICULTY CALIBRATION REMEDIATION
 *
 * Verifies that the difficulty calibration remediation across:
 * - Agent1Planner (authoritative capacity, zero Hard allocations on zero Hard cap, Medium deficit provenance)
 * - LectureIntelligence (tightened depth indicators without superficial keyword inflation)
 * - Agent3Evaluator (rejection of UNCERTAIN/Medium for Hard, code relational expressions as TRACE/Medium)
 * - DeterministicValidator (terminal contract duplicate detection, prevention of static lookup as Medium)
 *
 * comprehensively resolves DEF-DIFF-01, DEF-DIFF-02, DEF-DIFF-03, and DEF-DIFF-04.
 */

'use strict';

process.env.AGENT3_MODE = 'deterministic_only';

const assert = require('assert');
const { Agent1Planner } = require('../engine/agents/agent1Planner');
const evaluator = require('../engine/agents/agent3Evaluator');
const deterministicValidator = require('../engine/validators/deterministicValidator');

console.log('======================================================================');
console.log('  TEST SUITE: OBJECTIVE 5 DIFFICULTY CALIBRATION REMEDIATION');
console.log('======================================================================\n');

let totalTests = 0;
let passedTests = 0;

async function runTest(testName, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  [PASS] Test ${totalTests}: ${testName}`);
  } catch (err) {
    console.error(`  [FAIL] Test ${totalTests}: ${testName}`);
    console.error(`         Error: ${err.message}`);
    process.exitCode = 1;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const mockEvidencePackageZeroHard = {
  mainTopic: 'Stock Trading Greedy Algorithm',
  instructionalProfile: {
    negativeBoundaries: [],
    hardFeasibility: { hardFeasible: false, maxHard: 0, message: 'Lecture is purely descriptive/procedural with 0 invariants.' }
  },
  evidenceCapacity: {
    capacityByDifficulty: { easy: 4, medium: 5, hard: 0 },
    effectiveHardCap: 0,
    isCapacityValid: true
  },
  lectureIntelligence: {
    evidenceCapacity: {
      capacityByDifficulty: { easy: 4, medium: 5, hard: 0 },
      effectiveHardCap: 0
    }
  },
  unifiedRawContent: 'The stock trading algorithm takes an array of daily prices. If price increases from day i to i+1, add difference to profit. Return 0 if no profit is possible.',
  assessmentTargets: [
    { targetId: 'T01', concept: 'Problem Definition', targetDifficulty: 'Easy' },
    { targetId: 'T02', concept: 'Valley-Peak Principle', targetDifficulty: 'Medium' },
    { targetId: 'T03', concept: 'Greedy Choice Property', targetDifficulty: 'Medium' },
    { targetId: 'T04', concept: 'Iterative Implementation', targetDifficulty: 'Medium' },
    { targetId: 'T05', concept: 'Boundary Casework: Zero-Absorption & Positives', targetDifficulty: 'Hard' },
    { targetId: 'T06', concept: 'Local Transition Logic', targetDifficulty: 'Medium' }
  ]
};

// Condition B questions for calibration audits
const q4 = {
  questionText: 'In the canonical iterative implementation, what condition determines whether an adjacent price transition contributes to the running total max_profit?',
  options: [
    'prices[i] < prices[i+1]',
    'prices[i] > prices[i+1]',
    'prices[i] == prices[i+1]',
    'prices[i] >= prices[i+1]'
  ],
  correctAnswer: 'prices[i] < prices[i+1]',
  explanation: 'When prices[i] < prices[i+1], buying at i and selling at i+1 yields a strictly positive profit that increments the accumulator.'
};

const q5 = {
  questionText: 'In the context of the peak-valley decomposition, how does a zero price difference between consecutive days affect the running total profit?',
  options: [
    'It adds nothing to the profit because only strictly positive transitions increment the running total.',
    'It resets the accumulated profit back to zero because no gain occurred.',
    'It decrements the accumulated profit by the baseline price.',
    'It triggers a mandatory stock liquidation event.'
  ],
  correctAnswer: 'It adds nothing to the profit because only strictly positive transitions increment the running total.',
  explanation: 'A price delta of zero adds 0 to max_profit, leaving the running total unchanged.'
};

const q7 = {
  questionText: 'Under the problem specification, what integer must be printed if no profit is possible from any sequence of transactions?',
  options: [
    'The integer zero',
    'A negative error code',
    'The initial stock price',
    'A null termination pointer'
  ],
  correctAnswer: 'The integer zero',
  explanation: 'If prices never increase, the algorithm executes zero transactions and prints 0.'
};

const q12 = {
  questionText: 'According to the lecture specification, what integer must be printed if the price sequence strictly decreases across all days?',
  options: [
    'Zero',
    'Negative one',
    'The minimum price',
    'The maximum price'
  ],
  correctAnswer: 'Zero',
  explanation: 'When prices strictly decrease, no buy-sell pair yields profit, so 0 is printed.'
};

const q13 = {
  questionText: 'Why is a price decrease between consecutive trading days excluded from the accumulated profit?',
  options: [
    'Selling at a lower price than purchase incurs a loss, reducing net profit.',
    'The exchange prohibits selling when prices decrease.',
    'Negative numbers cannot be added to an integer variable in C++.',
    'A decrease resets the index counter to the array start.'
  ],
  correctAnswer: 'Selling at a lower price than purchase incurs a loss, reducing net profit.',
  explanation: 'The greedy strategy only captures upward deltas; downward deltas represent losses and are omitted.'
};

const genuineHardQuestion = {
  questionText: 'In a concurrent transaction engine using two-phase locking, Transaction T1 holds a shared lock on Item A and requests an exclusive lock on Item B, while Transaction T2 holds an exclusive lock on Item B and requests an exclusive lock on Item A. Why does this schedule produce a deadlock anomaly rather than a serializable execution?',
  options: [
    'T1 and T2 form a circular wait dependency where neither can acquire its requested lock because incompatible lock modes are held by the counterpart transaction.',
    'Two-phase locking prohibits transactions from acquiring locks in the shrinking phase.',
    'Shared locks cannot be converted to exclusive locks under any strict schedule.',
    'The buffer manager aborts both transactions due to uncommitted dirty writes.'
  ],
  correctAnswer: 'T1 and T2 form a circular wait dependency where neither can acquire its requested lock because incompatible lock modes are held by the counterpart transaction.',
  explanation: 'Circular wait with reciprocal incompatible lock holds creates a deadlock cycle requiring abort and rollback.'
};

// ─────────────────────────────────────────────────────────────────────────────
// Test Cases
// ─────────────────────────────────────────────────────────────────────────────

(async () => {
  // 1. DEF-DIFF-01: Zero Hard Capacity Enforced Across Target Planning & Padding
  await runTest('Zero Hard capacity: generates 0 Hard allocations and preserves honest Hard deficits', async () => {
    const planner = new Agent1Planner();
    const plan = await planner.planAssessment(mockEvidencePackageZeroHard, {
      count: 6,
      requestedDifficulty: 'Hard',
      deficitPolicy: 'PRESERVE_DEFICIT'
    });

    assert(plan && Array.isArray(plan.assessmentTargets), 'Plan should produce assessment targets');
    const activeHard = plan.assessmentTargets.filter(t => t.targetDifficulty === 'Hard' && !t.isCapacityLimited);
    assert.strictEqual(activeHard.length, 0, `Active Hard targets must be 0 when effectiveHardCap is 0, got ${activeHard.length}`);

    const deficitTargets = plan.assessmentTargets.filter(t => t.intendedCognitiveOperation === 'UNFULFILLED_CAPACITY_DEFICIT');
    assert(deficitTargets.length > 0, 'Must record explicit capacity deficit targets');
    for (const dt of deficitTargets) {
      assert.strictEqual(dt.targetDifficulty, 'Hard', 'Deficit target should record requested tier as Hard');
      assert.strictEqual(dt.capacityLimitation.status, 'INSUFFICIENT_EVIDENCE_FOR_HARD', 'Status must be INSUFFICIENT_EVIDENCE_FOR_HARD');
    }
  });

  // 2. DEF-DIFF-01: Deficit Provenance (Medium Deficit is NOT Recorded as Hard)
  await runTest('Medium capacity exhaustion: records correct Medium deficit provenance (not INSUFFICIENT_EVIDENCE_FOR_HARD)', async () => {
    const planner = new Agent1Planner();
    const mediumPackage = {
      ...mockEvidencePackageZeroHard,
      instructionalProfile: {
        hardFeasibility: { hardFeasible: false, maxHard: 0 }
      },
      evidenceCapacity: {
        capacityByDifficulty: { easy: 2, medium: 2, hard: 0 },
        mediumCap: 2,
        effectiveHardCap: 0,
        isCapacityValid: true
      }
    };

    const plan = await planner.planAssessment(mediumPackage, {
      count: 5,
      requestedDifficulty: 'Medium',
      deficitPolicy: 'PRESERVE_DEFICIT'
    });

    const targets = plan.assessmentTargets || [];
    const deficits = targets.filter(t => t.isCapacityLimited || t.intendedCognitiveOperation === 'UNFULFILLED_CAPACITY_DEFICIT');
    if (deficits.length > 0) {
      for (const d of deficits) {
        assert.strictEqual(d.targetDifficulty, 'Medium', 'Medium deficit must preserve Medium target difficulty');
        assert.notStrictEqual(d.capacityLimitation?.status, 'INSUFFICIENT_EVIDENCE_FOR_HARD', 'Medium deficit must NOT have status INSUFFICIENT_EVIDENCE_FOR_HARD');
        assert.strictEqual(d.capacityLimitation?.status, 'INSUFFICIENT_CURRICULAR_EVIDENCE', 'Medium deficit status must be INSUFFICIENT_CURRICULAR_EVIDENCE');
      }
    }
  });

  // 3. DEF-DIFF-02: Evaluator Rejects Q5 and Q13 from Hard Tier
  await runTest('DEF-DIFF-02: Q5 and Q13 rejected from Hard tier as TIER_COGNITIVE_MISMATCH', async () => {
    const targetHard = {
      targetId: 'T05',
      concept: 'Boundary Casework: Zero-Absorption & Positives',
      targetDifficulty: 'Hard',
      intendedCognitiveOperation: 'DIAGNOSE'
    };

    const stockEvidence = 'The stock trading algorithm takes an array of daily prices. If price increases from day i to i+1, add difference to profit. A zero price difference adds zero to profit. Negative price deltas are omitted.';

    const evalQ5 = evaluator._runDeterministicAudit(q5, targetHard, stockEvidence);
    assert.strictEqual(evalQ5.passed, false, 'Q5 must fail when evaluated for Hard tier');
    assert(evalQ5.failureReasons.includes('TIER_COGNITIVE_MISMATCH'), 'Q5 must fail with TIER_COGNITIVE_MISMATCH');

    const evalQ13 = evaluator._runDeterministicAudit(q13, targetHard, stockEvidence);
    assert.strictEqual(evalQ13.passed, false, 'Q13 must fail when evaluated for Hard tier');
    assert(evalQ13.failureReasons.includes('TIER_COGNITIVE_MISMATCH'), 'Q13 must fail with TIER_COGNITIVE_MISMATCH');
  });

  // 4. DEF-DIFF-02: Evaluator Rejects UNCERTAIN Demand from Hard Tier
  await runTest('DEF-DIFF-02: UNCERTAIN cognitive demand rejected from Hard tier', async () => {
    const uncertainMCQ = {
      questionText: 'Consider the following scenario involving the data structures discussed.',
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correctAnswer: 'Option A',
      explanation: 'Basic explanation.'
    };

    const targetHard = {
      targetId: 'T01',
      concept: 'General Subject Matter',
      targetDifficulty: 'Hard',
      intendedCognitiveOperation: 'DIAGNOSE'
    };

    const res = evaluator._runDeterministicAudit(uncertainMCQ, targetHard, 'Generic data structures context.');
    assert.strictEqual(res.passed, false, 'UNCERTAIN demand must fail Hard tier');
    assert(res.failureReasons.includes('TIER_COGNITIVE_MISMATCH'), 'UNCERTAIN demand must yield TIER_COGNITIVE_MISMATCH');
  });

  // 5. DEF-DIFF-02: Genuine Hard Diagnostic Scenario Still Accepted
  await runTest('DEF-DIFF-02: Genuine Hard diagnostic/reasoning question remains accepted in Hard tier', async () => {
    const targetHard = {
      targetId: 'T01',
      concept: 'Two-Phase Locking Deadlock Anomaly',
      targetDifficulty: 'Hard',
      intendedCognitiveOperation: 'DIAGNOSE'
    };

    const dbEvidence = 'Two-phase locking guarantees conflict serializability. However, reciprocal locking where T1 waits for T2 and T2 waits for T1 causes deadlock anomaly.';

    const res = evaluator._runDeterministicAudit(genuineHardQuestion, targetHard, dbEvidence);
    assert(!res.failureReasons.includes('TIER_COGNITIVE_MISMATCH'), 'Genuine Hard diagnostic question must NOT fail with TIER_COGNITIVE_MISMATCH');
  });

  // 6. DEF-DIFF-03: Q4 Relational Code Logic Classified as Medium (TRACE), Not Easy (RECALL)
  await runTest('DEF-DIFF-03: Q4 relational code logic classified as Medium (TRACE), while syntax recognition is Easy (RECALL)', async () => {
    const q4Demand = evaluator._evaluateCognitiveDemand(q4, { targetDifficulty: 'Medium' });
    assert.strictEqual(q4Demand.demand, 'TRACE', `Q4 must evaluate to TRACE demand, got ${q4Demand.demand}`);

    // Syntax recognition query with short options must evaluate to RECALL
    const syntaxMCQ = {
      questionText: 'Which C++ keyword is used to declare a constant integer variable?',
      options: ['const', 'var', 'let', 'final'],
      correctAnswer: 'const',
      explanation: 'const specifies that a variable value cannot be modified.'
    };

    const syntaxDemand = evaluator._evaluateCognitiveDemand(syntaxMCQ, { targetDifficulty: 'Easy' });
    assert.strictEqual(syntaxDemand.demand, 'RECALL', `Syntax recognition must evaluate to RECALL, got ${syntaxDemand.demand}`);
  });

  // 7. DEF-DIFF-04: Q7 and Q12 Detected as Terminal Contract Semantic Duplicates
  await runTest('DEF-DIFF-04: Q7 and Q12 detected as TERMINAL_CONTRACT_DUPLICATE despite stem paraphrasing', async () => {
    const dupCheck = deterministicValidator.checkDuplicateQuestion(q12, [q7], { concept: 'Boundary Casework: Zero-Absorption & Positives' });
    assert.strictEqual(dupCheck.isDuplicate, true, 'Q12 must be detected as duplicate of Q7');
    assert(dupCheck.reason.includes('TERMINAL_CONTRACT_DUPLICATE'), `Reason must indicate TERMINAL_CONTRACT_DUPLICATE, got: ${dupCheck.reason}`);
  });

  // 8. DEF-DIFF-04: Unrelated Questions with Answer Zero are NOT Falsely Marked as Duplicates
  await runTest('DEF-DIFF-04: Unrelated questions sharing answer zero are NOT falsely marked as duplicates', async () => {
    const unrelatedZeroMCQ = {
      questionText: 'In standard zero-based indexing in C++, what is the index of the first element in an array of size n?',
      options: ['0', '1', '-1', 'n-1'],
      correctAnswer: '0',
      explanation: 'Arrays in C++ are zero-indexed, starting at index 0.'
    };

    const dupCheck = deterministicValidator.checkDuplicateQuestion(unrelatedZeroMCQ, [q7], { concept: 'Array Indexing' });
    assert.strictEqual(dupCheck.isDuplicate, false, 'Unrelated question with answer 0 must NOT be marked duplicate');
  });

  // 9. DEF-DIFF-04: Direct Output Constant Lookup Cannot Pass as Medium
  await runTest('DEF-DIFF-04: Direct output constant lookup fails Medium tier calibration', async () => {
    const targetMedium = {
      targetId: 'T12',
      concept: 'Non-Profit Boundary Contract',
      targetDifficulty: 'Medium',
      intendedCognitiveOperation: 'EXPLAIN_MECHANISM'
    };

    const stockEvidence = 'The stock trading algorithm returns 0 if the price sequence strictly decreases across all days because no positive transaction exists.';

    const evalQ12 = evaluator._runDeterministicAudit(q12, targetMedium, stockEvidence);
    assert.strictEqual(evalQ12.passed, false, 'Q12 must fail when evaluated for Medium tier');
    assert(evalQ12.failureReasons.includes('TIER_COGNITIVE_MISMATCH'), 'Q12 must fail with TIER_COGNITIVE_MISMATCH');
  });

  // 10. Genuine Medium Trace/Reasoning Question Remains Accepted in Medium Tier
  await runTest('Genuine Medium trace/reasoning question (Q4) accepted in Medium tier', async () => {
    const targetMedium = {
      targetId: 'T04',
      concept: 'Canonical Iteration Condition',
      targetDifficulty: 'Medium',
      intendedCognitiveOperation: 'TRACE'
    };

    const stockEvidence = 'Canonical iterative implementation in C++: for i = 0 to n-1, if prices[i] < prices[i+1], max_profit += prices[i+1] - prices[i].';

    const evalQ4 = evaluator._runDeterministicAudit(q4, targetMedium, stockEvidence);
    assert(!evalQ4.failureReasons.includes('TIER_COGNITIVE_MISMATCH'), 'Q4 must NOT fail TIER_COGNITIVE_MISMATCH in Medium tier');
  });

  console.log('\n======================================================================');
  console.log(`  RESULTS: ${passedTests} / ${totalTests} tests passed`);
  console.log('======================================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  } else {
    process.exit(0);
  }
})();
