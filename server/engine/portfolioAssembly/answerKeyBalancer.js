function norm(str) {
  return typeof str === 'string' ? str.normalize("NFKC").trim() : "";
}

/**
 * 5. DETERMINISTIC SLOT-ASSIGNMENT ANSWER KEY BALANCER
 * Assigns questions directly to pre-calculated position quotas to guarantee exact answer distributions.
 */
function balanceAnswerKeyPositions(items) {
  const balancedItems = items.map(item => JSON.parse(JSON.stringify(item)));
  const total = balancedItems.length;

  if (total === 0) {
    return {
      balancedItems: [],
      positionCounts: { A: 0, B: 0, C: 0, D: 0 },
      exactQuotasMet: true
    };
  }

  // Compute exact quota array for N questions (e.g. N=10 -> [3, 3, 2, 2])
  const baseCount = Math.floor(total / 4);
  const remainder = total % 4;
  const targetQuotas = Array.from({ length: 4 }, (_, i) => baseCount + (i < remainder ? 1 : 0));

  // Build deterministic target position assignments from the computed quotas.
  const targetAssignments = [];
  targetQuotas.forEach((quota, posIndex) => {
    for (let k = 0; k < quota; k++) {
      targetAssignments.push(posIndex);
    }
  });

  const currentCounts = [0, 0, 0, 0];

  balancedItems.forEach((item, idx) => {
    const normChoices = item.options.map(norm);
    const normAns = norm(item.correctAnswer);
    let currentAnsIndex = normChoices.indexOf(normAns);

    if (currentAnsIndex === -1) {
      currentAnsIndex = 0;
    }

    const targetPos = targetAssignments[idx];

    // Swap correct answer to target position
    if (currentAnsIndex !== targetPos) {
      const temp = item.options[targetPos];
      item.options[targetPos] = item.options[currentAnsIndex];
      item.options[currentAnsIndex] = temp;
    }

    currentCounts[targetPos]++;
  });

  // Verify Runtime Integrity Invariants
  const totalPositionCount = currentCounts.reduce((sum, count) => sum + count, 0);
  if (totalPositionCount !== total) {
    throw new Error(`Answer key distribution integrity failure: ${totalPositionCount} !== ${total}`);
  }

  const exactQuotasMet = currentCounts.every((count, idx) => count === targetQuotas[idx]);
  if (!exactQuotasMet) {
    throw new Error(`Exact answer-key quota failure: expected [${targetQuotas.join(',')}], got [${currentCounts.join(',')}]`);
  }

  return {
    balancedItems,
    positionCounts: {
      A: currentCounts[0],
      B: currentCounts[1],
      C: currentCounts[2],
      D: currentCounts[3]
    },
    exactQuotasMet
  };
}

module.exports = {
  balanceAnswerKeyPositions
};
