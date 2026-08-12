const headerExtractor = require('./extractors/headerExtractor');
const codeMathExtractor = require('./extractors/codeMathExtractor');
const acronymExtractor = require('./extractors/acronymExtractor');
const definitionExtractor = require('./extractors/definitionExtractor');
const nounPhraseExtractor = require('./extractors/nounPhraseExtractor');
const typedConceptExtractor = require('./extractors/typedConceptExtractor');

/**
 * 3. STATELESS EXTRACTOR REGISTRY WITH ISOLATION
 * Immutable registry executed per request with exception isolation.
 */
class ExtractorRegistry {
  constructor() {
    this.extractors = Object.freeze([
      headerExtractor,
      codeMathExtractor,
      acronymExtractor,
      definitionExtractor,
      nounPhraseExtractor,
      typedConceptExtractor
    ]);
  }

  getActiveExtractorsCount() {
    return this.extractors.length;
  }

  /**
   * Run all registered extractors safely with exception isolation
   */
  runAll(text, diagnostics = { extractorWarnings: [] }) {
    const allCandidates = [];

    for (const extractor of this.extractors) {
      try {
        const results = extractor.extract(text);
        if (Array.isArray(results)) {
          allCandidates.push(...results);
        }
      } catch (err) {
        const warning = `[Extractor Exception] ${extractor.name || 'unknown'}: ${err.message}`;
        console.warn(`⚠️ ${warning}`);
        if (diagnostics && Array.isArray(diagnostics.extractorWarnings)) {
          diagnostics.extractorWarnings.push({
            extractorName: extractor.name || 'unknown',
            error: err.message,
            timestamp: Date.now()
          });
        }
      }
    }

    return allCandidates;
  }
}

module.exports = new ExtractorRegistry();
