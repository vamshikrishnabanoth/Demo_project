/**
 * server/test/test_focused_lecture_quality_audit.js
 *
 * Focused Lecture-Quality Audit Suite across 4 Core CS Domains:
 * - Domain 1: Data Structures (Complete & Full Binary Trees, Heap State Tracing)
 * - Domain 2: Databases & Concurrency (ACID, OCC vs 2PL, Strict 2PL, Deadlocks, WAL)
 * - Domain 3: Computer Architecture & Pipelining (ALU, Data Hazards, Structural Hazards & Mitigation)
 * - Domain 4: Operating Systems (Page Tables, Belady's Anomaly Definition & Reference Sequence Analysis, TLB Faults)
 *
 * Audits 19 real-world questions across 6 key testing categories:
 * 1. Easy Questions (Direct Recall / Definitions)
 * 2. Medium Questions (Mechanisms & Comparative Tradeoffs)
 * 3. Hard Recall Traps (Scenario Cosplay / Textbook Definitions disguised with "Why" & "Because")
 * 4. Genuine Causal Operational Mechanisms
 * 5. Mixed-Wording Mechanisms (Options containing definitional phrasing)
 * 6. Multi-Step State Tracing & Anomaly Diagnosis (Positive Controls)
 */

'use strict';

const agent3 = require('../engine/agents/agent3Evaluator');

