/**
 * server/engine/evidence/evidenceContextSelector.js
 *
 * Deterministically selects the relevant evidence span for a specific target.
 * Primary Path (Step 1 + Step 2):
 * - Dual-Level Hierarchical Retriever (precision child scoring -> parent narrative context window)
 * - Cross-Material Alignment Expansion (injects top-linked slide/code/voice cross-references)
 * Fallback Path:
 * - If no reliable hierarchical match is found, falls back gracefully to multi-term sliding window block scoring.
 */

'use strict';

const { HierarchicalRetriever } = require('./hierarchicalRetriever');
const { CrossMaterialAligner } = require('./crossMaterialAligner');
const HybridRetriever = require('./hybridRetriever');
const RerankerService = require('./rerankerService');

function tokenize(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3);
}

/**
 * Deterministically selects the relevant evidence span for a specific target.
 * @param {Object} target - AssessmentTarget
 * @param {Object|string} evidencePackageOrContent - EvidencePackage object or raw string
 * @param {number} maxContextChars - Maximum character budget for context window (default: 2000, validated by A/B experiment)
 * @returns {string} Formatted evidence context
 */
function getTargetEvidenceContext(target = {}, evidencePackageOrContent = '', maxContextChars = 2000) {
  const isPackage = typeof evidencePackageOrContent === 'object' && evidencePackageOrContent !== null;
  const evidencePackage = isPackage ? evidencePackageOrContent : null;
  const effectiveMaxChars = (evidencePackage && typeof evidencePackage.maxContextCharsOverride === 'number')
    ? evidencePackage.maxContextCharsOverride
    : maxContextChars;
  const rawContent = evidencePackage ? (evidencePackage.unifiedRawContent || '') : String(evidencePackageOrContent || '');

  const supporting = (target.supportingEvidence || target.evidenceSpan || '').trim();

  // ──────────────────────────────────────────────────────────────────────────
  // Primary Path: Multimodal Hybrid Retrieval (Dense + BM25 + Content-Type Boost + Reranker)
  // ──────────────────────────────────────────────────────────────────────────
  const activeStore = evidencePackage?.multimodalStore || evidencePackage?.hierarchicalStore;
  if (activeStore && Array.isArray(activeStore.children) && activeStore.children.length > 0) {
    try {
      const candidates = HybridRetriever.retrieveForTarget(activeStore, target, { topK: 4 });
      if (candidates && candidates.length > 0) {
        const { evidenceContextString } = RerankerService.rerank(candidates, target, { topN: 3 });
        if (evidenceContextString && evidenceContextString.trim().length > 30) {
          const parts = [];
          if (supporting) {
            parts.push('[DIRECT TARGET EVIDENCE]\n' + supporting);
          }
          let fullContext = evidenceContextString.trim();
          if (fullContext.length > effectiveMaxChars) {
            fullContext = fullContext.substring(0, effectiveMaxChars);
          }
          parts.push('[RELEVANT MULTIMODAL CONTEXT (HYBRID BM25 + DENSE)]\n' + fullContext);
          return parts.join('\n\n');
        }
      }
    } catch (hybridErr) {
      console.warn(`⚠️ [EvidenceContextSelector] Hybrid retrieval notice for target ${target.targetId}: ${hybridErr.message}. Falling back to standard hierarchical.`);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Secondary Path: Dual-Level Hierarchical RAG + Cross-Material Alignment
  // ──────────────────────────────────────────────────────────────────────────
  if (evidencePackage && evidencePackage.hierarchicalStore && Array.isArray(evidencePackage.hierarchicalStore.children)) {
    try {
      const retrieved = HierarchicalRetriever.retrieveForTarget(evidencePackage.hierarchicalStore, target, 2);

      // Verify hierarchical retrieval found a reliable match
      if (retrieved && retrieved.retrievedContent && retrieved.retrievedContent.length > 50 && retrieved.relevanceScore > 0) {
        let extraCrossModalContent = '';

        // Cross-Material Alignment Expansion (Step 2)
        if (evidencePackage.alignmentGraph && Object.keys(evidencePackage.alignmentGraph).length > 0) {
          const expandedEids = CrossMaterialAligner.expandEvidenceWithAlignment(
            evidencePackage.hierarchicalStore,
            retrieved.matchedChildIds,
            evidencePackage.alignmentGraph
          );

          for (const eid of expandedEids) {
            if (!retrieved.matchedChildIds.includes(eid)) {
              const childObj = evidencePackage.hierarchicalStore.childMap?.[eid];
              const parentObj = childObj?.parentId ? evidencePackage.hierarchicalStore.parentMap?.[childObj.parentId] : null;

              if (parentObj) {
                const pSource = (parentObj.sourceType || '').toUpperCase();
                const roleTag = (pSource === 'SLIDE' || pSource === 'DOCUMENT' || pSource === 'CODE')
                  ? ' [TECHNICAL SPECIFICATION & ARTIFACT REFERENCE]'
                  : ' [SPOKEN LECTURE DEMONSTRATION & TEACHING EMPHASIS]';
                extraCrossModalContent += `\n\n=== [CROSS-MATERIAL LINKED EVIDENCE: ${parentObj.title} (${eid})${roleTag}] ===\n${parentObj.fullText.substring(0, 1000)}`;
              } else if (childObj) {
                const cSource = (childObj.sourceType || '').toUpperCase();
                const roleTag = (cSource === 'SLIDE' || cSource === 'DOCUMENT' || cSource === 'CODE')
                  ? ' [TECHNICAL SPECIFICATION & ARTIFACT REFERENCE]'
                  : ' [SPOKEN LECTURE DEMONSTRATION & TEACHING EMPHASIS]';
                extraCrossModalContent += `\n\n=== [CROSS-MATERIAL LINKED EVIDENCE: ${eid}${roleTag}] ===\n${childObj.text}`;
              }
            }
          }
        }

        const parts = [];
        if (supporting) {
          parts.push('[DIRECT TARGET EVIDENCE]\n' + supporting);
        }
        let fullContext = (retrieved.retrievedContent + extraCrossModalContent).trim();
        if (fullContext.length > effectiveMaxChars) {
          fullContext = fullContext.substring(0, effectiveMaxChars);
        }
        parts.push('[RELEVANT SESSION CONTEXT (HIERARCHICAL & ALIGNED)]\n' + fullContext);
        return parts.join('\n\n');
      }
    } catch (hierErr) {
      console.warn(`⚠️ [EvidenceContextSelector] Hierarchical retrieval notice for target ${target.targetId}: ${hierErr.message}. Falling back to sliding window.`);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Fallback Path: Sliding-Window Keyword Matcher (Retained for 100% Resilience)
  // ──────────────────────────────────────────────────────────────────────────
  const content = rawContent || '';
  if (content.length === 0) {
    return target.supportingEvidence || target.concept || 'No content provided.';
  }

  // If content is already shorter than window, return it entirely
  if (content.length <= effectiveMaxChars) {
    const parts = [];
    if (supporting) {
      parts.push('[DIRECT TARGET EVIDENCE]\n' + supporting);
    }
    parts.push('[RELEVANT SESSION CONTEXT]\n' + content.trim());
    return parts.join('\n\n');
  }

  const concept = (target.concept || '').trim();
  const subtopic = (target.subtopic || '').trim();
  const instruction = (target.instruction || '').trim();

  let matchIndex = -1;

  // 1. Direct Substring Search for Supporting Evidence
  if (supporting.length > 8) {
    matchIndex = content.indexOf(supporting);
    if (matchIndex === -1) {
      const sub = supporting.substring(0, Math.min(50, supporting.length)).toLowerCase();
      matchIndex = content.toLowerCase().indexOf(sub);
    }
  }

  // 2. Semantic Block Scoring across the entire transcript
  if (matchIndex === -1) {
    const queryTokens = new Set([
      ...tokenize(concept),
      ...tokenize(subtopic),
      ...tokenize(supporting),
      ...tokenize(instruction)
    ]);

    if (queryTokens.size > 0) {
      const blockSize = 600;
      const step = 300;
      let bestScore = -1;
      let bestPos = 0;

      for (let pos = 0; pos < content.length; pos += step) {
        const block = content.substring(pos, pos + blockSize).toLowerCase();
        let score = 0;
        for (const token of queryTokens) {
          const occurrences = (block.match(new RegExp('\\b' + token + '\\b', 'g')) || []).length;
          score += occurrences;
        }
        if (score > bestScore) {
          bestScore = score;
          bestPos = pos;
        }
      }

      if (bestScore > 0) {
        matchIndex = bestPos;
      }
    }
  }

  // 3. Extract surrounding window around matchIndex
  let windowText = '';
  if (matchIndex !== -1) {
    const halfWindow = Math.floor(effectiveMaxChars / 2);
    const start = Math.max(0, matchIndex - halfWindow);
    const end = Math.min(content.length, start + effectiveMaxChars);
    const adjustedStart = Math.max(0, end - effectiveMaxChars);
    windowText = content.substring(adjustedStart, end);
  } else {
    windowText = content.substring(0, effectiveMaxChars);
  }

  const parts = [];
  if (supporting) {
    parts.push('[DIRECT TARGET EVIDENCE]\n' + supporting);
  }
  parts.push('[RELEVANT SESSION CONTEXT]\n' + windowText.trim());

  return parts.join('\n\n');
}

/**
 * Format seconds into mm:ss
 */
function formatTs(seconds) {
  if (typeof seconds !== 'number' || isNaN(seconds) || seconds < 0) return '00:00';
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Resolves and strictly verifies the genuine evidence provenance for an assessment target / question.
 * Safeguard 3: Checks all supporting chunk IDs against the active evidence store.
 * Safeguard 4: Sets VOICE + DOCUMENT only when an actual, validated relationship exists.
 *
 * @param {Object} target - AssessmentTarget
 * @param {Object} evidencePackage - Session evidence package
 * @param {Object} [evalResult] - Agent 3 evaluation result
 * @returns {Object} Provenance metadata
 */
function resolveTargetProvenance(target = {}, evidencePackage = null, evalResult = null) {
  const activeStore = evidencePackage?.multimodalStore || evidencePackage?.hierarchicalStore;
  const targetId = target.targetId || target.target_id || 'T_UNKNOWN';

  if (!activeStore || !Array.isArray(activeStore.children) || activeStore.children.length === 0) {
    return {
      targetId,
      supportingChunks: [],
      parentChunks: [],
      timeSpan: null,
      hasRealTimestamps: false,
      sourceOrigin: 'VOICE',
      isEvidenceVerified: false,
      verificationStatus: 'UNVERIFIED_NO_STORE'
    };
  }

  // 1. Identify matched evidence children from the active store
  let matchedChildren = [];
  try {
    const candidates = HybridRetriever.retrieveForTarget(activeStore, target, { topK: 3 });
    if (candidates && candidates.length > 0) {
      matchedChildren = candidates.map(c => c.child).filter(Boolean);
    }
  } catch (_) {}

  if (matchedChildren.length === 0) {
    try {
      const hierRetrieved = HierarchicalRetriever.retrieveForTarget(activeStore, target, 2);
      if (hierRetrieved && Array.isArray(hierRetrieved.matchedChildIds)) {
        matchedChildren = hierRetrieved.matchedChildIds
          .map(cid => activeStore.childMap?.[cid])
          .filter(Boolean);
      }
    } catch (_) {}
  }

  // Check if target specified explicit sourceChunks that are missing from active store
  const hasExplicitSourceChunks = Array.isArray(target.sourceChunks) && target.sourceChunks.length > 0;
  const invalidSourceChunks = hasExplicitSourceChunks
    ? target.sourceChunks.filter(cid => !activeStore.childMap?.[cid])
    : [];

  // Fallback to target's existing sourceChunks if valid
  if (matchedChildren.length === 0 && hasExplicitSourceChunks) {
    matchedChildren = target.sourceChunks
      .map(cid => activeStore.childMap?.[cid])
      .filter(Boolean);
  }

  // If still no specific match, bind to the most representative child in store ONLY if no explicit invalid chunks were passed
  if (matchedChildren.length === 0 && activeStore.children.length > 0 && invalidSourceChunks.length === 0) {
    const phase = String(target.trajectoryPhase || 'MID').toUpperCase();
    const cCount = activeStore.children.length;
    let fallbackIdx = Math.floor(cCount / 2);
    if (phase === 'EARLY') fallbackIdx = 0;
    else if (phase === 'LATE') fallbackIdx = Math.max(0, cCount - 1);
    matchedChildren = [activeStore.children[fallbackIdx]];
  }

  const supportingChunks = Array.from(new Set(matchedChildren.map(c => c.evidenceId).filter(Boolean)));
  const parentChunks = Array.from(new Set(matchedChildren.map(c => c.parentId).filter(Boolean)));

  // 2. Strict Provenance Verification against Active Store (Safeguard 3)
  const allChunksValid = supportingChunks.length > 0 && invalidSourceChunks.length === 0 &&
    supportingChunks.every(id => {
      const child = activeStore.childMap?.[id];
      return Boolean(child && typeof child.text === 'string' && child.text.length > 0);
    });

  const isEvidenceVerified = allChunksValid;
  const verificationStatus = isEvidenceVerified
    ? 'VERIFIED_AGAINST_STORE'
    : (invalidSourceChunks.length > 0 ? 'UNVERIFIED_INVALID_CHUNK_REFERENCE' : (supportingChunks.length === 0 ? 'UNVERIFIED_NO_CHUNKS' : 'UNVERIFIED_INVALID_CHUNK_REFERENCE'));

  // 3. Genuine Whisper Timestamp Propagation (Safeguard 2: null when unavailable, not fake timing)
  const getChildStart = c => typeof c?.start === 'number' ? c.start : (typeof c?.timeSpan?.start === 'number' ? c.timeSpan.start : null);
  const getChildEnd = c => typeof c?.end === 'number' ? c.end : (typeof c?.timeSpan?.end === 'number' ? c.timeSpan.end : null);

  const timedChildren = matchedChildren.filter(c => {
    const s = getChildStart(c);
    const e = getChildEnd(c);
    const hasTs = Boolean(c?.hasRealTimestamps || c?.timeSpan?.hasRealTimestamps);
    return hasTs && s !== null && e !== null && !isNaN(s) && !isNaN(e);
  });

  let timeSpan = null;
  let hasRealTimestamps = false;
  let timestampProvenance = 'UNAVAILABLE';

  if (timedChildren.length > 0) {
    const minStart = Math.min(...timedChildren.map(getChildStart));
    const maxEnd = Math.max(...timedChildren.map(getChildEnd));
    timeSpan = {
      start: minStart,
      end: maxEnd,
      formatted: `${formatTs(minStart)} - ${formatTs(maxEnd)}`,
      hasRealTimestamps: true,
      provenance: 'GENUINE'
    };
    hasRealTimestamps = true;
    timestampProvenance = 'GENUINE';
  }

  // 4. Truthful Modality Attribution (Safeguard 4: Do not overstate alignment)
  const sessionHasDocs = Boolean(
    evidencePackage?.hasAlignedDocs ||
    (Array.isArray(evidencePackage?.documentTexts) && evidencePackage.documentTexts.length > 0) ||
    activeStore.children.some(c => c.sourceType === 'SLIDE' || c.sourceType === 'CODE')
  );
  const sessionHasVoice = Boolean(
    evidencePackage?.voiceAnalysis ||
    (typeof evidencePackage?.unifiedRawContent === 'string' && evidencePackage.unifiedRawContent.includes('[VOICE TRANSCRIPT]')) ||
    activeStore.children.some(c => c.sourceType === 'TRANSCRIPT')
  );

  const matchedHasVoice = matchedChildren.some(c => c.sourceType === 'TRANSCRIPT');
  const matchedHasDocs = matchedChildren.some(c => c.sourceType === 'SLIDE' || c.sourceType === 'CODE');

  // Check if cross-material alignment graph links any of these audio chunks to an aligned slide
  const alignmentGraph = evidencePackage?.alignmentGraph || {};
  const hasLinkedCrossModalSlide = supportingChunks.some(cid =>
    Array.isArray(alignmentGraph[cid]) && alignmentGraph[cid].length > 0
  );

  let sourceOrigin = 'VOICE';
  if (!sessionHasDocs && sessionHasVoice) {
    // Pure voice session: 100% voice authority, zero document attribution
    sourceOrigin = 'VOICE';
  } else if (!sessionHasVoice && sessionHasDocs) {
    // Pure document session
    sourceOrigin = 'DOCUMENT';
  } else if (sessionHasVoice && sessionHasDocs) {
    // Mixed session: Only assign 'VOICE + DOCUMENT' if a validated cross-material link exists!
    const isDocAligned = Boolean(evidencePackage?.hasAlignedDocs && !evidencePackage?.unalignedDocuments?.includes(target.concept));
    if ((matchedHasVoice && matchedHasDocs) || (matchedHasVoice && hasLinkedCrossModalSlide && isDocAligned)) {
      sourceOrigin = 'VOICE + DOCUMENT';
    } else if (matchedHasDocs && !matchedHasVoice) {
      sourceOrigin = 'DOCUMENT';
    } else {
      sourceOrigin = 'VOICE';
    }
  }

  return {
    targetId,
    supportingChunks,
    parentChunks,
    timeSpan,
    hasRealTimestamps,
    timestampProvenance,
    sourceOrigin,
    isEvidenceVerified,
    verificationStatus
  };
}

module.exports = {
  getTargetEvidenceContext,
  resolveTargetProvenance,
  formatTs
};

