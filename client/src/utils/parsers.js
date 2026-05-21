/**
 * AikenParser Utility
 * Robust state-machine parser for the AIKEN quiz format.
 * Handles single and double newline separators.
 */
export function parseAiken(text) {
    const errors = [];
    const questions = [];

    const isOption = line => /^[A-Z]\.\s+.+$/.test(line);
    const isAnswer = line => /^ANSWER\s*:\s*[A-Z]$/i.test(line);

    const rawLines = text.split('\n').map(l => l.trim());

    // Build chunks: each chunk is the lines for one question.
    const chunks = [];
    let current = [];
    let sawAnswer = false;

    for (const line of rawLines) {
        if (line === '') continue;

        if (sawAnswer && !isOption(line) && !isAnswer(line)) {
            if (current.length > 0) {
                chunks.push(current);
                current = [];
            }
            sawAnswer = false;
        }

        current.push(line);

        if (isAnswer(line)) {
            sawAnswer = true;
        }
    }
    if (current.length > 0) chunks.push(current);

    for (let i = 0; i < chunks.length; i++) {
        const lines = chunks[i];
        const qNum = i + 1;

        if (lines.length < 3) {
            errors.push(`Question ${qNum}: Too few lines to be valid.`);
            continue;
        }

        const questionText = lines[0];
        const options = [];
        let correctAnswer = '';
        let unrecognizedLinesCount = 0;

        for (let j = 1; j < lines.length; j++) {
            const optMatch = lines[j].match(/^([A-Z])\.\s+(.+)$/);
            const ansMatch = lines[j].match(/^ANSWER\s*:\s*([A-Z])$/i);

            if (optMatch) {
                options.push({ letter: optMatch[1], text: optMatch[2] });
            } else if (ansMatch) {
                correctAnswer = ansMatch[1].toUpperCase();
            } else {
                errors.push(`Question ${qNum}: Unrecognized line → "${lines[j]}"`);
                unrecognizedLinesCount++;
            }
        }

        if (unrecognizedLinesCount > 0) {
            continue;
        }

        if (options.length !== 4) {
            errors.push(`Question ${qNum}: Every question must contain exactly 4 options. Found ${options.length} options instead.`);
            continue;
        }

        const expectedLetters = ['A', 'B', 'C', 'D'];
        let hasSequenceError = false;
        for (let oIdx = 0; oIdx < 4; oIdx++) {
            if (options[oIdx].letter !== expectedLetters[oIdx]) {
                errors.push(`Question ${qNum}: Option ${oIdx + 1} must start with letter "${expectedLetters[oIdx]}" (found "${options[oIdx].letter}" instead). No option letters should be skipped.`);
                hasSequenceError = true;
            }
        }

        if (hasSequenceError) {
            continue;
        }

        if (!correctAnswer) {
            errors.push(`Question ${qNum}: Missing ANSWER line. Each question must contain: ANSWER: X`);
            continue;
        }

        const correctOpt = options.find(o => o.letter === correctAnswer);
        if (!correctOpt) {
            errors.push(`Question ${qNum}: ANSWER "${correctAnswer}" does not match any valid option letter (A, B, C, or D).`);
            continue;
        }

        questions.push({
            questionText,
            options: options.map(o => o.text),
            correctAnswer: correctOpt.text,
            points: 10
        });
    }

    const isValid = errors.length === 0 && questions.length > 0;
    return { questions, errors, isValid };
}