const auditCases = [
  // =========================================================================
  // DOMAIN 1: BINARY TREES & TREE TOPOLOGIES (Original Observed Lecture)
  // =========================================================================
  {
    domain: "Binary Trees",
    category: "Easy Recall",
    tier: "Easy",
    intendedOp: "RECALL",
    expectedVerdict: "PASS",
    expectedDemand: "RECALL",
    humanRationale: "Target is Easy. Asking for textbook definition of leaf node is appropriate for Easy tier.",
    mcq: {
      questionText: "What is a leaf node in a binary tree?",
      options: [
        "A node that has zero child nodes",
        "A node with exactly one child",
        "A node with two children",
        "The root node of any tree"
      ],
      correctAnswer: "A node that has zero child nodes"
    },
    evidence: "In a binary tree, a leaf node (external node) is any node that has zero children."
  },
  {
    domain: "Binary Trees",
    category: "Medium Comparison",
    tier: "Medium",
    intendedOp: "COMPARE",
    expectedVerdict: "PASS",
    expectedDemand: "COMPARE",
    humanRationale: "Target is Medium. Differentiating structural constraints between full and complete binary trees requires comparative understanding.",
    mcq: {
      questionText: "How does a full binary tree differ from a complete binary tree in its structural constraints?",
      options: [
        "In a full binary tree every internal node has exactly two children, whereas in a complete binary tree all levels except possibly the last must be completely filled from left to right",
        "In a full binary tree all leaves must reside at the exact same depth, whereas complete binary trees permit random node insertion",
        "In a full binary tree nodes are stored as arrays, whereas complete binary trees strictly require linked lists",
        "In a full binary tree left subtrees are always larger than right subtrees, whereas complete binary trees require equal sizes"
      ],
      correctAnswer: "In a full binary tree every internal node has exactly two children, whereas in a complete binary tree all levels except possibly the last must be completely filled from left to right"
    },
    evidence: "A full binary tree requires every node to have 0 or 2 children. A complete binary tree requires all levels except the last to be fully filled, with the last level filled from left to right."
  },
  {
    domain: "Binary Trees",
    category: "Hard Recall Trap (Observed Q1)",
    tier: "Hard",
    intendedOp: "DIAGNOSE",
    expectedVerdict: "FAIL",
    expectedDemand: "RECALL",
    humanRationale: "Target is Hard. Stem gives the condition (1 child) and asks why it's classified as internal; options repeat the textbook definition. Must fail Hard calibration.",
    mcq: {
      questionText: "In a binary tree, a node with exactly one child is classified as internal. Why does this classification hold despite the node not being fully populated?",
      options: [
        "Because it is not a leaf, so it must be internal by exclusion",
        "Because it has fewer than two children, marking it as external",
        "Because it is at a non-terminal level, forcing internal status",
        "Because it has at least one child, satisfying the internal node definition"
      ],
      correctAnswer: "Because it has at least one child, satisfying the internal node definition"
    },
    evidence: "In a binary tree, an internal node is any node that has at least one child."
  },
  {
    domain: "Binary Trees",
    category: "Hard Recall Trap (Observed Q3)",
    tier: "Hard",
    intendedOp: "DIAGNOSE",
    expectedVerdict: "FAIL",
    expectedDemand: "RECALL",
    humanRationale: "Target is Hard. Asking which metric convention sets root height to zero is pure terminology recall dressed up with 'cache eviction policy'. Must fail Hard calibration.",
    mcq: {
      questionText: "A system designer must define the height of a single-node tree for a cache eviction policy. If the policy requires the height to be zero, which metric definition must be adopted?",
      options: [
        "Counting the number of levels starting from one",
        "Counting the maximum depth of leaf nodes",
        "Counting the total number of nodes in the tree",
        "Counting the number of edges connecting nodes"
      ],
      correctAnswer: "Counting the number of edges connecting nodes"
    },
    evidence: "Tree height can be measured by counting nodes (root has height 1) or counting edges (root has height 0)."
  },
  {
    domain: "Binary Trees",
    category: "Hard Recall Trap (Observed Q6)",
    tier: "Hard",
    intendedOp: "DIAGNOSE",
    expectedVerdict: "FAIL",
    expectedDemand: "RECALL",
    humanRationale: "Target is Hard. Describes properties of a perfect binary tree and asks for its name. Pure definition matching. Must fail Hard calibration.",
    mcq: {
      questionText: "Consider a scenario where a binary tree must strictly maintain all internal nodes with exactly two children, and all leaf nodes must reside at the same level. What type of binary tree is being described, and what is its primary constraint?",
      options: [
        "Full binary tree; requires all internal nodes to have 0 or 2 children.",
        "Complete binary tree; allows the last level to be partially filled from left.",
        "Perfect binary tree; requires all internal nodes have 2 children and leaves at same level.",
        "Balanced binary tree; requires height difference between subtrees <= 1."
      ],
      correctAnswer: "Perfect binary tree; requires all internal nodes have 2 children and leaves at same level."
    },
    evidence: "A perfect binary tree requires all internal nodes to have 2 children and all leaf nodes to be at the same level."
  },
  {
    domain: "Binary Trees",
    category: "Hard Multi-Step State Trace",
    tier: "Hard",
    intendedOp: "DIAGNOSE",
    expectedVerdict: "PASS",
    expectedDemand: "TRACE",
    humanRationale: "Target is Hard. Sifting down root across 6 elements requires 2 sequential child comparisons and swaps to find final array state. Valid Hard trace.",
    mcq: {
      questionText: "A min-heap is represented as the 1-based array [4, 7, 9, 12, 15, 18, 20]. Trace the execution after extracting the minimum element (4) and restoring the min-heap invariant via sift-down: what is the terminal value stored in index 2?",
      options: ["12", "20", "7", "15"],
      correctAnswer: "12"
    },
    evidence: "In a binary min-heap stored in an array, extracting the root replaces it with the last element and sifts down by swapping with the smaller child until heap order is restored."
  },

  // =========================================================================
  // DOMAIN 2: DATABASES & CONCURRENCY CONTROL
  // =========================================================================
  {
    domain: "Concurrency & Databases",
    category: "Easy Recall",
    tier: "Easy",
    intendedOp: "RECALL",
    expectedVerdict: "PASS",
    expectedDemand: "RECALL",
    humanRationale: "Target is Easy. Asking for the expansion of the ACID acronym is appropriate for Easy tier.",
    mcq: {
      questionText: "What does the acronym ACID stand for in database transaction systems?",
      options: [
        "Atomicity, Consistency, Isolation, Durability",
        "Accuracy, Concurrency, Integrity, Durability",
        "Allocation, Consistency, Isolation, Distribution",
        "Atomicity, Coordination, Indexing, Durability"
      ],
      correctAnswer: "Atomicity, Consistency, Isolation, Durability"
    },
    evidence: "ACID properties in database systems represent Atomicity, Consistency, Isolation, and Durability."
  },
  {
    domain: "Concurrency & Databases",
    category: "Medium Comparison",
    tier: "Medium",
    intendedOp: "COMPARE",
    expectedVerdict: "PASS",
    expectedDemand: "COMPARE",
    humanRationale: "Target is Medium. Contrasting conflict detection timing between OCC and 2PL requires understanding transaction phase mechanisms.",
    mcq: {
      questionText: "How do optimistic concurrency control and pessimistic locking differ in their conflict detection timing?",
      options: [
        "Optimistic concurrency control validates conflicts at commit time before writes, whereas pessimistic locking acquires exclusive locks during read and write execution",
        "Optimistic locking converts all write locks into shared locks, whereas pessimistic concurrency aborts all concurrent reads immediately",
        "Optimistic locking requires distributed hardware clocks, whereas pessimistic locking operates strictly on single-core architectures",
        "Optimistic concurrency eliminates transaction aborts completely, whereas pessimistic locking causes all transactions to abort upon collision"
      ],
      correctAnswer: "Optimistic concurrency control validates conflicts at commit time before writes, whereas pessimistic locking acquires exclusive locks during read and write execution"
    },
    evidence: "Optimistic concurrency control delays conflict checks until transaction validation/commit phase, while pessimistic locking acquires locks during execution."
  },
  {
    domain: "Concurrency & Databases",
    category: "Hard Causal Mechanism",
    tier: "Hard",
    intendedOp: "DIAGNOSE",
    expectedVerdict: "PASS",
    expectedDemand: "EXPLAIN_MECHANISM",
    humanRationale: "Target is Hard. Explaining why lock release timing prevents dirty-read cascade propagation requires causal deduction.",
    mcq: {
      questionText: "In a database system using Strict Two-Phase Locking (Strict 2PL), why does holding exclusive write locks until transaction completion prevent cascading aborts across concurrent transactions?",
      options: [
        "Because concurrent transactions are prevented from reading uncommitted dirty data that could later be rolled back",
        "Because all transactions acquire locks simultaneously at system startup to eliminate conflict",
        "Because the storage engine automatically aborts all active reading transactions prior to disk write",
        "Because write locks are converted into shared read locks immediately after each write statement"
      ],
      correctAnswer: "Because concurrent transactions are prevented from reading uncommitted dirty data that could later be rolled back"
    },
    evidence: "In Strict 2PL, holding exclusive write locks until completion prevents other transactions from reading dirty uncommitted writes, eliminating cascading aborts."
  },
  {
    domain: "Concurrency & Databases",
    category: "Hard Mixed-Wording Mechanism (User Caution Check)",
    tier: "Hard",
    intendedOp: "DIAGNOSE",
    expectedVerdict: "PASS",
    expectedDemand: "EXPLAIN_MECHANISM",
    humanRationale: "Target is Hard. Tests user caution: the key option contains 'rule mandates' and 'uncommitted states', but the core question is causal recovery reasoning. Must NOT be falsely rejected as recall.",
    mcq: {
      questionText: "In a database using write-ahead logging (WAL), why must dirty page log records be flushed to disk before the corresponding modified data page is written to persistent storage?",
      options: [
        "Because the write-ahead logging protocol mandates that log records precede persistent data pages so the recovery manager can reconstruct or undo uncommitted states upon a crash",
        "Because writing data pages first permanently locks the database buffer pool and prevents any transaction commit",
        "Because the disk controller requires log files and table files to be written in alternating sectors to prevent fragmentation",
        "Because unwritten log records cause the operating system kernel to reject subsequent filesystem sync calls"
      ],
      correctAnswer: "Because the write-ahead logging protocol mandates that log records precede persistent data pages so the recovery manager can reconstruct or undo uncommitted states upon a crash"
    },
    evidence: "The write-ahead logging (WAL) protocol dictates that log records describing a modification must reach disk before the modified data page is written to disk, ensuring atomicity and durability during crash recovery."
  },
  {
    domain: "Concurrency & Databases",
    category: "Hard Deadlock Diagnosis",
    tier: "Hard",
    intendedOp: "DIAGNOSE",
    expectedVerdict: "PASS",
    expectedDemand: "DIAGNOSE",
    humanRationale: "Target is Hard. Given a 2-transaction lock acquisition sequence (T1 holds A requests B, T2 holds B requests A), diagnosing the circular wait failure is genuine applied diagnosis.",
    mcq: {
      questionText: "In a database transaction schedule where T1 holds an exclusive lock on resource A and requests resource B, while T2 holds an exclusive lock on resource B and requests resource A, what specific concurrency failure is diagnosed?",
      options: [
        "A circular wait deadlock cycle between T1 and T2",
        "A cascading abort triggered by uncommitted dirty reads",
        "A livelock caused by continuous transaction priority preemption",
        "A starvation condition where lower priority transactions are delayed"
      ],
      correctAnswer: "A circular wait deadlock cycle between T1 and T2"
    },
    evidence: "Deadlock occurs when there is a circular wait dependency graph where T1 holds lock on A and waits for B, while T2 holds lock on B and waits for A."
  },

  // =========================================================================
  // DOMAIN 3: COMPUTER ARCHITECTURE & PIPELINING
  // =========================================================================
  {
    domain: "Computer Architecture",
    category: "Easy Recall",
    tier: "Easy",
    intendedOp: "RECALL",
    expectedVerdict: "PASS",
    expectedDemand: "RECALL",
    humanRationale: "Target is Easy. Asking for the functional role of the Arithmetic Logic Unit is appropriate for Easy tier.",
    mcq: {
      questionText: "Which hardware component of a central processing unit executes integer arithmetic and bitwise logic operations?",
      options: [
        "Arithmetic Logic Unit (ALU)",
        "Translation Lookaside Buffer (TLB)",
        "Direct Memory Access controller (DMA)",
        "Memory Management Unit (MMU)"
      ],
      correctAnswer: "Arithmetic Logic Unit (ALU)"
    },
    evidence: "The Arithmetic Logic Unit (ALU) is the CPU combinational circuit that performs arithmetic and bitwise operations."
  },
  {
    domain: "Computer Architecture",
    category: "Medium Mechanism",
    tier: "Medium",
    intendedOp: "EXPLAIN_MECHANISM",
    expectedVerdict: "PASS",
    expectedDemand: "EXPLAIN_MECHANISM",
    humanRationale: "Target is Medium. Explaining how forwarding solves a RAW dependency between EX and ID stages tests operational pipeline mechanics.",
    mcq: {
      questionText: "What occurs during a pipeline data hazard when an instruction in the decode stage depends on the arithmetic result of the immediately preceding instruction in the execute stage?",
      options: [
        "The forwarding unit routes the execution result directly from the ALU output back to the decode stage without inserting stall cycles",
        "The pipeline controller flushes all five stages and restarts program execution from the instruction cache",
        "The program counter is decremented by 8 bytes to re-fetch the preceding instruction from physical memory",
        "The instruction decoder converts the dependent instruction into a sequence of no-op operations permanently"
      ],
      correctAnswer: "The forwarding unit routes the execution result directly from the ALU output back to the decode stage without inserting stall cycles"
    },
    evidence: "In pipelined processor design, a data hazard occurs when an instruction in the decode stage depends on the result of an arithmetic instruction in the execute stage. The forwarding unit resolves this data hazard by routing the execution result directly from the ALU output back to the decode stage without inserting stall cycles."
  },
  {
    domain: "Computer Architecture",
    category: "Hard Recall Trap (Cosplay Structural Hazard)",
    tier: "Hard",
    intendedOp: "DIAGNOSE",
    expectedVerdict: "FAIL",
    expectedDemand: "RECALL",
    humanRationale: "Target is Hard. Asking why single-port memory conflict is classified as a structural hazard is asking for category taxonomy, not calculating hardware hazards. Must fail Hard calibration.",
    mcq: {
      questionText: "A pipeline hardware designer notes that simultaneous memory access conflicts occur when instruction fetch and data memory access target a single-port cache. Under processor taxonomy, why is this condition classified as a structural hazard rather than a control hazard?",
      options: [
        "Because it is caused by a hardware resource limitation rather than a branch decision, satisfying the structural hazard classification",
        "Because it involves branch misprediction in the instruction fetch stage",
        "Because it is resolved exclusively through software compiler reordering",
        "Because it only affects floating-point operations while leaving integer registers valid"
      ],
      correctAnswer: "Because it is caused by a hardware resource limitation rather than a branch decision, satisfying the structural hazard classification"
    },
    evidence: "A structural hazard occurs when hardware cannot support all possible combinations of instructions in the same clock cycle due to resource conflicts like single-port memory."
  },
  {
    domain: "Computer Architecture",
    category: "Hard Structural Hazard Mitigation (Positive Control)",
    tier: "Hard",
    intendedOp: "DIAGNOSE",
    expectedVerdict: "PASS",
    expectedDemand: "DIAGNOSE",
    humanRationale: "Target is Hard. Asking for the specific cycle action (inserting a 1-cycle bubble by freezing IF/ID) to resolve a concrete simultaneous access conflict on single-port RAM. Genuine applied diagnosis.",
    mcq: {
      questionText: "A pipelined processor with single-port memory encounters a resource conflict when an instruction fetch in stage IF coincides with a data memory load in stage MEM during clock cycle 4. What specific hardware action must the hazard detection unit execute to resolve this structural hazard?",
      options: [
        "Insert a 1-cycle pipeline bubble by disabling write-enable on the IF/ID registers and freezing the program counter until the load completes",
        "Forward the loaded data word directly into the instruction decode register to bypass the cache",
        "Flush all five pipeline stages and re-fetch from the interrupt vector address",
        "Convert the load instruction into a floating-point operation to use a separate register file"
      ],
      correctAnswer: "Insert a 1-cycle pipeline bubble by disabling write-enable on the IF/ID registers and freezing the program counter until the load completes"
    },
    evidence: "In pipelined processor design, a structural hazard occurs when multiple instructions compete for the same physical hardware resource simultaneously. When an instruction fetch in the IF stage and a data memory access in the MEM stage both target a single-port memory in the same cycle, the hazard detection unit resolves the structural hazard by inserting a one-cycle stall or bubble, disabling the program counter and IF/ID pipeline registers until the memory port becomes available."
  },

  // =========================================================================
  // DOMAIN 4: OPERATING SYSTEMS & VIRTUAL MEMORY
  // =========================================================================
  {
    domain: "OS Memory Management",
    category: "Easy Recall",
    tier: "Easy",
    intendedOp: "RECALL",
    expectedVerdict: "PASS",
    expectedDemand: "RECALL",
    humanRationale: "Target is Easy. Asking for the name of the address translation data structure is appropriate for Easy tier.",
    mcq: {
      questionText: "What data structure does an operating system maintain to translate virtual page numbers into physical frame numbers?",
      options: [
        "Page Table",
        "Segment Table",
        "File Allocation Table",
        "Process Control Block"
      ],
      correctAnswer: "Page Table"
    },
    evidence: "A page table is the data structure used by a virtual memory system in an operating system to store the mapping between virtual addresses and physical addresses."
  },
  {
    domain: "OS Memory Management",
    category: "Hard Recall Trap (Cosplay Belady)",
    tier: "Hard",
    intendedOp: "DIAGNOSE",
    expectedVerdict: "FAIL",
    expectedDemand: "RECALL",
    humanRationale: "Target is Hard. Setting numbers (faults 9 to 10, frames 3 to 4) is scenario costume; asking why it's classified as Belady's Anomaly is textbook naming recall. Must fail Hard calibration.",
    mcq: {
      questionText: "A memory manager simulator observes page fault counts increasing from 9 to 10 when physical frame allocation is increased from 3 to 4 under FIFO page replacement. Under memory management taxonomy, why is this phenomenon classified as Belady's Anomaly rather than a thrashing condition?",
      options: [
        "Because it represents a specific algorithmic property violation of non-stack replacement policies, satisfying the definition of Belady's Anomaly",
        "Because the working set of the process exceeded total physical RAM capacity",
        "Because page tables were allocated in non-contiguous physical memory frames",
        "Because the page replacement daemon ran out of available swap disk sectors"
      ],
      correctAnswer: "Because it represents a specific algorithmic property violation of non-stack replacement policies, satisfying the definition of Belady's Anomaly"
    },
    evidence: "Belady's Anomaly is the phenomenon in which increasing the number of page frames results in an increase in the number of page faults for certain memory access patterns under FIFO replacement."
  },
  {
    domain: "OS Memory Management",
    category: "Hard Belady's Anomaly Analysis (Positive Control)",
    tier: "Hard",
    intendedOp: "DIAGNOSE",
    expectedVerdict: "PASS",
    expectedDemand: "DIAGNOSE",
    humanRationale: "Target is Hard. Analyzing the chronological reference string [1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5] under 3 vs 4 frames requires simulating the replacement queue across 12 steps. Genuine Hard analytical problem.",
    mcq: {
      questionText: "A virtual memory simulator processes the page reference sequence [1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5] under FIFO page replacement. How does the total page fault count transition when physical memory allocation is increased from 3 frames to 4 frames, demonstrating Belady's Anomaly?",
      options: [
        "Transitions from 9 misses on 3 frames up to 10 misses when expanded to 4 frames",
        "Decreases sharply from 12 page faults down to 6 faults as capacity grows",
        "Remains invariant at 7 replacements across both memory configurations",
        "Drops to zero page faults because working set residency is achieved"
      ],
      correctAnswer: "Transitions from 9 misses on 3 frames up to 10 misses when expanded to 4 frames"
    },
    evidence: "Belady's Anomaly is a counterintuitive phenomenon in FIFO page replacement where increasing physical memory allocation from 3 frames to 4 frames actually increases the total number of page faults. For the reference string 1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5, an allocation of 3 frames incurs 9 page faults, whereas increasing allocation to 4 frames increases the total to 10 page faults."
  },
  {
    domain: "OS Memory Management",
    category: "Hard Fault Diagnosis",
    tier: "Hard",
    intendedOp: "DIAGNOSE",
    expectedVerdict: "PASS",
    expectedDemand: "DIAGNOSE",
    humanRationale: "Target is Hard. Given TLB present bit = 0 and page table valid bit = 0, diagnosing the resulting page fault exception and disk swap retrieval is applied system diagnosis.",
    mcq: {
      questionText: "In a virtual memory system, when a memory access produces a valid bit of 0 in the page table entry while the present bit in the TLB is also 0, what specific fault is diagnosed?",
      options: [
        "A page fault requiring the operating system to retrieve the missing page from disk swap space",
        "A memory bus structural hazard that requires CPU clock stalling",
        "A segmentation fault indicating illegal memory access across protected boundaries",
        "A cache tag mismatch requiring a dual-port memory cycle flush"
      ],
      correctAnswer: "A page fault requiring the operating system to retrieve the missing page from disk swap space"
    },
    evidence: "When the page table entry indicates valid bit 0 (not in memory), the MMU triggers a page fault exception, causing the OS to fetch the page from swap space."
  }
];

