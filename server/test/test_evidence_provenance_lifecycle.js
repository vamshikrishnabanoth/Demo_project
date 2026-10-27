/**
 * server/test/test_evidence_provenance_lifecycle.js
 *
 * Verifies that:
 * 1. Early, middle, and late lecture targets receive authentic segment evidence.
 * 2. Deep-segment concepts occurring after character 1,500 of a large chunk receive a
 *    match-centered evidence window that captures the target concept and its direct context.
 * 3. Attached evidence directly supports the target concept rather than falling back to
 *    the first 1,500 characters of the lecture introduction.
 */

'use strict';

const assert = require('assert');
const agent1Planner = require('../engine/agents/agent1Planner');

console.log('======================================================================');
console.log('🧪 VERIFYING EVIDENCE PROVENANCE & TARGET-SPECIFIC RETRIEVAL LIFECYCLE');
console.log('======================================================================\n');

// Build a simulated 3-segment multimodal lecture store:
// Chunk 1: Early (00:00 - 15:00) - Basic definitions, intro
// Chunk 2: Mid (15:00 - 30:00) - Core mechanisms
// Chunk 3: Late (30:00 - 45:00) - Large segment (5,000 chars) with a deep concept at char 3,200

const earlyText = 'Welcome to today lecture on Memory Management. Operating systems use paging and segmentation to manage memory hierarchies. Page tables translate virtual addresses to physical frames.';
const midText = 'In multi-level page tables, the page directory entry points to a second-level page table. Translation lookaside buffers act as high-speed caches for recent translations to eliminate memory lookup penalties.';

// Deep late text: 5,000 characters with "Demand Paging Working Set Invariant" located at char 3,200
const fillerBefore = 'This is section introductory text discussing physical memory constraints and swap space dynamics. '.repeat(32); // ~3,136 chars
const deepConceptText = 'Under the Demand Paging Working Set Invariant, the operating system tracks page access frequency across a sliding time window. If the total working set size exceeds available physical frames, severe page fault thrashing occurs immediately, degrading CPU utilization to near zero.';
const fillerAfter = ' Additional operational notes regarding swap space partitioning and dirty page daemon write-back intervals. '.repeat(15);
const lateText = fillerBefore + deepConceptText + fillerAfter;

assert.ok(lateText.length > 4500, `Late text must be long (${lateText.length} chars)`);
const deepConceptOffset = lateText.indexOf('Demand Paging Working Set Invariant');
assert.ok(deepConceptOffset > 3000, `Deep concept must occur after char 3,000 (actual: ${deepConceptOffset})`);

const mockEvidencePackage = {
  subject: 'Operating Systems',
  topic: 'Memory Management & Paging',
  multimodalStore: {
    children: [
      {
        evidenceId: 'CHUNK_01_EARLY',
        sourceType: 'TRANSCRIPT',
        hasRealTimestamps: true,
        timeSpan: { formatted: '04:12' },
        text: earlyText
      },
      {
        evidenceId: 'CHUNK_02_MID',
        sourceType: 'TRANSCRIPT',
        hasRealTimestamps: true,
        timeSpan: { formatted: '21:45' },
        text: midText
      },
      {
        evidenceId: 'CHUNK_03_LATE',
        sourceType: 'TRANSCRIPT',
        hasRealTimestamps: true,
        timeSpan: { formatted: '38:30' },
        text: lateText
      }
    ]
  },
  unifiedRawContent: earlyText + '\n\n' + midText + '\n\n' + lateText
};

// Test 1: Early target gets early chunk
console.log('--- TEST 1: Early Target Evidence Provenance ---');
const earlyProv = agent1Planner._resolveTargetEvidenceProvenance('Paging and Segmentation', 'Paging', 'EARLY', mockEvidencePackage);
assert.strictEqual(earlyProv.sourceChunks[0], 'CHUNK_01_EARLY', 'Must match early chunk');
assert.strictEqual(earlyProv.timestamp, '04:12', 'Must carry early timestamp');
assert.ok(earlyProv.supportingEvidence.includes('paging and segmentation'), 'Must contain early concept text');
console.log(' ✅ PASS: Early target successfully grounded in early chunk (04:12).\n');

// Test 2: Mid target gets mid chunk
console.log('--- TEST 2: Mid Target Evidence Provenance ---');
const midProv = agent1Planner._resolveTargetEvidenceProvenance('Translation Lookaside Buffer', 'TLB Cache', 'MID', mockEvidencePackage);
assert.strictEqual(midProv.sourceChunks[0], 'CHUNK_02_MID', 'Must match mid chunk');
assert.strictEqual(midProv.timestamp, '21:45', 'Must carry mid timestamp');
assert.ok(midProv.supportingEvidence.includes('Translation lookaside buffers'), 'Must contain mid concept text');
console.log(' ✅ PASS: Mid target successfully grounded in mid chunk (21:45).\n');

