/**
 * server/engine/validators/blindAnswerCheck.js
 *
 * Independent answer check: a reasoning model answers every question WITHOUT seeing the key
 * (it works the answer out itself). Disagreements and questions with more than one defensible
 * option are reported per question in `independentCheck`.
 *
 * Two uses:
 *  - Lecture path (opts.lectureModel given): runs next to the Final Quality Gate. Each question is shown with the
 *    teacher's passage for its teaching point, so lecture-specific facts and program behaviour can be checked.
 *    `blindRejections()` turns disagreements into gate rejections so the bounded replacement round refills them.
 *    Release check (2026-11-16, 188 questions): the lite gate passed 7 wrong keys and 3 two-answer questions;
 *    a key-blind reasoning solve caught 5 + 2 of them even without the passage.
 *  - Legacy (no lecture model): one call over the quiz, flags only (used when the gate is switched off).
 *
 * Failures are non-fatal: questions are marked NOT_CHECKED and the gate's verdict stands.
 */
'use strict';

const lectureModel = require('../intelligence/lectureModel');

function keyIndex(q) {
  const opts = Array.isArray(q.options) ? q.options : [];
  const key = q.correctAnswer ?? q.correct_answer ?? q.answer;
  if (typeof q.correctAnswerIndex === 'number' && opts[q.correctAnswerIndex] !== undefined) return q.correctAnswerIndex;
  return opts.findIndex(o => o === key);
}

function passageFor(q, lm, maxChars) {
  if (!lm || !Array.isArray(lm.units)) return '';
  const s = q.lectureSource || {};
  const unit = (s.unitId && lm.units.find(u => u.id === s.unitId))
    || lm.units.find(u => s.subtopic && String(u.subtopic).toLowerCase() === String(s.subtopic).toLowerCase());
  return unit ? lectureModel.unitEvidenceText(lm, unit, maxChars) : '';
}

function buildPrompt(list, { lm, passageChars, detectDuplicates }) {
  const body = list.map((q, i) => {
    const stem = q.question || q.questionText || q.stem || '';
    const passage = lm && passageChars > 0 ? passageFor(q, lm, passageChars) : '';
    return `Q${i + 1}.${passage ? `\nLECTURE PASSAGE (what the teacher said or showed; the program/data here is authoritative for this question): """${passage}"""` : ''}\n${stem}\n${q.options.map((o, k) => `  ${'ABCD'[k] || k}) ${o}`).join('\n')}`;
  }).join('\n\n');
  const withPassage = list.some(q => lm && passageChars > 0 && passageFor(q, lm, passageChars));
  const passageRule = withPassage
    ? ' Use correct subject knowledge; where a question refers to a program, data or definition from its lecture passage, use the passage (e.g. what that exact program prints). If the passage states something technically wrong, answer by correct subject knowledge. "Stem reveals the answer" is about the question text only, never the passage.'
    : ' Use correct subject knowledge.';
  const dupPart = detectDuplicates ? '\nAlso list pairs of questions that test the same fact or skill (near-duplicates).' : '';
  const dupJson = detectDuplicates ? ',"duplicates":[[1,3]]' : '';
  return `${body}\n\nWork each question out yourself before choosing (trace the steps or do the calculation using the data in the question; do not assume any option is right).${passageRule} For every question return: one or two lines of working, then the single best option letter; and any OTHER option letters that a knowledgeable examiner could also defend as correct (empty if none); and whether the stem itself already reveals the answer; and, separately, whether the question text, or the option you chose as best, states or assumes something technically false (for example it calls a model that generates one token after another "encoder-only", gives a wrong property of a data structure as a premise, or the best option still contains a false reason): quote that false part in "falsePremise" and give the correct statement in "correction" (both empty when the question's premises are all true).${dupPart}\nReturn {"answers":[{"q":1,"working":"short working","answer":"B","alsoDefensible":[],"stemRevealsAnswer":false,"falsePremise":"","correction":"","note":"short reason if alsoDefensible is not empty"}]${dupJson}}`;
}

const SYSTEM = 'You are a careful university examiner taking a multiple-choice quiz. Return JSON only.';

