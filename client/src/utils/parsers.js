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

        for (let j = 1; j < lines.length; j++) {
            const optMatch = lines[j].match(/^([A-Z])\.\s+(.+)$/);
            const ansMatch = lines[j].match(/^ANSWER\s*:\s*([A-Z])$/i);

            if (optMatch) {
                options.push({ letter: optMatch[1], text: optMatch[2] });
            } else if (ansMatch) {
                correctAnswer = ansMatch[1].toUpperCase();
            } else {
                errors.push(`Question ${qNum}: Unrecognized line → "${lines[j]}"`);
            }
        }

        if (options.length < 2) {
            errors.push(`Question ${qNum}: Needs at least 2 options.`);
            continue;
        }
        if (!correctAnswer) {
            errors.push(`Question ${qNum}: Missing ANSWER line.`);
            continue;
        }
        const correctOpt = options.find(o => o.letter === correctAnswer);
        if (!correctOpt) {
            errors.push(`Question ${qNum}: ANSWER "${correctAnswer}" does not match any option letter.`);
            continue;
        }

        questions.push({
            questionText,
            options: options.map(o => o.text),
            correctAnswer: correctOpt.text,
            points: 10
        });
    }

    return { questions, errors };
}
