const { CONCEPT_CONFIG } = require('../../config/conceptConfig');

/**
 * 5. CONCEPT GRAPH NORMALIZER
 * Prunes low-importance orphans, breaks cyclic prerequisite edges deterministically,
 * derives topological traversal order, and calculates heuristic centrality scores.
 */
function normalizeConceptGraph(rawGraph, diagnostics = { buildWarnings: [] }) {
  let { nodes = [], edges = [] } = rawGraph;
  const THRESHOLDS = CONCEPT_CONFIG.PRUNING_THRESHOLDS;
  let prunedOrphansCount = 0;
  let cyclesResolvedCount = 0;

  // 1. Conservative Orphan Node Pruning
  const connectedNodeIds = new Set();
  edges.forEach(e => {
    connectedNodeIds.add(e.source);
    connectedNodeIds.add(e.target);
  });

  const retainedNodes = [];
  nodes.forEach((node) => {
    const isOrphan = !connectedNodeIds.has(node.id);
    const sourcesArr = Array.from(node.sources || []);
    const isHeader = sourcesArr.includes('HEADER');

    if (isOrphan && 
        node.importanceScore < THRESHOLDS.ORPHAN_MIN_IMPORTANCE && 
        (node.frequency || 1) <= THRESHOLDS.ORPHAN_MAX_FREQUENCY && 
        !isHeader) {
      prunedOrphansCount++;
    } else {
      retainedNodes.push(node);
    }
  });

  // Filter edges whose endpoints were pruned
  const activeNodeIds = new Set(retainedNodes.map(n => n.id));
  let activeEdges = edges.filter(e => activeNodeIds.has(e.source) && activeNodeIds.has(e.target));

  // 2. Deterministic Cycle-Resilient Topological Sorting (Best-Effort DAG)
  const nodeMap = new Map(retainedNodes.map(n => [n.id, n]));
  const inDegree = new Map();
  const adj = new Map();

  retainedNodes.forEach(n => {
    inDegree.set(n.id, 0);
    adj.set(n.id, []);
  });

  activeEdges.forEach(e => {
    inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
    adj.get(e.source).push(e);
  });

  const traversalOrder = [];
  const queue = retainedNodes.filter(n => inDegree.get(n.id) === 0).map(n => n.id);
  const visited = new Set();

  while (queue.length > 0) {
    // Sort queue deterministically (higher importance, then lexicographical ID)
    queue.sort((a, b) => {
      const impA = nodeMap.get(a)?.importanceScore || 0;
      const impB = nodeMap.get(b)?.importanceScore || 0;
      if (impB !== impA) return impB - impA;
      return a.localeCompare(b);
    });

    const curr = queue.shift();
    if (visited.has(curr)) continue;

    visited.add(curr);
    traversalOrder.push(curr);

    const outgoing = adj.get(curr) || [];
    outgoing.forEach(edge => {
      const dest = edge.target;
      inDegree.set(dest, inDegree.get(dest) - 1);
      if (inDegree.get(dest) === 0) {
        queue.push(dest);
      }
    });
  }

  // Detect and resolve cycles deterministically if not all nodes visited
  if (traversalOrder.length < retainedNodes.length) {
    const unvisited = retainedNodes.filter(n => !visited.has(n.id));
    
    const cyclicEdges = activeEdges.filter(e => !visited.has(e.source) || !visited.has(e.target));
    
    if (cyclicEdges.length > 0) {
      cyclicEdges.sort((a, b) => {
        if (a.confidence !== b.confidence) return a.confidence - b.confidence;
        const nodeA1 = nodeMap.get(a.source);
        const nodeB1 = nodeMap.get(b.source);
        const posA = nodeA1?.firstOffset || 0;
        const posB = nodeB1?.firstOffset || 0;
        if (posA !== posB) return posB - posA; // Higher offset broken first
        return a.source.localeCompare(b.source);
      });

      const edgeToBreak = cyclicEdges[0];
      activeEdges = activeEdges.filter(e => !(e.source === edgeToBreak.source && e.target === edgeToBreak.target));
      cyclesResolvedCount++;

      const warnMsg = `[Cycle Resolved] Broken cyclic prerequisite edge ${edgeToBreak.source} -> ${edgeToBreak.target} (Confidence: ${edgeToBreak.confidence})`;
      diagnostics.buildWarnings.push(warnMsg);
      console.warn(`[GUARD] ${warnMsg}`);
    }

    // Append remaining unvisited nodes in deterministic order
    unvisited.sort((a, b) => b.importanceScore - a.importanceScore || a.id.localeCompare(b.id));
    unvisited.forEach(n => traversalOrder.push(n.id));
  }

  // 3. Deterministic Heuristic Centrality Calculation
  const degreeMap = new Map();
  retainedNodes.forEach(n => degreeMap.set(n.id, 0));
  activeEdges.forEach(e => {
    degreeMap.set(e.source, (degreeMap.get(e.source) || 0) + 1);
    degreeMap.set(e.target, (degreeMap.get(e.target) || 0) + 1);
  });

  retainedNodes.forEach((node) => {
    const degree = degreeMap.get(node.id) || 0;
    const degreeContrib = Math.min(0.4, (degree / Math.max(1, retainedNodes.length)) * 2.0);
    const importanceContrib = (node.importanceScore || 0.5) * 0.6;
    node.centralityScore = Number(Math.min(1.0, Math.max(0.1, degreeContrib + importanceContrib)).toFixed(2));
  });

  return {
    normalizedNodes: retainedNodes,
    normalizedEdges: activeEdges,
    traversalOrder,
    prunedOrphansCount,
    cyclesResolvedCount
  };
}

module.exports = {
  normalizeConceptGraph
};