/** Lecture path: key-blind reasoning solve on Groq (gpt-oss-120b first), in small batches to stay under the per-minute token cap. */
async function callReasoner(prompt) {
  const router = require('../adapter/llmRouter');
  const { safeParseJson } = require('../utils/jsonParser');
  const models = (process.env.BLIND_CHECK_MODELS || 'openai/gpt-oss-120b,qwen/qwen3.8-27b').split(',').map(s => s.trim()).filter(Boolean);
  const raw = await router.complete({
    prompt, systemPrompt: SYSTEM, temperature: 0, responseFormat: 'json',
    maxTokens: Math.max(1500, parseInt(process.env.BLIND_CHECK_MAX_TOKENS, 10) || 3500),
    operation: 'BLIND_ANSWER_CHECK', model: models[0], groqModels: models, noGeminiFallback: true,
    reasoningEffort: process.env.BLIND_CHECK_EFFORT || 'medium',
    rateLimitWaitMs: Math.max(0, parseInt(process.env.BLIND_CHECK_RATE_WAIT_MS, 10) || 60000)
  });
  const data = safeParseJson(raw, null);
  if (!data) throw new Error('Unreadable answer from the independent check.');
  return { data, model: models[0] };
}

function answersOf(d) {
  return Array.isArray(d) ? d : Array.isArray(d && d.answers) ? d.answers : (Object.values(d || {}).find(v => Array.isArray(v)) || []);
}

/** Apply one batch's answers to its questions; returns the number flagged. */
function applyAnswers(list, d, model, field = 'independentCheck') {
  let flagged = 0;
  const answers = answersOf(d);
  list.forEach((q, i) => {
    const a = answers.find(x => Number(x.q) === i + 1) || answers[i];
    const k = keyIndex(q);
    if (!a || typeof a.answer !== 'string') {
      q[field] = { status: 'NOT_CHECKED', reason: 'No answer returned for this question.' };
      return;
    }
    const blind = 'ABCD'.indexOf(a.answer.trim().toUpperCase().charAt(0));
    const also = (Array.isArray(a.alsoDefensible) ? a.alsoDefensible : [])
      .map(l => 'ABCD'.indexOf(String(l).trim().toUpperCase().charAt(0)))
      .filter(x => x >= 0 && x !== blind);
    if (blind !== k) {
      flagged++;
      q[field] = { status: 'DISAGREES', model, blindAnswer: q.options[blind] ?? null, working: a.working || '', reason: `An independent model chose "${q.options[blind] ?? a.answer}" instead of the key. Please check this question.` };
    } else if (also.length > 0) {
      flagged++;
      q[field] = { status: 'POSSIBLY_AMBIGUOUS', model, otherDefensible: also.map(x => q.options[x]), reason: a.note || 'Another option may also be defensible.' };
    } else if (typeof a.falsePremise === 'string' && a.falsePremise.trim().length > 3) {
      // The key can be right while the question itself teaches something false ("what does autoregressive mean for an
      // encoder-only model?"). Such a question is rejected; if the lecture said it, the teacher is told (lectureDiscrepancies).
      flagged++;
      q[field] = { status: 'FALSE_PREMISE', model, premise: a.falsePremise.trim().slice(0, 300), correction: String(a.correction || '').trim().slice(0, 300), reason: `The question assumes something false: "${a.falsePremise.trim().slice(0, 160)}".` };
    } else if (a.stemRevealsAnswer === true) {
      flagged++;
      q[field] = { status: 'POSSIBLY_AMBIGUOUS', model, stemReveals: true, reason: 'The question text already shows the answer (e.g. the output it asks for). Consider removing that part.' };
    } else {
      q[field] = { status: 'AGREES', model };
    }
  });
  return flagged;
}

/**
 * @param {Array} questions delivered MCQs ({question|questionText, options[4], correctAnswer})
 * @param {{lectureModel?:object, detectDuplicates?:boolean, batchSize?:number, passageChars?:number}} [opts]
 * @returns {Promise<{checked:boolean, flagged:number, model?:string, reason?:string}>} mutates each question with `independentCheck`
 */