async function runFocusedLectureAudit() {
  console.log('========================================================================');
  console.log('🧪 Focused Lecture-Quality Audit Suite across 4 Core CS Domains');
  console.log('========================================================================\n');

  let passedAuditCount = 0;
  const auditReport = [];

  for (const item of auditCases) {
    const res = await agent3.evaluateQuestion(item.mcq, {
      concept: item.category,
      targetDifficulty: item.tier,
      intendedCognitiveOperation: item.intendedOp
    }, {
      unifiedRawContent: item.evidence,
      sessionId: `sess_audit_${item.domain.toLowerCase().replace(/[^a-z0-9]/g, '_')}`
    }, { skipLLM: true });

    const isPass = res.status === 'PASS';
    const isAligned = (item.expectedVerdict === 'PASS' && isPass) || (item.expectedVerdict === 'FAIL' && !isPass);

    if (isAligned) passedAuditCount++;

    auditReport.push({
      domain: item.domain,
      category: item.category,
      tier: item.tier,
      stem: item.mcq.questionText.slice(0, 65) + '...',
      evaluatedDemand: res.cognitiveAudit?.evaluatedCognitiveDemand,
      calibrated: res.cognitiveAudit?.isCalibrated,
      verificationMethod: res.verificationMethod,
      expectedVerdict: item.expectedVerdict,
      actualVerdict: res.status,
      score: res.score,
      failureReasons: res.failureReasons,
      alignment: isAligned ? 'ALIGNED ✅' : 'MISALIGNED ❌',
      humanReview: item.humanRationale
    });
  }

  console.log(`Audit Summary: ${passedAuditCount} / ${auditCases.length} items aligned with pedagogical expectations (${Math.round((passedAuditCount / auditCases.length) * 100)}%)\n`);

  console.table(auditReport.map(r => ({
    'Domain': r.domain,
    'Category': r.category,
    'Tier': r.tier,
    'Evaluated Demand': r.evaluatedDemand,
    'Method': r.verificationMethod,
    'Expected': r.expectedVerdict,
    'Actual': r.actualVerdict,
    'Status': r.alignment
  })));

  return auditReport;
}

if (require.main === module) {
  runFocusedLectureAudit().catch(err => {
    console.error('Audit run failed:', err);
    process.exit(1);
  });
}

module.exports = { runFocusedLectureAudit, auditCases };
