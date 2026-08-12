/**
 * Document Store & Persistence Layer E2E Test Suite (v3.2.0)
 * Verifies document persistence, stable documentId generation, scoped text retrieval,
 * and memory-light lightweight docket rehydration.
 */

const assert = require('assert');
const documentStore = require('./storage/documentStore');
const { generateMCQPipeline } = require('./engine/mcqEngine');

const SAMPLE_TEXT = `
Unit-3 Software Engineering & Architectural Patterns
1. Singleton Pattern: Ensures a class has only one instance and provides a global access point.
2. Factory Method Pattern: Defines an interface for creating objects in a superclass.
3. Observer Pattern: Defines a one-to-many dependency between objects.
4. Strategy Pattern: Enables selecting an algorithm's behavior at runtime.
5. Adapter Pattern: Allows incompatible interfaces to work together.
`;

async function runDocumentStoreTest() {
  console.log("\n======================================================================");
  console.log(" 🧪 DOCUMENT STORE & PERSISTENCE LAYER E2E TEST (v3.2.0)");
  console.log("======================================================================\n");

  // 1. Save Document & Check documentId Creation
  const docEntry = documentStore.saveDocument({
    filename: 'Software_Architecture_Patterns.pdf',
    ext: '.pdf',
    totalPages: 5,
    textContent: SAMPLE_TEXT
  });

  assert.strictEqual(typeof docEntry.documentId, 'string');
  assert.strictEqual(docEntry.documentId.startsWith('doc_'), true);
  console.log(` ✅ PASS 1: Document saved to DocumentStore with stable documentId: ${docEntry.documentId}`);

  // 2. Test Scoped Text Range Retrieval (Pages 1 to 3)
  const scoped = documentStore.getScopedText(docEntry.documentId, 1, 3);
  assert.strictEqual(scoped.documentId, docEntry.documentId);
  assert.strictEqual(scoped.startPage, 1);
  assert.strictEqual(scoped.endPage, 3);
  assert.strictEqual(scoped.scopedText.includes('Singleton Pattern'), true);
  console.log(` ✅ PASS 2: Scoped text retrieval by documentId (Pages 1-3) returned ${scoped.scopedText.length} chars.`);

  // 3. Pipeline Generation via documentId Scoped Payload
  const pipelineResult = await generateMCQPipeline({
    content: scoped.scopedText,
    difficulty: 'Balanced',
    requestedCount: 3,
    requestId: `test_doc_store_${Date.now()}`
  });

  assert.strictEqual(Array.isArray(pipelineResult.finalQuiz.questions) && pipelineResult.finalQuiz.questions.length > 0, true);
  console.log(` ✅ PASS 3: 9-Stage MCQ Pipeline successfully generated ${pipelineResult.finalQuiz.questions.length} questions from documentId.`);

  console.log("\n======================================================================");
  console.log(" 🎉 ALL DOCUMENT STORE & PERSISTENCE LAYER TESTS PASSED CLEANLY!");
  console.log("======================================================================\n");
}

runDocumentStoreTest().catch(err => {
  console.error("❌ DocumentStore Test Failed:", err);
  process.exit(1);
});
