/**
 * server/engine/evidence/evidencePackager.js
 *
 * Assembles the Teaching Evidence Package from Session Content & RAG.
 * Applies Dual-Source Authority Division:
 * - Voice Authority -> Teaching Intent, Verbal Emphasis, Difficulty Expectations, Explicit Instructions.
 * - Structured Material Authority (Code/PPT/PDF/Image) -> Exact Factual Artifacts, Syntax Definitions, Formulas.
 * - Multi-Signal Evidence Depth Score (Concepts, Explanations, Relations, Examples, Procedures, Artifacts).
 * - Evidence Capacity Estimator (Direct, Inferable, Foundational, Extension).
 * - Hard Zero Weight Enforcement.
 */

'use strict';

class EvidencePackager {
  /**
   * Package unified content into a structured Teaching Evidence Package.
   * @param {Object} sessionInputs - { voiceTranscript, documentTexts, codeSnippets, imageTexts }
   * @param {Array} ragChunks - Session RAG retrieved chunks
   * @returns {Object} Teaching Evidence Package
   */
  packageSessionEvidence(sessionInputs = {}, ragChunks = []) {
    const voiceText = sessionInputs.voiceTranscript || '';
    const docsText = (sessionInputs.documentTexts || []).join('\n');
    const codeText = sessionInputs.codeSnippets || '';
    const imageText = (sessionInputs.imageTexts || []).join('\n');

    // Extract verbal emphasis cues from Voice
    const voiceEmphasisSignals = this._extractVoiceEmphasis(voiceText);

    // Extract exact artifacts from Code / PPT / PDF / Board Images
    const exactArtifacts = this._extractExactArtifacts(codeText, docsText, imageText);

    const rawContent = `[VOICE TRANSCRIPT]\n${voiceText}\n\n[DOCUMENT CONTENT]\n${docsText}\n\n[CODE SNIPPETS]\n${codeText}\n\n[BOARD OCR]\n${imageText}`;

    // 1. Multi-Signal Evidence Depth Assessment
    const evidenceDepth = this._calculateMultiSignalDepth(rawContent, voiceEmphasisSignals, exactArtifacts);

    // 2. Evidence-Supported Question Capacity Estimation
    const evidenceCapacity = this._estimateQuestionCapacity(evidenceDepth, rawContent);

    // 3. Evidence-driven category weights with strict Hard Zero enforcement
    const categoryWeights = this._computeCategoryWeights(exactArtifacts, voiceEmphasisSignals, rawContent);

    // Build structured Evidence Package
    const packageData = {
      sessionId: sessionInputs.sessionId || 'session_' + Date.now(),
      authoritySummary: {
        voiceAuthority: 'Intent, Verbal Emphasis, Cognitive Expectations, Explicit Instructions',
        materialAuthority: 'Exact Syntax, Formulas, Code Logic, Tables, Diagrams'
      },
      voiceEmphasis: voiceEmphasisSignals,
      artifacts: exactArtifacts,
      evidenceDepth: evidenceDepth,
      evidenceCapacity: evidenceCapacity,
      categoryWeights: categoryWeights,
      ragChunksSummary: ragChunks.map(c => ({
        id: c.id,
        sourceType: c.sourceType,
        sourceId: c.sourceId,
        snippet: (c.content || '').substring(0, 150)
      })),
      unifiedRawContent: rawContent
    };

    return packageData;
  }

  /**
   * Multi-Signal Evidence Depth Calculation (Not relying on word count alone).
   * Evaluates: Concepts, Explanations, Relations, Examples, Procedures, Artifacts, Length.
   */
  _calculateMultiSignalDepth(rawContent, voiceSignals, artifacts) {
    const contentLower = rawContent.toLowerCase();
    const words = rawContent.trim().split(/\s+/).length;

    // Signal 1: Concepts & Key Terms (0 - 25 pts)
    const technicalKeywords = [
      'interrupt', 'pipeline', 'aggregation', 'schema', 'register', 'stack', 'instruction',
      'vector', 'routine', 'handler', 'memory', 'cpu', 'processor', 'asynchronous', 'polling',
      'query', 'index', 'document', 'database', 'node', 'tree', 'function', 'class', 'method'
    ];
    const techMatches = technicalKeywords.filter(kw => contentLower.includes(kw)).length;
    const conceptScore = Math.min(25, Math.max(5, (techMatches * 3) + (words > 80 ? 6 : 2)));

    // Signal 2: Explanation Richness (0 - 20 pts)
    const explanationKeywords = ['because', 'therefore', 'which means', 'in order to', 'allows', 'enables', 'reason', 'why', 'how', 'purpose'];
    const explanationMatches = explanationKeywords.filter(kw => contentLower.includes(kw)).length;
    const explanationScore = Math.min(20, Math.max(3, explanationMatches * 3.5));

    // Signal 3: Relationships & Cause-Effect (0 - 15 pts)
    const relationKeywords = ['causes', 'leads to', 'compared to', 'instead of', 'triggers', 'initiates', 'results in', 'affects', 'depends on'];
    const relationMatches = relationKeywords.filter(kw => contentLower.includes(kw)).length;
    const relationScore = Math.min(15, Math.max(2, relationMatches * 3.5));

    // Signal 4: Examples & Scenarios (0 - 15 pts)
    const exampleKeywords = ['for example', 'for instance', 'consider', 'suppose', 'case where', 'scenario', 'such as', 'like when', 'while'];
    const exampleMatches = exampleKeywords.filter(kw => contentLower.includes(kw)).length;
    const exampleScore = Math.min(15, Math.max(2, exampleMatches * 3.5));

    // Signal 5: Procedures & Steps (0 - 10 pts)
    const stepKeywords = ['first', 'second', 'then', 'after', 'before', 'finally', 'step', 'phase', 'sequence', 'resumes', 'finishes', 'saves', 'loads'];
    const stepMatches = stepKeywords.filter(kw => contentLower.includes(kw)).length;
    const procedureScore = Math.min(10, Math.max(2, stepMatches * 2));

    // Signal 6: Artifacts & Code/Formulas (0 - 15 pts)
    let artifactScore = 0;
    if (artifacts && artifacts.hasCode) artifactScore += 8;
    if (artifacts && artifacts.formulasDetected && artifacts.formulasDetected.length > 0) artifactScore += 7;

    const totalDepthScore = Math.min(100, Math.round(conceptScore + explanationScore + relationScore + exampleScore + procedureScore + artifactScore));

    let rating = 'MODERATE';
    if (totalDepthScore < 45) rating = 'SHALLOW';
    else if (totalDepthScore >= 75) rating = 'DEEP';

    return {
      depthScore: totalDepthScore,
      rating: rating,
      breakdown: {
        concepts: `${conceptScore}/25`,
        explanations: `${explanationScore}/20`,
        relationships: `${relationScore}/15`,
        examples: `${exampleScore}/15`,
        procedures: `${procedureScore}/10`,
        artifacts: `${artifactScore}/15`
      },
      maxLegitimateDifficulty: rating === 'SHALLOW' ? 'Medium' : (rating === 'DEEP' ? 'Hard' : 'Medium')
    };
  }

