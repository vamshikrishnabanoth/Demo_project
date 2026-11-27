/**
 * Unit tests for the MCQ pipeline design, one group per design point (D1–D20 in docs/MCQ_PIPELINE.md).
 * No network: every model call is replaced by a stub. Run: node test/test_mcq_pipeline_design.js
 */
process.env.SEMANTIC_LINKAGE = 'off'; // embeddings are stubbed explicitly where a test needs them
const assert = require('assert');
const lm = require('../engine/intelligence/lectureModel');
const I = lm._internal;
const semantic = require('../engine/utils/semanticEmbedder');
const { getTargetEvidenceContext } = require('../engine/evidence/evidenceContextSelector');
const pipeline = require('../engine/mcq/lecturePipeline');
const hardForms = require('../engine/intelligence/hardForms');
const { classifyTextBlock } = require('../utils/inputKind');

const results = [];
async function test(id, name, fn) {
  try { await fn(); results.push({ id, name, ok: true }); console.log(`  PASS ${id} ${name}`); }
  catch (e) { results.push({ id, name, ok: false, err: e.message }); console.log(`  FAIL ${id} ${name}\n       ${e.message}`); }
}

// ── Fixtures ──────────────────────────────────────────────────────────────────────────────────────────────
let uid = 0;
function unit(o) {
  uid++;
  return {
    id: o.id || `U${String(uid).padStart(2, '0')}`,
    topic: o.topic || 'Recursion',
    subtopic: o.subtopic || `point ${uid} ${Math.random().toString(36).slice(2, 7)}`,
    kind: o.kind || 'MECHANISM',
    depth: o.depth || 'EXPLAINED',
    source: o.source || 'SPOKEN',
    importance: 'CORE',
    statement: o.statement || Array.from({ length: 8 }, () => Math.random().toString(36).slice(2, 8)).join(' '),
    quote: 'q',
    blocks: o.blocks || [`B${String(uid).padStart(2, '0')}`],
    angles: o.angles || [{ type: 'concept', difficulty: 'easy', focus: `focus ${uid}` }],
    misconceptions: ['a wrong belief'],
    role: o.role, stressed: o.stressed, mentions: o.mentions, seconds: o.seconds
  };
}
function model(units, extra = {}) {
  const topics = [...new Set(units.map(u => u.topic))].map(name => ({ name, share: extra.shares ? extra.shares[name] || 0 : 50, units: units.filter(u => u.topic === name) }));
  return { ok: true, id: 'test', title: 'Test lecture', units, topics, capacity: lm.computeCapacity(units), blocks: extra.blocks || [], calibration: extra.calibration || null, intent: extra.intent || '' };
}
const ang = (type, difficulty) => ({ type, difficulty, focus: `${type} ${difficulty} ${Math.random().toString(36).slice(2, 6)}` });

