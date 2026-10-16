/**
 * server/test/run_all_phase_tests.js
 *
 * Master Consolidated Test Runner for the KMIT Kahoot MCQ Pipeline
 * Executes all 11 test suites covering Phase 1 through Phase 6:
 *   1. Phase 1: Zero-Crash Reliability (test_phase1_zero_crash_reliability.js)
 *   2. Phase 1: Semantic Capacity & Concept Extraction (test_phase1_semantic_capacity.js)
 *   3. Phase 2: Full-Lecture Understanding (test_phase2_full_lecture_understanding.js)
 *   4. Phase 2: Capacity Deficit & Safety (test_phase2_capacity_deficit.js)
 *   5. Phase 3: Evidence Transparency & Timestamps (test_phase3_evidence_transparency.js)
 *   6. Phase 5: Concept Capacity Alignment (test_phase5_concept_capacity_alignment.js)
 *   7. Phase 6 - Stage 1: Full-Lecture End-to-End Benchmark (test_phase6_stage1_full_lecture_benchmark.js)
 *   8. Phase 6 - Stage 2: MCQ Quality & Adversarial Distractor Audit (test_phase6_stage2_mcq_quality_audit.js)
 *   9. Phase 6 - Stage 3: Code & SQL AST Validation Gates (test_phase6_stage3_ast_sql_validation.js)
 *  10. Phase 6 - Stage 4: Multi-Tier Provider Resilience (test_phase6_stage4_provider_resilience.js)
 *  11. Phase 6 - Stage 5: Live Concurrency & Deployment Flow (test_phase6_stage5_concurrency_deployment.js)
 */

'use strict';

const { spawn } = require('child_process');
const path = require('path');

const SUITES = [
  { name: 'Phase 1: Zero-Crash Reliability', file: 'test_phase1_zero_crash_reliability.js' },
  { name: 'Phase 1: Semantic Capacity & Extraction', file: 'test_phase1_semantic_capacity.js' },
  { name: 'Phase 2: Full-Lecture Understanding', file: 'test_phase2_full_lecture_understanding.js' },
  { name: 'Phase 2: Capacity Deficit & Safety', file: 'test_phase2_capacity_deficit.js' },
  { name: 'Phase 3: Evidence Transparency & Monotonic Timestamps', file: 'test_phase3_evidence_transparency.js' },
  { name: 'Phase 5: Concept Capacity Alignment & Multi-Facet Targets', file: 'test_phase5_concept_capacity_alignment.js' },
  { name: 'Phase 6 - Stage 1: Full-Lecture End-to-End Benchmark', file: 'test_phase6_stage1_full_lecture_benchmark.js' },
  { name: 'Phase 6 - Stage 2: MCQ Quality & Distractor Audit', file: 'test_phase6_stage2_mcq_quality_audit.js' },
  { name: 'Phase 6 - Stage 3: Code & SQL AST Execution Gates', file: 'test_phase6_stage3_ast_sql_validation.js' },
  { name: 'Phase 6 - Stage 4: Provider Resilience & Zero Fake Questions', file: 'test_phase6_stage4_provider_resilience.js' },
  { name: 'Phase 6 - Stage 5: Live WebSocket Concurrency & DB Persistence', file: 'test_phase6_stage5_concurrency_deployment.js' }
];

async function runChildSuite(suite) {
  return new Promise((resolve) => {
    const filePath = path.resolve(__dirname, suite.file);
    const start = Date.now();

    console.log(`\n======================================================================`);
    console.log(`▶ Running ${suite.name} (${suite.file})...`);
    console.log(`======================================================================`);

    const child = spawn(process.execPath, [filePath], {
      cwd: path.resolve(__dirname, '..'),
      env: { ...process.env },
      stdio: 'inherit'
    });

    child.on('close', (code) => {
      const durationMs = Date.now() - start;
      resolve({
        name: suite.name,
        file: suite.file,
        passed: code === 0,
        exitCode: code,
        durationMs
      });
    });

    child.on('error', (err) => {
      const durationMs = Date.now() - start;
      resolve({
        name: suite.name,
        file: suite.file,
        passed: false,
        error: err.message,
        durationMs
      });
    });
  });
}

async function main() {
  console.log('======================================================================');
  console.log('🚀 MASTER TEST RUNNER: KMIT KAHOOT MCQ PIPELINE (PHASES 1 - 6)');
  console.log('======================================================================');

  const overallStart = Date.now();
  const results = [];

  for (const suite of SUITES) {
    const res = await runChildSuite(suite);
    results.push(res);
  }

  const overallDuration = Date.now() - overallStart;

  console.log('\n======================================================================');
  console.log('📋 MASTER CONSOLIDATED VERIFICATION REPORT');
  console.log('======================================================================');

  let allPassed = true;
  for (const r of results) {
    const statusIcon = r.passed ? '✅ PASS' : '❌ FAIL';
    console.log(` ${statusIcon.padEnd(8)} | ${(r.durationMs + 'ms').padStart(8)} | ${r.name}`);
    if (!r.passed) allPassed = false;
  }

  console.log('======================================================================');
  console.log(`⏱ Total Execution Time: ${(overallDuration / 1000).toFixed(2)}s`);
  if (allPassed) {
    console.log('🎉 ALL 11 TEST SUITES PASSED CLEANLY (100% PRODUCTION RELEASE READY)');
    process.exit(0);
  } else {
    console.error('⚠️ SOME TEST SUITES FAILED');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Master runner error:', err);
  process.exit(1);
});