  /**
   * Estimate Legitimate Question Capacity across Derivability Tiers.
   */
  _estimateQuestionCapacity(evidenceDepth, rawContent) {
    const score = evidenceDepth.depthScore;
    
    let directCap = Math.max(3, Math.floor(score * 0.20));
    let inferableCap = Math.max(3, Math.floor(score * 0.18));
    let foundationalCap = Math.max(2, Math.floor(score * 0.10));
    let extensionCap = Math.max(2, Math.floor(score * 0.08));

    const totalLegitimateCapacity = directCap + inferableCap + foundationalCap + extensionCap;

    return {
      direct: directCap,
      inferable: inferableCap,
      foundational: foundationalCap,
      extension: extensionCap,
      totalCapacity: totalLegitimateCapacity
    };
  }

  /**
   * Strictly enforce Hard Zero and compute dynamic category weights based on session evidence.
   */
  _computeCategoryWeights(artifacts, voiceSignals, rawContent) {
    const weights = {
      CONCEPTS_AND_DEFINITIONS: 0.35,
      COMPARISONS_AND_TRADEOFFS: 0.25,
      CASE_STUDIES_AND_SCENARIOS: 0.40,
      FORMULAS_AND_CALCULATIONS: 0.0,
      PRACTICAL_AND_LAB_TASKS: 0.0
    };

    // 1. Hard Zero for Formulas & Calculations
    if (artifacts.formulasDetected && artifacts.formulasDetected.length > 0) {
      weights.FORMULAS_AND_CALCULATIONS = 0.20;
    } else {
      weights.FORMULAS_AND_CALCULATIONS = 0.0; // STRICT HARD ZERO
    }

    // 2. Hard Zero for Practical & Lab Tasks if no code / lab steps exist
    const hasLabSteps = rawContent.toLowerCase().includes('lab task') || rawContent.toLowerCase().includes('terminal command');
    if (artifacts.hasCode || hasLabSteps) {
      weights.PRACTICAL_AND_LAB_TASKS = 0.20;
    } else {
      weights.PRACTICAL_AND_LAB_TASKS = 0.0; // STRICT HARD ZERO
    }

    // 3. Renormalize active non-zero weights so they sum to exactly 1.0 (100%)
    const activeKeys = Object.keys(weights).filter(k => weights[k] > 0);
    const currentSum = activeKeys.reduce((sum, k) => sum + weights[k], 0);

    if (currentSum > 0) {
      activeKeys.forEach(k => {
        weights[k] = Number((weights[k] / currentSum).toFixed(3));
      });
    }

    return weights;
  }

  /** Extract verbal emphasis signals from Voice transcript */
  _extractVoiceEmphasis(voiceText) {
    const signals = {
      syntaxEmphasis: 'MEDIUM',
      conceptualEmphasis: 'HIGH',
      explicitInstructions: [],
      perceivedDifficultyCues: 'BALANCED'
    };

    const textLower = voiceText.toLowerCase();

    if (textLower.includes("don't worry about syntax") || textLower.includes("ignore syntax")) {
      signals.syntaxEmphasis = 'LOW';
      signals.explicitInstructions.push("De-emphasize syntax questions.");
    } else if (textLower.includes("remember the syntax") || textLower.includes("must write the query")) {
      signals.syntaxEmphasis = 'HIGH';
      signals.explicitInstructions.push("Elevate syntax and query construction emphasis.");
    }

    if (textLower.includes("focus on application") || textLower.includes("solve the problem")) {
      signals.conceptualEmphasis = 'HIGH';
    }

    return signals;
  }

  /** Extract exact code, formulas, and artifacts */
  _extractExactArtifacts(codeText, docsText, imageText) {
    const artifacts = {
      hasCode: Boolean(codeText && codeText.trim().length > 0),
      codeSnippets: codeText ? [codeText] : [],
      formulasDetected: [],
      keyTerms: []
    };

    const combined = `${docsText} ${imageText}`;
    const formulaMatches = combined.match(/([A-Za-z0-9_]+\s*=\s*[^.\n]+)/g);
    if (formulaMatches) {
      artifacts.formulasDetected = formulaMatches.slice(0, 5);
    }

    return artifacts;
  }
}

module.exports = new EvidencePackager();
