/**
 * server/test_pdi_calibration.js
 * 
 * Phase 2.4: Dedicated Test Suite for PDI Router Calibration
 * 
 * Verifies:
 * 1. Mathematical elimination of monologue ceiling (strong monologue reaches BLUEPRINT >= 0.60).
 * 2. Boundary calibration across pedagogical densities (0.5 -> SUMMARY, 1.0 -> SUMMARY, 1.5 -> BLUEPRINT).
 * 3. Dialogue rebalancing (pure dialogue capped at 0.60, interactive lecture reaches 0.70).
 * 4. Code penalty behavior (unvoiced code penalized; voiced code explanation not penalized).
 * 5. Modality invariants (slides-only -> SUMMARY, multimodal -> UNIFIED).
 * 6. Real lecture corpus validation.
 */

'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const pdiRouter = require('./engine/pdiRouter');

let passCount = 0;
let failCount = 0;

function runTest(testName, fn) {
  try {
    fn();
    console.log(` ✅ PASS [${passCount + 1}]: ${testName}`);
    passCount++;
  } catch (err) {
    console.error(` ❌ FAIL: ${testName}`);
    console.error(`    ${err.message}`);
    failCount++;
  }
}

console.log('======================================================================');
console.log('🧪 PDI ROUTER EMPIRICAL CALIBRATION & CEILING REMOVAL (PHASE 2.4)');
console.log('======================================================================\n');

// 1. Monologue Ceiling Elimination
runTest('Monologue Ceiling Eliminated: High-pedagogy spoken monologue reaches BLUEPRINT', () => {
  const result = pdiRouter.route({
    voiceTranscript: `Remember this rule of thumb for the exam. It is important and critical to note that page faults trigger trap to kernel. Pay attention to the replacement algorithm, careful not to confuse FIFO with LRU. A common mistake is forgetting dirty bit.`
  });

  assert.strictEqual(result.selected_representation, 'BLUEPRINT', 'Should route to BLUEPRINT');
  assert.ok(result.pedagogical_delivery_index >= 0.60, `PDI should be >= 0.60, got ${result.pedagogical_delivery_index}`);
  assert.strictEqual(result.features.has_audio, true);
  assert.strictEqual(result.features.has_ppt, false);
});

// 2. Boundary Calibration for Monologue (Audio=1, PPT=0, Dial=0)
runTest('Boundary Calibration: 0.5 ped density -> SUMMARY, 1.0 -> SUMMARY, 1.5 -> BLUEPRINT', () => {
  const filler = 'The system architecture defines the interaction between hardware components and user applications. '.repeat(10); // 120 words
  
  // 0.5 density: 1 cue in 2,000 words
  const mildText = 'important '.concat(filler.repeat(17)); // ~2040 words, 1 cue => rho ~ 0.49
  const resMild = pdiRouter.route({ voiceTranscript: mildText });
  assert.strictEqual(resMild.selected_representation, 'SUMMARY', `Mild teaching should be SUMMARY, got ${resMild.selected_representation}`);
  assert.ok(resMild.pedagogical_delivery_index < 0.60, `PDI for mild should be < 0.60, got ${resMild.pedagogical_delivery_index}`);

  // 1.0 density: 1 cue in 1,000 words
  const modText = 'important '.concat(filler.repeat(8)); // ~961 words, 1 cue => rho ~ 1.04
  const resMod = pdiRouter.route({ voiceTranscript: modText });
  assert.strictEqual(resMod.selected_representation, 'SUMMARY', `Moderate teaching (1.0) should remain SUMMARY under denom 1.5, got ${resMod.selected_representation}`);
  assert.ok(resMod.pedagogical_delivery_index < 0.60, `PDI for moderate should be < 0.60, got ${resMod.pedagogical_delivery_index}`);

  // 1.5+ density: 2 cues in 1,000 words => rho ~ 2.08
  const strongText = 'remember important '.concat(filler.repeat(8)); // ~962 words, 2 cues => rho ~ 2.08
  const resStrong = pdiRouter.route({ voiceTranscript: strongText });
  assert.strictEqual(resStrong.selected_representation, 'BLUEPRINT', `Strong teaching (>=1.5) must reach BLUEPRINT, got ${resStrong.selected_representation}`);
  assert.ok(resStrong.pedagogical_delivery_index >= 0.60, `PDI for strong must be >= 0.60, got ${resStrong.pedagogical_delivery_index}`);
});

// 3. Flat Monologue Remains SUMMARY
runTest('Flat Monologue: Pure definitions without instructional cues strictly routes to SUMMARY', () => {
  const result = pdiRouter.route({
    voiceTranscript: `An operating system is system software that manages computer hardware and software resources. Time-sharing systems schedule tasks for efficient use. Memory is partitioned into blocks called pages.`
  });

  assert.strictEqual(result.selected_representation, 'SUMMARY');
  assert.strictEqual(result.pedagogical_delivery_index, 0.500);
});

