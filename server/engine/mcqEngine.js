const Groq = require('groq-sdk');

const DEFAULT_CONFIG = {
  maxRepairAttempts: 2,
  requestTimeoutMs: 15000,
  similarityThreshold: 0.85,
  scoring: {
    baseScore: 1.0,
    penalties: {
      missingEvidenceSpan: 0.20,
      borderlineDuplicate: 0.15,
      minorWarning: 0.10,
      repairedItem: 0.15
    }
  }
};

class LightweightConceptGraph {
  constructor() {
    this.nodes = new Map();
    this.edges = new Map();
  }

  buildFromText(text) {
    if (!text || typeof text !== 'string') return this;
    
    // Extract technical concepts: Acronyms, CamelCase, snake_case, code tokens, function calls
    const conceptRegex = /\b([A-Z]{2,}[0-9]?|[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]+)+|[a-z0-9]+_[a-z0-9_]+|`[^`]+`|[A-Z][a-zA-Z0-9_\-]{2,})\b/g;
    const matches = text.match(conceptRegex) || [];
    const sanitized = matches.map(m => m.replace(/`/g, '').toLowerCase());

    sanitized.forEach(term => {
      this.nodes.set(term, (this.nodes.get(term) || 0) + 1);
    });

    for (let i = 0; i < sanitized.length - 1; i++) {
      const pair = [sanitized[i], sanitized[i + 1]].sort().join('::');
      this.edges.set(pair, (this.edges.get(pair) || 0) + 1);
    }
    return this;
  }

  allocateConcepts(requestedCount) {
    const sortedConcepts = Array.from(this.nodes.entries())
      .sort((a, b) => b[1] - a[1])
      .map(entry => entry[0]);

    if (sortedConcepts.length === 0) {
      return [{ concept: "Core Curriculum Concept", targetQuestions: requestedCount }];
    }

    const allocation = [];
    const topConcepts = sortedConcepts.slice(0, Math.min(sortedConcepts.length, requestedCount));
    const basePerConcept = Math.floor(requestedCount / topConcepts.length);
    let remainder = requestedCount % topConcepts.length;

    topConcepts.forEach(concept => {
      const count = basePerConcept + (remainder > 0 ? 1 : 0);
      remainder--;
      allocation.push({ concept, targetQuestions: count });
    });

    return allocation;
  }
}

class LLMProvider {
  constructor(apiKey) {
    this.client = new Groq({ apiKey: apiKey || process.env.GROQ_API_KEY });
  }

  async generateJSON(prompt, systemMessage = "You are a precise academic assessment engine.") {
    let attempts = 0;
    const maxAttempts = 2;
    let lastError = null;

    while (attempts < maxAttempts) {
      attempts++;
      try {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("LLM Request Timeout (15s)")), 15000)
        );

        const apiPromise = this.client.chat.completions.create({
          messages: [
            { role: "system", content: systemMessage },
            { role: "user", content: prompt }
          ],
          model: "llama-3.1-8b-instant",
          response_format: { type: "json_object" },
          temperature: 0.15
        });

        const response = await Promise.race([apiPromise, timeoutPromise]);
        return response.choices[0].message.content;
      } catch (err) {
        lastError = err;
        console.warn(`[LLMProvider Attempt ${attempts} failed]: ${err.message}`);
        if (attempts < maxAttempts) {
          await new Promise(r => setTimeout(r, 1000 * attempts));
        }
      }
    }
    throw lastError || new Error("LLM generation failed after retries.");
  }
}

function parseJSONRecoverable(rawString) {
  if (!rawString || typeof rawString !== 'string') {
    throw new Error("Empty or invalid string provided for JSON parsing.");
  }
  try {
    return JSON.parse(rawString);
  } catch (e1) {
    let cleaned = rawString.replace(/```json/gi, '').replace(/```/g, '').trim();
    try {
      return JSON.parse(cleaned);
    } catch (e2) {
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        cleaned = cleaned.substring(firstBrace, lastBrace + 1);
        try {
          return JSON.parse(cleaned);
        } catch (e3) {
          cleaned = cleaned
            .replace(/,\s*([\]}])/g, '$1')
            .replace(/[\u0000-\u001F\u007F-\u009F]/g, (match) => {
              if (match === '\n' || match === '\r' || match === '\t') return match;
              return '';
            });
          return JSON.parse(cleaned);
        }
      }
      throw new Error("Failed to recover valid JSON from LLM response.");
    }
  }
}

function computeJaccardSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  const setA = new Set(String(str1).toLowerCase().split(/\s+/).filter(Boolean));
  const setB = new Set(String(str2).toLowerCase().split(/\s+/).filter(Boolean));
  if (setA.size === 0 && setB.size === 0) return 1.0;
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

