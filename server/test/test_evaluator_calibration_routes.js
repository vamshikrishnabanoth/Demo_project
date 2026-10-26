/**
 * server/test/test_evaluator_calibration_routes.js
 *
 * Comprehensive Benchmark Suite for Agent 3 Evaluator Cognitive Calibration Routes:
 * - Case 1a: Definition disguised as reasoning ("Why does this classification hold" + "Because" options).
 *   Verifies whether the evaluator mistakes definitional justification for Hard mechanism reasoning.
 * - Case 1b: Genuine causal-mechanism reasoning (Strict 2PL preventing cascading aborts).
 *   Verifies whether legitimate causal mechanism reasoning is accepted and not rejected by anti-definition filters.
 * - Case 2: Genuine operational deduction (Min-heap state tracing with concrete array).
 *   Verifies whether multi-step chronological state simulation passes as Hard without collateral damage.
 * - Case 3: Adversarial critic override contract assertion (Deterministic cognitive mismatch vs LLM Critic PASS).
 *   Verifies whether final verdict assembly preserves deterministic calibration failures or allows
 *   the downstream LLM critic to silently overturn them.
 * - Boundary Matrix: Tests RECALL, Definition-in-Cosplay, Causal Mechanism, State Trace, and Diagnostic Anomaly
 *   against the requested Hard tier.
 *
 * NO PRODUCTION CODE IS MODIFIED BY THIS HARNESS.
 */

'use strict';

const assert = require('assert');
const agent3 = require('../engine/agents/agent3Evaluator');
const llmRouter = require('../engine/adapter/llmRouter');

