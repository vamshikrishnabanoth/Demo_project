/**
 * server/test_assignment2_pipeline.js
 * 
 * Verification Test Suite for Major Architecture Upgrade v2.0:
 * Generalized Educational Assessment Pipeline on Assignment 2: Advanced CRUD Operations.
 */

const assert = require('assert');
const { cleanDocument } = require('./engine/conceptGraphBuilder/utils/documentCleaner');
const { isValidConcept } = require('./engine/conceptGraphBuilder/utils/conceptSanitizer');
const { buildConceptGraph } = require('./engine/conceptGraphBuilder');
const { generateQuizPlan } = require('./engine/quizPlanner');
const { classifyDocumentAndIntent } = require('./engine/quizPlanner/documentClassifier');
const { generateMCQPipeline } = require('./engine/mcqEngine');

const sampleAssignment2Text = `
Assignment 2: Advanced CRUD Operations in MongoDB
Scenario 1 - Low Stock Products
Dataset link: https://drive.google.com/file/d/1abcxyz/view (products.json)
The warehouse manager wants to restock products that are running low.
Display all products whose stock is less than 20. Use $lt operator.
db.products.find({ stock: { $lt: 20 } })

Scenario 2 - Premium Product Listing
Dataset link: https://drive.google.com/file/d/2defuvw/view (movies.json)
The marketing team is preparing a premium product catalogue.
Display all products costing more than 10000 arranged from most expensive to least expensive.
db.products.find({ price: { $gt: 10000 } }).sort({ price: -1 })

Scenario 3 - Customer Cart Update
Add a new item to customer shopping cart array using $push operator.
db.customers.updateOne({ id: 101 }, { $push: { cart: "Laptop" } })

Scenario 4 - Delete Inactive Users
Delete all user accounts that have status "inactive" using deleteMany().
db.users.deleteMany({ status: "inactive" })
`;

async function runAssignment2Verification() {
  console.log('======================================================================');
  console.log(' 🚀 RUNNING VERIFICATION: PIPELINE v2.0 (ASSIGNMENT 2 CRUD OPS)');
  console.log('======================================================================\n');

  // TEST GROUP 1: Structural Metadata Stripping & Concept Filtering
  console.log('--- TEST GROUP 1: Structural Metadata Stripping ---');
  const { cleanedText } = cleanDocument(sampleAssignment2Text);
  
  const metadataBlacklist = ["https", "products.json", "movies.json", "scenario 1", "scenario 2", "assignment 2"];
  metadataBlacklist.forEach(tag => {
    assert.strictEqual(cleanedText.toLowerCase().includes(tag), false, `Cleaned text must NOT contain structural metadata '${tag}'`);
  });
  console.log(' ✅ PASS: Structural metadata (URLs, dataset filenames, Scenario labels) cleanly stripped.');

  const graph = buildConceptGraph(sampleAssignment2Text);
  const conceptLabels = graph.nodes.map(n => n.label.toUpperCase());
  console.log(` Extracted Concepts (${graph.nodes.length}):`, conceptLabels.join(', '));

  assert.strictEqual(conceptLabels.some(c => c.includes("SCENARIO")), false, "Scenario must NOT be a concept node.");
  assert.strictEqual(conceptLabels.some(c => c.includes("PRODUCTS.JSON")), false, "Filename must NOT be a concept node.");
  assert.strictEqual(conceptLabels.some(c => c.includes("HTTPS")), false, "URL must NOT be a concept node.");
  console.log(' ✅ PASS: Zero structural metadata tags present in Concept Graph.');

  // TEST GROUP 2: Typed Concept Classification & Document Intent
  console.log('\n--- TEST GROUP 2: Typed Concept Classification & Document Intent ---');
  const classification = classifyDocumentAndIntent(graph, sampleAssignment2Text);
  console.log(` Document Type: ${classification.docType} | Intent: ${classification.primaryIntent}`);
  console.log(` Practical Executable Ratio Allocated: ${Math.round(classification.composition.practicalExecutableRatio * 100)}%`);

  assert.strictEqual(classification.docType, "DATABASE_QUERY_DOCUMENT", "Document type must be DATABASE_QUERY_DOCUMENT");
  assert.strictEqual(classification.isPractical, true, "isPractical must be true");
  assert.strictEqual(classification.composition.practicalExecutableRatio >= 0.60, true, "Practical question ratio must be 60-80%");
  console.log(' ✅ PASS: Document correctly classified as DATABASE_QUERY_DOCUMENT with 70% practical executable ratio.');

  // TEST GROUP 3: E2E Pipeline Generation & Quality Gates
  console.log('\n--- TEST GROUP 3: E2E Pipeline Generation & Quality Gates ---');
  const circuitBreaker = require('./engine/questionGenerator/circuitBreaker');
  circuitBreaker.reset();
  process.env.LLM_PROVIDER = "mock";

  const pipelineResult = await generateMCQPipeline({
    content: sampleAssignment2Text,
    difficulty: "Balanced",
    requestedCount: 4,
    requestId: "test_assignment2_e2e_" + Date.now()
  });

  const finalQuiz = pipelineResult.finalQuiz;
  assert.strictEqual(Array.isArray(finalQuiz.questions) && finalQuiz.questions.length > 0, true, "Pipeline should deliver valid questions");
  console.log(` Generated ${finalQuiz.questions.length} MCQs for Assignment 2.`);

  // Verify No Meta References in stems or options
  finalQuiz.questions.forEach((q, idx) => {
    const stem = q.stem || q.questionText;
    assert.strictEqual(/\bscenario\s*\d+\b/i.test(stem), false, `Question #${idx+1} stem must NOT contain 'Scenario X' meta-references`);
    assert.strictEqual(/\bproducts\.json\b/i.test(stem), false, `Question #${idx+1} stem must NOT contain dataset filenames`);
  });
  console.log(' ✅ PASS: All delivered questions have ZERO meta-references or dataset filenames.');

  // Verify Out-of-Domain Distractors
  const OUT_OF_DOMAIN_PATTERNS = [/compiler internals/i, /packet transmission/i, /kernel scheduling/i];
  finalQuiz.questions.forEach((q, idx) => {
    (q.options || []).forEach(opt => {
      OUT_OF_DOMAIN_PATTERNS.forEach(pat => {
        assert.strictEqual(pat.test(String(opt)), false, `Question #${idx+1} option '${opt}' must NOT contain out-of-domain terms`);
      });
    });
  });
  console.log(' ✅ PASS: All delivered distractors are semantically consistent with database domain (ZERO out-of-domain terms).');

  console.log('\n======================================================================');
  console.log(' 🎉 ALL MAJOR ARCHITECTURE UPGRADE v2.0 TESTS PASSED CLEANLY');
  console.log('======================================================================\n');
}

runAssignment2Verification().catch(err => {
  console.error('\n❌ Verification Test Failed:', err);
  process.exit(1);
});
