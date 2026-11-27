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
const semantic = require('../utils/semanticEmbedder');

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
  NOT_VALIDATED: 'It could not be validated, so it is not delivered',
  DEPTH: 'Too shallow for its level, or it checks an incidental detail instead of an idea that was taught',
  CLUES: 'An option gives the answer away'
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
  // A stem must ask something (M02, 27 Nov: "A team adds a payment feature and runs regression tests…" with no question).
  {
    const st = stemOf(q).trim();
    const asks = /\?\s*$|\?\s*\n/.test(st) || /\?/.test(st.split('\n').slice(-3).join(' ')) ||
      /\b(?:which|what|why|how|when|where|who|whom|whose|identify|select|choose|determine|compute|calculate|find|predict|trace|complete|fill|contrast|compare|explain|describe|state|evaluate|diagnose|order|arrange|name|give)\b/i.test(st.split(/\n|\s\|\s/).filter(l => !/^\s{2,}\S|[;{}]\s*$|^\s*(?:def|for|while|if|else|return|int|class|import|public|private|print|cout|#include)\b/.test(l)).join(' '));
    if (st.length >= 12 && !asks) problems.push({ code: 'COMPLETENESS', detail: 'The question text does not ask anything.' });
  }
  // A question that refers to code ("this loop", "the condition", "what does the program print") must show it.
  // Questions of a code-type plan that ask about data or concepts (e.g. "given the data set …") are not affected.
  const type = q.lectureSource && q.lectureSource.questionType;
  const stem = stemOf(q);
  const talksAboutCode = /\b(?:this|the following|given(?:\s+the)?|the provided|the given|the shown|the above|the below|above|below)\s+(?:(?:python|java|c\+\+|c|javascript|sql|bash|shell|pytorch|docker|dockerfile|yaml|json|html|css|terminal|mysql)\s+)?(?:[\w-]+\s+){0,2}(?:code|program|snippet|fragment|script|dockerfile|loop|function|command|query|method)\b|\bwhat (?:does|will) (?:the|this) (?:code|program|loop|statement|command|query) (?:print|output|return|display)|\bcondition\s+['"`]?[a-z_]\w*\s*(?:[<>=!]=?|>=|<=)|\bwhat is printed\b|\boutput of\b/i.test(stem);
  if (CODE_TYPES.has(type) || talksAboutCode) {
    const showsCode = /```|`[^`]+`|\n\s*\S.*[;{}()=<>\[\]]|^\s*(?:\$|>>>|#include|for\s*\(|while\s*\(|if\s*\(|int\s|def\s|print)|^\s*(?:FROM|RUN|COPY|ADD|WORKDIR|CMD|ENTRYPOINT|ENV|EXPOSE|SELECT|INSERT|CREATE|UPDATE|DELETE|ALTER|DROP|mysql>|docker|git|pip|npm|kubectl)\s+\S/m.test(stem);
    if (talksAboutCode && !showsCode) problems.push({ code: 'COMPLETENESS', detail: 'It refers to code but does not show the code.' });
  }
  // A question must stand on its own: "what did the instructor emphasize during the walkthrough?" cannot be answered
  // by a student who missed that class, and tests memory of the session rather than the subject.
  const refersToClass = /\b(?:the|our|your) (?:instructor|teacher|lecturer|professor|presenter|speaker|trainer)\b|\b(?:during|in|from) the (?:live )?(?:coding )?(?:walkthrough|demo(?:nstration)?|lecture|class|session|video|recording)\b|\bin (?:today's |this |the )?class\b|\bas (?:discussed|explained|shown|mentioned|taught) (?:in|during|earlier|before|above)\b/i.test(stem);
  // "Trace the taught algorithm on …" does not say which algorithm (S05: -96 is right only for the minimum-product
  // subset; a student would compute the maximum product, 192).
  const unnamedTaught = /\b(?:the|this) (?:taught|discussed|covered|presented|given|explained) (?:algorithm|method|approach|procedure|technique|formula|rule|strategy)\b|\b(?:algorithm|method|approach|procedure|formula) (?:as )?(?:taught|discussed|covered|explained) (?:in class|earlier|above)\b/i.test(stem);
  if (unnamedTaught) problems.push({ code: 'COMPLETENESS', detail: 'It asks to apply "the taught algorithm" without naming it, so a student cannot tell which one is meant.' });
  if (refersToClass) problems.push({ code: 'COMPLETENESS', detail: 'It refers to the class or the instructor, so a student who missed the class cannot answer it from the question alone.' });
  // "According to the quick answer check / the notes / the slides …": tests the document, not the subject.
  const refersToMaterial = /\baccording to the (?:notes|slides?|material|document|text|passage|handout|ppt|presentation|quick (?:answer )?check|summary|table|example given|lecture notes)\b|\b(?:in|from) the (?:quick (?:answer )?check|handout|given notes|uploaded (?:notes|document|material))\b/i.test(stem);
  if (refersToMaterial) problems.push({ code: 'COMPLETENESS', detail: 'It refers to the uploaded material itself ("according to the notes/slides"), not to the subject.' });
  // Options written into the question text as well ("… A. … B. … C. …") show the answers twice and break shuffling.
  const listsOptions = /(?:^|\s)\(?A[.)]\s+\S[\s\S]*?\s\(?B[.)]\s+\S[\s\S]*?\s\(?C[.)]\s+\S/.test(stem);
  if (listsOptions) problems.push({ code: 'FORMAT', detail: 'The options are also written inside the question text.' });
  // An option that labels itself ("… (correct rank-based behaviour)", "(the bug)") tells the student which one it is.
  const selfLabel = /\((?:[^)]*\b(?:correct|incorrect|wrong|right answer|the bug|buggy|standard (?:behaviou?r|approach|implementation)|recommended|expected behaviou?r)\b[^)]*)\)\s*$/i;
  if (opts.some(o => selfLabel.test(o))) problems.push({ code: 'CLUES', detail: 'An option labels itself as correct, standard or wrong, which gives the answer away.' });
  // A numeric key must be what the explanation's own working arrives at. S09 (27 Nov): the explanation computed
  // T = 20 / 4.25 = 4.705, then "adjusted" to the key 1.82; none of the options was right and the judge passed it.
  const mismatch = keyContradictsWorking(q);
  if (mismatch) problems.push({ code: 'TECHNICAL_CORRECTNESS', detail: mismatch });
  return problems;
}

const NUM = /-?\d+(?:,\d{3})*(?:\.\d+)?/g;
function keyContradictsWorking(q) {
  const opts = Array.isArray(q.options) ? q.options : [];
  const key = String(opts[keyIndex(q)] ?? q.correctAnswer ?? '');
  const expl = String(q.explanation || q.answerReasoning || '');
  const keyNums = (key.match(NUM) || []).map(x => Number(x.replace(/,/g, '')));
  if (keyNums.length !== 1 || !expl) return null;
  const k = keyNums[0];
  // Results of the working: the number after each "=" or "equals (approximately)" / "≈".
  const results = [...expl.matchAll(/(?:(?<![<>!=])=(?!=)|≈|\bequals?\s+(?:to\s+)?(?:approximately\s+|about\s+|roughly\s+)?|\bis\s+approximately\s+)\s*(-?\d+(?:,\d{3})*(?:\.\d+)?)(?!\s*[\/*×^+])/gi)]
    .map(m => Number(m[1].replace(/,/g, '')));
  if (!results.length) return null;
  const close = (a, b) => Math.abs(a - b) <= Math.max(0.02 * Math.max(Math.abs(a), Math.abs(b)), 0.006);
  const pct = /%|percent/i.test(key);
  if (results.some(r => close(r, k) || (pct && (close(r * 100, k) || close(r, k / 100))))) return null;
  return `The explanation's working arrives at ${results[results.length - 1]}, not the key's ${k}.`;
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
 - grounded: as defined above. A KEY that states exactly what a tool, program or system prints or returns (an error message or code, a status line, console output) is grounded only if that output appears in SOURCE or is computed from code shown in the question; an output the class never saw (e.g. a specific error text for a query that was never run) makes grounded=false.
 - correct: KEY is technically correct (concepts, calculations, code, outputs). For any number, shape or count in the KEY that comes from code or data in the question, recompute it step by step from the question EXACTLY as written (e.g. an input_shape of (28, 28) is not a flattened 784 vector, even if the lecture flattened it); if your result differs from the KEY, correct=false. For ANY claim about what code or an algorithm does (what it counts, skips, misses, prints, which elements are affected), trace it yourself on a small example — the one in SOURCE if there is one — before accepting it. A key that is half right ("skips earlier elements but misses LATER ones" when it actually misses earlier ones) is not correct.
 - alsoDefensible (in step 1): look at each wrong option on its own and ask whether a teacher who taught SOURCE would also accept it. Also read each wrong option as a stand-alone statement about the subject: if it is TRUE (e.g. "an adjacency list is less efficient than a matrix for dense graphs"), it is defensible and must be listed, even if the key is "more" correct. A mapping, order or naming that is only one valid convention among several is defensible too. "Why/purpose/motivation" questions often have two acceptable answers; list them.
 - consistent: any data, state or trace given in the question is internally consistent (e.g. the state "after processing index 2" must reflect indices 0 and 1). Count an inconsistency as complete=false.
 - steps: how many dependent reasoning steps a strong student needs to reach the answer (1 = recall or one direct application).
 - trivial: true ONLY if the question asks an incidental detail that is not itself one of the ideas taught — a default value, a specific number, a name, a version or a setting mentioned in passing — or if its answer is given away by the wording of the question. Asking what a central taught concept means, does, or is used for is NOT trivial.
 - level: "recall" ONLY if the question asks the student to restate a fact, definition, value, name or statement (what is X, which term, what does X stand for, what value does X hold), or if its answer is a single lookup or one arithmetic operation on numbers given in the stem (512 / 4 heads = 128; the dimensions of a matrix the stem already describes). "apply" if the question gives a situation, case, data or code and asks what happens, what to choose or why — even when the lecture discussed the same example. "analyze" if it needs several dependent steps, combining ideas or diagnosing.
 - distractorsValid: every wrong option is clearly wrong; none is correct, equivalent in meaning to another option or the key (e.g. "counts only elements after x" vs "skips elements before x"), duplicated, nonsensical or unrelated.
 - plausible: every wrong option is a realistic student misconception, not a throwaway. An option from a different topic or a different kind of thing than the question asks about (e.g. "training-set size and validation-set size" as the axes of a confusion matrix) is a throwaway: plausible=false.
 - aligned: the options directly answer the question asked.
 - complete: the question contains everything needed (the code when it asks about code or output); no unstated assumption.
 - clear: concise, grammatical, immediately understandable. clear=false if the question shows data, numbers or code that are not needed to reach the answer (padding), or uses a term that is a speech-recognition slip for a real term (e.g. "FX score" for F1 score).
 - fair: no misleading trick.
 - explanationOk: the explanation (if any) is accurate and matches KEY (true if there is none).
3. "problems": one short phrase for each false item.
4. "fact": the single fact or skill the KEY establishes, in at most 8 words (e.g. "linear search per element gives O(n^2)").
Then compare the "fact" of every question with every other question (including OTHER QUESTIONS) and list "duplicates": pairs whose correct answers establish the same fact, even if worded differently or asked from a different angle, so a student who knows one answer knows the other. A definition and a computation that uses it are NOT duplicates.

Return JSON only: {"results":[{"q":1,"working":"...","answer":"B","alsoDefensible":[],"grounded":true,"correct":true,"distractorsValid":true,"plausible":true,"aligned":true,"complete":true,"clear":true,"fair":true,"explanationOk":true,"steps":1,"level":"apply","trivial":false,"problems":[],"fact":"..."}],"duplicates":[[1,3]]}`;
}

async function judgeBatch(items, mode, otherStems) {
  const res = await lectureModel._internal.callJson({
    systemPrompt: 'You are the final quality gate for university multiple-choice questions. Be strict and exact: a question passes only if it is fully correct, grounded and unambiguous. Return JSON only.',
    prompt: buildPrompt(items, mode, otherStems),
    maxTokens: 8192,
    operation: 'FINAL_QUALITY_GATE',
    // When Gemini is unavailable and the gate falls back to Groq, Hard questions are judged by the strongest model: the
    // smaller one undercounted reasoning steps and returned no verdict, rejecting every Hard question (S04, 27 Nov).
    groqModel: items.some(x => String(x.q.difficulty || x.q.metadata?.targetDifficulty || '') === 'Hard') ? 'openai/gpt-oss-120b' : null
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
/**
 * A key that quotes what a tool printed (an error message, "Query OK, ...", a traceback) must quote something the
 * class actually saw. C03 (27 Nov): a question invented the MySQL error for a query the class never ran, and its key
 * was also wrong (a misplaced WHERE gives a syntax error, not "Invalid use of group function"); the judge passed it.
 * Returns the unseen output, or null. Only lecture inputs are checked (topic notes have no class output).
 */
const TOOL_OUTPUT = /(?:\berror\b\s*(?:\d+\s*)?(?:\([^)]*\)\s*)?:\s*(.{6,}))|(\bQuery OK\b.*)|(\b\d+\s+rows?\s+(?:in set|affected).*)|(\bTraceback\b.*)|(\bException in thread\b.*)|(\b[A-Z][A-Za-z]+(?:Error|Exception)\s*:\s*.{4,})/i;
function unseenToolOutput(q, lm) {
  if (!lm || lm.isTopicNotes || !Array.isArray(lm.blocks) || !lm.blocks.length) return null;
  const opts = q.options || [];
  const key = String(opts[keyIndex(q)] ?? q.correctAnswer ?? '');
  const m = key.match(TOOL_OUTPUT);
  if (!m) return null;
  const quoted = (m.slice(1).find(Boolean) || m[0]);
  const norm = (t) => String(t).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const words = norm(quoted).split(' ').filter(w => w.length > 2).slice(0, 8);
  if (words.length < 2) return null;
  const lecture = norm(lm.blocks.map(b => b.text).join(' '));
  const stem = norm(stemOf(q));
  const seen = words.filter(w => lecture.includes(w) || stem.includes(w)).length;
  return seen / words.length >= 0.75 && lecture.includes(norm(quoted).split(' ').slice(0, 3).join(' ')) ? null : quoted.slice(0, 120);
}

async function finalQualityGate(questions, opts = {}) {
  const t0 = Date.now();
  const lm = opts.lectureModel && opts.lectureModel.ok ? opts.lectureModel : null;
  const mode = lm && !lm.isTopicNotes ? 'lecture' : 'domain';
  const context = Array.isArray(opts.context) ? opts.context : [];
  const list = (questions || []).map((q, i) => ({ q, n: i + 1, source: sourceFor(q, lm), problems: deterministicProblems(q) }));
  // Deep lecture = its reading found at least HARD_DEEP_MIN multi-step (Hard) opportunities (default 8: the Transformer
  // lecture has 23, Kruskal 13, MIT DP 8; the introductory classification-metrics class 5).
  const hardCap = lm && lm.capacity && lm.capacity.byDifficulty ? Number(lm.capacity.byDifficulty.hard) || 0 : 0;
  const deepLecture = hardCap >= (parseInt(process.env.HARD_DEEP_MIN, 10) || 8);
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
    // A batch too large for the available provider is split in halves (down to one question) and judged in parts.
    const judgeSplit = async (items) => {
      try { return await judgeBatch(items, mode, others); } catch (e) {
        if (items.length > 1 && /TOO_LARGE|413|too large/i.test(e.message)) {
          const mid = Math.ceil(items.length / 2);
          const [a, b] = [await judgeSplit(items.slice(0, mid)), await judgeSplit(items.slice(mid))];
          if (a.error && b.error) return a;
          return { results: [...(a.results || []), ...(b.results || [])], duplicates: [...(a.duplicates || []), ...(b.duplicates || [])], model: a.model || b.model };
        }
        return { error: e.message };
      }
    };
    let out = await judgeSplit(batch);
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
      else { const unseen = unseenToolOutput(item.q, lm); if (unseen) add('GROUNDING', `The key quotes tool output the class never saw ("${unseen}").`); }
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
      // A judge can undercount steps on a trace ("three produce attempts on a circular buffer" = 1 step). A stem with
      // code or data that asks about the result after several operations is at least two dependent steps.
      const traceFloor = (() => {
        const st = stemOf(item.q);
        const codeLines = st.split(/\n|\s\|\s/).filter(l => /[=;{}()%<>]|\b(?:while|for|if|return)\b/.test(l)).length;
        const several = /\b(?:two|three|four|five|2|3|4|5)\s+(?:items|times|attempts|operations|requests|steps|iterations|calls|pushes|pops|inserts)\b|\bsequentially\b|\bafter (?:the )?(?:second|third|fourth|all)\b|\bthen\b.*\bthen\b/i.test(st);
        return codeLines >= 2 && several ? 2 : 0;
      })();
      const steps = Math.max(Number(r.steps) || 0, traceFloor) || Number(r.steps);
      const label = String(item.q.difficulty || item.q.metadata?.targetDifficulty || '');
      // Depth. First pass (opts.depth !== 'relabel'): a question shallower than its level, or one that checks an incidental
      // detail, is REJECTED so the replacement round writes a deeper one at the same planned level. Relabelling it down
      // (the old behaviour) kept the count but silently turned planned Hard/Medium questions into Easy ones.
      // Replacement pass (opts.depth === 'relabel'): keep the slot under its true label rather than deliver fewer questions.
      const strictDepth = opts.depth !== 'relabel';
      // Hard is relative to the lecture: the most demanding level THIS class supports. A deep class (one whose reading
      // found many multi-step opportunities: traces, calculations, code) supports multi-step questions, so its Hard needs
      // at least two dependent steps. An introductory class's Hard is its best applied question, so there only recall is
      // demoted. (Transformer lecture, 23 Nov: with the relaxed rule everywhere, one-step questions passed as Hard.)
      if (Number.isFinite(steps)) item.q.measuredSteps = steps;
      const level = String(r.level || '').toLowerCase();
      if (label === 'Hard' && level === 'recall') {
        item.relabel = { from: 'Hard', to: 'Medium', reason: 'is answered by recalling a statement; a Hard question must apply or analyse what was taught' };
      } else if (label === 'Hard' && deepLecture && Number.isFinite(steps) && steps < 2) {
        item.relabel = { from: 'Hard', to: 'Medium', reason: `needs ${steps} reasoning step; this lecture supports multi-step Hard questions` };
      } else if (label === 'Medium' && String(r.level || '').toLowerCase() === 'recall') {
        // A "Medium" question answered by remembering a sentence from the lecture is honestly an Easy question.
        item.relabel = { from: 'Medium', to: 'Easy', reason: 'is answered by recalling a statement from the lecture; Medium needs applying it' };
      }
      if (strictDepth && item.relabel) {
        add('DEPTH', `Planned ${label} but it ${item.relabel.reason}.`);
        item.relabel = null;
      } else if (strictDepth && r.trivial === true) {
        add('DEPTH', 'Checks an incidental detail or is answerable without understanding the taught idea.');
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

  // Semantic backup: questions whose stem + correct answer mean the same thing (e.g. "spam marked as spam by mistake:
  // which error?" and "another name for a false positive?") are duplicates even with no words in common. Threshold
  // 0.895 on gemini-embedding-001: on 38 delivered questions it flagged exactly the 3 same-fact pairs and none of the
  // definition-vs-calculation pairs (0.888 and below). Skipped (judge + word backup only) when embeddings are unavailable.
  try {
    const keyText = (q) => { const k = keyIndex(q); return k >= 0 && q.options ? q.options[k] : (q.correctAnswer || ''); };
    const pool = [...list.map(x => ({ n: x.n, q: x.q })), ...context.map((q, i) => ({ n: list.length + i + 1, q }))];
    const vecs = pool.length > 1 ? await semantic.embedMany(pool.map(p => `${stemOf(p.q)} Answer: ${keyText(p.q)}`), { label: 'duplicate check' }) : null;
    const T = parseFloat(process.env.SEMANTIC_DUP_THRESHOLD) || 0.895;
    if (vecs) {
      for (let i = 0; i < pool.length; i++) {
        for (let j = i + 1; j < pool.length; j++) {
          if (pool[i].n > list.length && pool[j].n > list.length) continue;
          const c = semantic.cosine(vecs[i], vecs[j]);
          if (c !== null && c >= T) dupPairs.push([pool[i].n, pool[j].n]);
        }
      }
    }
  } catch (_) { /* semantic duplicate check is a backup only */ }

  // Same answer, same fact: two questions whose keys are the same text ("Binary cross entropy" twice, S03 27 Nov) test
  // the same point even when the stems differ. Checked in code, so it holds when embeddings are unavailable.
  {
    const keyText = (q) => { const k = keyIndex(q); return norm(k >= 0 && q.options ? q.options[k] : (q.correctAnswer || '')); };
    const pool = [...list.map(x => ({ n: x.n, q: x.q })), ...context.map((q, i) => ({ n: list.length + i + 1, q }))];
    for (let i = 0; i < pool.length; i++) for (let j = i + 1; j < pool.length; j++) {
      if (pool[i].n > list.length && pool[j].n > list.length) continue;
      const a = keyText(pool[i].q), b = keyText(pool[j].q);
      if (a.length >= 4 && a === b && !/^\d+(?:\.\d+)?$/.test(a)) dupPairs.push([pool[i].n, pool[j].n]);
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
    DUPLICATE: 'duplicate of another question', FAIRNESS: 'a misleading trick', EXPLANATION: 'an inaccurate explanation', NOT_VALIDATED: 'could not be validated', DEPTH: 'too shallow for its level', CLUES: 'an option that gives the answer away'
  };
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([c, n]) => `${n} ${label[c] || c}`).join(', ');
}

module.exports = { finalQualityGate, describeRejections, deterministicProblems, unseenToolOutput, keyContradictsWorking, CRITERIA };
