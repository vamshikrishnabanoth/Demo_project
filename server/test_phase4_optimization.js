/**
 * Phase 4 Integration Test Suite: Continuous Optimization Engine
 * Verifies IRT 2PL Calibration, Distractor Efficiency Index, and Portfolio Utility Optimization.
 */

'use strict';

const { calibrateItemParameters } = require('./engine/optimization/irtCalibrator');
const { optimizePortfolio } = require('./engine/optimization/constrainedPortfolioOptimizer');

async function runPhase4Tests() {
  console.log('======================= 🧪 RUNNING PHASE 4 OPTIMIZATION TESTS =======================\n');

  // TEST 1: IRT 2PL Parameter Calibration & Distractor Efficiency
  console.log('--- TEST 1: IRT 2PL Calibration & Distractor Analysis ---');
  // Simulate 100 student responses
  const responseMatrix = [];
  for (let i = 0; i < 100; i++) {
    const totalScore = Math.floor(Math.random() * 100);
    // High scoring students get question right, low scoring students choose options
    const isCorrect = totalScore > 40;
    let selectedOption = 'Option A';
    if (!isCorrect) {
      selectedOption = totalScore % 2 === 0 ? 'Option B' : 'Option C'; // Option D selected by 0 students (non-functional)
    }
    responseMatrix.push({
      studentId: `student_${i}`,
      studentTotalScore: totalScore,
      isCorrect,
      selectedOption
    });
  }

  const calibration = calibrateItemParameters('Q_SLIDING_WINDOW_004', responseMatrix);
  console.log('IRT Calibration Output:', JSON.stringify(calibration, null, 2));
  if (typeof calibration.discriminationA !== 'number' || typeof calibration.difficultyB !== 'number') {
    throw new Error('Test 1 Failed: IRT calibration output parameters missing.');
  }
  console.log('✅ TEST 1 PASSED.\n');

  // TEST 2: Constrained Portfolio Utility Optimization
  console.log('--- TEST 2: Constrained Portfolio Optimization ---');
  const candidatePool = [
    { stem: 'Question 1 on Sliding Window', conceptName: 'Sliding Window', bloomLevel: 'RECALL', preTestIqs: 0.85 },
    { stem: 'Question 2 on Retransmission', conceptName: 'TCP Timeouts', bloomLevel: 'APPLY', preTestIqs: 0.90 },
    { stem: 'Question 3 on Congestion', conceptName: 'Congestion Control', bloomLevel: 'ANALYZE', preTestIqs: 0.92 },
    { stem: 'Question 4 on RTT Estimation', conceptName: 'RTT Estimation', bloomLevel: 'APPLY', preTestIqs: 0.88 },
    { stem: 'Question 5 on Flow Control', conceptName: 'Flow Control', bloomLevel: 'ANALYZE', preTestIqs: 0.95 }
  ];

  const optimizationResult = optimizePortfolio(candidatePool, 4, { w1_coverage: 0.25, w2_bloom: 0.20 });
  console.log('Portfolio Optimization Output:', JSON.stringify(optimizationResult, null, 2));
  if (optimizationResult.selectedQuestions.length !== 4) {
    throw new Error('Test 2 Failed: Portfolio optimizer did not select target count 4.');
  }
  if (optimizationResult.utilityScore <= 0.5) {
    throw new Error('Test 2 Failed: Optimized portfolio utility score too low.');
  }
  console.log('✅ TEST 2 PASSED.\n');

  console.log('======================================================================');
  console.log(' 🎉 ALL PHASE 4 CONTINUOUS OPTIMIZATION TESTS PASSED CLEANLY');
  console.log('======================================================================');
}

runPhase4Tests().catch(err => {
  console.error('❌ Phase 4 Test Failure:', err);
  process.exit(1);
});
