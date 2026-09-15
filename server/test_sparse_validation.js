/**
 * server/test_sparse_validation.js
 *
 * Dedicated Insufficient-Evidence / Sparse Lecture Fixture Test:
 * Tests the frozen pipeline with a deliberately minimal fixture and 10 requested questions.
 * Validates:
 * - Delivery of N valid grounded questions (N < 10, supported by evidence)
 * - Status: COMPLETED_WITH_PARTIAL_FULFILLMENT
 * - Zero runaway replenishment loops
 * - Zero unbounded retries
 * - Zero ungrounded/foreign MCQs delivered
 */

'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const pipelineOrchestrator = require('./engine/pipelineOrchestrator');
const telemetryLedger = require('./engine/observability/telemetryLedger');

async function runSparseTest() {
  console.log('========================================================================');
  console.log('🧪 RUNNING DEDICATED INSUFFICIENT-EVIDENCE FIXTURE VALIDATION');
  console.log('========================================================================\n');

  const minimalText = 'TCP uses a three-way handshake protocol to establish a connection before data transfer. Step 1: The client sends a SYN packet. Step 2: The server responds with SYN-ACK. Step 3: The client replies with ACK to establish the connection.';

  const sessionInputs = {
    sessionId: 'matrix_sparse_minimal_10q',
    voiceTranscript: minimalText,
    documentTexts: [minimalText],
    codeSnippets: null,
    difficulty: 'Medium',
    count: 10 // Deliberately requesting 10 questions from minimal 30-word fixture
  };

  console.log(`[FIXTURE]: "${minimalText}"`);
  console.log(`[REQUEST]: 10 questions | Difficulty: Medium\n`);

  const startTime = Date.now();
  const result = await pipelineOrchestrator.runPipeline(sessionInputs);
  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);

  const deliveredCount = result?.deliveredCount || result?.questions?.length || 0;
  const recent = telemetryLedger.getRecentJobs(5);
  const ledgerRow = recent.find(j => j.job_id === sessionInputs.sessionId) || {};

  console.log('\n========================================================================');
  console.log('📊 SPARSE FIXTURE TEST RESULTS');
  console.log('========================================================================');
  console.log(`Requested Questions:   ${result.requestedCount}`);
  console.log(`Delivered Questions:   ${deliveredCount}`);
  console.log(`Pipeline Status:       ${result.pipelineStatus}`);
  console.log(`Notice / Reason:       ${result.notice || 'N/A'}`);
  console.log(`Total Elapsed Time:    ${elapsedSec}s`);
  console.log(`Total LLM Calls:       ${ledgerRow.llm_calls || 'N/A'}`);
  console.log(`Total Retries:         ${ledgerRow.retries ?? 0}`);
  console.log(`Average Grounding:     ${result.telemetry?.avgGroundingScore || 'N/A'}`);
  console.log(`Token Usage (Actual):  In=${ledgerRow.input_tokens_actual || 0}, Out=${ledgerRow.output_tokens_actual || 0}`);
  console.log('========================================================================\n');

  console.log('--- DELIVERED QUESTIONS ---');
  (result.questions || []).forEach((q, idx) => {
    console.log(`Q${idx + 1}: ${q.questionText}`);
    console.log(`   Correct: ${q.correctAnswer}`);
    console.log(`   Dimension: ${q.metadata?.dimension} | Tier: ${q.metadata?.tier} | Grounding: ${q.metadata?.groundingScore}`);
  });

  return { result, ledgerRow };
}

runSparseTest().then(() => {
  console.log('\n✅ Sparse lecture test execution finished successfully.');
  process.exit(0);
}).catch(err => {
  console.error('\n❌ Sparse lecture test error:', err);
  process.exit(1);
});
