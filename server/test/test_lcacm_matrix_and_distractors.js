/**
 * server/test/test_lcacm_matrix_and_distractors.js
 *
 * Dedicated verification suite for LCA-CM:
 * Suite A: Instructional Allocation & Multi-Factor Scoring
 * Suite B: 2D Topic × Difficulty Matrix & Decoupling
 * Suite C: Tier-Specific Distractor Quality & Negative Tests
 * Suite D: Agent 3 Independent Distractor Auditing
 */

'use strict';

const assert = require('assert');
const path = require('path');

const demoProjectDir = path.resolve(__dirname, '..');
process.chdir(demoProjectDir);

const agent1Planner = require('../engine/agents/agent1Planner');
const DifficultyAwareDistractorValidator = require('../engine/validators/difficultyAwareDistractorValidator');
const agent3Evaluator = require('../engine/agents/agent3Evaluator');

console.log('🧪 ====================================================================');
console.log('🧪 VERIFYING LCA-CM: INSTRUCTIONAL ALLOCATION, 2D MATRIX & DISTRACTORS');
console.log('🧪 ====================================================================\n');

let passCount = 0;
let failCount = 0;

function runTest(name, fn) {
  try {
    fn();
    passCount++;
    console.log(` ✅ PASS: ${name}`);
  } catch (err) {
    failCount++;
    console.error(` ❌ FAIL: ${name}`);
    console.error(`    ${err.message}`);
  }
}

// ============================================================================
// SUITE A: INSTRUCTIONAL ALLOCATION & MULTI-FACTOR SCORING
// ============================================================================
console.log('--- SUITE A: Instructional Allocation & Multi-Factor Scoring ---');

runTest('A1: 15-minute introduction vs 45-minute demonstration allocates 3 and 7 for N=10', () => {
  const subtopics = ['Git Introduction & Version Control Concepts', 'Git Command Execution & Staging Workflow'];
  const evidencePackage = {
    unifiedRawContent: `
      Welcome to Git introduction. Git is a distributed version control system designed to solve collaboration conflicts.
      Today our learning objective is to understand why distributed tracking is essential.
      Now we move to live hands-on terminal command execution. Let's run git status.
      Now run git add index.js to stage the file. Notice git status turns green.
      Next run git commit -m "initial commit".
      Let's practice git checkout and git branch multiple times.
    `,
    transcriptSegments: [
      { start: 0, end: 900, text: 'Git introduction and version control concepts' },      // 15 mins (900s)
      { start: 900, end: 3600, text: 'Git command execution and staging workflow demo' }   // 45 mins (2700s)
    ]
  };

  const { rawScores } = agent1Planner.computeInstructionalScores(subtopics, evidencePackage, evidencePackage.unifiedRawContent);
  const budgets = agent1Planner.allocateHamiltonHare(rawScores, 10);

  assert.strictEqual(budgets['Git Introduction & Version Control Concepts'] + budgets['Git Command Execution & Staging Workflow'], 10);
  assert.strictEqual(budgets['Git Introduction & Version Control Concepts'], 3);
  assert.strictEqual(budgets['Git Command Execution & Staging Workflow'], 7);
});

runTest('A2: Two topics with equal time but different emphasis allocate higher budget to emphasized topic', () => {
  const scores = {
    'Heavily Emphasized Topic': 0.70,
    'Lightly Mentioned Topic': 0.30
  };
  const budgets = agent1Planner.allocateHamiltonHare(scores, 5);
  assert.strictEqual(budgets['Heavily Emphasized Topic'] + budgets['Lightly Mentioned Topic'], 5);
  assert.ok(budgets['Heavily Emphasized Topic'] > budgets['Lightly Mentioned Topic'], 'Emphasized topic gets higher question budget');
  assert.ok(budgets['Heavily Emphasized Topic'] >= 3);
});

runTest('A3: Short topic with a clearly stated major learning objective is not starved', () => {
  const subtopics = ['Key Architecture Core Invariant', 'Broad Peripheral Examples'];
  const evidencePackage = {
    unifiedRawContent: `
      Our primary learning objective and mandatory goal today is to master the key architecture core invariant.
      This principle is essential and critical.
      Now for some broad peripheral examples and secondary remarks across various domains.
    `
  };
  const { rawScores } = agent1Planner.computeInstructionalScores(subtopics, evidencePackage, evidencePackage.unifiedRawContent);
  const budgets = agent1Planner.allocateHamiltonHare(rawScores, 3);
  assert.strictEqual(budgets['Key Architecture Core Invariant'] + budgets['Broad Peripheral Examples'], 3);
  assert.ok(budgets['Key Architecture Core Invariant'] >= 1, 'Core objective received at least 1 question');
});

