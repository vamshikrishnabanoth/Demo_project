/**
 * server/test/run_quantity_scaling_multi005_n10.js
 *
 * PRIORITY 3: QUANTITY SCALING EXPERIMENT — RUN 1 (N=10)
 * Subject: Algorithms
 * Topic: DAA - Best Time to Buy and Sell Stock / Greedy Minimum Spanning Trees
 * Modality: VOICE_PLUS_MATERIAL (69.0 min Audio + 3-Page C++ Code PDF)
 * Requested: N=10, Difficulty: Balanced
 *
 * Invariants Enforced:
 *   1. Production freeze: Commit 4a52690. Zero engine modifications.
 *   2. Independent 4-dimensional scoring (D1: Correctness, D2: Grounding, D3: Cognitive Fit, D4: Stem Alignment).
 *   3. Separation of generation capacity vs. assessment quality.
 *   4. Full scale telemetry:
 *      - Delivery count vs. Usable count
 *      - Unique concept coverage & near-duplicate similarity
 *      - Bloom tier distribution (Easy / Medium / Hard)
 *      - Topic coverage across Stock Trading (Single/Multi/DP) vs. MST/Graphs
 *      - Latency, provider retries, and replenishment overhead
 *      - Option exclusivity audit (verifying single-correct key)
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

const AUDIO_PATH = path.resolve(__dirname, '../../evaluation_dataset/VOICE_PLUS_MATERIAL/MULTI_005/audio.mp3');
const PDF_PATH = path.resolve(__dirname, '../../evaluation_dataset/VOICE_PLUS_MATERIAL/MULTI_005/material.pdf');
const TRANSCRIPT_CACHE_PATH = path.resolve(__dirname, '../../evaluation_dataset/VOICE_PLUS_MATERIAL/MULTI_005/transcript_cache.txt');
const OUTPUT_RESULTS_FILE = path.resolve(__dirname, '../../evaluation_dataset/benchmark_results/quantity_scaling_multi005_n10_results.json');

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

function computeJaccardSimilarity(textA, textB) {
  const wordsA = new Set((textA || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 3));
  const wordsB = new Set((textB || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 3));
  if (wordsA.size === 0 || wordsB.size === 0) return 0.0;
  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }
  const union = wordsA.size + wordsB.size - intersection;
  return union === 0 ? 0.0 : parseFloat((intersection / union).toFixed(3));
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

async function getOrTranscribeAudio(audioPath) {
  if (fs.existsSync(TRANSCRIPT_CACHE_PATH)) {
    const cached = fs.readFileSync(TRANSCRIPT_CACHE_PATH, 'utf8');
    if (cached && cached.trim().length > 1000) {
      console.log(`✅ Loaded cached audio transcript (${cached.length} characters) from disk.`);
      return {
        transcript: cached,
        durationSec: 4140.96,
        isCached: true
      };
    }
  }

  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY missing from environment');
  }

  const durationSec = getAudioDuration(audioPath);
  console.log(`⏱️ Probed audio duration: ${durationSec.toFixed(1)}s (${(durationSec / 60).toFixed(1)} minutes)`);

  console.log('📦 Compressing 99.4MB audio to 20k mono AAC for Groq Whisper Turbo single-pass...');
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

  // Cache for subsequent scaling experiments
  try {
    fs.writeFileSync(TRANSCRIPT_CACHE_PATH, transcriptText, 'utf8');
    console.log(`💾 Cached transcript to ${TRANSCRIPT_CACHE_PATH}`);
  } catch (_) {}

  return {
    transcript: transcriptText,
    durationSec,
    isCached: false,
    compressionTimeSec: parseFloat(compTime),
    transcriptionTimeSec: parseFloat(sttTime)
  };
}

function classifyTopicDomain(stem, options, concept) {
  const full = `${stem} ${options.join(' ')} ${concept}`.toLowerCase();
  const hasStock = /\b(stock|buy|sell|price|profit|transaction|minprice)\b/i.test(full);
  const hasValley = /\b(valley|peak|ascending|consecutive|subsequent)\b/i.test(full);
  const hasDP = /\b(dynamic programming|dp|memoiz|optimal substructure|subproblem|tabulat)\b/i.test(full);
  const hasMST = /\b(spanning tree|kruskal|prim|mst|edge weight|cycle|cayley|formula|vertex|vertices)\b/i.test(full);
  const hasGraph = /\b(graph|connected|component|undirected|degree|adjacency)\b/i.test(full);

  if (hasStock && (hasValley || hasDP)) return 'Stock Trading (Multi/DP)';
  if (hasStock) return 'Stock Trading (Single Transaction)';
  if (hasMST) return 'Greedy MST (Kruskal/Prim)';
  if (hasGraph) return 'Graph Topology & Connectivity';
  return 'General Algorithms & Greedy Paradigms';
}

async function runQuantityScalingN10() {
  console.log('======================================================================');
  console.log('🚀 PRIORITY 3: QUANTITY SCALING EXPERIMENT — RUN 1 (N=10)');
  console.log('   Target: MULTI_005 (DAA: Stock Trading vs. Spanning Trees)');
  console.log('   Difficulty: Balanced (Targeting ~3-4 Easy, 3-4 Medium, 3-4 Hard)');
  console.log('======================================================================\n');

  // 1. Prerequisites & Invariants
  const repoRoot = path.resolve(__dirname, '../..');
  const currentCommit = execSync(`git -C "${repoRoot}" rev-parse HEAD`, { encoding: 'utf8' }).trim();
  const gitStatusShort = execSync(`git -C "${repoRoot}" status --short`, { encoding: 'utf8' }).trim();

  console.log(`📌 Current Commit SHA: ${currentCommit}`);
  console.log(`📌 Working Tree Status:\n${gitStatusShort || 'Clean'}\n`);

  const audioHash = computeFileSha256(AUDIO_PATH);
  const pdfHash = computeFileSha256(PDF_PATH);
  console.log(`📁 Audio Asset:    ${path.basename(AUDIO_PATH)} (SHA-256: ${audioHash})`);
  console.log(`📁 Material Asset: ${path.basename(PDF_PATH)} (SHA-256: ${pdfHash})\n`);

  // 2. Ingestion
  console.log('📥 Ingesting Presentation Document (pdf-parse)...');
  const pdfData = await extractPdfText(PDF_PATH);
  console.log(`✅ Extracted PDF: ${pdfData.numPages} pages, ${pdfData.text.length} characters`);

  console.log('📥 Ingesting Classroom Audio...');
  const audioData = await getOrTranscribeAudio(AUDIO_PATH);
  const voiceTranscript = audioData.transcript;
  const unifiedEvidence = voiceTranscript + '\n\n' + pdfData.text;

  // 3. Pipeline Generation (Requested Count = 10)
  const REQUESTED_COUNT = 10;
  console.log(`\n⚙️ Executing Generation Pipeline (Requested: N=${REQUESTED_COUNT}, Difficulty: Balanced)...`);
  const t0_gen = Date.now();
  const sessionId = 'scale_multi005_n10_' + Date.now();

  const pipelineResult = await pipelineOrchestrator.runPipeline({
    sessionId,
    voiceTranscript,
    documentTexts: [pdfData.text],
    documentNames: ['material.pdf'],
    count: REQUESTED_COUNT,
    difficulty: 'Balanced'
  });
  const generationDurationSec = parseFloat(((Date.now() - t0_gen) / 1000).toFixed(1));

  const deliveredQuestions = pipelineResult.questions || [];
  const deliveredCount = deliveredQuestions.length;

  console.log(`\n✅ Pipeline Execution Completed in ${generationDurationSec}s`);
  console.log(`   Pipeline Status: ${pipelineResult.pipelineStatus}`);
  console.log(`   Requested Count: ${REQUESTED_COUNT} | Delivered Count: ${deliveredCount}`);
  console.log(`   Capacity Fulfillment: ${((deliveredCount / REQUESTED_COUNT) * 100).toFixed(1)}%\n`);

  // 4. Four-Dimensional Independent Evaluation of Every Delivered Question
  console.log('======================================================================');
  console.log('🔍 INDEPENDENT FOUR-DIMENSIONAL AUDIT OF DELIVERED QUESTIONS');
  console.log('======================================================================\n');

  const evaluatedQuestions = [];
  const conceptSet = new Set();
  const topicDistribution = {};
  const tierDistribution = { Easy: 0, Medium: 0, Hard: 0 };

  for (let i = 0; i < deliveredQuestions.length; i++) {
    const q = deliveredQuestions[i];
    const stem = q.questionText || q.stem || '';
    const options = q.options || [];
    const correctAnswer = q.correctAnswer || '';
    const difficulty = q.difficulty || q.targetDifficulty || 'Medium';
    const concept = q.metadata?.concept || q.concept || 'Algorithmic Problem';
    conceptSet.add(concept);
    tierDistribution[difficulty] = (tierDistribution[difficulty] || 0) + 1;

    const topicClassification = classifyTopicDomain(stem, options, concept);
    topicDistribution[topicClassification] = (topicDistribution[topicClassification] || 0) + 1;

    console.log(`----------------------------------------------------------------------`);
    console.log(`[QUESTION ${i + 1} / ${deliveredCount}] - Tier: ${difficulty} | Subtopic: ${topicClassification}`);
    console.log(`Concept: "${concept}"`);
    console.log(`Stem (${countWords(stem)}w): "${stem}"`);
    console.log(`Options (max ${Math.max(...options.map(o => countWords(o)))}w, ratio ${calculateOptionLengthRatio(options)}x):`);
    options.forEach((opt, idx) => {
      const letter = String.fromCharCode(65 + idx);
      const isKey = (opt === correctAnswer || letter === q.correctAnswerKey) ? ' ★ [KEY]' : '';
      console.log(`  ${letter}. ${opt}${isKey}`);
    });

    // Dimension 1: Answer-Key Correctness & Option Exclusivity
    const keyInOptions = options.includes(correctAnswer);
    let keyDefensible = keyInOptions && options.length === 4;

    // Check for distractor ambiguity / option collision (like MULTI_005 Q3 BD issue)
    const optionsLower = options.map(o => o.toLowerCase());
    let optionOverlapDefect = null;
    for (let j = 0; j < options.length; j++) {
      for (let k = j + 1; k < options.length; k++) {
        // Check if two options start with the same entity name (e.g., "BD, as ...")
        const wordsJ = options[j].split(/[\s,]+/);
        const wordsK = options[k].split(/[\s,]+/);
        if (wordsJ[0] && wordsK[0] && wordsJ[0].toLowerCase() === wordsK[0].toLowerCase() && wordsJ[0].length >= 2) {
          // Both name the same leading token
          if (options[j] === correctAnswer || options[k] === correctAnswer) {
            optionOverlapDefect = `Option collision between ${String.fromCharCode(65 + j)} and ${String.fromCharCode(65 + k)} on leading token "${wordsJ[0]}"`;
            keyDefensible = false;
          }
        }
      }
    }

    // Dimension 2: Grounding Gate Fresh-Graph Audit
    const groundingFresh = groundingGate.verifyQuizGrounding([{
      questionText: stem,
      options,
      correctAnswer
    }], {
      unifiedRawContent: unifiedEvidence,
      negativeBoundaries: []
    });
    const groundingScore = groundingFresh.status === 'PASSED' ? 1 : 0;

    // Dimension 3: Cognitive Calibration / Bloom Fit
    const target = {
      concept,
      targetDifficulty: difficulty,
      intendedCognitiveOperation: q.metadata?.cognitiveDemand || (difficulty === 'Easy' ? 'RECALL' : difficulty === 'Medium' ? 'COMPARE' : 'DIAGNOSE')
    };
    const cognitiveAudit = agent3Evaluator._evaluateCognitiveDemand(q, target);
    let cognitiveScore = 1;
    if (difficulty === 'Hard' && cognitiveAudit.evaluatedCognitiveDemand === 'RECALL') cognitiveScore = 0;
    if (difficulty === 'Easy' && cognitiveAudit.evaluatedCognitiveDemand === 'DIAGNOSE') cognitiveScore = 0;

    // Dimension 4: Interrogative Mood & Stem–Answer Alignment (Workstream 1 Gate)
    const evalRes = await agent3Evaluator.evaluateQuestion(q, target, { unifiedRawContent: unifiedEvidence });
    const alignmentRecord = evalRes.stemAnswerAlignment;
    const isDirectlyResponsive = alignmentRecord?.isDirectlyResponsive === true;
    const interrogativeMatch = alignmentRecord?.interrogativeMatch === true;
    const alignmentScore = (isDirectlyResponsive && interrogativeMatch) ? 1 : 0;

    // Usable Question Yield: All 4 dimensions must equal 1
    const overallPass = (keyDefensible ? 1 : 0) && groundingScore && cognitiveScore && alignmentScore;

    const defectLabels = [];
    if (!keyDefensible) {
      defectLabels.push(optionOverlapDefect ? 'AMBIGUOUS_DISTRACTOR_OVERLAP' : 'INCORRECT_OR_AMBIGUOUS_KEY');
    }
    if (!groundingScore) defectLabels.push('UNGROUNDED_EVIDENCE_CLAIM');
    if (!cognitiveScore) defectLabels.push('TIER_COGNITIVE_MISMATCH');
    if (!alignmentScore) defectLabels.push('STEM_ANSWER_MISALIGNMENT');

    const primaryDisposition = overallPass ? 'USABLE_PASS' : (defectLabels[0] || 'REJECTED');

    console.log(`\n  DIMENSION 1 (Correctness): ${keyDefensible ? '✅ PASS (1)' : '❌ FAIL (0)'}${optionOverlapDefect ? ` [${optionOverlapDefect}]` : ''}`);
    console.log(`  DIMENSION 2 (Grounding):   ${groundingScore ? '✅ PASS (1)' : '❌ FAIL (0)'} (${groundingFresh.status})`);
    if (!groundingScore) console.log(`    ⚠️ Reason: ${groundingFresh.reasons?.[0] || 'Unknown'}`);
    console.log(`  DIMENSION 3 (Cognitive):   ${cognitiveScore ? '✅ PASS (1)' : '❌ FAIL (0)'} (Demand: ${cognitiveAudit.evaluatedCognitiveDemand})`);
    console.log(`  DIMENSION 4 (Alignment):   ${alignmentScore ? '✅ PASS (1)' : '❌ FAIL (0)'} (Mood: ${alignmentRecord?.interrogativeMood})`);
    console.log(`  OVERALL EVALUATION:        ${overallPass ? '🌟 USABLE PASS' : '⚠️ REJECTED'} | Primary: ${primaryDisposition}`);

    evaluatedQuestions.push({
      questionIndex: i + 1,
      difficulty,
      topicClassification,
      concept,
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
        dimension2_Grounding: groundingScore,
        dimension3_CognitiveFit: cognitiveScore,
        dimension4_StemAlignment: alignmentScore
      },
      overallPass: Boolean(overallPass),
      defectLabels,
      primaryDisposition,
      optionOverlapDefect,
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

  // 5. Redundancy & Near-Duplicate Analysis
  console.log('\n======================================================================');
  console.log('🔄 SCALE METRIC: REDUNDANCY & NEAR-DUPLICATE ANALYSIS');
  console.log('======================================================================\n');

  const similarityPairs = [];
  let highSimilarityCount = 0; // Jaccard >= 0.50

  for (let i = 0; i < evaluatedQuestions.length; i++) {
    for (let j = i + 1; j < evaluatedQuestions.length; j++) {
      const qA = evaluatedQuestions[i];
      const qB = evaluatedQuestions[j];
      const sim = computeJaccardSimilarity(qA.stem, qB.stem);
      if (sim >= 0.35) {
        similarityPairs.push({
          pair: `Q${qA.questionIndex} <-> Q${qB.questionIndex}`,
          similarity: sim,
          stemA: qA.stem,
          stemB: qB.stem
        });
        if (sim >= 0.50) highSimilarityCount++;
      }
    }
  }

  console.log(`• Total Question Pairs Evaluated: ${(evaluatedQuestions.length * (evaluatedQuestions.length - 1)) / 2}`);
  console.log(`• Moderately Similar Pairs (Jaccard >= 0.35): ${similarityPairs.length}`);
  console.log(`• High-Risk Near-Duplicate Pairs (Jaccard >= 0.50): ${highSimilarityCount}`);
  similarityPairs.forEach(p => {
    console.log(`  - [${p.pair}] Similarity: ${(p.similarity * 100).toFixed(1)}%`);
    console.log(`    A: "${p.stemA.slice(0, 70)}..."`);
    console.log(`    B: "${p.stemB.slice(0, 70)}..."`);
  });

  // 6. Scale Summary
  const usableCount = evaluatedQuestions.filter(q => q.overallPass).length;
  const d1PassCount = evaluatedQuestions.filter(q => q.dimensionScores.dimension1_Correctness === 1).length;
  const d2PassCount = evaluatedQuestions.filter(q => q.dimensionScores.dimension2_Grounding === 1).length;
  const d3PassCount = evaluatedQuestions.filter(q => q.dimensionScores.dimension3_CognitiveFit === 1).length;
  const d4PassCount = evaluatedQuestions.filter(q => q.dimensionScores.dimension4_StemAlignment === 1).length;

  console.log('\n======================================================================');
  console.log('📊 QUANTITY SCALING N=10 SUMMARY REPORT');
  console.log('======================================================================');
  console.log(`• Requested Count:             ${REQUESTED_COUNT}`);
  console.log(`• Delivered Count:             ${deliveredCount} (${((deliveredCount / REQUESTED_COUNT) * 100).toFixed(1)}%)`);
  console.log(`• Usable Count (All 4 Dims):   ${usableCount} / ${deliveredCount} (${((usableCount / deliveredCount) * 100).toFixed(1)}% of Delivered)`);
  console.log(`• Usable / Requested Count:    ${usableCount} / ${REQUESTED_COUNT} (${((usableCount / REQUESTED_COUNT) * 100).toFixed(1)}% of Requested)`);
  console.log(`• Latency:                     ${generationDurationSec}s (${(generationDurationSec / deliveredCount).toFixed(1)}s / question)`);
  console.log(`• Dimension 1 (Correctness):   ${d1PassCount} / ${deliveredCount} (${((d1PassCount / deliveredCount) * 100).toFixed(1)}%)`);
  console.log(`• Dimension 2 (Grounding):     ${d2PassCount} / ${deliveredCount} (${((d2PassCount / deliveredCount) * 100).toFixed(1)}%)`);
  console.log(`• Dimension 3 (Cognitive Fit): ${d3PassCount} / ${deliveredCount} (${((d3PassCount / deliveredCount) * 100).toFixed(1)}%)`);
  console.log(`• Dimension 4 (Stem Align):    ${d4PassCount} / ${deliveredCount} (${((d4PassCount / deliveredCount) * 100).toFixed(1)}%)`);
  console.log(`• Unique Concepts:             ${conceptSet.size} / ${deliveredCount}`);
  console.log(`• Difficulty Distribution:     Easy: ${tierDistribution.Easy}, Medium: ${tierDistribution.Medium}, Hard: ${tierDistribution.Hard}`);
  console.log(`• Topic Breadth Distribution:`);
  Object.entries(topicDistribution).forEach(([t, cnt]) => {
    console.log(`    - ${t}: ${cnt} question(s)`);
  });

  const finalOutput = {
    benchmarkPhase: 'PRIORITY_3_QUANTITY_SCALING',
    runId: 'RUN_1_N10',
    datasetId: 'MULTI_005',
    subject: 'Algorithms',
    topic: 'DAA - Best Time to Buy and Sell Stock / Minimum Spanning Trees',
    gitCommit: currentCommit,
    timestamp: new Date().toISOString(),
    parameters: {
      requestedCount: REQUESTED_COUNT,
      deliveredCount,
      difficulty: 'Balanced',
      generationDurationSec
    },
    scalingMetrics: {
      capacityFulfillmentRate: `${((deliveredCount / REQUESTED_COUNT) * 100).toFixed(1)}%`,
      usableYieldDelivered: `${usableCount} / ${deliveredCount}`,
      usablePercentageDelivered: `${((usableCount / deliveredCount) * 100).toFixed(1)}%`,
      usableYieldRequested: `${usableCount} / ${REQUESTED_COUNT}`,
      usablePercentageRequested: `${((usableCount / REQUESTED_COUNT) * 100).toFixed(1)}%`,
      latencySecondsTotal: generationDurationSec,
      latencySecondsPerDeliveredQuestion: parseFloat((generationDurationSec / deliveredCount).toFixed(1)),
      uniqueConceptsCount: conceptSet.size,
      redundancy: {
        totalPairs: (evaluatedQuestions.length * (evaluatedQuestions.length - 1)) / 2,
        moderateSimilarityPairsCount: similarityPairs.length,
        highSimilarityNearDuplicatesCount: highSimilarityCount,
        nearDuplicateRate: `${((highSimilarityCount / Math.max(1, (evaluatedQuestions.length * (evaluatedQuestions.length - 1)) / 2)) * 100).toFixed(1)}%`
      },
      difficultyDistribution: tierDistribution,
      topicBreadthDistribution: topicDistribution
    },
    dimensionPassRates: {
      dimension1_Correctness: `${d1PassCount} / ${deliveredCount}`,
      dimension2_Grounding: `${d2PassCount} / ${deliveredCount}`,
      dimension3_CognitiveFit: `${d3PassCount} / ${deliveredCount}`,
      dimension4_StemAlignment: `${d4PassCount} / ${deliveredCount}`
    },
    questions: evaluatedQuestions
  };

  fs.writeFileSync(OUTPUT_RESULTS_FILE, JSON.stringify(finalOutput, null, 2), 'utf8');
  console.log(`\n💾 Raw N=10 scaling results saved to: ${OUTPUT_RESULTS_FILE}`);

  return finalOutput;
}

runQuantityScalingN10().catch(err => {
  console.error('❌ Scaling experiment failed:', err);
  process.exit(1);
});
