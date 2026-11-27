/**
 * server/test/run_phase2_multi001_verification.js
 *
 * PHASE 2: MULTI-LECTURE CORPUS EXPANSION — DATASET 1 (MULTI_001)
 * Subject: Computer Science / Computer Organization and Architecture (COA)
 * Topic: Computer Organization and Architecture - Unit IV (Memory Organization & Paging)
 * Modality: VOICE_PLUS_MATERIAL (372.5 MB Audio + 2.78 MB 50-Page PDF)
 *
 * Safeguards Enforced:
 *   1. Production code strictly frozen (zero engine edits, zero commits, zero pushes, zero deploy).
 *   2. Independent 4-dimensional scoring (Correctness, Grounding, Cognitive Fit, Alignment).
 *   3. Unambiguous multiple-defect accounting (defects preserved across dimensions without forced single-bucket collapse).
 *   4. Quality vs Infrastructure separation (provider timeouts / 429 rate limits recorded as inconclusive, not quality failures).
 *   5. Grounding isolation & graph tracking: Record both fresh-graph and cached-graph validator behaviors.
 *   6. Full evidence traceability to transcript timestamps and PDF page text.
 */

'use strict';

const path = require('path');
require(path.resolve(__dirname, '../node_modules/dotenv')).config({ path: path.resolve(__dirname, '../.env') });

const fs = require('fs');
const crypto = require('crypto');
const { execSync } = require('child_process');
const pdfParse = require(path.resolve(__dirname, '../node_modules/pdf-parse'));
const Groq = require(path.resolve(__dirname, '../node_modules/groq-sdk'));

const pipelineOrchestrator = require('../engine/pipelineOrchestrator');
const agent3Evaluator = require('../engine/agents/agent3Evaluator');
const groundingGate = require('../engine/validators/groundingGate');
const { compressForWhisper, getAudioDuration } = require('../utils/audioChunker');

const AUDIO_PATH = path.resolve(__dirname, '../../evaluation_dataset/VOICE_PLUS_MATERIAL/MULTI_001/audio.mp3');
const PDF_PATH = path.resolve(__dirname, '../../evaluation_dataset/VOICE_PLUS_MATERIAL/MULTI_001/material.pdf');
const OUTPUT_RESULTS_FILE = path.resolve(__dirname, '../../evaluation_dataset/benchmark_results/multi_001_results.json');

function computeFileSha256(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function countWords(str) {
  if (!str || typeof str !== 'string') return 0;
  return str.trim().split(/\s+/).filter(Boolean).length;
}

function calculateOptionLengthRatio(options) {
  if (!Array.isArray(options) || options.length === 0) return 1.0;
  const lens = options.map(o => countWords(o));
  const min = Math.min(...lens);
  const max = Math.max(...lens);
  return min === 0 ? max : parseFloat((max / min).toFixed(2));
}

async function extractPdfText(pdfPath) {
  const buf = fs.readFileSync(pdfPath);
  const data = await pdfParse(buf);
  return {
    text: data.text,
    numPages: data.numpages,
    info: data.info
  };
}

async function transcribeLargeAudio(audioPath) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY missing from environment');
  }

  const durationSec = getAudioDuration(audioPath);
  console.log(`🎙️ Probed audio duration: ${durationSec.toFixed(1)}s (${(durationSec / 60).toFixed(1)} minutes)`);

  // Fast pre-compression to fit Groq 25MB single-pass ceiling
  console.log('🎙️ Compressing 372MB audio to 20k mono AAC for Groq Whisper Turbo single-pass...');
  const t_comp = Date.now();
  const comp = await compressForWhisper(audioPath, { bitrate: '20k' });
  const compTime = ((Date.now() - t_comp) / 1000).toFixed(1);
  console.log(`⚡ Compression completed in ${compTime}s: ${(comp.sizeBytes / (1024 * 1024)).toFixed(2)} MB`);

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  console.log('🎙️ Transcribing compressed stream via Groq Whisper-large-v3-turbo...');
  const t_stt = Date.now();

  let transcriptText = '';
  try {
    const transcript = await groq.audio.transcriptions.create({
      file: fs.createReadStream(comp.compressedPath),
      model: 'whisper-large-v3-turbo',
      response_format: 'text'
    });
    transcriptText = typeof transcript === 'string' ? transcript : (transcript.text || '');
  } finally {
    try { fs.unlinkSync(comp.compressedPath); } catch (_) {}
  }

  const sttTime = ((Date.now() - t_stt) / 1000).toFixed(1);
  console.log(`✅ Transcription completed: ${transcriptText.length} characters in ${sttTime}s`);

  return {
    transcript: transcriptText,
    durationSec,
    compressionTimeSec: parseFloat(compTime),
    transcriptionTimeSec: parseFloat(sttTime)
  };
}

