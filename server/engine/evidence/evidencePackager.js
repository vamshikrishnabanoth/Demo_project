/**
 * server/engine/evidence/evidencePackager.js
 *
 * Assembles the Teaching Evidence Package from Session Content & RAG.
 * Applies Pedagogy-Aware Ingestion & Dual-Source Authority Division:
 * - Voice Authority -> Teaching Intent, Verbal Emphasis, Cognitive Expectations, Explicit Instructions.
 * - Material Authority -> Exact Factual Artifacts, Syntax Definitions, Formulas.
 * - Integrates DepthAnalyzer for Pedagogy-Aware Classification & Evidence Extraction.
 * - Strict Hard Zero Category Enforcement.
 */

'use strict';

const depthAnalyzer = require('./depthAnalyzer');
const { HierarchicalChunker } = require('./hierarchicalChunker');
const { CrossMaterialAligner } = require('./crossMaterialAligner');
const evidenceCache = require('./evidenceCache');
const IntentRelativeReasoner = require('../agents/intentRelativeReasoner');
const CurricularCoverageAnalyzer = require('./curricularCoverageAnalyzer');

class EvidencePackager {
  /**
   * Package unified content into a structured Teaching Evidence Package.
   * @param {Object} sessionInputs - { voiceTranscript, documentTexts, codeSnippets, imageTexts }
   * @param {Array} ragChunks - Session RAG retrieved chunks
   * @returns {Object} Teaching Evidence Package
   */
  packageSessionEvidence(sessionInputs = {}, ragChunks = []) {
    // 0. Check Preprocessing LRU Cache
    const cached = evidenceCache.get(sessionInputs);
    if (cached) {
      console.log(`⚡ [EvidencePackager] Preprocessing LRU Cache HIT for session (instant <5ms)`);
      return cached;
    }

    const voiceText = (sessionInputs.voiceTranscript || 
      (Array.isArray(sessionInputs.audioTranscripts) ? sessionInputs.audioTranscripts.join('\n\n') : '') ||
      (Array.isArray(sessionInputs.voiceTranscripts) ? sessionInputs.voiceTranscripts.join('\n\n') : '') ||
      '').trim();
    const hasVoice = Boolean(voiceText && voiceText.trim().length > 50);
    const docTexts = Array.isArray(sessionInputs.documentTexts) ? sessionInputs.documentTexts : (sessionInputs.documentTexts ? [sessionInputs.documentTexts] : []);
    const docNames = Array.isArray(sessionInputs.documentNames) ? sessionInputs.documentNames : [];
    const codeText = sessionInputs.codeSnippets || '';
    const imageText = (sessionInputs.imageTexts || []).join('\n');

    // Policy C + B: Cross-Material Alignment Check
    let effectiveDocTexts = [];
    let unalignedDocs = [];
    let alignmentWarning = null;

    if (hasVoice && docTexts.length > 0) {
      docTexts.forEach((dText, idx) => {
        const dName = docNames[idx] || (docTexts.length === 1 ? 'Uploaded Document' : `Document ${idx + 1}`);
        if (!dText || dText.trim().length === 0) return;

        const evalResult = CrossMaterialAligner.evaluateDocumentAlignment(voiceText, dText);
        if (evalResult.isAligned) {
          if (evalResult.relationship === 'PARTIALLY_ALIGNED_SECTION' && evalResult.sections && evalResult.sections.length > 1) {
            const alignedText = evalResult.sections
              .filter(s => s.priority <= 3)
              .map(s => s.text)
              .join('\n\n');
            effectiveDocTexts.push({
              text: alignedText || dText,
              name: dName,
              priority: evalResult.priority,
              relationship: evalResult.relationship,
              evalResult
            });
          } else {
            effectiveDocTexts.push({
              text: dText,
              name: dName,
              priority: evalResult.priority,
              relationship: evalResult.relationship,
              evalResult
            });
          }
        } else {
          unalignedDocs.push({
            text: dText,
            name: dName,
            priority: 5,
            relationship: evalResult.relationship || 'COMPLETELY_UNRELATED',
            evalResult
          });
        }
      });

      if (unalignedDocs.length > 0) {
        const namesList = unalignedDocs.map(d => `'${d.name}'`).join(', ');
        alignmentWarning = `Uploaded document ${namesList} did not align with the spoken lecture topic and was assigned lowest priority (suppressed from question targets) to keep assessment questions strictly grounded in what was taught.`;
        console.log(`⚠️ [CrossMaterialAligner] Policy C+B Applied: ${alignmentWarning}`);
      }
    } else {
      effectiveDocTexts = docTexts.map((dText, idx) => ({
        text: dText,
        name: docNames[idx] || `Document ${idx + 1}`
      }));
    }

    const cleanDocsArray = effectiveDocTexts.map(d => d.text);
    const cleanDocsText = cleanDocsArray.join('\n');

    // Extract exact artifacts from Code / PPT / PDF / Board Images (using only aligned materials)
    const exactArtifacts = this._extractExactArtifacts(codeText, cleanDocsText, imageText);

    const rawContent = `[VOICE TRANSCRIPT]\n${voiceText}\n\n[DOCUMENT CONTENT]\n${cleanDocsText}\n\n[CODE SNIPPETS]\n${codeText}\n\n[BOARD OCR]\n${imageText}`;

    // 1. Decoupled Modality Depth Analyses:
    // Architectural Invariant: Document evidence CANNOT inflate or alter Teacher Pedagogical Richness.
    let voiceAnalysis = null;
    if (hasVoice) {
      voiceAnalysis = depthAnalyzer.analyzeLecture(voiceText, { sourceModality: 'VOICE' });
    }

    let docAnalysis = null;
    const hasDocs = Boolean(cleanDocsText && cleanDocsText.trim().length > 30);
    if (hasDocs) {
      docAnalysis = depthAnalyzer.analyzeLecture(cleanDocsText, { sourceModality: 'DOCUMENT' });
    }

    // Determine primary instructional analysis:
    // When voice is present, Voice is the primary pedagogical authority.
    // When voice is absent, Document analysis provides reference curriculum depth.
    const primaryAnalysis = hasVoice
      ? voiceAnalysis
      : (docAnalysis || depthAnalyzer.analyzeLecture('', { sourceModality: 'NONE' }));

    const pedagogicalRichness = hasVoice ? voiceAnalysis.lectureDepth : null;
    const documentReferenceDepth = hasDocs ? docAnalysis?.lectureDepth : null;

    // Extract verbal emphasis cues strictly from Voice and Teacher Pedagogical segments
    const pedagogicalSegments = hasVoice ? (voiceAnalysis.pedagogicalSegments || []) : [];
    const voiceEmphasisSignals = this._extractVoiceEmphasis(voiceText, pedagogicalSegments);

    // 2. Evidence-driven category weights with strict Hard Zero enforcement
    const categoryWeights = this._computeCategoryWeights(exactArtifacts, voiceEmphasisSignals, rawContent);

    // Build formatted curricular content with explicit pedagogy-aware evidence annotations
    const curricularSegments = primaryAnalysis.curricularSegments || [];
    const curricularLines = curricularSegments.map(s => {
      const cType = s.classification?.type;
      const evText = s.classification?.evidence_text || s.text;
      if (cType === 'TEACHER_EXPERIENCE') {
        return `[TEACHER EXPERIENCE / PRODUCTION CASE]: ${evText} (${s.classification?.reason || ''})`;
      } else if (cType === 'ANALOGY') {
        return `[CONCEPTUAL ANALOGY]: ${evText} (${s.classification?.reason || ''})`;
      } else if (cType === 'TECHNICAL_HUMOR') {
        return `[TECHNICAL HUMOR / CONCEPTUAL VIGNETTE]: ${evText}`;
      } else if (cType === 'REAL_WORLD_APPLICATION') {
        return `[REAL-WORLD APPLICATION]: ${evText}`;
      }
      return evText;
    });

    const curricularContent = (primaryAnalysis.isAcademic && curricularLines.length > 0)
      ? curricularLines.join('\n')
      : (primaryAnalysis.isAcademic ? rawContent : '');

    // 2b. Teacher Instructional Intent, Negative Boundaries & Relative Hard Feasibility
    const instructionalProfile = IntentRelativeReasoner.analyzeInstructionalProfile(voiceText, cleanDocsText);

    // Build structured Evidence Package with decoupled modality depth metrics
    const packageData = {
      sessionId: sessionInputs.sessionId || 'session_' + Date.now(),
      authoritySummary: {
        voiceAuthority: 'Intent, Verbal Emphasis, Cognitive Expectations, Explicit Instructions',
        materialAuthority: 'Exact Syntax, Formulas, Code Logic, Tables, Diagrams'
      },
      voiceEmphasis: voiceEmphasisSignals,
      artifacts: exactArtifacts,
      // Decoupled Modality Depth Properties:
      pedagogicalRichness,
      documentReferenceDepth,
      voiceAnalysis,
      docAnalysis,
      // Phase 4 / 4.5 Pedagogical Intent & Boundary Properties:
      instructionalIntent: instructionalProfile.instructionalIntent,
      negativeBoundaries: instructionalProfile.negativeBoundaries,
      supportedReasoningModes: instructionalProfile.supportedReasoningModes,
      hardFeasibility: instructionalProfile.hardFeasibility,
      hardOperationalGuidance: instructionalProfile.operationalGuidance,
      instructionalProfile: instructionalProfile,
      // Primary / Grounded Properties:
      isAcademic: primaryAnalysis.isAcademic,
      isCurricular: primaryAnalysis.isCurricular,
      academicFailureReason: primaryAnalysis.reason,
      teachingValueScore: primaryAnalysis.teachingValueScore,
      lectureDepth: primaryAnalysis.lectureDepth,
      detectedFocus: primaryAnalysis.detectedFocus,
      retainedSegments: primaryAnalysis.retainedSegments || [],
      curricularSegments,
      pedagogicalSegments,
      adminSegments: primaryAnalysis.adminSegments || [],
      discardedSegments: primaryAnalysis.discardedSegments || [],
      curricularContent,
      categoryWeights,
      hasExcludedMaterials: unalignedDocs.length > 0,
      unalignedDocuments: unalignedDocs.map(d => d.name),
      alignmentWarning,
      hasAlignedDocs: cleanDocsArray.length > 0,
      relationships: effectiveDocTexts.map(d => ({ name: d.name, relationship: d.relationship, priority: d.priority })),
      unrelatedMaterials: unalignedDocs.map(d => ({ name: d.name, relationship: d.relationship, priority: d.priority })),
      ragChunksSummary: ragChunks.map(c => ({
        id: c.id,
        sourceType: c.sourceType,
        sourceId: c.sourceId,
        snippet: (c.content || '').substring(0, 150)
      })),
      unifiedRawContent: rawContent
    };

    // 3. Construct Dual-Level Hierarchical Evidence Store & Cross-Material Alignment Graph
    try {
      const sanitizedInputs = {
        ...sessionInputs,
        documentTexts: cleanDocsArray
      };
      packageData.hierarchicalStore = HierarchicalChunker.buildStore(sanitizedInputs);

      // Integrate Structure-Aware Multimodal Chunker if CommonDocumentModel is present
      const StructureAwareChunker = require('./structureAwareChunker');
      if (sessionInputs.commonDocumentModel) {
        packageData.commonDocumentModel = sessionInputs.commonDocumentModel;
        const structResult = StructureAwareChunker.chunkDocument(sessionInputs.commonDocumentModel);
        if (structResult.children && structResult.children.length > 0) {
          if (!packageData.hierarchicalStore) {
            packageData.hierarchicalStore = { parents: [], children: [], parentMap: {}, childMap: {} };
          }
          // Merge structure-aware chunks
          for (const p of structResult.parents) {
            packageData.hierarchicalStore.parents.push(p);
            packageData.hierarchicalStore.parentMap[p.evidenceId] = p;
          }
          for (const c of structResult.children) {
            packageData.hierarchicalStore.children.push(c);
            packageData.hierarchicalStore.childMap[c.evidenceId] = c;
          }
        }
      }
      packageData.multimodalStore = packageData.hierarchicalStore;
      packageData.alignmentGraph = CrossMaterialAligner.buildAlignmentGraph(packageData.hierarchicalStore);
      // Step 2: Build Lightweight In-Memory Concept-Evidence Graph (preserving all provenance and evidence fields)
      packageData.conceptEvidenceGraph = this._buildConceptEvidenceGraph(voiceText, effectiveDocTexts, unalignedDocs, primaryAnalysis, exactArtifacts);
    } catch (storeErr) {
      console.warn(`⚠️ [EvidencePackager] Notice building hierarchical/alignment store: ${storeErr.message}`);
      packageData.hierarchicalStore = null;
      packageData.alignmentGraph = {};
      packageData.conceptEvidenceGraph = this._buildConceptEvidenceGraph(voiceText, effectiveDocTexts, unalignedDocs, primaryAnalysis, exactArtifacts);
    }

    // Step 5: Pre-Generation Curricular Coverage Analysis (assessability pre-check)
    try {
      packageData.curricularCoverage = CurricularCoverageAnalyzer.analyzeCoverage(packageData);
    } catch (covErr) {
      console.warn(`⚠️ [EvidencePackager] Notice analyzing curricular coverage: ${covErr.message}`);
      packageData.curricularCoverage = CurricularCoverageAnalyzer._createEmptyProfile();
    }

    evidenceCache.set(sessionInputs, packageData);
    return packageData;
  }

