/**
 * server/engine/validators/verificationRecordGate.js
 *
 * Verification Record Integrity Gate (Phase 3).
 * Enforces strict factual, relational, mathematical, and trace verification:
 * 1. Checks schema presence & distractor rationales completeness (all 3 distractors).
 * 2. Invariant: Correct answer slot NEVER receives a distractor rationale.
 * 3. Invariant: byLetter alignment must accurately match current options permutation.
 * 4. Factual grounding: factualBasis verified against session evidence; rejects contradictions.
 * 5. Deterministic verification:
 *    - QUICK_CALCULATION: verified via calculationEngine (allowlisted parser, zero eval).
 *    - MICRO_TRACE: verified via microTraceVerifier (pure JS state simulation).
 *    - Other archetypes: marked VERIFICATION_UNSUPPORTED (never falsely certified).
 */

'use strict';

const calculationEngine = require('./calculationEngine');
const microTraceVerifier = require('./microTraceVerifier');
const groundingGate = require('./groundingGate');

const VERIFICATION_STATUSES = {
  MODEL_ASSERTED: 'MODEL_ASSERTED',
  DETERMINISTIC_VERIFIED: 'DETERMINISTIC_VERIFIED',
  VERIFICATION_FAILED: 'VERIFICATION_FAILED',
  VERIFICATION_UNSUPPORTED: 'VERIFICATION_UNSUPPORTED',
  VERIFICATION_MALFORMED: 'VERIFICATION_MALFORMED'
};

class VerificationRecordGate {
  constructor() {
    this.STATUSES = VERIFICATION_STATUSES;
    this.calcEngine = calculationEngine;
    this.traceVerifier = microTraceVerifier;
    this.groundingGate = groundingGate;
  }

