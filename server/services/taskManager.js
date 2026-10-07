/**
 * server/services/taskManager.js
 *
 * Production Async Task & Job State Machine Manager.
 * Features:
 *   - Explicit finite state machine: UPLOADED -> VALIDATING -> EXTRACTING -> OCR -> VISION -> CHUNKING -> INDEXING -> RETRIEVING -> GENERATING -> VALIDATING_MCQ -> GROUNDING -> COMPLETED
 *   - Bounded concurrency & backpressure (max concurrent active jobs)
 *   - Hard job timeouts (prevents runaway/stuck background jobs)
 *   - Multi-tenant user authorization checks (userId association)
 *   - Progress percentage tracking
 *   - Idempotency deduplication by hash/key
 *   - Non-blocking TTL garbage collection
 */

'use strict';

const { randomUUID } = require('crypto');
const EventEmitter = require('events');
const providerConfig = require('../config/providerConfig');
const productionMetrics = require('../utils/productionMetrics');

const taskEmitter = new EventEmitter();
taskEmitter.setMaxListeners(500);

const TASK_RESULT_TTL_MS = parseInt(process.env.TASK_RESULT_TTL_MS, 10) || 900000; // 15 min
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 min
const MAX_CONCURRENT_JOBS = providerConfig.queue.maxConcurrentJobs;
const MAX_QUEUE_SIZE = providerConfig.queue.maxQueueSize;
const TOTAL_JOB_TIMEOUT_MS = providerConfig.queue.jobTimeoutMs;

// Explicit Processing States
const TaskStates = {
  UPLOADED: 'UPLOADED',
  VALIDATING: 'VALIDATING',
  EXTRACTING: 'EXTRACTING',
  OCR_PROCESSING: 'OCR_PROCESSING',
  VISION_PROCESSING: 'VISION_PROCESSING',
  CHUNKING: 'CHUNKING',
  INDEXING: 'INDEXING',
  RETRIEVING: 'RETRIEVING',
  GENERATING: 'GENERATING',
  VALIDATING_MCQ: 'VALIDATING_MCQ',
  GROUNDING: 'GROUNDING',
  COMPLETED: 'COMPLETED',

  // Terminal Failure States
  FAILED: 'FAILED',
  FAILED_VALIDATION: 'FAILED_VALIDATION',
  FAILED_EXTRACTION: 'FAILED_EXTRACTION',
  FAILED_OCR: 'FAILED_OCR',
  FAILED_VISION: 'FAILED_VISION',
  FAILED_RETRIEVAL: 'FAILED_RETRIEVAL',
  FAILED_GENERATION: 'FAILED_GENERATION',
  INSUFFICIENT_READABLE_EVIDENCE: 'INSUFFICIENT_READABLE_EVIDENCE',
  TIMEOUT_EXCEEDED: 'TIMEOUT_EXCEEDED',
  FAILED_INTERNAL: 'FAILED_INTERNAL',
  EXPIRED: 'EXPIRED'
};

const STAGE_PROGRESS_MAP = {
  [TaskStates.UPLOADED]: 5,
  [TaskStates.VALIDATING]: 10,
  [TaskStates.EXTRACTING]: 20,
  [TaskStates.OCR_PROCESSING]: 35,
  [TaskStates.VISION_PROCESSING]: 45,
  [TaskStates.CHUNKING]: 55,
  [TaskStates.INDEXING]: 65,
  [TaskStates.RETRIEVING]: 75,
  [TaskStates.GENERATING]: 85,
  [TaskStates.VALIDATING_MCQ]: 92,
  [TaskStates.GROUNDING]: 97,
  [TaskStates.COMPLETED]: 100
};

/** @type {Map<string, Object>} */
const tasks = new Map();

/** @type {Map<string, string>} idempotencyKey -> taskId */
const idempotencyIndex = new Map();

/**
 * Count active RUNNING tasks
 */
function getActiveRunningJobCount() {
  let count = 0;
  for (const t of tasks.values()) {
    if (t.status === 'RUNNING') count++;
  }
  return count;
}

