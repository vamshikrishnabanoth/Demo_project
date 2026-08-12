/**
 * Stage 1.5: Instructional Document Analyzer Engine
 * Processes cleaned text from Stage 1 and outputs NormalizedDocumentProfile.
 */

const { detectLanguageFamily } = require('./languageDetector');
const { categorizeTextTriad } = require('./textTriadCategorizer');

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

function analyzeInstructionalDocument(cleanedContent, options = {}) {
  if (!cleanedContent || typeof cleanedContent !== 'string') {
    return {
      documentType: 'THEORY_TEXTBOOK',
      primaryLanguageFamily: 'Theoretical CS',
      confidence: 0.5,
      textTriad: { structuralMetadata: [], proceduralActions: [], instructionalConcepts: [] },
      learningObjectives: [],
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

  // 4. Infer Learning Objectives
  const learningObjectives = triad.instructionalConcepts.slice(0, 8).map(concept => {
    return `Student should understand and correctly execute ${concept} in ${primaryLanguageFamily} operations.`;
  });

  // 5. Practical Question Ratio Allocation
  const allocatedPracticalRatio = (documentType === 'PRACTICAL_LAB_ASSIGNMENT' || documentType === 'PROGRAMMING_ASSIGNMENT') ? 0.70 : 0.20;

  return {
    documentType,
    primaryLanguageFamily,
    confidence: langResult.confidence,
    textTriad: triad,
    instructionalConcepts: triad.instructionalConcepts,
    proceduralActions: triad.proceduralActions,
    structuralMetadata: triad.structuralMetadata,
    learningObjectives,
    allocatedPracticalRatio
  };
}

module.exports = {
  analyzeInstructionalDocument,
  detectLanguageFamily,
  categorizeTextTriad
};