function computeLectureDepth(text) {
  if (!text || typeof text !== 'string') {
    return { lectureDepthScore: 25, depthBand: "Low" };
  }

  const words = text.trim().split(/\s+/).length;
  const conceptGraph = new LightweightConceptGraph().buildFromText(text);
  const uniqueConcepts = conceptGraph.nodes.size;

  const codeBlocks = (text.match(/```[\s\S]*?```/g) || []).length;
  const mathSymbols = (text.match(/[=+\-*/<>{}\\]/g) || []).length;
  const technicalTerms = (text.match(/\b(algorithm|function|database|protocol|interface|class|object|method|structure|query|architecture|system|optimization|complexity|thread|memory|pointer|latency|bandwidth)\b/gi) || []).length;

  let score = 0;

  // Word count contribution (max 35)
  if (words > 2500) score += 35;
  else if (words > 1500) score += 28;
  else if (words > 800) score += 20;
  else if (words > 300) score += 12;
  else score += Math.min(8, Math.floor(words / 40));

  // Concept density contribution (max 30)
  score += Math.min(30, uniqueConcepts * 2);

  // Technical & code block density contribution (max 35)
  score += Math.min(20, codeBlocks * 5 + Math.floor(mathSymbols / 10));
  score += Math.min(15, Math.floor(technicalTerms * 1.2));

  const lectureDepthScore = Math.min(100, Math.max(15, score));

  let depthBand = "Low";
  if (lectureDepthScore >= 86) depthBand = "Very High";
  else if (lectureDepthScore >= 61) depthBand = "High";
  else if (lectureDepthScore >= 31) depthBand = "Moderate";
  else depthBand = "Low";

  return { lectureDepthScore, depthBand };
}

function validateAndScoreQuiz(questions, config = DEFAULT_CONFIG) {
  const validQuestions = [];
  const invalidQuestions = [];
  const seenStems = [];

  (questions || []).forEach((q, idx) => {
    const criticalErrors = [];
    const warnings = [];
    let penaltiesToApply = 0;

    const stem = q.question || q.questionText;
    if (!stem || typeof stem !== 'string') criticalErrors.push("Missing question text.");
    if (!Array.isArray(q.options) || q.options.length !== 4) criticalErrors.push("Options must contain exactly 4 items.");

    if (Array.isArray(q.options) && q.options.length === 4) {
      const uniqueOpts = new Set(q.options.map(o => String(o).trim().toLowerCase()));
      if (uniqueOpts.size !== 4) criticalErrors.push("Duplicate choices detected.");

      const verbatimMatch = q.options.some(opt => String(opt).trim() === String(q.correctAnswer).trim());
      if (!verbatimMatch) criticalErrors.push("correctAnswer string does not match any option verbatim.");

      const hasLazyOption = q.options.some(opt => /all of the above|none of the above|both a and b|both b and c/i.test(String(opt)));
      if (hasLazyOption) criticalErrors.push("Forbidden option phrase ('All/None of the above').");
    }

    if (stem) {
      for (const seen of seenStems) {
        const sim = computeJaccardSimilarity(stem, seen);
        if (sim >= config.similarityThreshold) {
          criticalErrors.push(`Semantic duplicate detected (Similarity: ${sim.toFixed(2)}).`);
          break;
        } else if (sim >= 0.65) {
          warnings.push("Borderline question stem similarity.");
          penaltiesToApply += config.scoring.penalties.borderlineDuplicate;
        }
      }
      seenStems.push(stem);
    }

    if (!Array.isArray(q.sourceEvidence) || q.sourceEvidence.length === 0 || !q.sourceEvidence[0]?.text) {
      warnings.push("Missing or incomplete source evidence span.");
      penaltiesToApply += config.scoring.penalties.missingEvidenceSpan;
    }

    if (q.wasRepaired) penaltiesToApply += config.scoring.penalties.repairedItem;
    const finalQualityScore = Math.max(0.1, Number((config.scoring.baseScore - penaltiesToApply).toFixed(2)));

    const enrichedQuestion = {
      ...q,
      question: stem,
      questionText: stem,
      qualityScore: finalQualityScore,
      validationWarnings: warnings
    };

    if (criticalErrors.length === 0) {
      validQuestions.push(enrichedQuestion);
    } else {
      invalidQuestions.push({ index: idx, question: enrichedQuestion, errors: criticalErrors });
    }
  });

  return { isValid: invalidQuestions.length === 0, validQuestions, invalidQuestions };
}

