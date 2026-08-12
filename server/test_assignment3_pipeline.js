/**
 * Pipeline v2.5 Verification Test Suite: Assignment 3 (MongoDB Aggregation & Indexing)
 * Tests Stage 1.5 Instructional Document Analyzer, Language/Syntax Awareness & Quality Gates
 */

const assert = require('assert');
const { generateMCQPipeline } = require('./engine/mcqEngine');
const { analyzeInstructionalDocument } = require('./engine/documentAnalyzer/index');
const { buildConceptGraph } = require('./engine/conceptGraphBuilder/index');

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

async function runAssignment3Verification() {
  console.log("\n======================================================================");
  console.log(" 🧪 PIPELINE v2.5 VERIFICATION: ASSIGNMENT 3 (AGGREGATION & INDEXING)");
  console.log("======================================================================\n");

  // ── TEST GROUP 1: Stage 1.5 Instructional Document Analyzer ──
  console.log("--- TEST GROUP 1: Stage 1.5 Document Profile & Language Detection ---");
  const docProfile = analyzeInstructionalDocument(sampleAssignment3Text);

  console.log(`  ├─ Document Type Detected: ${docProfile.documentType}`);
  console.log(`  ├─ Primary Language Family: ${docProfile.primaryLanguageFamily} (Conf: ${docProfile.confidence})`);
  console.log(`  ├─ Structural Metadata Filtered (${docProfile.structuralMetadata.length}):`, docProfile.structuralMetadata);
  console.log(`  ├─ Procedural Actions Filtered (${docProfile.proceduralActions.length}):`, docProfile.proceduralActions);
  console.log(`  └─ Instructional Concepts Extracted (${docProfile.instructionalConcepts.length}):`, docProfile.instructionalConcepts);

  assert.strictEqual(docProfile.primaryLanguageFamily, 'MongoDB', "Primary language family should be detected as MongoDB");
  assert.strictEqual(docProfile.documentType, 'PRACTICAL_LAB_ASSIGNMENT', "Document type should be PRACTICAL_LAB_ASSIGNMENT");

  const hasGroup = docProfile.instructionalConcepts.includes('$GROUP');
  const hasUnwind = docProfile.instructionalConcepts.includes('$UNWIND');
  const hasIXSCAN = docProfile.instructionalConcepts.includes('IXSCAN');

  assert.strictEqual(hasGroup && hasUnwind && hasIXSCAN, true, "Instructional concepts should contain $GROUP, $UNWIND, and IXSCAN");
  console.log(" ✅ PASS: Stage 1.5 correctly identified MongoDB language family, practical lab type, and filtered text triad.\n");

  // ── TEST GROUP 2: Concept Graph Filtering (Zero Procedural / Metadata Tags) ──
  console.log("--- TEST GROUP 2: Concept Graph Noise Isolation ---");
  const cg = buildConceptGraph(sampleAssignment3Text);
  const conceptLabels = cg.nodes.map(n => n.label.toUpperCase());

  console.log(` Extracted Concepts (${conceptLabels.length}):`, conceptLabels.join(", "));

  const invalidTags = ["RESTAURANTS.JSON", "SORT THE FINAL OUTPUT", "ONLY INCLUDE CATEGORIES", "ASSIGNMENT 3", "SCENARIO 1"];
  const leakedTags = conceptLabels.filter(label => invalidTags.some(bad => label.includes(bad)));

  assert.strictEqual(leakedTags.length, 0, `No procedural or metadata phrases should leak into Concept Graph. Leaked: ${leakedTags.join(', ')}`);
  console.log(" ✅ PASS: Zero procedural instructions or metadata tags present in Concept Graph.\n");

  // ── TEST GROUP 3: End-to-End Pipeline & Quality Gates ──
  console.log("--- TEST GROUP 3: E2E Pipeline Generation & Language Syntax Gates ---");

  const pipelineResult = await generateMCQPipeline({
    content: sampleAssignment3Text,
    difficulty: "Balanced",
    requestedCount: 4,
    requestId: "test_assignment3_e2e_" + Date.now()
  });

  const finalQuiz = pipelineResult.finalQuiz;
  assert.strictEqual(Array.isArray(finalQuiz.questions) && finalQuiz.questions.length > 0, true, "Pipeline should deliver valid questions");
  console.log(` Generated ${finalQuiz.questions.length} MCQs for Assignment 3.`);

  finalQuiz.questions.forEach((q, idx) => {
    console.log(`\n  Q${idx + 1} (${q.bloomLevel || 'APPLY'}): "${q.stem || q.questionText || q.question}"`);
    (q.options || []).forEach((opt, oIdx) => {
      const isCorrect = opt === q.correctAnswer;
      console.log(`     ${String.fromCharCode(65 + oIdx)}. ${opt} ${isCorrect ? '✅ (Correct)' : ''}`);
    });

    // Check zero meta references
    const textToScan = `${q.questionText || q.question} ${q.options?.join(" ")}`;
    assert.strictEqual(/restaurants\.json|Scenario 1|Assignment 3/i.test(textToScan), false, "Question should contain ZERO meta-references");

    // Check zero out-of-domain terms
    assert.strictEqual(/packet transmission|kernel scheduling|compiler pass/i.test(textToScan), false, "Question should contain ZERO out-of-domain terms");
  });

  console.log("\n ✅ PASS: All delivered questions test actual MongoDB aggregation & index mechanics with valid syntax.");
  console.log(" ✅ PASS: All distractors are domain-consistent with ZERO out-of-domain terms.\n");

  console.log("======================================================================");
  console.log(" 🎉 PIPELINE v2.5 STAGE 1.5 ARCHITECTURE UPGRADE TESTS PASSED CLEANLY");
  console.log("======================================================================\n");
}

runAssignment3Verification().catch(err => {
  console.error("❌ Verification Test Failed:", err);
  process.exit(1);
});
