/**
 * server/test/run_grounding_investigation_diagnostic.js
 *
 * Controlled Grounding Gate Diagnostic Runner
 * Tests regex predicate extraction and relational grounding behavior on:
 *   - 'process' in OS domain (Noun vs. Verb vs. Object vs. Neg Control)
 *   - 'generate' in ML domain (Adj vs. Noun Agent vs. Verb vs. Neg Control)
 *   - Clean structural domain controls (COA & Trees)
 *
 * Strict read-only diagnostic. Zero modifications to production code.
 */

'use strict';

const path = require('path');
const groundingGate = require('../engine/validators/groundingGate');

// Test Evidence Passages
const EVIDENCE_OS = `In an operating system, a user process executes instructions in user mode. When the process requests memory, the kernel allocates page frames from physical memory. The operating system handles all process scheduling across available CPU cores.`;

const EVIDENCE_ML = `In a variational autoencoder, generative models learn the underlying data distribution. The decoder generates reconstructed images from latent vectors sampled from a Gaussian prior. The encoder maps input samples into mean and variance parameters.`;

const EVIDENCE_STRUCT = `In virtual memory systems, the page table maps virtual page numbers to physical frame numbers. A binary tree node has at most two children, referred to as left child and right child.`;

const TEST_CASES = [
  // Group A: 'process' (OS Domain)
  {
    id: 'TC-A1',
    group: 'Group A: OS (process)',
    evidence: EVIDENCE_OS,
    stem: 'What executes instructions in user mode in an operating system?',
    correctAnswer: 'A user process executes instructions in user mode.',
    role: 'Noun Subject (Taught)',
    expectedStatus: 'PASSED'
  },
  {
    id: 'TC-A2',
    group: 'Group A: OS (process)',
    evidence: EVIDENCE_OS,
    stem: 'What happens when a process requests memory in an operating system?',
    correctAnswer: 'When a process requests memory, the kernel allocates physical page frames.',
    role: 'Noun Subject with kernel agent (Taught)',
    expectedStatus: 'PASSED'
  },
  {
    id: 'TC-A3',
    group: 'Group A: OS (process)',
    evidence: EVIDENCE_OS,
    stem: 'How are processes handled across available CPU cores?',
    correctAnswer: 'The operating system schedules each background process across CPU cores.',
    role: 'Noun Direct Object (Taught)',
    expectedStatus: 'PASSED'
  },
  {
    id: 'TC-A4',
    group: 'Group A: OS (process) - Negative Control',
    evidence: EVIDENCE_OS,
    stem: 'Which hardware component directly processes kernel memory pages?',
    correctAnswer: 'The network card processes kernel memory pages without CPU authorization.',
    role: 'Transitive Verb (Untaught / Hallucination)',
    expectedStatus: 'FAILED'
  },

  // Group B: 'generate' (ML / VAE Domain)
  {
    id: 'TC-B1',
    group: 'Group B: ML (generate)',
    evidence: EVIDENCE_ML,
    stem: 'What is the role of generative models in a variational autoencoder?',
    correctAnswer: 'Generative models learn the underlying data distribution from training samples.',
    role: 'Adjective "generative" (Taught)',
    expectedStatus: 'PASSED'
  },
  {
    id: 'TC-B2',
    group: 'Group B: ML (generate)',
    evidence: EVIDENCE_ML,
    stem: 'What produces synthetic images from latent vectors in a VAE?',
    correctAnswer: 'The generator network constructs synthetic images from latent vectors.',
    role: 'Agent Noun "generator" (Taught)',
    expectedStatus: 'PASSED'
  },
  {
    id: 'TC-B3',
    group: 'Group B: ML (generate)',
    evidence: EVIDENCE_ML,
    stem: 'What does the decoder produce in a variational autoencoder?',
    correctAnswer: 'The decoder generates reconstructed images from sampled latent vectors.',
    role: 'Transitive Verb "generates" (Taught)',
    expectedStatus: 'PASSED'
  },
  {
    id: 'TC-B4',
    group: 'Group B: ML (generate) - Negative Control',
    evidence: EVIDENCE_ML,
    stem: 'What component creates reconstructed images from input pixels?',
    correctAnswer: 'The encoder generates reconstructed images directly from raw input pixels.',
    role: 'Transitive Verb (Untaught / Misattribution)',
    expectedStatus: 'FAILED'
  },

  // Group D: Authentic Phase 2 Failure Reproduction (Exact Transcripts & Stems)
  {
    id: 'TC-D1 (MULTI_002 Q1)',
    group: 'Group D: Authentic Corpus Reproduction',
    evidence: 'In direct communication, each process that wants to communicate must explicitly name the recipient or sender. A communication link is established automatically between every pair of processes. In message passing with direct communication, sender process transmits message to destination.',
    stem: 'In direct communication IPC, what is the primary operational requirement for a sender process to transmit a message?',
    correctAnswer: 'Explicitly specifying the destination process ID',
    role: 'Authentic Noun Compound "sender process"',
    expectedStatus: 'PASSED'
  },
  {
    id: 'TC-D2 (MULTI_002 Q2)',
    group: 'Group D: Authentic Corpus Reproduction',
    evidence: 'When multiple processes simultaneously access shared resources without synchronization, race conditions occur. If two processes print simultaneously to a non-shareable printer, their outputs interleave.',
    stem: 'If two cooperating processes simultaneously send print jobs to a single printer, violating the default non‑shareable resource rule, what is the most likely result?',
    correctAnswer: 'Their outputs will interleave, producing a corrupted document with mixed pages.',
    role: 'Authentic Plural Noun "cooperating processes"',
    expectedStatus: 'PASSED'
  },
  {
    id: 'TC-D3 (MULTI_003 Q2)',
    group: 'Group D: Authentic Corpus Reproduction',
    evidence: 'In a VAE, KL-divergence regularizes the latent space. A meaningful latent space allows the network to generate new samples effectively. Without regularization, the latent space has gaps.',
    stem: 'Given identical encoder outputs, how does removing the KL‑divergence regularization affect a VAE’s ability to generate new samples compared to keeping the regularization?',
    correctAnswer: 'Samples will be less diverse and sampling will be less meaningful.',
    role: 'Authentic Infinitive "ability to generate"',
    expectedStatus: 'PASSED'
  }
];