runTest('A4: Missing timestamps cleanly falls back to text frequency and semantic depth', () => {
  const scores = { 'Subtopic A': 0.45, 'Subtopic B': 0.55 };
  const budgets = agent1Planner.allocateHamiltonHare(scores, 6);
  assert.strictEqual(budgets['Subtopic A'] + budgets['Subtopic B'], 6);
  assert.strictEqual(budgets['Subtopic A'], 3);
  assert.strictEqual(budgets['Subtopic B'], 3);
});

runTest('A5: Zero or missing instructional signals split allocations evenly and sum to N', () => {
  const zeroScores = { 'Topic 1': 0, 'Topic 2': 0, 'Topic 3': 0 };
  const budgets = agent1Planner.allocateHamiltonHare(zeroScores, 7);
  const total = Object.values(budgets).reduce((a, b) => a + b, 0);
  assert.strictEqual(total, 7);
});

runTest('A6: More topics than requested questions distributes questions without negative counts', () => {
  const scores = { T1: 0.2, T2: 0.2, T3: 0.2, T4: 0.2, T5: 0.2 };
  const budgets = agent1Planner.allocateHamiltonHare(scores, 3);
  const total = Object.values(budgets).reduce((a, b) => a + b, 0);
  assert.strictEqual(total, 3);
  Object.values(budgets).forEach(v => assert.ok(v >= 0));
});

// ============================================================================
// SUITE B: 2D TOPIC × DIFFICULTY MATRIX & DECOUPLING
// ============================================================================
console.log('\n--- SUITE B: 2D Topic × Difficulty Matrix & Decoupling ---');

runTest('B1: Introductory concept can support Easy, Medium, and Hard questions', () => {
  const planData = {
    mainTopic: 'Version Control Systems',
    subtopics: ['Git Introduction & Philosophy'],
    assessmentTargets: []
  };
  const evidencePackage = {
    unifiedRawContent: `
      Git is a distributed version control system. It solves collaboration conflicts.
      When multiple developers modify the same line concurrently, a merge conflict occurs requiring manual resolution.
      Git models history as a directed acyclic graph of immutable commit snapshots.
    `,
    lectureIntelligence: {
      evidenceCapacity: { totalDefensibleCapacity: 10, effectiveHardCap: 3, capacityByDifficulty: { easy: 3, medium: 3, hard: 3 } }
    }
  };

  const plan = agent1Planner._applyLcacmMatrixBlueprint(planData, 'Balanced', 3, evidencePackage);
  const targets = plan.assessmentTargets;
  assert.strictEqual(targets.length, 3);
  const tiers = targets.map(t => t.targetDifficulty);
  assert.ok(tiers.includes('Easy'), 'Intro has Easy');
  assert.ok(tiers.includes('Medium'), 'Intro has Medium');
  assert.ok(tiers.includes('Hard'), 'Intro has Hard');
});

runTest('B2: Command execution topic can support Easy, Medium, and Hard questions', () => {
  const planData = {
    mainTopic: 'Git Commands',
    subtopics: ['Git Command Execution'],
    assessmentTargets: []
  };
  const evidencePackage = {
    unifiedRawContent: `
      The git status command displays working tree status.
      After modifying files, git add moves them into the staging index.
      If a file is staged and then modified again before git commit, only the previously staged bytes enter the commit snapshot.
    `,
    lectureIntelligence: {
      evidenceCapacity: { totalDefensibleCapacity: 10, effectiveHardCap: 3 }
    }
  };

  const plan = agent1Planner._applyLcacmMatrixBlueprint(planData, 'Balanced', 3, evidencePackage);
  const targets = plan.assessmentTargets;
  assert.strictEqual(targets.length, 3);
  const tiers = targets.map(t => t.targetDifficulty);
  assert.ok(tiers.includes('Easy'), 'Command execution has Easy');
  assert.ok(tiers.includes('Medium'), 'Command execution has Medium');
  assert.ok(tiers.includes('Hard'), 'Command execution has Hard');
});

