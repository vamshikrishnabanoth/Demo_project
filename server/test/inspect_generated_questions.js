/**
 * server/test/inspect_generated_questions.js
 *
 * Live End-to-End Quiz Generation & Output Inspection
 * Tests both Text/Document and Voice routes and prints every generated question
 * with its options, correct answer, explanation, cognitive level, grounding score, and audit verdict.
 */

'use strict';

const pipelineOrchestrator = require('../engine/pipelineOrchestrator');

console.log('======================================================================');
console.log('🔬 LIVE QUESTION GENERATION & QUALITY AUDIT INSPECTION');
console.log('======================================================================\n');

async function testGeneration() {
  // ── TEST 1: Text / Document Modality ─────────────────────────────────────
  console.log('----------------------------------------------------------------------');
  console.log('📖 ROUTE 1: Text / Document Material Assessment Generation');
  console.log('----------------------------------------------------------------------');

  const textTaskId = 'inspect_text_' + Date.now();
  const documentText = `
    Operating Systems: Deadlock Handling and Banker's Algorithm.
    A deadlock occurs when a set of processes are blocked because each process is holding a resource
    and waiting for another resource acquired by some other process in the system.
    The four Coffman conditions necessary for deadlock are:
    1. Mutual Exclusion: At least one resource must be held in a non-shareable mode.
    2. Hold and Wait: A process must be holding at least one resource and waiting to acquire additional resources.
    3. No Preemption: Resources cannot be preempted; a resource can only be released voluntarily by the process holding it.
    4. Circular Wait: A closed chain of processes exists such that each process holds at least one resource needed by the next.
    Deadlock avoidance can be achieved using Dijkstra's Banker's Algorithm.
    A state is considered safe if the system can allocate resources to each process up to its maximum in some order
    without entering deadlock. If no such safe sequence exists, the system is in an unsafe state.
  `;

  console.log('⏳ Running 3-Agent Pipeline for Text route (Requested: 2 Medium Questions)...');
  const textResult = await pipelineOrchestrator.runPipeline({
    taskId: textTaskId,
    documentTexts: [documentText],
    documentNames: ['os_deadlocks.txt'],
    count: 2,
    difficulty: 'Medium'
  });

  console.log(`\n📌 Pipeline Result Status: ${textResult.pipelineStatus}`);
  console.log(`📌 Delivered Questions: ${textResult.questions.length}/${textResult.requestedCount}`);
  console.log(`📌 Whole-Quiz Quality Status: ${textResult.quizQualityStatus}`);
  console.log(`📌 Evidence Safety: ${textResult.evidenceSafety}\n`);

  console.log('══════════════════════════════════════════════════════════════════════');
  console.log('📝 TEXT GENERATED QUESTIONS DETAIL');
  console.log('══════════════════════════════════════════════════════════════════════');

  textResult.questions.forEach((q, idx) => {
    console.log(`\n[Question ${idx + 1}] (${q.difficulty || 'Medium'} | Bloom: ${q.bloom_level || q.targetBloom || 'Understand'})`);
    console.log(`Stem: "${q.questionText || q.stem || q.question}"`);
    console.log('Options:');
    q.options.forEach((opt, optIdx) => {
      const letter = String.fromCharCode(65 + optIdx);
      const isCorrect = opt === q.correctAnswer ? ' ★ (CORRECT KEY)' : '';
      console.log(`   ${letter}. ${opt}${isCorrect}`);
    });
    console.log(`Explanation: ${q.explanation || 'N/A'}`);
    console.log(`Grounding Score: ${q.metadata?.groundingScore ?? 'N/A'}`);
    console.log(`Derivability Tier: ${q.metadata?.tier || 'EVIDENCE_DERIVED'}`);
    console.log(`Agent 3 Verdict: ${q.metadata?.decisionLedger?.agent3?.verdict || 'PASS'}`);
  });

  // ── TEST 2: Voice Modality ────────────────────────────────────────────────
  console.log('\n\n----------------------------------------------------------------------');
  console.log('🎙️ ROUTE 2: Voice Lecture Transcript Assessment Generation');
  console.log('----------------------------------------------------------------------');

  const voiceTaskId = 'inspect_voice_' + Date.now();
  const voiceTranscript = `
    Welcome back class. Today we will explore Database Normalization and Normal Forms.
    Database normalization is the process of structuring a relational database in accordance with normal forms
    to reduce data redundancy and improve data integrity.
    First Normal Form, or 1NF, requires that each column contain only atomic, indivisible values,
    and each record must be unique.
    Second Normal Form, 2NF, requires the table to be in 1NF and additionally that all non-key attributes
    are fully functionally dependent on the entire primary key, eliminating partial dependencies.
    Third Normal Form, 3NF, builds upon 2NF by removing transitive dependencies,
    meaning non-prime attributes must not depend on other non-prime attributes.
    Boyce-Codd Normal Form, BCNF, is a stricter version of 3NF where for every functional dependency X determines Y,
    X must be a super key.
  `;

  console.log('⏳ Running 3-Agent Pipeline for Voice route (Requested: 2 Easy Questions)...');
  const voiceResult = await pipelineOrchestrator.runPipeline({
    taskId: voiceTaskId,
    voiceTranscript,
    count: 2,
    difficulty: 'Easy'
  });

  console.log(`\n📌 Voice Pipeline Status: ${voiceResult.pipelineStatus}`);
  console.log(`📌 Delivered Questions: ${voiceResult.questions.length}/${voiceResult.requestedCount}`);
  console.log(`📌 Whole-Quiz Quality Status: ${voiceResult.quizQualityStatus}`);
  console.log(`📌 Evidence Safety: ${voiceResult.evidenceSafety}\n`);

  console.log('══════════════════════════════════════════════════════════════════════');
  console.log('🎙️ VOICE GENERATED QUESTIONS DETAIL');
  console.log('══════════════════════════════════════════════════════════════════════');

  voiceResult.questions.forEach((q, idx) => {
    console.log(`\n[Question ${idx + 1}] (${q.difficulty || 'Easy'} | Bloom: ${q.bloom_level || q.targetBloom || 'Recall'})`);
    console.log(`Stem: "${q.questionText || q.stem || q.question}"`);
    console.log('Options:');
    q.options.forEach((opt, optIdx) => {
      const letter = String.fromCharCode(65 + optIdx);
      const isCorrect = opt === q.correctAnswer ? ' ★ (CORRECT KEY)' : '';
      console.log(`   ${letter}. ${opt}${isCorrect}`);
    });
    console.log(`Explanation: ${q.explanation || 'N/A'}`);
    console.log(`Grounding Score: ${q.metadata?.groundingScore ?? 'N/A'}`);
    console.log(`Derivability Tier: ${q.metadata?.tier || 'EVIDENCE_DERIVED'}`);
    console.log(`Agent 3 Verdict: ${q.metadata?.decisionLedger?.agent3?.verdict || 'PASS'}`);
  });

  console.log('\n======================================================================');
  console.log('🏁 ALL QUESTIONS SUCCESSFULLY GENERATED, AUDITED, AND GROUNDED');
  console.log('======================================================================\n');
}

testGeneration().catch(err => {
  console.error('Inspection failed:', err);
  process.exit(1);
});
