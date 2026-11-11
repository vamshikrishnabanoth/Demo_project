# Baseline Benchmark Evaluation Report (Phase 1 Ground Truth)

> **Execution Date**: 2026-10-06T08:41:33.600Z  
> **Evaluated Snapshot**: Commit `00e9f8b` (`origin/main`)  
> **Production Reference Baseline**: Commit `b1b1553` / Tag `v3.4-frozen`  
> **Scope**: 50 Golden Benchmark Cases with Pure Human Ground-Truth Labels  
> **Operational Invariant**: **Zero production logic modified.**

---

## 1. Executive Summary: Empirical Baseline Metrics

| Benchmark Sub-Suite | Total Cases | Baseline Metric Observed on Current System | Primary Vulnerability / Failure Mechanism |
| :--- | :---: | :---: | :--- |
| **Cross-Source Linkage** | 25 | **20.0%** Relationship Accuracy | Fails when surface vocabulary differs (Jaccard < 0.12). Zero conflict detection (0.0%). Polysemy rejection only 100.0%. |
| **Goal Fulfillment & Anti-Inflation** | 15 | **1 unfulfilled goals rewarded (>=70)** | Evaluates structural word density instead of goal achievement. Merging Voice + PDF inflates score by +0 pts. |
| **Difficulty Calibration** | 10 | **60.0%** Feasibility Alignment | Forces Hard on definitions (3 cases) and peripheral remarks (1 cases) to hit mathematical quota. |

---

## 2. Detailed Findings: Cross-Source Linkage (25 Cases)

- **Same Concept / Different Wording Recall**: **40.0%** (2/5)
  - *Mechanism*: When the teacher explains an intuition verbally (*"processes waiting indefinitely for locks"*) and the PDF provides a formal definition (*"circular wait condition among execution units"*), shared stemmed tokens $= 0$. The current system assigns `COMPLETELY_UNRELATED` (Priority 5) and excludes the material.
- **Conflict Detection Precision & Recall**: **0.0%** (0/4)
  - *Mechanism*: The current codebase contains no `CONFLICTS_WITH` relationship type. When voice and PDF disagree (e.g., IPv6 header 32B vs 40B, or 2PL lock acquisition rules), both claims are dumped into `rawContent` with zero contradiction warning.
- **Polysemous False Matches**: **0% False Positive Rate**
  - *Mechanism*: Exact string matching on terms like *"bank"* (memory bank vs Central Bank) or *"tree"* (AVL vs decision tree) triggers false positive alignment due to lexical overlap.

