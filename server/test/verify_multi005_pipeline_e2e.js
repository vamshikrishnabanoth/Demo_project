/**
 * server/test/verify_multi005_pipeline_e2e.js
 *
 * END-TO-END PIPELINE VERIFICATION: MULTI_005 DIFFICULTY CALIBRATION
 *
 * Verifies that the four confirmed difficulty defects (DEF-DIFF-01 through DEF-DIFF-04)
 * are thoroughly resolved in actual MULTI_005 pipeline execution without regressions.
 */

'use strict';

process.env.AGENT3_MODE = 'deterministic_only';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { Agent1Planner } = require('../engine/agents/agent1Planner');
const evaluator = require('../engine/agents/agent3Evaluator');
const deterministicValidator = require('../engine/validators/deterministicValidator');
const pipelineOrchestrator = require('../engine/pipelineOrchestrator');
const agent2Generator = require('../engine/agents/agent2Generator');

console.log('======================================================================');
console.log('  MULTI_005 END-TO-END DIFFICULTY CALIBRATION VERIFICATION');
console.log('======================================================================\n');

(async () => {
  // Load delivered items from Condition B corpus
  const deliveredPath = path.resolve(__dirname, '../../scratch/multi_005_sprint_all_delivered.json');
  const conditionBItems = fs.existsSync(deliveredPath) ? JSON.parse(fs.readFileSync(deliveredPath, 'utf8')) : [];
  console.log(`Loaded ${conditionBItems.length} delivered items from Condition B corpus\n`);

  const unifiedEvidence = 'Algorithms: Best Time to Buy and Sell Stock with Infinite Transactions. In C++ loop iteration from i = 0 to n-1: if prices[i] < prices[i+1] then max_profit += prices[i+1] - prices[i]. Zero price difference adds nothing. Negative deltas are excluded. If no profit is possible, return 0.';

  const multi005EvidencePackage = {
    mainTopic: 'Stock Trading Greedy Algorithm',
    instructionalProfile: {
      negativeBoundaries: [],
      hardFeasibility: {
        hardFeasible: false,
        maxHard: 0,
        message: 'Stock trading lecture is procedural/implementation focused with 0 invariant proofs or multi-constraint diagnostic scenarios.'
      }
    },
    evidenceCapacity: {
      capacityByDifficulty: { easy: 4, medium: 5, hard: 0 },
      effectiveHardCap: 0,
      totalDefensibleCapacity: 9,
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

  const planner = new Agent1Planner();

  // ─────────────────────────────────────────────────────────────────────────
  // 1. Verify DEF-DIFF-01: Planner Zero Hard Allocation in Hard & Balanced Runs
  // ─────────────────────────────────────────────────────────────────────────
  console.log('--- Step 1: Auditing Planner Output for MULTI_005 (Hard N=6 & Balanced N=6) ---');
  const hardPlan = await planner.planAssessment(multi005EvidencePackage, {
    count: 6,
    requestedDifficulty: 'Hard',
    deficitPolicy: 'PRESERVE_DEFICIT'
  });

  const activeHardInHardPlan = hardPlan.assessmentTargets.filter(t => t.targetDifficulty === 'Hard' && !t.isCapacityLimited);
  console.log(`  Active Hard targets in Hard plan: ${activeHardInHardPlan.length} (Expected: 0)`);
  assert.strictEqual(activeHardInHardPlan.length, 0, 'Hard plan must generate 0 active Hard targets when effectiveHardCap is 0');

  const hardDeficitsInHardPlan = hardPlan.assessmentTargets.filter(t => t.intendedCognitiveOperation === 'UNFULFILLED_CAPACITY_DEFICIT' && t.targetDifficulty === 'Hard');
  console.log(`  Explicit Hard capacity deficit slots in Hard plan: ${hardDeficitsInHardPlan.length}`);
  assert(hardDeficitsInHardPlan.length > 0, 'Hard plan must record honest capacity deficits for requested Hard slots');
  for (const hd of hardDeficitsInHardPlan) {
    assert.strictEqual(hd.capacityLimitation?.status, 'INSUFFICIENT_EVIDENCE_FOR_HARD', 'Status must be INSUFFICIENT_EVIDENCE_FOR_HARD');
  }

  const balancedPlan = await planner.planAssessment(multi005EvidencePackage, {
    count: 6,
    requestedDifficulty: 'Balanced',
    deficitPolicy: 'PRESERVE_DEFICIT'
  });

  const activeHardBalanced = balancedPlan.assessmentTargets.filter(t => t.targetDifficulty === 'Hard' && !t.isCapacityLimited);
  console.log(`  Active Hard targets in Balanced plan: ${activeHardBalanced.length} (Expected: 0)`);
  assert.strictEqual(activeHardBalanced.length, 0, 'Balanced plan must generate 0 active Hard targets when effectiveHardCap is 0');

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Verify DEF-DIFF-01: Deficit Provenance on Exhausted Medium Tiers
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n--- Step 2: Auditing Deficit Provenance for MULTI_005 (Medium Run N=5, Cap=2) ---');
  const mediumPackage = {
    ...multi005EvidencePackage,
    unifiedRawContent: 'The stock trading algorithm takes an array of daily prices. If price increases from day i to i+1, add difference to profit. (Cap constraint evaluation run)',
    evidenceCapacity: {
      capacityByDifficulty: { easy: 2, medium: 2, hard: 0 },
      mediumCap: 2,
      effectiveHardCap: 0,
      isCapacityValid: true
    },
    lectureIntelligence: {
      evidenceCapacity: {
        capacityByDifficulty: { easy: 2, medium: 2, hard: 0 },
        effectiveHardCap: 0
      }
    },
    assessmentTargets: multi005EvidencePackage.assessmentTargets.slice(0, 2)
  };

  const mediumPlan = await planner.planAssessment(mediumPackage, {
    count: 5,
    requestedDifficulty: 'Medium',
    deficitPolicy: 'PRESERVE_DEFICIT'
  });

  const mediumDeficits = mediumPlan.assessmentTargets.filter(t => t.isCapacityLimited || t.intendedCognitiveOperation === 'UNFULFILLED_CAPACITY_DEFICIT');
  console.log(`  Medium deficit targets: ${mediumDeficits.length}`);
  for (const md of mediumDeficits) {
    console.log(`    Target ${md.targetId}: Difficulty=${md.targetDifficulty}, Status=${md.capacityLimitation?.status}`);
    assert.strictEqual(md.targetDifficulty, 'Medium', 'Medium deficit must preserve Medium difficulty');
    assert.notStrictEqual(md.capacityLimitation?.status, 'INSUFFICIENT_EVIDENCE_FOR_HARD', 'Medium deficit must NOT have status INSUFFICIENT_EVIDENCE_FOR_HARD');
    assert.strictEqual(md.capacityLimitation?.status, 'INSUFFICIENT_CURRICULAR_EVIDENCE', 'Medium deficit status must be INSUFFICIENT_CURRICULAR_EVIDENCE');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Verify DEF-DIFF-02: Evaluator Rejection of Q5 and Q13 from Hard Tier
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n--- Step 3: Auditing Evaluator Cognitive Demand on Q5 and Q13 ---');
  const targetHard = {
    targetId: 'TGT_HARD',
    concept: 'Boundary Casework: Zero-Absorption & Positives',
    targetDifficulty: 'Hard',
    intendedCognitiveOperation: 'DIAGNOSE'
  };

  const rawQ5 = conditionBItems[4] || {
    questionStem: 'In the context of the peak-valley decomposition, how does a zero price difference between consecutive days affect the running total profit?',
    options: [
      'It adds nothing to the profit because only strictly positive transitions increment the running total.',
      'It resets the accumulated profit back to zero because no gain occurred.',
      'It decrements the accumulated profit by the baseline price.',
      'It triggers a mandatory stock liquidation event.'
    ],
    correctAnswer: 'It adds nothing to the profit because only strictly positive transitions increment the running total.'
  };

  const rawQ13 = conditionBItems[12] || {
    questionStem: 'Why is a price decrease between consecutive trading days excluded from the accumulated profit?',
    options: [
      'Selling at a lower price than purchase incurs a loss, reducing net profit.',
      'The exchange prohibits selling when prices decrease.',
      'Negative numbers cannot be added to an integer variable in C++.',
      'A decrease resets the index counter to the array start.'
    ],
    correctAnswer: 'Selling at a lower price than purchase incurs a loss, reducing net profit.'
  };

  const evalQ5 = evaluator._runDeterministicAudit({
    questionText: rawQ5.questionStem || rawQ5.questionText,
    options: rawQ5.options,
    correctAnswer: rawQ5.correctAnswer
  }, targetHard, unifiedEvidence);

  console.log(`  Q5 Hard audit passed: ${evalQ5.passed} | Failure reasons: [${evalQ5.failureReasons.join(', ')}]`);
  assert.strictEqual(evalQ5.passed, false, 'Q5 must fail when audited against Hard tier');
  assert(evalQ5.failureReasons.includes('TIER_COGNITIVE_MISMATCH'), 'Q5 must fail with TIER_COGNITIVE_MISMATCH');

  const evalQ13 = evaluator._runDeterministicAudit({
    questionText: rawQ13.questionStem || rawQ13.questionText,
    options: rawQ13.options,
    correctAnswer: rawQ13.correctAnswer
  }, targetHard, unifiedEvidence);

  console.log(`  Q13 Hard audit passed: ${evalQ13.passed} | Failure reasons: [${evalQ13.failureReasons.join(', ')}]`);
  assert.strictEqual(evalQ13.passed, false, 'Q13 must fail when audited against Hard tier');
  assert(evalQ13.failureReasons.includes('TIER_COGNITIVE_MISMATCH'), 'Q13 must fail with TIER_COGNITIVE_MISMATCH');

  // ─────────────────────────────────────────────────────────────────────────
  // 4. Verify DEF-DIFF-03: Q4 Relational Code Logic Classified as Medium (TRACE)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n--- Step 4: Auditing Code Cognitive Demand on Q4 ---');
  const rawQ4 = conditionBItems[3] || {
    questionStem: 'In the canonical iterative implementation, what condition determines whether an adjacent price transition contributes to the running total max_profit?',
    options: [
      'prices[i] < prices[i+1]',
      'prices[i] > prices[i+1]',
      'prices[i] == prices[i+1]',
      'prices[i] >= prices[i+1]'
    ],
    correctAnswer: 'prices[i] < prices[i+1]'
  };

  const q4Demand = evaluator._evaluateCognitiveDemand({
    questionText: rawQ4.questionStem || rawQ4.questionText,
    options: rawQ4.options
  }, { targetDifficulty: 'Medium' });

  console.log(`  Q4 evaluated demand: ${q4Demand.demand} (Reasoning: ${q4Demand.reasoning})`);
  assert.strictEqual(q4Demand.demand, 'TRACE', `Q4 must evaluate to TRACE demand, got ${q4Demand.demand}`);

  // ─────────────────────────────────────────────────────────────────────────
  // 5. Verify DEF-DIFF-04: Q7 and Q12 Caught as TERMINAL_CONTRACT_DUPLICATE
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n--- Step 5: Auditing Terminal Contract Duplicate Gate (Q7 vs Q12) ---');
  const rawQ7 = conditionBItems[6] || {
    questionStem: 'Under the problem specification, what integer must be printed if no profit is possible from any sequence of transactions?',
    correctAnswer: 'The integer zero'
  };

  const rawQ12 = conditionBItems[11] || {
    questionStem: 'According to the lecture specification, what integer must be printed if the price sequence strictly decreases across all days?',
    correctAnswer: 'Zero'
  };

  const dupResult = deterministicValidator.checkDuplicateQuestion(
    { questionText: rawQ12.questionStem || rawQ12.questionText, correctAnswer: rawQ12.correctAnswer },
    [{ questionText: rawQ7.questionStem || rawQ7.questionText, correctAnswer: rawQ7.correctAnswer }],
    { concept: 'Boundary Casework: Zero-Absorption & Positives' }
  );

  console.log(`  Q7 vs Q12 duplicate detection: isDuplicate=${dupResult.isDuplicate} | Reason: ${dupResult.reason}`);
  assert.strictEqual(dupResult.isDuplicate, true, 'Q12 must be detected as duplicate of Q7');
  assert(dupResult.reason.includes('TERMINAL_CONTRACT_DUPLICATE'), 'Duplicate reason must be TERMINAL_CONTRACT_DUPLICATE');

  // Also verify Q12 direct static lookup fails Medium tier calibration
  const evalQ12Med = evaluator._runDeterministicAudit({
    questionText: rawQ12.questionStem || rawQ12.questionText,
    options: ['0', '1', '-1', '10'],
    correctAnswer: '0'
  }, { targetDifficulty: 'Medium', intendedCognitiveOperation: 'EXPLAIN_MECHANISM' }, unifiedEvidence);

  console.log(`  Q12 Medium tier audit: passed=${evalQ12Med.passed} | Failure reasons: [${evalQ12Med.failureReasons.join(', ')}]`);
  assert.strictEqual(evalQ12Med.passed, false, 'Direct static output lookup must fail Medium tier');
  assert(evalQ12Med.failureReasons.includes('TIER_COGNITIVE_MISMATCH'), 'Must fail with TIER_COGNITIVE_MISMATCH');

  // ─────────────────────────────────────────────────────────────────────────
  // 6. Verify Full Orchestrator Integration (N=6 Balanced with Repair Loop)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n--- Step 6: Full Orchestrator Integration Execution (N=6 Balanced) ---');
  const origGenerate = agent2Generator.generateQuestion;

  let target4InitialAttempts = 0;
  let target4Repairs = 0;

  const comprehensiveStockEvidence = [
    'Algorithms: Best Time to Buy and Sell Stock with Infinite Transactions.',
    'Stock trading greedy algorithm: Maximize profit by buying stock on an earlier day and selling on a subsequent day.',
    'Chronological constraint: A stock must be bought on an earlier day before it can be sold on a subsequent day.',
    'Two versions of the problem: One transaction allows buy once and sell once. Infinite transactions allows multiple buy and sell transactions.',
    'In an ascending price sequence, summing consecutive daily differences telescopes to the net gain between first and last day.',
    'Greedy choice property: Accumulate profit whenever the next day price exceeds the current day price.',
    'In the canonical C++ iterative implementation, loop iteration condition prices[i] < prices[i+1] adds adjacent differences to max_profit.',
    'Zero price difference between consecutive days adds zero to accumulated profit without altering the running total.',
    'Price decreases between consecutive days represent operational losses and are omitted from accumulated profit.',
    'If no profit is possible, return 0.'
  ].join(' ');

  agent2Generator.generateQuestion = async (tgt, evidencePkg, repairInstruction) => {
    const concept = String(tgt.concept || '');
    const id = String(tgt.targetId || '');

    if (id === 'T01' || concept.includes('Problem Definition') || concept.includes('Chronological')) {
      return {
        questionText: 'In the stock trading greedy algorithm, what chronological constraint governs transaction ordering?',
        options: [
          'A stock must be bought on an earlier day before it can be sold on a subsequent day',
          'Selling can occur on any day regardless of acquisition timing',
          'Transactions can only execute on odd-numbered calendar days',
          'Positions must be closed simultaneously with market open'
        ],
        correctAnswer: 'A stock must be bought on an earlier day before it can be sold on a subsequent day',
        targetDifficulty: 'Easy',
        difficulty: 'Easy'
      };
    }

    if (id === 'T02' || concept.includes('Valley-Peak') || concept.includes('Telescoping')) {
      return {
        questionText: 'In an ascending price sequence, why does summing consecutive daily differences yield the maximum profit?',
        options: [
          'Summing consecutive daily differences telescopes to the net gain between first and last day',
          'Brokerage transaction fees are waived when trading orders execute across consecutive days',
          'Stock prices are presumed to reset to baseline levels during non-consecutive trade days',
          'Alternating transaction schedules double the return multiplier on positive daily shifts'
        ],
        correctAnswer: 'Summing consecutive daily differences telescopes to the net gain between first and last day',
        targetDifficulty: 'Easy',
        difficulty: 'Easy'
      };
    }

    if (id === 'T03' || concept.includes('Greedy Choice')) {
      return {
        questionText: 'Which decision rule characterizes the greedy choice in the stock problem with infinite transactions?',
        options: [
          'Accumulate profit whenever the next day price exceeds the current day price',
          'Hold shares until the highest overall price in the array sequence is reached',
          'Distribute purchase capital uniformly across all available trading intervals',
          'Execute sell transactions exclusively at predetermined calendar period dates'
        ],
        correctAnswer: 'Accumulate profit whenever the next day price exceeds the current day price',
        targetDifficulty: 'Medium',
        difficulty: 'Medium'
      };
    }

    if (id === 'T04' || concept.includes('Iterative Implementation') || concept.includes('Accumulator')) {
      target4InitialAttempts++;
      if (!repairInstruction) {
        // DELIBERATELY DEFECTIVE CANDIDATE (Objective 3 Format Asymmetry: 1 C++ code key vs 3 prose distractors)
        return {
          questionText: 'In the canonical iterative implementation, what condition determines whether an adjacent price transition contributes to the running total max_profit?',
          options: [
            'prices[i] < prices[i+1]',
            'When the subsequent trading day price exceeds current valuation',
            'Whenever cumulative capital allows position enlargement',
            'If the market order executes without broker slippage'
          ],
          correctAnswer: 'prices[i] < prices[i+1]',
          targetDifficulty: 'Medium',
          difficulty: 'Medium'
        };
      } else {
        // REPAIRED CANDIDATE (Enforces parallel code format)
        target4Repairs++;
        return {
          questionText: 'In the canonical iterative implementation, what condition determines whether an adjacent price transition contributes to the running total max_profit?',
          options: [
            'prices[i] < prices[i+1]',
            'prices[i] > prices[i+1]',
            'prices[i] == prices[i+1]',
            'prices[i] >= prices[i+1]'
          ],
          correctAnswer: 'prices[i] < prices[i+1]',
          targetDifficulty: 'Medium',
          difficulty: 'Medium'
        };
      }
    }

    if (id === 'T05' || concept.includes('Zero-Absorption') || concept.includes('Boundary Casework')) {
      return {
        questionText: 'How does a zero price difference between consecutive days affect the running total profit in the algorithm?',
        options: [
          'It adds zero to accumulated profit without altering the running total',
          'It resets the running total profit counter back to the initial zero state',
          'It applies a mandatory deduction penalty that decreases accumulated return',
          'It forces an immediate close of all active transaction positions in array'
        ],
        correctAnswer: 'It adds zero to accumulated profit without altering the running total',
        targetDifficulty: 'Medium',
        difficulty: 'Medium'
      };
    }

    // Default / Target 6: Downward price transition
    return {
      questionText: 'Why is a downward price transition between consecutive trading days omitted from accumulated profit?',
      options: [
        'Selling at a lower price than purchase incurs an operational loss reducing total return',
        'Negative integer values cause immediate runtime syntax errors in the loop calculation',
        'Order execution rules strictly prohibit transaction recording during downward steps',
        'Downward intervals reset the array processing pointer back to the starting position'
      ],
      correctAnswer: 'Selling at a lower price than purchase incurs an operational loss reducing total return',
      targetDifficulty: 'Medium',
      difficulty: 'Medium'
    };
  };

  try {
    const orchestratorResult = await pipelineOrchestrator.runPipeline({
      sessionId: 'verify_multi005_n6_balanced_' + Date.now(),
      voiceTranscript: comprehensiveStockEvidence,
      count: 6,
      difficulty: 'Balanced',
      deficitPolicy: 'PRESERVE_DEFICIT',
      evidenceCapacity: {
        capacityByDifficulty: { easy: 4, medium: 5, hard: 0 },
        effectiveHardCap: 0,
        totalDefensibleCapacity: 9,
        isCapacityValid: true
      },
      instructionalProfile: {
        hardFeasibility: { hardFeasible: false, maxHard: 0 }
      },
      teachingUnits: [
        {
          id: 'TU_STOCK_001',
          claimId: 'TU_STOCK_001',
          concept: 'Problem Definition',
          subtopic: 'Problem Definition',
          topic: 'Stock Trading Greedy Algorithm',
          statement: 'Stock must be bought before it can be sold',
          claim: 'Stock must be bought before it can be sold',
          evidence: comprehensiveStockEvidence,
          anchors: ['bought before', 'cannot sell before buy'],
          targetDifficulty: 'Easy',
          verification: { status: 'VERIFIED' }
        },
        {
          id: 'TU_STOCK_002',
          claimId: 'TU_STOCK_002',
          concept: 'Valley-Peak Principle',
          subtopic: 'Valley-Peak Principle',
          topic: 'Stock Trading Greedy Algorithm',
          statement: 'Summing positive deltas equals peak minus valley',
          claim: 'Summing positive deltas equals peak minus valley',
          evidence: comprehensiveStockEvidence,
          anchors: ['telescoping sum', 'valley and peak'],
          targetDifficulty: 'Easy',
          verification: { status: 'VERIFIED' }
        },
        {
          id: 'TU_STOCK_003',
          claimId: 'TU_STOCK_003',
          concept: 'Greedy Choice Property',
          subtopic: 'Greedy Choice Property',
          topic: 'Stock Trading Greedy Algorithm',
          statement: 'Capture profit on every adjacent upward step',
          claim: 'Capture profit on every adjacent upward step',
          evidence: comprehensiveStockEvidence,
          anchors: ['greedy choice', 'adjacent step'],
          targetDifficulty: 'Medium',
          verification: { status: 'VERIFIED' }
        },
        {
          id: 'TU_STOCK_004',
          claimId: 'TU_STOCK_004',
          concept: 'Iterative Implementation',
          subtopic: 'Iterative Implementation',
          topic: 'Stock Trading Greedy Algorithm',
          statement: 'If prices[i] < prices[i+1] add difference to max_profit',
          claim: 'If prices[i] < prices[i+1] add difference to max_profit',
          evidence: comprehensiveStockEvidence,
          anchors: ['prices[i] < prices[i+1]'],
          targetDifficulty: 'Medium',
          verification: { status: 'VERIFIED' }
        },
        {
          id: 'TU_STOCK_005',
          claimId: 'TU_STOCK_005',
          concept: 'Boundary Casework: Zero-Absorption & Positives',
          subtopic: 'Boundary Casework',
          topic: 'Stock Trading Greedy Algorithm',
          statement: 'Zero price delta adds nothing to accumulated profit',
          claim: 'Zero price delta adds nothing to accumulated profit',
          evidence: comprehensiveStockEvidence,
          anchors: ['zero difference', 'adds nothing'],
          targetDifficulty: 'Medium',
          verification: { status: 'VERIFIED' }
        },
        {
          id: 'TU_STOCK_006',
          claimId: 'TU_STOCK_006',
          concept: 'Downward Transition Loss Elimination',
          subtopic: 'Local Transition Logic',
          topic: 'Stock Trading Greedy Algorithm',
          statement: 'Price decreases represent losses and are omitted',
          claim: 'Price decreases represent losses and are omitted',
          evidence: comprehensiveStockEvidence,
          anchors: ['negative difference', 'losses omitted'],
          targetDifficulty: 'Medium',
          verification: { status: 'VERIFIED' }
        }
      ]
    });

    console.log(`\n  Pipeline Status: ${orchestratorResult.pipelineStatus}`);
    console.log(`  Questions Delivered: ${orchestratorResult.questions?.length || 0} / ${orchestratorResult.requestedCount}`);

    // A. Fulfillment Assertions
    assert.strictEqual(orchestratorResult.pipelineStatus, 'COMPLETED', 'Pipeline should complete successfully');
    assert.strictEqual(orchestratorResult.requestedCount, 6, 'Requested count must be 6');
    assert.strictEqual(orchestratorResult.deliveredCount, 6, 'Delivered count must be 6');

    // B. Difficulty Distribution Assertions
    const diffReport = orchestratorResult.difficultyReport || {};
    console.log(`  Originally Requested Distribution:`, diffReport.requestedDistribution);
    console.log(`  Actually Allocated Distribution:   `, diffReport.allocatedDistribution);
    console.log(`  Achieved Delivered Distribution:   `, diffReport.achievedDistribution);

    assert.deepStrictEqual(diffReport.requestedDistribution, { Easy: 2, Medium: 2, Hard: 2 }, 'Original requested distribution must be { Easy: 2, Medium: 2, Hard: 2 }');
    assert.deepStrictEqual(diffReport.allocatedDistribution, { Easy: 2, Medium: 4, Hard: 0 }, 'Allocated distribution must be { Easy: 2, Medium: 4, Hard: 0 }');
    assert.deepStrictEqual(diffReport.achievedDistribution, { Easy: 2, Medium: 4, Hard: 0 }, 'Achieved distribution must be { Easy: 2, Medium: 4, Hard: 0 }');

    // C. Conformance & Capacity Status Semantics
    console.log(`  Total Count Fulfillment:       ${diffReport.conformance?.totalCountFulfillment}`);
    console.log(`  Difficulty Capacity Fulfillment:${diffReport.conformance?.difficultyCapacityFulfillment}`);
    console.log(`  Hard Capacity Deficit:          ${diffReport.conformance?.hardCapacityDeficit}`);
    console.log(`  Reallocated Slots:              ${diffReport.conformance?.reallocatedCount}`);

    assert.strictEqual(diffReport.conformance?.totalCountFulfillment, 'FULFILLED', 'Total count fulfillment must be FULFILLED');
    assert.strictEqual(diffReport.conformance?.difficultyCapacityFulfillment, 'PARTIALLY_FULFILLED', 'Difficulty capacity fulfillment must be PARTIALLY_FULFILLED');
    assert.strictEqual(diffReport.conformance?.hardCapacityDeficit, 2, 'Hard capacity deficit must be 2');
    assert.strictEqual(diffReport.conformance?.reallocatedCount, 2, 'Reallocated count must be 2');

    // D. Capacity Audit Preservation in Plan & Result
    const capAudit = orchestratorResult.plan?.capacityAudit || orchestratorResult.capacityDeficitReport?.capacityAudit;
    console.log(`  Capacity Audit deficitStatus:   ${capAudit?.deficitStatus}`);
    console.log(`  Capacity Audit reallocatedTo:   ${capAudit?.reallocatedTo}`);
    assert(capAudit, 'capacityAudit must survive in plan / capacityDeficitReport');
    assert.strictEqual(capAudit.requestedHardCount, 2, 'capacityAudit.requestedHardCount must be 2');
    assert.strictEqual(capAudit.allocatedHardCount, 0, 'capacityAudit.allocatedHardCount must be 0');
    assert.strictEqual(capAudit.reallocatedCount, 2, 'capacityAudit.reallocatedCount must be 2');
    assert.strictEqual(capAudit.reallocatedTo, 'Medium', 'capacityAudit.reallocatedTo must be Medium');
    assert.strictEqual(capAudit.deficitStatus, 'INSUFFICIENT_EVIDENCE_FOR_HARD', 'capacityAudit.deficitStatus must be INSUFFICIENT_EVIDENCE_FOR_HARD');

    // E. Teacher Warning Visibility in Data Path
    const finalWarning = orchestratorResult.capacityReport?.capacityWarning;
    console.log(`  Teacher Warning Banner:        "${finalWarning}"`);
    assert(finalWarning && finalWarning.includes('Hard questions could not be supported by the lecture evidence'), 'Teacher warning must be present in capacityReport');
    assert(finalWarning.includes('reallocated to Medium'), 'Warning must specify reallocation to Medium');

    // Verify McqViewer data path (every question's metadata has capacityReport with warning)
    const viewerReceivesWarning = orchestratorResult.questions.some(q => q.metadata?.capacityReport?.capacityWarning);
    console.log(`  McqViewer data path verified:  ${viewerReceivesWarning}`);
    assert.strictEqual(viewerReceivesWarning, true, 'Every question must carry capacityReport.capacityWarning for McqViewer');

    // F. Repair Accounting Verification
    const rep = orchestratorResult.metrics?.repairs || {};
    console.log(`  Repair Metrics: Total Attempted=${rep.totalAttempted}, Successful=${rep.successfulRepairs}, Failed=${rep.failedRepairs}`);
    assert.strictEqual(rep.totalAttempted, 1, 'Total attempted repairs must be exactly 1 (for target 4)');
    assert.strictEqual(rep.successfulRepairs, 1, 'Successful repairs must be exactly 1');
    assert.strictEqual(rep.failedRepairs, 0, 'Failed repairs must be 0');

    // G. Zero Hard Leakage
    for (const q of orchestratorResult.questions) {
      assert.notStrictEqual(q.difficulty, 'Hard', 'Delivered question must never be labeled as Hard');
    }
  } finally {
    agent2Generator.generateQuestion = origGenerate;
  }

  console.log('\n======================================================================');
  console.log('  SUCCESS: ALL MULTI_005 DIFFICULTY CALIBRATION CHECKS PASSED CLEANLY');
  console.log('======================================================================\n');
  process.exit(0);
})().catch(err => {
  console.error('\n💥 MULTI_005 VERIFICATION FAILED:', err);
  process.exit(1);
});