async function blindAnswerCheck(questions, opts = {}) {
  const list = (questions || []).filter(q => Array.isArray(q.options) && q.options.length >= 2);
  if (list.length === 0) return { checked: false, flagged: 0, reason: 'No questions to check.' };
  const lm = opts.lectureModel && Array.isArray(opts.lectureModel.units) ? opts.lectureModel : null;

  if (lm) {
    // Own field: the Final Quality Gate runs in parallel and writes its own verdict to independentCheck.
    const FIELD = 'blindCheck';
    const size = Math.max(1, opts.batchSize || parseInt(process.env.BLIND_CHECK_BATCH, 10) || 5);
    // No passage by default. Measured on the 188 release-check questions (2026-11-17): with the teacher's passage the
    // solver deferred to the lecture (a Docker key the teacher stated wrongly was then "agreed"), caught 5 of 10 real
    // defects vs 7 of 10 without it, and spent ~4x the input tokens. BLIND_CHECK_PASSAGE_CHARS > 0 turns it back on.
    const passageChars = opts.passageChars ?? (parseInt(process.env.BLIND_CHECK_PASSAGE_CHARS, 10) || 0);
    const batches = [];
    for (let i = 0; i < list.length; i += size) batches.push(list.slice(i, i + size));
    let flagged = 0; let model = null; let failures = 0; let lastErr = null;
    await Promise.all(batches.map(async (b) => {
      try {
        const res = await callReasoner(buildPrompt(b, { lm, passageChars, detectDuplicates: false }));
        model = res.model;
        flagged += applyAnswers(b, res.data, res.model, FIELD);
      } catch (e) {
        failures++; lastErr = e;
        b.forEach(q => { q[FIELD] = { status: 'NOT_CHECKED', reason: 'Independent check unavailable (provider busy).' }; });
      }
    }));
    return { checked: failures < batches.length, flagged, model, ...(failures ? { reason: `${failures} of ${batches.length} batches not checked: ${lastErr && lastErr.message}` } : {}) };
  }

  let res;
  try {
    res = await lectureModel._internal.callJson({
      systemPrompt: SYSTEM + ' Answer from correct subject knowledge.',
      prompt: buildPrompt(list, { lm: null, detectDuplicates: opts.detectDuplicates !== false }),
      maxTokens: 8192,
      operation: 'BLIND_ANSWER_CHECK'
    });
  } catch (e) {
    list.forEach(q => { q.independentCheck = { status: 'NOT_CHECKED', reason: 'Independent check unavailable (provider busy).' }; });
    return { checked: false, flagged: 0, reason: e.message };
  }
  let flagged = applyAnswers(list, res.data, res.model);
  // Near-duplicates: flag the later question of each pair so the teacher can replace it.
  const d = res.data;
  const dupPairs = Array.isArray(d && d.duplicates) ? d.duplicates : [];
  for (const pair of dupPairs) {
    if (!Array.isArray(pair) || pair.length < 2) continue;
    const [x, y] = pair.map(Number).sort((m, n) => m - n);
    const later = list[y - 1];
    if (!later || !list[x - 1] || x === y) continue;
    if (!later.independentCheck || later.independentCheck.status === 'AGREES') {
      flagged++;
      later.independentCheck = { status: 'POSSIBLY_AMBIGUOUS', model: res.model, duplicateOf: x, reason: `Tests the same point as Q${x}. Consider replacing one of them.` };
    }
  }
  return { checked: true, flagged, model: res.model };
}

/**
 * Split gate-accepted questions by the blind check: a different key or a second defensible option means rejection
 * (gate criteria TECHNICAL_CORRECTNESS / SINGLE_ANSWER) so the replacement round refills the slot. "Stem reveals the
 * answer" and NOT_CHECKED keep the gate's verdict.
 */
function blindRejections(accepted) {
  const keep = []; const rejected = [];
  for (const q of accepted) {
    const c = q.blindCheck;
    if (c && c.status === 'DISAGREES') {
      const reason = `TECHNICAL_CORRECTNESS: An independent key-blind solve chose "${c.blindAnswer}" instead of the key${c.working ? ` (${String(c.working).slice(0, 200)})` : ''}.`;
      q.qualityGate = { ...(q.qualityGate || {}), status: 'REJECTED', criteria: ['TECHNICAL_CORRECTNESS'], reasons: [reason] };
      rejected.push({ question: q, reasons: [reason], criteria: ['TECHNICAL_CORRECTNESS'] });
    } else if (c && c.status === 'FALSE_PREMISE') {
      const reason = `TECHNICAL_CORRECTNESS: The question assumes something false: "${c.premise}"${c.correction ? ` (correct: ${c.correction})` : ''}.`;
      q.qualityGate = { ...(q.qualityGate || {}), status: 'REJECTED', criteria: ['TECHNICAL_CORRECTNESS'], reasons: [reason] };
      rejected.push({ question: q, reasons: [reason], criteria: ['TECHNICAL_CORRECTNESS'] });
    } else if (c && c.status === 'POSSIBLY_AMBIGUOUS' && Array.isArray(c.otherDefensible) && c.otherDefensible.length) {
      const reason = `SINGLE_ANSWER: An independent solve found another defensible option ("${c.otherDefensible[0]}"): ${c.reason || ''}`.trim();
      q.qualityGate = { ...(q.qualityGate || {}), status: 'REJECTED', criteria: ['SINGLE_ANSWER'], reasons: [reason] };
      rejected.push({ question: q, reasons: [reason], criteria: ['SINGLE_ANSWER'] });
    } else keep.push(q);
  }
  return { keep, rejected };
}

/**
 * "Was the lecture itself wrong here?" For questions the key-blind solve disputed, solve once more WITH the teacher's
 * passage. If the passage-based answer matches the key while the subject-knowledge answer does not, the key follows
 * what the lecture said and the lecture point itself may be technically wrong (e.g. "EXPOSE 80 makes the port
 * available to the host"). The question is still replaced; the point is reported to the teacher to double-check.
 * @returns {Promise<Array<{subtopic, time, lectureSays, standardAnswer, working, question}>>}
 */
