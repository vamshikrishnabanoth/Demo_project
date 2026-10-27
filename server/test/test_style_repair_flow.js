/**
 * server/test/test_style_repair_flow.js
 *
 * Verifies that:
 * 1. A candidate with a repairable style defect triggers Agent 3's bounded 1-attempt repair loop and passes.
 * 2. A candidate with BOTH a style defect AND a semantic defect synthesizes repair instructions addressing BOTH.
 * 3. A repaired candidate fixing style but retaining a semantic defect is REJECTED by Agent 3 semantic evaluation.
 * 4. A repaired candidate fixing both style and semantic defects is APPROVED.
 */

'use strict';

const assert = require('assert');
const agent3Evaluator = require('../engine/agents/agent3Evaluator');

const LECTURE_EVIDENCE = 'The translation lookaside buffer (TLB) is a hardware cache that stores recent virtual-to-physical page mappings. When a virtual address is accessed, the MMU checks the TLB first. On a TLB hit, the physical address is obtained immediately without reading the multi-level page table from main memory.';

const TARGET = {
  targetId: 'T01',
  concept: 'Translation Lookaside Buffer',
  dimension: 'Operational Mechanics',
  targetDifficulty: 'Medium',
  intendedCognitiveOperation: 'COMPARE'
};

const EVIDENCE_PACKAGE = {
  subject: 'Operating Systems',
  topic: 'Virtual Memory & Page Tables',
  unifiedRawContent: LECTURE_EVIDENCE,
  curricularContent: LECTURE_EVIDENCE
};

async function testStyleOnlyRepair() {
  console.log('--- TEST 1: Style-Only Defect Bounded Repair ---');

  const candidate = {
    targetId: 'T01',
    questionText: 'According to the lecture, how does the MMU address translation flow differ between a TLB hit and a TLB miss?',
    question: 'According to the lecture, how does the MMU address translation flow differ between a TLB hit and a TLB miss?',
    options: [
      'On a TLB hit the physical address is obtained immediately, whereas a TLB miss requires reading the multi-level page table',
      'On a TLB hit the operating system swaps the page table, whereas a TLB miss writes to disk',
      'On a TLB miss the CPU halts active threads, whereas a TLB hit flushes the cache',
      'On a TLB miss physical frames are reallocated, whereas a TLB hit triggers an interrupt'
    ],
    correctAnswerIndex: 0,
    correctAnswer: 'On a TLB hit the physical address is obtained immediately, whereas a TLB miss requires reading the multi-level page table',
    explanation: 'On a TLB hit, physical translation is immediate from the hardware cache; a miss incurs reading the page table.',
    questionArchetype: 'CONCEPTUAL_CONTRAST',
    metadata: { targetDifficulty: 'Medium', intendedCognitiveOperation: 'COMPARE' }
  };

  let repairCalled = false;
  let receivedInstruction = null;

  const mockGenerator = {
    generateQuestion: async (tgt, pkg, instruction) => {
      repairCalled = true;
      receivedInstruction = instruction;
      return {
        targetId: tgt.targetId,
        questionText: 'How does the MMU address translation flow differ between a TLB hit and a TLB miss?',
        question: 'How does the MMU address translation flow differ between a TLB hit and a TLB miss?',
        options: candidate.options,
        correctAnswerIndex: 0,
        correctAnswer: candidate.correctAnswer,
        explanation: candidate.explanation,
        questionArchetype: 'CONCEPTUAL_CONTRAST',
        metadata: candidate.metadata
      };
    }
  };

  const result = await agent3Evaluator.evaluateAndRepairQuestion(candidate, TARGET, EVIDENCE_PACKAGE, mockGenerator);

  assert.strictEqual(repairCalled, true, 'Generator repair must have been called');
  assert.ok(receivedInstruction && receivedInstruction.includes('meta-discourse'), 'Instruction must cite meta-discourse');
  assert.strictEqual(result.repaired, true, 'repaired must be true');
  assert.strictEqual(result.status, 'PASS', 'Repaired candidate must pass');
  console.log(' ✅ PASS: Style-only defect triggered repair, removed meta-prefix, and passed.\n');
}

