/**
 * server/engine/conceptGraphBuilder/utils/conceptSanitizer.js
 * 
 * MODULE 2 — CONCEPT SANITIZER (PURE NORMALIZATION)
 * Performs pure string normalization, punctuation trimming, stop-word edge stripping,
 * and technical term casing preservation.
 * 
 * Does NOT guess or repair concepts (repair is delegated to conceptRepair rules).
 */

'use strict';

// List of technical terms whose exact casing / punctuation MUST be preserved
const TECHNICAL_TERMS_MAP = new Map([
  ['b+ tree', 'B+ Tree'],
  ['b-tree', 'B-Tree'],
  ['hash table', 'Hash Table'],
  ['hash index', 'Hash Index'],
  ['b-tree index', 'B-Tree Index'],
  ['sha-256', 'SHA-256'],
  ['os', 'OS'],
  ['python', 'Python'],
  ['java', 'Java'],
  ['c', 'C'],
  ['c++', 'C++'],
  ['cpp', 'C++'],
  ['ai', 'AI'],
  ['ml', 'ML'],
  ['ds', 'DS'],
  ['dsa', 'DSA'],
  ['db', 'DB'],
  ['dbms', 'DBMS'],
  ['cn', 'CN'],
  ['coa', 'COA'],
  ['html', 'HTML'],
  ['css', 'CSS'],
  ['js', 'JS'],
  ['git', 'Git'],
  ['docker', 'Docker'],
  ['ipv6', 'IPv6'],
  ['ipv4', 'IPv4'],
  ['tcp ack', 'TCP ACK'],
  ['tcp', 'TCP'],
  ['udp', 'UDP'],
  ['http', 'HTTP'],
  ['https', 'HTTPS'],
  ['rnn', 'RNN'],
  ['cnn', 'CNN'],
  ['lstm', 'LSTM'],
  ['jwt', 'JWT'],
  ['o(log n)', 'O(log n)'],
  ['o(1)', 'O(1)'],
  ['o(n)', 'O(n)'],
  ['o(n^2)', 'O(n^2)'],
  ['sql', 'SQL'],
  ['nosql', 'NoSQL'],
  ['acid', 'ACID'],
  ['cpu', 'CPU'],
  ['ram', 'RAM'],
  ['dom', 'DOM'],
  ['ack', 'ACK'],
  ['ack flag', 'ACK Flag'],
  ['syn', 'SYN'],
  ['fin', 'FIN'],
  ['checksum', 'Checksum']
]);

// Stop words that should NOT appear at the extreme start or end of a concept string
const EDGE_STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'for', 'of', 'by', 'with', 'used', 'using', 'called', 'known', 'that',
  'which', 'in', 'on', 'at', 'to', 'from', 'as', 'into', 'such', 'this',
  'these', 'those', 'also', 'has', 'have', 'had', 'does', 'do', 'did',
  'provides', 'provides o', 'provide', 'provide o'
]);

/**
 * Trim leading and trailing stop words from word array
 */
function trimStopWords(str) {
  if (!str || typeof str !== 'string') return '';
  let words = str.trim().split(/\s+/);

  while (words.length > 0 && EDGE_STOP_WORDS.has(words[0].toLowerCase())) {
    words.shift();
  }
  while (words.length > 0 && EDGE_STOP_WORDS.has(words[words.length - 1].toLowerCase())) {
    words.pop();
  }

  return words.join(' ');
}

/**
 * Trim leading/trailing punctuation and markdown artifacts
 */
function trimPunctuation(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/^[\s#*_\-:`"'()[\\]{}|.,;?!]+/, '')
    .replace(/[\s#*_\-:`"'()[\\]{}|.,;?!]+$/, '')
    .trim();
}

/**
 * Preserve exact technical term capitalization if matched
 */
function normalizeTechnicalTerms(str) {
  if (!str || typeof str !== 'string') return '';
  const lower = str.trim().toLowerCase();
  if (TECHNICAL_TERMS_MAP.has(lower)) {
    return TECHNICAL_TERMS_MAP.get(lower);
  }
  return str;
}

const ACRONYM_BLACKLIST = new Set([
  'CSE', 'CSM', 'CSD', 'IT', 'ECE', 'EEE', 'RKR21', 'RKR', 'PAGE', 'UNIT',
  'SOFTWARE ENGINEERING', 'UNIT-1', 'UNIT-2', 'UNIT-3', 'UNIT-4', 'UNIT-5'
]);

/**
 * Check if candidate concept string is valid
 */
function isValidConcept(str) {
  if (!str || typeof str !== 'string') return false;
  const trimmed = str.trim();
  if (trimmed.length < 2) {
    // Only single-char concepts allowed are specific technical notations like O(1) or C
    if (!['C', 'R', 'K'].includes(trimmed)) return false;
  }

  // Reject blacklisted academic header acronyms (CSE, CSM, CSD, IT, etc.)
  if (ACRONYM_BLACKLIST.has(trimmed.toUpperCase())) return false;

  // Reject procedural imperative phrases ("Sort the output", "Only include", "Compare execution statistics between")
  const lower = trimmed.toLowerCase();
  if (/^(sort|display|only include|show|write a|calculate the|find all|arrange|retrieve|compare execution statistics|the warehouse manager|the marketing team)\b/.test(lower)) {
    return false;
  }

  // Reject if it contains raw markdown hashes or line breaks
  if (/#|\n|\r/.test(trimmed)) return false;

  // Reject if entire concept is just a stop word
  if (EDGE_STOP_WORDS.has(trimmed.toLowerCase())) return false;

  // Reject if string is isolated numbers or single stop words
  if (/^\d+$/.test(trimmed)) return false;

  return true;
}

/**
 * Main Pure Sanitizer function
 */
function sanitizeConcept(rawConcept) {
  if (!rawConcept || typeof rawConcept !== 'string') return '';

  let cleaned = rawConcept.trim();

  // Strip Markdown header symbols & decorative noise
  cleaned = cleaned.replace(/^#{1,6}\s+/, '');
  cleaned = trimPunctuation(cleaned);

  // Check technical term preserve
  const techMatch = normalizeTechnicalTerms(cleaned);
  if (techMatch !== cleaned) {
    return techMatch;
  }

  // Trim edge stop words
  cleaned = trimStopWords(cleaned);
  cleaned = trimPunctuation(cleaned);

  // Capitalize Title Case if all lower or simple phrase
  if (cleaned && !/[A-Z]/.test(cleaned)) {
    cleaned = cleaned.split(' ')
      .map(w => w.length > 0 ? w[0].toUpperCase() + w.slice(1).toLowerCase() : '')
      .join(' ');
  }

  return normalizeTechnicalTerms(cleaned);
}

module.exports = {
  sanitizeConcept,
  trimStopWords,
  trimPunctuation,
  isValidConcept,
  normalizeTechnicalTerms,
  TECHNICAL_TERMS_MAP
};
