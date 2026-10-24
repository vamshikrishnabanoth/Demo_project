/**
 * server/test/test_phase3_verification.js
 *
 * PHASE 3 TEST SUITE: Deterministic Sandbox Verifiers & Integrity Gate.
 *
 * Verifies:
 * 1. Option Validation Contract: Single digits, identifiers, symbols vs invalid short prose
 * 2. Calculation Verifier: Modulo, powers of 2, tree bounds, arithmetic contradictions, allowlisted grammar
 * 3. Micro-Trace Verifier: Loop accumulators, variable swaps, collection mutations, unsupported traces
 * 4. Verification Record Integrity Gate: Schema completeness, correct answer rationale exclusion, byLetter synchronization, factual non-contradiction
 * 5. Safeguard A & B: Explicit statuses (MODEL_ASSERTED, DETERMINISTIC_VERIFIED, VERIFICATION_FAILED, VERIFICATION_UNSUPPORTED) without false certifications
 * 6. Safeguard C: Fast-path protection in agent3Evaluator (failed verifications blocked; unsupported not falsely certified)
 */

'use strict';

const assert = require('assert');
const deterministicValidator = require('../engine/validators/deterministicValidator');
const calculationEngine = require('../engine/validators/calculationEngine');
const microTraceVerifier = require('../engine/validators/microTraceVerifier');
const verificationRecordGate = require('../engine/validators/verificationRecordGate');
const agent3Evaluator = require('../engine/agents/agent3Evaluator');

