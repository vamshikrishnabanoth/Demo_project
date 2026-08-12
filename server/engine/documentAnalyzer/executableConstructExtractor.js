/**
 * Stage 1.5: Executable Construct Extractor
 * Identifies legitimate syntax constructs (operators, methods, stages, keywords)
 * for target language families (MongoDB, SQL, Python, Java, JS, etc.).
 */

const EXECUTABLE_SYNTAX_PATTERNS = {
  MongoDB: [
    /\$(group|unwind|match|project|addFields|lookup|switch|facet|sort|limit|skip|push|addToSet|gt|lt|gte|lte|in|nin|exists|type|expr|sum|avg|max|min)\b/gi,
    /\b(db\.[a-zA-Z0-9_]+\.(aggregate|find|updateMany|updateOne|insertMany|insertOne|deleteMany|deleteOne|explain|createIndex))\b/gi,
    /\b(IXSCAN|COLLSCAN|FETCH|SORT|OR|AND|STAGE)\b/gi
  ],
  SQL: [
    /\b(SELECT|INSERT INTO|UPDATE|DELETE FROM|JOIN|LEFT JOIN|RIGHT JOIN|GROUP BY|ORDER BY|HAVING|WHERE|CREATE TABLE|ALTER TABLE|PRIMARY KEY|FOREIGN KEY)\b/gi
  ],
  Python: [
    /\b(def\s+[a-zA-Z0-9_]+|class\s+[a-zA-Z0-9_]+|import\s+[a-zA-Z0-9_]+|lambda\s|try:|except\s|with\s+open)\b/gi
  ],
  Java: [
    /\b(public\s+class|private\s+final|System\.out\.println|ArrayList<|HashMap<|new\s+[A-Z][a-zA-Z0-9_]*\(|throws\s+Exception)\b/gi
  ],
  JavaScript: [
    /\b(const\s|let\s|var\s|function\s|async\s|await\s|console\.log|Promise\.)\b/gi
  ]
};

function extractExecutableConstructs(text, languageFamily = 'MongoDB') {
  if (!text || typeof text !== 'string') return [];

  const patterns = EXECUTABLE_SYNTAX_PATTERNS[languageFamily] || EXECUTABLE_SYNTAX_PATTERNS.MongoDB;
  const constructs = new Set();

  patterns.forEach(pat => {
    const matches = text.match(pat);
    if (matches) {
      matches.forEach(m => {
        const cleaned = m.trim();
        if (cleaned.length >= 2) {
          constructs.add(cleaned);
        }
      });
    }
  });

  return Array.from(constructs);
}

module.exports = {
  extractExecutableConstructs
};
