/**
 * Question Formatter Utility
 * Provides intelligent parsing and language detection for code-based,
 * snippet-based, problem-based, scenario-based, and normal questions.
 */

/**
 * Detects programming language for a given code block string.
 */
export function detectLanguage(codeStr) {
    if (!codeStr || typeof codeStr !== 'string') return 'code';
    const text = codeStr.trim();

    if (/#include|using\s+namespace|cout\s*<<|cin\s*>>|std::|int\s+main\s*\(/i.test(text)) {
        return 'cpp';
    }
    if (/public\s+class|System\.out\.print|public\s+static\s+void\s+main/i.test(text)) {
        return 'java';
    }
    if (/def\s+\w+\s*\(|elif\s+|import\s+\w+|print\s*\(/i.test(text) && !/console\.log/i.test(text) && !/;/i.test(text)) {
        return 'python';
    }
    if (/SELECT\s+[\s\S]+?FROM\s+|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|WHERE\s+\w+|GROUP\s+BY|ORDER\s+BY/i.test(text)) {
        return 'sql';
    }
    if (/<html|<div|<span|<p>|<style|<script|<!DOCTYPE/i.test(text)) {
        return 'html';
    }
    if (/console\.log|function\s*\(|const\s+|let\s+|var\s+|document\./i.test(text)) {
        return 'javascript';
    }
    return 'code';
}

/**
 * Formats a single-line concatenated code string into multi-line code statements.
 * Example: "int sum = 0; for(int i = 1; i <= 5; i++) sum += i; cout << sum;"
 * Output:
 * int sum = 0;
 * for(int i = 1; i <= 5; i++) sum += i;
 * cout << sum;
 */
export function formatInlineCodeToMultiline(codeText) {
    if (!codeText || typeof codeText !== 'string') return codeText;
    if (codeText.includes('\n')) return codeText; // Already has newlines

    let formatted = codeText.trim();

    // Preserve for(...) loop headers so semicolons inside loop headers are not split
    const forLoopRegex = /for\s*\([^)]*\)/gi;
    const forLoops = [];
    formatted = formatted.replace(forLoopRegex, (match) => {
        forLoops.push(match);
        return `__FOR_LOOP_${forLoops.length - 1}__`;
    });

    // Replace statement terminating semicolons with semicolon + newline
    formatted = formatted.replace(/;\s*/g, ';\n');

    // Replace braces with newlines
    formatted = formatted.replace(/\{\s*/g, '{\n').replace(/\}\s*/g, '}\n');

    // Restore for loop headers
    forLoops.forEach((forStr, idx) => {
        formatted = formatted.replace(`__FOR_LOOP_${idx}__`, forStr);
    });

    return formatted
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join('\n');
}

/**
 * Checks if a block of text contains strong programming syntax constructs.
 */
export function containsStrongCodeConstruct(text) {
    if (!text || typeof text !== 'string') return false;
    return (
        /#include|using\s+namespace|int\s+main\s*\(|public\s+class|public\s+static\s+void\s+main|System\.out\.println|cout\s*<<|cin\s*>>|printf\s*\(|scanf\s*\(/i.test(text) ||
        /def\s+\w+\s*\([^)]*\)\s*:|print\s*\([^)]*\)|elif\s+.*:/i.test(text) ||
        /SELECT\s+[\s\S]+?FROM|WHERE\s+\w+\s*[=><]|ORDER\s+BY|GROUP\s+BY/i.test(text) ||
        /<style[\s\S]*?>|<div[\s\S]*?>|<script[\s\S]*?>/i.test(text) ||
        /for\s*\([^)]*\)\s*\{|while\s*\([^)]*\)\s*\{|if\s*\([^)]*\)\s*\{/i.test(text) ||
        /console\.log\s*\(/i.test(text) ||
        /;\s*$/m.test(text) ||
        /;\s*(?:int|float|double|char|bool|var|let|const|cout|cin|printf|System|return|for|if|while|def)\b/i.test(text)
    );
}

/**
 * Checks if an individual line matches common code characteristics.
 */
function isCodeLine(line) {
    if (!line) return false;
    const trimmed = line.trim();
    if (!trimmed) return false;

    // Strong syntax markers
    if (/#include|using\s+namespace|int\s+main|public\s+class|public\s+static|System\.out|cout\s*<<|cin\s*>>|printf\(|scanf\(|return\s+0;|return\s+\w+;/i.test(trimmed)) return true;
    if (/def\s+\w+\s*\(|print\(|elif\s+|import\s+\w+/i.test(trimmed)) return true;
    if (/SELECT\s+|FROM\s+|WHERE\s+|ORDER\s+BY|GROUP\s+BY|INSERT\s+INTO|UPDATE\s+/i.test(trimmed)) return true;
    if (/<div|<span|<p>|<style|<script|<\/div>|<\/span>|<\/style>|<\/script>/i.test(trimmed)) return true;
    if (/for\s*\(|while\s*\(|if\s*\(|else\s*\{|switch\s*\(/i.test(trimmed)) return true;
    if (/console\.log\(|function\s*\(|const\s+\w+\s*=|let\s+\w+\s*=|var\s+\w+\s*=/i.test(trimmed)) return true;

    // Structural braces & semicolons
    if (/^[\{\}\(\)];?$/.test(trimmed)) return true;
    if (/;\s*$/.test(trimmed)) return true;
    if (/^[\w\<\>\:\*]+\s+[\w\<\>\:\*]+\s*=\s*.+;$/.test(trimmed)) return true;

    // Indented lines starting with spaces or tab
    if (/^(  +|\t)[a-zA-Z0-9_\#\<\>\/\{\}\(\)\;\=]/.test(line)) return true;

    return false;
}

/**
 * Parses raw questionText into structured content segments:
 * Returns { hasCode: boolean, segments: Array<{ type: 'text'|'code', content: string, language?: string }> }
 */
export function parseQuestionContent(questionText) {
    if (!questionText || typeof questionText !== 'string') {
        return { hasCode: false, segments: [{ type: 'text', content: questionText || '' }] };
    }

    const text = questionText.trim();

    // 1. Explicit Markdown Code Block (```lang ... ```)
    if (text.includes('```')) {
        const segments = [];
        const codeBlockRegex = /```(\w*)\r?\n?([\s\S]*?)```/g;
        let lastIdx = 0;
        let match;

        while ((match = codeBlockRegex.exec(text)) !== null) {
            if (match.index > lastIdx) {
                const textPart = text.substring(lastIdx, match.index);
                if (textPart.trim()) {
                    segments.push({ type: 'text', content: textPart });
                }
            }
            const lang = match[1] || detectLanguage(match[2]);
            segments.push({
                type: 'code',
                language: lang,
                content: match[2]
            });
            lastIdx = match.index + match[0].length;
        }

        if (lastIdx < text.length) {
            const tail = text.substring(lastIdx);
            if (tail.trim()) {
                segments.push({ type: 'text', content: tail });
            }
        }

        return { hasCode: true, segments };
    }

    // 2. Explicit HTML Code Block (<pre><code>...</code></pre>)
    if (text.includes('<pre>') || text.includes('<code>')) {
        const segments = [];
        const htmlCodeRegex = /<pre>(?:<code(?: class="(\w+)")?>)?([\s\S]*?)(?:<\/code>)?<\/pre>/g;
        let lastIdx = 0;
        let match;

        while ((match = htmlCodeRegex.exec(text)) !== null) {
            if (match.index > lastIdx) {
                const textPart = text.substring(lastIdx, match.index);
                if (textPart.trim()) {
                    segments.push({ type: 'text', content: textPart });
                }
            }
            const lang = match[1] || detectLanguage(match[2]);
            segments.push({
                type: 'code',
                language: lang,
                content: match[2]
            });
            lastIdx = match.index + match[0].length;
        }

        if (lastIdx < text.length) {
            const tail = text.substring(lastIdx);
            if (tail.trim()) {
                segments.push({ type: 'text', content: tail });
            }
        }

        if (segments.some(s => s.type === 'code')) {
            return { hasCode: true, segments };
        }
    }

    // 3. Implied Code Block Detection (Multi-line AIKEN questions without backticks)
    const lines = text.split(/\r?\n/);
    if (lines.length >= 2) {
        let codeStartIdx = -1;
        let codeEndIdx = -1;

        for (let i = 0; i < lines.length; i++) {
            if (isCodeLine(lines[i])) {
                if (codeStartIdx === -1) codeStartIdx = i;
                codeEndIdx = i;
            } else if (codeStartIdx !== -1 && codeEndIdx !== -1) {
                if (lines[i].trim() === '') {
                    let nextCodeLine = -1;
                    for (let k = i + 1; k < lines.length; k++) {
                        if (lines[k].trim() !== '') {
                            if (isCodeLine(lines[k])) nextCodeLine = k;
                            break;
                        }
                    }
                    if (nextCodeLine !== -1) {
                        codeEndIdx = nextCodeLine;
                        i = nextCodeLine;
                        continue;
                    }
                }
                break;
            }
        }

        if (codeStartIdx !== -1 && codeEndIdx >= codeStartIdx) {
            const codeSubLines = lines.slice(codeStartIdx, codeEndIdx + 1);
            const nonBlankCount = codeSubLines.filter(l => l.trim() !== '').length;

            if (nonBlankCount >= 1 && (nonBlankCount >= 2 || containsStrongCodeConstruct(codeSubLines.join('\n')))) {
                const promptLines = lines.slice(0, codeStartIdx);
                const codeLines = codeSubLines;
                const tailLines = lines.slice(codeEndIdx + 1);

                const segments = [];
                const promptText = promptLines.join('\n');
                if (promptText.trim()) {
                    segments.push({ type: 'text', content: promptText });
                }

                let cStart = 0;
                let cEnd = codeLines.length - 1;
                while (cStart <= cEnd && codeLines[cStart].trim() === '') cStart++;
                while (cEnd >= cStart && codeLines[cEnd].trim() === '') cEnd--;

                const codeText = codeLines.slice(cStart, cEnd + 1).join('\n');
                segments.push({
                    type: 'code',
                    language: detectLanguage(codeText),
                    content: codeText
                });

                const tailText = tailLines.join('\n');
                if (tailText.trim()) {
                    segments.push({ type: 'text', content: tailText });
                }

                return { hasCode: true, segments };
            }
        }
    }

    // 4. Single-line Concatenated Code Question Detection (e.g. "What is the output of the following C++ code? int sum = 0; for(int i = 1; i <= 5; i++) sum += i; cout << sum;")
    if (containsStrongCodeConstruct(text)) {
        const codeMatch = text.match(/([?.:]|\b)\s+(#include|using\s+namespace|int\s+main|int\s+[a-zA-Z_]|float\s+|double\s+|char\s+|bool\s+|void\s+|public\s+class|public\s+static|def\s+|for\s*\(|while\s*\(|if\s*\(|cout\s*<<|cin\s*>>|System\.out|console\.log|SELECT\s+|<div|<style)/i);
        
        if (codeMatch) {
            const codeStartPos = codeMatch.index + codeMatch[1].length;
            const promptText = text.substring(0, codeStartPos).trim();
            const rawCode = text.substring(codeStartPos).trim();
            const multilineCode = formatInlineCodeToMultiline(rawCode);

            const segments = [];
            if (promptText) {
                segments.push({ type: 'text', content: promptText });
            }
            segments.push({
                type: 'code',
                language: detectLanguage(multilineCode),
                content: multilineCode
            });

            return { hasCode: true, segments };
        }
    }

    // 5. Default: Plain text (Normal MCQ or Scenario multi-paragraph)
    return {
        hasCode: false,
        segments: [{ type: 'text', content: text }]
    };
}
