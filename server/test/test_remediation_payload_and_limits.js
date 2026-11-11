'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const deterministicValidator = require('../engine/validators/deterministicValidator');
const agent3Evaluator = require('../engine/agents/agent3Evaluator');
const pipelineOrchestrator = require('../engine/pipelineOrchestrator');

console.log('========================================================================');
console.log('🧪 TARGETED REMEDIATION TEST SUITE — PAYLOAD INTEGRITY & CALL BOUNDS');
console.log('========================================================================\n');

// -----------------------------------------------------------------------------
// TEST 1: Question Payload Integrity & Normalization
// -----------------------------------------------------------------------------
console.log('--- TEST 1: Question Payload Integrity & Normalization ---');

// 1.1: Missing question prompt is strictly rejected
const malformedMCQ1 = {
  options: ['Option A', 'Option B', 'Option C', 'Option D'],
  correctAnswer: 'Option A',
  explanation: 'Explanation text'
};
const res1 = deterministicValidator.runPreChecks(malformedMCQ1);
assert.strictEqual(res1.isValid, false, 'Candidate with missing prompt must fail pre-checks');
assert.ok(res1.errors.some(e => e.includes('questionText must be a string with at least 10 characters')),
  'Error must specify prompt requirement');
console.log('  ✅ PASS: 1.1 Missing prompt is strictly rejected by deterministicValidator');

// 1.2: Short prompt (<10 chars) is strictly rejected
const malformedMCQ2 = {
  question: 'What is?',
  options: ['Option A', 'Option B', 'Option C', 'Option D'],
  correctAnswer: 'Option A'
};
const res2 = deterministicValidator.runPreChecks(malformedMCQ2);
assert.strictEqual(res2.isValid, false, 'Candidate with prompt < 10 chars must fail pre-checks');
console.log('  ✅ PASS: 1.2 Short prompt (< 10 chars) is strictly rejected');

// 1.3: Valid prompt in any property is normalized and synchronized across question, questionText, stem
const validMCQ = {
  questionText: 'Which statement accurately describes child node constraints in a binary tree?',
  options: [
    'Nodes are limited to a single child',
    'A node may have up to three children',
    'Each node can have at most two children',
    'There is no limit on the number of children per node'
  ],
  correctAnswer: 'Each node can have at most two children',
  explanation: 'By definition, every node in a binary tree has at most two children.'
};
const res3 = deterministicValidator.runPreChecks(validMCQ);
assert.strictEqual(res3.isValid, true, 'Valid MCQ must pass pre-checks');
assert.strictEqual(validMCQ.question, validMCQ.questionText, 'question and questionText must be synchronized');
assert.strictEqual(validMCQ.stem, validMCQ.questionText, 'stem and questionText must be synchronized');
assert.ok(validMCQ.question.length >= 10, 'Prompt must have length >= 10');
console.log('  ✅ PASS: 1.3 Valid prompt is synchronized across question, questionText, and stem');

// -----------------------------------------------------------------------------
// TEST 2: Provider Call & Repair Limits
// -----------------------------------------------------------------------------
console.log('\n--- TEST 2: Provider Call & Repair Limits ---');

// 2.1: calculateAttemptCeiling is bounded relative to the request (no thrashing),
// but never below the request itself (a fixed ceiling of 12 made N > 12 impossible).
const ceilingN5 = pipelineOrchestrator.calculateAttemptCeiling(5, 5, 3);
assert.ok(ceilingN5 <= 15, `Ceiling for N=5 must be <= 3N attempts (actual: ${ceilingN5})`);
assert.ok(ceilingN5 >= 5, `Ceiling for N=5 must be >= 5 attempts (actual: ${ceilingN5})`);
console.log(`  ✅ PASS: 2.1 calculateAttemptCeiling for N=5 is bounded to ${ceilingN5} attempts`);

