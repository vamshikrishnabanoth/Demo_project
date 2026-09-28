/**
 * server/engine/agents/agent3Evaluator.js
 *
 * AGENT 3: Academic Evaluator & Curriculum Auditor.
 * Mode 1: Question-Level Evaluation using the 5-Tier Derivability Model & Student Answerability.
 * Mode 2: Whole-Quiz Evaluation with Multi-Signal Redundancy and Evidence-Capacity-Aware Distribution.
 */

'use strict';

const llmRouter = require('../adapter/llmRouter');
const deterministicValidator = require('../validators/deterministicValidator');
const { safeParseJson } = require('../utils/jsonParser');
const { getTargetEvidenceContext } = require('../evidence/evidenceContextSelector');

class Agent3Evaluator {
  /**
   * Mode 1: Evaluate an individual candidate MCQ.
   * Classifies question across 5 Derivability Tiers and validates student answerability.
   */
  async evaluateQuestion(candidateMCQ, target, evidencePackage) {
    const evidenceDepth = evidencePackage.evidenceDepth || { rating: 'MODERATE', depthScore: 65 };

    const systemPrompt = `You are Agent 3: Academic Question Evaluator & Curriculum Auditor.
Evaluate the candidate MCQ against pedagogical quality and the 5-Tier Derivability Model.

5-TIER DERIVABILITY CLASSIFICATION:
1. "DIRECT_EVIDENCE": Explicitly stated in the session content.
2. "EVIDENCE_DERIVED": Logically derivable by a student who understood the taught principles, even if not phrased word-for-word.
3. "FOUNDATIONAL_PREREQUISITE": Minimal baseline prerequisite necessary to understand the topic (Acceptable ONLY IF student answerability is HIGH and relevant to session).
4. "RELATED_EXTENSION": Closely related application of taught concepts without introducing new un-taught specialized domain terms.
5. "UNSUPPORTED_FOREIGN": Requires un-taught external domain knowledge or represents completely unrelated topics (MUST BE REJECTED).

STUDENT-SESSION ANSWERABILITY CRITERION:
"Could a student who genuinely understood this session correctly answer this question using the concepts, examples, and reasoning taught?"

DIFFICULTY VALIDATION:
Teaching Depth is "${evidenceDepth.rating}" (Score: ${evidenceDepth.depthScore}/100).
- Is this question difficult because it requires deeper reasoning over taught material? (ACCEPT)
- Is this question difficult because it demands un-taught advanced algorithms / foreign knowledge? (REJECT)

Return strictly valid JSON matching this schema:
{
  "status": "PASS" or "FAIL",
  "tier": "DIRECT_EVIDENCE|EVIDENCE_DERIVED|FOUNDATIONAL_PREREQUISITE|RELATED_EXTENSION|UNSUPPORTED_FOREIGN",
  "studentAnswerability": "HIGH|MEDIUM|LOW",
  "failureReason": null or "...",
  "repairInstruction": null or "...",
  "groundingScore": 0.95
}`;

    const evidenceContext = getTargetEvidenceContext(target, evidencePackage, 2000);

    const userPrompt = `
[TARGET SPECIFICATION]
Concept: ${target.concept}
Subtopic: ${target.subtopic || 'Core Mechanism'}
Dimension: ${target.dimension}
Difficulty: ${target.targetDifficulty}

[CANDIDATE MCQ]
Question: ${candidateMCQ.questionText}
Options: ${JSON.stringify(candidateMCQ.options)}
Correct Answer: ${candidateMCQ.correctAnswer}

[SESSION EVIDENCE]
${evidenceContext}
`;

    try {
      const responseText = await llmRouter.complete({
        prompt: userPrompt,
        systemPrompt: systemPrompt,
        temperature: 0.1,
        model: process.env.AGENT3_MODEL || 'openai/gpt-oss-120b',
        sessionId: evidencePackage?.sessionId
      });

      const parsed = safeParseJson(responseText);

      if (!parsed || typeof parsed !== 'object' || !parsed.status) {
        throw new Error('AGENT3_MALFORMED_RESPONSE: Parsed JSON does not contain valid evaluation status');
      }

      parsed.verificationMethod = 'LLM_EVALUATION';
      parsed.isFallback = false;

      // Hard enforcement on unsupported foreign tier or low student answerability on foundational
      if (parsed.tier === 'UNSUPPORTED_FOREIGN') {
        parsed.status = 'FAIL';
        parsed.failureReason = parsed.failureReason || 'Question requires unsupported external domain knowledge';
      } else if (parsed.tier === 'FOUNDATIONAL_PREREQUISITE' && parsed.studentAnswerability === 'LOW') {
        parsed.status = 'FAIL';
        parsed.failureReason = 'Foundational prerequisite is too advanced or out-of-scope for this session';
      }

      return parsed;
    } catch (err) {
      console.warn(`⚠️ [Agent 3] LLM evaluation unavailable (${err.message}). Engaging deterministic grounding fallback.`);
      return this._deterministicGroundingFallback(candidateMCQ, target, evidenceContext, err.message);
    }
  }

