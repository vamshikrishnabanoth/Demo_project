'use strict';

/**
 * server/test/run_e2e_single.js
 *
 * Runs the upgraded pipeline on KMIT Deepa Madam Lecture (ARCH_05)
 * for a specific count and difficulty, logging complete end-to-end telemetry.
 *
 * Usage:
 *   node test/run_e2e_single.js --count=5 --difficulty=Balanced --out=e2e_n5_balanced.json
 */

const fs = require('fs');
const path = require('path');
const pipelineOrchestrator = require('../engine/pipelineOrchestrator');

// Parse CLI args
const args = process.argv.slice(2);
let count = 5;
let difficulty = 'Balanced';
let testId = 'ARCH_05';
let outFileName = `e2e_result_${Date.now()}.json`;

for (const arg of args) {
  if (arg.startsWith('--count=')) {
    count = parseInt(arg.split('=')[1], 10);
  } else if (arg.startsWith('--difficulty=')) {
    difficulty = arg.split('=')[1];
  } else if (arg.startsWith('--testId=')) {
    testId = arg.split('=')[1];
  } else if (arg.startsWith('--out=')) {
    outFileName = arg.split('=')[1];
  }
}

const GOLDEN_BENCHMARKS_PATH = path.resolve(__dirname, '../../evaluation_dataset/golden_benchmarks/step7_real_lecture_benchmark.json');

