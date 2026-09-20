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
                extraCrossModalContent += `\n\n=== [CROSS-MATERIAL LINKED EVIDENCE: ${parentObj.title} (${eid})] ===\n${parentObj.fullText.substring(0, 1000)}`;
              } else if (childObj) {
                extraCrossModalContent += `\n\n=== [CROSS-MATERIAL LINKED EVIDENCE: ${eid}] ===\n${childObj.text}`;
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

module.exports = {
  getTargetEvidenceContext
};
