const { performance } = require('perf_hooks');
const { PLANNER_CONFIG } = require('../../config/plannerConfig');
const { allocateConceptSlots } = require('./conceptSelector');
const { mapBloomAndDifficulty } = require('./bloomMapper');
const { rotateFramingStyles } = require('./framingRotator');
const { buildPlanSlots } = require('./planBuilder');
const { classifyDocumentAndIntent } = require('./documentClassifier');

/**
 * Public API: generateQuizPlan(conceptGraph, userConfig)
 * Executes 4 deterministic passes to generate a complete quiz blueprint.
 */
function generateQuizPlan(conceptGraph = {}, userConfig = {}) {
  const startTime = performance.now();

  const requestedCount = parseInt(userConfig.requestedCount || userConfig.count, 10) || 10;
  const userDifficulty = userConfig.difficulty || userConfig.targetDifficulty || "Balanced";

  // Document Type & Intent Classification
  const classification = classifyDocumentAndIntent(conceptGraph, userConfig.content || "");

  // Pass 1: Weighted Concept Allocation & Hamilton Rounding
  const {
    allocatedSlots: conceptNodes,
    uncoveredConceptIds,
    conceptCoverageRatio,
    averageConceptImportance
  } = allocateConceptSlots(conceptGraph, requestedCount);

  // Pass 2: Mathematical Depth & Bloom Distribution
  const {
    profileKey,
    distributionSummary,
    slotDistributions
  } = mapBloomAndDifficulty(requestedCount, userDifficulty);

  // Pass 3: Framing Style Rotation & Code/Math Overrides
  const {
    slotFramings,
    framingConflictsResolved,
    framingStrategy
  } = rotateFramingStyles(conceptNodes);

  // Pass 4: Immutable Slot IDs, Evidence Binding & Prompt Profiles
  const slots = buildPlanSlots({
    conceptNodes,
    slotDistributions,
    slotFramings,
    conceptGraph
  }).map((slot, idx) => {
    const conceptObj = (conceptGraph.nodes || []).find(n => (n.label || n.id) === (slot.conceptLabel || slot.conceptId)) || {};
    return {
      ...slot,
      category: conceptObj.category || "DOMAIN_CONCEPT",
      executable: !!conceptObj.executable,
      canGenerateSyntaxQuestion: !!conceptObj.canGenerateSyntaxQuestion,
      learningObjective: conceptObj.learningObjective || `Student should understand ${slot.conceptLabel}`,
      docType: classification.docType,
      primaryIntent: classification.primaryIntent
    };
  });

  const buildTimeMs = Math.round(performance.now() - startTime);

  return {
    plannerVersion: PLANNER_CONFIG.VERSION,
    metadata: {
      plannerVersion: PLANNER_CONFIG.VERSION,
      buildTimeMs,
      allocationMethod: "Hamilton",
      framingStrategy,
      difficultyProfile: profileKey
    },
    requestedCount,
    distributionSummary,
    diagnostics: {
      conceptCoverageRatio,
      averageConceptImportance,
      uncoveredConceptIds,
      framingConflictsResolved,
      allocationWarnings: []
    },
    slots
  };
}

module.exports = {
  generateQuizPlan
};