// Test 3: Late target with concept in early part of late chunk
console.log('--- TEST 3: Late Target Evidence Provenance ---');
const latePhaseProv = agent1Planner._resolveTargetEvidenceProvenance('Swap Space Dynamics', 'Memory Constraints', 'LATE', mockEvidencePackage);
assert.strictEqual(latePhaseProv.sourceChunks[0], 'CHUNK_03_LATE', 'Must match late chunk');
assert.strictEqual(latePhaseProv.timestamp, '38:30', 'Must carry late timestamp');
assert.ok(latePhaseProv.supportingEvidence.includes('swap space dynamics'), 'Must contain late concept text');
console.log(' ✅ PASS: Late target successfully grounded in late chunk (38:30).\n');

// Test 4: Deep concept occurring AFTER character 1,500 (at offset 3,200)
console.log('--- TEST 4: Deep Concept Offset (> 1,500 chars) Match-Centered Window ---');
const deepProv = agent1Planner._resolveTargetEvidenceProvenance(
  'Demand Paging Working Set Invariant',
  'Page Fault Thrashing',
  'LATE',
  mockEvidencePackage
);

assert.strictEqual(deepProv.sourceChunks[0], 'CHUNK_03_LATE', 'Must match late chunk');
assert.ok(deepProv.supportingEvidence.length <= 1500, `Evidence window must be bounded to <= 1500 chars, got: ${deepProv.supportingEvidence.length}`);
assert.ok(
  deepProv.supportingEvidence.includes('Demand Paging Working Set Invariant'),
  'CRITICAL: Match-centered window must include the deep concept text located at offset 3,200!'
);
assert.ok(
  deepProv.supportingEvidence.includes('severe page fault thrashing occurs immediately'),
  'CRITICAL: Window must include the causal consequence text immediately surrounding the concept!'
);
// Confirm it did NOT just take the beginning (filler) of the chunk
assert.ok(
  !deepProv.supportingEvidence.startsWith('This is section introductory text discussing physical memory constraints and swap space dynamics. This is section introductory text'),
  'Must not be anchored to character 0 of the 5,000 char chunk'
);
console.log(' ✅ PASS: Deep concept located at offset ' + deepConceptOffset + ' successfully captured within centered 1,500-char window.\n');

// Test 5: Fallback plan generation preserves provenance across all slots
console.log('--- TEST 5: Fallback Plan Evidence Integrity Across Trajectory Phases ---');
const fallbackPlan = agent1Planner._buildFallbackPlan(
  mockEvidencePackage.unifiedRawContent,
  'Balanced',
  3,
  {},
  {},
  ['Paging and Segmentation', 'Translation Lookaside Buffer', 'Demand Paging Working Set Invariant'],
  mockEvidencePackage
);

assert.strictEqual(fallbackPlan.assessmentTargets.length, 3, 'Must have 3 targets');
const [tEarly, tMid, tLate] = fallbackPlan.assessmentTargets;

assert.strictEqual(tEarly.trajectoryPhase, 'EARLY');
assert.ok(tEarly.supportingEvidence.includes('paging and segmentation'), 'T01 must carry early chunk evidence');

assert.strictEqual(tMid.trajectoryPhase, 'MID');
assert.ok(tMid.supportingEvidence.includes('Translation lookaside buffers'), 'T02 must carry mid chunk evidence');

assert.strictEqual(tLate.trajectoryPhase, 'LATE');
assert.ok(tLate.supportingEvidence.includes('Demand Paging Working Set Invariant'), 'T03 must carry deep late evidence');

console.log(' ✅ PASS: Fallback plan correctly distributes target-specific evidence across EARLY, MID, and LATE phases.\n');

// Test 6: Paraphrased target concept name without exact substring matches
console.log('--- TEST 6: Paraphrased Concept Name Robustness ---');
// Target uses paraphrased concept: 'Thrashing dynamics under memory pressure'
// Exact phrase does NOT exist in chunk 3, but 'thrashing' and 'memory' do occur at offset 3,200.
const paraphrasedProv = agent1Planner._resolveTargetEvidenceProvenance(
  'Thrashing dynamics under memory pressure',
  'Virtual Memory Scaling',
  'LATE',
  mockEvidencePackage
);

assert.strictEqual(paraphrasedProv.sourceChunks[0], 'CHUNK_03_LATE', 'Must match late chunk via content keyword');
assert.ok(paraphrasedProv.supportingEvidence.includes('severe page fault thrashing occurs immediately'), 'Must center on thrashing evidence at offset 3,200');
assert.ok(
  !paraphrasedProv.supportingEvidence.startsWith('This is section introductory text discussing physical memory constraints and swap space dynamics. This is section introductory text'),
  'Paraphrased match must NOT silently default to character 0 of the chunk'
);
console.log(' ✅ PASS: Paraphrased concept successfully mapped via content keywords to offset 3,200 without falling back to character 0.\n');

console.log('======================================================================');
console.log('🏁 ALL 6 EVIDENCE PROVENANCE LIFECYCLE TESTS PASSED CLEANLY!');
console.log('======================================================================');
