const { performance } = require('perf_hooks');
const { VALIDATOR_CONFIG, ValidationAbortedError } = require('../../config/validatorConfig');
const { runStructuralValidation } = require('./structuralValidator');
const { runGroundingValidation } = require('./groundingValidator');
const { runEducationalValidation } = require('./educationalValidator');

function buildAbortedResult(version, mcqItem, terminationReason, timeoutMs) {
  return {
    validatorVersion: version,
    pipelineVersion: VALIDATOR_CONFIG.VERSIONS.PIPELINE,
    item: mcqItem,
    status: "ABORTED",
    terminationReason,
    isValid: false,
    qualityScore: 0.0,
    scores: { bloom: 0, distractors: 0, duplication: 0, ambiguity: 0 },
    repairRequired: false,
    repairHints: [],
    failureStage: VALIDATOR_CONFIG.FAILURE_STAGES.TIMEOUT,
    validationTrace: [
      {
        ...(mcqItem?.existingTraceMetadata || {}),
        validatorVersion: version,
        stage: "ORCHESTRATOR",
        status: "ABORTED",
        code: "VAL_000",
        durationMs: timeoutMs,
        diagnostics: {
          ...(mcqItem?.existingDiagnostics || {}),
          error: `${timeoutMs}ms validation timeout exceeded`
        }
      }
    ],
    findings: {
      criticalFailures: [VALIDATOR_CONFIG.CODES.VAL_000_TIMEOUT_EXCEEDED],
      majorWarnings: [],
      minorWarnings: []
    }
  };
}

/**
 * 5. METADATA-PRESERVING ORCHESTRATOR WITH TIMEOUT GUARD
 */
async function validateMCQWithTimeout(mcqItem, validationContext = {}) {
  const timeoutMs = validationContext.config?.TIMEOUT_MS || VALIDATOR_CONFIG.TIMEOUT_MS || 500;
  const version = VALIDATOR_CONFIG.VERSIONS.VALIDATOR;
  const controller = new AbortController();
  const { signal } = controller;

  let timer;

  const validationPromise = (async () => {
    try {
      const trace = [];
      const start = performance.now();

      // Gate 1: Structural
      const structRes = runStructuralValidation(mcqItem, validationContext, signal);
      trace.push({
        ...(mcqItem?.existingTraceMetadata || {}),
        validatorVersion: version,
        stage: "STRUCTURAL",
        status: structRes.passed ? "PASS" : "FAIL",
        code: structRes.code,
        durationMs: Math.round(performance.now() - start),
        diagnostics: {
          ...(mcqItem?.existingDiagnostics || {}),
          schemaValid: structRes.passed
        }
      });

      if (!structRes.passed) {
        return {
          validatorVersion: version,
          pipelineVersion: VALIDATOR_CONFIG.VERSIONS.PIPELINE,
          item: mcqItem,
          status: "FAILED",
          isValid: false,
          qualityScore: 0.0,
          scores: { bloom: 0, distractors: 0, duplication: 0, ambiguity: 0 },
          repairRequired: true,
          repairHints: [VALIDATOR_CONFIG.REPAIR_HINTS.FULL_REGENERATE],
          failureStage: VALIDATOR_CONFIG.FAILURE_STAGES.STRUCTURAL,
          validationTrace: trace,
          findings: { criticalFailures: [structRes.errorDetail], majorWarnings: [], minorWarnings: [] }
        };
      }

      // Gate 2: Grounding
      const groundStart = performance.now();
      const groundRes = runGroundingValidation(mcqItem, validationContext, signal);
      trace.push({
        ...(mcqItem?.existingTraceMetadata || {}),
        validatorVersion: version,
        stage: "GROUNDING",
        status: groundRes.passed ? "PASS" : "FAIL",
        code: groundRes.code,
        durationMs: Math.round(performance.now() - groundStart),
        diagnostics: {
          ...(mcqItem?.existingDiagnostics || {}),
          matchType: groundRes.matchType,
          repairedOffsets: !!groundRes.repairedOffsets
        }
      });

      if (!groundRes.passed) {
        return {
          validatorVersion: version,
          pipelineVersion: VALIDATOR_CONFIG.VERSIONS.PIPELINE,
          item: mcqItem,
          status: "FAILED",
          isValid: false,
          qualityScore: 0.0,
          scores: { bloom: 0, distractors: 0, duplication: 0, ambiguity: 0 },
          repairRequired: true,
          repairHints: [VALIDATOR_CONFIG.REPAIR_HINTS.FULL_REGENERATE],
          failureStage: VALIDATOR_CONFIG.FAILURE_STAGES.GROUNDING,
          validationTrace: trace,
          findings: { criticalFailures: [groundRes.errorDetail], majorWarnings: [], minorWarnings: [] }
        };
      }

      // Evaluator 3: Educational
      const eduStart = performance.now();
      const eduRes = await runEducationalValidation(mcqItem, validationContext, signal);
      trace.push({
        ...(mcqItem?.existingTraceMetadata || {}),
        validatorVersion: version,
        stage: "EDUCATIONAL",
        status: eduRes.passed ? "PASS" : "FAIL",
        code: eduRes.passed ? VALIDATOR_CONFIG.PASS_CODES.EDUCATIONAL : "EDU_WARN",
        durationMs: Math.round(performance.now() - eduStart),
        diagnostics: {
          ...(mcqItem?.existingDiagnostics || {}),
          qualityScore: eduRes.qualityScore,
          scores: eduRes.scores
        }
      });

      const updatedItem = groundRes.repairedOffsets ? {
        ...mcqItem,
        sourceEvidence: {
          ...(mcqItem?.sourceEvidence || {}),
          evidenceBounds: groundRes.repairedOffsets
        }
      } : mcqItem;

      return {
        validatorVersion: version,
        pipelineVersion: VALIDATOR_CONFIG.VERSIONS.PIPELINE,
        item: updatedItem,
        status: eduRes.passed ? "SUCCESS" : "REPAIR_REQUIRED",
        isValid: eduRes.passed,
        qualityScore: eduRes.qualityScore,
        qualityBreakdown: eduRes.qualityBreakdown || { structural: 1.0, grounding: 1.0, educational: eduRes.qualityScore },
        scores: eduRes.scores,
        repairRequired: !eduRes.passed,
        repairHints: eduRes.repairHints,
        failureStage: eduRes.passed ? null : VALIDATOR_CONFIG.FAILURE_STAGES.EDUCATIONAL,
        validationTrace: trace,
        findings: eduRes.findings,
        metrics: { totalValidationMs: Math.round(performance.now() - start) }
      };
    } finally {
      clearTimeout(timer);
    }
  })().catch(err => {
    if (err instanceof ValidationAbortedError || signal.aborted) {
      return buildAbortedResult(version, mcqItem, "TIMEOUT", timeoutMs);
    }
    throw err;
  });

  const timeoutPromise = new Promise((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(buildAbortedResult(version, mcqItem, "TIMEOUT", timeoutMs));
    }, timeoutMs);
  });

  return Promise.race([validationPromise, timeoutPromise]);
}

module.exports = {
  validateMCQWithTimeout,
  validateMCQ: validateMCQWithTimeout // Backward compatibility
};
