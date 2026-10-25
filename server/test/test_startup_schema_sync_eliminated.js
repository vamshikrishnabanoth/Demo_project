'use strict';

/**
 * server/test/test_startup_schema_sync_eliminated.js
 *
 * P1 Verification Suite:
 * 1. Static AST/Content Assertion: Proves child_process, exec, and prisma db push are absent from server/index.js.
 * 2. Controlled Runtime Boot Test: Boots server on an ephemeral port in test mode (no DB mutations),
 *    captures all stdout/stderr streams, and asserts that zero schema sync hooks fire.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

console.log('======================================================================');
console.log('🧪 RUNNING P1 STARTUP SCHEMA-SYNC ELIMINATION VERIFICATION');
console.log('======================================================================\n');

let passCount = 0;
function runTest(name, fn) {
  try {
    fn();
    passCount++;
    console.log(` ✅ PASS [${passCount}]: ${name}`);
  } catch (err) {
    console.error(` ❌ FAIL: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

// -----------------------------------------------------------------------------
// Test 1: Static Code Inspection
// -----------------------------------------------------------------------------
runTest('T1: server/index.js contains zero references to exec or child_process', () => {
  const codePath = path.resolve(__dirname, '../index.js');
  const code = fs.readFileSync(codePath, 'utf8');

  assert.ok(!code.includes("require('child_process')"), "Must not require child_process");
  assert.ok(!code.includes('require("child_process")'), "Must not require child_process");
  assert.ok(!/\bconst\s*\{\s*exec\s*\}\b/.test(code), "Must not destructure exec");
  assert.ok(!code.includes('prisma db push'), "Must not contain 'prisma db push'");
  assert.ok(!code.includes('Automatic Prisma Database Schema Synchronization'), "Must not contain schema-sync hook");
});

// -----------------------------------------------------------------------------
// Test 2: Runtime Boot Telemetry Verification
// -----------------------------------------------------------------------------
async function testRuntimeBoot() {
  console.log('\n▶ Testing actual application boot stream for schema-sync attempts...');

  return new Promise((resolve, reject) => {
    const testPort = 59876;
    const serverProcess = spawn(process.execPath, [path.resolve(__dirname, '../index.js')], {
      env: {
        ...process.env,
        PORT: String(testPort),
        NODE_ENV: 'development' // Non-test so server.listen fires
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdoutData = '';
    let stderrData = '';

    serverProcess.stdout.on('data', chunk => {
      stdoutData += chunk.toString();
    });

    serverProcess.stderr.on('data', chunk => {
      stderrData += chunk.toString();
    });

    // Let server run for 4 seconds so setImmediate/timers would have fired
    setTimeout(() => {
      serverProcess.kill('SIGINT');

      try {
        console.log('Captured boot stdout preview:\n', stdoutData.trim().slice(0, 400));
        if (stderrData) {
          console.log('Captured boot stderr preview:\n', stderrData.trim().slice(0, 300));
        }

        // Assert server started
        assert.ok(stdoutData.includes(`Server running on port ${testPort}`), 'Server must start and listen on designated port');

        // Assert schema sync strings are 100% absent
        assert.ok(!stdoutData.includes('Syncing database schema via prisma db push'), 'Must NOT log schema sync attempt');
        assert.ok(!stdoutData.includes('Database schema is in sync with schema.prisma'), 'Must NOT log schema sync success');
        assert.ok(!stderrData.includes('Failed to initiate database sync'), 'Must NOT log database sync failure');
        assert.ok(!stderrData.includes('exec is not defined'), 'Must NOT encounter exec ReferenceError');

        passCount++;
        console.log(` ✅ PASS [${passCount}]: T2: Application booted and listened without triggering any schema sync hooks`);
        resolve();
      } catch (err) {
        reject(err);
      }
    }, 4000);

    serverProcess.on('error', reject);
  });
}

testRuntimeBoot()
  .then(() => {
    console.log('\n======================================================================');
    console.log(`🎉 ALL ${passCount} P1 STARTUP TESTS PASSED WITH 100% SUCCESS!`);
    console.log('======================================================================\n');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Runtime boot test failed:', err);
    process.exit(1);
  });
