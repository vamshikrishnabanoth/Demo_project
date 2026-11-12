/**
 * server/engine/validators/finalQualityGate.js
 *
 * Final Quality Gate — every delivered MCQ must earn its place (KMIT non-negotiable quality spec).
 *
 * Runs after generation, grounding and difficulty calibration (those stay separate responsibilities)
 * and before anything reaches the teacher's review. Each question is judged on its own; no average
 * can compensate for an individual failure, and no criterion compensates for another:
 *
 *   Absolute criteria                      Mandatory standards
 *   1 GROUNDING                            7 WORDING (clear, concise, grammatical)
 *   2 TECHNICAL_CORRECTNESS                8 FORMAT (exactly 4 distinct, meaningful options)
 *   3 SINGLE_ANSWER                        9 DISTRACTOR_PLAUSIBILITY (realistic misconceptions)
 *   4 DISTRACTOR_VALIDITY                 12 DUPLICATE (no repeated assessment of the same point)
 *   5 ALIGNMENT                           13 FAIRNESS (no misleading tricks)
 *   6 COMPLETENESS                        14 EXPLANATION (accurate explanation and key)
 * (10 difficulty is calibrated by the evaluator; 11 variety is planned from the lecture.)
 *
 * The judging model first answers each question WITHOUT the key (independent solve), then audits it
 * against the teacher's own words for that teaching point. A question with no verdict (provider down,
 * missing from the reply) is rejected as NOT_VALIDATED — it is never assumed correct.
 * Every rejection keeps its reasons for traceability.
 *
 * Cost: one batched call per 10 questions (run in parallel), the same order as the old blind check.
 */
'use strict';

const lectureModel = require('../intelligence/lectureModel');

const CRITERIA = {
  GROUNDING: 'Not supported by the material for this input mode',
  TECHNICAL_CORRECTNESS: 'The answer key (or a statement, calculation, code or output) is not correct',
  SINGLE_ANSWER: 'More than one option is defensibly correct',
  DISTRACTOR_VALIDITY: 'A wrong option is also correct, equivalent to another option, duplicated, nonsensical or unrelated',
  ALIGNMENT: 'The options do not directly answer the question',
  COMPLETENESS: 'The question lacks information it needs or relies on an unstated assumption',
  WORDING: 'The wording is unclear, ungrammatical or ambiguous',
  FORMAT: 'The question does not have exactly four distinct, meaningful options with a valid key',
  DISTRACTOR_PLAUSIBILITY: 'A distractor is not a plausible misconception',
  DUPLICATE: 'It tests the same point and skill as another question in the quiz',
  FAIRNESS: 'It relies on a misleading trick',
  EXPLANATION: 'The explanation is inaccurate or does not match the key',
  NOT_VALIDATED: 'It could not be validated, so it is not delivered'
};

const CODE_TYPES = new Set(['output', 'debug', 'trace']);
const BATCH = 10;

const stemOf = (q) => String(q.question || q.questionText || q.stem || '').trim();
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function keyIndex(q) {
  const opts = Array.isArray(q.options) ? q.options : [];
  if (typeof q.correctAnswerIndex === 'number' && opts[q.correctAnswerIndex] !== undefined) return q.correctAnswerIndex;
  const key = q.correctAnswer ?? q.correct_answer ?? q.answer;
  return opts.findIndex(o => o === key);
}

