/**
 * server/services/taskManager.js
 *
 * In-memory async task manager for quiz generation jobs.
 * Supports TTL persistence, state tracking, and automatic cleanup.
 *
 * States: RUNNING → COMPLETED | FAILED → EXPIRED (after TTL)
 */

'use strict';

const { randomUUID } = require('crypto');

const TASK_RESULT_TTL_MS = parseInt(process.env.TASK_RESULT_TTL_MS) || 900000; // 15 min
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 min

/** @type {Map<string, Task>} */
const tasks = new Map();

/**
 * @typedef {Object} Task
 * @property {string}  id
 * @property {'RUNNING'|'COMPLETED'|'FAILED'|'EXPIRED'} status
 * @property {number}  stage           0-3 pipeline stage index
 * @property {string}  stageLabel      Human-readable stage label
 * @property {number}  createdAt       Unix ms
 * @property {number}  [completedAt]   Unix ms
 * @property {object}  [result]        Final result payload (questions + agentReport)
 * @property {string}  [error]         Error message if FAILED
 */

/**
 * Create a new task and return its id.
 * @returns {string} taskId
 */
function createTask() {
    const id = randomUUID();
    tasks.set(id, {
        id,
        status: 'RUNNING',
        stage: 0,
        stageLabel: 'Generating Questions',
        createdAt: Date.now(),
    });
    return id;
}

/**
 * Advance the pipeline stage for a running task.
 * @param {string} taskId
 * @param {number} stage  0-3
 * @param {string} label  Human-readable label
 */
function updateTaskStage(taskId, stage, label) {
    const task = tasks.get(taskId);
    if (!task || task.status !== 'RUNNING') return;
    task.stage = stage;
    task.stageLabel = label;
}

/**
 * Mark a task as COMPLETED and store the result payload.
 * @param {string} taskId
 * @param {object} result  { questions, agentReport, title, duration }
 */
function completeTask(taskId, result) {
    const task = tasks.get(taskId);
    if (!task) return;
    task.status = 'COMPLETED';
    task.stage = 3;
    task.stageLabel = 'Preparing Final Quiz';
    task.completedAt = Date.now();
    task.result = result;
}

/**
 * Mark a task as FAILED.
 * @param {string} taskId
 * @param {string} error
 */
function failTask(taskId, error) {
    const task = tasks.get(taskId);
    if (!task) return;
    task.status = 'FAILED';
    task.completedAt = Date.now();
    task.error = error;
}

/**
 * Return the current state of a task (or null if not found / expired).
 * @param {string} taskId
 * @returns {Task|null}
 */
function getTask(taskId) {
    return tasks.get(taskId) || null;
}

// ─── Cleanup: expire & remove old completed/failed tasks ─────────────────────
function runCleanup() {
    const now = Date.now();
    for (const [id, task] of tasks.entries()) {
        if (task.status === 'RUNNING') continue; // never expire in-progress tasks

        const finishedAt = task.completedAt || task.createdAt;
        if (now - finishedAt > TASK_RESULT_TTL_MS) {
            task.status = 'EXPIRED';
            // Keep the entry for one extra cycle so a late poll can still see EXPIRED
            // then delete on the next cycle
        } else if (task.status === 'EXPIRED') {
            tasks.delete(id);
        }
    }
}

// Start periodic cleanup
const _cleanupTimer = setInterval(runCleanup, CLEANUP_INTERVAL_MS);
// Don't block Node exit
if (_cleanupTimer.unref) _cleanupTimer.unref();

module.exports = { createTask, updateTaskStage, completeTask, failTask, getTask };
