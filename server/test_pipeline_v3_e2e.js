/**
 * Recommended 9-Stage Pipeline Architecture v3.0.0 Verification Suite
 * Tests Stage 1 to Stage 9 Contracts, AST Parser, EDU_012 Grounding Guard, Lineage & Stage 9 Review
 */

const assert = require('assert');
const { generateMCQPipeline } = require('./engine/mcqEngine');
const { parseAndValidateAST } = require('./engine/validators/astParser');
const { validateStageContract } = require('./engine/contracts/pipelineContracts');
const { buildQuestionLineage } = require('./engine/tracing/lineageTracker');
const { reviewQuizPortfolio } = require('./engine/portfolioReviewer/index');
const { runEducationalValidation } = require('./engine/validators/educationalValidator');
const { analyzeInstructionalDocument } = require('./engine/documentAnalyzer/index');

const sampleAssignment3Text = `
Assignment 3: MongoDB Aggregation Pipelines & Indexing Strategies
Dataset link: https://drive.google.com/file/d/3xyz999/view (restaurants.json)

Scenario 1 - Restaurant Analytics
The database administrator wants to summarize total restaurant counts grouped by cuisine type.
Sort the final output from highest to lowest count. Only include categories with count > 50.

Task 1: Aggregation Pipeline
Write a MongoDB aggregation query using $group and $unwind to calculate average review scores per borough.
Use $addFields to compute the normalized score rating and $switch for grade classification.
Use $lookup to join with the reviews collection.

Task 2: Index Optimization
Analyze query performance using explain(). Compare execution statistics between COLLSCAN (Full Collection Scan) and IXSCAN (Index Scan) when querying indexed fields.
`;

async function runPipelineV3Verification() {
  console.log("\n======================================================================");
  console.log(" 🧪 RECOMMENDED 9-STAGE PIPELINE ARCHITECTURE v3.0.0 VERIFICATION");
  console.log("======================================================================\n");

  // ── TEST 1: Stage Contracts & Invariants ──
  console.log("--- TEST 1: Explicit Pipeline Contracts (Stages 1 through 9) ---");
  const contractResult = validateStageContract('STAGE_1_5', {
    cleanedContent: sampleAssignment3Text,
    documentProfile: analyzeInstructionalDocument(sampleAssignment3Text)
  });
  assert.strictEqual(contractResult, true, "Stage 1.5 Contract validation should pass");
  console.log(" ✅ PASS: Stage contracts fail-fast validation routine operational.\n");

  // ── TEST 2: Stage 5 Grounding Contract Guard (EDU_012_UNGROUNDED_EXECUTABLE) ──
  console.log("--- TEST 2: Stage 5 Grounding Contract Guard (EDU_012) ---");
  const docProfile = analyzeInstructionalDocument(sampleAssignment3Text);

  // $graphLookup is valid MongoDB syntax, BUT did NOT exist in assignment text -> EDU_012
  const ungroundedItem = {
    slotId: "slot_ungrounded",
    conceptId: "graphLookup",
    conceptLabel: "$graphLookup",
    stem: "Which aggregation stage performs recursive graph search?",
    options: [
      'db.restaurants.aggregate([ { $graphLookup: { from: "employees", startWith: "$reportsTo" } } ])',
      'db.restaurants.aggregate([ { $group: { _id: "$cuisine" } } ])',
      'db.restaurants.find({ category: "Italian" })',
      'db.restaurants.createIndex({ cuisine: 1 })'
    ],
    correctAnswer: 'db.restaurants.aggregate([ { $graphLookup: { from: "employees", startWith: "$reportsTo" } } ])',
    sourceEvidence: { text: sampleAssignment3Text }
  };

  const validationContext = {
    cleanedContent: sampleAssignment3Text,
    documentProfile: docProfile,
    docType: docProfile.documentType,
    config: { THRESHOLDS: { MIN_QUALITY_SCORE: 0.75 } }
  };

  const eduRes = await runEducationalValidation(ungroundedItem, validationContext);
  console.log(`  ├─ Ungrounded Operator Validation Result: Passed: ${eduRes.passed} | Quality: ${eduRes.qualityScore}`);
  console.log(`  └─ Major Warnings:`, eduRes.findings?.majorWarnings);

  const hasEDU012 = eduRes.findings?.majorWarnings?.includes('EDU_012');
  assert.strictEqual(hasEDU012, true, "Stage 6 should flag EDU_012_UNGROUNDED_EXECUTABLE for ungrounded $graphLookup operator");
  console.log(" ✅ PASS: Stage 5 Grounding Guard correctly rejected ungrounded operator via EDU_012.\n");

  // ── TEST 3: Stage 6 Language Tokenizer & AST Structural Parser ──
  console.log("--- TEST 3: Stage 6 Language Tokenizer & AST Structural Parser ---");
  const astValid = parseAndValidateAST('db.restaurants.aggregate([ { $group: { _id: "$cuisine" } } ])', 'MongoDB');
  const astInvalid = parseAndValidateAST('db.restaurants.aggregate([ { $design and create: { _id: "$cuisine" } } ])', 'MongoDB');

  assert.strictEqual(astValid.valid, true, "Valid BSON pipeline should pass AST parser");
  assert.strictEqual(astInvalid.valid, false, "Invented operator key with spaces should fail AST parser");
  console.log(" ✅ PASS: AST Structural Parser correctly validates BSON syntax with zero false positives.\n");

  // ── TEST 4: Concept Lineage Tracking & Stage 9 Review ──
  console.log("--- TEST 4: End-to-End Pipeline & Stage 9 Portfolio Review ---");
  const pipelineResult = await generateMCQPipeline({
    content: sampleAssignment3Text,
    difficulty: "Balanced",
    requestedCount: 4,
    requestId: "test_v3_e2e_" + Date.now()
  });

  const finalQuiz = pipelineResult.finalQuiz;
  assert.strictEqual(Array.isArray(finalQuiz.questions) && finalQuiz.questions.length > 0, true, "Pipeline should deliver valid questions");

  const sampleQuestion = finalQuiz.questions[0];
  const lineage = buildQuestionLineage(sampleQuestion, { documentProfile: docProfile });

  console.log(`  ├─ Generated Quiz: ${finalQuiz.questions.length} MCQs`);
  console.log(`  ├─ Lineage Trace Sample (Q1):`, JSON.stringify(lineage.stemOrigin));
  console.log(`  └─ Stage Confidence Trace:`, JSON.stringify(lineage.stageConfidenceTrace));

  const reviewResult = reviewQuizPortfolio(finalQuiz, { documentProfile: docProfile });
  assert.strictEqual(reviewResult.approved, true, "Stage 9 Reviewer should approve final portfolio");
  console.log(" ✅ PASS: Stage 9 Portfolio Reviewer approved final quiz balance, ramp, and lineage.\n");

  console.log("======================================================================");
  console.log(" 🎉 RECOMMENDED 9-STAGE PIPELINE v3.0.0 TESTS PASSED CLEANLY");
  console.log("======================================================================\n");
}

runPipelineV3Verification().catch(err => {
  console.error("❌ Verification Test Failed:", err);
  process.exit(1);
});
