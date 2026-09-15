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
const { getTargetEvidenceContext } = require('../evidence/evidenceContextSelector');

class Agent2Generator {
  /**
   * Deterministically normalize correctAnswer to match one of the 4 options.
   */
  normalizeCorrectAnswer(mcq) {
    if (!mcq || !Array.isArray(mcq.options) || mcq.options.length === 0 || !mcq.correctAnswer) {
      return;
    }
    const ans = String(mcq.correctAnswer).trim();

    // 1. Exact match
    if (mcq.options.includes(ans)) {
      mcq.correctAnswer = ans;
      return;
    }

    // 2. Letter / Index prefix: "Option A", "A", "A)", "(A)", "Option 1", "1"
    const letterMatch = ans.match(/^(?:option\s+)?([a-d1-4])(?:\)|\.|\:|\s|$)/i);
    if (letterMatch) {
      const char = letterMatch[1].toUpperCase();
      const map = { 'A': 0, '1': 0, 'B': 1, '2': 1, 'C': 2, '3': 2, 'D': 3, '4': 3 };
      const idx = map[char];
      if (idx !== undefined && mcq.options[idx]) {
        mcq.correctAnswer = mcq.options[idx];
        return;
      }
    }

    // 3. Case-insensitive or trimmed match
    const lowerAns = ans.toLowerCase();
    const matchedOpt = mcq.options.find(o => (o || '').trim().toLowerCase() === lowerAns);
    if (matchedOpt) {
      mcq.correctAnswer = matchedOpt;
      return;
    }

    // 4. Substring without letter prefix
    const strippedAns = ans.replace(/^(?:option\s+[a-d1-4]|(?:[a-d1-4][\)\.\:\s]+))\s*/i, '').trim().toLowerCase();
    if (strippedAns) {
      const subMatch = mcq.options.find(o => (o || '').trim().toLowerCase() === strippedAns);
      if (subMatch) {
        mcq.correctAnswer = subMatch;
        return;
      }
    }
  }

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

    const systemPrompt = `You are Agent 2: Expert CS Question Generator.
Generate exactly ONE multiple-choice question in valid JSON format.
JSON SCHEMA:
{
  "targetId": "${target.targetId}",
  "questionText": "...",
  "options": ["First distinct option", "Second distinct option", "Third distinct option", "Fourth distinct option"],
  "correctAnswer": "First distinct option",
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
3. Exactly 4 distinct, plausible options.
4. "correctAnswer" MUST be the exact verbatim string of one of the 4 items in the "options" array.
5. Ground the question strictly in the provided session evidence. DO NOT introduce un-taught domain knowledge.
6. ${repairInstruction ? 'REPAIR INSTRUCTION: ' + repairInstruction : ''}`;

    const evidenceContext = getTargetEvidenceContext(target, evidencePackage.unifiedRawContent || '', 3000);

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

[GROUNDING EVIDENCE]
${evidenceContext}
`;

    const fastModel = process.env.AGENT2_MODEL || 'openai/gpt-oss-20b';

    let responseText = await llmRouter.complete({
      prompt: userPrompt,
      systemPrompt: systemPrompt,
      temperature: 0.2,
      model: fastModel
    });

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
          model: fastModel
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

    // Deterministically normalize correctAnswer before schema validation
    this.normalizeCorrectAnswer(parsedMCQ);

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
