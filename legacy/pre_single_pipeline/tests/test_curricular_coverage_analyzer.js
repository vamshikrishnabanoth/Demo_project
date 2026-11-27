/**
 * server/test/test_curricular_coverage_analyzer.js
 *
 * CONTRACT & VALIDATION TEST SUITE: STEP 5 PRE-GENERATION CURRICULAR COVERAGE ANALYZER
 *
 * Verifies:
 * 1. Schema conformity: concept, evidenceStrength, taughtDepth, teacherEmphasis,
 *    coverageStatus, internalStatus, evidenceSource, evidenceSpans, explicitlyExcluded, exclusionReason.
 *    (Asserts NO eligibleDifficulties field is produced).
 * 2. Distinction between Mentioned vs Taught vs Sufficient:
 *    - SUFFICIENT: Substantive mechanisms, tradeoffs, and definitions.
 *    - INADEQUATE: Isolated brief facts lacking operational depth.
 *    - MENTIONED_ONLY: Passing name-drops, future teasers ("we'll discuss that later").
 *    - EXPLICITLY_EXCLUDED: Negative boundaries ("Don't worry about coding or PyTorch").
 *    - ABSENT: Unmentioned concepts.
 * 3. User-facing statuses: Sufficient, Inadequate, No coverage.
 * 4. Agent 1 Planner integration and target exclusion filtering.
 * 5. Architectural independence: Difficulty calibration remains decoupled in IntentRelativeReasoner.
 */

'use strict';

const assert = require('assert');
const CurricularCoverageAnalyzer = require('../engine/evidence/curricularCoverageAnalyzer');
const evidencePackager = require('../engine/evidence/evidencePackager');
const agent1Planner = require('../engine/agents/agent1Planner');

let passCount = 0;
let totalCount = 0;

function runTest(testName, fn) {
  totalCount++;
  try {
    fn();
    console.log(`  [PASS] Test ${totalCount}: ${testName}`);
    passCount++;
  } catch (err) {
    console.error(`  [FAIL] Test ${totalCount}: ${testName}`);
    console.error(`         ${err.message}`);
    process.exitCode = 1;
  }
}

async function runAsyncTest(testName, fn) {
  totalCount++;
  try {
    await fn();
    console.log(`  [PASS] Test ${totalCount}: ${testName}`);
    passCount++;
  } catch (err) {
    console.error(`  [FAIL] Test ${totalCount}: ${testName}`);
    console.error(`         ${err.message}`);
    process.exitCode = 1;
  }
}

