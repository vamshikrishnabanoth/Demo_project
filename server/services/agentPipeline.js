/**
 * server/services/agentPipeline.js
 *
 * Agentic Quiz Quality Assurance Pipeline.
 *
 * Order of operations:
 *   1. Whole-quiz critic   (repeated concepts, difficulty distribution, answer-position bias)
 *   2. Per-question critic  (10 weighted criteria, score 0-100)
 *   3. Early-exit if avg score >= EARLY_EXIT_AVG (92)
 *   4. Parallel refinement  (max concurrency = 3, max 3 rounds via Groq)
 *   5. Re-critique after each round; exit if quality target met or timeout reached
 *   6. Return final questions + agentReport (no scores shown to teachers — only verdicts)
 */

'use strict';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const PASS_THRESHOLD  = 90;   // per-question pass score
const EARLY_EXIT_AVG  = 92;   // exit loop early if avg >= this
const MAX_RETRIES     = 3;    // refinement rounds per question
const MAX_CONCURRENCY = 3;    // parallel Groq calls

// ─── HELPERS ──────────────────────────────────────────────────────────────────

/** Word-overlap ratio between two strings (ignores short words) */
function wordOverlap(a, b) {
    const tokenise = str =>
        new Set(str.toLowerCase().split(/\W+/).filter(w => w.length > 3));
    const setA = tokenise(a);
    const setB = tokenise(b);
    if (setA.size === 0 || setB.size === 0) return 0;
    let shared = 0;
    setA.forEach(w => { if (setB.has(w)) shared++; });
    return shared / Math.min(setA.size, setB.size);
}

/** Average of an array of numbers */
function avg(arr) {
    if (!arr.length) return 0;
    return arr.reduce((s, v) => s + v, 0) / arr.length;
}

/** Run async tasks with a concurrency cap */
async function withConcurrency(tasks, limit) {
    const results = new Array(tasks.length);
    let idx = 0;
    async function worker() {
        while (idx < tasks.length) {
            const i = idx++;
            results[i] = await tasks[i]();
        }
    }
    await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
    return results;
}

// ─── WHOLE-QUIZ CRITIC ────────────────────────────────────────────────────────

/**
 * Reviews the quiz as a whole.
 * Returns { quizIssues: string[], quizContext: { [questionIndex]: string[] } }
 */
function wholeQuizCritic(questions, requestedDifficulty) {
    const quizIssues = [];
    const quizContext = {}; // per-question context flags

    const flag = (idx, msg) => {
        quizContext[idx] = quizContext[idx] || [];
        if (!quizContext[idx].includes(msg)) quizContext[idx].push(msg);
    };

    // 1. Repeated concepts
    for (let i = 0; i < questions.length; i++) {
        for (let j = i + 1; j < questions.length; j++) {
            const overlap = wordOverlap(
                questions[i].questionText || '',
                questions[j].questionText || ''
            );
            if (overlap >= 0.6) {
                const msg = `Concept overlap with Question ${j + 1}`;
                const msg2 = `Concept overlap with Question ${i + 1}`;
                flag(i, msg);
                flag(j, msg2);
                if (!quizIssues.find(x => x.includes('Repeated concept'))) {
                    quizIssues.push(`Repeated concept between Q${i + 1} and Q${j + 1}`);
                }
            }
        }
    }

    // 2. Answer-position bias
    const posCounts = [0, 0, 0, 0];
    questions.forEach(q => {
        const ai = (q.options || []).indexOf(q.correctAnswer);
        if (ai >= 0 && ai < 4) posCounts[ai]++;
    });
    const total = questions.length;
    posCounts.forEach((count, pos) => {
        if (total >= 3 && count / total > 0.5) {
            const label = ['A', 'B', 'C', 'D'][pos];
            quizIssues.push(`Answer-position bias: ${Math.round(count / total * 100)}% of answers are at option ${label}`);
            questions.forEach((q, idx) => {
                if ((q.options || []).indexOf(q.correctAnswer) === pos) {
                    flag(idx, `Answer position bias (option ${label})`);
                }
            });
        }
    });

    // 3. Difficulty distribution
    const hardKw = ['analyze', 'evaluate', 'compare', 'why does', 'explain how', 'what would happen'];
    const easyKw = ['what is', 'define', 'which one', 'name the'];
    const level = (requestedDifficulty || 'Medium').toLowerCase();
    if (level === 'hard') {
        const hardCount = questions.filter(q =>
            hardKw.some(kw => (q.questionText || '').toLowerCase().includes(kw))
        ).length;
        if (hardCount < Math.ceil(questions.length * 0.3)) {
            quizIssues.push('Difficulty distribution: few questions match the requested Hard level');
        }
    }
    if (level === 'easy') {
        const hardCount = questions.filter(q =>
            hardKw.some(kw => (q.questionText || '').toLowerCase().includes(kw))
        ).length;
        if (hardCount > Math.floor(questions.length * 0.2)) {
            quizIssues.push('Difficulty distribution: some questions are too complex for Easy level');
        }
    }

    return { quizIssues, quizContext };
}