/** Deterministic checks (criteria 8 and the code part of 6): no model needed, never skipped. */
function deterministicProblems(q) {
  const problems = [];
  const opts = Array.isArray(q.options) ? q.options.map(o => String(o ?? '').trim()) : [];
  if (opts.length !== 4 || opts.some(o => o.length === 0)) problems.push({ code: 'FORMAT', detail: `Has ${opts.length} options; exactly four non-empty options are required.` });
  else if (new Set(opts.map(norm)).size !== 4) problems.push({ code: 'FORMAT', detail: 'Two options are the same.' });
  if (keyIndex(q) < 0) problems.push({ code: 'FORMAT', detail: 'The answer key is not one of the options.' });
  if (stemOf(q).length < 12) problems.push({ code: 'COMPLETENESS', detail: 'The question text is missing or too short.' });
  // A question that refers to code ("this loop", "the condition", "what does the program print") must show it.
  // Questions of a code-type plan that ask about data or concepts (e.g. "given the data set …") are not affected.
  const type = q.lectureSource && q.lectureSource.questionType;
  const stem = stemOf(q);
  const talksAboutCode = /\b(?:this|the following|given|above|below)\s+(?:code|program|snippet|loop|statement|line|function|condition|command|query)\b|\bwhat (?:does|will) (?:the|this) (?:code|program|loop|statement|command|query) (?:print|output|return|display)|\bcondition\s+['"`]?[a-z_]\w*\s*(?:[<>=!]=?|>=|<=)|\bwhat is printed\b|\boutput of\b/i.test(stem);
  if (CODE_TYPES.has(type) || talksAboutCode) {
    const showsCode = /```|`[^`]+`|\n\s*\S.*[;{}()=<>\[\]]|^\s*(?:\$|>>>|#include|for\s*\(|while\s*\(|if\s*\(|int\s|def\s|print)/m.test(stem);
    if (talksAboutCode && !showsCode) problems.push({ code: 'COMPLETENESS', detail: 'It refers to code but does not show the code.' });
  }
  return problems;
}

/** The teacher's own words for this question's teaching point (the allowed source of specific facts). */
function sourceFor(q, lm) {
  if (!lm || !Array.isArray(lm.units)) return null;
  const s = q.lectureSource || {};
  const unit = (s.unitId && lm.units.find(u => u.id === s.unitId))
    || lm.units.find(u => s.subtopic && String(u.subtopic).toLowerCase() === String(s.subtopic).toLowerCase());
  if (!unit) return null;
  // Full passage for the point (gaps between cited blocks filled). The reader's one-line summary is shown but
  // marked as fallible: the transcript is the authority (a wrong summary once misled generator and judge alike).
  const text = lectureModel.unitEvidenceText(lm, unit, 3000);
  const summary = unit.statement ? `\n(Reader's one-line summary, may be imprecise — trust the transcript above: ${unit.statement})` : '';
  return `${text}${summary}`;
}

function buildPrompt(items, mode, otherStems) {
  const sourceRule = mode === 'lecture'
    ? 'SOURCE is what the teacher actually taught for this question. Every specific fact, number, example, code line and claim in the question, its key and its explanation must be stated in SOURCE or follow directly from it. General subject knowledge may be used ONLY to check correctness, never to add things the teacher did not teach.'
    : 'There is no lecture for this input (topic-only or reference notes). Specific facts must be standard, verifiable subject knowledge (or follow from SOURCE when given).';
  const body = items.map(({ q, n, source }) => {
    const opts = (q.options || []).map((o, k) => `  ${'ABCD'[k] || k}) ${o}`).join('\n');
    const key = 'ABCD'[keyIndex(q)] || '?';
    const type = q.lectureSource && q.lectureSource.questionType ? ` | type ${q.lectureSource.questionType}` : '';
    const expl = q.explanation || q.answerReasoning || '';
    return `Q${n} [${q.difficulty || q.metadata?.targetDifficulty || '?'}${type}]\nSOURCE: """${source || '(none)'}"""\nQUESTION: ${stemOf(q)}\n${opts}\nKEY: ${key}${expl ? `\nEXPLANATION: ${String(expl).slice(0, 400)}` : ''}`;
  }).join('\n\n');
  const others = otherStems.length ? `\n\nOTHER QUESTIONS IN THIS QUIZ (only for the duplicate check):\n${otherStems.map(o => `Q${o.n}. ${o.stem}`).join('\n')}` : '';
  return `${body}${others}

${sourceRule}

For EACH question:
1. Solve it yourself from the question and options only, as a strong student would, ignoring KEY: one line of working, then your letter ("answer"), and any OTHER letters an expert could also defend as correct ("alsoDefensible").
2. Then judge strictly (true only if fully satisfied):
 - grounded: as defined above.
 - correct: KEY is technically correct (concepts, calculations, code, outputs). For ANY claim about what code or an algorithm does (what it counts, skips, misses, prints, which elements are affected), trace it yourself on a small example — the one in SOURCE if there is one — before accepting it. A key that is half right ("skips earlier elements but misses LATER ones" when it actually misses earlier ones) is not correct.
 - alsoDefensible (in step 1): look at each wrong option on its own and ask whether a teacher who taught SOURCE would also accept it. "Why/purpose/motivation" questions often have two acceptable answers; list them.
 - consistent: any data, state or trace given in the question is internally consistent (e.g. the state "after processing index 2" must reflect indices 0 and 1). Count an inconsistency as complete=false.
 - steps: how many dependent reasoning steps a strong student needs to reach the answer (1 = recall or one direct application).
 - distractorsValid: every wrong option is clearly wrong; none is correct, equivalent in meaning to another option or the key (e.g. "counts only elements after x" vs "skips elements before x"), duplicated, nonsensical or unrelated.
 - plausible: every wrong option is a realistic student misconception, not a throwaway.
 - aligned: the options directly answer the question asked.
 - complete: the question contains everything needed (the code when it asks about code or output); no unstated assumption.
 - clear: concise, grammatical, immediately understandable.
 - fair: no misleading trick.
 - explanationOk: the explanation (if any) is accurate and matches KEY (true if there is none).
3. "problems": one short phrase for each false item.
4. "fact": the single fact or skill the KEY establishes, in at most 8 words (e.g. "linear search per element gives O(n^2)").
Then compare the "fact" of every question with every other question (including OTHER QUESTIONS) and list "duplicates": pairs whose correct answers establish the same fact, even if worded differently or asked from a different angle, so a student who knows one answer knows the other. A definition and a computation that uses it are NOT duplicates.

Return JSON only: {"results":[{"q":1,"working":"...","answer":"B","alsoDefensible":[],"grounded":true,"correct":true,"distractorsValid":true,"plausible":true,"aligned":true,"complete":true,"clear":true,"fair":true,"explanationOk":true,"steps":1,"problems":[],"fact":"..."}],"duplicates":[[1,3]]}`;
}

async function judgeBatch(items, mode, otherStems) {
  const res = await lectureModel._internal.callJson({
    systemPrompt: 'You are the final quality gate for university multiple-choice questions. Be strict and exact: a question passes only if it is fully correct, grounded and unambiguous. Return JSON only.',
    prompt: buildPrompt(items, mode, otherStems),
    maxTokens: 8192,
    operation: 'FINAL_QUALITY_GATE'
  });
  const d = res.data || {};
  const results = Array.isArray(d) ? d : (Array.isArray(d.results) ? d.results : (Object.values(d).find(v => Array.isArray(v)) || []));
  return { results, duplicates: Array.isArray(d.duplicates) ? d.duplicates : [], model: res.model };
}

/**
 * @param {Array} questions candidate MCQs (mutated: each gets `qualityGate`)
 * @param {object} opts { lectureModel?: model with units/blocks, context?: already-accepted questions (duplicate check only) }
 * @returns {Promise<{accepted:Array, rejected:Array<{question, reasons}>, model?:string, ms:number}>}
 */
async function finalQualityGate(questions, opts = {}) {
  const t0 = Date.now();
  const lm = opts.lectureModel && opts.lectureModel.ok ? opts.lectureModel : null;
  const mode = lm && !lm.isTopicNotes ? 'lecture' : 'domain';
  const context = Array.isArray(opts.context) ? opts.context : [];
  const list = (questions || []).map((q, i) => ({ q, n: i + 1, source: sourceFor(q, lm), problems: deterministicProblems(q) }));
  const contextStems = context.map((q, i) => ({ n: list.length + i + 1, stem: stemOf(q).slice(0, 220) }));

  const batches = [];
  for (let i = 0; i < list.length; i += BATCH) batches.push(list.slice(i, i + BATCH));
  const models = new Set();
  const dupPairs = [];
  await Promise.all(batches.map(async (batch) => {
    const others = [
      ...list.filter(x => !batch.includes(x)).map(x => ({ n: x.n, stem: stemOf(x.q).slice(0, 220) })),
      ...contextStems
    ];
    let out = null;
    try { out = await judgeBatch(batch, mode, others); } catch (e) { out = { error: e.message }; }
    if (out.model) models.add(out.model);
    if (Array.isArray(out.duplicates)) dupPairs.push(...out.duplicates);
    for (const item of batch) {
      const r = out.results ? (out.results.find(x => Number(x.q) === item.n) || null) : null;
      item.verdict = r;
      if (!r || typeof r.answer !== 'string') {
        item.problems.push({ code: 'NOT_VALIDATED', detail: out.error ? `Validation service unavailable (${String(out.error).slice(0, 80)}).` : 'No verdict was returned for this question.' });
        continue;
      }
      const k = keyIndex(item.q);
      const solved = 'ABCD'.indexOf(String(r.answer).trim().toUpperCase().charAt(0));
      const also = (Array.isArray(r.alsoDefensible) ? r.alsoDefensible : []).map(l => 'ABCD'.indexOf(String(l).trim().toUpperCase().charAt(0))).filter(x => x >= 0 && x !== solved);
      const why = (Array.isArray(r.problems) ? r.problems : []).filter(Boolean).join('; ');
      const add = (code, detail) => item.problems.push({ code, detail: detail || why || CRITERIA[code] });
      if (r.grounded === false) add('GROUNDING');
      if (r.correct === false) add('TECHNICAL_CORRECTNESS');
      else if (solved !== k) add('TECHNICAL_CORRECTNESS', `An independent solve chose "${item.q.options[solved] ?? r.answer}", not the key.${r.working ? ` (${String(r.working).slice(0, 160)})` : ''}`);
      if (also.length > 0) add('SINGLE_ANSWER', `Also defensible: "${also.map(x => item.q.options[x]).join('", "')}".`);
      if (r.distractorsValid === false) add('DISTRACTOR_VALIDITY');
      if (r.plausible === false) add('DISTRACTOR_PLAUSIBILITY');
      if (r.aligned === false) add('ALIGNMENT');
      if (r.complete === false) add('COMPLETENESS');
      else if (r.consistent === false) add('COMPLETENESS', 'The data or state given in the question is inconsistent.');
      if (r.clear === false) add('WORDING');
      if (r.fair === false) add('FAIRNESS');
      if (r.explanationOk === false) add('EXPLANATION');
      // Criterion 10 (difficulty fits): a "Hard" question needing fewer than two dependent steps keeps its place
      // only under its true label — it is relabelled Medium (and reported), never passed off as Hard.
      const steps = Number(r.steps);
      const label = String(item.q.difficulty || item.q.metadata?.targetDifficulty || '');
      if (label === 'Hard' && Number.isFinite(steps) && steps < 2) {
        item.relabel = { from: 'Hard', to: 'Medium', reason: `needs ${steps} reasoning step${steps === 1 ? '' : 's'}, not the two or more a Hard question requires` };
      }
    }
  }));

  // Backup duplicate check on the judge's own "fact" summaries (a judge may list facts but miss the pair).
  const STOP = new Set(['the', 'and', 'for', 'with', 'from', 'that', 'this', 'each', 'into', 'are', 'its', 'per', 'has', 'have', 'when', 'than']);
  const factWords = list.map(x => ({ n: x.n, w: new Set(norm(x.verdict && x.verdict.fact).split(' ').filter(t => t.length > 2 && !STOP.has(t))) }));
  for (let i = 0; i < factWords.length; i++) {
    for (let j = i + 1; j < factWords.length; j++) {
      const A = factWords[i].w; const B = factWords[j].w;
      if (A.size < 3 || B.size < 3) continue;
      const inter = [...A].filter(t => B.has(t)).length;
      if (inter / (A.size + B.size - inter) >= 0.6) dupPairs.push([factWords[i].n, factWords[j].n]);
    }
  }

  // Duplicates: within the new questions, keep the earlier one; against already-accepted context, reject the new one.
  for (const pair of dupPairs) {
    if (!Array.isArray(pair) || pair.length < 2) continue;
    const [a, b] = pair.map(Number).sort((x, y) => x - y);
    if (a === b || a < 1) continue;
    const later = list.find(x => x.n === b);
    const earlier = list.find(x => x.n === a);
    const ctx = b > list.length ? context[b - list.length - 1] : null;
    if (later && earlier) later.problems.push({ code: 'DUPLICATE', detail: `Tests the same point and skill as Q${a}.` });
    else if (earlier && ctx) earlier.problems.push({ code: 'DUPLICATE', detail: 'Tests the same point and skill as a question already in the quiz.' });
  }

  const accepted = [];
  const rejected = [];
  for (const item of list) {
    const codes = [...new Set(item.problems.map(p => p.code))];
    item.q.qualityGate = {
      status: codes.length ? 'REJECTED' : 'PASSED',
      criteria: codes,
      reasons: item.problems.map(p => `${p.code}: ${p.detail}`),
      model: [...models].join(', ') || null,
      grounding: mode
    };
    if (codes.length === 0 && item.relabel) {
      item.q.difficulty = item.relabel.to;
      if (item.q.metadata) item.q.metadata.targetDifficulty = item.relabel.to;
      if (item.q.lectureSource) item.q.lectureSource.measuredDifficulty = item.relabel.to;
      item.q.qualityGate.relabeled = item.relabel;
    }
    if (codes.length === 0) {
      // Keep the independent solve as the review badge the teacher already sees.
      item.q.independentCheck = { status: 'AGREES', model: [...models][0] || null };
      accepted.push(item.q);
    } else {
      rejected.push({ question: item.q, reasons: item.q.qualityGate.reasons, criteria: codes });
    }
  }
  return { accepted, rejected, model: [...models].join(', ') || null, ms: Date.now() - t0 };
}

/** Plain-language summary of rejections for the teacher's notice. */
function describeRejections(rejected) {
  const counts = {};
  rejected.forEach(r => r.criteria.forEach(c => { counts[c] = (counts[c] || 0) + 1; }));
  const label = {
    GROUNDING: 'not supported by the lecture', TECHNICAL_CORRECTNESS: 'incorrect answer or content', SINGLE_ANSWER: 'more than one correct answer',
    DISTRACTOR_VALIDITY: 'an invalid wrong option', ALIGNMENT: 'options not answering the question', COMPLETENESS: 'missing information',
    WORDING: 'unclear wording', FORMAT: 'wrong option format', DISTRACTOR_PLAUSIBILITY: 'implausible wrong options',
    DUPLICATE: 'duplicate of another question', FAIRNESS: 'a misleading trick', EXPLANATION: 'an inaccurate explanation', NOT_VALIDATED: 'could not be validated'
  };
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([c, n]) => `${n} ${label[c] || c}`).join(', ');
}

module.exports = { finalQualityGate, describeRejections, deterministicProblems, CRITERIA };