async function runSuite() {
  console.log('============================================================');
  console.log('  TEST SUITE: STEP 5 CURRICULAR COVERAGE ANALYZER CONTRACT  ');
  console.log('============================================================\n');

  // -------------------------------------------------------------
  // Suite 1: Schema Invariants & Architectural Separation
  // -------------------------------------------------------------
  console.log('--- Suite 1: Schema Invariants & Architectural Separation ---');

  const ganVoice = "Don't worry about coding or PyTorch today; we want to explore the conceptual game between the generator and discriminator. Think of it as a counterfeiter and a detective. Explore what happens if the discriminator gets too good too fast—if the detective catches everything immediately, what feedback does the counterfeiter get? None! Vanishing gradients. That's the dynamic tradeoff.";
  const ganDoc = "Adversarial Training Dynamics. Minimax objective, zero-sum game, discriminator loss saturation.";

  const ganPackage = evidencePackager.packageSessionEvidence({
    sessionId: 'test_cov_gan',
    voiceTranscript: ganVoice,
    documentTexts: [ganDoc],
    documentNames: ['GAN_Notes.md']
  });

  runTest('CurricularCoverageAnalyzer produces valid schema record for a concept', () => {
    const record = CurricularCoverageAnalyzer.evaluateConceptCoverage('Generator', ganPackage);
    
    assert.strictEqual(typeof record.concept, 'string', 'concept must be string');
    assert(['STRONG', 'MODERATE', 'WEAK', 'NONE'].includes(record.evidenceStrength), 'valid evidenceStrength');
    assert(['HIGH', 'MEDIUM', 'LOW', 'SURFACE'].includes(record.taughtDepth), 'valid taughtDepth');
    assert(['HIGH', 'MEDIUM', 'LOW'].includes(record.teacherEmphasis), 'valid teacherEmphasis');
    assert(['Sufficient', 'Inadequate', 'No coverage'].includes(record.coverageStatus), 'valid user coverageStatus');
    assert(['SUFFICIENT', 'INADEQUATE', 'MENTIONED_ONLY', 'ABSENT', 'EXPLICITLY_EXCLUDED'].includes(record.internalStatus), 'valid internalStatus');
    assert(['VOICE_PRIMARY', 'DOC_PRIMARY', 'DUAL_SOURCE', 'NONE'].includes(record.evidenceSource), 'valid evidenceSource');
    assert(Array.isArray(record.evidenceSpans), 'evidenceSpans must be array');
    assert.strictEqual(typeof record.explicitlyExcluded, 'boolean', 'explicitlyExcluded must be boolean');

    // CRITICAL ARCHITECTURAL SEPARATION INVARIANT:
    // Coverage Analyzer MUST NOT emit eligibleDifficulties (difficulty feasibility belongs to v2 Reasoner)
    assert.strictEqual(record.eligibleDifficulties, undefined, 'eligibleDifficulties MUST NOT be produced by Coverage Analyzer');
  });

  runTest('Full session analyzeCoverage produces expected summary and partitions', () => {
    const coverage = CurricularCoverageAnalyzer.analyzeCoverage(ganPackage, [
      'Generator',
      'Discriminator',
      'Adversarial Dynamics',
      'PyTorch coding',
      'Learning rate'
    ]);

    assert(coverage.summary, 'summary object must exist');
    assert.strictEqual(coverage.summary.totalConcepts, 5, '5 concepts evaluated');
    assert.strictEqual(typeof coverage.summary.sufficientCount, 'number');
    assert.strictEqual(typeof coverage.summary.noCoverageCount, 'number');
    assert(Array.isArray(coverage.sufficientConcepts), 'sufficientConcepts array');
    assert(Array.isArray(coverage.excludedOrUncoveredConcepts), 'excludedOrUncoveredConcepts array');
  });

  // -------------------------------------------------------------
  // Suite 2: Core Pedagogical Discrimination
  // -------------------------------------------------------------
  console.log('\n--- Suite 2: Pedagogical Assessability Discrimination ---');

  runTest('Core thoroughly taught concepts receive SUFFICIENT (Sufficient)', () => {
    const genRecord = CurricularCoverageAnalyzer.evaluateConceptCoverage('Generator', ganPackage);
    assert.strictEqual(genRecord.coverageStatus, 'Sufficient');
    assert.strictEqual(genRecord.internalStatus, 'SUFFICIENT');
    assert.strictEqual(genRecord.explicitlyExcluded, false);
    assert(genRecord.evidenceSpans.length > 0, 'Must have supporting spans');

    const discRecord = CurricularCoverageAnalyzer.evaluateConceptCoverage('Discriminator', ganPackage);
    assert.strictEqual(discRecord.coverageStatus, 'Sufficient');
    assert.strictEqual(discRecord.internalStatus, 'SUFFICIENT');

    const dynRecord = CurricularCoverageAnalyzer.evaluateConceptCoverage('Dynamic tradeoff', ganPackage);
    assert.strictEqual(dynRecord.coverageStatus, 'Sufficient');
    assert.strictEqual(dynRecord.internalStatus, 'SUFFICIENT');
  });

  runTest('Explicitly excluded concepts receive NO_COVERAGE (No coverage / EXPLICITLY_EXCLUDED)', () => {
    const codeRecord = CurricularCoverageAnalyzer.evaluateConceptCoverage('PyTorch coding', ganPackage);
    assert.strictEqual(codeRecord.coverageStatus, 'No coverage');
    assert.strictEqual(codeRecord.internalStatus, 'EXPLICITLY_EXCLUDED');
    assert.strictEqual(codeRecord.explicitlyExcluded, true);
    assert(codeRecord.exclusionReason.includes('NO_CODE_IMPLEMENTATION') || codeRecord.exclusionReason.includes('excluded'));
  });

  runTest('Absent foreign concepts receive NO_COVERAGE (No coverage / ABSENT)', () => {
    const absentRecord = CurricularCoverageAnalyzer.evaluateConceptCoverage('Kubernetes Pod Replication', ganPackage);
    assert.strictEqual(absentRecord.coverageStatus, 'No coverage');
    assert.strictEqual(absentRecord.internalStatus, 'ABSENT');
    assert.strictEqual(absentRecord.explicitlyExcluded, false);
    assert.strictEqual(absentRecord.evidenceStrength, 'NONE');
  });

  // -------------------------------------------------------------
  // Suite 3: Mentioned-Only vs Inadequate vs Sufficient
  // -------------------------------------------------------------
  console.log('\n--- Suite 3: Mentioned-Only vs Inadequate Discrimination ---');

  const teaserVoice = "Today we focus on basic binary trees and node structures. Binary trees have a left and right child pointer. GANs also use learning rates, but we'll discuss that later in the semester. You may have heard of mode collapse in passing. A buffer is a temporary memory area.";
  const teaserPackage = evidencePackager.packageSessionEvidence({
    sessionId: 'test_cov_teaser',
    voiceTranscript: teaserVoice,
    documentTexts: ['Binary Tree structures: node, left pointer, right pointer, root key.'],
    documentNames: ['Trees.md']
  });

  runTest('Future teaser ("we\'ll discuss that later") is classified as MENTIONED_ONLY (No coverage)', () => {
    const lrRecord = CurricularCoverageAnalyzer.evaluateConceptCoverage('Learning rates', teaserPackage);
    assert.strictEqual(lrRecord.coverageStatus, 'No coverage');
    assert.strictEqual(lrRecord.internalStatus, 'MENTIONED_ONLY');
    assert.strictEqual(lrRecord.explicitlyExcluded, false);
    assert(lrRecord.exclusionReason.includes('Mentioned only in passing') || lrRecord.exclusionReason.includes('future'));
  });

  runTest('Passing name-drop ("you may have heard of ... in passing") is classified as MENTIONED_ONLY (No coverage)', () => {
    const mcRecord = CurricularCoverageAnalyzer.evaluateConceptCoverage('Mode collapse', teaserPackage);
    assert.strictEqual(mcRecord.coverageStatus, 'No coverage');
    assert.strictEqual(mcRecord.internalStatus, 'MENTIONED_ONLY');
    assert.strictEqual(mcRecord.explicitlyExcluded, false);
  });

  runTest('Brief isolated description with no mechanism is classified as INADEQUATE (Inadequate)', () => {
    const bufRecord = CurricularCoverageAnalyzer.evaluateConceptCoverage('Buffer', teaserPackage);
    assert.strictEqual(bufRecord.coverageStatus, 'Inadequate');
    assert.strictEqual(bufRecord.internalStatus, 'INADEQUATE');
    assert.strictEqual(bufRecord.explicitlyExcluded, false);
    assert(bufRecord.exclusionReason.includes('brief') || bufRecord.exclusionReason.includes('operational'));
  });

  // -------------------------------------------------------------
  // Suite 4: Agent 1 Integration & Target Protection
  // -------------------------------------------------------------
  console.log('\n--- Suite 4: Agent 1 Planner Integration ---');

  runTest('evidencePackager automatically populates packageData.curricularCoverage', () => {
    assert(ganPackage.curricularCoverage, 'evidencePackage must contain curricularCoverage');
    assert(ganPackage.curricularCoverage.summary, 'curricularCoverage must have summary');
    assert(ganPackage.curricularCoverage.concepts.length > 0, 'curricularCoverage must have concepts');
  });

  runTest('agent1Planner _auditAssessmentTargets rejects excluded or uncovered concepts', () => {
    const targets = [
      { targetId: 'T01', concept: 'Generator Counterfeiter Dynamics', subtopic: 'Adversarial' },
      { targetId: 'T02', concept: 'PyTorch coding implementation', subtopic: 'Code' },
      { targetId: 'T03', concept: 'Discriminator Classification', subtopic: 'Loss' }
    ];
    const reserve = [
      { targetId: 'R01', concept: 'Adversarial Dynamic Equilibrium', subtopic: 'Theory' },
      { targetId: 'R02', concept: 'Learning rates future formula', subtopic: 'Opt' }
    ];

    const { auditedTargets, auditedReserve, auditLog } = agent1Planner._auditAssessmentTargets(
      targets,
      reserve,
      2,
      ganPackage
    );

    // T02 (PyTorch coding) should be rejected
    const rejectedCodes = auditLog.rejected.map(r => r.concept);
    assert(rejectedCodes.some(c => c.toLowerCase().includes('pytorch')), 'PyTorch coding target must be rejected');
    
    // Audited targets must not contain PyTorch coding
    assert(!auditedTargets.some(t => t.concept.toLowerCase().includes('pytorch')), 'Audited targets must be free of excluded concepts');
    
    // Valid targets accepted
    assert(auditedTargets.some(t => t.concept.includes('Generator')), 'Valid generator target preserved');
  });

  console.log('\n============================================================');
  console.log(`  STEP 5 TEST SUITE COMPLETE: ${passCount}/${totalCount} PASSED  `);
  console.log('============================================================\n');
}

runSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
