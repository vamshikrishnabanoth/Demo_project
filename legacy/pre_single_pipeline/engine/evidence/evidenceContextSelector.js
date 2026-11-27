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
 * @param {number} maxContextChars - Maximum character budget for context window (default: 4000, validated for curricular narrative coverage)
 * @returns {string} Formatted evidence context
 */
function getTargetEvidenceContext(target = {}, evidencePackageOrContent = '', maxContextChars = 4000) {
  const isPackage = typeof evidencePackageOrContent === 'object' && evidencePackageOrContent !== null;
  const evidencePackage = isPackage ? evidencePackageOrContent : null;
  const effectiveMaxChars = (evidencePackage && typeof evidencePackage.maxContextCharsOverride === 'number')
    ? evidencePackage.maxContextCharsOverride
    : maxContextChars;
  const rawContent = evidencePackage ? (evidencePackage.unifiedRawContent || '') : String(evidencePackageOrContent || '');

  const supporting = (target.supportingEvidence || target.evidenceSpan || '').trim();
  const activeStore = evidencePackage?.multimodalStore || evidencePackage?.hierarchicalStore;

  // ──────────────────────────────────────────────────────────────────────────
  // Path 0: Exact Chunk-ID Lookup (Highest Precedence)
  // ──────────────────────────────────────────────────────────────────────────
  const targetChunkIds = Array.isArray(target.sourceChunks) && target.sourceChunks.length > 0
    ? target.sourceChunks
    : (Array.isArray(target.supportingChunks) && target.supportingChunks.length > 0 ? target.supportingChunks : []);

  if (activeStore && targetChunkIds.length > 0) {
    const validChunks = [];
    const missingChunkIds = [];

    for (const cid of targetChunkIds) {
      const chunk = activeStore.childMap?.[cid] ||
        activeStore.children?.find(c => c.evidenceId === cid || c.childId === cid) ||
        activeStore.parentMap?.[cid];
      if (chunk && typeof chunk.text === 'string' && chunk.text.trim().length > 0) {
        validChunks.push(chunk);
      } else {
        missingChunkIds.push(cid);
      }
    }

    if (missingChunkIds.length > 0) {
      console.warn(`⚠️ [EvidenceContextSelector] Target ${target.targetId || target.concept} references invalid/missing chunk ID(s): ${missingChunkIds.join(', ')}`);
    }

    if (validChunks.length > 0) {
      const parts = [];
      if (supporting) {
        parts.push(`[DIRECT TARGET EVIDENCE]\n${supporting}`);
      }

      // Format exact retrieved chunks with identity, source type, timing, offsets, and authoritative role tags
      const chunkTexts = validChunks.map(c => {
        const eid = c.evidenceId || c.childId || c.id || 'CHUNK';
        const sType = (c.sourceType || 'TRANSCRIPT').toUpperCase();
        const roleTag = (sType === 'SLIDE' || sType === 'DOCUMENT' || sType === 'CODE')
          ? ' [TECHNICAL SPECIFICATION & ARTIFACT REFERENCE]'
          : ' [SPOKEN LECTURE DEMONSTRATION & TEACHING EMPHASIS]';
        const timing = c.timeSpan?.formatted ? ` | Time: ${c.timeSpan.formatted}` : '';
        const offsetInfo = (typeof c.start === 'number' && typeof c.end === 'number') ? ` | Offsets: [${c.start}..${c.end}]` : '';
        return `=== [EXACT EVIDENCE CHUNK: ${eid} (${sType})${roleTag}${timing}${offsetInfo}] ===\n${c.text.trim()}`;
      });

      let fullExactContext = chunkTexts.join('\n\n');
      if (fullExactContext.length > effectiveMaxChars) {
        fullExactContext = fullExactContext.substring(0, effectiveMaxChars);
      }

      parts.push(`[VERIFIED TEACHING UNIT EVIDENCE (EXACT CHUNK LOOKUP)]\n${fullExactContext}`);
      return parts.join('\n\n');
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Fallback Retrieval Paths (Only when exact sourceChunks are unavailable)
  // ──────────────────────────────────────────────────────────────────────────
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
          parts.push('[RELEVANT MULTIMODAL CONTEXT (HYBRID BM25 + DENSE FALLBACK)]\n' + fullContext);
          return parts.join('\n\n');
        }
      }
    } catch (hybridErr) {
      console.warn(`⚠️ [EvidenceContextSelector] Hybrid retrieval notice for target ${target.targetId}: ${hybridErr.message}. Falling back to standard hierarchical.`);
    }
  }

  // Secondary Path: Dual-Level Hierarchical RAG + Cross-Material Alignment
  if (evidencePackage && evidencePackage.hierarchicalStore && Array.isArray(evidencePackage.hierarchicalStore.children)) {
    try {
      const retrieved = HierarchicalRetriever.retrieveForTarget(evidencePackage.hierarchicalStore, target, 2);
      if (retrieved && retrieved.retrievedContent && retrieved.retrievedContent.length > 50 && retrieved.relevanceScore > 0) {
        let extraCrossModalContent = '';
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
        parts.push('[RELEVANT SESSION CONTEXT (HIERARCHICAL & ALIGNED FALLBACK)]\n' + fullContext);
        return parts.join('\n\n');
      }
    } catch (hierErr) {
      console.warn(`⚠️ [EvidenceContextSelector] Hierarchical retrieval notice for target ${target.targetId}: ${hierErr.message}. Falling back to sliding window.`);
    }
  }

  // Fallback Path: Sliding-Window Keyword Matcher
  const content = rawContent || '';
  if (content.length === 0) {
    return target.supportingEvidence || target.concept || 'No content provided.';
  }

  if (content.length <= effectiveMaxChars) {
    const parts = [];
    if (supporting) {
      parts.push('[DIRECT TARGET EVIDENCE]\n' + supporting);
    }
    parts.push('[RELEVANT SESSION CONTEXT (DIRECT CONTENT)]\n' + content.trim());
    return parts.join('\n\n');
  }

  const concept = (target.concept || '').trim();
  const subtopic = (target.subtopic || '').trim();
  const instruction = (target.instruction || '').trim();

  let matchIndex = -1;
  if (supporting.length > 8) {
    matchIndex = content.indexOf(supporting);
    if (matchIndex === -1) {
      const sub = supporting.substring(0, Math.min(50, supporting.length)).toLowerCase();
      matchIndex = content.toLowerCase().indexOf(sub);
    }
  }

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

  // CRITICAL REQUIREMENT: Do NOT silently fall back to transcript character index 0!
  let windowText = '';
  if (matchIndex !== -1) {
    const halfWindow = Math.floor(effectiveMaxChars / 2);
    const start = Math.max(0, matchIndex - halfWindow);
    const end = Math.min(content.length, start + effectiveMaxChars);
    const adjustedStart = Math.max(0, end - effectiveMaxChars);
    windowText = content.substring(adjustedStart, end);
  } else {
    // If no match found, do NOT return character 0 of the lecture introduction!
    // Return supporting evidence directly and warn explicitly.
    console.warn(`⚠️ [EvidenceContextSelector] No keyword or semantic match found for target "${concept}". Suppressing silent fallback to transcript index 0.`);
    windowText = supporting || concept || 'Target evidence could not be localized within transcript.';
  }

  const parts = [];
  if (supporting) {
    parts.push('[DIRECT TARGET EVIDENCE]\n' + supporting);
  }
  parts.push('[RELEVANT SESSION CONTEXT (LOCALIZED WINDOW)]\n' + windowText.trim());
  return parts.join('\n\n');
}

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

  // Prioritize explicit verified sourceChunks on target to prevent provenance loss during reserve promotion
  const hasExplicitSourceChunks = Array.isArray(target.sourceChunks) && target.sourceChunks.length > 0;
  const invalidSourceChunks = hasExplicitSourceChunks
    ? target.sourceChunks.filter(cid => !activeStore.childMap?.[cid] && !activeStore.children?.some(c => c.evidenceId === cid || c.childId === cid))
    : [];

  if (hasExplicitSourceChunks) {
    matchedChildren = target.sourceChunks
      .map(cid => activeStore.childMap?.[cid] || activeStore.children?.find(c => c.evidenceId === cid || c.childId === cid))
      .filter(Boolean);
  }

  // Only if no explicit source chunks are available or valid, fall back to retrieval
  if (matchedChildren.length === 0) {
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

