const { performance } = require('perf_hooks');
const registry = require('./registry');
const { cleanDocument } = require('./utils/documentCleaner');
const { resolveAliasesAndBuildIndex } = require('./aliasResolver');
const { calculateAdaptiveRetentionLimit, calculateImportanceScore } = require('./scoring');
const { inferEdges } = require('./edgeInference');
const { normalizeConceptGraph } = require('./normalizer');
const { assembleGraph } = require('./graphAssembler');
const { isValidConcept } = require('./utils/conceptSanitizer');

/**
 * Controlled Enrichment Rule Check
 */
function passesControlledEnrichment(term, documentProfile) {
  if (!term || typeof term !== 'string') return false;

  const rawUpper = term.trim().toUpperCase();
  const rawLower = term.trim().toLowerCase();

  // Rule 1: Must NOT be present in structuralMetadata or proceduralActions
  if (documentProfile.structuralMetadata && documentProfile.structuralMetadata.some(m => m.toUpperCase().includes(rawUpper))) {
    return false;
  }
  if (documentProfile.proceduralActions && documentProfile.proceduralActions.some(p => p.toLowerCase().includes(rawLower))) {
    return false;
  }
  if (/^(design and create|signaturedishes|sort the|only include|display all|write a|calculate the|find all|arrange|retrieve)\b/i.test(rawLower)) {
    return false;
  }

  // Rule 2: High semantic overlap with domainProfile or executableConstructs
  const domainWords = new Set(documentProfile.domainProfile || []);
  const termWords = rawLower.split(/\s+/).filter(Boolean);
  const hasDomainMatch = termWords.some(w => domainWords.has(w)) ||
    (documentProfile.executableConstructs && documentProfile.executableConstructs.some(c => c.toLowerCase().includes(rawLower)));

  if (!hasDomainMatch && !/\$|[()=><\{\}]|\b(index|scan|query|command|api|method|class)\b/i.test(rawLower)) {
    return false;
  }

  // Rule 3: Validated concept check
  return isValidConcept(term);
}

/**
 * Public API: buildConceptGraph(cleanedContent, options)
 * Executes Passes 1 to 4 with Canonical Document Profile contract enforcement,
 * Controlled Enrichment rules, adaptive retention bounds, and inverted index mapping.
 */
function buildConceptGraph(cleanedContent, options = {}) {
  const startTime = performance.now();
  const diagnostics = {
    extractorWarnings: [],
    buildWarnings: []
  };

  const documentProfile = options.documentProfile || options.profile || null;

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
  const textToProcess = cleanedText || cleanedContent;

  // Pass 1: Extractor Registry Execution
  let rawCandidates = registry.runAll(textToProcess, diagnostics);

  // Controlled Enrichment Contract Enforcement (Stage 1.5 -> Stage 2)
  if (documentProfile && documentProfile.instructionalConcepts) {
    const canonicalConcepts = new Set(documentProfile.instructionalConcepts.map(c => c.toUpperCase()));

    // Seed canonical concepts directly
    documentProfile.instructionalConcepts.forEach(concept => {
      rawCandidates.push({
        rawTerm: concept,
        source: 'stage_1.5_canonical_profile',
        importanceScore: 0.95,
        executable: true,
        canGenerateSyntaxQuestion: true
      });
    });

    // Apply Controlled Enrichment Rules to candidates from legacy extractors
    rawCandidates = rawCandidates.filter(c => {
      const termUpper = String(c.rawTerm || '').toUpperCase();
      if (canonicalConcepts.has(termUpper)) return true;
      return passesControlledEnrichment(c.rawTerm, documentProfile);
    });
  }

  // Pass 2: Deterministic Alias Merging & Inverted Index Construction
  const { conceptMap, conceptIndex, mergedAliasesCount, filteredNoiseCount } = resolveAliasesAndBuildIndex(rawCandidates, textToProcess);

  // Pass 3: Adaptive Node Retention & Importance Scoring
  const candidateCount = conceptMap.size;
  const retainedLimit = calculateAdaptiveRetentionLimit(candidateCount);

  const candidateNodes = Array.from(conceptMap.values()).map(node => {
    node.importanceScore = calculateImportanceScore(node);
    return node;
  });

  candidateNodes.sort((a, b) => b.importanceScore - a.importanceScore);
  const retainedCandidateNodes = candidateNodes.slice(0, retainedLimit);

  // Pass 4: Clamped Edge Inference
  const rawEdges = inferEdges(retainedCandidateNodes, textToProcess);

  // Normalization
  const {
    normalizedNodes,
    normalizedEdges,
    traversalOrder,
    prunedOrphansCount,
    cyclesResolvedCount
  } = normalizeConceptGraph({ nodes: retainedCandidateNodes, edges: rawEdges }, diagnostics);

  const buildTimeMs = Math.round(performance.now() - startTime);

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
  buildConceptGraph,
  passesControlledEnrichment
};
