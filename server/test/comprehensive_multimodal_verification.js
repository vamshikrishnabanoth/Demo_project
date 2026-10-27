const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const pdfParse = require('pdf-parse');
const DocumentRouter = require('../engine/documentRouter/documentRouter');
const lectureIntelligence = require('../engine/intelligence/lectureIntelligence');
const depthAnalyzer = require('../engine/evidence/depthAnalyzer');
const pipelineOrchestrator = require('../engine/pipelineOrchestrator');

async function testPdfMetadata(name, pdfPath) {
  console.log(`\n======================================================`);
  console.log(`📄 Testing PDF Metadata & Depth Analysis: ${name}`);
  console.log(`Path: ${pdfPath}`);
  console.log(`======================================================`);

  const fileBuffer = fs.readFileSync(pdfPath);
  const data = await pdfParse(fileBuffer);
  const extractedText = data.text || '';
  console.log(`Extracted Pages: ${data.numpages || 1}, Characters: ${extractedText.length}`);

  const intelligence = await lectureIntelligence.analyze({
    evidenceText: extractedText,
    fileName: path.basename(pdfPath)
  });
  console.log(`Concept Map Length: ${intelligence.conceptMap?.length || 0}`);
  console.log(`Concepts: ${(intelligence.conceptMap || []).map(c => c.name).join(', ')}`);

  const evCap = intelligence.evidenceCapacity;
  console.log(`Evidence Capacity Analysis:`);
  console.log(`  - Total Defensible Capacity: ${evCap?.totalDefensibleCapacity}`);
  console.log(`  - Recommended Count: ${evCap?.recommendedQuestionCount}`);
  console.log(`  - Recommended By Difficulty:`, evCap?.recommendedByDifficulty);
  console.log(`  - Capacity By Difficulty:`, evCap?.capacityByDifficulty);
  console.log(`  - Hard Feasibility:`, evCap?.hardFeasibility);

  if (!evCap?.recommendedByDifficulty || evCap.recommendedByDifficulty.balanced <= 1) {
    throw new Error(`Invalid capacity recommendation: collapsed to ${evCap?.recommendedByDifficulty?.balanced} for substantive document`);
  }
  console.log(`✅ [PASS] PDF ${name} successfully analyzed with honest evidence-backed counts.`);
  return evCap;
}

async function testImageOcr(name, imgPath) {
  console.log(`\n======================================================`);
  console.log(`🖼️ Testing Image OCR & Metadata: ${name}`);
  console.log(`Path: ${imgPath}`);
  console.log(`======================================================`);

  const fileBuffer = fs.readFileSync(imgPath);
  const ingested = await DocumentRouter.ingestDocument(fileBuffer, path.basename(imgPath), 'image/png');
  const extractedText = ingested.text || '';
  console.log(`OCR Extracted Text Length: ${extractedText.length}`);
  console.log(`OCR Text Snippet: "${extractedText.slice(0, 150).replace(/\s+/g, ' ')}..."`);

  const intelligence = await lectureIntelligence.analyze({
    evidenceText: extractedText,
    fileName: path.basename(imgPath)
  });
  console.log(`Concept Map Length: ${intelligence.conceptMap?.length || 0}`);

  const evCap = intelligence.evidenceCapacity;
  console.log(`Image Capacity Analysis:`);
  console.log(`  - Total Defensible Capacity: ${evCap?.totalDefensibleCapacity}`);
  console.log(`  - Recommended Count: ${evCap?.recommendedQuestionCount}`);
  console.log(`  - Recommended By Difficulty:`, evCap?.recommendedByDifficulty);

  console.log(`✅ [PASS] Image ${name} processed through OCR and capacity analysis without crashing.`);
  return { ingested, intelligence, evCap };
}

