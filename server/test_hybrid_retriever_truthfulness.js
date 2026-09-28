/**
 * server/test_hybrid_retriever_truthfulness.js
 *
 * Dedicated verification suite for Phase 2.3:
 * - Truthful lexical TF cosine similarity verification
 * - Proof of orthogonal term vectors (absence of dense embeddings)
 * - Resolution of "page table" false table boost
 * - Intentional table and visual 1.4x content-type boosts
 * - Backward compatibility aliases (rankDense, computeDenseVectorScore)
 */

'use strict';

const assert = require('assert');
const HybridRetriever = require('./engine/evidence/hybridRetriever');
const { BlockTypes } = require('./engine/documentRouter/commonDocumentModel');

console.log('======================================================================');
console.log('🧪 HYBRID RETRIEVER TRUTHFUL LEXICAL FRAMING & RRF (PHASE 2.3)');
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
// 1. MATHEMATICAL TRUTHFULNESS: Lexical Sparse TF Cosine Similarity
// ──────────────────────────────────────────────────────────────────────────

record('Math Truthfulness 1: computeLexicalCosineScore calculates exact TF cosine angle', () => {
  const qTokens = ['virtual', 'memory', 'paging'];
  const dTokens = ['virtual', 'memory', 'allocation'];

  // q: { virtual:1, memory:1, paging:1 } -> mag = sqrt(3)
  // d: { virtual:1, memory:1, allocation:1 } -> mag = sqrt(3)
  // dot = 1*1 + 1*1 = 2
  // cos = 2 / (sqrt(3)*sqrt(3)) = 2/3 = 0.6666667
  const score = HybridRetriever.computeLexicalCosineScore(qTokens, dTokens);
  assert.ok(Math.abs(score - (2 / 3)) < 1e-5, `Expected 0.6667, got ${score}`);
});

record('Math Truthfulness 2: Disjoint terms have 0.0 similarity (Confirms lexical, non-dense embedding)', () => {
  // In a true dense embedding model, "cpu" and "processor" would have high cosine similarity (>0.8).
  // In our local lexical TF cosine retriever, disjoint terms have 0 dot product.
  const score = HybridRetriever.computeLexicalCosineScore(['cpu'], ['processor']);
  assert.strictEqual(score, 0, 'Lexical retriever must yield 0 for disjoint terms without dense embeddings');
});

// ──────────────────────────────────────────────────────────────────────────
// 2. RETRIEVAL ACCURACY & FALSE-BOOST ELIMINATION
// ──────────────────────────────────────────────────────────────────────────

const mockStore = {
  parents: [
    { evidenceId: 'P1', fullText: 'Memory Management Chapter', pageNumber: 1 },
    { evidenceId: 'P2', fullText: 'Scheduling Benchmark Comparisons', pageNumber: 2 }
  ],
  parentMap: {
    P1: { evidenceId: 'P1', fullText: 'Memory Management Chapter', pageNumber: 1 },
    P2: { evidenceId: 'P2', fullText: 'Scheduling Benchmark Comparisons', pageNumber: 2 }
  },
  children: [
    {
      evidenceId: 'C_PAGING',
      childId: 'C_PAGING',
      parentId: 'P1',
      sourceType: 'TRANSCRIPT',
      contentType: BlockTypes.PARAGRAPH,
      text: 'Virtual Address Translation: The page table maps virtual pages to physical frames using the page table base register.'
    },
    {
      evidenceId: 'C_SCHEDULING_TABLE',
      childId: 'C_SCHEDULING_TABLE',
      parentId: 'P2',
      sourceType: 'SLIDE',
      contentType: BlockTypes.TABLE,
      text: '| Algorithm | Average Wait Time | Overhead |\n| FCFS | High | Low |\n| SJF | Minimum | Low |'
    },
    {
      evidenceId: 'C_UTILIZATION_CHART',
      childId: 'C_UTILIZATION_CHART',
      parentId: 'P2',
      sourceType: 'SLIDE',
      contentType: BlockTypes.CHART,
      text: '[CHART]: Histogram of CPU utilization across Round Robin scheduling time slices.'
    }
  ]
};

record('Retrieval Accuracy 1: "page table" query retrieves C_PAGING without false table boost', () => {
  const target = {
    concept: 'Page Table Translation',
    instruction: 'How the page table base register maps virtual pages',
    contentType: 'text'
  };

  const results = HybridRetriever.retrieveForTarget(mockStore, target, { topK: 2, boostFactor: 1.4 });
  assert.strictEqual(results[0].child.evidenceId, 'C_PAGING', 'Must retrieve page table chunk first');
  assert.strictEqual(results[0].appliedBoost, 1.0, 'No table boost must be applied to text query');
});

record('Retrieval Accuracy 2: Explicit table query retrieves C_SCHEDULING_TABLE with 1.4x boost', () => {
  const target = {
    concept: 'Scheduling Comparison',
    instruction: 'Comparison of algorithm wait times and overhead in tabular format',
    contentType: 'table'
  };

  const results = HybridRetriever.retrieveForTarget(mockStore, target, { topK: 2, boostFactor: 1.4 });
  assert.strictEqual(results[0].child.evidenceId, 'C_SCHEDULING_TABLE', 'Must retrieve comparison table first');
  assert.strictEqual(results[0].appliedBoost, 1.4, '1.4x boost must be applied for table target');
});

record('Retrieval Accuracy 3: Visual chart query retrieves C_UTILIZATION_CHART with 1.4x boost', () => {
  const target = {
    concept: 'CPU Utilization',
    instruction: 'Histogram showing CPU utilization across time slices',
    contentType: 'chart'
  };

  const results = HybridRetriever.retrieveForTarget(mockStore, target, { topK: 2, boostFactor: 1.4 });
  assert.strictEqual(results[0].child.evidenceId, 'C_UTILIZATION_CHART', 'Must retrieve utilization chart first');
  assert.strictEqual(results[0].appliedBoost, 1.4, '1.4x boost must be applied for visual target');
});

// ──────────────────────────────────────────────────────────────────────────
// 3. BACKWARD COMPATIBILITY
// ──────────────────────────────────────────────────────────────────────────

record('Backward Compatibility: rankDense and computeDenseVectorScore are preserved as aliases', () => {
  const target = { concept: 'Page Table', contentType: 'text' };
  const results = HybridRetriever.retrieveForTarget(mockStore, target, { topK: 1 });

  assert.ok(results[0].rankLexicalCosine !== undefined, 'rankLexicalCosine property must be populated');
  assert.strictEqual(results[0].rankDense, results[0].rankLexicalCosine, 'rankDense must equal rankLexicalCosine');
  assert.strictEqual(typeof HybridRetriever.computeDenseVectorScore, 'function', 'computeDenseVectorScore function alias must exist');
});

console.log('\n======================================================================');
console.log(` 🏁 RESULT: ${passedTests} / ${totalTests} TESTS PASSED CLEANLY`);
console.log('======================================================================\n');
