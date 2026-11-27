/**
 * Stage 4 Verification: Procedural Evidence-Based Hard Capacity
 */

'use strict';

const assert = require('assert');
const planner = require('../engine/agents/agent1Planner');

async function runStage4Tests() {
  console.log('--- Testing Stage 4: Procedural Hard Capacity Resolver ---');

  // Test 1: Positive Case - MAT_004 Structural Content
  {
    console.log('[Test 1] MAT_004 structural evidence yields effectiveHardCap >= 5 with 5 distinct opportunities');
    const fs = require('fs');
    const path = require('path');
    const targetFile = fs.existsSync('evaluation_dataset/benchmark_results/eval_cohort_mat004_bst_avl_n5_hard_1794300864678.json')
      ? 'evaluation_dataset/benchmark_results/eval_cohort_mat004_bst_avl_n5_hard_1794300864678.json'
      : path.join(__dirname, '../../evaluation_dataset/benchmark_results/eval_cohort_mat004_bst_avl_n5_hard_1794300864678.json');
    const benchmarkData = JSON.parse(fs.readFileSync(targetFile, 'utf8'));
    const evidencePackage = benchmarkData.rawPipelineResult.evidencePackage;

    const cap = planner._resolveCapacity(evidencePackage);
    console.log('  Resolved capacity:', cap);

    assert.strictEqual(cap.isCapacityValid, true, 'Capacity must be valid');
    assert.strictEqual(cap.effectiveHardCap, 5, 'Must resolve effectiveHardCap = 5 for MAT_004');

    const procRes = planner._deriveProceduralHardCapacity(evidencePackage);
    assert.strictEqual(procRes.distinctOpportunities.length, 5, 'Must verify all 5 distinct procedural opportunities');
    const oppIds = procRes.distinctOpportunities.map(o => o.opportunityId);
    assert.ok(oppIds.includes('OPP_1_BST_DELETION_TRACE'), 'Must contain OPP_1');
    assert.ok(oppIds.includes('OPP_2_BST_DEGENERATE_SKEW'), 'Must contain OPP_2');
    assert.ok(oppIds.includes('OPP_3_AVL_SINGLE_ROTATION'), 'Must contain OPP_3');
    assert.ok(oppIds.includes('OPP_4_AVL_DOUBLE_ROTATION'), 'Must contain OPP_4');
    assert.ok(oppIds.includes('OPP_5_AVL_HEIGHT_BOUND_RECURRENCE'), 'Must contain OPP_5');
    console.log('  ✓ Successfully verified all 5 distinct procedural opportunities on MAT_004');
  }

  // Test 2: Negative Control - Purely Descriptive / Glossary Text
  {
    console.log('[Test 2] Purely descriptive text resolves effectiveHardCap = 0 (Honest Capacity Deficit)');
    const descriptiveEvidence = {
      hierarchicalStore: {
        children: [
          { text: 'A tree is an abstract data structure. It consists of nodes and edges without any cycles.' },
          { text: 'The top node is called the root. Nodes with no children are called leaves or terminal nodes.' },
          { text: 'Trees are widely used in computer science for hierarchical representations and file systems.' }
        ]
      }
    };

    const cap = planner._resolveCapacity(descriptiveEvidence);
    console.log('  Descriptive text resolved capacity:', cap);

    assert.strictEqual(cap.isCapacityValid, false, 'Capacity fails closed for descriptive text');
    assert.strictEqual(cap.effectiveHardCap, 0, 'Must preserve effectiveHardCap = 0 for descriptive text');
    console.log('  ✓ Preserves effectiveHardCap = 0 on non-procedural/glossary text');
  }

  // Test 3: Deduplication - Multiple identical rotation mentions do not inflate capacity
  {
    console.log('[Test 3] Deduplication across overlapping text');
    const duplicateEvidence = {
      hierarchicalStore: {
        children: [
          { text: 'Balance factor BF(X) = height(left) - height(right). Invariant: BF in {-1, 0, 1}. Lowest unbalanced ancestor requires single left rotation.' },
          { text: 'Another note on single left rotation and balance factor BF(X) with lowest unbalanced ancestor.' },
          { text: 'Summary of single left rotation restoring balance factor invariant at lowest unbalanced ancestor.' }
        ]
      }
    };

    const procRes = planner._deriveProceduralHardCapacity(duplicateEvidence);
    assert.strictEqual(procRes.distinctOpportunities.length, 1, 'Overlapping single rotation mentions must deduplicate to 1 opportunity');
    assert.strictEqual(procRes.hardCap, 1);
    console.log('  ✓ Deduplication properly prevents multiple mentions of one mechanism from inflating capacity');
  }

  console.log('\n✅ All Stage 4 tests passed successfully!\n');
}

runStage4Tests().catch(err => {
  console.error('❌ Stage 4 test failed:', err);
  process.exit(1);
});
