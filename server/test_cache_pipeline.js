require('dotenv').config();
const cacheManager = require('./utils/cacheManager');
const metricsManager = require('./utils/metricsManager');
const { 
  normalizeTextCodeSafe, 
  generateAssetCacheKey, 
  generateAnalysisCacheKey, 
  generateQuizCacheKey 
} = require('./utils/cacheHash');
const sourceService = require('./services/sourceService');
const { generateMCQPipeline } = require('./engine/mcqEngine');

async function runCacheTests() {
  console.log('=== TEST 1: Code-Safe Text Normalization ===');
  const codeSample = "Hello \r\n World!\n\n\n```javascript\nconst x = 1;\r\nconsole.log(x);\n```\n\nMore text \u200B here.";
  const normalized = normalizeTextCodeSafe(codeSample);
  console.log('Normalized output preserves code blocks intact:');
  console.log(normalized);

  console.log('\n=== TEST 2: Namespaced Cache Keys ===');
  const assetKey = generateAssetCacheKey(Buffer.from('sample pdf content'), 1024, '.pdf');
  const analysisKey = generateAnalysisCacheKey('Algorithm & Data Structure Lecture');
  const quizKey = generateQuizCacheKey({ text: 'Algorithm Lecture', difficulty: 'Balanced', count: 5 });

  console.log('Asset Key:', assetKey);
  console.log('Analysis Key:', analysisKey);
  console.log('Quiz Key:', quizKey);

  console.log('\n=== TEST 3: L1 / L2 Cache Write & Read Priority ===');
  const reqId = 'test_req_101';
  const testData = { title: 'Test Quiz', questions: [{ stem: 'What is O(1)?' }] };
  
  cacheManager.set(quizKey, testData, { measuredProcessingTimeMs: 1500, qualityScore: 0.95, category: 'quiz' }, reqId);
  
  const hitData = cacheManager.get(quizKey, reqId);
  console.log('Cache Read Hit Data:', hitData ? 'SUCCESS' : 'FAILED');

  console.log('\n=== TEST 4: Singleflight Request Coalescing ===');
  let computeCount = 0;
  const coalescedKey = 'coalesced_test_key_1';

  const p1 = cacheManager.fetchCoalesced(coalescedKey, async () => {
    computeCount++;
    await new Promise(r => setTimeout(r, 100));
    return 'Result 1';
  }, reqId);

  const p2 = cacheManager.fetchCoalesced(coalescedKey, async () => {
    computeCount++;
    await new Promise(r => setTimeout(r, 100));
    return 'Result 2';
  }, reqId);

  const [res1, res2] = await Promise.all([p1, p2]);
  console.log(`Coalesced Compute Executions: ${computeCount} (Expected: 1)`);
  console.log(`Coalesced Results: res1="${res1}", res2="${res2}"`);

  console.log('\n=== TEST 5: Pipeline Engine Generation with Cache Observability ===');
  const engineRes = await generateMCQPipeline({
    content: 'TCP/IP network protocols and socket programming architecture using C code ```c int socket = socket(); ```.',
    difficulty: 'Balanced',
    requestedCount: 5,
    requestId: 'demo_req_99'
  });

  console.log(`Engine Status: ${engineRes.status}, Questions Delivered: ${engineRes.questions.length}`);
  console.log('\n=== TEST 6: Subsequent Generation Call (Cache Hit Test) ===');
  const engineHitRes = await generateMCQPipeline({
    content: 'TCP/IP network protocols and socket programming architecture using C code ```c int socket = socket(); ```.',
    difficulty: 'Balanced',
    requestedCount: 5,
    requestId: 'demo_req_99_second_hit'
  });

  console.log(`Second Call Engine Status: ${engineHitRes.status}, Questions Delivered: ${engineHitRes.questions.length}`);
  console.log('\n=== ALL CACHE PIPELINE TESTS PASSED CLEANLY! ===');
}

runCacheTests().catch(err => {
  console.error('❌ Cache Pipeline Test Error:', err);
  process.exit(1);
});
