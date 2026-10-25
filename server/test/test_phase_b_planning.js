'use strict';

const assert = require('assert');
const agent1Planner = require('../engine/agents/agent1Planner');

console.log('🧪 ====================================================================');
console.log('🧪 RUNNING PHASE B: PLANNING & TARGET DECOMPOSITION TEST SUITE');
console.log('🧪 ====================================================================');

// Test 1: Angle & Format Derivation
console.log('\n▶ Test 1: Assessment Angle and Format Recommendation Derivation');
{
  const calcTarget = { concept: 'Euclidean remainder trace', dimension: 'Quick Calculation', intendedCognitiveOperation: 'CALCULATE' };
  assert.strictEqual(agent1Planner._deriveAssessmentAngle(calcTarget), 'CALCULATION');
  assert.strictEqual(agent1Planner._deriveFormatRecommendation(calcTarget), 'NUMERICAL_TRACE');

  const codeTarget = { concept: 'GCD recursive function', dimension: 'Flow / Trace', intendedCognitiveOperation: 'TRACE' };
  assert.strictEqual(agent1Planner._deriveAssessmentAngle(codeTarget), 'CODE_TRACE');
  assert.strictEqual(agent1Planner._deriveFormatRecommendation(codeTarget), 'CODE_ANALYSIS');

  const reasoningTarget = { concept: 'Divisor invariance property', dimension: 'Comparison / Tradeoff', intendedCognitiveOperation: 'COMPARE' };
  assert.strictEqual(agent1Planner._deriveAssessmentAngle(reasoningTarget), 'REASONING');
  assert.strictEqual(agent1Planner._deriveFormatRecommendation(reasoningTarget), 'REASONING_CONTRAST');

  const conceptualTarget = { concept: 'Definition of Greatest Common Divisor', dimension: 'Conceptual', intendedCognitiveOperation: 'RECALL' };
  assert.strictEqual(agent1Planner._deriveAssessmentAngle(conceptualTarget), 'CONCEPTUAL');
  assert.strictEqual(agent1Planner._deriveFormatRecommendation(conceptualTarget), 'PROSE_MULTIPLE_CHOICE');

  console.log('✅ PASS: Angle and format recommendations derived correctly across archetypes');
}

// Test 2: Multi-Angle Target Preservation in Audit (Same Macro-Topic)
console.log('\n▶ Test 2: Audit allows multiple distinct angles on the same macro-topic');
{
  const targets = [
    {
      targetId: 'T01',
      macroTopic: 'Euclidean Algorithm',
      concept: 'Euclidean Algorithm Invariant',
      assessmentAngle: 'REASONING',
      learningObjective: 'Explain why GCD is preserved during remainder reduction',
      specificReasoningTask: 'Invariance proof under modulo reduction',
      formatRecommendation: 'REASONING_CONTRAST',
      dimension: 'Comparison / Tradeoff',
      supportingEvidence: 'Euclidean algorithm repeatedly computes remainders preserving gcd.'
    },
    {
      targetId: 'T02',
      macroTopic: 'Euclidean Algorithm',
      concept: 'Euclidean Remainder Step Calculation',
      assessmentAngle: 'CALCULATION',
      learningObjective: 'Calculate remainder steps for given integers',
      specificReasoningTask: 'Compute step-by-step remainder for 48 and 18',
      formatRecommendation: 'NUMERICAL_TRACE',
      dimension: 'Quick Calculation',
      supportingEvidence: 'Euclidean algorithm computes 48 mod 18 = 12, then 18 mod 12 = 6.'
    },
    {
      targetId: 'T03',
      macroTopic: 'Euclidean Algorithm',
      concept: 'Euclidean Algorithm Recursive Code Trace',
      assessmentAngle: 'CODE_TRACE',
      learningObjective: 'Trace recursive base case and return value',
      specificReasoningTask: 'Trace termination when b reaches 0',
      formatRecommendation: 'CODE_ANALYSIS',
      dimension: 'Flow / Trace',
      supportingEvidence: 'Recursive gcd function terminates when second argument is zero.'
    }
  ];

  const evidencePackage = {
    unifiedRawContent: 'The Euclidean algorithm computes the greatest common divisor. gcd(48, 18) computes remainders. The recursive gcd function terminates when remainder is zero.',
    detectedFocus: ['Euclidean Algorithm']
  };

  const { auditedTargets } = agent1Planner._auditAssessmentTargets(targets, [], 3, evidencePackage);
  assert.strictEqual(auditedTargets.length, 3, `Expected all 3 distinct targets to be preserved, got ${auditedTargets.length}`);
  console.log('✅ PASS: All 3 distinct assessment angles on same topic preserved without false collision');
}

