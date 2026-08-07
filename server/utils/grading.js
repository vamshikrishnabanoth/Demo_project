/**
 * server/utils/grading.js
 *
 * Universal answer grading engine.
 *
 * Primary Strategy: FULL TEXT STRING COMPARISON
 * The correctAnswer stored in DB is ALWAYS the full option text string.
 * The student submits the full option text string.
 * → Direct string comparison is the primary method.
 *
 * Fallback Strategy: Handle legacy quizzes where correctAnswer might be
 * a label ("A", "B", "C", "D") or a numeric index (0, 1, 2, 3).
 */

'use strict';

/**
 * Resolve the correct option text from a question object.
 * This handles legacy cases where correctAnswer might be:
 *  - Full text: "To find the derivative..." → returns as-is (after matching to options)
 *  - Label: "A", "B", "C", "D" → resolves to options[0], options[1], etc.
 *  - Numeric index: "0", "1", "2", "3" → resolves to options[n]
 *
 * @param {object|string} questionOrRaw - Question object or raw correct answer string
 * @param {string[]} [optionsInput] - Options array (if passing raw string)
 * @returns {string} Resolved full text of the correct option
 */
function resolveCorrectOptionText(questionOrRaw, optionsInput) {
    let question = {};
    let options = [];

    if (Array.isArray(optionsInput)) {
        options = optionsInput.map(o => typeof o === 'string' ? o.trim() : (o?.text || o?.label || String(o)).trim());
        if (typeof questionOrRaw === 'object' && questionOrRaw !== null) {
            question = questionOrRaw;
        } else {
            question = { correctAnswer: questionOrRaw, options };
        }
    } else if (typeof questionOrRaw === 'object' && questionOrRaw !== null) {
        question = questionOrRaw;
        options = (question.options || []).map(o => typeof o === 'string' ? o.trim() : (o?.text || o?.label || String(o)).trim());
    } else {
        question = { correctAnswer: questionOrRaw };
    }

    const rawCorrect = (
        question.correctAnswer ||
        question.correct_answer ||
        question.correct_ans ||
        question.answer ||
        ''
    ).toString().trim();

    if (!rawCorrect) {
        // No correct answer specified — return empty string (will never match)
        return '';
    }

    if (options.length === 0) {
        return rawCorrect;
    }

    // 1. Direct exact match (case-insensitive)
    const exactMatch = options.find(o => o.toLowerCase() === rawCorrect.toLowerCase());
    if (exactMatch) return exactMatch;

    // 2. Normalized match (ignoring extra spaces & punctuation)
    const cleanRaw = rawCorrect.toLowerCase().replace(/[\s\W]+/g, '');
    if (cleanRaw) {
        const cleanMatch = options.find(o => o.toLowerCase().replace(/[\s\W]+/g, '') === cleanRaw);
        if (cleanMatch) return cleanMatch;
    }

    // 3. Label match: "A", "B", "C", "D", "a", "b"...
    const labels = ['a', 'b', 'c', 'd', 'e', 'f'];
    const cleanedLabel = rawCorrect.toLowerCase()
        .replace(/^(option|choice|answer|select)\s*/i, '')
        .replace(/[.\s:]/g, '');

    const labelIdx = labels.indexOf(cleanedLabel);
    if (labelIdx !== -1 && options[labelIdx] !== undefined) {
        return options[labelIdx];
    }

    // 4. Numeric index (0-based): "0", "1", "2", "3"
    if (/^\d+$/.test(cleanedLabel)) {
        const num = parseInt(cleanedLabel, 10);
        if (num >= 0 && num < options.length) {
            return options[num];
        }
        // 1-based fallback
        if (num >= 1 && num <= options.length) {
            return options[num - 1];
        }
    }

    // 5. correctOption / correct_option field (integer index)
    const idxField = question.correct_option !== undefined ? question.correct_option : question.correctOption;
    if (idxField !== undefined && idxField !== null) {
        const num = parseInt(idxField, 10);
        if (!isNaN(num) && num >= 0 && num < options.length) {
            return options[num];
        }
    }

    // No match found — return the raw value as-is (better than guessing options[0])
    return rawCorrect;
}