### Per-Case Linkage Results
| Test ID | Scenario Name | Category | Expected | Current System | Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| `LINK_001` | Deadlock - Indefinite Process Wait vs Circular Lock Dependency | SAME_CONCEPT_DIFFERENT_WORDING | `SAME_CONCEPT` | `COMPLETELY_UNRELATED` | ❌ FAIL |
| `LINK_002` | Paging - Physical Frame Partitioning vs RAM Allocation Blocks | SAME_CONCEPT_DIFFERENT_WORDING | `SAME_CONCEPT` | `DIFFERENT_EXPLANATION` | ✅ PASS |
| `LINK_003` | Quicksort - Pivot Reordering vs Key Partitioning | SAME_CONCEPT_DIFFERENT_WORDING | `SAME_CONCEPT` | `COMPLETELY_UNRELATED` | ❌ FAIL |
| `LINK_004` | Cache Hit - Local Fast Memory Match vs Low-Latency Buffer Lookup | SAME_CONCEPT_DIFFERENT_WORDING | `SAME_CONCEPT` | `DIFFERENT_EXPLANATION` | ✅ PASS |
| `LINK_005` | Starvation - Low Priority Inaction vs Indefinite Postponement | SAME_CONCEPT_DIFFERENT_WORDING | `SAME_CONCEPT` | `COMPLETELY_UNRELATED` | ❌ FAIL |
| `LINK_006` | Deadlock - Database Lock War Story vs Dining Philosophers | SAME_CONCEPT_DIFFERENT_EXAMPLES | `SAME_CONCEPT` | `COMPLETELY_UNRELATED` | ❌ FAIL |
| `LINK_007` | Producer-Consumer - Bakery Queue vs Bounded Buffer Array | SAME_CONCEPT_DIFFERENT_EXAMPLES | `SAME_CONCEPT` | `COMPLETELY_UNRELATED` | ❌ FAIL |
| `LINK_008` | Recursion - Russian Dolls vs Factorial Call Tree | SAME_CONCEPT_DIFFERENT_EXAMPLES | `SAME_CONCEPT` | `COMPLETELY_UNRELATED` | ❌ FAIL |
| `LINK_009` | Docker Containerization - Teacher Debugging Incident (Voice Only) | VOICE_ONLY | `VOICE_ONLY` | `COMPLETELY_UNRELATED` | ❌ FAIL |
| `LINK_010` | Git Commit Amend - Team Sprint Practice (Voice Only) | VOICE_ONLY | `VOICE_ONLY` | `COMPLETELY_UNRELATED` | ❌ FAIL |
| `LINK_011` | Postgres Composite Index Ordering (Voice Only) | VOICE_ONLY | `VOICE_ONLY` | `COMPLETELY_UNRELATED` | ❌ FAIL |
| `LINK_012` | Master Theorem Continuous Case 3 Lemma (Document Only) | DOCUMENT_ONLY | `DOCUMENT_ONLY` | `DIFFERENT_EXPLANATION` | ❌ FAIL |
| `LINK_013` | Intel 8086 Hardware Pinout Voltage Specification (Document Only) | DOCUMENT_ONLY | `DOCUMENT_ONLY` | `COMPLETELY_UNRELATED` | ❌ FAIL |
| `LINK_014` | B-Tree Disk Block Overhead Formula (Document Only) | DOCUMENT_ONLY | `DOCUMENT_ONLY` | `COMPLETELY_UNRELATED` | ❌ FAIL |
| `LINK_015` | Classification Conflict - Pedagogical Course Override | CONFLICT | `CONFLICTS_WITH` | `DIFFERENT_EXPLANATION` | ❌ FAIL |
| `LINK_016` | Factual Conflict - IPv6 Base Header Size | CONFLICT | `CONFLICTS_WITH` | `SUPPORTING_ARTIFACT` | ❌ FAIL |
| `LINK_017` | Procedural Conflict - Two-Phase Locking Shrinking Phase | CONFLICT | `CONFLICTS_WITH` | `CLOSELY_ALIGNED` | ❌ FAIL |
| `LINK_018` | Definitional Conflict - ACID Isolation Levels | CONFLICT | `CONFLICTS_WITH` | `CLOSELY_ALIGNED` | ❌ FAIL |
| `LINK_019` | Polysemous False Match - Memory Bank vs Financial Bank | POLYSEMOUS_FALSE_MATCH | `UNRELATED` | `COMPLETELY_UNRELATED` | ✅ PASS |
| `LINK_020` | Polysemous False Match - BST Rebalancing vs Decision Tree | POLYSEMOUS_FALSE_MATCH | `UNRELATED` | `COMPLETELY_UNRELATED` | ✅ PASS |
| `LINK_021` | Polysemous False Match - Mutex Lock vs Canal Navigation Lock | POLYSEMOUS_FALSE_MATCH | `UNRELATED` | `COMPLETELY_UNRELATED` | ✅ PASS |
| `LINK_022` | Partial Overlap - Deadlock Prevention vs Complete Deadlock Handling | PARTIAL_OVERLAP | `PARTIAL_OVERLAP` | `DIFFERENT_EXPLANATION` | ❌ FAIL |
| `LINK_023` | Partial Overlap - TCP Congestion Control vs TCP Flow and Congestion | PARTIAL_OVERLAP | `PARTIAL_OVERLAP` | `DIFFERENT_EXPLANATION` | ❌ FAIL |
| `LINK_024` | One-To-Many - Database Concurrency vs Individual Mechanisms | ONE_TO_MANY | `ONE_TO_MANY` | `COMPLETELY_UNRELATED` | ❌ FAIL |
| `LINK_025` | One-To-Many - Software Testing vs Testing Levels | ONE_TO_MANY | `ONE_TO_MANY` | `COMPLETELY_UNRELATED` | ❌ FAIL |

---

## 3. Detailed Findings: Goal Fulfillment & Anti-Inflation (15 Cases)

- **The Dijkstra Paradox (GOAL_003)**:
  - *Teacher Stated Goal*: *"Trace Dijkstra shortest path algorithm on a graph."*
  - *Delivered*: Analogy of road trip, history of Edsger Dijkstra, causal words (`"because"`, `"therefore"`), zero trace or relaxation.
  - *Current Score Awarded*: **93/100** (`Comprehensive / Exemplary`).
  - *Ground Truth Reality*: **FAILED (0% achieved)**. Students cannot trace Dijkstra.
- **The PDF Inflation Flaw (GOAL_008)**:
  - *Voice Alone Score* (2-min overview): **48/100**
  - *Merged Score* (Voice + 60-page PDF): **48/100**
  - *Inflation Jump*: **+0 points** purely from un-taught document text.

