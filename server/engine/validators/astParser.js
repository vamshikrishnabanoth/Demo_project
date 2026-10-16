/**
 * server/engine/validators/astParser.js
 *
 * Stage 3 / Stage 6 Production AST Code & SQL Validator (v4.0.0)
 * Provides isolated, safe syntactic & structural validation for:
 * 1. Python AST parsing (via safe child process with bounded timeout)
 * 2. JavaScript AST / syntactic compilation (via vm.compileFunction / vm.Script without execution)
 * 3. SQL parsing & isolated execution gate (via node:sqlite in-memory with synthetic bounded schema)
 * 4. MongoDB / BSON structural JSON/BSON tokenizer
 * 5. Conceptual pass-through: conceptual questions pass safely without requiring executable code
 */

'use strict';

const { spawnSync } = require('child_process');
const vm = require('vm');

let sqliteEngine = null;
try {
  const { DatabaseSync } = require('node:sqlite');
  sqliteEngine = DatabaseSync;
} catch (e) {
  // node:sqlite fallback
  sqliteEngine = null;
}

/**
 * 1. Validate BSON / MongoDB Query Structure
 */
function validateBSONQueryStructure(codeSnippet) {
  if (!codeSnippet || typeof codeSnippet !== 'string') return { valid: false, reason: "Empty snippet" };

  const str = codeSnippet.trim();

  // Detect invented keys with spaces following $ (e.g., {$design and create: ...})
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

  // Extract JSON/BSON object literals within query calls like aggregate([...]) or find({...})
  const jsonMatches = str.match(/\{[^{}]*\}/g) || [];
  for (const jsonStr of jsonMatches) {
    try {
      const mockJson = jsonStr
        .replace(/([a-zA-Z0-9_$]+)\s*:/g, '"$1":')
        .replace(/'/g, '"');
      JSON.parse(mockJson);
    } catch (e) {
      if (/:\s*|\{/.test(jsonStr) && /[a-zA-Z0-9_]+\s+[a-zA-Z0-9_]+\s*:/i.test(jsonStr)) {
        return {
          valid: false,
          code: 'EDU_010',
          reason: `Invalid unquoted object key containing spaces: '${jsonStr}'`
        };
      }
    }
  }

  return { valid: true, language: 'MongoDB' };
}

/**
 * 2. Validate Python AST Syntax
 * Executes python built-in ast.parse via stdin with strict timeout and no shell execution.
 */
function validatePythonAST(codeSnippet, timeoutMs = 1500) {
  if (!codeSnippet || typeof codeSnippet !== 'string') return { valid: true };
  const trimmed = codeSnippet.trim();
  if (!trimmed) return { valid: true };

  try {
    const res = spawnSync('python', ['-c', 'import ast, sys; ast.parse(sys.stdin.read())'], {
      input: trimmed,
      encoding: 'utf8',
      timeout: timeoutMs,
      windowsHide: true
    });

    if (res.error) {
      if (res.error.code === 'ETIMEDOUT') {
        return { valid: false, code: 'AST_TIMEOUT', language: 'Python', reason: 'Python AST parse timed out' };
      }
      // If python binary is unavailable, fallback to balanced bracket & basic syntax heuristic
      return _heuristicSyntaxCheck(trimmed, 'Python');
    }

    if (res.status !== 0) {
      const stderr = (res.stderr || '').trim();
      const firstLine = stderr.split('\n').filter(l => l.includes('SyntaxError') || l.includes('IndentationError'))[0] || stderr;
      return {
        valid: false,
        code: 'PYTHON_SYNTAX_ERROR',
        language: 'Python',
        reason: firstLine.trim() || 'Python syntax error detected in code snippet'
      };
    }

    return { valid: true, language: 'Python' };
  } catch (err) {
    return _heuristicSyntaxCheck(trimmed, 'Python');
  }
}

/**
 * 3. Validate JavaScript Syntax
 * Compiles code snippet using Node's built-in vm without evaluating it.
 */
function validateJavaScriptAST(codeSnippet) {
  if (!codeSnippet || typeof codeSnippet !== 'string') return { valid: true };
  const trimmed = codeSnippet.trim();
  if (!trimmed) return { valid: true };

  try {
    // If it is an expression or statement, try compiling in vm.Script
    new vm.Script(trimmed, { filename: 'snippet.js' });
    return { valid: true, language: 'JavaScript' };
  } catch (err) {
    // If it's a function body or object literal, try wrapping as an expression
    try {
      new vm.Script(`(${trimmed})`, { filename: 'snippet_expr.js' });
      return { valid: true, language: 'JavaScript' };
    } catch (err2) {
      return {
        valid: false,
        code: 'JS_SYNTAX_ERROR',
        language: 'JavaScript',
        reason: err.message
      };
    }
  }
}

/**
 * 4. Validate SQL Query & Isolated In-Memory Execution Gate
 * Uses Node's native node:sqlite DatabaseSync in memory with a synthetic test schema.
 * Strictly bounded: no filesystem or network access, runs in-memory only.
 */
function validateSQLQuery(sqlQuery, syntheticSchema = null) {
  if (!sqlQuery || typeof sqlQuery !== 'string') return { valid: true };
  const trimmed = sqlQuery.trim().replace(/;+$/, '');
  if (!trimmed) return { valid: true };

  // Heuristic syntax checks: keywords order, unclosed quotes, invalid leading tokens
  const unclosedQuotes = (trimmed.match(/'/g) || []).length % 2 !== 0 || (trimmed.match(/"/g) || []).length % 2 !== 0;
  if (unclosedQuotes) {
    return {
      valid: false,
      code: 'SQL_SYNTAX_ERROR',
      language: 'SQL',
      reason: 'Unclosed quotes in SQL query snippet'
    };
  }

  // Obvious typo keywords
  if (/\b(SELEC|WHER|FROMM|UPDAT|INTOo)\b/i.test(trimmed)) {
    return {
      valid: false,
      code: 'SQL_SYNTAX_ERROR',
      language: 'SQL',
      reason: 'Misspelled SQL keyword detected'
    };
  }

  if (!sqliteEngine) {
    // Basic structural checks if node:sqlite is not loaded
    return _heuristicSyntaxCheck(trimmed, 'SQL');
  }

  try {
    const db = new sqliteEngine(':memory:');

    // Default synthetic tables for standard CS/DB coursework
    const defaultSchema = `
      CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, age INTEGER, email TEXT, score REAL);
      CREATE TABLE orders (order_id INTEGER PRIMARY KEY, user_id INTEGER, amount REAL, order_date TEXT);
      CREATE TABLE products (product_id INTEGER PRIMARY KEY, name TEXT, price REAL, stock INTEGER);
      CREATE TABLE employees (emp_id INTEGER PRIMARY KEY, department TEXT, salary REAL, manager_id INTEGER);
      CREATE TABLE students (roll_no INTEGER PRIMARY KEY, name TEXT, department TEXT, gpa REAL);
      INSERT INTO users VALUES (1, 'Alice', 25, 'alice@example.com', 95.5);
      INSERT INTO orders VALUES (101, 1, 150.0, '2026-10-01');
      INSERT INTO products VALUES (1, 'Laptop', 999.99, 10);
      INSERT INTO employees VALUES (1, 'CS', 80000.0, NULL);
      INSERT INTO students VALUES (101, 'Samanvi', 'CSE', 9.8);
    `;

    db.exec(syntheticSchema || defaultSchema);

    // Prepare statement to validate parsing & syntax against the SQLite parser
    const stmt = db.prepare(trimmed);

    // If it's a SELECT statement, run it to verify semantic execution against the synthetic table
    if (/^\s*SELECT\b/i.test(trimmed)) {
      stmt.all();
    }

    db.close();
    return { valid: true, language: 'SQL' };
  } catch (err) {
    // If the error is about an unknown table, the syntax might still be valid SQL,
    // so verify if it's a syntax error vs unknown table error
    const msg = err.message || '';
    if (msg.includes('syntax error') || msg.includes('incomplete input') || msg.includes('unrecognized token')) {
      return {
        valid: false,
        code: 'SQL_SYNTAX_ERROR',
        language: 'SQL',
        reason: msg
      };
    }

    // If it's just "no such table", syntax is technically valid SQLite syntax
    if (msg.includes('no such table') || msg.includes('no such column')) {
      return { valid: true, language: 'SQL', warning: msg };
    }

    return {
      valid: false,
      code: 'SQL_EXECUTION_ERROR',
      language: 'SQL',
      reason: msg
    };
  }
}

/**
 * Fallback structural balance check
 */
function _heuristicSyntaxCheck(codeStr, language = 'Generic') {
  let parens = 0, braces = 0, brackets = 0;
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < codeStr.length; i++) {
    const char = codeStr[i];
    const prev = i > 0 ? codeStr[i - 1] : '';

    if (inString) {
      if (char === stringChar && prev !== '\\') {
        inString = false;
      }
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      inString = true;
      stringChar = char;
      continue;
    }

    if (char === '(') parens++;
    else if (char === ')') parens--;
    else if (char === '{') braces++;
    else if (char === '}') braces--;
    else if (char === '[') brackets++;
    else if (char === ']') brackets--;

    if (parens < 0 || braces < 0 || brackets < 0) {
      return {
        valid: false,
        code: `${language.toUpperCase()}_UNBALANCED_DELIMITERS`,
        language,
        reason: `Mismatched closing delimiter '${char}' in code snippet`
      };
    }
  }

  if (parens !== 0 || braces !== 0 || brackets !== 0) {
    return {
      valid: false,
      code: `${language.toUpperCase()}_UNBALANCED_DELIMITERS`,
      language,
      reason: 'Unclosed parenthesis, brace, or bracket in code snippet'
    };
  }

  return { valid: true, language };
}

/**
 * Automatic Language Detector for Code Snippets
 */
function detectLanguage(codeSnippet) {
  if (!codeSnippet || typeof codeSnippet !== 'string') return 'Conceptual';

  const str = codeSnippet.trim();

  // SQL detection
  if (/\b(SELECT\s|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|CREATE\s+TABLE|ALTER\s+TABLE|GROUP\s+BY|ORDER\s+BY|JOIN\s+\w+\s+ON)\b/i.test(str)) {
    return 'SQL';
  }

  // MongoDB detection
  if (/\b(db\.[a-zA-Z0-9_]+\.(find|aggregate|updateOne|updateMany|insertOne|deleteMany)|\$match|\$group|\$project|\$lookup)\b/i.test(str)) {
    return 'MongoDB';
  }

  // Python detection
  if (/\b(def\s+[a-zA-Z_]\w*\s*\(|class\s+[a-zA-Z_]\w*\s*:|import\s+[a-zA-Z_]\w*|from\s+[a-zA-Z_]\w*\s+import|elif\s+|print\(|for\s+[a-zA-Z_]\w*\s+in\s+range)\b/.test(str)) {
    return 'Python';
  }

  // JavaScript / C++ detection
  if (/\b(const\s+[a-zA-Z_]\w*\s*=|let\s+[a-zA-Z_]\w*\s*=|var\s+[a-zA-Z_]\w*\s*=|function\s*\w*\(|=>\s*\{|\.forEach\(|\.map\(|\.filter\(|console\.log\()\b/.test(str)) {
    return 'JavaScript';
  }

  // C++ indicators
  if (/\b(int\s+main\(\)|std::|cout\s*<<|cin\s*>>|#include\s*<|nullptr)\b/.test(str)) {
    return 'C++';
  }

  return 'Conceptual';
}

/**
 * Universal AST & Code Validator Entry Point
 */
function parseAndValidateAST(codeOption, languageFamily = null) {
  if (!codeOption || typeof codeOption !== 'string') return { valid: true, isCode: false };

  const trimmed = codeOption.trim();
  if (trimmed.length < 3) return { valid: true, isCode: false };

  // Detect language if not explicitly provided
  const lang = languageFamily || detectLanguage(trimmed);

  if (lang === 'Conceptual') {
    // Pure conceptual question/option - passes safely without code validation
    return { valid: true, isCode: false, language: 'Conceptual' };
  }

  if (lang === 'SQL') {
    const res = validateSQLQuery(trimmed);
    res.isCode = true;
    return res;
  }

  if (lang === 'Python') {
    const res = validatePythonAST(trimmed);
    res.isCode = true;
    return res;
  }

  if (lang === 'JavaScript') {
    const res = validateJavaScriptAST(trimmed);
    res.isCode = true;
    return res;
  }

  if (lang === 'MongoDB' || lang === 'Theoretical CS') {
    const res = validateBSONQueryStructure(trimmed);
    res.isCode = true;
    return res;
  }

  if (lang === 'C++') {
    const res = _heuristicSyntaxCheck(trimmed, 'C++');
    res.isCode = true;
    return res;
  }

  return { valid: true, isCode: false };
}

/**
 * Question-Level Code Artifact Validator
 * Audits all code blocks in the question stem and options array.
 */
function validateQuestionCodeArtifacts(mcq) {
  if (!mcq || typeof mcq !== 'object') return { valid: true, hasCode: false };

  const snippets = [];

  // Check stem for fenced code blocks or standalone code
  const stem = mcq.questionText || mcq.stem || '';
  const codeBlockMatches = stem.match(/```(?:[a-zA-Z0-9_\-]+)?\s*([\s\S]*?)```/g);
  if (codeBlockMatches) {
    for (const m of codeBlockMatches) {
      const codeOnly = m.replace(/```(?:[a-zA-Z0-9_\-]+)?/g, '').replace(/```/g, '').trim();
      if (codeOnly) snippets.push({ source: 'stem_codeblock', snippet: codeOnly });
    }
  }

  // Check options
  if (Array.isArray(mcq.options)) {
    mcq.options.forEach((opt, idx) => {
      const lang = detectLanguage(opt);
      if (lang !== 'Conceptual') {
        snippets.push({ source: `option_${idx}`, snippet: opt, lang });
      }
    });
  }

  if (snippets.length === 0) {
    return { valid: true, hasCode: false, snippetsEvaluated: 0 };
  }

  const errors = [];
  for (const item of snippets) {
    const res = parseAndValidateAST(item.snippet, item.lang);
    if (!res.valid) {
      errors.push({
        source: item.source,
        language: res.language || item.lang,
        code: res.code,
        reason: res.reason,
        snippet: item.snippet
      });
    }
  }

  return {
    valid: errors.length === 0,
    hasCode: true,
    snippetsEvaluated: snippets.length,
    errors
  };
}

module.exports = {
  parseAndValidateAST,
  validateBSONQueryStructure,
  validatePythonAST,
  validateJavaScriptAST,
  validateSQLQuery,
  validateQuestionCodeArtifacts,
  detectLanguage
};
