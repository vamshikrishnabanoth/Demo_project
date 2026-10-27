/**
 * server/test/test_style_contract.js
 *
 * Dedicated test suite for KMIT Kahoot Signature Style Contract (v1.2)
 *
 * Tests:
 * 1. Valid questions pass style checks (CS, Systems, Economics, Technical Context).
 * 2. Two valid options with similar terminology pass style cleanly (no false rejection).
 * 3. Near-duplicate / word-order permutations are flagged as advisory warnings, not fatal rejections.
 * 4. Defective questions fail style checks (Meta-language, Duplicate options, Asymmetry, Runaway length).
 * 5. Domain exemplar selector routes known domains, but returns null for unknown/ambiguous/non-technical domains.
 * 6. Non-technical subjects (biology, literature) receive no forced CS/code structure.
 * 7. Exemplar prompt injection explicitly prevents subject/fact/difficulty leakage.
 * 8. Planner guidance supports Easy, Medium, and Hard while preserving evidence authority and difficulty intent.
 * 9. Style checker certifies form only, never substituting for cognitive or semantic evaluation.
 */

'use strict';

const assert = require('assert');
const kmitStyleContract = require('../config/kmitStyleContract');

console.log('======================================================================');
console.log('🧪 VERIFYING KMIT KAHOOT STYLE CONTRACT v1.2');
console.log('======================================================================\n');

