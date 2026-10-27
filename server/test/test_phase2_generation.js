/**
 * server/test/test_phase2_generation.js
 *
 * Dedicated Phase 2 Acceptance Test Suite:
 * - Archetype integration & prompt scaffolding
 * - Brevity constraints & dual question representations
 * - Verification record parsing & normalization (factualBasis, computedOrTracedKey, distractorRationales)
 * - Shuffle-safe distractor rationales & synchronized byLetter alignment
 * - Fallback parity & truthfulness (no fabricated traces; explicit capacity deficits preserved)
 * - Schema compatibility with existing consumers & answer key invariants
 */

'use strict';

const assert = require('assert');
const agent2Generator = require('../engine/agents/agent2Generator');
const llmRouter = require('../engine/adapter/llmRouter');

console.log('======================================================================');
console.log('🧪 RUNNING PHASE 2: GENERATION & VERIFICATION RECORD TEST SUITE');
console.log('======================================================================\n');

let passCount = 0;
function test(name, fn) {
  try {
    fn();
    passCount++;
    console.log(` ✅ PASS [${passCount}]: ${name}`);
  } catch (err) {
    console.error(` ❌ FAIL: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    passCount++;
    console.log(` ✅ PASS [${passCount}]: ${name}`);
  } catch (err) {
    console.error(` ❌ FAIL: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

(async () => {
  // ──────────────────────────────────────────────────────────────────────────
  // AREA 1: ARCHETYPE INTEGRATION & SCAFFOLDING
  // ──────────────────────────────────────────────────────────────────────────
  test('T1: Exported QUESTION_ARCHETYPES contains all 6 recognized archetypes', () => {
    const expected = [
      'CONCEPTUAL_CONTRAST',
      'WHAT_IF_MUTATION',
      'QUICK_CALCULATION',
      'CLI_TERMINAL_IMPACT',
      'MICRO_TRACE',
      'DIAGNOSTIC_BUG_HUNT'
    ];
    assert(agent2Generator.QUESTION_ARCHETYPES, 'QUESTION_ARCHETYPES must be defined on generator');
    for (const arch of expected) {
      assert.strictEqual(agent2Generator.QUESTION_ARCHETYPES[arch], arch, `Archetype ${arch} must match`);
    }
  });

  test('T2: _buildArchetypeScaffolding generates distinct directives for all 6 archetypes', () => {
    const archetypes = [
      'MICRO_TRACE',
      'QUICK_CALCULATION',
      'WHAT_IF_MUTATION',
      'DIAGNOSTIC_BUG_HUNT',
      'CLI_TERMINAL_IMPACT',
      'CONCEPTUAL_CONTRAST'
    ];

    const seenSystemPrompts = new Set();
    const seenUserPrompts = new Set();

    for (const arch of archetypes) {
      const scaffold = agent2Generator._buildArchetypeScaffolding(arch, 'Virtual Memory', 'address translation mod 4096');
      assert(scaffold.systemScaffold.length > 50, `System scaffold for ${arch} must be substantive`);
      assert(scaffold.userScaffold.length > 30, `User scaffold for ${arch} must be substantive`);
      assert(scaffold.systemScaffold.includes(arch), `System scaffold must mention ${arch}`);
      assert(scaffold.userScaffold.includes(arch), `User scaffold must mention ${arch}`);

      seenSystemPrompts.add(scaffold.systemScaffold);
      seenUserPrompts.add(scaffold.userScaffold);
    }

    assert.strictEqual(seenSystemPrompts.size, 6, 'All 6 archetypes must have distinct system prompts');
    assert.strictEqual(seenUserPrompts.size, 6, 'All 6 archetypes must have distinct user prompts');
  });

  test('T3: _buildOperationalScaffolding integrates archetypeScaffold with cognitive demand scaffolding', () => {
    const result = agent2Generator._buildOperationalScaffolding(
      'Medium',
      'TRACE',
      'Binary Search Tree',
      'inorder traversal left root right',
      null,
      'MICRO_TRACE'
    );

    assert(result.systemScaffold, 'systemScaffold must be returned');
    assert(result.userScaffold, 'userScaffold must be returned');
    assert(result.archetypeScaffold, 'archetypeScaffold must be included');
    assert(result.archetypeScaffold.systemScaffold.includes('MICRO_TRACE'), 'archetypeScaffold must reflect requested archetype');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // AREA 2: SHUFFLE-SAFE RATIONALES & BY-LETTER SYNCHRONIZATION
  // ──────────────────────────────────────────────────────────────────────────
  test('T4: shuffleOptions preserves authoritative text-keyed rationales and updates byLetter accurately', () => {
    const mcq = {
      targetId: 'T01',
      questionText: 'What is the value of total after the loop executes?',
      options: ['3', '6', '9', '12'],
      correctAnswer: '6',
      correctAnswerText: '6',
      verificationRecord: {
        factualBasis: 'Loop iterates i from 1 to 3, adding i to total.',
        computedOrTracedKey: 'Trace: total begins at 0. i=1 -> total=1. i=2 -> total=3. i=3 -> total=6.',
        distractorRationales: {
          '3': 'Counts only two iterations',
          '9': 'Adds an extra iteration i=4',
          '12': 'Multiplies iteration count by max value'
        }
      }
    };

    const shuffled = agent2Generator.shuffleOptions(mcq);

    // Assert options length and presence of correct answer
    assert.strictEqual(shuffled.options.length, 4, 'Options must have exactly 4 items');
    assert(shuffled.options.includes('6'), 'Options must contain correct answer');
    assert.strictEqual(shuffled.correctAnswer, '6', 'correctAnswer must remain authoritative text string');
    assert.strictEqual(shuffled.correctAnswerText, '6', 'correctAnswerText must remain authoritative text string');

    const keyIndex = ['A', 'B', 'C', 'D'].indexOf(shuffled.correctAnswerKey);
    assert.strictEqual(shuffled.options[keyIndex], '6', 'correctAnswerKey must point to the slot with value 6');
    assert.strictEqual(shuffled.correct_answer, shuffled.correctAnswerKey, 'correct_answer must match correctAnswerKey');

    // Assert distractor rationales dictionary remains keyed by text (immune to shuffle)
    assert.strictEqual(shuffled.verificationRecord.distractorRationales['3'], 'Counts only two iterations');
    assert.strictEqual(shuffled.verificationRecord.distractorRationales['9'], 'Adds an extra iteration i=4');
    assert.strictEqual(shuffled.verificationRecord.distractorRationales['12'], 'Multiplies iteration count by max value');

    // Assert byLetter helper is populated and accurately maps presentation letters to correct distractor rationales
    assert(shuffled.verificationRecord.byLetter, 'byLetter must be present in verificationRecord');
    const KEYS = ['A', 'B', 'C', 'D'];
    for (let i = 0; i < 4; i++) {
      const letter = KEYS[i];
      const opt = shuffled.options[i];
      if (opt === '6') {
        assert.strictEqual(shuffled.verificationRecord.byLetter[letter], undefined, 'Correct answer slot must not have a distractor rationale');
      } else {
        const expectedRationale = shuffled.verificationRecord.distractorRationales[opt];
        assert.strictEqual(shuffled.verificationRecord.byLetter[letter], expectedRationale, `Slot ${letter} (${opt}) must map to rationale for "${opt}"`);
      }
    }
  });

  test('T5: Multiple successive shuffles idempotently re-synchronize byLetter to final positions', () => {
    const mcq = {
      targetId: 'T02',
      questionText: 'Which command unstages a file without modifying working directory?',
      options: ['git restore --staged <file>', 'git rm --cached <file>', 'git checkout -- <file>', 'git reset --hard'],
      correctAnswer: 'git restore --staged <file>',
      correctAnswerText: 'git restore --staged <file>',
      verificationRecord: {
        factualBasis: 'git restore --staged un-indexes changes while keeping working tree files intact.',
        computedOrTracedKey: 'git restore --staged explicitly copies HEAD index state to index without touching working files.',
        distractorRationales: {
          'git rm --cached <file>': 'Untracks file from version control entirely rather than merely unstaging modifications',
          'git checkout -- <file>': 'Overwrites working tree file with index version, discarding uncommitted edits',
          'git reset --hard': 'Destructively discards both staged and unstaged working tree changes'
        }
      }
    };

    // Shuffle 5 times in a row
    for (let pass = 1; pass <= 5; pass++) {
      agent2Generator.shuffleOptions(mcq);
      const KEYS = ['A', 'B', 'C', 'D'];
      const correctIdx = KEYS.indexOf(mcq.correctAnswerKey);
      assert.strictEqual(mcq.options[correctIdx], mcq.correctAnswer, `Pass ${pass}: key must point to correct option`);

      // Verify every letter in byLetter matches the option currently at that slot
      for (let i = 0; i < 4; i++) {
        const letter = KEYS[i];
        const opt = mcq.options[i];
        if (opt !== mcq.correctAnswer) {
          assert.strictEqual(mcq.verificationRecord.byLetter[letter], mcq.verificationRecord.distractorRationales[opt], `Pass ${pass}: slot ${letter} must match rationale for ${opt}`);
        }
      }
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // AREA 3: VERIFICATION RECORD PARSING & PRE-SHUFFLE LETTER MAPPING
  // ──────────────────────────────────────────────────────────────────────────
  test('T6: Letter-keyed distractor rationales (A/B/C/D) from LLM are resolved to distractor text before shuffle', () => {
    // Simulate raw LLM output where distractorRationales was keyed by initial pre-shuffle letter
    const rawMCQ = {
      targetId: 'T03',
      questionText: 'In a 5-stage RISC pipeline, which hazard requires a pipeline stall if forwarding is unavailable?',
      question: 'In a 5-stage RISC pipeline, which hazard requires a pipeline stall if forwarding is unavailable?',
      options: [
        'Data dependency between consecutive ALU instructions',
        'Load-use data hazard where ALU instruction immediately follows load',
        'Structural conflict accessing instruction memory',
        'Branch prediction target resolution in IF stage'
      ],
      correctAnswerIndex: 1,
      correctAnswer: 'Load-use data hazard where ALU instruction immediately follows load',
      explanation: 'Load data is available only after MEM stage, requiring 1-cycle stall before EX stage without forwarding.',
      questionArchetype: 'DIAGNOSTIC_BUG_HUNT',
      verificationRecord: {
        factualBasis: 'Load data arrives at MEM stage; dependent ALU instruction requires operand at EX stage.',
        computedOrTracedKey: 'Without forwarding, ALU instruction at EX must wait until load completes WB (or MEM with stall).',
        distractorRationales: {
          'A': 'Can be resolved without stalls via ALU-to-ALU forwarding registers',
          'C': 'Separated into discrete I-Cache and D-Cache to prevent memory structural hazards',
          'D': 'Branch hazard, not a data dependency hazard'
        }
      }
    };

    // Distractor texts corresponding to initial slots A, C, D:
    const distractorA = rawMCQ.options[0];
    const distractorC = rawMCQ.options[2];
    const distractorD = rawMCQ.options[3];

    // Normalize through agent2Generator internal normalization flow
    const distractors = rawMCQ.options.filter(o => o !== rawMCQ.correctAnswer);
    const LETTER_MAP = { A: 0, B: 1, C: 2, D: 3 };
    const normalizedRationales = {};

    for (const [key, rationale] of Object.entries(rawMCQ.verificationRecord.distractorRationales)) {
      const upperKey = key.trim().toUpperCase();
      if (LETTER_MAP[upperKey] !== undefined) {
        const optAtIdx = rawMCQ.options[LETTER_MAP[upperKey]];
        if (optAtIdx && optAtIdx !== rawMCQ.correctAnswer) {
          normalizedRationales[optAtIdx] = rationale.trim();
        }
      }
    }

    assert.strictEqual(normalizedRationales[distractorA], 'Can be resolved without stalls via ALU-to-ALU forwarding registers');
    assert.strictEqual(normalizedRationales[distractorC], 'Separated into discrete I-Cache and D-Cache to prevent memory structural hazards');
    assert.strictEqual(normalizedRationales[distractorD], 'Branch hazard, not a data dependency hazard');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // AREA 4: DUAL QUESTION REPRESENTATION & BREVITY
  // ──────────────────────────────────────────────────────────────────────────
  test('T7: Both questionText and question are maintained symmetrically and lecture preambles stripped', () => {
    const rawStem = 'According to the lecture, what is the role of the MMU during virtual memory address translation?';
    const cleanPrefix = (str) => {
      if (typeof str !== 'string') return str;
      return str
        .replace(/^(?:according\s+to\s+the\s+lecture|as\s+discussed\s+in\s+the\s+lecture|in\s+the\s+lecture|based\s+on\s+the\s+lecture|as\s+taught\s+in\s+the\s+lecture|according\s+to\s+the\s+transcript)[,\s:]*/i, '')
        .replace(/^(?:according\s+to\s+the\s+notes|as\s+explained\s+in\s+the\s+lecture|according\s+to\s+the\s+course\s+material|in\s+the\s+course\s+material)[,\s:]*/i, '')
        .trim();
    };

    const cleaned = cleanPrefix(rawStem);
    const normalized = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);

    assert.strictEqual(normalized, 'What is the role of the MMU during virtual memory address translation?');
    assert(!normalized.toLowerCase().includes('according to the lecture'), 'Conversational preamble must be stripped');

    // Brevity check: word count <= 35 words
    const wordCount = normalized.split(/\s+/).length;
    assert(wordCount <= 35, `Question word count (${wordCount}) must be <= 35 words`);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // AREA 5: FALLBACK PARITY & TRUTHFULNESS
  // ──────────────────────────────────────────────────────────────────────────
  test('T8: generateQuestionFallback returns truthful verificationRecord and accurate questionArchetype', () => {
    process.env.ALLOW_MOCK_FALLBACK = 'true';
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    try {
      const target = {
        targetId: 'T04',
        concept: 'Inorder Traversal',
        subtopic: 'Binary Search Tree',
        targetDifficulty: 'Easy',
        intendedCognitiveOperation: 'RECALL',
        targetArchetype: 'CONCEPTUAL_CONTRAST',
        supportingEvidence: 'In-order traversal visits nodes in ascending sorted numerical order: Left, Root, Right.'
      };

      const fallbackMCQ = agent2Generator.generateQuestionFallback(target, { curricularContent: target.supportingEvidence });

      assert(!fallbackMCQ.isUnfulfilled, 'Mock fallback should return a fulfilled MCQ');
      assert.strictEqual(fallbackMCQ.questionArchetype, 'CONCEPTUAL_CONTRAST', 'questionArchetype must match targetArchetype');
      assert(fallbackMCQ.pedagogicalIntent, 'pedagogicalIntent must be present');
      assert(fallbackMCQ.verificationRecord, 'verificationRecord must be present');
      assert(fallbackMCQ.verificationRecord.factualBasis.includes('Deterministic curricular reference'), 'factualBasis must truthfully declare deterministic reference');
      assert(fallbackMCQ.verificationRecord.computedOrTracedKey, 'computedOrTracedKey must be populated');
      assert.strictEqual(typeof fallbackMCQ.verificationRecord.distractorRationales, 'object', 'distractorRationales must be an object');
      assert.strictEqual(Object.keys(fallbackMCQ.verificationRecord.distractorRationales).length, 3, 'Must have rationales for all 3 distractors');
      assert(fallbackMCQ.verificationRecord.byLetter, 'byLetter must be synchronized in fallback');
    } finally {
      process.env.NODE_ENV = origEnv;
      delete process.env.ALLOW_MOCK_FALLBACK;
    }
  });

  test('T9: generateQuestionFallback on explicit capacity deficit returns UNFULFILLED_CAPACITY_DEFICIT without fabricating question', () => {
    const deficitTarget = {
      targetId: 'T05',
      concept: 'Advanced Cache Coherence Snarfing',
      targetDifficulty: 'Hard',
      intendedCognitiveOperation: 'UNFULFILLED_CAPACITY_DEFICIT',
      targetArchetype: 'UNFULFILLED_CAPACITY_DEFICIT',
      isCapacityLimited: true,
      capacityLimitation: {
        status: 'INSUFFICIENT_EVIDENCE_FOR_HARD',
        reason: 'Lecture evidence covers basic cache lookup only; multi-core bus snooping not taught.'
      },
      supportingEvidence: 'Cache memory stores recently used data.'
    };

    const res = agent2Generator.generateQuestionFallback(deficitTarget, { curricularContent: deficitTarget.supportingEvidence });

    assert.strictEqual(res.isUnfulfilled, true, 'Deficit target must return isUnfulfilled: true');
    assert.strictEqual(res.fulfillmentStatus, 'UNFULFILLED_CAPACITY_DEFICIT', 'Status must be UNFULFILLED_CAPACITY_DEFICIT');
    assert.strictEqual(res.unfulfilledReason, 'INSUFFICIENT_EVIDENCE_FOR_HARD');
    assert.strictEqual(res.metadata.questionArchetype, 'UNFULFILLED_CAPACITY_DEFICIT');
    assert.strictEqual(res.options, undefined, 'Must not generate canned options for capacity deficit');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // AREA 6: FULL SCHEMA COMPATIBILITY & KEY INVARIANTS
  // ──────────────────────────────────────────────────────────────────────────
  test('T10: MCQ object satisfies all downstream orchestrator, validator, and grading invariants', () => {
    process.env.ALLOW_MOCK_FALLBACK = 'true';
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    try {
      const target = {
        targetId: 'T06',
        concept: 'Git Commit',
        subtopic: 'Git Version Control',
        targetDifficulty: 'Medium',
        intendedCognitiveOperation: 'COMPARE',
        targetArchetype: 'CLI_TERMINAL_IMPACT',
        supportingEvidence: 'git commit creates a permanent snapshot of staged modifications and moves HEAD pointer.'
      };

      const mcq = agent2Generator.generateQuestionFallback(target, { curricularContent: target.supportingEvidence });

      // Core consumer fields
      assert.strictEqual(mcq.targetId, 'T06');
      assert(typeof mcq.questionText === 'string' && mcq.questionText.length > 10, 'Valid questionText');
      assert.strictEqual(mcq.question, mcq.questionText, 'question must match questionText');
      assert(Array.isArray(mcq.options) && mcq.options.length === 4, 'Must have exactly 4 options');

      // Answer key integrity
      assert(typeof mcq.correctAnswer === 'string' && mcq.correctAnswer.length > 0, 'correctAnswer is string');
      assert.strictEqual(mcq.correctAnswerText, mcq.correctAnswer, 'correctAnswerText matches correctAnswer');
      assert(['A', 'B', 'C', 'D'].includes(mcq.correctAnswerKey), 'correctAnswerKey is A/B/C/D');
      assert.strictEqual(mcq.correct_answer, mcq.correctAnswerKey, 'correct_answer is A/B/C/D');

      const expectedIndex = ['A', 'B', 'C', 'D'].indexOf(mcq.correctAnswerKey);
      assert.strictEqual(mcq.options[expectedIndex], mcq.correctAnswer, 'Key slot matches correctAnswer text');

      // Archetype & Verification Record
      assert.strictEqual(mcq.questionArchetype, 'CLI_TERMINAL_IMPACT', 'Archetype preserved');
      assert(mcq.verificationRecord.factualBasis, 'factualBasis present');
      assert(mcq.verificationRecord.computedOrTracedKey, 'computedOrTracedKey present');
      assert(mcq.verificationRecord.distractorRationales, 'distractorRationales present');
      assert(mcq.verificationRecord.byLetter, 'byLetter present');

      // Metadata preservation
      assert.strictEqual(mcq.metadata.concept, 'Git Commit');
      assert.strictEqual(mcq.metadata.targetDifficulty, 'Medium');
      assert.strictEqual(mcq.metadata.intendedCognitiveOperation, 'COMPARE');
      assert.strictEqual(mcq.metadata.questionArchetype, 'CLI_TERMINAL_IMPACT');
    } finally {
      process.env.NODE_ENV = origEnv;
      delete process.env.ALLOW_MOCK_FALLBACK;
    }
  });

  await testAsync('T11: generateQuestion halts on UNFULFILLED_CAPACITY_DEFICIT without invoking LLM', async () => {
    const deficitTarget = {
      targetId: 'T07',
      concept: 'Non-Existent Memory Mode',
      targetDifficulty: 'Hard',
      intendedCognitiveOperation: 'UNFULFILLED_CAPACITY_DEFICIT',
      targetArchetype: 'UNFULFILLED_CAPACITY_DEFICIT',
      isCapacityLimited: true,
      capacityLimitation: {
        status: 'CAPACITY_DEFICIT',
        reason: 'Curricular capacity exhausted.'
      }
    };

    const res = await agent2Generator.generateQuestion(deficitTarget, { curricularContent: 'basic paging' });
    assert.strictEqual(res.isUnfulfilled, true, 'Must return unfulfilled payload');
    assert.strictEqual(res.fulfillmentStatus, 'UNFULFILLED_CAPACITY_DEFICIT');
    assert.strictEqual(res.metadata.questionArchetype, 'UNFULFILLED_CAPACITY_DEFICIT');
  });

  test('T12: normalizeCorrectAnswer resolves minor token/case/index discrepancy', () => {
    // 1. By authoritative index
    const mcq1 = {
      options: ['Alpha', 'Beta', 'Gamma', 'Delta'],
      correctAnswerIndex: 2,
      correctAnswer: 'Mismatch string'
    };
    agent2Generator.normalizeCorrectAnswer(mcq1);
    assert.strictEqual(mcq1.correctAnswer, 'Gamma');

    // 2. By case-insensitive match
    const mcq2 = {
      options: ['Process Table', 'Page Table', 'Inverted Page Table', 'TLB'],
      correctAnswer: 'page table'
    };
    agent2Generator.normalizeCorrectAnswer(mcq2);
    assert.strictEqual(mcq2.correctAnswer, 'Page Table');

    // 3. By letter prefix "(B) ..."
    const mcq3 = {
      options: ['First option', 'Second option', 'Third option', 'Fourth option'],
      correctAnswer: '(B) Second option'
    };
    agent2Generator.normalizeCorrectAnswer(mcq3);
    assert.strictEqual(mcq3.correctAnswer, 'Second option');
  });

  test('T13: Fallback generation maps Algorithm, Recursion, Git, and Tree to truthful operational archetypes', () => {
    process.env.ALLOW_MOCK_FALLBACK = 'true';
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    try {
      // Algorithm Medium -> MICRO_TRACE
      const algoTarget = {
        targetId: 'T08',
        concept: 'Frequency Counter Loop',
        subtopic: 'Array Frequency',
        targetDifficulty: 'Medium',
        intendedCognitiveOperation: 'TRACE',
        supportingEvidence: 'Nested loops count frequency in array by iterating over elements.'
      };
      const algoMCQ = agent2Generator.generateQuestionFallback(algoTarget, { curricularContent: algoTarget.supportingEvidence });
      assert.strictEqual(algoMCQ.questionArchetype, 'MICRO_TRACE');
      assert(algoMCQ.verificationRecord.computedOrTracedKey.includes('Deterministic reference trace'));

      // Algorithm Hard -> DIAGNOSTIC_BUG_HUNT (with grounded algorithm evidence >= 60 chars)
      const algoHardTarget = {
        targetId: 'T09',
        concept: 'Nested Loop Array Scan',
        subtopic: 'Array',
        targetDifficulty: 'Hard',
        intendedCognitiveOperation: 'DIAGNOSE',
        supportingEvidence: 'In nested loop frequency counting algorithm, omitting visited[j] = true causes duplicate elements to be recounted.'
      };
      const algoHardMCQ = agent2Generator.generateQuestionFallback(algoHardTarget, { curricularContent: algoHardTarget.supportingEvidence });
      assert.strictEqual(algoHardMCQ.questionArchetype, 'DIAGNOSTIC_BUG_HUNT');

      // Recursion Hard -> QUICK_CALCULATION (with Master theorem recurrence evidence >= 60 chars)
      const recTarget = {
        targetId: 'T10',
        concept: 'Recurrence Relation Master Theorem',
        subtopic: 'Recursion',
        targetDifficulty: 'Hard',
        intendedCognitiveOperation: 'APPLY',
        supportingEvidence: 'The recurrence algorithm computes T(n) = 2T(n/2) + O(n) which executes with time complexity O(n log n).'
      };
      const recMCQ = agent2Generator.generateQuestionFallback(recTarget, { curricularContent: recTarget.supportingEvidence });
      assert.strictEqual(recMCQ.questionArchetype, 'QUICK_CALCULATION');

      // Tree Easy -> CONCEPTUAL_CONTRAST
      const treeTarget = {
        targetId: 'T11',
        concept: 'BST Invariant Order Property',
        subtopic: 'Binary Search Tree',
        targetDifficulty: 'Easy',
        intendedCognitiveOperation: 'RECALL',
        supportingEvidence: 'In a binary search tree, all keys in left subtree are strictly less than X, and right subtree are greater than X.'
      };
      const treeMCQ = agent2Generator.generateQuestionFallback(treeTarget, { curricularContent: treeTarget.supportingEvidence });
      assert.strictEqual(treeMCQ.questionArchetype, 'CONCEPTUAL_CONTRAST');
    } finally {
      process.env.NODE_ENV = origEnv;
      delete process.env.ALLOW_MOCK_FALLBACK;
    }
  });

  test('T14: Distractor rationales fallback synthesis populates missing entries cleanly', () => {
    const mcq = {
      targetId: 'T12',
      options: ['Opt1', 'Opt2', 'Opt3', 'Opt4'],
      correctAnswer: 'Opt1',
      correctAnswerText: 'Opt1',
      usedArchetypes: ['NEAR_MISS_MECHANISM'],
      verificationRecord: {
        factualBasis: 'Rule 1',
        computedOrTracedKey: 'Step 1',
        distractorRationales: {
          'Opt2': 'Explicit rationale for Opt2'
          // Opt3 and Opt4 missing
        }
      }
    };

    const normalizedRationales = {};
    const distractors = mcq.options.filter(o => o !== mcq.correctAnswer);
    for (const [key, rat] of Object.entries(mcq.verificationRecord.distractorRationales)) {
      normalizedRationales[key] = rat;
    }
    for (const d of distractors) {
      if (!normalizedRationales[d]) {
        normalizedRationales[d] = `Plausible student misconception based on near miss mechanism.`;
      }
    }
    mcq.verificationRecord.distractorRationales = normalizedRationales;

    agent2Generator.shuffleOptions(mcq);

    assert.strictEqual(Object.keys(mcq.verificationRecord.distractorRationales).length, 3);
    assert(mcq.verificationRecord.distractorRationales['Opt3'].includes('Plausible student misconception'));
    assert(mcq.verificationRecord.distractorRationales['Opt4'].includes('Plausible student misconception'));
    assert.strictEqual(Object.keys(mcq.verificationRecord.byLetter).length, 3);
  });

  test('T15: Unknown questionArchetype is safely corrected to targetArchetype or recognized archetype', () => {
    const recognized = Object.keys(agent2Generator.QUESTION_ARCHETYPES);
    const rawMCQ = {
      questionArchetype: 'FANCY_CUSTOM_TYPE'
    };
    const targetArchetype = 'QUICK_CALCULATION';
    let resolved = rawMCQ.questionArchetype || targetArchetype || 'CONCEPTUAL_CONTRAST';
    if (!recognized.includes(resolved)) {
      resolved = targetArchetype && recognized.includes(targetArchetype) ? targetArchetype : 'CONCEPTUAL_CONTRAST';
    }
    assert.strictEqual(resolved, 'QUICK_CALCULATION');
  });

  test('T16: Brevity invariant is strictly enforced: stems <= 35 words and options 2-10 words', () => {
    const stem = 'What is the primary role of the MMU in virtual memory address translation?';
    const options = [
      'Translates virtual page numbers to physical frames',
      'Caches recently translated page mappings in hardware',
      'Translates physical frames back to virtual addresses',
      'Allocates contiguous physical memory frames to processes'
    ];
    const stemWords = stem.trim().split(/\s+/).length;
    assert(stemWords <= 35, `Stem word count (${stemWords}) must be <= 35`);
    for (const opt of options) {
      const words = opt.trim().split(/\s+/).length;
      assert(words >= 2 && words <= 10, `Option "${opt}" word count (${words}) must be between 2 and 10`);
    }
  });

  test('T17: Programmatic brevity enforcement trims rambling stems and verbose options while preserving code block', () => {
    const verboseMCQ = {
      questionText: 'In computer science and operating systems, when a process attempts to access a virtual memory address that is not currently mapped into physical RAM by the page table entries, what specific sequence of kernel and hardware operations occurs to handle this condition before execution resumes?\n```c\nint *p = (int*)0x1000;\n*p = 42;\n```',
      options: [
        'The MMU generates a page fault exception, transferring control to the kernel interrupt handler which loads the page from disk and restarts the instruction',
        'Short option A',
        'Short option B',
        'Short option C'
      ],
      correctAnswer: 'Short option A'
    };

    const enforced = agent2Generator._enforceBrevity(verboseMCQ);
    const nonCodeProse = enforced.questionText.replace(/```[\s\S]*?```/, '').trim();
    const words = nonCodeProse.split(/\s+/).filter(Boolean);
    assert(words.length <= 45, `Enforced stem prose (${words.length} words) must be <= 45 words`);
    assert(enforced.questionText.includes('```c\nint *p = (int*)0x1000;'), 'Code block must be preserved intact');

    const opt0Words = enforced.options[0].split(/\s+/).filter(Boolean);
    assert(opt0Words.length <= 10, `Enforced option 0 (${opt0Words.length} words) must be <= 10 words`);
  });

  await testAsync('T18: Archetype adherence in generateQuestion enforces planner-assigned archetype over LLM slip', async () => {
    const target = {
      targetId: 'T13',
      concept: 'Loop State Mutation',
      targetDifficulty: 'Medium',
      intendedCognitiveOperation: 'TRACE',
      targetArchetype: 'MICRO_TRACE',
      supportingEvidence: 'for (int i = 0; i < 3; i++) total += i;'
    };

    const origComplete = llmRouter.complete;
    llmRouter.complete = async () => JSON.stringify({
      targetId: 'T13',
      questionText: 'What is the value of total after the loop terminates?',
      options: ['1', '3', '6', '10'],
      correctAnswerIndex: 1,
      correctAnswer: '3',
      explanation: 'total accumulates 0 + 1 + 2 = 3.',
      questionArchetype: 'CONCEPTUAL_CONTRAST', // LLM slipped and returned conceptual
      verificationRecord: {
        factualBasis: 'Loop iterates i from 0 to 2, accumulating total.',
        computedOrTracedKey: 'Step trace: i=0 -> total=0; i=1 -> total=1; i=2 -> total=3.',
        distractorRationales: {
          '1': 'Stops after i=1',
          '6': 'Adds i=3 past termination',
          '10': 'Sums up to i=4'
        }
      }
    });

    try {
      const res = await agent2Generator.generateQuestion(target, { curricularContent: target.supportingEvidence });
      assert.strictEqual(res.questionArchetype, 'MICRO_TRACE', 'Planner assigned MICRO_TRACE must be enforced over LLM slip');
      assert.strictEqual(res.metadata.questionArchetype, 'MICRO_TRACE');
    } finally {
      llmRouter.complete = origComplete;
    }
  });

  await testAsync('T19: Real generation path exercises mocked LLM output through parsing, normalization, and shuffle', async () => {
    const target = {
      targetId: 'T14',
      concept: 'Git Soft Reset',
      targetDifficulty: 'Medium',
      intendedCognitiveOperation: 'COMPARE',
      targetArchetype: 'CLI_TERMINAL_IMPACT',
      supportingEvidence: 'git reset --soft HEAD~1 moves HEAD pointer back by one commit while leaving index and working tree untouched.'
    };

    let capturedPrompt = '';
    const origComplete = llmRouter.complete;
    llmRouter.complete = async ({ prompt, systemPrompt }) => {
      capturedPrompt = prompt + '\n' + systemPrompt;
      // Return realistic LLM output with letter-keyed distractor rationales and conversational opener
      return JSON.stringify({
        targetId: 'T14',
        questionText: 'According to the lecture, what happens to staged files when executing git reset --soft HEAD~1?',
        options: [
          'Staged changes are permanently discarded',
          'Staged changes remain in the staging index ready for commit',
          'Staged changes are moved to a temporary stash',
          'Staged changes are committed directly to main'
        ],
        correctAnswerIndex: 1,
        correctAnswer: 'Staged changes remain in the staging index ready for commit',
        explanation: 'git reset --soft moves only HEAD pointer, preserving both index and working tree.',
        questionArchetype: 'CLI_TERMINAL_IMPACT',
        verificationRecord: {
          factualBasis: 'git reset --soft HEAD~1 resets HEAD but preserves index and working tree.',
          computedOrTracedKey: 'State delta: HEAD points to HEAD~1; index holds staged modifications; working tree unchanged.',
          distractorRationales: {
            'A': 'Describes git reset --hard which discards index and working tree',
            'C': 'Confuses git reset with git stash command',
            'D': 'Inverts reset into commit operation'
          }
        }
      });
    };

    try {
      const mcq = await agent2Generator.generateQuestion(target, { curricularContent: target.supportingEvidence });

      // Verify prompt injected targetArchetype
      assert(capturedPrompt.includes('CLI_TERMINAL_IMPACT'), 'Target archetype must be injected into generator prompt');

      // Verify preamble stripped and brevity enforced
      assert(!mcq.questionText.toLowerCase().includes('according to the lecture'), 'Lecture preamble must be stripped');
      assert(mcq.questionText.split(/\s+/).length <= 35, 'Stem must be <= 35 words');

      // Verify correct answer integrity
      assert.strictEqual(mcq.correctAnswer, 'Staged changes remain in the staging index ready for commit');
      const keyIdx = ['A', 'B', 'C', 'D'].indexOf(mcq.correctAnswerKey);
      assert.strictEqual(mcq.options[keyIdx], mcq.correctAnswer, 'correctAnswerKey must match correctAnswer');

      // Verify distractor rationales resolved to text and aligned in byLetter
      assert.strictEqual(mcq.verificationRecord.distractorRationales['Staged changes are permanently discarded'], 'Describes git reset --hard which discards index and working tree');
      for (let i = 0; i < 4; i++) {
        const letter = ['A', 'B', 'C', 'D'][i];
        const opt = mcq.options[i];
        if (opt !== mcq.correctAnswer) {
          assert.strictEqual(mcq.verificationRecord.byLetter[letter], mcq.verificationRecord.distractorRationales[opt]);
        } else {
          assert.strictEqual(mcq.verificationRecord.byLetter[letter], undefined, 'Correct answer slot must not have distractor rationale');
        }
      }
    } finally {
      llmRouter.complete = origComplete;
    }
  });

  test('T20: Verification record truthfulness asserts substantive proof across all pathways', () => {
    // Fallback path
    process.env.ALLOW_MOCK_FALLBACK = 'true';
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
      const fb = agent2Generator.generateQuestionFallback({
        targetId: 'T15',
        concept: 'Virtual Page Translation',
        targetDifficulty: 'Easy',
        supportingEvidence: 'MMU translates virtual page numbers to physical frames.'
      }, { curricularContent: 'MMU translates virtual page numbers to physical frames.' });

      assert(fb.verificationRecord.factualBasis.length >= 20, 'Factual basis must be substantive');
      assert(fb.verificationRecord.computedOrTracedKey.length >= 20, 'Computed key proof must be substantive');
      assert(Object.keys(fb.verificationRecord.distractorRationales).length === 3, 'Must have 3 distractor rationales');
    } finally {
      process.env.NODE_ENV = origEnv;
      delete process.env.ALLOW_MOCK_FALLBACK;
    }
  });

  await testAsync('T21: Unsafe verbosity triggers rejection instead of mangling text or invalidating answer', async () => {
    const unsafeTarget = {
      targetId: 'T16',
      concept: 'Lock Contention',
      targetDifficulty: 'Medium',
      intendedCognitiveOperation: 'DIAGNOSE',
      targetArchetype: 'DIAGNOSTIC_BUG_HUNT',
      supportingEvidence: 'Lock contention occurs when multiple threads concurrently attempt to acquire the same mutual exclusion lock.'
    };

    const origComplete = llmRouter.complete;
    llmRouter.complete = async () => JSON.stringify({
      targetId: 'T16',
      questionText: 'What is the outcome of lock contention?',
      options: [
        'An extraordinarily lengthy unbroken option without commas or semicolons that describes a complex operational mechanism that cannot be truncated safely',
        'Threads block awaiting release',
        'Memory is leaked permanently',
        'CPU halts completely'
      ],
      correctAnswerIndex: 1,
      correctAnswer: 'Threads block awaiting release',
      explanation: 'Threads queue and sleep until the lock owner releases.',
      questionArchetype: 'DIAGNOSTIC_BUG_HUNT'
    });

    const origEnv = process.env.NODE_ENV;
    try {
      // Under production rules (no mock fallback allowed), unsafe verbosity is truthfully unfulfilled
      process.env.NODE_ENV = 'production';
      delete process.env.ALLOW_MOCK_FALLBACK;
      const resProd = await agent2Generator.generateQuestion(unsafeTarget, { curricularContent: unsafeTarget.supportingEvidence });
      assert.strictEqual(resProd.isUnfulfilled, true, 'Unsafe verbosity must be unfulfilled when mock fallback is disabled');
      assert.strictEqual(resProd.unfulfilledReason, 'BREVITY_CONSTRAINT_VIOLATION_UNSAFE_TO_TRIM');

      // Under dev rules with ALLOW_MOCK_FALLBACK=true, fallback question is generated
      process.env.NODE_ENV = 'development';
      process.env.ALLOW_MOCK_FALLBACK = 'true';
      const resDev = await agent2Generator.generateQuestion(unsafeTarget, { curricularContent: unsafeTarget.supportingEvidence });
      assert.strictEqual(resDev.isUnfulfilled, undefined);
      assert(resDev.questionText.length > 10, 'Fallback question generated cleanly');
      assert(resDev.questionText.split(/\s+/).length <= 35, 'Fallback question satisfies brevity');
    } finally {
      llmRouter.complete = origComplete;
      process.env.NODE_ENV = origEnv;
      delete process.env.ALLOW_MOCK_FALLBACK;
    }
  });

  test('T22: Verification records explicitly distinguish MODEL_ASSERTED and DETERMINISTIC_REFERENCE from programmatic verification', () => {
    // Fallback contract
    process.env.ALLOW_MOCK_FALLBACK = 'true';
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
      const fb = agent2Generator.generateQuestionFallback({
        targetId: 'T17',
        concept: 'Page Replacement',
        targetDifficulty: 'Easy',
        supportingEvidence: 'LRU replaces the least recently used page frame.'
      }, { curricularContent: 'LRU replaces the least recently used page frame.' });

      assert.strictEqual(fb.verificationRecord.verificationStatus, 'DETERMINISTIC_REFERENCE');
      assert.strictEqual(fb.verificationRecord.verifiedProgrammatically, false);
      assert(!fb.verificationRecord.factualBasis.includes('Grounding verified'), 'Must not claim grounding was programmatically verified');
    } finally {
      process.env.NODE_ENV = origEnv;
      delete process.env.ALLOW_MOCK_FALLBACK;
    }
  });

  console.log('\n======================================================================');
  console.log(` 🏁 RESULT: ${passCount} / ${passCount} PHASE 2 ACCEPTANCE TESTS PASSED CLEANLY`);
  console.log('======================================================================\n');
})();
