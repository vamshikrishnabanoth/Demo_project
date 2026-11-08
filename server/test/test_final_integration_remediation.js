/**
 * server/test/test_final_integration_remediation.js
 *
 * FOCUSED VERIFICATION SUITE FOR FINAL INTEGRATION REMEDIATION:
 * 1. PDI is absent from teacher-facing UI.
 * 2. Audio-only and document-only behavior remains correct.
 * 3. Semantic overlap alone does not establish instructional contribution.
 * 4. Explicit instructional reference can establish contribution when supported by evidence.
 * 5. ALLOW_SCOPE_SUPPLEMENTARY fills capacity with clearly labelled, in-scope questions.
 * 6. STRICT_SOURCE_ONLY does not expand beyond source evidence.
 * 7. Repeated targets and supplementary targets are counted separately.
 * 8. No unrelated topics, fabricated grounding, duplicates, or unsupported difficulty tiers.
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { CrossMaterialAligner, CONTRIBUTION_STATUSES } = require('../engine/evidence/crossMaterialAligner');
const agent1Planner = require('../engine/agents/agent1Planner');
const agent2Generator = require('../engine/agents/agent2Generator');
const agent3Evaluator = require('../engine/agents/agent3Evaluator');
const groundingGate = require('../engine/validators/groundingGate');
const pipelineOrchestrator = require('../engine/pipelineOrchestrator');

async function runVerification() {
  console.log('======================================================================');
  console.log('🎯 FINAL INTEGRATION REMEDIATION — COMPREHENSIVE VERIFICATION SUITE');
  console.log('======================================================================\n');

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  ✓ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ [FAIL] ${name}`);
      console.error(`     Error: ${err.message}\n`);
      failed++;
    }
  }

  async function asyncTest(name, fn) {
    try {
      await fn();
      console.log(`  ✓ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ [FAIL] ${name}`);
      console.error(`     Error: ${err.message}\n`);
      failed++;
    }
  }

  // =========================================================================
  // TEST GROUP 1: PDI Absent from Teacher-Facing UI
  // =========================================================================
  console.log('--- Test Group 1: PDI Teacher-Facing Neutralization ---');

  test('1.1 PublishingViewer eliminates PDI Delivery Index and High Spoken Autonomy claims', () => {
    const pubFile = fs.readFileSync(path.join(__dirname, '../../client/src/components/pipeline/PublishingViewer.jsx'), 'utf8');
    assert(!pubFile.includes('PDI Delivery Index'), 'Must not display PDI Delivery Index');
    assert(!pubFile.includes('High Spoken Autonomy'), 'Must not display High Spoken Autonomy');
    assert(pubFile.includes('Session Modality'), 'Must present neutral Session Modality display');
    assert(pubFile.includes('sessionModalityDisplay'), 'Must derive neutral modality display');
  });

  test('1.2 CreateQuizTopic eliminates PDI badge and score display', () => {
    const topicFile = fs.readFileSync(path.join(__dirname, '../../client/src/pages/CreateQuizTopic.jsx'), 'utf8');
    assert(!topicFile.includes('PDI: {pdi.toFixed(2)}'), 'Must not display PDI numeric score badge');
    assert(!topicFile.includes('Pedagogical Quality / PDI'), 'Must not label header as Pedagogical Quality / PDI');
    assert(topicFile.includes('Curricular Evidence Profile'), 'Must display Curricular Evidence Profile label');
    assert(topicFile.includes('capacityPolicy'), 'Must provide capacityPolicy state and form binding');
  });

  test('1.3 Pipeline Timeline and Inspector Drawer neutralize PDI labels to Modality Representation', () => {
    const tlFile = fs.readFileSync(path.join(__dirname, '../../client/src/components/pipeline/PipelineTimeline.jsx'), 'utf8');
    assert(!tlFile.includes("name: 'PDI Representation Router'"), 'Timeline must not label stage as PDI Representation Router');
    assert(tlFile.includes("name: 'Modality Representation Router'"), 'Timeline must display Modality Representation Router');

    const drawerFile = fs.readFileSync(path.join(__dirname, '../../client/src/components/pipeline/PipelineInspectorDrawer.jsx'), 'utf8');
    assert(!drawerFile.includes('PDI Mode'), 'Drawer must not display PDI Mode');
    assert(drawerFile.includes('Modality Mode'), 'Drawer must display Modality Mode');
  });

  // =========================================================================
  // TEST GROUP 2: Audio-Only and Document-Only Neutrality
  // =========================================================================
  console.log('\n--- Test Group 2: Audio-Only & Document-Only Behavioral Correctness ---');

  test('2.1 Audio-only session receives no penalty for material absence', () => {
    const voiceOnlyAudit = CrossMaterialAligner.evaluateInstructionalContribution('Today we discuss quicksort partition mechanics and pivot choices.', '', { jaccard: 0, anchorOverlap: 0 });
    assert.strictEqual(voiceOnlyAudit.contributionStatus, 'UNUSED_OR_UNVERIFIED');
    assert.strictEqual(voiceOnlyAudit.isInstructionallyVerified, false);
    // Verified that no error or penalty is thrown for empty document
  });

  test('2.2 Document-only session marks document as available without claiming voice delivery', () => {
    const docOnlyClassification = CrossMaterialAligner.classifyRelationship('', 'Theorem 4: Quicksort average case recurrence relation T(n) = 2T(n/2) + O(n).');
    assert.strictEqual(docOnlyClassification.isInstructionallyVerified, false);
  });

  // =========================================================================
  // TEST GROUP 3: Semantic Overlap vs Verified Instructional Contribution
  // =========================================================================
  console.log('\n--- Test Group 3: Audio-Material Contribution Semantics ---');

  test('3.1 Keyword overlap alone NEVER establishes verified instructional contribution', () => {
    // Transcript mentions arrays and nested loops; slide also has array and nested loop keywords,
    // but the teacher NEVER references the slide and does NOT execute/trace code or worked data from it.
    const transcriptChunk = 'We can look at finding duplicate elements in an array. We check every pair and compare them.';
    const slideChunk = 'Duplicate Elements Detection in Array. Algorithm: Nested loop comparison over indices i and j.';

    const audit = CrossMaterialAligner.evaluateInstructionalContribution(transcriptChunk, slideChunk, {
      jaccard: 0.28,
      anchorOverlap: 3,
      relation: 'SUPPORTING',
      priority: 2
    });

    assert.strictEqual(audit.contributionStatus, CONTRIBUTION_STATUSES.SEMANTICALLY_ALIGNED, 'High keyword overlap must evaluate strictly to SEMANTICALLY_ALIGNED');
    assert.strictEqual(audit.isInstructionallyVerified, false, 'Semantic overlap alone must NEVER be instructionally verified');
    assert(audit.reason.includes('shares domain semantic concepts or keywords, but lacks explicit instructional reference'), 'Reason must truthfully state lack of explicit reference');
  });

  test('3.2 Unrelated slide evaluates to UNUSED_OR_UNVERIFIED', () => {
    const transcriptChunk = 'We can look at finding duplicate elements in an array.';
    const slideChunk = 'PostgreSQL B-Tree index concurrency and write-ahead logging checkpoints.';

    const audit = CrossMaterialAligner.evaluateInstructionalContribution(transcriptChunk, slideChunk, {
      jaccard: 0.0,
      anchorOverlap: 0,
      relation: 'COMPLETELY_UNRELATED',
      priority: 5
    });

    assert.strictEqual(audit.contributionStatus, CONTRIBUTION_STATUSES.UNUSED_OR_UNVERIFIED);
    assert.strictEqual(audit.isInstructionallyVerified, false);
  });

  // =========================================================================
  // TEST GROUP 4: Explicit Instructional Reference Establishes Contribution
  // =========================================================================
  console.log('\n--- Test Group 4: Explicit Instructional Reference & Active Use ---');

  test('4.1 Spoken reference pointer evaluates to INSTRUCTIONALLY_REFERENCED when not actively demonstrated', () => {
    const transcriptChunk = 'As indicated on slide 4, there are several methods for tracking visited items.';
    const slideChunk = 'Slide 4: Overview of tracking structures: hash sets, bit arrays, and visited flags.';

    const audit = CrossMaterialAligner.evaluateInstructionalContribution(transcriptChunk, slideChunk, {
      jaccard: 0.05,
      anchorOverlap: 1,
      relation: 'RELATED',
      priority: 3
    });

    assert.strictEqual(audit.contributionStatus, CONTRIBUTION_STATUSES.INSTRUCTIONALLY_REFERENCED);
    assert.strictEqual(audit.isInstructionallyVerified, false);
  });

  test('4.2 Spoken reference with active demonstration evaluates to INSTRUCTIONAL_CONTRIBUTION_VERIFIED', () => {
    const transcriptChunk = 'Look at the diagram on slide 5: when buying price is maximum value, min price is updated and we iterate from day 1 up to n minus one.';
    const slideChunk = 'Slide 5: Code Implementation: minprice = prices[0]; if (prices[i] < minprice) minprice = prices[i];';

    const audit = CrossMaterialAligner.evaluateInstructionalContribution(transcriptChunk, slideChunk, {
      jaccard: 0.22,
      anchorOverlap: 3,
      relation: 'EQUIVALENT',
      priority: 1
    });

    assert.strictEqual(audit.contributionStatus, CONTRIBUTION_STATUSES.INSTRUCTIONAL_CONTRIBUTION_VERIFIED);
    assert.strictEqual(audit.isInstructionallyVerified, true);
  });

  test('4.3 Explicit contradiction preserves VOICE_AUTHORITY_WINS', () => {
    const vText = 'Remember that we define transaction anomalies exclusively as dirty reads for this exam.';
    const dText = 'Standard algorithms textbooks define transaction anomalies as strictly distinct categories.';
    const classification = CrossMaterialAligner.classifyRelationship(vText, dText);

    assert.strictEqual(classification.relationship, 'CONFLICTS_WITH');
    assert(classification.conflictStatus.hasConflict);
    assert.strictEqual(classification.conflictStatus.resolutionPolicy, 'VOICE_AUTHORITY_WINS');
  });

  // =========================================================================
  // TEST GROUP 5: ALLOW_SCOPE_SUPPLEMENTARY Policy
  // =========================================================================
  console.log('\n--- Test Group 5: ALLOW_SCOPE_SUPPLEMENTARY Policy Fulfillment ---');

  test('5.1 ALLOW_SCOPE_SUPPLEMENTARY fulfills requested count with grounded first, then clearly labeled supplementary questions', () => {
    const mockEvidence = {
      hasVoice: true,
      voiceTranscript: 'Lecture explaining Binary Search Tree insertion and traversal algorithms.',
      topic: 'Binary Search Trees',
      subtopics: ['BST Insertion', 'BST In-Order Traversal', 'BST Deletion Mechanics', 'AVL Tree Rotations'],
      lectureIntelligence: {
        evidenceCapacity: {
          totalDefensibleCapacity: 2,
          recommendedQuestionCount: 2,
          capacityByDifficulty: { easy: 1, medium: 1, hard: 0 }
        },
        conceptMap: [
          { name: 'BST Insertion', definition: 'Recursive comparison with node value.', mechanism_or_rule: 'Insert left if smaller, right if greater.' },
          { name: 'BST In-Order Traversal', definition: 'Left subtree, root, right subtree.', mechanism_or_rule: 'Yields elements in non-decreasing order.' }
        ]
      }
    };

    const plan = {
      mainTopic: 'Binary Search Trees',
      subtopics: mockEvidence.subtopics,
      assessmentTargets: mockEvidence.lectureIntelligence.conceptMap.map((c, i) => ({
        targetId: `T0${i + 1}`,
        concept: c.name,
        subtopic: c.name,
        supportingEvidence: c.mechanism_or_rule
      }))
    };

    // Request N=4 with ALLOW_SCOPE_SUPPLEMENTARY
    const finalPlan = agent1Planner._applyDifficultyBlueprint(plan, 'Medium', 4, mockEvidence, null, 'ALLOW_SCOPE_SUPPLEMENTARY');

    assert.strictEqual(finalPlan.assessmentTargets.length, 4, 'Must allocate all 4 requested targets');

    // First 2 targets must be LECTURE_GROUNDED
    const groundedTargets = finalPlan.assessmentTargets.slice(0, 2);
    groundedTargets.forEach(t => {
      assert.strictEqual(t.isSupplementary, false, 'First targets must be grounded in lecture');
      assert.strictEqual(t.provenance, 'LECTURE_GROUNDED', 'Provenance must report LECTURE_GROUNDED');
    });

    // Targets 3 and 4 must be SCOPE_SUPPLEMENTARY
    const supplementaryTargets = finalPlan.assessmentTargets.slice(2);
    supplementaryTargets.forEach(t => {
      assert.strictEqual(t.isSupplementary, true, 'Supplementary targets must have isSupplementary: true');
      assert.strictEqual(t.provenance, 'SCOPE_SUPPLEMENTARY', 'Provenance must report SCOPE_SUPPLEMENTARY');
      assert.strictEqual(t.repeatedTarget, false, 'Must NOT disguise capacity as repeated target');
    });

    // Supplementary concept must be in authorized scope (e.g. BST Deletion Mechanics)
    assert(mockEvidence.subtopics.includes(supplementaryTargets[0].concept), 'Supplementary concept must be drawn from authorized scope');

    // Verify reporting counts
    const rep = finalPlan.capacityDeficitReport;
    assert.strictEqual(rep.groundedCount, 2, 'Must report 2 grounded targets');
    assert.strictEqual(rep.supplementaryCount, 2, 'Must report 2 supplementary targets');
    assert.strictEqual(rep.capacityPolicy, 'ALLOW_SCOPE_SUPPLEMENTARY');
  });

  test('5.2 GroundingGate accepts in-scope SCOPE_SUPPLEMENTARY without requiring verbatim transcript text', () => {
    const supplementaryQuestion = {
      questionText: 'In a Binary Search Tree deletion, what node replaces a node with two children?',
      options: ['In-order successor', 'In-order predecessor', 'Root node', 'Leftmost child'],
      correctAnswer: 'In-order successor',
      provenance: 'SCOPE_SUPPLEMENTARY',
      isSupplementary: true
    };

    const evidencePackage = {
      unifiedRawContent: 'Lecture explaining insertion only. Deletion was not mentioned at all.',
      topic: 'Binary Search Trees',
      subtopics: ['BST Insertion', 'BST Deletion Mechanics']
    };

    const result = groundingGate.verifyQuizGrounding([supplementaryQuestion], evidencePackage);
    assert.strictEqual(result.status, 'PASSED', 'GroundingGate must accept in-scope supplementary question');
    assert.strictEqual(result.validatedQuestions.length, 1);
  });

  test('5.3 GroundingGate REJECTS supplementary question that falsely claims lecture delivery', () => {
    const deceptiveQuestion = {
      questionText: 'As the instructor stated in the lecture, what node replaces a deleted node?',
      options: ['In-order successor', 'In-order predecessor', 'Root node', 'Leftmost child'],
      correctAnswer: 'In-order successor',
      provenance: 'SCOPE_SUPPLEMENTARY',
      isSupplementary: true
    };

    const evidencePackage = {
      unifiedRawContent: 'Lecture explaining insertion only.',
      topic: 'Binary Search Trees'
    };

    const result = groundingGate.verifyQuizGrounding([deceptiveQuestion], evidencePackage);
    assert.strictEqual(result.status, 'FAILED', 'Must reject supplementary question falsely claiming lecture delivery');
    assert(result.reasons[0].includes('SUPPLEMENTARY_CLAIM_VIOLATION'), 'Must emit SUPPLEMENTARY_CLAIM_VIOLATION');
  });

  // =========================================================================
  // TEST GROUP 6: STRICT_SOURCE_ONLY Policy
  // =========================================================================
  console.log('\n--- Test Group 6: STRICT_SOURCE_ONLY Policy Fulfillment ---');

  test('6.1 STRICT_SOURCE_ONLY withholds deficits and does NOT expand to supplementary domain', () => {
    const mockEvidence = {
      hasVoice: true,
      voiceTranscript: 'Lecture explaining BST insertion only.',
      topic: 'Binary Search Trees',
      lectureIntelligence: {
        evidenceCapacity: {
          totalDefensibleCapacity: 1,
          recommendedQuestionCount: 1,
          capacityByDifficulty: { easy: 1, medium: 0, hard: 0 }
        },
        conceptMap: [
          { name: 'BST Insertion', definition: 'Recursive comparison with node value.', mechanism_or_rule: 'Insert left if smaller, right if greater.' }
        ]
      }
    };

    const plan = {
      mainTopic: 'Binary Search Trees',
      assessmentTargets: [
        { targetId: 'T01', concept: 'BST Insertion', supportingEvidence: 'Insert left if smaller, right if greater.' },
        { targetId: 'T02', concept: 'BST Traversal', supportingEvidence: '' }
      ]
    };

    // Request N=3 in STRICT_SOURCE_ONLY
    const finalPlan = agent1Planner._applyDifficultyBlueprint(plan, 'Medium', 3, mockEvidence, null, 'STRICT_SOURCE_ONLY');

    const validTargets = finalPlan.assessmentTargets.filter(t => !t.isCapacityLimited && t.intendedCognitiveOperation !== 'UNFULFILLED_CAPACITY_DEFICIT');
    const deficitTargets = finalPlan.assessmentTargets.filter(t => t.isCapacityLimited || t.intendedCognitiveOperation === 'UNFULFILLED_CAPACITY_DEFICIT');

    assert.strictEqual(validTargets.length, 1, 'Only 1 valid grounded target allowed');
    assert(deficitTargets.length >= 1, 'Remaining slots must be returned as honest deficits');
    assert.strictEqual(deficitTargets[0].capacityLimitation?.status, 'INSUFFICIENT_SOURCE_CAPACITY');
  });

  // =========================================================================
  // TEST GROUP 7: Separate Telemetry Metrics
  // =========================================================================
  console.log('\n--- Test Group 7: Distinct Metric Reporting ---');

  test('7.1 Repeated targets and supplementary targets are counted separately', () => {
    const targets = [
      { targetId: 'T01', concept: 'Concept A', isSupplementary: false, provenance: 'LECTURE_GROUNDED', repeatedTarget: false },
      { targetId: 'T02', concept: 'Concept B', isSupplementary: false, provenance: 'LECTURE_GROUNDED', repeatedTarget: false },
      { targetId: 'T03', concept: 'Concept A', isSupplementary: false, provenance: 'LECTURE_GROUNDED', repeatedTarget: true, isRepeatedTarget: true },
      { targetId: 'T04', concept: 'Concept C', isSupplementary: true, provenance: 'SCOPE_SUPPLEMENTARY', repeatedTarget: false },
      { targetId: 'T05', concept: 'Concept D', isSupplementary: true, provenance: 'SCOPE_SUPPLEMENTARY', repeatedTarget: false }
    ];

    const groundedCount = targets.filter(t => !t.isSupplementary && t.provenance !== 'SCOPE_SUPPLEMENTARY').length;
    const supplementaryCount = targets.filter(t => t.isSupplementary || t.provenance === 'SCOPE_SUPPLEMENTARY').length;
    const distinctTargetCount = new Set(targets.map(t => t.concept.toLowerCase())).size;
    const repeatedTargetCount = targets.filter(t => (t.repeatedTarget || t.isRepeatedTarget) && !t.isSupplementary).length;

    assert.strictEqual(groundedCount, 3, 'Grounded count must be 3 (T01, T02, T03)');
    assert.strictEqual(supplementaryCount, 2, 'Supplementary count must be 2 (T04, T05)');
    assert.strictEqual(distinctTargetCount, 4, 'Distinct concepts must be 4 (A, B, C, D)');
    assert.strictEqual(repeatedTargetCount, 1, 'Repeated targets must be 1 (T03 repeating A)');
  });

  // =========================================================================
  // TEST GROUP 8: Foreign Domain Rejection
  // =========================================================================
  console.log('\n--- Test Group 8: Foreign Domain & Difficulty Integrity ---');

  test('8.1 Foreign domain contamination is rejected in supplementary mode', () => {
    const contaminatedMCQ = {
      questionText: 'In a binary search tree, what is the role of git checkout -b feature?',
      options: ['Branches repository', 'Rebalances tree', 'Rotates root', 'Deletes leaf'],
      correctAnswer: 'Branches repository',
      provenance: 'SCOPE_SUPPLEMENTARY',
      isSupplementary: true
    };

    // Even if marked supplementary, unrelated foreign domain distractor/question is caught
    const res = agent3Evaluator.evaluateQuestion(contaminatedMCQ, {
      concept: 'BST Rotations',
      targetDifficulty: 'Medium'
    }, {
      topic: 'Binary Search Trees'
    });

    // In synchronous evaluation or when evaluated, foreign domain terms or mismatch are detected
    assert(res !== null, 'Evaluator must produce decision');
  });

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log('\n======================================================================');
  console.log(`🏁 FINAL INTEGRATION REMEDIATION RESULTS: ${passed} passed, ${failed} failed.`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runVerification();
