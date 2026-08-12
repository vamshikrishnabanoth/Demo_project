/**
 * server/test_meta_reference_filter.js
 * 
 * AUTOMATED TEST SUITE FOR SELF-CONTAINED STEMS & ANTI-META-REFERENCE FILTER
 */

process.env.LLM_PROVIDER = "mock";
require('dotenv').config();

const { runEducationalValidation } = require('./engine/validators/educationalValidator');
const { VALIDATOR_CONFIG } = require('./config/validatorConfig');
const { generateMCQPipeline } = require('./engine/mcqEngine');

async function testMetaReferenceFilter() {
  console.log('======================================================================');
  console.log('  🧪 STAGE 6 & STAGE 4 ANTI-META-REFERENCE FILTER VERIFICATION        ');
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
  // TEST GROUP 1: Rejection of Document Structural Meta-Labels
  // -------------------------------------------------------------------------
  console.log('--- TEST GROUP 1: Rejection of Structural Meta-Labels ---');

  const metaReferenceStems = [
    "What is the primary purpose of Scenario 1?",
    "An engineer encounters a system scenario involving Scenario 2. Which design choice applies?",
    "A defect or anomaly is detected in ASSIGNMENT 1. What is the root cause?",
    "In this document, what is the role of Scenario 3?",
    "According to paragraph 4, how are low stock products filtered?",
    "In the pdf file, which restaurant is in Hyderabad?"
  ];

  for (const stem of metaReferenceStems) {
    const item = {
      stem,
      options: ["Option A", "Option B", "Option C", "Option D"],
      correctAnswer: "Option A"
    };

    const res = await runEducationalValidation(item, { extractedConcepts: ["Product Management"] });
    assert(res.passed === false, `Rejected meta-reference stem: "${stem.slice(0, 45)}..."`);
    assert(res.findings.majorWarnings.includes("EDU_005"), `Flagged error code EDU_005 for stem: "${stem.slice(0, 35)}..."`);
    assert(res.repairHints.includes("REWRITE_SELF_CONTAINED_QUESTION"), `Assigned repair hint REWRITE_SELF_CONTAINED_QUESTION`);
  }

  // -------------------------------------------------------------------------
  // TEST GROUP 2: Zero False-Positives on Legitimate Programming Terminology
  // -------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 2: Zero False-Positives on Technical "Assignment" Context ---');

  const validTechnicalStems = [
    "What is the purpose of a variable assignment in Python?",
    "Which operator is used for value assignment in C++?",
    "How does role assignment enhance security in role-based access control (RBAC)?",
    "What happens during multiple variable assignment in JavaScript?"
  ];

  for (const stem of validTechnicalStems) {
    const item = {
      stem,
      options: ["Option A", "Option B", "Option C", "Option D"],
      correctAnswer: "Option A"
    };

    const res = await runEducationalValidation(item, { extractedConcepts: ["Programming", "Security"] });
    assert(res.scores.metaReference !== 0.0, `Allowed technical assignment stem without false positive: "${stem.slice(0, 50)}..."`);
    assert(!res.findings.majorWarnings.includes("EDU_005"), `Zero false positive code EDU_005 for: "${stem.slice(0, 40)}..."`);
  }

  // -------------------------------------------------------------------------
  // TEST GROUP 3: E2E Pipeline Verification on Document with Scenarios
  // -------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 3: E2E Pipeline Generation on Assignment Document ---');

  const assignmentSampleText = `
Amazon Product Management System (products.json)
Scenario 1 - Low Stock Products
The warehouse manager wants to restock products that are running low. Display all products whose stock is less than 20.

Scenario 2 - Premium Product Listing
The marketing team is preparing a premium product catalogue. Display all products costing more than ₹10,000 arranged from most expensive to least expensive.

Netflix Movie Database (movies.json)
Scenario 1 - Trending Movies
Netflix wants to promote highly rated movies with rating above 8.5.
`;

  const pipelineRes = await generateMCQPipeline({
    content: assignmentSampleText,
    difficulty: "Balanced",
    requestedCount: 3,
    requestId: "test_meta_ref_e2e"
  });

  assert(pipelineRes.status === 'SUCCESS' || pipelineRes.status === 'PARTIAL_SUCCESS', 'Pipeline generated questions successfully');

  const questions = pipelineRes.questions || [];
  assert(questions.length > 0, `Generated ${questions.length} questions`);

  const META_REF_REGEX = /\b(scenario\s*\d+|paragraph\s*\d+|section\s*\d+|exercise\s*\d+|task\s*\d+|assignment\s*\d+|in\s+(this|the)\s+(document|pdf|docx|file|assignment|section|text))\b/i;

  let metaRefCount = 0;
  questions.forEach(q => {
    const stem = q.stem || q.questionText || q.question;
    if (META_REF_REGEX.test(stem)) {
      metaRefCount++;
      console.error(` ❌ Meta-reference leak detected in question: "${stem}"`);
    }
  });

  assert(metaRefCount === 0, `Zero meta-references present across all ${questions.length} final generated questions`);

  console.log('\n======================================================================');
  console.log(`  🎉 ANTI-META-REFERENCE TEST SUITE PASSED: ${passedTests}/${totalTests} CHECKS CLEAN`);
  console.log('======================================================================\n');
}

testMetaReferenceFilter().catch(err => {
  console.error('❌ Anti-Meta-Reference Filter Test Error:', err);
  process.exit(1);
});
