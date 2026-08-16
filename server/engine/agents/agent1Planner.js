/**
 * server/engine/agents/agent1Planner.js
 *
 * AGENT 1: Assessment Planner & Curriculum Strategist.
 * - Extracts natural subtopics supported by evidence (no artificial caps).
 * - Calibrates target difficulty against evidence teaching depth.
 * - Allocates targets across distinct cognitive dimensions and derivability tiers.
 * - Generates Primary Targets ($N$) and Reserve Pool ($M$).
 */

'use strict';

const llmRouter = require('../adapter/llmRouter');

class Agent1Planner {
  /**
   * Plan Assessment targets and calculate TC Score.
   * @param {Object} evidencePackage - Session evidence package from EvidencePackager
   * @param {String} requestedDifficulty - 'Easy' | 'Medium' | 'Hard' | 'Balanced'
   * @param {Number} requestedCount - Number of questions requested
   * @returns {Object} AssessmentPlan JSON payload
   */
  async planAssessment(evidencePackage, requestedDifficulty = 'Medium', requestedCount = 5) {
    const rawContent = evidencePackage.unifiedRawContent || '';
    const voiceEmphasis = evidencePackage.voiceEmphasis || {};
    const categoryWeights = evidencePackage.categoryWeights || {};
    const evidenceDepth = evidencePackage.evidenceDepth || { depthScore: 65, rating: 'MODERATE', maxLegitimateDifficulty: 'Medium' };
    const capacity = evidencePackage.evidenceCapacity || { totalCapacity: 20 };

    // 1. Calculate TC (Teaching Coverage) Score
    const tcScoreReport = this._computeTCScore(rawContent, voiceEmphasis, evidenceDepth);

    // 2. Build prompt for Agent 1 Planning
    const systemPrompt = `You are Agent 1: Assessment Planner & Curriculum Strategist.
Analyze the session evidence and generate an Assessment Plan in valid JSON format.
You must plan ${requestedCount} primary assessment targets AND ${Math.max(1, Math.ceil(requestedCount * 0.3))} pre-generated reserve targets.

POLICY GUIDELINES:
1. NATURAL SUBTOPIC EXTRACTION: Extract ALL distinct, assessable subtopics actually supported by the session content. Do NOT artificially cap or force an arbitrary count.
2. DIVERSITY VIA COGNITIVE OPERATIONS: When the requested question count (${requestedCount}) exceeds the number of subtopics, diversify across cognitive operations:
   - "Conceptual": Core definitions & fundamental mechanism principles.
   - "Scenario Analysis": Applied problem scenarios in context.
   - "Comparison/Tradeoff": Contrasting alternatives (e.g. Interrupts vs Polling, or Stage A vs Stage B).
   - "Application": Concrete use-case implementation or configuration.
   - "Flow/Trace": Step-by-step execution sequencing, register/state saving.
   - "Foundational Prerequisite": Essential baseline domain facts (only if directly relevant to understanding the session).
3. DEPTH-CALIBRATED DIFFICULTY: The evidence teaching depth is "${evidenceDepth.rating}" (Score: ${evidenceDepth.depthScore}/100).
   - Calibrate questions to legitimate teaching depth.
   - Do NOT introduce un-taught advanced algorithms if teaching depth is Shallow.

JSON SCHEMA:
{
  "subject": "string",
  "mainTopic": "string",
  "subtopics": ["all distinct subtopics extracted from evidence"],
  "teachingEmphasis": {
    "conceptual": "HIGH|MEDIUM|LOW",
    "application": "HIGH|MEDIUM|LOW",
    "syntax": "HIGH|MEDIUM|LOW",
    "calculation": "HIGH|MEDIUM|LOW"
  },
  "targetCount": ${requestedCount},
  "assessmentTargets": [
    {
      "targetId": "T01",
      "subtopic": "...",
      "concept": "Specific, unique learning objective",
      "dimension": "Conceptual|Scenario Analysis|Comparison/Tradeoff|Application|Flow/Trace|Foundational Prerequisite",
      "cognitiveLevel": "Remember|Understand|Apply|Analyze|Evaluate",
      "targetDifficulty": "Easy|Medium|Hard",
      "evidenceType": "VOICE|CODE|DOCUMENT|VOICE + DOCUMENT",
      "sourceChunks": ["chunk_01"],
      "requiresExactArtifact": false,
      "instruction": "Guidance for question generation"
    }
  ],
  "reserveTargets": [
    {
      "targetId": "R01",
      "subtopic": "...",
      "concept": "Distinct fallback concept",
      "dimension": "...",
      "cognitiveLevel": "...",
      "targetDifficulty": "...",
      "evidenceType": "...",
      "sourceChunks": ["chunk_02"],
      "requiresExactArtifact": false,
      "instruction": "..."
    }
  ]
}`;

    const userPrompt = `
[TEACHING EVIDENCE PACKAGE]
Evidence Depth Rating: ${evidenceDepth.rating} (Score: ${evidenceDepth.depthScore}/100)
Evidence Capacity: ${capacity.totalCapacity} legitimate questions
Voice Emphasis: Syntax=${voiceEmphasis.syntaxEmphasis}, Conceptual=${voiceEmphasis.conceptualEmphasis}
Explicit Instructions: ${(voiceEmphasis.explicitInstructions || []).join('; ')}
Evidence-Driven Category Weights: ${JSON.stringify(categoryWeights)}
Requested Difficulty: ${requestedDifficulty}
Requested Question Count: ${requestedCount}

[SESSION CONTENT]
${rawContent.substring(0, 3500)}
`;

    let planData;
    try {
      const responseText = await llmRouter.complete({
        prompt: userPrompt,
        systemPrompt: systemPrompt,
        temperature: 0.2,
        model: 'llama-3.3-70b-versatile'
      });

      let parsed = JSON.parse(responseText);
      if (parsed.assessmentPlan) parsed = parsed.assessmentPlan;
      if (parsed.plan) parsed = parsed.plan;

      const rawTargets = Array.isArray(parsed.assessmentTargets) 
        ? parsed.assessmentTargets 
        : (Array.isArray(parsed.assessment_targets) ? parsed.assessment_targets : (Array.isArray(parsed.targets) ? parsed.targets : []));

      const rawReserve = Array.isArray(parsed.reserveTargets) 
        ? parsed.reserveTargets 
        : (Array.isArray(parsed.reserve_targets) ? parsed.reserve_targets : []);

      if (rawTargets.length === 0) {
        throw new Error('No assessment targets found in LLM response');
      }

      planData = {
        subject: parsed.subject || 'Computer Science',
        mainTopic: parsed.mainTopic || parsed.topic || 'Core Lecture Topic',
        subtopics: parsed.subtopics || [],
        teachingEmphasis: parsed.teachingEmphasis || { conceptual: 'HIGH', application: 'HIGH', syntax: 'MEDIUM', calculation: 'LOW' },
        targetCount: parsed.targetCount || requestedCount,
        categoryWeights: categoryWeights,
        evidenceDepth: evidenceDepth,
        evidenceCapacity: capacity,
        assessmentTargets: rawTargets.map((t, idx) => ({
          targetId: t.targetId || `T0${idx + 1}`,
          subtopic: t.subtopic || parsed.subtopics[idx % (parsed.subtopics.length || 1)] || 'General Concept',
          concept: t.concept || 'Core Concept',
          dimension: t.dimension || 'Conceptual',
          cognitiveLevel: t.cognitiveLevel || 'Understand',
          targetDifficulty: t.targetDifficulty || requestedDifficulty,
          evidenceType: t.evidenceType || 'VOICE + DOCUMENT',
          sourceChunks: t.sourceChunks || ['chunk_01'],
          requiresExactArtifact: Boolean(t.requiresExactArtifact),
          instruction: t.instruction || 'Test understanding of the concept.'
        })),
        reserveTargets: rawReserve.map((r, idx) => ({
          targetId: r.targetId || `R0${idx + 1}`,
          subtopic: r.subtopic || 'Reserve Subtopic',
          concept: r.concept || 'Reserve Concept',
          dimension: r.dimension || 'Application',
          cognitiveLevel: r.cognitiveLevel || 'Apply',
          targetDifficulty: r.targetDifficulty || requestedDifficulty,
          evidenceType: r.evidenceType || 'DOCUMENT',
          sourceChunks: r.sourceChunks || ['chunk_02'],
          requiresExactArtifact: Boolean(r.requiresExactArtifact),
          instruction: r.instruction || 'Test application of reserve concept.'
        }))
      };
    } catch (err) {
      console.warn(`⚠️ [Agent 1 Planner] LLM call failed: ${err.message}. Using fallback plan.`);
      planData = this._buildFallbackPlan(rawContent, requestedDifficulty, requestedCount, categoryWeights, evidenceDepth, capacity);
    }

    planData.tcScore = tcScoreReport;
    return planData;
  }

