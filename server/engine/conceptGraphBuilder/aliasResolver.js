const { CONCEPT_CONFIG } = require('../../config/conceptConfig');
const { isValidConcept } = require('./utils/conceptSanitizer');

/**
 * Deterministic Alias Resolver & Inverted Index Construction
 */
function resolveAliasesAndBuildIndex(candidates, text) {
  const stopwords = new Set(CONCEPT_CONFIG.NOISE_STOPWORDS);
  const conceptMap = new Map();
  const conceptIndex = {};
  let mergedAliasesCount = 0;
  let filteredNoiseCount = 0;

  for (const item of candidates) {
    const rawTerm = item.rawTerm ? String(item.rawTerm).trim() : '';
    if (!rawTerm) continue;

    if (!isValidConcept(rawTerm)) {
      filteredNoiseCount++;
      continue;
    }

    const normKey = rawTerm.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
    if (!normKey || normKey.length < 2) continue;

    // Filter Noise Stopwords
    if (stopwords.has(normKey) || (stopwords.has(rawTerm.toLowerCase()))) {
      filteredNoiseCount++;
      continue;
    }

    const conceptId = normKey;

    if (!conceptMap.has(conceptId)) {
      conceptMap.set(conceptId, {
        id: conceptId,
        label: rawTerm,
        aliases: new Set(),
        sources: new Set([item.source]),
        evidenceOffsets: [],
        frequency: 0,
        hasCodeOrMath: !!item.hasCodeOrMath,
        firstOffset: item.startOffset || 0
      });
      conceptIndex[conceptId] = [];
    } else {
      mergedAliasesCount++;
    }

    const entry = conceptMap.get(conceptId);
    entry.frequency += 1;
    entry.sources.add(item.source);
    if (item.alias) entry.aliases.add(item.alias);
    if (item.hasCodeOrMath) entry.hasCodeOrMath = true;

    if (item.startOffset !== undefined && item.endOffset !== undefined) {
      const pair = [item.startOffset, item.endOffset];
      entry.evidenceOffsets.push(pair);
      conceptIndex[conceptId].push(pair);
    }
  }

  // Populate inverted index scan for terms if evidenceOffsets were not explicitly provided
  for (const [cId, entry] of conceptMap.entries()) {
    if (entry.evidenceOffsets.length === 0) {
      const labelRegex = new RegExp(`\\b${entry.label.replace(/[^a-zA-Z0-9]/g, '\\$&')}\\b`, 'gi');
      let m;
      while ((m = labelRegex.exec(text)) !== null) {
        const pair = [m.index, m.index + m[0].length];
        entry.evidenceOffsets.push(pair);
        if (!conceptIndex[cId]) conceptIndex[cId] = [];
        conceptIndex[cId].push(pair);
      }
      if (entry.evidenceOffsets.length === 0) {
        entry.evidenceOffsets.push([0, entry.label.length]);
        conceptIndex[cId] = [[0, entry.label.length]];
      }
    }
  }

  return {
    conceptMap,
    conceptIndex,
    mergedAliasesCount,
    filteredNoiseCount
  };
}

module.exports = {
  resolveAliasesAndBuildIndex
};
