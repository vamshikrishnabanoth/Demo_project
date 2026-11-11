const assert = require('assert');
const fs = require('fs');
const path = require('path');
const depthAnalyzer = require('../engine/evidence/depthAnalyzer');

console.log('========================================================================');
console.log('🧪 REMEDIATION 1 REGRESSION SUITE: ACADEMIC DISCOURSE GATING');
console.log('========================================================================\n');

let passed = 0;
let total = 0;

function runCheck(name, fn) {
  total++;
  try {
    fn();
    console.log(` ✅ PASS [${total}]: ${name}`);
    passed++;
  } catch (err) {
    console.error(` ❌ FAIL [${total}]: ${name}`);
    console.error(`    Error: ${err.message}`);
    process.exitCode = 1;
  }
}

// Test 1: Lecture 4 Banter
runCheck('1. Classroom Banter classified as NON_ACADEMIC with 0 curricular segments', () => {
  const banter = `What Manish? Did you learn something or nothing? Hey Manish. No, no, no, today we are not doing any class. Let's talk about the weekend. Did you see the cricket match yesterday? India played really well, what a shot by Kohli. By the way, how many people in this class will actually pass the exam? Maybe 75 to 80 percent, the rest of you need to study. Manish, why are you always sitting in the last row laughing? Keep your mouth shut Manish. Okay guys, tomorrow is a holiday, enjoy your weekend, no homework today.`;
  const res = depthAnalyzer.analyzeLecture(banter);
  assert.strictEqual(res.isAcademic, false, `Expected isAcademic to be false, got ${res.isAcademic}`);
  assert.strictEqual(res.academicClassification, 'NON_ACADEMIC', `Expected academicClassification to be NON_ACADEMIC, got ${res.academicClassification}`);
  assert.strictEqual(res.curricularSegments.length, 0, `Expected 0 curricular segments, got ${res.curricularSegments.length}`);
});

// Test 2: Plain-English Search Explanation (Zero technical jargon)
runCheck('2. Plain-English Search with zero technical jargon preserved as ACADEMIC via instructional mechanism', () => {
  const plainEnglish = `If we divide the list in half and compare our target with the middle item, then we only need to search the left half. In contrast to checking every single item from start to finish, this cuts the remaining items in half at each step.`;
  const res = depthAnalyzer.analyzeLecture(plainEnglish);
  assert.strictEqual(res.isAcademic, true, `Expected isAcademic to be true, got ${res.isAcademic}`);
  assert.strictEqual(res.academicClassification, 'ACADEMIC', `Expected academicClassification to be ACADEMIC, got ${res.academicClassification}`);
  assert(res.curricularSegments.length >= 1, `Expected at least 1 curricular segment, got ${res.curricularSegments.length}`);
});

// Test 3: Administrative Banter with academic words
runCheck('3. Administrative announcements with academic words rejected as NON_ACADEMIC', () => {
  const admin = `Tomorrow is your math exam, so everyone must submit their homework on time and be present in class. Do not forget to bring your calculators and identity cards.`;
  const res = depthAnalyzer.analyzeLecture(admin);
  assert.strictEqual(res.isAcademic, false, `Expected isAcademic to be false for administrative chatter, got ${res.isAcademic}`);
  assert.strictEqual(res.curricularSegments.length, 0, `Expected 0 curricular segments, got ${res.curricularSegments.length}`);
});

// Test 4: Introductory Computer Science (BST)
runCheck('4. Standard Computer Science curriculum preserved as ACADEMIC', () => {
  const bst = `In a binary search tree, the left subtree of a node contains only keys lesser than the node's key, and the right subtree contains only keys greater than the node's key.`;
  const res = depthAnalyzer.analyzeLecture(bst);
  assert.strictEqual(res.isAcademic, true, `Expected isAcademic to be true, got ${res.isAcademic}`);
  assert.strictEqual(res.academicClassification, 'ACADEMIC', `Expected academicClassification to be ACADEMIC, got ${res.academicClassification}`);
  assert(res.curricularSegments.length >= 1, `Expected at least 1 curricular segment, got ${res.curricularSegments.length}`);
});

// Test 5: Invariant - Zero hardcoded personal names in depthAnalyzer source
runCheck('5. Invariant check: depthAnalyzer.js contains zero hardcoded names (Manish, Kohli)', () => {
  const src = fs.readFileSync(path.join(__dirname, '../engine/evidence/depthAnalyzer.js'), 'utf8');
  assert(!/\bmanish\b/i.test(src), 'Found hardcoded "manish" in depthAnalyzer.js source!');
  assert(!/\bkohli\b/i.test(src), 'Found hardcoded "kohli" in depthAnalyzer.js source!');
});

// Test 6: Edge Case MIX-2 - Administrative introduction followed by genuine academic explanation
runCheck('6. MIX-2: Administrative intro ("listen carefully") followed by deadlock definition preserves academic content', () => {
  const mix2 = `I know you guys are tired after lunch, but listen carefully: a deadlock happens when two processes each hold a resource that the other process requires to proceed.`;
  const res = depthAnalyzer.analyzeLecture(mix2);
  assert.strictEqual(res.isAcademic, true, `Expected isAcademic to be true, got ${res.isAcademic}`);
  assert.strictEqual(res.academicClassification, 'ACADEMIC', `Expected academicClassification to be ACADEMIC, got ${res.academicClassification}`);
  assert(res.curricularSegments.length >= 1, `Expected at least 1 curricular segment, got ${res.curricularSegments.length}`);
});

// Test 7: Edge Case BANTER-4 - Casual tea break announcement mentioning continuous classes
runCheck('7. BANTER-4: Casual tea break announcement mentioning continuous classes rejected as NON_ACADEMIC', () => {
  const banter4 = `Let's take a ten minute tea break at the canteen because everyone looks exhausted after the continuous classes.`;
  const res = depthAnalyzer.analyzeLecture(banter4);
  assert.strictEqual(res.isAcademic, false, `Expected isAcademic to be false for casual tea break announcement, got ${res.isAcademic}`);
  assert.strictEqual(res.academicClassification, 'NON_ACADEMIC', `Expected academicClassification to be NON_ACADEMIC, got ${res.academicClassification}`);
  assert.strictEqual(res.curricularSegments.length, 0, `Expected 0 curricular segments, got ${res.curricularSegments.length}`);
});

console.log('\n========================================================================');
console.log(`🏁 TEST SUMMARY: ${passed} / ${total} TESTS PASSED CLEANLY (${Math.round((passed / total) * 100)}%)`);
console.log('========================================================================\n');

if (passed !== total) {
  process.exit(1);
}
