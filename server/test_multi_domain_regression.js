/**
 * Multi-Domain Regression Test Suite (v3.1.0)
 * Evaluates the 9-Stage MCQ Generation Engine across 5 distinct domains:
 * 1. Theory CS (Data Structures & B-Trees)
 * 2. SQL Databases (PostgreSQL JOIN & Grouping)
 * 3. Python Algorithms (Asyncio & Decorators)
 * 4. Linux & Shell (Permissions & Process Signals)
 * 5. Noisy OCR Slides (Short academic text with slide headers)
 */

const assert = require('assert');
const { generateMCQPipeline } = require('./engine/mcqEngine');
const cacheManager = require('./utils/cacheManager');

const DOMAIN_DATASETS = {
  THEORY_CS: `
Chapter 4: Advanced Data Structures - B-Tree Indexing
A B-Tree is a self-balancing search tree in which nodes can have more than two children.
B-Trees are optimized for storage systems that read and write large blocks of memory.
Key properties: Every node has at most m children. Non-leaf nodes with k children contain k-1 keys.
Search, insertion, and deletion operations take O(log n) logarithmic time complexity.
`,
  SQL_DATABASES: `
Assignment 2: PostgreSQL Relational Database Queries
Dataset: e_commerce.sql (orders table, customers table)

Task 1: Aggregation & Multi-Table Joins
Write a SQL query using SELECT, INNER JOIN, and GROUP BY to calculate total revenue per customer country.
Use HAVING count(order_id) > 10 to filter high-volume regions.
Use ORDER BY revenue DESC to rank top purchasing countries.
`,
  PYTHON_ALGORITHMS: `
Module 3: Python Asynchronous Programming & Concurrency
Asyncio uses an event loop to execute asynchronous tasks concurrently without multi-threading.
Use async def to declare coroutines and await to pause execution until a Future resolves.
Decorators like @functools.wraps preserve original function metadata.
Memory management uses reference counting and a generational garbage collector.
`,
  LINUX_SHELL: `
Lab 5: Linux System Administration & Shell Scripting
File permissions are represented by rwx triplets for User, Group, and Others.
Use chmod 755 script.sh to grant execute permissions.
Process management: kill -9 send SIGKILL to terminate processes immediately.
Pipe operator (|) redirects stdout of one process to stdin of the next.
`,
  NOISY_SLIDES: `
CSE401 - SLIDE 12 - TOPIC 4
PAGE 44 / 120 (RKR21)
Unit-3 Software Design Patterns
Singleton Pattern ensures a class has only one instance and provides a global access point.
Factory Method defines an interface for creating objects in a superclass.
`
};

async function runMultiDomainRegressionSuite() {
  cacheManager.resetStore?.();
  console.log("\n======================================================================");
  console.log(" 🧪 MULTI-DOMAIN REGRESSION TEST SUITE (v3.1.0)");
  console.log("======================================================================\n");

  const results = [];

  for (const [domainName, sampleText] of Object.entries(DOMAIN_DATASETS)) {
    console.log(`\n--- TESTING DOMAIN: ${domainName} ---`);

    const result = await generateMCQPipeline({
      content: sampleText,
      difficulty: "Balanced",
      requestedCount: 3,
      requestId: `regression_${domainName.toLowerCase()}_${Date.now()}`
    });

    const quiz = result.finalQuiz;
    assert.strictEqual(Array.isArray(quiz.questions) && quiz.questions.length > 0, true, `${domainName} should yield valid questions`);

    console.log(`  ├─ Questions Delivered: ${quiz.questions.length}`);
    console.log(`  ├─ Detected Profile Language: ${result.portfolioSummary?.globalReview ? 'PASS' : 'WARN'}`);
    console.log(`  └─ Sample Q1 (${quiz.questions[0].targetBloom || 'APPLY'}): "${quiz.questions[0].stem || quiz.questions[0].question}"`);

    results.push({ domain: domainName, count: quiz.questions.length, status: "PASSED" });
  }

  console.log("\n======================================================================");
  console.log(" 📊 REGRESSION SUITE RESULTS SUMMARY:");
  results.forEach(r => console.log(`  ✅ [${r.domain}] ${r.count} MCQs Generated | Status: ${r.status}`));
  console.log("======================================================================\n");
}

runMultiDomainRegressionSuite().catch(err => {
  console.error("❌ Multi-Domain Regression Test Failed:", err);
  process.exit(1);
});
