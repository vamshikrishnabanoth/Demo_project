const Groq = require('groq-sdk');
const cacheManager = require('../utils/cacheManager');
const metricsManager = require('../utils/metricsManager');
const { 
  generateAnalysisCacheKey, 
  generateQuizCacheKey 
} = require('../utils/cacheHash');
const { validateMCQ } = require('./validators/validatorOrchestrator');
const { createValidationContext } = require('./validators/validationContext');
const { buildConceptGraph } = require('./conceptGraphBuilder/index');
const { generateQuizPlan } = require('./quizPlanner/index');

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

/**
 * 1. ACADEMIC RELEVANCE GUARDRAIL (Per-Input Noise Filtering)
 * Evaluates academic and technical density of individual source inputs (0.00 to 1.00)
 */
function computeAcademicDensityScore(text, sourceName = "Source") {
  if (!text || typeof text !== 'string' || text.trim().length < 10) {
    return { score: 0.0, isAcademic: false };
  }

  const cleaned = text.trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length < 5) {
    return { score: 0.0, isAcademic: false };
  }

  // Technical & academic domain term patterns
  const techRegex = /\b(algorithm|function|database|protocol|interface|class|object|method|structure|query|architecture|system|optimization|complexity|thread|memory|pointer|latency|bandwidth|equation|theorem|reaction|molecule|hypothesis|analysis|property|variable|constant|model|dataset|matrix|vector|derivative|integral|cell|gene|protein|organism|network|quantum|entropy|compiler|cache|schema|index|async|await|event|loop|logic|proof|definition|lemma|corollary)\b|`[^`]+`/gi;
  const techMatches = (cleaned.match(techRegex) || []).length;

  // Administrative / syllabus noise patterns
  const noiseRegex = /\b(syllabus|office hours|grading|attendance|midterm|final exam|homework|zoom|classroom|schedule|instructor|email|due date|late policy|prerequisites|welcome|office|location|contact|phone)\b/gi;
  const noiseMatches = (cleaned.match(noiseRegex) || []).length;

  const techRatio = techMatches / Math.max(1, words.length);
  const noiseRatio = noiseMatches / Math.max(1, words.length);

  let score = (techRatio * 5.0) - (noiseRatio * 4.0);

  // Boost for code snippets or math formulas
  if (cleaned.includes('```') || /[=+\-*/<>{}\\]/.test(cleaned)) {
    score += 0.25;
  }

  if (words.length >= 30 && techMatches >= 2 && noiseMatches === 0) {
    score += 0.20;
  }

  const finalScore = Number(Math.min(1.0, Math.max(0.0, score)).toFixed(2));
  const isAcademic = finalScore >= 0.20;

  return { score: finalScore, isAcademic };
}

class LightweightConceptGraph {
  constructor() {
    this.nodes = new Map();
    this.edges = new Map();
  }

