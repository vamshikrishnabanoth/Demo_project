/**
 * server/test/test_standalone_classifier.js
 *
 * Offline Unit Test Suite for Standalone Source Classifier (Milestone 1)
 *
 * Verifies:
 *  1. Python, Java, C/C++, and SQL classification accuracy
 *  2. Ordinary prose vs. mixed text/code vs. empty input handling
 *  3. Short but meaningful snippets (1-2 lines) accepted based on content
 *  4. Inadequate/trivial snippets rejected with clear sufficiency reasoning
 *  5. Malicious-looking inputs treated strictly as inert text (zero execution)
 *  6. Manual language override capability
 */

'use strict';

const assert = require('assert');
const { classifySource, DANGEROUS_PATTERNS } = require('../engine/inputClassifier/standaloneSourceClassifier');

let totalTests = 0;
let passedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
  }
}

console.log('======================================================================');
console.log('🧪 RUNNING STANDALONE SOURCE CLASSIFIER TEST SUITE (MILESTONE 1)');
console.log('======================================================================\n');

// ── Test Group 1: Python Classification ──────────────────────────────────────
console.log('--- Group 1: Python Detection ---');

runTest('Detects standard Python function with control flow', () => {
  const code = `
def binary_search(arr, target):
    low, high = 0, len(arr) - 1
    while low <= high:
        mid = (low + high) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            low = mid + 1
        else:
            high = mid - 1
    return -1
`;
  const result = classifySource(code);
  assert.strictEqual(result.detectedType, 'code');
  assert.strictEqual(result.language, 'python');
  assert.strictEqual(result.isSufficientEvidence, true);
  assert.strictEqual(result.metadata.hasControlFlow, true);
  assert.strictEqual(result.metadata.hasFunctionDef, true);
});

// ── Test Group 2: Java Classification ────────────────────────────────────────
console.log('\n--- Group 2: Java Detection ---');

runTest('Detects Java class with main and System.out', () => {
  const code = `
public class Factorial {
    public static int compute(int n) {
        if (n <= 1) return 1;
        return n * compute(n - 1);
    }
    public static void main(String[] args) {
        System.out.println("Result: " + compute(5));
    }
}
`;
  const result = classifySource(code);
  assert.strictEqual(result.detectedType, 'code');
  assert.strictEqual(result.language, 'java');
  assert.strictEqual(result.isSufficientEvidence, true);
  assert.strictEqual(result.metadata.hasFunctionDef, true);
});

// ── Test Group 3: C / C++ Classification ─────────────────────────────────────
console.log('\n--- Group 3: C / C++ Detection ---');

runTest('Detects C++ snippet with include, vector, and cout', () => {
  const code = `
#include <iostream>
#include <vector>

int main() {
    std::vector<int> numbers = {10, 20, 30};
    for (int num : numbers) {
        std::cout << num << std::endl;
    }
    return 0;
}
`;
  const result = classifySource(code);
  assert.strictEqual(result.detectedType, 'code');
  assert.strictEqual(result.language, 'cpp');
  assert.strictEqual(result.isSufficientEvidence, true);
});

// ── Test Group 4: SQL Classification ─────────────────────────────────────────
console.log('\n--- Group 4: SQL Detection ---');

runTest('Detects multi-line SQL query with aggregations and joins', () => {
  const sql = `
SELECT 
    d.department_name,
    COUNT(e.id) AS total_employees,
    AVG(e.salary) AS avg_salary
FROM departments d
INNER JOIN employees e ON d.id = e.department_id
WHERE e.status = 'active'
GROUP BY d.department_name
HAVING COUNT(e.id) >= 5
ORDER BY avg_salary DESC;
`;
  const result = classifySource(sql);
  assert.strictEqual(result.detectedType, 'sql');
  assert.strictEqual(result.language, 'sql');
  assert.strictEqual(result.isSufficientEvidence, true);
  assert.strictEqual(result.metadata.hasQueryStructure, true);
});

// ── Test Group 5: Short But Meaningful Snippets (Reviewer Directive) ─────────
console.log('\n--- Group 5: Short but Meaningful Snippets (Non-arbitrary line length) ---');

runTest('Accepts single-line SQL query with complete projection & filter', () => {
  const sql = `SELECT dept_id, AVG(salary) FROM employees GROUP BY dept_id HAVING COUNT(*) > 5;`;
  const result = classifySource(sql);
  assert.strictEqual(result.detectedType, 'sql');
  assert.strictEqual(result.language, 'sql');
  assert.strictEqual(result.metadata.lineCount, 1);
  assert.strictEqual(result.isSufficientEvidence, true, 'Single line SQL must be accepted if it contains relational operations');
});

runTest('Accepts 1-line recursive arrow function with control flow', () => {
  const code = `const fib = n => n <= 1 ? n : fib(n - 1) + fib(n - 2);`;
  const result = classifySource(code);
  assert.strictEqual(result.detectedType, 'code');
  assert.strictEqual(result.metadata.lineCount, 1);
  assert.strictEqual(result.isSufficientEvidence, true, 'Short recursive function must be recognized as sufficient logic');
});

runTest('Accepts 2-line C GCD function', () => {
  const code = `int gcd(int a, int b) {\n    return b == 0 ? a : gcd(b, a % b);\n}`;
  const result = classifySource(code);
  assert.strictEqual(result.detectedType, 'code');
  assert.strictEqual(result.isSufficientEvidence, true);
});

