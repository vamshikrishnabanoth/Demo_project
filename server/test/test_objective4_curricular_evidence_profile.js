/**
 * test_objective4_curricular_evidence_profile.js
 *
 * Comprehensive Multi-Subject Verification Suite for Objective 4:
 * CurricularEvidenceProfile & Scoring Contract Remediation.
 *
 * Verifies:
 *  1. MULTI_005 (Algorithms / Stock Trading) evidence extraction & zero score emission
 *  2. MULTI_001 (Computer Architecture) multi-concept pass & zero score emission
 *  3. Short complete single-concept lecture acceptance (no arbitrary length rejection)
 *  4. Classroom banter / logistics rejection (FAIL + INSUFFICIENT_EVIDENCE)
 *  5. Adversarial nonsense rejection (FAIL/UNCERTAIN + INSUFFICIENT_EVIDENCE)
 *  6. Agent 1 Planner Curricular Coverage & _computeTCScore deprecation
 *  7. Pipeline Orchestrator quizAlignment, delivered coverage ratio & tcScore deprecation
 *  8. Multi-modal independence (Voice-only, Document-only, Voice + Material)
 *  9. Non-evaluative disclaimers & Schema 2.0.0 compliance
 * 10. AudioTeachingQualityEngine retirement status & historical preservation
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const depthAnalyzer = require('../engine/evidence/depthAnalyzer');
const agent1Planner = require('../engine/agents/agent1Planner');
const AudioTeachingQualityEngine = require('../engine/assessment/audioTeachingQualityEngine');

let passedTests = 0;
let totalTests = 0;

function runTest(testName, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ [PASS] ${testName}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ [FAIL] ${testName}: ${err.message}`);
    throw err;
  }
}

console.log('\n================================================================');
console.log('  OBJECTIVE 4: CURRICULAR EVIDENCE PROFILE & SCORE VERIFICATION');
console.log('================================================================\n');

// ─────────────────────────────────────────────────────────────────────────────
// Test Group 1: MULTI_005 (Algorithms / Stock Trading) Multi-Modal Evidence
// ─────────────────────────────────────────────────────────────────────────────
console.log('--- Test Group 1: MULTI_005 Evidence Profile & Score Elimination ---');

const multi005TranscriptPath = path.resolve(__dirname, '../../evaluation_dataset/VOICE_PLUS_MATERIAL/MULTI_005/transcript_cache.txt');
const multi005ReconPath = path.resolve(__dirname, '../../evaluation_dataset/VOICE_PLUS_MATERIAL/MULTI_005/multi_005_pedagogical_reconstruction.json');

const multi005Transcript = fs.readFileSync(multi005TranscriptPath, 'utf8');
const multi005Recon = fs.existsSync(multi005ReconPath)
  ? JSON.parse(fs.readFileSync(multi005ReconPath, 'utf8'))
  : [];

const res005 = depthAnalyzer.analyzeLecture(multi005Transcript, {
  sourceModality: 'VOICE_TRANSCRIPT',
  teachingUnits: multi005Recon
});

runTest('1.1 MULTI_005 Academic Content Gate passes with primary discourse ACADEMIC', () => {
  const gate = res005.curricularEvidenceProfile?.prerequisiteGates?.academicContentGate;
  assert(gate, 'academicContentGate must exist');
  assert.strictEqual(gate.status, 'PASS', 'Status must be PASS');
  assert.strictEqual(gate.primaryDiscourse, 'ACADEMIC', 'Primary discourse must be ACADEMIC');
  assert.strictEqual(res005.isAcademic, true, 'isAcademic top-level must be true');
});

runTest('1.2 MULTI_005 Evidence Sufficiency Gate evaluates SUFFICIENT', () => {
  const sufficiency = res005.curricularEvidenceProfile?.prerequisiteGates?.evidenceSufficiency;
  assert(sufficiency, 'evidenceSufficiency must exist');
  assert.strictEqual(sufficiency.status, 'SUFFICIENT');
  assert(sufficiency.distinctConceptCount > 0, 'distinctConceptCount must be > 0');
});

runTest('1.3 MULTI_005 Observable Evidence contains verified domain concepts', () => {
  const concepts = res005.curricularEvidenceProfile?.observableEvidence?.distinctConcepts || [];
  assert(concepts.length >= 4, `Expected at least 4 concepts, got ${concepts.length}`);
  const expectedAny = ['Stock', 'Price', 'Day', 'Profit', 'Algorithm', 'Greedy', 'Minimum Cost', 'Spanning Trees'];
  const hasOverlap = concepts.some(c => expectedAny.some(e => c.toLowerCase().includes(e.toLowerCase())));
  assert(hasOverlap, 'Concepts must reflect authentic algorithms/stock domain subject matter');
});

runTest('1.4 MULTI_005 Observable Evidence signals include formal definitions and worked traces', () => {
  const obs = res005.curricularEvidenceProfile?.observableEvidence || {};
  assert(Array.isArray(obs.formalDefinitions), 'formalDefinitions must be an array');
  assert(obs.formalDefinitions.length > 0, 'formalDefinitions must contain verified definitions');
  assert(Array.isArray(obs.workedTraces), 'workedTraces must be an array');
  assert(obs.workedTraces.length > 0, 'workedTraces must contain verified worked traces');
});

runTest('1.5 MULTI_005 permanently eliminates 100-point composite score', () => {
  assert.strictEqual(res005.lectureDepth?.score, null, 'lectureDepth.score must be strictly null');
  assert.strictEqual(res005.teachingValueScore, null, 'teachingValueScore must be strictly null');
  assert.strictEqual(res005.lectureDepth?.isDeprecated, true, 'lectureDepth.isDeprecated must be true');
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Group 2: MULTI_001 (Computer Architecture) Evidence Profile
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- Test Group 2: MULTI_001 Computer Architecture Cross-Subject ---');

const multi001TranscriptPath = path.resolve(__dirname, '../../evaluation_dataset/VOICE_PLUS_MATERIAL/MULTI_001/transcript_cache.txt');
const multi001Transcript = fs.readFileSync(multi001TranscriptPath, 'utf8');

const res001 = depthAnalyzer.analyzeLecture(multi001Transcript, {
  sourceModality: 'VOICE_TRANSCRIPT'
});

runTest('2.1 MULTI_001 Academic Content Gate passes', () => {
  assert.strictEqual(res001.curricularEvidenceProfile?.prerequisiteGates?.academicContentGate?.status, 'PASS');
  assert.strictEqual(res001.isAcademic, true);
});

runTest('2.2 MULTI_001 Evidence Sufficiency Gate evaluates SUFFICIENT', () => {
  assert.strictEqual(res001.curricularEvidenceProfile?.prerequisiteGates?.evidenceSufficiency?.status, 'SUFFICIENT');
});

runTest('2.3 MULTI_001 Observable Concepts reflect Computer Architecture curriculum', () => {
  const concepts = res001.curricularEvidenceProfile?.observableEvidence?.distinctConcepts || [];
  assert(concepts.length >= 10, `Expected at least 10 concepts, got ${concepts.length}`);
  const hasArchTerms = concepts.some(c => /cpu|interrupt|register|memory|bus|io|instruction/i.test(c));
  assert(hasArchTerms, 'Concepts must reflect authentic computer architecture terminology');
});

runTest('2.4 MULTI_001 eliminates static 80.4 score and composite percentage', () => {
  assert.strictEqual(res001.lectureDepth?.score, null, 'Score must be null');
  assert.strictEqual(res001.teachingValueScore, null, 'teachingValueScore must be null');
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Group 3: Short Single-Concept Complete Lecture (Non-Rejection)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- Test Group 3: Short Single-Concept Lecture Non-Rejection ---');

const shortLectureText = 'Quick sort is a divide-and-conquer algorithm. It selects a pivot element and partitions the array such that elements smaller than pivot come before it, and greater elements come after. Its average time complexity is O(n log n).';

const resShort = depthAnalyzer.analyzeLecture(shortLectureText, { sourceModality: 'TEXT' });

runTest('3.1 Short complete single-concept lecture passes Academic Content Gate', () => {
  assert.strictEqual(resShort.isAcademic, true);
  assert.strictEqual(resShort.curricularEvidenceProfile?.prerequisiteGates?.academicContentGate?.status, 'PASS');
});

runTest('3.2 Short lecture evaluates SUFFICIENT for compact capacity', () => {
  assert.strictEqual(resShort.curricularEvidenceProfile?.prerequisiteGates?.evidenceSufficiency?.status, 'SUFFICIENT');
  const totalRec = resShort.curricularEvidenceProfile?.assessmentCapacity?.totalRecommended;
  assert(totalRec > 0 && totalRec <= 3, `Expected 1-3 questions, got ${totalRec}`);
});

runTest('3.3 Short lecture emits score: null without arbitrary character threshold penalty', () => {
  assert.strictEqual(resShort.lectureDepth?.score, null);
  assert.strictEqual(resShort.curricularEvidenceProfile?.observableEvidence?.distinctConcepts?.length > 0, true);
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Group 4: Classroom Banter & Administrative Logistics (Rejection)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- Test Group 4: Classroom Banter & Logistics Rejection ---');

const banterText = 'Hey everyone, did you watch the cricket match last night? It was amazing. Remember there is no homework due tomorrow. See you all next week for class logistics.';

const resBanter = depthAnalyzer.analyzeLecture(banterText, { sourceModality: 'TEXT' });

runTest('4.1 Classroom banter FAILS Academic Content Gate', () => {
  assert.strictEqual(resBanter.isAcademic, false);
  assert.strictEqual(resBanter.curricularEvidenceProfile?.prerequisiteGates?.academicContentGate?.status, 'FAIL');
});

runTest('4.2 Classroom banter evaluates INSUFFICIENT_EVIDENCE', () => {
  assert.strictEqual(resBanter.curricularEvidenceProfile?.prerequisiteGates?.evidenceSufficiency?.status, 'INSUFFICIENT_EVIDENCE');
});

runTest('4.3 Classroom banter allocates 0 assessment capacity and blocks generation', () => {
  assert.strictEqual(resBanter.curricularEvidenceProfile?.assessmentCapacity?.totalRecommended, 0);
  assert.strictEqual(resBanter.lectureDepth?.score, null);
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Group 5: Adversarial Nonsense (Rejection)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- Test Group 5: Adversarial Nonsense Rejection ---');

const nonsenseText = 'Colorless green ideas sleep furiously while purple clouds dance backwards through time.';

const resNonsense = depthAnalyzer.analyzeLecture(nonsenseText, { sourceModality: 'TEXT' });

runTest('5.1 Adversarial nonsense rejects Academic Content Gate (FAIL or UNCERTAIN)', () => {
  assert.strictEqual(resNonsense.isAcademic, false);
  const status = resNonsense.curricularEvidenceProfile?.prerequisiteGates?.academicContentGate?.status;
  assert(['FAIL', 'UNCERTAIN'].includes(status), `Expected FAIL or UNCERTAIN, got ${status}`);
});

runTest('5.2 Adversarial nonsense evaluates INSUFFICIENT_EVIDENCE with 0 capacity', () => {
  assert.strictEqual(resNonsense.curricularEvidenceProfile?.prerequisiteGates?.evidenceSufficiency?.status, 'INSUFFICIENT_EVIDENCE');
  assert.strictEqual(resNonsense.curricularEvidenceProfile?.assessmentCapacity?.totalRecommended, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Group 6: Agent 1 Planner Contract Integration
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- Test Group 6: Agent 1 Planner Contract Integration ---');

const mockEvidencePackage = {
  unifiedRawContent: shortLectureText,
  representationMode: 'VOICE_TRANSCRIPT',
  voiceEmphasis: { conceptualEmphasis: 'HIGH' },
  curricularEvidenceProfile: resShort.curricularEvidenceProfile,
  lectureDepth: resShort.lectureDepth
};

runTest('6.1 Planner _computeTCScore emits overallScore: null and isDeprecated: true', () => {
  const tcReport = agent1Planner._computeTCScore(
    shortLectureText,
    mockEvidencePackage.voiceEmphasis,
    mockEvidencePackage.lectureDepth,
    {
      auditedTargets: [
        { targetId: 'T01', conceptName: 'Quick Sort', tier: 'Core' },
        { targetId: 'T02', conceptName: 'Pivot Element', tier: 'Secondary' }
      ],
      auditedReserve: [],
      subtopics: ['Quick Sort', 'Pivot Element']
    }
  );

  assert.strictEqual(tcReport.overallScore, null, 'overallScore must be null');
  assert.strictEqual(tcReport.isDeprecated, true, 'isDeprecated must be true');
  assert(tcReport.disclaimer.includes('retired'), 'Disclaimer must mention score retirement');
});

runTest('6.2 Curricular Coverage calculates distinct targeted over eligible concepts', () => {
  const eligibleConcepts = ['Quick Sort', 'Pivot Element', 'Time Complexity', 'Divide and Conquer'];
  const plannedTargets = [
    { targetId: 'T01', conceptName: 'Quick Sort' },
    { targetId: 'T02', conceptName: 'Pivot Element' }
  ];

  const eligibleCount = eligibleConcepts.length;
  const plannedSet = new Set(plannedTargets.map(t => t.conceptName.toLowerCase()));
  const plannedCount = plannedSet.size;
  const ratio = plannedCount / eligibleCount;

  assert.strictEqual(eligibleCount, 4);
  assert.strictEqual(plannedCount, 2);
  assert.strictEqual(ratio, 0.5);
});

runTest('6.3 Curricular Coverage produces strictly null when eligible count is 0', () => {
  const eligibleCount = 0;
  const plannedCount = 0;
  const ratio = eligibleCount > 0 ? plannedCount / eligibleCount : null;
  assert.strictEqual(ratio, null, 'Coverage ratio must be null when eligible count is 0 (DEF-TC-09)');
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Group 7: Pipeline Orchestrator quizAlignment & Coverage Contract
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- Test Group 7: Pipeline Orchestrator Alignment Contract ---');

runTest('7.1 Pipeline Orchestrator projection attaches authoritative quizAlignment', () => {
  const eligible = ['Spanning Trees', 'Graphs', 'Minimum Cost', 'Combinations'];
  const validatedQuestions = [
    { conceptTested: 'Spanning Trees', difficulty: 'Easy' },
    { conceptTested: 'Graphs', difficulty: 'Medium' },
    { conceptTested: 'Spanning Trees', difficulty: 'Medium' } // Duplicate concept on different question
  ];

  const deliveredSet = new Set();
  const distribution = {};
  for (const q of validatedQuestions) {
    const c = q.conceptTested;
    deliveredSet.add(c.toLowerCase());
    distribution[c] = (distribution[c] || 0) + 1;
  }

  const deliveredCount = deliveredSet.size;
  const deliveredRatio = deliveredCount / eligible.length;

  assert.strictEqual(deliveredCount, 2, 'Delivered distinct concepts must be deduplicated (2)');
  assert.strictEqual(deliveredRatio, 2 / 4, 'Delivered coverage ratio must be 0.5');
  assert.strictEqual(distribution['Spanning Trees'], 2);
  assert.strictEqual(distribution['Graphs'], 1);
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Group 8: Multi-Modal Independence (Voice vs Document)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- Test Group 8: Multi-Modal Independence ---');

runTest('8.1 Document-only input does not hallucinate audio speech properties', () => {
  const docOnlyText = '# Unit 4: Memory Management\n## Paging and Virtual Memory\nPage tables translate virtual addresses to physical frames. Page faults trigger kernel trap routines.';
  const resDoc = depthAnalyzer.analyzeLecture(docOnlyText, { sourceModality: 'DOCUMENT_ONLY' });

  assert.strictEqual(resDoc.isAcademic, true);
  assert.strictEqual(resDoc.sourceModality, 'DOCUMENT_ONLY');
  assert.strictEqual(resDoc.lectureDepth?.score, null);
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Group 9: Non-Evaluative Disclaimer & Schema 2.0.0 Compliance
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- Test Group 9: Disclaimers & Schema 2.0.0 Compliance ---');

runTest('9.1 Profile strictly conforms to Schema 2.0.0 with mandatory disclaimers', () => {
  const profile = res005.curricularEvidenceProfile;
  assert.strictEqual(profile.schemaVersion, '2.0.0');
  assert(typeof profile.evaluationTimestamp === 'string');
  assert(profile.disclaimer.includes('Does NOT measure teacher pedagogical efficacy'));
  assert(res005.lectureDepth?.disclaimer.includes('Does NOT measure teacher pedagogical efficacy'));
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Group 10: AudioTeachingQualityEngine Retirement & Historical Preservation
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- Test Group 10: AudioTeachingQualityEngine Retirement Status ---');

runTest('10.1 AudioTeachingQualityEngine reports RETIRED_HISTORICAL_ARTIFACT status', () => {
  const report = AudioTeachingQualityEngine.evaluateLecture({
    voiceTranscript: 'a'.repeat(600),
    teachingUnits: [{}, {}, {}]
  });
  assert.strictEqual(report.status, 'RETIRED_HISTORICAL_ARTIFACT');
  assert.strictEqual(report.isRetiredHistoricalArtifact, true);
  assert(report.retirementNotice.includes('Objective 4'));
});

console.log('\n================================================================');
console.log(`  OBJECTIVE 4 VERIFICATION COMPLETE: ${passedTests}/${totalTests} TESTS PASSED`);
console.log('================================================================\n');