/**
 * Tie-breaker before telling a teacher their lecture is wrong: ask directly whether the quoted statement is technically
 * wrong. A disagreement between two model solves is not proof (Transformer lecture, 24 Nov: the solver inverted the
 * correct "multiply the embedding by sqrt(d_model)" and the lecture was flagged). Only a clear "wrong" passes.
 */
async function statementIsWrong(quote, topic) {
  try {
    const res = await callReasoner(`A teacher said, in a lecture on ${topic || 'this subject'}: "${quote}"
Is this statement technically WRONG as taught (not merely informal, simplified or incomplete)? Answer "B" if it is wrong, "A" if it is correct or acceptable. Return {"answers":[{"q":1,"answer":"A","why":"one sentence"}]}`);
    const a = answersOf(res.data)[0] || {};
    return String(a.answer || '').trim().toUpperCase().charAt(0) === 'B';
  } catch (_) { return false; }
}

async function lectureDiscrepancies(disputed, lm, { max = 3 } = {}) {
  if (!lm || !Array.isArray(disputed) || !disputed.length) return [];
  const found = [];
  await Promise.all(disputed.slice(0, max).map(async (q) => {
    const c = q.blindCheck || {};
    if (c.status !== 'DISAGREES' && c.status !== 'FALSE_PREMISE') return;
    const passage = passageFor(q, lm, 1600);
    if (!passage) return;
    const norm = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (c.status === 'FALSE_PREMISE') {
      // Did the lecture itself say the false thing? Only a verbatim quote from the passage counts.
      try {
        const res = await callReasoner(`LECTURE PASSAGE: """${passage}"""

A quiz question assumed: "${c.premise}". The correct statement is: "${c.correction}".
Does the lecture passage itself state or clearly imply the false version? If yes, copy the exact words from the passage in "lectureQuote" (verbatim, at least 6 words); if not, leave it empty. Return {"answers":[{"q":1,"answer":"A","lectureQuote":""}]}`);
        const a = answersOf(res.data)[0] || {};
        const quote = typeof a.lectureQuote === 'string' ? a.lectureQuote.trim() : '';
        if (quote.split(/s+/).length >= 6 && norm(passage).includes(norm(quote)) && await statementIsWrong(quote, (q.lectureSource || {}).topic)) {
          const s = q.lectureSource || {};
          found.push({ kind: 'premise', subtopic: s.subtopic || null, time: s.time || null, lectureSays: c.premise, lectureQuote: quote, standardAnswer: c.correction || null, working: '', question: q.question || q.questionText || '' });
        }
      } catch (_) { /* best effort */ }
      return;
    }
    const probe = { ...q, blindCheck: undefined };
    try {
      const prompt = `${buildPrompt([probe], { lm, passageChars: 1600, detectDuplicates: false })}\nFor this check answer as the LECTURE PASSAGE teaches it (what a student who learned only from this passage would choose), even if you think the passage is imprecise. In the answer object also give "lectureQuote": the exact words from the passage that lead to this answer (copied verbatim), and "convention": true if the answer depends on a convention, tie-break or assumption that the question does not state.`;
      const res = await callReasoner(prompt);
      const a = answersOf(res.data)[0];
      const byLecture = a && typeof a.answer === 'string' ? 'ABCD'.indexOf(a.answer.trim().toUpperCase().charAt(0)) : -1;
      // A flag tells a teacher their lecture may be wrong, so it needs proof: the exact lecture words behind the key
      // (found in the passage), and a question that does not hinge on an unstated convention. An ambiguous or
      // simply wrong question is rejected and replaced without blaming the lecture.
      const quote = a && typeof a.lectureQuote === 'string' ? a.lectureQuote.trim() : '';
      const quoted = quote.split(/\s+/).length >= 4 && norm(passage).includes(norm(quote));
      const hedged = a && (a.convention === true || String(a.convention).toLowerCase() === 'true');
      if (byLecture >= 0 && byLecture === keyIndex(q) && quoted && !hedged && await statementIsWrong(quote, (q.lectureSource || {}).topic)) {
        const s = q.lectureSource || {};
        found.push({ subtopic: s.subtopic || null, time: s.time || null, lectureSays: q.options[byLecture], lectureQuote: quote, standardAnswer: c.blindAnswer, working: c.working || '', question: q.question || q.questionText || '' });
      }
    } catch (_) { /* best effort: no flag */ }
  }));
  return found;
}

module.exports = { blindAnswerCheck, blindRejections, lectureDiscrepancies, _buildPrompt: buildPrompt };