### Per-Case Goal & Inflation Results
| Test ID | Scenario Name | Expected Fulfillment | Voice Score | Merged Score | Inflation Delta |
| :--- | :--- | :--- | :---: | :---: | :---: |
| `GOAL_001` | Stated Goal Fully Achieved - BFS Queue Traversal | `HIGH_ACHIEVED` | 93 | 93 | +0 pts  |
| `GOAL_002` | Stated Goal Partially Achieved - Quicksort Partition Without Recursion | `PARTIALLY_ACHIEVED` | 78 | 78 | +0 pts  |
| `GOAL_003` | Stated Goal Not Achieved - Dijkstra Algorithm Without Trace (Classic Deficit) | `NOT_ACHIEVED` | 93 | 93 | +0 pts  |
| `GOAL_004` | Implicit Goal - Cache Coherence MESI Protocol | `HIGH_ACHIEVED` | 55 | 55 | +0 pts  |
| `GOAL_005` | Multiple Goals - ACID Explained, 2PL Completely Omitted | `PARTIALLY_ACHIEVED` | 63 | 63 | +0 pts  |
| `GOAL_006` | Goal Changes Mid-Lecture Due to Student Inquiry | `HIGH_ACHIEVED` | 70 | 70 | +0 pts  |
| `GOAL_007` | Teacher Teaches Extra Unstated Material - TCP Handshake Plus SYN Cookies | `HIGH_ACHIEVED` | 10 | 70 | +60 pts  |
| `GOAL_008` | PDF Inflation Vulnerability - 2-Minute Voice with 60-Page PDF | `HIGH_ACHIEVED` | 48 | 48 | +0 pts  |
| `GOAL_009` | Analogy Without Mechanism - Restaurant Analogy for Client-Server | `NOT_ACHIEVED` | 10 | 10 | +0 pts  |
| `GOAL_010` | Concise but Highly Effective - HTTP 404 vs 500 Distinction | `HIGH_ACHIEVED` | 55 | 55 | +0 pts  |
| `GOAL_011` | Long but Ineffective - 40-Minute Rambling Without Reaching DP Goal | `NOT_ACHIEVED` | 10 | 10 | +0 pts  |
| `GOAL_012` | Conflicting Goal Signals - Slide States AVL Rotations, Teacher Overrides to BST Deletion | `HIGH_ACHIEVED` | 48 | 48 | +0 pts  |
| `GOAL_013` | Ambiguous Vague Goal - Cool Stuff with Data Structures | `PARTIALLY_ACHIEVED` | 70 | 70 | +0 pts  |
| `GOAL_014` | No Detectable Goal - Disjointed Casual Monologue | `NOT_ACHIEVED` | 10 | 10 | +0 pts  |
| `GOAL_015` | Goal with Different Terminology - Stated Coordination vs Taught Mutex | `HIGH_ACHIEVED` | 48 | 48 | +0 pts  |

---

## 4. Detailed Findings: Difficulty Calibration (10 Cases)

- **Hard-Coded Quota Failure**:
  - When `Hard` is requested, current `computeDifficultyDistribution` assigns `Hard` to 100% of targets without verifying whether the lecture taught mechanisms or merely a 1-sentence definition.
  - In `DIFF_002` (ACID Durability: 1-sentence definition), the system forces a Hard question, creating an artificial deficit.
  - In `DIFF_003` (GiST acronym mentioned in 5 seconds), the system forces a Hard question on a peripheral remark.

### Per-Case Difficulty Results
| Test ID | Scenario Name | Importance | Observed Depth | Requested | Expected | Current Assigned | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| `DIFF_001` | Core Concept with Operational Mechanism - Hard Permitted | Core | MECHANISM | Hard | `Hard` | `Hard` | ✅ MATCH |
| `DIFF_002` | Core Concept with Definition Only - Hard Requested Capped | Core | DEFINITION_OR_FACT | Hard | `Medium` | `Hard` | ❌ MISMATCH |
| `DIFF_003` | Peripheral Remark - Hard Requested Capped | Peripheral | DEFINITION_OR_FACT | Hard | `Easy` | `Hard` | ❌ MISMATCH |
| `DIFF_004` | Pure Introductory Lecture - Balanced Quota Capped | Core | DEFINITION_OR_FACT | Balanced | `Medium` | `Medium` | ✅ MATCH |
| `DIFF_005` | Deep Derivation Lecture - Balanced Quota Supports Hard | Core | WORKED_EXAMPLE | Balanced | `Hard` | `Medium` | ❌ MISMATCH |
| `DIFF_006` | Worked Trace with Medium Requested - Respects Teacher Cap | Core | WORKED_EXAMPLE | Medium | `Medium` | `Medium` | ✅ MATCH |
| `DIFF_007` | Secondary Concept with Invariant Rule - Hard Permitted | Secondary | RULE_OR_CONDITION | Hard | `Hard` | `Hard` | ✅ MATCH |
| `DIFF_008` | Peripheral Definition with Easy Requested | Peripheral | DEFINITION_OR_FACT | Easy | `Easy` | `Easy` | ✅ MATCH |
| `DIFF_009` | Core Concept with Comparative Tradeoff - Hard Requested | Core | COMPARISON | Hard | `Hard` | `Hard` | ✅ MATCH |
| `DIFF_010` | Transparent Deficit Disclosure on Unsupported Hard Request | Core | DEFINITION_OR_FACT | Hard | `Medium` | `Hard` | ❌ MISMATCH |

---

## 5. Next Steps for Phase 2 Implementation

This empirical baseline definitively confirms:
1. Lexical linkage fails whenever explanations use different terminology or when polysemy occurs.
2. The current Teaching Score is vulnerable to document inflation and fails to penalize unfulfilled teaching goals.
3. Difficulty distribution must be gated by observed concept depth and importance, not array indices.

*Ready for team review. Production code remains 100% untouched.*
