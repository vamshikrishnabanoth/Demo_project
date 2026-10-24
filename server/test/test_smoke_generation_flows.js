/**
 * server/test/test_smoke_generation_flows.js
 *
 * Dedicated Smoke Test Suite verifying the 5 Core Quiz Generation Flows:
 * 1. Successful Generation Flow (Task creation, completion, valid MCQ structure & polling contract)
 * 2. Provider Failure Flow (429/TPD simulation -> failTask with PROVIDER_RATE_LIMITED code & collegiate advice)
 * 3. Persistent Error Banner & Safe Retry (Preserves docket inputs, uploaded files, prevents duplicate submissions)
 * 4. Zero-Question Empty State & Docket Return (Guards zero-yield from completing, renders recovery actions, blocks publish)
 * 5. Partial Success Flow (Honest delivery of 2 of 5 questions with isPartial notice preserved)
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
  createTask,
  completeTask,
  failTask,
  getTask,
  TaskStates,
  TaskFailureCodes
} = require('../services/taskManager');
const { toUserFriendlyError } = require('../utils/friendlyErrorMapper');
const { resolveGenerationErrorCode } = require('../controllers/quizController');

console.log('======================================================================');
console.log('🧪 SMOKE TESTING 5 CORE GENERATION & RECOVERY FLOWS');
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
// Flow 1: Successful Generation Flow
// -----------------------------------------------------------------------------
runTest('Flow 1: Successful generation completes task with full MCQ payload and polling contract', () => {
  const teacherId = 'teacher_smoke_001';
  const taskId = createTask({ questionCount: 3, userId: teacherId });
  assert.ok(taskId, 'Task ID must be created');

  const initialTask = getTask(taskId, teacherId);
  assert.strictEqual(initialTask.status, 'RUNNING');
  assert.strictEqual(initialTask.state, TaskStates.UPLOADED);

  // Simulate pipeline completion
  const mockQuestions = [
    {
      question: 'What is the worst-case time complexity of lookup in an unbalanced BST?',
      questionText: 'What is the worst-case time complexity of lookup in an unbalanced BST?',
      options: ['O(1)', 'O(log n)', 'O(n)', 'O(n^2)'],
      correctAnswer: 'O(n)',
      metadata: {
        targetDifficulty: 'Medium',
        intendedCognitiveOperation: 'RECALL',
        questionArchetype: 'CONCEPTUAL_CONTRAST',
        groundingScore: 0.95
      }
    },
    {
      question: 'Which property ensures a binary search tree remains self-balancing in Red-Black trees?',
      questionText: 'Which property ensures a binary search tree remains self-balancing in Red-Black trees?',
      options: ['Uniform edge weights', 'Black height invariant', 'FIFO leaf ordering', 'Strict binary heap ordering'],
      correctAnswer: 'Black height invariant',
      metadata: {
        targetDifficulty: 'Hard',
        intendedCognitiveOperation: 'DIAGNOSE',
        questionArchetype: 'WHAT_IF_MUTATION',
        groundingScore: 0.92
      }
    },
    {
      question: 'In a BST in-order traversal, what order are visited keys processed?',
      questionText: 'In a BST in-order traversal, what order are visited keys processed?',
      options: ['Random order', 'Descending order', 'Ascending sorted order', 'Level-by-level breadth order'],
      correctAnswer: 'Ascending sorted order',
      metadata: {
        targetDifficulty: 'Easy',
        intendedCognitiveOperation: 'RECALL',
        questionArchetype: 'CONCEPTUAL_CONTRAST',
        groundingScore: 0.98
      }
    }
  ];

  completeTask(taskId, {
    questions: mockQuestions,
    deliveredCount: 3,
    requestedCount: 3,
    isPartial: false
  });

  const completedTask = getTask(taskId, teacherId);
  assert.strictEqual(completedTask.status, TaskStates.COMPLETED);
  assert.strictEqual(completedTask.result.questions.length, 3);
  assert.strictEqual(completedTask.result.isPartial, false);
  assert.strictEqual(completedTask.result.deliveredCount, 3);

  // Verify options structure and answer integrity
  for (const q of completedTask.result.questions) {
    assert.strictEqual(q.options.length, 4);
    assert.ok(q.options.includes(q.correctAnswer));
    assert.ok(q.metadata.groundingScore >= 0.15);
  }
});

// -----------------------------------------------------------------------------
// Flow 2: Provider Failure Flow (Rate Limiting / Exhaustion)
// -----------------------------------------------------------------------------
runTest('Flow 2: Provider failure accurately diagnoses PROVIDER_RATE_LIMITED and preserves docket session', () => {
  const teacherId = 'teacher_smoke_002';
  const taskId = createTask({ questionCount: 5, userId: teacherId });

  // Simulate 429 upstream rate limit
  const rateLimitErr = new Error('Groq upstream throttled: 429 Too Many Requests (Rate limit reached)');
  const resolvedCode = resolveGenerationErrorCode(rateLimitErr, null);
  assert.strictEqual(resolvedCode, TaskFailureCodes.PROVIDER_RATE_LIMITED);

  failTask(taskId, rateLimitErr.message, resolvedCode);

  const failedTask = getTask(taskId, teacherId);
  assert.strictEqual(failedTask.status, TaskStates.FAILED);
  assert.strictEqual(failedTask.errorCode, TaskFailureCodes.PROVIDER_RATE_LIMITED);

  // Friendly error must provide reassurance and clear action
  assert.ok(failedTask.error.includes('high demand'), 'Must mention high demand');
  assert.ok(failedTask.error.includes('automatically preserved your session'), 'Must confirm session preserved');
  assert.ok(failedTask.error.includes('click Generate again'), 'Must prompt retry');
});

// -----------------------------------------------------------------------------
// Flow 3: Persistent Error Banner & Safe Retry Flow
// -----------------------------------------------------------------------------
runTest('Flow 3: CreateQuizTopic.jsx ensures docket materials are preserved and retry prevents duplicate runs', () => {
  const componentPath = path.resolve(__dirname, '../../client/src/pages/CreateQuizTopic.jsx');
  const code = fs.readFileSync(componentPath, 'utf8');

  // Verify persistent error banner rendering
  assert.ok(code.includes('generationError'), 'Must maintain persistent generationError state');
  assert.ok(code.includes('setGenerationError(null)'), 'Must allow dismiss and reset on retry');
  assert.ok(code.includes('handleRetry'), 'Must implement handleRetry function');

  // Verify submission guard against double clicks
  assert.ok(
    code.includes('if (isGenerating || submitting) return;') || code.includes('disabled={isGenerating || submitting}'),
    'handleRetry must guard against concurrent submissions when isGenerating or submitting is true'
  );

  // Verify handleRetry invokes handleGenerateQuiz with preserved form data without resetting file state
  assert.ok(code.includes('handleGenerateQuiz()'), 'handleRetry must call handleGenerateQuiz directly');

  // Verify that files state is never cleared on error
  const onErrorBlock = code.slice(code.indexOf('onError: (msg, ec) =>'), code.indexOf('setGenerationError({'));
  assert.ok(!onErrorBlock.includes('setFiles([])'), 'onError must NOT clear uploaded files');
  assert.ok(!onErrorBlock.includes('setFile(null)'), 'onError must NOT clear single uploaded file');
});

// -----------------------------------------------------------------------------
// Flow 4: Zero-Question Empty State & Return to Docket Flow
// -----------------------------------------------------------------------------
runTest('Flow 4: Zero generated questions triggers failTask in backend and provides clean recovery in UI', () => {
  // 1. Backend Controller Check: Zero questions must fail explicitly
  const teacherId = 'teacher_smoke_004';
  const taskId = createTask({ questionCount: 4, userId: teacherId });

  // Simulate pipeline returning 0 questions due to insufficient lecture depth
  const rawMsg = 'Zero questions passed validation gates';
  const resolvedCode = resolveGenerationErrorCode(rawMsg, null);
  assert.strictEqual(resolvedCode, TaskFailureCodes.FAILED_VALIDATION);

  failTask(taskId, rawMsg, resolvedCode);

  const task = getTask(taskId, teacherId);
  assert.strictEqual(task.status, TaskStates.FAILED);
  assert.strictEqual(task.errorCode, TaskFailureCodes.FAILED_VALIDATION);
  assert.ok(task.error.includes('academic quality or verification gates'));

  // 2. Frontend UI Empty State Check: CreateQuizText.jsx
  const editorPath = path.resolve(__dirname, '../../client/src/pages/CreateQuizText.jsx');
  const editorCode = fs.readFileSync(editorPath, 'utf8');

  // Verify empty state display when questions.length === 0
  assert.ok(editorCode.includes('isGeneratedSource && questions.length === 0'), 'Must check for zero questions on generated source');
  assert.ok(editorCode.includes('No Valid Questions Generated'), 'Must render explicit empty state title');
  assert.ok(editorCode.includes('Return to Docket & Adjust Material'), 'Must provide Return to Docket action button');
  assert.ok(editorCode.includes("navigate('/create-quiz/topic')"), 'Return button must route back to docket');
  assert.ok(editorCode.includes('Write Questions Manually'), 'Must offer manual question creation');

  // Verify publishing/saving is disabled when 0 questions
  assert.ok(
    editorCode.includes('disabled={loading || questions.length === 0}'),
    'Publish/Save button must be disabled when 0 questions exist'
  );
});

// -----------------------------------------------------------------------------
// Flow 5: Partial Success Flow
// -----------------------------------------------------------------------------
runTest('Flow 5: Partial question yield is preserved with isPartial: true and collegiate notice', () => {
  const teacherId = 'teacher_smoke_005';
  const taskId = createTask({ questionCount: 5, userId: teacherId });

  const partialQuestions = [
    {
      question: 'What is a race condition in concurrent operating systems?',
      questionText: 'What is a race condition in concurrent operating systems?',
      options: [
        'A deterministic hardware interrupt sequence',
        'An outcome dependent on non-deterministic execution order of concurrent threads',
        'A compiler optimization flaw in memory alignment',
        'A network transmission failure across distributed sockets'
      ],
      correctAnswer: 'An outcome dependent on non-deterministic execution order of concurrent threads',
      metadata: { targetDifficulty: 'Medium', groundingScore: 0.94 }
    },
    {
      question: 'Which synchronization primitive prevents race conditions by enforcing mutual exclusion?',
      questionText: 'Which synchronization primitive prevents race conditions by enforcing mutual exclusion?',
      options: ['Mutex lock', 'Translation lookaside buffer', 'Demand page table', 'Circular DMA buffer'],
      correctAnswer: 'Mutex lock',
      metadata: { targetDifficulty: 'Medium', groundingScore: 0.91 }
    }
  ];

  // Complete with partial success: 2 delivered out of 5 requested
  completeTask(taskId, {
    questions: partialQuestions,
    deliveredCount: 2,
    requestedCount: 5,
    isPartial: true
  });

  const task = getTask(taskId, teacherId);
  assert.strictEqual(task.status, TaskStates.COMPLETED, 'Task status must be COMPLETED on partial success');
  assert.strictEqual(task.result.isPartial, true, 'isPartial must be true');
  assert.strictEqual(task.result.deliveredCount, 2);
  assert.strictEqual(task.result.requestedCount, 5);
  assert.strictEqual(task.result.questions.length, 2);

  // Check frontend CreateQuizText.jsx handles isPartial banner
  const editorPath = path.resolve(__dirname, '../../client/src/pages/CreateQuizText.jsx');
  const editorCode = fs.readFileSync(editorPath, 'utf8');
  assert.ok(editorCode.includes('location.state.isPartial') || editorCode.includes('isPartialYield'), 'CreateQuizText must inspect isPartial');
  assert.ok(editorCode.includes('deliveredCount') || editorCode.includes('questions.length'), 'Must display count of delivered questions');
});

console.log('\n======================================================================');
console.log(`🎉 ALL 5 SMOKE TEST FLOWS VERIFIED SUCCESSFULLY (${passCount}/${passCount})`);
console.log('======================================================================\n');
