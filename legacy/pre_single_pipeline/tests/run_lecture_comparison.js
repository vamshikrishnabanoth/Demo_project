/**
 * server/test/run_lecture_comparison.js
 *
 * Runs the upgraded Multi-Agent Pipeline on KMIT 45-minute Deepa Madam Lecture (ARCH_05)
 * and compares it directly against the baseline golden benchmark.
 */

'use strict';

process.env.GENERATION_CONCURRENCY = '1';

const fs = require('fs');
const path = require('path');
const pipelineOrchestrator = require('../engine/pipelineOrchestrator');

const GOLDEN_BENCHMARKS_PATH = path.resolve(__dirname, '../../evaluation_dataset/golden_benchmarks/step7_real_lecture_benchmark.json');
const BASELINE_QUIZ_PATH = path.resolve(__dirname, '../../../pipeline/outputs/quiz_deepa madam.mp3_medium.json');

async function runComparison() {
  console.log('======================================================================');
  console.log('🎓 FULL LECTURE GENERATION COMPARISON: BASELINE vs UPGRADED PIPELINE');
  console.log('======================================================================\n');

  // 1. Load Lecture Evidence
  const goldenCases = JSON.parse(fs.readFileSync(GOLDEN_BENCHMARKS_PATH, 'utf8'));
  const case05 = goldenCases.find(c => c.testId === 'ARCH_05');
  if (!case05) {
    throw new Error('ARCH_05 benchmark case not found!');
  }

  // 2. Load Baseline Questions
  let baselineQuiz = null;
  if (fs.existsSync(BASELINE_QUIZ_PATH)) {
    baselineQuiz = JSON.parse(fs.readFileSync(BASELINE_QUIZ_PATH, 'utf8'));
  }

  console.log(`Lecture Topic:        ${case05.subject} - Recursion & Euclidean Algorithm`);
  console.log(`Voice Transcript Len: ${case05.voiceText.length} characters (~45 minutes of lecture)`);
  console.log(`Requested Questions:  5`);
  console.log(`Requested Difficulty: Medium\n`);

  console.log('⏳ Running Upgraded 3-Agent Pipeline (Planner -> Generator -> Evaluator)...');
  const t0 = Date.now();

  const newResult = await pipelineOrchestrator.runPipeline({
    sessionId: 'compare_deepa_madam_' + Date.now(),
    voiceTranscript: case05.voiceText,
    documentTexts: [case05.docText],
    documentNames: ['KMIT_Recursion_Syllabus.txt'],
    count: 5,
    difficulty: 'Medium'
  });

  const durationMs = Date.now() - t0;
  console.log(`✅ Generation completed in ${(durationMs / 1000).toFixed(1)}s\n`);

  const outputPayload = {
    metadata: {
      lecture: 'KMIT Deepa Madam Recursion (ARCH_05)',
      transcriptLength: case05.voiceText.length,
      durationMs,
      timestamp: new Date().toISOString()
    },
    baseline: baselineQuiz ? {
      totalQuestions: baselineQuiz.total_questions || baselineQuiz.questions?.length,
      difficulty: baselineQuiz.target_difficulty,
      questions: baselineQuiz.questions
    } : null,
    upgraded: {
      status: newResult.pipelineStatus,
      deliveredQuestions: newResult.questions.length,
      requestedQuestions: newResult.requestedCount,
      difficulty: newResult.difficulty,
      evidenceSafety: newResult.evidenceSafety,
      qualityStatus: newResult.quizQualityStatus,
      questions: newResult.questions.map((q, idx) => ({
        index: idx + 1,
        stem: q.questionText || q.stem || q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        difficulty: q.difficulty,
        bloomLevel: q.bloom_level || q.targetBloom,
        archetype: q.archetype || q.question_type,
        groundingScore: q.metadata?.groundingScore,
        tier: q.metadata?.tier,
        agent3Verdict: q.metadata?.decisionLedger?.agent3?.verdict
      }))
    }
  };

  const savePath = path.resolve(__dirname, 'lecture_comparison_result.json');
  fs.writeFileSync(savePath, JSON.stringify(outputPayload, null, 2));
  console.log(`💾 Saved full comparison payload to: ${savePath}\n`);

  console.log('======================================================================');
  console.log('📋 UPGRADED PIPELINE GENERATED QUESTIONS');
  console.log('======================================================================');
  outputPayload.upgraded.questions.forEach(q => {
    console.log(`\n[Question ${q.index}] (${q.difficulty} | Bloom: ${q.bloomLevel} | Archetype: ${q.archetype || 'Standard'})`);
    console.log(`Stem: "${q.stem}"`);
    console.log('Options:');
    (q.options || []).forEach((opt, oIdx) => {
      const letter = String.fromCharCode(65 + oIdx);
      const isCorrect = opt === q.correctAnswer ? ' ★ (CORRECT)' : '';
      console.log(`   ${letter}. ${opt}${isCorrect}`);
    });
    console.log(`Explanation: ${q.explanation}`);
    console.log(`Grounding Score: ${q.groundingScore ?? 'N/A'} | Tier: ${q.tier || 'N/A'}`);
  });

  return outputPayload;
}

runComparison().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
