/**
 * AikenParser Utility
 * Robust multi-line parser for the AIKEN quiz format.
 * Supports multi-line question stems (including code blocks, blank lines, braces, and indentation).
 * Every line before option A. (A., B., C., D.) is treated as part of the question stem.
 */
export function parseAiken(text) {
    const errors = [];
    const questions = [];

    if (!text || !text.trim()) {
        return { questions: [], errors: ['File or text buffer is empty.'], isValid: false };
    }

    // Split raw text into individual lines
    const lines = text.split(/\r?\n/);

    // Group lines into question blocks ending with "ANSWER: X"
    const questionBlocks = [];
    let currentBlock = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        currentBlock.push(line);

        if (/^ANSWER\s*:\s*[A-Z]\s*$/i.test(line.trim())) {
            questionBlocks.push(currentBlock);
            currentBlock = [];
        }
    }

    // Check for remaining lines without a closing ANSWER line
    if (currentBlock.length > 0) {
        const remainingNonEmpty = currentBlock.filter(l => l.trim() !== '');
        if (remainingNonEmpty.length > 0) {
            errors.push(`Incomplete question block at the end of file (missing terminal "ANSWER: X" line).`);
        }
    }

    for (let qIdx = 0; qIdx < questionBlocks.length; qIdx++) {
        const blockLines = questionBlocks[qIdx];
        const qNum = qIdx + 1;

        // Find the index of Option A line (/^A\.\s+.+$/)
        let optionAIndex = -1;
        for (let j = 0; j < blockLines.length; j++) {
            if (/^A\.\s+.+$/.test(blockLines[j].trim())) {
                optionAIndex = j;
                break;
            }
        }

        if (optionAIndex === -1) {
            errors.push(`Question ${qNum}: Could not locate Option "A." line.`);
            continue;
        }

        // Extract all lines before option A as the question stem
        const stemLines = blockLines.slice(0, optionAIndex);

        // Strip outer leading/trailing blank lines while preserving interior code structure and indentation
        while (stemLines.length > 0 && stemLines[0].trim() === '') {
            stemLines.shift();
        }
        while (stemLines.length > 0 && stemLines[stemLines.length - 1].trim() === '') {
            stemLines.pop();
        }

        const questionText = stemLines.join('\n');

        if (!questionText.trim()) {
            errors.push(`Question ${qNum}: Question stem is empty.`);
            continue;
        }

        // Parse options A, B, C, D and ANSWER line
        const options = [];
        let correctAnswer = '';
        let hasError = false;

        const optionLetters = ['A', 'B', 'C', 'D'];
        let expectedOptIdx = 0;

        for (let k = optionAIndex; k < blockLines.length; k++) {
            const trimmedLine = blockLines[k].trim();
            if (trimmedLine === '') continue;

            const optMatch = trimmedLine.match(/^([A-Z])\.\s+(.+)$/);
            const ansMatch = trimmedLine.match(/^ANSWER\s*:\s*([A-Z])$/i);

            if (optMatch) {
                const letter = optMatch[1].toUpperCase();
                const optText = optMatch[2].trim();

                if (expectedOptIdx < 4 && letter === optionLetters[expectedOptIdx]) {
                    options.push({ letter, text: optText });
                    expectedOptIdx++;
                } else {
                    errors.push(`Question ${qNum}: Expected option "${optionLetters[expectedOptIdx] || 'ANSWER'}", but found "${letter}.". Option letters must be A, B, C, D in exact order.`);
                    hasError = true;
                    break;
                }
            } else if (ansMatch) {
                correctAnswer = ansMatch[1].toUpperCase();
            } else {
                errors.push(`Question ${qNum}: Unrecognized line in options section → "${trimmedLine}"`);
                hasError = true;
                break;
            }
        }

        if (hasError) continue;

        if (options.length !== 4) {
            errors.push(`Question ${qNum}: Every question must contain exactly 4 options (A, B, C, D). Found ${options.length}.`);
            continue;
        }

        if (!correctAnswer) {
            errors.push(`Question ${qNum}: Missing terminal "ANSWER: X" line.`);
            continue;
        }

        const correctOpt = options.find(o => o.letter === correctAnswer);
        if (!correctOpt) {
            errors.push(`Question ${qNum}: ANSWER "${correctAnswer}" does not match option letters A, B, C, or D.`);
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
