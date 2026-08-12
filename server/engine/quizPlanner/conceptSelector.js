const { PLANNER_CONFIG } = require('../../config/plannerConfig');

/**
 * Pass 1: Weighted Concept Allocation & Hamilton Rounding (conceptSelector.js)
 * Calculates dynamic allocation scores, applies Hamilton slot allocation, and enforces non-consecutive guard.
 */
function allocateConceptSlots(conceptGraph, requestedCount = 10) {
  const WEIGHTS = PLANNER_CONFIG.ALLOCATION_WEIGHTS;
  const maxShare = PLANNER_CONFIG.MAX_SINGLE_CONCEPT_SLOT_SHARE;
  const nodes = conceptGraph?.nodes || [];
  const traversalOrder = conceptGraph?.traversalOrder || [];
  const clusters = conceptGraph?.clusters || [];

  if (nodes.length === 0) {
    const fallbackNode = { id: "core_concept", label: "Core Concept", importanceScore: 1.0 };
    return {
      allocatedSlots: Array(requestedCount).fill(fallbackNode),
      uncoveredConceptIds: [],
      conceptCoverageRatio: 1.0,
      averageConceptImportance: 1.0
    };
  }

  // Build cluster lookup map for cluster coverage bonus
  const clusterSizeMap = new Map();
  clusters.forEach(c => {
    (c.conceptIds || []).forEach(cid => {
      clusterSizeMap.set(cid, (c.conceptIds || []).length);
    });
  });

  const traversalIndexMap = new Map();
  traversalOrder.forEach((id, idx) => traversalIndexMap.set(id, idx));

  // Compute dynamic allocation scores
  const scoredNodes = nodes.map((node, idx) => {
    const nodeId = node.id || `node_${idx}`;
    const imp = node.importanceScore !== undefined ? node.importanceScore : 0.5;
    const cent = node.centralityScore !== undefined ? node.centralityScore : 0.5;
    
    const travIdx = traversalIndexMap.has(nodeId) ? traversalIndexMap.get(nodeId) : traversalOrder.length;
    const travPriority = Math.max(0.1, 1.0 - (travIdx / Math.max(1, traversalOrder.length)));

    const cSize = clusterSizeMap.get(nodeId) || 1;
    const clusterBonus = 1.0 / Math.max(1, cSize);

    const allocScore = (WEIGHTS.IMPORTANCE * imp) + 
                       (WEIGHTS.CENTRALITY * cent) + 
                       (WEIGHTS.TRAVERSAL_PRIORITY * travPriority) + 
                       (WEIGHTS.CLUSTER_COVERAGE_BONUS * clusterBonus);

    return {
      node: { ...node, id: nodeId },
      allocScore,
      travIdx
    };
  });

  const totalScore = scoredNodes.reduce((acc, n) => acc + n.allocScore, 0);

  // Calculate Hamilton float quotas and single-concept caps
  const slotCap = nodes.length < requestedCount
    ? requestedCount
    : Math.max(1, Math.floor(requestedCount * maxShare));

  let assignedCountTotal = 0;
  const conceptSlotCounts = new Map();

  scoredNodes.forEach(item => {
    const quota = totalScore > 0 ? (requestedCount * (item.allocScore / totalScore)) : (requestedCount / nodes.length);
    const intQuota = Math.min(slotCap, Math.floor(quota));
    item.quota = quota;
    item.intQuota = intQuota;
    item.remainder = quota - Math.floor(quota);
    
    conceptSlotCounts.set(item.node.id, intQuota);
    assignedCountTotal += intQuota;
  });

  // Distribute remaining unassigned slots using Hamilton largest remainder method
  let remainingSlots = requestedCount - assignedCountTotal;
  if (remainingSlots > 0) {
    scoredNodes.sort((a, b) => {
      if (b.remainder !== a.remainder) return b.remainder - a.remainder;
      if (a.travIdx !== b.travIdx) return a.travIdx - b.travIdx;
      return String(a.node.id || '').localeCompare(String(b.node.id || ''));
    });

    let idx = 0;
    while (remainingSlots > 0) {
      const item = scoredNodes[idx % scoredNodes.length];
      const currentAssigned = conceptSlotCounts.get(item.node.id) || 0;
      if (currentAssigned < slotCap || nodes.length < requestedCount) {
        conceptSlotCounts.set(item.node.id, currentAssigned + 1);
        remainingSlots--;
      }
      idx++;
    }
  }

  // Build raw list of concepts to be assigned to slots
  const rawConceptSequence = [];
  scoredNodes.forEach(item => {
    const count = conceptSlotCounts.get(item.node.id) || 0;
    for (let c = 0; c < count; c++) {
      rawConceptSequence.push(item.node);
    }
  });

  // Enforce Non-Consecutive Assignment Guard
  const finalSequence = [];
  const pool = [...rawConceptSequence];

  while (pool.length > 0) {
    const prevConceptId = finalSequence.length > 0 ? finalSequence[finalSequence.length - 1].id : null;
    let nextIdx = pool.findIndex(n => n.id !== prevConceptId);
    
    if (nextIdx === -1) {
      nextIdx = 0; // Fallback if remaining pool contains only identical concept
    }
    
    const [selected] = pool.splice(nextIdx, 1);
    finalSequence.push(selected);
  }

  // Calculate coverage metrics (Weighted Concept Coverage)
  const mappedConceptIds = new Set(finalSequence.map(n => n.id));
  const uncoveredConceptIds = nodes.filter(n => !mappedConceptIds.has(n.id)).map(n => n.id);
  const conceptCoverageRatio = Number((mappedConceptIds.size / Math.max(1, nodes.length)).toFixed(2));
  
  const totalImportance = nodes.reduce((acc, n) => acc + (n.importanceScore || 0.5), 0);
  const coveredImportance = nodes.filter(n => mappedConceptIds.has(n.id)).reduce((acc, n) => acc + (n.importanceScore || 0.5), 0);
  const weightedConceptCoverage = Number((coveredImportance / Math.max(0.1, totalImportance)).toFixed(2));

  const avgImp = finalSequence.reduce((acc, n) => acc + (n.importanceScore || 0.5), 0) / Math.max(1, finalSequence.length);
  const averageConceptImportance = Number(avgImp.toFixed(2));

  return {
    allocatedSlots: finalSequence,
    uncoveredConceptIds,
    conceptCoverageRatio,
    weightedConceptCoverage,
    averageConceptImportance
  };
}

module.exports = {
  allocateConceptSlots
};