async function generateMCQPipeline(reqPayload, config = DEFAULT_CONFIG) {
  const startTime = Date.now();
  const { content, difficulty = "Balanced", requestedCount = 10, apiKey } = reqPayload;

  if (!content || typeof content !== 'string' || content.trim().length < 10) {
    throw new Error("Insufficient source content provided for MCQ generation.");
  }

  const internalTelemetry = {
    pipelineVersion: "4.1-Architect",
    provider: "groq",
    model: "llama-3.1-8b-instant",
    repairAttempts: 0,
    startTime
  };

  // 1. Content Analysis & Lecture Depth Computation
  const { lectureDepthScore, depthBand } = computeLectureDepth(content);
  const conceptGraph = new LightweightConceptGraph().buildFromText(content);
  const conceptPlan = conceptGraph.allocateConcepts(parseInt(requestedCount, 10));

  // 2. Compute Difficulty Plan
  let difficultyPlanNotice = difficulty;
  if (difficulty === "Balanced") {
    if (depthBand === "Low") difficultyPlanNotice = "Balanced (70% Easy, 30% Medium)";
    else if (depthBand === "Moderate") difficultyPlanNotice = "Balanced (40% Easy, 40% Medium, 20% Hard)";
    else if (depthBand === "High") difficultyPlanNotice = "Balanced (30% Easy, 40% Medium, 30% Hard)";
    else difficultyPlanNotice = "Balanced (20% Easy, 40% Medium, 40% Hard)";
  }

  // 3. Construct Deterministic Prompt
  const prompt = `
Generate exactly ${requestedCount} Multiple Choice Questions (MCQs) grounded strictly in the source text.

CONCEPT ALLOCATION PLAN:
${JSON.stringify(conceptPlan, null, 2)}

TARGET DIFFICULTY STRATEGY: ${difficultyPlanNotice}
LECTURE DEPTH BAND: ${depthBand} (Score: ${lectureDepthScore}/100)

GROUNDING & EVIDENCE RULES:
1. Every question, choice, explanation, and answer MUST be supported directly by the text.
2. For "sourceEvidence", return an object array containing the smallest text span and character offsets:
   "sourceEvidence": [{ "text": "exact or near-exact span from text", "chunkId": 1, "startOffset": 0, "endOffset": 50 }]
3. Do NOT use "All of the above", "None of the above", or "Both A and B".
4. Multi-angle framing strategies to utilize: Direct Recall, Sequential Flow, Comparative Reasoning, Constraint Recognition.

SOURCE TEXT:
"""
${content}
"""

OUTPUT FORMAT (JSON ONLY):
{
  "questions": [
    {
      "question": "Question stem",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "Exact matching string from options",
      "explanation": "Academic rationale directly supported by text",
      "sourceEvidence": [{ "text": "exact span from source", "chunkId": 1, "startOffset": 0, "endOffset": 50 }],
      "relativeDifficulty": "Easy | Medium | Hard",
      "framingType": "Direct Recall | Sequential Flow | Comparative Reasoning | Constraint Recognition"
    }
  ]
}
`;

  const llm = new LLMProvider(apiKey);
  const rawResponse = await llm.generateJSON(prompt);
  const parsedData = parseJSONRecoverable(rawResponse);
  let rawQuestions = parsedData.questions || [];

  let validation = validateAndScoreQuiz(rawQuestions, config);

  while (!validation.isValid && internalTelemetry.repairAttempts < config.maxRepairAttempts) {
    internalTelemetry.repairAttempts++;
    console.warn(`[Internal Telemetry] Executing Repair Attempt #${internalTelemetry.repairAttempts}...`);

    const repairPrompt = `
Fix the following defective MCQ objects based STRICTLY on the source text.
Preserve the original intent and difficulty level.

DEFECTIVE ITEMS & ERRORS:
${JSON.stringify(validation.invalidQuestions, null, 2)}

SOURCE TEXT:
"""
${content}
"""

Return JSON: { "fixedQuestions": [...] }
`;

    try {
      const repairRaw = await llm.generateJSON(repairPrompt);
      const repairedData = parseJSONRecoverable(repairRaw);
      const fixedList = (repairedData.fixedQuestions || repairedData.questions || []).map(q => ({ ...q, wasRepaired: true }));

      const mergedList = [...validation.validQuestions, ...fixedList];
      validation = validateAndScoreQuiz(mergedList, config);
    } catch (repairErr) {
      console.error(`[Repair Attempt #${internalTelemetry.repairAttempts} Failed]:`, repairErr.message);
      break;
    }
  }

  internalTelemetry.executionTimeMs = Date.now() - startTime;
  console.log("[Internal Telemetry Audit]", JSON.stringify(internalTelemetry));

  const finalQuestions = validation.validQuestions.slice(0, requestedCount);
  const isPartial = finalQuestions.length < requestedCount;

  return {
    success: true,
    status: isPartial ? "PARTIAL_SUCCESS" : "SUCCESS",
    lectureDepth: {
      score: lectureDepthScore,
      band: depthBand
    },
    ...(isPartial && {
      notice: `Generated ${finalQuestions.length} validated questions out of ${requestedCount} requested. Failing items were discarded to maintain factual precision.`
    }),
    quizPlanSummary: {
      allocatedConcepts: conceptPlan,
      targetDifficulty: difficulty,
      depthScore: lectureDepthScore,
      depthBand
    },
    questions: finalQuestions
  };
}

module.exports = {
  generateMCQPipeline,
  DEFAULT_CONFIG,
  computeLectureDepth,
  validateAndScoreQuiz,
  parseJSONRecoverable,
  computeJaccardSimilarity,
  LightweightConceptGraph
};
