/**
 * server/engine/tracing/replayEngine.js
 * 
 * MCQ PIPELINE REPLAY ENGINE WITH DRIFT ANALYSIS
 * Re-executes pipeline stages from saved trace JSON and pinpoints variation / LLM drift.
 */

'use strict';

const PipelineTracer = require('./pipelineTracer');
const { generateMCQPipeline } = require('../mcqEngine');

function computeStringSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  const setA = new Set(String(str1).toLowerCase().split(/\s+/).filter(Boolean));
  const setB = new Set(String(str2).toLowerCase().split(/\s+/).filter(Boolean));
  if (setA.size === 0 && setB.size === 0) return 1.0;
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

async function replayPipeline(requestIdOrTrace) {
  let trace = typeof requestIdOrTrace === 'object' ? requestIdOrTrace : PipelineTracer.loadTrace(requestIdOrTrace);

  if (!trace) {
    throw new Error(`Trace not found for requestId: ${requestIdOrTrace}`);
  }

  // Extract raw inputs from Stage 1 or top-level trace
  const stage1 = trace.stages?.['stage_1_ingestion_cleaning'] || trace.stages?.['stage_1_ingestion_&_cleaning'] || {};
  const rawInputText = stage1.inputs?.rawContent ||
                       trace.finalQuiz?.questions?.[0]?.sourceEvidence?.text ||
                       "";

  const requestedCount = trace.stages?.stage_3_quiz_planner?.inputs?.requestedCount ||
                         trace.finalQuiz?.totalQuestions || 5;

  const difficulty = trace.stages?.stage_3_quiz_planner?.inputs?.difficultyProfile ||
                     trace.finalQuiz?.difficulty || "Balanced";

  // Re-run pipeline deterministically
  const replayRes = await generateMCQPipeline({
    content: rawInputText,
    difficulty,
    requestedCount,
    requestId: `replay_${trace.requestId}_${Date.now()}`
  });

  // Perform Drift Analysis between original trace and replay output
  const originalQuestions = trace.finalQuiz?.questions || [];
  const replayedQuestions = replayRes.questions || [];

  const questionDrift = [];
  let totalSimSum = 0;

  const maxLen = Math.max(originalQuestions.length, replayedQuestions.length);
  for (let i = 0; i < maxLen; i++) {
    const origQ = originalQuestions[i];
    const replQ = replayedQuestions[i];

    if (origQ && replQ) {
      const origStem = origQ.stem || origQ.questionText || origQ.question;
      const replStem = replQ.stem || replQ.questionText || replQ.question;
      const sim = computeStringSimilarity(origStem, replStem);
      totalSimSum += sim;

      questionDrift.push({
        slotIndex: i + 1,
        originalConcept: origQ.targetConcept || origQ.concept,
        replayedConcept: replQ.targetConcept || replQ.concept,
        originalStem: origStem,
        replayedStem: replStem,
        stemSimilarity: Number(sim.toFixed(2)),
        isIdentical: sim >= 0.95
      });
    } else {
      questionDrift.push({
        slotIndex: i + 1,
        missingIn: origQ ? 'REPLAY' : 'ORIGINAL'
      });
    }
  }

  const avgStemSimilarity = maxLen > 0 ? Number((totalSimSum / Math.max(1, originalQuestions.length)).toFixed(2)) : 1.0;

  return {
    replayStatus: 'SUCCESS',
    originalRequestId: trace.requestId,
    replayRequestId: replayRes.requestId,
    timestamp: new Date().toISOString(),
    driftAnalysis: {
      averageStemSimilarity: avgStemSimilarity,
      hasDrift: avgStemSimilarity < 0.90,
      originalQuestionCount: originalQuestions.length,
      replayedQuestionCount: replayedQuestions.length,
      questionDrift
    },
    replayedQuiz: replayRes.finalQuiz || { questions: replayedQuestions }
  };
}

module.exports = {
  replayPipeline
};