/**
 * Grade a student's answer against a question.
 *
 * Primary method: Direct string comparison between student's answer and correctAnswer.
 * The correctAnswer in DB is always stored as the full option text.
 * The student submits the full option text they clicked.
 *
 * @param {string} studentRawAnswer - The answer text the student submitted
 * @param {object} question - The question object from DB
 * @returns {{ isCorrect: boolean, points: number, resolvedCorrect: string }}
 */
function gradeAnswer(studentRawAnswer, question) {
    if (!question) return { isCorrect: false, points: 0, resolvedCorrect: '' };

    const studentStr = (studentRawAnswer || '').toString().trim();
    const studentLower = studentStr.toLowerCase();

    if (!studentStr) {
        // Empty answer — always wrong
        const resolvedCorrect = resolveCorrectOptionText(question);
        return { isCorrect: false, points: 0, resolvedCorrect };
    }

    const rawOptions = Array.isArray(question.options) ? question.options : [];
    const normOptions = rawOptions.map(o => (typeof o === 'string' ? o : (o?.text || o?.label || String(o))).trim());

    // Resolve the authoritative correct answer text
    const resolvedCorrect = resolveCorrectOptionText(question);
    const resolvedLower = resolvedCorrect.toLowerCase();

    let isCorrect = false;

    // Layer 1: Direct text comparison (case-insensitive)
    if (studentLower === resolvedLower) {
        isCorrect = true;
    }

    // Layer 2: Normalized comparison (ignore spaces & punctuation) for typos/encoding issues
    if (!isCorrect) {
        const studentClean = studentLower.replace(/[\s\W]+/g, '');
        const resolvedClean = resolvedLower.replace(/[\s\W]+/g, '');
        if (studentClean && resolvedClean && studentClean === resolvedClean) {
            isCorrect = true;
        }
    }

    // Layer 3: Check raw DB fields directly (handles legacy correctAnswer formats)
    if (!isCorrect) {
        const rawCandidates = [
            question.correctAnswer,
            question.correct_answer,
            question.correct_ans,
            question.answer
        ].filter(Boolean).map(c => c.toString().trim().toLowerCase());

        if (rawCandidates.some(c => c === studentLower)) {
            isCorrect = true;
        }
    }

    // Layer 4: Label/Index — student sent "A", "B", "C", "D" or "0", "1", "2", "3"
    if (!isCorrect && normOptions.length > 0) {
        const labels = ['a', 'b', 'c', 'd', 'e', 'f'];
        const studentCleanedLabel = studentLower
            .replace(/^(option|choice|answer|select)\s*/i, '')
            .replace(/[.\s:]/g, '');
        const labelIdx = labels.indexOf(studentCleanedLabel);
        if (labelIdx !== -1 && normOptions[labelIdx] !== undefined) {
            if (normOptions[labelIdx].toLowerCase() === resolvedLower) {
                isCorrect = true;
            }
        } else if (/^\d+$/.test(studentCleanedLabel)) {
            const num = parseInt(studentCleanedLabel, 10);
            const targetOpt = normOptions[num] || normOptions[num - 1];
            if (targetOpt && targetOpt.toLowerCase() === resolvedLower) {
                isCorrect = true;
            }
        }
    }

    // Layer 5: correct_option index match — if student selected option at correct index
    if (!isCorrect && normOptions.length > 0) {
        const optIdxCandidate = question.correct_option !== undefined ? question.correct_option : question.correctOption;
        if (optIdxCandidate !== undefined && optIdxCandidate !== null) {
            let targetIdx = -1;
            if (typeof optIdxCandidate === 'number') targetIdx = optIdxCandidate;
            else if (!isNaN(optIdxCandidate)) targetIdx = parseInt(optIdxCandidate, 10);
            else if (typeof optIdxCandidate === 'string') {
                const labels = ['a', 'b', 'c', 'd', 'e', 'f'];
                targetIdx = labels.indexOf(optIdxCandidate.trim().toLowerCase());
            }
            if (targetIdx >= 0 && targetIdx < normOptions.length) {
                const targetText = normOptions[targetIdx].toLowerCase();
                if (studentLower === targetText || studentLower.replace(/[\s\W]+/g, '') === targetText.replace(/[\s\W]+/g, '')) {
                    isCorrect = true;
                }
            }
        }
    }

    const points = isCorrect ? (question.points || 10) : 0;
    return { isCorrect, points, resolvedCorrect };
}

module.exports = { gradeAnswer, resolveCorrectOptionText };
