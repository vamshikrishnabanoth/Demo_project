/**
 * Regression test: pasted material (notes, code, SQL, terminal sessions) must be treated as
 * teaching material; only a short topic name triggers topic-synthesis mode.
 */
'use strict';
const assert = require('assert');
const { classifyTextBlock, isTopicLike } = require('../utils/inputKind');

const cases = [
  ['Deadlocks in Operating Systems', 'topic'],
  ['binary search trees, AVL rotations and balance factor', 'topic'],
  ['$ ps -ef | head -3\nUID PID PPID C STIME TTY TIME CMD\n$ kill -9 4521\nbash: kill: (4521) - No such process', 'terminal'],
  ['student@lab:~/proj$ git status\nOn branch main\nstudent@lab:~/proj$ git add app.js\nstudent@lab:~/proj$ git commit -m "fix"', 'terminal'],
  ['class Dog extends Animal {\n  void sound() { System.out.println("bark"); }\n}', 'code'],
  ['SELECT e.name, d.dept_name\nFROM employee e\nINNER JOIN department d ON e.dept_id = d.id\nWHERE e.salary > 50000;', 'code'],
  ['In object-oriented programming a class is a blueprint for objects. Inheritance lets a subclass reuse its parent class.\nMethod overriding lets a subclass replace a parent method; the version that runs is chosen at runtime.', 'notes'],
  ['A paragraph of lecture notes that is long enough to be material rather than a topic name, explaining how paging divides memory into fixed-size frames and pages, and how the page table maps them.', 'notes']
];

let passed = 0;
for (const [text, expected] of cases) {
  const kind = classifyTextBlock(text);
  try {
    assert.strictEqual(kind, expected);
    assert.strictEqual(isTopicLike(text), expected === 'topic');
    passed++;
    console.log(`  ✅ PASS: ${expected.padEnd(8)} ${text.split('\n')[0].slice(0, 60)}`);
  } catch (e) {
    console.log(`  ❌ FAIL: expected ${expected}, got ${kind}: ${text.split('\n')[0].slice(0, 60)}`);
  }
}
console.log(`\n🏁 ${passed} / ${cases.length} tests passed`);
process.exit(passed === cases.length ? 0 : 1);