// ─── PER-QUESTION CRITIC ─────────────────────────────────────────────────────

/**
 * Scores a single question 0-100 against 6 weighted criteria.
 * Returns { score, approved, issues, feedback, retries }
 */
function criticQuestion(q, index, allQuestions, quizContext, requestedDifficulty) {
    let score = 0;
    const issues = [];
    const feedback = [];

    const text    = (q.questionText  || '').trim();
    const options = q.options || [];
    const answer  = (q.correctAnswer || '').trim();
    const expl    = (q.explanation   || '').trim();

    // ── Correctness 30 pts ──────────────────────────────────────────────────
    if (answer) {
        score += 15;
        if (options.some(o => o === answer)) {
            score += 15;
        } else {
            issues.push('Correct answer does not match any option exactly');
            feedback.push('Set correctAnswer to an exact string copy of one of the options');
        }
    } else {
        issues.push('Missing correct answer');
        feedback.push('Provide a correctAnswer that exactly matches one of the options');
    }

    // ── Clarity 20 pts ──────────────────────────────────────────────────────
    if (text.length >= 15) score += 10;
    else { issues.push('Question is too short'); feedback.push('Write a more complete question (≥ 15 chars)'); }

    const metaKw = ['file format', '/opt/', 'powerpoint', 'path extension', 'directory'];
    if (!metaKw.some(kw => text.toLowerCase().includes(kw))) {
        score += 5;
    } else {
        issues.push('Question references metadata or file paths');
        feedback.push('Remove file paths / system references and focus on the subject matter');
    }

    if (text.endsWith('?') || text.endsWith(':')) score += 5;
    else { issues.push('Question does not end with "?"'); feedback.push('Rephrase as a proper question ending with "?"'); }

    // ── Distractor Quality 15 pts ───────────────────────────────────────────
    const nonEmpty = options.filter(o => o && o.trim().length > 0);
    if (nonEmpty.length >= 4) score += 5;
    else { issues.push(`Only ${nonEmpty.length} non-empty options (need 4)`); feedback.push('Provide exactly 4 meaningful options'); }

    const unique = new Set(options.map(o => (o || '').toLowerCase().trim()));
    if (unique.size === options.length) score += 5;
    else { issues.push('Duplicate options detected'); feedback.push('Make all 4 options distinct'); }

    if (options.every(o => o && o.trim().length > 3)) score += 5;
    else { issues.push('Some options are too short'); feedback.push('Each option should be at least 4 characters'); }

    // ── Explanation 10 pts ──────────────────────────────────────────────────
    if (expl.length >= 20) score += 10;
    else if (expl.length > 0) { score += 5; issues.push('Explanation is too brief'); feedback.push('Expand the explanation to at least 20 characters'); }
    else { issues.push('Missing explanation'); feedback.push('Add an explanation for why the correct answer is right'); }

    // ── Difficulty Alignment 15 pts ─────────────────────────────────────────
    const reqDiff   = (requestedDifficulty || 'Medium').toLowerCase();
    const textLower = text.toLowerCase();
    const isHard    = ['analyze', 'evaluate', 'compare', 'explain how', 'what would happen'].some(p => textLower.includes(p));
    const isEasy    = ['what is', 'define', 'which one', 'name the'].some(p => textLower.includes(p));

    if (reqDiff === 'hard' && isEasy && !isHard) {
        issues.push('Difficulty mismatch: question is too simple for Hard level');
        feedback.push('Rewrite as an analysis, evaluation, or application question');
        score = Math.max(0, score - 5);
    } else if (reqDiff === 'easy' && isHard) {
        issues.push('Difficulty mismatch: question is too complex for Easy level');
        feedback.push('Simplify to a basic recall or definition question');
    } else {
        score += 15;
    }

    // ── Uniqueness 10 pts ───────────────────────────────────────────────────
    const hasSimilar = allQuestions.some((other, j) =>
        j !== index && wordOverlap(text, other.questionText || '') >= 0.6
    );
    if (!hasSimilar) score += 10;
    else { issues.push('Similar to another question in this quiz'); feedback.push('Test a different concept or rephrase significantly'); }

    // ── Quiz-level context flags ────────────────────────────────────────────
    (quizContext[index] || []).forEach(ci => {
        if (!issues.includes(ci)) issues.push(ci);
    });

    score = Math.max(0, Math.min(100, score));
    return { score, approved: score >= PASS_THRESHOLD, issues, feedback, retries: 0 };
}

