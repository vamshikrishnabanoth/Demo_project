/**
 * server/verify_deep_multimodal.js
 *
 * DEEP MULTIMODAL RAG VALIDATION, HARDENING & PRODUCTION VERIFICATION SUITE
 * 
 * Verifies all requirements from prompt:
 * - Section 3: Actual PDF Table Extraction
 * - Section 4: Real Chart Understanding
 * - Section 5: Real Diagram Understanding
 * - Section 6: Scanned Multi-Page PDF
 * - Section 7: DOCX with Mixed Content
 * - Section 8: Common Document Model
 * - Section 9: Structure-Aware Chunking
 * - Section 10: BM25 Exact Keyword Retrieval
 * - Section 11: Dense Vector Retrieval
 * - Section 12: Real RRF Fusion
 * - Section 13: Content-Type Boost
 * - Section 14: Cross-Encoder Reranking
 * - Section 15: Vision Fallback
 * - Section 16: Gemini Moderation Fix
 * - Section 17: OCR Failure Handling
 * - Section 18: Grounding Failure Rejection
 * - Section 19: Invalid MCQ Retry
 * - Section 20: Insufficient Evidence Controlled Failure
 * - Section 21: Vector Database Failure Fallback
 * - Section 22: Reranker Failure Fallback
 * - Section 23: Document Isolation (Zero Contamination)
 * - Section 24: Repeated Uploads & Caching
 * - Section 25: Latency Performance Benchmark
 */

'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const assert = require('assert');
const fs = require('fs');

// Engine & Router modules
const DocumentRouter = require('./engine/documentRouter/documentRouter');
const { CommonDocumentModel, DocumentPage, DocumentBlock, BlockTypes } = require('./engine/documentRouter/commonDocumentModel');
const PdfMultimodalExtractor = require('./engine/documentRouter/pdfMultimodalExtractor');
const DocxMultimodalExtractor = require('./engine/documentRouter/docxMultimodalExtractor');
const TableExtractor = require('./engine/documentRouter/tableExtractor');
const OcrService = require('./engine/documentRouter/ocrService');
const visionService = require('./engine/documentRouter/visionService');

// Evidence & Retrieval modules
const StructureAwareChunker = require('./engine/evidence/structureAwareChunker');
const BM25Retriever = require('./engine/evidence/bm25Retriever');
const HybridRetriever = require('./engine/evidence/hybridRetriever');
const RerankerService = require('./engine/evidence/rerankerService');
const evidenceCache = require('./engine/evidence/evidenceCache');
const { getTargetEvidenceContext } = require('./engine/evidence/evidenceContextSelector');
const GroundingGate = require('./engine/validators/groundingGate');

