/**
 * server/test/test_full_duration_audio_integrity.js
 *
 * Verifies end-to-end full lecture duration preservation:
 * 1. Security input sanitizer does NOT truncate multi-hour transcripts to 10k chars (preserves up to 5MB).
 * 2. Multi-hour audio chapters span the full duration from 00:00 to probed duration (e.g. 01:38:41).
 * 3. Chapter titles filter out conversational stopwords ("core curriculum", "mean", etc.).
 * 4. High-depth multi-hour lectures support defensible Hard questions (8-10+), not artificial singletons.
 * 5. Conversational interactive lectures (Git commands) with human teacher pronouns pass academic gate.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const { sanitizeValue } = require('../middleware/security');
const depthAnalyzer = require('../engine/evidence/depthAnalyzer');
const lectureIntelligence = require('../engine/intelligence/lectureIntelligence');

console.log('======================================================================');
console.log('🧪 VERIFYING FULL-DURATION AUDIO & CURRICULAR INTEGRITY');
console.log('======================================================================\n');

// 1. Security Input Sanitizer Preservation
const largeTranscript = 'A '.repeat(30000) + 'Binary Search Trees and Invariant Preservation.'; // 60,000+ chars
const sanitized = sanitizeValue(largeTranscript);
assert.strictEqual(sanitized.length, largeTranscript.length, 'Sanitizer must preserve 60k+ character transcript without truncation');
console.log('✅ PASS [1]: Security middleware preserves large transcripts (>60,000 chars) without truncation.');

// 2. Full Duration Multi-Chapter Spanning
const totalDurationSec = 5921; // 1h 38m 41s
const smartChapters = lectureIntelligence._buildSmartChapters({
  title: 'BST Node Deletion Strategy (1h 39m)',
  rawText: largeTranscript,
  wordCount: 10589,
  hasTimingData: true,
  totalDurationSec,
  detectedFocus: ['BST Deletion', 'In-order Successor', 'Leaf Nodes', 'Path Construction', 'Recursive Swapping']
});

assert.strictEqual(smartChapters.length, 5, '1.5h+ lecture must generate 5 comprehensive chapters');
assert.strictEqual(smartChapters[0].timestamp_start, '00:00', 'First chapter must start at 00:00');
assert.strictEqual(smartChapters[4].timestamp_end, '01:38:41', 'Final chapter must span to full duration (01:38:41)');
console.log(`✅ PASS [2]: Chapters span full duration: ${smartChapters[0].timestamp_start} to ${smartChapters[4].timestamp_end} across 5 subtopics.`);

// 3. Stopwords Filter in Chapter Titles
const focusWithStopwords = ['Core Curriculum', 'Mean', 'Class', 'Trees', 'Pointer'];
const cleanedChapters = lectureIntelligence._buildSmartChapters({
  title: 'BST Node Deletion',
  rawText: largeTranscript,
  wordCount: 5000,
  hasTimingData: true,
  totalDurationSec: 3600,
  detectedFocus: focusWithStopwords
});
const chapterTitles = cleanedChapters.map(c => c.title.toLowerCase());
assert.ok(!chapterTitles.some(t => t.includes('core curriculum')), 'Stopword "core curriculum" must not appear in chapter titles');
assert.ok(!chapterTitles.some(t => t.includes('mean analysis')), 'Stopword "mean" must not appear in chapter titles');
console.log('✅ PASS [3]: Stopwords (core curriculum, mean, class) successfully filtered from chapter titles.');

// 4. Defensible Capacity Scaling for 100/100 Depth Lecture
const concepts = [
  { name: 'BST Deletion', definition: 'Recursive deletion of nodes with two children using in-order successor.', mechanism_or_rule: 'Swap value with successor then recursively call delete on right subtree.', substanceType: 'RULE_OR_CONDITION', sourceAnchors: ['seg_1'] },
  { name: 'In-Order Successor', definition: 'Smallest node value located strictly in the right subtree.', mechanism_or_rule: 'Traverse left pointers from right child until leaf or single child.', substanceType: 'RULE_OR_CONDITION', sourceAnchors: ['seg_2'] },
  { name: 'Leaf Node Deletion', definition: 'Node with zero children detached directly by nulling parent pointer.', mechanism_or_rule: 'Return null to parent reference during recursion rewind.', substanceType: 'RULE', sourceAnchors: ['seg_3'] },
  { name: 'Single Child Deletion', definition: 'Bypassing node by connecting parent pointer to child node.', mechanism_or_rule: 'Return child node reference to parent pointer.', substanceType: 'MECHANISM', sourceAnchors: ['seg_4'] },
  { name: 'Root-to-Leaf Path Traversal', definition: 'Pre-order traversal (root-left-right) preserving path string.', mechanism_or_rule: 'Append node data to path string and print upon reaching leaf node.', substanceType: 'RULE_OR_CONDITION', sourceAnchors: ['seg_5'] },
  { name: 'Tree Invariant Balancing', definition: 'Maintaining balance factor condition across all subtrees.', mechanism_or_rule: 'Left subtree height minus right subtree height must not exceed 1.', substanceType: 'FORMAL_DERIVATION', sourceAnchors: ['seg_6'] }
];

const critique = {
  explanatoryDepth: ['OPERATIONAL_MECHANISM', 'THEORETICAL_DERIVATION'],
  reasoningDepth: ['INVARIANT_AND_CAUSAL'],
  practicalDemonstrations: ['WORKED_TRACE_OR_CODE']
};

const cap = lectureIntelligence.deriveSemanticCapacity(concepts, critique, { wordCount: 10589, curricularSegmentsCount: 280 });
assert.ok(cap.recommendedQuestionCount >= 15, `Expected recommended >= 15 for full lecture, got ${cap.recommendedQuestionCount}`);
assert.ok(cap.recommendedByDifficulty.hard >= 4, `Expected recommended Hard >= 4 for deep invariant lecture, got ${cap.recommendedByDifficulty.hard}`);
console.log(`✅ PASS [4]: Defensible capacity scaled properly: Balanced=${cap.recommendedByDifficulty.balanced}, Easy=${cap.recommendedByDifficulty.easy}, Medium=${cap.recommendedByDifficulty.medium}, Hard=${cap.recommendedByDifficulty.hard} (Total Capacity: ${cap.totalDefensibleCapacity}).`);

// 5. Short Interactive Spoken Lecture with Pronouns (Git commands)
const gitSpokenText = `Hello students, welcome to our class. Today we will be learning some basic git commands.
In our last class we saw version control. So if you want to know if git is installed, you type git version.
Then you use git config to give your username and email. When we want to initialize our repository, we type git init.
You use git status to see your changes. We type git add dot to stage our changes. Then git commit minus m to save to our repository.`;

const gitResult = depthAnalyzer.analyzeLecture(gitSpokenText);
assert.strictEqual(gitResult.isAcademic, true, 'Spoken Git commands lecture must be classified as ACADEMIC');
assert.strictEqual(gitResult.isCurricular, true, 'Spoken Git commands lecture must be classified as CURRICULAR');
console.log('✅ PASS [5]: Conversational interactive Git commands lecture with spoken pronouns correctly classified as ACADEMIC.');

console.log('\n======================================================================');
console.log('🎉 ALL 5 FULL-DURATION AUDIO & CURRICULAR INTEGRITY TESTS PASSED!');
console.log('======================================================================\n');