  /**
   * Partition assessable curricular content according to the router's representation decision.
   */
  applyRepresentationPackaging(packageData, representationMode = 'UNIFIED') {
    if (!packageData || !packageData.curricularSegments) return packageData;

    const segments = packageData.curricularSegments || [];
    const artifacts = packageData.artifacts || {};
    const mode = (representationMode || 'UNIFIED').toUpperCase();

    let selectedText = '';
    const formulaLines = (artifacts.formulasDetected || []).map(f => `[FORMULA/SYNTAX]: ${f}`).join('\n');
    const codeLines = (artifacts.codeSnippets || []).map(c => `[CODE ARTIFACT]:\n${c}`).join('\n');
    const artifactBlock = [formulaLines, codeLines].filter(Boolean).join('\n');

    if (mode === 'SUMMARY') {
      const summarySegs = segments.filter(s => {
        const st = s.classification?.substanceType;
        const ct = s.classification?.type;
        return ['DEFINITION_OR_FACT', 'MECHANISM', 'RULE_OR_CONDITION', 'COMPARISON'].includes(st) || ct === 'CORE_EXPLANATION';
      });
      const textSegs = (summarySegs.length >= 3 ? summarySegs : segments).map(s => s.classification?.evidence_text || s.text).join('\n');
      selectedText = `--- TECHNICAL SUMMARY: CONCEPTS, DEFINITIONS, MECHANISMS & PRINCIPLES (WHAT WAS TAUGHT) ---\n${textSegs}`;
      if (artifactBlock) {
        selectedText += `\n\n--- EXACT ARTIFACTS ---\n${artifactBlock}`;
      }
    } else if (mode === 'BLUEPRINT') {
      const blueprintSegs = segments.filter(s => {
        const st = s.classification?.substanceType;
        const ct = s.classification?.type;
        return ['OBSERVATION_DEMONSTRATION', 'RULE_OR_CONDITION', 'COMPARISON', 'WORKED_EXAMPLE', 'SOCRATIC_INSTRUCTION', 'MECHANISM', 'REAL_WORLD_CASE', 'CONCEPTUAL_ANALOGY'].includes(st) ||
          ['TEACHER_EXPERIENCE', 'ANALOGY', 'TECHNICAL_HUMOR', 'REAL_WORLD_APPLICATION', 'DEMONSTRATION'].includes(ct);
      });
      const textSegs = (blueprintSegs.length >= 3 ? blueprintSegs : segments).map(s => {
        const ct = s.classification?.type;
        const ev = s.classification?.evidence_text || s.text;
        if (ct === 'TEACHER_EXPERIENCE') return `[TEACHER EXPERIENCE]: ${ev}`;
        if (ct === 'ANALOGY') return `[ANALOGY]: ${ev}`;
        return ev;
      }).join('\n');
      selectedText = `--- INSTRUCTIONAL BLUEPRINT: PEDAGOGICAL INTENT, ANALOGIES & TEACHER EMPHASIS (HOW & WHY IT WAS TAUGHT) ---\n${textSegs}`;
    } else { // UNIFIED
      const allText = segments.map(s => {
        const ct = s.classification?.type;
        const ev = s.classification?.evidence_text || s.text;
        if (ct === 'TEACHER_EXPERIENCE') return `[TEACHER EXPERIENCE]: ${ev}`;
        if (ct === 'ANALOGY') return `[ANALOGY]: ${ev}`;
        if (ct === 'TECHNICAL_HUMOR') return `[TECHNICAL HUMOR]: ${ev}`;
        return ev;
      }).join('\n');
      selectedText = `--- UNIFIED REPRESENTATION: CURRICULAR CONTENT + PEDAGOGICAL BLUEPRINT ---\n${allText}`;
      if (artifactBlock) {
        selectedText += `\n\n--- EXACT ARTIFACTS ---\n${artifactBlock}`;
      }
    }

    packageData.curricularContent = selectedText;
    packageData.representationMode = mode;
    return packageData;
  }