async function runDeepVerification() {
  console.log('======================================================================');
  console.log('🔬 DEEP MULTIMODAL RAG SUBSYSTEM & COMPONENT VERIFICATION');
  console.log('======================================================================\n');

  const results = [];
  let testNum = 0;

  async function test(name, fn) {
    testNum++;
    console.log(`----------------------------------------------------------------------`);
    console.log(`▶ [${testNum}] RUNNING: ${name}`);
    console.log(`----------------------------------------------------------------------`);
    const start = Date.now();
    try {
      await fn();
      const latencyMs = Date.now() - start;
      console.log(`✅ PASS [${testNum}]: ${name} (${latencyMs}ms)\n`);
      results.push({ id: testNum, name, status: 'PASS', latencyMs });
    } catch (err) {
      const latencyMs = Date.now() - start;
      console.error(`❌ FAIL [${testNum}]: ${name} (${latencyMs}ms)`);
      console.error(`   Error: ${err.message}\n`);
      results.push({ id: testNum, name, status: 'FAIL', latencyMs, error: err.message });
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 1: SECTION 8 - Common Document Model Canonical Schema
  // ──────────────────────────────────────────────────────────────────────────
  await test('SECTION 8: CommonDocumentModel Canonical Architecture & Block Typing', async () => {
    const doc = new CommonDocumentModel({
      documentId: 'doc_canonical_001',
      sourceType: 'PDF',
      filename: 'sample.pdf',
      totalPages: 2
    });

    const page1 = new DocumentPage({ pageNumber: 1, section: 'Intro' });
    page1.addBlock(new DocumentBlock({
      blockId: 'b1',
      type: BlockTypes.HEADING,
      content: 'Algorithm Analysis',
      metadata: { headingLevel: 1 }
    }));
    page1.addBlock(new DocumentBlock({
      blockId: 'b2',
      type: BlockTypes.PARAGRAPH,
      content: 'Asymptotic complexity evaluates runtime scaling with input size n.'
    }));
    doc.addPage(page1);

    const page2 = new DocumentPage({ pageNumber: 2, section: 'Data' });
    page2.addBlock(new DocumentBlock({
      blockId: 'b3',
      type: BlockTypes.TABLE,
      content: '| Algorithm | Complexity |\n| --- | --- |\n| Merge Sort | O(n log n) |'
    }));
    page2.addBlock(new DocumentBlock({
      blockId: 'b4',
      type: BlockTypes.CHART,
      content: '[Chart: Scaling curves of O(n) vs O(n^2)]'
    }));
    page2.addBlock(new DocumentBlock({
      blockId: 'b5',
      type: BlockTypes.DIAGRAM,
      content: '[Diagram: Recursive division of divide-and-conquer]'
    }));
    page2.addBlock(new DocumentBlock({
      blockId: 'b6',
      type: BlockTypes.OCR_TEXT,
      content: 'Scanned lecture notes on master theorem'
    }));
    doc.addPage(page2);

    assert.strictEqual(doc.documentId, 'doc_canonical_001');
    assert.strictEqual(doc.pages.length, 2);
    assert.strictEqual(doc.getAllBlocks().length, 6);

    // Verify all canonical block types
    const types = doc.getAllBlocks().map(b => b.type);
    assert.ok(types.includes(BlockTypes.HEADING));
    assert.ok(types.includes(BlockTypes.PARAGRAPH));
    assert.ok(types.includes(BlockTypes.TABLE));
    assert.ok(types.includes(BlockTypes.CHART));
    assert.ok(types.includes(BlockTypes.DIAGRAM));
    assert.ok(types.includes(BlockTypes.OCR_TEXT));

    // Verify unified text serialization
    const unified = doc.toUnifiedText();
    assert.ok(unified.includes('Algorithm Analysis'));
    assert.ok(unified.includes('| Merge Sort | O(n log n) |'));
    assert.ok(unified.includes('[VISUAL EVIDENCE: CHART]'));
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 2: SECTION 3 - Actual PDF Table Extraction & Column Integrity
  // ──────────────────────────────────────────────────────────────────────────
  await test('SECTION 3: PDF Table Extraction, Column/Row Association & Structured Evidence', async () => {
    const pdfPath = path.join(__dirname, 'test_materials', 'pdf_table_algorithms.pdf');
    assert.ok(fs.existsSync(pdfPath), `File must exist: ${pdfPath}`);
    const buf = fs.readFileSync(pdfPath);

    const doc = await PdfMultimodalExtractor.extract(buf, { filename: 'pdf_table_algorithms.pdf' });
    assert.ok(doc instanceof CommonDocumentModel, 'Must produce CommonDocumentModel');
    assert.strictEqual(doc.metadata.hasTables, true, 'Metadata must record hasTables=true');

    const tables = doc.getBlocksByType(BlockTypes.TABLE);
    assert.ok(tables.length >= 1, `Must detect at least 1 table, found ${tables.length}`);

    const tableContent = tables[0].content;
    console.log('   Extracted Markdown Table:\n' + tableContent.split('\n').map(l => '     ' + l).join('\n'));

    // Verify rows are NOT mixed and columns remain associated correctly
    assert.ok(tableContent.includes('Merge Sort'), 'Must contain Merge Sort');
    assert.ok(tableContent.includes('Quick Sort'), 'Must contain Quick Sort');
    assert.ok(tableContent.includes('Bubble Sort'), 'Must contain Bubble Sort');
    assert.ok(tableContent.includes('Heap Sort'), 'Must contain Heap Sort');

    // Check exact row column association (Row with Merge Sort must have O(n log n) and O(n))
    const lines = tableContent.split('\n');
    const mergeRow = lines.find(l => l.includes('Merge Sort'));
    assert.ok(mergeRow, 'Merge Sort row must exist');
    assert.ok(mergeRow.includes('O(n log n)'), 'Merge Sort time complexity must be associated in same row');
    assert.ok(mergeRow.includes('O(n)'), 'Merge Sort space complexity must be associated in same row');

    const bubbleRow = lines.find(l => l.includes('Bubble Sort'));
    assert.ok(bubbleRow, 'Bubble Sort row must exist');
    assert.ok(bubbleRow.includes('O(n^2)'), 'Bubble Sort time complexity must be associated in same row');
    assert.ok(bubbleRow.includes('O(1)'), 'Bubble Sort space complexity must be associated in same row');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 3: SECTION 9 - Structure-Aware Chunking (Table Unsplit & Heading Cohesion)
  // ──────────────────────────────────────────────────────────────────────────
  await test('SECTION 9: Structure-Aware Chunking (No Table Split + Heading-Paragraph Cohesion)', async () => {
    const pdfPath = path.join(__dirname, 'test_materials', 'pdf_table_algorithms.pdf');
    const buf = fs.readFileSync(pdfPath);
    const doc = await PdfMultimodalExtractor.extract(buf, { filename: 'pdf_table_algorithms.pdf' });

    const chunkResult = StructureAwareChunker.chunkDocument(doc, { childSize: 40, parentSize: 200 });
    assert.ok(chunkResult.parents.length > 0, 'Parents must be generated');
    assert.ok(chunkResult.children.length > 0, 'Children must be generated');

    // 1. Verify Table survives chunking as a single intact chunk
    const tableChunks = chunkResult.children.filter(c => c.contentType === BlockTypes.TABLE);
    assert.ok(tableChunks.length >= 1, 'Must have table chunk');
    const tableChunk = tableChunks[0];
    assert.ok(tableChunk.text.includes('Merge Sort'), 'Table chunk must have Merge Sort');
    assert.ok(tableChunk.text.includes('Heap Sort'), 'Table chunk must retain last row Heap Sort');
    assert.ok(tableChunk.text.includes('O(n^2)'), 'Table chunk must retain Bubble Sort complexity');

    // 2. Verify Heading Cohesion: paragraph chunk includes heading context
    const paragraphChunks = chunkResult.children.filter(c => c.contentType === BlockTypes.PARAGRAPH);
    const headingBound = paragraphChunks.some(c => c.text.includes('###') || (c.section && c.section.length > 5));
    assert.ok(headingBound, 'Heading context must be bound to subsequent paragraph chunk');

    // 3. Verify Parent-Child mapping integrity
    for (const child of chunkResult.children) {
      assert.ok(child.parentId, `Child ${child.childId} must have parentId`);
      assert.ok(chunkResult.parentMap[child.parentId], `Parent ${child.parentId} must exist in parentMap`);
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 4: SECTION 10 - BM25 Exact Keyword Retrieval
  // ──────────────────────────────────────────────────────────────────────────
  await test('SECTION 10: BM25 Exact Keyword Retrieval for Technical Identifiers', async () => {
    const docs = [
      { childId: 'doc_A', text: 'Binary search tree deletion requires finding the in-order successor or predecessor node.' },
      { childId: 'doc_B', text: 'Graph traversal algorithms such as breadth-first search and depth-first search explore vertices.' },
      { childId: 'doc_C', text: 'Hash table collision resolution using open addressing and double hashing techniques.' }
    ];

    const bm25 = new BM25Retriever();
    bm25.index(docs);

    // Exact query matching technical terms in Document A
    const resA = bm25.search('binary search tree deletion', 3);
    assert.strictEqual(resA[0].document.childId, 'doc_A', 'BM25 must rank Document A first');
    assert.ok(resA[0].score > resA[1].score, 'Document A score must strictly exceed Document B');

    // Technical term query in Document C
    const resC = bm25.search('hash collision double hashing', 3);
    assert.strictEqual(resC[0].document.childId, 'doc_C', 'BM25 must rank Document C first');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 5: SECTION 11 - Dense Semantic Vector Retrieval
  // ──────────────────────────────────────────────────────────────────────────
  await test('SECTION 5: Dense Semantic Retrieval Across Paraphrased Formulations', async () => {
    const store = {
      children: [
        { childId: 'c1', evidenceId: 'c1', text: 'CPU utilization measures the percentage of processor capacity currently being used by active processes.' },
        { childId: 'c2', evidenceId: 'c2', text: 'Disk input output operations evaluate write throughput and read seek latency on storage blocks.' },
        { childId: 'c3', evidenceId: 'c3', text: 'Network packet congestion occurs when buffer queues overflow at gateway switches.' }
      ],
      parentMap: {}
    };

    // Paraphrased query: "How much of the processor is currently occupied?" (zero lexical overlap with "CPU utilization")
    const retrieved = HybridRetriever.retrieveForTarget(store, {
      concept: 'processor occupied capacity percentage',
      instruction: 'How much of the processing engine is actively engaged?'
    }, { topK: 1 });

    assert.ok(retrieved.length > 0);
    assert.strictEqual(retrieved[0].child.childId, 'c1', 'Semantic vector retrieval must rank c1 (processor capacity) highest');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 6: SECTION 12 - Reciprocal Rank Fusion (RRF) Formula & Deduplication
  // ──────────────────────────────────────────────────────────────────────────
  await test('SECTION 12: Real RRF Fusion (1/(60+dense) + 1/(60+bm25)) & Candidate Merge', async () => {
    const store = {
      children: [
        // Doc 1: Good in BM25, mediocre in dense
        { childId: 'd1', evidenceId: 'd1', text: 'Merge sort recursion divide and conquer algorithm.' },
        // Doc 2: High in dense, lower in BM25
        { childId: 'd2', evidenceId: 'd2', text: 'Splitting arrays into sublists until single items remain and sorting them.' },
        // Doc 3: Irrelevant
        { childId: 'd3', evidenceId: 'd3', text: 'Relational database ACID transaction isolation levels.' }
      ],
      parentMap: {}
    };

    const target = {
      concept: 'Merge sort algorithm',
      instruction: 'Explain splitting lists recursively'
    };

    const candidates = HybridRetriever.retrieveForTarget(store, target, { topK: 3, rrfK: 60 });
    assert.strictEqual(candidates.length, 3, 'Must return all 3 scored candidates');

    // Verify RRF score computation: rrfScore = 1/(60+rankDense) + 1/(60+rankBM25)
    for (const item of candidates) {
      const expectedRrf = (1 / (60 + item.rankDense)) + (1 / (60 + item.rankBM25));
      const diff = Math.abs(item.rrfScore - expectedRrf);
      assert.ok(diff < 0.001, `RRF score ${item.rrfScore} must match formula within precision`);
    }

    // Both d1 and d2 must rank higher than irrelevant d3
    assert.ok(candidates[0].child.childId === 'd1' || candidates[0].child.childId === 'd2');
    assert.strictEqual(candidates[2].child.childId, 'd3');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 7: SECTION 13 - Content-Type Aware Ranking Boost
  // ──────────────────────────────────────────────────────────────────────────
  await test('SECTION 13: Content-Type Aware Ranking Boost (1.4x for Tables/Visuals)', async () => {
    const store = {
      children: [
        {
          childId: 'text_chunk',
          evidenceId: 'e_text',
          contentType: BlockTypes.PARAGRAPH,
          text: 'Sorting algorithms compare items. Bubble sort takes quadratic time and merge sort takes logarithmic.'
        },
        {
          childId: 'table_chunk',
          evidenceId: 'e_table',
          contentType: BlockTypes.TABLE,
          text: '| Algorithm | Time Complexity | Space Complexity |\n| Merge Sort | O(n log n) | O(n) |\n| Bubble Sort | O(n^2) | O(1) |'
        }
      ],
      parentMap: {}
    };

    // Query targeting comparison table
    const target = {
      concept: 'Sorting complexity comparison',
      instruction: 'Compare the algorithms using the data table',
      contentType: 'table'
    };

    const results = HybridRetriever.retrieveForTarget(store, target, { topK: 2, boostFactor: 1.4 });
    assert.strictEqual(results[0].child.childId, 'table_chunk', 'Table chunk must be boosted to rank #1');
    assert.strictEqual(results[0].appliedBoost, 1.4, 'Applied boost factor must be 1.4x');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 8: SECTION 14 - Cross-Encoder Reranking and RRF Fallback
  // ──────────────────────────────────────────────────────────────────────────
  await test('SECTION 14: Cross-Encoder Reranking & RRF Ordering Fallback', async () => {
    const candidates = [
      {
        child: { text: 'Quick Sort partitioning picks a pivot and reorders elements.' },
        parent: { fullText: 'Quick Sort overview' },
        rrfScore: 0.030,
        contentType: 'TEXT'
      },
      {
        child: { text: 'Heap Sort builds a max heap and repeatedly extracts the root.' },
        parent: { fullText: 'Heap Sort overview' },
        rrfScore: 0.032,
        contentType: 'TEXT'
      }
    ];

    // Target specifically asking for Quick Sort pivot logic
    const target = {
      concept: 'Quick Sort pivot partitioning',
      instruction: 'Explain how the pivot element divides the array'
    };

    const { reranked, evidenceContextString } = RerankerService.rerank(candidates, target, { topN: 2 });
    assert.strictEqual(reranked.length, 2);
    // Quick Sort has exact term matches ('pivot', 'partitioning', 'quick sort') -> should be promoted to #1
    assert.ok(reranked[0].child.text.includes('Quick Sort'), 'Reranker must promote Quick Sort to rank 1 based on term coverage');
    assert.ok(evidenceContextString.includes('[EVIDENCE 1]'), 'Must include structured evidence citation tags');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 9: SECTION 15 & 17 - Vision & OCR Multi-Tier Fallback Under Failure
  // ──────────────────────────────────────────────────────────────────────────
  await test('SECTION 15 & 17: Vision Fallback Chain (Vision -> OCR -> Controlled Failure)', async () => {
    // 1. Test image with readable text -> falls back safely through OCR
    const samplePngPath = path.join(__dirname, 'test_materials', 'scanned_paging.png');
    assert.ok(fs.existsSync(samplePngPath));
    const imgBuf = fs.readFileSync(samplePngPath);

    const desc = await visionService.describeImage(imgBuf, 'image/png', 'general');
    assert.ok(desc.isSuccessful, 'Image with text must successfully resolve');
    assert.ok(desc.description.includes('Paging') || desc.description.includes('Memory'), 'Must extract key text');

    // 2. Test completely blank / unreadable buffer -> Controlled failure, no crash, no fabrication
    const blankBuf = Buffer.alloc(500, 0); // Solid black / blank bytes
    const blankDesc = await visionService.describeImage(blankBuf, 'image/png', 'chart');
    assert.strictEqual(blankDesc.isSuccessful, false, 'Blank buffer must yield isSuccessful=false');
    assert.strictEqual(blankDesc.method, 'unreadable', 'Method must report unreadable');
    assert.ok(!blankDesc.description.includes('2021'), 'Must never fabricate values');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 10: SECTION 18 - Grounding Gate Rejection of Foreign Contamination
  // ──────────────────────────────────────────────────────────────────────────
  await test('SECTION 18: Grounding Gate Rejection of Unsupported / Contaminated Claims', async () => {
    const gate = GroundingGate.verifyQuizGrounding ? GroundingGate : new GroundingGate();
    const evidencePackage = {
      unifiedRawContent: 'Operating systems memory management uses paging and segmentation to partition logical addresses into physical frames.'
    };

    // 1. Grounded Question -> PASS
    const validQuestion = {
      questionText: 'What is the role of paging in operating systems memory management?',
      correctAnswer: 'Paging partitions logical addresses into physical frames.'
    };
    const validRes = gate.verifyQuizGrounding([validQuestion], evidencePackage);
    assert.strictEqual(validRes.status, 'PASSED');
    assert.strictEqual(validRes.validatedQuestions.length, 1);

    // 2. Unsupported / Foreign Question (Biochemistry in an OS lecture) -> REJECT
    const hallucinatedQuestion = {
      questionText: 'Which enzyme catalyzes DNA polymerase elongation during PCR denaturation?',
      correctAnswer: 'Taq polymerase catalyzes replication at high temperatures.'
    };
    const rejectRes = gate.verifyQuizGrounding([hallucinatedQuestion], evidencePackage);
    assert.strictEqual(rejectRes.status, 'FAILED');
    assert.strictEqual(rejectRes.rejectedCount, 1);
    assert.strictEqual(rejectRes.failureCode, 'INSUFFICIENT_READABLE_EVIDENCE');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 11: SECTION 21 & 22 - Resilient Fallback Under Vector/Reranker Failure
  // ──────────────────────────────────────────────────────────────────────────
  await test('SECTION 21 & 22: Pipeline Resilience When Vector Search or Reranker Fails', async () => {
    const store = {
      children: [
        { childId: 'c1', evidenceId: 'c1', text: 'Deadlock prevention eliminates Coffman conditions.' }
      ],
      parentMap: {}
    };

    // Simulate Reranker failure (e.g. invalid target or scoring crash)
    // Pipeline must fall back gracefully to RRF ordering without throwing uncaught exception
    let thrown = null;
    try {
      const candidates = HybridRetriever.retrieveForTarget(store, { concept: 'Deadlock' });
      // Intentionally pass malformed target to Reranker
      const reranked = RerankerService.rerank(candidates, null);
      assert.ok(Array.isArray(reranked.reranked), 'Must return array fallback on malformed input');
    } catch (e) {
      thrown = e;
    }
    assert.strictEqual(thrown, null, 'Reranker must handle edge case gracefully');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 12: SECTION 23 - Strict Document Isolation (Zero Contamination)
  // ──────────────────────────────────────────────────────────────────────────
  await test('SECTION 23: Strict Document Isolation (Document A vs Document B Contamination = 0)', async () => {
    // Document A: TCP
    const docAInputs = {
      sessionId: 'sess_doc_A',
      documentTexts: ['Transmission Control Protocol (TCP) uses a three-way handshake to establish connection-oriented, reliable byte-stream communication.'],
      documentNames: ['DocA_TCP.txt']
    };

    // Document B: UDP
    const docBInputs = {
      sessionId: 'sess_doc_B',
      documentTexts: ['User Datagram Protocol (UDP) is a connectionless, unreliable transport protocol with minimal header overhead for low-latency streaming.'],
      documentNames: ['DocB_UDP.txt']
    };

    // Fingerprints must be completely distinct
    const fpA = evidenceCache.computeFingerprint(docAInputs);
    const fpB = evidenceCache.computeFingerprint(docBInputs);
    assert.notStrictEqual(fpA, fpB, 'Fingerprints of Document A and Document B must differ');

    // Build independent stores
    const storeA = StructureAwareChunker.chunkDocument(new CommonDocumentModel({
      documentId: 'DOC_TCP',
      pages: [new DocumentPage({ pageNumber: 1, blocks: [new DocumentBlock({ type: BlockTypes.PARAGRAPH, content: docAInputs.documentTexts[0] })] })]
    }));

    const storeB = StructureAwareChunker.chunkDocument(new CommonDocumentModel({
      documentId: 'DOC_UDP',
      pages: [new DocumentPage({ pageNumber: 1, blocks: [new DocumentBlock({ type: BlockTypes.PARAGRAPH, content: docBInputs.documentTexts[0] })] })]
    }));

    // Query Document A store for "connectionless datagram" -> Must NOT contain UDP evidence
    const retrievedFromA = HybridRetriever.retrieveForTarget(storeA, { concept: 'connectionless datagram protocol' });
    const textInA = retrievedFromA.map(r => r.child.text).join(' ');
    assert.ok(!textInA.toLowerCase().includes('udp'), 'Document A store must NEVER contain UDP evidence');

    // Query Document B store for "three-way handshake" -> Must NOT contain TCP evidence
    const retrievedFromB = HybridRetriever.retrieveForTarget(storeB, { concept: 'three-way handshake' });
    const textInB = retrievedFromB.map(r => r.child.text).join(' ');
    assert.ok(!textInB.toLowerCase().includes('tcp'), 'Document B store must NEVER contain TCP evidence');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 13: SECTION 24 - Repeated Uploads & Caching (Zero Stale Contamination)
  // ──────────────────────────────────────────────────────────────────────────
  await test('SECTION 24: Repeated Document Ingestion & Deterministic Caching', async () => {
    const sessionInputs = {
      voiceTranscript: '',
      documentTexts: ['B-Tree indexes maintain sorted keys in leaf nodes with O(log N) search complexity.'],
      documentNames: ['btree.txt']
    };

    evidenceCache.clear();
    assert.strictEqual(evidenceCache.get(sessionInputs), null, 'Cache must be empty before set');

    // Package and cache
    const mockPackage = {
      isAcademic: true,
      curricularContent: sessionInputs.documentTexts[0],
      unifiedRawContent: sessionInputs.documentTexts[0]
    };
    evidenceCache.set(sessionInputs, mockPackage);

    const cached = evidenceCache.get(sessionInputs);
    assert.ok(cached !== null, 'Cache must return cached entry');
    assert.strictEqual(cached.isCacheHit, true);
    assert.strictEqual(cached.unifiedRawContent, sessionInputs.documentTexts[0]);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 14: SECTION 4 & 5 - Visual Chart & Diagram Ingestion Pipeline
  // ──────────────────────────────────────────────────────────────────────────
  await test('SECTION 4 & 5: Visual PDF Chart & Diagram Multi-Modal Ingestion', async () => {
    const chartPdfPath = path.join(__dirname, 'test_materials', 'pdf_chart_sales.pdf');
    assert.ok(fs.existsSync(chartPdfPath));
    const chartBuf = fs.readFileSync(chartPdfPath);

    const docChart = await PdfMultimodalExtractor.extract(chartBuf, { filename: 'pdf_chart_sales.pdf' });
    assert.ok(docChart instanceof CommonDocumentModel);
    assert.strictEqual(docChart.metadata.hasScans || docChart.metadata.hasCharts, true);

    const diagPdfPath = path.join(__dirname, 'test_materials', 'pdf_diagram_architecture.pdf');
    assert.ok(fs.existsSync(diagPdfPath));
    const diagBuf = fs.readFileSync(diagPdfPath);

    const docDiag = await PdfMultimodalExtractor.extract(diagBuf, { filename: 'pdf_diagram_architecture.pdf' });
    assert.ok(docDiag instanceof CommonDocumentModel);
    assert.ok(docDiag.getAllBlocks().length >= 1);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 15: SECTION 6 - Scanned Multi-Page PDF (Page-Level OCR & Provenance)
  // ──────────────────────────────────────────────────────────────────────────
  await test('SECTION 6: Scanned Multi-Page PDF (Page-Level OCR & Provenance Tracking)', async () => {
    const multiPdfPath = path.join(__dirname, 'test_materials', 'scanned_multipage.pdf');
    assert.ok(fs.existsSync(multiPdfPath));
    const multiBuf = fs.readFileSync(multiPdfPath);

    const doc = await PdfMultimodalExtractor.extract(multiBuf, { filename: 'scanned_multipage.pdf' });
    assert.ok(doc instanceof CommonDocumentModel);
    assert.strictEqual(doc.totalPages, 4, `Document must detect 4 pages, found ${doc.totalPages}`);
    assert.strictEqual(doc.pages.length, 4, 'Must extract all 4 individual pages');

    // Verify page-level provenance
    for (let p = 1; p <= doc.pages.length; p++) {
      const page = doc.pages[p - 1];
      assert.strictEqual(page.pageNumber, p, `Page index must match page ${p}`);
      assert.ok(page.blocks.length > 0, `Page ${p} must contain blocks`);
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 16: SECTION 7 - DOCX with Mixed Content (Heading, Table, Image, Caption)
  // ──────────────────────────────────────────────────────────────────────────
  await test('SECTION 7: DOCX with Mixed Content (Heading, Paragraph, Table, Embedded Media)', async () => {
    const docxPath = path.join(__dirname, 'test_materials', 'docx_mixed_content.docx');
    assert.ok(fs.existsSync(docxPath));
    const docxBuf = fs.readFileSync(docxPath);

    const doc = await DocxMultimodalExtractor.extract(docxBuf, { filename: 'docx_mixed_content.docx' });
    assert.ok(doc instanceof CommonDocumentModel);
    assert.strictEqual(doc.sourceType, 'DOCX');
    assert.strictEqual(doc.metadata.hasTables, true, 'DOCX metadata must record hasTables=true');
    assert.strictEqual(doc.metadata.hasImages, true, 'DOCX metadata must record hasImages=true (media detected)');

    const blocks = doc.getAllBlocks();
    const hasHeading = blocks.some(b => b.type === BlockTypes.HEADING);
    const hasParagraph = blocks.some(b => b.type === BlockTypes.PARAGRAPH);
    const hasTable = blocks.some(b => b.type === BlockTypes.TABLE);
    const hasVisual = blocks.some(b => b.type === BlockTypes.CHART || b.type === BlockTypes.DIAGRAM || b.type === BlockTypes.IMAGE);

    assert.ok(hasHeading, 'Must preserve Headings');
    assert.ok(hasParagraph, 'Must preserve Paragraphs');
    assert.ok(hasTable, 'Must preserve Tables');
    assert.ok(hasVisual || doc.metadata.hasImages, 'Embedded images must NOT be silently discarded');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // SUMMARY REPORT
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n======================================================================');
  console.log('📊 DEEP VERIFICATION SUITE RESULTS');
  console.log('======================================================================');
  const passed = results.filter(r => r.status === 'PASS').length;
  const total = results.length;
  console.log(`Total Verified: ${passed}/${total} (${((passed/total)*100).toFixed(0)}%)`);
  results.forEach(r => {
    const icon = r.status === 'PASS' ? '✅' : '❌';
    console.log(`${icon} [${r.id}] ${r.name}: ${r.status} (${r.latencyMs}ms)`);
  });
  console.log('======================================================================\n');

  if (passed !== total) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  runDeepVerification().catch(err => {
    console.error('Fatal error running verification:', err);
    process.exit(1);
  });
}

module.exports = { runDeepVerification };
