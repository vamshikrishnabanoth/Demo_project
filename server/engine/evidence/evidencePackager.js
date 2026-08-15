/**
 * server/engine/evidence/evidencePackager.js
 *
 * Assembles the Teaching Evidence Package from Session Content & RAG.
 * Applies Dual-Source Authority Division:
 * - Voice Authority -> Teaching Intent, Verbal Emphasis, Difficulty Expectations, Explicit Instructions.
 * - Structured Material Authority (Code/PPT/PDF/Image) -> Exact Factual Artifacts, Syntax Definitions, Formulas.
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

    // Build structured Evidence Package
    const packageData = {
      sessionId: sessionInputs.sessionId || 'session_' + Date.now(),
      authoritySummary: {
        voiceAuthority: 'Intent, Verbal Emphasis, Cognitive Expectations, Explicit Instructions',
        materialAuthority: 'Exact Syntax, Formulas, Code Logic, Tables, Diagrams'
      },
      voiceEmphasis: voiceEmphasisSignals,
      artifacts: exactArtifacts,
      ragChunksSummary: ragChunks.map(c => ({
        id: c.id,
        sourceType: c.sourceType,
        sourceId: c.sourceId,
        snippet: (c.content || '').substring(0, 150)
      })),
      unifiedRawContent: `[VOICE TRANSCRIPT]\n${voiceText}\n\n[DOCUMENT CONTENT]\n${docsText}\n\n[CODE SNIPPETS]\n${codeText}\n\n[BOARD OCR]\n${imageText}`
    };

    return packageData;
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
