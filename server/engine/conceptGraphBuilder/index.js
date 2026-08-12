const { performance } = require('perf_hooks');
const registry = require('./registry');
const { cleanDocument } = require('./utils/documentCleaner');
const { resolveAliasesAndBuildIndex } = require('./aliasResolver');
const { calculateAdaptiveRetentionLimit, calculateImportanceScore } = require('./scoring');
const { inferEdges } = require('./edgeInference');
const { normalizeConceptGraph } = require('./normalizer');
const { assembleGraph } = require('./graphAssembler');

/**
 * Public API: buildConceptGraph(cleanedContent, options)
 * Executes Passes 1 to 4 with exception-isolated extraction, adaptive retention bounds,
 * cycle-resilient normalization, and inverted index mapping.
 */
function buildConceptGraph(cleanedContent, options = {}) {
  const startTime = performance.now();
  const diagnostics = {
    extractorWarnings: [],
    buildWarnings: []
  };

  if (!cleanedContent || typeof cleanedContent !== 'string') {
    return assembleGraph({
      nodes: [],
      edges: [],
      traversalOrder: [],
      conceptIndex: {},
      metadata: { buildTimeMs: Math.round(performance.now() - startTime) },
      diagnostics
    });
  }

  // Pass 0: Module 1 Input Preprocessing (Document Cleaner)
  const { cleanedText, stats: cleanStats } = cleanDocument(cleanedContent);
  if (cleanStats.ocrArtifactsRemoved > 0) {
    console.log(`[PREPROCESS] Removed ${cleanStats.ocrArtifactsRemoved} OCR artifacts / slide headers.`);
  }
  const textToProcess = cleanedText || cleanedContent;

  // Pass 1: Extractor Registry Execution (Stateless, Exception-Isolated)
  const rawCandidates = registry.runAll(textToProcess, diagnostics);

  // Pass 2: Deterministic Alias Merging & Inverted Index Construction
  const { conceptMap, conceptIndex, mergedAliasesCount, filteredNoiseCount } = resolveAliasesAndBuildIndex(rawCandidates, textToProcess);

  // Pass 3: Adaptive Node Retention & Importance Scoring
  const candidateCount = conceptMap.size;
  const retainedLimit = calculateAdaptiveRetentionLimit(candidateCount);

  const candidateNodes = Array.from(conceptMap.values()).map(node => {
    node.importanceScore = calculateImportanceScore(node);
    return node;
  });

  // Sort candidates by importanceScore descending and retain top concepts bounded by dynamic limit
  candidateNodes.sort((a, b) => b.importanceScore - a.importanceScore);
  const retainedCandidateNodes = candidateNodes.slice(0, retainedLimit);

  // Pass 4: Clamped Edge Inference
  const rawEdges = inferEdges(retainedCandidateNodes, textToProcess);

  // Normalization: Conservative Orphan Pruning, Cycle-Resilient Topological Sort, Centrality
  const {
    normalizedNodes,
    normalizedEdges,
    traversalOrder,
    prunedOrphansCount,
    cyclesResolvedCount
  } = normalizeConceptGraph({ nodes: retainedCandidateNodes, edges: rawEdges }, diagnostics);

  const buildTimeMs = Math.round(performance.now() - startTime);

  // Final Graph Assembly
  return assembleGraph({
    nodes: normalizedNodes,
    edges: normalizedEdges,
    traversalOrder,
    conceptIndex,
    metadata: {
      activeExtractorsCount: registry.getActiveExtractorsCount(),
      totalCandidates: candidateCount,
      retainedLimit,
      mergedAliases: mergedAliasesCount,
      filteredNoise: filteredNoiseCount,
      prunedOrphans: prunedOrphansCount,
      cyclesResolved: cyclesResolvedCount,
      buildTimeMs
    },
    diagnostics,
    fullText: textToProcess
  });
}

module.exports = {
  buildConceptGraph
};