async function runCalibrationRoutesBenchmark() {
  console.log('========================================================================');
  console.log('🧪 Benchmark Suite: Evaluator Cognitive Calibration & Verdict Assembly');
  console.log('========================================================================\n');

  const benchmarkReport = [];

  // ===========================================================================
  // Case 1a: Definition Disguised as Reasoning ("Why" + "Because" Options)
  // ===========================================================================
  console.log('--- [Case 1a] Definition Disguised as Reasoning ---');
  const case1aMCQ = {
    questionText: "In a binary tree, a node with exactly one child is classified as internal. Why does this classification hold despite the node not being fully populated?",
    options: [
      "Because it is not a leaf, so it must be internal by exclusion",
      "Because it has fewer than two children, marking it as external",
      "Because it is at a non-terminal level, forcing internal status",
      "Because it has at least one child, satisfying the internal node definition"
    ],
    correctAnswer: "Because it has at least one child, satisfying the internal node definition"
  };

  const case1aTarget = {
    concept: "Internal Node Classification",
    subtopic: "Binary Tree Terminology",
    targetDifficulty: "Hard",
    intendedCognitiveOperation: "DIAGNOSE"
  };

  const case1aEvidence = {
    unifiedRawContent: "In a binary tree, an internal node is defined as any node that has at least one child. A leaf or external node has zero children. A root with one child is still classified as internal.",
    sessionId: "sess_benchmark_case1a"
  };

  const case1aResult = await agent3.evaluateQuestion(case1aMCQ, case1aTarget, case1aEvidence, {});

  const case1aPassedFastPath = case1aResult.verificationMethod === 'DETERMINISTIC_FAST_PATH';
  const case1aAcceptedAsHard = case1aResult.status === 'PASS';
  const case1aBenchmarkPass = !case1aAcceptedAsHard && !case1aPassedFastPath;

  console.log(`  Evaluated Demand     : ${case1aResult.cognitiveAudit?.evaluatedCognitiveDemand}`);
  console.log(`  Classification Reason: ${case1aResult.cognitiveAudit?.classificationReasoning}`);
  console.log(`  Verification Method  : ${case1aResult.verificationMethod}`);
  console.log(`  Final Status         : ${case1aResult.status} (score: ${case1aResult.score})`);
  console.log(`  Failure Reasons      : ${JSON.stringify(case1aResult.failureReasons)}`);
  console.log(`  Benchmark Criteria   : Expected REJECT as Hard / No Fast-Path`);
  console.log(`  Current Production   : ${case1aBenchmarkPass ? 'PASSED (Protected)' : 'FAILED (Route A Reproduced: False Classification -> Fast-Path Acceptance)'}\n`);

  benchmarkReport.push({
    caseNum: '1a',
    title: 'Definition in Reasoning Cosplay ("Why" + "Because")',
    expected: 'RECALL / Fail Hard Calibration / No Fast-Path',
    actualDemand: case1aResult.cognitiveAudit?.evaluatedCognitiveDemand,
    actualVerdict: case1aResult.status,
    verificationMethod: case1aResult.verificationMethod,
    benchmarkStatus: case1aBenchmarkPass ? 'PASS' : 'FAIL',
    mechanismDiagnosis: 'Linguistic cues ("Why does..." + "Because...") triggered EXPLAIN_MECHANISM and bypassed critic via DETERMINISTIC_FAST_PATH'
  });

  // ===========================================================================
  // Case 1b: Genuine Causal-Mechanism Reasoning (Strict 2PL Cascading Aborts)
  // ===========================================================================
  console.log('--- [Case 1b] Genuine Causal-Mechanism Reasoning ---');
  const case1bMCQ = {
    questionText: "In a database system using Strict Two-Phase Locking (Strict 2PL), why does holding exclusive write locks until transaction completion prevent cascading aborts across concurrent transactions?",
    options: [
      "Because concurrent transactions are prevented from reading uncommitted dirty data that could later be rolled back",
      "Because all transactions acquire locks simultaneously at system startup to eliminate conflict",
      "Because the storage engine automatically aborts all active reading transactions prior to disk write",
      "Because write locks are converted into shared read locks immediately after each write statement"
    ],
    correctAnswer: "Because concurrent transactions are prevented from reading uncommitted dirty data that could later be rolled back"
  };

  const case1bTarget = {
    concept: "Strict Two-Phase Locking",
    subtopic: "Cascading Abort Prevention",
    targetDifficulty: "Hard",
    intendedCognitiveOperation: "DIAGNOSE"
  };

  const case1bEvidence = {
    unifiedRawContent: "In Strict Two-Phase Locking (Strict 2PL), a transaction holds all its exclusive write locks until the transaction completes (commits or aborts). This guarantees that no other transaction can read uncommitted dirty data, completely preventing cascading aborts.",
    sessionId: "sess_benchmark_case1b"
  };

  const case1bResult = await agent3.evaluateQuestion(case1bMCQ, case1bTarget, case1bEvidence, { skipLLM: true });

  const case1bBenchmarkPass = case1bResult.status === 'PASS' && 
                             case1bResult.cognitiveAudit?.isCalibrated === true &&
                             case1bResult.failureReasons.length === 0;

  console.log(`  Evaluated Demand     : ${case1bResult.cognitiveAudit?.evaluatedCognitiveDemand}`);
  console.log(`  Classification Reason: ${case1bResult.cognitiveAudit?.classificationReasoning}`);
  console.log(`  Verification Method  : ${case1bResult.verificationMethod}`);
  console.log(`  Final Status         : ${case1bResult.status} (score: ${case1bResult.score})`);
  console.log(`  Failure Reasons      : ${JSON.stringify(case1bResult.failureReasons)}`);
  console.log(`  Benchmark Criteria   : Expected PASS as Hard Mechanism Reasoning`);
  console.log(`  Current Production   : ${case1bBenchmarkPass ? 'PASSED (Genuine Mechanism Reasoning Correctly Preserved)' : 'FAILED / COLLATERAL DAMAGE'}\n`);

  benchmarkReport.push({
    caseNum: '1b',
    title: 'Genuine Causal-Mechanism Reasoning (Strict 2PL)',
    expected: 'PASS / Calibrated as Hard Mechanism Reasoning',
    actualDemand: case1bResult.cognitiveAudit?.evaluatedCognitiveDemand,
    actualVerdict: case1bResult.status,
    verificationMethod: case1bResult.verificationMethod,
    benchmarkStatus: case1bBenchmarkPass ? 'PASS' : 'FAIL',
    mechanismDiagnosis: case1bBenchmarkPass ? 'Legitimate causal-operational relationship properly recognized' : 'Collateral damage: valid mechanism reasoning rejected'
  });

  // ===========================================================================
  // Case 2: Genuine Operational Deduction (Min-Heap State Trace)
  // ===========================================================================
  console.log('--- [Case 2] Genuine Operational Deduction (State Trace) ---');
  const case2MCQ = {
    questionText: "A min-heap is represented as the 1-based array [4, 7, 9, 12, 15, 18, 20]. Trace the execution after extracting the minimum element (4) and restoring the min-heap invariant via sift-down: what is the terminal value stored in index 2?",
    options: [
      "12",
      "20",
      "7",
      "15"
    ],
    correctAnswer: "12"
  };

  const case2Target = {
    concept: "Min-Heap Deletion",
    subtopic: "Sift-Down State Transitions",
    targetDifficulty: "Hard",
    intendedCognitiveOperation: "DIAGNOSE"
  };

  const case2Evidence = {
    unifiedRawContent: "In a binary min-heap stored in a 1-based array, extracting the root replaces it with the last array element, decreases heap size by one, and sifts down the new root by repeatedly swapping with the smaller child until min-heap property holds. For index i, left child is 2i and right child is 2i+1.",
    sessionId: "sess_benchmark_case2"
  };

  const case2Result = await agent3.evaluateQuestion(case2MCQ, case2Target, case2Evidence, { skipLLM: true });

  const case2BenchmarkPass = case2Result.status === 'PASS' && 
                             case2Result.cognitiveAudit?.isCalibrated === true &&
                             (case2Result.cognitiveAudit?.evaluatedCognitiveDemand === 'TRACE' || case2Result.cognitiveAudit?.evaluatedCognitiveDemand === 'DIAGNOSE');

  console.log(`  Evaluated Demand     : ${case2Result.cognitiveAudit?.evaluatedCognitiveDemand}`);
  console.log(`  Classification Reason: ${case2Result.cognitiveAudit?.classificationReasoning}`);
  console.log(`  Verification Method  : ${case2Result.verificationMethod}`);
  console.log(`  Final Status         : ${case2Result.status} (score: ${case2Result.score})`);
  console.log(`  Failure Reasons      : ${JSON.stringify(case2Result.failureReasons)}`);
  console.log(`  Benchmark Criteria   : Expected PASS as Hard (TRACE / DIAGNOSE)`);
  console.log(`  Current Production   : ${case2BenchmarkPass ? 'PASSED (Legitimate Hard Question Successfully Preserved)' : 'FAILED / COLLATERAL DAMAGE'}\n`);

  benchmarkReport.push({
    caseNum: '2',
    title: 'Genuine Operational Deduction (Min-Heap State Trace)',
    expected: 'PASS / Calibrated as Hard (TRACE/DIAGNOSE)',
    actualDemand: case2Result.cognitiveAudit?.evaluatedCognitiveDemand,
    actualVerdict: case2Result.status,
    verificationMethod: case2Result.verificationMethod,
    benchmarkStatus: case2BenchmarkPass ? 'PASS' : 'FAIL',
    mechanismDiagnosis: case2BenchmarkPass ? 'Positive control: concrete multi-step state trace correctly recognized' : 'Collateral damage: legitimate Hard question rejected'
  });

  // ===========================================================================
  // Case 3: Adversarial Critic Override Contract Assertion
  // ===========================================================================
  console.log('--- [Case 3] Adversarial Critic Override Contract Assertion ---');
  const case3MCQ = {
    questionText: "What is the edge-based definition of binary tree height?",
    options: [
      "The count of edges on the longest path from root to deepest leaf",
      "The total number of nodes in the binary tree",
      "The number of levels starting from one",
      "The maximum degree of any internal node"
    ],
    correctAnswer: "The count of edges on the longest path from root to deepest leaf"
  };

  const case3Target = {
    concept: "Binary Tree Height Definition",
    subtopic: "Tree Terminology",
    targetDifficulty: "Hard",
    intendedCognitiveOperation: "DIAGNOSE"
  };

  const case3Evidence = {
    unifiedRawContent: "Tree height can be defined as the number of edges on the longest downward path from the root to a leaf node.",
    sessionId: "sess_benchmark_case3"
  };

  // Inspect deterministic pre-audit first to verify it fails deterministically
  const preAuditCase3 = agent3._runDeterministicAudit(case3MCQ, case3Target, case3Evidence.unifiedRawContent, '', case3Evidence);
  console.log(`  Deterministic Pre-Audit : Passed = ${preAuditCase3.passed}, Demand = ${preAuditCase3.cognitiveAudit?.evaluatedCognitiveDemand}, Failures = ${JSON.stringify(preAuditCase3.failureReasons)}`);

  // Stub llmRouter.complete to simulate an adversarial LLM Critic returning PASS
  const originalComplete = llmRouter.complete;
  llmRouter.complete = async (params) => {
    return JSON.stringify({
      status: "PASS",
      verdict: "PASS",
      score: 0.95,
      failureReasons: [],
      failureReason: null,
      repairInstruction: null,
      optionAnalysis: [
        { slot: "A", text: case3MCQ.options[0], isKey: true, verdict: "VALID_KEY", distractorPlausibility: "N/A" },
        { slot: "B", text: case3MCQ.options[1], isKey: false, verdict: "PLAUSIBLE_DISTRACTOR", distractorPlausibility: "HIGH" },
        { slot: "C", text: case3MCQ.options[2], isKey: false, verdict: "PLAUSIBLE_DISTRACTOR", distractorPlausibility: "HIGH" },
        { slot: "D", text: case3MCQ.options[3], isKey: false, verdict: "PLAUSIBLE_DISTRACTOR", distractorPlausibility: "HIGH" }
      ],
      cognitiveAudit: {
        requestedDifficulty: "Hard",
        intendedCognitiveOperation: "DIAGNOSE",
        evaluatedCognitiveDemand: "DIAGNOSE",
        isCalibrated: true,
        mismatchDetails: null
      },
      evidenceGrounding: {
        tier: "DIRECT_EVIDENCE",
        groundingScore: 0.95,
        foreignDomainDetected: false
      }
    });
  };

  let case3Result;
  try {
    case3Result = await agent3.evaluateQuestion(case3MCQ, case3Target, case3Evidence, {});
  } finally {
    llmRouter.complete = originalComplete; // Restore router
  }

  // Contract: Final verdict assembly MUST retain deterministic TIER_COGNITIVE_MISMATCH failure.
  // The LLM Critic must NOT be able to overturn a deterministic calibration failure.
  const case3RetainedFailure = case3Result.status === 'FAIL' && 
                               Array.isArray(case3Result.failureReasons) &&
                               case3Result.failureReasons.includes('TIER_COGNITIVE_MISMATCH');
  const case3BenchmarkPass = case3RetainedFailure;

  console.log(`  LLM Critic Returned   : status = PASS, isCalibrated = true`);
  console.log(`  Final Evaluator Verdict : ${case3Result.status} (score: ${case3Result.score})`);
  console.log(`  Final Failure Reasons   : ${JSON.stringify(case3Result.failureReasons)}`);
  console.log(`  Contract Requirement   : FAIL with TIER_COGNITIVE_MISMATCH preserved`);
  console.log(`  Current Production      : ${case3BenchmarkPass ? 'PASSED (Contract Preserved)' : 'FAILED (Contract Violated: Route B Critic Override Active)'}\n`);

  benchmarkReport.push({
    caseNum: '3',
    title: 'Adversarial Critic Override Contract Assertion',
    expected: 'FAIL with TIER_COGNITIVE_MISMATCH preserved',
    actualDemand: case3Result.cognitiveAudit?.evaluatedCognitiveDemand,
    actualVerdict: case3Result.status,
    verificationMethod: case3Result.verificationMethod,
    benchmarkStatus: case3BenchmarkPass ? 'PASS' : 'FAIL',
    mechanismDiagnosis: 'Route B: Pre-audit correctly flagged RECALL, but verdict assembly lacked hard gate and accepted LLM Critic PASS'
  });

  // ===========================================================================
  // Boundary Matrix: 5 Archetypes Tested Against Requested Hard Tier
  // ===========================================================================
  console.log('========================================================================');
  console.log('📐 BOUNDARY MATRIX: Evaluating Cognitive Demands Against Requested Hard');
  console.log('========================================================================\n');

  const boundaryItems = [
    {
      archetype: 'Pure Terminology / Complexity Recall',
      mcq: {
        questionText: "What is the average lookup time complexity of a balanced Binary Search Tree?",
        options: ["O(log n)", "O(n)", "O(1)", "O(n log n)"],
        correctAnswer: "O(log n)"
      },
      target: { concept: "BST Complexity", targetDifficulty: "Hard", intendedCognitiveOperation: "DIAGNOSE" },
      evidence: { unifiedRawContent: "A balanced BST provides O(log n) average lookup time.", sessionId: "sess_mat_1" },
      expectedVerdict: 'FAIL',
      expectedDemand: 'RECALL'
    },
    {
      archetype: 'Definition in Cosplay ("Why" + "Because")',
      mcq: case1aMCQ,
      target: case1aTarget,
      evidence: case1aEvidence,
      expectedVerdict: 'FAIL',
      expectedDemand: 'RECALL'
    },
    {
      archetype: 'Genuine Causal Operational Mechanism',
      mcq: case1bMCQ,
      target: case1bTarget,
      evidence: case1bEvidence,
      expectedVerdict: 'PASS',
      expectedDemand: 'EXPLAIN_MECHANISM'
    },
    {
      archetype: 'Genuine Multi-Step State Trace',
      mcq: case2MCQ,
      target: case2Target,
      evidence: case2Evidence,
      expectedVerdict: 'PASS',
      expectedDemand: 'TRACE'
    },
    {
      archetype: 'Genuine Fault / Deadlock Diagnosis',
      mcq: {
        questionText: "In a database transaction schedule where T1 holds an exclusive lock on resource A and requests resource B, while T2 holds an exclusive lock on resource B and requests resource A, what specific concurrency failure is diagnosed?",
        options: [
          "A circular wait deadlock cycle between T1 and T2",
          "A cascading abort triggered by uncommitted dirty reads",
          "A livelock caused by continuous transaction priority preemption",
          "A starvation condition where lower priority transactions are delayed"
        ],
        correctAnswer: "A circular wait deadlock cycle between T1 and T2"
      },
      target: { concept: "Concurrency Deadlocks", subtopic: "Circular Wait Diagnosis", targetDifficulty: "Hard", intendedCognitiveOperation: "DIAGNOSE" },
      evidence: { unifiedRawContent: "Deadlock occurs when there is a circular wait dependency graph where T1 holds lock on A and waits for B, while T2 holds lock on B and waits for A.", sessionId: "sess_mat_5" },
      expectedVerdict: 'PASS',
      expectedDemand: 'DIAGNOSE'
    }
  ];

  const matrixReport = [];
  for (const item of boundaryItems) {
    const res = await agent3.evaluateQuestion(item.mcq, item.target, item.evidence, { skipLLM: true });
    const isPassing = res.status === 'PASS';
    const matchesExpected = isPassing === (item.expectedVerdict === 'PASS');

    console.log(`  [${item.archetype}]`);
    console.log(`    Evaluated Demand : ${res.cognitiveAudit?.evaluatedCognitiveDemand}`);
    console.log(`    Calibration      : ${res.cognitiveAudit?.isCalibrated ? 'Calibrated' : 'Uncalibrated'}`);
    console.log(`    Verdict          : ${res.status} (Expected: ${item.expectedVerdict}) -> ${matchesExpected ? 'ALIGNED ✅' : 'MISALIGNED ❌'}\n`);

    matrixReport.push({
      archetype: item.archetype,
      evaluatedDemand: res.cognitiveAudit?.evaluatedCognitiveDemand,
      calibrated: res.cognitiveAudit?.isCalibrated,
      expectedVerdict: item.expectedVerdict,
      actualVerdict: res.status,
      aligned: matchesExpected
    });
  }

  // ===========================================================================
  // Final Consolidated Output Table
  // ===========================================================================
  console.log('========================================================================');
  console.log('📊 CONSOLIDATED BENCHMARK SUMMARY (CURRENT UNPATCHED PRODUCTION BASELINE)');
  console.log('========================================================================');
  console.table(benchmarkReport.map(r => ({
    'Case': `Case ${r.caseNum}`,
    'Scenario': r.title,
    'Expected': r.expected,
    'Actual Verdict': r.actualVerdict,
    'Benchmark Result': r.benchmarkStatus
  })));

  console.log('\n========================================================================');
  console.log('📐 BOUNDARY MATRIX SUMMARY');
  console.log('========================================================================');
  console.table(matrixReport.map(m => ({
    'Archetype': m.archetype,
    'Evaluated Demand': m.evaluatedDemand,
    'Calibrated?': m.calibrated ? 'YES' : 'NO',
    'Expected': m.expectedVerdict,
    'Actual': m.actualVerdict,
    'Alignment': m.aligned ? 'ALIGNED' : 'MISALIGNED (DEFECT)'
  })));

  return { benchmarkReport, matrixReport };
}

if (require.main === module) {
  runCalibrationRoutesBenchmark().catch(err => {
    console.error('Benchmark suite error:', err);
    process.exit(1);
  });
}

module.exports = { runCalibrationRoutesBenchmark };