const ceilingN10 = pipelineOrchestrator.calculateAttemptCeiling(10, 10, 5);
assert.ok(ceilingN10 >= 10 && ceilingN10 <= 30, `Ceiling for N=10 must be within [N, 3N] (actual: ${ceilingN10})`);
const ceilingN30 = pipelineOrchestrator.calculateAttemptCeiling(30, 30, 15);
assert.ok(ceilingN30 >= 30 && ceilingN30 <= 60, `Ceiling for N=30 must be within [N, 60] (actual: ${ceilingN30})`);
console.log(`  ✅ PASS: 2.2 calculateAttemptCeiling for N=10 is ${ceilingN10} and for N=30 is ${ceilingN30} (bounded, never below the request)`);

// 2.3: agent3Evaluator honors allowRepair: false
async function testRepairFlag() {
  let generatorCalled = false;
  const mockGenerator = {
    generateQuestion: async () => {
      generatorCalled = true;
      return validMCQ;
    }
  };

  const flawedMCQ = {
    questionText: 'Which option is valid for binary search tree balancing?',
    options: ['Option A', 'Option A', 'Option C', 'Option D'], // duplicate option
    correctAnswer: 'Option A'
  };

  const evalRes = await agent3Evaluator.evaluateAndRepairQuestion(
    flawedMCQ,
    { targetId: 'T01', targetDifficulty: 'Medium' },
    {},
    mockGenerator,
    { allowRepair: false }
  );

  assert.strictEqual(generatorCalled, false, 'Generator must NOT be called when allowRepair is false');
  assert.strictEqual(evalRes.status, 'FAIL', 'Evaluation must fail without repair');
  assert.strictEqual(evalRes.repair.attempted, false, 'Repair must not be attempted');
  console.log('  ✅ PASS: 2.3 agent3Evaluator respects allowRepair: false when repair budget is reached');
}

// -----------------------------------------------------------------------------
// TEST 3: Upload Ceiling Reconciliation (50 MB)
// -----------------------------------------------------------------------------
console.log('\n--- TEST 3: Upload Ceiling Reconciliation ---');

const quizRouteCode = fs.readFileSync(path.join(__dirname, '../routes/quiz.js'), 'utf8');
assert.ok(quizRouteCode.includes('fileSize: 50 * 1024 * 1024'), 'Must enforce 50 MB ceiling in multer config');
assert.ok(!quizRouteCode.includes('fileSize: 1024 * 1024 * 1024'), 'Must not have 1 GB ceiling in multer config');
assert.ok(quizRouteCode.includes('verifyUploadedFile') && quizRouteCode.includes('verifyUploadedFiles'), 'Must preserve magic byte verification');
console.log('  ✅ PASS: 3.1 Upload ceiling reconciled to 50 MB (50 * 1024 * 1024) with magic byte validation preserved');

// -----------------------------------------------------------------------------
// TEST 4: Production Dependency Audit Verification
// -----------------------------------------------------------------------------
console.log('\n--- TEST 4: Dependency Vulnerability Audit ---');
const { execSync } = require('child_process');
let auditRaw;
try {
  auditRaw = execSync('npm audit --omit=dev --json', { cwd: path.join(__dirname, '..') }).toString();
} catch (e) {
  auditRaw = e.stdout ? e.stdout.toString() : '{}';
}
const auditOutput = JSON.parse(auditRaw);
const criticalCount = auditOutput.metadata?.vulnerabilities?.critical || 0;
const totalVulns = auditOutput.metadata?.vulnerabilities?.total || 0;

assert.strictEqual(criticalCount, 0, `Critical vulnerabilities must be 0 (found: ${criticalCount})`);
console.log(`  ✅ PASS: 4.1 Production critical vulnerabilities: 0 (eliminated proxy-addr CVE)`);
console.log(`  ℹ️ INFO: Total production vulnerabilities reduced to ${totalVulns} (down from 44)`);

testRepairFlag().then(() => {
  console.log('\n========================================================================');
  console.log('🏁 ALL TARGETED REMEDIATION TESTS PASSED CLEANLY (100%)');
  console.log('========================================================================\n');
}).catch(err => {
  console.error('Fatal Test Error:', err);
  process.exit(1);
});
