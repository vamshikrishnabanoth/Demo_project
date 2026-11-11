const assert = require('assert');
const validator = require('../engine/validators/deterministicValidator');

console.log('🧪 Running Stage 1 Targeted Tests: Validator Semantic Distinctions...');

// Test 1: Positive Case - Operational Sequencing (LR vs RL rotations)
{
  const options = [
    "Left rotate X's left child, then right rotate node X.",
    "Right rotate X's left child, then left rotate node X.",
    "Perform a single right rotation on node X.",
    "Perform a single left rotation on node X."
  ];
  const res = validator.validateOptionSet(options, "Which rotation rebalances?", options[0]);
  assert.strictEqual(res.isValid, true, 'Sequential rotation options must be recognized as valid distinct choices');
  console.log('  ✅ [PASS] 1. Operational sequencing (LR vs RL rotations) accepted without duplicate error');
}

// Test 2: Positive Case - Directional Antonym Options (Single Left vs Right Rotation)
{
  const options = [
    "Perform a single left rotation on node X.",
    "Perform a single right rotation on node X.",
    "Perform an in-order successor deletion.",
    "No rotation is required."
  ];
  const res = validator.validateOptionSet(options, "Which operation restores balance?", options[0]);
  assert.strictEqual(res.isValid, true, 'Single left vs right rotation options must be recognized as valid distinct choices');
  console.log('  ✅ [PASS] 2. Single left vs right rotation accepted without duplicate error');
}

// Test 3: Positive Case - Distinct Numeric Node Identifiers
{
  const options = [
    "The node with value 10 has a balance factor of +2.",
    "The node with value 20 has a balance factor of +2.",
    "The node with value 30 has a balance factor of +2.",
    "No node has a balance factor exceeding +1."
  ];
  const res = validator.validateOptionSet(options, "Which node violates balance?", options[2]);
  assert.strictEqual(res.isValid, true, 'Options distinguishing node values 10, 20, 30 must be valid distinct choices');
  console.log('  ✅ [PASS] 3. Distinct numeric node identifiers accepted without duplicate error');
}

// Test 4: Negative Case - Relational Inversion Duplicate (less than vs greater than inverted)
{
  const options = [
    "All keys in the left subtree are strictly less than the node key.",
    "The node key is strictly greater than all keys in its left subtree.",
    "All keys in the right subtree are less than the left subtree.",
    "Keys may be equal to the node key."
  ];
  const res = validator.validateOptionSet(options, "Which statement is true?", options[0]);
  assert.strictEqual(res.isValid, false, 'Inverted relational statements must be rejected as duplicates');
  const hasDupError = res.errors.some(e => e.code === 'SYNONYMOUS_DISTRACTOR_OPTION' || e.code === 'PERMUTED_DUPLICATE_OPTION');
  assert.strictEqual(hasDupError, true, 'Must flag SYNONYMOUS_DISTRACTOR_OPTION or PERMUTED_DUPLICATE_OPTION');
  console.log('  ✅ [PASS] 4. Inverted relational statements correctly rejected as duplicate distractors');
}

// Test 5: Negative Case - Commutative Formula Equivalence (N + 2 vs 2 + N)
{
  const options = [
    "Height is bounded by h < 1.44 * log2(N + 2) - 0.328.",
    "Height is bounded by h < 1.44 * log2(2 + N) - 0.328.",
    "Height degenerates to h = N in all cases.",
    "Height is strictly constant O(1)."
  ];
  const res = validator.validateOptionSet(options, "What is the height bound?", options[0]);
  assert.strictEqual(res.isValid, false, 'Commutatively identical formulas must be rejected as duplicates');
  console.log('  ✅ [PASS] 5. Commutatively identical formulas correctly rejected as duplicates');
}

// Test 6: Negative Case - Paraphrased Semantic Duplicate (logarithmic growth paraphrases)
{
  const options = [
    "The search complexity is strictly bounded by O(log N) in the worst case.",
    "Worst-case search operations grow logarithmically with the number of nodes.",
    "Height degenerates to O(N) in worst case.",
    "Search operations require O(1) constant time."
  ];
  const res = validator.validateOptionSet(options, "What is the search complexity?", options[0]);
  assert.strictEqual(res.isValid, false, 'Paraphrased mathematical statements must be rejected as duplicates');
  console.log('  ✅ [PASS] 6. Paraphrased complexity statements correctly rejected as duplicates');
}

console.log('🎉 All Stage 1 Targeted Tests Passed Cleanly!');
