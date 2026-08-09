const { CONCEPT_CONFIG } = require('../../config/conceptConfig');

/**
 * Pass 4: Clamped Edge Inference & Prerequisite Relationship Derivation
 */
function inferEdges(nodes, fullText) {
  const edges = [];
  if (!nodes || nodes.length < 2) return edges;

  const SEARCH_WINDOW = CONCEPT_CONFIG.PERFORMANCE.SEARCH_WINDOW_CHARS || 2000;

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const nodeA = nodes[i];
      const nodeB = nodes[j];

      const posA = nodeA.firstOffset || 0;
      const posB = nodeB.firstOffset || 0;
      const distance = Math.abs(posA - posB);

      if (distance <= SEARCH_WINDOW) {
        // Compute structural proximity (0.0 to 1.0)
        const structuralProximity = Math.max(0.0, 1.0 - (distance / SEARCH_WINDOW));

        // Co-occurrence frequency signal
        const coOccurrenceFreq = Math.min(1.0, (nodeA.frequency + nodeB.frequency) / 10.0);

        // Prerequisite ordering signal (earlier mentioned term is prerequisite)
        const prerequisiteOrder = posA < posB ? 0.8 : 0.4;

        // Signal count weighting
        const signalCount = Math.min(1.0, ((nodeA.sources?.length || 1) + (nodeB.sources?.length || 1)) / 4.0);

        // Weighted raw edge score calculation
        const W1 = 0.35, W2 = 0.35, W3 = 0.15, W4 = 0.15;
        const rawScore = (W1 * coOccurrenceFreq) + (W2 * structuralProximity) + (W3 * prerequisiteOrder) + (W4 * signalCount);
        const confidence = Number(Math.min(1.0, Math.max(0.1, rawScore)).toFixed(2));

        if (confidence >= 0.35) {
          const sourceNode = posA <= posB ? nodeA : nodeB;
          const targetNode = posA <= posB ? nodeB : nodeA;

          edges.push({
            source: sourceNode.id,
            target: targetNode.id,
            relation: "PREREQUISITE_FOR",
            confidence,
            relationshipsDetectedBy: ["CO_OCCURRENCE", "STRUCTURAL_PROXIMITY"],
            evidenceOffsets: [[Math.min(posA, posB), Math.max(posA, posB)]]
          });
        }
      }
    }
  }

  return edges;
}

module.exports = {
  inferEdges
};
