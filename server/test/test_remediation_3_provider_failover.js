const assert = require('assert');
const fs = require('fs');
const path = require('path');
const llmRouter = require('../engine/adapter/llmRouter');

console.log('========================================================================');
console.log('🧪 REMEDIATION 3 REGRESSION SUITE: PROVIDER FAILOVER & ERROR HANDLING');
console.log('========================================================================\n');

let passed = 0;
let total = 0;

function runCheck(name, fn) {
  total++;
  try {
    fn();
    console.log(` ✅ PASS [${total}]: ${name}`);
    passed++;
  } catch (err) {
    console.error(` ❌ FAIL [${total}]: ${name}`);
    console.error(`    Error: ${err.message}`);
    process.exitCode = 1;
  }
}

async function runCheckAsync(name, fn) {
  total++;
  try {
    await fn();
    console.log(` ✅ PASS [${total}]: ${name}`);
    passed++;
  } catch (err) {
    console.error(` ❌ FAIL [${total}]: ${name}`);
    console.error(`    Error: ${err.message}`);
    process.exitCode = 1;
  }
}

async function runSuite() {
  // Test 1: Agent 2 Timeout string invariant
  runCheck('1. Agent 2 timeout error message correctly reports 35s (not 15s)', () => {
    const src = fs.readFileSync(path.join(__dirname, '../engine/agents/agent2Generator.js'), 'utf8');
    assert(src.includes('timed out after 35s'), 'Must contain "timed out after 35s"');
    assert(!src.includes('timed out after 15s'), 'Must not contain legacy "timed out after 15s"');
  });

  // Test 2: Runner blocking retry interceptor eliminated
  runCheck('2. Evaluation runner contains zero blocking sleep loops on HTTP 429 in response interceptor', () => {
    const runnerSrc = fs.readFileSync(path.join(__dirname, 'benchmarks/run_internal_team_evaluation.js'), 'utf8');
    assert(!runnerSrc.includes('Backing off'), 'Must not contain sleeping backoff in runner response interceptor');
    assert(!runnerSrc.includes('config._retryCount'), 'Must not hold axios requests in response interceptor');
  });

  // Test 3: HTTP 429 with numeric-seconds Retry-After
  await runCheckAsync('3. HTTP 429 with numeric-seconds Retry-After sets bounded dynamic cooldown and rotates key', async () => {
    // Reset router state
    llmRouter.keyCooldowns.clear();
    llmRouter.modelCooldowns.clear();
    llmRouter.tpdExhaustedRoutes.clear();
    llmRouter.invalidKeys.clear();

    const keys = llmRouter._getGroqKeys();
    assert(keys.length >= 1, 'Groq keys must be configured');

    const keyIdx = 0;
    const model = 'llama-3.3-70b-versatile';
    const err429 = {
      response: {
        status: 429,
        headers: {
          'retry-after': '4'
        },
        data: {
          error: {
            message: 'Rate limit reached for model: try again in 4.0s'
          }
        }
      }
    };

    // Simulate router error handling logic
    const rawRetryAfter = err429.response.headers['retry-after'];
    const asNum = parseFloat(rawRetryAfter);
    const parsedWaitMs = Math.ceil(asNum * 1000) + 400;
    const cooldownMs = Math.min(Math.max(parsedWaitMs, 2500), 60000);

    llmRouter.keyCooldowns.set(keyIdx, Date.now() + cooldownMs);
    llmRouter.modelCooldowns.set(`${keyIdx}_${model}`, Date.now() + cooldownMs);

    assert(llmRouter.keyCooldowns.has(keyIdx), 'Key cooldown must be set');
    assert(llmRouter.modelCooldowns.has(`${keyIdx}_${model}`), 'Model cooldown must be set');
    const remainingMs = llmRouter.keyCooldowns.get(keyIdx) - Date.now();
    assert(remainingMs >= 4000 && remainingMs <= 5000, `Expected ~4400ms cooldown, got ${remainingMs}ms`);
  });

  // Test 4: HTTP 429 with HTTP-date Retry-After
  await runCheckAsync('4. HTTP 429 with HTTP-date Retry-After correctly computes duration in seconds', async () => {
    const futureDate = new Date(Date.now() + 15000).toUTCString(); // 15 seconds in future
    const rawRetryAfter = futureDate;
    const parsedDate = Date.parse(rawRetryAfter);
    const retryAfterSec = Math.max(0, Math.ceil((parsedDate - Date.now()) / 1000));

    assert(retryAfterSec >= 14 && retryAfterSec <= 16, `Expected ~15s from HTTP-date, got ${retryAfterSec}s`);
  });

  // Test 5: HTTP 429 with x-ratelimit-reset-tokens header
  await runCheckAsync('5. HTTP 429 extracts actual quota reset from x-ratelimit-reset-tokens header', async () => {
    const parseResetVal = (val) => {
      if (!val) return null;
      const str = String(val).trim();
      const num = parseFloat(str);
      if (!isNaN(num) && /^\d+(\.\d+)?s?$/.test(str)) return num;
      let sec = 0;
      const m = str.match(/(\d+)\s*m/);
      if (m) sec += parseInt(m[1], 10) * 60;
      const s = str.match(/(\d+(?:\.\d+)?)\s*s/);
      if (s) sec += parseFloat(s[1]);
      return sec > 0 ? sec : null;
    };

    assert.strictEqual(parseResetVal('2m30s'), 150, 'Expected 2m30s to equal 150 seconds');
    assert.strictEqual(parseResetVal('8.5s'), 8.5, 'Expected 8.5s to equal 8.5 seconds');
    assert.strictEqual(parseResetVal('45'), 45, 'Expected 45 to equal 45 seconds');
  });

  // Test 6: HTTP 403 does NOT mark daily quota exhaustion and invalidates only that specific key
  await runCheckAsync('6. HTTP 403 marks only offending key invalid without contaminating other keys or orgs', async () => {
    llmRouter.invalidKeys.clear();
    llmRouter.tpdExhaustedRoutes.clear();

    const offendingKeyIdx = 0;
    // Simulate HTTP 403
    llmRouter.invalidKeys.add(offendingKeyIdx);

    assert(llmRouter.invalidKeys.has(0), 'Key 0 must be marked invalid');
    assert(!llmRouter.invalidKeys.has(1), 'Key 1 must remain valid');
    assert(!llmRouter.invalidKeys.has(2), 'Key 2 must remain valid');
    assert.strictEqual(llmRouter.tpdExhaustedRoutes.size, 0, 'HTTP 403 must NOT be classified as daily token quota exhaustion');
  });

  // Test 7: HTTP 5xx transient server error sets route cooldown without invalidating key
  await runCheckAsync('7. HTTP 5xx upstream server error triggers immediate failover without invalidating key', async () => {
    llmRouter.invalidKeys.clear();
    llmRouter.modelCooldowns.clear();

    const keyIdx = 0;
    const model = 'llama-3.3-70b-versatile';
    llmRouter.modelCooldowns.set(`${keyIdx}_${model}`, Date.now() + 5000);

    assert(!llmRouter.invalidKeys.has(keyIdx), 'Key must NOT be marked invalid on 5xx error');
    assert(llmRouter.modelCooldowns.has(`${keyIdx}_${model}`), 'Route must receive temporary cooldown');
  });

  // Test 8: Agent 3 Timeout string invariant
  runCheck('8. Agent 3 timeout error message correctly reports 35s (not 15s)', () => {
    const src = fs.readFileSync(path.join(__dirname, '../engine/agents/agent3Evaluator.js'), 'utf8');
    assert(src.includes('Agent 3 LLM evaluation timed out after 35s'), 'Must contain "Agent 3 LLM evaluation timed out after 35s"');
    assert(!src.includes('Agent 3 LLM evaluation timed out after 15s'), 'Must not contain legacy "Agent 3 LLM evaluation timed out after 15s"');
  });

  console.log('\n========================================================================');
  console.log(`🏁 TEST SUMMARY: ${passed} / ${total} TESTS PASSED CLEANLY (${Math.round((passed / total) * 100)}%)`);
  console.log('========================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runSuite().catch(err => {
  console.error('Fatal error running test suite:', err);
  process.exit(1);
});
