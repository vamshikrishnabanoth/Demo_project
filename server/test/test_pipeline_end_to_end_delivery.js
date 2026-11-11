/**
 * server/test/test_pipeline_end_to_end_delivery.js
 *
 * End-to-end regression test for pipelineOrchestrator.runPipeline.
 * Runs the REAL orchestrator; only the LLM-backed functions are replaced with deterministic stubs.
 *
 * Guards against:
 *  - successful runs crashing at the final stage (const reassignment regression)
 *  - a fixed attempt ceiling that makes requests above ~12-15 questions impossible
 *  - shortfalls being blamed on the material when the system itself stopped
 *  - one malformed question failing the whole quiz
 */

'use strict';

const assert = require('assert');
const orchestrator = require('../engine/pipelineOrchestrator');
const agent1Planner = require('../engine/agents/agent1Planner');
const agent2Generator = require('../engine/agents/agent2Generator');
const agent3Evaluator = require('../engine/agents/agent3Evaluator');
const lectureIntelligence = require('../engine/intelligence/lectureIntelligence');
const groundingGate = require('../engine/validators/groundingGate');
const deterministicValidator = require('../engine/validators/deterministicValidator');

const original = {
  extractTeachingUnits: lectureIntelligence.extractTeachingUnits,
  planAssessment: agent1Planner.planAssessment,
  generateQuestionBatch: agent2Generator.generateQuestionBatch,
  generateQuestion: agent2Generator.generateQuestion,
  evaluateAndRepairQuestion: agent3Evaluator.evaluateAndRepairQuestion,
  evaluateQuizSet: agent3Evaluator.evaluateQuizSet,
  verifyQuizGrounding: groundingGate.verifyQuizGrounding,
  checkJustification: groundingGate._checkJustification,
  checkDuplicateQuestion: deterministicValidator.checkDuplicateQuestion,
  checkDistractorCollision: deterministicValidator.checkDistractorCollision
};

const TRANSCRIPT = 'Paging divides physical memory into fixed size frames and logical memory into pages. '.repeat(60);

function makeTarget(prefix, i) {
  const concept = `${prefix === 'R' ? 'Reserve' : 'Primary'} concept ${i + 1}`;
  return {
    targetId: `${prefix}${String(i + 1).padStart(2, '0')}`,
    concept,
    subtopic: concept,
    targetDifficulty: 'Medium',
    dimension: 'Conceptual',
    supportingEvidence: `Evidence sentence describing ${concept} in enough detail.`
  };
}

let generated = 0;
function makeMCQ(target) {
  generated++;
  const key = `Correct statement about ${target.concept} (${generated})`;
  return {
    question: `Which statement about ${target.concept} is correct in case ${generated}?`,
    options: [key, `Wrong option A ${generated}`, `Wrong option B ${generated}`, `Wrong option C ${generated}`],
    correctAnswer: key,
    correctAnswerKey: 'A',
    metadata: {}
  };
}

/**
 * Install stubs.
 * @param {Object} cfg
 *   primary: number of primary targets the planner returns
 *   reserves: number of reserve targets
 *   evaluate: (mcq, target) => 'PASS' | 'FAIL' | 'PROVIDER' | 'BROKEN_KEY'
 */
function installStubs({ primary, reserves, evaluate }) {
  generated = 0;
  lectureIntelligence.extractTeachingUnits = async () => ({
    teachingUnits: [{ concept: 'Primary concept 1', statement: 'already planned, so no spare unit is available' }],
    extractionAudit: { quarantinedCount: 0 }
  });
  agent1Planner.planAssessment = async () => ({
    subject: 'Operating Systems',
    mainTopic: 'Memory Management',
    assessmentTargets: Array.from({ length: primary }, (_, i) => makeTarget('T', i)),
    reserveTargets: Array.from({ length: reserves }, (_, i) => makeTarget('R', i))
  });
  const gen = (t) => {
    const verdict = evaluate(null, t);
    if (verdict === 'PROVIDER') {
      return {
        targetId: t.targetId,
        fulfillmentStatus: 'UNFULFILLED_PROVIDER_FAILURE',
        isUnfulfilled: true,
        unfulfilledReason: 'PROVIDER_ERROR',
        message: 'simulated provider failure'
      };
    }
    return makeMCQ(t);
  };
  agent2Generator.generateQuestionBatch = async (targets) => targets.map(gen);
  agent2Generator.generateQuestion = async (t) => gen(t);
  agent3Evaluator.evaluateAndRepairQuestion = async (mcq, target) => {
    const verdict = evaluate(mcq, target);
    if (verdict === 'FAIL') {
      return { status: 'FAIL', mcq, failureReasons: ['SIMULATED_QUALITY_FAILURE'], failureReason: 'simulated quality failure' };
    }
    if (verdict === 'BROKEN_KEY') {
      mcq.correctAnswer = 'An answer that is not among the options';
    }
    return { status: 'PASS', mcq };
  };
  agent3Evaluator.evaluateQuizSet = () => ({ quizQualityStatus: 'QUALITY_PASSED', coverageScore: 90 });
  groundingGate.verifyQuizGrounding = (qs) => ({ status: 'PASSED', validatedQuestions: qs, totalVerified: qs.length, rejectedCount: 0 });
  groundingGate._checkJustification = () => ({ isJustified: true, reason: 'stub' });
  deterministicValidator.checkDuplicateQuestion = () => ({ isDuplicate: false });
  deterministicValidator.checkDistractorCollision = () => ({ hasCollision: false });
}

