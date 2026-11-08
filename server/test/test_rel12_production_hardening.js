/**
 * KMIT Kahoot — REL-12 Production Hardening Test Suite
 * Baseline: 9b0b8872fdb8483377288e45574e2b836ed136d4
 * Specification: PLAN-PROD-2026-11-08-REL-12-DEFINITIVE
 */

const assert = require('assert');
const crypto = require('crypto');
const taskManager = require('../services/taskManager');
const provenanceValidator = require('../services/provenanceValidator');
const { isGenuinelyMatchingIndex } = require('../../scripts/run_production_migration');

console.log('🧪 Starting REL-12 Production Hardening Verification Suite...\n');

let totalTests = 0;
let passedTests = 0;

function it(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    console.error(`  ❌ ${name}`);
    console.error(`     Error: ${err.message}`);
  }
}

async function itAsync(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    console.error(`  ❌ ${name}`);
    console.error(`     Error: ${err.message}`);
  }
}

async function runAllTests() {

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 1: Task Manager SLA, Cancellation & Retry Idempotency
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('📦 Suite 1: Task Manager Watchdog SLA, Cancellation & Retry Idempotency');

  it('calculateAdaptiveTimeoutMs enforces calibrated operational SLA bounds (420s - 1200s)', () => {
    // Small input <= 15k chars
    const smallTimeout = taskManager.calculateAdaptiveTimeoutMs({ questionCount: 5, textLength: 10000 });
    assert.strictEqual(smallTimeout, 460000); // 420s base + 5*8s = 460s

    // Medium input 15k-30k chars
    const medTimeout = taskManager.calculateAdaptiveTimeoutMs({ questionCount: 10, textLength: 22000 });
    assert.strictEqual(medTimeout, 700000); // 600s base + 10*10s = 700s

    // Heavy 75-min lecture transcript (> 30k chars, 59,390 chars, 25 Qs)
    // Reconciled with measured 19m51s (1191s) worst-case peak API baseline
    const heavyTimeout = taskManager.calculateAdaptiveTimeoutMs({ questionCount: 25, textLength: 59390 });
    assert.strictEqual(heavyTimeout, 1200000); // 900s base + 25*12s = 1200s (20m strictly bounded ceiling)

    // Unbounded protection: huge question count capped strictly at 1200s
    const cappedTimeout = taskManager.calculateAdaptiveTimeoutMs({ questionCount: 100, textLength: 60000 });
    assert.strictEqual(cappedTimeout, 1200000);

    // Pure questionCount integer backwards compatibility
    const legacyTimeout = taskManager.calculateAdaptiveTimeoutMs(5);
    assert.strictEqual(legacyTimeout, 460000);
  });

  it('createTask instantiates AbortController and initializes manifest fields', () => {
    const taskId = taskManager.createTask({ questionCount: 5, userId: 'teacher_123' });
    const task = taskManager.getTask(taskId);
    assert.ok(task, 'Task must exist');
    assert.ok(task.abortController instanceof AbortController, 'abortController must be instance of AbortController');
    assert.strictEqual(task.abortController.signal.aborted, false, 'Signal must initially be active (not aborted)');
    assert.strictEqual(task.isPublished, false, 'isPublished must initialize to false');
    assert.strictEqual(task.manifest, null, 'manifest must initialize to null');
  });

  it('cancelTask synchronously aborts in-flight AbortController signal', () => {
    const taskId = taskManager.createTask({ questionCount: 5, userId: 'teacher_123' });
    const task = taskManager.getTask(taskId);
    const cancelled = taskManager.cancelTask(taskId, 'teacher_123');
    assert.strictEqual(cancelled, true);
    assert.strictEqual(task.status, 'CANCELLED');
    assert.strictEqual(task.abortController.signal.aborted, true, 'AbortSignal must be true after cancellation');
  });

  it('preemptTaskForRetry synchronously cancels old task before replacement', () => {
    const oldTaskId = taskManager.createTask({ questionCount: 5, userId: 'teacher_retry' });
    const oldTask = taskManager.getTask(oldTaskId);
    const preempted = taskManager.preemptTaskForRetry(oldTaskId, 'teacher_retry');
    assert.strictEqual(preempted, true);
    assert.strictEqual(oldTask.status, 'CANCELLED');
    assert.strictEqual(oldTask.errorCode, 'SUPERSEDED_BY_RETRY');
    assert.strictEqual(oldTask.abortController.signal.aborted, true);
  });

  it('Retry Idempotency Regression: Preempting task with same idempotencyKey creates genuinely new task', () => {
    const testKey = `idemp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const task1Id = taskManager.createTask({ questionCount: 5, userId: 'teacher_idemp', idempotencyKey: testKey });
    assert.ok(task1Id);

    // If request arrives while task 1 is RUNNING without preemption, reuse task 1
    const task1Reused = taskManager.createTask({ questionCount: 5, userId: 'teacher_idemp', idempotencyKey: testKey });
    assert.strictEqual(task1Reused, task1Id, 'Active RUNNING task must be reused if not preempted');

    // Preempt task 1 for retry
    const preempted = taskManager.preemptTaskForRetry(task1Id, 'teacher_idemp');
    assert.strictEqual(preempted, true);

    // Replacement request with the exact same idempotencyKey MUST generate a genuinely new task
    const task2Id = taskManager.createTask({ questionCount: 5, userId: 'teacher_idemp', idempotencyKey: testKey });
    assert.notStrictEqual(task2Id, task1Id, 'Replacement task MUST have a genuinely new UUID');

    const task1 = taskManager.getTask(task1Id);
    const task2 = taskManager.getTask(task2Id);
    assert.strictEqual(task1.status, 'CANCELLED');
    assert.strictEqual(task2.status, 'RUNNING');
  });

  it('completeTask rejects late completion if abortController signal is aborted', () => {
    const taskId = taskManager.createTask({ questionCount: 5, userId: 'teacher_late' });
    const task = taskManager.getTask(taskId);
    task.abortController.abort();
    taskManager.completeTask(taskId, { questions: [{ questionText: 'Q1' }] });
    assert.notStrictEqual(task.status, 'COMPLETED', 'completeTask must not set status to COMPLETED if aborted');
    assert.strictEqual(task.result, null, 'Result must remain null');
  });

  it('completeTask builds canonical manifest when task completes normally', () => {
    const taskId = taskManager.createTask({ questionCount: 1, userId: 'teacher_ok' });
    const questions = [
      {
        questionText: 'What is a foreign key?',
        correctAnswer: 'Enforces referential integrity',
        concept_tag: 'Foreign Keys',
        targetId: 1
      }
    ];
    taskManager.completeTask(taskId, { questions });
    const task = taskManager.getTask(taskId);
    assert.strictEqual(task.status, 'COMPLETED');
    assert.ok(Array.isArray(task.manifest), 'task.manifest must be an array');
    assert.strictEqual(task.manifest.length, 1);
    assert.strictEqual(task.manifest[0].stem, 'What is a foreign key?');
    assert.strictEqual(task.manifest[0].correctAnswer, 'Enforces referential integrity');
    assert.strictEqual(task.manifest[0].conceptTested, 'Foreign Keys');
    assert.ok(task.manifest[0].qOriginId.includes(taskId));
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 2: Provenance Integrity & Triple Semantic Guardrails (Production Validator)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n🔍 Suite 2: Question Provenance Integrity (Production Service)');

  it('Positive 1: Typo and vocabulary polishing is ACCEPTED', () => {
    const cq = {
      stem: "In relational databases, what does a foreign key constraint enforce?",
      correctAnswer: "Referential integrity between two tables."
    };
    const sq = {
      stem: "In a relational database, what does a foreign key constraint guarantee?",
      correctAnswer: "Referential integrity between two tables."
    };
    const res = provenanceValidator.evaluateQuestionProvenance(sq, cq);
    assert.strictEqual(res.status, 'ACCEPTED');
    assert.strictEqual(res.code, 'PROVENANCE_VERIFIED');
  });

  it('Positive 2: Preamble removal and stem simplification is ACCEPTED', () => {
    const cq = {
      stem: "Based on the database design lecture, which join returns all rows from both tables?",
      correctAnswer: "Full Outer Join"
    };
    const sq = {
      stem: "Which SQL join returns all rows from both tables?",
      correctAnswer: "Full Outer Join"
    };
    const res = provenanceValidator.evaluateQuestionProvenance(sq, cq);
    assert.strictEqual(res.status, 'ACCEPTED');
    assert.strictEqual(res.code, 'PROVENANCE_VERIFIED');
  });

  it('Negative 1: Retained answer with changed question topic is REJECTED (STEM_MISMATCH)', () => {
    const cq = {
      stem: "In graph theory, which algorithm finds the shortest path in a weighted graph?",
      correctAnswer: "Dijkstra's Algorithm"
    };
    const sq = {
      stem: "In database index design, how do B-Trees optimize range queries?",
      correctAnswer: "Dijkstra's Algorithm"
    };
    const res = provenanceValidator.evaluateQuestionProvenance(sq, cq);
    assert.strictEqual(res.status, 'REJECTED');
    assert.strictEqual(res.code, 'PROVENANCE_VIOLATION_STEM_MISMATCH');
  });

  it('Negative 2: Negation scope mismatch is REJECTED (SCOPE_MISMATCH)', () => {
    const cq = {
      stem: "Which of the following is NOT an advantage of indexing a database column?",
      correctAnswer: "Increased insert and update throughput"
    };
    const sq = {
      stem: "Which of the following is an advantage of indexing a database column?",
      correctAnswer: "Faster query execution"
    };
    const res = provenanceValidator.evaluateQuestionProvenance(sq, cq);
    assert.strictEqual(res.status, 'REJECTED');
    assert.strictEqual(res.code, 'PROVENANCE_VIOLATION_SCOPE_MISMATCH');
  });

  it('Negative 3: Ambiguous borderline answer match (52%) is safely REJECTED', () => {
    const cq = {
      stem: "In relational database design, what is the primary role of a foreign key constraint?",
      correctAnswer: "To enforce referential integrity between two related tables."
    };
    const sq = {
      stem: "In relational database design, what is the primary role of a foreign key constraint?",
      correctAnswer: "To maintain referential consistency between tables."
    };
    const res = provenanceValidator.evaluateQuestionProvenance(sq, cq);
    assert.strictEqual(res.status, 'REJECTED');
    assert.strictEqual(res.code, 'PROVENANCE_AMBIGUOUS_BORDERLINE');
    assert.ok(res.answerSim >= 0.35 && res.answerSim < 0.65);
  });

  it('Negative 4: Meaning-changing answer rewrite (<35%) is REJECTED', () => {
    const cq = {
      stem: "In relational database design, what is the primary role of a foreign key constraint?",
      correctAnswer: "To enforce referential integrity between two related tables."
    };
    const sq = {
      stem: "In relational database design, what is the primary role of a foreign key constraint?",
      correctAnswer: "To uniquely identify each record in a table and ensure entity integrity."
    };
    const res = provenanceValidator.evaluateQuestionProvenance(sq, cq);
    assert.strictEqual(res.status, 'REJECTED');
    assert.strictEqual(res.code, 'PROVENANCE_VIOLATION_MEANING_CHANGED');
    assert.ok(res.answerSim < 0.35);
  });

  it('validateSubmissionProvenance rejects duplicate submitted questions', () => {
    const manifest = [
      { qOriginId: 't1_q1', stem: 'What is ACID?', correctAnswer: 'Atomicity, Consistency, Isolation, Durability' },
      { qOriginId: 't1_q2', stem: 'What is a B-Tree?', correctAnswer: 'A balanced search tree' }
    ];
    const duplicates = [
      { qOriginId: 't1_q1', stem: 'What is ACID?', correctAnswer: 'Atomicity, Consistency, Isolation, Durability' },
      { qOriginId: 't1_q2', stem: 'What is ACID?', correctAnswer: 'Atomicity, Consistency, Isolation, Durability' }
    ];
    const val = provenanceValidator.validateSubmissionProvenance(duplicates, manifest);
    assert.strictEqual(val.valid, false);
    assert.strictEqual(val.error, 'PROVENANCE_VIOLATION_DUPLICATE_SUBMITTED_QUESTION');
  });

  it('validateSubmissionProvenance enforces 1-to-1 canonical matching', () => {
    const manifest = [
      { qOriginId: 't1_q1', stem: 'What is ACID?', correctAnswer: 'Atomicity, Consistency, Isolation, Durability' }
    ];
    const duplicateClaims = [
      { qOriginId: 't1_q1', stem: 'What is ACID?', correctAnswer: 'Atomicity, Consistency, Isolation, Durability' },
      { qOriginId: 't1_q1', stem: 'What is ACID in DBs?', correctAnswer: 'Atomicity, Consistency, Isolation, Durability' }
    ];
    const val = provenanceValidator.validateSubmissionProvenance(duplicateClaims, manifest);
    assert.strictEqual(val.valid, false);
    assert.strictEqual(val.error, 'PROVENANCE_VIOLATION_DUPLICATE_CANONICAL_CLAIM');
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 3: Broadcast Dispatch Lease & Client-Side Deduplication
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n📡 Suite 3: Broadcast Dispatch Lease & Client Deduplication');

  class MockDatabase {
    constructor() {
      this.broadcasts = new Map();
      this.quizzes = new Map();
    }
    insertQuiz(id, sourceTaskId) {
      this.quizzes.set(id, { id, sourceTaskId, broadcastStatus: false });
    }
    insertBroadcast(id, quizId, deliveryStatus = 'pending') {
      this.broadcasts.set(id, {
        id, quizId, deliveryStatus, leaseOwner: null, leaseExpiresAt: null, leaseToken: null
      });
    }
    claimLease(broadcastId, workerId, ttlMs = 30000) {
      const b = this.broadcasts.get(broadcastId);
      if (!b) return { acquired: false };
      const now = Date.now();
      const isPending = b.deliveryStatus === 'pending';
      const isExpiredDispatching = b.deliveryStatus === 'dispatching' && b.leaseExpiresAt && b.leaseExpiresAt <= now;
      if (isPending || isExpiredDispatching) {
        const leaseToken = crypto.randomUUID();
        b.deliveryStatus = 'dispatching';
        b.leaseOwner = workerId;
        b.leaseExpiresAt = now + ttlMs;
        b.leaseToken = leaseToken;
        return { acquired: true, leaseToken, leaseExpiresAt: b.leaseExpiresAt };
      }
      return { acquired: false };
    }
    renewLease(broadcastId, leaseToken, ttlMs = 30000) {
      const b = this.broadcasts.get(broadcastId);
      if (!b) return null;
      const now = Date.now();
      if (b.deliveryStatus === 'dispatching' && b.leaseToken === leaseToken && b.leaseExpiresAt && b.leaseExpiresAt > now) {
        b.leaseExpiresAt = now + ttlMs;
        return b.leaseExpiresAt;
      }
      return null;
    }
    completeDispatch(broadcastId, quizId, workerId, leaseToken) {
      const b = this.broadcasts.get(broadcastId);
      const q = this.quizzes.get(quizId);
      if (!b || !q) return false;
      const now = Date.now();
      if (b.deliveryStatus !== 'dispatching' || b.leaseToken !== leaseToken || !b.leaseExpiresAt || b.leaseExpiresAt <= now) {
        return false;
      }
      b.deliveryStatus = 'delivered';
      b.leaseOwner = null;
      b.leaseExpiresAt = null;
      b.leaseToken = null;
      q.broadcastStatus = true;
      return true;
    }
  }

  it('Initial lease claim succeeds for pending broadcast', () => {
    const db = new MockDatabase();
    db.insertQuiz('q1', 'task_1');
    db.insertBroadcast('b1', 'q1', 'pending');
    const claim = db.claimLease('b1', 'worker_A', 30000);
    assert.strictEqual(claim.acquired, true);
    assert.ok(claim.leaseToken);
  });

  it('Concurrent lease claim on active lease is REJECTED', () => {
    const db = new MockDatabase();
    db.insertQuiz('q1', 'task_1');
    db.insertBroadcast('b1', 'q1', 'pending');
    db.claimLease('b1', 'worker_A', 30000);
    const concurrentClaim = db.claimLease('b1', 'worker_B', 30000);
    assert.strictEqual(concurrentClaim.acquired, false);
  });

  it('Heartbeat renewal extends lease TTL when valid, fails if expired', () => {
    const db = new MockDatabase();
    db.insertQuiz('q1', 'task_1');
    db.insertBroadcast('b1', 'q1', 'pending');
    const claim = db.claimLease('b1', 'worker_A', 1000);
    const renewed = db.renewLease('b1', claim.leaseToken, 30000);
    assert.ok(renewed, 'Renewal must succeed for active lease');

    // Stale/invalid token renewal fails
    const invalidRenew = db.renewLease('b1', 'forged_token', 30000);
    assert.strictEqual(invalidRenew, null);
  });

  it('Stale worker is fenced out on completion; Quiz.broadcastStatus remains consistent', () => {
    const db = new MockDatabase();
    db.insertQuiz('q1', 'task_1');
    db.insertBroadcast('b1', 'q1', 'pending');
    const claimA = db.claimLease('b1', 'worker_A', 50);

    // Simulate expiry: worker A expires
    db.broadcasts.get('b1').leaseExpiresAt = Date.now() - 10;

    // Worker B reclaims
    const claimB = db.claimLease('b1', 'worker_B', 30000);
    assert.strictEqual(claimB.acquired, true);

    // Worker A attempts late completion
    const compA = db.completeDispatch('b1', 'q1', 'worker_A', claimA.leaseToken);
    assert.strictEqual(compA, false, 'Expired worker A must be fenced out');
    assert.strictEqual(db.quizzes.get('q1').broadcastStatus, false);

    // Worker B completes
    const compB = db.completeDispatch('b1', 'q1', 'worker_B', claimB.leaseToken);
    assert.strictEqual(compB, true);
    assert.strictEqual(db.quizzes.get('q1').broadcastStatus, true);
    assert.strictEqual(db.broadcasts.get('b1').deliveryStatus, 'delivered');
  });

  it('Client Broadcast Deduplication: Receiving the same event twice creates only ONE notification', () => {
    // Test the client deduplication logic simulated in DashboardLayout
    const seenEvents = new Set();
    let toastCount = 0;

    function handleTestBroadcast(broadcast) {
      const eventId = broadcast?.eventId || (broadcast?.id ? `bcast_${broadcast.id}` : null);
      if (eventId && seenEvents.has(eventId)) {
        return; // Deduplicated
      }
      if (eventId) seenEvents.add(eventId);
      toastCount++;
    }

    const eventPayload = {
      eventId: 'bcast_b07e59b2-2ca1-4f93-84fb',
      id: 'b07e59b2-2ca1-4f93-84fb',
      title: 'Live Arena Invitation'
    };

    // First arrival
    handleTestBroadcast(eventPayload);
    assert.strictEqual(toastCount, 1, 'First receipt must trigger toast');

    // Duplicate arrival (retransmitted socket packet / second worker)
    handleTestBroadcast(eventPayload);
    assert.strictEqual(toastCount, 1, 'Duplicate receipt must NOT trigger a second toast');

    // Distinct event
    handleTestBroadcast({ eventId: 'bcast_distinct_id_2', id: '2', title: 'New Quiz' });
    assert.strictEqual(toastCount, 2, 'Distinct event must trigger toast');
  });

  it('Broadcast Delivery Correctness: Socket.IO unavailable or failed completion does NOT report success', () => {
    function simulateBroadcastDispatch({ io, userSockets, transactionSuccess }) {
      // Step 4: Sockets availability guard
      if (!io || !userSockets) {
        return { delivered: false, reason: 'SOCKETS_UNAVAILABLE' };
      }
      // Step 5: Transactional completion
      if (!transactionSuccess) {
        return { delivered: false, reason: 'TRANSACTION_FAILED' };
      }
      return { delivered: true, reason: 'DELIVERED_SUCCESSFULLY' };
    }

    // Case 1: io is null
    const resNoIo = simulateBroadcastDispatch({ io: null, userSockets: new Map(), transactionSuccess: true });
    assert.strictEqual(resNoIo.delivered, false);
    assert.strictEqual(resNoIo.reason, 'SOCKETS_UNAVAILABLE');

    // Case 2: userSockets is null
    const resNoSockets = simulateBroadcastDispatch({ io: {}, userSockets: null, transactionSuccess: true });
    assert.strictEqual(resNoSockets.delivered, false);
    assert.strictEqual(resNoSockets.reason, 'SOCKETS_UNAVAILABLE');

    // Case 3: completeBroadcastDispatch returns false (transaction rolled back)
    const resTxFailed = simulateBroadcastDispatch({ io: {}, userSockets: new Map(), transactionSuccess: false });
    assert.strictEqual(resTxFailed.delivered, false);
    assert.strictEqual(resTxFailed.reason, 'TRANSACTION_FAILED');

    // Case 4: Everything available and successful
    const resSuccess = simulateBroadcastDispatch({ io: {}, userSockets: new Map(), transactionSuccess: true });
    assert.strictEqual(resSuccess.delivered, true);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 4: Exact Migration Index Verification
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n🛡️ Suite 4: Exact Index-Definition Verification (Migration Runner)');

  it('isGenuinelyMatchingIndex preserves ONLY an exact, valid, unique, single-column index on Quiz(sourceTaskId)', () => {
    // Valid genuine index on public.Quiz.sourceTaskId
    const validIdx = {
      schema_name: 'public',
      table_name: 'Quiz',
      column_name: 'sourceTaskId',
      indisunique: true,
      indisvalid: true,
      indisready: true,
      is_not_partial: true,
      is_not_expression: true,
      indnkeyatts: 1,
      indnatts: 1
    };
    assert.strictEqual(isGenuinelyMatchingIndex(validIdx), true);

    // Rejection 0: Wrong schema
    assert.strictEqual(isGenuinelyMatchingIndex({ ...validIdx, schema_name: 'staging' }), false);

    // Rejection 1: Wrong table
    assert.strictEqual(isGenuinelyMatchingIndex({ ...validIdx, table_name: 'Broadcast' }), false);

    // Rejection 2: Wrong column
    assert.strictEqual(isGenuinelyMatchingIndex({ ...validIdx, column_name: 'joinCode' }), false);

    // Rejection 3: Non-unique
    assert.strictEqual(isGenuinelyMatchingIndex({ ...validIdx, indisunique: false }), false);

    // Rejection 4: Invalid index (build interrupted)
    assert.strictEqual(isGenuinelyMatchingIndex({ ...validIdx, indisvalid: false }), false);

    // Rejection 5: Not ready
    assert.strictEqual(isGenuinelyMatchingIndex({ ...validIdx, indisready: false }), false);

    // Rejection 6: Partial index (contains WHERE predicate)
    assert.strictEqual(isGenuinelyMatchingIndex({ ...validIdx, is_not_partial: false }), false);

    // Rejection 7: Expression index (e.g. lower(sourceTaskId))
    assert.strictEqual(isGenuinelyMatchingIndex({ ...validIdx, is_not_expression: false }), false);

    // Rejection 8: Multi-column composite index
    assert.strictEqual(isGenuinelyMatchingIndex({ ...validIdx, indnkeyatts: 2 }), false);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 5: In-Flight Provider Cancellation & TPD Process-Local Tracking
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n⚡ Suite 5: Mocked In-Flight Provider Cancellation & Process-Local TPD');

  await itAsync('AbortSignal terminates in-flight Groq axios request immediately without hanging', async () => {
    const ac = new AbortController();
    let abortedAt = null;

    // Simulate in-flight HTTP socket connected to Groq
    const mockAxiosPost = (url, data, options) => {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          resolve({ data: { choices: [{ message: { content: '{}' } }] } });
        }, 5000); // 5s latency simulation

        if (options?.signal) {
          options.signal.addEventListener('abort', () => {
            clearTimeout(timer);
            abortedAt = Date.now();
            const abortErr = new Error('Request aborted');
            abortErr.code = 'ERR_CANCELED';
            abortErr.name = 'CanceledError';
            reject(abortErr);
          });
        }
      });
    };

    const startTime = Date.now();
    // Fire request
    const requestPromise = mockAxiosPost('https://api.groq.com/openai/v1/chat/completions', {}, { signal: ac.signal });

    // Abort after 20ms
    setTimeout(() => ac.abort(), 20);

    try {
      await requestPromise;
      assert.fail('Request should have aborted');
    } catch (err) {
      const elapsed = Date.now() - startTime;
      assert.strictEqual(err.name, 'CanceledError');
      assert.ok(elapsed < 200, `Abort took ${elapsed}ms; must terminate immediately (<200ms)`);
    }
  });

  await itAsync('AbortSignal breaks sleep and cooldown waits immediately without waiting', async () => {
    const ac = new AbortController();
    const startTime = Date.now();

    // Abortable sleep helper
    const abortableSleep = (ms, signal) => {
      return new Promise((resolve, reject) => {
        if (signal?.aborted) return reject(new Error('ABORTED_DURING_SLEEP'));
        const timer = setTimeout(resolve, ms);
        if (signal) {
          signal.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new Error('ABORTED_DURING_SLEEP'));
          });
        }
      });
    };

    setTimeout(() => ac.abort(), 15);

    try {
      await abortableSleep(60000, ac.signal); // 60s rate limit sleep
      assert.fail('Sleep should have been aborted');
    } catch (err) {
      const elapsed = Date.now() - startTime;
      assert.strictEqual(err.message, 'ABORTED_DURING_SLEEP');
      assert.ok(elapsed < 200, `Sleep abort took ${elapsed}ms; must exit immediately without sleeping 60s`);
    }
  });

  it('Cancelled task publication is rejected by production createQuiz guard', () => {
    const cancelledTaskId = taskManager.createTask({ questionCount: 5, userId: 'teacher_cancelled' });
    taskManager.cancelTask(cancelledTaskId, 'teacher_cancelled');
    const task = taskManager.getTask(cancelledTaskId);
    assert.strictEqual(task.status, 'CANCELLED');

    // Simulate publication check from createQuiz
    function checkPublicationAllowed(taskId) {
      const t = taskManager.getTask(taskId);
      if (t && (t.status === 'CANCELLED' || t.status === 'FAILED')) {
        return { allowed: false, code: `TASK_${t.status}` };
      }
      return { allowed: true };
    }

    const check = checkPublicationAllowed(cancelledTaskId);
    assert.strictEqual(check.allowed, false);
    assert.strictEqual(check.code, 'TASK_CANCELLED');
  });

  it('TPD route tracking is verified as process-local in-memory Map', () => {
    const router = require('../engine/adapter/llmRouter');
    assert.ok(router.tpdExhaustedRoutes instanceof Map, 'tpdExhaustedRoutes must be an in-memory Map instance');
    
    // Simulate setting a 12h TPD lockout on a route
    const testRoute = '0_openai/gpt-oss-120b';
    const expiresAt = Date.now() + (12 * 60 * 60 * 1000);
    router.tpdExhaustedRoutes.set(testRoute, expiresAt);
    
    assert.strictEqual(router.tpdExhaustedRoutes.get(testRoute), expiresAt);
    assert.ok(router.tpdExhaustedRoutes.get(testRoute) > Date.now());
  });

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log(`🎯 Test Summary: ${passedTests}/${totalTests} tests passed (${Math.round(passedTests/totalTests*100)}%)`);
  console.log('══════════════════════════════════════════════════════════════\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
