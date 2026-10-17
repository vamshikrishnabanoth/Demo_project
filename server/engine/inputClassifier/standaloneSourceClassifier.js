/**
 * server/engine/inputClassifier/standaloneSourceClassifier.js
 *
 * Standalone Source Classifier (Milestone 1)
 *
 * Classifies raw user inputs into:
 *  - 'code' (Python, Java, C/C++, JavaScript, etc.)
 *  - 'sql' (ANSI SQL, Postgres, MySQL)
 *  - 'text' (Expository prose, concept descriptions)
 *  - 'mixed' (Markdown or text with embedded code/query blocks)
 *  - 'empty' (Whitespace or absent content)
 *
 * ZERO-EXECUTION SECURITY GUARANTEE:
 * - This module performs 100% static string and pattern analysis.
 * - NEVER executes code via eval, Function, child_process, VM, or shell.
 * - NEVER connects to any database to validate SQL syntax.
 * - Treats all incoming text (including dangerous scripts, drop table, rm -rf) strictly as inert data.
 */

'use strict';

// ── Security Pattern Signatures (Inert Inspection Only) ──────────────────────
const DANGEROUS_PATTERNS = [
  { name: 'shell_execution', regex: /\b(exec|spawn|fork|system|popen|subprocess|child_process)\b/i },
  { name: 'file_deletion', regex: /\b(rm\s+-rf|unlinkSync|del\s+\/f|format\s+[a-z]:)\b/i },
  { name: 'sql_destructive_ddl', regex: /\b(DROP\s+TABLE|DROP\s+DATABASE|TRUNCATE\s+TABLE|ALTER\s+TABLE\s+.*DROP)\b/i },
  { name: 'sql_injection_probe', regex: /('?\s*OR\s*'?1'?\s*=\s*'?1'?|--\s*$|\/\*.*\*\/)/im },
  { name: 'process_kill', regex: /\b(process\.exit|os\._exit|kill\s+-9|System\.exit)\b/i }
];

// ── Language Pattern Signatures ──────────────────────────────────────────────
const SQL_PATTERNS = {
  primaryClauses: /\b(SELECT|FROM|WHERE|GROUP\s+BY|HAVING|ORDER\s+BY|INSERT\s+INTO|UPDATE|DELETE\s+FROM|CREATE\s+TABLE|WITH\s+[a-zA-Z0-9_]+\s+AS)\b/i,
  secondaryClauses: /\b(INNER\s+JOIN|LEFT\s+OUTER\s+JOIN|RIGHT\s+JOIN|FULL\s+JOIN|CROSS\s+JOIN|UNION\s+ALL|UNION|INTERSECT|EXCEPT)\b/i,
  functionsAndTypes: /\b(COUNT|SUM|AVG|MIN|MAX|COALESCE|VARCHAR|INT|BIGINT|TIMESTAMP|BOOLEAN|PRIMARY\s+KEY|FOREIGN\s+KEY|REFERENCES)\b/i,
  structureCheck: /\bSELECT\b[\s\S]*?\bFROM\b/i
};

const PYTHON_PATTERNS = {
  definitions: /^\s*(def\s+[a-zA-Z_]\w*\s*\(|class\s+[a-zA-Z_]\w*(\s*\(.*?\))?\s*:)/m,
  imports: /^\s*(import\s+[a-zA-Z0-9_.]+|from\s+[a-zA-Z0-9_.]+\s+import)/m,
  controlFlow: /\b(elif\s+.*?:|if\s+.*?:|for\s+[a-zA-Z_]\w*\s+in\s+|while\s+.*?:)/m,
  idioms: /\b(lambda\s+|self\.[a-zA-Z_]\w*|__init__|__name__\s*==\s*['"]__main__['"]|range\s*\(|len\s*\(|print\s*\()/
};

const JAVA_PATTERNS = {
  mainSignature: /public\s+static\s+void\s+main\s*\(\s*String\s*(\[\s*\]|\.\.\.)\s*\w+\s*\)/,
  classSignature: /\b(public|private|protected)?\s*(abstract|final)?\s*class\s+[a-zA-Z_]\w*(\s+extends\s+\w+)?(\s+implements\s+[\w,\s]+)?\s*\{/,
  typesAndIdioms: /\b(System\.(out|err)\.print(ln)?|@Override|throws\s+\w+Exception|new\s+[A-Z]\w*\s*\(|List<[A-Z]\w*>|Map<[A-Z]\w*,\s*[A-Z]\w*>)/,
  modifiers: /\b(public|private|protected)\s+(static\s+)?(final\s+)?(int|void|boolean|String|double|char|float|long)\s+[a-zA-Z_]\w*\s*\(/
};

const CPP_PATTERNS = {
  includes: /#include\s*<[a-zA-Z0-9_.]+>/,
  mainSignature: /\bint\s+main\s*\(\s*(int\s+\w+\s*,\s*char\s*\*(\*|\s*)\w+\[\]|void)?\s*\)/,
  namespacesAndIo: /\b(std::|cout\s*<<|cin\s*>>|endl|vector<|nullptr)/,
  memoryAndPointers: /\b(malloc\s*\(|free\s*\(|new\s+\w+|delete\s+|delete\[\]\s+|\bprintf\s*\(|\bscanf\s*\()/
};

const MARKDOWN_CODE_BLOCK = /```([a-zA-Z0-9_+-]*)\n([\s\S]*?)```/g;

/**
 * Analyzes string without executing anything.
 * @param {string} input - Raw user input text/code
 * @param {Object} [options] - Optional manual override parameters
 * @param {string} [options.manualLanguage] - Optional language hint specified by teacher
 * @returns {Object} Comprehensive classification result
 */
function classifySource(input, options = {}) {
  // 1. Empty Check
  if (input === null || input === undefined || typeof input !== 'string') {
    return {
      detectedType: 'empty',
      language: 'unknown',
      confidence: 1.0,
      isSufficientEvidence: false,
      sufficiencyReason: 'Input is missing or null.',
      metadata: { charCount: 0, lineCount: 0, tokenCount: 0 }
    };
  }

  const raw = input.trim();
  if (raw.length === 0) {
    return {
      detectedType: 'empty',
      language: 'unknown',
      confidence: 1.0,
      isSufficientEvidence: false,
      sufficiencyReason: 'Input contains only whitespace.',
      metadata: { charCount: 0, lineCount: 0, tokenCount: 0 }
    };
  }

  const lines = raw.split(/\r?\n/);
  const lineCount = lines.length;
  const charCount = raw.length;
  const tokenCount = raw.split(/\s+/).filter(Boolean).length;

  // 2. Security Signature Audit (Inert flag for logging & provenance)
  const securityConstructs = [];
  for (const item of DANGEROUS_PATTERNS) {
    if (item.regex.test(raw)) {
      securityConstructs.push(item.name);
    }
  }

  // 3. Embedded Markdown Code Block Detection (Mixed Mode)
  const codeBlocks = [];
  let blockMatch;
  const blockRegex = new RegExp(MARKDOWN_CODE_BLOCK.source, 'g');
  while ((blockMatch = blockRegex.exec(raw)) !== null) {
    codeBlocks.push({
      declaredLang: (blockMatch[1] || '').toLowerCase(),
      content: blockMatch[2]
    });
  }

  const isExplicitMixed = codeBlocks.length > 0 && raw.replace(blockRegex, '').trim().length > 30;

  // 4. Score Potential Languages
  const scores = {
    sql: scoreSQL(raw),
    python: scorePython(raw),
    java: scoreJava(raw),
    cpp: scoreCPP(raw),
    text: scoreProse(raw, lineCount, tokenCount)
  };

  // Determine top candidate
  let primaryLang = 'text';
  let maxScore = scores.text;

  for (const [lang, score] of Object.entries(scores)) {
    if (lang === 'text') continue;
    if (score > maxScore && score >= 2.0) {
      maxScore = score;
      primaryLang = lang;
    }
  }

  // Handle manual language override if provided by caller
  const manual = (options.manualLanguage || '').toLowerCase().trim();
  if (manual) {
    if (['python', 'py'].includes(manual)) primaryLang = 'python';
    else if (['java'].includes(manual)) primaryLang = 'java';
    else if (['c', 'cpp', 'c++', 'cxx'].includes(manual)) primaryLang = 'cpp';
    else if (['sql'].includes(manual)) primaryLang = 'sql';
    else if (['text', 'prose', 'plain'].includes(manual)) primaryLang = 'text';
  }

  // 5. Determine high-level detectedType
  let detectedType = 'text';
  if (isExplicitMixed) {
    detectedType = 'mixed';
  } else if (primaryLang === 'sql') {
    detectedType = 'sql';
  } else if (['python', 'java', 'cpp'].includes(primaryLang)) {
    detectedType = 'code';
  } else {
    // If not matched to code/sql, verify if text has code-like density
    const codeLikeRatio = (raw.match(/[{}\[\]();=><+\-*\/%&|^!~]/g) || []).length / Math.max(1, charCount);
    if (codeLikeRatio > 0.12 && tokenCount >= 4) {
      detectedType = 'code';
      if (primaryLang === 'text') primaryLang = 'unknown_code';
    } else {
      detectedType = 'text';
    }
  }

  // 6. Content Sufficiency Evaluation (Content-aware, NOT purely line-count)
  const sufficiency = evaluateSufficiency({
    detectedType,
    language: primaryLang,
    raw,
    lineCount,
    charCount,
    tokenCount,
    scores
  });

  // Calculate normalized confidence
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0) || 1;
  const confidence = Math.min(1.0, Math.max(0.3, parseFloat((maxScore / totalScore).toFixed(2))));

  return {
    detectedType,
    language: primaryLang,
    confidence,
    isSufficientEvidence: sufficiency.isSufficient,
    sufficiencyReason: sufficiency.reason,
    metadata: {
      charCount,
      lineCount,
      tokenCount,
      hasControlFlow: sufficiency.hasControlFlow,
      hasQueryStructure: sufficiency.hasQueryStructure,
      hasFunctionDef: sufficiency.hasFunctionDef,
      potentialSecurityConstructsFound: securityConstructs.length > 0,
      securityConstructs,
      languageScores: scores,
      codeBlocksFound: codeBlocks.length
    }
  };
}

// ── Scorer Functions ─────────────────────────────────────────────────────────

function scoreSQL(raw) {
  let score = 0;
  if (SQL_PATTERNS.structureCheck.test(raw)) score += 4.0;
  if (SQL_PATTERNS.primaryClauses.test(raw)) score += 2.5;
  if (SQL_PATTERNS.secondaryClauses.test(raw)) score += 2.0;
  if (SQL_PATTERNS.functionsAndTypes.test(raw)) score += 1.5;
  if (/\bWHERE\b[\s\S]*?[=><]|LIKE|BETWEEN/i.test(raw)) score += 1.0;
  if (/;\s*$/.test(raw.trim())) score += 0.5;
  return score;
}

function scorePython(raw) {
  let score = 0;
  if (PYTHON_PATTERNS.definitions.test(raw)) score += 3.5;
  if (PYTHON_PATTERNS.imports.test(raw)) score += 2.0;
  if (PYTHON_PATTERNS.controlFlow.test(raw)) score += 2.0;
  if (PYTHON_PATTERNS.idioms.test(raw)) score += 1.5;
  // Indentation check
  if (/\n\s{4}[a-zA-Z_]/.test(raw) && !/[{};]/.test(raw)) score += 1.5;
  return score;
}

function scoreJava(raw) {
  let score = 0;
  if (JAVA_PATTERNS.mainSignature.test(raw)) score += 4.5;
  if (JAVA_PATTERNS.classSignature.test(raw)) score += 3.5;
  if (JAVA_PATTERNS.typesAndIdioms.test(raw)) score += 2.5;
  if (JAVA_PATTERNS.modifiers.test(raw)) score += 2.0;
  if (/[{};]/.test(raw) && /\b(System\.out|public|private)\b/.test(raw)) score += 2.0;
  return score;
}

function scoreCPP(raw) {
  let score = 0;
  if (CPP_PATTERNS.includes.test(raw)) score += 4.0;
  if (CPP_PATTERNS.mainSignature.test(raw)) score += 3.5;
  if (CPP_PATTERNS.namespacesAndIo.test(raw)) score += 3.0;
  if (CPP_PATTERNS.memoryAndPointers.test(raw)) score += 2.0;
  if (/->|::|\bstd\b/.test(raw)) score += 1.5;
  return score;
}

function scoreProse(raw, lineCount, tokenCount) {
  let score = 0.5;
  const sentenceCount = (raw.match(/[.!?](\s+|$)/g) || []).length;
  if (sentenceCount >= 2) score += 2.0;
  if (tokenCount >= 25) score += 2.0;
  // Natural prose ratio (letters and common punctuation vs symbol density)
  const letters = (raw.match(/[a-zA-Z]/g) || []).length;
  const symbols = (raw.match(/[{}\[\]();=><+\-*\/%&|^!~_]/g) || []).length;
  if (letters > 0 && (symbols / letters) < 0.05) score += 2.5;
  return score;
}

// ── Content-Sufficiency Evaluator ────────────────────────────────────────────

function evaluateSufficiency(ctx) {
  const { detectedType, language, raw, lineCount, charCount, tokenCount, scores } = ctx;

  // 1. Trivial floor check
  if (charCount < 10 || tokenCount < 3) {
    return {
      isSufficient: false,
      reason: 'Snippet is too short (< 10 chars or < 3 tokens) to support a multiple-choice question.',
      hasControlFlow: false,
      hasQueryStructure: false,
      hasFunctionDef: false
    };
  }

  // 2. SQL Content Evaluation
  if (detectedType === 'sql') {
    const hasSelectFrom = SQL_PATTERNS.structureCheck.test(raw);
    const hasFilterOrGroup = /\b(WHERE|GROUP\s+BY|HAVING|ORDER\s+BY|JOIN)\b/i.test(raw);
    const hasDDLOrDML = /\b(INSERT\s+INTO|UPDATE|DELETE\s+FROM|CREATE\s+TABLE)\b/i.test(raw);

    if (hasSelectFrom || hasDDLOrDML) {
      return {
        isSufficient: true,
        reason: 'SQL query contains complete relational operations (projection, selection, or manipulation).',
        hasControlFlow: false,
        hasQueryStructure: true,
        hasFunctionDef: false
      };
    }

    return {
      isSufficient: false,
      reason: 'SQL snippet is incomplete; missing fundamental SELECT...FROM or DDL/DML clause structure.',
      hasControlFlow: false,
      hasQueryStructure: false,
      hasFunctionDef: false
    };
  }

  // 3. Code Content Evaluation (Python, Java, C++, etc.)
  if (detectedType === 'code' || detectedType === 'mixed') {
    const hasControlFlow = /\b(if|else|for|while|switch|case|try|catch|return)\b/i.test(raw) || /\?[\s\S]*:/.test(raw);
    const hasFunctionDef = /(\bdef\s+|\bfunction\b|\bvoid\s+|\bint\s+\w+\s*\(|\bpublic\s+|\bclass\s+|=>|\bconst\s+\w+\s*=)/i.test(raw);
    const hasExpressions = /[=><+\-*\/%&|^!~].*[=><+\-*\/%&|^!~]/.test(raw) || /\b(return|print|cout|System\.out)\b/i.test(raw);

    // Accept short 1-line or 2-line snippets if they embody complete logical/recursive expressions!
    // Example: "const fib = n => n <= 1 ? n : fib(n - 1) + fib(n - 2);"
    if (hasFunctionDef && (hasControlFlow || hasExpressions)) {
      return {
        isSufficient: true,
        reason: 'Source code defines a function/class with executable logic or control flow.',
        hasControlFlow,
        hasQueryStructure: false,
        hasFunctionDef
      };
    }

    if (hasControlFlow && hasExpressions && tokenCount >= 6) {
      return {
        isSufficient: true,
        reason: 'Source code provides identifiable algorithmic control flow and state transformations.',
        hasControlFlow,
        hasQueryStructure: false,
        hasFunctionDef
      };
    }

    return {
      isSufficient: false,
      reason: 'Code snippet lacks algorithmic logic, function declaration, or control flow required for code-tracing or output prediction.',
      hasControlFlow,
      hasQueryStructure: false,
      hasFunctionDef
    };
  }

  // 4. Prose / Plain Text Evaluation
  if (detectedType === 'text') {
    if (tokenCount >= 15 && /[.!?]/.test(raw)) {
      return {
        isSufficient: true,
        reason: 'Text provides sufficient narrative context and academic domain claims.',
        hasControlFlow: false,
        hasQueryStructure: false,
        hasFunctionDef: false
      };
    }

    return {
      isSufficient: false,
      reason: 'Text is too sparse (< 15 words or lacking complete sentences) to extract defensible factual claims.',
      hasControlFlow: false,
      hasQueryStructure: false,
      hasFunctionDef: false
    };
  }

  return {
    isSufficient: false,
    reason: 'Unrecognized input structure.',
    hasControlFlow: false,
    hasQueryStructure: false,
    hasFunctionDef: false
  };
}

module.exports = {
  classifySource,
  DANGEROUS_PATTERNS
};
