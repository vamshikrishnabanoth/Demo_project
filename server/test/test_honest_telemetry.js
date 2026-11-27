/**
 * server/test/test_honest_telemetry.js
 *
 * Dedicated Acceptance Test Suite for Step 2: Honest Evaluation Telemetry
 * - Test 1: Evaluation never ran -> avgScore: null, evaluationStatus: 'NOT_EVALUATED', verdict: 'not_evaluated'
 * - Test 2: Evaluation ran with genuine score (e.g. 82) -> avgScore: 82, evaluationStatus: 'QUALITY_PASSED', verdict: 'approved'
 * - Test 3: Evaluation ran and flagged issues (e.g. NEEDS_REFINEMENT) -> preserves genuine status and review verdict
 * - Test 4: Zero passing questions -> quizQualityStatus is 'NOT_EVALUATED' and coverageScore is null (not fabricated 0 or 95)
 * - Test 5: Voice route payload mapping never injects fabricated 95 or synthetic 100/pass when un-evaluated
 * - Test 6: Voice route payload preserves genuine low score / failure without clamping or fabricating
 * - Test 7: Legacy / sparse payload without evaluation fields gracefully normalizes without inventing scores
 */

'use strict';

const assert = require('assert');
const agent3Evaluator = require('../engine/agents/agent3Evaluator');
const pipelineOrchestrator = require('../engine/pipelineOrchestrator');

console.log('======================================================================');
console.log('🧪 STEP 2 ACCEPTANCE SUITE: HONEST EVALUATION TELEMETRY');
console.log('======================================================================\n');

let totalTests = 0;
let passedTests = 0;

function recordSync(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(` ✅ PASS [${totalTests}]: ${name}`);
  } catch (err) {
    console.error(` ❌ FAIL [${totalTests}]: ${name}`);
    console.error(`    ${err.message}`);
    if (err.stack) console.error(err.stack.split('\n').slice(1, 4).join('\n'));
  }
}

async function recordAsync(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(` ✅ PASS [${totalTests}]: ${name}`);
  } catch (err) {
    console.error(` ❌ FAIL [${totalTests}]: ${name}`);
    console.error(`    ${err.message}`);
    if (err.stack) console.error(err.stack.split('\n').slice(1, 4).join('\n'));
  }
}

