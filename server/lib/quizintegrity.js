/**
 * server/lib/quizIntegrity.js
 *
 * Canonical SHA-256 quiz integrity utility.
 *
 * The hash is computed over ONLY the content that must be frozen:
 *   - questions array (canonically sorted keys, stripped of metadata)
 *   - publishedAt (ISO string)
 *   - createdById (teacher user ID)
 *   - version (integer)
 *
 * Metadata fields (title, timerPerQuestion, assignedGroups, etc.) are
 * intentionally excluded so that benign setting changes do NOT invalidate
 * an already-published hash.
 */

'use strict';

const crypto = require('crypto');

// ── Canonical question shape ──────────────────────────────────────────────────
// Strip all non-content fields so only what students answer against is hashed.
function canonicalizeQuestion(q) {
    return {
        questionText:  (q.questionText  || '').trim(),
        options:       (q.options       || []).map(o => (o || '').trim()).sort(), // sort to be position-independent
        correctAnswer: (q.correctAnswer || '').trim(),
        explanation:   (q.explanation   || '').trim(),
        points:        q.points || 10,
        type:          q.type   || 'multiple-choice',
    };
}

/**
 * Generate a canonical SHA-256 hash for the published quiz payload.
 *
 * @param {object[]} questions  - The frozen questions array
 * @param {string}   publishedAt - ISO date string of when the quiz was published
 * @param {string}   createdById - User ID of the teacher who published
 * @param {number}   version    - Integer version counter
 * @returns {string} Hex-encoded SHA-256 hash
 */
function hashQuiz(questions, publishedAt, createdById, version) {
    if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error('[QuizIntegrity] Cannot hash quiz with no questions');
    }

    const canonical = {
        v:           version || 1,
        publishedAt: publishedAt,
        createdById: createdById,
        questions:   questions.map(canonicalizeQuestion),
    };

    // Deterministic JSON serialization (keys sorted)
    const payload = JSON.stringify(canonical, Object.keys(canonical).sort());

    return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
}

/**
 * Verify that a quiz's stored hash matches a fresh recomputation.
 *
 * @param {object} quiz - Full quiz record from DB (must have questions, quizHash, publishedAt, createdById, version)
 * @returns {{ valid: boolean, computed: string, stored: string }}
 */
function verifyQuizIntegrity(quiz) {
    if (!quiz.isLocked || !quiz.quizHash) {
        // Not yet published — nothing to verify
        return { valid: true, computed: null, stored: null, reason: 'not_locked' };
    }

    try {
        const computed = hashQuiz(
            quiz.questions,
            quiz.publishedAt ? new Date(quiz.publishedAt).toISOString() : '',
            quiz.createdById,
            quiz.version || 1
        );
        const valid = computed === quiz.quizHash;
        return {
            valid,
            computed,
            stored:  quiz.quizHash,
            reason:  valid ? 'ok' : 'mismatch',
        };
    } catch (err) {
        return {
            valid:    false,
            computed: null,
            stored:   quiz.quizHash,
            reason:   `error: ${err.message}`,
        };
    }
}

module.exports = { hashQuiz, verifyQuizIntegrity, canonicalizeQuestion };
