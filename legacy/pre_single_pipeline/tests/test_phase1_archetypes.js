/**
 * server/test/test_phase1_archetypes.js
 *
 * Dedicated Verification Suite for Phase 1: Evidence-Aware Archetype Planning
 * Comprehensive coverage including corrective pass for all 5 review findings + remaining 4 issues:
 * 1. Boundary bypass prevention: NO_CONCEPTUAL and complete exclusion handled via capacity deficit.
 * 2. Topic mode mutation grounding: static definitions without conditional rules/invariants rejected for WHAT_IF_MUTATION.
 * 3. Generic keyword rejection at target level: "latency", "array", "command" alone do NOT satisfy operational archetypes.
 * 4. Adversarial formula verification: dangling operators, malformed equations, price ranges, phone numbers rejected.
 * 5. Full-path preservation across planner pipelines.
 */

'use strict';

const assert = require('assert');
const planner = require('../engine/agents/agent1Planner');
const { QUESTION_ARCHETYPES } = planner;

console.log('======================================================================');
console.log('🧪 RUNNING PHASE 1: EVIDENCE-AWARE ARCHETYPE ELIGIBILITY & FALLBACK SUITE');
console.log('======================================================================\n');

let passedTests = 0;
let totalTests = 0;

function it(desc, fn) {
  totalTests++;
  try {
    fn();
    console.log(` ✅ PASS [${totalTests}]: ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(` ❌ FAIL [${totalTests}]: ${desc}`);
    console.error(`    ${err.message}`);
  }
}

// -----------------------------------------------------------------------------
// Baseline & User Design Decisions (Tests 1-11)
// -----------------------------------------------------------------------------

it('T1: CONCEPTUAL_CONTRAST is eligible by default for academic text with distinct concepts', () => {
  const eligible = planner._determineEligibleArchetypes({}, 'General introduction to university curriculum comparing early systems.');
  assert.ok(eligible.includes(QUESTION_ARCHETYPES.CONCEPTUAL_CONTRAST));
});

it('T2: Topic mode on non-technical syllabus does NOT grant CLI, Micro-Trace, or Math', () => {
  const eligible = planner._determineEligibleArchetypes({
    inputModality: 'TOPIC_SYNTHESIS',
    topic: '1. Constitutional Law, 2. Separation of Powers, 3. Judicial Review'
  }, 'Constitutional Law and Separation of Powers');

  assert.ok(eligible.includes(QUESTION_ARCHETYPES.CONCEPTUAL_CONTRAST), 'Must have CONCEPTUAL_CONTRAST');
  assert.ok(eligible.includes(QUESTION_ARCHETYPES.WHAT_IF_MUTATION), 'Must have WHAT_IF_MUTATION for topic scenarios');
  assert.strictEqual(eligible.includes(QUESTION_ARCHETYPES.CLI_TERMINAL_IMPACT), false, 'Must NOT have CLI_TERMINAL_IMPACT');
  assert.strictEqual(eligible.includes(QUESTION_ARCHETYPES.MICRO_TRACE), false, 'Must NOT have MICRO_TRACE');
  assert.strictEqual(eligible.includes(QUESTION_ARCHETYPES.QUICK_CALCULATION), false, 'Must NOT have QUICK_CALCULATION');
});

it('T3: Numbers alone (1995, v1.2, 5 questions, port 8080) do NOT trigger QUICK_CALCULATION', () => {
  const evidenceText = `
    In 1995, Java version 1.2 was released with 5 questions per slide.
    The web server listens on port 8080 and port 5000 for 45 minutes with 50 students.
  `;
  const eligible = planner._determineEligibleArchetypes({}, evidenceText);
  assert.strictEqual(eligible.includes(QUESTION_ARCHETYPES.QUICK_CALCULATION), false, 'Numbers alone must NOT trigger QUICK_CALCULATION');
});

it('T4: Real math formula (offset = address mod 4096, 2^12, Km = 2.5) DOES trigger QUICK_CALCULATION', () => {
  const mathEvidence = `
    Address translation: offset = virtual_address mod 4096.
    Page size is 4KB (2^12 bytes), leaving 20 bits for the VPN.
    Michaelis constant Km = 2.5 mM and Vmax = 100 umol/min.
  `;
  const eligible = planner._determineEligibleArchetypes({}, mathEvidence);
  assert.ok(eligible.includes(QUESTION_ARCHETYPES.QUICK_CALCULATION), 'Genuine formulas MUST trigger QUICK_CALCULATION');
});

it('T5: WHAT_IF_MUTATION is eligible for conditional rules, policies, and invariants without code', () => {
  const policyEvidence = `
    Under Banker's algorithm, an unsafe state is not a deadlock unless all processes simultaneously request resources.
    If the hold-and-wait condition is broken, deadlock cannot occur.
  `;
  const eligible = planner._determineEligibleArchetypes({}, policyEvidence);
  assert.ok(eligible.includes(QUESTION_ARCHETYPES.WHAT_IF_MUTATION), 'Invariant/rule evidence MUST trigger WHAT_IF_MUTATION');
});

it('T6: Audio mentioning "arrays" and "functions" does NOT trigger MICRO_TRACE without state transitions', () => {
  const genericAudioText = `
    Today we will talk about programming. We use arrays in computer science, and functions are useful.
    Variables store data in computer systems.
  `;
  const eligible = planner._determineEligibleArchetypes({}, genericAudioText);
  assert.strictEqual(eligible.includes(QUESTION_ARCHETYPES.MICRO_TRACE), false, 'Vague programming nouns must NOT trigger MICRO_TRACE');
});

it('T7: Concrete code with queue.push state mutations DOES trigger MICRO_TRACE', () => {
  const codeEvidence = `
    void bfs(int start) {
      queue<int> q;
      visited[start] = true;
      q.push(start);
      while(!q.empty()) { int curr = q.front(); q.pop(); }
    }
  `;
  const eligible = planner._determineEligibleArchetypes({ codeSnippets: [codeEvidence] }, codeEvidence);
  assert.ok(eligible.includes(QUESTION_ARCHETYPES.MICRO_TRACE), 'Code with push/pop MUST trigger MICRO_TRACE');
});

it('T8: Terminal CLI logs trigger CLI_TERMINAL_IMPACT', () => {
  const terminalEvidence = `
    $ docker run -d --name web -p 8080:80 nginx:latest
    $ psql -U postgres -d testdb
    BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;
    $ kill -15 1420
  `;
  const eligible = planner._determineEligibleArchetypes({}, terminalEvidence);
  assert.ok(eligible.includes(QUESTION_ARCHETYPES.CLI_TERMINAL_IMPACT), 'Terminal CLI commands MUST trigger CLI_TERMINAL_IMPACT');
});

it('T9: Negative boundary NO_MATH and NO_CODE blocks respective archetypes', () => {
  const combined = `
    $ docker run -p 8080:80
    offset = address mod 4096; 2^12;
    q.push(x);
  `;
  const eligible = planner._determineEligibleArchetypes({
    negativeBoundaries: ['NO_MATH', 'NO_CODE']
  }, combined);

  assert.strictEqual(eligible.includes(QUESTION_ARCHETYPES.QUICK_CALCULATION), false, 'NO_MATH must block calculation');
  assert.strictEqual(eligible.includes(QUESTION_ARCHETYPES.MICRO_TRACE), false, 'NO_CODE must block micro-trace');
  assert.ok(eligible.includes(QUESTION_ARCHETYPES.CLI_TERMINAL_IMPACT), 'CLI still permitted');
});

it('T10: Fallback planner assigns strictly eligible archetypes with zero undefined', () => {
  const plan = planner._buildFallbackPlan('Constitutional Law and Due Process', 'Medium', 4, {}, {}, ['Due Process', 'Equal Protection'], {
    inputModality: 'TOPIC_SYNTHESIS',
    topic: 'Constitutional Law'
  });

  assert.strictEqual(plan.assessmentTargets.length, 4);
  const eligible = planner._determineEligibleArchetypes({ inputModality: 'TOPIC_SYNTHESIS', topic: 'Constitutional Law' });
  plan.assessmentTargets.forEach(t => {
    assert.ok(t.targetArchetype, `Target ${t.targetId} must have targetArchetype`);
    assert.ok(eligible.includes(t.targetArchetype) || t.targetArchetype === 'UNFULFILLED_CAPACITY_DEFICIT',
      `Target ${t.targetId} archetype ${t.targetArchetype} must be in eligible list ${JSON.stringify(eligible)}`);
  });
});

it('T11: Capacity deficit slots carry targetArchetype UNFULFILLED_CAPACITY_DEFICIT', () => {
  const plan = planner._buildFallbackPlan('Short Lecture', 'Hard', 5, {}, {}, ['Short Lecture'], {
    lectureIntelligence: { evidenceCapacity: { totalDefensibleCapacity: 2, effectiveHardCap: 0 } },
    curricularContent: 'Brief non-technical intro.'
  });

  assert.strictEqual(plan.assessmentTargets.length, 5);
  const deficitTargets = plan.assessmentTargets.filter(t => t.intendedCognitiveOperation === 'UNFULFILLED_CAPACITY_DEFICIT');
  assert.ok(deficitTargets.length > 0, 'Must have capacity deficits for 0 hard cap');
  deficitTargets.forEach(t => {
    assert.strictEqual(t.targetArchetype, 'UNFULFILLED_CAPACITY_DEFICIT', 'Deficit target must have UNFULFILLED_CAPACITY_DEFICIT archetype');
  });
});

it('T12: NO_CODE cannot be bypassed in _resolveDefaultArchetype even with dirty inputs', () => {
  const resolved = planner._resolveDefaultArchetype('Flow / Trace', 'TRACE', [QUESTION_ARCHETYPES.MICRO_TRACE], ['NO_CODE']);
  assert.strictEqual(resolved, QUESTION_ARCHETYPES.CONCEPTUAL_CONTRAST, 'Must fallback cleanly away from MICRO_TRACE when NO_CODE is set');

  const resolvedBug = planner._resolveDefaultArchetype('Scenario', 'DIAGNOSE', [QUESTION_ARCHETYPES.DIAGNOSTIC_BUG_HUNT], ['NO_CODE']);
  assert.strictEqual(resolvedBug, QUESTION_ARCHETYPES.CONCEPTUAL_CONTRAST, 'Must fallback away from DIAGNOSTIC_BUG_HUNT when NO_CODE is set');

  const resolvedMath = planner._resolveDefaultArchetype('Calculation', 'CALC', [QUESTION_ARCHETYPES.QUICK_CALCULATION], ['NO_MATH']);
  assert.strictEqual(resolvedMath, QUESTION_ARCHETYPES.CONCEPTUAL_CONTRAST, 'Must fallback away from QUICK_CALCULATION when NO_MATH is set');
});

it('T13: UNFULFILLED_CAPACITY_DEFICIT slots are never assigned a question archetype', () => {
  const deficitTarget = {
    targetId: 'T03',
    concept: 'Deficit Slot',
    isCapacityLimited: true,
    capacityLimitation: { status: 'INSUFFICIENT_EVIDENCE_FOR_HARD', reason: 'Depth exhausted' }
  };
  const resolved = planner._resolveTargetArchetype(deficitTarget, [QUESTION_ARCHETYPES.MICRO_TRACE, QUESTION_ARCHETYPES.CONCEPTUAL_CONTRAST], [], {});
  assert.strictEqual(resolved, 'UNFULFILLED_CAPACITY_DEFICIT', 'Deficit slot must remain UNFULFILLED_CAPACITY_DEFICIT');
  assert.strictEqual(deficitTarget.intendedCognitiveOperation, 'UNFULFILLED_CAPACITY_DEFICIT');
  assert.strictEqual(deficitTarget.isCapacityLimited, true);
});

it('T14: Clean reference code without bugs or defects does NOT enable DIAGNOSTIC_BUG_HUNT', () => {
  const cleanCode = `
    int binarySearch(int arr[], int n, int target) {
      int left = 0, right = n - 1;
      while (left <= right) {
        int mid = left + (right - left) / 2;
        if (arr[mid] == target) return mid;
        if (arr[mid] < target) left = mid + 1;
        else right = mid - 1;
      }
      return -1;
    }
  `;
  const eligible = planner._determineEligibleArchetypes({ codeSnippets: [cleanCode] }, 'Lecture on standard binary search.');
  assert.ok(eligible.includes(QUESTION_ARCHETYPES.MICRO_TRACE), 'Clean code allows MICRO_TRACE');
  assert.strictEqual(eligible.includes(QUESTION_ARCHETYPES.DIAGNOSTIC_BUG_HUNT), false, 'Clean reference code must NOT enable DIAGNOSTIC_BUG_HUNT');
});

it('T15: Code with defect comments or runtime errors DOES enable DIAGNOSTIC_BUG_HUNT', () => {
  const buggyCode = `
    // BUG: off-by-one error causes buffer overflow in array indexing
    void flawed_copy(char *dest, char *src, int n) {
      for (int i = 0; i <= n; i++) { // defect here
        dest[i] = src[i];
      }
    }
  `;
  const eligible = planner._determineEligibleArchetypes({ codeSnippets: [buggyCode] }, buggyCode);
  assert.ok(eligible.includes(QUESTION_ARCHETYPES.DIAGNOSTIC_BUG_HUNT), 'Flawed code with defect comments MUST enable DIAGNOSTIC_BUG_HUNT');

  const crashEvidence = 'Server crashed with: segmentation fault core dumped at address 0x0000.';
  const eligibleCrash = planner._determineEligibleArchetypes({}, crashEvidence);
  assert.ok(eligibleCrash.includes(QUESTION_ARCHETYPES.DIAGNOSTIC_BUG_HUNT), 'Terminal crash logs MUST enable DIAGNOSTIC_BUG_HUNT');
});

it('T16: Target-level grounding prevents conceptual targets from receiving MICRO_TRACE in code session', () => {
  const sessionEligible = [QUESTION_ARCHETYPES.CONCEPTUAL_CONTRAST, QUESTION_ARCHETYPES.MICRO_TRACE, QUESTION_ARCHETYPES.WHAT_IF_MUTATION];

  const conceptualTarget = {
    targetId: 'T01',
    concept: 'Definition of an Abstract Data Type',
    subtopic: 'Theory',
    dimension: 'Conceptual',
    instruction: 'Assess student definition of ADT interfaces versus concrete implementations.',
    supportingEvidence: 'An abstract data type defines the logical interface independently of implementation.'
  };
  const resolved = planner._resolveTargetArchetype(conceptualTarget, sessionEligible, [], {});
  assert.strictEqual(resolved, QUESTION_ARCHETYPES.CONCEPTUAL_CONTRAST, 'Purely conceptual target must not get MICRO_TRACE');

  const tracingTarget = {
    targetId: 'T02',
    concept: 'Queue Dequeue State Mutation',
    subtopic: 'Queues',
    dimension: 'Flow / Trace',
    instruction: 'Trace the state of queue after q.pop() executes.',
    supportingEvidence: 'queue.push(10); queue.pop(); the front element changes from 10 to 20.'
  };
  const resolvedTrace = planner._resolveTargetArchetype(tracingTarget, sessionEligible, [], {});
  assert.strictEqual(resolvedTrace, QUESTION_ARCHETYPES.MICRO_TRACE, 'Target with queue state mutation must get MICRO_TRACE');
});

it('T17: False positive math rejection for text assignments, dates, ports, and noisy formulas', () => {
  const nonMathText = `
    const user = "Alice";
    color = "blue";
    server_port = 8080;
    year = 2024;
    status = active;
  `;
  assert.strictEqual(planner._isGenuineMathExpression('user = "Alice"'), false);
  assert.strictEqual(planner._isGenuineMathExpression('color = blue'), false);
  assert.strictEqual(planner._isGenuineMathExpression('server_port = 8080'), false);
  assert.strictEqual(planner._isGenuineMathExpression('const x = require("express")'), false);
  assert.strictEqual(planner._isGenuineMathExpression('status = active'), false);

  const noisyArtifacts = {
    formulasDetected: ['author = John Doe', 'title = Computer Networks', 'version = 2.0.1', 'port = 5000']
  };
  const eligible = planner._determineEligibleArchetypes({ artifacts: noisyArtifacts }, nonMathText);
  assert.strictEqual(eligible.includes(QUESTION_ARCHETYPES.QUICK_CALCULATION), false, 'Noisy assignments must NOT trigger QUICK_CALCULATION');

  assert.ok(planner._isGenuineMathExpression('offset = address mod 4096'));
  assert.ok(planner._isGenuineMathExpression('EAT = 0.9 * 10 + 0.1 * 100'));
  assert.ok(planner._isGenuineMathExpression('O(n log n)'));
  assert.ok(planner._isGenuineMathExpression('Km = 2.5'));
});

it('T18: Broad CLI coverage across shell history, system tools, and command pipelines', () => {
  const shellHistory = '$ git checkout -b feat/memory-tuning && git commit -m "optimize"';
  assert.ok(planner._detectCliEvidence(shellHistory), 'Git commands must be detected');

  const adminCli = 'Run command: tar -czvf archive.tar.gz /var/log && systemctl restart app';
  assert.ok(planner._detectCliEvidence(adminCli), 'Tar and systemctl must be detected');

  const pipeCli = 'cat /var/log/nginx.log | grep 500 | wc -l';
  assert.ok(planner._detectCliEvidence(pipeCli), 'Piped shell commands must be detected');

  const sqlCli = 'BEGIN TRANSACTION; SELECT * FROM accounts WHERE id = 1 FOR UPDATE;';
  assert.ok(planner._detectCliEvidence(sqlCli), 'SQL transaction terminal commands must be detected');
});

it('T19: Natural spoken trace detection in lecture transcripts', () => {
  const spoken1 = 'First we push 5 onto the stack, and then we pop the top element.';
  assert.ok(planner._detectSpokenTraceEvidence(spoken1), 'Spoken push/pop must be detected');

  const spoken2 = 'Pointer p now points to the head node, and pointer curr moves to next.';
  assert.ok(planner._detectSpokenTraceEvidence(spoken2), 'Spoken pointer transitions must be detected');

  const spoken3 = 'After the second iteration, the array becomes sorted up to index 3.';
  assert.ok(planner._detectSpokenTraceEvidence(spoken3), 'Spoken loop iterations must be detected');

  const nonTraceSpoken = 'Today we will discuss the philosophical implications of algorithmic thinking.';
  assert.strictEqual(planner._detectSpokenTraceEvidence(nonTraceSpoken), false, 'Non-trace speech must return false');
});

it('T20: filterGrounded preserves LLM-planned targetArchetype', () => {
  const rawTarget = {
    targetId: 'T01',
    concept: 'Deadlock Detection Invariants',
    dimension: 'Scenario Analysis',
    targetDifficulty: 'Medium',
    targetArchetype: 'WHAT_IF_MUTATION',
    supportingEvidence: 'If resource allocation graph contains a cycle in single-unit system, deadlock exists.'
  };

  const eligible = [QUESTION_ARCHETYPES.CONCEPTUAL_CONTRAST, QUESTION_ARCHETYPES.WHAT_IF_MUTATION];
  const groundedArchetype = planner._resolveTargetArchetype(rawTarget, eligible, [], {});
  assert.strictEqual(groundedArchetype, 'WHAT_IF_MUTATION', 'LLM-planned WHAT_IF_MUTATION must be preserved when grounded');
});

it('T21: Legacy bloom quota mode routes through archetype safety normalization', () => {
  const oldMode = process.env.DIFFICULTY_CALIBRATION_MODE;
  process.env.DIFFICULTY_CALIBRATION_MODE = 'v1_bloom_quota';
  try {
    const rawPlan = {
      assessmentTargets: [
        { targetId: 'T01', concept: 'Paging Basics', dimension: 'Conceptual', supportingEvidence: 'Paging divides memory.' }
      ],
      reserveTargets: [
        { targetId: 'R01', concept: 'Segmentation', dimension: 'Conceptual', supportingEvidence: 'Segments have variable lengths.' }
      ]
    };

    const calibrated = planner._applyLegacyBloomQuotaBlueprint(rawPlan, 'Medium', 1, {
      unifiedRawContent: 'Paging divides memory into fixed size frames to prevent external fragmentation, in contrast with variable partitioning.'
    });

    assert.ok(calibrated.assessmentTargets[0].targetArchetype, 'Assessment target must have targetArchetype in legacy mode');
    assert.strictEqual(calibrated.assessmentTargets[0].targetArchetype, QUESTION_ARCHETYPES.CONCEPTUAL_CONTRAST);
    assert.ok(calibrated.reserveTargets[0].targetArchetype, 'Reserve target must have targetArchetype in legacy mode');
  } finally {
    process.env.DIFFICULTY_CALIBRATION_MODE = oldMode;
  }
});

// -----------------------------------------------------------------------------
// Final Targeted Pass for Remaining 4 Issues (Tests 22-26)
// -----------------------------------------------------------------------------

// Test 22: Issue 1 - Complete negative boundary exclusion results in UNFULFILLED_CAPACITY_DEFICIT
it('T22: Complete negative boundary exclusion marks target UNFULFILLED_CAPACITY_DEFICIT without bypass', () => {
  // All archetypes blocked by negative boundaries
  const allExcluded = ['NO_CODE', 'NO_MATH', 'NO_CLI', 'NO_CONCEPTUAL', 'NO_MUTATION'];
  const target = {
    targetId: 'T01',
    concept: 'Total Boundary Block',
    dimension: 'Conceptual'
  };

  const resolved = planner._resolveTargetArchetype(target, Object.values(QUESTION_ARCHETYPES), allExcluded, {});
  assert.strictEqual(resolved, 'UNFULFILLED_CAPACITY_DEFICIT', 'Must return deficit when all archetypes are excluded');
  assert.strictEqual(target.intendedCognitiveOperation, 'UNFULFILLED_CAPACITY_DEFICIT');
  assert.strictEqual(target.isCapacityLimited, true);
  assert.strictEqual(target.capacityLimitation?.status, 'NEGATIVE_BOUNDARY_EXCLUSION');
});

// Test 23: Issue 2 - Topic mode rejects WHAT_IF_MUTATION for static definitions lacking mutation logic
it('T23: Topic mode rejects WHAT_IF_MUTATION for static definitions lacking mutation logic', () => {
  const sessionEligible = [QUESTION_ARCHETYPES.CONCEPTUAL_CONTRAST, QUESTION_ARCHETYPES.WHAT_IF_MUTATION];

  // Static definition in topic mode
  const staticTarget = {
    targetId: 'T01',
    concept: 'Constitutional Law - Preamble Principles',
    subtopic: 'Foundations',
    dimension: 'Conceptual',
    instruction: 'Assess student recall of the three primary principles named in the preamble.',
    supportingEvidence: 'Constitutional Law: Preamble establishes justice, liberty, and equality.'
  };

  const resolved = planner._resolveTargetArchetype(staticTarget, sessionEligible, [], {});
  assert.strictEqual(resolved, QUESTION_ARCHETYPES.CONCEPTUAL_CONTRAST, 'Static definition in topic mode must NOT get WHAT_IF_MUTATION');

  // Dynamic scenario with conditional rule in topic mode
  const scenarioTarget = {
    targetId: 'T02',
    concept: 'Separation of Powers - Veto Invariant',
    subtopic: 'Executive Power',
    dimension: 'Scenario Analysis',
    instruction: 'What if the executive vetoes legislation? Evaluate conditions under which legislature overrides.',
    supportingEvidence: 'If the president vetoes a bill, Congress requires a two-thirds majority to override.'
  };

  const resolvedScenario = planner._resolveTargetArchetype(scenarioTarget, sessionEligible, [], {});
  assert.strictEqual(resolvedScenario, QUESTION_ARCHETYPES.WHAT_IF_MUTATION, 'Conditional rule target in topic mode MUST get WHAT_IF_MUTATION');
});

// Test 24: Issue 3 - Target-level checks reject generic words (latency, array, command) without concrete evidence
it('T24: Generic words (latency, array, command) without concrete operations rejected for operational archetypes', () => {
  const sessionEligible = Object.values(QUESTION_ARCHETYPES);

  // 1. Target with word "latency" and "overhead" but NO formula
  const abstractMathTarget = {
    targetId: 'T01',
    concept: 'Network Latency and Overhead Theory',
    subtopic: 'Networking',
    dimension: 'Conceptual',
    instruction: 'Discuss how latency and protocol overhead affect web performance.',
    supportingEvidence: 'Latency causes propagation delay and protocol headers introduce communication overhead.'
  };
  const resolvedMath = planner._resolveTargetArchetype(abstractMathTarget, sessionEligible, [], {});
  assert.notStrictEqual(resolvedMath, QUESTION_ARCHETYPES.QUICK_CALCULATION, 'Abstract latency text must NOT get QUICK_CALCULATION');

  // 2. Target with word "array" and "function" but NO state mutation or code
  const abstractCodeTarget = {
    targetId: 'T02',
    concept: 'Array Data Structure and Function Signatures',
    subtopic: 'Data Structures',
    dimension: 'Conceptual',
    instruction: 'Explain why an array stores homogeneous elements and how function signatures declare parameters.',
    supportingEvidence: 'An array allocates contiguous memory and functions declare parameters.'
  };
  const resolvedCode = planner._resolveTargetArchetype(abstractCodeTarget, sessionEligible, [], {});
  assert.notStrictEqual(resolvedCode, QUESTION_ARCHETYPES.MICRO_TRACE, 'Abstract array/function text must NOT get MICRO_TRACE');

  // 3. Target with word "command" and "terminal" but NO CLI command syntax
  const abstractCliTarget = {
    targetId: 'T03',
    concept: 'Terminal Command Line Interface Principles',
    subtopic: 'Operating Systems',
    dimension: 'Conceptual',
    instruction: 'Explain the role of the terminal command line interpreter in modern operating systems.',
    supportingEvidence: 'The terminal command line provides a shell interface for executing system utilities.'
  };
  const resolvedCli = planner._resolveTargetArchetype(abstractCliTarget, sessionEligible, [], {});
  assert.notStrictEqual(resolvedCli, QUESTION_ARCHETYPES.CLI_TERMINAL_IMPACT, 'Abstract command/terminal text must NOT get CLI_TERMINAL_IMPACT');
});

// Test 25: Issue 4 - Adversarial formula tests: dangling operators, malformed expressions, and prose numbers
it('T25: Adversarial formula verification blocks malformed syntax, dangling operators, and prose numbers', () => {
  // Dangling operators
  assert.strictEqual(planner._isGenuineMathExpression('total = x + y + '), false, 'Dangling plus operator must fail');
  assert.strictEqual(planner._isGenuineMathExpression('value = 5 * '), false, 'Dangling multiply operator must fail');
  assert.strictEqual(planner._isGenuineMathExpression('offset = address - '), false, 'Dangling minus operator must fail');

  // Malformed equations and operators
  assert.strictEqual(planner._isGenuineMathExpression('1 + + 2'), false, 'Malformed ++ in arithmetic must fail');
  assert.strictEqual(planner._isGenuineMathExpression('x = = 5'), false, 'Malformed double equals must fail');
  assert.strictEqual(planner._isGenuineMathExpression('= 10'), false, 'Missing LHS variable must fail');
  assert.strictEqual(planner._isGenuineMathExpression('(x + y * 2'), false, 'Unbalanced parentheses must fail');

  // Natural language prose with arithmetic punctuation
  assert.strictEqual(planner._isGenuineMathExpression('Items 1 - 5 on the list'), false, 'Item range must fail');
  assert.strictEqual(planner._isGenuineMathExpression('Cost is $10 - $20 per month'), false, 'Price range must fail');
  assert.strictEqual(planner._isGenuineMathExpression('Call +1-555-0199 for support'), false, 'Phone number must fail');

  // Valid genuine formulas must continue to pass
  assert.ok(planner._isGenuineMathExpression('total = x + y + z'), 'Valid binary arithmetic must pass');
  assert.ok(planner._isGenuineMathExpression('result = (x + y) * 2'), 'Valid arithmetic with balanced parens must pass');
  assert.ok(planner._isGenuineMathExpression('In v2.1, offset = address mod 4096'), 'Mixed version and modulo must pass');
  assert.ok(planner._isGenuineMathExpression('burst time = 8 ms, arrival time = 0'), 'Domain math parameters must pass');
});

// Test 26: Issue 4 - Formulas in code comments are validated against adversarial syntax
it('T26: Valid formulas in technical notes pass while invalid commented equations fail', () => {
  const validFormula = 'Note: effective access time EAT = 0.9 * 10 + 0.1 * 100';
  assert.ok(planner._isGenuineMathExpression(validFormula), 'Valid formula in technical notes must pass');

  const invalidCommentFormula = '// Note: formula calculation = a + ';
  assert.strictEqual(planner._isGenuineMathExpression(invalidCommentFormula), false, 'Dangling equation in comment must fail');
});

// Test 27: End-to-end check - Complete boundary exclusion preserves UNFULFILLED_CAPACITY_DEFICIT through full fallback pipeline
it('T27: Full pipeline preserves UNFULFILLED_CAPACITY_DEFICIT and locks downstream deficit recognition', () => {
  const allExcluded = ['NO_CODE', 'NO_MATH', 'NO_CLI', 'NO_CONCEPTUAL', 'NO_MUTATION'];
  const plan = planner._buildFallbackPlan('Completely Restricted Subject', 'Medium', 3, {}, {}, ['Topic A', 'Topic B'], {
    negativeBoundaries: allExcluded,
    unifiedRawContent: 'Basic curricular text.'
  });

  assert.strictEqual(plan.assessmentTargets.length, 3);
  plan.assessmentTargets.forEach((t) => {
    assert.strictEqual(t.targetArchetype, 'UNFULFILLED_CAPACITY_DEFICIT');
    assert.strictEqual(t.intendedCognitiveOperation, 'UNFULFILLED_CAPACITY_DEFICIT');
    assert.strictEqual(t.isCapacityLimited, true);
    assert.ok(
      ['NEGATIVE_BOUNDARY_EXCLUSION', 'INSUFFICIENT_CURRICULAR_EVIDENCE'].includes(t.capacityLimitation?.status),
      `Status must be deficit status, got: ${t.capacityLimitation?.status}`
    );

    // Downstream pipelineOrchestrator recognition check
    const isPreIdentifiedDeficit = Boolean(
      t.intendedCognitiveOperation === 'UNFULFILLED_CAPACITY_DEFICIT' ||
      t.targetArchetype === 'UNFULFILLED_CAPACITY_DEFICIT' ||
      t.isCapacityLimited === true
    );
    assert.strictEqual(isPreIdentifiedDeficit, true, 'Downstream pipeline must recognize slot as pre-identified deficit');
  });
});

console.log('\n======================================================================');
console.log(` 🏁 RESULT: ${passedTests} / ${totalTests} TESTS PASSED CLEANLY`);
console.log('======================================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
