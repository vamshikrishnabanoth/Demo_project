# Milestone v3.6 Phase 7.4: Candidate Prompt Intervention v1.2.0 Specification

**Document Version:** `candidate-prompt-v1.2.0-frozen`  
**Preceding Baseline:** `P5.3 baseline` in [`experiments/experiment_5_teaching_adequacy/runner/p5_3_coverage_gap_analyzer.js`](file:///c:/Users/samanvi/OneDrive/Desktop/git_kahoot/Demo_project/experiments/experiment_5_teaching_adequacy/runner/p5_3_coverage_gap_analyzer.js)  
**Preceding Rejected Candidate:** `candidate-prompt-v1.1.0` in [`candidate_prompt_intervention_v1_1_0.md`](file:///c:/Users/samanvi/OneDrive/Desktop/git_kahoot/Demo_project/experiments/experiment_5_teaching_adequacy/dev_2a/candidate_interventions/candidate_prompt_intervention_v1_1_0.md)  
**Timestamp:** `2026-10-02T21:15:00Z`  
**Status:** Frozen Prior to Phase 7.4 Model Calls  
**Milestone:** Milestone v3.6 Phase 7.4 (Track 2: Anchor Investigation)

---

## 1. Executive Summary & Root-Cause Hypotheses Addressed

In Phase 7.1, textual forensic audits of the three Phase 6 regressions (1B, 2B, 4B) proved that candidate `v1.1.0` failed because the generic 0–8 scale anchors at the top of the prompt exerted a gravitational pull that overrode the domain translation guidance located at the bottom of the prompt:
1. **Logic Semantics (Case 1B):** The generic Level 4 scale anchor explicitly required *"Dynamic interaction between two or more components, state transitions, or feedback flows"*. Because model-theoretic domain valuations lack runtime dynamic feedback, the model categorized them as an *"operational mapping"* and capped depth at Level 3.
2. **Pharmacology Mechanism (Case 2B):** The generic Level 5 scale anchor explicitly demanded *"Step-by-step mathematical proof, algebraic derivation"*. The model penalized physiological clearance ($CL = Q \times E$) for lacking algebraic derivation, while upstream P5.2A partitioned the concepts away from `JUSTIFICATION_WHY`.
3. **DSP Structural Primitives (Case 4B):** The generic scale anchors lacked recognition that complete foundational constituent primitives and structural blueprints satisfy Level 5 `STRUCTURE_COMPONENTS` on structural specification alone.

### Candidate v1.2.0 Core Adjustments:
- **P5.3-Only Scope:** Under Phase 7.4 Condition 1, candidate `v1.2.0` modifies P5.3 ONLY. P5.2A remains 100% frozen.
- **Top-Level Anchor Reconciliation:** Directly reconciles the generic Level 4 and Level 5 scale anchor definitions with formal model theory, physiological mechanisms, and static structural blueprints.
- **Explicit Level-Selection Rule (Level 4 vs. Level 5):** Establishes an unambiguous, pre-declared rule for structural components:
  * *Level 2 (Parameter Roster):* Itemized parameter rosters, scalar glossaries, or tuning bounds without structural composition ($T_s, f_s, N, \Delta f$).
  * *Level 4 (Partial Structure):* Difference equations or partial operator mentions without complete hardware constituent composition.
  * *Level 5 (Complete Architectural Primitives):* Complete foundational structural blueprints and operator compositions (e.g., tapped delay line registers $z^{-1}$ + coefficient multipliers + adder tree; or Vandermonde basis matrix $W_N$ + projection + inverse reconstruction) satisfy Level 5 on structural specification alone.
- **Upstream Extraction Limitation Explicitly Handled:** Documents that if Segment 2B remains under-scored due to zero concepts in `JUSTIFICATION_WHY`, it represents an upstream extraction limitation rather than a P5.3 reasoning error.

---

## 2. Verbatim Diff: Baseline P5.3 vs. Candidate P5.3 v1.2.0

```diff
 RULES:
 1. Preserve expected_depth and alignment_tier from P5.1 exactly.
 2. Estimate observed_depth (0-8) independently from the observed concepts/episodes using this calibrated scale:
    - Level 0 (Absent): Completely absent from the instructional record.
    - Level 1 (Passing Mention / Nominal Reference): Surface-level naming, passing keyword mention, single-sentence disclaimer, or brief limitation note without operational explanation. (E.g., merely stating "this assumes fixed resources" or naming an edge case in half a sentence).
    - Level 2 (Static Definition / Description): Formal definition of terminology, statutory text, or descriptive property summary without dynamic cause-and-effect.
    - Level 3 (Univariate Operational Step): Explicitly explained operational step, single cause-and-effect relationship, or sequential procedural rule.
-   - Level 4 (Systemic Interaction / Multi-Variable Dynamics): Dynamic interaction between two or more components, state transitions, or feedback flows.
-   - Level 5 (Substantive Derivation / Formal Proof / Rationale): Step-by-step mathematical proof, algebraic derivation, formal invariant maintenance, or causal necessity argument. (Reciting a formula without derivation is Level 1-2).
+   - Level 4 (Systemic Interaction / Multi-Variable Dynamics / Semantic Models): Dynamic interaction between two or more components, state transitions, or feedback flows; or formal model-theoretic truth valuation across domain elements (e.g., concrete interpretations, countermodel witnesses). (For structure, partial structural descriptions without complete blueprints are Level 4).
+   - Level 5 (Substantive Derivation / Formal Proof / Causal Mechanism / Architectural Primitives): Step-by-step mathematical proof, formal derivation, substantive causal mechanism (e.g., physiological organ clearance Q*E, cellular transport biology), or complete architectural constituent primitives (e.g., Vandermonde basis matrix, tapped delay registers with multiplier/adder tree). Closed-form algebraic equation manipulations without underlying mechanism are capped at Level 4. (Reciting a formula without derivation or mechanism is Level 1-2).
    - Level 6 (Worked Execution / Concrete Problem Trace): Complete numerical problem solved step-by-step, code trace with concrete memory states, or detailed comparative case analysis.
    - Level 7 (Substantive Boundary Analysis / Pathological Cases): In-depth stress-testing of limitations, failure modes, counterexamples, or boundary breakdown under pathological inputs.
    - Level 8 (Cross-Domain Transfer / Novel Synthesis): Synthesis across disparate fields, novel problem design, or long-term multi-domain transfer.

 DOMAIN TRANSLATION GUIDANCE (Applying the 8 Dimensions across Disciplines):
 - In Law & Humanities:
   * STRUCTURE_COMPONENTS: Specific statutory clauses, constitutional textual phrases (e.g., "procedure established by law" vs "due process"), or formal structural provisions.
   * RELATIONSHIPS_MECHANISM: Legal and constitutional doctrines governing inter-clause operations (e.g., the "Golden Triangle" doctrine coordinating Arts 14, 19, and 21).
   * JUSTIFICATION_WHY: Philosophical, historical, or normative necessity rationales (e.g., natural justice principles and anti-arbitrariness tests).
   * APPLICATION_INTERPRETATION: Comparative analysis of real case law precedents (e.g., tracing facts, conflicting doctrines, and holdings across Gopalan vs Maneka Gandhi reaches Level 6 worked case analysis).
 - In Mathematics, CS & Science:
+  * MEANING: Conceptual definition, model-theoretic domain semantics, or semantic truth valuations (e.g., evaluating quantifiers over universe elements, concrete countermodels) satisfy Level 4 MEANING. Syntactic manipulation rules or theorem naming without domain interpretation remain Level 2. (Foundational meta-theoretic proofs belong to JUSTIFICATION_WHY).
   * STRUCTURE_COMPONENTS: Primitives, variables, data structures, or formal terms (e.g., queue, visited set, adjacency list).
+    - Level-Selection Rule for Structure:
+      * Level 2 (Parameter Roster): Itemized parameter rosters, scalar glossaries, or tuning bounds without structural composition (e.g., Ts, fs, N, delta_f).
+      * Level 4 (Partial/Algebraic Structure): Mathematical difference equations or partial operator definitions without complete constituent hardware realization.
+      * Level 5 (Architectural Constituent Primitives): Complete foundational structural blueprints and operator compositions (e.g., tapped delay line registers z^-1, multiplier banks, and adder tree; or Vandermonde basis matrix W_N, projection, and inverse reconstruction) satisfy Level 5 on structural specification alone, without requiring runtime dynamic signal simulation (which belongs to RELATIONSHIPS_MECHANISM).
   * RELATIONSHIPS_MECHANISM: Dynamic interaction between data structures or variables (e.g., how dequeue operations update the visited set to maintain state; or how reconstruction loss balances KL regularizer).
   * JUSTIFICATION_WHY: Step-by-step mathematical proof, theoretical rationale, or causal biological/physical mechanism. (Simply stating "eigenvalues are useful for stability" without derivation is Level 1-2; formal derivations reach Level 5).
+    - In Applied, Biological & Physical Sciences: Level 5 strictly requires causal physical, anatomical, or cellular mechanisms (e.g., organ blood flow Q, capillary extraction ratio E, active cellular transporters OAT/OCT, filtration barriers). Deriving formulas purely through algebraic parameter rearrangement (CL = ke * Vd, CL_R = U * V / P) without cellular/tissue mechanisms is a formal identity capped at Level 4 (FORMAL_MATHEMATICAL_IDENTITY).
   * APPLICATION_INTERPRETATION:
     - In Conceptual lectures: Worked numerical calculation, visual graph layer traversal, or qualitative state tracing reaches Level 5-6.
     - In Implementation lectures (where the learning objective explicitly demands code implementation): A whiteboard graph trace without code reaches Level 5 (conceptual trace); Level 6 strictly requires concrete code execution, syntax, or implementation-level trace.
+    - In Clinical & Applied Problem Solving: Conversational bedside estimates and verbal rules-of-thumb without intermediate state calculation (e.g., rough mental multiplication, informal rate guidelines) are Level 3/4 (INFORMAL_CLINICAL_ESTIMATION). Reaching Level 6 (RIGOROUS_STEPWISE_EXECUTION_TRACE) strictly requires >= 3 sequentially chained computational steps with explicit intermediate numerical states, units, and validation (e.g., body weight adjustments, commercial vial rounding, or nomogram lookup).

 ANTI-OVERCREDITING INVARIANTS:
 - Passing Disclaimers vs Deep Instruction: Brief verbal disclaimers or passing limitation statements (e.g., "banker's algorithm assumes fixed resources", "in reality this has edge cases") MUST be scored at Level 1, NEVER Level 4+.
- - Stating vs Deriving: Simply stating or displaying a formula/theorem is Level 1-2. Level 5 requires step-by-step analytical proof, derivation, or substantive rationale.
+ - Stating vs Deriving: Simply stating or displaying a formula/theorem is Level 1-2. Level 5 requires step-by-step analytical proof, derivation, or substantive causal mechanism.
 - High-Level Mention vs Worked Trace: Describing an algorithm in broad terms is Level 2-3. Level 6 requires a worked numerical, code, or concrete state execution trace.
+ - Static Primitives vs Dynamic Simulation: Structural constituent primitives satisfy Level 4-5 in STRUCTURE_COMPONENTS on structural specification alone, without requiring dynamic execution or temporal state changes.
+ - Algebraic Derivation vs Causal Mechanism: In physical and biological sciences, algebraic parameter manipulation is capped at Level 4; Level 5 requires causal biological/physical mechanism.
+ - Bedside Estimation vs Chained Execution: Single-step mental multiplication or verbal clinical rules of thumb are capped at Level 3-4; Level 6 requires >= 3 sequentially chained calculation steps.
```