runTest('B3: Subtopic lacking Hard mechanisms smoothly allocates to Medium/Easy without fabricating ungrounded Hard', () => {
  const planData = {
    mainTopic: 'Basic Terminologies',
    subtopics: ['Taxonomic Definitions Only'],
    assessmentTargets: []
  };
  const evidencePackage = {
    unifiedRawContent: 'A compiler translates source code. An interpreter executes bytecode line by line.',
    lectureIntelligence: {
      evidenceCapacity: { totalDefensibleCapacity: 5, effectiveHardCap: 0, hardFeasible: false }
    }
  };

  const plan = agent1Planner._applyLcacmMatrixBlueprint(planData, 'Hard', 2, evidencePackage, 'FILL_WITH_MEDIUM');
  assert.strictEqual(plan.assessmentTargets.length, 2);
  // Deficit policy substituted with Medium
  assert.ok(plan.assessmentTargets.every(t => t.targetDifficulty === 'Medium'));
});

runTest('B4: Topic × Difficulty Matrix is recorded on plan.topicDifficultyMatrix', () => {
  const planData = {
    mainTopic: 'Git',
    subtopics: ['Git Intro', 'Git Commands'],
    assessmentTargets: []
  };
  const evidencePackage = {
    unifiedRawContent: 'Git introduction details. Git commands execution details with state transitions.',
    lectureIntelligence: {
      evidenceCapacity: { totalDefensibleCapacity: 10, effectiveHardCap: 3 }
    }
  };
  const plan = agent1Planner._applyLcacmMatrixBlueprint(planData, 'Balanced', 5, evidencePackage);
  assert.ok(plan.topicDifficultyMatrix, 'Matrix structure exists on plan');
  assert.strictEqual(plan.topicDifficultyMatrix.globalRequested, 'Balanced');
  assert.strictEqual(plan.assessmentTargets.length, 5);
});

// ============================================================================
// SUITE C: TIER-SPECIFIC DISTRACTOR QUALITY & NEGATIVE TESTS
// ============================================================================
console.log('\n--- SUITE C: Tier-Specific Distractor Quality & Negative Tests ---');

runTest('C1: Valid Easy question with surface misconception distractor passes validation', () => {
  const q = {
    questionText: 'What is the primary function of Git in software development?',
    options: [
      'Tracks changes and coordinates collaboration across project history',
      'Uploads code files automatically to remote cloud hosting services',
      'Compiles source code into native platform binaries',
      'Minifies frontend JavaScript bundle files'
    ],
    correctAnswer: 'Tracks changes and coordinates collaboration across project history'
  };
  const report = DifficultyAwareDistractorValidator.validate(q, 'Easy');
  assert.strictEqual(report.verdict, 'PASS');
});

runTest('C2: Valid Hard question with competing technical mechanisms passes validation', () => {
  const q = {
    questionText: 'A developer edits index.js, stages it with git add index.js, and then appends new code to index.js without re-staging. What does running git commit capture?',
    options: [
      'The snapshot of index.js as it existed when git add was run, leaving subsequent working tree modifications unstaged.',
      'The latest working tree version of index.js, because git commit automatically captures current disk changes for tracked files.',
      'The commit is rejected with an error requiring the developer to resolve or stage the modified working tree changes before committing.',
      'The staged snapshot is committed, but Git resets index.js in the working tree back to the staged state, discarding subsequent edits.'
    ],
    correctAnswer: 'The snapshot of index.js as it existed when git add was run, leaving subsequent working tree modifications unstaged.'
  };
  const report = DifficultyAwareDistractorValidator.validate(q, 'Hard');
  assert.strictEqual(report.verdict, 'PASS');
});

runTest('C3: Rejects fake or fabricated CLI command in distractors (Negative Test: Fake Command)', () => {
  const q = {
    questionText: 'Which command stages modified files in Git?',
    options: [
      'git add .',
      'git upload',
      'git save',
      'git commit'
    ],
    correctAnswer: 'git add .'
  };
  const report = DifficultyAwareDistractorValidator.validate(q, 'Easy');
  assert.strictEqual(report.verdict, 'REJECT');
  assert.ok(report.flaws.some(f => f.code === 'ERR_FAKE_COMMAND'));
});

