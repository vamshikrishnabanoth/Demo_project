process.env.LLM_PROVIDER = "mock";
require('dotenv').config();
const { generateMCQPipeline } = require('./engine/mcqEngine');

async function testTotalPipeline() {
  console.log('======================================================================');
  console.log('         🚀 TOTAL MCQ ENGINE PIPELINE (STAGES 1 TO 8) DEMO            ');
  console.log('======================================================================\n');

  // CASE 1: Standard Academic Input
  console.log('\n======================================================================');
  console.log('  CASE 1: SINGLE ACADEMIC LECTURE PAYLOAD (Network Protocols)');
  console.log('======================================================================');

  const payload1 = {
    content: `
# Computer Network Protocols & Architecture

Transmission Control Protocol (TCP) is a core protocol of the Internet protocol suite.
TCP is defined as a connection-oriented protocol that guarantees reliable, ordered delivery of data packets.

## Transport Layer Flow Control

The sliding window protocol is used by TCP for flow control between sender and receiver.
The socket() system call opens a network socket descriptor for network stream communication.
An ACK (acknowledgement) flag is sent back by the receiver to confirm frame receipt.

### Error Detection Mechanism

A Checksum algorithm is computed across packet headers and data frames to detect corruption during transmission.
    `,
    difficulty: "Balanced",
    requestedCount: 5,
    requestId: "req_total_case1"
  };

  const res1 = await generateMCQPipeline(payload1);
  console.log(`\n✅ [CASE 1 RESULT] Delivered ${res1.questions.length} Questions (Status: ${res1.status})`);
  console.log(`   Final Quiz Questions Sample:`);
  res1.questions.slice(0, 3).forEach(q => {
    console.log(`   - Q${q.questionNumber}: [${q.targetBloom} | ${q.targetDifficulty}] "${q.stem}"`);
    console.log(`     Correct (${q.correctOptionLetter}): ${q.correctAnswer}`);
  });

  // CASE 2: Multi-Input Mix (PDF/Doc Text + Code + Noise Guardrail Test)
  console.log('\n======================================================================');
  console.log('  CASE 2: MULTI-INPUT MIX WITH ACADEMIC DENSITY NOISE FILTERING');
  console.log('======================================================================');

  const payload2 = {
    inputs: [
      {
        name: "Chapter_12_Database_Indexes.pdf",
        content: `
Database B-Tree indexing optimizes query performance by maintaining balanced search trees.
Indexing reduces disk I/O operations from O(N) linear scans to O(log N) logarithmic search time.
Hash indexes provide O(1) average time complexity for exact equality queries but do not support range queries.
        `
      },
      {
        name: "Syllabus_And_Grading_Policy.docx",
        content: `
Course Syllabus 2026. Office Hours: Monday 2-4 PM in Room 302.
Grading breakdown: Homework 20%, Midterm 30%, Final Exam 50%.
Late submissions will receive a 10% penalty per day. Email instructor for extension requests.
        `
      }
    ],
    difficulty: "Balanced",
    requestedCount: 5,
    requestId: "req_total_case2"
  };

  const res2 = await generateMCQPipeline(payload2);
  console.log(`\n✅ [CASE 2 RESULT] Delivered ${res2.questions.length} Questions (Status: ${res2.status})`);
  console.log(`   Final Quiz Questions Sample:`);
  res2.questions.slice(0, 3).forEach(q => {
    console.log(`   - Q${q.questionNumber}: [${q.targetBloom} | ${q.targetDifficulty}] "${q.stem}"`);
    console.log(`     Correct (${q.correctOptionLetter}): ${q.correctAnswer}`);
  });

  console.log('\n======================================================================');
  console.log('         ✨ ALL STAGE 1–8 PIPELINE EXECUTIONS COMPLETED SUCCESSFULLY!   ');
  console.log('======================================================================\n');
}

testTotalPipeline().catch(err => {
  console.error('❌ Total Pipeline Test Failed:', err);
  process.exit(1);
});
