/**
 * server/engine/conceptGraphBuilder/extractors/typedConceptExtractor.js
 * 
 * TYPED CONCEPT EXTRACTOR
 * Extracts categorized instructional concepts (operators, DB methods, CLI commands, APIs, algorithms)
 * with executable flags and importance scoring.
 */

'use strict';

const TYPED_PATTERNS = [
  // 1. Update Operators ($push, $set, $inc, $pull, $addToSet, $rename, $unset)
  {
    category: "UPDATE_OPERATOR",
    regex: /\$(push|set|inc|pull|addToSet|rename|unset|pop|pullAll|min|max|currentDate)\b/g,
    executable: true,
    importance: 0.97
  },
  // 2. Query & Comparison Operators ($gt, $gte, $lt, $lte, $in, $nin, $eq, $ne, $regex, $elemMatch, $and, $or, $not)
  {
    category: "QUERY_OPERATOR",
    regex: /\$(gt|gte|lt|lte|in|nin|eq|ne|regex|elemMatch|and|or|not|exists|type|mod|text|where|all|size)\b/g,
    executable: true,
    importance: 0.95
  },
  // 3. Database Methods / Commands (find(), updateMany(), updateOne(), deleteMany(), deleteOne(), aggregate(), insertMany(), createIndex())
  {
    category: "DATABASE_COMMAND",
    regex: /\b(find|updateMany|updateOne|deleteMany|deleteOne|aggregate|insertMany|insertOne|createIndex|dropIndex|countDocuments|distinct|limit|sort|skip)\s*\(\)/gi,
    executable: true,
    importance: 0.96
  },
  // 4. API Endpoints (e.g., GET /api/products, POST /api/users)
  {
    category: "API_ENDPOINT",
    regex: /\b(GET|POST|PUT|DELETE|PATCH)\s+(\/[a-zA-Z0-9_\-\/:]+)/g,
    executable: true,
    importance: 0.94
  },
  // 5. CLI Commands
  {
    category: "CLI_COMMAND",
    regex: /\b(mongosh|mongo|npm|git|docker|kubectl|npx|node|python|pip)\s+([a-zA-Z0-9_\-\.\:]+)/g,
    executable: true,
    importance: 0.90
  },
  // 6. Data Structures & Algorithms
  {
    category: "DATA_STRUCTURE",
    regex: /\b(B-Tree|Hash Index|Binary Search Tree|Linked List|Stack|Queue|Heap|Graph|Trie|Adjacency Matrix|AVL Tree)\b/gi,
    executable: false,
    importance: 0.88
  }
];

function extractTypedConcepts(text) {
  if (!text || typeof text !== 'string') return [];
  const candidates = [];
  const seenTerms = new Set();

  TYPED_PATTERNS.forEach(rule => {
    let match;
    const regex = new RegExp(rule.regex);
    while ((match = regex.exec(text)) !== null) {
      const rawTerm = match[0].trim();
      const normKey = `${rule.category}:${rawTerm.toLowerCase()}`;
      if (!seenTerms.has(normKey)) {
        seenTerms.add(normKey);
        
        // Determine if term appears inside code snippet or example syntax
        const snippetWindow = text.slice(Math.max(0, match.index - 50), Math.min(text.length, match.index + 50));
        const appearsInExample = snippetWindow.includes('{') || snippetWindow.includes(':') || snippetWindow.includes('```');

        candidates.push({
          rawTerm,
          source: "typedConceptExtractor",
          category: rule.category,
          importanceScore: rule.importance,
          appearsInExample,
          executable: rule.executable,
          canGenerateSyntaxQuestion: rule.executable,
          startOffset: match.index,
          endOffset: match.index + rawTerm.length
        });
      }
    }
  });

  return candidates;
}

module.exports = {
  name: "typedConceptExtractor",
  extract: extractTypedConcepts
};
