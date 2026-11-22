/**
 * Deterministic tests for the shared lecture model (engine/intelligence/lectureModel.js).
 * No LLM calls: covers block building with real timestamps, terminal splitting, quote
 * verification, angle rules, capacity, allocation, request planning and the planner mapping.
 */
'use strict';
const assert = require('assert');
const lm = require('../engine/intelligence/lectureModel');
const planner = require('../engine/agents/agent1Planner');
const { buildBlocks, quoteSupported, sanitiseAngles, computeCapacity, allocate } = lm._internal;

const results = [];
function test(name, fn) {
  try { fn(); results.push(true); console.log(`  ✅ PASS: ${name}`); }
  catch (e) { results.push(false); console.log(`  ❌ FAIL: ${name}\n     ${e.message}`); }
}

// ── Blocks keep real Whisper times ────────────────────────────────────────────
test('Speech blocks keep the real start/end times of their Whisper segments', () => {
  const segments = [];
  for (let i = 0; i < 30; i++) segments.push({ start: i * 10, end: i * 10 + 9.5, text: `sentence number ${i} about paging and frames in memory management` });
  const { speech, timed } = buildBlocks({ text: '', segments });
  assert.ok(timed);
  assert.ok(speech.length >= 4, `expected several blocks, got ${speech.length}`);
  assert.strictEqual(speech[0].start, 0);
  assert.strictEqual(speech[speech.length - 1].end, 299.5);
  for (let i = 1; i < speech.length; i++) assert.ok(speech[i].start >= speech[i - 1].end - 0.5, 'blocks are in order and non-overlapping');
});

test('A pasted terminal session is split per command so each command can be a teaching point', () => {
  const text = '$ ps aux | grep python\nalice 4211 python3 train.py\n$ kill -STOP 4211\n$ ps -o pid,stat -p 4211\n 4211 T\n$ kill -CONT 4211\n$ jobs\n[1]+ Running backup.py &\n$ fg %1';
  const { material } = buildBlocks({ text });
  assert.ok(material.length >= 3, `expected >=3 terminal blocks, got ${material.length}`);
  assert.ok(material.every(b => b.kind === 'TERMINAL'));
});

test('Slides keep their slide numbers', () => {
  const text = '--- Slide 1 ---\nDeadlock: a set of processes each waiting for a resource held by another.\n\n--- Slide 2 ---\nFour necessary conditions: mutual exclusion, hold and wait, no preemption, circular wait.';
  const { material } = buildBlocks({ text });
  assert.deepStrictEqual(material.map(b => b.slide), [1, 2]);
});

// ── Quote verification ────────────────────────────────────────────────────────
test('Quotes are verified against the source; invented quotes are rejected', () => {
  const src = 'The page table maps each virtual page number to a physical frame number in memory.';
  assert.ok(quoteSupported('maps each virtual page number to a physical frame', src));
  assert.ok(!quoteSupported('the TLB is flushed on every context switch by hardware', src));
});

// ── Angle rules ───────────────────────────────────────────────────────────────
test('Trace/output angles are dropped for non-code units; recall is never Hard; tracing is never Easy', () => {
  const angles = sanitiseAngles({ kind: 'DEFINITION', depth: 'EXPLAINED', subtopic: 'Paging', angles: [
    { type: 'output', difficulty: 'medium', focus: 'x' },
    { type: 'recall', difficulty: 'hard', focus: 'y' },
    { type: 'comparison', difficulty: 'medium', focus: 'z' }
  ] });
  assert.ok(!angles.some(a => a.type === 'output'));
  assert.strictEqual(angles.find(a => a.type === 'recall').difficulty, 'medium');
  const codeAngles = sanitiseAngles({ kind: 'CODE', depth: 'DEMONSTRATED', subtopic: 'loop', angles: [{ type: 'trace', difficulty: 'easy', focus: 't' }] });
  assert.strictEqual(codeAngles[0].difficulty, 'medium');
});

test('A merely mentioned unit supports at most one easy question', () => {
  const angles = sanitiseAngles({ kind: 'DEFINITION', depth: 'MENTIONED', subtopic: 'RAID', angles: [
    { type: 'recall', difficulty: 'easy', focus: 'a' }, { type: 'comparison', difficulty: 'hard', focus: 'b' }
  ] });
  assert.strictEqual(angles.length, 1);
  assert.strictEqual(angles[0].difficulty, 'easy');
});

