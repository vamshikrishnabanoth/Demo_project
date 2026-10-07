/**
 * server/test/benchmarks/compile_50_case_benchmark.js
 *
 * Compiles the unified 50-case evaluation benchmark:
 * - 22 cases from intent_difficulty_benchmark.json (Golden Phase 4)
 * - 14 cases from intent_difficulty_holdout_unseen.json (Unseen Holdout)
 * - 14 cases from goal_fulfillment_benchmark.json (Curricular Goals Across Domains)
 */

'use strict';

const fs = require('fs');
const path = require('path');

const BENCHMARK_DIR = path.resolve(__dirname, '../../../evaluation_dataset/golden_benchmarks');
const p1Path = path.join(BENCHMARK_DIR, 'intent_difficulty_benchmark.json');
const p2Path = path.join(BENCHMARK_DIR, 'intent_difficulty_holdout_unseen.json');
const p3Path = path.join(BENCHMARK_DIR, 'goal_fulfillment_benchmark.json');

const p1 = JSON.parse(fs.readFileSync(p1Path, 'utf8'));
const p2 = JSON.parse(fs.readFileSync(p2Path, 'utf8'));
const p3 = JSON.parse(fs.readFileSync(p3Path, 'utf8'));

const c1 = p1.map(c => ({
  caseIndex: 0,
  testId: c.testId,
  name: c.name,
  category: c.category || 'Paired / Intent',
  voiceText: c.voiceSnippet || c.voiceTranscript,
  docText: c.documentSnippet || c.documentText,
  source: 'intent_golden_phase4',
  negativeBoundaries: c.negativeBoundaries || [],
  expectedIntent: c.expectedIntent || null,
  isDeficit: ['INTENT_015', 'INTENT_016', 'INTENT_017'].includes(c.testId),
  deficitReason: ['INTENT_015', 'INTENT_016', 'INTENT_017'].includes(c.testId) ? 'Purely descriptive taxonomy without taught mechanisms' : null
}));

const c2 = p2.map(c => ({
  caseIndex: 0,
  testId: c.testId,
  name: c.name,
  category: c.category || 'Holdout Unseen',
  voiceText: c.voiceSnippet || c.voiceTranscript,
  docText: c.documentSnippet || c.documentText,
  source: 'intent_holdout_unseen',
  negativeBoundaries: c.negativeBoundaries || [],
  expectedIntent: c.expectedIntent || null,
  isDeficit: c.testId === 'HOLD_INT_010',
  deficitReason: c.testId === 'HOLD_INT_010' ? 'Version control taxonomy definitions without state transitions' : null
}));

const c3 = p3.slice(0, 14).map(c => ({
  caseIndex: 0,
  testId: c.testId,
  name: c.name,
  category: 'Curricular Goal Fulfillment',
  voiceText: c.voiceTranscript,
  docText: c.documentText,
  source: 'curricular_goals',
  negativeBoundaries: [],
  expectedIntent: null,
  isDeficit: c.testId === 'GOAL_003',
  deficitReason: c.testId === 'GOAL_003' ? 'Lecture mentions Dijkstra history but provides zero trace or relaxation step' : null
}));

const combined = [...c1, ...c2, ...c3].map((item, idx) => ({
  ...item,
  caseIndex: idx + 1
}));

const outputPath = path.join(BENCHMARK_DIR, 'step4_50_case_benchmark.json');
fs.writeFileSync(outputPath, JSON.stringify(combined, null, 2), 'utf8');
console.log(`✅ Compiled 50 benchmark cases successfully to: ${outputPath}`);
console.log(`   - Phase 4 Golden Cases:  ${c1.length}`);
console.log(`   - Unseen Holdout Cases:  ${c2.length}`);
console.log(`   - Curricular Goal Cases: ${c3.length}`);
console.log(`   - Total Deficit Cases:   ${combined.filter(c => c.isDeficit).length}`);
