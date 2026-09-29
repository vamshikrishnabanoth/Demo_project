/**
 * server/test/test_option_exclusivity_gate.js
 *
 * Expanded Adversarial Contract Tests for Option-Relationship Ambiguity Detector.
 * Validates exact 4-way classification:
 * - POTENTIAL_MULTI_KEY (Must Reject)
 * - NO_NESTING (Must Allow: Non-additive structural containment, math subexpressions, control flow)
 * - EXPLICITLY_DISCRIMINATED (Must Allow: Explicitly distinguished by stem context)
 */

'use strict';

const deterministicValidator = require('../engine/validators/deterministicValidator');

console.log('=== TEST: EXPANDED ADVERSARIAL OPTION AMBIGUITY DETECTOR (12 CASES) ===\n');

let passedTests = 0;
let totalTests = 0;

function runTestCase(id, name, stem, options, correctAnswer, expectedClassification) {
  totalTests++;
  const result = deterministicValidator.detectOptionAmbiguity(stem, options, correctAnswer);
  const passed = result.classification === expectedClassification;
  
  if (passed) {
    passedTests++;
    console.log(`[PASS] Case ${id}: ${name}`);
    console.log(`       Classification: ${result.classification}`);
  } else {
    console.error(`[FAIL] Case ${id}: ${name}`);
    console.error(`       Expected: ${expectedClassification}`);
    console.error(`       Actual:   ${result.classification}`);
    console.error(`       Reason:   ${result.reason}`);
    console.error(`       Pair:     ${JSON.stringify(result.offendingPair)}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY 1: POTENTIAL_MULTI_KEY — MUST REJECT (1 - 4)
// ─────────────────────────────────────────────────────────────────────────────

// 1. git init vs git init --bare, with no mode distinction in the stem
runTestCase(
  1,
  'git init vs git init --bare (no mode distinction in stem)',
  'Which command initializes a new Git repository?',
  ['git init', 'git init --bare', 'git start', 'git create'],
  'git init',
  'POTENTIAL_MULTI_KEY'
);

// 2. git config user.email "x" vs the same command with --global, with no scope distinction in the stem
runTestCase(
  2,
  'git config email vs --global (no scope distinction in stem)',
  'Which command sets the user email in Git?',
  [
    'git config user.email "you@example.com"',
    'git config user.email "you@example.com" --global',
    'git set email "you@example.com"',
    'git email init'
  ],
  'git config user.email "you@example.com"',
  'POTENTIAL_MULTI_KEY'
);

// 3. mongoimport ... --file=products.json vs the same command with --jsonArray, with no format distinction in the stem
runTestCase(
  3,
  'mongoimport base vs --jsonArray (no format distinction in stem)',
  'Which command imports data from products.json into the products collection?',
  [
    'mongoimport --db test --collection products --file products.json',
    'mongoimport --db test --collection products --file products.json --jsonArray',
    'mongoimport --db test',
    'mongoimport products.json'
  ],
  'mongoimport --db test --collection products --file products.json',
  'POTENTIAL_MULTI_KEY'
);

// 4. MongoDB local connection vs Atlas URI when the stem does not distinguish the environment
runTestCase(
  4,
  'mongoimport local vs Atlas URI (no environment distinction in stem)',
  'Which command imports products.json into the products collection using mongoimport?',
  [
    'mongoimport --db ecommerce --collection=products --file=products.json --jsonArray',
    'mongoimport --uri="mongodb+srv://..." --db=ecommerce --collection=products --file=products.json --jsonArray',
    'mongoimport --db ecommerce',
    'mongoimport file.json'
  ],
  'mongoimport --db ecommerce --collection=products --file=products.json --jsonArray',
  'POTENTIAL_MULTI_KEY'
);

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY 2: NO_NESTING — MUST ALLOW (5 - 9)
// ─────────────────────────────────────────────────────────────────────────────

// 5. b == 0 vs a % b == 0 (Operator-spliced arithmetic subexpression)
runTestCase(
  5,
  'b == 0 vs a % b == 0 (Arithmetic operator splicing exclusion)',
  'In the Euclidean algorithm for greatest common divisor, which condition terminates the recursive step?',
  ['b == 0', 'a % b == 0', 'a == b', 'b > a'],
  'b == 0',
  'NO_NESTING'
);

// 6. a == 0 vs if (a == 0) return; (Control flow enclosure)
runTestCase(
  6,
  'a == 0 vs if (a == 0) return; (Control flow statement enclosure)',
  'In a recursive tree traversal, which statement terminates execution when the node pointer is null?',
  ['a == 0', 'if (a == 0) return;', 'a != 0', 'return a;'],
  'if (a == 0) return;',
  'NO_NESTING'
);

// 7. x + y vs x + y + z (Arithmetic operator chain)
runTestCase(
  7,
  'x + y vs x + y + z (Arithmetic operator chain exclusion)',
  'Which expression represents the sum of all three variables x, y, and z?',
  ['x + y', 'x + y + z', 'x * y * z', 'x - y - z'],
  'x + y + z',
  'NO_NESTING'
);

// 8. FIFO vs LRU vs Optimal vs Clock (Disparate concept options)
runTestCase(
  8,
  'FIFO vs LRU vs Optimal vs Clock (Disparate options, zero containment)',
  'Which page replacement algorithm evicts the page that arrived earliest in physical memory?',
  ['FIFO', 'LRU', 'Optimal Replacement', 'Second-Chance (Clock)'],
  'FIFO',
  'NO_NESTING'
);

// 9. git init vs git init space (Speech / syntax corruption, not option parameter subsumption)
runTestCase(
  9,
  'git init vs git init space (Syntax corruption, not parameter subsumption)',
  'Which command is used to convert the folder named "sample example" into a Git repository?',
  ['git init space', 'git repository init', 'git space init', 'git init'],
  'git init',
  'NO_NESTING'
);

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY 3: EXPLICITLY_DISCRIMINATED — MUST ALLOW (10 - 12)
// ─────────────────────────────────────────────────────────────────────────────

// 10. git init vs git init --bare, when the stem explicitly asks about bare mode
runTestCase(
  10,
  'git init vs git init --bare (Bare mode explicitly requested in stem)',
  'Which command initializes an empty Git repository in bare mode without a working tree?',
  ['git init', 'git init --bare', 'git clone --bare', 'git start --bare'],
  'git init --bare',
  'EXPLICITLY_DISCRIMINATED'
);

// 11. git config ... vs ... --global, when the stem explicitly asks about global configuration
runTestCase(
  11,
  'git config email vs --global (Global scope explicitly requested in stem)',
  'Which command configures the user email globally across all repositories on the local system?',
  [
    'git config user.email "you@example.com"',
    'git config user.email "you@example.com" --global',
    'git config --system user.email "you@example.com"',
    'git config --local user.email "you@example.com"'
  ],
  'git config user.email "you@example.com" --global',
  'EXPLICITLY_DISCRIMINATED'
);

// 12. mongoexport ... vs ... --jsonArray, when the stem explicitly asks for JSON-array output
runTestCase(
  12,
  'mongoexport vs --jsonArray (JSON array format explicitly requested in stem)',
  'Which mongoexport command exports data from the products collection formatted as a JSON array?',
  [
    'mongoexport --db ecommerce --collection=products --out=product.json',
    'mongoexport --db ecommerce --collection=products --out=product.json --jsonArray',
    'mongoexport --db ecommerce --collection=products --type=csv',
    'mongoexport --db ecommerce --collection=products --fields=id,name'
  ],
  'mongoexport --db ecommerce --collection=products --out=product.json --jsonArray',
  'EXPLICITLY_DISCRIMINATED'
);

console.log(`\nResults: ${passedTests} / ${totalTests} tests passed.`);
if (passedTests === totalTests) {
  console.log('Contract Test Suite: SUCCESS\n');
  process.exit(0);
} else {
  console.error('Contract Test Suite: FAILURE\n');
  process.exit(1);
}
