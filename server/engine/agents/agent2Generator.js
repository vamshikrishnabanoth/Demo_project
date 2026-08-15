/**
 * server/engine/agents/agent2Generator.js
 *
 * AGENT 2: MCQ Question Generator.
 * Uses fine-tuned Meta Llama 3 8B + LoRA merged GGUF (via Ollama 'quiz-expert' / llmRouter).
 * Answers: "Given the assessment target and evidence, what question should be created?"
 * Applies Scenario Transformation & Calculation Engine integration.
 */

'use strict';

const llmRouter = require('../adapter/llmRouter');
const calculationEngine = require('../validators/calculationEngine');

class Agent2Generator {
  /**
   * Generate candidate MCQ for a specific Assessment Target.
   * @param {Object} target - AssessmentTarget from Agent 1
   * @param {Object} evidencePackage - Session evidence package
   * @param {String} repairInstruction - Optional repair instruction from Agent 3
   * @returns {Object} Candidate MCQ object
   */
  async generateQuestion(target, evidencePackage, repairInstruction = null) {
    const isCalculation = target.dimension === 'Calculation' || (target.concept || '').toLowerCase().includes('banker');

    let calculatedData = null;
    if (isCalculation) {
      calculatedData = calculationEngine.evaluateCalculation(target, { max: [7, 5, 3], allocation: [3, 2, 2] });
    }

    const systemPrompt = `You are Agent 2: Expert CS Question Generator (Fine-Tuned Llama 3 8B).
Generate exactly ONE multiple-choice question in valid JSON format.
JSON SCHEMA:
{
  "targetId": "${target.targetId}",
  "questionText": "...",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correctAnswer": "Option A",
  "explanation": "...",
  "metadata": {
    "dimension": "${target.dimension}",
    "cognitiveLevel": "${target.cognitiveLevel}",
    "targetDifficulty": "${target.targetDifficulty}"
  }
}

STRICT CONSTRAINTS:
1. Output MUST be valid JSON starting with { and ending with }.
2. Exactly 4 distinct options.
3. If transforming scenario: preserve concept, but change surface entities. DO NOT introduce un-taught domain knowledge.
4. ${repairInstruction ? 'REPAIR INSTRUCTION: ' + repairInstruction : ''}`;

    const userPrompt = `
[ASSESSMENT TARGET]
Target ID: ${target.targetId}
Concept: ${target.concept}
Dimension: ${target.dimension}
Cognitive Level: ${target.cognitiveLevel}
Difficulty: ${target.targetDifficulty}
Evidence Type: ${target.evidenceType || 'VOICE + DOCUMENT'}
Instruction: ${target.instruction}
${calculatedData ? '[COMPUTED ARITHMETIC ANSWER]: ' + calculatedData.expectedAnswer : ''}

[SESSION EVIDENCE]
${(evidencePackage.unifiedRawContent || '').substring(0, 2000)}
`;

    try {
      const responseText = await llmRouter.complete({
        prompt: userPrompt,
        systemPrompt: systemPrompt,
        temperature: 0.3,
        model: 'quiz-expert'
      });

      const parsedMCQ = JSON.parse(responseText);

      // Enforce calculated answer if arithmetic target
      if (calculatedData && calculatedData.expectedAnswer) {
        parsedMCQ.correctAnswer = calculatedData.expectedAnswer;
        if (!parsedMCQ.options.includes(calculatedData.expectedAnswer)) {
          parsedMCQ.options[0] = calculatedData.expectedAnswer;
        }
      }

      parsedMCQ.targetId = target.targetId;
      parsedMCQ.metadata = {
        ...(parsedMCQ.metadata || {}),
        dimension: target.dimension || 'Conceptual',
        cognitiveLevel: target.cognitiveLevel || 'Understand',
        targetDifficulty: target.targetDifficulty || 'Medium',
        concept: target.concept
      };

      return parsedMCQ;
    } catch (err) {
      console.warn(`⚠️ [Agent 2] Generation failed or returned malformed JSON: ${err.message}. Building fallback MCQ.`);
      return this._buildFallbackMCQ(target, calculatedData);
    }
  }

  /** Fallback MCQ builder if LLM fails */
  _buildFallbackMCQ(target, calculatedData) {
    const correctAnswer = calculatedData ? calculatedData.expectedAnswer : 'At the beginning of the pipeline';
    const options = [
      correctAnswer,
      'Inside the $group stage',
      'At the very end of the pipeline',
      'Inside the $project stage'
    ];

    return {
      targetId: target.targetId,
      questionText: `Which approach correctly addresses: ${target.concept}?`,
      options: options,
      correctAnswer: correctAnswer,
      explanation: `Correct choice directly satisfies ${target.concept}.`,
      metadata: {
        dimension: target.dimension || 'Conceptual',
        cognitiveLevel: target.cognitiveLevel || 'Understand',
        targetDifficulty: target.targetDifficulty || 'Medium',
        concept: target.concept
      }
    };
  }
}

module.exports = new Agent2Generator();