// 4. Dialogue Rebalancing
runTest('Dialogue Rebalancing: Pure rhetorical dialogue capped at 0.60; Interactive + Pedagogy reaches 0.70', () => {
  // Pure rhetorical dialogue (0 pedagogy)
  const rhetoricalResult = pdiRouter.route({
    voiceTranscript: `Any questions? Do you understand? Yes ma'am. Right? Got it. Who can tell what is the answer? Why is that? Right? Got it.`
  });
  assert.strictEqual(rhetoricalResult.pedagogical_delivery_index, 0.600, 'Pure dialogue should cap at 0.600');

  // Interactive teaching (high dialogue + high pedagogy)
  const interactiveResult = pdiRouter.route({
    voiceTranscript: `Remember this rule of thumb for the exam. Who can tell me what happens on a page fault? Any questions? Right, understand? Got it.`
  });
  assert.strictEqual(interactiveResult.selected_representation, 'BLUEPRINT');
  assert.strictEqual(interactiveResult.pedagogical_delivery_index, 0.700);
});

// 5. Code Penalty Behavior
runTest('Code Penalty: Voiced code explanation not penalized; Unvoiced static code penalized', () => {
  const code = `function dijkstra(graph, source) {\n  const dist = {};\n  for (const v of graph.vertices) dist[v] = Infinity;\n  return dist;\n}`;
  
  // Voiced code explanation with strong pedagogical cues
  const voicedCodeResult = pdiRouter.route({
    voiceTranscript: `Remember that initializing distance to infinity is critical. Pay attention to the source vertex initialization. Be careful with edge relaxation.`,
    codeSnippets: code
  });
  assert.strictEqual(voicedCodeResult.selected_representation, 'BLUEPRINT');
  assert.strictEqual(voicedCodeResult.pedagogical_delivery_index, 0.600, 'Code penalty must be 0 when audio is present');

  // Unvoiced static code (No audio)
  const unvoicedCodeResult = pdiRouter.route({
    voiceTranscript: '',
    documentTexts: ['Here is the migration.'],
    codeSnippets: code
  });
  assert.strictEqual(unvoicedCodeResult.selected_representation, 'SUMMARY');
  assert.ok(unvoicedCodeResult.pedagogical_delivery_index < 0.30, `Unvoiced code must be penalized, got ${unvoicedCodeResult.pedagogical_delivery_index}`);
});

// 6. Modality Invariants: Slides Only and Multimodal
runTest('Modality Invariants: Slides-only routes to SUMMARY; Multimodal immediately routes to UNIFIED', () => {
  // Slides only
  const slidesOnly = pdiRouter.route({
    voiceTranscript: '',
    documentTexts: [`CS301: Computer Architecture - Unit 4: Pipelining\nInstruction Fetch, Decode, Execute, Memory, Write-back.`]
  });
  assert.strictEqual(slidesOnly.selected_representation, 'SUMMARY');
  assert.strictEqual(slidesOnly.pedagogical_delivery_index, 0.300);

  // Multimodal (Audio + Slides)
  const multimodal = pdiRouter.route({
    voiceTranscript: `Welcome to Unit 4 on pipelining. Pay attention to hazard resolution.`,
    documentTexts: [`CS301 Pipelining: 5-Stage RISC Pipeline Architecture covering IF, ID, EX, MEM, and WB stages.`]
  });
  assert.strictEqual(multimodal.selected_representation, 'UNIFIED');
  assert.ok(multimodal.pedagogical_delivery_index > 0.80);
});

// 7. Real Workspace Corpus Tests
runTest('Real Workspace Corpus: Groq Whisper clip unlocks BLUEPRINT, Deepa Madam preserves BLUEPRINT', () => {
  const groqWhisperPath = path.resolve(__dirname, '../Speech_To_Text/results/transcripts/groq_whisper_deepa_madam.txt');
  if (fs.existsSync(groqWhisperPath)) {
    const text = fs.readFileSync(groqWhisperPath, 'utf8');
    const res = pdiRouter.route({ voiceTranscript: text });
    assert.strictEqual(res.selected_representation, 'BLUEPRINT', 'Groq whisper clip must unlock BLUEPRINT');
    assert.strictEqual(res.pedagogical_delivery_index, 0.600);
  }

  const deepaPath = path.resolve(__dirname, '../Speech_To_Text/results/transcripts/deepgram_deepa_madam.txt');
  if (fs.existsSync(deepaPath)) {
    const text = fs.readFileSync(deepaPath, 'utf8');
    const res = pdiRouter.route({ voiceTranscript: text });
    assert.strictEqual(res.selected_representation, 'BLUEPRINT', 'Deepa madam lecture must preserve BLUEPRINT');
    assert.ok(res.pedagogical_delivery_index >= 0.60);
  }
});

console.log('\n======================================================================');
if (failCount === 0) {
  console.log(` 🏁 RESULT: ${passCount} / ${passCount} TESTS PASSED CLEANLY`);
} else {
  console.error(` 💥 RESULT: ${failCount} TESTS FAILED`);
  process.exit(1);
}
console.log('======================================================================\n');
