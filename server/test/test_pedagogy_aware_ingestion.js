/**
 * server/test/test_pedagogy_aware_ingestion.js
 *
 * Verification suite for Pedagogy-Aware Ingestion & Teaching-Value Classification (v4.0).
 */

const assert = require('assert');
const depthAnalyzer = require('../engine/evidence/depthAnalyzer');
const lectureAnalyzer = require('../engine/evidence/lectureAnalyzer');
const evidencePackager = require('../engine/evidence/evidencePackager');

async function runTests() {
  console.log('🧪 ====================================================================');
  console.log('🧪 RUNNING PEDAGOGY-AWARE INGESTION & TEACHING-VALUE TEST SUITE');
  console.log('🧪 ====================================================================\n');

  let passed = 0;
  let failed = 0;

  function runCheck(testName, fn) {
    try {
      fn();
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } catch (err) {
      console.error(`❌ FAIL: ${testName}`);
      console.error(`   Error: ${err.message}`);
      failed++;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Test 1: Chhota Bheem Cartoon Transcript (Must be REJECTED)
  // ──────────────────────────────────────────────────────────────────────────
  runCheck('1. Chhota Bheem cartoon transcript must be classified as OFF_TOPIC / DISCARD and rejected', () => {
    const chhotaBheemText = `
      In this episode, Professor Dhoomketu invents a lava car using special chemicals that mimic molten lava.
      The kids in Dholakpur take the remote control because the primary controls are inside the vehicle.
      Bheem and Kalia race to stop the vehicle before it crashes into the kingdom gates.
      Yuji casts a spell with the mystical amulet to defeat the monster and save Dholakpur.
    `;
    const res = depthAnalyzer.analyzeLecture(chhotaBheemText);
    assert.strictEqual(res.isAcademic, false, 'Chhota Bheem cartoon must be isAcademic: false');
    assert.strictEqual(res.isCurricular, false, 'Chhota Bheem cartoon must be isCurricular: false');
    assert.strictEqual(res.curricularSegments.length, 0, 'Must have 0 curricular segments');
    assert(res.reason.includes('cartoon') || res.reason.includes('NON_ACADEMIC_CONTENT'), 'Reason must mention non-academic/cartoon narrative');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 2: Movie Drama / Casual Sewing Dialogue (Must be REJECTED)
  // ──────────────────────────────────────────────────────────────────────────
  runCheck('2. English movie sewing drama must be classified as OFF_TOPIC / DISCARD and rejected', () => {
    const movieText = `
      I need to deliver this tomorrow, and only half of it is done, but otherwise everything is fine.
      I accidentally sewed the sleeve to the back, so I had to rip it out.
      My boyfriend called me while I was cooking dinner and told me to get ready for the party.
    `;
    const res = depthAnalyzer.analyzeLecture(movieText);
    assert.strictEqual(res.isAcademic, false, 'Movie drama must be isAcademic: false');
    assert.strictEqual(res.isCurricular, false, 'Movie drama must be isCurricular: false');
    assert.strictEqual(res.curricularSegments.length, 0, 'Must have 0 curricular segments');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 3: Teacher Experience / Production War Story (Must be RETAINED with KEEP_PARTIAL/KEEP_WHOLE)
  // ──────────────────────────────────────────────────────────────────────────
  runCheck('3. Teacher production incident (Deadlock at 2 AM) must be classified as TEACHER_EXPERIENCE and retained', () => {
    const teacherExpSeg = "Last year when I was working at a company, we had this crazy incident. We were deploying the application at 2 AM, everyone was tired, and then suddenly four processes were waiting for each other's database locks, causing a deadlock.";
    const classification = depthAnalyzer.classifySegment(teacherExpSeg);
    
    assert.strictEqual(classification.type, 'TEACHER_EXPERIENCE', 'Must be classified as TEACHER_EXPERIENCE');
    assert(classification.teaching_value >= 0.85, `Teaching value must be >= 0.85, got ${classification.teaching_value}`);
    assert(classification.action === 'KEEP_WHOLE' || classification.action === 'KEEP_PARTIAL', `Action must be KEEP_WHOLE or KEEP_PARTIAL, got ${classification.action}`);
    assert(classification.concept_links.some(c => c.toLowerCase().includes('deadlock') || c.toLowerCase().includes('database')), 'Must link to Deadlock or Database concept');
    assert(classification.evidence_text.length > 10, 'Must contain non-empty evidence text');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 4: Conceptual Analogy (Traffic Jam for Deadlock) (Must be RETAINED)
  // ──────────────────────────────────────────────────────────────────────────
  runCheck('4. Conceptual analogy (traffic gridlock for deadlock) must be classified as ANALOGY and retained', () => {
    const analogySeg = "Imagine a traffic jam where four cars arrive at a four-way intersection simultaneously and each car is waiting for the car to its left to proceed. This circular wait condition is analogous to a process deadlock.";
    const classification = depthAnalyzer.classifySegment(analogySeg);

    assert.strictEqual(classification.type, 'ANALOGY', 'Must be classified as ANALOGY');
    assert(classification.teaching_value >= 0.80, `Teaching value must be >= 0.80, got ${classification.teaching_value}`);
    assert.strictEqual(classification.action, 'KEEP_WHOLE', 'Action must be KEEP_WHOLE');
    assert(classification.concept_links.some(c => c.toLowerCase().includes('deadlock') || c.toLowerCase().includes('process')), 'Must link to Deadlock or Process');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 5: Technical Humor / Conceptual Joke (Must be RETAINED)
  // ──────────────────────────────────────────────────────────────────────────
  runCheck('5. Technical joke about SQL joins must be classified as TECHNICAL_HUMOR and retained', () => {
    const jokeSeg = "A SQL query walks into a bar, walks up to two tables and asks: Can I join you? This classic joke illustrates how relational database joins require matching foreign keys.";
    const classification = depthAnalyzer.classifySegment(jokeSeg);

    assert.strictEqual(classification.type, 'TECHNICAL_HUMOR', 'Must be classified as TECHNICAL_HUMOR');
    assert(classification.teaching_value >= 0.75, `Teaching value must be >= 0.75, got ${classification.teaching_value}`);
    assert.strictEqual(classification.action, 'KEEP_WHOLE', 'Action must be KEEP_WHOLE');
    assert(classification.concept_links.some(c => c.toLowerCase().includes('database') || c.toLowerCase().includes('sql')), 'Must link to SQL / Database');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 6: Administrative Noise (Must be DISCARDED)
  // ──────────────────────────────────────────────────────────────────────────
  runCheck('6. Administrative speech (attendance, silence) must be classified as ADMINISTRATIVE and discarded', () => {
    const adminSeg = "Good morning everyone, please sit down and stop talking. Silence in the back benches, I am taking attendance for roll numbers 1 to 50.";
    const classification = depthAnalyzer.classifySegment(adminSeg);

    assert.strictEqual(classification.type, 'ADMINISTRATIVE', 'Must be classified as ADMINISTRATIVE');
    assert.strictEqual(classification.action, 'DISCARD', 'Action must be DISCARD');
    assert(classification.teaching_value <= 0.10, `Teaching value must be <= 0.10, got ${classification.teaching_value}`);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 7: Full Lecture with Mixed Preamble, Analogy & Technical Explanation
  // ──────────────────────────────────────────────────────────────────────────
  runCheck('7. Full lecture with mixed speech, teacher experience, analogies and core concepts must pass cleanly', () => {
    const fullLecture = `
      Good morning everyone, please settle down and silence your phones.
      Today we are going to study operating system deadlocks and resource allocation graphs.
      A deadlock occurs when a set of processes are blocked because each process is holding a resource and waiting for another resource held by another process.
      Imagine a traffic jam where four cars arrive at an intersection and each car blocks the path of the next car.
      When I was working at my previous company, we hit this bug in production where two worker threads were waiting for database mutex locks, freezing the entire checkout service.
      In order to prevent deadlocks, the operating system can enforce a resource ordering protocol or use the Banker's algorithm to ensure safe state transitions.
      Submit your lab assignments by Friday at 5 PM.
    `;

    const res = depthAnalyzer.analyzeLecture(fullLecture);
    assert.strictEqual(res.isAcademic, true, 'Lecture must be isAcademic: true');
    assert.strictEqual(res.isCurricular, true, 'Lecture must be isCurricular: true');
    assert(res.detectedFocus.includes('Deadlock') || res.detectedFocus.some(f => f.toLowerCase().includes('deadlock')), 'Detected focus must include Deadlock');
    assert(res.curricularSegments.length >= 3, 'Must have at least 3 curricular segments');
    assert(res.adminSegments.length >= 2, 'Must isolate at least 2 administrative segments');
    
    // Check that evidencePackager formats annotated evidence
    const pkg = evidencePackager.packageSessionEvidence({ voiceTranscript: fullLecture });
    assert.strictEqual(pkg.isAcademic, true, 'Package must be isAcademic: true');
    assert(pkg.curricularContent.includes('Deadlock') || pkg.curricularContent.includes('deadlock'), 'Curricular content must contain Deadlock');
  });

  console.log(`\n====================================================================`);
  console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log(`====================================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution crashed:', err);
  process.exit(1);
});
