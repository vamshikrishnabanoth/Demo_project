/**
 * server/test_multimodal_pipeline.js
 *
 * Subsystem & Unit Verification Suite for:
 * 1. DocumentRouter & Magic Byte Detection
 * 2. CommonDocumentModel serialization & block queries
 * 3. StructureAwareChunker (table preservation, heading cohesion, metadata enrichment)
 * 4. BM25Retriever (tokenization, BM25 scoring)
 * 5. HybridRetriever (Reciprocal Rank Fusion + Content-Type Ranking Boost)
 * 6. Multimodal GroundingGate (table & visual grounding validation)
 * 7. Controlled failure & Insufficient Evidence handling
 */

'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const { CommonDocumentModel, DocumentBlock, DocumentPage, BlockTypes } = require('./engine/documentRouter/commonDocumentModel');
const DocumentRouter = require('./engine/documentRouter/documentRouter');
const structureAwareChunker = require('./engine/evidence/structureAwareChunker');
const BM25Retriever = require('./engine/evidence/bm25Retriever');
const HybridRetriever = require('./engine/evidence/hybridRetriever');
const GroundingGate = require('./engine/validators/groundingGate');

async function runSubsystemTests() {
  console.log('======================================================================');
  console.log('🧪 MULTIMODAL PIPELINE SUBSYSTEM & UNIT VERIFICATION SUITE');
  console.log('======================================================================\n');

  let passed = 0;
  let total = 0;

  function record(testName, fn) {
    total++;
    try {
      fn();
      console.log(`✅ PASS [${total}]: ${testName}`);
      passed++;
    } catch (err) {
      console.error(`❌ FAIL [${total}]: ${testName}`);
      console.error(err);
    }
  }

  async function recordAsync(testName, fn) {
    total++;
    try {
      await fn();
      console.log(`✅ PASS [${total}]: ${testName}`);
      passed++;
    } catch (err) {
      console.error(`❌ FAIL [${total}]: ${testName}`);
      console.error(err);
    }
  }

  // --- TEST 1: CommonDocumentModel Integrity ---
  record('CommonDocumentModel creates and retrieves structured pages & blocks', () => {
    const doc = new CommonDocumentModel({
      documentId: 'doc_test_1',
      sourceType: 'PDF',
      filename: 'sample_operating_systems.pdf'
    });

    const page1 = new DocumentPage({ pageNumber: 1, section: 'Memory Management' });
    page1.addBlock(new DocumentBlock({
      blockId: 'b1',
      type: BlockTypes.HEADING,
      content: 'Virtual Memory and Paging'
    }));
    page1.addBlock(new DocumentBlock({
      blockId: 'b2',
      type: BlockTypes.PARAGRAPH,
      content: 'Virtual memory allows execution of processes that are not completely in memory.'
    }));
    page1.addBlock(new DocumentBlock({
      blockId: 'b3',
      type: BlockTypes.TABLE,
      content: '| Algorithm | Page Fault Rate | Implementation Complexity |\n| FIFO | High | Low |\n| LRU | Low | Medium |'
    }));

    doc.addPage(page1);

    assert.strictEqual(doc.pages.length, 1);
    assert.strictEqual(doc.totalPages, 1);
    assert.strictEqual(doc.getAllBlocks().length, 3);
    assert.strictEqual(doc.getBlocksByType(BlockTypes.TABLE).length, 1);
    assert.ok(doc.toFlattenedText().includes('Virtual Memory and Paging'));
    assert.ok(doc.toFlattenedText().includes('| Algorithm | Page Fault Rate |'));
  });

  // --- TEST 2: Structure-Aware Chunker Table Preservation ---
  record('StructureAwareChunker preserves entire markdown table in a single chunk without row splits', () => {
    const doc = new CommonDocumentModel({
      documentId: 'doc_tables_test',
      sourceType: 'DOCX',
      filename: 'comparisons.docx'
    });

    const page = new DocumentPage({ pageNumber: 1 });
    page.addBlock(new DocumentBlock({
      blockId: 'tbl_1',
      type: BlockTypes.TABLE,
      content: '| Metric | TCP | UDP |\n| Connection | Connection-oriented | Connectionless |\n| Reliability | High (ACKs) | Low (Best effort) |\n| Speed | Slower | Faster |'
    }));
    doc.addPage(page);

    const chunkResult = structureAwareChunker.chunkDocument(doc, { childSize: 100 });
    assert.ok(chunkResult.children.length >= 1);
    const tableChunk = chunkResult.children.find(c => c.contentType === BlockTypes.TABLE);
    assert.ok(tableChunk, 'Should produce a TABLE content-type chunk');
    assert.ok(tableChunk.text.includes('| Metric | TCP | UDP |'));
    assert.ok(tableChunk.text.includes('| Speed | Slower | Faster |'));
    assert.strictEqual(tableChunk.pageNumber, 1);
    assert.strictEqual(tableChunk.sourceType, 'DOCX');
  });

  // --- TEST 3: Structure-Aware Chunker Heading Cohesion ---
  record('StructureAwareChunker binds heading to subsequent paragraphs for semantic cohesion', () => {
    const doc = new CommonDocumentModel({
      documentId: 'doc_heading_test',
      sourceType: 'PDF',
      filename: 'os_ch4.pdf'
    });

    const page = new DocumentPage({ pageNumber: 2, section: 'CPU Scheduling' });
    page.addBlock(new DocumentBlock({
      blockId: 'h1',
      type: BlockTypes.HEADING,
      content: 'Multi-Level Feedback Queue Scheduling'
    }));
    page.addBlock(new DocumentBlock({
      blockId: 'p1',
      type: BlockTypes.PARAGRAPH,
      content: 'MLFQ allows a process to move between queues. If a process uses too much CPU time, it is moved to a lower-priority queue.'
    }));
    doc.addPage(page);

    const chunkResult = structureAwareChunker.chunkDocument(doc);
    assert.ok(chunkResult.children.length > 0);
    const chunk = chunkResult.children[0];
    assert.ok(chunk.text.includes('Multi-Level Feedback Queue Scheduling'), 'Heading should be retained');
    assert.ok(chunk.text.includes('lower-priority queue'), 'Paragraph text should follow');
  });

  // --- TEST 4: BM25 Retriever Accuracy ---
  record('BM25Retriever scores relevant terms higher using Okapi BM25', () => {
    const documents = [
      { id: 'c1', text: 'Deadlock avoidance uses the Banker algorithm to ensure safe state allocation.' },
      { id: 'c2', text: 'Process synchronization utilizes semaphores and mutex locks for critical section entry.' },
      { id: 'c3', text: 'Paging divides memory into fixed-size physical frames and logical pages.' }
    ];

    const bm25 = new BM25Retriever();
    bm25.index(documents);
    const results = bm25.search('Banker algorithm safe state', 3);

    assert.ok(results.length > 0);
    assert.strictEqual(results[0].document.id, 'c1', 'Top candidate should be c1 for Banker algorithm');
    assert.ok(results[0].score > 0);
  });

  // --- TEST 5: Content-Type-Aware Hybrid RRF Retrieval with Boost ---
  record('HybridRetriever boosts TABLE content type when query targets comparison', () => {
    const children = [
      {
        childId: 'chk_text_tcp',
        evidenceId: 'e_chk_text_tcp',
        parentId: 'p_1',
        contentType: BlockTypes.PARAGRAPH,
        text: 'TCP provides reliable, ordered, and error-checked delivery of a stream of octets between applications running on hosts.',
        pageNumber: 10
      },
      {
        childId: 'chk_table_protocols',
        evidenceId: 'e_chk_table_protocols',
        parentId: 'p_2',
        contentType: BlockTypes.TABLE,
        text: '| Protocol | Connection | Header Size | Reliability |\n| TCP | Connection-oriented | 20-60 bytes | High |\n| UDP | Connectionless | 8 bytes | Low |',
        pageNumber: 11
      },
      {
        childId: 'chk_text_udp',
        evidenceId: 'e_chk_text_udp',
        parentId: 'p_3',
        contentType: BlockTypes.PARAGRAPH,
        text: 'UDP uses a simple connectionless communication model with a minimum of protocol mechanisms.',
        pageNumber: 12
      }
    ];

    const parents = [
      { parentId: 'p_1', evidenceId: 'p_1', fullText: children[0].text, childIds: ['e_chk_text_tcp'] },
      { parentId: 'p_2', evidenceId: 'p_2', fullText: children[1].text, childIds: ['e_chk_table_protocols'] },
      { parentId: 'p_3', evidenceId: 'p_3', fullText: children[2].text, childIds: ['e_chk_text_udp'] }
    ];

    const store = {
      children,
      parents,
      childMap: {
        'e_chk_text_tcp': children[0],
        'e_chk_table_protocols': children[1],
        'e_chk_text_udp': children[2]
      },
      parentMap: {
        'p_1': parents[0],
        'p_2': parents[1],
        'p_3': parents[2]
      }
    };

    const target = {
      concept: 'TCP vs UDP',
      dimension: 'Comparison',
      contentType: BlockTypes.TABLE,
      instruction: 'Compare TCP and UDP connection and header size in table'
    };

    const ranked = HybridRetriever.retrieveForTarget(store, target, { topK: 3, boostFactor: 1.5 });
    assert.ok(ranked.length > 0);
    // chk_table_protocols should be at the top due to table content-type boost
    assert.strictEqual(ranked[0].child.childId, 'chk_table_protocols', 'Table chunk should be boosted to rank 1');
    assert.strictEqual(ranked[0].contentType, BlockTypes.TABLE);
  });

  // --- TEST 6: Multimodal GroundingGate with Structured Evidence ---
  record('GroundingGate accepts questions derived from table and visual evidence', () => {
    const doc = new CommonDocumentModel({
      documentId: 'doc_net',
      sourceType: 'PDF',
      filename: 'networks.pdf'
    });

    const page = new DocumentPage({ pageNumber: 5 });
    page.addBlock(new DocumentBlock({
      blockId: 'tbl_proto',
      type: BlockTypes.TABLE,
      content: '| Protocol | Port | Transport |\n| HTTP | 80 | TCP |\n| DNS | 53 | UDP |\n| HTTPS | 443 | TCP |'
    }));
    doc.addPage(page);

    const evidencePackage = {
      unifiedRawContent: 'Computer networking fundamental protocols overview.',
      commonDocumentModel: doc
    };

    const questions = [
      {
        questionText: 'According to the protocol specifications, which default port is utilized by HTTPS?',
        correctAnswer: '443',
        options: ['80', '53', '443', '21']
      }
    ];

    const result = GroundingGate.verifyQuizGrounding(questions, evidencePackage);
    assert.strictEqual(result.status, 'PASSED');
    assert.strictEqual(result.validatedQuestions.length, 1);
  });

  // --- TEST 7: GroundingGate Rejects Foreign Ungrounded Concepts ---
  record('GroundingGate rejects questions containing foreign ungrounded concepts', () => {
    const evidencePackage = {
      unifiedRawContent: 'Virtual memory concepts: page fault handling, TLB cache, and page replacement algorithms.',
      commonDocumentModel: null
    };

    const ungroundedQuestions = [
      {
        questionText: 'Which enzyme catalyzes DNA replication during PCR amplification in biochemistry?',
        correctAnswer: 'Taq polymerase',
        options: ['Taq polymerase', 'RNA polymerase', 'Ligase', 'Helicase']
      }
    ];

    const result = GroundingGate.verifyQuizGrounding(ungroundedQuestions, evidencePackage);
    assert.strictEqual(result.status, 'FAILED');
    assert.strictEqual(result.validatedQuestions.length, 0);
    assert.strictEqual(result.rejectedCount, 1);
  });

  // --- TEST 8: DocumentRouter Magic Byte Verification ---
  record('DocumentRouter rejects spoofed files via magic bytes signature checks', () => {
    const tempSpoofedPath = path.join(__dirname, 'temp_spoofed.pdf');
    fs.writeFileSync(tempSpoofedPath, 'This is plain text with a .pdf extension!');

    try {
      assert.throws(() => {
        DocumentRouter.validateMagicBytes(tempSpoofedPath, '.pdf');
      }, /FILE_MAGIC_BYTES_MISMATCH/);
    } finally {
      if (fs.existsSync(tempSpoofedPath)) fs.unlinkSync(tempSpoofedPath);
    }
  });

  console.log('\n======================================================================');
  console.log(`📊 SUBSYSTEM TEST RESULTS: ${passed}/${total} PASSED`);
  console.log('======================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

if (require.main === module) {
  runSubsystemTests().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
  });
}

module.exports = { runSubsystemTests };
