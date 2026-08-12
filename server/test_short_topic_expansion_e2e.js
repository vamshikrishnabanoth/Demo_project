/**
 * Short Topic & Small Description Auto-Expansion E2E Test Suite (v3.3.0)
 * Verifies that small inputs like "OS", "Python", "Java", "C", "SQL", "HTML", "AI", "ML"
 * and short descriptions (e.g., "Python OS basics") generate valid MCQs cleanly without length errors.
 */

const assert = require('assert');
const { generateMCQPipeline } = require('./engine/mcqEngine');
const { expandShortTopicDescription } = require('./engine/documentAnalyzer/topicExpander');
const cacheManager = require('./utils/cacheManager');

const SHORT_TOPIC_INPUTS = [
  'OS',
  'Python',
  'Java',
  'C',
  'SQL',
  'HTML',
  'AI',
  'Python OS basics'
];

async function runShortTopicExpansionSuite() {
  console.log("\n======================================================================");
  console.log(" 🧪 SHORT TOPIC & SMALL DESCRIPTION EXPANSION TEST SUITE (v3.3.0)");
  console.log("======================================================================\n");

  cacheManager.resetStore?.();

  for (const topicInput of SHORT_TOPIC_INPUTS) {
    console.log(`\n--- TESTING SHORT TOPIC INPUT: "${topicInput}" ---`);

    // 1. Verify Expander Functionality
    const expanded = expandShortTopicDescription(topicInput);
    assert.strictEqual(expanded.length >= 100, true, `Expanded payload for '${topicInput}' should be >= 100 characters.`);
    console.log(`  ├─ Expanded Text Length: ${expanded.length} chars`);

    // 2. Execute 9-Stage MCQ Pipeline on Short Input
    const pipelineResult = await generateMCQPipeline({
      content: topicInput,
      difficulty: 'Balanced',
      requestedCount: 3,
      requestId: `test_short_topic_${topicInput.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`
    });

    const quiz = pipelineResult.finalQuiz;
    assert.strictEqual(Array.isArray(quiz.questions) && quiz.questions.length > 0, true, `Should generate questions for topic '${topicInput}'`);

    console.log(`  ├─ Questions Generated: ${quiz.questions.length}`);
    console.log(`  ├─ Detected Profile Language: ${pipelineResult.portfolioSummary?.globalReview ? 'PASS' : 'WARN'}`);
    console.log(`  └─ Sample Q1 (${quiz.questions[0].targetBloom || 'RECALL'}): "${quiz.questions[0].question || quiz.questions[0].stem}"`);
  }

  console.log("\n======================================================================");
  console.log(" 🎉 ALL SHORT TOPIC & SMALL DESCRIPTION EXPANSION TESTS PASSED!");
  console.log("======================================================================\n");
}

runShortTopicExpansionSuite().catch(err => {
  console.error("❌ Short Topic Expansion Test Failed:", err);
  process.exit(1);
});