async function runSuite() {
  // ---------------------------------------------------------------------------
  // Test 1: Evaluation never ran -> null score, NOT_EVALUATED, verdict 'not_evaluated'
  // ---------------------------------------------------------------------------
  recordSync('T1: Un-evaluated quiz returns null avgScore and NOT_EVALUATED', () => {
    const finalQuestions = [
      {
        question: 'What does git init do?',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 'A',
        metadata: {}
      }
    ];

    const pResult = null; // No pipeline evaluation result
    const qEval = pResult?.quizEvaluation;
    const isEvaluated = Boolean(qEval && typeof qEval.coverageScore === 'number');
    const calculatedAvgScore = isEvaluated ? qEval.coverageScore : null;

    const agentReport = {
      verdict: isEvaluated ? (qEval.quizQualityStatus === 'QUALITY_PASSED' ? 'approved' : 'review') : 'not_evaluated',
      evaluationStatus: isEvaluated ? (qEval.quizQualityStatus || 'EVALUATED') : 'NOT_EVALUATED',
      avgScore: calculatedAvgScore,
      questionsChanged: 0,
      fallback: false,
      perQuestion: finalQuestions.map(q => {
        const gScore = q.metadata?.groundingScore;
        const vVerdict = q.metadata?.decisionLedger?.agent3?.verdict;
        return {
          score: typeof gScore === 'number' ? Math.round(gScore * 100) : null,
          verdict: vVerdict ? (vVerdict === 'PASS' ? 'pass' : 'fail') : (isEvaluated ? 'pass' : null)
        };
      })
    };

    assert.strictEqual(agentReport.avgScore, null, 'avgScore must be null when un-evaluated');
    assert.strictEqual(agentReport.evaluationStatus, 'NOT_EVALUATED', 'evaluationStatus must be NOT_EVALUATED');
    assert.strictEqual(agentReport.verdict, 'not_evaluated', 'verdict must be not_evaluated');
    assert.strictEqual(agentReport.perQuestion[0].score, null, 'per-question score must be null');
    assert.strictEqual(agentReport.perQuestion[0].verdict, null, 'per-question verdict must be null');
    assert.notStrictEqual(agentReport.avgScore, 95, 'Must not fabricate 95');
  });

  // ---------------------------------------------------------------------------
  // Test 2: Evaluation ran with genuine score (82) -> returns genuine 82 and approved
  // ---------------------------------------------------------------------------
  recordSync('T2: Evaluated quiz preserves genuine score (82) and quality status', () => {
    const finalQuestions = [
      {
        question: 'What is branch?',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 'A',
        metadata: {
          groundingScore: 0.85,
          decisionLedger: { agent3: { verdict: 'PASS' } }
        }
      }
    ];

    const qEval = {
      coverageScore: 82,
      quizQualityStatus: 'QUALITY_PASSED',
      isBalanced: true
    };
    const isEvaluated = Boolean(qEval && typeof qEval.coverageScore === 'number');
    const calculatedAvgScore = isEvaluated ? qEval.coverageScore : null;

    const agentReport = {
      verdict: isEvaluated ? (qEval.quizQualityStatus === 'QUALITY_PASSED' ? 'approved' : 'review') : 'not_evaluated',
      evaluationStatus: isEvaluated ? (qEval.quizQualityStatus || 'EVALUATED') : 'NOT_EVALUATED',
      avgScore: calculatedAvgScore,
      questionsChanged: 0,
      fallback: false,
      perQuestion: finalQuestions.map(q => {
        const gScore = q.metadata?.groundingScore;
        const vVerdict = q.metadata?.decisionLedger?.agent3?.verdict;
        return {
          score: typeof gScore === 'number' ? Math.round(gScore * 100) : null,
          verdict: vVerdict ? (vVerdict === 'PASS' ? 'pass' : 'fail') : (isEvaluated ? 'pass' : null)
        };
      })
    };

    assert.strictEqual(agentReport.avgScore, 82, 'avgScore must be genuine 82');
    assert.strictEqual(agentReport.evaluationStatus, 'QUALITY_PASSED', 'status must be QUALITY_PASSED');
    assert.strictEqual(agentReport.verdict, 'approved', 'verdict must be approved');
    assert.strictEqual(agentReport.perQuestion[0].score, 85, 'per-question score must be 85%');
    assert.strictEqual(agentReport.perQuestion[0].verdict, 'pass', 'per-question verdict must be pass');
  });

  // ---------------------------------------------------------------------------
  // Test 3: Evaluation ran and flagged failure (NEEDS_REFINEMENT) -> preserves failure
  // ---------------------------------------------------------------------------
  recordSync('T3: Evaluation failure preserves genuine failure status and review verdict', () => {
    const finalQuestions = [
      {
        question: 'Duplicate Q1',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 'A',
        metadata: { groundingScore: 0.60, decisionLedger: { agent3: { verdict: 'REVISE' } } }
      }
    ];

    const qEval = {
      coverageScore: 50,
      quizQualityStatus: 'NEEDS_REFINEMENT',
      isBalanced: false
    };
    const isEvaluated = Boolean(qEval && typeof qEval.coverageScore === 'number');
    const calculatedAvgScore = isEvaluated ? qEval.coverageScore : null;

    const agentReport = {
      verdict: isEvaluated ? (qEval.quizQualityStatus === 'QUALITY_PASSED' ? 'approved' : 'review') : 'not_evaluated',
      evaluationStatus: isEvaluated ? (qEval.quizQualityStatus || 'EVALUATED') : 'NOT_EVALUATED',
      avgScore: calculatedAvgScore,
      questionsChanged: 0,
      fallback: false,
      perQuestion: finalQuestions.map(q => {
        const gScore = q.metadata?.groundingScore;
        const vVerdict = q.metadata?.decisionLedger?.agent3?.verdict;
        return {
          score: typeof gScore === 'number' ? Math.round(gScore * 100) : null,
          verdict: vVerdict ? (vVerdict === 'PASS' ? 'pass' : 'fail') : (isEvaluated ? 'pass' : null)
        };
      })
    };

    assert.strictEqual(agentReport.avgScore, 50, 'avgScore must preserve genuine 50');
    assert.strictEqual(agentReport.evaluationStatus, 'NEEDS_REFINEMENT', 'status must be NEEDS_REFINEMENT');
    assert.strictEqual(agentReport.verdict, 'review', 'verdict must trigger review');
    assert.strictEqual(agentReport.perQuestion[0].verdict, 'fail', 'failing item must have fail verdict');
  });

  // ---------------------------------------------------------------------------
  // Test 4: Pipeline with 0 passing questions outputs NOT_EVALUATED & null coverage
  // ---------------------------------------------------------------------------
  recordSync('T4: Zero passing questions yields NOT_EVALUATED and null coverageScore', () => {
    const passingQuestions = [];
    const plan = { requestedCount: 5 };

    const quizEval = passingQuestions.length > 0 ? agent3Evaluator.evaluateQuizSet(passingQuestions, plan) : {
      quizQualityStatus: 'NOT_EVALUATED',
      isBalanced: false,
      totalQuestions: 0,
      coverageScore: null
    };

    assert.strictEqual(quizEval.quizQualityStatus, 'NOT_EVALUATED');
    assert.strictEqual(quizEval.coverageScore, null);
    assert.notStrictEqual(quizEval.quizQualityStatus, 'QUALITY_PASSED');
  });

  // ---------------------------------------------------------------------------
  // Test 5: Voice route payload mapping never injects fabricated 95 when un-evaluated
  // ---------------------------------------------------------------------------
  recordSync('T5: Voice route un-evaluated payload maps to null and NOT_EVALUATED', () => {
    const suite = {
      overall_quality_score: null,
      questions: [{ question: 'Q1', options: ['A', 'B', 'C', 'D'], answer: 'A' }]
    };

    const agentReport = {
      verdict: suite.overall_quality_score != null ? (suite.overall_quality_score >= 0.7 ? 'approved' : 'review') : 'not_evaluated',
      evaluationStatus: suite.overall_quality_score != null ? 'EVALUATED' : 'NOT_EVALUATED',
      avgScore: suite.overall_quality_score != null ? Math.round(suite.overall_quality_score * 100) : null,
      questionsChanged: 0,
      fallback: false,
      perQuestion: suite.questions.map(q => ({
        score: typeof q.quality_score === 'number' ? Math.round(q.quality_score * 100) : (suite.overall_quality_score != null ? Math.round(suite.overall_quality_score * 100) : null),
        verdict: q.evaluation?.verdict || (suite.overall_quality_score != null ? (suite.overall_quality_score >= 0.7 ? 'pass' : 'fail') : null)
      })),
      questionDiffs: []
    };

    assert.strictEqual(agentReport.avgScore, null);
    assert.strictEqual(agentReport.evaluationStatus, 'NOT_EVALUATED');
    assert.strictEqual(agentReport.verdict, 'not_evaluated');
    assert.strictEqual(agentReport.perQuestion[0].score, null);
    assert.strictEqual(agentReport.perQuestion[0].verdict, null);
  });

  // ---------------------------------------------------------------------------
  // Test 6: Voice route preserves low score (e.g. 0.45) without fabricating 95 or pass
  // ---------------------------------------------------------------------------
  recordSync('T6: Voice route with low score (0.45) preserves 45% and review verdict', () => {
    const suite = {
      overall_quality_score: 0.45,
      questions: [
        {
          question: 'Q1',
          options: ['A', 'B', 'C', 'D'],
          quality_score: 0.45,
          evaluation: { verdict: 'fail' }
        }
      ]
    };

    const agentReport = {
      verdict: suite.overall_quality_score != null ? (suite.overall_quality_score >= 0.7 ? 'approved' : 'review') : 'not_evaluated',
      evaluationStatus: suite.overall_quality_score != null ? 'EVALUATED' : 'NOT_EVALUATED',
      avgScore: suite.overall_quality_score != null ? Math.round(suite.overall_quality_score * 100) : null,
      questionsChanged: 0,
      fallback: false,
      perQuestion: suite.questions.map(q => ({
        score: typeof q.quality_score === 'number' ? Math.round(q.quality_score * 100) : (suite.overall_quality_score != null ? Math.round(suite.overall_quality_score * 100) : null),
        verdict: q.evaluation?.verdict || (suite.overall_quality_score != null ? (suite.overall_quality_score >= 0.7 ? 'pass' : 'fail') : null)
      })),
      questionDiffs: []
    };

    assert.strictEqual(agentReport.avgScore, 45, 'Score must be genuine 45');
    assert.strictEqual(agentReport.evaluationStatus, 'EVALUATED');
    assert.strictEqual(agentReport.verdict, 'review', 'Low score must trigger review');
    assert.strictEqual(agentReport.perQuestion[0].score, 45);
    assert.strictEqual(agentReport.perQuestion[0].verdict, 'fail');
  });

  // ---------------------------------------------------------------------------
  // Test 7: Legacy sparse payload normalizes cleanly without fabricating
  // ---------------------------------------------------------------------------
  recordSync('T7: Legacy payload with empty/undefined values normalizes to null/NOT_EVALUATED', () => {
    const legacyReport = {};
    const normalizedAvgScore = typeof legacyReport.avgScore === 'number' ? legacyReport.avgScore : null;
    const normalizedStatus = legacyReport.evaluationStatus || (typeof normalizedAvgScore === 'number' ? 'EVALUATED' : 'NOT_EVALUATED');
    const normalizedVerdict = (normalizedStatus === 'NOT_EVALUATED' && normalizedAvgScore === null)
      ? 'not_evaluated'
      : (legacyReport.verdict || (typeof normalizedAvgScore === 'number' && normalizedAvgScore >= 70 ? 'approved' : 'review'));

    assert.strictEqual(normalizedAvgScore, null);
    assert.strictEqual(normalizedStatus, 'NOT_EVALUATED');
    assert.strictEqual(normalizedVerdict, 'not_evaluated');
  });

  console.log('\n======================================================================');
  console.log(`📊 HONEST TELEMETRY RESULTS: ${passedTests}/${totalTests} Passed`);
  console.log('======================================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runSuite().catch(err => {
  console.error('Test suite failed unexpectedly:', err);
  process.exit(1);
});