  /**
   * Strictly enforce Hard Zero and compute dynamic category weights based on session evidence.
   */
  _computeCategoryWeights(artifacts, voiceSignals, rawContent) {
    const weights = {
      CONCEPTS_AND_DEFINITIONS: 0.35,
      COMPARISONS_AND_TRADEOFFS: 0.25,
      CASE_STUDIES_AND_SCENARIOS: 0.40,
      FORMULAS_AND_CALCULATIONS: 0.0,
      PRACTICAL_AND_LAB_TASKS: 0.0
    };

    // 1. Hard Zero for Formulas & Calculations
    if (artifacts.formulasDetected && artifacts.formulasDetected.length > 0) {
      weights.FORMULAS_AND_CALCULATIONS = 0.20;
    } else {
      weights.FORMULAS_AND_CALCULATIONS = 0.0; // STRICT HARD ZERO
    }

    // 2. Hard Zero for Practical & Lab Tasks if no code / lab steps exist
    const hasLabSteps = rawContent.toLowerCase().includes('lab task') || rawContent.toLowerCase().includes('terminal command');
    if (artifacts.hasCode || hasLabSteps) {
      weights.PRACTICAL_AND_LAB_TASKS = 0.20;
    } else {
      weights.PRACTICAL_AND_LAB_TASKS = 0.0; // STRICT HARD ZERO
    }

    // 3. Renormalize active non-zero weights so they sum to exactly 1.0 (100%)
    const activeKeys = Object.keys(weights).filter(k => weights[k] > 0);
    const currentSum = activeKeys.reduce((sum, k) => sum + weights[k], 0);

    if (currentSum > 0) {
      activeKeys.forEach(k => {
        weights[k] = Number((weights[k] / currentSum).toFixed(3));
      });
    }

    return weights;
  }

