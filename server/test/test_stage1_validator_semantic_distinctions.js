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
  const hasDupError = res.errors.some(e => e.code === 'SYNONYMOUS_DISTRACTOR_OPTION' || e.code === 'PERMUTED_DUPLICATE_OPTION');
  const hasDupFlag = (res.warnings || []).some(w => w.code === 'POSSIBLE_SYNONYM_PAIR');
  assert.strictEqual(hasDupError || hasDupFlag, true, 'Inverted relational statements must be rejected or flagged for semantic review');
  console.log('  ✅ [PASS] 4. Inverted relational statements rejected or flagged for semantic review');
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
  const flagged = !res.isValid || (res.warnings || []).some(w => w.code === 'POSSIBLE_SYNONYM_PAIR');
  assert.strictEqual(flagged, true, 'Paraphrased mathematical statements must be rejected or flagged for semantic review');
  console.log('  ✅ [PASS] 6. Paraphrased complexity statements rejected or flagged for semantic review');
}

// Test 7: Near-miss distractors from real generated questions must NOT be hard-rejected
{
  const nearMissSets = [
    ["Set new_node.next to head, then set head to new_node", "Set head to new_node, then set new_node.next to the old head", "Set new_node.next to null, then set head to new_node", "Set new_node.next to head, then set head.next to new_node"],
    ["The new head's next pointer is set to NULL", "The old head's next pointer is set to NULL", "The tail's next pointer is set to the new head", "The list is left unchanged by the operation"],
    ["Operators with higher or equal precedence", "Operators with strictly higher precedence", "Operators with lower precedence only", "Only opening parentheses"],
    ["Stack1, because elements are pushed onto it during enqueue.", "Stack2, because elements are pushed onto it during enqueue.", "Neither stack; enqueue writes to an array.", "Both stacks receive each enqueued element."]
  ];
  for (const options of nearMissSets) {
    const res = validator.validateOptionSet(options, "Which is correct?", options[0]);
    const dupErrors = res.errors.filter(e => ['SYNONYMOUS_DISTRACTOR_OPTION', 'PERMUTED_DUPLICATE_OPTION'].includes(e.code));
    assert.strictEqual(dupErrors.length, 0, `Near-miss distractors must not be rejected as duplicates: ${JSON.stringify(dupErrors.map(e => e.message))}`);
  }
  console.log('  ✅ [PASS] 7. Near-miss distractors (step order, operand, boundary, identifier) are not rejected as duplicates');
}

console.log('🎉 All Stage 1 Targeted Tests Passed Cleanly!');
