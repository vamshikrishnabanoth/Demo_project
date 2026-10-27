/**
 * server/test/test_adversarial_evaluator.js
 *
 * Verifies that a stylistically perfect candidate MCQ with an incorrect key
 * and an accidental correct distractor is rejected by Agent 3's real quality gates.
 */

'use strict';

const assert = require('assert');
const kmitStyleContract = require('../config/kmitStyleContract');
const agent3Evaluator = require('../engine/agents/agent3Evaluator');

async function runAdversarialTest() {
  console.log('======================================================================');
  console.log('🧪 RUNNING ADVERSARIAL EVALUATION GATE EXPERIMENT');
  console.log('======================================================================\n');

  const adversarialMCQ = {
    targetId: 'T01',
    questionText: 'When a virtual address translation triggers a page fault in physical memory, which kernel mechanism immediately resolves the missing frame allocation?',
    question: 'When a virtual address translation triggers a page fault in physical memory, which kernel mechanism immediately resolves the missing frame allocation?',
    options: [
      'Demand paging handler allocates an available physical frame',
      'Direct memory access controller bypasses system bus latency',
      'Kernel scheduler initiates speculative branch execution trace',
      'Translation lookaside buffer writes dirty cache lines back'
    ],
    correctAnswerIndex: 1,
    correctAnswer: 'Direct memory access controller bypasses system bus latency',
    explanation: 'The DMA controller bypasses bus latency during memory access.',
    questionArchetype: 'CONCEPTUAL_CONTRAST',
    metadata: {
      targetDifficulty: 'Medium',
      intendedCognitiveOperation: 'COMPARE'
    }
  };

  const target = {
    targetId: 'T01',
    concept: 'Page Fault Resolution',
    dimension: 'Operational Mechanics',
    targetDifficulty: 'Medium',
    intendedCognitiveOperation: 'COMPARE'
  };

  const lectureEvidence = 'Virtual memory allows an operating system to execute processes that require more memory than is physically available. When a CPU references a virtual address whose page table entry has the valid bit set to 0, a page fault exception occurs. The operating system kernel\'s demand paging handler handles the page fault by allocating an available physical memory frame, loading the requested page from disk into that frame, and updating the page table entry.';

  const evidencePackage = {
    subject: 'Operating Systems',
    topic: 'Virtual Memory & Page Tables',
    unifiedRawContent: lectureEvidence,
    curricularContent: lectureEvidence
  };

  // Step 1: Check with Style Heuristics
  const styleResult = kmitStyleContract.checkStyleHeuristics(adversarialMCQ);
  console.log('1. Style Heuristic Audit:');
  console.log(`   • passesStyle: ${styleResult.passesStyle}`);
  console.log(`   • issues: ${JSON.stringify(styleResult.issues)}`);
  console.log(`   • warnings: ${JSON.stringify(styleResult.warnings)}`);
  assert.strictEqual(styleResult.passesStyle, true, 'Adversarial question must pass style checks (form is clean)');

  // Step 2: Run Real Agent 3 Evaluator
  console.log('\n2. Executing Real Agent 3 Evaluator against Candidate...');
  const evalResult = await agent3Evaluator.evaluateQuestion(adversarialMCQ, target, evidencePackage);
  console.log('   • status:', evalResult.status);
  console.log('   • passed:', evalResult.passed);
  console.log('   • verdict:', evalResult.verdict);
  console.log('   • failureReasons:', JSON.stringify(evalResult.failureReasons));
  console.log('   • failureReason:', evalResult.failureReason);
  console.log('   • verificationMethod:', evalResult.verificationMethod);
  console.log('   • evidenceGrounding:', JSON.stringify(evalResult.evidenceGrounding));

  assert.strictEqual(evalResult.passed, false, 'Adversarial question MUST fail Agent 3 evaluation!');
  assert.notStrictEqual(evalResult.status, 'PASS', 'Status must not be PASS');
  console.log('\n✅ VERIFIED: Stylistically clean question was REJECTED by real evaluator gates!');
  console.log('======================================================================\n');
}

runAdversarialTest().catch(err => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
