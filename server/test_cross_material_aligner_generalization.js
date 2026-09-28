/**
 * server/test_cross_material_aligner_generalization.js
 *
 * Dedicated verification suite for Phase 2.2:
 * - CrossMaterialAligner Domain Generalization
 * - Morphological normalization unit checks
 * - Elimination of hardcoded VAE/Kruskal false positive leaks
 * - Verification across OS, COA, DSA, and unrelated domains
 * - Bidirectional alignment graph generation
 * - Source code invariant: zero hardcoded domain keywords
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  CrossMaterialAligner,
  tokenize,
  RELATIONSHIP_TYPES,
  PRIORITY_LEVELS
} = require('./engine/evidence/crossMaterialAligner');

console.log('======================================================================');
console.log('🧪 CROSS-MATERIAL ALIGNER DOMAIN GENERALIZATION (PHASE 2.2)');
console.log('======================================================================\n');

let totalTests = 0;
let passedTests = 0;

function record(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(` ✅ PASS [${totalTests}]: ${name}`);
  } catch (err) {
    console.error(` ❌ FAIL [${totalTests}]: ${name}`);
    console.error(`    Error: ${err.message}\n`);
    throw err;
  }
}

// ──────────────────────────────────────────────────────────────────────────
// 1. MORPHOLOGICAL NORMALIZATION CHECKS
// ──────────────────────────────────────────────────────────────────────────

record('Morphology 1: Word variants stem to identical morphological roots', () => {
  const pairs = [
    ['virtualization', 'virtual'],
    ['paging', 'pages'],
    ['pipelined', 'pipelining'],
    ['scheduling', 'schedule'],
    ['processes', 'process'],
    ['allocation', 'allocate'],
    ['synchronization', 'synchronize']
  ];

  for (const [w1, w2] of pairs) {
    const s1 = Array.from(tokenize(w1))[0];
    const s2 = Array.from(tokenize(w2))[0];
    assert.ok(s1 && s2, `Both tokens must yield stems: ${w1}, ${w2}`);
    assert.ok(
      s1 === s2 || s1.startsWith(s2) || s2.startsWith(s1),
      `Tokens "${w1}" (${s1}) and "${w2}" (${s2}) must morphologically align`
    );
  }
});

// ──────────────────────────────────────────────────────────────────────────
// 2. FALSE POSITIVE ELIMINATION (No VAE / Kruskal hardcode triggers)
// ──────────────────────────────────────────────────────────────────────────

record('False Positive Elimination 1: Economics "cycle" vs Trade "union" is COMPLETELY_UNRELATED', () => {
  const voice = 'The business cycle fluctuates between economic expansion and recession over several quarters.';
  const doc = 'The European Union parliament held a summit on labor union representation and collective bargaining agreements across member nations.';
  const res = CrossMaterialAligner.classifyRelationship(voice, doc);

  assert.strictEqual(res.relationship, RELATIONSHIP_TYPES.COMPLETELY_UNRELATED);
  assert.strictEqual(res.priority, PRIORITY_LEVELS.PRIORITY_5_UNRELATED);
  assert.strictEqual(res.isAligned, false);
});

record('False Positive Elimination 2: Chemistry "sample" vs Math "epsilon" is COMPLETELY_UNRELATED', () => {
  const voice = 'Take a liquid sample and measure the temperature in the flask before beginning distillation.';
  const doc = 'Let epsilon be greater than zero in the Cauchy limit definition for continuous functions on real intervals.';
  const res = CrossMaterialAligner.classifyRelationship(voice, doc);

  assert.strictEqual(res.relationship, RELATIONSHIP_TYPES.COMPLETELY_UNRELATED);
  assert.strictEqual(res.priority, PRIORITY_LEVELS.PRIORITY_5_UNRELATED);
  assert.strictEqual(res.isAligned, false);
});

// ──────────────────────────────────────────────────────────────────────────
// 3. CROSS-MODAL ALIGNMENT ON REAL CURRICULAR MATERIAL
// ──────────────────────────────────────────────────────────────────────────

record('Real Curricular 1: OS Lecture (Voice + Paging Slides) is CLOSELY_ALIGNED', () => {
  const voice = 'When a page fault occurs, the operating system initiates paging by retrieving the requested page from secondary storage into an available physical frame. The memory virtualization system translates addresses.';
  const doc = 'Memory Virtualization & Paging Architecture:\nVirtual address translation maps pages to frames. Page faults allocate physical memory frames on demand.\n\n--- Page 2 ---\nTLB (Translation Lookaside Buffer) speeds up virtual address lookups.';
  const res = CrossMaterialAligner.classifyRelationship(voice, doc);

  assert.strictEqual(res.relationship, RELATIONSHIP_TYPES.CLOSELY_ALIGNED);
  assert.strictEqual(res.priority, PRIORITY_LEVELS.PRIORITY_2_ALIGNED_MATERIAL);
  assert.strictEqual(res.isAligned, true);
  assert.ok(res.sharedTokens.length >= 5, `Expected >=5 shared tokens, got ${res.sharedTokens.length}`);
});

record('Real Curricular 2: COA Lecture (Voice + Pipelining Slides) is CLOSELY_ALIGNED', () => {
  const voice = 'In pipelining, instruction execution is overlapped across multiple stages. Pipelined processors must handle data hazards and branch prediction to prevent stalls.';
  const doc = 'Pipelined Processor Design:\nPipelining stages include fetch, decode, execute, memory access, and writeback. Hazard detection units and branch predictors resolve pipeline stalls.';
  const res = CrossMaterialAligner.classifyRelationship(voice, doc);

  assert.strictEqual(res.relationship, RELATIONSHIP_TYPES.CLOSELY_ALIGNED);
  assert.strictEqual(res.priority, PRIORITY_LEVELS.PRIORITY_2_ALIGNED_MATERIAL);
  assert.strictEqual(res.isAligned, true);
  assert.ok(res.sharedTokens.length >= 5, `Expected >=5 shared tokens, got ${res.sharedTokens.length}`);
});

record('Real Curricular 3: DSA Lecture (Voice + Recursion / GCD Slides) is CLOSELY_ALIGNED', () => {
  const voice = 'We compute the greatest common divisor using Euclidean division and recursive function calls. The base condition stops when the remainder reaches zero.';
  const doc = 'Greatest Common Divisor (GCD) & Recursion:\nEuclidean algorithm computes greatest common divisors recursively. Base cases terminate when remainder is zero.';
  const res = CrossMaterialAligner.classifyRelationship(voice, doc);

  assert.strictEqual(res.relationship, RELATIONSHIP_TYPES.CLOSELY_ALIGNED);
  assert.strictEqual(res.priority, PRIORITY_LEVELS.PRIORITY_2_ALIGNED_MATERIAL);
  assert.strictEqual(res.isAligned, true);
});

// ──────────────────────────────────────────────────────────────────────────
// 4. UNRELATED DOMAIN SUPPRESSION
// ──────────────────────────────────────────────────────────────────────────

record('Unrelated Domain: Baking vs Operating Systems is COMPLETELY_UNRELATED', () => {
  const voice = 'The operating system kernel handles context switching, process scheduling, and virtual memory page faults.';
  const doc = 'Bake the sourdough bread in a preheated Dutch oven at 450 degrees Fahrenheit for 25 minutes until the crust is golden brown and crackles.';
  const res = CrossMaterialAligner.classifyRelationship(voice, doc);

  assert.strictEqual(res.relationship, RELATIONSHIP_TYPES.COMPLETELY_UNRELATED);
  assert.strictEqual(res.priority, PRIORITY_LEVELS.PRIORITY_5_UNRELATED);
  assert.strictEqual(res.isAligned, false);
});

// ──────────────────────────────────────────────────────────────────────────
// 5. BIDIRECTIONAL CMA GRAPH CONSTRUCTION
// ──────────────────────────────────────────────────────────────────────────

record('CMA Graph: buildAlignmentGraph links related audio & slide chunks correctly', () => {
  const mockStore = {
    children: [
      {
        evidenceId: 'E_VOICE_01',
        sourceType: 'TRANSCRIPT',
        text: 'The CPU scheduler performs context switching to save process registers to the process control block.'
      },
      {
        evidenceId: 'E_VOICE_02',
        sourceType: 'TRANSCRIPT',
        text: 'Virtual memory paging resolves page faults by swapping page frames between RAM and secondary storage.'
      },
      {
        evidenceId: 'E_SLIDE_01',
        sourceType: 'SLIDE',
        text: 'Process Management: CPU scheduling algorithms and context switch logic saving registers.'
      },
      {
        evidenceId: 'E_SLIDE_02',
        sourceType: 'SLIDE',
        text: 'Memory Architecture: Paging, frame allocation, and page fault handling mechanisms.'
      },
      {
        evidenceId: 'E_SLIDE_UNRELATED',
        sourceType: 'SLIDE',
        text: 'Baking artisanal pastry: Temperature gradients and dough fermentation.'
      }
    ]
  };

  const graph = CrossMaterialAligner.buildAlignmentGraph(mockStore, 0.10);

  // E_VOICE_01 should link to E_SLIDE_01 (Process Management / Context Switch)
  assert.ok(graph['E_VOICE_01'], 'Audio 1 must have alignment links');
  assert.ok(graph['E_VOICE_01'].includes('E_SLIDE_01'), 'Audio 1 must link to Slide 1');

  // E_VOICE_02 should link to E_SLIDE_02 (Paging / Memory)
  assert.ok(graph['E_VOICE_02'], 'Audio 2 must have alignment links');
  assert.ok(graph['E_VOICE_02'].includes('E_SLIDE_02'), 'Audio 2 must link to Slide 2');

  // Reverse mapping must be present
  assert.ok(graph['E_SLIDE_01'] && graph['E_SLIDE_01'].includes('E_VOICE_01'), 'Slide 1 must link back to Audio 1');
  assert.ok(graph['E_SLIDE_02'] && graph['E_SLIDE_02'].includes('E_VOICE_02'), 'Slide 2 must link back to Audio 2');

  // Unrelated slide must have 0 audio links
  assert.strictEqual((graph['E_SLIDE_UNRELATED'] || []).length, 0, 'Unrelated slide must not link to OS audio');
});

// ──────────────────────────────────────────────────────────────────────────
// 6. CODEBASE INTEGRITY INVARIANT
// ──────────────────────────────────────────────────────────────────────────

record('Invariant: Zero hardcoded domain pairs in crossMaterialAligner.js source', () => {
  const src = fs.readFileSync(path.join(__dirname, 'engine', 'evidence', 'crossMaterialAligner.js'), 'utf8');
  const forbiddenPatterns = [
    'bottleneck',
    'kruskal',
    'reparameterization',
    'conceptExpansionHit'
  ];

  for (const pattern of forbiddenPatterns) {
    const hasPattern = src.toLowerCase().includes(pattern.toLowerCase());
    assert.strictEqual(
      hasPattern,
      false,
      `crossMaterialAligner.js must not contain hardcoded domain pattern: "${pattern}"`
    );
  }
});

console.log('\n======================================================================');
console.log(` 🏁 RESULT: ${passedTests} / ${totalTests} TESTS PASSED CLEANLY`);
console.log('======================================================================\n');
