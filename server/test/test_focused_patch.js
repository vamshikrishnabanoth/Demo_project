'use strict';

const assert = require('assert');
const path = require('path');

// Target components under test
const deterministicValidator = require('../engine/validators/deterministicValidator');
const agent1Planner = require('../engine/agents/agent1Planner');
const llmRouter = require('../engine/adapter/llmRouter');

async function runTests() {
  console.log('🧪 Starting Focused Patch Test Suite (Provider Reliability, Semantic Deduplication, Count Recovery)...\n');
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     ${err.message}`);
      failed++;
    }
  }

  async function asyncTest(name, fn) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     ${err.message}`);
      failed++;
    }
  }

  // ============================================================================
  // Suite 1: Semantic Deduplication (Dimension Independence & Specific Pattern Blocks)
  // ============================================================================
  console.log('--- Suite 1: Semantic Deduplication ---');

  test('1.1 Verbatim stem duplicate is rejected regardless of dimension label', () => {
    const existing = [{
      questionText: 'What is the greatest common divisor of two integers a and b?',
      correctAnswer: 'The largest positive integer that divides both a and b',
      options: ['The largest positive integer that divides both a and b', 'The sum of both integers', 'The product of both integers', 'The smallest remainder'],
      metadata: { dimension: 'Conceptual', concept: 'Euclidean Algorithm' }
    }];
    const candidate = {
      questionText: 'What is the greatest common divisor of two integers a and b?',
      correctAnswer: 'The largest positive integer that divides both a and b',
      options: ['The largest positive integer that divides both a and b', 'The sum of both integers', 'The product of both integers', 'The smallest remainder'],
      metadata: { dimension: 'Foundational Prerequisite', concept: 'Euclidean Algorithm' }
    };
    const res = deterministicValidator.checkDuplicateQuestion(candidate, existing, candidate.metadata);
    assert.strictEqual(res.isDuplicate, true, 'Should be flagged duplicate');
    assert.strictEqual(res.reason.includes('VERBATIM_DUPLICATE'), true);
  });

  test('1.2 Repeated GCD definitions are blocked even with different wording and dimensions', () => {
    const existing = [{
      questionText: 'What is the definition of the Greatest Common Divisor (GCD) of two numbers?',
      correctAnswer: 'The largest positive integer that divides both numbers without a remainder',
      options: ['The largest positive integer that divides both numbers without a remainder', 'The least common multiple', 'The difference between numbers', 'The product of prime factors'],
      metadata: { dimension: 'Conceptual', concept: 'GCD Definition' }
    }];
    const candidate = {
      questionText: 'How is the greatest common divisor of integers a and b formally defined?',
      correctAnswer: 'It is the largest integer that divides both a and b evenly',
      options: ['It is the largest integer that divides both a and b evenly', 'The smallest common multiple', 'The quotient of a and b', 'The square root of their product'],
      metadata: { dimension: 'Foundational Prerequisite', concept: 'Greatest Common Divisor' }
    };
    const res = deterministicValidator.checkDuplicateQuestion(candidate, existing, candidate.metadata);
    assert.strictEqual(res.isDuplicate, true, 'Repeated GCD definition across dimensions must be blocked');
    assert.strictEqual(res.reason.includes('CORE_DEFINITION_DUPLICATE') || res.reason.includes('ANSWER_COLLISION'), true);
  });

  test('1.3 Multiple questions testing the equality operator (==) are blocked across differing dimensions', () => {
    const existing = [{
      questionText: 'In Python, what is the purpose of the == operator in the base condition if b == 0: return a?',
      correctAnswer: 'It compares the value of b to zero for equality',
      options: ['It compares the value of b to zero for equality', 'It assigns 0 to b', 'It checks if b is a reference to 0', 'It increments b'],
      metadata: { dimension: 'Flow / Trace', concept: 'Base Case Equality' }
    }];
    const candidate = {
      questionText: 'What operation does the double equal == perform in the conditional statement b == 0?',
      correctAnswer: 'Compares whether b equals zero',
      options: ['Compares whether b equals zero', 'Assigns zero to b', 'Bitwise comparison', 'Type casting'],
      metadata: { dimension: 'Conceptual', concept: 'Python Comparison Operators' }
    };
    const res = deterministicValidator.checkDuplicateQuestion(candidate, existing, candidate.metadata);
    assert.strictEqual(res.isDuplicate, true, 'Duplicate == operator question must be blocked');
    assert.strictEqual(res.reason.includes('OPERATOR_REPETITION_DUPLICATE') || res.reason.includes('ANSWER_COLLISION'), true);
  });

  test('1.4 Equivalent answer with minor grammatical variation and stem overlap is blocked', () => {
    const existing = [{
      questionText: 'Why does Euclidean algorithm terminate when the second argument reaches zero?',
      correctAnswer: 'Any integer divides zero and gcd(a, 0) equals a',
      options: ['Any integer divides zero and gcd(a, 0) equals a', 'Division by zero halts execution', 'Negative remainder occurs', 'Zero is prime'],
      metadata: { dimension: 'Reasoning', concept: 'Termination Proof' }
    }];
    const candidate = {
      questionText: 'Why does the Euclidean algorithm stop when the remainder reaches zero?',
      correctAnswer: 'The integer a divides zero and gcd(a, 0) equals a',
      options: ['The integer a divides zero and gcd(a, 0) equals a', 'Execution errors out', 'Remainder cannot be zero', 'Infinite recursion'],
      metadata: { dimension: 'Conceptual', concept: 'Termination Condition' }
    };
    const res = deterministicValidator.checkDuplicateQuestion(candidate, existing, candidate.metadata);
    assert.strictEqual(res.isDuplicate, true, 'Equivalent answer with stem overlap must be blocked');
  });

  // ============================================================================
  // Suite 2: Negative Tests (Distinct Questions on Same Topic Preserved)
  // ============================================================================
  console.log('\n--- Suite 2: Negative Tests (Preserving Legitimate Diversity) ---');

  test('2.1 Conceptual GCD definition vs numerical calculation on GCD must NOT be blocked', () => {
    const existing = [{
      questionText: 'What is the definition of the greatest common divisor of two integers?',
      correctAnswer: 'The largest positive integer that divides both integers',
      options: ['The largest positive integer that divides both integers', 'The product of the integers', 'The quotient of the integers', 'The smallest non-zero remainder'],
      metadata: { dimension: 'Conceptual', concept: 'GCD Definition' }
    }];
    const candidate = {
      questionText: 'Using the Euclidean algorithm, what is the remainder in the first step when calculating gcd(48, 18)?',
      correctAnswer: '12',
      options: ['12', '6', '2', '0'],
      metadata: { dimension: 'Calculation', concept: 'Euclidean Algorithm Trace' }
    };
    const res = deterministicValidator.checkDuplicateQuestion(candidate, existing, candidate.metadata);
    assert.strictEqual(res.isDuplicate, false, 'Calculation question must NOT be flagged as duplicate of definition question');
  });

  test('2.2 Base-case question vs recursive invariant explanation on same topic must NOT be blocked', () => {
    const existing = [{
      questionText: 'What condition forms the base case in the recursive Euclidean algorithm implementation?',
      correctAnswer: 'b == 0',
      options: ['b == 0', 'a == 0', 'a % b == 0', 'b == 1'],
      metadata: { dimension: 'Flow / Trace', concept: 'Base Case Condition' }
    }];
    const candidate = {
      questionText: 'Why does gcd(a, b) = gcd(b, a % b) hold true mathematically at each recursive step?',
      correctAnswer: 'Any common divisor of a and b also divides their linear combination and remainder',
      options: ['Any common divisor of a and b also divides their linear combination and remainder', 'Because modulo always reduces numbers by half', 'Because recursion reverses division order', 'Because prime factorizations remain identical'],
      metadata: { dimension: 'Reasoning', concept: 'Euclidean Reduction Invariance' }
    };
    const res = deterministicValidator.checkDuplicateQuestion(candidate, existing, candidate.metadata);
    assert.strictEqual(res.isDuplicate, false, 'Distinct reasoning vs trace questions on same topic must NOT be flagged as duplicates');
  });

  test('2.3 Edge-case parameter inversion question vs numerical result must NOT be blocked', () => {
    const existing = [{
      questionText: 'What is the final return value of gcd(12, 18)?',
      correctAnswer: '6',
      options: ['6', '3', '2', '12'],
      metadata: { dimension: 'Calculation', concept: 'Euclidean Algorithm Trace' }
    }];
    const candidate = {
      questionText: 'How does the Euclidean algorithm handle an initial input where a < b (for example, gcd(18, 48))?',
      correctAnswer: 'The first modulo step produces a % b = a, cleanly swapping the parameters to gcd(48, 18)',
      options: ['The first modulo step produces a % b = a, cleanly swapping the parameters to gcd(48, 18)', 'It raises a ZeroDivisionError', 'It enters an infinite recursion loop', 'It returns 0 immediately'],
      metadata: { dimension: 'Edge Case', concept: 'Parameter Inversion' }
    };
    const res = deterministicValidator.checkDuplicateQuestion(candidate, existing, candidate.metadata);
    assert.strictEqual(res.isDuplicate, false, 'Edge-case behavior question must NOT collide with calculation question');
  });

  // ============================================================================
  // Suite 3: Defensible Capacity Scaling & Count Fulfillment
  // ============================================================================
  console.log('\n--- Suite 3: Defensible Capacity Scaling ---');

  test('3.1 Substantive lecture (>15k chars) scales capacity to support 15+ questions', () => {
    const concepts = Array.from({ length: 15 }, (_, i) => `algorithmic_facet_${i + 1}`);
    const longLectureEvidence = {
      unifiedRawContent: `Comprehensive lecture covering ` + concepts.map(c => `${c} is an essential mechanism in Euclidean recursion`).join('. ') + '. ' + 'invariance theorem remainder calculation '.repeat(500), // >15k chars
      lectureIntelligence: null,
      detectedFocus: ['Euclidean Algorithm']
    };
    const targets = [];
    for (let i = 0; i < 15; i++) {
      targets.push({
        targetId: `T${String(i + 1).padStart(2, '0')}`,
        concept: concepts[i],
        subtopic: `Section ${Math.ceil((i + 1) / 3)}`,
        dimension: i % 2 === 0 ? 'Calculation' : 'Reasoning',
        assessmentAngle: i % 2 === 0 ? 'CALCULATION' : 'REASONING',
        specificReasoningTask: `Unique task ${i + 1}`,
        targetDifficulty: 'Medium',
        supportingEvidence: `${concepts[i]} is an essential mechanism in Euclidean recursion`
      });
    }

    const { auditedTargets, auditLog } = agent1Planner._auditAssessmentTargets(targets, [], 15, longLectureEvidence);
    const capacityRejected = auditLog.rejected.filter(r => r.reason.includes('capacity reached')).length;
    assert.strictEqual(capacityRejected, 0, `Substantive lecture must not artificially reject targets due to capacity clamping. Found ${capacityRejected} capacity rejections.`);
    assert.strictEqual(auditedTargets.length, 15, `All 15 distinct targets should pass audit for substantive material, got ${auditedTargets.length}`);
  });

  test('3.2 Brief snippet (<1500 chars) honestly clamps capacity to prevent hallucination', () => {
    const briefConcepts = Array.from({ length: 10 }, (_, i) => `snippet_concept_${i + 1}`);
    const briefSnippetEvidence = {
      unifiedRawContent: `Brief snippet: ` + briefConcepts.map(c => `${c} is mentioned briefly`).join('. '), // ~350 chars
      lectureIntelligence: null,
      detectedFocus: ['Recursion']
    };
    const targets = [];
    for (let i = 0; i < 10; i++) {
      targets.push({
        targetId: `T${String(i + 1).padStart(2, '0')}`,
        concept: briefConcepts[i],
        subtopic: 'Recursion Basics',
        dimension: 'Conceptual',
        targetDifficulty: 'Easy',
        supportingEvidence: `${briefConcepts[i]} is mentioned briefly`
      });
    }

    const { auditedTargets, auditLog } = agent1Planner._auditAssessmentTargets(targets, [], 10, briefSnippetEvidence);
    const capacityRejected = auditLog.rejected.filter(r => r.reason.includes('capacity reached')).length;
    assert.ok(capacityRejected >= 5, `Brief snippet must clamp capacity and reject excess targets. Expected >= 5, got ${capacityRejected}`);
    assert.ok(auditedTargets.length <= 4, `Audited targets for brief snippet must be capped (<= 4), got ${auditedTargets.length}`);
  });

  // ============================================================================
  // Suite 4: Provider Reliability & Failover Logic
  // ============================================================================
  console.log('\n--- Suite 4: Provider Reliability & Failover ---');

  test('4.1 llmRouter has zero 120-second sleep on Groq daily TPD exhaustion', () => {
    const fs = require('fs');
    const routerSource = fs.readFileSync(path.resolve(__dirname, '../engine/adapter/llmRouter.js'), 'utf8');
    assert.strictEqual(routerSource.includes('cooldownMs = isTPD ? 120000 :'), false, '120s TPD sleep must be removed');
    assert.strictEqual(routerSource.includes('daily quota exhausted (TPD). Failing over immediately'), true, 'Must fail over immediately on TPD');
  });

  test('4.2 llmRouter single MCQ maxTokens reservation is <= 1200 tokens', () => {
    const fs = require('fs');
    const routerSource = fs.readFileSync(path.resolve(__dirname, '../engine/adapter/llmRouter.js'), 'utf8');
    assert.strictEqual(routerSource.includes('resolvedMaxTokens = 1100'), true, 'Single MCQ reservation must be 1100 tokens to protect TPM while preventing truncation');
  });

  test('4.3 Gemini fallback cascade excludes quota-exhausted gemini-pro-latest', () => {
    const fs = require('fs');
    const routerSource = fs.readFileSync(path.resolve(__dirname, '../engine/adapter/llmRouter.js'), 'utf8');
    assert.strictEqual(routerSource.includes("'gemini-pro-latest'"), false, 'gemini-pro-latest must not be in candidateModels');
    assert.strictEqual(routerSource.includes("'gemini-flash-latest'"), true, 'gemini-flash-latest must be present');
  });

  console.log(`\n======================================================`);
  console.log(`Focused Test Suite Completed: ${passed} PASSED, ${failed} FAILED`);
  console.log(`======================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
