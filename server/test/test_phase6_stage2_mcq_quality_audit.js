/**
 * server/test/test_phase6_stage2_mcq_quality_audit.js
 *
 * Phase 6 / Stage 2: Comprehensive MCQ Quality & Adversarial Audit Suite
 * Verifies the 7-Point Quality Rubric against Adversarial Inputs:
 * 1. Exactly one defensible correct answer (no dual keys / subsumptions)
 * 2. Correct answer key matches the actual option text
 * 3. Distractors are plausible, incorrect under stated conditions, mutually distinguishable
 * 4. No duplicate or superficial rewording of another question
 * 5. No unsupported assumptions, foreign contamination, or teacher boundary violations
 * 6. Difficulty matches the lecture's teaching intent
 * 7. Supporting evidence and provenance are available and verified against active store
 */

'use strict';

const assert = require('assert');
const agent3 = require('../engine/agents/agent3Evaluator');
const deterministicValidator = require('../engine/validators/deterministicValidator');
const DifficultyAwareDistractorValidator = require('../engine/validators/difficultyAwareDistractorValidator');
const { resolveTargetProvenance } = require('../engine/evidence/evidenceContextSelector');

async function runStage2QualityAudit() {
  console.log('================================================================');
  console.log('🧪 Starting Phase 6 / Stage 2: MCQ Quality & Adversarial Suite');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  async function testCase(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✅ PASS: [${total}] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: [${total}] ${name}`);
      console.error(`     Error: ${err.message}\n`);
    }
  }

  const baseEvidence = {
    unifiedRawContent: "Binary Search Trees maintain the invariant that for any node, all keys in its left subtree are strictly smaller, and all keys in its right subtree are strictly greater. Searching, insertion, and deletion operate in O(log n) average time on balanced trees, but degrade to O(n) on skewed trees. In recursive insertion, when the root pointer is nullptr, a new node is allocated and returned as the base case.",
    sessionId: "sess_quality_audit_01"
  };

  // --- 1. Adversarial: Ambiguous Wording / Unconstrained Subsumption (Dual Keys) ---
  await testCase('Adversarial: Detects unconstrained parameter/flag subsumption as AMBIGUOUS_DISTRACTOR', async () => {
    const mcq = {
      questionText: "Which Git command commits changes with an inline commit message?",
      options: [
        "git commit -m \"message\"",
        "git commit -a -m \"message\"",
        "git add .",
        "git push origin main"
      ],
      correctAnswer: "git commit -m \"message\""
    };

    const target = { concept: "Git Commits", targetDifficulty: "Medium", intendedCognitiveOperation: "COMPARE" };
    const evalRes = await agent3.evaluateQuestion(mcq, target, baseEvidence, { skipLLM: true });

    assert.strictEqual(evalRes.status, 'FAIL', 'Ambiguous subsumption must fail');
    assert.ok(
      evalRes.failureReasons.includes('AMBIGUOUS_DISTRACTOR'),
      `Expected AMBIGUOUS_DISTRACTOR, got: ${JSON.stringify(evalRes.failureReasons)}`
    );
  });

  // --- 2. Adversarial: Multiple Correct Options / Duplicate Options ---
  await testCase('Adversarial: Detects identical or duplicate option statements', async () => {
    const mcq = {
      questionText: "What is true about the left subtree of any node in a valid Binary Search Tree?",
      options: [
        "All keys in the left subtree are smaller than the node key",
        "All keys in the left subtree are smaller than the node key", // Duplicate!
        "All keys in the left subtree are greater than the node key",
        "The left subtree contains only even numbered keys"
      ],
      correctAnswer: "All keys in the left subtree are smaller than the node key"
    };

    const target = { concept: "Binary Search Tree Invariant", targetDifficulty: "Easy", intendedCognitiveOperation: "RECALL" };
    const evalRes = await agent3.evaluateQuestion(mcq, target, baseEvidence, { skipLLM: true });

    assert.strictEqual(evalRes.status, 'FAIL', 'Duplicate options must fail');
    assert.ok(
      evalRes.failureReasons.includes('OPTION_VALIDATION_ERROR'),
      `Expected OPTION_VALIDATION_ERROR, got: ${JSON.stringify(evalRes.failureReasons)}`
    );
  });

  // --- 3. Adversarial: Answer Key Missing from Options ---
  await testCase('Adversarial: Detects missing correctAnswer in provided options array', async () => {
    const mcq = {
      questionText: "What is the average lookup time complexity of a balanced Binary Search Tree?",
      options: [
        "O(n)",
        "O(n log n)",
        "O(1)",
        "O(n^2)"
      ],
      correctAnswer: "O(log n)" // Not in options!
    };

    const target = { concept: "BST Complexity", targetDifficulty: "Easy", intendedCognitiveOperation: "RECALL" };
    const evalRes = await agent3.evaluateQuestion(mcq, target, baseEvidence, { skipLLM: true });

    assert.strictEqual(evalRes.status, 'FAIL');
    assert.ok(
      evalRes.failureReasons.includes('CORRECT_ANSWER_NOT_IN_OPTIONS') || evalRes.failureReasons.includes('OPTION_VALIDATION_ERROR'),
      `Expected key inclusion failure, got: ${JSON.stringify(evalRes.failureReasons)}`
    );
  });

  // --- 4. Adversarial: Weak / Absurd / Cartoon Distractors ---
  await testCase('Adversarial: Detects absurd or cartoon distractors as IMPLAUSIBLE_DISTRACTOR', async () => {
    const mcq = {
      questionText: "Why does tree search performance degrade to linear O(n) time?",
      options: [
        "When keys are inserted in strictly sorted order, forming a degenerate linked list",
        "Because chocolate frogs cast magic spells that confuse the pointer linkages",
        "Because binary trees require moon cycles to rotate their nodes",
        "Because the computer runs out of digital pixie dust"
      ],
      correctAnswer: "When keys are inserted in strictly sorted order, forming a degenerate linked list"
    };

    const target = { concept: "BST Skew Degradation", targetDifficulty: "Medium", intendedCognitiveOperation: "EXPLAIN_MECHANISM" };
    const evalRes = await agent3.evaluateQuestion(mcq, target, baseEvidence, { skipLLM: true });

    assert.strictEqual(evalRes.status, 'FAIL');
    assert.ok(
      evalRes.failureReasons.includes('IMPLAUSIBLE_DISTRACTOR') || evalRes.failureReasons.includes('FOREIGN_DOMAIN_CONTAMINATION'),
      `Expected IMPLAUSIBLE_DISTRACTOR or FOREIGN_DOMAIN_CONTAMINATION, got: ${JSON.stringify(evalRes.failureReasons)}`
    );
  });

  // --- 5. Adversarial: Foreign Domain Contamination ---
  await testCase('Adversarial: Detects foreign out-of-domain technical terms in distractors', async () => {
    const mcq = {
      questionText: "What happens during recursive BST insertion when root is nullptr?",
      options: [
        "A new node with the target key is allocated and returned",
        "React useEffect executes the component re-render hook",
        "The PCR amplification thermal cycler initiates DNA denaturation",
        "Bacteriophage capsids inject viral nucleic acids into the host cell"
      ],
      correctAnswer: "A new node with the target key is allocated and returned"
    };

    const target = { concept: "BST Insertion Base Case", targetDifficulty: "Easy", intendedCognitiveOperation: "RECALL" };
    const evalRes = await agent3.evaluateQuestion(mcq, target, baseEvidence, { skipLLM: true });

    assert.strictEqual(evalRes.status, 'FAIL');
    assert.ok(
      evalRes.failureReasons.includes('FOREIGN_DOMAIN_CONTAMINATION'),
      `Expected FOREIGN_DOMAIN_CONTAMINATION, got: ${JSON.stringify(evalRes.failureReasons)}`
    );
  });

  // --- 6. Adversarial: Teacher Boundary Violation ---
  await testCase('Adversarial: Detects violation of teacher negative boundary NO_CODE_IMPLEMENTATION', async () => {
    const mcq = {
      questionText: "Which C++ code snippet correctly implements the recursive insert base condition?\n```cpp\nif (root == nullptr) return new Node(key);\n```",
      options: [
        "if (root == nullptr) return new Node(key);",
        "if (root == 0) return 0;",
        "root->left = new Node(key);",
        "delete root;"
      ],
      correctAnswer: "if (root == nullptr) return new Node(key);"
    };

    const target = {
      concept: "BST Insertion Implementation",
      targetDifficulty: "Medium",
      intendedCognitiveOperation: "TRACE",
      negativeBoundaries: ["NO_CODE_IMPLEMENTATION"]
    };

    const evidence = {
      ...baseEvidence,
      negativeBoundaries: ["NO_CODE_IMPLEMENTATION"]
    };

    const evalRes = await agent3.evaluateQuestion(mcq, target, evidence, { skipLLM: true });
    assert.strictEqual(evalRes.status, 'FAIL');
    assert.ok(
      evalRes.failureReasons.includes('TEACHER_BOUNDARY_VIOLATION'),
      `Expected TEACHER_BOUNDARY_VIOLATION, got: ${JSON.stringify(evalRes.failureReasons)}`
    );
  });

  // --- 7. Adversarial: Difficulty Mismatch (Factual Recall for Requested Hard) ---
  await testCase('Adversarial: Detects cognitive mismatch when pure recall is generated for Hard tier', async () => {
    const mcq = {
      questionText: "What does the acronym BST stand for in computer science?",
      options: [
        "Binary Search Tree",
        "Balanced Sequential Token",
        "Base Segment Table",
        "Bounded Search Tracker"
      ],
      correctAnswer: "Binary Search Tree"
    };

    const target = {
      concept: "BST Definition",
      targetDifficulty: "Hard", // Requested Hard!
      intendedCognitiveOperation: "DIAGNOSE"
    };

    const evalRes = await agent3.evaluateQuestion(mcq, target, baseEvidence, { skipLLM: true });
    assert.strictEqual(evalRes.status, 'FAIL');
    assert.ok(
      evalRes.failureReasons.includes('TIER_COGNITIVE_MISMATCH'),
      `Expected TIER_COGNITIVE_MISMATCH, got: ${JSON.stringify(evalRes.failureReasons)}`
    );
  });

  // --- 8. Adversarial: Redundant / Superficial Question Rewording in Quiz ---
  await testCase('Adversarial: Whole-quiz evaluator catches pedagogical duplicate questions', async () => {
    const quizQuestions = [
      {
        questionText: "What is the average time complexity of searching a node in a balanced Binary Search Tree?",
        options: ["O(log n)", "O(n)", "O(1)", "O(n log n)"],
        correctAnswer: "O(log n)",
        metadata: { concept: "BST Search Complexity", targetDifficulty: "Easy", intendedCognitiveOperation: "RECALL" }
      },
      {
        // Near-identical duplicate question
        questionText: "In a balanced Binary Search Tree, what is the average time complexity of finding a node?",
        options: ["O(log n)", "O(n)", "O(1)", "O(n log n)"],
        correctAnswer: "O(log n)",
        metadata: { concept: "BST Search Complexity", targetDifficulty: "Easy", intendedCognitiveOperation: "RECALL" }
      }
    ];

    const quizEval = agent3.evaluateQuizSet(quizQuestions, { requestedCount: 2 });
    assert.ok(
      quizEval.quizQualityStatus === 'NEEDS_REFINEMENT' || quizEval.quizQualityStatus === 'QUALITY_FAILED',
      `Expected non-passing quiz status, got: ${quizEval.quizQualityStatus}`
    );
    assert.strictEqual(quizEval.isBalanced, false);
    assert.ok(
      quizEval.redundancy.totalRedundantPairs > 0 || quizEval.redundancy.highSimilarityPairs.length > 0,
      'Should detect redundancy between the two duplicate questions'
    );
  });

  // --- 9. Genuine Passing MCQ with Full Grounding & Provenance ---
  await testCase('Genuine MCQ: Valid, properly calibrated, grounded question passes cleanly', async () => {
    const validMCQ = {
      questionText: "In a Binary Search Tree, why does inserting keys in pre-sorted ascending order degrade search operations to O(n) linear time?",
      options: [
        "Each newly inserted key is placed into the right child of the previous node, transforming the tree into a linear linked list.",
        "The tree automatically balances itself by shifting all nodes into the left subtree, doubling search steps.",
        "Sorted keys cause duplicate keys to be ignored, resulting in missing nodes that require full table scans.",
        "Insertion of sorted elements causes the root pointer to become nullptr, forcing sequential array re-allocation."
      ],
      correctAnswer: "Each newly inserted key is placed into the right child of the previous node, transforming the tree into a linear linked list."
    };

    const target = {
      concept: "BST Sorted Insertion Degradation",
      targetDifficulty: "Medium",
      intendedCognitiveOperation: "EXPLAIN_MECHANISM"
    };

    const evalRes = await agent3.evaluateQuestion(validMCQ, target, baseEvidence, { skipLLM: true });
    assert.strictEqual(evalRes.status, 'PASS', `Valid question should pass, got: ${evalRes.failureReason}`);
    assert.strictEqual(evalRes.failureReasons.length, 0);
  });

  // --- 10. Provenance Verification Against Active Store ---
  await testCase('Provenance: Verified chunk reference succeeds while fabricated chunk reference is flagged', () => {
    const mockEvidencePackage = {
      hierarchicalStore: {
        children: [
          { evidenceId: 'chunk_bst_01', text: 'BST ordering property', start: 10, end: 45, hasRealTimestamps: true }
        ],
        childMap: {
          'chunk_bst_01': { evidenceId: 'chunk_bst_01', text: 'BST ordering property', start: 10, end: 45, hasRealTimestamps: true }
        }
      },
      hasRealTimestamps: true
    };

    // Valid reference in store
    const validTarget = { targetId: 'T01', concept: 'BST Ordering', sourceChunks: ['chunk_bst_01'] };
    const validProv = resolveTargetProvenance(validTarget, mockEvidencePackage);
    assert.strictEqual(validProv.isEvidenceVerified, true);
    assert.strictEqual(validProv.supportingChunks.length, 1);

    // Fabricated reference not in store
    const fakeTarget = { targetId: 'T02', concept: 'BST Ordering', sourceChunks: ['chunk_invented_999'] };
    const fakeProv = resolveTargetProvenance(fakeTarget, mockEvidencePackage);
    assert.strictEqual(fakeProv.isEvidenceVerified, false);
    assert.strictEqual(fakeProv.verificationStatus, 'UNVERIFIED_INVALID_CHUNK_REFERENCE');
  });

  console.log(`\n================================================================`);
  console.log(`📊 Phase 6 / Stage 2 Results: ${passed} / ${total} Tests Passed (${Math.round((passed / total) * 100)}%)`);
  console.log('================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

if (require.main === module) {
  runStage2QualityAudit().catch(err => {
    console.error('Fatal error running Stage 2 tests:', err);
    process.exit(1);
  });
}

module.exports = { runStage2QualityAudit };