function runDiagnostic() {
  console.log('======================================================================');
  console.log('🔬 CONTROLLED GROUNDING GATE DIAGNOSTIC: POS / RELATIONAL COLLISION');
  console.log('======================================================================\n');

  const results = [];

  for (const tc of TEST_CASES) {
    const questionObj = {
      questionText: tc.stem,
      options: [
        tc.correctAnswer,
        'Distractor Option 1',
        'Distractor Option 2',
        'Distractor Option 3'
      ],
      correctAnswer: tc.correctAnswer
    };

    const auditResult = groundingGate.verifyQuizGrounding([questionObj], {
      unifiedRawContent: tc.evidence,
      negativeBoundaries: []
    });

    const isPassed = auditResult.status === 'PASSED';
    const reason = auditResult.reasons?.[0] || 'None';
    const meetsIdeal = (isPassed && tc.expectedStatus === 'PASSED') || (!isPassed && tc.expectedStatus === 'FAILED');

    results.push({
      id: tc.id,
      group: tc.group,
      role: tc.role,
      expected: tc.expectedStatus,
      actual: auditResult.status,
      meetsIdeal,
      reason
    });

    console.log(`[${tc.id}] ${tc.group} - Role: ${tc.role}`);
    console.log(`  Expected: ${tc.expectedStatus} | Actual: ${auditResult.status}`);
    if (!isPassed) {
      console.log(`  Reason: ${reason}`);
    }
    console.log(`  Diagnostic Disposition: ${meetsIdeal ? '✅ IDEAL BEHAVIOR' : '⚠️ VULNERABILITY OBSERVED'}\n`);
  }

  console.log('======================================================================');
  console.log('📊 DIAGNOSTIC SUMMARY');
  console.log('======================================================================');
  const anomalies = results.filter(r => !r.meetsIdeal);
  console.log(`Total Cases: ${results.length} | Ideal Outcomes: ${results.length - anomalies.length} | Anomalies: ${anomalies.length}\n`);

  if (anomalies.length > 0) {
    console.log('Detected Vulnerabilities (False Rejections / Bypasses):');
    anomalies.forEach(a => {
      console.log(`  - ${a.id} (${a.role}): Expected ${a.expected}, got ${a.actual} [${a.reason}]`);
    });
  } else {
    console.log('No anomalies detected.');
  }

  return results;
}

runDiagnostic();
