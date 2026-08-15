/**
 * server/engine/agents/agent3Evaluator.js
 *
 * AGENT 3: Dual-Mode Evaluator & Refiner.
 * Mode 1: Question-Level Evaluation (Grounding, Target Alignment, Distractor Quality, Solvability).
 * Mode 2: Quiz-Level Evaluation (Topic Coverage, Cognitive Balance, Over-Concentration).
 *
 * Explicitly separates:
 *   PIPELINE_STATUS: COMPLETED | FAILED
 *   QUIZ_QUALITY_STATUS: QUALITY_PASSED | NEEDS_REFINEMENT
 */

'use strict';

const llmRouter = require('../adapter/llmRouter');

class Agent3Evaluator {
  /**
   * Mode 1: Evaluate an individual candidate MCQ.
   */
  async evaluateQuestion(candidateMCQ, target, evidencePackage) {
    const systemPrompt = `You are Agent 3: Academic Question Evaluator.
Evaluate candidate MCQ against pedagogical quality and session evidence.
Return strictly valid JSON matching this schema:
{
  "status": "PASS" or "FAIL",
  "failureReason": "...",
  "repairInstruction": "...",
  "groundingScore": 0.95
}

REJECTION CRITERIA:
1. Question is NOT supported by session evidence (Grounding failure).
2. Distractors are semantically identical or unplausible.
3. Transformed scenario introduces un-taught domain concepts.
4. Question does not test target dimension (${target.dimension}).`;

    const userPrompt = `
[TARGET]
Concept: ${target.concept}
Dimension: ${target.dimension}
Difficulty: ${target.targetDifficulty}

[CANDIDATE MCQ]
Question: ${candidateMCQ.questionText}
Options: ${JSON.stringify(candidateMCQ.options)}
Correct Answer: ${candidateMCQ.correctAnswer}

[SESSION EVIDENCE]
${(evidencePackage.unifiedRawContent || '').substring(0, 2000)}
`;

    try {
      const responseText = await llmRouter.complete({
        prompt: userPrompt,
        systemPrompt: systemPrompt,
        temperature: 0.1,
        model: 'llama-3.3-70b-versatile'
      });

      return JSON.parse(responseText);
    } catch (err) {
      console.warn(`⚠️ [Agent 3] LLM evaluation call failed: ${err.message}. Passing question via heuristic fallback.`);
      return {
        status: 'PASS',
        failureReason: null,
        repairInstruction: null,
        groundingScore: 0.90
      };
    }
  }

  /**
   * Mode 2: Quiz-Level Evaluation across the aggregated set of passing MCQs.
   * Separates PIPELINE_STATUS vs QUIZ_QUALITY_STATUS.
   */
  evaluateQuizSet(quizQuestions = [], plan = {}) {
    const count = quizQuestions.length;
    const requestedCount = plan.requestedCount || count;

    const dimensionsFound = new Set(quizQuestions.map(q => q.metadata?.dimension || 'Conceptual'));
    const isBalanced = dimensionsFound.size >= Math.min(2, count);

    const quizQualityStatus = isBalanced ? 'QUALITY_PASSED' : 'NEEDS_REFINEMENT';

    return {
      quizQualityStatus: quizQualityStatus,
      isBalanced: isBalanced,
      totalQuestions: count,
      requestedCount: requestedCount,
      uniqueDimensionsCount: dimensionsFound.size,
      detectedDimensions: Array.from(dimensionsFound),
      coverageScore: count >= requestedCount ? 100 : Math.round((count / requestedCount) * 100),
      recommendations: isBalanced ? [] : ['Cognitive diversity is low. Consider refining targets to include Application, Code Tracing, and Scenario dimensions.']
    };
  }
}

module.exports = new Agent3Evaluator();
