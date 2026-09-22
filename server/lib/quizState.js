'use strict';
/**
 * quizState.js — Authoritative In-Memory Quiz State Engine
 *
 * PURPOSE:
 *   Provides a single source of truth for all active quiz sessions.
 *   Students' answers are validated, graded, and scored entirely in memory.
 *   PostgreSQL is updated asynchronously via a controlled write buffer.
 *
 * ARCHITECTURE:
 *   WebSocket event → quizState (grade/update) → immediate WS response
 *                                              ↘ write buffer → DB flush (async)
 *
 * KEY GUARANTEES:
 *   - Zero DB reads during answer submission (quiz pre-loaded at start_quiz)
 *   - Zero DB writes blocking the WebSocket handler
 *   - Deduplication: latest-state coalescing per student (Map overwrite)
 *   - Bounded concurrency: max FLUSH_CONCURRENCY concurrent DB writes
 *   - Retry with exponential backoff on write failure
 *   - Drain on quiz end: all pending writes flushed before finalization
 *   - Backpressure: buffer capped at MAX_BUFFER_SIZE per quiz
 *
 * DATA LOSS WINDOW:
 *   If the process crashes, answers submitted in the last FLUSH_INTERVAL_MS
 *   (default 2000ms) that have not been flushed yet are lost.
 *   This is minimized by: small flush interval + drain on quiz end.
 */

const prisma = require('./prisma');

// ─── Tuning Constants ─────────────────────────────────────────────────────────
const FLUSH_INTERVAL_MS  = 2000;   // Flush write buffer every 2 seconds
const FLUSH_CONCURRENCY  = 3;      // Max simultaneous DB write operations
const MAX_RETRIES        = 3;      // Max retry attempts per failed write
const RETRY_BASE_MS      = 500;    // Base delay for exponential backoff
const MAX_BUFFER_SIZE    = 5000;   // Safety cap: total pending writes across all quizzes
const DRAIN_TIMEOUT_MS   = 12000;  // Max time to drain buffer on quiz end
const LEADERBOARD_THROTTLE_MS = 400; // Min ms between full leaderboard broadcasts per quiz

// ─── In-Memory Quiz State Store ───────────────────────────────────────────────
// Map<quizId, QuizMemoryState>
const quizStore = new Map();

// ─── Write Buffer ─────────────────────────────────────────────────────────────
// Map<`${quizId}:${studentId}`, WriteEntry>
// Latest-state coalescing: each write overwrites the previous one for the same key.
const writeBuffer = new Map();

// Track total pending entries to enforce MAX_BUFFER_SIZE
let totalPending = 0;

// ─── PIN → Quiz ID Resolution Cache ──────────────────────────────────────────
// Map<joinCode, quizId>  — populated at start_quiz; avoids DB lookups for heartbeats
const pinToQuizId = new Map();

// ─── Last Leaderboard Broadcast Timestamps ───────────────────────────────────
// Map<quizId, number>  — used to throttle broadcasts
const lastBroadcastAt = new Map();

// ─── Flush Worker State ───────────────────────────────────────────────────────
let flushTimer = null;
let isFlushRunning = false;

/**
 * @typedef {Object} StudentState
 * @property {string}   studentId
 * @property {string}   username
 * @property {number}   score
 * @property {number}   totalTimeTaken
 * @property {Object[]} answers          — array of answer records
 * @property {Date}     lastAnsweredAt
 * @property {Set<number>} answeredQuestions — question indices already answered
 */

/**
 * @typedef {Object} QuizMemoryState
 * @property {string}   quizId
 * @property {Object}   quiz             — full quiz object from DB (frozen after load)
 * @property {string}   status           — 'waiting' | 'started' | 'finishing' | 'finished'
 * @property {number}   currentQuestion
 * @property {number|null} endTime       — ms timestamp
 * @property {Map<string, StudentState>} students
 * @property {Object}   progress         — legacy-compat: { [studentId]: { [qIdx]: {...} } }
 * @property {Array}    cheatAlerts
 * @property {boolean}  accepting        — false when quiz is being finalized
 * @property {Set}      inFlight         — set of studentIds currently being processed
 */

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Initialize in-memory state for a quiz that is about to start.
 * Call this from start_quiz BEFORE broadcasting quiz_started.
 *
 * @param {string} quizId
 * @param {Object} quiz    — full quiz row from DB
 * @param {Object} opts    — { currentQuestion?, endTime?, status? }
 */
