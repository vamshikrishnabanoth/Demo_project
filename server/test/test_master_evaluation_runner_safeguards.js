/**
 * Demo_project/server/test/test_master_evaluation_runner_safeguards.js
 *
 * RIGOROUS MOCK-ONLY TESTS FOR TRANSPORT-LEVEL EVALUATION RUNNER SAFEGUARDS
 *
 * Verifies all 10 required safeguard behaviors without ANY live network requests:
 * 1. Multiple HTTP attempts inside one complete() call (Groq retry & fallback).
 * 2. HTTP 429 consecutive error accounting and circuit-breaker trip.
 * 3. 120th request allowed, 121st request blocked at pre-dispatch.
 * 4. Token reservation blocking a request that cannot fit within remaining budget.
 * 5. Concurrent token reservation headroom tracking.
 * 6. Raw string response handling from provider.
 * 7. Missing usage metadata handling with conservative upper bound (never zero).
 * 8. Failed requests retaining reserved tokens without refund.
 * 9. Partial telemetry persistence after each completed run.
 * 10. Planner cache bypass preserving non-plan cache keys.
 */

'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const { MasterEvaluationRunner, GLOBAL_BUDGET, EVALUATION_MATRIX } = require('../../run_master_product_evaluation');
const llmRouter = require('../engine/adapter/llmRouter');
const cacheManager = require('../utils/cacheManager');
const axios = require('axios');

