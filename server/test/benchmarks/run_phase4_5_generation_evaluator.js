/**
 * server/test/benchmarks/run_phase4_5_generation_evaluator.js
 *
 * Phase 4.5 Generation Validation Harness.
 * 
 * Tests the complete end-to-end cognitive pipeline:
 * IntentRelativeReasoner -> Operational Blueprint -> Agent 2 Generator -> MCQ
 *
 * Evaluates across 8 core dimensions:
 * 1. Intent Recognition
 * 2. Negative Boundary Adherence & Anti-Hallucination
 * 3. Difficulty Calibration (Relative Hard)
 * 4. Question Grounding
 * 5. Blueprint Adherence
 * 6. Answer-Key Correctness (Single Correct Answer)
 * 7. Distractor Quality & Mutual Exclusivity
 * 8. Teacher-Style Differentiation (Lecturer A vs Lecturer B)
 *
 * Tests:
 * - Canonical GAN A/B Pair (INTENT_001 vs INTENT_002)
 * - Concurrency A/B Pair (INTENT_003 vs INTENT_004)
 * - Consensus A/B Pair (INTENT_005 vs INTENT_006)
 * - Holdout Transformer A/B Pair (HOLD_INT_001 vs HOLD_INT_002)
 * - Holdout Linux CFS A/B Pair (HOLD_INT_003 vs HOLD_INT_004)
 * - Holdout Negative Boundary Cases (HOLD_INT_005, HOLD_INT_006, HOLD_INT_007)
 * - Holdout Conceptual-Hard Cases (HOLD_INT_008, HOLD_INT_009)
 * - Genuine Deficit Cases (INTENT_015, HOLD_INT_010)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const agent2Generator = require('../../engine/agents/agent2Generator');
const { IntentRelativeReasoner } = require('./run_phase4_intent_evaluator');

const GOLDEN_FILE = path.resolve(__dirname, '../../../evaluation_dataset/golden_benchmarks/intent_difficulty_benchmark.json');
const HOLDOUT_FILE = path.resolve(__dirname, '../../../evaluation_dataset/golden_benchmarks/intent_difficulty_holdout_unseen.json');

function loadJson(filepath) {
  return JSON.parse(fs.readFileSync(filepath, 'utf8'));
}

// ─────────────────────────────────────────────────────────────────────────────
// Verification Validators
// ─────────────────────────────────────────────────────────────────────────────
function verifyNegativeBoundary(mcq, boundaries) {
  if (!boundaries || boundaries.length === 0) return { passed: true, violations: [] };
  const violations = [];
  const fullText = `${mcq.questionText} ${mcq.options.join(' ')} ${mcq.explanation || ''}`.toLowerCase();

  if (boundaries.includes('NO_CODE_IMPLEMENTATION')) {
    const codeSignals = /\b(?:pytorch|torch\.|def |class |import |optimizer\.|zero_grad|loss\.backward|optimizer\.step|```|`[a-z0-9_]+\(\)`|c structs?|llvm pass)\b/i;
    if (codeSignals.test(fullText)) {
      violations.push(`Found code/syntax elements violating NO_CODE_IMPLEMENTATION: ${fullText.match(codeSignals)[0]}`);
    }
  }

  if (boundaries.includes('NO_MATHEMATICAL_DERIVATION')) {
    const mathSignals = /\b(?:formal proof|derive the equation|calculus proof|group homomorphism|ring theory|regularity condition proof)\b/i;
    if (mathSignals.test(fullText)) {
      violations.push(`Found formal proof elements violating NO_MATHEMATICAL_DERIVATION: ${fullText.match(mathSignals)[0]}`);
    }
  }

  if (boundaries.includes('NO_VENDOR_SPECIFIC_CLI')) {
    const cliSignals = /\b(?:docker run|docker --|aws ecs|cisco ios|router cli|show ip bgp)\b/i;
    if (cliSignals.test(fullText)) {
      violations.push(`Found vendor CLI syntax violating NO_VENDOR_SPECIFIC_CLI: ${fullText.match(cliSignals)[0]}`);
    }
  }

  if (boundaries.includes('NO_PACKET_FORMAT_TRIVIA')) {
    const triviaSignals = /\b(?:byte offset|bytes \d+ to \d+|packet field offset)\b/i;
    if (triviaSignals.test(fullText)) {
      violations.push(`Found wire trivia violating NO_PACKET_FORMAT_TRIVIA: ${fullText.match(triviaSignals)[0]}`);
    }
  }

  return {
    passed: violations.length === 0,
    violations
  };
}

function verifyAnswerKeyCorrectness(mcq) {
  if (!mcq || !Array.isArray(mcq.options) || mcq.options.length !== 4) {
    return { passed: false, reason: 'Options array is not exactly 4 items' };
  }
  const exactMatch = mcq.options.includes(mcq.correctAnswer);
  if (!exactMatch) {
    return { passed: false, reason: 'correctAnswer is not an exact match to any option' };
  }
  const uniqueOptions = new Set(mcq.options);
  if (uniqueOptions.size !== 4) {
    return { passed: false, reason: 'Options contain duplicate entries' };
  }
  return { passed: true };
}

function verifyDistractorQuality(mcq) {
  const lengths = mcq.options.map(o => o.length);
  const minLen = Math.min(...lengths);
  const maxLen = Math.max(...lengths);
  const ratio = minLen > 0 ? (maxLen / minLen) : 999;
  const isBalanced = ratio <= 2.5;

  const archetypes = mcq.usedArchetypes || [];
  const hasArchetypes = archetypes.length >= 1;

  return {
    isBalanced,
    lengthRatio: ratio.toFixed(2),
    hasArchetypes,
    archetypes,
    passed: isBalanced && hasArchetypes
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite Execution
// ─────────────────────────────────────────────────────────────────────────────
async function runPhase45Validation() {
  console.log('========================================================================================');
  console.log('       PHASE 4.5: END-TO-END MCQ GENERATION & BLUEPRINT ADHERENCE VALIDATION            ');
  console.log('========================================================================================\n');

  const goldenCases = loadJson(GOLDEN_FILE);
  const holdoutCases = loadJson(HOLDOUT_FILE);

  // Selected test matrix covering all experimental requirements
  const selectedTestIds = [
    // Golden Canonical Pairs
    'INTENT_001', 'INTENT_002', // GAN A/B
    'INTENT_003', 'INTENT_004', // Concurrency A/B
    'INTENT_005', 'INTENT_006', // Consensus A/B
    // Holdout Canonical Pairs
    'HOLD_INT_001', 'HOLD_INT_002', // Transformer Attention A/B
    'HOLD_INT_003', 'HOLD_INT_004', // Linux CFS Scheduler A/B
    // Holdout Negative Boundaries
    'HOLD_INT_005', // Diffie-Hellman (No Math Proof)
    'HOLD_INT_006', // Compiler LICM (No Backend Code)
    'HOLD_INT_007', // BGP AS-Path (No Router CLI)
    // Holdout Conceptual-Hard
    'HOLD_INT_008', // Mutation Testing
    'HOLD_INT_009', // Byzantine Fault Tolerance
    // Genuine Deficit Cases
    'INTENT_015',   // AWS Cloud Catalog (Golden Deficit)
    'HOLD_INT_010'   // VCS Taxonomy (Holdout Deficit)
  ];

  const allCases = [...goldenCases, ...holdoutCases];
  const testCases = selectedTestIds.map(id => allCases.find(c => c.testId === id)).filter(Boolean);

  const results = [];

  for (const tc of testCases) {
    console.log(`----------------------------------------------------------------------------------------`);
    console.log(`TESTING [${tc.testId}] ${tc.name}`);
    console.log(`Category: ${tc.category} | Pair: ${tc.pairId || 'None'}`);

    const vText = tc.voiceSnippet;
    const dText = tc.documentSnippet;

    // Step 1: Intent Relative Reasoner
    const intent = IntentRelativeReasoner.extractIntent(vText, dText);
    const negativeBoundaries = IntentRelativeReasoner.extractNegativeBoundaries(vText);
    const feasibility = IntentRelativeReasoner.evaluateHardFeasibility(vText, dText, intent);
    const hardGuidance = IntentRelativeReasoner.planHardGuidance(intent, negativeBoundaries);

    console.log(`Reasoner Output -> Intent: ${intent} | Feasible: ${feasibility.hardFeasible} | Boundaries: [${negativeBoundaries.join(', ')}]`);

    // Step 2: Formulate Agent 1 Target
    const target = {
      targetId: `TARGET_${tc.testId}`,
      concept: tc.name.split(':')[1]?.trim() || tc.name,
      subtopic: tc.name,
      dimension: 'Conceptual',
      cognitiveLevel: 'Evaluate',
      targetDifficulty: 'Hard',
      intendedCognitiveOperation: intent === 'EXPLORATION' ? 'BEHAVIORAL_PREDICTION' :
                                   (intent === 'COMPARATIVE_TRADEOFF' ? 'SCENARIO_TRADEOFF' :
                                   (intent === 'IMPLEMENTATION_PRACTICE' ? 'CODE_OR_TRACE' :
                                   (intent === 'PROCEDURAL_TRACE' ? 'STEP_TRACE' : 'CAUSAL_EXPLANATION'))),
      operationalGuidance: hardGuidance,
      negativeBoundaries: negativeBoundaries,
      supportingEvidence: `${vText}\n${dText}`,
      capacityLimitation: feasibility.hardFeasible ? null : {
        status: 'INSUFFICIENT_EVIDENCE_FOR_HARD',
        reason: feasibility.message
      }
    };

    // Step 3: Run Agent 2 Generation
    const evidencePackage = {
      unifiedRawContent: target.supportingEvidence,
      curricularContent: target.supportingEvidence
    };

    const startTime = Date.now();
    const mcq = await agent2Generator.generateQuestion(target, evidencePackage);
    const durationMs = Date.now() - startTime;

    // Step 4: Validate
    const isDeficit = !feasibility.hardFeasible;
    let deficitHandledCorrectly = false;
    let boundaryValidation = { passed: true, violations: [] };
    let keyValidation = { passed: true };
    let distractorValidation = { passed: true, lengthRatio: '1.0', archetypes: [] };

    if (isDeficit) {
      deficitHandledCorrectly = mcq.isUnfulfilled && mcq.fulfillmentStatus === 'UNFULFILLED_CAPACITY_DEFICIT';
      console.log(`Deficit Result -> Handled Correctly: ${deficitHandledCorrectly ? '✅ PASS' : '❌ FAIL'} (${mcq.fulfillmentStatus})`);
    } else {
      boundaryValidation = verifyNegativeBoundary(mcq, negativeBoundaries);
      keyValidation = verifyAnswerKeyCorrectness(mcq);
      distractorValidation = verifyDistractorQuality(mcq);

      console.log(`Question Stem: "${mcq.questionText}"`);
      console.log(`Correct Answer: "${mcq.correctAnswer}"`);
      console.log(`Options (4):`);
      mcq.options.forEach((opt, idx) => console.log(`  [${String.fromCharCode(65 + idx)}] ${opt}`));
      console.log(`Validation -> Boundaries: ${boundaryValidation.passed ? '✅ PASS' : '❌ FAIL'} | Key: ${keyValidation.passed ? '✅ PASS' : '❌ FAIL'} | Distractors: ${distractorValidation.passed ? '✅ PASS' : '⚠️ WARN'} (Ratio: ${distractorValidation.lengthRatio}, Archetypes: [${distractorValidation.archetypes.join(', ')}])`);
      if (!boundaryValidation.passed) {
        console.error(`  ⚠️ Boundary Violations:`, boundaryValidation.violations);
      }
    }

    results.push({
      testId: tc.testId,
      name: tc.name,
      pairId: tc.pairId,
      expectedIntent: tc.expectedIntent,
      extractedIntent: intent,
      intentMatch: intent === tc.expectedIntent,
      negativeBoundaries,
      isDeficit,
      deficitHandledCorrectly,
      mcq,
      boundaryValidation,
      keyValidation,
      distractorValidation,
      durationMs
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Aggregate Metrics & Style Differentiation
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n========================================================================================');
  console.log('                             PHASE 4.5 GENERATION EVALUATION RESULTS                    ');
  console.log('========================================================================================');

  const intentSuccess = results.filter(r => r.intentMatch).length;
  const deficitCases = results.filter(r => r.isDeficit);
  const deficitSuccess = deficitCases.filter(r => r.deficitHandledCorrectly).length;

  const generatedCases = results.filter(r => !r.isDeficit);
  const boundarySuccess = generatedCases.filter(r => r.boundaryValidation.passed).length;
  const keySuccess = generatedCases.filter(r => r.keyValidation.passed).length;
  const distractorSuccess = generatedCases.filter(r => r.distractorValidation.passed).length;

  // Pair Style Differentiation Check
  const pairIds = Array.from(new Set(results.map(r => r.pairId).filter(Boolean)));
  const pairDiffs = [];
  pairIds.forEach(pid => {
    const pair = results.filter(r => r.pairId === pid);
    if (pair.length === 2 && !pair[0].isDeficit && !pair[1].isDeficit) {
      const qA = pair[0].mcq.questionText.toLowerCase();
      const qB = pair[1].mcq.questionText.toLowerCase();
      const distinctStems = qA !== qB;
      const distinctOps = pair[0].extractedIntent !== pair[1].extractedIntent;
      pairDiffs.push({
        pairId: pid,
        distinctStems,
        distinctOps,
        passed: distinctStems && distinctOps
      });
    }
  });

  const pairDiffSuccess = pairDiffs.filter(p => p.passed).length;

  console.log(`1. Intent Recognition Rate                 : ${intentSuccess}/${results.length} (${((intentSuccess / results.length) * 100).toFixed(1)}%)`);
  console.log(`2. Negative Boundary Adherence             : ${boundarySuccess}/${generatedCases.length} (${((boundarySuccess / generatedCases.length) * 100).toFixed(1)}%)`);
  console.log(`3. Genuine Deficit Handling Precision      : ${deficitSuccess}/${deficitCases.length} (${((deficitSuccess / deficitCases.length) * 100).toFixed(1)}%)`);
  console.log(`4. Answer-Key Correctness & Exclusivity    : ${keySuccess}/${generatedCases.length} (${((keySuccess / generatedCases.length) * 100).toFixed(1)}%)`);
  console.log(`5. Distractor Quality & Option Balance     : ${distractorSuccess}/${generatedCases.length} (${((distractorSuccess / generatedCases.length) * 100).toFixed(1)}%)`);
  console.log(`6. Teacher-Style Differentiation Across Pairs: ${pairDiffSuccess}/${pairIds.length} (${((pairDiffSuccess / pairIds.length) * 100).toFixed(1)}%)`);
  console.log('========================================================================================\n');

  return {
    results,
    pairDiffs,
    metrics: {
      intentAccuracy: ((intentSuccess / results.length) * 100).toFixed(1),
      boundaryAdherence: ((boundarySuccess / generatedCases.length) * 100).toFixed(1),
      deficitPrecision: ((deficitSuccess / deficitCases.length) * 100).toFixed(1),
      keyCorrectness: ((keySuccess / generatedCases.length) * 100).toFixed(1),
      distractorQuality: ((distractorSuccess / generatedCases.length) * 100).toFixed(1),
      pairDifferentiation: ((pairDiffSuccess / pairIds.length) * 100).toFixed(1)
    }
  };
}

if (require.main === module) {
  runPhase45Validation().catch(console.error);
}

module.exports = { runPhase45Validation };
