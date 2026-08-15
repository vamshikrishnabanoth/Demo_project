/**
 * server/test_baseline_v1_pipeline.js
 *
 * Direct Unit Integration Test for Architecture Baseline v1.0 Pipeline Orchestrator.
 * Tests:
 * 1. Evidence Packager & Dual-Source Authority Division
 * 2. Agent 1 Assessment Planner & Target Reserve Pool ($N + M$)
 * 3. Agent 2 MCQ Generator via Universal LLM Router (Groq Cloud / Ollama / Mock)
 * 4. Deterministic Pre-Checks & Post-Checks
 * 5. Agent 3 Dual-Mode Evaluator
 * 6. Deterministic Calculation Engine
 * 7. Final Grounding Gate
 */

'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const pipelineOrchestrator = require('./engine/pipelineOrchestrator');

async function runTest() {
  console.log('🧪 Starting Architecture Baseline v1.0 Pipeline Integration Test...\n');

  const sessionInputs = {
    sessionId: 'test_sess_v10',
    voiceTranscript: `
      Today we are discussing MongoDB aggregation pipelines and indexing strategies.
      Remember that putting the $match stage at the beginning of the pipeline is critical for performance because it uses indexes to filter documents early.
      Don't worry about memorizing exact syntax today; focus on understanding query optimization logic.
    `,
    documentTexts: [
      'Assignment 3: MongoDB Aggregation Pipelines & Indexing Strategies. Dataset link: restaurants.json. $match filters documents, $group aggregates, $project shapes output.'
    ],
    codeSnippets: `db.restaurants.aggregate([ { $match: { cuisine: "Italian" } }, { $group: { _id: "$borough", count: { $sum: 1 } } } ])`,
    difficulty: 'Medium',
    count: 3
  };

  const progressEvents = [];

  try {
    const result = await pipelineOrchestrator.runPipeline(sessionInputs, (event) => {
      progressEvents.push(event);
      console.log(`  📡 [SSE EVENT] ${event.stage} | ${event.status} | ${event.details}`);
    });

    console.log('\n--- PIPELINE EXECUTION SUMMARY ---');
    console.log(`Session ID: ${result.sessionId}`);
    console.log(`Pipeline Status: ${result.pipelineStatus}`);
    console.log(`Quiz Quality Status: ${result.quizQualityStatus}`);
    console.log(`Subject: ${result.subject}`);
    console.log(`Main Topic: ${result.quizTitle}`);
    console.log(`TC Score: ${result.tcScore?.overallScore}/100 (${result.tcScore?.coverageDepth})`);
    console.log(`Delivered Questions: ${result.questions.length}/${result.telemetry.requestedCount}`);
    console.log(`Total Duration: ${result.telemetry.totalDurationMs}ms`);

    console.log('\n--- VERIFYING DELIVERED MCQS ---');
    result.questions.forEach((q, idx) => {
      console.log(`\nQ${idx + 1}: ${q.questionText}`);
      console.log(`  Options: ${q.options.map(o => `"${o}"`).join(', ')}`);
      console.log(`  Correct Answer: "${q.correctAnswer}"`);
      console.log(`  Explanation: ${q.explanation}`);

      // Verification checks
      if (!q.questionText || !Array.isArray(q.options) || q.options.length !== 4) {
        throw new Error(`Q${idx + 1} fails 4-option schema check.`);
      }
      if (!q.options.includes(q.correctAnswer)) {
        throw new Error(`Q${idx + 1} correctAnswer is missing from options list.`);
      }
    });

    console.log('\n✅ ✅ ✅ ARCHITECTURE BASELINE v1.0 INTEGRATION TEST PASSED SUCCESSFULY! ✅ ✅ ✅');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Pipeline Integration Test Failed:', err);
    process.exit(1);
  }
}

runTest();