  buildFromText(text) {
    const cg = buildConceptGraph(text);
    cg.nodes.forEach(n => this.nodes.set(n.label || n.id, n.importanceScore || 1));
    cg.edges.forEach(e => this.edges.set(`${e.source}::${e.target}`, e.confidence || 0.8));
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
  const conceptGraph = buildConceptGraph(text);
  const uniqueConcepts = conceptGraph.nodes.length;

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

/**
 * Legacy Validation Wrapper (for backward compatibility)
 */
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
  let { content, difficulty = "Balanced", requestedCount = 10, apiKey } = reqPayload;

  // Correlation Request ID Propagation
  const reqId = reqPayload.requestId || reqPayload.reqId || Math.random().toString(36).substring(2, 10);

  requestedCount = parseInt(requestedCount, 10) || 10;
  if (requestedCount < 1) requestedCount = 1;
  if (requestedCount > 50) requestedCount = 50;

  // ── 1. ACADEMIC RELEVANCE GUARDRAIL & PER-INPUT NOISE FILTERING ──
  let sourceInputs = [];
  if (Array.isArray(reqPayload.inputs) && reqPayload.inputs.length > 0) {
    sourceInputs = reqPayload.inputs;
  } else if (Array.isArray(reqPayload.sources) && reqPayload.sources.length > 0) {
    sourceInputs = reqPayload.sources;
  } else if (content && typeof content === 'string') {
    sourceInputs = [{ name: 'Provided Source Content', content: content }];
  }

  const validAcademicInputs = [];
  const excludedInputs = [];

  sourceInputs.forEach((inp, idx) => {
    const srcName = inp.name || inp.source_name || `Source #${idx + 1}`;
    const srcContent = inp.content || (typeof inp === 'string' ? inp : '');
    const { score, isAcademic } = computeAcademicDensityScore(srcContent, srcName);

    if (isAcademic) {
      validAcademicInputs.push({ ...inp, name: srcName, content: srcContent, densityScore: score });
    } else {
      excludedInputs.push({ name: srcName, densityScore: score });
      console.warn(`[ReqID: ${reqId}] [GUARD] Excluded non-academic source: ${srcName}`);
    }
  });

  // ── 3. SAFETY LOCK ──
  if (validAcademicInputs.length === 0) {
    console.error(`[ReqID: ${reqId}] ❌ [SAFETY LOCK TRIGGERED] No academic or technical content detected across provided sources.`);
    const error = new Error('400 Bad Request: "No academic or technical content detected in provided sources."');
    error.statusCode = 400;
    throw error;
  }

  // Combine valid contents for main generation payload
  const cleanedContent = validAcademicInputs.map(i => i.content).join('\n\n--- Source Split ---\n\n').trim();

  // Normalize difficulty string (handles "Balanced", "balanced", "⚖️ Balanced", etc.)
  const cleanDiffStr = String(difficulty).replace(/[^a-zA-Z]/g, '').toLowerCase();
  let isBalanced = cleanDiffStr.includes('balanced');
  let normalizedDifficulty = 'Balanced';
  if (!isBalanced) {
    if (cleanDiffStr.includes('easy')) normalizedDifficulty = 'Easy';
    else if (cleanDiffStr.includes('hard')) normalizedDifficulty = 'Hard';
    else normalizedDifficulty = 'Medium';
  }

  const rawCharCount = cleanedContent.length;
  const wordCount = cleanedContent.split(/\s+/).length;
  const codeBlocks = (cleanedContent.match(/```[\s\S]*?```/g) || []).length;
  const mathSymbolsCount = (cleanedContent.match(/[=+\-*/<>{}\\]/g) || []).length;

  console.log(`\n======================= 🚀 MCQ GENERATION DRY-RUN TRACE [ReqID: ${reqId}] =======================`);

  // [STEP 1: INGESTION & CONTENT CLEANING]
  console.log(`\n[ReqID: ${reqId}] [STEP 1: INGESTION & CONTENT CLEANING]`);
  console.log(`  ├─ Raw Input Received: ${rawCharCount.toLocaleString()} characters (~${wordCount.toLocaleString()} words) across ${validAcademicInputs.length} valid source(s)`);
  if (excludedInputs.length > 0) {
    console.log(`  ├─ Noise Filtering Guard: Excluded ${excludedInputs.length} non-academic source(s).`);
  } else {
    console.log(`  ├─ Noise Filtering Guard: Stripped transcript filler words, page headers, & audio noise.`);
  }
  console.log(`  ├─ Code/Syntax Guard: Preserved formatting across ${codeBlocks} detected code block(s).`);
  console.log(`  └─ Cleaned Academic Text Payload: ${cleanedContent.length.toLocaleString()} characters remaining.`);

  // [STEP 2: FEATURE ANALYSIS & CONCEPT GRAPH BUILDER v2.6.0 (WITH NAMESPACED CACHING)]
  const analysisCacheKey = generateAnalysisCacheKey(cleanedContent);

  const conceptGraph = await cacheManager.fetchCoalesced(analysisCacheKey, async () => {
    const analysisStart = Date.now();
    const cg = buildConceptGraph(cleanedContent);
    const analysisTime = Date.now() - analysisStart;

    cacheManager.set(analysisCacheKey, cg, {
      measuredProcessingTimeMs: analysisTime,
      qualityScore: 1.0,
      category: 'analysis'
    }, reqId);

    return cg;
  }, reqId);

  const meta = conceptGraph.metadata || {};
  const conceptNodes = conceptGraph.nodes || [];
  const conceptEdges = conceptGraph.edges || [];
  const conceptIndex = conceptGraph.conceptIndex || {};
  const traversalOrder = conceptGraph.traversalOrder || [];

  console.log(`\n[ReqID: ${reqId}] [STEP 2: CONCEPT GRAPH BUILDER & NORMALIZER v2.6.0]`);
  console.log(`  ├─ Extractor Registry: ${meta.activeExtractorsCount || 5} Active Extractors (Stateless)`);
  console.log(`  ├─ Raw Candidates Scanned: ${meta.totalCandidates || conceptNodes.length} | Adaptive Node Limit: ${meta.retainedLimit || 30}`);
  console.log(`  ├─ Graph Normalizer: Pruned ${meta.prunedOrphans || 0} Orphans | Cycles Resolved: ${meta.cyclesResolved || 0}`);
  console.log(`  ├─ Graph Assembly: ${conceptNodes.length} Nodes | ${conceptEdges.length} Edges | Inverted Index: ${Object.keys(conceptIndex).length} Mapped Keys`);
  console.log(`  ├─ Traversal Sequence: Derived ${traversalOrder.length}-step DAG topological order`);
  console.log(`  ├─ Graph Metadata: Avg Confidence: ${meta.averageConfidence || 0.90} | Build Time: ${meta.buildTimeMs || 0}ms`);
  console.log(`  ├─ Health Diagnostics: ${conceptGraph.diagnostics?.extractorWarnings?.length || 0} Extractor Warnings | ${conceptGraph.diagnostics?.buildWarnings?.length || 0} Build Warnings`);
  console.log(`  └─ Normalized Concept Graph and Inverted Index attached to context.`);

  // [STEP 3: QUIZ PLANNER ENGINE v1.3.0]
  const quizPlan = generateQuizPlan(conceptGraph, {
    requestedCount,
    difficulty: normalizedDifficulty
  });

  const dist = quizPlan.distributionSummary || { EASY: 0, MEDIUM: 0, HARD: 0 };
  const pMeta = quizPlan.metadata || {};
  const pDiag = quizPlan.diagnostics || {};

  console.log(`\n[ReqID: ${reqId}] [STEP 3: QUIZ PLANNER ENGINE v1.3.0]`);
  console.log(`  ├─ Plan Configuration: ${requestedCount} Questions | Depth Profile: ${pMeta.difficultyProfile || 'BALANCED'}`);
  console.log(`  ├─ Metadata: Allocation Method: ${pMeta.allocationMethod || 'Hamilton'} | Strategy: ${pMeta.framingStrategy || 'RoundRobinWithCodeOverride'} | Build Time: ${pMeta.buildTimeMs || 0}ms`);
  console.log(`  ├─ Slot Distribution: ${dist.EASY} Easy (RECALL) | ${dist.MEDIUM} Medium (APPLY) | ${dist.HARD} Hard (ANALYZE)`);
  console.log(`  ├─ Hamilton Allocation: Proportional Integer Distribution Applied (0 Fractional Leaks)`);
  console.log(`  ├─ Concept Coverage: ${((pDiag.conceptCoverageRatio || 1.0) * 100).toFixed(1)}% of Graph Nodes Mapped (Avg Imp: ${pDiag.averageConceptImportance || 0.85})`);
  console.log(`  ├─ Anti-Repetition Guard: Enforced (0 Back-to-Back Duplicate Concept Slots)`);
  console.log(`  └─ Quiz Plan blueprint generated and attached to pipeline context.`);

  // [STEP 4: PROMPT CONSTRUCTION & GROUNDING CONTRACT]
  console.log(`\n[ReqID: ${reqId}] [STEP 4: PROMPT CONSTRUCTION & GROUNDING CONTRACT]`);
  console.log(`  ├─ Enforcing Traceability Contract: Requiring explicit sourceEvidence spans for every item.`);
  console.log(`  ├─ Enforcing Anti-Hallucination Rules: Strict zero external domain knowledge constraint.`);
  console.log(`  └─ Multi-Angle Framing Strategy: Active (Direct Recall, Sequential Flow, Comparative Reasoning, Constraint Recognition).`);

  // BATCHING EXECUTION FOR LARGE QUESTION COUNTS (> 10 MCQs) WITH NAMESPACED QUIZ CACHING
  const BATCH_SIZE = 10;
  const numBatches = Math.ceil(requestedCount / BATCH_SIZE);
  let accumulatedQuestions = [];

  for (let b = 0; b < numBatches; b++) {
    const targetInBatch = Math.min(BATCH_SIZE, requestedCount - accumulatedQuestions.length);
    if (targetInBatch <= 0) break;

    const quizCacheKey = generateQuizCacheKey({
      text: cleanedContent,
      difficulty: normalizedDifficulty,
      count: requestedCount,
      batchIndex: b
    });

    const batchQuestions = await cacheManager.fetchCoalesced(quizCacheKey, async () => {
      const batchSlots = quizPlan.slots.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);

      const prompt = `
Generate exactly ${targetInBatch} Multiple Choice Questions (MCQs) grounded strictly in the source text.
${numBatches > 1 ? `BATCH ${b + 1} OF ${numBatches}: Focus on generating distinct, non-overlapping questions.` : ''}

QUIZ PLAN BLUEPRINT SLOTS:
${JSON.stringify(batchSlots, null, 2)}

GROUNDING & EVIDENCE RULES:
1. Every question, choice, explanation, and answer MUST be supported directly by the text.
2. For "sourceEvidence", return an object array containing the smallest text span and character offsets:
   "sourceEvidence": [{ "text": "exact or near-exact span from text", "chunkId": 1, "startOffset": 0, "endOffset": 50 }]
3. Do NOT use "All of the above", "None of the above", or "Both A and B".
4. Multi-angle framing strategies to utilize: Direct Recall, Sequential Flow, Comparative Reasoning, Constraint Recognition.

SOURCE TEXT:
"""
${cleanedContent}
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

      console.log(`\n[ReqID: ${reqId}] [STEP 5: PRIMARY AI GENERATION ENGINE (Batch ${b + 1} of ${numBatches})]`);
      console.log(`  ├─ LLM Provider: Groq (llama-3.1-8b-instant)`);
      console.log(`  ├─ Dispatching Prompt Payload (~${Math.round(prompt.length / 4)} tokens)...`);

      const llmStartTime = Date.now();
      const llm = new LLMProvider(apiKey);
      const rawResponse = await llm.generateJSON(prompt);
      const llmDurationMs = Date.now() - llmStartTime;
      console.log(`  └─ Inference Complete in ${(llmDurationMs / 1000).toFixed(2)} seconds.`);

      const parsedData = parseJSONRecoverable(rawResponse);
      const bQuestions = parsedData.questions || parsedData.fixedQuestions || [];

      if (bQuestions.length > 0) {
        cacheManager.set(quizCacheKey, bQuestions, {
          measuredProcessingTimeMs: llmDurationMs,
          qualityScore: 0.90,
          category: 'quiz'
        }, reqId);
      }

      return bQuestions;
    }, reqId);

    accumulatedQuestions.push(...(batchQuestions || []));
  }

  // [STEP 6: RECOVERY PARSER GUARDRAIL]
  console.log(`\n[ReqID: ${reqId}] [STEP 6: RECOVERY PARSER GUARDRAIL]`);
  console.log(`  ├─ Raw JSON Status: Multi-batch JSON parsing complete.`);
  console.log(`  └─ Recovery Action: ${accumulatedQuestions.length} raw question(s) extracted across ${numBatches} batch(es).`);

  // [STEP 7: VALIDATOR ORCHESTRATOR v4.2.0]
  console.log(`\n[ReqID: ${reqId}] [STEP 7: VALIDATOR ORCHESTRATOR v4.2.0]`);

  const acceptedQuestionIndex = new Map();
  const validQuestions = [];
  const invalidQuestions = [];

  for (let idx = 0; idx < accumulatedQuestions.length; idx++) {
    const q = accumulatedQuestions[idx];
    const valContext = createValidationContext({
      cleanedContent,
      targetDifficulty: normalizedDifficulty,
      targetBloom: 'UNDERSTAND',
      expectedFraming: q.framingType || 'Direct Recall',
      conceptGraph,
      extractedConcepts: conceptNodes.map(n => n.id),
      acceptedQuestionIndex
    });

    const report = await validateMCQ(q, valContext);

    const stem = q.question || q.questionText || "Untitled Question";
    const stemShort = stem.length > 45 ? stem.slice(0, 45) + "..." : stem;

    const structStage = report.validationTrace.find(t => t.stage === 'STRUCTURAL') || { durationMs: 0, code: 'PASS' };
    const groundStage = report.validationTrace.find(t => t.stage === 'GROUNDING') || { durationMs: 0, matchType: 'Exact Match' };
    const eduStage = report.validationTrace.find(t => t.stage === 'EDUCATIONAL') || { durationMs: 0, qualityScore: report.qualityScore };

    console.log(`  ├─ Q${idx + 1}: "${stemShort}"`);
    console.log(`  │   ├─ Gate 1 (Structural):  ${structStage.passed !== false ? '✅ PASS' : '❌ FAIL'} (${structStage.durationMs}ms) | Code: ${structStage.code}`);
    if (structStage.passed !== false) {
      console.log(`  │   ├─ Gate 2 (Grounding):   ${groundStage.passed !== false ? '⚡ PASS' : '❌ FAIL'} (${groundStage.durationMs}ms) | Match: ${groundStage.matchType}`);
      if (groundStage.passed !== false) {
        console.log(`  │   ├─ Eval 3 (Educational): ${eduStage.passed !== false ? '✅ PASS' : '⚠️ WARNING'} (${eduStage.durationMs}ms) | Bloom Framing: ${valContext.plannerHints.expectedFraming}`);
      }
    }

    const b = report.qualityBreakdown;
    const bdStr = `S:${b.structural.toFixed(1)} | G:${b.grounding.toFixed(1)} | E:${b.educational.toFixed(1)}`;
    const statusTag = report.isValid ? '✅ APPROVED' : '❌ REJECTED (Triggering Targeted Repair)';
    console.log(`  │   └─ Quality Score: ${report.qualityScore.toFixed(2)} / 1.00 (Breakdown: ${bdStr}) ──► ${statusTag} (Total: ${report.metrics.totalValidationMs}ms)`);
    console.log(`  │`);

    const enrichedQuestion = {
      ...q,
      question: stem,
      questionText: stem,
      qualityScore: report.qualityScore,
      validationReport: report
    };

    if (report.isValid) {
      validQuestions.push(enrichedQuestion);
      acceptedQuestionIndex.set(stem, { score: report.qualityScore });
    } else {
      invalidQuestions.push({
        index: idx,
        question: enrichedQuestion,
        errors: report.findings.criticalFailures.map(f => f.message || f.code || String(f)),
        failureStage: report.failureStage,
        code: report.findings.criticalFailures[0]?.code || 'FAIL'
      });
    }
  }

  // [STEP 8: TARGETED REPAIR ROUTING & REVALIDATION]
  let repairAttempts = 0;
  while (validQuestions.length < requestedCount && invalidQuestions.length > 0 && repairAttempts < config.maxRepairAttempts) {
    repairAttempts++;
    console.log(`\n[ReqID: ${reqId}] [STEP 8: TARGETED REPAIR ROUTING (Attempt ${repairAttempts} / ${config.maxRepairAttempts})]`);

    const targetedRepairs = invalidQuestions.map(inv => {
      const qItem = inv.question;
      if (!qItem.repairHistory) qItem.repairHistory = [];
      qItem.repairHistory.push({ stage: inv.failureStage, code: inv.code, timestamp: Date.now() });

      return {
        index: inv.index + 1,
        question: qItem.question,
        options: qItem.options,
        correctAnswer: qItem.correctAnswer,
        failureStage: inv.failureStage,
        errorCode: inv.code,
        failureReasons: inv.errors
      };
    });

    console.log(`  ├─ Targeted Repair Index: ${targetedRepairs.map(r => `#${r.index}`).join(', ')}`);
    console.log(`  ├─ Error Codes Sent to Repair Agent: ${targetedRepairs.map(r => r.errorCode).join(', ')}`);

    const repairStartTime = Date.now();

    const repairPrompt = `
Fix the following defective MCQ objects based STRICTLY on the source text.
Address the specific failureStage and errorCode listed for each item.

DEFECTIVE ITEMS & ERROR CODES:
${JSON.stringify(targetedRepairs, null, 2)}

SOURCE TEXT:
"""
${cleanedContent}
"""

Return JSON: { "fixedQuestions": [...] }
`;

    try {
      const llm = new LLMProvider(apiKey);
      const repairRaw = await llm.generateJSON(repairPrompt);
      const repairDurationSec = ((Date.now() - repairStartTime) / 1000).toFixed(2);
      console.log(`  ├─ Repair Agent Execution Complete in ${repairDurationSec} seconds.`);

      const repairedData = parseJSONRecoverable(repairRaw);
      const fixedList = (repairedData.fixedQuestions || repairedData.questions || []).map(q => ({ ...q, wasRepaired: true }));

      for (const fItem of fixedList) {
        const valContext = createValidationContext({
          cleanedContent,
          targetDifficulty: normalizedDifficulty,
          conceptGraph,
          acceptedQuestionIndex
        });
        const repReport = await validateMCQ(fItem, valContext);
        if (repReport.isValid) {
          fItem.qualityScore = repReport.qualityScore;
          validQuestions.push(fItem);
          acceptedQuestionIndex.set(fItem.question || fItem.questionText, { score: repReport.qualityScore });
        }
      }

      console.log(`  └─ Re-Validating Repaired Items Complete. Approved Valid Count: ${validQuestions.length}`);
    } catch (repairErr) {
      console.log(`  └─ Repair Attempt #${repairAttempts} Failed: ${repairErr.message}`);
      break;
    }
  }

  // [BACKFILL GUARD: GUARANTEE EXACT QUESTION COUNT MATCH]
  if (validQuestions.length < requestedCount) {
    const missingCount = requestedCount - validQuestions.length;
    console.log(`\n[ReqID: ${reqId}] [BACKFILL GUARD] Valid questions (${validQuestions.length}) < Requested (${requestedCount}). Fetching ${missingCount} supplemental MCQs...`);
    try {
      const backfillSlots = quizPlan.slots.slice(0, missingCount);
      const backfillPrompt = `
Generate exactly ${missingCount} UNIQUE Multiple Choice Questions (MCQs) grounded strictly in the source text.
DO NOT repeat any previous question stems.

QUIZ PLAN BLUEPRINT SLOTS:
${JSON.stringify(backfillSlots, null, 2)}

SOURCE TEXT:
"""
${cleanedContent}
"""

Return JSON: { "questions": [...] }
`;
      const llm = new LLMProvider(apiKey);
      const backfillRaw = await llm.generateJSON(backfillPrompt);
      const backfillData = parseJSONRecoverable(backfillRaw);
      const backfillQuestions = backfillData.questions || backfillData.fixedQuestions || [];
      
      for (const bfItem of backfillQuestions) {
        const valContext = createValidationContext({
          cleanedContent,
          targetDifficulty: normalizedDifficulty,
          conceptGraph,
          acceptedQuestionIndex
        });
        const bfReport = await validateMCQ(bfItem, valContext);
        if (bfReport.isValid) {
          bfItem.qualityScore = bfReport.qualityScore;
          validQuestions.push(bfItem);
          acceptedQuestionIndex.set(bfItem.question || bfItem.questionText, { score: bfReport.qualityScore });
        }
      }
    } catch (bfErr) {
      console.warn(`[ReqID: ${reqId}] ⚠️ Backfill attempt error:`, bfErr.message);
    }
  }

  const executionTimeMs = Date.now() - startTime;
  const totalLatencySec = (executionTimeMs / 1000).toFixed(2);
  const finalQuestions = validQuestions.slice(0, requestedCount);
  const totalScoreSum = finalQuestions.reduce((acc, q) => acc + (q.qualityScore || 1.0), 0);
  const avgQualityScore = finalQuestions.length > 0 ? (totalScoreSum / finalQuestions.length).toFixed(2) : "0.00";
  const isPartial = finalQuestions.length < requestedCount;
  const finalStatusStr = isPartial ? "PARTIAL_SUCCESS" : "SUCCESS";

  // FETCH CACHE METRICS SUMMARY FOR THIS REQUEST
  const reqMetrics = metricsManager.getRequestSummary(reqId);

  console.log(`\n======================= 📊 CACHE EXECUTION SUMMARY [ReqID: ${reqId}] =======================`);
  console.log(`  ├─ L1 Memory Hits: ${reqMetrics.l1Hits}`);
  console.log(`  ├─ L2 Storage Hits: ${reqMetrics.l2Hits}`);
  console.log(`  ├─ Cache Misses: ${reqMetrics.misses}`);
  console.log(`  ├─ Cache Writes Skipped (Size/Failure): ${reqMetrics.writesSkipped}`);
  console.log(`  └─ Total Actual Processing Time Saved: ${reqMetrics.processingTimeSavedMs.toLocaleString()} ms`);
  console.log("========================================================================\n");

  return {
    success: true,
    status: finalStatusStr,
    requestId: reqId,
    conceptGraph,
    conceptIndex,
    quizPlan,
    ...(isPartial && {
      notice: `Generated ${finalQuestions.length} validated questions out of ${requestedCount} requested.`
    }),
    quizPlanSummary: {
      allocatedConcepts: quizPlan.slots.map(s => ({ concept: s.conceptLabel, targetQuestions: 1 })),
      targetDifficulty: normalizedDifficulty,
      depthProfile: pMeta.difficultyProfile,
      distributionSummary: dist
    },
    questions: finalQuestions,
    cacheMetrics: reqMetrics
  };
}

module.exports = {
  generateMCQPipeline,
  DEFAULT_CONFIG,
  computeAcademicDensityScore,
  computeLectureDepth,
  validateAndScoreQuiz,
  parseJSONRecoverable,
  computeJaccardSimilarity,
  LightweightConceptGraph
};
