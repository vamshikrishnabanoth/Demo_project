/**
 * server/utils/grading.js
 *
 * Shared, authoritative answer grading logic.
 * Resolves AI-generated labels ("Option A", "Option 1", "A.", "b", "1") to actual text strings.
 */

'use strict';

function resolveCorrectOptionText(rawCorrectInput, optionsInput) {
    if (!Array.isArray(optionsInput) || optionsInput.length === 0) {
        return (rawCorrectInput || '').toString().trim();
    }
    
    const options = optionsInput.map(o => typeof o === 'string' ? o.trim() : (o?.text || o?.label || String(o)).trim());
    const raw = (rawCorrectInput || '').toString().trim();
    if (!raw) return options[0] || '';

    const rawLower = raw.toLowerCase();

    // 1. Direct exact match with one of the options
    const exactMatch = options.find(o => o.toLowerCase() === rawLower);
    if (exactMatch) return exactMatch;

    // 2. Substring match: option contains raw or raw contains option
    const subMatch = options.find(o => o.toLowerCase().includes(rawLower) || rawLower.includes(o.toLowerCase()));
    if (subMatch) return subMatch;

    // 3. Extract label/index: "Option A", "Option 1", "A.", "Choice A", "1."
    const cleaned = rawLower
        .replace(/^(option|choice|answer|select)\s*/i, '')
        .replace(/[\.\s:]/g, '');

    const labels = ['a', 'b', 'c', 'd', 'e'];
    const labelIdx = labels.indexOf(cleaned);
    if (labelIdx !== -1 && options[labelIdx]) {
        return options[labelIdx];
    }

    // 4. Numeric index (1-based or 0-based): "1", "2", "3", "4" or "0"
    if (!isNaN(cleaned) && cleaned !== '') {
        const num = parseInt(cleaned, 10);
        if (num >= 0 && num < options.length) {
            return options[num];
        } else if (num >= 1 && num <= options.length) {
            return options[num - 1];
        }
    }

    return raw;
}

function gradeAnswer(studentRawAnswer, question) {
    if (!question) return { isCorrect: false, points: 0, resolvedCorrect: '' };

    const studentAnswer = (studentRawAnswer || '').toString().trim().toLowerCase();
    const rawCorrect = (question.correctAnswer || question.correct_answer || question.correct_ans || '').toString().trim();
    const rawOptions = Array.isArray(question.options) ? question.options : [];

    const resolvedCorrect = resolveCorrectOptionText(rawCorrect, rawOptions);
    const resolvedLower = resolvedCorrect.toLowerCase();

    // 1. Check if studentAnswer matches resolved correct option or raw correct
    let isCorrect = (studentAnswer === resolvedLower) || (studentAnswer === rawCorrect.toLowerCase());

    // 2. Check if studentAnswer matches ANY option that IS the resolved correct option
    if (!isCorrect && rawOptions.length > 0) {
        const normOptions = rawOptions.map(o => (typeof o === 'string' ? o : (o?.text || String(o))).trim().toLowerCase());
        isCorrect = normOptions.some(opt => opt === studentAnswer && (opt === resolvedLower || opt === rawCorrect.toLowerCase()));
    }

    const points = isCorrect ? (question.points || 10) : 0;
    return { isCorrect, points, resolvedCorrect };
}

module.exports = { gradeAnswer, resolveCorrectOptionText };
