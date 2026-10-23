/**
 * server/test/test_audit_failure_prevention.js
 * 
 * Verifies that the specific defects identified in the external ChatGPT audit
 * (duplicate/permuted options, synonymous choices, distractor-correctAnswer collisions)
 * are deterministically blocked and rejected by our validation gates.
 */

const assert = require('assert');
const deterministicValidator = require('../engine/validators/deterministicValidator');
const difficultyAwareDistractorValidator = require('../engine/validators/difficultyAwareDistractorValidator');

console.log('======================================================================');
console.log('🧪 RUNNING AUDIT DEFECT PREVENTION TEST SUITE');
console.log('======================================================================\n');

// ─────────────────────────────────────────────────────────────────────────────
// Test 1: Permuted Duplicate Options (Exact Audio+PDF Q1 failure mode)
// ─────────────────────────────────────────────────────────────────────────────
const q1Candidate = {
  questionText: 'Which of the following lists all four advantages of inter-process communication as described in the lecture?',
  options: [
    'Modularity, resource isolation, fault tolerance, and scalability',
    'Message passing, shared memory, sockets, and pipes',
    'Information sharing, modularity, computational speed-up, and convenience',
    'Convenience, computational speed-up, modularity, information sharing'
  ],
  correctAnswer: 'Information sharing, modularity, computational speed-up, and convenience'
};

const pre1 = deterministicValidator.runPreChecks(q1Candidate);
assert.strictEqual(pre1.isValid, false, 'Pre-check should reject question with permuted options');
const hasPermutedError = pre1.errors.some(e => e.includes('Permuted duplicate'));
assert.strictEqual(hasPermutedError, true, 'Pre-check should report permuted duplicate error');
console.log('✅ PASS [1]: Audio+PDF Q1 Permuted options (C vs D) blocked by deterministicValidator');

// ─────────────────────────────────────────────────────────────────────────────
// Test 2: Synonymous Options (High Token Overlap >= 75%)
// ─────────────────────────────────────────────────────────────────────────────
const q2Candidate = {
  questionText: 'What is the primary role of a semaphore in concurrent execution?',
  options: [
    'A synchronization primitive that controls access to a shared resource',
    'A synchronization mechanism that manages access to a shared resource',
    'A file system directory entry for inter-process communication',
    'A CPU scheduling algorithm for real-time task priorities'
  ],
  correctAnswer: 'A synchronization primitive that controls access to a shared resource'
};

const pre2 = deterministicValidator.runPreChecks(q2Candidate);
assert.strictEqual(pre2.isValid, false, 'Pre-check should reject options with 75%+ vocabulary overlap');
const hasSynonymError = pre2.errors.some(e => e.includes('Synonymous duplicate') || e.includes('Permuted duplicate'));
assert.strictEqual(hasSynonymError, true, 'Pre-check should report synonymous duplicate error');
console.log('✅ PASS [2]: High vocabulary overlap synonymous choices blocked');

// ─────────────────────────────────────────────────────────────────────────────
// Test 3: Distractor matching correct answer in permuted order
// ─────────────────────────────────────────────────────────────────────────────
assert.throws(() => {
  deterministicValidator.normalizeSemanticMCQ({
    questionText: 'Test question stem',
    options: ['Alpha Beta Gamma Delta', 'Delta Gamma Beta Alpha', 'Omega Sigma Pi Tau', 'One Two Three Four'],
    correctAnswer: 'Alpha Beta Gamma Delta'
  });
}, /KEY_ASSIGNMENT_INTEGRITY_ERROR/, 'Should throw when a distractor is a permuted duplicate of correct answer');
console.log('✅ PASS [3]: Distractor matching correct answer in permuted order triggers KEY_ASSIGNMENT_INTEGRITY_ERROR');

// ─────────────────────────────────────────────────────────────────────────────
// Test 4: DifficultyAwareDistractorValidator catches permuted/synonymous choices across all 4 options
// ─────────────────────────────────────────────────────────────────────────────
const dadRes = difficultyAwareDistractorValidator.validate(q1Candidate, 'Medium');
assert.strictEqual(dadRes.verdict, 'REPAIR', 'Distractor fitness should flag REPAIR for synonymous options');
assert.strictEqual(dadRes.flaws.some(f => f.code === 'SYNONYMOUS_DISTRACTORS'), true, 'Should detect SYNONYMOUS_DISTRACTORS flaw');
console.log('✅ PASS [4]: DifficultyAwareDistractorValidator detects SYNONYMOUS_DISTRACTORS');

// ─────────────────────────────────────────────────────────────────────────────
// Test 5: Clean, legitimate question passes all gates cleanly
// ─────────────────────────────────────────────────────────────────────────────
const cleanCandidate = {
  questionText: 'Which system call in UNIX is specifically used to create a new shared memory segment or access an existing one?',
  options: [
    'shmget',
    'shmat',
    'shmdt',
    'shmctl'
  ],
  correctAnswer: 'shmget'
};

const preClean = deterministicValidator.runPreChecks(cleanCandidate);
assert.strictEqual(preClean.isValid, true, 'Clean question must pass pre-checks');
console.log('✅ PASS [5]: Clean, distinct technical choices pass with zero false positives');

console.log('\n======================================================================');
console.log('🏁 ALL 5 AUDIT FAILURE PREVENTION TESTS PASSED CLEANLY');
console.log('======================================================================\n');
