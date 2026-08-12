/**
 * Stage 1.5: Text Triad Categorizer
 * Categorizes document text into:
 * 1. Structural Metadata (URLs, drive links, assignment labels, file names) -> DISCARD
 * 2. Procedural Actions (Student instructions like "Sort the output", "Only include") -> DISCARD
 * 3. Instructional Concepts (Domain operators, methods, execution stages) -> RETAIN
 */

const STRUCTURAL_METADATA_REGEX = /(https?:\/\/[^\s]+|drive\.google\.com[^\s]*|[a-zA-Z0-9_-]+\.(json|csv|pdf|docx|txt)|Scenario\s*\d+|Assignment\s*\d+|Question\s*\d+|Part\s*[A-Z]|UNIT\s*-\s*\d+|TOPIC\s*-\s*\d+|PAGE\s*\d+|CSE|IT|CSM|CSD|ECE|EEE|RKR21|SOFTWARE ENGINEERING)/gi;

const PROCEDURAL_ACTION_PATTERNS = [
  /^sort\b/i,
  /^only include\b/i,
  /^display\b/i,
  /^show\b/i,
  /^find all\b/i,
  /^write a\b/i,
  /^construct a\b/i,
  /^return\b/i,
  /^filter\b/i,
  /^arrange\b/i,
  /^calculate the\b/i,
  /^list the\b/i,
  /^retrieve\b/i,
  /\bthe (warehouse manager|marketing team|administrator|user|student) wants to\b/i,
  /\bis preparing a\b/i
];

const DOMAIN_CONCEPT_PATTERNS = [
  /\$(group|unwind|match|project|addFields|lookup|switch|facet|sort|limit|skip|push|addToSet|gt|lt|gte|lte|in|nin|exists|type|expr|sum|avg|max|min)\b/gi,
  /\b(db\.[a-zA-Z0-9_]+\.(aggregate|find|updateMany|updateOne|insertMany|insertOne|deleteMany|deleteOne|explain|createIndex))\b/gi,
  /\b(IXSCAN|COLLSCAN|FETCH|SORT|OR|AND|STAGE|BSON|JSON|INDEX|AGGREGATION PIPELINE|LOOKUP STAGE|UNWIND STAGE|GROUP STAGE|EXPLAIN PLAN)\b/gi
];

function categorizeTextTriad(text) {
  if (!text || typeof text !== 'string') {
    return {
      structuralMetadata: [],
      proceduralActions: [],
      instructionalConcepts: []
    };
  }

  const sentences = text.split(/[\n;.]+/).map(s => s.trim()).filter(Boolean);

  const structuralMetadata = [];
  const proceduralActions = [];
  const instructionalConcepts = [];

  sentences.forEach(sentence => {
    // Always extract genuine domain concept operators first
    DOMAIN_CONCEPT_PATTERNS.forEach(pat => {
      const matches = sentence.match(pat);
      if (matches) {
        matches.forEach(m => {
          instructionalConcepts.push(m.trim().toUpperCase());
        });
      }
    });

    // 1. Structural Metadata Check
    if (STRUCTURAL_METADATA_REGEX.test(sentence) && sentence.length < 90 && !/\$|aggregate|find|db\./i.test(sentence)) {
      structuralMetadata.push(sentence);
      return;
    }

    // 2. Procedural Action Check
    const isProcedural = PROCEDURAL_ACTION_PATTERNS.some(pat => pat.test(sentence));
    if (isProcedural) {
      proceduralActions.push(sentence);
    }
  });

  // Filter out any garbage or structural URLs from instructional concepts
  const cleanConcepts = Array.from(new Set(instructionalConcepts))
    .filter(c => !c.includes('GOOGLE.COM') && !c.includes('RESTAURANTS.JSON') && c.length >= 2);

  return {
    structuralMetadata: Array.from(new Set(structuralMetadata)),
    proceduralActions: Array.from(new Set(proceduralActions)),
    instructionalConcepts: cleanConcepts
  };
}

module.exports = {
  categorizeTextTriad,
  STRUCTURAL_METADATA_REGEX,
  PROCEDURAL_ACTION_PATTERNS
};
