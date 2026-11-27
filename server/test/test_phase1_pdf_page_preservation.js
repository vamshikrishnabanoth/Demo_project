/**
 * Regression Test: Phase 1 PDF Page Preservation & Fallback Verification
 * Target: MULTI_005 (DAA - Greedy Algorithms) material.pdf
 * 
 * Verifies:
 * 1. Direct PdfMultimodalExtractor extracts all 3 pages with explicit page markers
 * 2. Cold-Cache SourceService Ingestion executes extractor (cache MISS) and preserves all page delimiters
 * 3. HierarchicalChunker creates exactly 3 slide evidence chunks with pageNumber preserved
 * 4. Controller metadata extraction logic returns totalCount=3 with intact page delimiters
 * 5. Fallback verification: when PdfMultimodalExtractor fails, legacy pdfParse fallback is logged
 *    and unsegmented text is confirmed NOT to claim page preservation
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const sourceService = require('../services/sourceService');
const { HierarchicalChunker } = require('../engine/evidence/hierarchicalChunker');
const PdfMultimodalExtractor = require('../engine/documentRouter/pdfMultimodalExtractor');
const cacheManager = require('../utils/cacheManager');
const { generateAssetCacheKey } = require('../utils/cacheHash');

const PDF_PATH = path.resolve(__dirname, '../../evaluation_dataset/VOICE_PLUS_MATERIAL/MULTI_005/material.pdf');

function invalidateCacheForFile(filePath) {
  const stats = fs.statSync(filePath);
  const fileBuffer = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const cacheKey = generateAssetCacheKey(fileBuffer, stats.size, ext);
  cacheManager.l1.delete(cacheKey);
  const l2Path = cacheManager.getL2Path(cacheKey);
  if (fs.existsSync(l2Path)) {
    fs.unlinkSync(l2Path);
  }
  return cacheKey;
}

async function runTests() {
  console.log('================================================================');
  console.log('RUNNING REGRESSION TEST: Phase 1 PDF Page Preservation');
  console.log(`Target PDF: ${PDF_PATH}`);
  console.log('================================================================\n');

  assert(fs.existsSync(PDF_PATH), `Test PDF file does not exist at ${PDF_PATH}`);

  // Test 1: Direct PdfMultimodalExtractor extraction
  console.log('--- Test 1: Direct PdfMultimodalExtractor Extraction ---');
  const fileBuffer = fs.readFileSync(PDF_PATH);
  const docModel = await PdfMultimodalExtractor.extract(fileBuffer, { filename: path.basename(PDF_PATH) });

  assert.strictEqual(docModel.pages.length, 3, `Expected 3 pages, found ${docModel.pages.length}`);
  assert.strictEqual(docModel.totalPages, 3, `Expected totalPages === 3, found ${docModel.totalPages}`);
  console.log(`[PASS] Page count verified: ${docModel.pages.length} pages`);

  for (let i = 0; i < docModel.pages.length; i++) {
    const page = docModel.pages[i];
    assert.strictEqual(page.pageNumber, i + 1, `Page index ${i} has pageNumber ${page.pageNumber}`);
    const pageText = page.blocks.map(b => b.content).join('\n');
    assert(pageText && pageText.length > 50, `Page ${i + 1} has insufficient text: ${pageText.length} chars`);
    const wordCount = pageText.split(/\s+/).filter(Boolean).length;
    console.log(`[PASS] Page ${page.pageNumber}: length=${pageText.length} chars, wordCount=${wordCount}`);
  }

  // Test 2: Cold-Cache SourceService Ingestion & Unified Text Output
  console.log('\n--- Test 2: Cold-Cache SourceService Ingestion & Unified Text Output ---');
  // Invalidate cache entry to guarantee a cold execution
  const clearedKey = invalidateCacheForFile(PDF_PATH);
  console.log(`[CACHE INVAL] Evicted cache key ${clearedKey} to enforce cold cache`);

  const extractedText = await sourceService.extractTextFromFile(PDF_PATH, 'test-phase1-cold-run');

  assert(extractedText.includes('--- Page 1 ---'), 'Missing "--- Page 1 ---" delimiter');
  assert(extractedText.includes('--- Page 2 ---'), 'Missing "--- Page 2 ---" delimiter');
  assert(extractedText.includes('--- Page 3 ---'), 'Missing "--- Page 3 ---" delimiter');
  console.log('[PASS] Unified text contains all 3 page delimiters ("--- Page 1 ---", "--- Page 2 ---", "--- Page 3 ---")');

  // Verify Page 1 content (Stock Trading Problem & Example 1)
  assert(extractedText.includes('Given an array price[] of length N') || extractedText.includes('maximum profit possible'), 'Page 1 missing problem statement');
  assert(extractedText.includes('Example - 1') || extractedText.includes('Example 1'), 'Page 1 missing Example 1');
  assert(extractedText.includes('7 1 5 3 6 4'), 'Page 1 missing Example 1 price array');
  console.log('[PASS] Page 1 content verified (Problem statement & Example 1 [7 1 5 3 6 4], output = 7)');

  // Verify Page 2 content (Explanation & Example 2)
  assert(extractedText.includes('Purchase on 2nd day. Price = 1.'), 'Page 2 missing day 2 purchase explanation');
  assert(extractedText.includes('Example - 2') || extractedText.includes('Example 2'), 'Page 2 missing Example 2');
  assert(extractedText.includes('1 2 3 4 5'), 'Page 2 missing Example 2 price array');
  console.log('[PASS] Page 2 content verified (Purchase/Sell explanation & Example 2 [1 2 3 4 5], output = 4)');

  // Verify Page 3 content (C++ Code)
  assert(extractedText.includes('int minprice = INTMAX;'), 'Page 3 missing minprice declaration');
  assert(extractedText.includes('max_profit += (prices[i + 1] - prices[i]);'), 'Page 3 missing infinite transaction formula');
  console.log('[PASS] Page 3 code block verified (minprice declaration and infinite transaction difference logic)');

  // Test 3: HierarchicalChunker building store from extracted document text
  console.log('\n--- Test 3: HierarchicalChunker Page Boundary Preservation ---');
  const store = HierarchicalChunker.buildStore({
    documentTexts: [extractedText]
  });

  const slideChildren = store.children.filter(c => c.sourceType === 'SLIDE');
  const slideParents = store.parents.filter(p => p.sourceType === 'SLIDE');

  assert.strictEqual(slideChildren.length, 3, `Expected exactly 3 slide child chunks, found ${slideChildren.length}`);
  assert.strictEqual(slideParents.length, 3, `Expected exactly 3 slide parent chunks, found ${slideParents.length}`);
  console.log(`[PASS] HierarchicalChunker produced exactly 3 slide child chunks and 3 slide parent chunks`);

  // Verify Page 1 Chunk
  const c1 = slideChildren[0];
  const p1 = slideParents[0];
  assert.strictEqual(c1.evidenceId, 'E_SLIDE_1', `Expected E_SLIDE_1, found ${c1.evidenceId}`);
  assert.strictEqual(c1.pageNumber, 1, `Expected child pageNumber === 1, found ${c1.pageNumber}`);
  assert.strictEqual(p1.evidenceId, 'E_PARENT_SLIDE_1', `Expected E_PARENT_SLIDE_1, found ${p1.evidenceId}`);
  assert.strictEqual(p1.pageNumber, 1, `Expected parent pageNumber === 1, found ${p1.pageNumber}`);
  assert.strictEqual(p1.title, 'Page 1 Full Context', `Expected "Page 1 Full Context", found "${p1.title}"`);
  assert(c1.text.includes('Example - 1') || c1.text.includes('Example 1'), 'E_SLIDE_1 missing Example 1');
  console.log(`[PASS] E_SLIDE_1 verified: pageNumber=${c1.pageNumber}, words=${c1.wordCount}, title="${p1.title}"`);

  // Verify Page 2 Chunk
  const c2 = slideChildren[1];
  const p2 = slideParents[1];
  assert.strictEqual(c2.evidenceId, 'E_SLIDE_2', `Expected E_SLIDE_2, found ${c2.evidenceId}`);
  assert.strictEqual(c2.pageNumber, 2, `Expected child pageNumber === 2, found ${c2.pageNumber}`);
  assert.strictEqual(p2.evidenceId, 'E_PARENT_SLIDE_2', `Expected E_PARENT_SLIDE_2, found ${p2.evidenceId}`);
  assert.strictEqual(p2.pageNumber, 2, `Expected parent pageNumber === 2, found ${p2.pageNumber}`);
  assert.strictEqual(p2.title, 'Page 2 Full Context', `Expected "Page 2 Full Context", found "${p2.title}"`);
  assert(c2.text.includes('Example - 2') || c2.text.includes('Example 2'), 'E_SLIDE_2 missing Example 2');
  console.log(`[PASS] E_SLIDE_2 verified: pageNumber=${c2.pageNumber}, words=${c2.wordCount}, title="${p2.title}"`);

  // Verify Page 3 Chunk
  const c3 = slideChildren[2];
  const p3 = slideParents[2];
  assert.strictEqual(c3.evidenceId, 'E_SLIDE_3', `Expected E_SLIDE_3, found ${c3.evidenceId}`);
  assert.strictEqual(c3.pageNumber, 3, `Expected child pageNumber === 3, found ${c3.pageNumber}`);
  assert.strictEqual(p3.evidenceId, 'E_PARENT_SLIDE_3', `Expected E_PARENT_SLIDE_3, found ${p3.evidenceId}`);
  assert.strictEqual(p3.pageNumber, 3, `Expected parent pageNumber === 3, found ${p3.pageNumber}`);
  assert.strictEqual(p3.title, 'Page 3 Full Context', `Expected "Page 3 Full Context", found "${p3.title}"`);
  assert(c3.text.includes('int minprice = INTMAX;'), 'E_SLIDE_3 missing minprice code');
  assert(c3.text.includes('max_profit += (prices[i + 1] - prices[i]);'), 'E_SLIDE_3 missing profit accumulation code');
  console.log(`[PASS] E_SLIDE_3 verified: pageNumber=${c3.pageNumber}, words=${c3.wordCount}, title="${p3.title}"`);

  // Test 4: Controller Metadata Extraction Alignment
  console.log('\n--- Test 4: Controller Metadata Extractor Alignment ---');
  const metaExtract = await PdfMultimodalExtractor.extract(fileBuffer, { filename: 'material.pdf' });
  const totalCount = metaExtract.totalPages || metaExtract.pages.length || 1;
  const metaUnified = metaExtract.toUnifiedText();
  assert.strictEqual(totalCount, 3, `Expected metadata totalCount === 3, got ${totalCount}`);
  assert(metaUnified.includes('--- Page 3 ---'), 'Metadata unified text missing Page 3 delimiter');
  console.log(`[PASS] Controller metadata extraction logic returns totalCount=3 with intact page delimiters`);

  // Test 5: Fallback Verification (PdfMultimodalExtractor failure handled gracefully)
  console.log('\n--- Test 5: Fallback Path Verification (PdfMultimodalExtractor Failure) ---');
  const origExtract = PdfMultimodalExtractor.extract;
  let loggedWarning = '';
  const origWarn = console.warn;
  console.warn = (...args) => {
    loggedWarning += args.join(' ') + '\n';
    origWarn(...args);
  };

  try {
    // Invalidate cache so extraction is attempted
    invalidateCacheForFile(PDF_PATH);

    // Mock PdfMultimodalExtractor.extract to throw error
    PdfMultimodalExtractor.extract = async () => {
      throw new Error('Simulated parser exception / corrupted PDF stream');
    };

    const fallbackText = await sourceService.extractTextFromFile(PDF_PATH, 'test-fallback-run');

    // 1. Confirm fallback warning was logged clearly
    assert(
      loggedWarning.includes('⚠️ [SourceService] PdfMultimodalExtractor notice: Simulated parser exception / corrupted PDF stream. Falling back to default pdfParse.'),
      'Expected fallback warning message was not logged'
    );
    console.log('[PASS] Fallback notice logged clearly via console.warn');

    // 2. Confirm fallback text was produced by legacy pdfParse (flat string)
    assert(fallbackText && fallbackText.length > 100, 'Fallback text should not be empty');
    assert.strictEqual(fallbackText.includes('--- Page 1 ---'), false, 'Fallback text MUST NOT contain "--- Page 1 ---"');
    assert.strictEqual(fallbackText.includes('--- Page 2 ---'), false, 'Fallback text MUST NOT contain "--- Page 2 ---"');
    assert.strictEqual(fallbackText.includes('--- Page 3 ---'), false, 'Fallback text MUST NOT contain "--- Page 3 ---"');
    console.log('[PASS] Fallback output confirmed: legacy pdfParse produces flat unsegmented text with NO page delimiters');

    // 3. Confirm HierarchicalChunker DOES NOT claim page preservation for fallback text
    const fallbackStore = HierarchicalChunker.buildStore({
      documentTexts: [fallbackText]
    });
    const fallbackSlideChildren = fallbackStore.children.filter(c => c.sourceType === 'SLIDE');
    assert.strictEqual(fallbackSlideChildren.length, 1, `Fallback chunker expected 1 unsegmented chunk, got ${fallbackSlideChildren.length}`);
    assert.notStrictEqual(fallbackStore.parents[0]?.title, 'Page 1 Full Context', 'Fallback parent MUST NOT claim "Page 1 Full Context"');
    console.log(`[PASS] HierarchicalChunker correctly treats fallback as 1 unsegmented chunk (${fallbackStore.parents[0]?.title}) without claiming page preservation`);

  } finally {
    // Restore original methods and clear fallback cache entry
    PdfMultimodalExtractor.extract = origExtract;
    console.warn = origWarn;
    invalidateCacheForFile(PDF_PATH);
  }

  console.log('\n================================================================');
  console.log('ALL PHASE 1 REGRESSION TESTS PASSED (100%)');
  console.log('================================================================');
}

runTests().catch(err => {
  console.error('\n❌ REGRESSION TEST FAILED:', err);
  process.exit(1);
});
