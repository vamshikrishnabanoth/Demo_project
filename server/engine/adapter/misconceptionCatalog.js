/**
 * Phase 2 — Misconception Catalog
 * Registry of common domain-specific student misconceptions to guide distractor generation.
 */

'use strict';

const MISCONCEPTION_CATALOG = {
  // Computer Science & Software Engineering
  "sliding_window": [
    "Confusing ACK loss timeout with sliding frame corruption",
    "Assuming receiver window size is static regardless of buffer availability",
    "Conflating Go-Back-N retransmission with Selective Repeat packet buffering"
  ],
  "pointers": [
    "Confusing memory address (&x) with pointer dereferenced value (*p)",
    "Assuming uninitialized pointer points to NULL automatically",
    "Expecting pointer arithmetic to increment by 1 byte instead of sizeof(T)"
  ],
  "sql_joins": [
    "Confusing INNER JOIN filtering with WHERE clause predicate evaluation",
    "Assuming LEFT JOIN excludes non-matching rows from the right table",
    "Conflating GROUP BY aggregation with DISTINCT row elimination"
  ],
  "recursion": [
    "Omitting base case causing infinite stack frame allocation",
    "Confusing head recursion return evaluation order with tail call optimization"
  ],
  "neural_networks": [
    "Confusing gradient descent learning rate with model weight magnitude",
    "Assuming backpropagation updates weights synchronously in forward pass",
    "Conflating vanishing gradient with exploding activation outputs in deep layers"
  ],
  "recurrent_neural_networks": [
    "Assuming standard RNNs retain long-term dependencies without vanishing gradients",
    "Confusing hidden state h_t with cell state c_t in LSTM architectures",
    "Conflating Backpropagation Through Time (BPTT) with standard feedforward backprop"
  ],
  "operating_systems": [
    "Confusing process state READY with RUNNING during CPU scheduling",
    "Assuming virtual memory paging physically contiguous RAM allocation",
    "Conflating deadlock prevention with deadlock detection and recovery"
  ]
};

function getMisconceptionsForConcept(conceptName) {
  if (!conceptName || typeof conceptName !== 'string') return [];
  const lower = conceptName.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  
  for (const [key, misconceptions] of Object.entries(MISCONCEPTION_CATALOG)) {
    if (lower.includes(key) || key.includes(lower)) {
      return misconceptions;
    }
  }
  
  return [
    `Confusing foundational mechanisms of ${conceptName} with peripheral operational constraints`,
    `Over-generalizing boundary conditions for ${conceptName}`
  ];
}

module.exports = {
  MISCONCEPTION_CATALOG,
  getMisconceptionsForConcept
};