  /**
   * Deterministic grounding check used strictly as a truthful fallback
   * when LLM evaluation is unavailable (e.g., timeout, rate-limit, network error).
   * Measures actual token overlap between candidate question/answer and retrieved evidence.
   */
  _deterministicGroundingFallback(candidateMCQ, target, evidenceText, errorReason) {
    // 1. Pre-check validation: malformed MCQs fail immediately
    const preCheck = deterministicValidator.runPreChecks(candidateMCQ);
    if (!preCheck.isValid) {
      return {
        status: 'FAIL',
        tier: 'UNSUPPORTED_FOREIGN',
        studentAnswerability: 'LOW',
        failureReason: `AGENT3_FALLBACK_FAIL: Pre-checks failed (${preCheck.errors.join('; ')}) after LLM evaluation failed (${errorReason})`,
        repairInstruction: 'Format question with exactly 4 distinct options and matching correctAnswer',
        groundingScore: 0.0,
        verificationMethod: 'UNAUDITED_HEURISTIC_FALLBACK',
        isFallback: true,
        auditNotice: `LLM evaluation failed (${errorReason}). Pre-checks rejected the candidate question.`
      };
    }

    const cleanEvidence = (evidenceText || '').toLowerCase();
    if (cleanEvidence.length < 20) {
      return {
        status: 'FAIL',
        tier: 'UNSUPPORTED_FOREIGN',
        studentAnswerability: 'LOW',
        failureReason: `AGENT3_FALLBACK_FAIL: Insufficient readable evidence context after LLM evaluation failed (${errorReason})`,
        repairInstruction: `Ensure evidence contains sufficient context for concept ${target?.concept || 'target'}`,
        groundingScore: 0.0,
        verificationMethod: 'UNAUDITED_HEURISTIC_FALLBACK',
        isFallback: true,
        auditNotice: `LLM evaluation failed (${errorReason}). Insufficient evidence context to verify grounding.`
      };
    }

    // 2. Extract content tokens (>3 chars, non-stopwords) from question, options, and target concept
    const stopwords = new Set([
      'which', 'what', 'where', 'when', 'after', 'before', 'during', 'should',
      'between', 'their', 'there', 'about', 'using', 'would', 'could', 'because',
      'primary', 'following', 'statement', 'correct', 'accurately', 'context',
      'system', 'program', 'process', 'result', 'inside', 'dataset', 'placed',
      'that', 'this', 'with', 'from', 'have', 'been', 'does', 'than', 'into'
    ]);

    const qText = (candidateMCQ.questionText || '').toLowerCase();
    const ansText = (candidateMCQ.correctAnswer || '').toLowerCase();

    const rawTokens = `${qText} ${ansText}`
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3 && !stopwords.has(w));

    const uniqueTokens = [...new Set(rawTokens)];

    if (uniqueTokens.length === 0) {
      return {
        status: 'FAIL',
        tier: 'UNSUPPORTED_FOREIGN',
        studentAnswerability: 'LOW',
        failureReason: `AGENT3_FALLBACK_FAIL: No assessable content terms found to evaluate grounding after LLM failure (${errorReason})`,
        repairInstruction: `Include concrete domain terms for ${target?.concept || 'concept'} in the question`,
        groundingScore: 0.0,
        verificationMethod: 'UNAUDITED_HEURISTIC_FALLBACK',
        isFallback: true,
        auditNotice: `LLM evaluation failed (${errorReason}). No assessable content tokens found.`
      };
    }

    // 3. Measure actual overlap against verifiable evidence text
    const matchedTokens = uniqueTokens.filter(t => cleanEvidence.includes(t));
    const matchRatio = Number((matchedTokens.length / uniqueTokens.length).toFixed(2));

    // Baseline grounding: requires at least 0.15 overlap and at least 1 matched token
    const isGrounded = matchRatio >= 0.15 && matchedTokens.length >= 1;

    if (!isGrounded) {
      return {
        status: 'FAIL',
        tier: 'UNSUPPORTED_FOREIGN',
        studentAnswerability: 'LOW',
        failureReason: `AGENT3_FALLBACK_FAIL: LLM evaluation failed (${errorReason}) and candidate MCQ has insufficient evidence overlap (${matchedTokens.length}/${uniqueTokens.length} terms matched, ${(matchRatio * 100).toFixed(0)}% < 15%)`,
        repairInstruction: `Ground question and answer strictly in session evidence for ${target?.concept || 'target'}`,
        groundingScore: matchRatio,
        verificationMethod: 'UNAUDITED_HEURISTIC_FALLBACK',
        isFallback: true,
        auditNotice: `LLM evaluation unavailable (${errorReason}). Deterministic fallback rejected question due to insufficient evidence overlap (${(matchRatio * 100).toFixed(0)}%).`
      };
    }

