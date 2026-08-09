const { performance } = require('perf_hooks');
const { VALIDATOR_CONFIG } = require('../../config/validatorConfig');
const { runStructuralValidation } = require('./structuralValidator');
const { runGroundingValidation } = require('./groundingValidator');
const { runEducationalValidation } = require('./educationalValidator');

/**
 * 6. ORCHESTRATOR WITH TIMEOUT PROTECTION
 * Sequentially executes Gate 1 (Structural), Gate 2 (Grounding), and Evaluator 3 (Educational).
 * Hard-gated early returns on Gate 1/2 failure. Wrapped in a 500ms Promise.race timeout guard.
 */
async function validateMCQ(mcqItem, validationContext = {}) {
  const timeoutMs = validationContext.config?.TIMEOUT_MS || VALIDATOR_CONFIG.TIMEOUT_MS || 500;

  const validationPromise = (async () => {
    const trace = [];
    const start = performance.now();

    // Gate 1: Structural
    const structStart = performance.now();
    const structRes = runStructuralValidation(mcqItem, validationContext);
    const structTimeMs = Math.round(performance.now() - structStart);
    trace.push({ stage: "STRUCTURAL", passed: structRes.passed, durationMs: structTimeMs, code: structRes.code });

    if (!structRes.passed) {
      return buildReport({
        isValid: false,
        qualityScore: 0.0,
        repairRequired: true,
        failureStage: "STRUCTURAL",
        criticalFailures: [structRes.errorDetail],
        trace,
        metrics: { structTimeMs, groundingTimeMs: 0, educationalTimeMs: 0, totalValidationMs: structTimeMs }
      });
    }

    // Gate 2: Grounding
    const groundStart = performance.now();
    const groundRes = runGroundingValidation(mcqItem, validationContext);
    const groundingTimeMs = Math.round(performance.now() - groundStart);
    trace.push({ stage: "GROUNDING", passed: groundRes.passed, durationMs: groundingTimeMs, matchType: groundRes.matchType });

    if (!groundRes.passed) {
      return buildReport({
        isValid: false,
        qualityScore: 0.0,
        repairRequired: true,
        failureStage: "GROUNDING",
        criticalFailures: [groundRes.errorDetail],
        trace,
        metrics: { structTimeMs, groundingTimeMs, educationalTimeMs: 0, totalValidationMs: structTimeMs + groundingTimeMs }
      });
    }

    // Evaluator 3: Educational
    const eduStart = performance.now();
    const eduRes = runEducationalValidation(mcqItem, validationContext);
    const educationalTimeMs = Math.round(performance.now() - eduStart);
    trace.push({ stage: "EDUCATIONAL", passed: eduRes.passed, durationMs: educationalTimeMs, qualityScore: eduRes.qualityScore });

    const totalValidationMs = Math.round(performance.now() - start);

    return buildReport({
      validatorVersion: VALIDATOR_CONFIG.VERSIONS.VALIDATOR,
      pipelineVersion: VALIDATOR_CONFIG.VERSIONS.PIPELINE,
      isValid: eduRes.passed,
      qualityScore: eduRes.qualityScore,
      qualityBreakdown: eduRes.qualityBreakdown,
      repairRequired: !eduRes.passed,
      failureStage: eduRes.passed ? null : "EDUCATIONAL",
      repairHistory: mcqItem.repairHistory || [],
      validationTrace: trace,
      findings: {
        criticalFailures: eduRes.criticalFailures || [],
        majorWarnings: eduRes.majorWarnings || [],
        minorWarnings: eduRes.minorWarnings || []
      },
      metrics: { structTimeMs, groundingTimeMs, educationalTimeMs, totalValidationMs }
    });
  })();

  // Timeout Fallback (500ms)
  const timeoutPromise = new Promise((resolve) =>
    setTimeout(() => {
      resolve(buildReport({
        isValid: false,
        qualityScore: 0.0,
        repairRequired: false, // Skip repair on timeout to unblock pipeline
        failureStage: "TIMEOUT",
        criticalFailures: [VALIDATOR_CONFIG.CODES.VAL_000_TIMEOUT_EXCEEDED],
        findings: {
          criticalFailures: [VALIDATOR_CONFIG.CODES.VAL_000_TIMEOUT_EXCEEDED],
          majorWarnings: [],
          minorWarnings: []
        },
        metrics: { structTimeMs: 0, groundingTimeMs: 0, educationalTimeMs: 0, totalValidationMs: timeoutMs }
      }));
    }, timeoutMs)
  );

  return Promise.race([validationPromise, timeoutPromise]);
}

function buildReport(opts) {
  return {
    validatorVersion: opts.validatorVersion || VALIDATOR_CONFIG.VERSIONS.VALIDATOR,
    pipelineVersion: opts.pipelineVersion || VALIDATOR_CONFIG.VERSIONS.PIPELINE,
    isValid: !!opts.isValid,
    qualityScore: opts.qualityScore !== undefined ? opts.qualityScore : 0.0,
    qualityBreakdown: opts.qualityBreakdown || { structural: 0.0, grounding: 0.0, educational: 0.0 },
    repairRequired: !!opts.repairRequired,
    failureStage: opts.failureStage || null,
    repairHistory: opts.repairHistory || [],
    validationTrace: opts.trace || [],
    findings: opts.findings || {
      criticalFailures: opts.criticalFailures || [],
      majorWarnings: [],
      minorWarnings: []
    },
    metrics: opts.metrics || { totalValidationMs: 0 }
  };
}

module.exports = {
  validateMCQ
};
