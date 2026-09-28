/**
 * server/test_grounding_gate_generalization.js
 *
 * Dedicated verification suite for Phase 2.1:
 * - Domain De-contamination (Removal of hardcoded MongoDB indicators)
 * - Evidence-based foreign anchor detection
 * - Negative controls for legitimate technical terms (process, scheduler, kernel, memory)
 * - Mixed-phrasing negative controls
 * - Cross-domain contamination tests (MongoDB, Biochemistry, React, TCP Networking)
 * - Invariant: Zero domain-specific hardcoded keywords in validator source code
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const groundingGate = require('./engine/validators/groundingGate');

console.log('======================================================================');
console.log('🧪 GROUNDING GATE DOMAIN DE-CONTAMINATION & GENERALIZATION (PHASE 2.1)');
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
// TEST EVIDENCE CORPUS
// ──────────────────────────────────────────────────────────────────────────

const osEvidence = {
  unifiedRawContent: `In modern operating systems, CPU scheduling determines which process runs when multiple processes are in the ready state. The kernel performs a context switch by saving the program counter, registers, and stack pointer of the currently running process to its process control block (PCB), and loading the saved state of the next selected process. Scheduling algorithms include First-Come-First-Served (FCFS), Shortest Job First (SJF), and Round Robin (RR) with a time quantum. Virtual memory uses paging to map virtual addresses to physical frames. When a requested page is not in physical memory, the memory management unit triggers a page fault interrupt, prompting the operating system to retrieve the page from secondary storage. Deadlocks can occur when four conditions hold simultaneously: mutual exclusion, hold and wait, no preemption, and circular wait.`
};

const mongoEvidence = {
  unifiedRawContent: `MongoDB aggregation pipelines process documents through multiple stages. The $match stage filters documents so only those matching specified criteria pass to the next stage. The $group stage groups documents by a specified identifier and accumulates summary values. For optimal performance in large collections, placing the $match stage at the beginning of the pipeline leverages indexes and minimizes the volume of documents passing through subsequent stages. Mongoose provides schema validation for NoSQL document modeling.`
};

// ──────────────────────────────────────────────────────────────────────────
// 1. NEGATIVE CONTROLS: Legitimate Questions Across Phrasings & Technical Words
// ──────────────────────────────────────────────────────────────────────────

record('Negative Control 1: Core OS concepts pass grounding gate', () => {
  const q = {
    questionText: 'What data structure does the kernel update to save process state during a context switch?',
    correctAnswer: 'Process Control Block (PCB)',
    options: ['Process Control Block (PCB)', 'Interrupt Vector Table', 'Page Table Base Register', 'Ready Queue Header']
  };
  const res = groundingGate.verifyQuizGrounding([q], osEvidence);
  assert.strictEqual(res.status, 'PASSED', 'Grounded core OS question must pass');
  assert.strictEqual(res.validatedQuestions.length, 1);
});

record('Negative Control 2: Mixed-phrasing conversational question passes without substring penalties', () => {
  const q = {
    questionText: 'How does a context switch affect the currently running process?',
    correctAnswer: 'Its execution is paused, registers are saved to PCB, and CPU control transfers to another process',
    options: ['Its execution is paused, registers are saved to PCB, and CPU control transfers to another process', 'It terminates immediately', 'It bypasses the ready queue', 'It is assigned a new virtual address space']
  };
  const res = groundingGate.verifyQuizGrounding([q], osEvidence);
  assert.strictEqual(res.status, 'PASSED', 'Conversational mixed phrasing must pass when core concepts align');
  assert.strictEqual(res.validatedQuestions.length, 1);
});

record('Negative Control 3: Paging and Page Fault technical mechanism passes', () => {
  const q = {
    questionText: 'When the memory management unit detects that a requested page is not in physical memory, what occurs?',
    correctAnswer: 'A page fault interrupt triggers retrieval from storage',
    options: ['A page fault interrupt triggers retrieval from storage', 'The process is terminated', 'A segmentation fault is raised', 'The CPU enters an infinite loop']
  };
  const res = groundingGate.verifyQuizGrounding([q], osEvidence);
  assert.strictEqual(res.status, 'PASSED', 'Technical memory management mechanism must pass');
  assert.strictEqual(res.validatedQuestions.length, 1);
});

record('Negative Control 4: Technical academic nouns (process, scheduler, kernel, memory) pass cleanly', () => {
  const q = {
    questionText: 'Which component inside the operating system kernel is responsible for deciding which ready process executes next?',
    correctAnswer: 'CPU scheduler',
    options: ['CPU scheduler', 'Memory management unit', 'Secondary storage controller', 'Context switch register']
  };
  const res = groundingGate.verifyQuizGrounding([q], osEvidence);
  assert.strictEqual(res.status, 'PASSED', 'Technical academic nouns must not be filtered or rejected as foreign');
  assert.strictEqual(res.validatedQuestions.length, 1);
});

// ──────────────────────────────────────────────────────────────────────────
// 2. CROSS-DOMAIN CONTAMINATION: Evidence-Based Anchor Rejection
// ──────────────────────────────────────────────────────────────────────────

record('Cross-Domain Contamination 1: MongoDB aggregation in OS lecture is rejected without hardcoded lists', () => {
  const q = {
    questionText: 'When optimizing a MongoDB aggregation pipeline for 1,000,000 documents, where should the $match stage be placed?',
    correctAnswer: 'At the beginning of the pipeline',
    options: ['At the beginning of the pipeline', 'Inside $group', 'At the end', 'Inside $project']
  };
  const res = groundingGate.verifyQuizGrounding([q], osEvidence);
  assert.strictEqual(res.status, 'FAILED', 'MongoDB aggregation question must be rejected against OS evidence');
  assert.strictEqual(res.rejectedCount, 1);
});

record('Cross-Domain Contamination 2: Biochemistry in CS lecture is rejected', () => {
  const q = {
    questionText: 'Which enzyme catalyzes DNA replication during PCR amplification in molecular genetics?',
    correctAnswer: 'Taq DNA polymerase',
    options: ['Taq DNA polymerase', 'RNA helicase', 'DNA ligase', 'Reverse transcriptase']
  };
  const res = groundingGate.verifyQuizGrounding([q], osEvidence);
  assert.strictEqual(res.status, 'FAILED', 'Biochemistry question must be rejected against CS evidence');
  assert.strictEqual(res.rejectedCount, 1);
});

record('Cross-Domain Contamination 3: React Hook contamination in OS lecture is caught via unsupported anchors', () => {
  const q = {
    questionText: 'In modern React applications, which lifecycle hook or effect hook should be invoked to manage state synchronization inside a component?',
    correctAnswer: 'useEffect hook with dependency array',
    options: ['useEffect hook with dependency array', 'useState hook', 'useContext hook', 'useReducer hook']
  };
  const res = groundingGate.verifyQuizGrounding([q], osEvidence);
  assert.strictEqual(res.status, 'FAILED', 'React hook question must be rejected against OS evidence despite incidental English word overlap');
  assert.strictEqual(res.rejectedCount, 1);
  assert.ok(
    res.reasons[0].includes('FOREIGN_TOPIC_CONTAMINATION') || res.reasons[0].includes('ZERO_SESSION_OVERLAP'),
    'Reason must indicate contamination or ungrounded overlap'
  );
});

record('Cross-Domain Contamination 4: TCP Networking in OS lecture is rejected', () => {
  const q = {
    questionText: 'What is the primary role of the TCP three-way handshake SYN ACK exchange before data transmission?',
    correctAnswer: 'Establish sequence numbers and synchronize connection parameters between sender and receiver',
    options: ['Establish sequence numbers and synchronize connection parameters between sender and receiver', 'Encrypt the payload using TLS', 'Route packets across autonomous systems', 'Allocate bandwidth at the router']
  };
  const res = groundingGate.verifyQuizGrounding([q], osEvidence);
  assert.strictEqual(res.status, 'FAILED', 'TCP networking question must be rejected against OS evidence');
  assert.strictEqual(res.rejectedCount, 1);
});

// ──────────────────────────────────────────────────────────────────────────
// 3. GROUNDING REVERSIBILITY: Legitimate Questions in Other Domains Pass
// ──────────────────────────────────────────────────────────────────────────

record('Grounding Reversibility 1: MongoDB question passes when MongoDB evidence is provided', () => {
  const q = {
    questionText: 'When optimizing an aggregation pipeline, why should the $match stage be placed at the beginning?',
    correctAnswer: 'To filter documents early and leverage indexes',
    options: ['To filter documents early and leverage indexes', 'To accumulate summary values', 'To provide schema validation', 'To sort documents descending']
  };
  const res = groundingGate.verifyQuizGrounding([q], mongoEvidence);
  assert.strictEqual(res.status, 'PASSED', 'MongoDB question must pass when MongoDB evidence is supplied');
  assert.strictEqual(res.validatedQuestions.length, 1);
});

record('Grounding Reversibility 2: OS Deadlocks question fails when tested against MongoDB evidence', () => {
  const q = {
    questionText: 'Which of the following conditions is required for a deadlock to occur in an operating system?',
    correctAnswer: 'Circular wait condition',
    options: ['Circular wait condition', 'Fast query execution', 'Document aggregation', 'Schema validation']
  };
  const res = groundingGate.verifyQuizGrounding([q], mongoEvidence);
  assert.strictEqual(res.status, 'FAILED', 'OS question must fail when tested against MongoDB evidence');
  assert.strictEqual(res.rejectedCount, 1);
});

// ──────────────────────────────────────────────────────────────────────────
// 4. CODEBASE INTEGRITY INVARIANT: Zero Hardcoded Domain Identifiers
// ──────────────────────────────────────────────────────────────────────────

record('Invariant: Zero hardcoded domain indicators in groundingGate.js source', () => {
  const src = fs.readFileSync(path.join(__dirname, 'engine', 'validators', 'groundingGate.js'), 'utf8');
  const forbiddenPatterns = [
    'foreignIndicators',
    'mongodb',
    'mongoose',
    'nosql',
    "'$match'",
    "'$group'",
    "'$project'"
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