// ─── QUESTION REFINER ────────────────────────────────────────────────────────

const _promptCache = new Map();

async function refineQuestion(q, criticResult, groqClient, difficulty) {
    if (!groqClient) return { question: q, refined: false };

    const cacheKey = `${(q.questionText || '').slice(0, 80)}::${[...criticResult.issues].sort().join('|')}`;
    if (_promptCache.has(cacheKey)) {
        return { question: _promptCache.get(cacheKey), refined: true, cached: true };
    }

    const prompt = [
        'You are an expert quiz editor. Improve this multiple-choice question based on the specific issues listed.',
        '',
        'ORIGINAL QUESTION:',
        JSON.stringify(q, null, 2),
        '',
        'ISSUES TO FIX:',
        criticResult.issues.map((issue, i) => `${i + 1}. ${issue}`).join('\n'),
        '',
        'FIX INSTRUCTIONS:',
        criticResult.feedback.map((fb, i) => `${i + 1}. ${fb}`).join('\n'),
        '',
        `REQUIRED DIFFICULTY: ${difficulty || 'Medium'}`,
        '',
        'Return ONLY a valid JSON object with EXACTLY these keys:',
        '{ "questionText", "options" (array of 4 strings), "correctAnswer" (exact match of one option), "explanation", "points", "type" }',
        'Do NOT wrap in markdown. Do NOT add extra keys. Do NOT change the subject/topic.',
    ].join('\n');

    try {
        const completion = await groqClient.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'llama-3.1-8b-instant',
            response_format: { type: 'json_object' },
            temperature: 0.3,
            max_tokens: 600,
        });

        const raw = completion.choices[0].message.content.trim();
        const refined = JSON.parse(raw);

        if (refined.questionText && Array.isArray(refined.options) && refined.correctAnswer) {
            const result = {
                questionText:  refined.questionText,
                options:       refined.options.slice(0, 4),
                correctAnswer: refined.correctAnswer,
                explanation:   refined.explanation || q.explanation || '',
                points:        refined.points || q.points || 10,
                type:          'multiple-choice',
            };
            _promptCache.set(cacheKey, result);
            return { question: result, refined: true };
        }
    } catch (err) {
        // silently fall back — never block the teacher flow
    }
    return { question: q, refined: false };
}

// ─── REPORT BUILDER ──────────────────────────────────────────────────────────

function buildReport(criticResults, quizIssues, totalRetries, totalMs, criticMs, timedOut, groqUnavailable) {
    const scores = criticResults.map(r => r.score);
    const avgQuality = Math.round(avg(scores));

    // Verdict: teacher-friendly language only (no raw numbers)
    let verdict;
    if (avgQuality >= 92) verdict = 'excellent';
    else if (avgQuality >= 80) verdict = 'good';
    else verdict = 'review';

    const fallback = groqUnavailable || timedOut;

    return {
        verdict,          // 'excellent' | 'good' | 'review'
        avgScore: avgQuality,
        totalRetries,
        fallback,
        timedOut,
        groqUnavailable,
        totalMs,
        criticMs,
        quizIssues,
        perQuestion: criticResults.map((r, i) => ({
            index:    i,
            verdict:  r.score >= 92 ? 'excellent' : r.score >= 75 ? 'good' : 'review',
            issues:   r.issues,
            retries:  r.retries || 0,
        })),
    };
}

