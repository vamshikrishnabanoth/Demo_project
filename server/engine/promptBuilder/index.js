const { assembleSlotPayload } = require('./payloadAssembler');

/**
 * Public API: buildSlotPrompts(quizPlan, pipelineContext)
 * Constructs isolated, sentence/newline-snapped prompt payloads for every slot in quizPlan.
 */
function buildSlotPrompts(quizPlan = {}, pipelineContext = {}) {
  const slots = quizPlan.slots || [];
  
  const ctx = {
    ...pipelineContext,
    quizPlan
  };

  const promptPayloads = slots.map(slot => assembleSlotPayload(slot, ctx));

  return promptPayloads;
}

module.exports = {
  buildSlotPrompts
};