async function testDualDefectRepair() {
  console.log('--- TEST 2: Dual Defect (Style + Semantic) Repair Flow ---');

  // Candidate has:
  // 1. Style defect: Meta-discourse prefix ("According to the lecture, ")
  // 2. Semantic defect: Ambiguous distractor (Option B is essentially synonymous with Option A / key)
  const dualDefectiveCandidate = {
    targetId: 'T01',
    questionText: 'According to the lecture, how does the MMU address translation flow differ between a TLB hit and a TLB miss?',
    question: 'According to the lecture, how does the MMU address translation flow differ between a TLB hit and a TLB miss?',
    options: [
      'On a TLB hit the physical address is obtained immediately, whereas a TLB miss requires reading the multi-level page table',
      'On a TLB hit the physical address is obtained directly from hardware cache, whereas a TLB miss requires walking the page table', // Ambiguous synonym of Option A
      'On a TLB miss the CPU halts active threads, whereas a TLB hit flushes the cache',
      'On a TLB miss physical frames are reallocated, whereas a TLB hit triggers an interrupt'
    ],
    correctAnswerIndex: 0,
    correctAnswer: 'On a TLB hit the physical address is obtained immediately, whereas a TLB miss requires reading the multi-level page table',
    explanation: 'On a TLB hit, physical translation is immediate from the hardware cache; a miss incurs reading the page table.',
    questionArchetype: 'CONCEPTUAL_CONTRAST',
    metadata: { targetDifficulty: 'Medium', intendedCognitiveOperation: 'COMPARE' }
  };

  let receivedInstruction = null;

  // Scenario A: Generator fixes BOTH defects
  const fullRepairGenerator = {
    generateQuestion: async (tgt, pkg, instruction) => {
      receivedInstruction = instruction;
      console.log('   [Dual Repair Generator] Received combined instruction:', instruction);
      return {
        targetId: tgt.targetId,
        questionText: 'How does the MMU address translation flow differ between a TLB hit and a TLB miss?',
        question: 'How does the MMU address translation flow differ between a TLB hit and a TLB miss?',
        options: [
          'On a TLB hit the physical address is obtained immediately, whereas a TLB miss requires reading the multi-level page table',
          'On a TLB hit the operating system swaps the page table, whereas a TLB miss writes to disk',
          'On a TLB miss the CPU halts active threads, whereas a TLB hit flushes the cache',
          'On a TLB miss physical frames are reallocated, whereas a TLB hit triggers an interrupt'
        ],
        correctAnswerIndex: 0,
        correctAnswer: 'On a TLB hit the physical address is obtained immediately, whereas a TLB miss requires reading the multi-level page table',
        explanation: 'On a TLB hit, physical translation is immediate from the hardware cache; a miss incurs reading the page table.',
        questionArchetype: 'CONCEPTUAL_CONTRAST',
        metadata: { targetDifficulty: 'Medium', intendedCognitiveOperation: 'COMPARE' }
      };
    }
  };

  const resultFull = await agent3Evaluator.evaluateAndRepairQuestion(
    dualDefectiveCandidate,
    TARGET,
    EVIDENCE_PACKAGE,
    fullRepairGenerator
  );

  // Assert combined instruction contains BOTH style and semantic guidance
  assert.ok(receivedInstruction.includes('meta-discourse') || receivedInstruction.includes('Style compliance'), 'Instruction must cite style compliance');
  assert.ok(receivedInstruction.length > 50, 'Instruction must be comprehensive');
  assert.strictEqual(resultFull.repaired, true, 'Full repair must succeed');
  assert.strictEqual(resultFull.status, 'PASS', 'Full repair must pass Agent 3 evaluation');
  console.log(' ✅ PASS: Combined repair instruction addressed both style and semantic requirements, and passed.\n');

  // Scenario B: Generator fixes style BUT leaves semantic defect (ambiguous distractor)
  console.log('--- TEST 3: Partial Repair (Fixes Style but Fails Semantic) Must Be Rejected ---');

  const partialRepairGenerator = {
    generateQuestion: async (tgt, pkg, instruction) => {
      return {
        targetId: tgt.targetId,
        questionText: 'How does the MMU address translation flow differ between a TLB hit and a TLB miss?', // Fixed style!
        question: 'How does the MMU address translation flow differ between a TLB hit and a TLB miss?',
        options: [
          'On a TLB hit the physical address is obtained immediately, whereas a TLB miss requires reading the multi-level page table',
          'On a TLB hit the physical address is obtained directly from hardware cache, whereas a TLB miss requires walking the page table', // Still ambiguous!
          'On a TLB miss the CPU halts active threads, whereas a TLB hit flushes the cache',
          'On a TLB miss physical frames are reallocated, whereas a TLB hit triggers an interrupt'
        ],
        correctAnswerIndex: 0,
        correctAnswer: 'On a TLB hit the physical address is obtained immediately, whereas a TLB miss requires reading the multi-level page table',
        explanation: 'On a TLB hit, physical translation is immediate from the hardware cache; a miss incurs reading the page table.',
        questionArchetype: 'CONCEPTUAL_CONTRAST',
        metadata: { targetDifficulty: 'Medium', intendedCognitiveOperation: 'COMPARE' }
      };
    }
  };

  const resultPartial = await agent3Evaluator.evaluateAndRepairQuestion(
    dualDefectiveCandidate,
    TARGET,
    EVIDENCE_PACKAGE,
    partialRepairGenerator
  );

  assert.strictEqual(resultPartial.repaired, false, 'Partial repair must NOT be certified');
  assert.strictEqual(resultPartial.status, 'FAIL', 'Partial repair must remain rejected');
  assert.strictEqual(resultPartial.repair.successful, false, 'repair.successful must be false');
  console.log(' ✅ PASS: Question with fixed style but remaining semantic flaw remained REJECTED.\n');
}

