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
const { safeParseJson } = require('../utils/jsonParser');

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
1. Output MUST be strictly raw JSON starting with { and ending with }.
2. Absolutely NO markdown asterisks, bullet points, definitions, conversational commentary, or headers outside the JSON.
3. Exactly 4 distinct options.
4. If transforming scenario: preserve concept, but change surface entities. DO NOT introduce un-taught domain knowledge.
5. ${repairInstruction ? 'REPAIR INSTRUCTION: ' + repairInstruction : ''}`;

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
${(evidencePackage.unifiedRawContent || '').substring(0, 16000)}
`;

    let responseText = '';
    try {
      responseText = await llmRouter.complete({
        prompt: userPrompt,
        systemPrompt: systemPrompt,
        temperature: 0.3,
        model: 'llama-3.3-70b-versatile'
      });
    } catch (err) {
      console.warn(`⚠️ [Agent 2] Primary model failed: ${err.message}. Retrying with llama-3.1-8b-instant...`);
      responseText = await llmRouter.complete({
        prompt: userPrompt,
        systemPrompt: systemPrompt,
        temperature: 0.2,
        model: 'llama-3.1-8b-instant'
      });
    }

    let parsedMCQ;
    try {
      parsedMCQ = safeParseJson(responseText);
    } catch (parseErr) {
      console.warn(`⚠️ [Agent 2] Initial JSON parse notice: ${parseErr.message}. Retrying with repair prompt...`);
      try {
        const repairResponse = await llmRouter.complete({
          prompt: `The previous output had syntax issues:\n"${responseText.substring(0, 400)}"\nConvert it into strictly valid JSON for:\nTarget: ${target.concept}\nInstruction: ${target.instruction}`,
          systemPrompt: 'You are a JSON repair specialist. Output ONLY the raw JSON object matching the required schema starting with { and ending with }. No commentary or markdown formatting.',
          temperature: 0.1,
          model: 'llama-3.1-8b-instant'
        });
        parsedMCQ = safeParseJson(repairResponse);
      } catch (repairErr) {
        console.error(`❌ [Agent 2] JSON repair failed for target ${target.targetId}: ${repairErr.message}`);
        const fatalJsonErr = new Error(`AGENT2_JSON_PARSE_FAILED: ${parseErr.message}`);
        fatalJsonErr.code = 'JSON_PARSE_ERROR';
        fatalJsonErr.targetId = target.targetId;
        throw fatalJsonErr;
      }
    }

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
  }
}

module.exports = new Agent2Generator();