  _computeTCScore(rawContent, voiceEmphasis, evidenceDepth) {
    const depthScore = evidenceDepth.depthScore || 70;
    return {
      overallScore: depthScore,
      rating: depthScore >= 85 ? 'Comprehensive' : (depthScore >= 50 ? 'Moderate' : 'Shallow'),
      breakdown: {
        conceptCoverage: `${Math.min(25, Math.round(depthScore * 0.25))}/25`,
        applicationCoverage: `${Math.min(25, Math.round(depthScore * 0.24))}/25`,
        artifactCoverage: `${Math.min(20, Math.round(depthScore * 0.18))}/20`,
        teacherEmphasis: '14/15',
        depth: `${Math.min(15, Math.round(depthScore * 0.15))}/15`,
        total: `${depthScore}/100`
      }
    };
  }

  _buildFallbackPlan(rawContent, difficulty, count, categoryWeights = {}, evidenceDepth = {}, capacity = {}) {
    const targets = [];
    const dimensions = ['Conceptual', 'Scenario Analysis', 'Comparison/Tradeoff', 'Application', 'Flow/Trace'];

    for (let i = 1; i <= count; i++) {
      targets.push({
        targetId: `T0${i}`,
        subtopic: `Subtopic 0${Math.ceil(i / 2)}`,
        concept: `Key Concept ${i} from Session Content`,
        dimension: dimensions[(i - 1) % dimensions.length],
        cognitiveLevel: i % 2 === 0 ? 'Apply' : 'Understand',
        targetDifficulty: difficulty,
        evidenceType: 'VOICE + DOCUMENT',
        sourceChunks: ['chunk_01'],
        requiresExactArtifact: false,
        instruction: `Assess specific concept ${i}`
      });
    }

    return {
      subject: 'Computer Science',
      mainTopic: 'Core Lecture Topic',
      subtopics: ['Core Definitions', 'Mechanism Sequence', 'Registers & Flags', 'Performance Impact'],
      teachingEmphasis: { conceptual: 'HIGH', application: 'HIGH', syntax: 'MEDIUM', calculation: 'LOW' },
      targetCount: count,
      categoryWeights,
      evidenceDepth,
      evidenceCapacity: capacity,
      assessmentTargets: targets,
      reserveTargets: [
        {
          targetId: 'R01',
          subtopic: 'Reserve Subtopic',
          concept: 'Reserve Concept from Session',
          dimension: 'Application',
          cognitiveLevel: 'Apply',
          targetDifficulty: difficulty,
          evidenceType: 'DOCUMENT',
          sourceChunks: ['chunk_01'],
          requiresExactArtifact: false,
          instruction: 'Fallback reserve target'
        }
      ]
    };
  }
}

module.exports = new Agent1Planner();