// ── Capacity + allocation ─────────────────────────────────────────────────────
function fakeModel() {
  const units = [
    { id: 'U01', topic: 'Paging', subtopic: 'Page table', kind: 'MECHANISM', depth: 'EXPLAINED', blocks: ['B01'], statement: 's1', quote: 'q', misconceptions: ['m'], angles: [{ type: 'recall', difficulty: 'easy', focus: 'a' }, { type: 'mechanism', difficulty: 'medium', focus: 'b' }] },
    { id: 'U02', topic: 'Paging', subtopic: 'Address translation', kind: 'CALCULATION', depth: 'DEMONSTRATED', blocks: ['B02'], statement: 's2', quote: 'q', misconceptions: [], angles: [{ type: 'calculation', difficulty: 'medium', focus: 'c' }, { type: 'edge_case', difficulty: 'hard', focus: 'd' }] },
    { id: 'U03', topic: 'Segmentation', subtopic: 'Segment table', kind: 'DEFINITION', depth: 'EXPLAINED', blocks: ['B03'], statement: 's3', quote: 'q', misconceptions: [], angles: [{ type: 'recall', difficulty: 'easy', focus: 'e' }] }
  ];
  return {
    ok: true,
    units,
    topics: [{ name: 'Paging', share: 70 }, { name: 'Segmentation', share: 30 }],
    capacity: computeCapacity(units),
    blocks: [{ id: 'B01', text: 'page table text' }, { id: 'B02', text: 'translation text' }, { id: 'B03', text: 'segment text' }]
  };
}

test('Capacity counts distinct angles by difficulty', () => {
  const cap = fakeModel().capacity;
  assert.deepStrictEqual(cap.byDifficulty, { easy: 2, medium: 2, hard: 1 });
  assert.strictEqual(cap.total, 5);
});

test('Allocation never exceeds a cap and assigns the full request when capacity allows', () => {
  const out = allocate(7, { a: 5, b: 1, c: 1 }, { a: 3, b: 10, c: 10 });
  assert.strictEqual(out.a + out.b + out.c, 7);
  assert.ok(out.a <= 3);
});

test('Balanced plan follows capacity, not a fixed one-third split, and reports shortfall honestly', () => {
  const m = fakeModel();
  const p = lm.planRequest(m, 4, 'Balanced');
  assert.strictEqual(p.deliverable, 4);
  assert.ok(p.byDifficulty.hard <= 1);
  const big = lm.planRequest(m, 12, 'Balanced');
  assert.strictEqual(big.deliverable, 5);
  assert.strictEqual(big.shortfall, 7);
  assert.ok(big.shortfallReasons[0].includes('supports 5'));
});

test('Code questions exist at every difficulty: taught code also gets a one-step Easy code question', () => {
  const a = sanitiseAngles({ kind: 'CODE', depth: 'DEMONSTRATED', subtopic: 'nested loop', angles: [{ type: 'recall', difficulty: 'easy', focus: 'r' }, { type: 'trace', difficulty: 'medium', focus: 't' }] });
  assert.ok(a.some(x => x.difficulty === 'easy' && ['output', 'debug'].includes(x.type)));
  assert.ok(!a.some(x => x.type === 'trace' && x.difficulty === 'easy'));
});

test('Code read aloud is recognised as code; ordinary explanation is not', () => {
  const { spokenCodeHits } = lm._internal;
  assert.ok(spokenCodeHits('for x equal to 0, x less than size, x plus plus. Inside this I declare int count equal to 0 and print f a of x') >= 2);
  assert.strictEqual(spokenCodeHits('A frequency count array has one index for every possible value, so negative values need a mapping.'), 0);
});

test('Replacing a question keeps the difficulty, stays on the same point with a new type, and never repeats a used pair', () => {
  const m = fakeModel();
  m.units[0].angles.push({ type: 'scenario', difficulty: 'medium', focus: 'f' });
  const p = lm.planRequest(m, 1, 'Medium', { replace: { unitId: 'U01', type: 'mechanism', difficulty: 'Medium', usedPairs: [{ unitId: 'U01', type: 'mechanism' }] } });
  assert.strictEqual(p.selected.length, 1);
  assert.strictEqual(p.selected[0].unit.id, 'U01');
  assert.strictEqual(p.selected[0].angle.type, 'scenario');
  assert.ok(p.reserves.length <= 2);
  const p2 = lm.planRequest(m, 1, 'Medium', { replace: { unitId: 'U01', type: 'mechanism', difficulty: 'Medium',
    usedPairs: [{ unitId: 'U01', type: 'mechanism' }, { unitId: 'U01', type: 'scenario' }] } });
  assert.ok(p2.selected.every(s => !(s.unit.id === 'U01' && ['mechanism', 'scenario'].includes(s.angle.type))));
  assert.ok(p2.selected.every(s => s.difficulty === 'medium' || s.difficulty === 'easy' || s.difficulty === 'hard'));
});

test('A teaching point\'s evidence fills small gaps between cited blocks and keeps every block when trimmed', () => {
  const blocks = ['B1', 'B2', 'B3', 'B4'].map((id, i) => ({ id, source: 'SPEECH', start: i * 60, end: i * 60 + 59, text: `${id} ` + 'x'.repeat(1000) }));
  const model = { blocks };
  const txt = lm.unitEvidenceText(model, { blocks: ['B1', 'B3', 'B4'] }, 2400);
  assert.ok(txt.includes('B2 '), 'the skipped middle block is included');
  ['B1 ', 'B3 ', 'B4 '].forEach(b => assert.ok(txt.includes(b), `${b} kept after trimming`));
  assert.ok(txt.length <= 2400 + 8);
});

