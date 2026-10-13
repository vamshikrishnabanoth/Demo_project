/**
 * server/test/test_trace_linkage.js
 *
 * Dedicated Acceptance Test Suite for Step 3: Trace Linkage
 * - Test 1: registerAlias bidirectionally links taskId and sessionId
 * - Test 2: emitStageUpdate for sessionId notifies subscriber listening on taskId
 * - Test 3: emitStageUpdate for taskId notifies subscriber listening on sessionId
 * - Test 4: getLogs(taskId) returns historical logs saved under sessionId
 * - Test 5: getLogs(sessionId) returns historical logs saved under taskId
 * - Test 6: pipelineOrchestrator respects sessionInputs.taskId as trace identifier
 * - Test 7: Unsubscribing cleanly removes alias listeners without dangling events
 * - Test 8: TelemetryService syncs existing logs when alias is registered post-facto
 */

'use strict';

const assert = require('assert');
const telemetryService = require('../services/telemetryService');
const pipelineOrchestrator = require('../engine/pipelineOrchestrator');

console.log('======================================================================');
console.log('🧪 STEP 3 ACCEPTANCE SUITE: TRACE LINKAGE & TELEMETRY OBSERVABILITY');
console.log('======================================================================\n');

let totalTests = 0;
let passedTests = 0;

function recordSync(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(` ✅ PASS [${totalTests}]: ${name}`);
  } catch (err) {
    console.error(` ❌ FAIL [${totalTests}]: ${name}`);
    console.error(`    ${err.message}`);
    if (err.stack) console.error(err.stack.split('\n').slice(1, 4).join('\n'));
  }
}

async function recordAsync(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(` ✅ PASS [${totalTests}]: ${name}`);
  } catch (err) {
    console.error(` ❌ FAIL [${totalTests}]: ${name}`);
    console.error(`    ${err.message}`);
    if (err.stack) console.error(err.stack.split('\n').slice(1, 4).join('\n'));
  }
}

