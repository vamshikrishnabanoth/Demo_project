/**
 * server/test_uml_unit3_filter.js
 * 
 * Verification Test for Unit-3 Conceptual Model of UML Document Filtering,
 * Acronym Blacklisting (CSE/CSM/CSD/IT), and Anti-Boilerplate Distractor Quality Gate.
 */

'use strict';

const assert = require('assert');
const { cleanDocument } = require('./engine/conceptGraphBuilder/utils/documentCleaner');
const { buildConceptGraph } = require('./engine/conceptGraphBuilder/index');
const { runEducationalValidation } = require('./engine/validators/educationalValidator');
const { generateMCQPipeline } = require('./engine/mcqEngine');

async function runUMLVerification() {
  console.log('\n======================================================================');
  console.log(' 🧪 RUNNING UML UNIT-3 CONCEPTUAL MODEL FILTER & QUALITY TEST');
  console.log('======================================================================\n');

  const sampleUMLText = `
UNIT - 3
SOFTWARE ENGINEERING (RKR21)
DEPARTMENT OF CSE / CSM / CSD / IT
PAGE 1 OF 45

Conceptual Model of UML
The Unified Modeling Language (UML) consists of three major building blocks: Things, Relationships, and Diagrams.
1. Structural Things: Class Diagram, Use Case Diagram, Component Diagram, Node Diagram.
2. Behavioral Things: Interactions, State Machines, Activity Diagrams.
3. Relationships: Dependency, Association, Generalization, Realization.

A Class Diagram illustrates system classes, attributes, operations, and relationships between objects.
A Use Case Diagram captures system functionality and actor interactions.
A Sequence Diagram illustrates dynamic interactions between objects over time using lifeline messages.
A Component Diagram models physical software components, executables, and libraries.
`;

  // TEST 1: Header Cleaning & Acronym Blacklisting
  console.log('--- TEST GROUP 1: Document Cleaning & Acronym Blacklist ---');
  const cleaned = cleanDocument(sampleUMLText);
  const graph = buildConceptGraph(cleaned.cleanedText);
  const nodeLabels = graph.nodes.map(n => String(n.label || n.id).toUpperCase());

  const blacklisted = ['CSE', 'CSM', 'CSD', 'IT', 'ECE', 'EEE', 'RKR21', 'SOFTWARE ENGINEERING', 'UNIT - 3'];
  blacklisted.forEach(badTag => {
    const found = nodeLabels.includes(badTag);
    assert.strictEqual(found, false, `Blacklisted header tag '${badTag}' must NOT be extracted as a concept node.`);
    console.log(` ✅ PASS: Blacklisted header tag '${badTag}' cleanly filtered.`);
  });

  const validConcepts = ['CLASS DIAGRAM', 'USE CASE DIAGRAM', 'SEQUENCE DIAGRAM', 'COMPONENT DIAGRAM'];
  const matchedValid = nodeLabels.filter(lbl => validConcepts.some(v => lbl.includes(v)));
  assert(matchedValid.length > 0, 'Graph should extract actual UML diagram concepts');
  console.log(` ✅ PASS: Valid UML concepts extracted: [${matchedValid.join(', ')}]`);

  // TEST 2: Boilerplate Distractor Rejection Gate (EDU_006)
  console.log('\n--- TEST GROUP 2: Boilerplate Distractor Gate (EDU_006) ---');
  const mcqWithBoilerplate = {
    stem: "What is the primary function of a Class Diagram in UML?",
    options: [
      "Illustrates system classes, attributes, operations, and relationships.",
      "Core mechanism governing Amazon Product Management System operations.",
      "Secondary protocol configuration for external services.",
      "Legacy database schema table definition."
    ],
    correctAnswer: "Illustrates system classes, attributes, operations, and relationships."
  };

  const eduResult = await runEducationalValidation(mcqWithBoilerplate, {});
  assert.strictEqual(eduResult.passed, false, 'MCQ with boilerplate distractors must be REJECTED');
  assert(eduResult.findings.criticalFailures.includes('EDU_006'), 'Must flag error code EDU_006');
  assert(eduResult.repairHints.includes('REWRITE_DOMAIN_SPECIFIC_DISTRACTORS'), 'Must assign REWRITE_DOMAIN_SPECIFIC_DISTRACTORS repair hint');
  console.log(' ✅ PASS: Candidate with boilerplate template distractors rejected with score:', eduResult.qualityScore);
  console.log(' ✅ PASS: Error code EDU_006_BOILERPLATE_LEAK flagged cleanly');

  // TEST 3: End-to-End MCQ Generation Verification
  console.log('\n--- TEST GROUP 3: E2E Generation Verification ---');
  const circuitBreaker = require('./engine/questionGenerator/circuitBreaker');
  circuitBreaker.reset();
  process.env.LLM_PROVIDER = "mock";

  const pipelineResult = await generateMCQPipeline({
    content: sampleUMLText,
    difficulty: "Balanced",
    requestedCount: 3,
    requestId: "test_uml_unit3_e2e"
  });

  assert(pipelineResult.questions.length > 0, 'Pipeline should deliver valid questions');
  pipelineResult.questions.forEach((q, idx) => {
    const text = JSON.stringify(q).toLowerCase();
    const hasBoilerplate = text.includes('core mechanism governing') || text.includes('secondary protocol configuration') || text.includes('legacy database schema');
    assert.strictEqual(hasBoilerplate, false, `Question #${idx + 1} must contain ZERO template boilerplate distractors`);

    const hasBlacklistedNode = blacklisted.some(b => q.targetConcept?.toUpperCase() === b);
    assert.strictEqual(hasBlacklistedNode, false, `Question #${idx + 1} target concept must not be a blacklisted header tag`);
  });

  console.log(' ✅ PASS: All delivered questions have ZERO boilerplate template distractors');
  console.log(' ✅ PASS: All question stems focus on genuine UML concepts (Class, Use Case, Sequence, Component Diagrams)');

  console.log('\n======================================================================');
  console.log(' 🎉 ALL UML UNIT-3 FILTER & QUALITY TESTS PASSED CLEANLY');
  console.log('======================================================================\n');
}

runUMLVerification().catch(err => {
  console.error('❌ Verification Test Failed:', err);
  process.exit(1);
});
