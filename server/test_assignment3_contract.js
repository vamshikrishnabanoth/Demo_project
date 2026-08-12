/**
 * Pipeline Cross-Stage Contract Enforcement Verification Test Suite
 * Tests Stage 1.5 -> Stage 2 -> Stage 4 -> Stage 6 -> Stage 7 Contract Rules
 */

const assert = require('assert');
const { generateMCQPipeline } = require('./engine/mcqEngine');
const { analyzeInstructionalDocument } = require('./engine/documentAnalyzer/index');
const { buildConceptGraph } = require('./engine/conceptGraphBuilder/index');
const { runEducationalValidation } = require('./engine/validators/educationalValidator');

const sampleAssignment3Text = `
Assignment 3: MongoDB Aggregation Pipelines & Indexing Strategies
Dataset link: https://drive.google.com/file/d/3xyz999/view (restaurants.json)

Scenario 1 - Restaurant Analytics
The database administrator wants to summarize total restaurant counts grouped by cuisine type.
Sort the final output from highest to lowest count. Only include categories with count > 50.
Design and create signatureDishes array for top performers.

Task 1: Aggregation Pipeline
Write a MongoDB aggregation query using $group and $unwind to calculate average review scores per borough.
Use $addFields to compute the normalized score rating and $switch for grade classification.
Use $lookup to join with the reviews collection.

Task 2: Index Optimization
Analyze query performance using explain(). Compare execution statistics between COLLSCAN (Full Collection Scan) and IXSCAN (Index Scan) when querying indexed fields.
`;

async function runContractVerification() {
  console.log("\n======================================================================");
  console.log(" 🧪 PIPELINE CROSS-STAGE CONTRACT ENFORCEMENT VERIFICATION");
  console.log("======================================================================\n");

  // ── TEST 1: Canonical Document Profile Contract ──
  console.log("--- TEST 1: Canonical Document Profile & Executable Constructs ---");
  const docProfile = analyzeInstructionalDocument(sampleAssignment3Text);

  console.log(`  ├─ Document Type: ${docProfile.documentType}`);
  console.log(`  ├─ Detected Language: ${docProfile.detectedLanguage}`);
  console.log(`  ├─ Executable Constructs (${docProfile.executableConstructs.length}):`, docProfile.executableConstructs);
  console.log(`  ├─ Structural Metadata (${docProfile.structuralMetadata.length}):`, docProfile.structuralMetadata);
  console.log(`  └─ Procedural Actions (${docProfile.proceduralActions.length}):`, docProfile.proceduralActions);

  assert.strictEqual(docProfile.detectedLanguage, 'MongoDB', "Detected language should be MongoDB");
  assert.strictEqual(docProfile.executableConstructs.includes('$group') || docProfile.executableConstructs.includes('$GROUP'), true, "Executable constructs should contain $group");
  console.log(" ✅ PASS: Canonical Document Profile created with valid executable constructs.\n");

  // ── TEST 2: Controlled Enrichment Contract in Stage 2 ──
  console.log("--- TEST 2: Stage 2 Controlled Enrichment Contract ---");
  const cg = buildConceptGraph(sampleAssignment3Text, { documentProfile: docProfile });
  const conceptLabels = cg.nodes.map(n => n.label.toUpperCase());

  console.log(` Concept Graph Nodes (${conceptLabels.length}):`, conceptLabels.join(", "));

  const forbiddenPhrases = ["SORT THE FINAL OUTPUT", "ONLY INCLUDE CATEGORIES", "DESIGN AND CREATE", "SIGNATUREDISHES", "RESTAURANTS.JSON", "ASSIGNMENT 3"];
  const leakedPhrases = conceptLabels.filter(label => forbiddenPhrases.some(bad => label.includes(bad)));

  assert.strictEqual(leakedPhrases.length, 0, `No procedural phrases or unapproved raw labels should leak into Stage 2 graph. Leaked: ${leakedPhrases.join(', ')}`);
  console.log(" ✅ PASS: Stage 2 enforced Controlled Enrichment rules and rejected all raw procedural instructions.\n");

  // ── TEST 3: Stage 6 Language Syntax & Contract Violation Gates ──
  console.log("--- TEST 3: Stage 6 Language-Aware Syntax & Contract Violation Gates ---");

  // Test item with invented operator synthesis: {$design and create: ...}
  const invalidSyntaxItem = {
    slotId: "slot_test_invalid",
    conceptId: "group",
    conceptLabel: "$group",
    stem: "Which query correctly groups restaurants?",
    options: [
      'db.restaurants.aggregate([ { $design and create: { _id: "$cuisine" } } ])',
      'db.restaurants.aggregate([ { $group: { _id: "$cuisine", count: { $sum: 1 } } } ])',
      'db.restaurants.find({ category: "Italian" })',
      'db.restaurants.createIndex({ cuisine: 1 })'
    ],
    correctAnswer: 'db.restaurants.aggregate([ { $group: { _id: "$cuisine", count: { $sum: 1 } } } ])',
    sourceEvidence: { text: sampleAssignment3Text }
  };

  const validationContext = {
    cleanedContent: sampleAssignment3Text,
    documentProfile: docProfile,
    docType: docProfile.documentType,
    config: { THRESHOLDS: { MIN_QUALITY_SCORE: 0.75 } }
  };

  const eduRes = await runEducationalValidation(invalidSyntaxItem, validationContext);
  console.log(`  ├─ Invalid Syntax Validation Result: Passed: ${eduRes.passed} | Quality: ${eduRes.qualityScore}`);
  console.log(`  └─ Major Warnings:`, eduRes.findings?.majorWarnings);

  const hasSyntaxOrContractWarning = eduRes.findings?.majorWarnings?.some(w => w === 'EDU_010' || w === 'EDU_011');
  assert.strictEqual(hasSyntaxOrContractWarning, true, "Stage 6 should flag EDU_010 or EDU_011 for invalid synthesized operator '$design and create'");
  console.log(" ✅ PASS: Stage 6 correctly flagged EDU_010 / EDU_011 on invalid synthesized operator.\n");

  // ── TEST 4: End-to-End Pipeline Contract Enforcement ──
  console.log("--- TEST 4: E2E Pipeline Generation & Portfolio Assembly ---");

  const pipelineResult = await generateMCQPipeline({
    content: sampleAssignment3Text,
    difficulty: "Balanced",
    requestedCount: 4,
    requestId: "test_contract_e2e_" + Date.now()
  });

  const finalQuiz = pipelineResult.finalQuiz;
  assert.strictEqual(Array.isArray(finalQuiz.questions) && finalQuiz.questions.length > 0, true, "Pipeline should deliver valid questions");
  console.log(` Delivered ${finalQuiz.questions.length} validated MCQs.`);

  finalQuiz.questions.forEach((q, idx) => {
    const textToScan = `${q.stem || q.questionText || q.question} ${q.options?.join(" ")}`;
    console.log(`  Q${idx + 1}: "${q.stem || q.questionText || q.question}"`);

    // Verify zero meta-references or invented operators
    assert.strictEqual(/restaurants\.json|Scenario 1|Assignment 3/i.test(textToScan), false, "Question should contain ZERO meta-references");
    assert.strictEqual(/\$\s*[a-z]+\s+[a-z]+/i.test(textToScan), false, "Question should contain ZERO invented multi-word operators");
  });

  console.log("\n======================================================================");
  console.log(" 🎉 CROSS-STAGE CONTRACT ENFORCEMENT TESTS PASSED CLEANLY");
  console.log("======================================================================\n");
}

runContractVerification().catch(err => {
  console.error("❌ Verification Test Failed:", err);
  process.exit(1);
});
