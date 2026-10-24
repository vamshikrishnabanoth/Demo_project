/**
 * server/utils/friendlyErrorMapper.js
 *
 * Translates low-level runtime errors, engine codes, and network exceptions
 * into clear, encouraging, collegiate, and actionable pedagogical messages for teachers.
 */

'use strict';

function toUserFriendlyError(rawError, context = {}) {
  if (!rawError) {
    return 'We encountered an unexpected issue while generating your quiz. Please try again in a few moments.';
  }

  const msg = typeof rawError === 'string' ? rawError : (rawError.message || String(rawError));
  const code = (rawError.code || rawError.errorCode || context.errorCode || '').toUpperCase();
  const lowerMsg = msg.toLowerCase();

  // 1. Network / Connection Fluctuations
  if (
    code.includes('ECONNRESET') ||
    code.includes('ETIMEDOUT') ||
    code.includes('ENOTFOUND') ||
    code.includes('EAI_AGAIN') ||
    lowerMsg.includes('econnreset') ||
    lowerMsg.includes('etimedout') ||
    lowerMsg.includes('socket hang up') ||
    lowerMsg.includes('network error') ||
    lowerMsg.includes('fetch failed') ||
    lowerMsg.includes('timeout of') ||
    lowerMsg.includes('client network socket disconnected')
  ) {
    return 'A temporary network fluctuation occurred while communicating with the AI service. Your lecture notes and docket items are safely preserved. Please click Retry to resume right where you left off.';
  }

  // 2. Rate Limiting / Provider Congestion
  if (
    code === 'RATE_LIMIT_EXCEEDED' ||
    code === 'PROVIDER_RATE_LIMITED' ||
    code === '429' ||
    lowerMsg.includes('rate limit') ||
    lowerMsg.includes('too many requests') ||
    lowerMsg.includes('quota exceeded') ||
    lowerMsg.includes('429')
  ) {
    return 'The AI reasoning service is currently experiencing high demand. We automatically preserved your session—please wait a few seconds and click Generate again.';
  }

  // 3. Insufficient Curricular Evidence / Targets
  if (
    code === 'INSUFFICIENT_CURRICULAR_TARGETS' ||
    code === 'INSUFFICIENT_READABLE_EVIDENCE' ||
    code === 'INSUFFICIENT_EVIDENCE' ||
    lowerMsg.includes('insufficient_curricular_targets') ||
    lowerMsg.includes('insufficient_readable_evidence') ||
    lowerMsg.includes('insufficient evidence') ||
    lowerMsg.includes('no instructional content') ||
    lowerMsg.includes('contains no assessable instructional content')
  ) {
    return 'The provided lecture material is concise and covers fewer distinct concepts than the requested question count. We suggest setting a slightly lower question count or adding supplementary lecture slides to your docket.';
  }

  // 4. Pedagogical Boundary Invariants (e.g. Teacher excluded code)
  if (
    code === 'TEACHER_BOUNDARY_VIOLATION' ||
    lowerMsg.includes('teacher_boundary_violation') ||
    lowerMsg.includes('code syntax generated despite explicit no_code')
  ) {
    return 'The assessment generator strictly upheld your pedagogical constraint to exclude programming code or syntax. We refreshed the questions to focus purely on conceptual principles.';
  }

  // 5. Ungrounded Relational Inferences
  if (
    code === 'UNGROUNDED_RELATIONAL_CLAIM' ||
    code === 'GROUNDING_GATE_FAILURE' ||
    lowerMsg.includes('ungrounded_relational_claim') ||
    lowerMsg.includes('grounding gate')
  ) {
    return 'Our curriculum grounding engine filtered out unverified assertions to ensure 100% factual accuracy against your teaching notes. Please retry generation to draw from verified lecture sections.';
  }

  // 5b. Quality Audit & Validation Gates
  if (
    code === 'FAILED_VALIDATION'
  ) {
    return 'Generated candidate questions did not meet academic quality or verification gates. Your docket materials are preserved—please click Retry to generate a new candidate set.';
  }

  // 6. Inaudible or Empty Speech
  if (
    lowerMsg.includes('intelligible speech') ||
    lowerMsg.includes('clear speech') ||
    lowerMsg.includes('audio is silent') ||
    lowerMsg.includes('speaking closer to the mic')
  ) {
    return 'We could not detect clear instructional speech in this recording. Please ensure your microphone is selected properly or upload an audio file containing audible lecture explanations.';
  }

  // 7. Non-Academic / Entertainment / Banter Filters
  if (
    code === 'NON_ACADEMIC_CONTENT' ||
    lowerMsg.includes('conversational chatter') ||
    lowerMsg.includes('non-academic') ||
    lowerMsg.includes('youtube banter') ||
    lowerMsg.includes('unboxing')
  ) {
    return 'The uploaded recording appears to be informal conversation or general media rather than an academic lecture. Please upload course materials, classroom recordings, or textbook excerpts.';
  }

  // 8. Raw Javascript Runtime Crashes (e.g. "Cannot read properties of undefined")
  if (
    lowerMsg.includes('cannot read properties') ||
    lowerMsg.includes('cannot read property') ||
    lowerMsg.includes('is not a function') ||
    lowerMsg.includes('unexpected token') ||
    lowerMsg.includes('pipeline error')
  ) {
    return 'We encountered a minor formatting irregularity while assembling the final questions. Your docket items are fully preserved—please click Generate again to complete generation.';
  }

  // Return the original message if it is already human-friendly, clean of stack traces
  const cleanMsg = msg.replace(/at\s+[\w\d_./\\-]+\s+\(.*\)/g, '').trim();
  return cleanMsg || 'We were unable to complete quiz generation at this time. Please retry in a few moments.';
}

module.exports = {
  toUserFriendlyError
};