console.log('======================================================================');
console.log('🧪 RUNNING PHASE 3: DETERMINISTIC VERIFIERS & INTEGRITY GATE SUITE');
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
  // ───────────────────────────────────────────────────────────────────────────
  // PART 1: OPTION VALIDATION CONTRACT
  // ───────────────────────────────────────────────────────────────────────────

  test('T1: Single-digit numerical options (0, 1, 2, 3) pass runPreChecks without EMPTY_OR_SHORT_OPTION', () => {
    const mcq = {
      questionText: 'What is the value of x after the loop terminates?',
      options: ['0', '1', '2', '3'],
      correctAnswer: '3'
    };
    const res = deterministicValidator.runPreChecks(mcq);
    assert.strictEqual(res.isValid, true, 'Single digit options must be accepted');
    assert.strictEqual(res.errors.length, 0);
  });

  test('T2: Single-character identifiers (i, j, k, n) and operators (+, -, *, /) pass validation', () => {
    const mcqIdentifiers = {
      questionText: 'Which variable stores the loop accumulator?',
      options: ['i', 'j', 'k', 'n'],
      correctAnswer: 'i'
    };
    const resId = deterministicValidator.runPreChecks(mcqIdentifiers);
    assert.strictEqual(resId.isValid, true, 'Single-character identifiers must be accepted');

    const mcqOperators = {
      questionText: 'Which operator performs modular reduction?',
      options: ['+', '-', '*', '%'],
      correctAnswer: '%'
    };
    const resOp = deterministicValidator.runPreChecks(mcqOperators);
    assert.strictEqual(resOp.isValid, true, 'Single-character math operators must be accepted');
  });

  test('T3: Stray punctuation and whitespace-only options are strictly rejected', () => {
    const mcqPunct = {
      questionText: 'What is the result of dereferencing a null pointer?',
      options: ['.', 'Segmentation Fault', 'Buffer Overflow', 'Stack Exhaustion'],
      correctAnswer: 'Segmentation Fault'
    };
    const resPunct = deterministicValidator.runPreChecks(mcqPunct);
    assert.strictEqual(resPunct.isValid, false, 'Single punctuation "." must be rejected');
    assert(resPunct.errors.some(e => e.includes('EMPTY_OR_SHORT_OPTION') || e.includes('shorter than 2 characters')));

    const mcqEmpty = {
      questionText: 'What is the return code for success in POSIX?',
      options: ['', '0', '1', '-1'],
      correctAnswer: '0'
    };
    const resEmpty = deterministicValidator.runPreChecks(mcqEmpty);
    assert.strictEqual(resEmpty.isValid, false, 'Empty option string must be rejected');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // PART 2: CALCULATION VERIFIER (ALLOWLISTED GRAMMAR & ZERO EVAL)
  // ───────────────────────────────────────────────────────────────────────────

  test('T4: Calculation verifier verifies modulo page offset calculations (e.g. 5000 % 4096 = 904)', () => {
    const mcq = {
      questionText: 'Given virtual address 5000 and 4096-byte page size, what is the page offset?',
      options: ['904 bytes', '1024 bytes', '4096 bytes', '5000 bytes'],
      correctAnswer: '904 bytes',
      verificationRecord: {
        computedOrTracedKey: 'Offset calculation: 5000 % 4096 = 904 bytes.'
      }
    };
    const res = calculationEngine.verifyCalculation(mcq, { targetArchetype: 'QUICK_CALCULATION' });
    assert.strictEqual(res.status, 'DETERMINISTIC_VERIFIED');
    assert.strictEqual(res.computedResult, 904);
  });

  test('T5: Calculation verifier verifies tree leaf bounds and power-of-two relations', () => {
    const mcq = {
      questionText: 'What is the maximum number of leaves in a binary tree of height 4?',
      options: ['8', '15', '16', '32'],
      correctAnswer: '16',
      verificationRecord: {
        computedOrTracedKey: 'Binary tree bounds: 2^4 = 16 leaves.'
      }
    };
    const res = calculationEngine.verifyCalculation(mcq, { targetArchetype: 'QUICK_CALCULATION' });
    assert.strictEqual(res.status, 'DETERMINISTIC_VERIFIED');
    assert.strictEqual(res.computedResult, 16);
  });

  test('T6: Calculation verifier rejects arithmetic contradictions between claimed formula and correctAnswer', () => {
    const mcq = {
      questionText: 'What is the physical offset for virtual address 5000 with 4096-byte pages?',
      options: ['904', '1024', '2048', '4096'],
      correctAnswer: '1024', // Contradicts math 5000 % 4096 = 904
      verificationRecord: {
        computedOrTracedKey: 'Offset calculation: 5000 % 4096 = 1024'
      }
    };
    const res = calculationEngine.verifyCalculation(mcq, { targetArchetype: 'QUICK_CALCULATION' });
    assert.strictEqual(res.status, 'VERIFICATION_FAILED');
    assert(res.reason.includes('evaluated to 904, but correctAnswer asserts "1024"'));
  });

  test('T7: Calculation verifier safely blocks unallowlisted code injection attempts without executing eval', () => {
    const parser = calculationEngine.parser;
    assert.strictEqual(parser.parseAndCompute('process.exit(1)').success, false);
    assert.strictEqual(parser.parseAndCompute('require("fs").unlinkSync("x")').success, false);
    assert.strictEqual(parser.parseAndCompute('10 / 0').success, false);
    assert.strictEqual(parser.parseAndCompute('(10 + 20').success, false);
  });

  test('T8: Calculation verifier marks unsupported formulas as VERIFICATION_UNSUPPORTED rather than guessing', () => {
    const mcq = {
      questionText: 'What is the asymptotic amortized bound?',
      options: ['O(1)', 'O(log N)', 'O(N)', 'O(N^2)'],
      correctAnswer: 'O(1)',
      verificationRecord: {
        computedOrTracedKey: 'Amortized bound derived from potential function Phi(D_i).'
      }
    };
    const res = calculationEngine.verifyCalculation(mcq, { targetArchetype: 'QUICK_CALCULATION' });
    assert.strictEqual(res.status, 'VERIFICATION_UNSUPPORTED');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // PART 3: MICRO-TRACE VERIFIER (PURE JS STATE SIMULATION)
  // ───────────────────────────────────────────────────────────────────────────

  test('T9: Micro-trace verifier simulates loop accumulators and confirms final state matches correctAnswer', () => {
    const mcq = {
      questionText: 'What is the value of total after the loop terminates?\n```c\nint total = 0;\nfor (int i = 0; i < 4; i++)\n  total += i;\n```',
      options: ['3', '6', '10', '15'],
      correctAnswer: '6',
      verificationRecord: {
        computedOrTracedKey: 'Loop trace: i=0->0, i=1->1, i=2->3, i=3->6.'
      }
    };
    const res = microTraceVerifier.verifyTrace(mcq, { targetArchetype: 'MICRO_TRACE' });
    assert.strictEqual(res.status, 'DETERMINISTIC_VERIFIED');
    assert.strictEqual(res.finalState.total, 6);
    assert.strictEqual(res.intermediateStates.length, 4);
  });

  test('T10: Micro-trace verifier catches state divergence in loop accumulator', () => {
    const mcq = {
      questionText: 'What is the value of total after the loop terminates?\n```c\nint total = 0;\nfor (int i = 0; i < 4; i++)\n  total += i;\n```',
      options: ['3', '6', '10', '15'],
      correctAnswer: '10', // Wrong: loop terminates at i=4 so total is 6
      verificationRecord: {
        computedOrTracedKey: 'Loop trace: claimed total is 10'
      }
    };
    const res = microTraceVerifier.verifyTrace(mcq, { targetArchetype: 'MICRO_TRACE' });
    assert.strictEqual(res.status, 'VERIFICATION_FAILED');
    assert(res.reason.includes('computed total=6, but correctAnswer asserts "10"'));
  });

  test('T11: Micro-trace verifier validates variable swap and collection mutation patterns', () => {
    const mcqSwap = {
      questionText: 'What are values of a and b?\n```c\ntemp = a; a = b; b = temp;\n```',
      options: ['Swapped', 'Both equal to a', 'Both equal to b', 'Reset to zero'],
      correctAnswer: 'Swapped',
      verificationRecord: { computedOrTracedKey: 'temp holds a; a gets b; b gets temp.' }
    };
    const resSwap = microTraceVerifier.verifyTrace(mcqSwap, { targetArchetype: 'MICRO_TRACE' });
    assert.strictEqual(resSwap.status, 'DETERMINISTIC_VERIFIED');
    assert.strictEqual(resSwap.pattern, 'VARIABLE_SWAP');

    const mcqQueue = {
      questionText: 'What value is dequeued next?\n```javascript\nq.push(10);\nq.push(20);\nq.shift();\n```',
      options: ['10', '20', 'undefined', 'null'],
      correctAnswer: '20',
      verificationRecord: { computedOrTracedKey: '10 was shifted; front of queue is now 20.' }
    };
    const resQueue = microTraceVerifier.verifyTrace(mcqQueue, { targetArchetype: 'MICRO_TRACE' });
    assert.strictEqual(resQueue.status, 'DETERMINISTIC_VERIFIED');
    assert.strictEqual(resQueue.pattern, 'COLLECTION_MUTATION');
  });

  test('T12: Micro-trace verifier leaves unsupported code patterns as VERIFICATION_UNSUPPORTED', () => {
    const mcq = {
      questionText: 'What is returned by this recursive function?\n```c\nint ackermann(int m, int n) { ... }\n```',
      options: ['4', '8', '16', '32'],
      correctAnswer: '16',
      verificationRecord: { computedOrTracedKey: 'Ackermann expansion' }
    };
    const res = microTraceVerifier.verifyTrace(mcq, { targetArchetype: 'MICRO_TRACE' });
    assert.strictEqual(res.status, 'VERIFICATION_UNSUPPORTED');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // PART 4: VERIFICATION RECORD INTEGRITY GATE
  // ───────────────────────────────────────────────────────────────────────────

  test('T13: Gate verifies complete distractor rationales and rejects missing non-key rationales', () => {
    const validMCQ = {
      questionText: 'What happens when git reset --soft HEAD~1 is run?',
      options: ['OptA', 'OptB', 'OptC', 'OptD'],
      correctAnswer: 'OptB',
      verificationRecord: {
        factualBasis: 'Git reset soft moves only the HEAD pointer back by one commit.',
        computedOrTracedKey: 'State delta: HEAD points to HEAD~1; index and worktree untouched.',
        distractorRationales: {
          'OptA': 'Describes git reset --hard behavior.',
          'OptC': 'Confuses reset with git stash.',
          'OptD': 'Inverts reset into commit operation.'
        },
        byLetter: {
          'A': 'Describes git reset --hard behavior.',
          'C': 'Confuses reset with git stash.',
          'D': 'Inverts reset into commit operation.'
        }
      }
    };
    const validRes = verificationRecordGate.verify(validMCQ, { targetArchetype: 'CONCEPTUAL_CONTRAST' });
    // Conceptual contrast cannot be deterministically simulated -> VERIFICATION_UNSUPPORTED (Safeguard B)
    assert.strictEqual(validRes.status, 'VERIFICATION_UNSUPPORTED');
    assert.strictEqual(validRes.verifiedProgrammatically, false);

    // Missing rationale for OptD
    const brokenMCQ = JSON.parse(JSON.stringify(validMCQ));
    delete brokenMCQ.verificationRecord.distractorRationales['OptD'];
    const brokenRes = verificationRecordGate.verify(brokenMCQ, { targetArchetype: 'CONCEPTUAL_CONTRAST' });
    assert.strictEqual(brokenRes.status, 'VERIFICATION_MALFORMED');
  });

  test('T14: Gate strictly rejects distractor rationales that assign a rationale to the correct answer', () => {
    const invalidMCQ = {
      questionText: 'Which data structure enforces FIFO order?',
      options: ['Stack', 'Queue', 'Array', 'Tree'],
      correctAnswer: 'Queue',
      verificationRecord: {
        factualBasis: 'Queue provides first-in first-out sequential ordering.',
        computedOrTracedKey: 'FIFO invariant strictly satisfied by Queue.',
        distractorRationales: {
          'Queue': 'Incorrectly assigning a distractor rationale to the correct answer!',
          'Stack': 'Enforces LIFO rather than FIFO order.',
          'Array': 'Random access rather than sequential FIFO order.',
          'Tree': 'Hierarchical organization.'
        }
      }
    };
    const res = verificationRecordGate.verify(invalidMCQ, { targetArchetype: 'CONCEPTUAL_CONTRAST' });
    assert.strictEqual(res.status, 'VERIFICATION_FAILED');
    assert(res.reason.includes('Correct answer "Queue" must never receive a distractor rationale'));
  });

  test('T15: Gate catches byLetter desynchronization from option permutation', () => {
    const desyncedMCQ = {
      questionText: 'Which command stages all changes in git?',
      options: ['git add .', 'git push', 'git commit', 'git status'],
      correctAnswer: 'git add .',
      verificationRecord: {
        factualBasis: 'git add stages working tree modifications.',
        computedOrTracedKey: 'Adds files to staging index.',
        distractorRationales: {
          'git push': 'Transfers commits to remote.',
          'git commit': 'Records staged changes in repo.',
          'git status': 'Shows working tree status.'
        },
        byLetter: {
          // A is git add . (correct answer), but byLetter mistakenly assigned rationale to A!
          'A': 'Transfers commits to remote.',
          'C': 'Records staged changes in repo.',
          'D': 'Shows working tree status.'
        }
      }
    };
    const res = verificationRecordGate.verify(desyncedMCQ, { targetArchetype: 'CONCEPTUAL_CONTRAST' });
    assert.strictEqual(res.status, 'VERIFICATION_FAILED');
    assert(res.reason.includes('holds the correct answer but contains a distractor rationale'));
  });

  test('T16: Gate catches factualBasis contradiction against session evidence', () => {
    const contradictoryMCQ = {
      questionText: 'What is the indexing convention in standard C arrays?',
      options: ['0-indexed', '1-indexed', '2-indexed', 'Dynamic'],
      correctAnswer: '0-indexed',
      verificationRecord: {
        // Factual basis contradicts session evidence
        factualBasis: 'C arrays are 1-indexed by architectural convention.',
        computedOrTracedKey: 'Verified against specification.',
        distractorRationales: {
          '1-indexed': 'Common student off-by-one confusion.',
          '2-indexed': 'Absurd offset.',
          'Dynamic': 'Static contiguous array.'
        }
      }
    };
    const evidence = 'In standard C programming, array offsets are always 0-indexed contiguous memory locations.';
    const res = verificationRecordGate.verify(contradictoryMCQ, { targetArchetype: 'CONCEPTUAL_CONTRAST' }, evidence);
    assert.strictEqual(res.status, 'VERIFICATION_FAILED');
    assert(res.reason.includes('Factual basis contradicts session evidence') || res.reason.includes('FACTUAL_CONTRADICTION'));
  });

  test('T17: Full deterministic verification succeeds on clean QUICK_CALCULATION question', () => {
    const mathMCQ = {
      questionText: 'Calculate physical page offset for address 5000 with page size 4096 bytes.',
      options: ['904 bytes', '1024 bytes', '4096 bytes', '5000 bytes'],
      correctAnswer: '904 bytes',
      verificationRecord: {
        factualBasis: 'Physical page offset is computed via address modulo page size: address % pageSize.',
        computedOrTracedKey: 'Offset = 5000 % 4096 = 904 bytes.',
        distractorRationales: {
          '1024 bytes': 'Powers of two confusion.',
          '4096 bytes': 'Full page size rather than offset.',
          '5000 bytes': 'Raw address without translation.'
        },
        byLetter: {
          'B': 'Powers of two confusion.',
          'C': 'Full page size rather than offset.',
          'D': 'Raw address without translation.'
        }
      }
    };
    const res = verificationRecordGate.verify(mathMCQ, { targetArchetype: 'QUICK_CALCULATION' }, 'Page translation calculates offset as address modulo page size.');
    assert.strictEqual(res.status, 'DETERMINISTIC_VERIFIED');
    assert.strictEqual(res.verifiedProgrammatically, true);
    assert.strictEqual(res.method, 'CALCULATION_ENGINE');
  });

  test('T18: Full deterministic verification succeeds on clean MICRO_TRACE question', () => {
    const traceMCQ = {
      questionText: 'What is total after the loop?\n```c\nint total = 0;\nfor (int i = 0; i < 3; i++)\n  total += i;\n```',
      options: ['1', '3', '6', '10'],
      correctAnswer: '3',
      verificationRecord: {
        factualBasis: 'Loop accumulator executes for i from 0 through 2, incrementing total.',
        computedOrTracedKey: 'Trace steps: i=0 total=0; i=1 total=1; i=2 total=3.',
        distractorRationales: {
          '1': 'Stops after i=1 iteration.',
          '6': 'Adds i=3 past loop termination condition.',
          '10': 'Sums up to i=4.'
        },
        byLetter: {
          'A': 'Stops after i=1 iteration.',
          'C': 'Adds i=3 past loop termination condition.',
          'D': 'Sums up to i=4.'
        }
      }
    };
    const res = verificationRecordGate.verify(traceMCQ, { targetArchetype: 'MICRO_TRACE' }, 'Loop accumulates i across iterations.');
    assert.strictEqual(res.status, 'DETERMINISTIC_VERIFIED');
    assert.strictEqual(res.verifiedProgrammatically, true);
    assert.strictEqual(res.method, 'MICRO_TRACE_VERIFIER');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // PART 5: SAFEGUARDS A, B & C (FAST PATH PROTECTION IN AGENT 3 EVALUATOR)
  // ───────────────────────────────────────────────────────────────────────────

  test('T19: Safeguard C: agent3Evaluator blocks fast path when verification fails on arithmetic discrepancy', async () => {
    const target = {
      targetId: 'T19_CALC',
      concept: 'Virtual Page Offset',
      targetDifficulty: 'Medium',
      intendedCognitiveOperation: 'CALCULATE',
      targetArchetype: 'QUICK_CALCULATION'
    };

    const faultyMCQ = {
      questionText: 'What is the offset for address 5000 with 4096-byte pages?',
      options: ['904 bytes', '1024 bytes', '2048 bytes', '4096 bytes'],
      correctAnswer: '1024 bytes', // Arithmetic error! 5000 % 4096 is 904
      verificationRecord: {
        factualBasis: 'Virtual address translation uses address modulo page size to find offset.',
        computedOrTracedKey: 'Offset = 5000 % 4096 = 1024 bytes.',
        distractorRationales: {
          '904 bytes': 'Arbitrary alternative.',
          '2048 bytes': 'Half page size.',
          '4096 bytes': 'Full page size.'
        }
      }
    };

    const preAudit = agent3Evaluator._runDeterministicAudit(faultyMCQ, target, 'Address translation modulo page size yields offset.');
    assert.strictEqual(preAudit.passed, false, 'Pre-audit must fail when deterministic verification fails');
    assert(preAudit.failureReasons.includes('VERIFICATION_FAILED'));
    assert.strictEqual(faultyMCQ.verificationRecord.verificationStatus, 'VERIFICATION_FAILED');
    assert.strictEqual(faultyMCQ.verificationRecord.verifiedProgrammatically, false);
  });

  test('T20: Safeguard A & B: Conceptual questions are tagged VERIFICATION_UNSUPPORTED and never falsely certified as DETERMINISTIC_VERIFIED', async () => {
    const target = {
      targetId: 'T20_CONCEPT',
      concept: 'Virtual Memory vs Physical Memory',
      targetDifficulty: 'Medium',
      intendedCognitiveOperation: 'COMPARE',
      targetArchetype: 'CONCEPTUAL_CONTRAST'
    };

    const conceptualMCQ = {
      questionText: 'How does virtual memory differ from physical memory in modern operating systems?',
      options: [
        'Virtual memory provides an isolated address space mapped by page tables',
        'Virtual memory replaces CPU registers completely',
        'Virtual memory eliminates the need for physical RAM',
        'Virtual memory requires dedicated magnetic tape drives'
      ],
      correctAnswer: 'Virtual memory provides an isolated address space mapped by page tables',
      verificationRecord: {
        factualBasis: 'Virtual memory creates an abstraction layer over physical memory frames.',
        computedOrTracedKey: 'Contrast: virtual memory offers isolation and paging, while physical memory refers to installed RAM.',
        distractorRationales: {
          'Virtual memory replaces CPU registers completely': 'Confuses virtual addressing with processor registers.',
          'Virtual memory eliminates the need for physical RAM': 'Overlooks that virtual pages back into physical frames.',
          'Virtual memory requires dedicated magnetic tape drives': 'Anachronistic storage medium.'
        },
        byLetter: {
          'B': 'Confuses virtual addressing with processor registers.',
          'C': 'Overlooks that virtual pages back into physical frames.',
          'D': 'Anachronistic storage medium.'
        }
      }
    };

    const preAudit = agent3Evaluator._runDeterministicAudit(conceptualMCQ, target, 'Virtual memory creates an isolated address space mapped by page tables to physical frames.');
    // Must NOT be stamped DETERMINISTIC_VERIFIED (Safeguard B)
    assert.strictEqual(conceptualMCQ.verificationRecord.verificationStatus, 'VERIFICATION_UNSUPPORTED');
    assert.strictEqual(conceptualMCQ.verificationRecord.verifiedProgrammatically, false);
    // But passes preAudit because options, length, and grounding are sound
    assert.strictEqual(preAudit.passed, true);
  });


  // ───────────────────────────────────────────────────────────────────────────
  // PART 6: FOUR CRITICAL PRE-COMMIT CORRECTNESS VERIFICATIONS
  // ───────────────────────────────────────────────────────────────────────────

  test('T21: Risk 1 - SafeMathParser enforces precedence, right-associative power, non-finite rejection, and zero eval', () => {
    const parser = calculationEngine.parser;
    // Operator precedence: 2 + 3 * 4 = 14; 2 * 3 ^ 2 = 18
    assert.strictEqual(parser.parseAndCompute('2 + 3 * 4').value, 14);
    assert.strictEqual(parser.parseAndCompute('2 * 3 ^ 2').value, 18);
    // Right-associative exponentiation: 2 ^ 3 ^ 2 = 2^(3^2) = 512 (NOT (2^3)^2 = 64)
    assert.strictEqual(parser.parseAndCompute('2 ^ 3 ^ 2').value, 512);
    // Division and modulo by zero
    assert.strictEqual(parser.parseAndCompute('42 / 0').success, false);
    assert.strictEqual(parser.parseAndCompute('42 % 0').success, false);
    // Non-finite results rejected
    assert.strictEqual(parser.parseAndCompute('10 ^ 1000').success, false);
    assert.strictEqual(parser.parseAndCompute('sqrt(-1)').success, false);
    // Rounding tolerance
    const mcqFloat = {
      questionText: 'Evaluate expression 0.1 + 0.2',
      correctAnswer: '0.3',
      verificationRecord: { computedOrTracedKey: '0.1 + 0.2 = 0.3' }
    };
    const floatRes = calculationEngine.verifyCalculation(mcqFloat, { targetArchetype: 'QUICK_CALCULATION' });
    assert.strictEqual(floatRes.status, 'DETERMINISTIC_VERIFIED');
  });

  test('T22: Risk 2 - MicroTraceVerifier handles <= boundaries, zero iterations, decrements, and prevents substring false positives', () => {
    // 1. Loop with <= boundary condition
    const mcqLeq = {
      questionText: 'What is total?\n```c\nint total = 0;\nfor (int i = 0; i <= 3; i++)\n  total += i;\n```',
      options: ['3', '6', '10', '15'],
      correctAnswer: '6'
    };
    const resLeq = microTraceVerifier.verifyTrace(mcqLeq);
    assert.strictEqual(resLeq.status, 'DETERMINISTIC_VERIFIED');
    assert.strictEqual(resLeq.finalState.total, 6);
    assert.strictEqual(resLeq.intermediateStates.length, 4);

    // 2. Zero iterations loop: i < 0
    const mcqZero = {
      questionText: 'What is total?\n```c\nint total = 0;\nfor (int i = 0; i < 0; i++)\n  total += i;\n```',
      options: ['0', '1', '2', '3'],
      correctAnswer: '0'
    };
    const resZero = microTraceVerifier.verifyTrace(mcqZero);
    assert.strictEqual(resZero.status, 'DETERMINISTIC_VERIFIED');
    assert.strictEqual(resZero.finalState.total, 0);
    assert.strictEqual(resZero.intermediateStates.length, 0);

    // 3. Decrementing loop: i > 0; i--
    const mcqDec = {
      questionText: 'What is total?\n```c\nint total = 0;\nfor (int i = 3; i > 0; i--)\n  total += i;\n```',
      options: ['3', '6', '9', '12'],
      correctAnswer: '6'
    };
    const resDec = microTraceVerifier.verifyTrace(mcqDec);
    assert.strictEqual(resDec.status, 'DETERMINISTIC_VERIFIED');
    assert.strictEqual(resDec.finalState.total, 6);

    // 4. Substring safety: total = 0 must NEVER match correctAnswer = '10'
    const mcqSubstringBug = {
      questionText: 'What is total?\n```c\nint total = 0;\nfor (int i = 0; i < 1; i++)\n  total += i;\n```',
      options: ['0', '5', '10', '15'],
      correctAnswer: '10' // 0 !== 10, but '10'.includes('0') is true
    };
    const resSub = microTraceVerifier.verifyTrace(mcqSubstringBug);
    assert.strictEqual(resSub.status, 'VERIFICATION_FAILED');

    // 5. Stack LIFO verification
    const mcqStack = {
      questionText: 'What remains at top?\n```javascript\ns.push(10);\ns.push(20);\ns.pop();\n```',
      options: ['10', '20', 'undefined', 'null'],
      correctAnswer: '10'
    };
    const resStack = microTraceVerifier.verifyTrace(mcqStack);
    assert.strictEqual(resStack.status, 'DETERMINISTIC_VERIFIED');
    assert.strictEqual(resStack.finalState[0], '10');
  });

  test('T23: Risk 3 - Grounding gate rejects generic boilerplate without evidence overlap', () => {
    const boilerplateMCQ = {
      questionText: 'What is the indexing convention in standard C arrays?',
      options: ['0-indexed', '1-indexed', '2-indexed', 'Dynamic'],
      correctAnswer: '0-indexed',
      verificationRecord: {
        factualBasis: 'This is a standard academic concept taught in computer science curriculum.',
        computedOrTracedKey: 'Offset convention.',
        distractorRationales: {
          '1-indexed': 'Common student off-by-one confusion.',
          '2-indexed': 'Absurd offset.',
          'Dynamic': 'Static contiguous array.'
        },
        byLetter: {
          'B': 'Common student off-by-one confusion.',
          'C': 'Absurd offset.',
          'D': 'Static contiguous array.'
        }
      }
    };
    const evidence = 'In standard C programming, array offsets are always 0-indexed contiguous memory locations.';
    const res = verificationRecordGate.verify(boilerplateMCQ, { targetArchetype: 'CONCEPTUAL_CONTRAST' }, evidence);
    assert.strictEqual(res.status, 'VERIFICATION_FAILED');
    assert(res.reason.includes('zero substantive keyword overlap') || res.reason.includes('fails grounding'));
  });

  test('T24: Risk 4 - Verification status propagation ensures fast-path never certifies unsupported as verified', async () => {
    const target = {
      targetId: 'T24_FAST_PATH_SAFEGUARD',
      concept: 'Array Indexing',
      targetDifficulty: 'Easy',
      intendedCognitiveOperation: 'RECALL',
      targetArchetype: 'CONCEPTUAL_CONTRAST'
    };

    const mcq = {
      questionText: 'What is the standard array index origin in C?',
      options: [
        'Zero-based indexing at offset 0',
        'One-based indexing starting at 1',
        'Pointer-based dynamic offset',
        'Hash-based memory lookup'
      ],
      correctAnswer: 'Zero-based indexing at offset 0',
      verificationRecord: {
        factualBasis: 'In standard C programming, array offsets are always zero-based contiguous memory.',
        computedOrTracedKey: 'Verified against specification.',
        distractorRationales: {
          'One-based indexing starting at 1': 'Student off-by-one error.',
          'Pointer-based dynamic offset': 'Confuses array indices with pointer arithmetic.',
          'Hash-based memory lookup': 'Confuses array indexing with hash tables.'
        },
        byLetter: {
          'B': 'Student off-by-one error.',
          'C': 'Confuses array indices with pointer arithmetic.',
          'D': 'Confuses array indexing with hash tables.'
        }
      }
    };

    const evidence = 'In standard C programming, array offsets are always zero-based contiguous memory locations.';
    const auditRes = agent3Evaluator._runDeterministicAudit(mcq, target, evidence);
    assert.strictEqual(auditRes.passed, true);
    assert.strictEqual(auditRes.verificationStatus, 'VERIFICATION_UNSUPPORTED');
    assert.strictEqual(auditRes.verifiedProgrammatically, false);
    assert.strictEqual(mcq.verificationRecord.verificationStatus, 'VERIFICATION_UNSUPPORTED');
    assert.strictEqual(mcq.verificationRecord.verifiedProgrammatically, false);
  });

  console.log('\n======================================================================');
  console.log(` 🏁 RESULT: ${passCount} / ${passCount} PHASE 3 TESTS PASSED CLEANLY`);
  console.log('======================================================================\n');
})();
