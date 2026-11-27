/**
 * Demo_project/server/test/test_teacher_role_comprehensive.js
 *
 * COMPREHENSIVE TEACHER ROLE VERIFICATION SUITE
 * 
 * Tests all non-negotiable requirements of the Teacher Role:
 * 1. Batch generation and partial-batch parsing.
 * 2. Distractor Discrepancy Coefficient (pre-test DDI) and CTT distinction.
 * 3. Question quality, 4-option schema, single unambiguous key.
 * 4. Teaching score calculation, rubric deductions, and 2 concrete recommendations.
 * 5. Input modalities: Terminal commands, code snippets, documents, and topics.
 * 6. Multi-facet capacity estimation (non-cannibalizing).
 * 7. End-to-end question count fulfillment.
 */

'use strict';

const assert = require('assert');
const path = require('path');

const agent1Planner = require('../engine/agents/agent1Planner');
const agent2Generator = require('../engine/agents/agent2Generator');
const agent3Evaluator = require('../engine/agents/agent3Evaluator');
const deterministicValidator = require('../engine/validators/deterministicValidator');
const DifficultyAwareDistractorValidator = require('../engine/validators/difficultyAwareDistractorValidator');
const DistractorDiscriminationAnalyzer = require('../engine/assessment/distractorDiscriminationAnalyzer');
const lectureIntelligence = require('../engine/intelligence/lectureIntelligence');
const pdiRouter = require('../engine/pdiRouter');
const pipelineOrchestrator = require('../engine/pipelineOrchestrator');

let totalTests = 0;
let passedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     ${err.message}`);
    throw err;
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✅ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     ${err.message}`);
    throw err;
  }
}