(async () => {
  console.log('MCQ pipeline design tests\n');

  // D1 Audio only → no linkage
  await test('D1', 'audio only: speech blocks, no material, no linkage step', async () => {
    const segs = Array.from({ length: 12 }, (_, i) => ({ start: i * 20, end: i * 20 + 20, text: `recursion explained part ${i} with base case and recursive case words` }));
    const { speech, material } = I.buildBlocks({ text: segs.map(s => s.text).join(' '), segments: segs, documents: [] });
    assert(speech.length > 0 && material.length === 0, 'expected speech only');
    const wins = I.buildWindows(speech, material);
    assert(wins.every(w => w.material.length === 0), 'no material should be attached');
    assert.strictEqual(await I.prepareSemanticLinkage(speech, material), null, 'no linkage without material');
  });

  // D2 Audio + material → linked (word overlap, and meaning when the wording differs)
  await test('D2a', 'audio + slides: a slide joins the speech window it overlaps by words', async () => {
    const speech = [
      { id: 'B01', source: 'SPEECH', start: 0, end: 60, text: 'stack frames grow with every recursive call until the base case returns '.repeat(40) },
      { id: 'B02', source: 'SPEECH', start: 60, end: 120, text: 'loops repeat a block of statements while a condition holds true '.repeat(40) }
    ];
    const material = [{ id: 'D01', source: 'MATERIAL', text: 'Loops: a while loop repeats statements while the condition holds' }];
    const wins = I.buildWindows(speech, material);
    const w = wins.find(x => x.material.some(m => m.id === 'D01'));
    assert(w && w.speech.some(b => b.id === 'B02'), 'slide should join the loops window');
  });
  await test('D2b', 'audio + slides: a slide with no shared words joins by meaning (hybrid linkage)', async () => {
    const speech = [
      { id: 'B01', source: 'SPEECH', start: 0, end: 60, text: 'alpha beta gamma delta '.repeat(800) },
      { id: 'B02', source: 'SPEECH', start: 60, end: 120, text: 'epsilon zeta eta theta '.repeat(800) }
    ];
    const material = [{ id: 'D01', source: 'MATERIAL', text: 'completely different wording here' }];
    const wordsOnly = I.buildWindows(speech, material);
    assert(wordsOnly.some(w => w.speech.length === 0 && w.material.length), 'without meaning it stays unlinked');
    const sem = { passageVec: [[1, 0], [0, 1]], passageOf: new Map([['B01', 0], ['B02', 1]]), matVec: new Map([['D01', [0.05, 1]]]), threshold: 0.6, stats: { semanticOnly: 0, movedBySemantic: 0, considered: 0 } };
    const wins = I.buildWindows(speech, material, sem);
    const w = wins.find(x => x.material.some(m => m.id === 'D01'));
    assert(w && w.speech.some(b => b.id === 'B02'), 'linked to the window that means the same');
    assert.strictEqual(sem.stats.semanticOnly, 1);
  });

  // D3 Material only (PDF / photo text / code / terminal) → questions still come
  await test('D3', 'material only: notes, code and terminal text become typed blocks', async () => {
    const { speech, material } = I.buildBlocks({ text: '', segments: [], documents: [
      { name: 'notes.pdf', text: '--- Slide 1 ---\nRecursion is a function calling itself.\n\n--- Slide 2 ---\nEvery recursion needs a base case.' },
      { name: 'fact.py', text: 'def fact(n):\n    if n == 0:\n        return 1\n    return n * fact(n - 1)\n' },
      { name: 'session.txt', text: '$ ls -la\ntotal 8\n$ cat a.txt\nhello' }
    ] });
    assert.strictEqual(speech.length, 0);
    assert(material.some(b => b.slide === 2), 'slide numbers kept');
    assert(material.some(b => b.kind === 'CODE'), 'code blocks typed');
    assert(material.some(b => b.kind === 'TERMINAL'), 'terminal blocks typed');
    assert.strictEqual(classifyTextBlock('def f(x):\n    return x+1\n'), 'code');
    assert(typeof require('../engine/documentRouter/geminiVisionReader').readWithGemini === 'function', 'photos/handwriting go to the vision reader');
  });

  // D4 Several materials: source kept, equal priority
  await test('D4', 'several materials: each block keeps its source; no source outranks another', async () => {
    const { material } = I.buildBlocks({ text: '', segments: [], documents: [{ name: 'a.pdf', text: 'Alpha text about sorting.' }, { name: 'b.pptx', text: 'Beta text about searching.' }] });
    assert(material.some(b => b.label === 'a.pdf') && material.some(b => b.label === 'b.pptx'), 'labels kept');
    const units = [
      unit({ topic: 'Sorting', source: 'MATERIAL', blocks: ['D01'], angles: [ang('concept', 'easy')] }),
      unit({ topic: 'Searching', source: 'MATERIAL', blocks: ['D02'], angles: [ang('concept', 'easy')] })
    ];
    const plan = lm.planRequest(model(units), 2, 'Easy', { styleGuided: false });
    assert.strictEqual(plan.selected.length, 2);
    assert.strictEqual(plan.fromMaterialOnly, 0, 'with no speech nothing counts as supplementary');
  });

  // D5 Lecture first; material-only points only for the shortfall
  await test('D5a', 'lecture + material: taught points fill the quiz first', async () => {
    const units = [
      ...Array.from({ length: 4 }, () => unit({ topic: 'Recursion', source: 'SPOKEN', angles: [ang('concept', 'easy')] })),
      ...Array.from({ length: 4 }, () => unit({ topic: 'Extra slides', source: 'MATERIAL', angles: [ang('concept', 'easy')] }))
    ];
    const plan = lm.planRequest(model(units, { shares: { Recursion: 100, 'Extra slides': 0 } }), 4, 'Easy', { styleGuided: false });
    assert.strictEqual(plan.selected.length, 4);
    assert(plan.selected.every(p => p.unit.source !== 'MATERIAL'), 'no material-only point while the lecture can fill');
    assert.strictEqual(plan.fromMaterialOnly, 0);
  });
  await test('D5b', 'lecture + material: material-only points fill only what the lecture cannot, and the notice says so', async () => {
    const units = [
      ...Array.from({ length: 2 }, () => unit({ topic: 'Recursion', source: 'BOTH', angles: [ang('concept', 'easy')] })),
      ...Array.from({ length: 4 }, () => unit({ topic: 'Extra slides', source: 'MATERIAL', angles: [ang('concept', 'easy')] }))
    ];
    const plan = lm.planRequest(model(units), 5, 'Easy', { styleGuided: false });
    assert.strictEqual(plan.selected.length, 5);
    assert.strictEqual(plan.fromMaterialOnly, 3);
    assert(plan.shortfallReasons.some(r => /only in the uploaded material/.test(r)), 'reason given');
    assert(!plan.reserves.slice(0, 1).some(r => r.supplementary && plan.reserves.some(x => !x.supplementary)), 'taught reserves first');
  });

  // D6 Intent understood and used
  await test('D6a', 'calibration returns the intent; it reaches the writer targets', async () => {
    const units = [unit({ id: 'U01', depth: 'EXPLAINED', angles: [ang('concept', 'easy'), ang('output', 'medium')] })];
    const m = model(units);
    const stub = async () => ({ provider: 'stub', model: 'stub', data: { intent: 'Explain recursion conceptually with real-world examples; no coding.', level: 'INTRODUCTORY', difficulty: { easy: 'e', medium: 'm', hard: 'h' }, units: [{ id: 'U01', role: 'CORE', angles: [{ i: 0, difficulty: 'easy', keep: true }, { i: 1, difficulty: 'medium', keep: false }] }], capacityNote: 'n' } });
    await lm.calibrateLecture(m, undefined, { callJson: stub });
    assert.strictEqual(m.calibration.status, 'ok');
    assert(/no coding/.test(m.calibration.intent));
    assert.strictEqual(m.units[0].angles.length, 1, 'code-output angle dropped for a conceptual class');
    const plan = lm.planRequest(m, 1, 'Easy', { styleGuided: false });
    const tu = lm.toTeachingUnits(m, plan, { styleGuided: false });
    assert(/no coding/.test(tu.primary[0].lectureIntent), 'intent travels with the target');
    assert.strictEqual(tu.primary[0].difficultyMeaning, 'e');
  });
  await test('D6b', 'the writer prompt contains the intent and what the difficulty means for this lecture', async () => {
    const router = require('../engine/adapter/llmRouter');
    const agent2 = require('../engine/agents/agent2Generator');
    const orig = router.complete; let seen = '';
    router.complete = async (o) => { seen += JSON.stringify(o); return JSON.stringify([{ question: 'Why does a recursive function need a base case?', options: ['To stop the calls', 'To speed it up', 'To use less code', 'To avoid parameters'], correctAnswer: 'To stop the calls', explanation: 'The base case ends the recursion.', difficulty: 'Easy' }]); };
    try {
      const t = pipeline.toTarget({ plannedDifficulty: 'Easy', subtopic: 'base case', statement: 'A base case stops recursion.', transcriptExcerpt: 'Every recursion needs a base case that stops the calls.', lectureUnitId: 'U01', questionAngle: 'concept', lectureIntent: 'Explain recursion conceptually; no coding.', difficultyMeaning: 'recall what a base case is for' }, 'T', 0, 'Easy');
      await agent2.generateQuestionBatch([t], pipeline.sessionContext({ count: 1 }, { blocks: [] }));
    } finally { router.complete = orig; }
    assert(/no coding/.test(seen), 'intent in prompt');
    assert(/recall what a base case is for/.test(seen), 'difficulty meaning in prompt');
  });

  // D7 Topics, time per topic, subtopics, revisits
  await test('D7', 'topics with time share; a point taught twice is merged and counted as a revisit', async () => {
    const blocks = [{ id: 'B01', source: 'SPEECH', start: 0, end: 300, text: 'x' }, { id: 'B02', source: 'SPEECH', start: 300, end: 400, text: 'y' }, { id: 'B03', source: 'SPEECH', start: 1200, end: 1260, text: 'z' }];
    const blockMap = Object.fromEntries(blocks.map(b => [b.id, b]));
    const a = unit({ id: 'U01', topic: 'Recursion', blocks: ['B01'] }), b = unit({ id: 'U02', topic: 'Loops', blocks: ['B02'] }), c = unit({ id: 'U03', topic: 'Recursion', blocks: ['B03'] });
    const topics = I.buildTopics([a, b, c], blockMap, true);
    const rec = topics.find(t => t.name === 'Recursion');
    assert(rec && rec.share > topics.find(t => t.name === 'Loops').share, 'more time on recursion');
    const stub = async () => ({ provider: 's', model: 's', data: { topics: [], duplicates: [['U01', 'U03']] } });
    const merged = await I.consolidateUnits([a, b, c, unit({ id: 'U04', topic: 'Loops' })], { calls: 0, providers: new Set() }, { callJson: stub });
    const kept = merged.find(u => u.id === 'U01');
    assert(!merged.some(u => u.id === 'U03'), 'revisit merged into the first mention');
    assert.strictEqual(kept.mentions, 2, 'revisit counted');
    assert(kept.blocks.includes('B03'), 'both timestamps kept');
    assert.strictEqual(I.unitSeconds(blocks, kept), 360);
  });

  // D9 Capacity and an honest recommended count
  await test('D9', 'capacity counts angles; recommended counts distinct taught points; peripheral not in Balanced', async () => {
    const units = [
      unit({ source: 'SPOKEN', role: 'CORE', angles: [ang('concept', 'easy'), ang('recall', 'easy'), ang('trace', 'medium')] }),
      unit({ source: 'SPOKEN', role: 'PERIPHERAL', angles: [ang('concept', 'easy')] }),
      unit({ source: 'MATERIAL', angles: [ang('concept', 'easy')] })
    ];
    const c = lm.computeCapacity(units);
    assert.deepStrictEqual(c.byDifficulty, { easy: 4, medium: 1, hard: 0 });
    assert.strictEqual(c.recommended.easy, 2, 'two taught points have an easy angle');
    assert.strictEqual(c.recommended.balanced, 1, 'peripheral and material-only left out of Balanced');
    assert.strictEqual(c.supplementary.easy, 1);
  });

  // D10 Difficulty relative to this lecture, with guards
  await test('D10', 'calibration relabels angles for the whole lecture; a merely mentioned point cannot be Hard', async () => {
    const units = [unit({ id: 'U01', depth: 'MENTIONED', angles: [ang('concept', 'easy')] }), unit({ id: 'U02', depth: 'DEMONSTRATED', angles: [ang('trace', 'medium')] })];
    const m = model(units);
    const stub = async () => ({ provider: 's', model: 's', data: { intent: 'i', level: 'ADVANCED', difficulty: { easy: 'e', medium: 'm', hard: 'h' }, units: [{ id: 'U01', role: 'SUPPORTING', angles: [{ i: 0, difficulty: 'hard' }] }, { id: 'U02', role: 'CORE', angles: [{ i: 0, difficulty: 'hard' }] }] } });
    await lm.calibrateLecture(m, undefined, { callJson: stub });
    assert.strictEqual(m.units[0].angles[0].difficulty, 'easy', 'mentioned stays easy');
    assert.strictEqual(m.units[1].angles[0].difficulty, 'hard', 'demonstrated trace becomes hard for this class');
    assert.strictEqual(m.units[1].angles[0].windowDifficulty, 'medium', 'the window label is kept for the record');
  });
  await test('D10b', 'calibration unavailable: window labels stand and the status says so', async () => {
    const m = model([unit({ id: 'U01', angles: [ang('concept', 'medium')] })]);
    await lm.calibrateLecture(m, undefined, { callJson: async () => { throw new Error('provider busy'); } });
    assert.strictEqual(m.calibration.status, 'unavailable');
    assert.strictEqual(m.units[0].angles[0].difficulty, 'medium');
    assert(typeof m.units[0].importanceScore === 'number');
  });

  // D11 Balanced follows the lecture
  await test('D11', 'Balanced mix follows the calibrated capacity (introductory → mostly Easy)', async () => {
    const units = [
      ...Array.from({ length: 8 }, () => unit({ angles: [ang('concept', 'easy')] })),
      ...Array.from({ length: 3 }, () => unit({ angles: [ang('trace', 'medium')] })),
      unit({ depth: 'DEMONSTRATED', angles: [ang('edge_case', 'hard')] })
    ];
    const plan = lm.planRequest(model(units), 6, 'Balanced', { styleGuided: false });
    assert(plan.byDifficulty.easy > plan.byDifficulty.medium && plan.byDifficulty.medium >= plan.byDifficulty.hard, JSON.stringify(plan.byDifficulty));
    const deep = [...Array.from({ length: 3 }, () => unit({ angles: [ang('concept', 'easy')] })), ...Array.from({ length: 6 }, () => unit({ depth: 'DEMONSTRATED', angles: [ang('edge_case', 'hard')] }))];
    const plan2 = lm.planRequest(model(deep), 6, 'Balanced', { styleGuided: false });
    assert(plan2.byDifficulty.hard > plan2.byDifficulty.easy, JSON.stringify(plan2.byDifficulty));
  });

  // D12 Fewer than recommended → keep the important points, not the earliest
  await test('D12', 'trimming keeps the most important point, not the first in lecture order', async () => {
    const early = unit({ topic: 'T', role: 'PERIPHERAL', depth: 'MENTIONED', angles: [ang('concept', 'easy')] });
    const late = unit({ topic: 'T', role: 'CORE', depth: 'DEMONSTRATED', stressed: true, mentions: 3, seconds: 240, angles: [ang('concept', 'easy')] });
    assert(lm.unitImportance(late) > lm.unitImportance(early));
    for (const sg of [false, true]) {
      const plan = lm.planRequest(model([early, late]), 1, 'Easy', { styleGuided: sg });
      assert.strictEqual(plan.selected[0].unit.id, late.id, `style ${sg}: kept the important point`);
      assert.strictEqual(plan.reserves[0].unit.id, early.id);
    }
  });

  // D13 More than the lecture supports
  await test('D13', 'asking for more than capacity: capped, shortfall explained, optional fill from the next tier', async () => {
    const units = [unit({ angles: [ang('trace', 'medium')] }), unit({ angles: [ang('concept', 'easy')] })];
    const p1 = lm.planRequest(model(units), 3, 'Medium', { styleGuided: false });
    assert.strictEqual(p1.selected.length, 1); assert(p1.shortfall === 2 && p1.shortfallReasons.length);
    const p2 = lm.planRequest(model(units), 2, 'Medium', { styleGuided: false, fillOtherTiers: true });
    assert.strictEqual(p2.selected.length, 2); assert.strictEqual(p2.filledFromOtherTiers, 1);
  });

  // D14 Grounded = answerable from what was taught
  await test('D14', 'the writer and the gate see the same teacher passage; the gate rejects an ungrounded question', async () => {
    const passage = 'Every recursion needs a base case that stops the calls.';
    assert.strictEqual(getTargetEvidenceContext({ lectureUnitId: 'U01', supportingEvidence: passage }, { unifiedRawContent: 'unrelated text '.repeat(500) }), passage);
    const gate = require('../engine/validators/finalQualityGate');
    const orig = I.callJson; let prompt = '';
    I.callJson = async (o) => { prompt = o.prompt; return { model: 'stub', data: { results: [{ q: 1, answer: 'A', alsoDefensible: [], grounded: false, correct: true, distractorsValid: true, plausible: true, aligned: true, complete: true, clear: true, fair: true, explanationOk: true, steps: 1, level: 'apply', fact: 'x' }], duplicates: [] } }; };
    const origEmb = semantic.embedMany; semantic.embedMany = async () => null;
    try {
      const lmFix = { ok: true, units: [{ id: 'U01', subtopic: 'base case', statement: 's', blocks: ['B01'] }], blocks: [{ id: 'B01', source: 'SPEECH', start: 0, end: 10, text: passage }] };
      const q = { question: 'What does the base case of a recursive function do?', options: ['Stops the calls', 'Adds a loop', 'Speeds memory', 'Removes parameters'], correctAnswer: 'Stops the calls', difficulty: 'Easy', lectureSource: { unitId: 'U01' } };
      const r = await gate.finalQualityGate([q], { lectureModel: lmFix });
      assert.strictEqual(r.rejected.length, 1); assert(q.qualityGate.criteria.includes('GROUNDING'));
    } finally { I.callJson = orig; semantic.embedMany = origEmb; }
    assert(prompt.includes(passage), 'gate sees the teacher passage');
    assert(/must be stated in SOURCE or follow directly from it/.test(prompt), 'grounding rule');
  });

  // D15 Quality: per-difficulty demands in the writer prompt; trivial questions rejected
  await test('D15', 'writer is told what each difficulty must demand (Easy is understanding, not trivia)', async () => {
    const src = require('fs').readFileSync(require.resolve('../engine/agents/agent2Generator'), 'utf8');
    assert(/NEVER ask an incidental detail/.test(src) && /must NOT be answerable by remembering one sentence/.test(src) && /multi-step reasoning on a NEW concrete situation/.test(src));
  });

  // D16 Several ways to make a question Hard
  await test('D16', 'Hard picks get different Hard forms suited to their content', async () => {
    const units = Array.from({ length: 4 }, () => unit({ kind: 'CODE', depth: 'DEMONSTRATED', angles: [ang('trace', 'hard')] }));
    const m = model(units);
    const plan = lm.planRequest(m, 4, 'Hard', { styleGuided: false });
    const forms = plan.selected.map(p => p.hardForm).filter(Boolean);
    assert(forms.length === 4, 'every Hard pick has a form');
    assert(new Set(forms).size >= 2, `forms vary: ${forms.join(',')}`);
    assert(hardForms.FORM_IDS.length >= 5);
  });

  // D17 Variety of question types
  await test('D17', 'plan spreads question types (not all one kind)', async () => {
    const types = ['concept', 'mechanism', 'comparison', 'application', 'scenario', 'recall'];
    const units = types.map(t => unit({ angles: [ang(t, 'medium'), ang('concept', 'medium')] }));
    const plan = lm.planRequest(model(units), 6, 'Medium', { styleGuided: false });
    assert(new Set(plan.selected.map(p => p.angle.type)).size >= 5, plan.selected.map(p => p.angle.type).join(','));
  });

  // D18 Crisp questions
  await test('D18', 'long stems are trimmed or flagged; options kept short', async () => {
    const agent2 = require('../engine/agents/agent2Generator');
    const long = { question: `${'In this very long and wordy scenario describing many unnecessary details about the system '.repeat(4)}what happens?`, options: ['A', 'B', 'C', 'D'], correctAnswer: 'A' };
    const out = agent2._enforceBrevity(JSON.parse(JSON.stringify(long)));
    const words = String(out.question).split(/\s+/).length;
    assert(words <= 55 || out._cannotSafelyTrimBrevity, `stem ${words} words not handled`);
  });

  // D19 Distractors: from lecture misconceptions; difficulty-aware validation
  await test('D19', 'distractors use the lecture misconceptions; absurd distractors are flagged', async () => {
    const t = pipeline.toTarget({ plannedDifficulty: 'Easy', subtopic: 'base case', statement: 's', lectureMisconceptions: ['the base case runs first'], lectureUnitId: 'U01' }, 'T', 0, 'Easy');
    assert.strictEqual(t.distractorStrategy, 'LECTURE_MISCONCEPTIONS');
    assert(/runs first/.test(t.distractorMisconceptions[0].description));
    const V = require('../engine/validators/difficultyAwareDistractorValidator');
    const ev = { unifiedRawContent: 'A recursive function calls itself. Every recursion needs a base case that stops the calls; otherwise the call stack grows until it overflows. The recursive case moves the problem towards the base case, and each call returns its value to the caller with the return statement. '.repeat(2) };
    const bad = V.validate({ question: 'What stops a recursive function?', options: ['The base case', 'Pizza delivery', 'The weather', 'A banana'], correctAnswer: 'The base case' }, 'Easy', ev);
    const good = V.validate({ question: 'What stops a recursive function?', options: ['The base case', 'The recursive case', 'The return type', 'The call stack size'], correctAnswer: 'The base case' }, 'Easy', ev);
    assert.notStrictEqual(bad.verdict, 'PASS', `absurd distractors must not pass: ${JSON.stringify(bad.dimensions && bad.dimensions.plausibility)}`);
    assert.strictEqual(good.verdict, 'PASS', `realistic distractors must pass: ${JSON.stringify(good.dimensions && good.dimensions.plausibility)}`);
  });

  // D20 The cycle: write → check each → replace a failure from reserves → hand over
  await test('D20a', 'pipeline: a failed question is replaced by a reserve of the same difficulty; broken keys and duplicates are refused', async () => {
    const tu = (id, d, extra = {}) => ({ claimId: id, plannedDifficulty: d, subtopic: `sub ${id}`, statement: `st ${id}`, transcriptExcerpt: `passage ${id}`, lectureUnitId: id, questionAngle: 'concept', ...extra });
    const units = [tu('U1', 'Easy'), tu('U2', 'Easy'), tu('U3', 'Hard'), tu('U4', 'Easy', { isReserve: true }), tu('U5', 'Hard', { isReserve: true })];
    const writer = {
      generateQuestionBatch: async (ts) => ts.map(t => ({ question: `Question about ${t.subtopic}?`, options: ['a1', 'b1', 'c1', 'd1'].map(x => `${x}-${t.lectureUnitId}`), correctAnswer: t.lectureUnitId === 'U2' ? 'not-an-option' : `a1-${t.lectureUnitId}`, difficulty: t.targetDifficulty })),
      generateQuestion: async () => null
    };
    const reviewer = { evaluateAndRepairQuestion: async (c, t) => (t.lectureUnitId === 'U3' ? { status: 'FAIL', failureReasons: ['wrong key'] } : { status: 'PASS', mcq: c }) };
    const r = await pipeline.run({ count: 3, difficulty: 'Balanced', teachingUnits: units }, { blocks: [] }, () => {}, { writer, reviewer });
    assert.strictEqual(r.questions.length, 3, JSON.stringify(r.writeCheck));
    const ids = r.questions.map(q => q.metadata.lectureUnitId).sort();
    assert.deepStrictEqual(ids, ['U1', 'U4', 'U5'], 'U2 (bad key) → U4; U3 (failed review) → U5');
    assert.strictEqual(r.writeCheck.failed.length, 2);
  });
  await test('D20c', 'pipeline: a busy provider is retried on the same target, not answered by burning reserves', async () => {
    const tu = (id, d, extra = {}) => ({ claimId: id, plannedDifficulty: d, subtopic: `sub ${id}`, statement: `st ${id}`, transcriptExcerpt: `passage ${id}`, lectureUnitId: id, questionAngle: 'concept', ...extra });
    let calls = 0;
    const writer = {
      generateQuestionBatch: async (ts) => ts.map(t => { calls++; return calls === 1 ? { isUnfulfilled: true, unfulfilledReason: 'PROVIDER_UNAVAILABLE', message: 'PROVIDER_UNAVAILABLE' } : { question: `Q ${t.lectureUnitId}?`, options: ['a', 'b', 'c', 'd'].map(x => `${x}${t.lectureUnitId}`), correctAnswer: `a${t.lectureUnitId}` }; }),
      generateQuestion: async () => null
    };
    const reviewer = { evaluateAndRepairQuestion: async (c) => (c.isUnfulfilled ? { status: 'UNFULFILLED', failureReasons: [c.unfulfilledReason] } : { status: 'PASS', mcq: c }) };
    process.env.HARD_OVERGENERATE = '0'; // this test is about retries; extra Hard candidates are tested in D45
    let r;
    try { r = await pipeline.run({ count: 1, difficulty: 'Hard', teachingUnits: [tu('U1', 'Hard'), tu('U9', 'Hard', { isReserve: true })] }, { blocks: [] }, () => {}, { writer, reviewer, providerWaitMs: 0 }); }
    finally { delete process.env.HARD_OVERGENERATE; }
    assert.strictEqual(r.questions.length, 1);
    assert.strictEqual(r.questions[0].metadata.lectureUnitId, 'U1', 'same point, written after the retry');
    assert.strictEqual(r.writeCheck.providerRetries, 1);
  });
  await test('D20b', 'gate: two questions that mean the same are duplicates even with different words', async () => {
    const gate = require('../engine/validators/finalQualityGate');
    const orig = I.callJson; const origEmb = semantic.embedMany;
    I.callJson = async () => ({ model: 'stub', data: { results: [1, 2].map(q => ({ q, answer: 'A', alsoDefensible: [], grounded: true, correct: true, distractorsValid: true, plausible: true, aligned: true, complete: true, clear: true, fair: true, explanationOk: true, steps: 1, level: 'apply', fact: q === 1 ? 'alpha' : 'omega' })), duplicates: [] } });
    semantic.embedMany = async (texts) => texts.map(() => [1, 0.01]);
    try {
      const mk = (s) => ({ question: s, options: ['Type 1 error', 'Type 2 error', 'True negative', 'True positive'], correctAnswer: 'Type 1 error', difficulty: 'Easy' });
      const qs = [mk('Spam marked as spam by mistake: which error?'), mk('Another name for a false positive?')];
      const r = await gate.finalQualityGate(qs, { lectureModel: null });
      assert.strictEqual(r.accepted.length, 1); assert(qs[1].qualityGate.criteria.includes('DUPLICATE'));
    } finally { I.callJson = orig; semantic.embedMany = origEmb; }
  });

  // D21 Smart key use: the chosen model on every key before any other model; least-used key first
  await test('D21', 'router: a busy key hands the request to the same model on another key, not to another model', async () => {
    const axios = require('axios');
    const router = require('../engine/adapter/llmRouter');
    const saved = { ...process.env }; const origPost = axios.post;
    Object.keys(process.env).filter(k => /^GROQ_/.test(k)).forEach(k => delete process.env[k]);
    ['A', 'B', 'C'].forEach((x, i) => { process.env[i ? `GROQ_API_KEY_T${i}` : 'GROQ_API_KEY'] = `gsk_test_key_${x}_${'x'.repeat(30)}`; });
    process.env.DISABLE_GEMINI = 'true';
    const seen = [];
    axios.post = async (url, body, cfg) => {
      const key = String(cfg.headers.Authorization).slice(-36, -30);
      seen.push(`${key}:${body.model}`);
      if (key.includes('A')) { const e = new Error('Request failed with status code 429'); e.response = { status: 429, data: { error: { message: 'Rate limit reached on tokens per minute (TPM): try again in 20s' } }, headers: {} }; throw e; }
      return { data: { choices: [{ message: { content: '{"ok":true}' } }], usage: {} }, headers: {} };
    };
    try {
      router.modelCooldowns.clear(); router.keyCooldowns.clear(); router.routeTokenBudget.clear(); router.currentKeyIndex = 0;
      await router.complete({ prompt: 'json please', systemPrompt: 'json', operation: 'TEST', groqModels: ['model-one', 'model-two'], noGeminiFallback: true, maxTokens: 20 });
    } finally { axios.post = origPost; Object.keys(process.env).forEach(k => { if (!(k in saved)) delete process.env[k]; }); Object.assign(process.env, saved); }
    assert(seen.length >= 2, seen.join(' '));
    assert(seen.every(x => x.endsWith(':model-one')), `switched model: ${seen.join(' ')}`);
    assert(!seen[1].startsWith(seen[0].split(':')[0]), `retried the busy key: ${seen.join(' ')}`);
  });

  // D22 Medium/Hard must give the student something to work on; a recall-only stem gets one rewrite
  await test('D22', 'a Medium question answerable by recall is rewritten into an applied one before acceptance', async () => {
    assert.strictEqual(pipeline.lacksConcreteCase({ question: "What is the decoder's function in an autoencoder?" }, 'Medium'), true);
    assert.strictEqual(pipeline.lacksConcreteCase({ question: 'A team increases the bottleneck from 32 to 128 neurons. What happens to clarity?' }, 'Medium'), false);
    assert.strictEqual(pipeline.lacksConcreteCase({ question: 'What does the base case do?' }, 'Easy'), false);
    let rewriteAsked = '';
    const writer = {
      generateQuestionBatch: async (ts) => ts.map(() => ({ question: "What is the decoder's function in an autoencoder?", options: ['Reconstructs input', 'Compresses input', 'Labels data', 'Shuffles data'], correctAnswer: 'Reconstructs input' })),
      generateQuestion: async (t, ctx, instr) => { rewriteAsked = instr; return { question: 'A team doubles the bottleneck of their autoencoder from 32 to 64 neurons. What happens to the reconstructions?', options: ['Sharper', 'Blurrier', 'Identical', 'Empty'], correctAnswer: 'Sharper' }; }
    };
    const reviewer = { evaluateAndRepairQuestion: async (c) => ({ status: 'PASS', mcq: c }) };
    const r = await pipeline.run({ count: 1, difficulty: 'Medium', teachingUnits: [{ claimId: 'U1', plannedDifficulty: 'Medium', subtopic: 'decoder', statement: 's', transcriptExcerpt: 'p', lectureUnitId: 'U1', questionAngle: 'concept' }] }, { blocks: [] }, () => {}, { writer, reviewer });
    assert(/REWRITE FOR MEDIUM/.test(rewriteAsked), 'rewrite instruction sent');
    assert(/bottleneck/.test(r.questions[0].question), 'applied version accepted');
  });

  await test('D23', 'only planned code questions (output/trace/debug) are required to show code', async () => {
    const mk = (angle, hasCode) => pipeline.toTarget({ plannedDifficulty: 'Medium', subtopic: 's', statement: 's', lectureUnitId: 'U1', questionAngle: angle, hasCode }, 'T', 0, 'Medium');
    assert.strictEqual(mk('trace', true).formatRecommendation, 'CODE_ANALYSIS');
    assert.strictEqual(mk('concept', true).formatRecommendation, null);
    assert.strictEqual(mk('concept', false).formatRecommendation, 'PROSE_MULTIPLE_CHOICE');
  });

  await test('D24', 'a key that names no option (a copied template phrase) falls back to the model own valid index; a conflicting key does not', async () => {
    const src = require('fs').readFileSync(require.resolve('../engine/agents/agent2Generator'), 'utf8');
    assert(!/"correctAnswer": "Valid factual formulation"/.test(src), 'template no longer shows a copyable answer');
    const fn = new Function(src.slice(src.indexOf('function resolveKeyToOption'), src.indexOf('module.exports = new Agent2Generator')) + '; return resolveKeyToOption;')();
    const o = ['Within intimate or family relationships', 'Only in public spaces', 'Only verbal abuse', 'A protest against norms'];
    assert.strictEqual(fn(o, 'Valid factual formulation', 0), o[0]);
    assert.strictEqual(fn(o, 'Only verbal abuse and threats', 0), null, 'key resembles option 3, index says 0: no guess');
    assert.strictEqual(fn(o, 'Valid factual formulation', 9), null, 'invalid index: no guess');
  });

  await test('D25', 'calibration judges difficulty blind: the per-window labels are not shown to it', async () => {
    let prompt = '';
    const m = model([unit({ id: 'U01', angles: [ang('trace', 'hard')] })]);
    await lm.calibrateLecture(m, undefined, { callJson: async (o) => { prompt = o.prompt; return { provider: 's', model: 's', data: { teachable: true, intent: 'i', level: 'INTRODUCTORY', difficulty: { easy: 'e', medium: 'm', hard: 'h' }, units: [{ id: 'U01', role: 'CORE', angles: [{ i: 0, difficulty: 'medium' }] }] } }; } });
    assert(/a0 trace: /.test(prompt) && !/a0 trace\/hard/.test(prompt), 'label hidden');
    assert.strictEqual(m.units[0].angles[0].difficulty, 'medium');
    assert.strictEqual(m.calibration.relabelledAngles, 1);
  });
  await test('D26', 'nothing taught (greetings, admin only): calibration marks the input not teachable and no point keeps a question angle', async () => {
    const m = model([unit({ id: 'U01', angles: [ang('concept', 'easy')] })]);
    await lm.calibrateLecture(m, undefined, { callJson: async () => ({ provider: 's', model: 's', data: { teachable: false, units: [] } }) });
    assert.strictEqual(m.calibration.teachable, false);
    assert(m.units.every(u => u.angles.length === 0));
  });

  await test('D27', 'a question failing only wording heuristics goes on to the gate; one failing correctness does not', async () => {
    const tu = (id) => ({ claimId: id, plannedDifficulty: 'Easy', subtopic: `s ${id}`, statement: 's', transcriptExcerpt: 'p', lectureUnitId: id, questionAngle: 'concept' });
    const writer = { generateQuestionBatch: async (ts) => ts.map(t => ({ question: `Q ${t.lectureUnitId}?`, options: ['a', 'b', 'c', 'd'].map(x => x + t.lectureUnitId), correctAnswer: 'a' + t.lectureUnitId })), generateQuestion: async () => null };
    const reviewer = { evaluateAndRepairQuestion: async (c, t) => ({ status: 'FAIL', failureReasons: t.lectureUnitId === 'U1' ? ['AMBIGUOUS_DISTRACTOR'] : ['KEYED_ANSWER_INCORRECT'] }) };
    const r = await pipeline.run({ count: 2, difficulty: 'Easy', teachingUnits: [tu('U1'), tu('U2')] }, { blocks: [] }, () => {}, { writer, reviewer });
    assert.deepStrictEqual(r.questions.map(q => q.metadata.lectureUnitId), ['U1']);
  });
  await test('D28', 'a second question on the same point is planned only for a different skill', async () => {
    const u = unit({ topic: 'T', angles: [ang('recall', 'easy'), ang('concept', 'easy'), ang('application', 'easy')] });
    const plan = lm.planRequest(model([u]), 3, 'Easy', { styleGuided: false });
    const fams = plan.selected.map(p => p.angle.type);
    assert(!(fams.includes('concept') && fams.includes('mechanism')), fams.join(','));
    assert.strictEqual(plan.selected.length, 3, 'recall, concept and application are three different skills');
    const v = unit({ topic: 'T', angles: [ang('concept', 'easy'), ang('mechanism', 'easy')] });
    const plan2 = lm.planRequest(model([v]), 2, 'Easy', { styleGuided: false });
    assert.strictEqual(plan2.selected.length, 1, 'concept and mechanism are the same skill: one question, the rest is a stated shortfall');
  });

  await test('D29', 'one pinned model out of its daily allowance does not block calls to the other models', async () => {
    const router = require('../engine/adapter/llmRouter');
    const orig = router._complete.bind(router);
    router.outage = null;
    router._complete = async (o) => { if (o.groqModels) { const e = new Error('NO_LLM_PROVIDER_AVAILABLE: DAILY_LIMIT: openai/gpt-oss-120b daily token allowance used'); e.code = 'NO_LLM_PROVIDER_AVAILABLE'; throw e; } return '{"ok":true}'; };
    try {
      await router.complete({ prompt: 'x', groqModels: ['openai/gpt-oss-120b'], noGeminiFallback: true }).catch(() => null);
      const out = await router.complete({ prompt: 'x', model: 'qwen/qwen3.8-27b' });
      assert.strictEqual(out, '{"ok":true}', 'the unpinned call went through');
      assert.strictEqual(router.getOutage(), null, 'no global outage');
    } finally { router._complete = orig; router.outage = null; }
  });

  await test('D30', 'a terminal session or code pasted from the class counts as taught, not as supplementary material', async () => {
    const units = [unit({ topic: 'SQL basics', source: 'SPOKEN', angles: [ang('concept', 'easy')] }), unit({ id: 'UT', topic: 'Joins', source: 'MATERIAL', blocks: ['D01'], angles: [ang('output', 'easy')] }), unit({ id: 'US', topic: 'Extra', source: 'MATERIAL', blocks: ['D02'], angles: [ang('concept', 'easy')] })];
    const m = model(units, { blocks: [{ id: 'D01', source: 'MATERIAL', kind: 'TERMINAL', text: 'mysql> SELECT ...' }, { id: 'D02', source: 'MATERIAL', text: 'slide text' }] });
    const plan = lm.planRequest(m, 2, 'Easy', { styleGuided: false });
    const ids = plan.selected.map(p => p.unit.id);
    assert(ids.includes('UT'), `terminal session planned as taught: ${ids}`);
    assert(!ids.includes('US'), 'slide-only point stays a supplement');
    assert.strictEqual(plan.fromMaterialOnly, 0);
  });

  await test('D31', 'peripheral points (setup clicks, tool trivia) are planned only after the core ones run out', async () => {
    const core = [unit({ id: 'C1', topic: 'Java', role: 'CORE', angles: [ang('concept', 'easy')] }), unit({ id: 'C2', topic: 'Java', role: 'SUPPORTING', angles: [ang('concept', 'easy')] })];
    const side = unit({ id: 'P1', topic: 'IDE', role: 'PERIPHERAL', angles: [ang('recall', 'easy')] });
    const m = model([...core, side], { shares: { Java: 20, IDE: 80 } });
    const ids2 = lm.planRequest(m, 2, 'Easy', { styleGuided: false }).selected.map(p => p.unit.id).sort();
    assert.deepStrictEqual(ids2, ['C1', 'C2'], 'even when the IDE topic took most of the time');
    const ids3 = lm.planRequest(m, 3, 'Easy', { styleGuided: false }).selected.map(p => p.unit.id).sort();
    assert.deepStrictEqual(ids3, ['C1', 'C2', 'P1'], 'used when needed');
  });

  await test('D32', 'scanned PDF detection ignores repeated watermarks and URL footers', async () => {
    const src = require('fs').readFileSync(require.resolve('../engine/documentRouter/geminiVisionReader'), 'utf8');
    assert(/freq\.get\(l\) < 3/.test(src) && /www\\./.test(src), 'repeated lines and URLs are excluded before measuring the text layer');
  });
  await test('D33', 'a short text that is not a subject is refused, not turned into notes', async () => {
    const src = require('fs').readFileSync(require.resolve('../engine/intelligence/lectureModel'), 'utf8');
    assert(/isTopic": false/.test(src) && /NOT_A_TOPIC/.test(src));
    const ctrl = require('fs').readFileSync(require.resolve('../controllers/quizController'), 'utf8');
    assert(/lm\.reason === 'NOT_A_TOPIC'/.test(ctrl) && /tm\.reason === 'NOT_A_TOPIC'/.test(ctrl), 'both preview and generation refuse with the reason');
  });

  await test('D34', 'gate: a batch too large for the provider is split and still judged', async () => {
    const gate = require('../engine/validators/finalQualityGate');
    const orig = I.callJson; const origEmb = semantic.embedMany; let calls = 0;
    I.callJson = async (o) => { calls++; const n = (o.prompt.match(/^Q\d+ \[/gm) || []).length; if (n > 1) throw new Error('PROMPT_TOO_LARGE_FOR_GROQ'); const q = Number((o.prompt.match(/^Q(\d+) \[/m) || [])[1]); return { model: 'stub', data: { results: [{ q, answer: 'A', alsoDefensible: [], grounded: true, correct: true, distractorsValid: true, plausible: true, aligned: true, complete: true, clear: true, fair: true, explanationOk: true, steps: 1, level: 'apply', fact: 'f' + q }], duplicates: [] } }; };
    semantic.embedMany = async () => null;
    try {
      const mk = (i) => ({ question: `Distinct question number ${i} about topic ${i}?`, options: ['Alpha ' + i, 'Beta ' + i, 'Gamma ' + i, 'Delta ' + i], correctAnswer: 'Alpha ' + i, difficulty: 'Easy' });
      const r = await gate.finalQualityGate([mk(1), mk(2), mk(3)], { lectureModel: null });
      assert.strictEqual(r.accepted.length, 3, JSON.stringify(r.rejected.map(x => x.reasons)));
      assert(calls >= 4, 'split into single-question calls');
    } finally { I.callJson = orig; semantic.embedMany = origEmb; }
  });
  await test('D35', 'a long lecture is calibrated in parts; every part is applied', async () => {
    const units = Array.from({ length: 60 }, (_, i) => unit({ id: `U${i + 1}`, angles: [ang('concept', 'easy')] }));
    const m = model(units); let calls = 0;
    await lm.calibrateLecture(m, undefined, { callJson: async (o) => { calls++; const ids = [...o.prompt.matchAll(/^(U\d+) \[/gm)].map(x => x[1]); return { provider: 's', model: 's', data: { teachable: true, intent: 'i', level: 'INTERMEDIATE', difficulty: { easy: 'e', medium: 'm', hard: 'h' }, units: ids.map(id => ({ id, role: 'CORE', angles: [{ i: 0, difficulty: 'medium' }] })) } }; } });
    assert.strictEqual(calls, 3, '60 points in parts of 28');
    assert(m.units.every(u => u.angles[0].difficulty === 'medium'), 'all parts applied');
  });

  await test('D36', 'a replacement for a too-shallow question is written with the gate reason; depth stays strict until the last round', async () => {
    const pipe = require('../engine/mcq/lecturePipeline');
    const hint = pipe.DEEPER_HINT('Hard', 'DEPTH: Planned Hard but it needs 1 reasoning step');
    assert(/two dependent reasoning steps/.test(hint) && /needs 1 reasoning step/.test(hint));
    const seen = [];
    const writer = { generateQuestionBatch: async () => { throw new Error('batch must not be used with a hint'); },
      generateQuestion: async (t, ctx, instr) => { seen.push(instr); return { question: 'Given x=3 and y=4 in the traced code, what does the loop print after two passes?', options: ['A1', 'B2', 'C3', 'D4'], correctAnswer: 'A1', difficulty: 'Hard' }; } };
    const reviewer = { evaluateAndRepairQuestion: async (c) => ({ status: 'PASS', mcq: c }) };
    const u = { id: 'U1', unitId: 'U1', lectureUnitId: 'U1', targetDifficulty: 'Hard', difficulty: 'Hard', subtopic: 's', evidence: 'e' };
    await pipe.run({ count: 1, difficulty: 'Hard', teachingUnits: [u], writeHint: hint }, { blocks: [] }, () => {}, { writer, reviewer });
    assert.strictEqual(seen[0], hint);
    const ctrl = require('fs').readFileSync(require.resolve('../controllers/quizController'), 'utf8');
    assert(/round < ROUNDS - 1 \? undefined : 'relabel'/.test(ctrl), 'only the last replacement round relabels');
  });

  await test('D37', 'a key quoting tool output the class never saw is ungrounded; output the class saw passes', async () => {
    const { unseenToolOutput } = require('../engine/validators/finalQualityGate');
    const lm = { ok: true, blocks: [{ text: 'mysql> CREATE TABLE t (id INT); Query OK, 0 rows affected (0.02 sec) mysql> SELECT ... GROUP BY d HAVING COUNT(s.id) > 1;' }] };
    const q = (k) => ({ question: 'What does MySQL print?', options: [k, 'w', 'x', 'y'], correctAnswer: k });
    assert.strictEqual(unseenToolOutput(q('Query OK, 0 rows affected'), lm), null);
    assert(unseenToolOutput(q('MySQL returns an error: Invalid use of group function'), lm));
    assert.strictEqual(unseenToolOutput(q('It groups rows by department'), lm), null, 'ordinary keys are not checked');
    assert.strictEqual(unseenToolOutput(q('MySQL returns an error: Invalid use of group function'), { ok: true, isTopicNotes: true, blocks: lm.blocks }), null, 'topic notes are not checked');
  });

  await test('D38', 'a question naming a snippet must show it; a replacement that could not be written keeps its slot', async () => {
    const g = require('../engine/validators/finalQualityGate');
    const mk = (s) => ({ question: s, options: ['a', 'b', 'c', 'd'], correctAnswer: 'a' });
    assert(g.deterministicProblems(mk('Given the Dockerfile snippet, what is the path of requirements.txt when RUN executes?')).some(p => p.code === 'COMPLETENESS'));
    assert.strictEqual(g.deterministicProblems(mk(['Given the Dockerfile snippet:', 'FROM python:3.8', 'WORKDIR /app', 'COPY requirements.txt .', 'Where is requirements.txt?'].join('\n'))).length, 0);
    const ctrl = require('fs').readFileSync(require.resolve('../controllers/quizController'), 'utf8');
    assert(/pending = \[\.\.\.gateN\.rejected, \.\.\.unwritten\]/.test(ctrl), 'unwritten slots stay pending');
  });

  await test('D39', 'slide superscripts and subscripts are kept (2^n, C_(IN)), not flattened to 2n', async () => {
    const { paragraphsFromXml } = require('../utils/pptxSlides');
    const xml = '<a:p><a:r><a:rPr lang="en"/><a:t>one of 2</a:t></a:r><a:r><a:rPr baseline="30000"/><a:t>n</a:t></a:r><a:r><a:t> inputs, carry C</a:t></a:r><a:r><a:rPr baseline="-25000"/><a:t>IN</a:t></a:r></a:p>';
    assert.deepStrictEqual(paragraphsFromXml(xml), ['one of 2^n inputs, carry C_(IN)']);
  });

  await test('D40', 'a numeric key the explanation does not arrive at is rejected; percent and comparisons are not false flags', async () => {
    const { keyContradictsWorking: k } = require('../engine/validators/finalQualityGate');
    const q = (key, explanation) => ({ options: [key, 'x', 'y', 'z'], correctAnswer: key, explanation });
    assert(k(q('approximately 1.82 units', 'T = 20 / 4.25, which equals approximately 4.705, but adjusting yields 1.82')));
    assert.strictEqual(k(q('54.44 A', 'I = 40550 / (1.732 * 500 * 0.86) = 54.44 A')), null);
    assert.strictEqual(k(q('25% of the original torque', 'T is proportional to V^2, so (0.5)^2 = 0.25')), null);
    assert.strictEqual(k(q('Balance is 150.0', 'deposit throws when amount <= 0, so the balance stays as it was')), null);
  });

  await test('D41', 'a reviewer that could not reach any model means retry the same question, not reject it', async () => {
    const a3 = require('../engine/agents/agent3Evaluator');
    const ev = a3.evaluateQuestion ? a3 : (a3.default || a3);
    const orig = ev.evaluateQuestion;
    ev.evaluateQuestion = async () => ({ status: 'FAIL', failureReasons: ['VERIFICATION_FAILED'], criticUnavailable: true, criticUnavailableReason: 'NO_LLM_PROVIDER_AVAILABLE: All AI providers failed (DAILY_LIMIT)' });
    try {
      const r = await ev.evaluateAndRepairQuestion({ questionText: 'q', options: ['a', 'b', 'c', 'd'], correctAnswer: 'a' }, { targetDifficulty: 'Easy' }, {}, null, { allowRepair: true });
      assert.strictEqual(r.status, 'PROVIDER_UNAVAILABLE');
      assert(/^PROVIDER_UNAVAILABLE/.test(r.failureReasons[0]));
    } finally { ev.evaluateQuestion = orig; }
    let calls = 0;
    const pipe = require('../engine/mcq/lecturePipeline');
    const writer = { generateQuestionBatch: async (b) => b.map(() => ({ question: 'Which command lists files in the current directory?', options: ['ls', 'cd', 'pwd', 'rm'], correctAnswer: 'ls', difficulty: 'Easy' })), generateQuestion: async () => null };
    const reviewer = { evaluateAndRepairQuestion: async (c) => (++calls < 3 ? { status: 'PROVIDER_UNAVAILABLE', failureReasons: ['PROVIDER_UNAVAILABLE: busy'] } : { status: 'PASS', mcq: c }) };
    const u = { id: 'U1', unitId: 'U1', lectureUnitId: 'U1', targetDifficulty: 'Easy', difficulty: 'Easy', subtopic: 's', evidence: 'e' };
    const out = await pipe.run({ count: 1, difficulty: 'Easy', teachingUnits: [u] }, { blocks: [] }, () => {}, { writer, reviewer, providerWaitMs: 1 });
    assert.strictEqual(out.questions.length, 1, 'same question accepted after the provider came back');
  });

  await test('D42', 'PROVE: only questions with a proven key and an exact lecture quote are delivered (pass-1 defects all stopped)', async () => {
    const { proveQuestions } = require('../engine/validators/keyProof');
    const lmP = { ok: true, units: [], blocks: [
      { text: 'Torque is T = K S E2^2 R2 / (R2^2 + (S X2)^2). Rotor resistance controls starting torque.' },
      { text: 'mysql> SELECT d.dept_name, COUNT(s.id) FROM departments d LEFT JOIN students s ON s.dept_id = d.dept_id GROUP BY d.dept_name HAVING COUNT(s.id) > 1;' },
      { text: 'Binary search halves the search range on every step, so it takes O(log n) time on a sorted array.' },
      { text: 'A queue is used for level order traversal of a binary tree.' }
    ] };
    const agree = { status: 'AGREES' };
    const torque = { question: 'Calculate the torque if slip is 0.1, rotor resistance is 2, reactance is 5 and K*E2^2 is 100.', options: ['approximately 2.50 units', 'approximately 3.33 units', 'approximately 5.00 units', 'approximately 1.82 units'], correctAnswer: 'approximately 1.82 units', blindCheck: agree };
    const sqlErr = { question: 'Which data structure is used for level order traversal?', options: ['A stack', 'A queue', 'A heap', 'A hash table'], correctAnswer: 'A queue', blindCheck: agree };
    const invented = { question: 'What does MySQL print for GROUP BY d.dept_name WHERE COUNT(s.id) > 1?', options: ['zero rows', 'MySQL returns an error: Invalid use of group function', 'all rows', 'only CSE'], correctAnswer: 'MySQL returns an error: Invalid use of group function', blindCheck: agree };
    const order = { question: 'Holding R2 under the ordering protocol, in which order may it request R1, R3, R4?', options: ['R1, R3, R4', 'R3, R4, R1', 'R4, R3, R1', 'R1, R4, R3'], correctAnswer: 'R3, R4, R1', blindCheck: agree };
    const bs = { question: 'How many steps does the binary_search below take on [10,20,30,40,50] for 30?\ndef binary_search(arr, t):\n    ...', options: ['1', '2', '3', '5'], correctAnswer: '1', blindCheck: agree };
    const unblind = { question: 'Why is binary search O(log n)?', options: ['It halves the range each step', 'It scans every element', 'It sorts first', 'It uses hashing'], correctAnswer: 'It halves the range each step', blindCheck: { status: 'NOT_CHECKED' } };
    const qs = [torque, sqlErr, invented, order, bs, unblind];
    const proofs = {
      0: { answer: 'D', quote: 'Torque is T = K S E2^2 R2 / (R2^2 + (S X2)^2)', solver: 'function solve(){ const s=0.1,R=2,X=5,K=100; return K*s*R/(R*R+(s*X)**2); }' },
      1: { answer: 'B', quote: 'A queue is used for level order traversal of a binary tree.' },
      2: { answer: 'B', quote: 'MySQL returns an error: Invalid use of group function', solver: '' },
      3: { answer: 'A', quote: 'requests resources in increasing order', solver: '' },
      4: { answer: 'A', quote: 'Binary search halves the search range on every step', solver: 'function solve(){ const a=[10,20,30,40,50]; let lo=0,hi=a.length-1,steps=0; while(lo<=hi){steps++; const m=Math.floor((lo+hi)/2); if(a[m]===30) return steps; if(a[m]<30) lo=m+1; else hi=m-1;} return -1; }' },
      5: { answer: 'A', quote: 'Binary search halves the search range on every step' }
    };
    const callJson = async ({ prompt }) => {
      const ids = [...prompt.matchAll(/^Q(\d+)\./gm)].map(m => Number(m[1]));
      const stems = qs.filter(q => prompt.includes(q.question.split('\n')[0]));
      return { model: 'stub', data: { proofs: stems.map((q, i) => ({ q: ids[i], ...proofs[qs.indexOf(q)] })) } };
    };
    const second = async (list) => list.map(q => (/binary_search|steps does/.test(q.question) ? 'function solve(){ const a=[10,20,30,40,50]; let lo=0,hi=4,s=0; while(lo<=hi){s++; const m=Math.floor((lo+hi)/2); if(a[m]===30) return s; if(a[m]<30) lo=m+1; else hi=m-1;} return -1; }' : null));
    const r = await proveQuestions(qs, lmP, { callJson, retryWaitMs: 1, secondSolver: second });
    const proven = r.proven.map(q => qs.indexOf(q)).sort();
    assert.deepStrictEqual(proven, [1, 4], JSON.stringify(r.rejected.map(x => x.reasons[0])));
    const why = (q) => r.rejected.find(x => x.question === q).reasons[0];
    assert(/none of the options/.test(why(torque)), why(torque));
    assert(/GROUNDING/.test(why(invented)) || /TECHNICAL/.test(why(invented)), why(invented));
    assert(/second independent solve/.test(why(order)), why(order));
    assert(/blind solve did not confirm/.test(why(unblind)), why(unblind));
    assert(r.proven.every(q => q.keyProof.status === 'PROVEN' && q.keyProof.quote));
    // Provider down twice: nothing is delivered unproven.
    const down = await proveQuestions([{ ...sqlErr }], lmP, { callJson: async () => { throw new Error('NO_LLM_PROVIDER_AVAILABLE'); }, retryWaitMs: 1 });
    assert.strictEqual(down.proven.length, 0);
    assert(/NOT_VALIDATED/.test(down.rejected[0].reasons[0]));
  });

  await test('D43', 'PROVE: tool output the class saw is proven by the session; invented output and "why" questions about code are not treated as computed', async () => {
    const { proveQuestions, isComputable } = require('../engine/validators/keyProof');
    const lmP = { ok: true, units: [], blocks: [{ text: 'mysql> CREATE TABLE students (id INT PRIMARY KEY, name VARCHAR(30)); Query OK, 0 rows affected (0.02 sec)' }] };
    const seen = { question: 'What does MySQL print after this command?\nCREATE TABLE students (id INT PRIMARY KEY, name VARCHAR(30));', options: ['1 row in set', 'Query OK, 0 rows affected', 'Query OK, 1 row affected', 'Table created successfully'], correctAnswer: 'Query OK, 0 rows affected', blindCheck: { status: 'AGREES' } };
    const made = { question: 'What does MySQL print for this query?\nSELECT a FROM t GROUP BY a WHERE COUNT(x) > 1;', options: ['zero rows', 'MySQL returns an error: Invalid use of group function', 'all rows', 'one row'], correctAnswer: 'MySQL returns an error: Invalid use of group function', blindCheck: { status: 'AGREES' } };
    const callJson = async ({ prompt }) => ({ model: 'stub', data: { proofs: [...prompt.matchAll(/^Q(\d+)\.[\s\S]*?(?=^Q\d+\.|For EACH)/gm)].map(m => {
      const isSeen = m[0].includes('CREATE TABLE');
      return { q: Number(m[1]), answer: 'B', quote: isSeen ? 'Query OK, 0 rows affected' : 'GROUP BY a HAVING COUNT', solver: isSeen ? 'function solve(){ return "Query OK, 0 rows affected"; }' : 'function solve(){ return "MySQL returns an error: Invalid use of group function"; }' };
    }) } });
    const r = await proveQuestions([seen, made], lmP, { callJson, retryWaitMs: 1, secondSolver: async (l) => l.map(() => 'function solve(){ return "Query OK, 0 rows affected"; }') });
    assert.deepStrictEqual(r.proven, [seen], JSON.stringify(r.rejected.map(x => x.reasons[0])));
    assert(/fixed answer/.test(r.rejected[0].reasons[0]));
    assert.strictEqual(isComputable({ question: 'Why is // used here?\ndef bs(a):\n    mid = (lo + hi) // 2\n    return mid', options: ['To ensure mid is an integer index for array access', 'b', 'c', 'd'], correctAnswer: 'To ensure mid is an integer index for array access' }), false);
  });

  await test('D44', 'Gemini keys work as a pool: a quota error moves to the next key; a daily limit rests that key', async () => {
    const gk = require('../engine/utils/geminiKeys');
    const saved = {}; for (const n of Object.keys(process.env)) if (/^GEMINI_API_KEY/.test(n)) { saved[n] = process.env[n]; delete process.env[n]; }
    try {
      process.env.GEMINI_API_KEY = 'k-main'; process.env.GEMINI_API_KEY_EXP_1 = 'k-exp1'; process.env.GEMINI_API_KEY_EXP_2 = 'k-exp2';
      gk._reset();
      assert.strictEqual(gk.count(), 3);
      const used = [];
      const out = await gk.withKey(async (k) => { used.push(k); if (k !== 'k-exp2') throw new Error('[429 Too Many Requests] You exceeded your current quota'); return 'ok'; });
      assert.strictEqual(out, 'ok'); assert.deepStrictEqual(used, ['k-main', 'k-exp1', 'k-exp2']);
      assert.strictEqual(gk.key(), 'k-exp2', 'daily-limited keys stay resting');
      await assert.rejects(() => gk.withKey(async () => { throw new Error('400 bad request'); }), /400/);
      delete process.env.GEMINI_API_KEY_EXP_1; delete process.env.GEMINI_API_KEY_EXP_2; gk._reset();
      const one = []; await assert.rejects(() => gk.withKey(async (k) => { one.push(k); throw new Error('429 quota'); }), /429/);
      assert.deepStrictEqual(one, ['k-main'], 'one key: one try, as before');
    } finally {
      for (const n of Object.keys(process.env)) if (/^GEMINI_API_KEY/.test(n)) delete process.env[n];
      Object.assign(process.env, saved); gk._reset();
    }
  });

  await test('D45', 'Hard: extra candidates are written in the first wave from Hard reserves; the controller keeps the planned number', async () => {
    const pipe = require('../engine/mcq/lecturePipeline');
    const tu = (id, extra = {}) => ({ claimId: id, plannedDifficulty: 'Hard', subtopic: `sub ${id}`, statement: `st ${id}`, transcriptExcerpt: `passage ${id}`, lectureUnitId: id, questionAngle: 'trace', ...extra });
    const units = [tu('U1'), tu('U2'), tu('U3'), tu('U4'), tu('U5'), ...['R1', 'R2', 'R3', 'R4'].map(id => tu(id, { isReserve: true }))];
    const writer = { generateQuestionBatch: async (ts) => ts.map(t => ({ question: `Given x=${t.lectureUnitId}, trace it twice?`, options: ['a', 'b', 'c', 'd'].map(x => `${x}${t.lectureUnitId}`), correctAnswer: `a${t.lectureUnitId}`, difficulty: 'Hard' })), generateQuestion: async () => null };
    const reviewer = { evaluateAndRepairQuestion: async (c) => ({ status: 'PASS', mcq: c }) };
    const r = await pipe.run({ count: 5, difficulty: 'Hard', teachingUnits: units }, { blocks: [] }, () => {}, { writer, reviewer, providerWaitMs: 0 });
    assert.strictEqual(r.writeCheck.extraHard, 2, 'ceil(0.4 x 5) extra Hard candidates');
    assert.strictEqual(r.questions.length, 7);
    assert.strictEqual(r.writeCheck.extraOther, 0, 'no Easy/Medium planned, none extra');
    const ctrl = require('fs').readFileSync(require.resolve('../controllers/quizController'), 'utf8');
    assert(/const accepted = fitToPlan\(gate\.accepted\.slice\(\), sessionInputs\.count \|\| generatedCount\);/.test(ctrl), 'trimmed to the requested count after the gate');
  });

  await test('D46', 'PROVE: a computed key needs a second independent computation that also reproduces it', async () => {
    const { proveQuestions } = require('../engine/validators/keyProof');
    const lmP = { ok: true, units: [], blocks: [{ text: 'A binary tree of height h has at least h + 1 nodes and at most 2^(h+1) - 1 nodes when height counts edges.' }] };
    const q = { question: 'Calculate the minimum and maximum number of nodes in a binary tree of height 3.', options: ['Minimum 4 nodes, maximum 15 nodes', 'Minimum 7 nodes, maximum 8 nodes', 'Minimum 3 nodes, maximum 7 nodes', 'Minimum 8 nodes, maximum 16 nodes'], correctAnswer: 'Minimum 7 nodes, maximum 8 nodes', blindCheck: { status: 'AGREES' } };
    const callJson = async () => ({ model: 'stub', data: { proofs: [{ q: 1, answer: 'B', quote: 'A binary tree of height h has at least h + 1 nodes', solver: 'function solve(){ const h=3; return [Math.pow(2,h)-1, Math.pow(2,h)]; }' }] } });
    const r = await proveQuestions([q], lmP, { callJson, retryWaitMs: 1, secondSolver: async () => ['function solve(){ const h=3; return [h+1, Math.pow(2,h+1)-1]; }'] });
    assert.strictEqual(r.proven.length, 0, 'the key reproduced by one computation only is not delivered');
    assert(/second independent computation gives \[4,15\]/.test(r.rejected[0].reasons[0]), r.rejected[0].reasons[0]);
  });

  await test('D47', 'review fixes: sandbox has no host objects, every number must match, literals detected, real answering model reported', async () => {
    const k = require('../engine/validators/keyProof');
    assert.strictEqual(k.runSolver('function solve(){ return Math.constructor.constructor("return typeof proc" + "ess")(); }'), 'undefined', 'no path to the host process');
    assert.deepStrictEqual(k.optionsMatching(15, ['Minimum 4 nodes, maximum 15 nodes', '15 nodes', '16', '7']), [1]);
    assert.deepStrictEqual(k.optionsMatching(54.44, ['54.44 A', '44.5 A', '60 A', '31.4 A']), [0]);
    const src = require('fs').readFileSync(require.resolve('../engine/validators/keyProof'), 'utf8');
    assert(src.includes(String.raw`(?:\\.|(?!\1).)*\1/g`), 'escaped characters inside string literals are skipped');
    const blind = require('fs').readFileSync(require.resolve('../engine/validators/blindAnswerCheck'), 'utf8');
    assert(!/split\(\/s\+\/\)/.test(blind), 'whitespace split, not the letter s');
    assert(/model: meta\.model \|\| models\[0\]/.test(blind), 'the model that actually answered is reported');
    const router = require('fs').readFileSync(require.resolve('../engine/adapter/llmRouter'), 'utf8');
    assert(/if \(meta\) \{ meta\.model = currentModel;/.test(router) && /if \(meta\) \{ meta\.model = geminiModelName;/.test(router));
  });

  const failed = results.filter(r => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})();