// Test 3: Reserve Target Promotion to Fulfill Requested Count
console.log('\n▶ Test 3: Reserve targets promoted when initial targets are fewer than requestedCount');
{
  const targets = [
    {
      targetId: 'T01',
      concept: 'Paging Mechanisms',
      subtopic: 'Virtual Memory',
      assessmentAngle: 'CONCEPTUAL',
      dimension: 'Conceptual',
      supportingEvidence: 'Paging divides memory into fixed size pages and frames.'
    }
  ];

  const reserves = [
    {
      targetId: 'R01',
      concept: 'Page Table Offset Calculation',
      subtopic: 'Virtual Memory',
      assessmentAngle: 'CALCULATION',
      dimension: 'Quick Calculation',
      supportingEvidence: 'Virtual address offset calculation uses page size bits.'
    },
    {
      targetId: 'R02',
      concept: 'TLB Hit vs Miss Latency',
      subtopic: 'Virtual Memory',
      assessmentAngle: 'REASONING',
      dimension: 'Comparison / Tradeoff',
      supportingEvidence: 'TLB lookup reduces memory access latency compared to page table walk.'
    }
  ];

  const evidencePackage = {
    unifiedRawContent: 'Paging divides memory into fixed size pages and frames. Virtual address offset calculation uses page size bits. TLB lookup reduces memory access latency compared to page table walk.',
    detectedFocus: ['Virtual Memory']
  };

  const { auditedTargets, auditLog } = agent1Planner._auditAssessmentTargets(targets, reserves, 3, evidencePackage);
  assert.strictEqual(auditedTargets.length, 3, `Expected 3 accepted targets via reserve promotion, got ${auditedTargets.length}`);
  assert.strictEqual(auditLog.promotedFromReserve, 2, 'Expected 2 reserves to be promoted');
  console.log('✅ PASS: Reserve targets successfully promoted to fulfill requested question count');
}

// Test 4: Genuine Capacity Deficit Preservation when Evidence is Exhausted
console.log('\n▶ Test 4: Honest capacity deficit preserved when evidence genuinely exhausted');
{
  const targets = [
    {
      targetId: 'T01',
      concept: 'Single Taught Concept',
      dimension: 'Conceptual',
      supportingEvidence: 'Only one concept was taught in this 30-second snippet.'
    }
  ];

  const evidencePackage = {
    unifiedRawContent: 'Only one concept was taught in this 30-second snippet.',
    detectedFocus: ['Single Taught Concept'],
    lectureIntelligence: {
      evidenceCapacity: {
        totalDefensibleCapacity: 1
      }
    }
  };

  const { auditedTargets } = agent1Planner._auditAssessmentTargets(targets, [], 3, evidencePackage);
  assert.strictEqual(auditedTargets.length, 1, 'Expected only 1 target accepted under strict capacity');
  console.log('✅ PASS: Capacity bounds strictly respected when evidence is genuinely small');
}

console.log('\n======================================================================');
console.log('🎉 ALL PHASE B PLANNING TESTS PASSED CLEANLY');
console.log('======================================================================');