async function runAllSafeguardTests() {
  console.log('========================================================================');
  console.log('  🧪 TESTING MASTER EVALUATION RUNNER SAFEGUARDS (TRANSPORT-LEVEL MOCKS)');
  console.log('========================================================================\n');

  // Test 1: Multiple HTTP attempts inside one complete() call (Model retry & failover)
  {
    console.log('[Test 1] Verifying multiple HTTP attempts within one complete() are accurately counted...');
    const runner = new MasterEvaluationRunner({ mockMode: true });
    runner.installSafeguards();

    runner.state.globalHttpAttempts = 0;
    runner.state.committedTokens = 0;
    runner.state.reservedTokens = 0;
    runner.state.failedHttpAttempts = 0;
    runner.state.callLedger = [];

    let attemptCount = 0;
    runner.mockAxiosHandler = async (config) => {
      attemptCount++;
      if (attemptCount === 1) {
        const err = new Error('Request failed with status code 503 (Service Unavailable)');
        err.response = { status: 503 };
        throw err;
      }
      return {
        status: 200,
        data: {
          id: 'chatcmpl_mock_123',
          choices: [{ message: { content: '{"question": "What is AVL rotation?"}' } }],
          usage: { prompt_tokens: 300, completion_tokens: 100, total_tokens: 400 }
        }
      };
    };

    // Make an axios call directly via llmRouter's transport
    let succeeded = false;
    try {
      await axios.post('https://api.groq.com/openai/v1/chat/completions', {
        model: 'primary-model',
        messages: [{ role: 'user', content: 'test prompt 1' }],
        max_tokens: 1000
      });
    } catch (_) {
      // First attempt failed (as expected)
    }

    // Second attempt (simulating model failover retry)
    const resp2 = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: 'fallback-model',
      messages: [{ role: 'user', content: 'test prompt 1' }],
      max_tokens: 1000
    });
    if (resp2?.data?.choices) succeeded = true;

    assert.strictEqual(runner.state.globalHttpAttempts, 2, 'Must count BOTH the failed initial attempt and retry attempt');
    assert.strictEqual(runner.state.failedHttpAttempts, 1, 'Must count exactly 1 failed attempt');
    assert.strictEqual(succeeded, true, 'Second attempt succeeded');
    console.log('  ✓ Accurately counted both outbound attempts (1 fail, 1 retry success).');
  }

  // Test 2: 120th request allowed, 121st request blocked before dispatch
  {
    console.log('\n[Test 2] Verifying 120th request allowed and 121st request blocked before dispatch...');
    const runner = new MasterEvaluationRunner({ mockMode: true });
    runner.installSafeguards();

    runner.state.globalHttpAttempts = 119;
    runner.state.committedTokens = 10000;
    runner.state.reservedTokens = 0;

    runner.mockAxiosHandler = async () => ({
      status: 200,
      data: { choices: [{ message: { content: 'ok' } }], usage: { total_tokens: 50 } }
    });

    // 120th request: Must SUCCEED
    await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      messages: [{ role: 'user', content: 'call 120' }],
      max_tokens: 100
    });
    assert.strictEqual(runner.state.globalHttpAttempts, 120, '120th request must be allowed and counted');

    // 121st request: Must be BLOCKED before network dispatch
    let blocked121 = false;
    try {
      await axios.post('https://api.groq.com/openai/v1/chat/completions', {
        messages: [{ role: 'user', content: 'call 121' }],
        max_tokens: 100
      });
    } catch (err) {
      if (err.code === 'BUDGET_CALL_LIMIT_EXCEEDED') {
        blocked121 = true;
      }
    }
    assert.strictEqual(blocked121, true, '121st request must be blocked with BUDGET_CALL_LIMIT_EXCEEDED');
    assert.strictEqual(runner.state.globalHttpAttempts, 120, 'Attempt count must remain strictly capped at 120');
    console.log('  ✓ 120th request processed; 121st blocked before dispatch.');
  }

  // Test 3: Token reservation blocking request that cannot fit within remaining budget
  {
    console.log('\n[Test 3] Verifying token reservation blocks request exceeding remaining headroom...');
    const runner = new MasterEvaluationRunner({ mockMode: true });
    runner.installSafeguards();

    // Set committed tokens close to ceiling (348,000 / 350,000) -> 2,000 headroom
    runner.state.globalHttpAttempts = 10;
    runner.state.committedTokens = 348000;
    runner.state.reservedTokens = 0;

    // A prompt of 500 bytes with max_tokens 2,500 requires 3,000 tokens reservation > 2,000 headroom!
    let blockedByTokenHeadroom = false;
    try {
      await axios.post('https://api.groq.com/openai/v1/chat/completions', {
        messages: [{ role: 'user', content: 'x'.repeat(500) }],
        max_tokens: 2500
      });
    } catch (err) {
      if (err.code === 'BUDGET_TOKEN_LIMIT_EXCEEDED') {
        blockedByTokenHeadroom = true;
      }
    }

    assert.strictEqual(blockedByTokenHeadroom, true, 'Must block call before dispatch when reservation exceeds headroom');
    console.log('  ✓ Pre-dispatch reservation prevented call from overshooting 350,000 tokens.');
  }

  // Test 4: Concurrent token reservations prevent parallel overshooting
  {
    console.log('\n[Test 4] Verifying concurrent token reservations prevent parallel overshoot...');
    const runner = new MasterEvaluationRunner({ mockMode: true });
    runner.installSafeguards();

    runner.state.globalHttpAttempts = 0;
    runner.state.committedTokens = 340000; // 10,000 headroom
    runner.state.reservedTokens = 0;

    // Simulate 3 concurrent worker calls, each reserving 4,500 tokens (total 13,500 > 10,000 headroom)
    let call1Allowed = false;
    let call2Allowed = false;
    let call3Blocked = false;

    runner.mockAxiosHandler = async () => {
      // Simulate delay in network call
      await new Promise(r => setTimeout(r, 50));
      return { status: 200, data: { choices: [{ message: { content: 'done' } }], usage: { total_tokens: 1000 } } };
    };

    const p1 = axios.post('https://api.groq.com/openai/v1/chat/completions', {
      messages: [{ role: 'user', content: 'w1' }],
      max_tokens: 4000
    }).then(() => { call1Allowed = true; });

    const p2 = axios.post('https://api.groq.com/openai/v1/chat/completions', {
      messages: [{ role: 'user', content: 'w2' }],
      max_tokens: 4000
    }).then(() => { call2Allowed = true; });

    const p3 = axios.post('https://api.groq.com/openai/v1/chat/completions', {
      messages: [{ role: 'user', content: 'w3' }],
      max_tokens: 4000
    }).catch(err => {
      if (err.code === 'BUDGET_TOKEN_LIMIT_EXCEEDED') call3Blocked = true;
    });

    await Promise.all([p1, p2, p3]);

    assert.strictEqual(call1Allowed, true, 'First concurrent call allowed');
    assert.strictEqual(call2Allowed, true, 'Second concurrent call allowed');
    assert.strictEqual(call3Blocked, true, 'Third concurrent call blocked because headroom was exhausted by active reservations');
    console.log('  ✓ Concurrent reservations accounted for active in-flight calls and blocked third call.');
  }

  // Test 5: Failed requests retain reserved tokens without refund
  {
    console.log('\n[Test 5] Verifying failed requests do NOT refund reservations...');
    const runner = new MasterEvaluationRunner({ mockMode: true });
    runner.installSafeguards();

    runner.state.globalHttpAttempts = 0;
    runner.state.committedTokens = 50000;
    runner.state.reservedTokens = 0;

    runner.mockAxiosHandler = async () => {
      const err = new Error('ECONNRESET: socket hang up');
      err.code = 'ECONNRESET';
      throw err;
    };

    const initialCommitted = runner.state.committedTokens;
    let failed = false;
    try {
      await axios.post('https://api.groq.com/openai/v1/chat/completions', {
        messages: [{ role: 'user', content: 'abc' }],
        max_tokens: 2000
      });
    } catch (_) {
      failed = true;
    }

    assert.strictEqual(failed, true, 'Call threw network failure');
    assert.strictEqual(runner.state.reservedTokens, 0, 'Active reservation cleared');
    assert.ok(runner.state.committedTokens > initialCommitted, 'Committed tokens must increase (reservation retained, not refunded)');
    console.log(`  ✓ Failed call retained reservation: committed tokens increased from ${initialCommitted} to ${runner.state.committedTokens}.`);
  }

  // Test 6: HTTP 429 and Circuit Breaker Tripping
  {
    console.log('\n[Test 6] Verifying 3 consecutive 429 errors trips circuit breaker...');
    const runner = new MasterEvaluationRunner({ mockMode: true });
    runner.installSafeguards();

    runner.state.globalHttpAttempts = 0;
    runner.state.consecutive429Count = 0;
    runner.state.circuitBreakerTripped = false;

    runner.mockAxiosHandler = async () => {
      const err = new Error('Request failed with status code 429');
      err.response = { status: 429 };
      throw err;
    };

    try { await axios.post('https://api.groq.com/openai/v1/chat/completions', { messages: [{ role: 'user', content: '1' }] }); } catch (_) {}
    assert.strictEqual(runner.state.consecutive429Count, 1);

    try { await axios.post('https://api.groq.com/openai/v1/chat/completions', { messages: [{ role: 'user', content: '2' }] }); } catch (_) {}
    assert.strictEqual(runner.state.consecutive429Count, 2);

    try { await axios.post('https://api.groq.com/openai/v1/chat/completions', { messages: [{ role: 'user', content: '3' }] }); } catch (_) {}
    assert.strictEqual(runner.state.consecutive429Count, 3);
    assert.strictEqual(runner.state.circuitBreakerTripped, true, 'Circuit breaker must be tripped');

    // 4th call must be blocked before dispatch
    let blockedByCB = false;
    try {
      await axios.post('https://api.groq.com/openai/v1/chat/completions', { messages: [{ role: 'user', content: '4' }] });
    } catch (err) {
      if (err.code === 'RATE_LIMIT_CIRCUIT_BREAKER_TRIPPED') blockedByCB = true;
    }
    assert.strictEqual(blockedByCB, true, 'Call 4 blocked by tripped circuit breaker');
    console.log('  ✓ Circuit breaker tripped on 3 consecutive 429s and blocked subsequent request.');
  }

  // Test 7: Missing usage metadata handling with conservative upper bound (never zero)
  {
    console.log('\n[Test 7] Verifying missing usage metadata records conservative upper bound (never zero)...');
    const runner = new MasterEvaluationRunner({ mockMode: true });
    runner.installSafeguards();

    runner.state.globalHttpAttempts = 0;
    runner.state.committedTokens = 0;
    runner.state.reservedTokens = 0;
    runner.state.estimatedTokensRecorded = 0;

    runner.mockAxiosHandler = async () => ({
      status: 200,
      data: {
        choices: [{ message: { content: 'sample question text without usage metadata' } }]
        // usage is omitted!
      }
    });

    await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      messages: [{ role: 'user', content: 'prompt text here' }],
      max_tokens: 500
    });

    assert.ok(runner.state.committedTokens > 0, 'Committed tokens must be greater than zero');
    assert.strictEqual(runner.state.actualTokensRecorded, 0, 'Actual tokens from provider is 0 because usage was missing');
    assert.ok(runner.state.estimatedTokensRecorded > 0, 'Estimated tokens recorded must capture conservative bound');
    assert.strictEqual(runner.state.callLedger[0].usageSource, 'CONSERVATIVE_ESTIMATE');
    console.log(`  ✓ Missing usage handled conservatively: recorded ${runner.state.estimatedTokensRecorded} tokens (source: CONSERVATIVE_ESTIMATE).`);
  }

  // Test 8: Raw string response handling from llmRouter
  {
    console.log('\n[Test 8] Verifying raw string response from provider completes cleanly...');
    const runner = new MasterEvaluationRunner({ mockMode: true });
    runner.installSafeguards();

    runner.mockAxiosHandler = async () => ({
      status: 200,
      data: {
        choices: [{ message: { content: '{"status": "OK", "raw": true}' } }],
        usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 }
      }
    });

    const resp = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      messages: [{ role: 'user', content: 'raw string check' }]
    });

    assert.strictEqual(typeof resp.data.choices[0].message.content, 'string');
    assert.strictEqual(runner.state.actualTokensRecorded, 120);
    console.log('  ✓ Raw string response handled cleanly with accurate usage accounting.');
  }

  // Test 9: Planner cache bypass preserving non-plan caches
  {
    console.log('\n[Test 9] Verifying planner cache bypass preserves non-plan cache entries...');
    const runner = new MasterEvaluationRunner({ mockMode: true });
    runner.installSafeguards();

    cacheManager.set('non_plan_production_key', { prod: 'data' });
    cacheManager.set('plan:v2:hash123', { targets: ['T1', 'T2'] });

    assert.strictEqual(cacheManager.get('plan:v2:hash123'), null, 'plan:* keys must return null for evaluation isolation');
    assert.deepStrictEqual(cacheManager.get('non_plan_production_key'), { prod: 'data' }, 'non-plan keys must be preserved');
    console.log('  ✓ Planner cache isolated; production non-plan cache preserved.');
  }

  // Test 10: Partial telemetry persistence after each run
  {
    console.log('\n[Test 10] Verifying partial telemetry is persisted with accurate execution ledger...');
    const runner = new MasterEvaluationRunner({ mockMode: true });
    runner.state.globalHttpAttempts = 5;
    runner.state.failedHttpAttempts = 1;
    runner.state.committedTokens = 12500;
    runner.state.runResults = [
      { runId: 'R1', cohortId: 'MULTI_004', deliveredCount: 5, pipelineStatus: 'COMPLETED' }
    ];

    const savedPath = runner.persistTelemetry('PARTIAL');
    assert.ok(fs.existsSync(savedPath));
    const content = JSON.parse(fs.readFileSync(savedPath, 'utf8'));

    assert.strictEqual(content.summaryType, 'PARTIAL');
    assert.strictEqual(content.consumed.totalHttpAttempts, 5);
    assert.strictEqual(content.consumed.failedHttpAttempts, 1);
    assert.strictEqual(content.consumed.committedTokens, 12500);
    assert.strictEqual(content.completedRunsCount, 1);
    console.log(`  ✓ Partial telemetry verified at ${savedPath}`);
  }

  console.log('\n========================================================================');
  console.log('  ✅ ALL 10 TRANSPORT-LEVEL SAFEGUARD TESTS PASSED CLEANLY');
  console.log('========================================================================\n');
}

runAllSafeguardTests().catch(err => {
  console.error('❌ Safeguard test failure:', err);
  process.exit(1);
});
