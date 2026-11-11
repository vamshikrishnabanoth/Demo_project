/**
 * server/utils/inputKind.js
 *
 * Decides what a piece of teacher-typed or pasted text is, so that pasted material
 * (notes, source code, SQL, terminal sessions) is treated as teaching material and only a
 * short topic name is treated as a topic for curriculum-style generation.
 */

'use strict';

const TOPIC_MAX_WORDS = 25;

const TERMINAL_LINE = /^\s*(?:\$|#|>|PS [A-Za-z]:\\[^>]*>|[A-Za-z]:\\[^>]*>|[\w.-]+@[\w.-]+:[^$#]*[$#])\s*\S/;
const CODE_LINE = /[;{}]\s*$|^\s*(?:def|class|public|private|protected|static|int|void|char|float|double|bool|boolean|String|return|import|from|#include|function|const|let|var|if|else|for|while|switch|case|try|catch|print|printf|System\.out)\b|^\s*(?:SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|WITH)\b|=>|->|\)\s*\{/i;

/** True when the text is a short topic name rather than material to assess. */
function isTopicLike(text) {
  const t = String(text || '').trim();
  if (!t) return false;
  if (/\n/.test(t)) return false;
  if (t.split(/\s+/).filter(Boolean).length > TOPIC_MAX_WORDS) return false;
  if (TERMINAL_LINE.test(t) || CODE_LINE.test(t)) return false;
  return true;
}

/**
 * Classify a block of pasted text.
 * @returns {'topic'|'terminal'|'code'|'notes'}
 */
function classifyTextBlock(text) {
  const t = String(text || '');
  if (isTopicLike(t)) return 'topic';
  const lines = t.split('\n').filter(l => l.trim().length > 0);
  if (lines.length === 0) return 'notes';
  const terminalLines = lines.filter(l => TERMINAL_LINE.test(l)).length;
  if (terminalLines >= 1 && terminalLines / lines.length >= 0.15) return 'terminal';
  const codeLines = lines.filter(l => CODE_LINE.test(l)).length;
  if (codeLines / lines.length >= 0.3) return 'code';
  return 'notes';
}

module.exports = { isTopicLike, classifyTextBlock, TOPIC_MAX_WORDS };