test('Shuffling options keeps explanation references pointing at the right options', () => {
  const gen = require('../engine/agents/agent2Generator');
  for (let k = 0; k < 10; k++) {
    const q = { options: ['right answer', 'wrong two', 'wrong three', 'wrong four'], correctAnswer: 'right answer', explanation: 'Option 1 is right; option 3 is a near miss.' };
    gen.shuffleOptions(q);
    const m = q.explanation.match(/Option ([A-D]) is right; option ([A-D])/);
    assert.ok(m, q.explanation);
    assert.strictEqual(q.options['ABCD'.indexOf(m[1])], 'right answer');
    assert.strictEqual(q.options['ABCD'.indexOf(m[2])], 'wrong three');
  }
});

test('Single-difficulty plan only uses that difficulty', () => {
  const p = lm.planRequest(fakeModel(), 3, 'Hard');
  assert.strictEqual(p.deliverable, 1);
  assert.ok(p.selected.every(s => s.difficulty === 'hard'));
});

test('Planner maps lecture-model units to targets without re-tiering them', () => {
  const m = fakeModel();
  const tu = lm.toTeachingUnits(m, lm.planRequest(m, 3, 'Balanced'));
  const plan = planner._planFromLectureModel(tu.all, 'Balanced', 3, {});
  assert.strictEqual(plan.assessmentTargets.length, 3);
  const planned = tu.primary.map(u => u.plannedDifficulty).sort();
  assert.deepStrictEqual(plan.assessmentTargets.map(t => t.targetDifficulty).sort(), planned);
  assert.ok(plan.assessmentTargets.every(t => t.allowDifficultyRelabel === true));
  assert.ok(plan.assessmentTargets.every(t => typeof t.supportingEvidence === 'string' && t.supportingEvidence.length > 0));
});

test('A rejected Medium/Hard slot is refilled with a reserve of the same planned tier (no drift to Easy)', () => {
  const orch = require('../engine/pipelineOrchestrator');
  const pool = [
    { targetId: 'R01', allocatedTier: 'Easy', lectureUnitId: 'U01' },
    { targetId: 'R02', allocatedTier: 'Easy', lectureUnitId: 'U02' },
    { targetId: 'R03', allocatedTier: 'Hard', lectureUnitId: 'U05' },
    { targetId: 'R04', allocatedTier: 'Medium', lectureUnitId: 'U03' },
    { targetId: 'R05', allocatedTier: 'Medium', lectureUnitId: 'U04' }
  ];
  assert.strictEqual(orch.takeLectureModelReserve(pool, 'Medium', 'U03').targetId, 'R05');
  const hard = orch.takeLectureModelReserve(pool, 'Hard', 'U09');
  assert.strictEqual(hard.targetId, 'R03');
  assert.strictEqual(hard.targetDifficulty, 'Hard');
  const plan = { allocatedDistribution: { Easy: 1, Medium: 3, Hard: 1 } };
  const delivered = [{ metadata: { targetDifficulty: 'Easy' } }, { metadata: { targetDifficulty: 'Medium' } }, { metadata: { targetDifficulty: 'Hard' } }];
  assert.strictEqual(orch.lectureModelTierNeeded(plan, delivered), 'Medium');
  // After 3 failed attempts a Hard slot is filled at Medium, never jumping to Easy first.
  const pool2 = [{ targetId: 'R10', allocatedTier: 'Easy' }, { targetId: 'R11', allocatedTier: 'Medium' }, { targetId: 'R12', allocatedTier: 'Hard' }];
  const r = orch.takeLectureModelReserve(pool2, 'Hard', null, { slotAttempts: 3, slotPlannedTier: 'Hard' });
  assert.strictEqual(r.targetId, 'R11');
  assert.strictEqual(r.slotPlannedTier, 'Hard');
  const pool3 = [{ targetId: 'R20', allocatedTier: 'Easy' }, { targetId: 'R21', allocatedTier: 'Medium' }];
  assert.strictEqual(orch.takeLectureModelReserve(pool3, 'Hard', null, null).targetId, 'R21');
  // No Hard opportunity left: the same Hard opportunity is retried with a fresh question until the limit.
  const retry = orch.takeLectureModelReserve([], 'Hard', 'U05', { targetId: 'T03', allocatedTier: 'Hard', slotAttempts: 1, slotPlannedTier: 'Hard' });
  assert.strictEqual(retry.targetDifficulty, 'Hard');
  assert.strictEqual(retry.targetId, 'T03~2');
  assert.strictEqual(orch.takeLectureModelReserve([], 'Medium', null, { targetId: 'T04' }), null);
});

