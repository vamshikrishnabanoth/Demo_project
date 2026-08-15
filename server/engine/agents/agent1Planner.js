/**
 * server/engine/agents/agent1Planner.js
 *
 * AGENT 1: Teaching Understanding & Assessment Planner + TC Analysis.
 * Answers: "What did the teacher teach, emphasize, and expect students to understand?"
 * Outputs: AssessmentPlan with N primary targets + M reserve targets & TC Score Report.
 */

'use strict';

const llmRouter = require('../adapter/llmRouter');

class Agent1Planner {
  /**
   * Plan assessment targets from Teaching Evidence Package.
   * @param {Object} evidencePackage - Prepared Teaching Evidence Package
   * @param {String} requestedDifficulty - 'Easy' | 'Medium' | 'Hard' | 'Balanced'
   * @param {Number} requestedCount - Number of questions requested (N)
   * @returns {Object} AssessmentPlan containing targets, reserve targets, and TC Score
   */
  async planAssessment(evidencePackage, requestedDifficulty = 'Balanced', requestedCount = 5) {
    const rawContent = evidencePackage.unifiedRawContent || '';
    const voiceEmphasis = evidencePackage.voiceEmphasis || {};

    // Calculate TC Score & Coverage Report
    const tcScoreReport = this._computeTCScore(rawContent, voiceEmphasis);

    // Prepare system prompt for Agent 1 Planning
    const systemPrompt = `You are Agent 1: Academic Assessment Planner.
Your task is to analyze classroom teaching evidence and generate a structured AssessmentPlan.
Determine what was taught, calibrate difficulty relative to teaching depth, and output:
1. Subject & Topic Hierarchy
2. Calibrated Emphasis (Conceptual, Application, Syntax, Calculation)
3. Primary Assessment Targets (${requestedCount})
4. Reserve Assessment Targets (2-3 reserve targets for fallback replacement)

Output strictly valid JSON matching the AssessmentPlan schema.`;

    const userPrompt = `
[TEACHING EVIDENCE PACKAGE]
Voice Emphasis: Syntax=${voiceEmphasis.syntaxEmphasis}, Conceptual=${voiceEmphasis.conceptualEmphasis}
Explicit Instructions: ${(voiceEmphasis.explicitInstructions || []).join('; ')}
Requested Difficulty: ${requestedDifficulty}
Requested Question Count: ${requestedCount}

[SESSION CONTENT]
${rawContent.substring(0, 3000)}
`;

    let planData;
    try {
      const responseText = await llmRouter.complete({
        prompt: userPrompt,
        systemPrompt: systemPrompt,
        temperature: 0.2,
        model: 'llama-3.3-70b-versatile'
      });

      planData = JSON.parse(responseText);
    } catch (err) {
      console.warn(`⚠️ [Agent 1] LLM call failed or produced non-JSON. Falling back to deterministic plan builder: ${err.message}`);
      planData = this._buildFallbackPlan(evidencePackage, requestedDifficulty, requestedCount);
    }

    // Attach computed TC Score Report
    planData.tcScore = tcScoreReport;
    planData.requestedCount = requestedCount;

    return planData;
  }

  /** Compute Teaching Coverage (TC) Score and pedagogical feedback */
  _computeTCScore(rawContent, voiceEmphasis) {
    const wordCount = rawContent.split(/\s+/).length;
    let score = 70;

    if (wordCount > 500) score += 10;
    if (wordCount > 1500) score += 10;
    if (voiceEmphasis.conceptualEmphasis === 'HIGH') score += 5;

    score = Math.min(score, 98);

    return {
      overallScore: score,
      coverageDepth: score >= 85 ? 'Strong' : 'Moderate',
      analyzedPillars: {
        conceptualExplanations: score >= 80 ? 'Extensive' : 'Basic',
        artifactEvidence: rawContent.includes('function') || rawContent.includes('SELECT') ? 'Present' : 'General'
      },
      suggestions: [
        'Include one worked scenario application.',
        'Validate distractor plausibility across cognitive levels.'
      ]
    };
  }

  /** Deterministic fallback plan generator if LLM fails */
  _buildFallbackPlan(evidencePackage, requestedDifficulty, count) {
    const primaryTargets = [];
    const reserveTargets = [];

    const dimensions = ['Conceptual', 'Application', 'Scenario', 'Code Tracing', 'Calculation'];

    for (let i = 1; i <= count; i++) {
      const dim = dimensions[(i - 1) % dimensions.length];
      primaryTargets.push({
        targetId: `T0${i}`,
        concept: `Core Teaching Concept Part ${i}`,
        dimension: dim,
        cognitiveLevel: dim === 'Conceptual' ? 'Remember' : 'Apply',
        targetDifficulty: requestedDifficulty === 'Balanced' ? (i % 2 === 0 ? 'Medium' : 'Easy') : requestedDifficulty,
        evidenceType: dim === 'Code Tracing' ? 'CODE' : 'VOICE + DOCUMENT',
        requiresExactArtifact: dim === 'Code Tracing' || dim === 'Calculation',
        instruction: `Test student understanding of concept part ${i} via ${dim}.`,
        sourceChunks: ['chunk_01']
      });
    }

    // Reserve targets
    for (let r = 1; r <= 2; r++) {
      reserveTargets.push({
        targetId: `R0${r}`,
        concept: `Reserve Concept ${r}`,
        dimension: 'Application',
        cognitiveLevel: 'Analyze',
        targetDifficulty: 'Hard',
        evidenceType: 'VOICE + DOCUMENT',
        requiresExactArtifact: false,
        instruction: `Reserve target for fallback replacement ${r}.`,
        sourceChunks: ['chunk_reserve']
      });
    }

    return {
      subject: 'Computer Science Core',
      mainTopic: 'Classroom Lecture Topic',
      subtopics: ['Concept Overview', 'Application Examples'],
      teachingEmphasis: {
        conceptual: 'HIGH',
        application: 'HIGH',
        syntax: evidencePackage.voiceEmphasis?.syntaxEmphasis || 'MEDIUM',
        calculation: 'MEDIUM'
      },
      targetCount: count,
      assessmentTargets: primaryTargets,
      reserveTargets: reserveTargets
    };
  }
}

module.exports = new Agent1Planner();
