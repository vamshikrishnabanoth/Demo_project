const { CONCEPT_CONFIG } = require('../../config/conceptConfig');

/**
 * Concept Typer: Classifies concepts using multi-signal pattern rules
 */
function inferConceptType(term, sources = [], textContext = '') {
  const clean = String(term).trim();
  const lower = clean.toLowerCase();
  const ctxLower = String(textContext).toLowerCase();

  // 1. PROTOCOL
  if (/\b(protocol|tcp|ip|udp|http|https|ftp|smtp|dns|ssh|ssl|tls|bgp|ospf|dhcp|arp|icmp)\b/i.test(clean) || lower.includes('protocol')) {
    return "PROTOCOL";
  }

  // 2. ALGORITHM
  if (/\b(algorithm|sort|search|hash|dijkstra|kruskal|prim|binary|tree|recursion|dynamic programming|heuristic)\b/i.test(clean) || lower.includes('algorithm')) {
    return "ALGORITHM";
  }

  // 3. DATA_STRUCTURE
  if (/\b(queue|stack|heap|linkedlist|array|graph|trie|matrix|vector|hashmap|tree|node|table|buffer)\b/i.test(clean) || lower.includes('structure')) {
    return "DATA_STRUCTURE";
  }

  // 4. API / METHOD / CLASS
  if (sources.includes('CODE_OR_MATH') || clean.includes('()') || clean.includes('`')) {
    if (/^[A-Z][a-zA-Z0-9]+$/.test(clean)) return "CLASS";
    if (/\(.*\)/.test(clean) || lower.includes('method') || lower.includes('function')) return "METHOD";
    return "API";
  }

  // 5. COMMAND
  if (/^[a-z0-9_\-]+$/.test(clean) && (ctxLower.includes('command') || ctxLower.includes('terminal') || ctxLower.includes('cli'))) {
    return "COMMAND";
  }

  // 6. DATABASE_OBJECT
  if (/\b(table|schema|index|query|sql|primary key|foreign key|database|column|relation)\b/i.test(clean)) {
    return "DATABASE_OBJECT";
  }

  // 7. SECURITY_MECHANISM
  if (/\b(encryption|cipher|hash|auth|jwt|oauth|firewall|token|signature|tls|ssl|key)\b/i.test(clean)) {
    return "SECURITY_MECHANISM";
  }

  // Fallback
  return "GENERAL_CONCEPT";
}

module.exports = {
  inferConceptType
};