async function asyncTests() {
  const llmRouter = require('../engine/adapter/llmRouter');
  const evaluator = require('../engine/agents/agent3Evaluator');
  const original = llmRouter.complete;
  try {
    llmRouter.complete = async () => JSON.stringify({ evaluations: [
      { id: 'Q2', status: 'FAIL', verdict: 'FAIL', failureReasons: ['AMBIGUOUS_DISTRACTOR'] },
      { id: 'Q1', status: 'PASS', verdict: 'PASS', failureReasons: [] }
    ] });
    const items = [1, 2, 3].map(i => ({ candidateMCQ: { questionText: `q${i}`, options: ['a', 'b', 'c', 'd'], correctAnswer: 'a' }, target: { concept: 'c', targetDifficulty: 'Easy', supportingEvidence: 'evidence text for the question' } }));
    const out = await evaluator.batchCriticResponses(items, {});
    test('Batched audit maps verdicts by question id; a missing verdict falls back to a single call', () => {
      assert.strictEqual(JSON.parse(out[0]).status, 'PASS');
      assert.strictEqual(JSON.parse(out[1]).status, 'FAIL');
      assert.strictEqual(out[2], null);
    });
    llmRouter.complete = async () => { throw new Error('provider down'); };
    const down = await evaluator.batchCriticResponses(items, {});
    test('Batched audit failure falls back to single-question evaluation for every item', () => {
      assert.deepStrictEqual(down, [null, null, null]);
    });
  } finally {
    llmRouter.complete = original;
  }
}

async function gateTests() {
  const { finalQualityGate, deterministicProblems } = require('../engine/validators/finalQualityGate');
  const mk = (stem, options, key, extra = {}) => ({ question: stem, options, correctAnswer: key, difficulty: 'Easy', ...extra });
  test('Gate format check: exactly four distinct options and a valid key; code questions must show the code', () => {
    assert.ok(deterministicProblems(mk('Which is right here?', ['a', 'b', 'c'], 'a')).some(p => p.code === 'FORMAT'));
    assert.ok(deterministicProblems(mk('Which is right here?', ['a', 'b', 'b', 'c'], 'a')).some(p => p.code === 'FORMAT'));
    assert.ok(deterministicProblems(mk('Which is right here?', ['a', 'b', 'c', 'd'], 'z')).some(p => p.code === 'FORMAT'));
    const noCode = mk('What does this loop print for the array 2, 0, 2?', ['a', 'b', 'c', 'd'], 'a', { lectureSource: { questionType: 'output' } });
    assert.ok(deterministicProblems(noCode).some(p => p.code === 'COMPLETENESS'));
    const conditionOnly = mk("When the condition i >= x is met, what happens to the inner loop?", ['a', 'b', 'c', 'd'], 'a');
    assert.ok(deterministicProblems(conditionOnly).some(p => p.code === 'COMPLETENESS'));
    const dataNotCode = mk('Given the data set 1 0 1 0 0 2, what size should the frequency array be?', ['2', '3', '6', '7'], '3', { lectureSource: { questionType: 'output' } });
    assert.strictEqual(deterministicProblems(dataNotCode).length, 0);
    const withCode = mk('What does this print?\nint count = 0;\ncount++;\nprintf("%d", count);', ['0', '1', '2', 'Error'], '1', { lectureSource: { questionType: 'output' } });
    assert.strictEqual(deterministicProblems(withCode).length, 0);
  });
  const original = lm._internal.callJson;
  try {
    lm._internal.callJson = async () => ({ model: 'stub', data: { results: [
      { q: 1, answer: 'B', alsoDefensible: [], grounded: true, correct: true, distractorsValid: true, plausible: true, aligned: true, complete: true, clear: true, fair: true, explanationOk: true, problems: [] },
      { q: 2, answer: 'C', alsoDefensible: ['A'], grounded: true, correct: true, distractorsValid: false, plausible: true, aligned: true, complete: true, clear: true, fair: true, explanationOk: true, problems: ['A and C mean the same'] }
    ], duplicates: [] } });
    const good = mk('Why is count declared inside the outer loop?', ['Compiler rule', 'To reset it for each element', 'To save memory', 'To keep it cumulative'], 'To reset it for each element');
    const twoRight = mk('Why does starting the inner loop from x fail?', ['It only counts elements after x', 'It counts twice', 'It skips elements before x', 'Infinite loop'], 'It skips elements before x');
    const unjudged = mk('What is a frequency count array?', ['w', 'x', 'y', 'z'], 'w');
    const out = await finalQualityGate([good, twoRight, unjudged], {});
    test('Gate keeps a fully valid question and rejects equivalent distractors and unjudged questions, with reasons', () => {
      assert.deepStrictEqual(out.accepted, [good]);
      const r2 = out.rejected.find(r => r.question === twoRight);
      assert.ok(r2.criteria.includes('SINGLE_ANSWER') && r2.criteria.includes('DISTRACTOR_VALIDITY'));
      const r3 = out.rejected.find(r => r.question === unjudged);
      assert.deepStrictEqual(r3.criteria, ['NOT_VALIDATED']);
      assert.ok(r2.reasons.length > 0 && twoRight.qualityGate.status === 'REJECTED');
    });
    lm._internal.callJson = async () => ({ model: 'stub', data: { results: [
      { q: 1, answer: 'A', alsoDefensible: [], grounded: true, correct: true, distractorsValid: true, plausible: true, aligned: true, complete: true, consistent: true, clear: true, fair: true, explanationOk: true, steps: 1, problems: [] },
      { q: 2, answer: 'A', alsoDefensible: [], grounded: true, correct: true, distractorsValid: true, plausible: true, aligned: true, complete: true, consistent: false, clear: true, fair: true, explanationOk: true, steps: 3, problems: ['state after index 2 ignores indices 0 and 1'] }
    ], duplicates: [] } });
    const oneStepHard = mk('Input 1, 1, 1. What is the frequency array?', ['[0, 3, 0]', '[3, 0, 0]', '[1, 1, 1]', '[0, 0, 3]'], '[0, 3, 0]', { difficulty: 'Hard' });
    const badState = mk('Input [2, 0, 2]; auxiliary []; processing index 2. What happens?', ['a', 'b', 'c', 'd'], 'a', { difficulty: 'Hard' });
    const cal = await finalQualityGate([oneStepHard, badState], {});
    test('First pass: a one-step question labelled Hard is rejected for depth (to be rewritten deeper); an inconsistent state is rejected', () => {
      assert.ok(cal.rejected.some(r => r.question === oneStepHard && r.criteria.includes('DEPTH')));
      assert.strictEqual(oneStepHard.difficulty, 'Hard');
      assert.ok(cal.rejected.some(r => r.question === badState && r.criteria.includes('COMPLETENESS')));
    });
    const oneStepHard2 = mk('Input 1, 1, 1. What is the frequency array?', ['[0, 3, 0]', '[3, 0, 0]', '[1, 1, 1]', '[0, 0, 3]'], '[0, 3, 0]', { difficulty: 'Hard' });
    const cal2 = await finalQualityGate([oneStepHard2], { depth: 'relabel' });
    test('Replacement pass: a one-step "Hard" replacement keeps its slot, relabelled Medium', () => {
      assert.ok(cal2.accepted.includes(oneStepHard2) && oneStepHard2.difficulty === 'Medium' && oneStepHard2.qualityGate.relabeled);
    });
    lm._internal.callJson = async () => ({ model: 'stub', data: { results: [
      { q: 1, answer: 'A', alsoDefensible: [], grounded: true, correct: true, distractorsValid: true, plausible: true, aligned: true, complete: true, consistent: true, clear: true, fair: true, explanationOk: true, steps: 1, level: 'recall', trivial: true, problems: [] }
    ], duplicates: [] } });
    const trivia = mk('What is the default dropout rate in the positional encoding constructor?', ['0.1', '0.2', '0.5', '0.0'], '0.1');
    const tv = await finalQualityGate([trivia], {});
    test('An Easy question on an incidental detail (e.g. a default value) is rejected for depth', () => {
      assert.ok(tv.rejected.some(r => r.question === trivia && r.criteria.includes('DEPTH')));
    });
    lm._internal.callJson = async () => { throw new Error('provider down'); };
    const down = await finalQualityGate([mk('Which is a valid statement?', ['a', 'b', 'c', 'd'], 'a')], {});
    test('If the gate cannot validate, nothing is delivered as if it were correct', () => {
      assert.strictEqual(down.accepted.length, 0);
      assert.ok(down.rejected[0].criteria.includes('NOT_VALIDATED'));
    });
  } finally {
    lm._internal.callJson = original;
  }
}

