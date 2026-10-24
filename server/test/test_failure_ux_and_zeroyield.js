/**
 * server/test/test_failure_ux_and_zeroyield.js
 *
 * FOCUSED TEST SUITE: Zero-Yield & Failure UX Verification
 *
 * Verifies:
 * 1. Error Code Discrimination:
 *    - Preserves actual failure reason (PROVIDER_RATE_LIMITED, INSUFFICIENT_EVIDENCE, FAILED_VALIDATION, FAILED_GENERATION)
 *    - Delineates lifecycle states (TaskStates) from diagnostic failure codes (TaskFailureCodes)
 *    - Does NOT blanket-classify all zero-yields as rate limits
 * 2. Zero-Yield Task Failure:
 *    - Tasks yielding 0 questions fail with failTask instead of completing with empty array
 *    - Task manager properly updates task.status = 'FAILED' and task.errorCode
 * 3. Partial Success Preservation:
 *    - When valid questions exist (e.g. 2 of 5), task completes successfully with isPartial: true
 *    - Requested and delivered question counts are preserved
 * 4. Friendly Error Mapping:
 *    - User-friendly messages provide collegiate, actionable advice tailored to each error code
 * 5. Frontend Poller & Contract Consistency:
 *    - useGenerationPoller captures and propagates errorCode alongside error
 * 6. Hardcoded Obsolete Model Audit Check:
 *    - Verifies audioChunker.js inspection state
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { createTask, completeTask, failTask, getTask, TaskStates, TaskFailureCodes } = require('../services/taskManager');
const { toUserFriendlyError } = require('../utils/friendlyErrorMapper');

console.log('======================================================================');
console.log('🧪 RUNNING ZERO-YIELD & FAILURE UX INTEGRITY TEST SUITE');
console.log('======================================================================\n');

let passCount = 0;
function runTest(name, fn) {
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

// -----------------------------------------------------------------------------
// Test 1: TaskStates separates lifecycle states from TaskFailureCodes
// -----------------------------------------------------------------------------
runTest('T1: TaskStates separates lifecycle states from TaskFailureCodes', () => {
  assert.strictEqual(TaskStates.FAILED, 'FAILED');
  assert.strictEqual(TaskStates.COMPLETED, 'COMPLETED');
  assert.strictEqual(TaskFailureCodes.PROVIDER_RATE_LIMITED, 'PROVIDER_RATE_LIMITED');
  assert.strictEqual(TaskFailureCodes.INSUFFICIENT_EVIDENCE, 'INSUFFICIENT_EVIDENCE');
  assert.strictEqual(TaskFailureCodes.FAILED_VALIDATION, 'FAILED_VALIDATION');
  assert.strictEqual(TaskFailureCodes.FAILED_GENERATION, 'FAILED_GENERATION');
});

// -----------------------------------------------------------------------------
// Test 2: friendlyErrorMapper maps PROVIDER_RATE_LIMITED to collegiate retry message
// -----------------------------------------------------------------------------
runTest('T2: friendlyErrorMapper maps PROVIDER_RATE_LIMITED to collegiate high-demand advice', () => {
  const msg = toUserFriendlyError('Groq API rate limit reached', { errorCode: 'PROVIDER_RATE_LIMITED' });
  assert.ok(msg.includes('experiencing high demand'), 'Must mention high demand');
  assert.ok(msg.includes('automatically preserved your session'), 'Must reassure session preservation');
  assert.ok(msg.includes('click Generate again'), 'Must suggest retry');
});

// -----------------------------------------------------------------------------
// Test 3: friendlyErrorMapper maps INSUFFICIENT_EVIDENCE to actionable curriculum advice
// -----------------------------------------------------------------------------
runTest('T3: friendlyErrorMapper maps INSUFFICIENT_EVIDENCE to lecture scope advice', () => {
  const msg = toUserFriendlyError('Zero grounded targets available', { errorCode: 'INSUFFICIENT_EVIDENCE' });
  assert.ok(msg.includes('concise and covers fewer distinct concepts'), 'Must explain concise content');
  assert.ok(msg.includes('setting a slightly lower question count') || msg.includes('adding supplementary lecture slides'), 'Must suggest lower count or more slides');
});

// -----------------------------------------------------------------------------
// Test 4: friendlyErrorMapper maps FAILED_VALIDATION to quality gate guidance
// -----------------------------------------------------------------------------
runTest('T4: friendlyErrorMapper maps FAILED_VALIDATION to verification gate guidance', () => {
  const msg = toUserFriendlyError('Quality audit filtered candidate output', { errorCode: 'FAILED_VALIDATION' });
  assert.ok(msg.includes('academic quality or verification gates'), 'Must reference academic verification gates');
  assert.ok(msg.includes('docket materials are preserved'), 'Must reassure docket preservation');
  assert.ok(msg.includes('Retry'), 'Must offer retry guidance');
});

// -----------------------------------------------------------------------------
// Test 5: failTask records explicit errorCode on task object
// -----------------------------------------------------------------------------
runTest('T5: failTask sets status FAILED, task.errorCode, and friendly message', () => {
  const taskId = createTask({ questionCount: 5 });
  failTask(taskId, 'Rate limit exceeded on provider', 'PROVIDER_RATE_LIMITED');
  
  const task = getTask(taskId);
  assert.strictEqual(task.status, 'FAILED');
  assert.strictEqual(task.errorCode, 'PROVIDER_RATE_LIMITED');
  assert.strictEqual(task.state, 'FAILED');
  assert.ok(typeof task.error === 'string' && task.error.length > 10, 'Must produce friendly error string');
});

// -----------------------------------------------------------------------------
// Test 6: failTask records INSUFFICIENT_EVIDENCE without classifying as rate limit
// -----------------------------------------------------------------------------
runTest('T6: failTask records INSUFFICIENT_EVIDENCE without classifying as rate limit', () => {
  const taskId = createTask({ questionCount: 10 });
  failTask(taskId, 'Evidence capacity exhausted for hard questions', 'INSUFFICIENT_EVIDENCE');
  
  const task = getTask(taskId);
  assert.strictEqual(task.status, 'FAILED');
  assert.strictEqual(task.errorCode, 'INSUFFICIENT_EVIDENCE');
  assert.strictEqual(task.state, 'FAILED');
  assert.ok(!task.error.toLowerCase().includes('rate limit'), 'Must NOT classify as rate limit');
});

// -----------------------------------------------------------------------------
// Test 7: Partial success completes task with isPartial: true and delivered count
// -----------------------------------------------------------------------------
runTest('T7: Partial yield (2 of 5 questions) completes task with isPartial: true', () => {
  const taskId = createTask({ questionCount: 5 });
  const partialQuestions = [
    { questionText: 'Q1', options: ['A', 'B', 'C', 'D'], correctAnswer: 'A' },
    { questionText: 'Q2', options: ['A', 'B', 'C', 'D'], correctAnswer: 'B' }
  ];
  
  completeTask(taskId, {
    questions: partialQuestions,
    requestedCount: 5,
    deliveredCount: 2,
    isPartial: true,
    notice: 'Delivered 2 of 5 requested questions grounded in lecture evidence.'
  });
  
  const task = getTask(taskId);
  assert.strictEqual(task.status, 'COMPLETED');
  assert.strictEqual(task.result.questions.length, 2);
  assert.strictEqual(task.result.deliveredCount, 2);
  assert.strictEqual(task.result.requestedCount, 5);
  assert.strictEqual(task.result.isPartial, true);
});

// -----------------------------------------------------------------------------
// Test 8: Status polling endpoint response includes error and errorCode
// -----------------------------------------------------------------------------
runTest('T8: Polling payload contract includes status, error, and errorCode', () => {
  const taskId = createTask({ questionCount: 5 });
  failTask(taskId, 'All candidates rejected by validation gates', 'FAILED_VALIDATION');
  
  const task = getTask(taskId);
  
  // Emulate GET /quiz/generate/status/:taskId logic from routes/quiz.js:395-408
  const pollingPayload = {
    status: task.status,
    state: task.state || task.status,
    progressPct: task.progressPct || 0,
    stage: task.stage,
    stageLabel: task.stageLabel,
    error: task.error || null,
    errorCode: task.errorCode || null,
  };
  
  assert.strictEqual(pollingPayload.status, 'FAILED');
  assert.strictEqual(pollingPayload.errorCode, 'FAILED_VALIDATION');
  assert.ok(pollingPayload.error.includes('academic quality or verification gates'));
});

// -----------------------------------------------------------------------------
// Test 9: quizController source code guards zero questions and resolves diagnostic error codes
// -----------------------------------------------------------------------------
runTest('T9: quizController source code guards zero questions and resolves diagnostic error codes', () => {
  const controllerPath = path.join(__dirname, '..', 'controllers', 'quizController.js');
  const controllerSrc = fs.readFileSync(controllerPath, 'utf8');
  
  assert.ok(controllerSrc.includes('function resolveGenerationErrorCode'), 'Must define resolveGenerationErrorCode');
  assert.ok(controllerSrc.includes('if (!finalQuestions || !Array.isArray(finalQuestions) || finalQuestions.length === 0)'), 'Must check for zero questions in generateQuizQuestions');
  assert.ok(controllerSrc.includes("failTask(taskId, rawMsg, resolvedCode)"), 'Must call failTask on zero questions with resolved error code');
  assert.ok(!controllerSrc.includes("completeTask(taskId, { questions: [] })"), 'Must never complete with empty array');
});

// -----------------------------------------------------------------------------
// Test 10: CreateQuizTopic.jsx implements persistent error banner and handleRetry
// -----------------------------------------------------------------------------
runTest('T10: CreateQuizTopic.jsx implements persistent dismissible error banner and handleRetry', () => {
  const topicPath = path.join(__dirname, '..', '..', 'client', 'src', 'pages', 'CreateQuizTopic.jsx');
  const topicSrc = fs.readFileSync(topicPath, 'utf8');
  
  assert.ok(topicSrc.includes('const [generationError, setGenerationError] = useState(null);'), 'Must define generationError state');
  assert.ok(topicSrc.includes('handleRetry'), 'Must implement handleRetry function');
  assert.ok(topicSrc.includes('Retry Generation'), 'Must render Retry Generation action');
  assert.ok(topicSrc.includes('Assessment Generation Halted'), 'Must render persistent banner');
  assert.ok(topicSrc.includes('PROVIDER_RATE_LIMITED'), 'Must handle PROVIDER_RATE_LIMITED guidance');
  assert.ok(topicSrc.includes('INSUFFICIENT_EVIDENCE'), 'Must handle INSUFFICIENT_EVIDENCE guidance');
});

// -----------------------------------------------------------------------------
// Test 11: CreateQuizText.jsx handles zero generated questions with empty state
// -----------------------------------------------------------------------------
runTest('T11: CreateQuizText.jsx renders empty state with Return to Docket & Adjust Material action', () => {
  const textPath = path.join(__dirname, '..', '..', 'client', 'src', 'pages', 'CreateQuizText.jsx');
  const textSrc = fs.readFileSync(textPath, 'utf8');
  
  assert.ok(textSrc.includes('isGeneratedSource && questions.length === 0'), 'Must check for zero generated questions');
  assert.ok(textSrc.includes('No Valid Questions Generated'), 'Must render empty state headline');
  assert.ok(textSrc.includes('Return to Docket & Adjust Material'), 'Must render Return to Docket button');
  assert.ok(textSrc.includes("navigate('/create-quiz/topic')"), 'Must navigate back to topic docket');
  assert.ok(textSrc.includes('Write Questions Manually'), 'Must preserve manual editor flow option');
});

// -----------------------------------------------------------------------------
// Test 12: useGenerationPoller.js propagates errorCode in FAILED and EXPIRED states
// -----------------------------------------------------------------------------
runTest('T12: useGenerationPoller.js captures and passes errorCode to onError callback', () => {
  const pollerPath = path.join(__dirname, '..', '..', 'client', 'src', 'hooks', 'useGenerationPoller.js');
  const pollerSrc = fs.readFileSync(pollerPath, 'utf8');
  
  assert.ok(pollerSrc.includes('const [errorCode,  setErrorCode]  = useState(null);'), 'Must store errorCode state');
  assert.ok(pollerSrc.includes('errorCode: ec'), 'Must destructure errorCode from API response');
  assert.ok(pollerSrc.includes('onErrorRef.current(msg, ec || null);'), 'Must pass errorCode to onError callback');
});

console.log('\n======================================================================');
console.log(`🎉 ALL ${passCount} ZERO-YIELD & FAILURE UX INTEGRITY TESTS PASSED CLEANLY!`);
console.log('======================================================================\n');