  /** Extract verbal emphasis signals from Voice transcript & pedagogical segments */
  _extractVoiceEmphasis(voiceText = '', pedagogicalSegments = []) {
    const signals = {
      syntaxEmphasis: 'MEDIUM',
      conceptualEmphasis: 'HIGH',
      explicitInstructions: [],
      perceivedDifficultyCues: 'BALANCED'
    };

    const textLower = voiceText.toLowerCase();

    if (textLower.includes("don't worry about syntax") || textLower.includes("ignore syntax")) {
      signals.syntaxEmphasis = 'LOW';
      signals.explicitInstructions.push("De-emphasize syntax questions.");
    } else if (textLower.includes("remember the syntax") || textLower.includes("must write the query")) {
      signals.syntaxEmphasis = 'HIGH';
      signals.explicitInstructions.push("Elevate syntax and query construction emphasis.");
    }

    if (textLower.includes("focus on application") || textLower.includes("solve the problem")) {
      signals.conceptualEmphasis = 'HIGH';
    }

    // Process instructional intent from pedagogical segments
    if (pedagogicalSegments && pedagogicalSegments.length > 0) {
      for (const seg of pedagogicalSegments) {
        const segLower = (seg.text || seg || '').toLowerCase();
        if (segLower.includes('interview') || segLower.includes('exam')) {
          signals.explicitInstructions.push('Instructional emphasis: concept is critical for technical assessment / interviews.');
        }
        if (segLower.includes('practice') || segLower.includes('takes time')) {
          signals.explicitInstructions.push('Instructional reassurance: reinforce core conceptual mechanics.');
        }
      }
    }

    return signals;
  }