// ── Teaching style (PDI v2) ───────────────────────────────────────────────────
const ts = lm.teachingStyle;
function styleModel() {
  const ang = (types) => types.map(t => ({ type: t, difficulty: 'medium', focus: `${t} focus` }));
  const units = [
    { id: 'U01', topic: 'Lists', subtopic: 'what a list is', kind: 'DEFINITION', depth: 'EXPLAINED', importance: 'CORE', blocks: ['B01'], statement: 'A list holds items.', angles: ang(['concept', 'output']), misconceptions: [] },
    { id: 'U02', topic: 'Lists', subtopic: 'append in a loop', kind: 'CODE', depth: 'DEMONSTRATED', importance: 'CORE', blocks: ['B03'], statement: 'append adds to the end.', angles: ang(['recall', 'output']), misconceptions: [], hasCode: true, teacherExample: 'appending the marks of five students in a for loop' },
    { id: 'U03', topic: 'Lists', subtopic: 'slicing', kind: 'DEFINITION', depth: 'EXPLAINED', importance: 'CORE', blocks: ['B05'], statement: 'Slicing returns a new list.', angles: ang(['recall', 'concept']), misconceptions: [] }
  ];
  const segments = [
    { title: 'Lists', start: 0, end: 600, delivery: 'CONCEPTUAL', unitIds: ['U01', 'U03'] },
    { title: 'Notebook demo', start: 600, end: 1000, delivery: 'CODE', unitIds: ['U02'] }
  ];
  return { ok: true, units, segments, topics: [{ name: 'Lists', share: 100 }], capacity: computeCapacity(units),
    blocks: [{ id: 'B01', source: 'SPEECH', text: 'so a list holds items right? any questions' }, { id: 'B03', source: 'SPEECH', text: 'run this cell and append each mark' }, { id: 'B05', source: 'SPEECH', text: 'slicing gives a new list remember this for the exam' }] };
}