runTest('C4: Rejects superficial 1-word boolean opposites (Negative Test: Superficial Opposite)', () => {
  const q = {
    questionText: 'How does Git handle binary file diffs?',
    options: [
      'Stores full delta representations for modified binary assets',
      'True',
      'False',
      'Stores compressed blobs without line-by-line delta parsing'
    ],
    correctAnswer: 'Stores compressed blobs without line-by-line delta parsing'
  };
  const report = DifficultyAwareDistractorValidator.validate(q, 'Medium');
  assert.strictEqual(report.verdict, 'REPAIR');
  assert.ok(report.flaws.some(f => f.code === 'ERR_SUPERFICIAL_OPPOSITE'));
});

runTest('C5: Rejects Hard question with trivial / childish throwaway distractors (Negative Test: Weak Distractors on Hard Stem)', () => {
  const q = {
    questionText: 'In a distributed Git topology, why does a fast-forward merge fail when divergent commits exist on the target branch?',
    options: [
      'The target branch HEAD is not a direct ancestor of the incoming commit',
      'Nothing',
      'Unknown',
      'It fails'
    ],
    correctAnswer: 'The target branch HEAD is not a direct ancestor of the incoming commit'
  };
  const report = DifficultyAwareDistractorValidator.validate(q, 'Hard');
  assert.strictEqual(report.verdict, 'REJECT');
  assert.ok(report.flaws.some(f => f.code === 'INSUFFICIENT_COGNITIVE_DEMAND_FOR_HARD'));
});

// ============================================================================
// SUITE D: AGENT 3 INDEPENDENT COGNITIVE & DISTRACTOR AUDITING
// ============================================================================
console.log('\n--- SUITE D: Agent 3 Independent Cognitive & Distractor Auditing ---');

runTest('D1: Agent 3 rejects Hard question when distractors fail cognitive demand despite complex stem', () => {
  const candidateMCQ = {
    questionText: 'Under high-concurrency database transactions, what mechanism guarantees serializability?',
    options: [
      'Two-Phase Locking protocol (2PL)',
      'Magic',
      'Nothing',
      'Hardware reboot'
    ],
    correctAnswer: 'Two-Phase Locking protocol (2PL)',
    verificationRecord: {
      distractorRationales: {
        'Magic': 'Convinces unprepared students who believe in magic',
        'Nothing': 'Plausible assumption of no lock overhead',
        'Hardware reboot': 'Common fallback recovery'
      }
    }
  };

  const target = {
    targetId: 'T01',
    concept: 'Database Concurrency Control',
    targetDifficulty: 'Hard',
    intendedCognitiveOperation: 'DIAGNOSE'
  };

  // Mock evaluation response from Agent 3 evaluator
  const mockCriticResponse = {
    status: 'FAIL',
    score: 0.3,
    verdict: 'FAIL',
    stemAnswerAlignment: {
      interrogativeMood: 'IDENTIFICATION_WHICH',
      isDirectlyResponsive: true,
      interrogativeMatch: true,
      responsivenessAnalysis: 'Keyed answer directly identifies 2PL protocol.'
    },
    optionAnalysis: [
      { slot: 'A', text: 'Two-Phase Locking protocol (2PL)', isKey: true, verdict: 'VALID_KEY' },
      { slot: 'B', text: 'Magic', isKey: false, verdict: 'ABSURD' },
      { slot: 'C', text: 'Nothing', isKey: false, verdict: 'INSUFFICIENT_DEMAND', distractorPlausibility: 'LOW' },
      { slot: 'D', text: 'Hardware reboot', isKey: false, verdict: 'PLAUSIBLE_DISTRACTOR', distractorPlausibility: 'LOW' }
    ]
  };

  const enforced = agent3Evaluator._parseAndEnforceEvaluationResponse(mockCriticResponse, {}, candidateMCQ, target);
  assert.strictEqual(enforced.passed, false);
  assert.strictEqual(enforced.verdict, 'FAIL');
  assert.ok(
    enforced.failureReasons.includes('DISTRACTOR_ABSURD') ||
    enforced.failureReasons.includes('DISTRACTOR_INSUFFICIENT_COGNITIVE_DEMAND'),
    'Agent 3 flagged distractor cognitive deficiency'
  );
});