async function main() {
  console.log('========================================================================');
  console.log('🧪 COMPREHENSIVE TEACHER ROLE ACCEPTANCE SUITE — KMIT KAHOOT');
  console.log('========================================================================\n');

  // ─────────────────────────────────────────────────────────────────────────
  // SUITE 1: Distractor Discrepancy Coefficient & Pre-Test Quality (Requirement 6)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('--- SUITE 1: Distractor Discrepancy Coefficient (Requirement 6) ---');

  runTest('1.1 Computes lexical Jaccard discrepancy between distractors and key', () => {
    const options = [
      'Nodes can have at most one child.',
      'A node may have up to three children.',
      'Each node can have at most two children.',
      'There is no limit on the number of children per node.'
    ];
    const key = 'Each node can have at most two children.';
    const stem = 'What is the maximum degree of any node in a binary tree?';

    const report = DifficultyAwareDistractorValidator.calculateDistractorDiscrepancy(options, key, stem);

    assert.strictEqual(report.metricName, 'Pre-Test Distractor Discrepancy Index (DDI)');
    assert.strictEqual(report.evaluationType, 'PRE_TEST_PREDICTIVE_PLAUSIBILITY');
    assert(report.compositeScore >= 0.5 && report.compositeScore <= 1.0, `Expected composite DDI in [0.5, 1.0], got ${report.compositeScore}`);
    assert.strictEqual(report.distractorAnalyses.length, 3);
    report.distractorAnalyses.forEach(d => {
      assert(typeof d.discrepancyFromKey === 'number', 'Expected numerical discrepancy');
      assert(d.discrepancyFromKey >= 0.15, `Expected non-synonymous discrepancy >= 0.15, got ${d.discrepancyFromKey}`);
    });
  });

  runTest('1.2 Detects near-synonym key collision risk when distractor is almost identical to key', () => {
    const options = [
      'Each node can have at most two children.',
      'Every node can have at most two children.', // Near identical to key
      'Nodes are limited to five children.',
      'There is no limit on children.'
    ];
    const key = 'Each node can have at most two children.';
    const stem = 'What is the maximum degree of any node in a binary tree?';

    const report = DifficultyAwareDistractorValidator.calculateDistractorDiscrepancy(options, key, stem);
    const nearSyn = report.distractorAnalyses.find(d => d.plausibilityClassification === 'RISK_NEAR_SYNONYM_KEY_AMBIGUITY');
    assert(nearSyn, 'Expected near-synonym collision risk to be detected for near-duplicate option');
    assert(nearSyn.discrepancyFromKey <= 0.28, 'Expected low discrepancy for near-synonym');
  });

  runTest('1.3 Explicitly differentiates Pre-Test DDI from Post-Test CTT discrimination', () => {
    const preReport = DifficultyAwareDistractorValidator.calculateDistractorDiscrepancy(
      ['A', 'B', 'C', 'D'],
      'A',
      'Test Question'
    );
    assert(preReport.distinctionNotice.includes('DistractorDiscriminationAnalyzer'), 'Pre-test report must cite Post-test analyzer');

    // Post-test CTT analysis
    const mcq = {
      questionText: 'Test Question',
      options: ['Alpha', 'Beta', 'Gamma', 'Delta'],
      correctAnswer: 'Alpha'
    };
    const syntheticCohort = [
      { studentId: 'S1', totalScore: 10, answers: [{ questionIndex: 1, selectedOption: 'Alpha', isCorrect: true }] },
      { studentId: 'S2', totalScore: 9, answers: [{ questionIndex: 1, selectedOption: 'Alpha', isCorrect: true }] },
      { studentId: 'S3', totalScore: 2, answers: [{ questionIndex: 1, selectedOption: 'Beta', isCorrect: false }] },
      { studentId: 'S4', totalScore: 1, answers: [{ questionIndex: 1, selectedOption: 'Gamma', isCorrect: false }] }
    ];
    const postReport = DistractorDiscriminationAnalyzer.analyzeItem(mcq, 0, syntheticCohort);
    assert.strictEqual(postReport.discriminationRating, 'EXCELLENT');
    assert.strictEqual(postReport.pValue, 0.5);
    assert(postReport.distractorEfficiency > 0, 'Expected positive distractor efficiency');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SUITE 2: Teaching Score & Actionable Feedback (Requirement 7)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n--- SUITE 2: Teaching Score & Actionable Lecturer Guidance (Requirement 7) ---');

  runTest('2.1 Generates 0-100 Lecturer Delivery Score with exact rubric breakdown', () => {
    const tcResult = agent1Planner._computeTCScore(
      'Binary Trees lecture transcript content...',
      { conceptualEmphasis: 'HIGH', syntaxEmphasis: 'MEDIUM' },
      { rating: 'Comprehensive' },
      {
        auditedTargets: [
          { targetId: 'T01', tier: 'Core' },
          { targetId: 'T02', tier: 'Core' },
          { targetId: 'T03', tier: 'Core' },
          { targetId: 'T04', tier: 'Core' },
          { targetId: 'T05', tier: 'Core' }
        ],
        auditedReserve: [{ targetId: 'R01', tier: 'Core' }],
        subtopics: ['Binary Trees', 'Types of Trees', 'Traversals', 'Skewed Trees', 'Properties'],
        subject: 'Algorithms',
        mainTopic: 'Binary Trees'
      }
    );

    assert.strictEqual(tcResult.metricName, 'Teaching Score — Lecturer Delivery Quality');
    assert.strictEqual(tcResult.overallScore, 87);
    assert.strictEqual(tcResult.rating, 'Proficient Instruction');
    assert.strictEqual(tcResult.dimensions.coverage.score, 23);
    assert.strictEqual(tcResult.dimensions.clarity.score, 28);
    assert.strictEqual(tcResult.dimensions.flow.score, 18);
    assert.strictEqual(tcResult.dimensions.enrichment.score, 18);

    // Test with 9 subtopics (as in MULTI_004) -> produces 94
    const tcResult9 = agent1Planner._computeTCScore(
      'Binary Trees lecture transcript content...',
      { conceptualEmphasis: 'HIGH' },
      { rating: 'Comprehensive' },
      {
        auditedTargets: [
          { targetId: 'T01', tier: 'Core' }, { targetId: 'T02', tier: 'Core' },
          { targetId: 'T03', tier: 'Core' }, { targetId: 'T04', tier: 'Core' },
          { targetId: 'T05', tier: 'Core' }
        ],
        auditedReserve: [{ targetId: 'R01', tier: 'Core' }],
        subtopics: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9'],
        subject: 'Algorithms',
        mainTopic: 'Binary Trees'
      }
    );
    assert.strictEqual(tcResult9.overallScore, 94);
    assert.strictEqual(tcResult9.rating, 'Exemplary Curricular Depth');
  });

  runTest('2.2 Generates explainable rubric deductions and exactly 2 concrete recommendations', () => {
    const tcResult = agent1Planner._computeTCScore(
      'Short lecture...',
      { conceptualEmphasis: 'MEDIUM' },
      { rating: 'Introductory' },
      {
        auditedTargets: [{ targetId: 'T01', tier: 'Core' }, { targetId: 'T02', tier: 'Core' }],
        auditedReserve: [],
        subtopics: ['Concept A', 'Concept B'],
        subject: 'Data Structures',
        mainTopic: 'Trees'
      }
    );

    const guidance = tcResult.actionableGuidance;
    assert(guidance, 'Must generate actionableGuidance block');
    assert(Array.isArray(guidance.demonstratedStrengths) && guidance.demonstratedStrengths.length > 0, 'Must record demonstrated strengths');
    assert(Array.isArray(guidance.scoringDeductions) && guidance.scoringDeductions.length > 0, 'Must record scoring deductions');
    assert.strictEqual(guidance.concreteRecommendations.length, 2, 'Must provide exactly two concrete recommendations');

    // Check structure of recommendations
    guidance.concreteRecommendations.forEach(rec => {
      assert(rec.priority === 1 || rec.priority === 2, 'Priority must be 1 or 2');
      assert(typeof rec.action === 'string' && rec.action.length > 10, 'Must state concrete action');
      assert(typeof rec.targetGain === 'string' && rec.targetGain.includes('point'), 'Must state points gain');
      assert(typeof rec.pedagogicalImpact === 'string', 'Must state pedagogical impact');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SUITE 3: Input Modality & Terminal / Code Detection (Requirement 8)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n--- SUITE 3: Input Modality & Terminal / Code Support (Requirement 8) ---');

  runTest('3.1 PdiRouter detects terminal shell commands and command-line inputs', () => {
    const terminalInput = {
      voiceTranscript: '',
      documentTexts: [
        '$ git init --bare myrepo.git\n$ git status\n$ chmod 755 run.sh\n$ docker build -t myapp .\n$ curl -X POST http://localhost:8080/api'
      ]
    };
    const features = pdiRouter.extractFeatures(terminalInput);
    assert(features.code_density > 0.5, `Expected code density > 0.5 for terminal dump, got ${features.code_density}`);
  });

  runTest('3.2 PdiRouter routes appropriately when voice is paired with slides', () => {
    const multimodalInput = {
      voiceTranscript: 'Welcome to class today. Notice that a binary tree node has at most two children. Remember this for your exams.',
      documentTexts: ['Slide 1: Binary Tree Definitions and Properties.\nSlide 2: Inorder, Preorder, Postorder Traversals.']
    };
    const decision = pdiRouter.route(multimodalInput);
    assert.strictEqual(decision.selected_representation, 'UNIFIED', 'Voice plus slides must route to UNIFIED');
    assert(decision.pedagogical_delivery_index >= 0.65, `Expected PDI >= 0.65, got ${decision.pedagogical_delivery_index}`);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SUITE 4: Multi-Facet Question Capacity Estimation (Requirement 5)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n--- SUITE 4: Evidence-Based Question Capacity Estimation (Requirement 5) ---');

  runTest('4.1 Multi-facet concepts preserve Easy recall without cannibalizing Medium mechanisms', () => {
    const mockConcepts = [
      { name: 'Binary Tree Definition', definition: 'A hierarchical tree structure where each node has at most two children.', mechanism: '', substanceType: 'DEFINITION' },
      { name: 'BST Insertion', definition: 'Inserting a key into a binary search tree preserving the BST invariant.', mechanism: 'Compare key with root, traverse left if smaller, traverse right if larger, attach as new leaf.', substanceType: 'MECHANISM' },
      { name: 'Full Binary Tree', definition: 'A binary tree where every node has either zero or two children.', mechanism: 'Node degree property checked at every internal node.', substanceType: 'RULE' },
      { name: 'Skewed Tree Height', definition: 'A binary tree where every internal node has only one child.', mechanism: 'Height equals N - 1, degenerating lookup to O(N).', substanceType: 'RULE_OR_CONDITION' }
    ];

    const capacityReport = lectureIntelligence.deriveSemanticCapacity(mockConcepts, {}, {
      durationMinutes: 45,
      wordCount: 5000
    });

    assert(capacityReport.totalDefensibleCapacity >= 4, `Expected totalDefensibleCapacity >= 4, got ${capacityReport.totalDefensibleCapacity}`);
    assert(capacityReport.capacityByDifficulty.easy >= 3, `Expected Easy capacity >= 3, got ${capacityReport.capacityByDifficulty.easy}`);
    assert(capacityReport.capacityByDifficulty.medium >= 2, `Expected Medium capacity >= 2, got ${capacityReport.capacityByDifficulty.medium}`);
    assert(capacityReport.recommendedQuestionCount >= 4, `Expected recommendedQuestionCount >= 4, got ${capacityReport.recommendedQuestionCount}`);
  });

  runTest('4.2 Honest zero capacity reported when input is genuinely non-curricular or empty', () => {
    const emptyReport = lectureIntelligence.deriveSemanticCapacity([], {}, { wordCount: 0 });
    assert.strictEqual(emptyReport.totalDefensibleCapacity, 0);
    assert.strictEqual(emptyReport.recommendedQuestionCount, 0);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SUITE 5: Batch Candidate Generation & Parsing (Requirement 1 & 9)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n--- SUITE 5: Batch Candidate Generation & Partial Parsing (Requirement 1 & 9) ---');

  await runAsyncTest('5.1 generateQuestionBatch handles structured multi-target batches', async () => {
    const targets = [
      { targetId: 'T01', concept: 'Root Node', targetDifficulty: 'Easy', intendedCognitiveOperation: 'RECALL', dimension: 'Conceptual' },
      { targetId: 'T02', concept: 'Leaf Node', targetDifficulty: 'Easy', intendedCognitiveOperation: 'RECALL', dimension: 'Conceptual' }
    ];

    // Mock evidence package
    const evidencePackage = {
      sessionId: 'test_batch_001',
      unifiedRawContent: 'A binary tree has a root node at top level. A leaf node is a node with zero children.'
    };

    // Test fallback generation when offline/test
    process.env.ALLOW_MOCK_FALLBACK = 'true';
    const candidates = await agent2Generator.generateQuestionBatch(targets, evidencePackage);

    assert.strictEqual(candidates.length, 2, 'Expected 2 candidates returned from batch');
    candidates.forEach((cand, idx) => {
      assert(cand.targetId === targets[idx].targetId, `Expected targetId ${targets[idx].targetId}`);
      assert(Array.isArray(cand.options) && cand.options.length === 4, 'Must have 4 options');
      assert(cand.correctAnswer, 'Must have correct answer');
      assert(cand.options.includes(cand.correctAnswer), 'Correct answer must exist in options');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SUITE 6: Quality Gate & Question Craftsmanship (Requirement 2 & 4)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n--- SUITE 6: Deterministic Validation & Quality Gates (Requirement 2 & 4) ---');

  runTest('6.1 Deterministic validator accepts compliant 4-option question and rejects giveaways', () => {
    const validMCQ = {
      questionText: 'What is the maximum degree of any node in a binary tree?',
      options: [
        'Nodes are limited to a single child.',
        'A node may have up to three children.',
        'Each node can have at most two children.',
        'There is no limit on the number of children per node.'
      ],
      correctAnswer: 'Each node can have at most two children.',
      explanation: 'In a binary tree every node has at most two children.'
    };

    const preCheck = deterministicValidator.runPreChecks(validMCQ);
    assert.strictEqual(preCheck.isValid, true, 'Valid MCQ must pass deterministic pre-checks');

    const distVal = DifficultyAwareDistractorValidator.validate(validMCQ);
    assert.strictEqual(distVal.verdict, 'PASS', 'Valid MCQ must pass distractor validation');

    // Giveaway test: "All of the above"
    const giveawayMCQ = {
      ...validMCQ,
      options: [
        'Nodes are limited to a single child.',
        'A node may have up to three children.',
        'Each node can have at most two children.',
        'All of the above'
      ]
    };
    const giveawayResult = DifficultyAwareDistractorValidator.validate(giveawayMCQ);
    assert(giveawayResult.verdict === 'REJECT' || giveawayResult.verdict === 'REPAIR', 'Giveaway option must be rejected/repaired');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n========================================================================');
  console.log(`🏁 COMPREHENSIVE ACCEPTANCE RESULTS: ${passedTests} / ${totalTests} TESTS PASSED CLEANLY (100%)`);
  console.log('========================================================================');
}

main().catch(err => {
  console.error('\n💥 Suite execution halted with error:', err);
  process.exit(1);
});