test('Teaching style: each part of the lecture is labelled, and the mix follows teaching time', () => {
  const m = styleModel();
  const p = ts.buildProfile(m);
  assert.strictEqual(p.basis, 'time');
  assert.strictEqual(p.mix.CONCEPTUAL, 60); assert.strictEqual(p.mix.CODE, 40);
  assert.strictEqual(p.dominant, 'CONCEPTUAL');
  assert.strictEqual(m.units[1].delivery, 'CODE');
  assert.strictEqual(p.slideUse.label, 'NO_MATERIAL');
  assert.ok(/Concept explanation 60% · Code walkthrough 40% · Taught without slides/.test(ts.describeProfile(p)));
});

test('Teaching style: older readings without labels fall back to how each point was taught', () => {
  const m = styleModel(); m.segments.forEach(s => { delete s.delivery; });
  const p = ts.buildProfile(m);
  assert.strictEqual(m.units[1].delivery, 'CODE'); assert.strictEqual(m.units[1].deliverySource, 'kind');
  assert.strictEqual(p.basis, 'units');
});

test('Slide use: reading the slides aloud, using them as an outline, and explaining beyond them are told apart', () => {
  const slide = 'Gradient descent updates each weight by subtracting the learning rate times the gradient of the loss. A learning rate that is too large makes the loss diverge, while a learning rate that is too small makes training very slow. Stochastic gradient descent uses one sample per update and mini batch gradient descent uses a small batch of samples per update.';
  const mat = { id: 'D01', source: 'MATERIAL', text: slide };
  const reads = ts.slideReliance([{ id: 'B01', source: 'SPEECH', text: `okay so ${slide} okay` }, mat]);
  const beyond = ts.slideReliance([{ id: 'B01', source: 'SPEECH', text: 'imagine you are walking down a hill in fog and you feel the ground with your feet and take a small step where it slopes down, if you jump too far you overshoot the valley and climb the other side' }, mat]);
  assert.strictEqual(reads.label, 'READS', JSON.stringify(reads));
  assert.strictEqual(beyond.label, 'BEYOND', JSON.stringify(beyond));
  assert.strictEqual(ts.slideReliance([{ id: 'B01', source: 'SPEECH', text: 'hello class' }]).label, 'NO_MATERIAL');
});

test('Slide use from the reading: points taught with the slides vs only in speech', () => {
  const m = styleModel();
  m.blocks.push({ id: 'D01', source: 'MATERIAL', text: 'Lists. '.repeat(60) });
  m.units.forEach(u => { u.source = 'SPOKEN'; });
  assert.strictEqual(ts.buildProfile(m).slideUse.label, 'BEYOND');
  m.units.forEach(u => { u.source = 'BOTH'; });
  const p = ts.buildProfile(m);
  assert.strictEqual(p.slideUse.label, 'READS'); assert.strictEqual(p.slideUse.basis, 'reading');
});

test('Planning prefers the question type that fits how each point was taught (code part → output, theory part → concept)', () => {
  const m = styleModel(); m.teachingStyle = ts.buildProfile(m);
  const plan = lm.planRequest(m, 2, 'Medium', {});
  const byUnit = Object.fromEntries(plan.selected.map(s => [s.unit.id, s.angle.type]));
  assert.strictEqual(byUnit.U02, 'output', JSON.stringify(byUnit));
  assert.strictEqual(byUnit.U01, 'concept', JSON.stringify(byUnit));
  const off = lm.planRequest(styleModel(), 2, 'Medium', { styleGuided: false });
  assert.ok(off.selected.some(s => s.unit.id === 'U02' && s.angle.type === 'recall'), 'without style the lecture\'s own angle order is used');
});

test('A teacher correction replaces the detected style, and the writer gets the teacher\'s own example', () => {
  const m = styleModel(); m.teachingStyle = ts.buildProfile(m);
  const override = ts.normaliseOverride({ modes: ['revision'], slideUse: 'beyond' });
  assert.deepStrictEqual(override, { modes: ['REVISION'], slideUse: 'BEYOND' });
  assert.strictEqual(ts.unitMode(m.units[1], override), 'REVISION');
  const plan = lm.planRequest(m, 3, 'Medium', { styleOverride: override });
  const units = lm.toTeachingUnits(m, plan, { styleOverride: override });
  const code = units.primary.find(t => t.lectureUnitId === 'U02');
  assert.ok(/quick revision/.test(code.teachingStyleNote) && /beyond the slides/.test(code.teachingStyleNote));
  assert.ok(/marks of five students/.test(code.teachingStyleNote));
  assert.strictEqual(ts.normaliseOverride({ modes: ['nonsense'] }), null);
});

