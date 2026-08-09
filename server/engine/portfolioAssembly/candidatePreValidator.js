function norm(str) {
  return typeof str === 'string' ? str.normalize("NFKC").trim() : "";
}

/**
 * 2. CANDIDATE PRE-VALIDATOR WITH DEFENSIVE GUARD & UNIQUE IDS
 * Validates array inputs, filters malformed items, and attaches an index-prefixed collision-free _portfolioCandId.
 */
function filterValidCandidates(approvedItems) {
  const validCandidates = [];
  const excludedCandidates = [];
  const items = Array.isArray(approvedItems) ? approvedItems : [];

  items.forEach((item, idx) => {
    const rawStem = item?.stem || item?.question || item?.questionText;
    const rawChoices = item?.options;
    const rawAns = item?.correctAnswer || item?.correct_answer;

    const normChoices = Array.isArray(rawChoices) ? rawChoices.map(norm) : [];
    const normAns = norm(String(rawAns || ''));
    const normStemStr = norm(rawStem);

    if (
      normChoices.length === 4 &&
      normAns.length > 0 &&
      normChoices.includes(normAns) &&
      normStemStr.length > 0
    ) {
      const candidateCopy = JSON.parse(JSON.stringify(item));
      const baseId = item.id || item.candidateId || item.requestId || item.slotId || 'cand';
      candidateCopy._portfolioCandId = `cand_${idx}_${baseId}`;
      candidateCopy.stem = candidateCopy.stem || candidateCopy.question || candidateCopy.questionText || normStemStr;
      candidateCopy.correctAnswer = candidateCopy.correctAnswer || candidateCopy.correct_answer || normAns;
      validCandidates.push(candidateCopy);
    } else {
      excludedCandidates.push({ item, reason: "MALFORMED_SCHEMA_OR_ANSWER_MISMATCH" });
    }
  });

  return { validCandidates, excludedCandidates };
}

module.exports = {
  filterValidCandidates
};
