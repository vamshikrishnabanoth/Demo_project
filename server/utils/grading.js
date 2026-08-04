/**
 * server/utils/grading.js
 *
 * Universal, ultra-resilient answer grading engine.
 * Supports:
 * - Direct option text string matching
 * - Punctuation/whitespace-insensitive text matching
 * - AI label resolution ("Option A", "Option 1", "A.", "b", "1")
 * - Direct index matching (correct_option / correctOption 0-3)
 * - Shuffled option string matching
 */

'use strict';

function resolveCorrectOptionText(questionOrRawCorrect, optionsInput) {
    let question = {};
    let options = [];

    if (Array.isArray(optionsInput)) {
        options = optionsInput.map(o => typeof o === 'string' ? o.trim() : (o?.text || o?.label || String(o)).trim());
        if (typeof questionOrRawCorrect === 'object' && questionOrRawCorrect !== null) {
            question = questionOrRawCorrect;
        } else {
            question = { correctAnswer: questionOrRawCorrect, options };
        }
    } else if (typeof questionOrRawCorrect === 'object' && questionOrRawCorrect !== null) {
        question = questionOrRawCorrect;
        options = (question.options || []).map(o => typeof o === 'string' ? o.trim() : (o?.text || o?.label || String(o)).trim());
    } else {
        question = { correctAnswer: questionOrRawCorrect };
    }

    // Collect all potential correct answer fields
    const candidates = [
        question.correctAnswer,
        question.correct_answer,
        question.correct_option,
        question.correctOption,
        question.correct_ans,
        question.answer
    ].filter(c => c !== undefined && c !== null && String(c).trim() !== '');

    if (options.length === 0) {
        return candidates[0] ? String(candidates[0]).trim() : '';
    }

    const labels = ['a', 'b', 'c', 'd', 'e'];

    // Try resolving each candidate against options array
    for (const rawCandidate of candidates) {
        const raw = String(rawCandidate).trim();
        const rawLower = raw.toLowerCase();

        // 1. Direct exact match (case-insensitive)
        const exact = options.find(o => o.toLowerCase() === rawLower);
        if (exact) return exact;

        // 2. Normalized match (ignoring spaces & punctuation)
        const cleanRaw = rawLower.replace(/[\s\W]+/g, '');
        if (cleanRaw !== '') {
            const cleanMatch = options.find(o => o.toLowerCase().replace(/[\s\W]+/g, '') === cleanRaw);
            if (cleanMatch) return cleanMatch;
        }

        // 3. Extract label/index: "Option A", "Option 1", "A.", "Choice A", "1.", "b", "c", "d"
        const cleanedLabel = rawLower
            .replace(/^(option|choice|answer|select)\s*/i, '')
            .replace(/[\.\s:]/g, '');

        const labelIdx = labels.indexOf(cleanedLabel);
        if (labelIdx !== -1 && options[labelIdx]) {
            return options[labelIdx];
        }

        // 4. Numeric index (0-based or 1-based): 0, 1, 2, 3
        if (!isNaN(cleanedLabel) && cleanedLabel !== '') {
            const num = parseInt(cleanedLabel, 10);
            if (num >= 0 && num < options.length) {
                return options[num];
            } else if (num >= 1 && num <= options.length) {
                return options[num - 1];
            }
        }

        // 5. Letter label scan ("option a", "choice b")
        for (let i = 0; i < options.length && i < labels.length; i++) {
            if (rawLower.includes(`option ${labels[i]}`) || rawLower.includes(`choice ${labels[i]}`) || rawLower === labels[i]) {
                return options[i];
            }
        }

        // 6. Substring match
        const sub = options.find(o => o.toLowerCase().includes(rawLower) || rawLower.includes(o.toLowerCase()));
        if (sub) return sub;
    }

    // Default safety fallback: return options[0]
    return options[0] || '';
}

function gradeAnswer(studentRawAnswer, question) {
    if (!question) return { isCorrect: false, points: 0, resolvedCorrect: '' };

    const studentStr = (studentRawAnswer || '').toString().trim();
    const studentLower = studentStr.toLowerCase();
    const studentClean = studentLower.replace(/[\s\W]+/g, '');

    const rawOptions = Array.isArray(question.options) ? question.options : [];
    const normOptions = rawOptions.map(o => (typeof o === 'string' ? o : (o?.text || o?.label || String(o))).trim());

    // Resolve authoritative correct answer text
    const resolvedCorrect = resolveCorrectOptionText(question);
    const resolvedLower = resolvedCorrect.toLowerCase();
    const resolvedClean = resolvedLower.replace(/[\s\W]+/g, '');

    let isCorrect = false;

    // Layer 1: Direct text comparison against resolved correct answer
    if (studentLower === resolvedLower || (studentClean !== '' && studentClean === resolvedClean)) {
        isCorrect = true;
    }

    // Layer 2: Direct text comparison against raw candidates (correctAnswer, correct_answer, etc.)
    if (!isCorrect) {
        const rawCandidates = [
            question.correctAnswer,
            question.correct_answer,
            question.correct_ans,
            question.answer
        ].filter(Boolean).map(c => String(c).trim().toLowerCase());

        if (rawCandidates.some(c => c === studentLower || (studentClean !== '' && studentClean === c.replace(/[\s\W]+/g, '')))) {
            isCorrect = true;
        }
    }

    // Layer 3: Index/Letter comparison if student sent "A", "B", "C", "D" or "0", "1", "2", "3"
    if (!isCorrect && normOptions.length > 0) {
        const labels = ['a', 'b', 'c', 'd', 'e'];
        const studentCleanedLabel = studentLower.replace(/^(option|choice|answer|select)\s*/i, '').replace(/[\.\s:]/g, '');
        const labelIdx = labels.indexOf(studentCleanedLabel);
        if (labelIdx !== -1 && normOptions[labelIdx]) {
            if (normOptions[labelIdx].toLowerCase() === resolvedLower) {
                isCorrect = true;
            }
        } else if (!isNaN(studentCleanedLabel) && studentCleanedLabel !== '') {
            const num = parseInt(studentCleanedLabel, 10);
            const targetOpt = normOptions[num] || normOptions[num - 1];
            if (targetOpt && targetOpt.toLowerCase() === resolvedLower) {
                isCorrect = true;
            }
        }
    }

    // Layer 4: Reverse option lookup — check if student selected option text matches the option at correct_option index
    if (!isCorrect && normOptions.length > 0) {
        const optIdxCandidate = question.correct_option !== undefined ? question.correct_option : question.correctOption;
        if (optIdxCandidate !== undefined && optIdxCandidate !== null) {
            let targetIdx = -1;
            if (typeof optIdxCandidate === 'number') targetIdx = optIdxCandidate;
            else if (!isNaN(optIdxCandidate)) targetIdx = parseInt(optIdxCandidate, 10);
            else if (typeof optIdxCandidate === 'string') {
                const labels = ['a', 'b', 'c', 'd', 'e'];
                targetIdx = labels.indexOf(optIdxCandidate.trim().toLowerCase());
            }
            if (targetIdx >= 0 && targetIdx < normOptions.length) {
                const targetText = normOptions[targetIdx].toLowerCase();
                if (studentLower === targetText || (studentClean !== '' && studentClean === targetText.replace(/[\s\W]+/g, ''))) {
                    isCorrect = true;
                }
            }
        }
    }

    const points = isCorrect ? (question.points || 10) : 0;
    return { isCorrect, points, resolvedCorrect };
}

module.exports = { gradeAnswer, resolveCorrectOptionText };