/**
 * Calculate a bounded adaptive watchdog timeout based on workload.
 * Base preparation time (ingestion, evidence packaging, planning) + estimated question generation work.
 * Bounded between min (180s = 3m) and max (360s = 6m).
 */
function calculateAdaptiveTimeoutMs(questionCount = 5) {
  const count = parseInt(questionCount, 10) || 5;
  const basePrepMs = 60000; // 60s for ingestion, audio handling, Agent 1 planning
  const perQuestionMs = 8000; // 8s per question safety allowance with concurrency
  const computed = basePrepMs + (count * perQuestionMs);
  const minTimeoutMs = 180000; // 3 minutes floor
  const maxTimeoutMs = 360000; // 6 minutes hard ceiling to prevent runaway jobs
  return Math.min(maxTimeoutMs, Math.max(minTimeoutMs, computed));
}

/**
 * Create a new task and return its id.
 * Supports backpressure limits, idempotency, and user ownership.
 *
 * @param {Object} options - { userId, idempotencyKey, timeoutMs, questionCount }
 * @returns {string} taskId
 */
function createTask(options = {}) {
  const userId = typeof options === 'string' ? options : (options?.userId || null);
  const idempotencyKey = typeof options === 'object' ? options?.idempotencyKey : null;
  const timeoutMs = (typeof options === 'object' && options?.timeoutMs)
    ? options.timeoutMs
    : (options?.questionCount ? calculateAdaptiveTimeoutMs(options.questionCount) : TOTAL_JOB_TIMEOUT_MS);

  // 1. Idempotency Check: if identical request is currently active or fresh, reuse taskId
  if (idempotencyKey && idempotencyIndex.has(idempotencyKey)) {
    const existingId = idempotencyIndex.get(idempotencyKey);
    const existing = tasks.get(existingId);
    if (existing && (existing.status === 'RUNNING' || existing.status === 'COMPLETED')) {
      if (!userId || existing.userId === userId) {
        return existingId;
      }
    }
  }

  // 2. Backpressure Guard: Reject if active queue capacity exceeded
  const activeCount = getActiveRunningJobCount();
  if (activeCount >= MAX_QUEUE_SIZE) {
    const err = new Error('SYSTEM_BUSY: Document processing queue is currently at maximum capacity. Please retry in a few moments.');
    err.code = 'SYSTEM_BUSY';
    err.statusCode = 429;
    throw err;
  }

  const id = randomUUID();
  const createdAt = Date.now();

  // 3. Hard Timeout watchdog
  const timer = setTimeout(() => {
    const t = tasks.get(id);
    if (t && t.status === 'RUNNING') {
      failTask(id, 'Document processing timed out after ' + Math.round(timeoutMs / 1000) + 's.', 'TIMEOUT_EXCEEDED');
      productionMetrics.inc('documents_failed_total');
    }
  }, timeoutMs);

  if (timer.unref) timer.unref();

  const task = {
    id,
    userId,
    idempotencyKey,
    status: 'RUNNING',
    state: TaskStates.UPLOADED,
    stage: 0,
    stageLabel: 'Ingesting & Analyzing Material',
    progressPct: 5,
    representation_mode: null,
    createdAt,
    timeoutTimer: timer,
    stages: [],
    stageMap: {},
    liveArtifacts: {},
    result: null,
    error: null,
    errorCode: null
  };

  tasks.set(id, task);

  if (idempotencyKey) {
    idempotencyIndex.set(idempotencyKey, id);
  }

  productionMetrics.inc('documents_uploaded_total');
  return id;
}

/**
 * Record a full structured stage event in real-time.
 *
 * @param {string} taskId
 * @param {Object} event - Structured stage record from SessionTrace
 */
