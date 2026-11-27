/**
 * Phase 2 — Persona Adapter Engine
 * Accepts an Academic AssessmentPlan (WHAT to test) and adapts it with LearnerProfile (HOW to test)
 * to produce the FinalAssessmentBrief for the Question Generator.
 */

'use strict';

const { getMisconceptionsForConcept } = require('./misconceptionCatalog');

function adaptAssessmentPlanToPersona(assessmentPlan = {}, learnerProfile = {}) {
  const {
    slotId = 'slot_001',
    concept = 'Core Domain Concept',
    bloomLevel = 'APPLY',
    evidenceBounds = '',
    learningObjective = ''
  } = assessmentPlan;

  const {
    cohort = 'General Student Cohort',
    targetYear = '2nd Year Undergraduate',
    abilityTheta = 0.0,
    weaknessAreas = [],
    customMisconception = null
  } = learnerProfile;

  // Determine difficulty multiplier based on ability theta (-2.0 to +2.0)
  let targetDifficulty = 'Balanced';
  if (abilityTheta > 0.8) targetDifficulty = 'Hard';
  else if (abilityTheta < -0.8) targetDifficulty = 'Easy';
  else targetDifficulty = 'Medium';

  // Select target misconception from catalog or custom input
  const catalogMisconceptions = getMisconceptionsForConcept(concept);
  const selectedMisconception = customMisconception || catalogMisconceptions[0] || `Common cognitive misconception regarding ${concept}`;

  const finalBrief = {
    slotId,
    concept,
    targetBloom: bloomLevel,
    evidenceBounds,
    learningObjective: learningObjective || `Assess understanding of ${concept} within ${targetYear} curriculum`,
    learnerPersona: {
      cohort,
      targetYear,
      assignedDifficulty: targetDifficulty,
      targetedWeakness: weaknessAreas.length > 0 ? weaknessAreas.join(', ') : 'General conceptual synthesis',
      targetedMisconception: selectedMisconception
    }
  };

  return finalBrief;
}

module.exports = {
  adaptAssessmentPlanToPersona
};