function initQuiz(quizId, quiz, opts = {}) {
    const existing = quizStore.get(quizId);
    if (existing && existing.status === 'started') {
        // Already running — update quiz object (e.g. if questions changed)
        existing.quiz = quiz;
        return;
    }

    const state = {
        quizId,
        quiz,                          // Frozen quiz data — never trust client
        status: opts.status || 'started',
        currentQuestion: opts.currentQuestion ?? 0,
        endTime: opts.endTime ?? null,
        students: new Map(),           // Map<studentId, StudentState>
        progress: {},                  // Legacy compat for teacher dashboard
        cheatAlerts: [],
        accepting: true,               // Set to false during finalization
        inFlight: new Set(),           // Student IDs currently being processed
    };

    quizStore.set(quizId, state);

    // Cache PIN → quizId mapping
    if (quiz.joinCode) {
        pinToQuizId.set(quiz.joinCode, quizId);
    }

    console.log(`[QuizState] Initialized quiz ${quizId} (${quiz.title || 'untitled'}), questions: ${Array.isArray(quiz.questions) ? quiz.questions.length : 0}`);
}

/**
 * Get the full in-memory state for a quiz. Returns null if not found.
 * @param {string} quizId
 * @returns {QuizMemoryState|null}
 */
function getQuizState(quizId) {
    return quizStore.get(quizId) || null;
}

/**
 * Resolve a PIN (join code) or quiz UUID to a quiz UUID using the in-memory cache.
 * Returns the input unchanged if no mapping is found (caller should do DB lookup as fallback).
 * @param {string} idOrPin
 * @returns {string}
 */
function resolveQuizId(idOrPin) {
    return pinToQuizId.get(idOrPin) || idOrPin;
}

/**
 * Register a PIN → quizId mapping (e.g. when student joins before teacher starts).
 * @param {string} pin
 * @param {string} quizId
 */
function registerPin(pin, quizId) {
    if (pin) pinToQuizId.set(pin, quizId);
}

/**
 * Process an answer submission entirely in memory.
 *
 * Returns an object with the result, leaderboard delta, and metadata.
 * Queues the write asynchronously.
 * This function is SYNCHRONOUS (no await) to keep it off the event loop.
 *
 * @param {Object} params
 * @param {string} params.quizId
 * @param {string} params.studentId
 * @param {string} params.username
 * @param {number} params.questionIndex
 * @param {string} params.answer
 * @param {number} params.qTimeTaken
 * @param {Function} params.gradeAnswer  — grading function (passed in to avoid circular dep)
 * @returns {{ accepted: boolean, reason?: string, isCorrect?: boolean, points?: number,
 *             updatedScore?: number, updatedTime?: number, updatedAnswers?: Array,
 *             leaderboardEntry?: Object, resolvedCorrect?: string }}
 */