function recordTaskStage(taskId, event) {
  const task = tasks.get(taskId);
  if (!task || !event) return;

  if (!task.stages) task.stages = [];
  if (!task.stageMap) task.stageMap = {};
  if (!task.liveArtifacts) task.liveArtifacts = {};

  const stageKey = event.stage || 'STAGE';
  task.stageMap[stageKey] = event;

  // Insert or update in stages array preserving timeline order
  const existingIdx = task.stages.findIndex(s => s.stage === stageKey && (s.stageOrder === event.stageOrder || !s.stageOrder));
  if (existingIdx >= 0) {
    task.stages[existingIdx] = { ...task.stages[existingIdx], ...event };
  } else {
    task.stages.push(event);
  }

  // Live artifact captures for fine-grained frontend display:
  if (event.output) {
    if (stageKey === 'INGESTION') {
      task.liveArtifacts.ingestion = { ...task.liveArtifacts.ingestion, ...event.output, input: event.input };
    } else if (stageKey === 'EVIDENCE_PACKAGE') {
      task.liveArtifacts.evidencePackage = { ...event.output, calculations: event.calculations, decisions: event.decisions };
      if (event.output.representationMode) task.representation_mode = event.output.representationMode;
    } else if (stageKey === 'AGENT_1_PLANNING') {
      task.liveArtifacts.plan = { ...event.output, tcScore: event.calculations, decisions: event.decisions };
    } else if (stageKey === 'QUESTION_GENERATION') {
      task.liveArtifacts.activeGeneration = { targetId: event.input?.targetId, concept: event.input?.concept, tier: event.input?.difficulty, decisions: event.decisions };
    } else if (stageKey === 'AGENT_3_QUESTION_EVAL') {
      if (!task.liveArtifacts.evaluations) task.liveArtifacts.evaluations = [];
      task.liveArtifacts.evaluations.push({ stageOrder: event.stageOrder, decisions: event.decisions, validation: event.validation, timestamp: event.timestamp || Date.now() });
    } else if (stageKey === 'AGENT_3_QUIZ_EVAL') {
      task.liveArtifacts.quizEval = event.output;
    } else if (stageKey === 'FINAL_GROUNDING_GATE') {
      task.liveArtifacts.grounding = event.output;
    }
  }

  taskEmitter.emit(`task:${taskId}`, { type: 'stage', taskId, event });
}

/**
 * Update arbitrary live artifact for a task.
 *
 * @param {string} taskId
 * @param {string} key
 * @param {any} data
 */
function updateTaskArtifact(taskId, key, data) {
  const task = tasks.get(taskId);
  if (!task) return;
  if (!task.liveArtifacts) task.liveArtifacts = {};
  task.liveArtifacts[key] = data;
  taskEmitter.emit(`task:${taskId}`, { type: 'artifact', taskId, key, data });
}

function onTaskEvent(taskId, callback) {
  taskEmitter.on(`task:${taskId}`, callback);
}

function removeTaskListener(taskId, callback) {
  taskEmitter.off(`task:${taskId}`, callback);
}

/**
 * Advance the pipeline stage for a running task.
 *
 * @param {string} taskId
 * @param {number|string} stage - number index (0-7) or TaskState string
 * @param {string} [label] - Human-readable label
 * @param {string} [representationMode] - 'SUMMARY' | 'BLUEPRINT' | 'UNIFIED'
 */
function updateTaskStage(taskId, stage, label, representationMode) {
  const task = tasks.get(taskId);
  if (!task || task.status !== 'RUNNING') return;

  if (typeof stage === 'string' && TaskStates[stage]) {
    task.state = stage;
    task.progressPct = STAGE_PROGRESS_MAP[stage] || task.progressPct;
  } else if (typeof stage === 'number') {
    task.stage = Math.max(task.stage || 0, stage);
    task.progressPct = Math.min(95, Math.round((task.stage / 7) * 90) + 5);
  }

  if (label) {
    task.stageLabel = label;
  }
  if (representationMode) {
    task.representation_mode = representationMode;
  }

  taskEmitter.emit(`task:${taskId}`, {
    type: 'progress',
    taskId,
    stage: task.stage,
    stageLabel: task.stageLabel,
    progressPct: task.progressPct,
    representation_mode: task.representation_mode
  });
}

