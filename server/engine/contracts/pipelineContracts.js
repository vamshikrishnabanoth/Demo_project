/**
 * Explicit Pipeline Contracts (v3.0.0)
 * Formal schemas, invariants, and fail-fast validation for Stages 1 through 9.
 */

const STAGE_CONTRACTS = {
  STAGE_1: {
    name: 'Ingestion & Noise Filtering',
    requiredInputs: ['cleanedContent'],
    invariants: (ctx) => typeof ctx.cleanedContent === 'string' && ctx.cleanedContent.length > 0,
    failureCode: 'CONTRACT_ERR_STAGE_1'
  },
  STAGE_1_5: {
    name: 'Canonical Document Profile',
    requiredInputs: ['cleanedContent'],
    invariants: (ctx) => ctx.documentProfile && Array.isArray(ctx.documentProfile.instructionalConcepts),
    failureCode: 'CONTRACT_ERR_STAGE_1_5'
  },
  STAGE_2: {
    name: 'Concept Graph Builder',
    requiredInputs: ['cleanedContent', 'documentProfile'],
    invariants: (ctx) => ctx.conceptGraph && Array.isArray(ctx.conceptGraph.nodes) && ctx.conceptGraph.nodes.length > 0,
    failureCode: 'CONTRACT_ERR_STAGE_2'
  },
  STAGE_3: {
    name: 'Adaptive Question Planner',
    requiredInputs: ['conceptGraph', 'documentProfile'],
    invariants: (ctx) => ctx.quizPlan && Array.isArray(ctx.quizPlan.slots) && ctx.quizPlan.slots.length > 0,
    failureCode: 'CONTRACT_ERR_STAGE_3'
  },
  STAGE_4: {
    name: 'Language-Agnostic Prompt Builder',
    requiredInputs: ['quizPlan', 'documentProfile'],
    invariants: (ctx) => Array.isArray(ctx.promptPayloads) && ctx.promptPayloads.length > 0,
    failureCode: 'CONTRACT_ERR_STAGE_4'
  },
  STAGE_5: {
    name: 'Grounded Question Generator',
    requiredInputs: ['promptPayloads'],
    invariants: (ctx) => Array.isArray(ctx.candidateItems) && ctx.candidateItems.length > 0,
    failureCode: 'CONTRACT_ERR_STAGE_5'
  },
  STAGE_6: {
    name: '3-Tier Validator Orchestrator',
    requiredInputs: ['candidateItems', 'pipelineContext'],
    invariants: (ctx) => ctx.pipelineContext && Array.isArray(ctx.pipelineContext.approvedItems),
    failureCode: 'CONTRACT_ERR_STAGE_6'
  },
  STAGE_7: {
    name: 'Targeted Repair Router',
    requiredInputs: ['repairQueue'],
    invariants: (ctx) => Array.isArray(ctx.repairQueue),
    failureCode: 'CONTRACT_ERR_STAGE_7'
  },
  STAGE_8: {
    name: 'Portfolio Assembly Engine',
    requiredInputs: ['approvedItems', 'quizPlan'],
    invariants: (ctx) => ctx.finalQuiz && Array.isArray(ctx.finalQuiz.questions),
    failureCode: 'CONTRACT_ERR_STAGE_8'
  },
  STAGE_9: {
    name: 'Portfolio-Level Reviewer',
    requiredInputs: ['finalQuiz'],
    invariants: (ctx) => ctx.portfolioReviewSummary && ctx.portfolioReviewSummary.approved === true,
    failureCode: 'CONTRACT_ERR_STAGE_9'
  }
};

function validateStageContract(stageKey, contextData) {
  const contract = STAGE_CONTRACTS[stageKey];
  if (!contract) return true;

  for (const inputKey of contract.requiredInputs) {
    if (contextData[inputKey] === undefined || contextData[inputKey] === null) {
      const err = new Error(`[PipelineContractViolation] ${contract.name} (${stageKey}) missing required input: '${inputKey}'`);
      err.code = contract.failureCode;
      throw err;
    }
  }

  if (contract.invariants && !contract.invariants(contextData)) {
    const err = new Error(`[PipelineContractViolation] ${contract.name} (${stageKey}) failed output invariants test.`);
    err.code = contract.failureCode;
    throw err;
  }

  return true;
}

module.exports = {
  STAGE_CONTRACTS,
  validateStageContract
};