  /**
   * Verify candidate MCQ's verificationRecord and underlying reasoning claims.
   *
   * @param {Object} mcq - Candidate MCQ
   * @param {Object} [target={}] - Target metadata from Agent 1
   * @param {Object} [evidencePackage={}] - Session evidence package
   * @returns {Object} { status, verifiedProgrammatically, reason, details }
   */
  verify(mcq, target = {}, evidencePackage = {}) {
    if (!mcq || typeof mcq !== 'object') {
      return {
        status: VERIFICATION_STATUSES.VERIFICATION_FAILED,
        verifiedProgrammatically: false,
        reason: 'Candidate MCQ is null or non-object'
      };
    }

    const vRecord = mcq.verificationRecord;
    if (!vRecord || typeof vRecord !== 'object') {
      return {
        status: VERIFICATION_STATUSES.VERIFICATION_MALFORMED,
        verifiedProgrammatically: false,
        reason: 'Missing verificationRecord object in candidate MCQ'
      };
    }

    const options = Array.isArray(mcq.options) ? mcq.options : [];
    const correctAnswer = String(mcq.correctAnswer || '').trim();
    const distractors = options.filter(o => o.trim() !== correctAnswer);

    // ─────────────────────────────────────────────────────────────────────────
    // 1. Distractor Rationales Completeness & Exclusion of Correct Answer
    // ─────────────────────────────────────────────────────────────────────────
    const rationales = vRecord.distractorRationales;
    if (!rationales || typeof rationales !== 'object') {
      return {
        status: VERIFICATION_STATUSES.VERIFICATION_MALFORMED,
        verifiedProgrammatically: false,
        reason: 'Missing distractorRationales in verificationRecord'
      };
    }

    if (rationales[correctAnswer] !== undefined) {
      return {
        status: VERIFICATION_STATUSES.VERIFICATION_FAILED,
        verifiedProgrammatically: false,
        reason: `Correct answer "${correctAnswer}" must never receive a distractor rationale`
      };
    }

    for (const d of distractors) {
      const rat = rationales[d] ||
        Object.entries(rationales).find(([k]) => k.trim().toLowerCase() === d.trim().toLowerCase())?.[1];
      if (!rat || typeof rat !== 'string' || rat.trim().length < 5) {
        return {
          status: VERIFICATION_STATUSES.VERIFICATION_MALFORMED,
          verifiedProgrammatically: false,
          reason: `Missing substantive distractor rationale for non-key option "${d}"`
        };
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. byLetter Synchronization Check
    // ─────────────────────────────────────────────────────────────────────────
    const KEYS = ['A', 'B', 'C', 'D'];
    if (vRecord.byLetter && typeof vRecord.byLetter === 'object') {
      for (let i = 0; i < options.length; i++) {
        const letter = KEYS[i];
        const opt = options[i];
        if (opt.trim() === correctAnswer) {
          if (vRecord.byLetter[letter] !== undefined) {
            return {
              status: VERIFICATION_STATUSES.VERIFICATION_FAILED,
              verifiedProgrammatically: false,
              reason: `Presentation slot ${letter} holds the correct answer but contains a distractor rationale`
            };
          }
        } else {
          const expectedRat = rationales[opt] ||
            Object.entries(rationales).find(([k]) => k.trim().toLowerCase() === opt.trim().toLowerCase())?.[1];
          if (vRecord.byLetter[letter] !== expectedRat) {
            return {
              status: VERIFICATION_STATUSES.VERIFICATION_FAILED,
              verifiedProgrammatically: false,
              reason: `Presentation slot ${letter} distractor rationale desynchronized from option "${opt}"`
            };
          }
        }
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. Factual Basis & Grounding Non-Contradiction Check
    // ─────────────────────────────────────────────────────────────────────────
    const factualBasis = vRecord.factualBasis;
    if (typeof factualBasis !== 'string' || factualBasis.trim().length < 15) {
      return {
        status: VERIFICATION_STATUSES.VERIFICATION_MALFORMED,
        verifiedProgrammatically: false,
        reason: 'factualBasis is missing or too short (min 15 characters required)'
      };
    }

    const rawEvidence = typeof evidencePackage === 'string'
      ? evidencePackage
      : (evidencePackage?.unifiedRawContent || evidencePackage?.curricularContent || '');

    // Mutual exclusion / factual contradiction check
    const MUTUALLY_EXCLUSIVE_PAIRS = [
      ['fifo', 'lifo'],
      ['first-in first-out', 'last-in first-out'],
      ['preemptive', 'non-preemptive'],
      ['contiguous', 'non-contiguous'],
      ['synchronous', 'asynchronous'],
      ['deterministic', 'non-deterministic'],
      ['static', 'dynamic'],
      ['linear', 'non-linear'],
      ['mutable', 'immutable'],
      ['0-indexed', '1-indexed'],
      ['zero-indexed', 'one-indexed']
    ];

    const fLower = factualBasis.toLowerCase();
    const eLower = String(rawEvidence || '').toLowerCase();
    for (const [termA, termB] of MUTUALLY_EXCLUSIVE_PAIRS) {
      if ((fLower.includes(termA) && eLower.includes(termB)) || (fLower.includes(termB) && eLower.includes(termA))) {
        const asserted = fLower.includes(termA) ? termA : termB;
        const expected = asserted === termA ? termB : termA;
        return {
          status: VERIFICATION_STATUSES.VERIFICATION_FAILED,
          verifiedProgrammatically: false,
          reason: `Factual basis contradicts session evidence: asserted "${asserted}", but session evidence states "${expected}"`
        };
      }
    }

    const isTopicMode = target.isTopicMode || evidencePackage?.inputModality === 'TOPIC_SYNTHESIS' || evidencePackage?.topic;

    // Reject missing evidence when evidence package is provided in evidence-based mode
    if (!isTopicMode && evidencePackage && typeof evidencePackage === 'object' && Object.keys(evidencePackage).length > 0 && !rawEvidence) {
      return {
        status: VERIFICATION_STATUSES.VERIFICATION_FAILED,
        verifiedProgrammatically: false,
        reason: 'Factual grounding cannot be verified: session evidence is missing or empty'
      };
    }

    if (rawEvidence && rawEvidence.length > 15) {
      // Substantive keyword presence: factualBasis cannot be pure generic boilerplate
      const fWords = factualBasis.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 3);
      const eLower = rawEvidence.toLowerCase();
      const GENERIC_BOILERPLATE = new Set(['this', 'that', 'concept', 'statement', 'question', 'standard', 'academic', 'taught', 'course', 'curriculum', 'lecture', 'material']);
      const substantiveFWords = fWords.filter(w => !GENERIC_BOILERPLATE.has(w));
      const hasSubstantiveOverlap = substantiveFWords.some(w => eLower.includes(w));

      if (substantiveFWords.length > 0 && !hasSubstantiveOverlap) {
        return {
          status: VERIFICATION_STATUSES.VERIFICATION_FAILED,
          verifiedProgrammatically: false,
          reason: 'Factual basis fails grounding: zero substantive keyword overlap with session evidence'
        };
      }

      if (this.groundingGate && typeof this.groundingGate._checkJustification === 'function') {
        const gateCheck = this.groundingGate._checkJustification(
          mcq.questionText || '',
          factualBasis,
          rawEvidence,
          mcq,
          evidencePackage
        );
        if (!gateCheck.isJustified) {
          const isFatalUngrounded = gateCheck.reason.includes('FACTUAL_CONTRADICTION') ||
            gateCheck.reason.includes('FOREIGN_TOPIC_CONTAMINATION') ||
            gateCheck.reason.includes('ZERO_SESSION_OVERLAP') ||
            gateCheck.reason.includes('ZERO_SUBSTANTIVE_OVERLAP');
          if (isFatalUngrounded) {
            return {
              status: VERIFICATION_STATUSES.VERIFICATION_FAILED,
              verifiedProgrammatically: false,
              reason: `Factual basis fails grounding verification: ${gateCheck.reason}`
            };
          }
        }
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. Archetype-Specific Deterministic Sandbox Verification
    // ─────────────────────────────────────────────────────────────────────────
    const arch = target.targetArchetype || mcq.questionArchetype;

    if (arch === 'QUICK_CALCULATION') {
      const calcRes = this.calcEngine.verifyCalculation(mcq, target);
      if (calcRes.status === 'VERIFICATION_FAILED') {
        return {
          status: VERIFICATION_STATUSES.VERIFICATION_FAILED,
          verifiedProgrammatically: false,
          reason: calcRes.reason,
          details: calcRes
        };
      }
      if (calcRes.status === 'DETERMINISTIC_VERIFIED') {
        return {
          status: VERIFICATION_STATUSES.DETERMINISTIC_VERIFIED,
          verifiedProgrammatically: true,
          method: 'CALCULATION_ENGINE',
          details: calcRes
        };
      }
      return {
        status: VERIFICATION_STATUSES.VERIFICATION_UNSUPPORTED,
        verifiedProgrammatically: false,
        reason: calcRes.reason || 'Calculation formula could not be parsed by allowlisted grammar'
      };
    }

    if (arch === 'MICRO_TRACE') {
      const traceRes = this.traceVerifier.verifyTrace(mcq, target);
      if (traceRes.status === 'VERIFICATION_FAILED') {
        return {
          status: VERIFICATION_STATUSES.VERIFICATION_FAILED,
          verifiedProgrammatically: false,
          reason: traceRes.reason,
          details: traceRes
        };
      }
      if (traceRes.status === 'DETERMINISTIC_VERIFIED') {
        return {
          status: VERIFICATION_STATUSES.DETERMINISTIC_VERIFIED,
          verifiedProgrammatically: true,
          method: 'MICRO_TRACE_VERIFIER',
          details: traceRes
        };
      }
      return {
        status: VERIFICATION_STATUSES.VERIFICATION_UNSUPPORTED,
        verifiedProgrammatically: false,
        reason: traceRes.reason || 'Code trace pattern not in recognized deterministic micro-trace subset'
      };
    }

    // Safeguard B: Do NOT falsely verify unsimulated archetypes
    // (CONCEPTUAL_CONTRAST, WHAT_IF_MUTATION, CLI_TERMINAL_IMPACT, DIAGNOSTIC_BUG_HUNT)
    return {
      status: VERIFICATION_STATUSES.VERIFICATION_UNSUPPORTED,
      verifiedProgrammatically: false,
      reason: `Archetype "${arch || 'UNSPECIFIED'}" requires qualitative academic review; deterministic simulation not supported`
    };
  }
}

module.exports = new VerificationRecordGate();
module.exports.VerificationRecordGate = VerificationRecordGate;
module.exports.VERIFICATION_STATUSES = VERIFICATION_STATUSES;