// ─── PIPELINE ORCHESTRATOR ───────────────────────────────────────────────────

/**
 * @param {object[]} draftQuestions  Raw questions from the AI generator
 * @param {object|null} groqClient   Groq SDK instance (or null if no API key)
 * @param {string} difficulty        Easy | Medium | Thinkable | Hard
 * @param {string} topic             Original topic/content (for context)
 * @param {number} timeoutMs         Max ms for critic+refine phase (default 60 000)
 * @returns {{ questions: object[], agentReport: object }}
 */
async function runAgentPipeline({ draftQuestions, groqClient, difficulty, topic, timeoutMs = 60000 }) {
    if (!draftQuestions || draftQuestions.length === 0) {
        return {
            questions: draftQuestions || [],
            agentReport: { verdict: 'review', avgScore: 0, retries: 0, fallback: true, error: 'No draft questions received', perQuestion: [] },
        };
    }

    const pipelineStart = Date.now();
    const isTimedOut = () => (Date.now() - pipelineStart) >= timeoutMs;
    const hasGroq = !!groqClient;

    let questions = draftQuestions.map(q => ({ ...q }));
    let criticResults;
    let totalRetries = 0;
    let timedOut = false;

    try {
        // ── Phase 1: Whole-quiz review ──────────────────────────────────────
        const { quizIssues, quizContext } = wholeQuizCritic(questions, difficulty);
        const criticStart = Date.now();

        // ── Phase 2: Per-question critique ─────────────────────────────────
        criticResults = questions.map((q, i) =>
            criticQuestion(q, i, questions, quizContext, difficulty)
        );

        // ── Phase 3: Early exit ─────────────────────────────────────────────
        const currentAvg = () => avg(criticResults.map(r => r.score));
        if (currentAvg() >= EARLY_EXIT_AVG) {
            return {
                questions,
                agentReport: buildReport(criticResults, quizIssues, 0, Date.now() - pipelineStart, Date.now() - criticStart, false, !hasGroq),
            };
        }

        // ── Phase 4: Parallel refinement rounds ─────────────────────────────
        for (let round = 0; round < MAX_RETRIES; round++) {
            if (isTimedOut()) { timedOut = true; break; }
            if (!hasGroq) break;

            const failingIdx = criticResults
                .map((r, i) => (r.approved ? null : i))
                .filter(i => i !== null);
            if (failingIdx.length === 0) break;

            const tasks = failingIdx.map(idx => async () => {
                if (isTimedOut()) return;
                const result = await refineQuestion(questions[idx], criticResults[idx], groqClient, difficulty);
                if (result.refined) {
                    questions[idx] = result.question;
                    criticResults[idx].retries = (criticResults[idx].retries || 0) + 1;
                    totalRetries++;
                }
            });

            await withConcurrency(tasks, MAX_CONCURRENCY);
            if (isTimedOut()) { timedOut = true; break; }

            // Re-critique only the refined questions
            const { quizContext: ctx2 } = wholeQuizCritic(questions, difficulty);
            failingIdx.forEach(idx => {
                criticResults[idx] = {
                    ...criticQuestion(questions[idx], idx, questions, ctx2, difficulty),
                    retries: criticResults[idx].retries || 0,
                };
            });

            if (currentAvg() >= EARLY_EXIT_AVG) break;
        }

        const criticMs = Date.now() - criticStart;
        return {
            questions,
            agentReport: buildReport(criticResults, quizIssues, totalRetries, Date.now() - pipelineStart, criticMs, timedOut, !hasGroq),
        };

    } catch (err) {
        console.error('❌ [AgentPipeline] Unexpected error:', err.message);
        return {
            questions: draftQuestions,
            agentReport: {
                verdict: 'review', avgScore: 0, totalRetries, fallback: true,
                error: err.message, timedOut: false, quizIssues: [], perQuestion: [],
            },
        };
    }
}

module.exports = { runAgentPipeline };