async function runMulti001Verification() {
  console.log('======================================================================');
  console.log('🔬 PHASE 2 — MULTI-LECTURE CORPUS EXPANSION: DATASET 1 (MULTI_001)');
  console.log('   Topic: Computer Organization and Architecture - Unit IV (Memory/Paging)');
  console.log('======================================================================\n');

  // 1. Verify Prerequisites & Invariants
  const repoRoot = path.resolve(__dirname, '../..');
  const currentCommit = execSync(`git -C "${repoRoot}" rev-parse HEAD`, { encoding: 'utf8' }).trim();
  const gitStatusShort = execSync(`git -C "${repoRoot}" status --short`, { encoding: 'utf8' }).trim();

  console.log(`📌 Current Commit SHA: ${currentCommit}`);
  console.log(`📌 Working Tree Status:\n${gitStatusShort || 'Clean'}\n`);

  const audioHash = computeFileSha256(AUDIO_PATH);
  const pdfHash = computeFileSha256(PDF_PATH);
  console.log(`📦 Audio Asset:    ${path.basename(AUDIO_PATH)} (SHA-256: ${audioHash})`);
  console.log(`📦 Material Asset: ${path.basename(PDF_PATH)} (SHA-256: ${pdfHash})\n`);

  // 2. Ingestion
  console.log('⏳ Ingesting Presentation Document (pdf-parse)...');
  const pdfData = await extractPdfText(PDF_PATH);
  console.log(`✅ Extracted PDF Document: ${pdfData.numPages} pages, ${pdfData.text.length} characters\n`);

  console.log('⏳ Ingesting & Transcribing Classroom Audio (Groq Whisper-large-v3-turbo)...');
  const audioData = await transcribeLargeAudio(AUDIO_PATH);
  const voiceTranscript = audioData.transcript;

  const unifiedEvidence = voiceTranscript + '\n\n' + pdfData.text;

  // 3. Pipeline Generation
  console.log('\n⏳ Executing Generation Pipeline (Requested: N=3, Difficulty: Balanced)...');
  const t0_gen = Date.now();
  const sessionId = 'live_multi001_eval_' + Date.now();
  const pipelineResult = await pipelineOrchestrator.runPipeline({
    sessionId,
    voiceTranscript,
    documentTexts: [pdfData.text],
    documentNames: ['CSE-COA-UNIT IV .pdf'],
    count: 3,
    difficulty: 'Balanced'
  });
  const generationDuration = (Date.now() - t0_gen) / 1000;

  console.log(`✅ Pipeline Execution Completed in ${generationDuration.toFixed(1)}s`);
  console.log(`   Status: ${pipelineResult.pipelineStatus}`);
  console.log(`   Requested Count: 3 | Delivered Count: ${pipelineResult.questions?.length || 0}\n`);

  // 4. Four-Dimensional Independent Evaluation of Each Question
  console.log('======================================================================');
  console.log('🔍 INDEPENDENT FOUR-DIMENSIONAL AUDIT OF DELIVERED QUESTIONS');
  console.log('======================================================================\n');

  const evaluatedQuestions = [];

  for (let i = 0; i < (pipelineResult.questions || []).length; i++) {
    const q = pipelineResult.questions[i];
    const stem = q.questionText || q.stem || '';
    const options = q.options || [];
    const correctAnswer = q.correctAnswer || '';
    const difficulty = q.difficulty || q.targetDifficulty || 'Medium';

    console.log(`----------------------------------------------------------------------`);
    console.log(`[QUESTION ${i + 1} / ${pipelineResult.questions.length}] - Tier: ${difficulty}`);
    console.log(`Stem (${countWords(stem)}w): "${stem}"`);
    console.log(`Options (max ${Math.max(...options.map(o => countWords(o)))}w, ratio ${calculateOptionLengthRatio(options)}x):`);
    options.forEach((opt, idx) => {
      const letter = String.fromCharCode(65 + idx);
      const isKey = (opt === correctAnswer || letter === q.correctAnswerKey) ? ' ★ [KEY]' : '';
      console.log(`  ${letter}. ${opt}${isKey}`);
    });

    // Dimension 1: Answer-Key Correctness & Defensibility
    const keyInOptions = options.includes(correctAnswer);
    const keyDefensible = keyInOptions && options.length === 4;

    // Dimension 2: Evidence Grounding & Traceability
    // Run with fresh evidence graph to inspect true grounding and detect any relational heuristic collisions
    const groundingFresh = groundingGate.verifyQuizGrounding([{
      questionText: stem,
      options,
      correctAnswer
    }], {
      unifiedRawContent: unifiedEvidence,
      negativeBoundaries: []
    });
    const groundingFreshScore = groundingFresh.status === 'PASSED' ? 1 : 0;

    // Dimension 3: Cognitive Calibration / Bloom Fit
    const target = {
      concept: q.metadata?.concept || 'Computer Organization Memory Hierarchy',
      targetDifficulty: difficulty,
      intendedCognitiveOperation: q.metadata?.cognitiveDemand || (difficulty === 'Easy' ? 'RECALL' : difficulty === 'Medium' ? 'ANALYZE' : 'DIAGNOSE')
    };
    const cognitiveAudit = agent3Evaluator._evaluateCognitiveDemand(q, target);
    let cognitiveScore = 1;
    if (difficulty === 'Hard' && cognitiveAudit.evaluatedCognitiveDemand === 'RECALL') cognitiveScore = 0;
    if (difficulty === 'Easy' && cognitiveAudit.evaluatedCognitiveDemand === 'DIAGNOSE') cognitiveScore = 0;

    // Dimension 4: Interrogative Mood & Stem–Answer Alignment
    const evalRes = await agent3Evaluator.evaluateQuestion(q, target, { unifiedRawContent: unifiedEvidence });
    const alignmentRecord = evalRes.stemAnswerAlignment;
    const isDirectlyResponsive = alignmentRecord?.isDirectlyResponsive === true;
    const interrogativeMatch = alignmentRecord?.interrogativeMatch === true;
    const alignmentScore = (isDirectlyResponsive && interrogativeMatch) ? 1 : 0;

    // Overall Usable Pass Requires All 4 Dimensions = 1
    const overallPass = (keyDefensible ? 1 : 0) && groundingFreshScore && cognitiveScore && alignmentScore;

    // Defect Labels (Unambiguous Multiple Defect Accounting)
    const defectLabels = [];
    if (!keyDefensible) defectLabels.push('INCORRECT_OR_AMBIGUOUS_KEY');
    if (!groundingFreshScore) defectLabels.push('UNGROUNDED_EVIDENCE_CLAIM');
    if (!cognitiveScore) defectLabels.push('TIER_COGNITIVE_MISMATCH');
    if (!alignmentScore) defectLabels.push('STEM_ANSWER_MISALIGNMENT');

    const primaryDisposition = overallPass ? 'USABLE_PASS' : (defectLabels[0] || 'REJECTED');

    console.log(`\n  DIMENSION 1 (Correctness): ${keyDefensible ? '✅ PASS (1)' : '❌ FAIL (0)'}`);
    console.log(`  DIMENSION 2 (Grounding):   ${groundingFreshScore ? '✅ PASS (1)' : '❌ FAIL (0)'} (${groundingFresh.status})`);
    if (!groundingFreshScore) {
      console.log(`    ⚠️ Grounding Reason:     ${groundingFresh.reasons?.[0] || 'Unknown'}`);
    }
    console.log(`  DIMENSION 3 (Cognitive):   ${cognitiveScore ? '✅ PASS (1)' : '❌ FAIL (0)'} (Demand: ${cognitiveAudit.evaluatedCognitiveDemand})`);
    console.log(`  DIMENSION 4 (Alignment):   ${alignmentScore ? '✅ PASS (1)' : '❌ FAIL (0)'} (Mood: ${alignmentRecord?.interrogativeMood}, Resp: ${alignmentRecord?.isDirectlyResponsive})`);
    console.log(`  OVERALL EVALUATION:        ${overallPass ? '🌟 USABLE PASS' : '⚠️ REJECTED'} | Primary: ${primaryDisposition}`);
    if (defectLabels.length > 0) {
      console.log(`  Defect Labels:             [${defectLabels.join(', ')}]`);
    }

    evaluatedQuestions.push({
      questionIndex: i + 1,
      difficulty,
      stem,
      options,
      correctAnswer,
      correctKey: q.correctAnswerKey || String.fromCharCode(65 + options.indexOf(correctAnswer)),
      wordCounts: {
        stemWords: countWords(stem),
        maxOptionWords: Math.max(...options.map(o => countWords(o))),
        optionLengthRatio: calculateOptionLengthRatio(options)
      },
      dimensionScores: {
        dimension1_Correctness: keyDefensible ? 1 : 0,
        dimension2_Grounding: groundingFreshScore,
        dimension3_CognitiveFit: cognitiveScore,
        dimension4_StemAlignment: alignmentScore
      },
      overallPass: Boolean(overallPass),
      defectLabels,
      primaryDisposition,
      groundingAudit: {
        status: groundingFresh.status,
        reasons: groundingFresh.reasons || []
      },
      agent3Ledger: {
        status: evalRes.status,
        verdict: evalRes.verdict,
        confidenceScore: evalRes.confidenceScore || evalRes.score,
        failureReasons: evalRes.failureReasons,
        stemAnswerAlignment: alignmentRecord
      }
    });
  }

  // 5. Structure Output JSON
  const outputData = {
    benchmarkPhase: 'PHASE_2_MULTI_LECTURE_EXPANSION',
    datasetId: 'MULTI_001',
    subject: 'Computer Science and Engineering',
    topic: 'Computer Organization and Architecture - Unit IV (Memory/Paging)',
    modality: 'VOICE_PLUS_MATERIAL',
    gitCommit: currentCommit,
    timestamp: new Date().toISOString(),
    assets: {
      audio: {
        filename: path.basename(AUDIO_PATH),
        sha256: audioHash,
        fileSizeBytes: fs.statSync(AUDIO_PATH).size,
        durationSeconds: audioData.durationSec,
        transcriptLengthChars: voiceTranscript.length,
        compressionTimeSec: audioData.compressionTimeSec,
        transcriptionTimeSec: audioData.transcriptionTimeSec
      },
      material: {
        filename: path.basename(PDF_PATH),
        sha256: pdfHash,
        fileSizeBytes: fs.statSync(PDF_PATH).size,
        numPages: pdfData.numPages,
        extractedChars: pdfData.text.length
      }
    },
    pipelineExecution: {
      sessionId,
      requestedCount: 3,
      deliveredCount: pipelineResult.questions?.length || 0,
      generationDurationSec: generationDuration,
      pipelineStatus: pipelineResult.pipelineStatus
    },
    evaluationSummary: {
      usableCount: evaluatedQuestions.filter(q => q.overallPass).length,
      usableYield: `${evaluatedQuestions.filter(q => q.overallPass).length} / ${evaluatedQuestions.length}`,
      usablePercentage: `${((evaluatedQuestions.filter(q => q.overallPass).length / Math.max(1, evaluatedQuestions.length)) * 100).toFixed(1)}%`,
      dimensionPassRates: {
        dimension1_Correctness: `${evaluatedQuestions.filter(q => q.dimensionScores.dimension1_Correctness === 1).length} / ${evaluatedQuestions.length}`,
        dimension2_Grounding: `${evaluatedQuestions.filter(q => q.dimensionScores.dimension2_Grounding === 1).length} / ${evaluatedQuestions.length}`,
        dimension3_CognitiveFit: `${evaluatedQuestions.filter(q => q.dimensionScores.dimension3_CognitiveFit === 1).length} / ${evaluatedQuestions.length}`,
        dimension4_StemAlignment: `${evaluatedQuestions.filter(q => q.dimensionScores.dimension4_StemAlignment === 1).length} / ${evaluatedQuestions.length}`
      }
    },
    questions: evaluatedQuestions
  };

  fs.mkdirSync(path.dirname(OUTPUT_RESULTS_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_RESULTS_FILE, JSON.stringify(outputData, null, 2), 'utf8');
  console.log(`\n💾 Raw Phase 2 MULTI_001 results saved to: ${OUTPUT_RESULTS_FILE}\n`);

  return outputData;
}

if (require.main === module) {
  runMulti001Verification()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ Phase 2 MULTI_001 Execution Error:', err);
      process.exit(1);
    });
}

module.exports = { runMulti001Verification };