  /** Extract exact code, formulas, and artifacts */
  _extractExactArtifacts(codeText, docsText, imageText) {
    const artifacts = {
      hasCode: Boolean(codeText && codeText.trim().length > 0),
      codeSnippets: codeText ? [codeText] : [],
      formulasDetected: [],
      keyTerms: []
    };

    const combined = `${docsText} ${imageText}`;
    const formulaMatches = combined.match(/([A-Za-z0-9_]+\s*=\s*[^.\n]+)/g);
    if (formulaMatches) {
      artifacts.formulasDetected = formulaMatches.slice(0, 5);
    }

    return artifacts;
  }

  /**
   * Build Lightweight In-Memory Concept-Evidence Graph.
   * Connects spoken instructional segments to supporting material with explicit
   * typed edges, conflict metadata, and modality boundaries.
   */
  _buildConceptEvidenceGraph(voiceText = '', effectiveDocTexts = [], unalignedDocs = [], primaryAnalysis = {}, exactArtifacts = {}) {
    const nodes = [];
    const edges = [];
    const conflicts = [];
    const voiceOnlyConcepts = [];
    const documentOnlyConcepts = [];

    // 1. Spoken Concept Nodes
    const curricularSegments = primaryAnalysis.curricularSegments || [];
    curricularSegments.forEach((seg, idx) => {
      const nodeId = `v_node_${String(idx + 1).padStart(2, '0')}`;
      const cType = seg.classification?.type || 'CORE_CONCEPT';
      const anchor = seg.classification?.conceptAnchor ||
        seg.classification?.anchor ||
        (CrossMaterialAligner._extractGenericAnchors ? CrossMaterialAligner._extractGenericAnchors(seg.text || '')[0] : null) ||
        `Spoken Concept ${idx + 1}`;

      nodes.push({
        id: nodeId,
        modality: 'VOICE',
        conceptAnchor: anchor,
        text: (seg.text || '').substring(0, 300),
        category: cType,
        provenance: {
          source: 'voiceTranscript',
          segmentIndex: idx,
          timestamp: seg.timestamp || null
        }
      });
    });

    // 2. Document Nodes & Alignment Edges
    effectiveDocTexts.forEach((doc, dIdx) => {
      const docNodeId = `d_node_${String(dIdx + 1).padStart(2, '0')}`;
      const evalRes = doc.evalResult || {};
      const anchor = evalRes.primaryAnchor || doc.name;
      nodes.push({
        id: docNodeId,
        modality: 'DOCUMENT',
        conceptAnchor: anchor,
        documentName: doc.name,
        text: (doc.text || '').substring(0, 300),
        priority: doc.priority,
        provenance: {
          source: 'documentTexts',
          documentName: doc.name,
          priority: doc.priority
        }
      });

      // Edge from Voice to Document
      const edge = {
        sourceNodeId: nodes.length > 0 && nodes[0].modality === 'VOICE' ? nodes[0].id : null,
        targetNodeId: docNodeId,
        relationship: doc.relationship || evalRes.relationship || 'SAME_CONCEPT',
        priority: doc.priority,
        semanticSimilarity: evalRes.semanticSimilarity || null,
        conflictStatus: evalRes.conflictStatus || { hasConflict: false },
        reason: evalRes.reason || null
      };
      edges.push(edge);

      if (evalRes.conflictStatus?.hasConflict) {
        conflicts.push({
          targetDocNodeId: docNodeId,
          documentName: doc.name,
          conflictType: evalRes.conflictStatus.conflictType,
          resolutionPolicy: evalRes.conflictStatus.resolutionPolicy,
          reason: evalRes.conflictStatus.reason,
          voiceClaim: evalRes.conflictStatus.voiceClaim || null,
          docClaim: evalRes.conflictStatus.docClaim || null
        });
      }

      if (evalRes.relationship === 'DOCUMENT_ONLY') {
        documentOnlyConcepts.push({ documentName: doc.name, anchor });
      }
    });

    // 3. Unaligned Documents
    unalignedDocs.forEach((doc, uIdx) => {
      const docNodeId = `u_node_${String(uIdx + 1).padStart(2, '0')}`;
      nodes.push({
        id: docNodeId,
        modality: 'DOCUMENT',
        conceptAnchor: doc.name,
        documentName: doc.name,
        text: (doc.text || '').substring(0, 300),
        priority: 5,
        provenance: {
          source: 'unalignedDocuments',
          documentName: doc.name,
          status: 'SUPPRESSED_LOW_PRIORITY'
        }
      });
      edges.push({
        sourceNodeId: null,
        targetNodeId: docNodeId,
        relationship: 'COMPLETELY_UNRELATED',
        priority: 5,
        reason: 'Unaligned with spoken curriculum'
      });
    });

    // 4. Voice-Only Concepts
    if (curricularSegments.length > 0 && effectiveDocTexts.length === 0) {
      nodes.filter(n => n.modality === 'VOICE').forEach(vn => {
        voiceOnlyConcepts.push({ nodeId: vn.id, anchor: vn.conceptAnchor });
      });
    }

    return {
      version: '1.0',
      linkerMode: process.env.CROSS_SOURCE_LINKER || 'v1_lexical',
      nodeCount: nodes.length,
      edgeCount: edges.length,
      nodes,
      edges,
      conflicts,
      voiceOnlyConcepts,
      documentOnlyConcepts
    };
  }
}

module.exports = new EvidencePackager();
