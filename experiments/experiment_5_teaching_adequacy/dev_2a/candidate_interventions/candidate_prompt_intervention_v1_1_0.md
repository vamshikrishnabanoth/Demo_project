# Milestone v3.6 Step 2A — Phase 5C: Candidate Prompt Intervention Specification

**Document Version:** `candidate-prompt-v1.1.0`  
**Preceding Baseline:** `P5.3 baseline` in [`experiments/experiment_5_teaching_adequacy/runner/p5_3_coverage_gap_analyzer.js`](file:///c:/Users/samanvi/OneDrive/Desktop/git_kahoot/Demo_project/experiments/experiment_5_teaching_adequacy/runner/p5_3_coverage_gap_analyzer.js) (unmodified)  
**Timestamp:** `2026-10-02T10:35:00Z`  
**Status:** Cryptographically Frozen Prior to Phase 6 Paired Model Evaluation  
**Milestone:** Milestone v3.6 Step 2A (Diagnostic Investigation — Phase 5C Intervention Freeze)

---

## 1. Executive Summary & Design Principles

Phase 5C formalizes targeted prompt refinements addressing the empirical root causes identified in Phase 4 and codified in Rubric `v1.1.0-frozen` ([`dev_2a/step2a_error_operationalization_rubrics_v1_1_0.md`](file:///c:/Users/samanvi/OneDrive/Desktop/git_kahoot/Demo_project/experiments/experiment_5_teaching_adequacy/dev_2a/step2a_error_operationalization_rubrics_v1_1_0.md)).

### Core Invariants:
1. **Baseline Preservation:** The baseline system prompt and execution pipeline in [`runner/p5_3_coverage_gap_analyzer.js`](file:///c:/Users/samanvi/OneDrive/Desktop/git_kahoot/Demo_project/experiments/experiment_5_teaching_adequacy/runner/p5_3_coverage_gap_analyzer.js) remains **100% unaltered**.
2. **Targeted Calibration (Not Generic Loosening):** Refinements do not inflate scores globally. They provide explicit boundary criteria distinguishing:
   - Model-theoretic domain semantics from syntactic symbol deduction (Pattern 1).
   - Causal biological/physiological transport mechanisms from algebraic parameter manipulations (Pattern 2).
   - Rigorous multi-step chained calculation traces from conversational bedside estimation (Pattern 3).
   - Foundational structural operator/hardware primitives from itemized parameter rosters (Pattern 4).
3. **Decoupled Verification:** Phase 5B human rubric adjudication ([`validation_adjudication_summary.json`](file:///c:/Users/samanvi/OneDrive/Desktop/git_kahoot/Demo_project/experiments/experiment_5_teaching_adequacy/dev_2a/validation_adjudication_summary.json), SHA-256: `611df7a9b51c1bb0cfd4cfa3af339eb8bf5cb1f6814914c6071d446c3a21fe74`) was completed and sealed prior to running Phase 6 evaluations.

---

## 2. Summary of Targeted Refinements

| Failure Pattern & Focus | Specific Candidate Prompt Refinement | Target Epistemic Dimension |
| :--- | :--- | :--- |
| **Pattern 1: Logic Semantics** (`dev_2a_01`) | **Epistemic Mapping Rule:** Clarifies that conceptual exposition of domain interpretations, model-theoretic truth valuations over universes of discourse ($D$), and concrete countermodels map to `MEANING` (Level 4), whereas pure syntactic symbol rewriting remains Level 2. (Foundational meta-theoretic proofs belong to `JUSTIFICATION_WHY`). | `MEANING` |
| **Pattern 2: PK Clearance Mechanism** (`dev_2a_02`) | **Empirical Causal Mechanism Invariant:** Clarifies that in applied, biological, and physical sciences, Level 5 strictly requires causal physical, anatomical, or cellular mechanisms ($CL = Q \cdot E$, carrier transporters OAT/OCT, filtration barriers). Closed-form algebraic parameter manipulations ($CL = k_e V_d$, $CL_R = U \cdot V / P$) are capped at Level 4 (`FORMAL_MATHEMATICAL_IDENTITY`). | `JUSTIFICATION_WHY` |
| **Pattern 3: Clinical Dosing Walkthrough** (`dev_2a_03`) | **Chained Calculation Trace Invariant:** Clarifies that conversational bedside approximations, mental arithmetic, and verbal rate rules-of-thumb without intermediate state calculation are Level 3/4 (`INFORMAL_CLINICAL_ESTIMATION`). Level 6 (`RIGOROUS_STEPWISE_EXECUTION_TRACE`) strictly requires $\ge 3$ sequentially chained computational steps with explicit intermediate numerical states, units, and validation against clinical dosage forms or nomograms. | `APPLICATION_INTERPRETATION` |
| **Pattern 4: DSP Transforms & Primitives** (`dev_2a_04`) | **Scale-Dimension Tension Invariant:** Resolves the contradiction between the generic Level 4 scale anchor (which demanded dynamic interaction) and `STRUCTURE_COMPONENTS`. Clarifies that static architectural constituent primitives, basis function matrices, and hardware block diagrams satisfy Level 4/5 `STRUCTURE_COMPONENTS` on structural specification alone, without requiring runtime dynamic signal simulation. | `STRUCTURE_COMPONENTS` |

---

## 3. Verbatim Prompt Diffs (Baseline vs. Candidate)

### 3.1 P5.2A Concept Reconstructor Additions
```diff
 UNIVERSAL EPISTEMIC DIMENSIONS:
 Classify each concept by its primary epistemic dimension:
 - IDENTIFICATION: Naming, statutory/formal notation, terminology, identification of key entities.
-- MEANING: Conceptual definition, qualitative intuition, core significance.
-- STRUCTURE_COMPONENTS: Structural parts, parameters, clauses, data structures, constituent elements.
+- MEANING: Conceptual definition, qualitative intuition, core significance, model-theoretic domain semantics (evaluating truth conditions over domain elements or countermodels).
+- STRUCTURE_COMPONENTS: Structural parts, parameters, clauses, data structures, constituent elements, architectural operator/hardware primitives.
 - RELATIONSHIPS_MECHANISM: Dynamic interaction, execution flow, procedural sequence, mutual relationships.
-- JUSTIFICATION_WHY: Underlying theoretical rationale, formal proof, constitutional purpose, why it holds against alternatives.
+- JUSTIFICATION_WHY: Underlying theoretical rationale, formal proof, foundational theorems, causal biological/physical mechanism, constitutional purpose.
 - APPLICATION_INTERPRETATION: Concrete worked problem, practical scenario, judicial precedent application, execution trace.
```

### 3.2 P5.3 Coverage Gap Analyzer Additions
```diff
 DOMAIN TRANSLATION GUIDANCE (Applying the 8 Dimensions across Disciplines):
 - In Mathematics, CS & Science:
+  * MEANING: Conceptual definition, model-theoretic domain semantics, or semantic truth valuations (e.g., evaluating quantifiers over universe elements, concrete countermodels). Syntactic manipulation rules or theorem naming without domain interpretation is Level 2. (Foundational meta-theoretic proofs belong to JUSTIFICATION_WHY).
   * STRUCTURE_COMPONENTS: Primitives, variables, data structures, or formal terms (e.g., queue, visited set, adjacency list).
+    - Scale-Dimension Invariant: Foundational constituent primitives, operator matrices, and architectural block diagrams (e.g., tapped delay line z^-1, multipliers, adder tree, or Vandermonde basis matrix) satisfy Level 4-5 STRUCTURE_COMPONENTS on structural specification alone, without requiring runtime dynamic signal simulation or temporal interactions (which belong to RELATIONSHIPS_MECHANISM). Itemized parameter rosters, variable glossaries, or tuning bounds without structural decomposition remain Level 2.
   * RELATIONSHIPS_MECHANISM: Dynamic interaction between data structures or variables (e.g., how dequeue operations update the visited set to maintain state; or how reconstruction loss balances KL regularizer).
   * JUSTIFICATION_WHY: Step-by-step mathematical proof or theoretical rationale (e.g., deriving det(A - lambda I) = 0 or proving why visited sets prevent cycles). Simply stating "eigenvalues are useful for stability" without derivation is Level 1-2; formal derivations reach Level 5.
+    - In Applied, Biological & Physical Sciences: Level 5 strictly requires causal physical, anatomical, or cellular mechanisms (e.g., organ blood flow Q, capillary extraction ratio E, active cellular transporters OAT/OCT, filtration barriers). Deriving formulas purely through algebraic parameter rearrangement (CL = ke * Vd, CL_R = U * V / P) is a formal mathematical identity capped at Level 4 (FORMAL_MATHEMATICAL_IDENTITY).
   * APPLICATION_INTERPRETATION:
     - In Conceptual lectures: Worked numerical calculation, visual graph layer traversal, or qualitative state tracing reaches Level 5-6.
     - In Implementation lectures (where the learning objective explicitly demands code implementation): A whiteboard graph trace without code reaches Level 5 (conceptual trace); Level 6 strictly requires concrete code execution, syntax, or implementation-level trace.
+    - In Clinical & Applied Problem Solving: Conversational bedside estimates and verbal rules-of-thumb without intermediate state calculation (e.g., rough mental multiplication, informal rate guidelines) are Level 3/4 (INFORMAL_CLINICAL_ESTIMATION). Reaching Level 6 (RIGOROUS_STEPWISE_EXECUTION_TRACE) strictly requires >= 3 sequentially chained computational steps with explicit intermediate numerical states, units, and validation (e.g., body weight adjustments, commercial vial rounding, or nomogram lookup).

 ANTI-OVERCREDITING INVARIANTS:
 - Passing Disclaimers vs Deep Instruction: Brief verbal disclaimers or passing limitation statements (e.g., "banker's algorithm assumes fixed resources", "in reality this has edge cases") MUST be scored at Level 1, NEVER Level 4+.
 - Stating vs Deriving: Simply stating or displaying a formula/theorem is Level 1-2. Level 5 requires step-by-step analytical proof, derivation, or substantive rationale.
 - High-Level Mention vs Worked Trace: Describing an algorithm in broad terms is Level 2-3. Level 6 requires a worked numerical, code, or concrete state execution trace.
+- Static Primitives vs Dynamic Simulation: Structural constituent primitives satisfy Level 4-5 in STRUCTURE_COMPONENTS without requiring dynamic execution or temporal state changes.
+- Algebraic Derivation vs Causal Mechanism: In physical and biological sciences, algebraic parameter manipulation is capped at Level 4; Level 5 requires causal biological/physical mechanism.
+- Bedside Estimation vs Chained Execution: Single-step mental multiplication or verbal clinical rules of thumb are capped at Level 3-4; Level 6 requires >= 3 sequentially chained calculation steps.
```

---

## 4. Predeclared 5-Point Adoption Decision Rule

To ensure objective adoption without post-hoc rationalization, candidate prompt `v1.1.0` must strictly satisfy:

1. **Isolated Segment Evaluation:** Each validation segment (1C–4D) and diagnostic segment (1A–4B) is evaluated individually to avoid multi-segment subsumption artifacts.
2. **Dual Metric Reporting:** Report raw counts and percentages separately for:
   - (a) Exact Depth Concordance with Phase 5B Adjudicated Reference.
   - (b) Boundary Decision Agreement (Correctly categorizing whether depth satisfies or falls short of the target operational threshold).
3. **Mandatory 2/2 Boundary Correctness:** The candidate prompt must achieve **2/2 boundary correctness** on the targeted validation cases for each failure pattern:
   - Pattern 1: 1C falls short of Level 4 semantics, 1D satisfies Level 4 semantics.
   - Pattern 2: 2C falls short of Level 5 mechanism, 2D satisfies Level 5 mechanism.
   - Pattern 3: 3C falls short of Level 6 execution trace, 3D satisfies Level 6 execution trace.
   - Pattern 4: 4C falls short of Level 5 primitives, 4D satisfies Level 5 primitives.
4. **Strict Zero-Regression Gate on Known Diagnostic Cases:** The candidate prompt must **NOT** introduce any misclassification or regression on the 8 previously evaluated diagnostic segments (1A–4B). Any regression on known diagnostic cases triggers immediate **REJECTION**.
5. **Raw Counts Reporting:** All outcomes must be reported as raw counts (e.g., 2/2, 8/8) alongside percentages, explicitly acknowledging sample size limitations.
