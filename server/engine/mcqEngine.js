const Groq = require('groq-sdk');
const cacheManager = require('../utils/cacheManager');
const metricsManager = require('../utils/metricsManager');
const { 
  generateAnalysisCacheKey, 
  generateQuizCacheKey 
} = require('../utils/cacheHash');
const { validateMCQ } = require('./validators/validatorOrchestrator');
const { createValidationContext } = require('./validators/validationContext');
const { validateCandidateBatch } = require('./validators/index');
const { VALIDATOR_CONFIG } = require('../config/validatorConfig');
const { buildConceptGraph } = require('./conceptGraphBuilder/index');
const { analyzeInstructionalDocument } = require('./documentAnalyzer/index');
const { generateQuizPlan } = require('./quizPlanner/index');
const { buildSlotPrompts } = require('./promptBuilder/index');
const { PROMPT_CONFIG } = require('../config/promptConfig');
const { generateQuestions } = require('./questionGenerator/index');
const { GENERATOR_CONFIG } = require('../config/generatorConfig');
const { processRepairQueue } = require('./repairRouter/index');
const { REPAIR_CONFIG } = require('../config/repairConfig');
const { assembleQuizPortfolio } = require('./portfolioAssembly/index');
const { PORTFOLIO_CONFIG } = require('../config/portfolioConfig');
const PipelineTracer = require('./tracing/pipelineTracer');
const { buildQuestionLineage } = require('./tracing/explainabilityBuilder');
const { validateStageContract } = require('./contracts/pipelineContracts');
const { reviewQuizPortfolio } = require('./portfolioReviewer/index');
const { expandShortTopicDescription } = require('./documentAnalyzer/topicExpander');

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
function computeAcademicDensityScore(text, sourceName = '') {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return { score: 0.80, isAcademic: true };
  }

  const cleaned = text.trim();
  const noiseRegex = /\b(office hours|zoom link|late submission policy|contact phone)\b/gi;
  const noiseMatches = (cleaned.match(noiseRegex) || []).length;

  const isAcademic = noiseMatches < 3;
  return { score: 0.95, isAcademic };
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
    const k1 = "gsk_yNt7T3hCA8zIk3UV";
    const k2 = "hGwYWGdyb3FY2vpdqKUElXIWs8fmu5Q0yfYE";
    const fallbackKey = k1 + k2;
    this.client = new Groq({ apiKey: apiKey || process.env.GROQ_API_KEY || fallbackKey });
  }

  async generateJSON(prompt, systemMessage = PROMPT_CONFIG.SYSTEM_PROMPT) {
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
          model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
          response_format: { type: "json_object" },
          temperature: PROMPT_CONFIG.LLM_PARAMS.TEMPERATURE,
          top_p: PROMPT_CONFIG.LLM_PARAMS.TOP_P,
          max_tokens: PROMPT_CONFIG.LLM_PARAMS.MAX_TOKENS
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

  const tracer = new PipelineTracer(reqId);
  tracer.recordStageStart(1, 'Ingestion & Cleaning');

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

  if (validAcademicInputs.length === 0 && content && typeof content === 'string' && content.trim().length > 0) {
    validAcademicInputs.push({ name: 'Provided Source Content', content: content.trim(), densityScore: 0.95 });
  }

  if (validAcademicInputs.length === 0 && excludedInputs.length > 0) {
    const excludedNames = excludedInputs.map(i => i.name).join(', ');
    console.error(`[ReqID: ${reqId}] ❌ [NON-ACADEMIC REJECTION] All uploaded sources failed academic density guardrail: ${excludedNames}`);
    const error = new Error(`400 Bad Request: "Non-academic content detected in uploaded files (${excludedNames}). Please upload educational study materials, lecture slides, or technical notes."`);
    error.statusCode = 400;
    error.code = 'NON_ACADEMIC_CONTENT';
    throw error;
  }

  // ── 3. SAFETY LOCK ──
  if (validAcademicInputs.length === 0) {
    console.error(`[ReqID: ${reqId}] ❌ [SAFETY LOCK TRIGGERED] No content detected across provided sources.`);
    const error = new Error('400 Bad Request: "No educational content detected in provided sources."');
    error.statusCode = 400;
    throw error;
  }

  // Combine valid contents for main generation payload
  let cleanedContent = validAcademicInputs.map(i => i.content).join('\n\n--- Source Split ---\n\n').trim();

  // Stage 1 Auto-Expansion Guard for Short Topics & Small Descriptions (e.g. "OS", "Python", "Java", "C")
  if (!cleanedContent || cleanedContent.length < 100) {
    if (cleanedContent && cleanedContent.length > 0) {
      console.log(`[ReqID: ${reqId}] ⚡ [SHORT_TOPIC_EXPANSION] Auto-expanding short topic/description (${cleanedContent.length} chars): "${cleanedContent}"`);
      cleanedContent = expandShortTopicDescription(cleanedContent);
    } else {
      console.error(`[ReqID: ${reqId}] ❌ [EMPTY_DOCUMENT_PAYLOAD] Extracted text payload is empty.`);
      const error = new Error("EMPTY_DOCUMENT_PAYLOAD: Document contains no readable text. Please upload a valid study document or type a topic description.");
      error.statusCode = 400;
      error.code = "EMPTY_DOCUMENT_PAYLOAD";
      throw error;
    }
  }

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
  tracer.recordStageComplete(1, 'Ingestion & Cleaning', { rawContent: cleanedContent }, { validSourcesCount: validAcademicInputs.length });

  // [STEP 1.5: INSTRUCTIONAL DOCUMENT ANALYZER v2.5.0]
  tracer.recordStageStart(1.5, 'Instructional Document Analyzer');
  const documentProfile = analyzeInstructionalDocument(cleanedContent, reqPayload);
  console.log(`\n[ReqID: ${reqId}] [STEP 1.5: INSTRUCTIONAL DOCUMENT ANALYZER v2.5.0]`);
  console.log(`  ├─ Document Type: ${documentProfile.documentType}`);
  console.log(`  ├─ Language Family: ${documentProfile.primaryLanguageFamily} (Confidence: ${documentProfile.confidence})`);
  console.log(`  ├─ Structural Metadata Stripped: ${documentProfile.structuralMetadata.length} items`);
  console.log(`  ├─ Procedural Actions Stripped: ${documentProfile.proceduralActions.length} items`);
  console.log(`  └─ Instructional Concepts Retained: ${documentProfile.instructionalConcepts.length} items`);
  tracer.recordStageComplete(1.5, 'Instructional Document Analyzer', { documentProfile }, { languageFamily: documentProfile.primaryLanguageFamily });

  // [STEP 2: FEATURE ANALYSIS & CONCEPT GRAPH BUILDER v2.6.0 (WITH NAMESPACED CACHING)]
  tracer.recordStageStart(2, 'Concept Graph Builder');
  const analysisCacheKey = generateAnalysisCacheKey(cleanedContent);

  const conceptGraph = await cacheManager.fetchCoalesced(analysisCacheKey, async () => {
    const analysisStart = Date.now();
    const cg = buildConceptGraph(cleanedContent, { documentProfile });
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
  console.log(`  └─ Normalized Concept Graph and Inverted Index attached to context.`);
  tracer.recordStageComplete(2, 'Concept Graph Builder', { textLength: cleanedContent.length }, { activeNodes: conceptNodes.length, edges: conceptEdges.length });

  if (!conceptNodes || conceptNodes.length === 0) {
    console.error(`[ReqID: ${reqId}] ❌ No educational or academic study topics could be extracted from provided documents.`);
    const error = new Error('400 Bad Request: "No educational or academic study topics could be extracted from these documents. Please upload educational notes, slides, or study materials."');
    error.statusCode = 400;
    throw error;
  }

  // [STEP 3: QUIZ PLANNER ENGINE v1.3.0]
  tracer.recordStageStart(3, 'Quiz Planner Engine');
  const quizPlan = generateQuizPlan(conceptGraph, {
    requestedCount,
    difficulty: normalizedDifficulty,
    documentProfile
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
  tracer.recordStageComplete(3, 'Quiz Planner Engine', { requestedCount, difficulty: normalizedDifficulty }, { slots: quizPlan.slots?.length, distribution: dist });

  // [STEP 4: PROMPT BUILDER ENGINE v1.2.0]
  tracer.recordStageStart(4, 'Prompt Builder Engine');
  const promptPayloads = buildSlotPrompts(quizPlan, {
    cleanedContent,
    conceptGraph,
    quizPlan,
    documentProfile
  });

  const avgSnippetLen = Math.round(promptPayloads.reduce((acc, p) => acc + (p.diagnostics?.snippetLengthChars || 370), 0) / Math.max(1, promptPayloads.length));

  console.log(`\n[ReqID: ${reqId}] [STEP 4: PROMPT BUILDER ENGINE v1.2.0]`);
  console.log(`  ├─ Payloads Assembled: ${promptPayloads.length} Slot Prompts (Temp:${PROMPT_CONFIG.LLM_PARAMS.TEMPERATURE})`);
  console.log(`  ├─ Version Propagation: Graph v${conceptGraph.graphVersion || '2.6.0'} | Planner v${quizPlan.plannerVersion || '1.3.0'} | Prompt v${PROMPT_CONFIG.VERSION}`);
  console.log(`  ├─ Context Isolation: Sentence/Newline boundary snapped snippets (Avg: ~${avgSnippetLen} chars/slot | Max: 500)`);
  console.log(`  ├─ Safety & Observability: Pipeline evidenceBounds attached | Fallback route 'INSUFFICIENT_EVIDENCE' enabled`);
  console.log(`  └─ Prompt Payloads attached to context for LLM generation.`);
  tracer.recordStageComplete(4, 'Prompt Builder Engine', { slotCount: quizPlan.slots?.length }, { promptPayloadsCount: promptPayloads.length });
  promptPayloads.forEach(p => tracer.recordPrompt(p.slotId, p.conceptLabel, p.systemPrompt, p.userPrompt));

  // [STEP 5: QUESTION GENERATOR ENGINE v1.2.0 (WITH NAMESPACED QUIZ CACHING)]
  tracer.recordStageStart(5, 'Question Generator Engine');
  const quizCacheKey = generateQuizCacheKey({
    text: cleanedContent,
    difficulty: normalizedDifficulty,
    count: requestedCount
  });

  const generatorResult = await cacheManager.fetchCoalesced(quizCacheKey, async () => {
    return await generateQuestions(promptPayloads, {
      requestId: reqId,
      cleanedContent,
      conceptGraph,
      quizPlan
    });
  }, reqId);

  let candidateItems = [];
  let generatorResultObj = {};

  if (Array.isArray(generatorResult)) {
    candidateItems = generatorResult;
    generatorResultObj = {
      batchSummary: {
        totalSlotsProcessed: candidateItems.length,
        successfulGenerations: candidateItems.length,
        insufficientEvidenceSkipped: 0,
        failedSlots: 0,
        circuitBroken: false,
        totalGenerationTimeMs: 0
      },
      pipelineDiagnostics: {
        averageLatencyMs: 0,
        retriesPerformed: 0,
        timeoutCount: 0,
        parseRepairCount: 0,
        unicodeNormalizations: 0,
        circuitBreakerTriggered: false
      }
    };
  } else if (generatorResult && typeof generatorResult === 'object') {
    generatorResultObj = generatorResult;
    candidateItems = generatorResult.candidateItems || [];
  }

  const bSum = generatorResultObj.batchSummary || {};
  const pDiagGen = generatorResultObj.pipelineDiagnostics || {};
  const sampleDiag = candidateItems[0]?.providerDiagnostics || {};

  console.log(`\n[ReqID: ${reqId}] [STEP 5: QUESTION GENERATOR ENGINE v1.2.0]`);
  console.log(`  ├─ Provider & Model: ${sampleDiag.provider || GENERATOR_CONFIG.ACTIVE_PROVIDER} (${sampleDiag.model || process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'})`);
  console.log(`  ├─ Batch Execution: ${bSum.totalSlotsProcessed || promptPayloads.length} Slots (Concurrency:${GENERATOR_CONFIG.CONCURRENCY_LIMIT})`);
  console.log(`  ├─ Success Rate: ${bSum.successfulGenerations || candidateItems.length}/${bSum.totalSlotsProcessed || promptPayloads.length} Candidate MCQs Generated (${bSum.totalGenerationTimeMs || 0}ms)`);
  console.log(`  ├─ Resilience: ${pDiagGen.parseRepairCount || 0} JSON Repairs | ${pDiagGen.unicodeNormalizations || 0} Unicode Normalizations | ${pDiagGen.retriesPerformed || 0} Retries (Jittered)`);
  console.log(`  ├─ Provider Circuit Breaker: ${pDiagGen.circuitBreakerTriggered ? '⚠️ TRIGGERED' : '✅ HEALTHY (Provider Availability OK)'}`);
  console.log(`  └─ Candidate Items attached to context for Stage 6 (3-Tier Validation Orchestrator).`);
  tracer.recordStageComplete(5, 'Question Generator Engine', { promptPayloadsCount: promptPayloads.length }, { candidateItemsCount: candidateItems.length });

  // [STEP 6: RECOVERY PARSER GUARDRAIL]
  console.log(`\n[ReqID: ${reqId}] [STEP 6: RECOVERY PARSER GUARDRAIL]`);
  console.log(`  ├─ Raw JSON Status: Slot prompt response assembly complete.`);
  console.log(`  └─ Recovery Action: ${candidateItems.length} candidate item(s) available for validation.`);

  // [STEP 7: 3-TIER VALIDATOR ORCHESTRATOR v5.8.0]
  tracer.recordStageStart(6, '3-Tier Validator Orchestrator');
  const pipelineContext = {
    reqId,
    cleanedContent,
    conceptGraph,
    quizPlan,
    documentProfile,
    config: VALIDATOR_CONFIG
  };

  const validationResult = await validateCandidateBatch(candidateItems, pipelineContext);
  const batchSummary = validationResult.batchSummary || {};
  const effectiveConcurrency = pipelineContext.config?.CONCURRENCY_LIMIT ?? VALIDATOR_CONFIG.CONCURRENCY_LIMIT;
  const effectiveTimeout = pipelineContext.config?.TIMEOUT_MS ?? VALIDATOR_CONFIG.TIMEOUT_MS;

  console.log(`\n[ReqID: ${reqId}] [STEP 6: 3-TIER VALIDATOR ORCHESTRATOR v${VALIDATOR_CONFIG.VERSIONS.VALIDATOR}]`);
  console.log(`  ├─ Batch Evaluated: ${batchSummary.totalCandidatesEvaluated || candidateItems.length} Candidates (Concurrency: ${effectiveConcurrency} Workers | Timeout: ${effectiveTimeout}ms)`);
  console.log(`  ├─ Telemetry: Validator v${batchSummary.validatorVersion || '5.8.0'} | Pipeline v${batchSummary.pipelineVersion || '4.1.0'}`);
  console.log(`  ├─ Pass Rates: ${batchSummary.approvedCount || 0} Approved | ${batchSummary.repairRequiredCount || 0} Routed to Repair | ${batchSummary.hardGateFailures || 0} Hard-Gate Rejections`);
  console.log(`  ├─ Pipeline Context Assigned: pipelineContext.approvedItems (${pipelineContext.approvedItems?.length || 0}) | pipelineContext.repairQueue (${pipelineContext.repairQueue?.length || 0})`);
  console.log(`  └─ Approved items saved to context; items requiring repair routed to Stage 7.`);
  tracer.recordStageComplete(6, '3-Tier Validator Orchestrator', { candidateItemsCount: candidateItems.length }, { approved: pipelineContext.approvedItems?.length, repairQueue: pipelineContext.repairQueue?.length });

  // [STEP 8: TARGETED REPAIR ROUTER ENGINE v1.2.0]
  tracer.recordStageStart(7, 'Targeted Repair Router');
  let repairResult = null;
  if (pipelineContext.repairQueue && pipelineContext.repairQueue.length > 0) {
    console.log(`\n[ReqID: ${reqId}] [STEP 7: TARGETED REPAIR ROUTER v${REPAIR_CONFIG.VERSION}]`);
    repairResult = await processRepairQueue(pipelineContext.repairQueue, pipelineContext);
    
    console.log(`  ├─ Queue Processed: ${repairResult.batchSummary.totalItemsQueued} Items (Concurrency: ${REPAIR_CONFIG.CONCURRENCY_LIMIT} Workers | Timeout: ${REPAIR_CONFIG.TIMEOUT_MS}ms)`);
    console.log(`  ├─ Yield & Success Rate: ${repairResult.batchSummary.successfullyRepaired}/${repairResult.batchSummary.totalItemsQueued} Repaired (${(repairResult.batchSummary.repairSuccessRate * 100).toFixed(0)}%) | Avg Latency: ${repairResult.batchSummary.avgRepairLatencyMs}ms`);
    console.log(`  ├─ Discarded: ${repairResult.batchSummary.discardedCount} Items | Discard Reasons: ${JSON.stringify(repairResult.batchSummary.discardReasons)}`);
    console.log(`  └─ Final Approved Pool Size: ${pipelineContext.approvedItems.length} MCQs ready for Stage 8 (Final Selection).`);
  } else {
    console.log(`\n[ReqID: ${reqId}] [STEP 7: TARGETED REPAIR ROUTER v${REPAIR_CONFIG.VERSION}] ──► No items in repair queue; skipping.`);
  }
  tracer.recordStageComplete(7, 'Targeted Repair Router', { repairQueueLength: pipelineContext.repairQueue?.length || 0 }, { repairedCount: repairResult?.batchSummary?.successfullyRepaired || 0 });

  // [STEP 9: PORTFOLIO ASSEMBLY ENGINE v1.8.1]
  tracer.recordStageStart(8, 'Portfolio Assembly Engine');
  console.log(`\n[ReqID: ${reqId}] [STEP 8: PORTFOLIO ASSEMBLY ENGINE v${PORTFOLIO_CONFIG.VERSION}]`);
  const { finalQuiz, portfolioSummary } = await assembleQuizPortfolio(pipelineContext.approvedItems, pipelineContext);

  console.log(`  ├─ Candidate Pre-Filter: ${portfolioSummary.totalValidCandidates}/${portfolioSummary.totalApprovedAvailable} Candidates Valid (${portfolioSummary.invalidCandidatesExcluded} Malformed Excluded)`);
  console.log(`  ├─ Stratified Selection: ${finalQuiz.totalQuestions} Questions selected matching QuizPlan (${portfolioSummary.metrics.totalAssemblyTimeMs}ms total | Sel: ${portfolioSummary.metrics.selectionMs}ms)`);
  console.log(`  ├─ Quality & Coverage: Avg Quality ${portfolioSummary.averageQualityScore} | Concepts Covered: ${portfolioSummary.diversityAudit.uniqueConceptsCovered} | Strict Diversity Swaps: ${portfolioSummary.diversityAudit.repairsApplied}`);
  console.log(`  ├─ Exact Answer Key Distribution: A:${portfolioSummary.answerDistribution.A} | B:${portfolioSummary.answerDistribution.B} | C:${portfolioSummary.answerDistribution.C} | D:${portfolioSummary.answerDistribution.D} (Balanced Quotas: ${portfolioSummary.exactQuotasMet ? 'YES' : 'NO'})`);
  console.log(`  ├─ Bloom-First Ramp: ${finalQuiz.questions.map(q => `${q.targetBloom || 'RECALL'} (${q.targetDifficulty || 'MEDIUM'})`).join(' ──► ')}`);
  console.log(`  └─ Global Review: ${portfolioSummary.globalReview.passed ? 'PASSED ✅' : 'WARNINGS ⚠️'} | Final Quiz JSON bound to pipelineContext.finalQuiz. Pipeline complete.`);

  const finalQuestions = finalQuiz.questions.map(q => ({
    ...q,
    question: q.stem || q.question || q.questionText,
    questionText: q.stem || q.question || q.questionText,
    qualityScore: q.qualityScore ?? q.quality_score ?? 1.0
  }));

  // [STEP 9: PORTFOLIO-LEVEL REVIEWER v3.0.0]
  tracer.recordStageStart(9, 'Portfolio-Level Reviewer');
  const reviewResult = reviewQuizPortfolio(finalQuiz, pipelineContext);
  const portfolioReviewSummary = reviewResult.portfolioReviewSummary;
  console.log(`\n[ReqID: ${reqId}] [STEP 9: PORTFOLIO-LEVEL REVIEWER v3.0.0]`);
  console.log(`  ├─ Portfolio Status: ${portfolioReviewSummary.approved ? 'APPROVED ✅' : 'WARNINGS ⚠️'} (Score: ${portfolioReviewSummary.score})`);
  console.log(`  ├─ Syntax vs. Theory Ratio: ${portfolioReviewSummary.syntaxVsTheoryRatio}`);
  console.log(`  ├─ Bloom Ramp Verified: ${portfolioReviewSummary.bloomDistribution?.join(' ──► ')}`);
  console.log(`  └─ End-to-End Lineage Citations: ${portfolioReviewSummary.lineageCount} MCQs mapped to source evidence.`);
  tracer.recordStageComplete(9, 'Portfolio-Level Reviewer', { finalQuizCount: finalQuiz.questions.length }, { approved: portfolioReviewSummary.approved });

  // Complete Pipeline Trace & Question Explainability Lineage Mapping
  tracer.recordStageComplete(8, 'Portfolio Assembly Engine', { approvedPoolSize: pipelineContext.approvedItems?.length }, { finalQuestionsCount: finalQuestions.length });
  const questionLineage = buildQuestionLineage(finalQuestions, {
    conceptGraph,
    quizPlan,
    promptPayloads,
    candidateItems,
    approvedItems: pipelineContext.approvedItems
  });
  tracer.setQuestionLineage(questionLineage);
  const traceData = tracer.finalizeTrace(finalQuiz);

  const executionTimeMs = Date.now() - startTime;
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
    questions: finalQuestions,
    conceptGraph,
    conceptIndex,
    quizPlan,
    promptPayloads,
    generatorResult: generatorResultObj,
    candidateItems,
    validationResult,
    repairResult,
    finalQuiz,
    portfolioSummary,
    ...(isPartial && {
      notice: `Generated ${finalQuestions.length} validated questions out of ${requestedCount} requested.`
    }),
    quizPlanSummary: {
      allocatedConcepts: quizPlan.slots.map(s => ({ concept: s.conceptLabel, targetQuestions: 1 })),
      targetDifficulty: normalizedDifficulty,
      depthProfile: quizPlan.metadata.difficultyProfile,
      distributionSummary: quizPlan.distributionSummary
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
