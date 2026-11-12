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

asyncTests().then(gateTests).then(() => {
const passed = results.filter(Boolean).length;
console.log(`\n🏁 ${passed} / ${results.length} tests passed`);
process.exit(passed === results.length ? 0 : 1);
});
