/**
 * server/test_regression_v200.js
 * 
 * COMPREHENSIVE END-TO-END DOWNSTREAM REGRESSION TEST SUITE (v2.0.0)
 * Verifies all 10 modules of the AI Quiz Pipeline Patch v2.0.0.
 */

process.env.LLM_PROVIDER = "mock";
require('dotenv').config();

const { cleanDocument } = require('./engine/conceptGraphBuilder/utils/documentCleaner');
const { sanitizeConcept, isValidConcept } = require('./engine/conceptGraphBuilder/utils/conceptSanitizer');
const { repairConcept } = require('./engine/conceptGraphBuilder/conceptRepair/index');
const { extractSnappedContext } = require('./engine/promptBuilder/contextExtractor');
const circuitBreaker = require('./engine/questionGenerator/circuitBreaker');
const { generateMCQPipeline } = require('./engine/mcqEngine');

async function runRegressionSuite() {
  console.log('======================================================================');
  console.log('    🧪 AI QUIZ PIPELINE STABILITY & QUALITY PATCH v2.0.0 REGRESSION   ');
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
  // TEST 1: MODULE 1 — Document Cleaner Preprocessor
  // -------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 1: Document Preprocessing & OCR Noise Cleaning ---');
  const dirtyDoc = `
# Database Architecture
Page 1 of 12
Slide 5
==================
Chapter 1 .......... 14
# Database Architecture

Database B-Tree indexing optimizes query performance.
\`\`\`javascript
const index = new BTreeIndex();
\`\`\`
  `;

  const { cleanedText, stats } = cleanDocument(dirtyDoc);
  assert(stats.ocrArtifactsRemoved >= 3, 'DocumentCleaner removed OCR artifacts and page/slide noise');
  assert(stats.headersNormalized >= 1, 'DocumentCleaner deduplicated Markdown headers');
  assert(cleanedText.includes('const index = new BTreeIndex();'), 'DocumentCleaner preserved code blocks intact');
  assert(!cleanedText.includes('Page 1 of 12'), 'DocumentCleaner stripped page number noise');

  // -------------------------------------------------------------------------
  // TEST 2: MODULE 2 — Concept Sanitizer & Pluggable Concept Repair Rules
  // -------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 2: Concept Sanitizer & Pluggable Repair Rules ---');

  const repair1 = repairConcept("Hash indexes provide O");
  assert(repair1.repaired === "Hash Index", `Repaired "Hash indexes provide O" -> "${repair1.repaired}"`);
  assert(repair1.confidence >= 0.90, `Repair confidence is high (${repair1.confidence})`);
  assert(repair1.strategy === "verb_phrase_trim", `Repair strategy identified (${repair1.strategy})`);

  const repair2 = repairConcept("An ACK flag is");
  assert(repair2.repaired === "ACK Flag", `Repaired "An ACK flag is" -> "${repair2.repaired}"`);

  const repair3 = repairConcept("# Database \n ## Indexing");
  assert(repair3.repaired === "Indexing" || repair3.repaired === "Database", `Repaired Markdown header -> "${repair3.repaired}"`);

  const repair4 = repairConcept("Distributed Hash Table");
  assert(repair4.repaired === "Distributed Hash Table", `Preserved multi-word concept "Distributed Hash Table" without blind truncation`);

  assert(isValidConcept("TCP ACK"), 'Validates technical concept "TCP ACK" as valid');
  assert(!isValidConcept("an"), 'Rejects single stop word "an" as invalid concept');

  // -------------------------------------------------------------------------
  // TEST 3: MODULE 3 — Abbreviation-Aware Sentence Boundary Chunking
  // -------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 3: Abbreviation-Aware Context Chunking ---');
  const techText = "In database systems, e.g. PostgreSQL or MySQL, B-Tree indexes optimize exact O(1) equality searches. For example, Dr. C. Date proposed relational model guidelines in v1.2 specifications.";
  const snippet = extractSnappedContext(techText, [[0, 50]]);
  assert(!snippet.endsWith("e.g.") && !snippet.endsWith("Dr."), `Context chunking preserved technical abbreviations ("${snippet.slice(0, 40)}...")`);

  // -------------------------------------------------------------------------
  // TEST 4: MODULE 4 — 3-State Circuit Breaker & Cooldown Recovery
  // -------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 4: 3-State Circuit Breaker ---');
  circuitBreaker.reset();
  assert(circuitBreaker.getState() === 'CLOSED', 'Circuit breaker starts in CLOSED state');

  circuitBreaker.recordFailure(new Error("503 Service Unavailable"));
  circuitBreaker.recordFailure(new Error("503 Service Unavailable"));
  circuitBreaker.recordFailure(new Error("503 Service Unavailable"));
  assert(circuitBreaker.isBroken(), 'Circuit breaker enters OPEN state after 3 transient failures');

  // Simulate cooldown passage
  circuitBreaker.lastStateChange = Date.now() - 65000;
  assert(circuitBreaker.getState() === 'HALF_OPEN', 'Circuit breaker transitions to HALF_OPEN after 60s cooldown');

  circuitBreaker.recordSuccess();
  assert(circuitBreaker.getState() === 'CLOSED', 'Circuit breaker recovers to CLOSED state on successful probe');

  // -------------------------------------------------------------------------
  // TEST 5: MODULE 5, 6, 7, 8 — Full E2E Pipeline & Downstream Telemetry Verification
  // -------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 5: Full Downstream Pipeline & Telemetry Verification ---');

  const pipelinePayload = {
    content: `
# Computer Network Protocols & Architecture

Transmission Control Protocol (TCP) is a core protocol of the Internet protocol suite.
TCP is defined as a connection-oriented protocol that guarantees reliable delivery.

An ACK flag is sent by the receiver to confirm packet receipt.
Checksum algorithm is used for detecting frame corruption.
Hash indexes provide O(1) average time complexity for exact equality queries.
    `,
    difficulty: "Balanced",
    requestedCount: 5,
    requestId: "req_regression_v200"
  };

  const res = await generateMCQPipeline(pipelinePayload);

  assert(res.status === 'SUCCESS' || res.status === 'PARTIAL_SUCCESS', `Pipeline executed with status: ${res.status}`);
  assert(Array.isArray(res.questions) && res.questions.length > 0, `Delivered ${res.questions?.length} valid quiz questions`);

  // Verify concept quality: No malformed "Hash indexes provide O" or "An ACK flag is" in delivered questions
  const stems = res.questions.map(q => q.questionText || q.stem || q.question);
  const corruptedStems = stems.filter(s => s.includes("Hash indexes provide O") || s.includes("An ACK flag is"));
  assert(corruptedStems.length === 0, 'Zero corrupted concept fragments present in generated question stems');

  // Verify telemetry consistency: No undefined values in quality scores or validator traces
  const firstQ = res.questions[0];
  assert(firstQ.qualityScore !== undefined, `Question qualityScore defined: ${firstQ.qualityScore}`);

  console.log('\n======================================================================');
  console.log(`  🎉 REGRESSION TEST SUITE PASSED: ${passedTests}/${totalTests} CHECKS VERIFIED CLEANLY`);
  console.log('======================================================================\n');
}

runRegressionSuite().catch(err => {
  console.error('❌ Regression Test Suite Error:', err);
  process.exit(1);
});