function processAnswer({ quizId, studentId, username, questionIndex, answer, qTimeTaken, gradeAnswer }) {
    const state = quizStore.get(quizId);
    if (!state) {
        return { accepted: false, reason: 'quiz_not_found' };
    }
    if (!state.accepting) {
        return { accepted: false, reason: 'quiz_ended' };
    }
    if (state.status !== 'started') {
        return { accepted: false, reason: 'quiz_not_active' };
    }

    // Idempotency check — O(1) using Set on per-student object
    let student = state.students.get(studentId);
    if (!student) {
        student = {
            studentId,
            username: username || studentId,
            score: 0,
            totalTimeTaken: 0,
            answers: [],
            lastAnsweredAt: new Date(),
            answeredQuestions: new Set(),
        };
        state.students.set(studentId, student);
    }

    if (student.answeredQuestions.has(questionIndex)) {
        return { accepted: false, reason: 'duplicate' };
    }

    // Mark as answered immediately (before grading) to block concurrent duplicates
    student.answeredQuestions.add(questionIndex);
    // Also mark in legacy progress for teacher dashboard compat
    if (!state.progress[studentId]) state.progress[studentId] = {};

    // Grade the answer
    const questions = Array.isArray(state.quiz.questions) ? state.quiz.questions : [];
    const question = questions[questionIndex];
    if (!question) {
        // Unknown question — mark wrong but accept
        state.progress[studentId][questionIndex] = { answered: true, isCorrect: false, timeTaken: qTimeTaken, selectedOption: answer };
        return { accepted: true, isCorrect: false, points: 0, updatedScore: student.score, updatedTime: student.totalTimeTaken };
    }

    const { isCorrect, points, resolvedCorrect } = gradeAnswer(answer, question);

    // Update student state (mutate in place — no cloning)
    student.score         += points;
    student.totalTimeTaken += qTimeTaken;
    student.lastAnsweredAt = new Date();

    const answerRecord = {
        questionIndex,
        questionText:   question.questionText,
        selectedOption: answer,
        correctOption:  resolvedCorrect,
        isCorrect,
        timeTaken:      qTimeTaken,
    };
    student.answers.push(answerRecord);

    // Update legacy progress map (teacher dashboard compatibility)
    state.progress[studentId][questionIndex] = { answered: true, isCorrect, timeTaken: qTimeTaken, selectedOption: answer };

    // Build leaderboard entry (lightweight object, no full sort here)
    const leaderboardEntry = {
        studentId,
        username:          student.username,
        currentScore:      student.score,
        totalTimeTaken:    student.totalTimeTaken,
        lastAnsweredAt:    student.lastAnsweredAt,
        answeredQuestions: student.answers.length,
    };

    // Queue the write (coalescing: overwrites any previous pending write for this student)
    _queueWrite(quizId, studentId, {
        score:           student.score,
        totalTimeTaken:  student.totalTimeTaken,
        answers:         student.answers,    // reference — snapshot taken at flush time
        lastAnsweredAt:  student.lastAnsweredAt,
        totalQuestions:  questions.length,
        username:        student.username,
    });

    return {
        accepted:       true,
        isCorrect,
        points,
        updatedScore:   student.score,
        updatedTime:    student.totalTimeTaken,
        updatedAnswers: student.answers,
        leaderboardEntry,
        resolvedCorrect,
        answerRecord,
    };
}

/**
 * Get the current sorted leaderboard from in-memory state.
 * Only call this when you need the full sorted list (e.g. leaderboard broadcast).
 * @param {string} quizId
 * @returns {Array}
 */
function getLeaderboard(quizId) {
    const state = quizStore.get(quizId);
    if (!state) return [];

    const entries = [];
    for (const student of state.students.values()) {
        entries.push({
            studentId:         student.studentId,
            username:          student.username,
            currentScore:      student.score,
            totalTimeTaken:    student.totalTimeTaken,
            lastAnsweredAt:    student.lastAnsweredAt,
            answeredQuestions: student.answers.length,
        });
    }

    entries.sort((a, b) => {
        if (b.currentScore !== a.currentScore) return b.currentScore - a.currentScore;
        if (a.totalTimeTaken !== b.totalTimeTaken) return a.totalTimeTaken - b.totalTimeTaken;
        return new Date(a.lastAnsweredAt) - new Date(b.lastAnsweredAt);
    });

    return entries.map((e, i) => ({ ...e, rank: i + 1 }));
}

/**
 * Check if we should broadcast the leaderboard now (throttle control).
 * Returns true and updates timestamp if enough time has passed.
 * @param {string} quizId
 * @returns {boolean}
 */
