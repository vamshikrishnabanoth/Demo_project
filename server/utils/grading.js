/**
 * server/utils/grading.js
 *
 * Shared, authoritative answer grading logic.
 * Eliminates the 3 duplicated copies that previously existed across:
 *   - submit_question_answer (server/index.js)
 *   - submit_new_question   (server/index.js)
 *   - quizController.js
 *
 * Handles three normalisation modes, in priority order:
 *   1. Exact string match (case-insensitive, trimmed)
 *   2. Label match: if correctAnswer is "a"/"b"/"c"/"d"/"e",
 *      compare studentAnswer to the corresponding option at that index
 *   3. Index match: if correctAnswer is a stringified integer ("0","1","2"...),
 *      compare studentAnswer to options[index]
 */

'use strict';

/**
 * Grade a single student answer against a question object.
 *
 * @param {string|null} studentRawAnswer  - raw answer string from the client
 * @param {object}      question          - question object with correctAnswer + options[]
 * @returns {{ isCorrect: boolean, points: number }}
 */
function gradeAnswer(studentRawAnswer, question) {
    const studentAnswer = (studentRawAnswer || '').toString().trim().toLowerCase();
    const correctAnswer = (question.correctAnswer || '').toString().trim().toLowerCase();

    // 1. Exact match
    let isCorrect = studentAnswer === correctAnswer;

    // 2 & 3. Label / index fallback (handles AI-generated labels)
    if (!isCorrect && Array.isArray(question.options)) {
        const labels = ['a', 'b', 'c', 'd', 'e'];
        const labelIdx = labels.indexOf(correctAnswer);

        if (labelIdx !== -1 && question.options[labelIdx]) {
            // Label match: "a" => options[0]
            isCorrect = studentAnswer === question.options[labelIdx].toString().trim().toLowerCase();
        } else if (
            correctAnswer !== '' &&
            !isNaN(correctAnswer) &&
            question.options[parseInt(correctAnswer, 10)]
        ) {
            // Index match: "0" => options[0]
            isCorrect = studentAnswer === question.options[parseInt(correctAnswer, 10)].toString().trim().toLowerCase();
        }
    }

    const points = isCorrect ? (question.points || 10) : 0;
    return { isCorrect, points };
}

/**
 * Resolves raw correctAnswer (which may be a label like "a" or index like "0") 
 * to its actual option text value.
 *
 * @param {object} question - question object containing options and correctAnswer
 * @returns {string} resolved correct option text
 */
function getCorrectOptionText(question) {
    const correctAnswer = (question.correctAnswer || '').toString().trim();
    if (Array.isArray(question.options)) {
        const labels = ['a', 'b', 'c', 'd', 'e'];
        const labelIdx = labels.indexOf(correctAnswer.toLowerCase());
        if (labelIdx !== -1 && question.options[labelIdx]) {
            return question.options[labelIdx].toString().trim();
        } else if (
            correctAnswer !== '' &&
            !isNaN(correctAnswer) &&
            question.options[parseInt(correctAnswer, 10)]
        ) {
            return question.options[parseInt(correctAnswer, 10)].toString().trim();
        }
    }
    return correctAnswer;
}

module.exports = { gradeAnswer, getCorrectOptionText };
