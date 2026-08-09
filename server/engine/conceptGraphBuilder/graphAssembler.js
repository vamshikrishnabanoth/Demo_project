const { CONCEPT_CONFIG } = require('../../config/conceptConfig');
const { extractSummaryContext } = require('./snippetExtractor');
const { inferConceptType } = require('./conceptTyper');

/**
 * 6. OUTPUT SCHEMA CONTRACT & GRAPH ASSEMBLER
 * Assembles nodes, edges, clusters, metadata, diagnostics, and conceptIndex.
 */
function assembleGraph(opts) {
  const {
    nodes = [],
    edges = [],
    traversalOrder = [],
    conceptIndex = {},
    metadata = {},
    diagnostics = { extractorWarnings: [], buildWarnings: [] },
    fullText = ''
  } = opts;

  // Enrich node schema
  const enrichedNodes = nodes.map(n => {
    const sources = Array.from(n.sources || []);
    const aliases = Array.from(n.aliases || []);
    const conceptType = inferConceptType(n.label, sources, fullText);
    const firstSpan = (n.evidenceOffsets && n.evidenceOffsets[0]) ? n.evidenceOffsets[0] : [0, 50];
    const summaryContext = extractSummaryContext(fullText, firstSpan[0], firstSpan[1]);

    return {
      id: n.id,
      label: n.label,
      aliases,
      sources,
      category: "CORE_CONCEPT",
      conceptType,
      importanceScore: n.importanceScore || 0.5,
      centralityScore: n.centralityScore || 0.5,
      confidence: n.confidence || 0.90,
      hasCodeOrMath: !!n.hasCodeOrMath,
      summaryContext,
      evidenceOffsets: n.evidenceOffsets || []
    };
  });

  // Calculate average edge confidence
  const avgConfidence = edges.length > 0 
    ? Number((edges.reduce((acc, e) => acc + (e.confidence || 0.8), 0) / edges.length).toFixed(2))
    : 0.90;

  // Build basic concept clusters (grouping by conceptType or top topics)
  const clusterMap = new Map();
  enrichedNodes.forEach(node => {
    const cName = node.conceptType !== 'GENERAL_CONCEPT' ? `${node.conceptType} Domain` : "General Core Domain";
    if (!clusterMap.has(cName)) clusterMap.set(cName, []);
    clusterMap.get(cName).push(node.id);
  });

  const clusters = Array.from(clusterMap.entries()).map(([clusterName, conceptIds]) => ({
    clusterName,
    conceptIds
  }));

  return {
    graphVersion: CONCEPT_CONFIG.VERSION.GRAPH,
    metadata: {
      graphVersion: CONCEPT_CONFIG.VERSION.GRAPH,
      extractorVersion: CONCEPT_CONFIG.VERSION.EXTRACTORS,
      normalizerVersion: CONCEPT_CONFIG.VERSION.NORMALIZER,
      activeExtractorsCount: metadata.activeExtractorsCount || 5,
      totalCandidates: metadata.totalCandidates || 0,
      retainedLimit: metadata.retainedLimit || 30,
      mergedAliases: metadata.mergedAliases || 0,
      filteredNoise: metadata.filteredNoise || 0,
      prunedOrphans: metadata.prunedOrphans || 0,
      cyclesResolved: metadata.cyclesResolved || 0,
      averageConfidence: avgConfidence,
      buildTimeMs: metadata.buildTimeMs || 0
    },
    diagnostics: {
      extractorWarnings: diagnostics.extractorWarnings || [],
      buildWarnings: diagnostics.buildWarnings || []
    },
    conceptIndex,
    traversalOrder,
    nodes: enrichedNodes,
    edges,
    clusters
  };
}

module.exports = {
  assembleGraph
};