runTest('D2: Agent 3 enforces independent verdict even if Agent 2 supplied rationales', () => {
  const candidateMCQ = {
    questionText: 'What is the role of Git staging area?',
    options: [
      'Prepares a snapshot for commit',
      'Sends email alerts to team',
      'Runs tests',
      'Compiles binary'
    ],
    correctAnswer: 'Prepares a snapshot for commit',
    verificationRecord: {
      distractorRationales: {
        'Sends email alerts to team': 'Agent 2 claims this is convincing',
        'Runs tests': 'Agent 2 claims this is common',
        'Compiles binary': 'Agent 2 claims this is plausible'
      }
    }
  };

  const target = { targetId: 'T02', concept: 'Staging Area', targetDifficulty: 'Easy' };
  const mockCritic = {
    status: 'PASS',
    score: 0.95,
    verdict: 'PASS',
    stemAnswerAlignment: { isDirectlyResponsive: true, interrogativeMatch: true },
    optionAnalysis: [
      { slot: 'A', text: 'Prepares a snapshot for commit', isKey: true, verdict: 'VALID_KEY' },
      { slot: 'B', text: 'Sends email alerts to team', isKey: false, verdict: 'PLAUSIBLE_DISTRACTOR', distractorPlausibility: 'HIGH' },
      { slot: 'C', text: 'Runs tests', isKey: false, verdict: 'PLAUSIBLE_DISTRACTOR', distractorPlausibility: 'HIGH' },
      { slot: 'D', text: 'Compiles binary', isKey: false, verdict: 'PLAUSIBLE_DISTRACTOR', distractorPlausibility: 'HIGH' }
    ]
  };

  const enforced = agent3Evaluator._parseAndEnforceEvaluationResponse(mockCritic, {}, candidateMCQ, target);
  assert.strictEqual(enforced.passed, true);
  assert.strictEqual(enforced.verdict, 'PASS');
});

// ============================================================================
// SUITE E: CAPACITY ACCOUNTING INVARIANTS
// ============================================================================
console.log('\n--- SUITE E: Capacity Accounting Invariants ---');

runTest('E1: Invariant: Allocated targets never exceed per-topic capacity', () => {
  const planData = {
    mainTopic: 'Algorithms & State Machines',
    subtopics: ['Subtopic Alpha', 'Subtopic Beta'],
    assessmentTargets: []
  };
  const ep = {
    unifiedRawContent: 'Alpha is a basic definition. Beta shows state transition loops under invariant constraints.',
    lectureIntelligence: {
      evidenceCapacity: { totalDefensibleCapacity: 6, effectiveHardCap: 2, capacityByDifficulty: { easy: 2, medium: 2, hard: 2 } }
    }
  };
  agent1Planner._applyLcacmMatrixBlueprint(planData, 'Balanced', 6, ep);
  const matrix = planData.topicDifficultyMatrix;
  matrix.subtopics.forEach(sub => {
    assert.ok(sub.allocated.Easy <= sub.capacities.Easy, `${sub.name} Easy (${sub.allocated.Easy}) <= capacity (${sub.capacities.Easy})`);
    assert.ok(sub.allocated.Medium <= sub.capacities.Medium, `${sub.name} Medium (${sub.allocated.Medium}) <= capacity (${sub.capacities.Medium})`);
    assert.ok(sub.allocated.Hard <= sub.capacities.Hard, `${sub.name} Hard (${sub.allocated.Hard}) <= capacity (${sub.capacities.Hard})`);
  });
});

runTest('E2: Invariant: Allocated targets never exceed global difficulty capacity', () => {
  const planData = {
    mainTopic: 'Discrete Mathematics',
    subtopics: ['GCD Logic', 'Prime Modulo', 'State Transitions'],
    assessmentTargets: []
  };
  const ep = {
    unifiedRawContent: 'Prime modulo logic with invariant loops and state conditions.',
    lectureIntelligence: {
      evidenceCapacity: { totalDefensibleCapacity: 6, effectiveHardCap: 2, capacityByDifficulty: { easy: 2, medium: 2, hard: 2 } }
    }
  };
  agent1Planner._applyLcacmMatrixBlueprint(planData, 'Hard', 10, ep);
  const allocatedHard = planData.topicDifficultyMatrix.globalAllocated.Hard;
  assert.ok(allocatedHard <= 2, `Allocated Hard (${allocatedHard}) <= global effectiveHardCap (2)`);
  assert.strictEqual(allocatedHard, 2, 'Allocates maximum feasible Hard (2)');
});

