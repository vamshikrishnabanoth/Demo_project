/**
 * server/engine/evidence/evidencePackager.js
 *
 * Assembles the Teaching Evidence Package from Session Content & RAG.
 * Applies Dual-Source Authority Division:
 * - Voice Authority -> Teaching Intent, Verbal Emphasis, Cognitive Expectations, Explicit Instructions.
 * - Material Authority -> Exact Factual Artifacts, Syntax Definitions, Formulas.
 * - Integrates DepthAnalyzer for Lecture Depth & Academic Verification.
 * - Strict Hard Zero Category Enforcement.
 */

'use strict';

const depthAnalyzer = require('./depthAnalyzer');
const { HierarchicalChunker } = require('./hierarchicalChunker');
const { CrossMaterialAligner } = require('./crossMaterialAligner');

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
    // Extract exact artifacts from Code / PPT / PDF / Board Images
    const exactArtifacts = this._extractExactArtifacts(codeText, docsText, imageText);

    const rawContent = `[VOICE TRANSCRIPT]\n${voiceText}\n\n[DOCUMENT CONTENT]\n${docsText}\n\n[CODE SNIPPETS]\n${codeText}\n\n[BOARD OCR]\n${imageText}`;

    // 1. Pedagogical Lecture Depth & Academic Content Analysis
    const depthAnalysis = depthAnalyzer.analyzeLecture(rawContent);

    // Extract verbal emphasis cues from Voice and Pedagogical segments
    const voiceEmphasisSignals = this._extractVoiceEmphasis(voiceText, depthAnalysis.pedagogicalSegments);

    // 2. Evidence-driven category weights with strict Hard Zero enforcement
    const categoryWeights = this._computeCategoryWeights(exactArtifacts, voiceEmphasisSignals, rawContent);

    // Filtered curricular content for downstream question planning
    // Instructional evidence is strictly isolated from motivational/pedagogical and administrative speech
    const curricularContent = (depthAnalysis.isAcademic && depthAnalysis.curricularSegments && depthAnalysis.curricularSegments.length > 0)
      ? depthAnalysis.curricularSegments.map(s => s.text).join('\n')
      : (depthAnalysis.isAcademic ? rawContent : '');

    // Build structured Evidence Package
    const packageData = {
      sessionId: sessionInputs.sessionId || 'session_' + Date.now(),
      authoritySummary: {
        voiceAuthority: 'Intent, Verbal Emphasis, Cognitive Expectations, Explicit Instructions',
        materialAuthority: 'Exact Syntax, Formulas, Code Logic, Tables, Diagrams'
      },
      voiceEmphasis: voiceEmphasisSignals,
      artifacts: exactArtifacts,
      isAcademic: depthAnalysis.isAcademic,
      isCurricular: depthAnalysis.isCurricular,
      academicFailureReason: depthAnalysis.reason,
      lectureDepth: depthAnalysis.lectureDepth,
      detectedFocus: depthAnalysis.detectedFocus,
      curricularSegments: depthAnalysis.curricularSegments || [],
      pedagogicalSegments: depthAnalysis.pedagogicalSegments || [],
      adminSegments: depthAnalysis.adminSegments || [],
      curricularContent,
      categoryWeights: categoryWeights,
      ragChunksSummary: ragChunks.map(c => ({
        id: c.id,
        sourceType: c.sourceType,
        sourceId: c.sourceId,
        snippet: (c.content || '').substring(0, 150)
      })),
      unifiedRawContent: rawContent
    };

    // 3. Construct Dual-Level Hierarchical Evidence Store & Cross-Material Alignment Graph
    try {
      packageData.hierarchicalStore = HierarchicalChunker.buildStore(sessionInputs);
      packageData.alignmentGraph = CrossMaterialAligner.buildAlignmentGraph(packageData.hierarchicalStore);
    } catch (storeErr) {
      console.warn(`⚠️ [EvidencePackager] Notice building hierarchical/alignment store: ${storeErr.message}`);
      packageData.hierarchicalStore = null;
      packageData.alignmentGraph = {};
    }

    return packageData;
  }

  /**
   * Partition assessable curricular content according to the router's representation decision.
   * - SUMMARY: Focuses on factual concepts, definitions, and exact artifacts (WHAT was taught).
   * - BLUEPRINT: Focuses on instructional acts, demonstrative observations, rules, mechanisms, and comparisons (HOW & WHY it was taught).
   * - UNIFIED: Synthesizes both factual definitions and instructional blueprints together.
   */
  applyRepresentationPackaging(packageData, representationMode = 'UNIFIED') {
    if (!packageData || !packageData.curricularSegments) return packageData;

    const segments = packageData.curricularSegments || [];
    const artifacts = packageData.artifacts || {};
    const mode = (representationMode || 'UNIFIED').toUpperCase();

    let selectedText = '';
    const formulaLines = (artifacts.formulasDetected || []).map(f => `[FORMULA/SYNTAX]: ${f}`).join('\n');
    const codeLines = (artifacts.codeSnippets || []).map(c => `[CODE ARTIFACT]:\n${c}`).join('\n');
    const artifactBlock = [formulaLines, codeLines].filter(Boolean).join('\n');

    if (mode === 'SUMMARY') {
      const summarySegs = segments.filter(s => s.classification?.substanceType === 'DEFINITION_OR_FACT');
      const textSegs = (summarySegs.length >= 3 ? summarySegs : segments).map(s => s.text).join('\n');
      selectedText = `--- TECHNICAL SUMMARY: CONCEPTS, DEFINITIONS & ARTIFACTS (WHAT WAS TAUGHT) ---\n${textSegs}`;
      if (artifactBlock) {
        selectedText += `\n\n--- EXACT ARTIFACTS ---\n${artifactBlock}`;
      }
    } else if (mode === 'BLUEPRINT') {
      const blueprintSegs = segments.filter(s => {
        const st = s.classification?.substanceType;
        return ['OBSERVATION_DEMONSTRATION', 'RULE_OR_CONDITION', 'COMPARISON', 'WORKED_EXAMPLE', 'SOCRATIC_INSTRUCTION', 'MECHANISM'].includes(st);
      });
      const textSegs = (blueprintSegs.length >= 3 ? blueprintSegs : segments).map(s => s.text).join('\n');
      selectedText = `--- INSTRUCTIONAL BLUEPRINT: PEDAGOGICAL INTENT & TEACHER EMPHASIS (HOW & WHY IT WAS TAUGHT) ---\n${textSegs}`;
    } else { // UNIFIED
      const allText = segments.map(s => s.text).join('\n');
      selectedText = `--- UNIFIED REPRESENTATION: CURRICULAR CONTENT + PEDAGOGICAL BLUEPRINT ---\n${allText}`;
      if (artifactBlock) {
        selectedText += `\n\n--- EXACT ARTIFACTS ---\n${artifactBlock}`;
      }
    }

    packageData.curricularContent = selectedText;
    packageData.representationMode = mode;
    return packageData;
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

  /** Extract verbal emphasis signals from Voice transcript & pedagogical segments */
  _extractVoiceEmphasis(voiceText = '', pedagogicalSegments = []) {
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

    // Process instructional intent from pedagogical segments
    if (pedagogicalSegments && pedagogicalSegments.length > 0) {
      for (const seg of pedagogicalSegments) {
        const segLower = (seg.text || seg || '').toLowerCase();
        if (segLower.includes('interview') || segLower.includes('exam')) {
          signals.explicitInstructions.push('Instructional emphasis: concept is critical for technical assessment / interviews.');
        }
        if (segLower.includes('practice') || segLower.includes('takes time')) {
          signals.explicitInstructions.push('Instructional reassurance: reinforce core conceptual mechanics.');
        }
      }
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
