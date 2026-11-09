/**
 * server/test/benchmarks/run_internal_team_evaluation.js
 *
 * Dedicated evaluation runner for the 4-lecture cohort under the frozen Change 1-3 baseline.
 * Executes full end-to-end pipeline via pipelineOrchestrator.runPipeline.
 *
 * Features:
 * - Built-in axios rate-limiting interceptor & Token Budget Guard for Groq API limits (8,000 TPM)
 * - Preserves all historical baseline outputs; writes uniquely timestamped JSON records
 * - Complete 4-lecture cohort coverage:
 *   1. Lecture 1: Deep GANs (N=10, Balanced)
 *   2. Lecture 2: Introductory Templates (N=10, Balanced)
 *   3. Lecture 3: BST / DSA (N=5, Balanced, Material-Only)
 *   4. Lecture 4: Classroom Banter (N=5, Balanced, Non-Academic Rejection)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Manually load .env into process.env if present
const envPath = path.resolve(__dirname, '../../../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const k = trimmed.slice(0, idx).trim();
        const v = trimmed.slice(idx + 1).trim();
        if (!process.env[k]) process.env[k] = v;
      }
    }
  });
}

// Enforce sequential generation in evaluation benchmark runner to respect single-key Groq TPM window
if (!process.env.GENERATION_CONCURRENCY) {
  process.env.GENERATION_CONCURRENCY = '1';
}

// Rate-limiting, pacing, and token budget guard for Groq on_demand tier
let lastCallTime = 0;
axios.interceptors.request.use(async (config) => {
  if (config.url && config.url.includes('api.groq.com')) {
    // 1. Pacing: maintain 2.5s between Groq calls
    const now = Date.now();
    const minInterval = 2500;
    const wait = Math.max(0, minInterval - (now - lastCallTime));
    if (wait > 0) {
      await new Promise(r => setTimeout(r, wait));
    }
    lastCallTime = Date.now();

    // 2. Token Budget Guard: Groq enforces an 8,000 TPM limit on on_demand tier.
    // If promptTokens + max_tokens > 7200, reduce max_tokens so the payload never triggers a static 413.
    if (config.data) {
      try {
        const payload = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
        if (payload && Array.isArray(payload.messages)) {
          const totalPromptChars = payload.messages.reduce((sum, m) => sum + (m.content || '').length, 0);
          const estPromptTokens = Math.ceil(totalPromptChars / 3.8);
          const currentMaxTokens = payload.max_tokens || 2048;
          const safeBudget = 7200; // Leave 800 tokens buffer below 8,000 TPM limit
          if (estPromptTokens + currentMaxTokens > safeBudget) {
            const adjustedMaxTokens = Math.max(800, safeBudget - estPromptTokens);
            payload.max_tokens = adjustedMaxTokens;
            config.data = typeof config.data === 'string' ? JSON.stringify(payload) : payload;
            console.log(`🔧 [Token Budget Guard] Adjusted max_tokens: ${currentMaxTokens} -> ${adjustedMaxTokens} (est prompt tokens: ${estPromptTokens})`);
          }
        }
      } catch (_) {}
    }
  }
  return config;
});

// Response errors bubble up directly to llmRouter for immediate multi-key failover
axios.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error)
);

const pipelineOrchestrator = require('../../engine/pipelineOrchestrator');

const COHORT = {
  1: {
    id: 'deep_gans',
    name: 'Lecture 1: Deep Architecture & GANs',
    fixturePath: path.resolve(__dirname, '../fixtures/lecture_arch_gans.json'),
    getInputs: (raw) => ({
      voiceTranscript: raw.inputs[0].content
    }),
    count: 10,
    difficulty: 'Balanced',
    category: 'VOICE_PLUS_MATERIAL',
    expectedCapacity: 'High (~20+)'
  },
  2: {
    id: 'intro_templates',
    name: 'Lecture 2: Introductory Model Templates',
    fixturePath: path.resolve(__dirname, '../../../archive/pipeline_experiment/data/transcripts/ml_madhurikamam_transcript.json'),
    getInputs: (raw) => {
      const text = raw.segments ? raw.segments.map(s => s.text).join(' ') : (raw.text || '');
      return {
        voiceTranscript: text
      };
    },
    count: 10,
    difficulty: 'Balanced',
    category: 'VOICE_ONLY',
    expectedCapacity: 'Bounded (~10-12, 0 Hard)'
  },
  3: {
    id: 'bst_dsa',
    name: 'Lecture 3: BST / DSA (Document-Only)',
    fixturePath: null,
    getInputs: () => {
      const bstText = `
Data Structures and Algorithms: Binary Search Trees and AVL Trees.

A Binary Search Tree (BST) is a hierarchical node-based binary tree data structure where for each node X, all keys in its left subtree are strictly less than X.key, and all keys in its right subtree are strictly greater than X.key.
Insertion traverses from root comparing values: go left if smaller, right if greater, until a null child is reached.
Deletion in a BST involves three cases: deleting a leaf node (simply remove), deleting a node with one child (replace with its child), and deleting a node with two children (replace with its in-order successor or predecessor, then recursively delete that node).
The in-order traversal of a binary search tree yields the keys in strictly sorted, ascending order.
When keys arrive in strictly sorted ascending order, BST height collapses to N, degrading search and insertion operations to O(N) linear worst-case time complexity.
In a balanced binary search tree, the time complexity for search, insertion, and deletion operations is O(log n).
To prevent worst-case linear skew, AVL trees enforce a balance factor invariant: for every node, |height(left) - height(right)| <= 1.
When insertion violates balance, rotations restore height: a single Left Rotation fixes Right-Right heavy skew, a single Right Rotation fixes Left-Left heavy skew, and double rotations (Left-Right or Right-Left) fix zigzag imbalances.
This rotation mechanism bounds tree height to O(log N), guaranteeing logarithmic lookup, insertion, and deletion complexity.
`;
      return {
        documentTexts: [bstText],
        documentNames: ['bst_data_structures.txt']
      };
    },
    count: 5,
    difficulty: 'Balanced',
    category: 'MATERIAL_ONLY',
    expectedCapacity: 'Moderate (~6-8)'
  },
  4: {
    id: 'classroom_banter',
    name: 'Lecture 4: Classroom Banter (Non-Academic)',
    fixturePath: null,
    getInputs: () => {
      const banterText = `
What Manish? Did you learn something or nothing? Hey Manish. No, no, no, today we are not doing any class. Let's talk about the weekend. Did you see the cricket match yesterday? India played really well, what a shot by Kohli. By the way, how many people in this class will actually pass the exam? Maybe 75 to 80 percent, the rest of you need to study. Manish, why are you always sitting in the last row laughing? Keep your mouth shut Manish. Okay guys, tomorrow is a holiday, enjoy your weekend, no homework today.
`;
      return {
        voiceTranscript: banterText
      };
    },
    count: 5,
    difficulty: 'Balanced',
    category: 'EDGE_CASES',
    expectedCapacity: '0 (Non-Academic Rejection Expected)'
  }
};

async function runSingleEvaluation(lectureKey = 1) {
  const config = COHORT[lectureKey];
  if (!config) {
    throw new Error(`Invalid cohort lecture key: ${lectureKey}`);
  }

  console.log('========================================================================');
  console.log(`🔬 INTERNAL TEAM EVALUATION — ${config.name}`);
  console.log(`   Configuration: N=${config.count}, Difficulty: ${config.difficulty}`);
  console.log(`   Category: ${config.category} | Expected Capacity: ${config.expectedCapacity}`);
  console.log('========================================================================\n');

  let rawData = null;
  if (config.fixturePath) {
    if (!fs.existsSync(config.fixturePath)) {
      throw new Error(`Fixture not found: ${config.fixturePath}`);
    }
    rawData = JSON.parse(fs.readFileSync(config.fixturePath, 'utf8'));
  }

  const sessionInputs = config.getInputs(rawData);
  const sourceLen = (sessionInputs.voiceTranscript || (sessionInputs.documentTexts || []).join(' ')).length;
  console.log(`▶ Ingested Source: ${sourceLen} characters | Modality: ${sessionInputs.documentTexts ? 'MATERIAL_ONLY' : 'VOICE'}`);

  const timestamp = Date.now();
  const sessionId = `eval_cohort_${config.id}_${timestamp}`;

  const startTime = Date.now();
  let result;
  try {
    result = await pipelineOrchestrator.runPipeline({
      sessionId,
      ...sessionInputs,
      count: config.count,
      difficulty: config.difficulty
    }, (progress) => {
      if (progress && progress.message) {
        console.log(`  [Progress ${progress.percent || 0}%] ${progress.stage || ''}: ${progress.message}`);
      }
    });
  } catch (err) {
    console.log(`⚠️ [Pipeline Halted / Threw Exception]: ${err.message} (code: ${err.code || err.errorCode || 'UNKNOWN'})`);
    result = err.pipelineResult || {
      sessionId,
      pipelineStatus: err.code === 'NON_ACADEMIC_CONTENT' ? 'REJECTED_NON_ACADEMIC' : 'FAILED',
      questions: [],
      error: err.message,
      errorCode: err.code || err.errorCode || 'PIPELINE_ERROR',
      notice: err.message,
      rejectedTargets: [],
      unfulfilledTargets: []
    };
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  const questions = result.questions || [];

  console.log(`\n========================================================================`);
  console.log(`🏁 PIPELINE EXECUTION COMPLETED IN ${durationSec}s`);
  console.log(`   Delivered: ${questions.length} / ${config.count} questions | Status: ${result.pipelineStatus}`);
  console.log('========================================================================\n');

  // Build the comprehensive evaluation record
  const outputDir = path.resolve(__dirname, '../../../evaluation_dataset/benchmark_results');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const recordFilename = `eval_cohort_${config.id}_n${config.count}_${config.difficulty.toLowerCase()}_${timestamp}.json`;
  const recordFilePath = path.join(outputDir, recordFilename);

  const evaluationRecord = {
    metadata: {
      cohortId: config.id,
      lectureName: config.name,
      evaluationTimestamp: new Date(timestamp).toISOString(),
      executionDurationSec: durationSec,
      gitCommit: '04456a0',
      requestedCount: config.count,
      requestedDifficulty: config.difficulty,
      deliveredCount: questions.length,
      pipelineStatus: result.pipelineStatus,
      evidenceSafety: result.evidenceSafety || result.evidencePackage?.evidenceSafety || 'GROUNDED'
    },
    capacityMetrics: {
      totalDefensibleCapacity: result.capacityDeficitReport?.totalDefensibleCapacity ?? result.teacherAnalysis?.evidenceCapacity?.totalDefensibleCapacity ?? null,
      recommendedQuestionCount: result.recommendedQuestionCount ?? result.teacherAnalysis?.evidenceCapacity?.recommendedQuestionCount ?? null,
      deficitCount: result.capacityDeficitReport?.capacityDeficit ?? (config.count - questions.length),
      capacityWarning: result.capacityDeficitReport?.capacityWarning ?? null,
      offeredActionOptions: result.capacityDeficitReport?.options ?? []
    },
    teachingProfile: {
      score: result.teacherAnalysis?.score ?? result.tcScore ?? null,
      description: result.teacherAnalysis?.pedagogicalCritique ?? null,
      deductions: result.teacherAnalysis?.deductions ?? [],
      pdi: result.pdi ?? result.evidencePackage?.PDI ?? null
    },
    deliveredQuestions: questions.map((q, idx) => ({
      index: idx + 1,
      targetId: q.targetId || q.id,
      concept: q.metadata?.concept || q.concept || 'Unknown Concept',
      difficulty: q.metadata?.targetDifficulty || q.metadata?.tier || q.difficulty || 'Medium',
      questionType: q.questionArchetype || q.metadata?.questionArchetype || 'PROSE_MULTIPLE_CHOICE',
      questionText: q.questionText || q.stem,
      options: q.options || [],
      correctAnswer: q.correctAnswer || q.correct_answer_text,
      correctAnswerIndex: q.correctAnswerIndex ?? q.correctOption,
      explanation: q.explanation || null
    })),
    auditDetails: {
      rejectedTargets: result.rejectedTargets || [],
      unfulfilledTargets: result.unfulfilledTargets || [],
      questionDecisionLedger: result.questionDecisionLedger || [],
      errors: result.error ? [result.error] : [],
      warnings: result.alignmentWarning ? [result.alignmentWarning] : []
    },
    rawPipelineResult: result
  };

  fs.writeFileSync(recordFilePath, JSON.stringify(evaluationRecord, null, 2), 'utf8');
  console.log(`📁 Timestamped Evaluation Record Saved: ${recordFilename}`);

  return { evaluationRecord, recordFilePath };
}

if (require.main === module) {
  const targetCohort = process.argv[2] ? parseInt(process.argv[2], 10) : 1;
  runSingleEvaluation(targetCohort).then(() => {
    console.log('\n✅ Evaluation run complete.');
    process.exit(0);
  }).catch(err => {
    console.error('❌ Evaluation run error:', err);
    process.exit(1);
  });
}

module.exports = { runSingleEvaluation, COHORT };
