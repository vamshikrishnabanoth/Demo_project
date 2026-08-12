/**
 * Stage 1.5: Instructional Document Analyzer Engine
 * Processes cleaned text from Stage 1 and outputs Canonical NormalizedDocumentProfile.
 */

const { detectLanguageFamily } = require('./languageDetector');
const { categorizeTextTriad } = require('./textTriadCategorizer');
const { extractExecutableConstructs } = require('./executableConstructExtractor');

function classifyDocumentType(text, languageFamily) {
  if (!text || typeof text !== 'string') return 'THEORY_TEXTBOOK';
  const lower = text.toLowerCase();

  if (/\b(lab|assignment|scenario|exercise|problem statement|task|question \d+)\b/i.test(lower)) {
    return 'PRACTICAL_LAB_ASSIGNMENT';
  }
  if (/\b(code|program|function|implement|class|method|script)\b/i.test(lower)) {
    return 'PROGRAMMING_ASSIGNMENT';
  }
  if (/\b(api|endpoint|request|response|swagger|payload|headers)\b/i.test(lower)) {
    return 'API_DOCUMENTATION';
  }
  if (/\b(yaml|config|docker|kubectl|helm|environment|settings)\b/i.test(lower)) {
    return 'CONFIGURATION_GUIDE';
  }

  return 'THEORY_TEXTBOOK';
}

function buildDomainProfile(text, instructionalConcepts = []) {
  if (!text || typeof text !== 'string') return new Set(['TECHNICAL_DOMAIN']);

  const words = text.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
  const freq = {};
  words.forEach(w => {
    freq[w] = (freq[w] || 0) + 1;
  });

  const domainWords = new Set(instructionalConcepts.map(c => c.toLowerCase()));
  Object.entries(freq).forEach(([w, count]) => {
    if (count >= 2 && !['the', 'and', 'for', 'with', 'this', 'that', 'from', 'user', 'will'].includes(w)) {
      domainWords.add(w);
    }
  });

  return Array.from(domainWords);
}

function analyzeInstructionalDocument(cleanedContent, options = {}) {
  if (!cleanedContent || typeof cleanedContent !== 'string') {
    return {
      documentType: 'THEORY_TEXTBOOK',
      detectedLanguage: 'Theoretical CS',
      primaryLanguageFamily: 'Theoretical CS',
      confidence: 0.5,
      instructionalConcepts: [],
      executableConstructs: [],
      proceduralActions: [],
      structuralMetadata: [],
      learningObjectives: [],
      instructionalIntent: 'Recall definitions & Describe architecture',
      domainProfile: ['CS'],
      allocatedPracticalRatio: 0.20
    };
  }

  // 1. Detect Language & Syntax Family
  const langResult = detectLanguageFamily(cleanedContent);
  const primaryLanguageFamily = langResult.primaryLanguageFamily;

  // 2. Classify Document Type
  const documentType = classifyDocumentType(cleanedContent, primaryLanguageFamily);

  // 3. Categorize Text Triad
  const triad = categorizeTextTriad(cleanedContent);

  // 4. Extract Executable Constructs
  const executableConstructs = extractExecutableConstructs(cleanedContent, primaryLanguageFamily);

  // 5. Infer Learning Objectives
  const learningObjectives = triad.instructionalConcepts.slice(0, 8).map(concept => {
    return `Student should understand and correctly execute ${concept} in ${primaryLanguageFamily} operations.`;
  });

  // 6. Build Domain Profile Bag-of-Words
  const domainProfile = buildDomainProfile(cleanedContent, triad.instructionalConcepts);

  // 7. Derive Instructional Intent & Practical Ratio
  const isPractical = (documentType === 'PRACTICAL_LAB_ASSIGNMENT' || documentType === 'PROGRAMMING_ASSIGNMENT');
  const instructionalIntent = isPractical ? 'Write queries & Apply operators' : 'Recall definitions & Describe concepts';
  const allocatedPracticalRatio = isPractical ? 0.70 : 0.20;

  return {
    profileVersion: "3.1",
    documentType,
    detectedLanguage: primaryLanguageFamily,
    primaryLanguageFamily,
    confidence: langResult.confidence,
    textTriad: triad,
    instructionalConcepts: triad.instructionalConcepts,
    executableConstructs,
    proceduralActions: triad.proceduralActions,
    structuralMetadata: triad.structuralMetadata,
    learningObjectives,
    instructionalIntent,
    domainProfile,
    allocatedPracticalRatio
  };
}

module.exports = {
  analyzeInstructionalDocument,
  detectLanguageFamily,
  categorizeTextTriad,
  extractExecutableConstructs
};
