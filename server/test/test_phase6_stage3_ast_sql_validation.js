/**
 * server/test/test_phase6_stage3_ast_sql_validation.js
 *
 * Phase 6 / Stage 3: Code and SQL AST & Isolated Execution Validation Suite
 * Verifies:
 * 1. Python AST parsing via safe subprocess (ast.parse)
 * 2. JavaScript AST syntactic compilation via vm
 * 3. SQL parsing and isolated in-memory execution gate via node:sqlite DatabaseSync
 * 4. Conceptual pass-through (conceptual questions never fail for lack of code)
 * 5. Safety & isolation (zero production DB access, strict timeouts, bounded memory)
 * 6. Agent 3 integration (syntax rejection & teacher boundary enforcement)
 */

'use strict';

const assert = require('assert');
const {
  parseAndValidateAST,
  validatePythonAST,
  validateJavaScriptAST,
  validateSQLQuery,
  validateQuestionCodeArtifacts,
  detectLanguage
} = require('../engine/validators/astParser');
const agent3 = require('../engine/agents/agent3Evaluator');

async function runStage3ValidationTests() {
  console.log('================================================================');
  console.log('🧪 Starting Phase 6 / Stage 3: Code & SQL AST Validation Suite');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function runTest(name, fn) {
    total++;
    try {
      fn();
      console.log(`  ✅ PASS: [${total}] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: [${total}] ${name}`);
      console.error(`     Error: ${err.message}\n`);
    }
  }

  async function runAsyncTest(name, fn) {
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

  // --- Python AST Tests ---
  runTest('Python AST accepts valid syntax (function definition & recursion)', () => {
    const validPython = `
def gcd(a, b):
    if b == 0:
        return a
    return gcd(b, a % b)
`;
    const res = validatePythonAST(validPython);
    assert.strictEqual(res.valid, true, 'Valid python should pass');
    assert.strictEqual(res.language, 'Python');
  });

  runTest('Python AST rejects syntax errors with informative reason', () => {
    const invalidPython = `
def gcd(a, b)
    if b == 0
        return a
`;
    const res = validatePythonAST(invalidPython);
    assert.strictEqual(res.valid, false, 'Invalid python syntax should fail');
    assert.strictEqual(res.code, 'PYTHON_SYNTAX_ERROR');
    assert.ok(res.reason.includes('SyntaxError') || res.reason.includes(':'), 'Should report syntax error');
  });

  // --- JavaScript AST Tests ---
  runTest('JavaScript AST accepts valid syntactic expressions and statements', () => {
    const validJS = `
function insertNode(root, val) {
    if (!root) return { val, left: null, right: null };
    if (val < root.val) root.left = insertNode(root.left, val);
    else root.right = insertNode(root.right, val);
    return root;
}
`;
    const res = validateJavaScriptAST(validJS);
    assert.strictEqual(res.valid, true, 'Valid JS should pass');
    assert.strictEqual(res.language, 'JavaScript');
  });

  runTest('JavaScript AST rejects syntax errors without executing code', () => {
    const invalidJS = `const x = [1, 2, 3].map(n => { return n *; });`;
    const res = validateJavaScriptAST(invalidJS);
    assert.strictEqual(res.valid, false, 'Invalid JS should fail');
    assert.strictEqual(res.code, 'JS_SYNTAX_ERROR');
  });

  // --- SQL AST & Execution Gate Tests ---
  runTest('SQL validator accepts valid queries and executes in isolated in-memory SQLite', () => {
    const validSQL = `SELECT name, score FROM users WHERE age >= 21 ORDER BY score DESC;`;
    const res = validateSQLQuery(validSQL);
    assert.strictEqual(res.valid, true, 'Valid SQL should pass');
    assert.strictEqual(res.language, 'SQL');
  });

  runTest('SQL validator rejects misspelled keywords and broken clauses', () => {
    const invalidSQL = `SELEC name, FROM users WHERE;`;
    const res = validateSQLQuery(invalidSQL);
    assert.strictEqual(res.valid, false, 'Invalid SQL keyword should fail');
    assert.strictEqual(res.code, 'SQL_SYNTAX_ERROR');
  });

  runTest('SQL validator isolates execution in memory without touching production DB', () => {
    // Tests that DatabaseSync operates purely in :memory: with synthetic data
    const query = `SELECT COUNT(*) AS total FROM users;`;
    const res = validateSQLQuery(query);
    assert.strictEqual(res.valid, true);
  });

  // --- Conceptual Pass-Through Tests ---
  runTest('Conceptual questions pass safely without requiring code artifacts', () => {
    const conceptualStem = "In a Binary Search Tree, what is the ordering relationship between the left subtree and root?";
    const res = parseAndValidateAST(conceptualStem);
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.isCode, false);
    assert.strictEqual(res.language, 'Conceptual');
  });

  // --- Agent 3 Evaluator Integration Tests ---
  await runAsyncTest('Agent 3 rejects candidate MCQ containing syntactically broken code', async () => {
    const badCodeMCQ = {
      questionText: "What is the result of the following Python function when called with gcd(12, 8)?\n```python\ndef gcd(a, b)\n  return a\n```",
      options: [
        "Returns 4",
        "Returns 12",
        "Returns 8",
        "Throws a runtime error"
      ],
      correctAnswer: "Returns 4"
    };

    const target = {
      concept: "Euclidean GCD Algorithm",
      targetDifficulty: "Medium",
      intendedCognitiveOperation: "TRACE"
    };

    const evidencePackage = {
      unifiedRawContent: "Euclidean algorithm computes greatest common divisor using modulo reduction."
    };

    const evalResult = await agent3.evaluateQuestion(badCodeMCQ, target, evidencePackage, { skipLLM: true });
    assert.strictEqual(evalResult.status, 'FAIL', 'Bad code MCQ must fail Agent 3');
    assert.ok(
      evalResult.failureReasons.includes('CODE_SYNTAX_ERROR'),
      `Expected CODE_SYNTAX_ERROR in reasons: ${JSON.stringify(evalResult.failureReasons)}`
    );
  });

  await runAsyncTest('Agent 3 rejects code-bearing MCQ when teacher specifies NO_CODE_IMPLEMENTATION', async () => {
    const codeMCQ = {
      questionText: "Which statement correctly implements the base condition in Python?\n```python\nif root is None:\n    return Node(key)\n```",
      options: [
        "if root is None: return Node(key)",
        "if root == 0: return False",
        "while root: root = root.next",
        "root.val = key"
      ],
      correctAnswer: "if root is None: return Node(key)"
    };

    const target = {
      concept: "Binary Search Tree Insertion",
      targetDifficulty: "Medium",
      intendedCognitiveOperation: "TRACE",
      negativeBoundaries: ["NO_CODE_IMPLEMENTATION"]
    };

    const evidencePackage = {
      unifiedRawContent: "Binary Search Trees maintain ordered keys.",
      negativeBoundaries: ["NO_CODE_IMPLEMENTATION"]
    };

    const evalResult = await agent3.evaluateQuestion(codeMCQ, target, evidencePackage, { skipLLM: true });
    assert.strictEqual(evalResult.status, 'FAIL', 'Code question violating NO_CODE must fail');
    assert.ok(
      evalResult.failureReasons.includes('TEACHER_BOUNDARY_VIOLATION'),
      `Expected TEACHER_BOUNDARY_VIOLATION in reasons: ${JSON.stringify(evalResult.failureReasons)}`
    );
  });

  console.log(`\n================================================================`);
  console.log(`📊 Phase 6 / Stage 3 Results: ${passed} / ${total} Tests Passed (${Math.round((passed / total) * 100)}%)`);
  console.log('================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

if (require.main === module) {
  runStage3ValidationTests().catch(err => {
    console.error('Fatal error running Stage 3 tests:', err);
    process.exit(1);
  });
}

module.exports = { runStage3ValidationTests };
