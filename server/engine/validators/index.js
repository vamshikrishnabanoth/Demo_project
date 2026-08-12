const { performance } = require('perf_hooks');
const { VALIDATOR_CONFIG } = require('../../config/validatorConfig');
const { validateMCQWithTimeout } = require('./validatorOrchestrator');
const { runStructuralValidation } = require('./structuralValidator');
const { runGroundingValidation } = require('./groundingValidator');
const { runEducationalValidation } = require('./educationalValidator');
const { createValidationContext } = require('./validationContext');

/**
 * 6. EXPLICIT PIPELINE CONTEXT WRITING & BATCH VALIDATOR
 */
async function validateCandidateBatch(candidateItems = [], pipelineContext = {}) {
  const startTime = performance.now();
  const effectiveConcurrency = pipelineContext.config?.CONCURRENCY_LIMIT ?? VALIDATOR_CONFIG.CONCURRENCY_LIMIT;
  const results = new Array(candidateItems.length);
  
  let nextIndex = 0;
  const getNextItem = () => {
    if (nextIndex >= candidateItems.length) return null;
    const currentIndex = nextIndex++;
    return { item: candidateItems[currentIndex], index: currentIndex };
  };

  const workers = Array.from({ length: Math.min(effectiveConcurrency, Math.max(1, candidateItems.length)) }, async () => {
    let task;
    while ((task = getNextItem()) !== null) {
      try {
        results[task.index] = await validateMCQWithTimeout(task.item, pipelineContext);
      } catch (err) {
        console.error("VALIDATOR EXCEPTION:", err);
        results[task.index] = {
          validatorVersion: VALIDATOR_CONFIG.VERSIONS.VALIDATOR,
          pipelineVersion: VALIDATOR_CONFIG.VERSIONS.PIPELINE,
          item: task.item,
          status: "FAILED",
          isValid: false,
          qualityScore: 0.0,
          scores: { bloom: 0, distractors: 0, duplication: 0, ambiguity: 0 },
          repairRequired: false,
          repairHints: [],
          failureStage: VALIDATOR_CONFIG.FAILURE_STAGES.INTERNAL_ERROR,
          validationTrace: [
            {
              ...(task.item?.existingTraceMetadata || {}),
              validatorVersion: VALIDATOR_CONFIG.VERSIONS.VALIDATOR,
              stage: "WORKER",
              status: "FAILED",
              code: VALIDATOR_CONFIG.CODES.VAL_500_INTERNAL_FAILURE.code,
              durationMs: 0,
              diagnostics: {
                ...(task.item?.existingDiagnostics || {}),
                errorType: err.name || "Error",
                message: err.message || "Internal validation exception",
                slotId: task.item?.slotId || "unknown_slot"
              }
            }
          ],
          findings: {
            criticalFailures: [{
              code: VALIDATOR_CONFIG.CODES.VAL_500_INTERNAL_FAILURE.code,
              message: err.message || "Internal validation exception",
              stack: process.env.NODE_ENV === "development" ? err.stack : undefined
            }],
            majorWarnings: [],
            minorWarnings: []
          }
        };
      }
    }
  });

  if (candidateItems.length > 0) {
    await Promise.all(workers);
  }

  const approvedItems = results.filter(r => r && r.isValid).map(r => r.item);
  const repairQueue = results.filter(r => r && r.repairRequired);
  const hardGateFailures = results.filter(r =>
    r && (
      r.failureStage === VALIDATOR_CONFIG.FAILURE_STAGES.STRUCTURAL ||
      r.failureStage === VALIDATOR_CONFIG.FAILURE_STAGES.GROUNDING
    )
  ).length;

  const totalValidationTimeMs = Math.round(performance.now() - startTime);
  const avgQuality = Number((results.reduce((acc, r) => acc + ((r && r.qualityScore) || 0), 0) / Math.max(1, results.length)).toFixed(2));

  // Explicitly update pipelineContext without replacing the reference
  pipelineContext.validatedItems = results;
  pipelineContext.approvedItems = approvedItems;
  pipelineContext.repairQueue = repairQueue;

  return {
    validatorVersion: VALIDATOR_CONFIG.VERSIONS.VALIDATOR,
    pipelineVersion: VALIDATOR_CONFIG.VERSIONS.PIPELINE,
    batchSummary: {
      validatorVersion: VALIDATOR_CONFIG.VERSIONS.VALIDATOR,
      pipelineVersion: VALIDATOR_CONFIG.VERSIONS.PIPELINE,
      totalCandidatesEvaluated: candidateItems.length,
      approvedCount: approvedItems.length,
      repairRequiredCount: repairQueue.length,
      hardGateFailures,
      averageQualityScore: avgQuality,
      totalValidationTimeMs
    },
    validatedItems: results,
    approvedItems,
    repairQueue
  };
}

module.exports = {
  validateCandidateBatch,
  validateMCQ: validateMCQWithTimeout,
  validateMCQWithTimeout,
  runStructuralValidation,
  runGroundingValidation,
  runEducationalValidation,
  createValidationContext
};
