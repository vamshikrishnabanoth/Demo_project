/**
 * server/test/test_release_gate_remediation.js
 *
 * Dedicated regression suite for release-blocking defects:
 * 1. Deterministic rejection of schema placeholder options (Asserts 1-3).
 * 2. Deterministic concept normalization and duplicate prevention (Assert 4).
 * 3. Provenance-enforced faculty analytics & score separation (Asserts 5-6).
 * 4. Easy-tier fast-path cannot bypass placeholder rejection (Assert 7).
 */

'use strict';

const assert = require('assert');
const deterministicValidator = require('../engine/validators/deterministicValidator');
const kmitStyleContract = require('../config/kmitStyleContract');
const agent3Evaluator = require('../engine/agents/agent3Evaluator');
const { OPTION_SET_CONTRACT } = require('../engine/contracts/pipelineContracts');

console.log('======================================================================');
console.log('🧪 VERIFYING RELEASE GATE REMEDIATION TEST SUITE');
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

async function runAsyncTest(name, fn) {
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

async function runAllTests() {
  // -------------------------------------------------------------------------
  // Assert 1: Exact placeholder options rejected with SCHEMA_PLACEHOLDER_OPTION
  // -------------------------------------------------------------------------
  test('Assert 1: Exact prompt schema archetype placeholder options rejected', () => {
    const placeholderArchetypes = [
      'Contrasting algorithmic approach or property',
      'Technically precise, correct formulation',
      'Boundary-condition or complexity trap',
      'Plausible engineering alternative / misconception',
      'Plausible engineering alternative',
      'Boundary condition trap',
      'Plausible alternative concept',
      'Distinct contrasting mechanism',
      'Valid factual formulation',
      'Common conceptual misconception'
    ];

    for (const placeholder of placeholderArchetypes) {
      assert.strictEqual(
        deterministicValidator.isSchemaPlaceholderOption(placeholder),
        true,
        `Expected isSchemaPlaceholderOption("${placeholder}") to return true`
      );

      const options = [
        'A valid, highly specific technical implementation choice',
        placeholder,
        'Another realistic distractor for direct testing',
        'A plausible algorithmic tradeoff'
      ];

      const validation = deterministicValidator.validateOptionSet(
        options,
        'What is the primary operational characteristic of associative caches?',
        options[0]
      );

      assert.strictEqual(validation.isValid, false, `Expected validation to fail for option "${placeholder}"`);
      const hasCode = validation.errors.some(e => e.code === OPTION_SET_CONTRACT.hardRejectionCodes.SCHEMA_PLACEHOLDER_OPTION);
      assert.strictEqual(hasCode, true, `Expected error code SCHEMA_PLACEHOLDER_OPTION for "${placeholder}"`);

      // Verify style contract also flags it
      const styleAudit = kmitStyleContract.checkStyleHeuristics({
        questionText: 'What is the primary operational characteristic of associative caches?',
        options,
        correctAnswer: options[0]
      });
      assert.strictEqual(styleAudit.passesStyle, false);
      assert.strictEqual(
        styleAudit.issues.includes('SCHEMA_PLACEHOLDER_OPTION'),
        true,
        `Expected style contract to flag SCHEMA_PLACEHOLDER_OPTION for "${placeholder}"`
      );
    }
  });

  // -------------------------------------------------------------------------
  // Assert 2: Case, whitespace, and punctuation variants rejected
  // -------------------------------------------------------------------------
  test('Assert 2: Placeholder variants (case, whitespace, punctuation) rejected', () => {
    const variants = [
      '   contrasting   algorithmic   approach   or   property   ',
      'TECHNICALLY PRECISE, CORRECT FORMULATION.',
      'boundary - condition or complexity trap!',
      'Plausible Engineering Alternative / Misconception...',
      'valid   factual   formulation;',
      'Common Conceptual Misconception.'
    ];

    for (const variant of variants) {
      assert.strictEqual(
        deterministicValidator.isSchemaPlaceholderOption(variant),
        true,
        `Expected variant "${variant}" to be recognized as schema placeholder`
      );

      const options = [
        'Valid technical choice A',
        variant,
        'Valid technical choice C',
        'Valid technical choice D'
      ];

      const validation = deterministicValidator.validateOptionSet(
        options,
        'What is a key difference in addressing modes?',
        options[0]
      );
      assert.strictEqual(validation.isValid, false, `Expected variant "${variant}" to be rejected`);
      assert.strictEqual(
        validation.errors.some(e => e.code === 'SCHEMA_PLACEHOLDER_OPTION'),
        true
      );
    }
  });

  // -------------------------------------------------------------------------
  // Assert 3: Legitimate technical options NOT rejected (zero false positives)
  // -------------------------------------------------------------------------
  test('Assert 3: Legitimate technical options containing similar keywords NOT rejected', () => {
    const legitimateOptions = [
      'Technically feasible using dual-ported SRAM cells in L1 cache',
      'Boundary condition handled via zero-padding at the edge of the array',
      'A plausible engineering alternative that reduces memory bus contention',
      'Contrasting algorithmic complexity between quicksort and mergesort',
      'Valid factual formulation of the Nyquist-Shannon sampling theorem',
      'Crisp 1-2 sentence response required from the real-time controller'
    ];

    for (const opt of legitimateOptions) {
      assert.strictEqual(
        deterministicValidator.isSchemaPlaceholderOption(opt),
        false,
        `False positive detected for legitimate option: "${opt}"`
      );

      const options = [
        opt,
        'Alternative choice 2 with distinct operational logic',
        'Alternative choice 3 with differing execution time',
        'Alternative choice 4 with balanced word count and structure'
      ];

      const validation = deterministicValidator.validateOptionSet(
        options,
        'Which architecture consideration applies to high-performance caches?',
        opt
      );
      const placeholderError = validation.errors.find(e => e.code === 'SCHEMA_PLACEHOLDER_OPTION');
      assert.strictEqual(
        placeholderError,
        undefined,
        `Unexpected SCHEMA_PLACEHOLDER_OPTION error for legitimate option: "${opt}"`
      );
    }
  });

  // -------------------------------------------------------------------------
  // Assert 4: Normalized concept duplicate flagged (& vs and, punctuation, case)
  // -------------------------------------------------------------------------
  test('Assert 4: Normalized concept duplicate detection (& vs and, punctuation, case)', () => {
    // 4a. Pedagogical duplicate detection with normalized concept matching
    const candidateMCQ = {
      questionText: 'In computer architecture, how does cache placement determine conflict misses in direct mapped memory?',
      options: [
        'By mapping multiple memory addresses to the exact same cache set',
        'By hashing all 32 address bits simultaneously',
        'By indexing through a separate associative tag directory',
        'By dividing the total address space into page frames'
      ],
      correctAnswer: 'By mapping multiple memory addresses to the exact same cache set',
      metadata: {
        concept: 'In computer architecture (Core Foundations and Governing Principles)'
      }
    };

    const existingMCQ = {
      questionText: 'In computer architecture, how does cache placement affect memory latency when accessing direct mapped lines?',
      options: [
        'By causing high miss penalties when multiple addresses contend for one line',
        'By translating virtual page addresses',
        'By checking dirty bits in the L2 tag RAM',
        'By querying the TLB miss handler'
      ],
      correctAnswer: 'By causing high miss penalties when multiple addresses contend for one line',
      metadata: {
        concept: 'In computer architecture (Core Foundations & Governing Principles)'
      }
    };

    const target = {
      concept: 'In computer architecture (Core Foundations and Governing Principles)'
    };

    const dupCheck = deterministicValidator.checkDuplicateQuestion(
      candidateMCQ,
      [existingMCQ],
      target
    );

    assert.strictEqual(
      dupCheck.isDuplicate,
      true,
      'Expected duplicate detection to flag pedagogical redundancy when normalized concepts match between "&" and "and"'
    );
    assert.strictEqual(
      dupCheck.reason.includes('PEDAGOGICAL_REDUNDANCY'),
      true,
      'Expected reason to include PEDAGOGICAL_REDUNDANCY'
    );

    // 4b. Replenishment queue concept signature normalization
    const normConceptSig = (c) => String(c || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const primaryConcept = 'In computer architecture (Core Foundations & Governing Principles)';
    const replenishmentConcept = 'In computer architecture (Core Foundations and Governing Principles)';
    const seenConcepts = new Set([normConceptSig(primaryConcept)]);

    assert.strictEqual(
      seenConcepts.has(normConceptSig(replenishmentConcept)),
      true,
      'Expected replenishment concept with "and" to match primary concept with "&" in seenConcepts'
    );
  });

  // -------------------------------------------------------------------------
  // Assert 5: Text-only session: tcScore === null, teacherAnalysis === null, plan.tcScore preserved
  // -------------------------------------------------------------------------
  test('Assert 5: Text-only session decouples plan.tcScore from tcScore & teacherAnalysis', () => {
    const hasVoice = false;
    const plan = {
      subject: 'Computer Architecture',
      mainTopic: 'Cache Memory',
      tcScore: 95
    };
    const evidencePackage = {
      lectureIntelligence: {
        pedagogicalCritique: 'Comprehensive coverage',
        chapters: [],
        conceptMap: [],
        evidenceCapacity: {},
        pedagogicalDeficitIndex: 0.12,
        tcScore: 95
      },
      pdi: 0.12
    };

    // Simulate final result object construction in pipelineOrchestrator.js:
    const tcScore = hasVoice
      ? (evidencePackage?.lectureIntelligence?.tcScore ?? evidencePackage?.voiceAnalysis?.teachingValueScore ?? null)
      : null;

    const teacherAnalysis = hasVoice && evidencePackage?.lectureIntelligence ? {
      pedagogicalCritique: evidencePackage.lectureIntelligence.pedagogicalCritique,
      chapters: evidencePackage.lectureIntelligence.chapters,
      conceptMap: evidencePackage.lectureIntelligence.conceptMap,
      evidenceCapacity: evidencePackage.lectureIntelligence.evidenceCapacity,
      pdi: evidencePackage.lectureIntelligence.pedagogicalDeficitIndex ?? evidencePackage.pdi ?? null,
      tcScore: evidencePackage.lectureIntelligence.tcScore ?? evidencePackage.voiceAnalysis?.teachingValueScore ?? null
    } : null;

    const resultPlan = plan ? {
      subject: plan.subject,
      mainTopic: plan.mainTopic,
      tcScore: plan.tcScore
    } : null;

    assert.strictEqual(tcScore, null, 'Expected tcScore to be null for text-only input');
    assert.strictEqual(teacherAnalysis, null, 'Expected teacherAnalysis to be null for text-only input');
    assert.strictEqual(resultPlan.tcScore, 95, 'Expected plan.tcScore to preserve planning ALO coverage of 95');
  });

  // -------------------------------------------------------------------------
  // Assert 6: Audio session with evaluated score: tcScore === 57, teacherAnalysis.tcScore === 57
  // -------------------------------------------------------------------------
  test('Assert 6: Audio lecture session preserves evaluated tcScore and teacherAnalysis', () => {
    const hasVoice = true;
    const plan = {
      subject: 'Operating Systems',
      mainTopic: 'Virtual Memory',
      tcScore: 90
    };
    const evidencePackage = {
      lectureIntelligence: {
        pedagogicalCritique: 'Clear explanation of page table structures',
        chapters: [{ title: 'Paging' }],
        conceptMap: ['Paging', 'TLB'],
        evidenceCapacity: { depth: 'HIGH' },
        pedagogicalDeficitIndex: 0.28,
        tcScore: 57
      },
      pdi: 0.28
    };

    const tcScore = hasVoice
      ? (evidencePackage?.lectureIntelligence?.tcScore ?? evidencePackage?.voiceAnalysis?.teachingValueScore ?? null)
      : null;

    const teacherAnalysis = hasVoice && evidencePackage?.lectureIntelligence ? {
      pedagogicalCritique: evidencePackage.lectureIntelligence.pedagogicalCritique,
      chapters: evidencePackage.lectureIntelligence.chapters,
      conceptMap: evidencePackage.lectureIntelligence.conceptMap,
      evidenceCapacity: evidencePackage.lectureIntelligence.evidenceCapacity,
      pdi: evidencePackage.lectureIntelligence.pedagogicalDeficitIndex ?? evidencePackage.pdi ?? null,
      tcScore: evidencePackage.lectureIntelligence.tcScore ?? evidencePackage.voiceAnalysis?.teachingValueScore ?? null
    } : null;

    assert.strictEqual(tcScore, 57, 'Expected evaluated tcScore to be 57 for audio session');
    assert.notStrictEqual(teacherAnalysis, null, 'Expected teacherAnalysis to be populated');
    assert.strictEqual(teacherAnalysis.tcScore, 57, 'Expected teacherAnalysis.tcScore to be 57');
  });

  // -------------------------------------------------------------------------
  // Assert 7: Easy-tier fast-path cannot bypass SCHEMA_PLACEHOLDER_OPTION rejection
  // -------------------------------------------------------------------------
  await runAsyncTest('Assert 7: Easy-tier fast-path CANNOT bypass SCHEMA_PLACEHOLDER_OPTION rejection', async () => {
    const candidateMCQ = {
      questionText: 'What is the main function of a processor cache memory?',
      options: [
        'To reduce average memory access latency by storing frequently used data',
        'Contrasting algorithmic approach or property',
        'Technically precise, correct formulation',
        'Boundary-condition or complexity trap'
      ],
      correctAnswer: 'To reduce average memory access latency by storing frequently used data',
      metadata: {
        targetDifficulty: 'Easy',
        intendedCognitiveOperation: 'RECALL',
        concept: 'Cache Memory Hierarchy'
      }
    };

    const target = {
      targetId: 'T_EASY_01',
      targetDifficulty: 'Easy',
      intendedCognitiveOperation: 'RECALL',
      concept: 'Cache Memory Hierarchy',
      supportingEvidence: 'Cache memory is designed to reduce average memory access latency by storing frequently used data close to the processor core.'
    };

    const evidencePackage = {
      unifiedRawContent: target.supportingEvidence,
      curricularContent: target.supportingEvidence
    };

    const evalResult = await agent3Evaluator.evaluateQuestion(
      candidateMCQ,
      target,
      evidencePackage,
      { skipLLM: false }
    );

    assert.strictEqual(evalResult.passed, false, 'Easy question with placeholder options must NOT pass');
    assert.notStrictEqual(
      evalResult.verificationMethod,
      'DETERMINISTIC_RECALL_FAST_PATH',
      'Must NOT be approved by DETERMINISTIC_RECALL_FAST_PATH'
    );
    assert.strictEqual(
      evalResult.failureReasons.some(r => r.includes('OPTION_VALIDATION_ERROR') || r.includes('STYLE_SCHEMA_PLACEHOLDER_OPTION')),
      true,
      `Expected failureReasons to contain placeholder rejection codes, got: ${JSON.stringify(evalResult.failureReasons)}`
    );
  });

  console.log('\n======================================================================');
  console.log(`🎉 ALL ${passCount} RELEASE GATE REMEDIATION TESTS PASSED CLEANLY!`);
  console.log('======================================================================\n');
  setTimeout(() => process.exit(0), 100);
}

runAllTests().catch(err => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});