async function run() {
  console.log('======================================================================');
  console.log(`🚀 RUNNING E2E PIPELINE ON BENCHMARK ${testId}`);
  console.log(`   Requested Count: ${count} | Requested Difficulty: ${difficulty}`);
  console.log('======================================================================\n');

  const goldenCases = JSON.parse(fs.readFileSync(GOLDEN_BENCHMARKS_PATH, 'utf8'));
  const selectedCase = goldenCases.find(c => c.testId === testId);
  if (!selectedCase) {
    throw new Error(`${testId} benchmark case not found in golden benchmarks!`);
  }

  const t0 = Date.now();
  const sessionId = `e2e_test_${count}_${difficulty}_${Date.now()}`;

  const result = await pipelineOrchestrator.runPipeline({
    sessionId,
    voiceTranscript: selectedCase.voiceText,
    documentTexts: selectedCase.docText ? [selectedCase.docText] : [],
    documentNames: selectedCase.docText ? [testId + '_Syllabus.txt'] : [],
    count,
    difficulty
  });

  const durationMs = Date.now() - t0;
  console.log(`\n⏱️ Pipeline completed in ${(durationMs / 1000).toFixed(2)}s`);

  // Extract detailed telemetry
  const plan = result.plan || {};
  const assessmentTargets = Array.isArray(plan.assessmentTargets) ? plan.assessmentTargets : [];
  const reserveTargets = Array.isArray(plan.reserveTargets) ? plan.reserveTargets : [];
  const questions = Array.isArray(result.questions) ? result.questions : [];

  // Categorize questions by format
  const formatCounts = {
    'Conceptual/prose': 0,
    'Numerical/calculation': 0,
    'Reasoning/contrast': 0,
    'Scenario/application': 0,
    'Code analysis': 0
  };

  const difficultyCounts = {
    'Easy': 0,
    'Medium': 0,
    'Hard': 0
  };

  const categorizedQuestions = questions.map((q, idx) => {
    const stem = q.questionText || q.stem || q.question || '';
    const hasCode = stem.includes('```') || (Array.isArray(q.options) && q.options.some(o => typeof o === 'string' && o.includes('```')));
    const hasMathCalc = /\b(?:calculate|modulo|remainder|gcd\(|lcm\(|\d+\s*mod\s*\d+|\d+\s*%\s*\d+|step\s*\d+)\b/i.test(stem);
    const hasReasoning = /\b(?:invariant|preserve|why|tradeoff|because|contrast|differ|guarantee)\b/i.test(stem);
    const hasScenario = /\b(?:scenario|given|suppose|application|system|pipeline|real-world)\b/i.test(stem);

    let detectedFormat = 'Conceptual/prose';
    if (hasCode || q.metadata?.formatRecommendation === 'CODE_ANALYSIS' || q.metadata?.assessmentAngle === 'CODE_TRACE') {
      detectedFormat = 'Code analysis';
    } else if (q.metadata?.formatRecommendation === 'NUMERICAL_TRACE' || q.metadata?.assessmentAngle === 'CALCULATION' || hasMathCalc) {
      detectedFormat = 'Numerical/calculation';
    } else if (q.metadata?.formatRecommendation === 'REASONING_CONTRAST' || q.metadata?.assessmentAngle === 'REASONING' || hasReasoning) {
      detectedFormat = 'Reasoning/contrast';
    } else if (q.metadata?.formatRecommendation === 'SCENARIO_APPLICATION' || q.metadata?.assessmentAngle === 'APPLICATION' || hasScenario) {
      detectedFormat = 'Scenario/application';
    }

    formatCounts[detectedFormat] = (formatCounts[detectedFormat] || 0) + 1;

    const diff = q.difficulty || q.metadata?.targetDifficulty || 'Medium';
    difficultyCounts[diff] = (difficultyCounts[diff] || 0) + 1;

    return {
      index: idx + 1,
      targetId: q.targetId || q.metadata?.targetId,
      concept: q.metadata?.concept || q.concept,
      macroTopic: q.metadata?.macroTopic,
      assessmentAngle: q.metadata?.assessmentAngle,
      formatRecommendation: q.metadata?.formatRecommendation,
      detectedFormat,
      difficulty: diff,
      bloomLevel: q.bloom_level || q.metadata?.cognitiveLevel,
      stem,
      options: q.options,
      correctAnswerIndex: q.correctAnswerIndex,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      groundingScore: q.metadata?.groundingScore,
      evidenceSnippet: q.evidenceSnippet || q.metadata?.supportingEvidence
    };
  });

  const summary = {
    runConfig: {
      requestedCount: count,
      requestedDifficulty: difficulty,
      sessionId,
      durationMs,
      durationSec: (durationMs / 1000).toFixed(2)
    },
    counts: {
      requested: count,
      delivered: questions.length,
      isFulfilled: questions.length === count,
      plannedPrimaryTargets: assessmentTargets.length,
      plannedReserveTargets: reserveTargets.length
    },
    formatBreakdown: formatCounts,
    difficultyBreakdown: difficultyCounts,
    questions: categorizedQuestions,
    telemetry: {
      pipelineStatus: result.pipelineStatus,
      quizQualityStatus: result.quizQualityStatus,
      totalGenerationAttempts: result.executionMetrics?.totalGenerationAttempts,
      repairMetrics: result.executionMetrics?.repairMetrics,
      rejectionReasonsCount: result.executionMetrics?.rejectionReasonsCount,
      targetResults: result.targetResults
    }
  };

  const outPath = path.resolve(__dirname, outFileName);
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2), 'utf8');

  console.log('\n======================================================================');
  console.log(`📊 EXECUTION SUMMARY (${count} Qs, ${difficulty})`);
  console.log('======================================================================');
  console.log(`Requested:            ${count}`);
  console.log(`Delivered:            ${questions.length}`);
  console.log(`Primary Planned:      ${assessmentTargets.length}`);
  console.log(`Reserve Planned:      ${reserveTargets.length}`);
  console.log(`Difficulty Breakdown: Easy=${difficultyCounts.Easy}, Medium=${difficultyCounts.Medium}, Hard=${difficultyCounts.Hard}`);
  console.log(`Format Breakdown:`);
  for (const [fmt, c] of Object.entries(formatCounts)) {
    console.log(`  - ${fmt}: ${c}`);
  }
  console.log(`Payload saved to:     ${outPath}\n`);

  questions.forEach((q, i) => {
    console.log(`[Q${i+1}] (${q.difficulty} | ${categorizedQuestions[i].detectedFormat})`);
    console.log(`   Stem: ${q.questionText || q.stem || q.question}`);
    console.log(`   Key:  ${q.correctAnswer}`);
    console.log(`   Options: ${JSON.stringify(q.options)}`);
    console.log('');
  });
}

run().catch(err => {
  console.error('❌ E2E Run failed:', err);
  process.exit(1);
});