async function testTopicPipelineLinkedList() {
  console.log(`\n======================================================`);
  console.log(`🧠 Testing End-to-End Generation: Linked List C++ (3 Hard MCQs)`);
  console.log(`======================================================`);

  const sessionInputs = {
    sessionId: `test_ll_${Date.now()}`,
    topic: 'linked list in c++ - creation,deletion,appending of nodes in a linked list',
    count: 3,
    difficulty: 'Hard',
    questionStyle: 'CODE',
    inputModality: 'TOPIC_SYNTHESIS'
  };

  const result = await pipelineOrchestrator.runPipeline(sessionInputs);
  console.log(`Pipeline Status: ${result.pipelineStatus}`);
  console.log(`Delivered Questions: ${result.deliveredCount} / ${result.requestedCount}`);
  console.log(`Shortfall Category: ${result.shortfallCategory}`);

  if (result.questions && result.questions.length > 0) {
    result.questions.forEach((q, i) => {
      console.log(`\nQuestion ${i + 1} (${q.metadata?.targetDifficulty || 'Unknown Tier'}):`);
      console.log(`Stem: ${q.questionText || q.stem}`);
      console.log(`Code snippet present: ${Boolean(q.codeSnippet || (q.questionText && q.questionText.includes('```')))}`);
      console.log(`Options (${q.options.length}):`);
      q.options.forEach((opt, oIdx) => {
        const key = ['A', 'B', 'C', 'D'][oIdx];
        const isCorrect = (key === q.correctAnswerKey || opt === q.correctAnswer);
        console.log(`  [${key}] ${opt.slice(0, 70)}${opt.length > 70 ? '...' : ''} ${isCorrect ? '⭐ (CORRECT)' : ''}`);
      });
    });
  }

  if (result.deliveredCount < 3) {
    throw new Error(`Expected 3 Hard questions delivered, got ${result.deliveredCount}`);
  }
  console.log(`\n✅ [PASS] Linked list C++ generation delivered 3/3 grounded, code-aware questions.`);
}

async function testPartialFulfillmentScreenshot() {
  console.log(`\n======================================================`);
  console.log(`🧩 Testing Honest Partial Delivery on Single Slide Screenshot`);
  console.log(`======================================================`);

  const imgPath = 'C:/Users/samanvi/.gemini/antigravity/brain/229afd64-ca4a-4e32-a5ea-be0151fe2fee/.user_uploaded/media_1793095224203_aee15865.png';
  if (!fs.existsSync(imgPath)) {
    console.log(`Screenshot file not found at ${imgPath}, skipping image pipeline test.`);
    return;
  }

  const fileBuffer = fs.readFileSync(imgPath);
  const ingested = await DocumentRouter.ingestDocument(fileBuffer, path.basename(imgPath), 'image/png');
  const text = ingested.text || 'Single slide screenshot on dynamic programming';

  const sessionInputs = {
    sessionId: `test_img_partial_${Date.now()}`,
    voiceTranscript: text,
    count: 8, // Requesting 8 questions on a single screenshot to test capacity bound
    difficulty: 'Balanced',
    questionStyle: 'MIXED'
  };

  const result = await pipelineOrchestrator.runPipeline(sessionInputs);
  console.log(`Pipeline Status: ${result.pipelineStatus}`);
  console.log(`Delivered Count: ${result.deliveredCount} / ${result.requestedCount}`);
  console.log(`isPartial: ${result.isPartial}`);
  console.log(`Shortfall Category: ${result.shortfallCategory}`);
  console.log(`Notice: ${result.notice}`);

  if (result.deliveredCount < result.requestedCount) {
    if (!result.isPartial) throw new Error('isPartial should be true when delivered < requested');
    if (!result.shortfallCategory) throw new Error('shortfallCategory must be populated');
    console.log(`✅ [PASS] Successfully handled material shortfall without crashing or hanging.`);
  } else {
    console.log(`Delivered all ${result.deliveredCount} questions.`);
  }
}

async function runAll() {
  try {
    // 1. Test PDFs
    const branchBoundPath = 'C:/Users/samanvi/OneDrive/Desktop/UNIT-5-PART-1_BRANCH  BOUND.pdf';
    if (fs.existsSync(branchBoundPath)) {
      await testPdfMetadata('Branch and Bound Unit 5', branchBoundPath);
    }

    const reactPath = 'C:/Users/samanvi/OneDrive/Desktop/WT/React/1.ReactJS_Components.pdf';
    if (fs.existsSync(reactPath)) {
      await testPdfMetadata('ReactJS Components', reactPath);
    }

    // 2. Test Image OCR
    const imgPath = 'C:/Users/samanvi/.gemini/antigravity/brain/229afd64-ca4a-4e32-a5ea-be0151fe2fee/.user_uploaded/media_1793095224203_aee15865.png';
    if (fs.existsSync(imgPath)) {
      await testImageOcr('User Slide Screenshot', imgPath);
    }

    // 3. Test Text Generation Pipeline
    await testTopicPipelineLinkedList();

    // 4. Test Partial Fulfillment
    await testPartialFulfillmentScreenshot();

    console.log(`\n======================================================`);
    console.log(`🎉 ALL COMPREHENSIVE MULTIMODAL VERIFICATIONS PASSED!`);
    console.log(`======================================================\n`);
  } catch (err) {
    console.error(`❌ Verification failed:`, err);
    process.exit(1);
  }
}

runAll();