// ── Test Group 6: Insufficient & Incomplete Snippets ─────────────────────────
console.log('\n--- Group 6: Insufficient Content Rejection ---');

runTest('Rejects isolated variable assignment without logic', () => {
  const snippet = `x = 5`;
  const result = classifySource(snippet);
  assert.strictEqual(result.isSufficientEvidence, false);
  assert.ok(result.sufficiencyReason.includes('too short') || result.sufficiencyReason.includes('lacks algorithmic logic'));
});

runTest('Rejects isolated type declaration', () => {
  const snippet = `int counter;`;
  const result = classifySource(snippet);
  assert.strictEqual(result.isSufficientEvidence, false);
});

runTest('Rejects incomplete SQL fragment', () => {
  const snippet = `WHERE employee_id > 100 AND salary < 50000`;
  const result = classifySource(snippet);
  assert.strictEqual(result.isSufficientEvidence, false);
  assert.ok(result.sufficiencyReason.includes('incomplete') || result.sufficiencyReason.includes('missing'));
});

// ── Test Group 7: Ordinary Prose & Mixed Content ────────────────────────────
console.log('\n--- Group 7: Prose and Mixed Content ---');

runTest('Detects expository academic prose as text', () => {
  const prose = `
A Binary Search Tree is a node-based binary tree data structure which has the following properties:
The left subtree of a node contains only nodes with keys lesser than the node’s key.
The right subtree of a node contains only nodes with keys greater than the node’s key.
The left and right subtree each must also be a binary search tree.
`;
  const result = classifySource(prose);
  assert.strictEqual(result.detectedType, 'text');
  assert.strictEqual(result.language, 'text');
  assert.strictEqual(result.isSufficientEvidence, true);
});

runTest('Detects mixed markdown documentation with embedded code block', () => {
  const mixed = `
### Tree Traversal Algorithms
Here is the implementation of in-order traversal using recursion in Python:

\`\`\`python
def inorder_traversal(root):
    if root:
        inorder_traversal(root.left)
        print(root.val)
        inorder_traversal(root.right)
\`\`\`

Notice that in-order traversal of a binary search tree yields nodes in non-decreasing order.
`;
  const result = classifySource(mixed);
  assert.strictEqual(result.detectedType, 'mixed');
  assert.strictEqual(result.isSufficientEvidence, true);
  assert.strictEqual(result.metadata.codeBlocksFound, 1);
});

// ── Test Group 8: Empty and Whitespace Inputs ────────────────────────────────
console.log('\n--- Group 8: Empty and Edge-Case Inputs ---');

runTest('Handles empty string safely', () => {
  const result = classifySource('');
  assert.strictEqual(result.detectedType, 'empty');
  assert.strictEqual(result.isSufficientEvidence, false);
});

runTest('Handles whitespace-only string safely', () => {
  const result = classifySource('   \n\t   \n  ');
  assert.strictEqual(result.detectedType, 'empty');
  assert.strictEqual(result.isSufficientEvidence, false);
});

runTest('Handles null and undefined safely without throwing', () => {
  const res1 = classifySource(null);
  const res2 = classifySource(undefined);
  assert.strictEqual(res1.detectedType, 'empty');
  assert.strictEqual(res2.detectedType, 'empty');
});

// ── Test Group 9: Security & Inert Data Guarantee ────────────────────────────
console.log('\n--- Group 9: Security Audit (Inert Data Guarantee) ---');

runTest('Treats dangerous Python os.system strictly as inert text without executing', () => {
  const maliciousPython = `
import os
import subprocess

def cleanup():
    # Attempt simulated destructive action
    os.system("rm -rf /tmp/test_dir")
    subprocess.call(["echo", "exploit"])
    return True
`;
  const result = classifySource(maliciousPython);
  assert.strictEqual(result.detectedType, 'code');
  assert.strictEqual(result.language, 'python');
  assert.strictEqual(result.isSufficientEvidence, true);
  assert.strictEqual(result.metadata.potentialSecurityConstructsFound, true);
  assert.ok(result.metadata.securityConstructs.includes('shell_execution') || result.metadata.securityConstructs.includes('file_deletion'));
});

runTest('Treats SQL injection probe and DROP TABLE strictly as inert text', () => {
  const maliciousSQL = `
SELECT * FROM users WHERE username = 'admin' OR '1'='1';
DROP TABLE students;
`;
  const result = classifySource(maliciousSQL);
  assert.strictEqual(result.detectedType, 'sql');
  assert.strictEqual(result.metadata.potentialSecurityConstructsFound, true);
  assert.ok(result.metadata.securityConstructs.includes('sql_destructive_ddl') || result.metadata.securityConstructs.includes('sql_injection_probe'));
});

// ── Test Group 10: Manual Language Override ──────────────────────────────────
console.log('\n--- Group 10: Manual Language Override ---');

runTest('Respects manual teacher language override', () => {
  const ambiguousCode = `
for i in range(10):
    print(i)
`;
  // Without override: detected as Python
  const resAuto = classifySource(ambiguousCode);
  assert.strictEqual(resAuto.language, 'python');

  // With explicit manual override: respects caller specification
  const resOverride = classifySource(ambiguousCode, { manualLanguage: 'python' });
  assert.strictEqual(resOverride.language, 'python');
});

// ── Summary ──────────────────────────────────────────────────────────────────
console.log('\n======================================================================');
console.log(`🏁 TEST RESULTS: ${passedTests} / ${totalTests} TESTS PASSED (${((passedTests / totalTests) * 100).toFixed(0)}%)`);
console.log('======================================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