function restoreStubs() {
  lectureIntelligence.extractTeachingUnits = original.extractTeachingUnits;
  agent1Planner.planAssessment = original.planAssessment;
  agent2Generator.generateQuestionBatch = original.generateQuestionBatch;
  agent2Generator.generateQuestion = original.generateQuestion;
  agent3Evaluator.evaluateAndRepairQuestion = original.evaluateAndRepairQuestion;
  agent3Evaluator.evaluateQuizSet = original.evaluateQuizSet;
  groundingGate.verifyQuizGrounding = original.verifyQuizGrounding;
  groundingGate._checkJustification = original.checkJustification;
  deterministicValidator.checkDuplicateQuestion = original.checkDuplicateQuestion;
  deterministicValidator.checkDistractorCollision = original.checkDistractorCollision;
}

async function run(count, cfg) {
  installStubs(cfg);
  try {
    return await orchestrator.runPipeline({
      sessionId: `e2e_${count}_${Date.now()}`,
      voiceTranscript: TRANSCRIPT,
      documentTexts: [],
      count,
      difficulty: 'Medium'
    });
  } finally {
    restoreStubs();
  }
}

const results = [];
async function test(name, fn) {
  // Silence the orchestrator's verbose logging while each case runs
  const { log, warn, error } = console;
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
  try {
    await fn();
    console.log = log; console.warn = warn; console.error = error;
    results.push(true);
    console.log(`  ✅ PASS: ${name}`);
  } catch (err) {
    console.log = log; console.warn = warn; console.error = error;
    results.push(false);
    console.log(`  ❌ FAIL: ${name}\n     ${err.message}`);
  }
}

(async () => {
  console.log('\n🧪 END-TO-END PIPELINE DELIVERY TEST (real orchestrator, stubbed LLM calls)\n');

  for (const n of [1, 5, 10, 15, 20, 30]) {
    await test(`Delivers all ${n} requested questions when generation succeeds`, async () => {
      const r = await run(n, { primary: n, reserves: Math.ceil(n / 2), evaluate: () => 'PASS' });
      assert.strictEqual(r.error ?? null, null, `unexpected error: ${r.error}`);
      assert.strictEqual(r.pipelineStatus, 'COMPLETED');
      assert.strictEqual(r.questions.length, n);
      assert.strictEqual(r.deliveredCount, n);
      assert.strictEqual(r.shortfallCategory, null);
      r.questions.forEach(q => {
        assert.ok(q.question && q.question.length >= 10, 'question stem present');
        assert.strictEqual(q.options.length, 4);
        assert.ok(q.options.includes(q.correctAnswer), 'key is one of the options');
      });
    });
  }

  await test('Rejected questions are replaced from reserves until the request is met', async () => {
    const r = await run(10, {
      primary: 10,
      reserves: 6,
      evaluate: (mcq, t) => (['T02', 'T05', 'T08'].includes(t.targetId) ? 'FAIL' : 'PASS')
    });
    assert.strictEqual(r.deliveredCount, 10);
    assert.strictEqual(r.pipelineStatus, 'COMPLETED');
  });

  await test('A question with a broken answer key is removed, not the whole quiz', async () => {
    const r = await run(5, {
      primary: 5,
      reserves: 3,
      evaluate: (mcq, t) => (t.targetId === 'T03' ? 'BROKEN_KEY' : 'PASS')
    });
    assert.notStrictEqual(r.pipelineStatus, 'FAILED', `quiz failed: ${r.error}`);
    assert.strictEqual(r.deliveredCount, 5, 'broken item replaced from reserves');
    r.questions.forEach(q => assert.ok(q.options.includes(q.correctAnswer)));
  });

  await test('Quality rejections are reported as VALIDATION_REJECTION, not as exhausted material', async () => {
    const r = await run(5, { primary: 5, reserves: 0, evaluate: (mcq, t) => (t.targetId === 'T01' ? 'FAIL' : 'PASS') });
    assert.strictEqual(r.deliveredCount, 4);
    assert.strictEqual(r.shortfallCategory, 'VALIDATION_REJECTION');
    assert.ok(/failed quality checks/i.test(r.notice), `notice: ${r.notice}`);
    assert.ok(!/strict factual grounding/i.test(r.notice), 'no generic grounding excuse');
  });

  await test('Provider failures are reported as PROVIDER_ERROR', async () => {
    const r = await run(5, { primary: 5, reserves: 0, evaluate: (mcq, t) => (t.targetId === 'T02' ? 'PROVIDER' : 'PASS') });
    assert.strictEqual(r.deliveredCount, 4);
    assert.strictEqual(r.shortfallCategory, 'PROVIDER_ERROR');
    assert.ok(/AI provider/i.test(r.notice), `notice: ${r.notice}`);
  });

  await test('Genuinely limited material is reported as MATERIAL_EXHAUSTED with the supported count', async () => {
    const r = await run(10, { primary: 4, reserves: 0, evaluate: () => 'PASS' });
    assert.strictEqual(r.deliveredCount, 4);
    assert.strictEqual(r.shortfallCategory, 'MATERIAL_EXHAUSTED');
    assert.ok(/supported 4 distinct question opportunities/i.test(r.notice), `notice: ${r.notice}`);
  });

  await test('Attempt ceiling scales with the request (no fixed cap of 12)', async () => {
    assert.ok(orchestrator.calculateAttemptCeiling(30, 30, 15) >= 45);
    assert.ok(orchestrator.calculateAttemptCeiling(20, 20, 10) >= 30);
    assert.ok(orchestrator.calculateAttemptCeiling(100, 100, 50) <= 60);
  });

  const passed = results.filter(Boolean).length;
  console.log(`\n🏁 ${passed} / ${results.length} tests passed\n`);
  process.exit(passed === results.length ? 0 : 1);
})();
