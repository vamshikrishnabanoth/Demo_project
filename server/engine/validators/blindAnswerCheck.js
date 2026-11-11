/**
 * server/engine/validators/blindAnswerCheck.js
 *
 * Independent answer check: a model from a different family than the generator answers every
 * delivered question WITHOUT seeing the key. Disagreements and questions with more than one
 * defensible option are flagged for the teacher's review (never silently passed as verified).
 *
 * One call per quiz; failures are non-fatal and reported as "not checked".
 */
'use strict';

const lectureModel = require('../intelligence/lectureModel');

function keyIndex(q) {
  const opts = Array.isArray(q.options) ? q.options : [];
  const key = q.correctAnswer ?? q.correct_answer ?? q.answer;
  if (typeof q.correctAnswerIndex === 'number' && opts[q.correctAnswerIndex] !== undefined) return q.correctAnswerIndex;
  const idx = opts.findIndex(o => o === key);
  return idx;
}

/**
 * @param {Array} questions delivered MCQs ({question|questionText, options[4], correctAnswer})
 * @returns {Promise<{checked:boolean, flagged:number, reason?:string}>} mutates each question with `independentCheck`
 */
async function blindAnswerCheck(questions) {
  const list = (questions || []).filter(q => Array.isArray(q.options) && q.options.length >= 2);
  if (list.length === 0) return { checked: false, flagged: 0, reason: 'No questions to check.' };
  const body = list.map((q, i) => {
    const stem = q.question || q.questionText || q.stem || '';
    return `Q${i + 1}. ${stem}\n${q.options.map((o, k) => `  ${'ABCD'[k] || k}) ${o}`).join('\n')}`;
  }).join('\n\n');
  let res;
  try {
    res = await lectureModel._internal.callJson({
      systemPrompt: 'You are a careful university examiner taking a multiple-choice quiz. Answer from correct subject knowledge. Return JSON only.',
      prompt: `${body}\n\nWork each question out yourself before choosing (trace the steps or do the calculation using the data in the question; do not assume any option is right). For every question return: one or two lines of working, then the single best option letter; and any OTHER option letters that a knowledgeable examiner could also defend as correct (empty if none); and whether the stem itself already reveals the answer.\nAlso list pairs of questions that test the same fact or skill (near-duplicates).\nReturn {"answers":[{"q":1,"working":"short working","answer":"B","alsoDefensible":[],"stemRevealsAnswer":false,"note":"short reason if alsoDefensible is not empty"}],"duplicates":[[1,3]]}`,
      maxTokens: 8192,
      operation: 'BLIND_ANSWER_CHECK'
    });
  } catch (e) {
    list.forEach(q => { q.independentCheck = { status: 'NOT_CHECKED', reason: 'Independent check unavailable (provider busy).' }; });
    return { checked: false, flagged: 0, reason: e.message };
  }
  let flagged = 0;
  // Models sometimes return a bare array or a different wrapper key.
  const d = res.data;
  const answers = Array.isArray(d) ? d
    : Array.isArray(d.answers) ? d.answers
      : (Object.values(d || {}).find(v => Array.isArray(v)) || []);
  list.forEach((q, i) => {
    const a = answers.find(x => Number(x.q) === i + 1) || answers[i];
    const k = keyIndex(q);
    if (!a || typeof a.answer !== 'string') {
      q.independentCheck = { status: 'NOT_CHECKED', reason: 'No answer returned for this question.' };
      return;
    }
    const blind = 'ABCD'.indexOf(a.answer.trim().toUpperCase().charAt(0));
    const also = (Array.isArray(a.alsoDefensible) ? a.alsoDefensible : [])
      .map(l => 'ABCD'.indexOf(String(l).trim().toUpperCase().charAt(0)))
      .filter(x => x >= 0 && x !== blind);
    if (blind !== k) {
      flagged++;
      q.independentCheck = { status: 'DISAGREES', model: res.model, blindAnswer: q.options[blind] ?? null, reason: `An independent model chose "${q.options[blind] ?? a.answer}" instead of the key. Please check this question.` };
    } else if (also.length > 0) {
      flagged++;
      q.independentCheck = { status: 'POSSIBLY_AMBIGUOUS', model: res.model, otherDefensible: also.map(x => q.options[x]), reason: a.note || 'Another option may also be defensible.' };
    } else if (a.stemRevealsAnswer === true) {
      flagged++;
      q.independentCheck = { status: 'POSSIBLY_AMBIGUOUS', model: res.model, reason: 'The question text already shows the answer (e.g. the output it asks for). Consider removing that part.' };
    } else {
      q.independentCheck = { status: 'AGREES', model: res.model };
    }
  });
  // Near-duplicates: flag the later question of each pair so the teacher can replace it.
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

module.exports = { blindAnswerCheck };