async function runSuite() {
  // ---------------------------------------------------------------------------
  // Test 1: registerAlias bidirectionally links taskId and sessionId
  // ---------------------------------------------------------------------------
  recordSync('T1: registerAlias bidirectionally links taskId and sessionId', () => {
    const taskId = 'task_test_001';
    const sessId = 'sess_test_001';

    telemetryService.registerAlias(taskId, sessId);

    assert.strictEqual(telemetryService.getAlias(taskId), sessId);
    assert.strictEqual(telemetryService.getAlias(sessId), taskId);
  });

  // ---------------------------------------------------------------------------
  // Test 2: emitStageUpdate for sessionId notifies subscriber on taskId
  // ---------------------------------------------------------------------------
  await recordAsync('T2: emitStageUpdate(sessionId) notifies subscriber on taskId', async () => {
    const taskId = 'task_stream_002';
    const sessId = 'sess_stream_002';
    telemetryService.registerAlias(taskId, sessId);

    let received = null;
    const unsub = telemetryService.subscribe(taskId, (payload) => {
      received = payload;
    });

    await telemetryService.emitStageUpdate(sessId, {
      stageNumber: 2,
      stageName: 'AGENT_1_PLANNING',
      status: 'PASS',
      metrics: { targets: 5 }
    });

    unsub();

    assert.notStrictEqual(received, null, 'Subscriber on taskId should receive event emitted to sessId');
    assert.strictEqual(received.stageName, 'AGENT_1_PLANNING');
    assert.strictEqual(received.status, 'PASS');
  });

  // ---------------------------------------------------------------------------
  // Test 3: emitStageUpdate for taskId notifies subscriber on sessionId
  // ---------------------------------------------------------------------------
  await recordAsync('T3: emitStageUpdate(taskId) notifies subscriber on sessionId', async () => {
    const taskId = 'task_stream_003';
    const sessId = 'sess_stream_003';
    telemetryService.registerAlias(taskId, sessId);

    let received = null;
    const unsub = telemetryService.subscribe(sessId, (payload) => {
      received = payload;
    });

    await telemetryService.emitStageUpdate(taskId, {
      stageNumber: 3,
      stageName: 'QUESTION_GENERATION',
      status: 'PASS',
      metrics: { generated: 3 }
    });

    unsub();

    assert.notStrictEqual(received, null, 'Subscriber on sessId should receive event emitted to taskId');
    assert.strictEqual(received.stageName, 'QUESTION_GENERATION');
  });

  // ---------------------------------------------------------------------------
  // Test 4: getLogs(taskId) returns historical logs saved under sessionId
  // ---------------------------------------------------------------------------
  await recordAsync('T4: getLogs(taskId) retrieves logs emitted under sessionId', async () => {
    const taskId = 'task_hist_004';
    const sessId = 'sess_hist_004';
    telemetryService.registerAlias(taskId, sessId);

    await telemetryService.emitStageUpdate(sessId, {
      stageNumber: 1,
      stageName: 'INGESTION',
      status: 'PASS'
    });

    const logsByTask = await telemetryService.getLogs(taskId);
    assert.ok(logsByTask.length > 0, 'getLogs(taskId) must return logs saved under sessId');
    assert.strictEqual(logsByTask[0].stageName, 'INGESTION');
  });

  // ---------------------------------------------------------------------------
  // Test 5: getLogs(sessionId) returns historical logs saved under taskId
  // ---------------------------------------------------------------------------
  await recordAsync('T5: getLogs(sessionId) retrieves logs emitted under taskId', async () => {
    const taskId = 'task_hist_005';
    const sessId = 'sess_hist_005';
    telemetryService.registerAlias(taskId, sessId);

    await telemetryService.emitStageUpdate(taskId, {
      stageNumber: 7,
      stageName: 'FINAL_GROUNDING_GATE',
      status: 'PASS'
    });

    const logsBySess = await telemetryService.getLogs(sessId);
    assert.ok(logsBySess.length > 0, 'getLogs(sessId) must return logs saved under taskId');
    assert.strictEqual(logsBySess[0].stageName, 'FINAL_GROUNDING_GATE');
  });

  // ---------------------------------------------------------------------------
  // Test 6: pipelineOrchestrator links sessionInputs.taskId to sessionId
  // ---------------------------------------------------------------------------
  await recordAsync('T6: pipelineOrchestrator establishes trace linkage for sessionInputs.taskId', async () => {
    const customTaskId = 'task_orch_link_006';
    let streamEventCaptured = null;

    const unsub = telemetryService.subscribe(customTaskId, (event) => {
      streamEventCaptured = event;
    });

    const result = await pipelineOrchestrator.runPipeline({
      taskId: customTaskId,
      count: 1,
      difficulty: 'Easy',
      voiceTranscript: 'In computing, a virtual machine provides an emulation of a computer system based on computer architectures.'
    });

    unsub();

    assert.strictEqual(result.sessionId, customTaskId, 'Pipeline result sessionId must equal taskId when provided');
    assert.notStrictEqual(streamEventCaptured, null, 'Live telemetry must be captured on the customTaskId subscriber');
  });

  // ---------------------------------------------------------------------------
  // Test 7: Unsubscribing cleanly removes alias listeners
  // ---------------------------------------------------------------------------
  await recordAsync('T7: Unsubscribing removes both primary and alias listeners without leakage', async () => {
    const taskId = 'task_unsub_007';
    const sessId = 'sess_unsub_007';
    telemetryService.registerAlias(taskId, sessId);

    let count = 0;
    const unsub = telemetryService.subscribe(taskId, () => {
      count++;
    });

    await telemetryService.emitStageUpdate(sessId, { stageNumber: 1, stageName: 'TEST', status: 'PASS' });
    assert.strictEqual(count, 1, 'Should have received 1 event');

    // Unsubscribe
    unsub();

    await telemetryService.emitStageUpdate(sessId, { stageNumber: 2, stageName: 'TEST2', status: 'PASS' });
    assert.strictEqual(count, 1, 'Should NOT receive event after unsubscribe');
  });

  // ---------------------------------------------------------------------------
  // Test 8: TelemetryService syncs existing logs when alias registered post-facto
  // ---------------------------------------------------------------------------
  await recordAsync('T8: Existing memory logs synced when alias registered after events', async () => {
    const sessId = 'sess_post_008';
    const taskId = 'task_post_008';

    // Emit to sessId BEFORE alias is known
    await telemetryService.emitStageUpdate(sessId, {
      stageNumber: 1,
      stageName: 'EARLY_INGESTION',
      status: 'PASS'
    });

    // Now register alias
    telemetryService.registerAlias(taskId, sessId);

    const logs = await telemetryService.getLogs(taskId);
    assert.ok(logs.length > 0, 'Logs must be accessible via taskId even if emitted before alias registration');
    assert.strictEqual(logs[0].stageName, 'EARLY_INGESTION');
  });

  console.log('\n======================================================================');
  console.log(`📊 TRACE LINKAGE RESULTS: ${passedTests}/${totalTests} Passed`);
  console.log('======================================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runSuite().catch(err => {
  console.error('Test suite failed unexpectedly:', err);
  process.exit(1);
});