function shouldBroadcastLeaderboard(quizId) {
    const now = Date.now();
    const last = lastBroadcastAt.get(quizId) || 0;
    if (now - last >= LEADERBOARD_THROTTLE_MS) {
        lastBroadcastAt.set(quizId, now);
        return true;
    }
    return false;
}

/**
 * Force a leaderboard broadcast on next call (e.g. after quiz end).
 * @param {string} quizId
 */
function forceLeaderboardBroadcast(quizId) {
    lastBroadcastAt.delete(quizId);
}

/**
 * Update room state fields (currentQuestion, endTime, status, etc.).
 * Merges with existing state.
 * @param {string} quizId
 * @param {Object} updates
 */
function updateQuizState(quizId, updates) {
    const state = quizStore.get(quizId);
    if (state) {
        Object.assign(state, updates);
    }
}

/**
 * Stop accepting new answers for a quiz.
 * Called at the start of end_quiz to prevent new submissions racing with finalization.
 * @param {string} quizId
 */
function closeQuiz(quizId) {
    const state = quizStore.get(quizId);
    if (state) {
        state.accepting = false;
        state.status = 'finishing';
    }
}

/**
 * Wait for all in-flight answer processings to complete.
 * Since processAnswer() is synchronous, this only guards any lingering async work.
 * @param {string} quizId
 * @param {number} [maxWaitMs=1000]
 */
async function waitForInFlight(quizId, maxWaitMs = 1000) {
    const state = quizStore.get(quizId);
    if (!state || state.inFlight.size === 0) return;

    const deadline = Date.now() + maxWaitMs;
    while (state.inFlight.size > 0 && Date.now() < deadline) {
        await _sleep(50);
    }
}

/**
 * Drain all pending writes for a quiz to DB. Waits until complete or timeout.
 * Call this during quiz end BEFORE finalizing results.
 * @param {string} quizId
 * @param {number} [timeoutMs=DRAIN_TIMEOUT_MS]
 */
async function drainWrites(quizId, timeoutMs = DRAIN_TIMEOUT_MS) {
    const deadline = Date.now() + timeoutMs;
    let attempt = 0;

    // Get all pending keys for this quiz
    const pendingKeys = [];
    for (const key of writeBuffer.keys()) {
        if (key.startsWith(`${quizId}:`)) pendingKeys.push(key);
    }

    if (pendingKeys.length === 0) {
        console.log(`[QuizState] No pending writes to drain for quiz ${quizId}`);
        return { flushed: 0, failed: 0 };
    }

    console.log(`[QuizState] Draining ${pendingKeys.length} writes for quiz ${quizId}...`);

    let flushed = 0;
    let failed  = 0;

    // Process in bounded concurrent batches until empty or timeout
    while (Date.now() < deadline) {
        const batchKeys = [];
        for (const key of writeBuffer.keys()) {
            if (key.startsWith(`${quizId}:`)) {
                batchKeys.push(key);
                if (batchKeys.length >= FLUSH_CONCURRENCY * 2) break;
            }
        }
        if (batchKeys.length === 0) break;

        const results = await _executeBatch(batchKeys);
        flushed += results.flushed;
        failed  += results.failed;
        attempt++;

        if (Date.now() >= deadline) {
            console.warn(`[QuizState] Drain timeout for quiz ${quizId} after ${attempt} rounds. Failed: ${failed}`);
            break;
        }
    }

    console.log(`[QuizState] Drain complete for quiz ${quizId}: flushed=${flushed}, failed=${failed}`);
    return { flushed, failed };
}

/**
 * Get all student states for a quiz (for finalization/leaderboard building).
 * @param {string} quizId
 * @returns {StudentState[]}
 */
function getAllStudentStates(quizId) {
    const state = quizStore.get(quizId);
    if (!state) return [];
    return Array.from(state.students.values());
}

/**
 * Get student state for a specific student.
 * @param {string} quizId
 * @param {string} studentId
 * @returns {StudentState|null}
 */
function getStudentState(quizId, studentId) {
    const state = quizStore.get(quizId);
    if (!state) return null;
    return state.students.get(studentId) || null;
}