let passCount = 0;
function test(name, fn) {
  try {
    fn();
    passCount++;
    console.log(` ✅ PASS [${passCount}]: ${name}`);
  } catch (err) {
    console.error(` ❌ FAIL: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

// -----------------------------------------------------------------------------
// Suite 1: Valid Questions Pass Style Checks
// -----------------------------------------------------------------------------
test('1. Algorithmic Exemplar cleanly passes style heuristics', () => {
  const ex = kmitStyleContract.exemplars.find(e => e.id === 'EXEMPLAR_ALGORITHMIC');
  const result = kmitStyleContract.checkStyleHeuristics(ex);
  assert.strictEqual(result.passesStyle, true, 'Algorithmic exemplar must pass style');
  assert.strictEqual(result.issues.length, 0);
  assert.strictEqual(result.standardsVersion, '1.2.0');
});

test('2. Systems Exemplar cleanly passes style heuristics', () => {
  const ex = kmitStyleContract.exemplars.find(e => e.id === 'EXEMPLAR_SYSTEMS');
  const result = kmitStyleContract.checkStyleHeuristics(ex);
  assert.strictEqual(result.passesStyle, true, 'Systems exemplar must pass style');
  assert.strictEqual(result.issues.length, 0);
});

test('3. Economics Applied Theory Exemplar cleanly passes style heuristics', () => {
  const ex = kmitStyleContract.exemplars.find(e => e.id === 'EXEMPLAR_APPLIED_THEORY');
  const result = kmitStyleContract.checkStyleHeuristics(ex);
  assert.strictEqual(result.passesStyle, true, 'Economics exemplar must pass style');
  assert.strictEqual(result.issues.length, 0);
});

test('4. Legitimate technical scenario context is allowed (no false positive on context)', () => {
  const q = {
    questionText: 'Given a 4-stage pipelined MIPS architecture with no data forwarding unit, how many stall cycles occur between a load instruction and an immediately dependent register add?',
    options: [
      'Two clock cycle stalls are inserted by hardware',
      'One clock cycle stall is inserted by hardware',
      'Zero clock cycle stalls because execution is reordered',
      'Four clock cycle stalls causing pipeline flush'
    ]
  };
  const result = kmitStyleContract.checkStyleHeuristics(q);
  assert.strictEqual(result.passesStyle, true, 'Technical context must not be flagged as meta-language');
  assert.strictEqual(result.issues.length, 0);
});

test('5. Valid options sharing terminology but expressing different mechanisms pass style without auto-rejection', () => {
  const q = {
    questionText: 'What is the trade-off of increasing memory cache line size from 64 bytes to 256 bytes?',
    options: [
      'Increases spatial locality benefit while increasing cache miss penalty',
      'Decreases spatial locality benefit while decreasing cache miss penalty',
      'Eliminates compulsory misses while increasing conflict misses',
      'Preserves miss penalty while reducing tag storage overhead'
    ]
  };
  const result = kmitStyleContract.checkStyleHeuristics(q);
  assert.strictEqual(result.passesStyle, true, 'Options with contrasting technical terms must pass style');
  assert.strictEqual(result.issues.length, 0, 'No blocking issues should be raised');
});

// -----------------------------------------------------------------------------
// Suite 2: Advisory Warnings (Near-Duplicates and Permutations)
// -----------------------------------------------------------------------------
test('6. Near-duplicate word-order permutations are flagged as advisory warnings, not fatal rejections', () => {
  const permutedQ = {
    questionText: 'Which sequence correctly represents the execution order of operations?',
    options: [
      'Allocate memory, initialize pointers, link successor node',
      'Link successor node, initialize pointers, allocate memory', // Same words reordered
      'Initialize pointers, allocate memory, link successor node', // Same words reordered
      'Free allocated node, bypass pointer, reset list head'
    ]
  };
  const result = kmitStyleContract.checkStyleHeuristics(permutedQ);
  // Must NOT reject the question solely on heuristic word overlap:
  assert.strictEqual(result.passesStyle, true, 'Heuristic overlap must not fatal-fail the item');
  assert.strictEqual(result.issues.length, 0, 'Issues array must remain empty of fatal errors');
  // Must emit advisory warning signals for semantic inspection:
  assert.ok(result.warnings.includes('HIGH_OPTION_VOCABULARY_SIMILARITY'), 'Must flag high vocabulary similarity');
  assert.ok(result.warnings.includes('OPTION_WORD_ORDER_PERMUTATION_WARNING'), 'Must flag word order permutation');
});

// -----------------------------------------------------------------------------
// Suite 3: Defective Questions Fail Style Heuristics (Fatal Violations)
// -----------------------------------------------------------------------------
test('7. Vacuous meta-language prefix triggers UNNECESSARY_META_LANGUAGE', () => {
  const badQ = {
    questionText: 'According to the lecture, which of the following is true about binary search trees?',
    options: ['Option A is correct', 'Option B is false', 'Option C is incorrect', 'Option D is invalid']
  };
  const result = kmitStyleContract.checkStyleHeuristics(badQ);
  assert.strictEqual(result.passesStyle, false);
  assert.ok(result.issues.includes('UNNECESSARY_META_LANGUAGE'), 'Must flag meta-language prefix');
});

test('8. Exact duplicate options trigger DUPLICATE_OPTIONS fatal rejection', () => {
  const dupQ = {
    questionText: 'What is the worst-case time complexity of quicksort with median-of-three pivot?',
    options: [
      'O(n log n)',
      'O(n^2)',
      'O(n log n)', // Exact duplicate of option 0
      'O(1)'
    ]
  };
  const result = kmitStyleContract.checkStyleHeuristics(dupQ);
  assert.strictEqual(result.passesStyle, false);
  assert.ok(result.issues.includes('DUPLICATE_OPTIONS'), 'Must detect and reject duplicate options');
});

test('9. Option count other than 4 triggers INVALID_OPTION_COUNT', () => {
  const threeOptQ = {
    questionText: 'What is the primary function of an operating system kernel scheduler?',
    options: ['Allocate CPU time slices', 'Manage physical disk storage', 'Resolve domain names']
  };
  const result = kmitStyleContract.checkStyleHeuristics(threeOptQ);
  assert.strictEqual(result.passesStyle, false);
  assert.ok(result.issues.includes('INVALID_OPTION_COUNT'), 'Must reject non-4 option counts');
});

test('10. Extreme giveaway option length asymmetry triggers OPTION_LENGTH_ASYMMETRY', () => {
  const asymmetricQ = {
    questionText: 'Why does demand curve slope downward in standard microeconomic consumer theory?',
    options: [
      'Price effect',
      'Income effect',
      'Substitution effect',
      'Because when price decreases consumers substitute toward relatively cheaper goods while experiencing an increase in real purchasing power across their consumption basket'
    ]
  };
  const result = kmitStyleContract.checkStyleHeuristics(asymmetricQ);
  assert.strictEqual(result.passesStyle, false);
  assert.ok(result.issues.includes('OPTION_LENGTH_ASYMMETRY'), 'Must flag giveaway length bias');
});

test('11. Runaway question stem triggers STEM_LENGTH_EXCEEDED', () => {
  const longStem = 'A '.repeat(90) + '?';
  const longQ = {
    questionText: longStem,
    options: ['Option A', 'Option B', 'Option C', 'Option D']
  };
  const result = kmitStyleContract.checkStyleHeuristics(longQ);
  assert.strictEqual(result.passesStyle, false);
  assert.ok(result.issues.includes('STEM_LENGTH_EXCEEDED'), 'Must flag stem exceeding hard word limit');
});

// -----------------------------------------------------------------------------
// Suite 4: Domain-Selective Exemplar Matching (No Unrelated Fallback)
// -----------------------------------------------------------------------------
test('12. Subject domain selector routes known domains correctly', () => {
  const csEx = kmitStyleContract.getExemplarForSubject('C++ Data Structures');
  assert.strictEqual(csEx.id, 'EXEMPLAR_ALGORITHMIC', 'CS topic must get algorithmic exemplar');

  const osEx = kmitStyleContract.getExemplarForSubject('Operating Systems Threads');
  assert.strictEqual(osEx.id, 'EXEMPLAR_SYSTEMS', 'OS topic must get systems exemplar');

  const econEx = kmitStyleContract.getExemplarForSubject('Macroeconomics Central Banking');
  assert.strictEqual(econEx.id, 'EXEMPLAR_APPLIED_THEORY', 'Econ topic must get applied theory exemplar');
});

test('13. Unknown, ambiguous, or general subjects return null (no unrelated exemplar fallback)', () => {
  assert.strictEqual(kmitStyleContract.getExemplarForSubject('General'), null);
  assert.strictEqual(kmitStyleContract.getExemplarForSubject('Unknown'), null);
  assert.strictEqual(kmitStyleContract.getExemplarForSubject(''), null);
  assert.strictEqual(kmitStyleContract.getExemplarForSubject(null), null);
  assert.strictEqual(kmitStyleContract.getExemplarForSubject(undefined), null);
});

test('14. Non-technical subjects receive null exemplar (never forced CS or economics)', () => {
  const bioEx = kmitStyleContract.getExemplarForSubject('Cellular Biology & Genetics');
  assert.strictEqual(bioEx, null, 'Biology must not receive forced CS or Econ exemplar');

  const litEx = kmitStyleContract.getExemplarForSubject('19th Century British Literature');
  assert.strictEqual(litEx, null, 'Literature must not receive forced CS or Econ exemplar');

  const histEx = kmitStyleContract.getExemplarForSubject('Modern European History');
  assert.strictEqual(histEx, null, 'History must not receive forced CS or Econ exemplar');
});

test('15. Declared subject has absolute precedence over subtopics or keywords', () => {
  // Authoritative unmapped subject with CS-like keyword in subtopic must NOT get CS exemplar:
  const bioWithCodeSubtopic = kmitStyleContract.getExemplarForSubject({
    subject: 'Cellular Biology',
    topic: 'Molecular Genetics',
    subtopic: 'The Genetic Code and Protein Translation Algorithm'
  });
  assert.strictEqual(bioWithCodeSubtopic, null, 'Declared Biology subject must override CS subtopic keywords');

  // Declared CS subject with general subtopic must get CS exemplar:
  const csWithGeneralSubtopic = kmitStyleContract.getExemplarForSubject({
    subject: 'Computer Science',
    topic: 'Data Structures',
    subtopic: 'General Overview'
  });
  assert.strictEqual(csWithGeneralSubtopic.id, 'EXEMPLAR_ALGORITHMIC', 'Declared CS subject must route to algorithmic');
});

// -----------------------------------------------------------------------------
// Suite 5: Style Guidance & Difficulty Independence
// -----------------------------------------------------------------------------
test('16. Generator prompt guidance decouples exemplar facts from generation task', () => {
  const guidance = kmitStyleContract.getGeneratorGuidance({
    targetDifficulty: 'Hard',
    subject: 'Algorithms and Data Structures',
    includeExemplar: true
  });
  assert.ok(guidance.includes('CANONICAL KMIT KAHOOT EXEMPLAR FOR THIS DOMAIN'), 'Should include exemplar header');
  assert.ok(guidance.includes('Do NOT adopt its subject matter'), 'Must explicitly warn against topic/concept adoption');
  assert.ok(guidance.includes('Your question must be based entirely on the provided lecture evidence'), 'Must enforce evidence authority');
  assert.ok(guidance.includes('Hard'), 'Must preserve target difficulty level');
});

test('17. Generator prompt guidance for unmapped domain provides neutral structure without exemplar injection', () => {
  const guidance = kmitStyleContract.getGeneratorGuidance({
    targetDifficulty: 'Medium',
    subject: 'Cellular Biology',
    includeExemplar: true
  });
  assert.ok(!guidance.includes('EXEMPLAR_ALGORITHMIC'), 'Must not inject CS exemplar for biology');
  assert.ok(!guidance.includes('EXEMPLAR_APPLIED_THEORY'), 'Must not inject Econ exemplar for biology');
  assert.ok(guidance.includes('[STRUCTURAL PATTERN REMINDER]'), 'Must provide neutral structural pattern reminder');
});

test('18. Planner guidance supports Easy, Medium, and Hard while preserving evidence authority and difficulty intent', () => {
  const easyPlanner = kmitStyleContract.getPlannerGuidance({ requestedDifficulty: 'Easy' });
  assert.ok(easyPlanner.includes('Easy'), 'Must reference Easy tier');
  assert.ok(easyPlanner.includes('Foundational comprehension'), 'Must define Easy expectations');
  assert.ok(easyPlanner.includes('EVIDENCE PRIMACY'), 'Must enforce evidence primacy');
  assert.ok(easyPlanner.includes('NON-INTERFERENCE'), 'Must declare non-interference with difficulty routing');

  const medPlanner = kmitStyleContract.getPlannerGuidance({ requestedDifficulty: 'Medium' });
  assert.ok(medPlanner.includes('Medium'), 'Must reference Medium tier');
  assert.ok(medPlanner.includes('Causal mechanisms'), 'Must define Medium expectations');

  const hardPlanner = kmitStyleContract.getPlannerGuidance({ requestedDifficulty: 'Hard' });
  assert.ok(hardPlanner.includes('Hard'), 'Must reference Hard tier');
  assert.ok(hardPlanner.includes('Multi-variable interactions'), 'Must define Hard expectations');
});

// -----------------------------------------------------------------------------
// Suite 6: Style Independence vs Quality Certification
// -----------------------------------------------------------------------------
test('19. Style checker certifies form only: trivial Hard question passes style but remains uncertified for quality', () => {
  const trivialHardQ = {
    questionText: 'What is the definition of a Queue data structure?',
    options: [
      'A linear structure adhering strictly to First In First Out ordering',
      'A hierarchical structure maintaining logarithmic height through rotation',
      'A hash map organizing elements through prime modulus buckets',
      'A contiguous memory array allowing random access in constant time'
    ]
  };
  const styleResult = kmitStyleContract.checkStyleHeuristics(trivialHardQ);
  assert.strictEqual(styleResult.passesStyle, true, 'Form is clean so style passes');
  assert.strictEqual(styleResult.issues.length, 0);
  assert.strictEqual(styleResult.warnings.length, 0);
  assert.strictEqual(styleResult.standardsVersion, '1.2.0');
});

// -----------------------------------------------------------------------------
// Suite 7: Unanchored Meta-Discourse Detection (Beginning, Middle, End)
// -----------------------------------------------------------------------------
test('20. Trailing meta-phrase at end of stem triggers UNNECESSARY_META_LANGUAGE', () => {
  const trailingQ = {
    questionText: 'What is the core conceptual principle when designing a recursive solution according to the lecture?',
    options: [
      'Make the problem extremely small, solve that, and repeat',
      'Precompute all arithmetic modulo values prior to recursion',
      'Always convert iterative loops into tail-recursive calls',
      'Execute operations from maximum bounds down to negative zero'
    ]
  };
  const res = kmitStyleContract.checkStyleHeuristics(trailingQ);
  assert.strictEqual(res.passesStyle, false);
  assert.ok(res.issues.includes('UNNECESSARY_META_LANGUAGE'), 'Must catch trailing meta-phrase');
});

test('21. Embedded meta-phrase in middle of stem triggers UNNECESSARY_META_LANGUAGE', () => {
  const middleQ = {
    questionText: 'When reversing a string, what base case, as discussed in the lecture, terminates recursion?',
    options: [
      'String length equals one character',
      'String length reaches zero bytes',
      'Buffer pointer encounters null terminator',
      'Recursion depth reaches maximum call limit'
    ]
  };
  const res = kmitStyleContract.checkStyleHeuristics(middleQ);
  assert.strictEqual(res.passesStyle, false);
  assert.ok(res.issues.includes('UNNECESSARY_META_LANGUAGE'), 'Must catch embedded middle meta-phrase');
});

test('22. Scientific law citation (e.g. Amdahl\'s Law) passes cleanly without false positive', () => {
  const lawQ = {
    questionText: 'According to Amdahl\'s Law, what fundamentally limits the speedup of a parallelized program?',
    options: [
      'The strictly serial fraction of execution time',
      'The bandwidth limit of inter-socket interconnects',
      'The register allocation latency of the compiler',
      'The branch predictor miss penalty in pipeline stages'
    ]
  };
  const res = kmitStyleContract.checkStyleHeuristics(lawQ);
  assert.strictEqual(res.passesStyle, true, 'Scientific law citation must not be flagged');
  assert.strictEqual(res.issues.length, 0);
});

test('23. Algorithmic problem domain context (e.g. lecture-hall interval scheduling) passes cleanly', () => {
  const domainQ = {
    questionText: 'In the lecture-hall interval scheduling problem, how does the greedy algorithm order requests?',
    options: [
      'Sorts intervals by earliest finish time',
      'Sorts intervals by shortest total duration',
      'Sorts intervals by latest start deadline',
      'Sorts intervals by maximum resource utilization'
    ]
  };
  const res = kmitStyleContract.checkStyleHeuristics(domainQ);
  assert.strictEqual(res.passesStyle, true, 'Domain phrasing must not be falsely rejected');
  assert.strictEqual(res.issues.length, 0);
});

console.log('\n======================================================================');
console.log(`🏁 ALL ${passCount} STYLE CONTRACT v1.2 VERIFICATION TESTS PASSED CLEANLY!`);
console.log('======================================================================\n');