/**
 * Mark a task as COMPLETED and store the result payload.
 *
 * @param {string} taskId
 * @param {object} result - { questions, agentReport, title, duration }
 */
function completeTask(taskId, result) {
  const task = tasks.get(taskId);
  if (!task) return;

  if (task.timeoutTimer) {
    clearTimeout(task.timeoutTimer);
    task.timeoutTimer = null;
  }

  task.status = 'COMPLETED';
  task.state = TaskStates.COMPLETED;
  task.stage = 7;
  task.progressPct = 100;
  task.stageLabel = 'Completed';
  task.completedAt = Date.now();
  task.result = result;

  const durationMs = task.completedAt - task.createdAt;
  productionMetrics.recordLatency('total_job', durationMs);
  productionMetrics.inc('documents_processed_total');

  if (result?.questions && Array.isArray(result.questions)) {
    productionMetrics.inc('mcqs_generated_total', result.questions.length);
  }

  taskEmitter.emit(`task:${taskId}`, { type: 'completed', taskId, result });
}

/**
 * Mark a task as FAILED with explicit terminal error code.
 *
 * @param {string} taskId
 * @param {string} error - Human-friendly error description
 * @param {string} [errorCode] - Controlled error code (e.g. INSUFFICIENT_READABLE_EVIDENCE)
 */
function failTask(taskId, error, errorCode = 'FAILED_INTERNAL') {
  const task = tasks.get(taskId);
  if (!task) return;

  if (task.timeoutTimer) {
    clearTimeout(task.timeoutTimer);
    task.timeoutTimer = null;
  }

  task.status = 'FAILED';
  task.state = TaskStates[errorCode] || TaskStates.FAILED;
  task.completedAt = Date.now();
  task.error = error;
  task.errorCode = errorCode;

  productionMetrics.inc('documents_failed_total');
  if (errorCode === 'INSUFFICIENT_READABLE_EVIDENCE') {
    productionMetrics.inc('insufficient_evidence_count');
  }

  taskEmitter.emit(`task:${taskId}`, { type: 'failed', taskId, error, errorCode });
}

/**
 * Return the current state of a task (or null if not found / expired).
 * Includes user ownership verification if requestingUserId is provided.
 *
 * @param {string} taskId
 * @param {string} [requestingUserId]
 * @returns {Object|null}
 */
function getTask(taskId, requestingUserId = null) {
  const task = tasks.get(taskId);
  if (!task) return null;

  // Multi-tenant authorization guard
  if (requestingUserId && task.userId && task.userId !== requestingUserId) {
    const authErr = new Error('UNAUTHORIZED_TASK_ACCESS: You do not have permission to view this task.');
    authErr.code = 'FORBIDDEN';
    authErr.statusCode = 403;
    throw authErr;
  }

  return task;
}

// ─── Cleanup: expire & remove old completed/failed tasks ─────────────────────
function runCleanup() {
  const now = Date.now();
  for (const [id, task] of tasks.entries()) {
    if (task.status === 'RUNNING') continue; // never expire in-progress tasks

    const finishedAt = task.completedAt || task.createdAt;
    if (now - finishedAt > TASK_RESULT_TTL_MS) {
      task.status = 'EXPIRED';
      task.state = TaskStates.EXPIRED;
      // Also clean up idempotency entry
      if (task.idempotencyKey) {
        idempotencyIndex.delete(task.idempotencyKey);
      }
    } else if (task.status === 'EXPIRED') {
      tasks.delete(id);
    }
  }
}

// Start periodic cleanup
const _cleanupTimer = setInterval(runCleanup, CLEANUP_INTERVAL_MS);
if (_cleanupTimer.unref) _cleanupTimer.unref();

module.exports = {
  TaskStates,
  createTask,
  updateTaskStage,
  recordTaskStage,
  updateTaskArtifact,
  onTaskEvent,
  removeTaskListener,
  completeTask,
  failTask,
  getTask,
  getActiveRunningJobCount,
  calculateAdaptiveTimeoutMs
};
