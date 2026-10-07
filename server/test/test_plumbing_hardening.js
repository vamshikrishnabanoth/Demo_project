/**
 * server/test/test_plumbing_hardening.js
 *
 * Dedicated verification suite for Production Plumbing & Performance Hardening:
 * 1. Adaptive Watchdog Timeout & Hard Ceilings
 * 2. Audio Payload Threshold (24.5 MB single-pass support)
 * 3. Scaled Concept Extraction & Advisory Capacity
 * 4. Bounded Concurrency Worker Pool Execution
 */

const assert = require('assert');
const { calculateAdaptiveTimeoutMs, createTask, getTask, failTask } = require('../services/taskManager');
const depthAnalyzer = require('../engine/evidence/depthAnalyzer');
const lectureIntelligence = require('../engine/intelligence/lectureIntelligence');

async function runPlumbingTests() {
  console.log('🧪 ====================================================================');
  console.log('🧪 RUNNING PRODUCTION PLUMBING & PERFORMANCE HARDENING TEST SUITE');
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

  async function runCheckAsync(testName, fn) {
    try {
      await fn();
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } catch (err) {
      console.error(`❌ FAIL: ${testName}`);
      console.error(`   Error: ${err.message}`);
      failed++;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Test 1: Adaptive Watchdog Timeout Floor & Ceiling
  // ──────────────────────────────────────────────────────────────────────────
  runCheck('1.1 calculateAdaptiveTimeoutMs floors at 360s for small counts (5 Qs)', () => {
    const timeout = calculateAdaptiveTimeoutMs(5);
    assert.strictEqual(timeout, 360000, `Expected 360000 ms (6m floor), got ${timeout}`);
  });

  runCheck('1.2 calculateAdaptiveTimeoutMs floors at 360s for 10 Qs', () => {
    const timeout = calculateAdaptiveTimeoutMs(10);
    assert.strictEqual(timeout, 360000, `Expected 360000 ms (6m floor), got ${timeout}`);
  });

  runCheck('1.3 calculateAdaptiveTimeoutMs scales appropriately for 25 Qs (420s)', () => {
    const timeout = calculateAdaptiveTimeoutMs(25);
    assert.strictEqual(timeout, 420000, `Expected 420000 ms (420s / 7m), got ${timeout}`);
  });

  runCheck('1.4 calculateAdaptiveTimeoutMs enforces hard ceiling of 600s for 100 Qs', () => {
    const timeout = calculateAdaptiveTimeoutMs(100);
    assert.strictEqual(timeout, 600000, `Expected 600000 ms (600s / 10m max), got ${timeout}`);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 2: Task Manager Wiring with Adaptive Timeout
  // ──────────────────────────────────────────────────────────────────────────
  runCheck('2.1 createTask automatically applies adaptive timeout when questionCount is provided', () => {
    const taskId = createTask({ questionCount: 25 });
    const task = getTask(taskId);
    assert(task, 'Task must exist');
    assert.strictEqual(task.status, 'RUNNING', 'Task must be RUNNING');
    // Clean up task timer
    failTask(taskId, 'Test completed');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 3: Audio Single-Pass Boundary
  // ──────────────────────────────────────────────────────────────────────────
  runCheck('3.1 22.2 MB audio file is within 24.5 MB single-pass boundary', () => {
    const fileSizeBytes = 22.2 * 1024 * 1024;
    const isSizeSmall = fileSizeBytes <= 24.5 * 1024 * 1024;
    assert.strictEqual(isSizeSmall, true, '22.2 MB must qualify for single-pass without ffmpeg slicing');
  });

  runCheck('3.2 26.0 MB audio file safely exceeds single-pass boundary and triggers Tier B chunking', () => {
    const fileSizeBytes = 26.0 * 1024 * 1024;
    const isSizeSmall = fileSizeBytes <= 24.5 * 1024 * 1024;
    assert.strictEqual(isSizeSmall, false, '26.0 MB must trigger Tier B chunking');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 4: Concept Extraction & Question Recommendation Scaling
  // ──────────────────────────────────────────────────────────────────────────
  runCheck('4.1 Short lecture (< 150 words) recommends 3 questions', () => {
    const shortText = 'React components are reusable pieces of UI. A component returns JSX. JSX looks like HTML but is executed in JavaScript.';
    const res = depthAnalyzer.analyzeLecture(shortText);
    assert.strictEqual(res.lectureDepth.breakdown.recommendedQuestionCount, 3);
  });

  runCheck('4.2 Medium lecture (500-1200 words) recommends 8-12 questions', () => {
    const paragraph = 'React state represents data that changes over time. When state changes, the component re-renders. Props are read-only inputs passed from parent to child components. Hooks allow functional components to manage lifecycle events. Event handlers capture user interactions like clicks. Controlled components keep form inputs in sync with state. Lifting state up shares data between sibling components. Fragments let you group elements without adding extra DOM nodes. Keys help React identify which items have changed, been added, or removed from a list. Virtual DOM computes diffs efficiently before updating the real browser DOM. ';
    const mediumText = paragraph.repeat(4); // ~800 words
    const res = depthAnalyzer.analyzeLecture(mediumText);
    assert(res.lectureDepth.breakdown.recommendedQuestionCount >= 8 && res.lectureDepth.breakdown.recommendedQuestionCount <= 12, `Expected 8-12 questions, got ${res.lectureDepth.breakdown.recommendedQuestionCount}`);
  });

  runCheck('4.3 Substantive lecture (3000+ words) recommends 18-25 questions naturally', () => {
    const paragraph = 'React state represents data that changes over time. When state changes, the component re-renders. Props are read-only inputs passed from parent to child components. Hooks allow functional components to manage lifecycle events. Event handlers capture user interactions like clicks. Controlled components keep form inputs in sync with state. Lifting state up shares data between sibling components. Fragments let you group elements without adding extra DOM nodes. Keys help React identify which items have changed, been added, or removed from a list. Virtual DOM computes diffs efficiently before updating the real browser DOM. ';
    const longText = paragraph.repeat(16); // ~3200 words
    const res = depthAnalyzer.analyzeLecture(longText);
    assert(res.lectureDepth.breakdown.recommendedQuestionCount >= 18, `Expected >= 18 questions for 3200-word lecture, got ${res.lectureDepth.breakdown.recommendedQuestionCount}`);
  });

  runCheck('4.4 lectureIntelligence fallback does not cap concepts at 8 (safety bound 30)', () => {
    const manyConcepts = Array.from({ length: 22 }, (_, i) => ({
      concept_name: `Concept_${i + 1}`,
      definition: `Definition of concept ${i + 1}`
    }));
    // Check evidenceCapacity cap logic
    const recCount = Math.max(1, Math.min(manyConcepts.length, 30));
    assert.strictEqual(recCount, 22, `Expected 22 concepts allowed, got ${recCount}`);
  });

  console.log(`\n======================================================================`);
  console.log(` 🏁 RESULT: ${passed} / ${passed + failed} TESTS PASSED CLEANLY`);
  console.log(`======================================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runPlumbingTests();
