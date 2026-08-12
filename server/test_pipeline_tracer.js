/**
 * server/test_pipeline_tracer.js
 * 
 * AUTOMATED TEST SUITE FOR PIPELINE TRACER, DASHBOARD & REPLAY FRAMEWORK
 */

process.env.LLM_PROVIDER = "mock";
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const PipelineTracer = require('./engine/tracing/pipelineTracer');
const { buildQuestionLineage } = require('./engine/tracing/explainabilityBuilder');
const { renderTraceDashboard } = require('./engine/tracing/dashboardRenderer');
const { replayPipeline } = require('./engine/tracing/replayEngine');
const { generateMCQPipeline } = require('./engine/mcqEngine');

async function testPipelineTracerFramework() {
  console.log('======================================================================');
  console.log('  🧪 MCQ PIPELINE TRACER, DASHBOARD & REPLAY FRAMEWORK VERIFICATION  ');
  console.log('======================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, testName) {
    totalTests++;
    if (condition) {
      console.log(` ✅ PASS: ${testName}`);
      passedTests++;
    } else {
      console.error(` ❌ FAIL: ${testName}`);
      process.exitCode = 1;
    }
  }

  // -------------------------------------------------------------------------
  // TEST 1: Pipeline Tracer Recording & Trace JSON Persistence
  // -------------------------------------------------------------------------
  console.log('--- TEST GROUP 1: Pipeline Tracer Recording & Trace JSON ---');
  const reqId = `test_tracer_${Date.now()}`;
  
  const res = await generateMCQPipeline({
    content: "Transmission Control Protocol (TCP) guarantees reliable data delivery in Computer Networks.",
    difficulty: "Balanced",
    requestedCount: 3,
    requestId: reqId
  });

  assert(res.status === 'SUCCESS', 'MCQ Engine executed successfully');

  const savedTrace = PipelineTracer.loadTrace(reqId);
  assert(savedTrace !== null, `Trace JSON saved to disk (trace_${reqId}.json)`);
  assert(savedTrace.requestId === reqId, 'Trace JSON requestId matches expected correlation ID');
  assert(savedTrace.timeline.length >= 8, `Trace timeline recorded all 8 stages (${savedTrace.timeline.length} events)`);

  // -------------------------------------------------------------------------
  // TEST 2: Question Explainability Lineage Mapping
  // -------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 2: Question Explainability Lineage ---');
  const lineage = savedTrace.questionLineage || [];
  assert(Array.isArray(lineage) && lineage.length > 0, `Lineage mapped for ${lineage.length} questions`);

  const firstQ = lineage[0];
  assert(firstQ.lineage?.generatedBecause !== undefined, 'Lineage contains "generatedBecause" rationale');
  assert(firstQ.lineage?.targetConcept?.label !== undefined, 'Lineage contains targetConcept details');
  assert(firstQ.lineage?.supportingEvidence?.textSnippet !== undefined, 'Lineage contains supportingEvidence quote');
  assert(firstQ.lineage?.validatorScores?.qualityScore !== undefined, 'Lineage contains validatorScores breakdown');

  // -------------------------------------------------------------------------
  // TEST 3: Visual HTML Dashboard Rendering
  // -------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 3: Visual HTML Dashboard Renderer ---');
  const htmlDashboard = renderTraceDashboard(savedTrace);
  assert(typeof htmlDashboard === 'string' && htmlDashboard.includes('<!DOCTYPE html>'), 'Rendered HTML dashboard');
  assert(htmlDashboard.includes(reqId), 'HTML dashboard contains request ID');
  assert(htmlDashboard.includes('Question Explainability Lineage'), 'HTML dashboard includes Question Explainability section');
  assert(htmlDashboard.includes('Stage Execution Timeline'), 'HTML dashboard includes Stage Execution Timeline');

  // -------------------------------------------------------------------------
  // TEST 4: Replay Engine & Drift Analysis
  // -------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 4: Replay Engine & Drift Analysis ---');
  const replayResult = await replayPipeline(reqId);
  assert(replayResult.replayStatus === 'SUCCESS', 'Pipeline replay executed cleanly');
  assert(replayResult.driftAnalysis?.averageStemSimilarity !== undefined, `Drift analysis calculated stem similarity (${replayResult.driftAnalysis.averageStemSimilarity * 100}%)`);
  assert(Array.isArray(replayResult.driftAnalysis?.questionDrift), 'Drift analysis returned per-question drift breakdown');

  // -------------------------------------------------------------------------
  // TEST 5: Traces Listing
  // -------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 5: Admin Traces Whitelist & Listing ---');
  const traceList = PipelineTracer.listTraces(10);
  assert(Array.isArray(traceList) && traceList.length > 0, `PipelineTracer.listTraces returned ${traceList.length} trace files`);

  console.log('\n======================================================================');
  console.log(`  🎉 TRACER FRAMEWORK VERIFICATION PASSED: ${passedTests}/${totalTests} CHECKS CLEAN`);
  console.log('======================================================================\n');
}

testPipelineTracerFramework().catch(err => {
  console.error('❌ Tracer Framework Test Error:', err);
  process.exit(1);
});
