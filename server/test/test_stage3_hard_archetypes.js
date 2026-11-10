/**
 * Stage 3 Verification: Hard Reasoning Archetypes
 */

'use strict';

const assert = require('assert');
const agent2 = require('../engine/agents/agent2Generator');

async function runStage3Tests() {
  console.log('--- Testing Stage 3: Hard Reasoning Archetypes ---');

  // Test 1: QUESTION_ARCHETYPES registered
  {
    console.log('[Test 1] New Hard archetypes registered in QUESTION_ARCHETYPES');
    assert.ok(agent2.QUESTION_ARCHETYPES.INVARIANT_DIAGNOSIS, 'Should have INVARIANT_DIAGNOSIS');
    assert.ok(agent2.QUESTION_ARCHETYPES.COUNTEREXAMPLE_EVALUATION, 'Should have COUNTEREXAMPLE_EVALUATION');
    assert.ok(agent2.QUESTION_ARCHETYPES.CODE_EXECUTION, 'Should have CODE_EXECUTION');
    console.log('  ✓ QUESTION_ARCHETYPES includes all approved Hard reasoning archetypes');
  }

  // Test 2: _buildArchetypeScaffolding returns detailed scaffolding
  {
    console.log('[Test 2] Archetype scaffolding output for new archetypes');
    const invScaffold = agent2._buildArchetypeScaffolding('INVARIANT_DIAGNOSIS', 'AVL Tree Balancing', '');
    assert.ok(invScaffold.systemScaffold.includes('INVARIANT_DIAGNOSIS'));
    assert.ok(invScaffold.systemScaffold.includes('lowest unbalanced ancestor'));
    assert.ok(invScaffold.userScaffold.includes('lowest unbalanced node'));

    const countScaffold = agent2._buildArchetypeScaffolding('COUNTEREXAMPLE_EVALUATION', 'AVL Minimum Nodes', '');
    assert.ok(countScaffold.systemScaffold.includes('N(h) = N(h-1) + N(h-2) + 1'));
    assert.ok(countScaffold.userScaffold.includes('N(0)=1, N(1)=2'));

    const codeScaffold = agent2._buildArchetypeScaffolding('CODE_EXECUTION', 'BST In-Order Successor Deletion', '');
    assert.ok(codeScaffold.systemScaffold.includes('CODE_EXECUTION'));
    assert.ok(codeScaffold.userScaffold.includes('pointer'));
    console.log('  ✓ Archetype scaffolding outputs precise instructions and guards');
  }

  // Test 3: Operational scaffolding provides tree-specific Hard mechanism guidance
  {
    console.log('[Test 3] Domain-adaptive operational scaffolding for tree at Hard tier');
    const opScaffold = agent2._buildOperationalScaffolding(
      'Hard',
      'DIAGNOSE',
      'AVL Tree Balancing',
      'AVL tree rotations and balance factor',
      null,
      'INVARIANT_DIAGNOSIS'
    );
    assert.ok(opScaffold.systemScaffold.includes('lowest ancestor node violates the balance invariant'));
    assert.ok(opScaffold.archetypeScaffold.userScaffold.includes('INVARIANT_DIAGNOSIS'));
    console.log('  ✓ Domain operational guidance correctly injects tree balancing mechanics');
  }

  console.log('\n✅ All Stage 3 tests passed successfully!\n');
}

runStage3Tests().catch(err => {
  console.error('❌ Stage 3 test failed:', err);
  process.exit(1);
});