    return {
      status: 'PASS',
      tier: 'VERIFICATION_FALLBACK',
      studentAnswerability: 'MEDIUM',
      failureReason: null,
      repairInstruction: null,
      groundingScore: matchRatio,
      verificationMethod: 'UNAUDITED_HEURISTIC_FALLBACK',
      isFallback: true,
      auditNotice: `LLM evaluation unavailable (${errorReason}). Question passed via deterministic lexical evidence match (${matchedTokens.length}/${uniqueTokens.length} terms, ${(matchRatio * 100).toFixed(0)}% overlap).`
    };
  }

  /**
   * Mode 2: Quiz-Level Evaluation across the aggregated set of passing MCQs.
   * Evaluates cognitive distribution, subtopic capacity, and multi-factor redundancy.
   */
  evaluateQuizSet(quizQuestions = [], plan = {}) {
    const count = quizQuestions.length;
    const requestedCount = plan.requestedCount || plan.targetCount || count;

    // 1. Cognitive Distribution
    const cognitiveDistribution = {};
    quizQuestions.forEach(q => {
      const dim = q.metadata?.dimension || 'Conceptual';
      cognitiveDistribution[dim] = (cognitiveDistribution[dim] || 0) + 1;
    });

    // 2. Concept / Subtopic Distribution
    const conceptDistribution = {};
    quizQuestions.forEach(q => {
      const subtopic = q.metadata?.subtopic || q.metadata?.concept || 'Core Concept';
      conceptDistribution[subtopic] = (conceptDistribution[subtopic] || 0) + 1;
    });

    // 3. Derivability Tier Breakdown
    const derivabilityTiers = {
      DIRECT_EVIDENCE: 0,
      EVIDENCE_DERIVED: 0,
      FOUNDATIONAL_PREREQUISITE: 0,
      RELATED_EXTENSION: 0,
      VERIFICATION_FALLBACK: 0
    };
    quizQuestions.forEach(q => {
      const tier = q.metadata?.tier || 'EVIDENCE_DERIVED';
      if (derivabilityTiers[tier] !== undefined) {
        derivabilityTiers[tier]++;
      } else {
        derivabilityTiers.EVIDENCE_DERIVED++;
      }
    });

    // 4. Multi-Factor Pedagogical Redundancy Matrix
    const redundancyAnalysis = deterministicValidator.computeRedundancyMatrix(quizQuestions);

    // 5. Context-Aware Concentration Assessment (Adaptive to available subtopics)
    const availableSubtopicsCount = Object.keys(conceptDistribution).length;
    let topClusterName = null;
    let topClusterCount = 0;

    Object.entries(conceptDistribution).forEach(([name, num]) => {
      if (num > topClusterCount) {
        topClusterCount = num;
        topClusterName = name;
      }
    });

    // If available subtopics >= 4, flag if a single cluster exceeds 40% of total
    const hasConcentrationWarning = availableSubtopicsCount >= 4 && topClusterCount > Math.max(2, Math.floor(count * 0.40));
    const hasTrueRedundancy = redundancyAnalysis.totalRedundantPairs > 0;

    let quizQualityStatus = 'QUALITY_PASSED';
    let concentrationWarning = null;
    let suggestion = null;

    if (hasConcentrationWarning) {
      const percent = Math.round((topClusterCount / count) * 100);
      concentrationWarning = `Cluster concentration notice: "${topClusterName}" accounts for ${topClusterCount}/${count} questions (${percent}%).`;
      suggestion = `Consider expanding questions across other available subtopics if broader coverage is desired.`;
    }

    if (hasTrueRedundancy) {
      quizQualityStatus = 'NEEDS_REFINEMENT';
      concentrationWarning = `Pedagogical redundancy detected: ${redundancyAnalysis.totalRedundantPairs} question pairs test identical cognitive operations with high similarity.`;
      suggestion = `Replace redundant questions with alternative cognitive dimensions.`;
    }

    const uniqueDims = Object.keys(cognitiveDistribution).length;
    const isBalanced = uniqueDims >= Math.min(2, count) && quizQualityStatus === 'QUALITY_PASSED';

    return {
      quizQualityStatus,
      isBalanced,
      totalQuestions: count,
      requestedCount,
      uniqueDimensionsCount: uniqueDims,
      cognitiveDistribution,
      conceptDistribution,
      derivabilityTiers,
      redundancy: {
        totalRedundantPairs: redundancyAnalysis.totalRedundantPairs,
        highSimilarityPairs: redundancyAnalysis.highSimilarityPairs
      },
      concentrationWarning,
      suggestion,
      coverageScore: count >= requestedCount ? 100 : Math.round((count / requestedCount) * 100),
      recommendations: suggestion ? [suggestion] : []
    };
  }
}

module.exports = new Agent3Evaluator();