async function blindTests() {
  const { blindAnswerCheck, blindRejections, _buildPrompt } = require('../engine/validators/blindAnswerCheck');
  const router = require('../engine/adapter/llmRouter');
  const model = { units: [{ id: 'U01', subtopic: 'Paging', blocks: [] }] };
  const original = lm.unitEvidenceText;
  lm.unitEvidenceText = (m, u) => (u.id === 'U01' ? 'Page size is 4 KB; 8 MB needs 2048 pages.' : '');
  const mk = (stem, options, key) => ({ question: stem, options, correctAnswer: key, lectureSource: { unitId: 'U01' } });
  const wrongKey = mk('8 MB with 4 KB pages needs how many pages?', ['512', '2048', '4096', '1024'], '1024');
  const twoRight = mk('Which is a special number value?', ['undefined', 'Infinity', 'null', 'NaN'], 'Infinity');
  const fine = mk('What is the page size?', ['1 KB', '2 KB', '4 KB', '8 KB'], '4 KB');
  const reveals = mk('It prints 3. What does it print?', ['1', '2', '3', '4'], '3');
  const realComplete = router.complete;
  let prompts = [];
  try {
    router.complete = async ({ prompt, noGeminiFallback }) => {
      prompts.push({ prompt, noGeminiFallback });
      return JSON.stringify({ answers: [
        { q: 1, answer: 'B', alsoDefensible: [] }, { q: 2, answer: 'B', alsoDefensible: ['D'], note: 'NaN is also a number' },
        { q: 3, answer: 'C', alsoDefensible: [] }, { q: 4, answer: 'C', alsoDefensible: [], stemRevealsAnswer: true }
      ] });
    };
    const qs = [wrongKey, twoRight, fine, reveals];
    const s = await blindAnswerCheck(qs, { lectureModel: model, batchSize: 4, passageChars: 1000 });
    const plain = _buildPrompt([fine], { lm: model, passageChars: 0, detectDuplicates: false });
    test('Blind check (lecture path) shows the teacher\'s passage, never falls back to Gemini, and finds a wrong key and a second answer', () => {
      assert.ok(s.checked);
      assert.strictEqual(prompts.length, 1);
      assert.ok(/LECTURE PASSAGE[^\n]*2048 pages/.test(prompts[0].prompt));
      assert.ok(!/LECTURE PASSAGE/.test(plain), 'no passage by default');
      assert.ok(!/duplicates/.test(prompts[0].prompt), 'no near-duplicate request on the lecture path');
      assert.strictEqual(prompts[0].noGeminiFallback, true);
      assert.strictEqual(wrongKey.blindCheck.status, 'DISAGREES');
      assert.strictEqual(twoRight.blindCheck.status, 'POSSIBLY_AMBIGUOUS');
      assert.strictEqual(fine.blindCheck.status, 'AGREES');
    });
    test('Blind rejections: wrong key and two answers are rejected for refill; stem-reveals and agreed questions are kept', () => {
      wrongKey.independentCheck = { status: 'AGREES', model: 'gate' }; // the parallel gate writes its own field
      const split = blindRejections(qs);
      assert.deepStrictEqual(split.keep, [fine, reveals]);
      assert.deepStrictEqual(split.rejected.map(r => r.criteria[0]), ['TECHNICAL_CORRECTNESS', 'SINGLE_ANSWER']);
      assert.strictEqual(wrongKey.qualityGate.status, 'REJECTED');
    });
    router.complete = async () => { throw new Error('rate limited'); };
    const busy = [mk('Q?', ['a', 'b', 'c', 'd'], 'a')];
    const s2 = await blindAnswerCheck(busy, { lectureModel: model });
    test('Blind check unavailable: questions are NOT_CHECKED and the gate verdict stands', () => {
      assert.strictEqual(s2.checked, false);
      assert.strictEqual(busy[0].blindCheck.status, 'NOT_CHECKED');
      assert.strictEqual(blindRejections(busy).keep.length, 1);
    });
    const { lectureDiscrepancies } = require('../engine/validators/blindAnswerCheck');
    const expose = mk('What does EXPOSE 80 do?', ['Needs -p to publish', 'Makes port 80 available to the host', 'Firewall rule', 'Runs on 80'], 'Makes port 80 available to the host');
    expose.lectureSource = { unitId: 'U01', subtopic: 'Dockerfile EXPOSE', time: '12:30' };
    expose.blindCheck = { status: 'DISAGREES', blindAnswer: 'Needs -p to publish', working: 'EXPOSE only documents' };
    const typo = mk('2 + 8 = ?', ['11', '10', '12', '9'], '11'); typo.blindCheck = { status: 'DISAGREES', blindAnswer: '10' };
    router.complete = async ({ prompt }) => JSON.stringify({ answers: [{ q: 1, answer: /EXPOSE/.test(prompt) ? 'B' : 'B' }] });
    const flags = await lectureDiscrepancies([expose, typo], model);
    test('Lecture discrepancy: a disputed key that matches what the lecture says is flagged for the teacher; a plain wrong key is not', () => {
      assert.strictEqual(flags.length, 1);
      assert.strictEqual(flags[0].subtopic, 'Dockerfile EXPOSE');
      assert.strictEqual(flags[0].standardAnswer, 'Needs -p to publish');
    });
    test('Blind check prompt without a lecture model keeps the near-duplicate request (legacy path)', () => {
      assert.ok(/duplicates/.test(_buildPrompt([fine], { lm: null, detectDuplicates: true })));
    });
  } finally {
    router.complete = realComplete;
    lm.unitEvidenceText = original;
  }
}

