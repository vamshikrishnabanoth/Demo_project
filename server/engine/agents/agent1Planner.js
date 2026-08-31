/**
 * server/engine/agents/agent1Planner.js
 *
 * AGENT 1: Assessment Planner & Curriculum Strategist (v1.2).
 * - Extracts natural subtopics supported by evidence (no artificial caps or minimums).
 * - Generates targets across 9 Cognitive Dimensions to fulfill requested question count ($N$).
 * - Calibrates difficulty to reasoning complexity over taught concepts without introducing un-taught advanced knowledge.
 * - Generates Primary Targets ($N$) and Reserve Targets ($M$).
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
    const lectureDepth = evidencePackage.lectureDepth || { score: 65, rating: 'Developing' };
    const detectedFocus = evidencePackage.detectedFocus || [];

    // 1. Calculate TC (Teaching Coverage) Score
    const tcScoreReport = this._computeTCScore(rawContent, voiceEmphasis, lectureDepth);

    // 2. Build prompt for Agent 1 Planning
    const systemPrompt = `You are Agent 1: Assessment Planner & Curriculum Strategist.
Analyze the session evidence and generate an Assessment Plan in valid JSON format.
You must plan ${requestedCount} primary assessment targets AND ${Math.max(1, Math.ceil(requestedCount * 0.3))} reserve targets.

CENTRAL PRINCIPLES:
1. NATURAL SUBTOPIC EXTRACTION: Extract all natural, assessable concepts actually supported by the session content (whether 2, 5, or 15).
2. MULTI-DIMENSIONAL EXPANSION: Fulfill the requested question count (${requestedCount}) by distributing targets across diverse cognitive dimensions:
   - "Conceptual": Core definitions & fundamental mechanism principles.
   - "Cause / Effect": Why things happen, consequences of actions.
   - "Comparison / Tradeoff": Contrasting alternatives, tradeoffs.
   - "Scenario Analysis": Applied problem scenarios in context ("A processor is waiting...").
   - "Application": Implementation, setup, or configuration.
   - "Prediction": What will happen when a condition changes.
   - "Flow / Trace": Step-by-step execution sequencing, register/state saving.
   - "Foundational Prerequisite": Basic knowledge necessary to understand the topic.
   - "Evidence-Derived Inference": Logical conclusions derived from taught material.
3. DIFFICULTY POLICY:
   - The teaching depth of this session is "${lectureDepth.rating}" (Score: ${lectureDepth.score}/100).
   - Calibrate difficulty to reasoning complexity over taught principles.
   - Do NOT introduce un-taught advanced algorithms if teaching depth is Introductory.

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
      "dimension": "Conceptual|Cause / Effect|Comparison / Tradeoff|Scenario Analysis|Application|Prediction|Flow / Trace|Foundational Prerequisite|Evidence-Derived Inference",
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
Lecture Depth: ${lectureDepth.rating} (${lectureDepth.score}/100)
Detected Focus Areas: ${detectedFocus.join(', ')}
Voice Emphasis: Syntax=${voiceEmphasis.syntaxEmphasis}, Conceptual=${voiceEmphasis.conceptualEmphasis}
Explicit Instructions: ${(voiceEmphasis.explicitInstructions || []).join('; ')}
Evidence-Driven Category Weights: ${JSON.stringify(categoryWeights)}
Requested Difficulty: ${requestedDifficulty}
Requested Question Count: ${requestedCount}

[SESSION CONTENT]
${rawContent.substring(0, 50000)}
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
        subtopics: parsed.subtopics || detectedFocus || [],
        teachingEmphasis: parsed.teachingEmphasis || { conceptual: 'HIGH', application: 'HIGH', syntax: 'MEDIUM', calculation: 'LOW' },
        targetCount: parsed.targetCount || requestedCount,
        categoryWeights: categoryWeights,
        lectureDepth: lectureDepth,
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
      console.warn(`⚠️ [Agent 1 Planner] LLM call notice: ${err.message}. Building adaptive fallback plan.`);
      planData = this._buildFallbackPlan(rawContent, requestedDifficulty, requestedCount, categoryWeights, lectureDepth, detectedFocus);
    }

    planData.tcScore = tcScoreReport;
    return planData;
  }

  _computeTCScore(rawContent, voiceEmphasis, lectureDepth) {
    const score = lectureDepth.score || 70;
    return {
      overallScore: score,
      rating: score >= 75 ? 'Comprehensive' : (score >= 50 ? 'Developing' : 'Introductory'),
      breakdown: {
        conceptCoverage: `${Math.min(25, Math.round(score * 0.25))}/25`,
        applicationCoverage: `${Math.min(25, Math.round(score * 0.24))}/25`,
        artifactCoverage: `${Math.min(20, Math.round(score * 0.18))}/20`,
        teacherEmphasis: '14/15',
        depth: `${Math.min(15, Math.round(score * 0.15))}/15`,
        total: `${score}/100`
      }
    };
  }

  _buildFallbackPlan(rawContent, difficulty, count, categoryWeights = {}, lectureDepth = {}, detectedFocus = []) {
    const targets = [];
    const dimensions = [
      'Conceptual',
      'Cause / Effect',
      'Comparison / Tradeoff',
      'Scenario Analysis',
      'Application',
      'Prediction',
      'Flow / Trace',
      'Foundational Prerequisite',
      'Evidence-Derived Inference'
    ];

    for (let i = 1; i <= count; i++) {
      const subtopic = detectedFocus[i % (detectedFocus.length || 1)] || `Topic Concept ${i}`;
      targets.push({
        targetId: `T0${i}`,
        subtopic: subtopic,
        concept: `${subtopic} - Aspect ${i}`,
        dimension: dimensions[(i - 1) % dimensions.length],
        cognitiveLevel: i % 2 === 0 ? 'Apply' : 'Understand',
        targetDifficulty: difficulty,
        evidenceType: 'VOICE + DOCUMENT',
        sourceChunks: ['chunk_01'],
        requiresExactArtifact: false,
        instruction: `Assess understanding and application of ${subtopic}`
      });
    }

    return {
      subject: 'Computer Science',
      mainTopic: detectedFocus[0] || 'Core Lecture Topic',
      subtopics: detectedFocus.length > 0 ? detectedFocus : ['Core Definitions', 'Mechanism Sequence', 'Performance Impact'],
      teachingEmphasis: { conceptual: 'HIGH', application: 'HIGH', syntax: 'MEDIUM', calculation: 'LOW' },
      targetCount: count,
      categoryWeights,
      lectureDepth,
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
