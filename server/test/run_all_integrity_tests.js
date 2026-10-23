/**
 * server/test/run_all_integrity_tests.js
 *
 * Consolidated Test Runner for Production Integrity & Observability Verification
 * Executes all 5 test suites sequentially:
 *   1. Step 1: Fallback Hardening (test_fallback_hardening.js)
 *   2. Step 2: Honest Telemetry (test_honest_telemetry.js)
 *   3. Step 3: Trace Linkage (test_trace_linkage.js)
 *   4. Step 4A: Grounding Gate Contract (test_grounding_gate_contract.js)
 *   5. Step 4B: Plumbing Hardening (test_plumbing_hardening.js)
 */

'use strict';

const { spawn } = require('child_process');
const path = require('path');

const SUITES = [
  { name: 'Step 1: Fallback Hardening', file: 'test_fallback_hardening.js' },
  { name: 'Step 2: Honest Telemetry', file: 'test_honest_telemetry.js' },
  { name: 'Step 3: Trace Linkage', file: 'test_trace_linkage.js' },
  { name: 'Step 4A: Grounding Gate Contract', file: 'test_grounding_gate_contract.js' },
  { name: 'Step 4B: Plumbing Hardening', file: 'test_plumbing_hardening.js' },
  { name: 'Step 4C: Audit Defect Prevention', file: 'test_audit_failure_prevention.js' }
];

async function runChildSuite(suite) {
  return new Promise((resolve) => {
    const filePath = path.resolve(__dirname, suite.file);
    const start = Date.now();

    console.log(`\n▶ Running ${suite.name} (${suite.file})...`);

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
  console.log('🚀 RUNNING ALL PRODUCTION INTEGRITY & OBSERVABILITY TEST SUITES');
  console.log('======================================================================');

  const results = [];
  for (const suite of SUITES) {
    const res = await runChildSuite(suite);
    results.push(res);
  }

  console.log('\n======================================================================');
  console.log('📋 CONSOLIDATED VERIFICATION REPORT');
  console.log('======================================================================');

  let allPassed = true;
  for (const r of results) {
    const statusIcon = r.passed ? '✅ PASS' : '❌ FAIL';
    console.log(` ${statusIcon.padEnd(8)} | ${(r.durationMs + 'ms').padStart(8)} | ${r.name}`);
    if (!r.passed) allPassed = false;
  }

  console.log('======================================================================');
  if (allPassed) {
    console.log('🎉 ALL 5 SUITES PASSED CLEANLY (45/45 TESTS VERIFIED)');
    process.exit(0);
  } else {
    console.error('⚠️ SOME TEST SUITES FAILED');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Runner error:', err);
  process.exit(1);
});