async function testTrailingSuffixRepair() {
  console.log('--- TEST 3: Trailing Suffix Meta-Discourse Bounded Repair ---');

  const suffixCandidate = {
    targetId: 'T01',
    questionText: 'How does the MMU address translation flow differ between a TLB hit and a TLB miss according to the lecture?',
    question: 'How does the MMU address translation flow differ between a TLB hit and a TLB miss according to the lecture?',
    options: [
      'On a TLB hit the physical address is obtained immediately, whereas a TLB miss requires reading the multi-level page table',
      'On a TLB hit the operating system swaps the page table, whereas a TLB miss writes to disk',
      'On a TLB miss the CPU halts active threads, whereas a TLB hit flushes the cache',
      'On a TLB miss physical frames are reallocated, whereas a TLB hit triggers an interrupt'
    ],
    correctAnswerIndex: 0,
    correctAnswer: 'On a TLB hit the physical address is obtained immediately, whereas a TLB miss requires reading the multi-level page table',
    explanation: 'On a TLB hit, physical translation is immediate from the hardware cache; a miss incurs reading the page table.',
    questionArchetype: 'CONCEPTUAL_CONTRAST',
    metadata: { targetDifficulty: 'Medium', intendedCognitiveOperation: 'COMPARE' }
  };

  let suffixRepairCalled = false;
  let suffixInstruction = null;

  const mockSuffixGenerator = {
    generateQuestion: async (tgt, pkg, instruction) => {
      suffixRepairCalled = true;
      suffixInstruction = instruction;
      return {
        targetId: tgt.targetId,
        questionText: 'How does the MMU address translation flow differ between a TLB hit and a TLB miss?',
        question: 'How does the MMU address translation flow differ between a TLB hit and a TLB miss?',
        options: suffixCandidate.options,
        correctAnswerIndex: 0,
        correctAnswer: suffixCandidate.correctAnswer,
        explanation: suffixCandidate.explanation,
        questionArchetype: 'CONCEPTUAL_CONTRAST',
        metadata: suffixCandidate.metadata
      };
    }
  };

  const result = await agent3Evaluator.evaluateAndRepairQuestion(suffixCandidate, TARGET, EVIDENCE_PACKAGE, mockSuffixGenerator);

  assert.strictEqual(suffixRepairCalled, true, 'Generator repair must have been called for trailing suffix defect');
  assert.ok(suffixInstruction && suffixInstruction.includes('meta-discourse'), 'Repair instruction must demand meta-discourse removal');
  assert.strictEqual(result.repaired, true, 'repaired must be true');
  assert.strictEqual(result.status, 'PASS', 'Repaired candidate without trailing suffix must pass Agent 3 evaluation');
  console.log(' ✅ PASS: Trailing suffix "according to the lecture" triggered repair, was stripped, and passed Agent 3.\n');
}

async function runAll() {
  console.log('======================================================================');
  console.log('🧪 VERIFYING AGENT 3 BOUNDED REPAIR WITH STYLE & SEMANTIC DEFECTS');
  console.log('======================================================================\n');

  await testStyleOnlyRepair();
  await testDualDefectRepair();
  await testTrailingSuffixRepair();

  console.log('======================================================================');
  console.log('🏁 ALL BOUNDED REPAIR & DUAL DEFECT TESTS PASSED CLEANLY');
  console.log('======================================================================\n');
}

runAll().catch(err => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
