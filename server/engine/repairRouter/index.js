const { performance } = require('perf_hooks');
const { REPAIR_CONFIG } = require('../../config/repairConfig');
const { executeRepairCall } = require('./repairExecutor');
const { validateMCQWithTimeout } = require('../validators/validatorOrchestrator');

/**
 * 4. CONCURRENT REPAIR WORKER POOL & OBSERVABILITY METRICS
 */
async function processRepairQueue(repairQueue = [], pipelineContext = {}) {
  const startTime = performance.now();
  const concurrency = REPAIR_CONFIG.CONCURRENCY_LIMIT || 3;
  const approvedItems = [...(pipelineContext.approvedItems || [])];
  const discardedQueue = [...(pipelineContext.discardedQueue || [])];
  const repairedSummary = [];
  const discardReasons = {};

  const recordDiscard = (item, reason, details = {}) => {
    discardReasons[reason] = (discardReasons[reason] || 0) + 1;
    discardedQueue.push({ item, reason, ...details });
  };

  // Safe Atomic Task Queue Worker
  let nextIndex = 0;
  const getNextTask = () => {
    if (nextIndex >= repairQueue.length) return null;
    const currentIndex = nextIndex++;
    return { queueItem: repairQueue[currentIndex], index: currentIndex };
  };

  let totalTokensUsed = 0;
  let totalLatencySum = 0;

  const workers = Array.from({ length: Math.min(concurrency, Math.max(1, repairQueue.length)) }, async () => {
    let task;
    while ((task = getNextTask()) !== null) {
      const { queueItem } = task;
      const item = queueItem.item || queueItem;
      const hints = queueItem.repairHints || item.repairHints || [];
      const findings = queueItem.findings || item.findings || {};

      // Filter out FULL_REGENERATE or items exceeding max repair attempts
      const pastAttempts = (item.repairHistory || []).length;
      if (pastAttempts >= REPAIR_CONFIG.MAX_REPAIR_ATTEMPTS || hints.includes(REPAIR_CONFIG.HINTS.FULL_REGENERATE)) {
        const reason = hints.includes(REPAIR_CONFIG.HINTS.FULL_REGENERATE)
          ? "FULL_REGENERATE_REQUIRED"
          : "MAX_REPAIRS_EXCEEDED";
        recordDiscard(item, reason, { hints });
        continue;
      }

      try {
        // Step 1: Execute consolidated surgical repair LLM call
        const repairedCandidate = await executeRepairCall(item, hints, findings, pipelineContext);
        
        const latestHistory = repairedCandidate.repairHistory[repairedCandidate.repairHistory.length - 1];
        totalTokensUsed += latestHistory?.completionTokens || 0;
        totalLatencySum += latestHistory?.latencyMs || 0;

        // Step 2: Re-validate repaired candidate item through Stage 6
        const revalResult = await validateMCQWithTimeout(repairedCandidate, pipelineContext);

        if (revalResult.isValid) {
          // Attach qualityAfter to latest repair history entry
          latestHistory.qualityAfter = revalResult.qualityScore;
          approvedItems.push(revalResult.item);
          repairedSummary.push({
            slotId: item.slotId || 'unknown_slot',
            hints,
            qualityBefore: item.qualityScore || 0.0,
            qualityAfter: revalResult.qualityScore,
            status: "SUCCESS"
          });
        } else {
          recordDiscard(revalResult.item, "REVALIDATION_FAILED", {
            failureStage: revalResult.failureStage,
            findings: revalResult.findings
          });
        }
      } catch (err) {
        recordDiscard(item, "REPAIR_EXECUTION_ERROR", { error: err.message });
      }
    }
  });

  if (repairQueue.length > 0) {
    await Promise.all(workers);
  }

  const totalRepairTimeMs = Math.round(performance.now() - startTime);
  const totalQueued = repairQueue.length;
  const successfullyRepaired = repairedSummary.length;
  const repairSuccessRate = totalQueued > 0 ? Number((successfullyRepaired / totalQueued).toFixed(2)) : 0.0;
  const avgRepairLatencyMs = successfullyRepaired > 0 ? Math.round(totalLatencySum / successfullyRepaired) : 0;

  // Update pipelineContext property references directly
  pipelineContext.approvedItems = approvedItems;
  pipelineContext.discardedQueue = discardedQueue;

  return {
    repairRouterVersion: REPAIR_CONFIG.VERSION,
    batchSummary: {
      repairRouterVersion: REPAIR_CONFIG.VERSION,
      totalItemsQueued: totalQueued,
      successfullyRepaired,
      discardedCount: discardedQueue.length,
      repairSuccessRate,
      avgRepairLatencyMs,
      totalTokensUsed,
      discardReasons,
      totalRepairTimeMs
    },
    repairedSummary,
    discardedQueue
  };
}

module.exports = {
  processRepairQueue
};
