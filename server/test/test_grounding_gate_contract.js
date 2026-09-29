/**
 * server/test/test_grounding_gate_contract.js
 *
 * Dedicated Contract Verification Suite for GroundingGate:
 * - 12 Discrete Contract & Adversarial Assertions (T1 - T12)
 * - Tests mathematical/discrete facts preservation
 * - Tests guarded morphological candidate matching without destructive stemming
 * - Tests question scaffolding separation
 * - Tests adversarial numeric injection defenses
 * - Tests strict cross-domain contamination rejections
 * - Invariant: Zero hardcoded domain indicators in groundingGate.js
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const groundingGate = require('../engine/validators/groundingGate');

console.log('======================================================================');
console.log('🧪 DEDICATED GROUNDING GATE CONTRACT & ADVERSARIAL SUITE');
console.log('======================================================================\n');

let totalTests = 0;
let passedTests = 0;

function record(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(` ✅ PASS [${totalTests}]: ${name}`);
  } catch (err) {
    console.error(` ❌ FAIL [${totalTests}]: ${name}`);
    console.error(`    Error: ${err.message}\n`);
    throw err;
  }
}

// ──────────────────────────────────────────────────────────────────────────
// TEST EVIDENCE FIXTURES
// ──────────────────────────────────────────────────────────────────────────

const osEvidence = {
  unifiedRawContent: 'In modern operating systems, CPU scheduling determines which process runs when multiple processes are in the ready state. The kernel performs a context switch by saving the program counter, registers, and stack pointer of the currently running process to its process control block (PCB), and loading the saved state of the next selected process. Scheduling algorithms include First-Come-First-Served (FCFS), Shortest Job First (SJF), and Round Robin (RR) with a time quantum. Virtual memory uses paging to map virtual addresses to physical frames. When a requested page is not in physical memory, the memory management unit triggers a page fault interrupt, prompting the operating system to retrieve the page from secondary storage. Deadlocks can occur when four conditions hold simultaneously: mutual exclusion, hold and wait, no preemption, and circular wait.'
};

const dsaVoicePath = path.resolve(__dirname, '../../../../Speech_To_Text/results/transcripts/deepgram_deepa_madam.txt');
let dsaVoiceText = '';
if (fs.existsSync(dsaVoicePath)) {
  dsaVoiceText = fs.readFileSync(dsaVoicePath, 'utf8').substring(0, 10000);
} else {
  dsaVoiceText = 'So is 24 modulo eight equal equal to zero? Yes. Now what is the condition here? If I modulo a equal equal to zero and I modulo b is equal equal to zero, return I. Now for both the things, right recursion. Convert this into recursion. Write the second one. It will be your base condition in this case. And then you will increment what? A always. Until a does not reach a bigger point where it is getting divided by b. This is your LCM.';
}

const dsaEvidence = {
  unifiedRawContent: dsaVoiceText
};

const biologyEvidence = {
  unifiedRawContent: 'General biology studies living organisms, cellular respiration, photosynthesis, and natural selection across diverse ecosystems.'
};

// ──────────────────────────────────────────────────────────────────────────
// 1. VALID GROUNDED QUESTIONS (FALSE POSITIVE RECOVERIES)
// ──────────────────────────────────────────────────────────────────────────

record('T1: Math Fact - 24 modulo 8 = 0 passes against BENCH_03 speech evidence', () => {
  const q = {
    questionText: 'According to the evidence, what is the result of the expression 24 modulo 8?',
    correctAnswer: '0',
    options: ['0', '2', '4', '8']
  };
  const res = groundingGate.verifyQuizGrounding([q], dsaEvidence);
  assert.strictEqual(res.status, 'PASSED', '24 modulo 8 = 0 must pass when taught verbatim');
  assert.strictEqual(res.validatedQuestions.length, 1);
});

record('T2: Algorithmic Inflection - Converting loop to recursive condition passes', () => {
  const q = {
    questionText: 'When converting the iterative LCM search into a recursive function, what is the specific upper bound condition established for the variable a to terminate the recursion?',
    correctAnswer: 'a reaches a value where it is divisible by b',
    options: [
      'a reaches 100',
      'a reaches a value where it is divisible by b',
      'a reaches the product of a and b',
      'a reaches the sum of a and b'
    ]
  };
  const res = groundingGate.verifyQuizGrounding([q], dsaEvidence);
  assert.strictEqual(res.status, 'PASSED', 'Morphologically inflected question with core domain support must pass');
  assert.strictEqual(res.validatedQuestions.length, 1);
});

record('T3: Scaffolding Isolation - Question heavily wrapped in prompt meta-words passes cleanly', () => {
  const q = {
    questionText: 'According to the evidence, determine which statement describes the primary result of CPU scheduling inside the operating system kernel?',
    correctAnswer: 'Deciding which ready process executes next on the CPU',
    options: [
      'Deciding which ready process executes next on the CPU',
      'Managing physical page allocation',
      'Flushing the translation lookaside buffer',
      'Encrypting data transfer'
    ]
  };
  const res = groundingGate.verifyQuizGrounding([q], osEvidence);
  assert.strictEqual(res.status, 'PASSED', 'Heavy scaffolding must not penalize legitimate grounding');
  assert.strictEqual(res.validatedQuestions.length, 1);
});

record('T5: Word Ending Protection - Protected technical nouns (process, address, status, bus) remain intact', () => {
  const q = {
    questionText: 'How does the process control block update virtual address mappings for a process?',
    correctAnswer: 'By saving process state and address pointers',
    options: ['By saving process state and address pointers', 'By resetting status registers', 'By clearing memory bus', 'By halting CPU clock']
  };
  const res = groundingGate.verifyQuizGrounding([q], osEvidence);
  assert.strictEqual(res.status, 'PASSED', 'Protected technical words ending in -ss or -us must not be mangled');
  assert.strictEqual(res.validatedQuestions.length, 1);
});

record('T12: Natural Phrasing Immunity - Legitimate phrasing variation with strong domain anchors passes', () => {
  const q = {
    questionText: 'How does the operating system kernel resolve a virtual memory translation request?',
    correctAnswer: 'By mapping virtual addresses to physical frames using paging',
    options: [
      'By mapping virtual addresses to physical frames using paging',
      'By restarting the CPU scheduler',
      'By terminating secondary storage tasks',
      'By clearing the interrupt vector table'
    ]
  };
  const res = groundingGate.verifyQuizGrounding([q], osEvidence);
  assert.strictEqual(res.status, 'PASSED', 'Natural pedagogical phrasing with strong domain anchors must pass');
  assert.strictEqual(res.validatedQuestions.length, 1);
});

// ──────────────────────────────────────────────────────────────────────────
// 2. ADVERSARIAL CONTAMINATION DEFENSES (FALSE NEGATIVE PREVENTION)
// ──────────────────────────────────────────────────────────────────────────

record('T4: Adversarial Numeric Injection - Foreign React question with numbers fails against OS', () => {
  const q = {
    questionText: 'In React 18, why does the useEffect hook trigger state updates at 0 ms intervals?',
    correctAnswer: 'To synchronize external component state',
    options: ['To synchronize external component state', 'To bypass rendering', 'To clear virtual frames', 'To halt scheduler']
  };
  const res = groundingGate.verifyQuizGrounding([q], osEvidence);
  assert.strictEqual(res.status, 'FAILED', 'Incidental numbers (18, 0) must not allow foreign React topic to pass');
  assert.strictEqual(res.rejectedCount, 1);
});

record('T6: False Morphological Collision - Microbiology fails against general biology evidence', () => {
  const q = {
    questionText: 'In advanced microbiology, what is the role of bacteriophage transduction in horizontal gene transfer?',
    correctAnswer: 'Transferring bacterial DNA between host cells via viral vectors',
    options: ['Transferring bacterial DNA between host cells via viral vectors', 'Facilitating cellular respiration', 'Catalyzing natural selection', 'Promoting photosynthesis']
  };
  const res = groundingGate.verifyQuizGrounding([q], biologyEvidence);
  assert.strictEqual(res.status, 'FAILED', 'Microbiology cannot pass against general biology through partial root matching');
  assert.strictEqual(res.rejectedCount, 1);
});

record('T7: Cross-Domain Contamination - React Lifecycle Hooks fail against OS evidence', () => {
  const q = {
    questionText: 'In modern React applications, which lifecycle hook or effect hook should be invoked to manage state synchronization inside a component?',
    correctAnswer: 'useEffect hook with dependency array',
    options: ['useEffect hook with dependency array', 'useState hook', 'useContext hook', 'useReducer hook']
  };
  const res = groundingGate.verifyQuizGrounding([q], osEvidence);
  assert.strictEqual(res.status, 'FAILED', 'React hooks must be unconditionally rejected against OS evidence');
  assert.strictEqual(res.rejectedCount, 1);
});

record('T8: Cross-Domain Contamination - Biochemistry PCR amplification fails against CS evidence', () => {
  const q = {
    questionText: 'Which enzyme catalyzes DNA replication during PCR amplification in molecular genetics?',
    correctAnswer: 'Taq DNA polymerase',
    options: ['Taq DNA polymerase', 'RNA helicase', 'DNA ligase', 'Reverse transcriptase']
  };
  const res = groundingGate.verifyQuizGrounding([q], osEvidence);
  assert.strictEqual(res.status, 'FAILED', 'Biochemistry PCR question must be rejected against CS evidence');
  assert.strictEqual(res.rejectedCount, 1);
});

record('T9: Cross-Domain Contamination - MongoDB aggregation pipeline fails against OS evidence', () => {
  const q = {
    questionText: 'When optimizing a MongoDB aggregation pipeline for 1,000,000 documents, where should the $match stage be placed?',
    correctAnswer: 'At the beginning of the pipeline',
    options: ['At the beginning of the pipeline', 'Inside $group', 'At the end', 'Inside $project']
  };
  const res = groundingGate.verifyQuizGrounding([q], osEvidence);
  assert.strictEqual(res.status, 'FAILED', 'MongoDB aggregation question must be rejected against OS evidence');
  assert.strictEqual(res.rejectedCount, 1);
});

record('T10: Cross-Domain Contamination - TCP Networking fails against OS evidence', () => {
  const q = {
    questionText: 'What is the primary role of the TCP three-way handshake SYN ACK exchange before data transmission?',
    correctAnswer: 'Establish sequence numbers and synchronize connection parameters between sender and receiver',
    options: ['Establish sequence numbers and synchronize connection parameters between sender and receiver', 'Encrypt the payload using TLS', 'Route packets across autonomous systems', 'Allocate bandwidth at the router']
  };
  const res = groundingGate.verifyQuizGrounding([q], osEvidence);
  assert.strictEqual(res.status, 'FAILED', 'TCP networking question must be rejected against OS evidence');
  assert.strictEqual(res.rejectedCount, 1);
});

record('T11: Invariant - Zero hardcoded domain indicators in groundingGate.js source', () => {
  const src = fs.readFileSync(path.join(__dirname, '../engine/validators/groundingGate.js'), 'utf8');
  const forbiddenPatterns = [
    'foreignIndicators',
    'mongodb',
    'mongoose',
    'nosql',
    "'$match'",
    "'$group'",
    "'$project'",
    'react',
    'useeffect'
  ];

  for (const pattern of forbiddenPatterns) {
    const hasPattern = src.toLowerCase().includes(pattern.toLowerCase());
    assert.strictEqual(
      hasPattern,
      false,
      `groundingGate.js must not contain hardcoded domain pattern: "${pattern}"`
    );
  }
});

console.log('\n======================================================================');
console.log(` 🏁 RESULT: ${passedTests} / ${totalTests} TESTS PASSED CLEANLY`);
console.log('======================================================================\n');