/**
 * Clean up all in-memory state for a quiz after finalization.
 * @param {string} quizId
 */
function cleanupQuiz(quizId) {
    const state = quizStore.get(quizId);
    if (state && state.quiz?.joinCode) {
        pinToQuizId.delete(state.quiz.joinCode);
    }
    quizStore.delete(quizId);
    lastBroadcastAt.delete(quizId);
    // Clean up any remaining buffer entries
    for (const key of writeBuffer.keys()) {
        if (key.startsWith(`${quizId}:`)) {
            writeBuffer.delete(key);
            totalPending = Math.max(0, totalPending - 1);
        }
    }
    console.log(`[QuizState] Cleaned up memory for quiz ${quizId}`);
}

/**
 * Add a cheat alert to in-memory state.
 * @param {string} quizId
 * @param {Object} alert
 */
function addCheatAlert(quizId, alert) {
    const state = quizStore.get(quizId);
    if (state) {
        state.cheatAlerts.push(alert);
    }
}

/**
 * Get the legacy-format progress object for teacher dashboard compatibility.
 * @param {string} quizId
 * @returns {Object}
 */
function getProgress(quizId) {
    const state = quizStore.get(quizId);
    return state ? state.progress : {};
}

// ─── Write Buffer Internals ───────────────────────────────────────────────────

/**
 * Queue a persistence write. Coalesces multiple writes for the same student
 * into a single write (latest state wins).
 */
function _queueWrite(quizId, studentId, data) {
    if (totalPending >= MAX_BUFFER_SIZE) {
        console.warn(`[QuizState] Write buffer at capacity (${MAX_BUFFER_SIZE}). Dropping write for ${studentId} in quiz ${quizId}.`);
        return;
    }

    const key = `${quizId}:${studentId}`;
    const isNew = !writeBuffer.has(key);
    writeBuffer.set(key, {
        quizId,
        studentId,
        // Snapshot the answers array at queue time (slice creates a shallow copy of refs)
        data: { ...data, answers: data.answers.slice() },
        retries: 0,
        queuedAt: Date.now(),
    });

    if (isNew) totalPending++;
}

/**
 * Execute a batch of writes with bounded concurrency.
 * @param {string[]} keys
 * @returns {{ flushed: number, failed: number }}
 */
async function _executeBatch(keys) {
    let flushed = 0;
    let failed  = 0;

    // Process in chunks of FLUSH_CONCURRENCY to limit concurrent DB connections
    for (let i = 0; i < keys.length; i += FLUSH_CONCURRENCY) {
        const chunk = keys.slice(i, i + FLUSH_CONCURRENCY);
        await Promise.all(chunk.map(async (key) => {
            const entry = writeBuffer.get(key);
            if (!entry) return; // Already removed by a concurrent flush

            try {
                await _persistEntry(entry);
                writeBuffer.delete(key);
                totalPending = Math.max(0, totalPending - 1);
                flushed++;
            } catch (err) {
                if (entry.retries < MAX_RETRIES) {
                    entry.retries++;
                    const backoffMs = RETRY_BASE_MS * Math.pow(2, entry.retries - 1);
                    console.warn(`[QuizState] Write failed for ${entry.studentId} (retry ${entry.retries}/${MAX_RETRIES}): ${err.message}. Retrying in ${backoffMs}ms`);
                    // Re-schedule: leave in buffer, will retry on next flush
                    // (entry already back in writeBuffer since we didn't delete it)
                } else {
                    console.error(`[QuizState] Write permanently failed for ${entry.studentId} after ${MAX_RETRIES} retries: ${err.message}`);
                    writeBuffer.delete(key);
                    totalPending = Math.max(0, totalPending - 1);
                    failed++;
                }
            }
        }));
    }

    return { flushed, failed };
}

/**
 * Persist a single student's result to PostgreSQL via upsert.
 * @param {Object} entry — { quizId, studentId, data: { score, totalTimeTaken, answers, ... } }
 */
