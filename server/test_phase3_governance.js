/**
 * Phase 3 Integration Test Suite: Feedback & Governance Engine
 * Verifies Item Versioning, Instructor Feedback Signals, and Post-Test IQS Calculation.
 */

'use strict';

const itemVersionManager = require('./engine/versioning/itemVersionManager');
const instructorFeedbackEngine = require('./engine/feedback/instructorFeedbackEngine');
const { calculatePostTestIqs } = require('./engine/quality/postTestIqsCalculator');

async function runPhase3Tests() {
  console.log('======================= 🧪 RUNNING PHASE 3 GOVERNANCE TESTS =======================\n');

  const questionId = 'Q_TEST_SLIDING_WINDOW_004';

  // TEST 1: Initial Version Creation
  console.log('--- TEST 1: Item Lineage Creation (v1) ---');
  const initialPayload = {
    stem: 'Why does sliding window trigger frame retransmission on timeout?',
    options: ['ACK timeout expired', 'Header overflow', 'Line noise', 'Queue drop'],
    correctAnswer: 'ACK timeout expired',
    explanation: 'Un-ACKed frames trigger retransmission.'
  };

  const v1 = itemVersionManager.createInitialVersion(questionId, initialPayload);
  console.log('Created Version 1:', JSON.stringify(v1, null, 2));
  if (v1.versionNumber !== 1) {
    throw new Error('Test 1 Failed: Initial version number is not 1.');
  }
  console.log('✅ TEST 1 PASSED.\n');

  // TEST 2: Teacher Revision Creation (v2)
  console.log('--- TEST 2: Teacher Revision Tracking (v2) ---');
  const updatedPayload = {
    ...initialPayload,
    options: ['ACK timeout timer expired prior to verification', 'Header overflow', 'Line noise', 'Queue drop']
  };

  const v2 = itemVersionManager.createRevision(questionId, updatedPayload, 'Teacher refined Option A clarity');
  console.log('Created Version 2:', JSON.stringify(v2, null, 2));
  const history = itemVersionManager.getVersionHistory(questionId);
  if (history.length !== 2) {
    throw new Error('Test 2 Failed: History length is not 2 after revision.');
  }
  console.log('✅ TEST 2 PASSED.\n');

  // TEST 3: Instructor Feedback Recording & Signal Calculation
  console.log('--- TEST 3: Instructor Feedback Engine ---');
  instructorFeedbackEngine.recordFeedback(questionId, 'prof_smith', 'EXCELLENT_DISTRACTORS', 'Very realistic distractor options');
  instructorFeedbackEngine.recordFeedback(questionId, 'prof_davis', 'ACCURATE_BLOOM', 'Correctly targets Analyze level');
  
  const signal = instructorFeedbackEngine.calculateInstructorSignal(questionId);
  console.log('Calculated Instructor Signal T_i:', signal);
  if (signal <= 0.50) {
    throw new Error('Test 3 Failed: Positive instructor ratings yielded non-positive signal.');
  }
  console.log('✅ TEST 3 PASSED.\n');

  // TEST 4: Post-Test IQS Calculation
  console.log('--- TEST 4: Unified Post-Test IQS Calculation ---');
  const studentTelemetry = { totalAttempts: 100, totalCompletions: 95 };
  const postIqs = calculatePostTestIqs(questionId, 0.85, studentTelemetry);
  console.log('Post-Test IQS Assessment:', JSON.stringify(postIqs, null, 2));
  if (postIqs.postTestIqs < 0.80) {
    throw new Error('Test 4 Failed: High performing question received low Post-Test IQS.');
  }
  console.log('✅ TEST 4 PASSED.\n');

  console.log('======================================================================');
  console.log(' 🎉 ALL PHASE 3 FEEDBACK & GOVERNANCE TESTS PASSED CLEANLY');
  console.log('======================================================================');
}

runPhase3Tests().catch(err => {
  console.error('❌ Phase 3 Test Failure:', err);
  process.exit(1);
});
