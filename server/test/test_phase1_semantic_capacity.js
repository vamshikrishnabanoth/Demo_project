/**
 * server/test/test_phase1_semantic_capacity.js
 *
 * Phase 1 Contract Verification Suite:
 * 1. 56-min Binary Tree lecture: Verify > 6 concepts survive (slice(0, 6) choke point removed).
 * 2. Decouple recommendation from concept count: Verify conceptCount !== recommendedQuestionCount.
 * 3. Low-evidence concepts do NOT inflate capacity.
 * 4. Deep concepts contribute multiple distinct assessment angles across Easy, Medium, and Hard.
 * 5. Safety ceiling of 30 acts as a resource guard, never an artificial target.
 * 6. Structured capacityByDifficulty (Easy/Medium/Hard) is transparently exposed.
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const depthAnalyzer = require('../engine/evidence/depthAnalyzer');
const lectureIntelligence = require('../engine/intelligence/lectureIntelligence');

console.log('🧪 ====================================================================');
console.log('🧪 RUNNING PHASE 1: SEMANTIC CAPACITY & CONCEPT EXTRACTION TEST SUITE');
console.log('🧪 ====================================================================\n');

let passed = 0;
let failed = 0;

function runCheck(name, fn) {
  try {
    fn();
    console.log(`✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`❌ FAIL: ${name}`);
    console.error(`   Error: ${err.message}\n${err.stack}`);
    failed++;
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Test 1: 56-Min Lecture Concept Survival
// ──────────────────────────────────────────────────────────────────────────
runCheck('1.1 56-min Binary Tree transcript: verify > 6 concepts survive (no slice(0, 6) choke point)', () => {
  const transcriptPath = path.resolve(__dirname, '../../pipeline_experiment/data/transcripts/binary_trees_transcript.json');
  assert(fs.existsSync(transcriptPath), `Transcript file must exist at ${transcriptPath}`);

  const rawJson = JSON.parse(fs.readFileSync(transcriptPath, 'utf8'));
  const analysis = depthAnalyzer.analyzeLecture(rawJson.raw_content);

  assert(Array.isArray(analysis.detectedFocus), 'detectedFocus must be an array');
  assert(
    analysis.detectedFocus.length > 6,
    `Expected > 6 concepts to survive, but got ${analysis.detectedFocus.length}`
  );
  assert(
    analysis.detectedFocus.length <= 30,
    `Safety guard of 30 must not be exceeded, got ${analysis.detectedFocus.length}`
  );

  const normalizedConcepts = analysis.detectedFocus.map(c => c.toLowerCase());
  const hasFullBinary = normalizedConcepts.some(c => c.includes('full binary'));
  const hasCompleteBinary = normalizedConcepts.some(c => c.includes('complete binary'));
  const hasPerfectBinary = normalizedConcepts.some(c => c.includes('perfect binary'));
  const hasBalancedTree = normalizedConcepts.some(c => c.includes('balanced'));

  assert(hasFullBinary, 'Full Binary Tree must be retained in concept inventory');
  assert(hasCompleteBinary, 'Complete Binary Tree must be retained in concept inventory');
  assert(hasPerfectBinary, 'Perfect Binary Tree must be retained in concept inventory');
  assert(hasBalancedTree, 'Balanced Tree must be retained in concept inventory');
});

// ──────────────────────────────────────────────────────────────────────────
// Test 2: Decouple Recommendation from Concept Count
// ──────────────────────────────────────────────────────────────────────────
runCheck('2.1 Deep lecture: 4 concepts with rich mechanisms produce recommendation != concept count', () => {
  const deepConcepts = [
    {
      id: 'C01',
      name: 'Binary Search Tree Node Deletion',
      definition: 'Deleting a node with two children requires preserving BST invariants by replacing it with its inorder successor or predecessor.',
      mechanism_or_rule: 'Find inorder successor (smallest key in right subtree), copy value to target node, recursively delete successor node from right subtree.',
      substanceType: 'MECHANISM',
      sourceAnchors: ['seg_01', 'seg_02', 'seg_03']
    },
    {
      id: 'C02',
      name: 'AVL Tree Balance Factor',
      definition: 'Balance factor is defined as the height of the left subtree minus the height of the right subtree.',
      mechanism_or_rule: 'Compute balance factor after insertion; if balance factor is outside {-1, 0, 1}, perform LL, RR, LR, or RL rotations to restore invariant.',
      substanceType: 'RULE',
      sourceAnchors: ['seg_04', 'seg_05']
    },
    {
      id: 'C03',
      name: 'Complete vs Full Binary Tree Distinction',
      definition: 'Full binary tree requires every node to have 0 or 2 children, whereas complete binary tree requires all levels filled except last filled left-to-right.',
      mechanism_or_rule: 'Verify 0 or 2 child constraint for full; verify left-packed array representation for complete.',
      substanceType: 'COMPARISON',
      sourceAnchors: ['seg_06', 'seg_07']
    },
    {
      id: 'C04',
      name: 'Queue-Based Level Order Traversal',
      definition: 'Breadth-first search traversal that visits nodes level by level using a FIFO queue data structure.',
      mechanism_or_rule: 'Enqueue root node. While queue is non-empty, dequeue current node, process value, enqueue left child if present, enqueue right child if present.',
      substanceType: 'MECHANISM',
      sourceAnchors: ['seg_08', 'seg_09', 'seg_10']
    }
  ];

  const critique = {
    explanatoryDepth: ['DEFINITION_AND_TERMINOLOGY', 'OPERATIONAL_MECHANISM', 'COMPARATIVE_TRADEOFF'],
    reasoningDepth: ['INVARIANT_AND_CAUSAL', 'MOTIVATION_PROVIDED'],
    practicalDemonstrations: ['WORKED_TRACE_OR_CODE']
  };

  const capacity = lectureIntelligence.deriveSemanticCapacity(deepConcepts, critique, { wordCount: 2500 });

  assert.strictEqual(capacity.distinctConceptCount, 4, 'Should identify 4 distinct substantive concepts');
  assert(
    capacity.recommendedQuestionCount !== capacity.distinctConceptCount,
    `recommendedQuestionCount (${capacity.recommendedQuestionCount}) must NOT equal distinctConceptCount (${capacity.distinctConceptCount})`
  );
  assert(
    capacity.recommendedQuestionCount > 4,
    `Deep concepts should support a recommendation > 4 (got ${capacity.recommendedQuestionCount})`
  );
  assert(
    capacity.totalDefensibleCapacity >= 10,
    `Expected total defensible capacity >= 10 across 4 deep concepts, got ${capacity.totalDefensibleCapacity}`
  );
});

runCheck('2.2 Surface lecture: 8 definition-only concepts produce recommendation != concept count', () => {
  const surfaceConcepts = Array.from({ length: 8 }, (_, i) => ({
    id: `C0${i + 1}`,
    name: `Term_${i + 1}`,
    definition: `Formal dictionary definition of terminology item ${i + 1}.`,
    mechanism_or_rule: null,
    substanceType: 'DEFINITION',
    sourceAnchors: [`seg_${i + 1}`]
  }));

  const critique = {
    explanatoryDepth: ['DEFINITION_AND_TERMINOLOGY'],
    reasoningDepth: ['ASSERTION_BASED'],
    practicalDemonstrations: ['NOT_OBSERVED_IN_EXCERPT']
  };

  const capacity = lectureIntelligence.deriveSemanticCapacity(surfaceConcepts, critique, { wordCount: 600 });

  assert.strictEqual(capacity.distinctConceptCount, 8);
  assert(
    capacity.recommendedQuestionCount !== capacity.distinctConceptCount,
    `recommendedQuestionCount (${capacity.recommendedQuestionCount}) must not equal conceptCount (${capacity.distinctConceptCount})`
  );
  assert.strictEqual(capacity.capacityByDifficulty.hard, 0, 'Pure definition concepts must yield 0 Hard capacity');
});

// ──────────────────────────────────────────────────────────────────────────
// Test 3: Low-Evidence Concepts Do NOT Inflate Capacity
// ──────────────────────────────────────────────────────────────────────────
runCheck('3.1 Low-evidence and passing-mention concepts contribute 0 capacity', () => {
  const baseConcepts = [
    {
      id: 'C01',
      name: 'Binary Tree Invariant',
      definition: 'A tree where each node has at most two children designated left and right.',
      mechanism_or_rule: 'Node degree constraint: degree(node) <= 2.',
      substanceType: 'RULE',
      sourceAnchors: ['seg_01']
    }
  ];

  const critique = {
    explanatoryDepth: ['DEFINITION_AND_TERMINOLOGY'],
    reasoningDepth: ['ASSERTION_BASED']
  };

  const baseCapacity = lectureIntelligence.deriveSemanticCapacity(baseConcepts, critique);

  // Add 5 low-evidence / passing-mention concepts
  const noisyConcepts = [
    ...baseConcepts,
    { id: 'C02', name: 'Passing Mention A', definition: 'Briefly mentioned', mechanism_or_rule: null, sourceAnchors: [] },
    { id: 'C03', name: 'Out of Scope B', definition: 'Out of scope for today', mechanism_or_rule: 'NOT_OBSERVED', sourceAnchors: [] },
    { id: 'C04', name: 'No Anchor C', definition: 'Short text', mechanism_or_rule: null, sourceAnchors: [] },
    { id: 'C05', name: 'Empty Def D', definition: '', mechanism_or_rule: null, sourceAnchors: [] },
    { id: 'C06', name: 'Trivial E', definition: 'None', mechanism_or_rule: 'null', sourceAnchors: [] }
  ];

  const noisyCapacity = lectureIntelligence.deriveSemanticCapacity(noisyConcepts, critique);

  assert.strictEqual(
    noisyCapacity.totalDefensibleCapacity,
    baseCapacity.totalDefensibleCapacity,
    `Total defensible capacity must not inflate from low-evidence concepts (Base: ${baseCapacity.totalDefensibleCapacity}, Noisy: ${noisyCapacity.totalDefensibleCapacity})`
  );
  assert.strictEqual(
    noisyCapacity.distinctConceptCount,
    baseCapacity.distinctConceptCount,
    `Distinct substantive concept count must ignore low-evidence items (Expected ${baseCapacity.distinctConceptCount}, got ${noisyCapacity.distinctConceptCount})`
  );
});

// ──────────────────────────────────────────────────────────────────────────
// Test 4: Deep Concepts Contribute Multiple Distinct Assessment Angles
// ──────────────────────────────────────────────────────────────────────────
runCheck('4.1 A single deep concept contributes multiple distinct assessment angles (Easy + Medium + Hard)', () => {
  const singleDeepConcept = [
    {
      id: 'C01',
      name: 'Binary Search Tree Deletion Algorithm',
      definition: 'Deleting a node with two children requires preserving BST sorted invariants by replacing the deleted node key with its inorder successor or predecessor.',
      mechanism_or_rule: 'Traverse to target node. If two children exist, locate the minimum node in right subtree (inorder successor), copy key, and delete successor node.',
      substanceType: 'MECHANISM',
      sourceAnchors: ['seg_01', 'seg_02', 'seg_03']
    }
  ];

  const critique = {
    explanatoryDepth: ['OPERATIONAL_MECHANISM', 'THEORETICAL_DERIVATION'],
    reasoningDepth: ['INVARIANT_AND_CAUSAL'],
    practicalDemonstrations: ['WORKED_TRACE_OR_CODE']
  };

  const capacity = lectureIntelligence.deriveSemanticCapacity(singleDeepConcept, critique);

  assert(capacity.capacityByDifficulty.easy >= 1, 'Deep concept must support Easy angle (definition/recall)');
  assert(capacity.capacityByDifficulty.medium >= 1, 'Deep concept must support Medium angle (operational trace)');
  assert(capacity.capacityByDifficulty.hard >= 1, 'Deep concept must support Hard angle (invariant preservation/edge case)');
  assert(
    capacity.totalDefensibleCapacity >= 3,
    `Single deep concept must support >= 3 distinct assessment angles, got ${capacity.totalDefensibleCapacity}`
  );
});

// ──────────────────────────────────────────────────────────────────────────
// Test 5: Safety Ceiling as Resource Guard (Not a Target)
// ──────────────────────────────────────────────────────────────────────────
runCheck('5.1 Safety ceiling clamps at 30 as a resource guard without becoming an artificial target', () => {
  const excessiveConcepts = Array.from({ length: 45 }, (_, i) => ({
    id: `C${String(i + 1).padStart(2, '0')}`,
    name: `Algorithmic Topic ${i + 1}`,
    definition: `Substantive definition and mechanism description for topic ${i + 1} with extensive explanations.`,
    mechanism_or_rule: `Execute operational procedure ${i + 1} step by step according to formal algorithm.`,
    substanceType: 'MECHANISM',
    sourceAnchors: [`seg_${i + 1}`]
  }));

  const critique = {
    explanatoryDepth: ['OPERATIONAL_MECHANISM'],
    reasoningDepth: ['INVARIANT_AND_CAUSAL']
  };

  const capacity = lectureIntelligence.deriveSemanticCapacity(excessiveConcepts, critique);

  assert.strictEqual(capacity.distinctConceptCount, 45, 'Substantive concepts accurately detected');
  assert(
    capacity.recommendedQuestionCount <= 30,
    `Recommended question count must be bounded at 30, got ${capacity.recommendedQuestionCount}`
  );
});

// ──────────────────────────────────────────────────────────────────────────
// Test 6: Structured Capacity by Difficulty Transparency
// ──────────────────────────────────────────────────────────────────────────
runCheck('6.1 evidenceCapacity returns transparent breakdown across Easy, Medium, and Hard', () => {
  const mixedConcepts = [
    {
      id: 'C01',
      name: 'Full Binary Tree',
      definition: 'A binary tree in which every internal node has strictly zero or two children.',
      mechanism_or_rule: null,
      substanceType: 'DEFINITION',
      sourceAnchors: ['seg_01']
    },
    {
      id: 'C02',
      name: 'Balanced Binary Tree',
      definition: 'A tree where the height of left and right subtrees differs by at most 1.',
      mechanism_or_rule: 'Calculate |h_L - h_R| <= 1 for every node in tree.',
      substanceType: 'RULE',
      sourceAnchors: ['seg_02']
    }
  ];

  const critique = {
    explanatoryDepth: ['DEFINITION_AND_TERMINOLOGY', 'OPERATIONAL_MECHANISM'],
    reasoningDepth: ['INVARIANT_AND_CAUSAL']
  };

  const capacity = lectureIntelligence.deriveSemanticCapacity(mixedConcepts, critique);

  assert(typeof capacity.capacityByDifficulty === 'object', 'capacityByDifficulty must be an object');
  assert(typeof capacity.capacityByDifficulty.easy === 'number', 'capacityByDifficulty.easy must be a number');
  assert(typeof capacity.capacityByDifficulty.medium === 'number', 'capacityByDifficulty.medium must be a number');
  assert(typeof capacity.capacityByDifficulty.hard === 'number', 'capacityByDifficulty.hard must be a number');
  assert(
    capacity.capacityByDifficulty.easy + capacity.capacityByDifficulty.medium + capacity.capacityByDifficulty.hard === capacity.totalDefensibleCapacity,
    'Sum of tier capacities must equal total defensible capacity'
  );
  assert(typeof capacity.advisoryRationale === 'string', 'advisoryRationale must be a descriptive string');
});

console.log(`\n======================================================================`);
console.log(` 🏁 RESULT: ${passed} / ${passed + failed} TESTS PASSED CLEANLY`);
console.log(`======================================================================\n`);

if (failed > 0) {
  process.exit(1);
}