async function _persistEntry(entry) {
    const { quizId, studentId, data } = entry;

    await prisma.result.upsert({
        where: { quizId_studentId: { quizId, studentId } },
        update: {
            score:          data.score,
            totalTimeTaken: data.totalTimeTaken,
            answers:        data.answers,
            status:         'in-progress',
            lastAnsweredAt: data.lastAnsweredAt || new Date(),
        },
        create: {
            quizId,
            studentId,
            score:          data.score,
            totalTimeTaken: data.totalTimeTaken,
            totalQuestions: data.totalQuestions || 0,
            answers:        data.answers,
            status:         'in-progress',
            lastAnsweredAt: data.lastAnsweredAt || new Date(),
        },
    });
}

/**
 * Background flush worker: runs every FLUSH_INTERVAL_MS.
 * Snapshots the current buffer and flushes in bounded batches.
 */
async function _flush() {
    if (isFlushRunning || writeBuffer.size === 0) return;
    isFlushRunning = true;

    try {
        // Snapshot keys to process in this tick
        const keys = Array.from(writeBuffer.keys());
        if (keys.length === 0) return;

        await _executeBatch(keys);
    } catch (err) {
        console.error('[QuizState] Flush worker error:', err.message);
    } finally {
        isFlushRunning = false;
    }
}

/**
 * Start the background flush worker.
 */
function startFlushWorker() {
    if (flushTimer) return;
    flushTimer = setInterval(_flush, FLUSH_INTERVAL_MS);
    console.log(`[QuizState] Persistence flush worker started (interval: ${FLUSH_INTERVAL_MS}ms, concurrency: ${FLUSH_CONCURRENCY})`);
}

/**
 * Stop the background flush worker and drain all remaining writes.
 * Call on graceful server shutdown.
 */
async function shutdown() {
    if (flushTimer) {
        clearInterval(flushTimer);
        flushTimer = null;
    }
    if (writeBuffer.size > 0) {
        console.log(`[QuizState] Shutdown: draining ${writeBuffer.size} pending writes...`);
        const keys = Array.from(writeBuffer.keys());
        await _executeBatch(keys);
        console.log('[QuizState] Shutdown drain complete.');
    }
}

/**
 * Get diagnostic stats for monitoring/health endpoints.
 */
function getStats() {
    return {
        activeQuizzes:   quizStore.size,
        pendingWrites:   totalPending,
        bufferSize:      writeBuffer.size,
        pinMappings:     pinToQuizId.size,
        flushRunning:    isFlushRunning,
    };
}

// ─── Utility ─────────────────────────────────────────────────────────────────
function _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Auto-start flush worker when module is loaded ────────────────────────────
startFlushWorker();

// ─── Graceful shutdown hook ───────────────────────────────────────────────────
process.on('SIGTERM', async () => {
    console.log('[QuizState] SIGTERM received — draining write buffer...');
    await shutdown();
});
process.on('SIGINT', async () => {
    console.log('[QuizState] SIGINT received — draining write buffer...');
    await shutdown();
});

// ─── Exports ─────────────────────────────────────────────────────────────────
module.exports = {
    // Quiz lifecycle
    initQuiz,
    getQuizState,
    updateQuizState,
    closeQuiz,
    cleanupQuiz,

    // Answer processing (hot path — synchronous)
    processAnswer,

    // Leaderboard
    getLeaderboard,
    shouldBroadcastLeaderboard,
    forceLeaderboardBroadcast,

    // Student access
    getStudentState,
    getAllStudentStates,

    // PIN resolution
    resolveQuizId,
    registerPin,

    // Quiz end support
    waitForInFlight,
    drainWrites,

    // Legacy compat
    getProgress,
    addCheatAlert,

    // Diagnostics
    getStats,

    // Shutdown (for tests and graceful restart)
    shutdown,
    startFlushWorker,

    // Exposed for testing
    _writeBuffer: writeBuffer,
    _quizStore:   quizStore,
};
