/**
 * Stage 6 Structural Tokenizer & AST Code Validator (v3.0.0)
 * Validates executable code options via JSON/BSON structural parsing.
 */

function validateBSONQueryStructure(codeSnippet) {
  if (!codeSnippet || typeof codeSnippet !== 'string') return { valid: false, reason: "Empty snippet" };

  const str = codeSnippet.trim();

  // 1. Detect invented keys with spaces following $ (e.g., {$design and create: ...})
  const invalidDollarSpaceMatch = str.match(/\$\s*([a-zA-Z0-9_\s]+)/g);
  if (invalidDollarSpaceMatch) {
    for (const match of invalidDollarSpaceMatch) {
      const subKey = match.replace(/^\$\s*/, '');
      if (subKey.includes(' ')) {
        return {
          valid: false,
          code: 'EDU_010',
          reason: `Invented Dollar Operator with spaces: '${match}'`
        };
      }
    }
  }

  // 2. Extract JSON/BSON object literals within query calls like aggregate([...]) or find({...})
  const jsonMatches = str.match(/\{[^{}]*\}/g) || [];
  for (const jsonStr of jsonMatches) {
    // Attempt strict structural JSON parse after replacing BSON unquoted keys or values
    try {
      const mockJson = jsonStr
        .replace(/([a-zA-Z0-9_$]+)\s*:/g, '"$1":')
        .replace(/'/g, '"');
      JSON.parse(mockJson);
    } catch (e) {
      // If unquoted keys contained spaces or illegal syntax, parse fails!
      if (/:\s*|\{/.test(jsonStr) && /[a-zA-Z0-9_]+\s+[a-zA-Z0-9_]+\s*:/i.test(jsonStr)) {
        return {
          valid: false,
          code: 'EDU_010',
          reason: `Invalid unquoted object key containing spaces: '${jsonStr}'`
        };
      }
    }
  }

  return { valid: true };
}

function parseAndValidateAST(codeOption, languageFamily = 'MongoDB') {
  if (!codeOption || typeof codeOption !== 'string') return { valid: true };

  const isCodeLike = /[\{\}\$\[\]\(\)=><]|\b(db\.[a-zA-Z0-9_]+|SELECT|UPDATE|def\s|class\s)\b/i.test(codeOption);
  if (!isCodeLike) return { valid: true };

  if (languageFamily === 'MongoDB' || languageFamily === 'Theoretical CS') {
    return validateBSONQueryStructure(codeOption);
  }

  return { valid: true };
}

module.exports = {
  parseAndValidateAST,
  validateBSONQueryStructure
};
