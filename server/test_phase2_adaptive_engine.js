/**
 * Phase 2 Integration Test Suite: Adaptive Pedagogical Engine
 * Verifies Persona Adapter, Misconception Catalog, Independent Critique Agent, and Pre-Test IQS.
 */

'use strict';

const { adaptAssessmentPlanToPersona } = require('./engine/adapter/personaAdapter');
const { getMisconceptionsForConcept } = require('./engine/adapter/misconceptionCatalog');
const { evaluateQuestionCritique } = require('./engine/agents/critiqueAgent');
const { calculatePreTestIqs } = require('./engine/quality/preTestIqsCalculator');

async function runPhase2Tests() {
  console.log('======================= 🧪 RUNNING PHASE 2 ADAPTIVE ENGINE TESTS =======================\n');

  // TEST 1: Misconception Catalog Retrieval
  console.log('--- TEST 1: Misconception Catalog Lookup ---');
  const misconceptions = getMisconceptionsForConcept('Sliding Window Protocol');
  console.log('Retrieved Misconceptions for Sliding Window:', misconceptions);
  if (!Array.isArray(misconceptions) || misconceptions.length === 0) {
    throw new Error('Test 1 Failed: Misconception retrieval returned empty array.');
  }
  console.log('✅ TEST 1 PASSED.\n');

  // TEST 2: Persona Adapter Brief Adaptation
  console.log('--- TEST 2: Persona Adapter Brief Construction ---');
  const plan = {
    slotId: 'slot_004',
    concept: 'Sliding Window Protocol',
    bloomLevel: 'ANALYZE',
    evidenceBounds: 'In Sliding Window, when an ACK is delayed beyond estimated RTT...',
    learningObjective: 'Evaluate timeout recovery behavior under non-deterministic RTT spikes'
  };

  const persona = {
    cohort: '3rd Year Computer Science',
    targetYear: '3rd Year Undergraduate',
    abilityTheta: 1.2,
    weaknessAreas: ['TCP Retransmission Timeouts'],
    customMisconception: 'Confusing ACK loss timeout with sliding frame corruption'
  };

  const finalBrief = adaptAssessmentPlanToPersona(plan, persona);
  console.log('Final Assessment Brief:', JSON.stringify(finalBrief, null, 2));
  if (finalBrief.learnerPersona.assignedDifficulty !== 'Hard') {
    throw new Error('Test 2 Failed: Ability theta 1.2 did not assign Hard difficulty.');
  }
  console.log('✅ TEST 2 PASSED.\n');

  // TEST 3: Independent Critique Agent Evaluation
  console.log('--- TEST 3: Independent Critique Agent ---');
  const candidateQuestion = {
    stem: 'In network architecture, why does an un-acknowledged frame trigger sliding window frame retransmission?',
    options: [
      'ACK timer expired prior to frame verification',
      'Frame header payload buffer overflow occurred',
      'Physical interface line noise drop',
      'Router queue congestion collapse'
    ],
    correctAnswer: 'ACK timer expired prior to frame verification',
    explanation: 'When ACK is not received within timeout, sliding window retransmits the frame.'
  };

  const critique = await evaluateQuestionCritique(candidateQuestion, finalBrief);
  console.log('Critique Evaluation Report:', JSON.stringify(critique, null, 2));
  if (typeof critique.overallConfidence !== 'number') {
    throw new Error('Test 3 Failed: Critique confidence score missing.');
  }
  console.log('✅ TEST 3 PASSED.\n');

  // TEST 4: Pre-Test IQS Calculation
  console.log('--- TEST 4: Pre-Test IQS Calculator ---');
  const iqsResult = calculatePreTestIqs(candidateQuestion, critique, { isValidated: true, toolErrors: [] });
  console.log('Calculated Pre-Test IQS Score:', JSON.stringify(iqsResult, null, 2));
  if (iqsResult.preTestIqs < 0.70) {
    throw new Error('Test 4 Failed: High quality item scored low Pre-Test IQS.');
  }
  console.log('✅ TEST 4 PASSED.\n');

  console.log('======================================================================');
  console.log(' 🎉 ALL PHASE 2 ADAPTIVE PEDAGOGICAL ENGINE TESTS PASSED CLEANLY');
  console.log('======================================================================');
}

runPhase2Tests().catch(err => {
  console.error('❌ Phase 2 Test Failure:', err);
  process.exit(1);
});