// ── Hard forms: many ways to be Hard, matched to what was taught ──────────────
{
  const hf = require('../engine/intelligence/hardForms');
  const U = (id, kind, extra = {}) => ({ id, topic: 'T', subtopic: `point ${id}`, statement: `statement ${id}`, kind, depth: 'EXPLAINED', importance: 'CORE',
    angles: [{ type: 'scenario', difficulty: 'hard', focus: 'x' }], ...extra });
  const units = [
    U('A', 'CODE', { hasCode: true, depth: 'DEMONSTRATED', angles: [{ type: 'trace', difficulty: 'hard', focus: 'x' }] }),
    U('B', 'MECHANISM'), U('C', 'COMPARISON'), U('D', 'CALCULATION', { hasFormula: true }),
    U('E', 'EDGE_CASE', { angles: [{ type: 'edge_case', difficulty: 'hard', focus: 'x' }] }),
    U('F', 'APPLICATION'), U('G', 'MECHANISM', { topic: 'Other' }), U('H', 'MECHANISM', { depth: 'MENTIONED' })
  ];
  const model = { units };
  test('Hard forms follow the content: code -> trace first, formula -> calculation, comparison -> choose under constraints, edge case -> boundary', () => {
    assert.strictEqual(hf.formsFor(units[0], model)[0], 'trace');
    assert.ok(hf.formsFor(units[3], model).slice(0, 2).includes('calculate_decide'));
    assert.strictEqual(hf.formsFor(units[2], model)[0], 'choose_constraints');
    assert.strictEqual(hf.formsFor(units[4], model)[0], 'boundary');
    assert.strictEqual(hf.formsFor(units[1], model)[0], 'predict_change');
  });
  test('Hard forms: a mentioned point has none; "connect two points" is offered only when a related point exists, never as the only way', () => {
    assert.deepStrictEqual(hf.formsFor(units[7], model), []);
    assert.ok(!hf.formsFor(units[6], model).includes('link'), 'no other explained point in its topic');
    const b = hf.formsFor(units[1], model);
    assert.ok(b.includes('link') && b[0] !== 'link');
    assert.ok(hf.formsFor(units[1], model).length >= 3);
  });
  test('Hard forms: a worked-solution or work-backwards form needs a demonstration, code or a formula', () => {
    assert.ok(!hf.formsFor(U('X', 'EXAMPLE'), model).includes('spot_flaw'));
    assert.ok(hf.formsFor(U('Y', 'EXAMPLE', { depth: 'DEMONSTRATED' }), model).includes('spot_flaw'));
  });
  test('Hard forms are varied across a quiz, and a replacement avoids the rejected form', () => {
    const picks = [units[1], units[5], units[2], units[4]].map(u => ({ unit: u, difficulty: 'hard' }));
    hf.assignForms(picks, model);
    assert.ok(new Set(picks.map(p => p.hardForm)).size >= 3, JSON.stringify(picks.map(p => p.hardForm)));
    const again = [{ unit: units[1], difficulty: 'hard' }];
    hf.assignForms(again, model, { avoid: [{ unitId: null, form: 'predict_change' }] });
    assert.ok(again[0].hardForm && again[0].hardForm !== 'predict_change');
  });
  test('Hard forms reach the writer: the target carries the recipe, and "connect two points" carries the related passage', () => {
    const plan = { selected: [{ unit: units[1], angle: units[1].angles[0], difficulty: 'hard', hardForm: 'link', linkedUnitId: 'C' }], reserves: [] };
    const t = lm.toTeachingUnits({ ...model, blocks: [] }, plan, { styleGuided: false }).primary[0];
    assert.strictEqual(t.hardForm, 'link');
    assert.ok(/RELATED POINT/.test(t.hardFormRecipe));
    assert.ok(t.transcriptExcerpt.includes('RELATED POINT TAUGHT IN THE SAME LECTURE (point C)'));
    const target = planner._planFromLectureModel([t], 'Hard', 1, {}).assessmentTargets[0];
    assert.strictEqual(target.hardForm, 'link');
    assert.ok(/RELATED POINT/.test(target.hardFormRecipe));
  });
}

asyncTests().then(gateTests).then(blindTests).then(() => {
const passed = results.filter(Boolean).length;
console.log(`\n🏁 ${passed} / ${results.length} tests passed`);
process.exit(passed === results.length ? 0 : 1);
});