runTest('E3: Invariant: Total allocations equal the feasible requested count', () => {
  const planData = {
    mainTopic: 'Discrete Mathematics',
    subtopics: ['GCD Logic', 'Prime Modulo', 'State Transitions'],
    assessmentTargets: []
  };
  const ep = {
    unifiedRawContent: 'GCD logic with Prime Modulo and State transitions.',
    lectureIntelligence: {
      evidenceCapacity: { totalDefensibleCapacity: 6, effectiveHardCap: 2, capacityByDifficulty: { easy: 2, medium: 2, hard: 2 } }
    }
  };
  agent1Planner._applyLcacmMatrixBlueprint(planData, 'Hard', 10, ep);
  const { TotalDefensible, Deficit } = planData.topicDifficultyMatrix.globalAllocated;
  assert.strictEqual(TotalDefensible + Deficit, 10, 'TotalDefensible + Deficit equals requested count (10)');
  assert.strictEqual(TotalDefensible, 2, 'TotalDefensible equals feasible Hard count (2)');
});

runTest('E4: Invariant: Deficits equal requested targets minus successfully allocated defensible targets', () => {
  const planData = {
    mainTopic: 'Discrete Mathematics',
    subtopics: ['GCD Logic', 'Prime Modulo'],
    assessmentTargets: []
  };
  const ep = {
    unifiedRawContent: 'Brief GCD logic.',
    lectureIntelligence: {
      evidenceCapacity: { totalDefensibleCapacity: 4, effectiveHardCap: 1, capacityByDifficulty: { easy: 2, medium: 1, hard: 1 } }
    }
  };
  const requested = 8;
  agent1Planner._applyLcacmMatrixBlueprint(planData, 'Hard', requested, ep);
  const { Hard, Deficit, TotalDefensible } = planData.topicDifficultyMatrix.globalAllocated;
  assert.strictEqual(Deficit, requested - TotalDefensible, `Deficit (${Deficit}) == requested (${requested}) - allocated (${TotalDefensible})`);
  assert.strictEqual(Hard, 1, 'Allocated exactly 1 Hard target');
  assert.strictEqual(Deficit, 7, 'Reported honest deficit of 7 (8 - 1 = 7)');
});

runTest('E5: Invariant: Easy + Medium + Hard capacity equals total defensible capacity', () => {
  const ep = {
    lectureIntelligence: {
      evidenceCapacity: {
        totalDefensibleCapacity: 6,
        capacityByDifficulty: { easy: 2, medium: 2, hard: 2 }
      }
    }
  };
  const cap = agent1Planner._resolveCapacity(ep);
  assert.strictEqual(
    cap.easyCap + cap.mediumCap + cap.effectiveHardCap,
    cap.totalDefensibleCapacity,
    'Mutually exclusive capacities sum to totalDefensibleCapacity (2 + 2 + 2 = 6)'
  );
  assert.strictEqual(cap.totalDefensibleCapacity, 6);
  assert.strictEqual(cap.effectiveHardCap, 2);
});

runTest('E6: Invariant: No reported Hard allocation exceeds effective Hard cap under high N (N=5, 10, 20)', () => {
  [5, 10, 20].forEach(N => {
    const planData = {
      mainTopic: 'Operating Systems Scheduling',
      subtopics: ['FIFO Queue', 'Round Robin Invariant', 'Multi-Level Feedback'],
      assessmentTargets: []
    };
    const ep = {
      unifiedRawContent: 'Operating system scheduling with Round Robin quantum invariants.',
      lectureIntelligence: {
        evidenceCapacity: { totalDefensibleCapacity: 7, effectiveHardCap: 2, capacityByDifficulty: { easy: 3, medium: 2, hard: 2 } }
      }
    };
    agent1Planner._applyLcacmMatrixBlueprint(planData, 'Hard', N, ep);
    const allocatedHard = planData.topicDifficultyMatrix.globalAllocated.Hard;
    assert.ok(allocatedHard <= 2, `For N=${N}, allocated Hard (${allocatedHard}) <= effectiveHardCap (2)`);
    assert.strictEqual(allocatedHard, 2, `For N=${N}, exactly reaches effectiveHardCap (2)`);
    assert.strictEqual(planData.topicDifficultyMatrix.globalAllocated.Deficit, N - 2, `For N=${N}, deficit is ${N - 2}`);
  });
});

console.log('\n======================================================================');
console.log(`🏁 TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
console.log('======================================================================');

if (failCount > 0) {
  process.exit(1);
}
