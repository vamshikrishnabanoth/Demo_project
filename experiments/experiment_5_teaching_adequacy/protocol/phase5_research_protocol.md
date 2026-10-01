# Phase 5 Research Protocol & Taxonomy Specification: Contextual Teaching Adequacy & Deep Lecture Understanding

**Status:** Frozen Experimental Contract (Officially Frozen)  
**Execution Context:** Strictly Lab-Only (`Demo_project/experiments/experiment_5_teaching_adequacy/`)  
**Production Commit Baseline:** `b1b15535389df45151601a9a39bc3c5d8f46e1f0` (Tag: `v3.4-frozen`)  
**Production Code Modification:** `0 files changed, 0 insertions(+), 0 deletions(-)` (Strict Isolation Verified)  

---

## 1. Executive Summary & Research Motivation

Phases 3 and 4 successfully validated the mechanics of automated question generation—achieving deterministic evidence grounding (Phase 3.1), calibrated difficulty (Phase 3.2), distractor exclusivity (Phase 3.3), and answer-key balance (Phase 3.4)—while demonstrating in Phase 4 that behavioral conditioning primarily impacts assessment planning (Agent 1 target selection) without destabilizing downstream generation (Agent 2).

However, a fundamental pedagogical layer connecting lecture delivery to assessment remains unaddressed:
> **Overarching Research Inquiry:**  
> *Given a lecture topic and its intended learning objective, can the system reconstruct what was taught, estimate the depth reached for each relevant concept, distinguish adequate coverage from permissible omissions, identify meaningful coverage gaps, and use that understanding to generate appropriately difficult assessments?*

Historically, educational technology systems have attempted to quantify teaching quality by tallying surface artifacts (+10 for code, +10 for diagrams, +10 for formulas). This measures **superficial props**, not pedagogical substance. A lecture may display code and diagrams while presenting an incoherent argument, whereas another lecture may use pure Socratic dialogue or chalkboard derivations to deliver profound conceptual understanding.

Phase 5 establishes a **domain-agnostic, evidence-grounded, objective-conditioned, and semantic reasoning architecture** to evaluate teaching adequacy and guide assessment. It is framed as a **heterogeneous cross-domain pilot** across six distinct academic disciplines, evaluated entirely in lab isolation outside production.

---

## 2. Architectural Pipeline & Research Questions (RQ1–RQ4)

To prevent monolithic composite scores and enforce scientific rigor, Phase 5 models lecture understanding through two parallel empirical tracks—normative requirements and observational reconstruction—which converge in adequacy diagnosis:

```
                    PHASE 5 CONCEPTUAL ARCHITECTURE

             TOPIC + OBJECTIVE + SYLLABUS + LEARNER LEVEL
                           │
                           ▼
                    ┌─────────────┐
                    │     RQ2     │
                    │ What SHOULD │
                    │ be taught?  │
                    └──────┬──────┘
                           │
                           │ normative profile
                           │
                           ▼
LECTURE ──► RQ1A ──► RQ1B ──► OBSERVED TEACHING
Evidence     │          │     (Reconstructed Concepts,
             └──────────┘      Episodes & Revisitations)
                    │
                    ▼
             ┌─────────────┐
             │     RQ3     │
             │ SHOULD vs   │
             │ OBSERVED    │
             └──────┬──────┘
                    │
                    ▼
             DIAGNOSTIC MATRIX
             (Covered / Partial / Gaps / Permissible)
                    │
                    ▼
             ┌─────────────┐
             │     RQ4     │
             │ Assessment  │
             │ Consequence │
             └──────┬──────┘
                    │
                    ▼
             FROZEN PHASE 3 ENGINE
             (Grounding & Determinism)
```

### The Four Central Research Questions
* **RQ1 — Topic & Progression Reconstruction:**
  * **RQ1A (Concept Reconstruction):** Can the system accurately identify the technical concepts and sub-concepts actually addressed in a lecture, adhering to an explicit concept-unit granularity policy?
  * **RQ1B (Instructional Episode Reconstruction):** Can the system reconstruct the chronological progression of instructional episodes, identifying dominant intellectual activities and explicitly capturing **concept revisitations** across non-linear teaching trajectories?
* **RQ2 — Normative Expected Depth:**
  * Given a topic, declared learning objective, syllabus context, and learner level, can the system construct an expected depth profile that agrees with an independently adjudicated, blinded human expert normative reference without relying on circular LLM-as-judge assumptions?
* **RQ3 — Teaching Adequacy & Coverage Gap Diagnosis:**
  * Can the system accurately evaluate observed teaching evidence against the normative profile to distinguish adequately taught concepts, partially taught concepts, unobserved concepts (`NOT_OBSERVED`), unresolvable audio/visual segments (`INSUFFICIENT_EVIDENCE`), permissible omissions (`PERMISSIBLE_SCOPE_OMISSION`), and actionable coverage gaps (`ACTIONABLE_COVERAGE_GAP`)?
* **RQ4 — Assessment Consequence & Cognitive Demand:**
  * Does this contextual teaching understanding lead to cognitive-demand-appropriate assessment targets and distractor sophistication without compromising Phase 3 grounding, single-key determinism, or balanced answer distribution?

---

## 3. Universal Epistemic Depth Dimensions & Operational Anchors

### 3.1 Non-Linear Independence
The 8 dimensions defined below serve as an **expressive reference vocabulary of epistemic dimensions**, not a rigid staircase through which every concept must climb.
* Reaching Level 5 in *Justification* does not imply or require that a concept traversed all preceding levels.
* Each dimension is evaluated independently with its own expected depth, observed depth, confidence rating, educational rationale, and objective alignment tier.

```
                    EPISTEMIC DEPTH DIMENSIONS
  
   IDENTIFICATION          MEANING
   STRUCTURE_COMPONENTS    RELATIONSHIPS_MECHANISM
   JUSTIFICATION_WHY       APPLICATION_INTERPRETATION
   BOUNDARIES_EXCEPTIONS   TRANSFER_SYNTHESIS
  
   Each dimension independently receives:
   [Expected Depth | Observed Depth | Confidence | Rationale | Status]
```

### 3.2 Operational Depth Anchors (Levels 0–8)
To prevent subjective or uncalibrated depth assignment by both human annotators and automated models, each dimension is evaluated against explicit operational criteria:

| Level | Operational Criterion Across Epistemic Dimensions |
|:---:|---|
| **0** | **No Observable Evidence:** The dimension is completely absent from the instructional record. |
| **1** | **Nominal Recognition / Mention:** The concept/dimension is merely named, stated as a term, or labeled without conceptual definition. |
| **2** | **Surface Description / Core Definition:** A basic qualitative definition, primary assertion, or intuitive description is stated. |
| **3** | **Univariate Mechanism / Structured Elaboration:** The internal components, basic steps, or direct causal sequence are explicitly articulated. |
| **4** | **Systemic Interaction / Dynamic Operational Flow:** How components interact dynamically under operational conditions; intermediate execution states or inter-clause relationships are detailed. |
| **5** | **Formal Derivation / Foundational Justification:** Rigorous explanation of *why* the concept holds; mathematical proof, theoretical necessity, or constitutional purpose established against alternatives. |
| **6** | **Concrete Application / Worked Interpretation:** Comprehensive application to a complete practical problem, non-trivial worked execution trace, or judicial case-precedent analysis. |
| **7** | **Boundary Evaluation / Failure-Mode Analysis:** Explicit examination of edge cases, invariant breakdowns, constitutional limitations, or algorithmic failure modes. |
| **8** | **Cross-Domain Synthesis / Generalization:** Transfer of the concept to novel problem constraints, counterfactual scenarios, or synthesis with disparate domain frameworks. |

---

## 4. Intellectual Activities vs. Interaction Dynamics

Phase 5 strictly decouples cognitive work from classroom dialogue dynamics:

### 4.1 Intellectual Activities (The Cognitive Work)
1. **`EXPLAIN`:** Articulating conceptual definitions, intuition, or background principles.
2. **`COMPARE`:** Contrasting two or more mechanisms, theories, frameworks, or trade-offs.
3. **`DERIVE`:** Step-by-step mathematical proof, logical deduction, or formal derivation.
4. **`TRACE`:** Chronological execution walkthrough of an algorithm, process, or legal precedent.
5. **`APPLY`:** Calculating a concrete problem, interpreting a scenario, or demonstrating execution.
6. **`JUSTIFY`:** Establishing underlying theoretical rationale, constitutional purpose, or motivation.
7. **`LIMIT`:** Identifying boundary conditions, edge cases, failure modes, or exceptions.
8. **`GENERALIZE`:** Synthesizing abstract theorems, high-level architectures, or transferable rules.

### 4.2 Interaction Modes (The Classroom Dynamics)
1. **`LECTURE_MONOLOGUE`:** Uninterrupted exposition by the primary instructor.
2. **`QUESTION_ANSWER`:** Instructor poses a rhetorical or direct query to students.
3. **`STUDENT_RESPONSE`:** Explicit student dialogue, question, or verbal feedback.
4. **`STUDENT_TASK`:** In-class student exercise, polling, or independent problem solving.
5. **`SOCRATIC_DISCUSSION`:** Collaborative dialogue leading to a conceptual conclusion.
6. **`LIVE_DEMONSTRATION`:** Real-time software terminal, physical laboratory apparatus, or slide walkthrough.

---

## 5. Strict Operational Definitions: Observability & Coverage States

To prevent false accusations against instructors and ensure actionable diagnostic reporting, Phase 5 enforces rigorous operational definitions:

```
                            OBSERVATIONAL RECORD
                                      │
                     Is evidence usable and conclusive?
                                     ╱ ╲
                                   YES  NO ──► INSUFFICIENT_EVIDENCE
                                   ╱
                  Was teaching evidence observed?
                                 ╱ ╲
                               YES  NO ──► Was it required for objective?
                               ╱             ╱                      ╲
                       Observed depth?     YES                      NO
                            ╱   ╲           │                        │
                      ≥ Expected < Expected  ▼                        ▼
                          │         │     ACTIONABLE              PERMISSIBLE
                          ▼         ▼     COVERAGE GAP          SCOPE OMISSION
                       COVERED   PARTIAL
```

### 5.1 `NOT_OBSERVED` vs. `INSUFFICIENT_EVIDENCE`
* **`NOT_OBSERVED`:** Usable, clear evidence was present in the instructional record (audible transcript, clear video/slides), but no evidence was found that the specific learning dimension was taught.
* **`INSUFFICIENT_EVIDENCE`:** Deficient, missing, or corrupted observational evidence prevents determining whether the dimension was taught (e.g. inaudible audio dropouts, off-screen whiteboard references, truncated recordings).
* *Negative Standard Rule:* The system is strictly forbidden from reporting a coverage gap if the recording quality is insufficient to determine whether the topic was taught.

### 5.2 `ACTIONABLE_COVERAGE_GAP` vs. `PERMISSIBLE_SCOPE_OMISSION`
* **`ACTIONABLE_COVERAGE_GAP`:** A learning dimension is **required** for the stated learning objective and syllabus context, but was classified as `NOT_OBSERVED` or `PARTIALLY_COVERED`.
* **`PERMISSIBLE_SCOPE_OMISSION`:** A learning dimension is outside the scope of the declared learning objective or syllabus context, and was classified as `NOT_OBSERVED`. Acknowledged as consistent with instructional scope; no penalty issued.

### 5.3 Diagnostic Coverage Matrix (Zero Composite 100-Point Score)
Phase 5 completely eliminates single composite scores. The system outputs a multi-dimensional diagnostic matrix:

```
TOPIC: Indian Constitution — Article 21
STATED OBJECTIVE: Understand the evolution of personal liberty from Gopalan to Maneka Gandhi

Dimension            Expected  Observed  Status             Diagnosis
─────────────────────────────────────────────────────────────────────────────────────────────
MEANING                 4         4      COVERED            Core liberty concepts fully articulated
STRUCTURE_COMPONENTS    4         3      PARTIAL            Due process distinction introduced briefly
JUSTIFICATION_WHY       5         5      COVERED            Constitutional rationale thoroughly justified
APPLICATION_INTERPRET   5         5      COVERED            Maneka Gandhi case analysis deeply explored
BOUNDARIES_EXCEPTIONS   4         0      ACTIONABLE_GAP     Valid state procedure limitations omitted
TRANSFER_SYNTHESIS      2         0      PERMISSIBLE        Novel digital privacy outside today's scope
─────────────────────────────────────────────────────────────────────────────────────────────
Summary Diagnosis:
- Adequately Covered: 3 dimensions (Meaning, Justification, Case Application)
- Partially Covered: 1 dimension (Structural distinction between Procedure vs Due Process)
- Actionable Gaps: 1 dimension (Constitutional limitations and valid state deprivation rules)
- Permissible Omissions: 1 dimension (Digital privacy transfer outside stated introductory objective)
```

---

## 6. Heterogeneous Benchmark Pilot Corpus & Causal Isolation

Phase 5 evaluates six multi-disciplinary lecture packages. The corpus deliberately avoids CS-only assumptions from Day 1 and features an objective-conditioning sensitivity pair (`pkg_03` vs `pkg_04`):

| Package ID | Academic Discipline | Subject Matter | Stated Learning Objective | Provenance Mode |
|---|---|---|---|:---:|
| **`pkg_01`** | Law / Indian Polity | Article 21 & Personal Liberty | Understand evolution of personal liberty (*Gopalan* to *Maneka Gandhi*) | `AUTHENTIC_RECORDING` |
| **`pkg_02`** | Mathematics | Linear Algebra: Eigenvalues | Compute eigenvalues and understand geometric vector transformation | `AUTHENTIC_RECORDING` |
| **`pkg_03`** | Computer Science (Theory) | Breadth-First Search (BFS) | **Conceptual Objective:** Understand queue invariant, level-order expansion, and completeness | `AUTHENTIC_RECORDING` |
| **`pkg_04`** | Computer Science (Applied) | Breadth-First Search (BFS) | **Implementation Objective:** Implement BFS with queue data structure, code trace, and edge cases | `AUTHENTIC_RECORDING` |
| **`pkg_05`** | AI / Machine Learning | Variational Autoencoders | Understand latent modeling, KL regularization, and reparameterization | `AUTHENTIC_RECORDING` |
| **`pkg_06`** | Economics / Social Science | Price Elasticity of Demand | Calculate elasticity, analyze consumer surplus, and evaluate deadweight loss | `AUTHENTIC_RECORDING` |

### Explicit Causal Isolation for the Paired BFS Packages
`pkg_03` and `pkg_04` share **identical underlying BFS transcript evidence**.
* **Causal Isolation Principle:** Observational evidence is held strictly constant; only the declared learning objective and corresponding normative profile differ.
* **Normative Divergence:**
  * In `pkg_03` (Conceptual), `APPLICATION_INTERPRETATION` and `BOUNDARIES_EXCEPTIONS` are assigned expected depth $\le 2$ (`OPTIONAL`/`PERMISSIBLE`).
  * In `pkg_04` (Implementation), `APPLICATION_INTERPRETATION` (concrete code trace) and `BOUNDARIES_EXCEPTIONS` (cyclic/disconnected handling) expand to expected depth $\ge 4$ (`REQUIRED`).
* **Evaluation Objective:** Directly test whether changing only the learning objective alters normative expectations while foundational conceptual expectations remain stable.

---

## 7. Bifurcated Human Ground Truth & Blinding Protocol

To prevent circular evaluation (an LLM generating its own normative expectations and verifying itself), human reference data is bifurcated into two independent files:

```
                             HUMAN EXPERT ADJUDICATION
                                         │
                   ┌─────────────────────┴─────────────────────┐
                   ▼                                           ▼
   NORMATIVE REFERENCE PROFILES               OBSERVATIONAL REFERENCE EVIDENCE
   (normative_reference_profiles.json)        (observational_reference_evidence.json)
   • What SHOULD be taught for objective      • What WAS actually taught in recording
   • Expected dimensions + depth levels       • Actual episode timeline & boundaries
   • Educational rationale & alignment        • Concept revisitations & evidence quotes
   • Independent of lecture execution         • Grounded coverage state & gap critique
```

### Strict Blinding Requirement
* **Blinding Protocol:** Human annotators must not have access to P5.1/P5.2/P5.3 outputs, generated assessment targets, system predictions, or automated evaluation results during initial annotation.
* **Normative Annotation Independence:** For the normative profile specifically, human annotators receive only: $\text{Topic} + \text{Objective} + \text{Syllabus} + \text{Learner Level}$. The human annotator constructs the reference profile completely independently of the system's provisional output.

### Concept-Unit Granularity Policy (RQ1A)
To ensure stable and reproducible concept-level evaluation:
> **Concept-Unit Policy:** *A concept unit is the smallest independently assessable domain proposition required to distinguish one instructional target from another. Parent concepts may contain child concepts, but parent and child units must not be double-counted as independent concepts unless both are independently taught or assessed.*
* Human annotators establish the concept hierarchy first, ensuring unambiguous precision and recall evaluation.

---

## 8. Cognitive Demand Assessment & Calibrated Distractor Modeling

### 8.1 Decoupling Phase 5 Contributions from Phase 3 Invariants
Phase 5 introduces cognitive demand targeting and distractor sophistication, while relying on the frozen Phase 3 engine for downstream execution:

```
┌────────────────────────────────────────────────────────┐
│                   PHASE 5 INTELLECT                     │
│  • Cognitive demand targeting (Easy / Medium / Hard)   │
│  • Distractor misconception calibration (Type A / B)   │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│               PHASE 3 DOWNSTREAM ENGINE                │
│  • Verbatim evidence grounding (M1 = 100%)             │
│  • Single-key determinism (M7 = 100%)                  │
│  • Option exclusivity gate (Zero containment)          │
│  • Answer distribution balance (Spread <= 1)           │
└────────────────────────────────────────────────────────┘
```

### 8.2 Redefining Difficulty as Cognitive Demand
Question difficulty is defined by reasoning complexity, not confusing phrasing:
$$\text{Difficulty} = f(\text{Cognitive Operations}, \text{Reasoning Steps}, \text{Constraint Complexity}, \text{Transfer Distance})$$

* **Easy:** Direct definition recognition, basic conceptual property lookup, single-step trace.
* **Medium:** Multi-step procedural application, mechanism tracing, discriminating between competing sibling principles.
* **Hard:** Boundary failure analysis, edge-case evaluation, structural trade-offs, synthesis under novel constraints.

### 8.3 Distractor Misconception Taxonomy
Every distractor must model a plausible student misconception appropriate to the question's cognitive tier:
* **Type A (Evidence-Backed Misconception):** Derived from lecture dialogue, student questions, or verified curriculum diagnostic research.
* **Type B (Domain-Plausible Misconception):** A logically coherent error derived from common procedural slips, mechanism conflation, or partial execution.
* **Type C (Invalid Distractor):** Grammatical giveaways, illogical nonsense, or ungrounded facts (**Strictly prohibited; rejected by validator**).

---

## 9. Evaluation Metrics & Reporting Standards

Phase 5 replaces arbitrary numerical pass/fail thresholds (e.g., $\ge 80\%$, $\kappa \ge 0.80$) with comprehensive descriptive and distributional reporting:

### 9.1 Human Inter-Annotator Agreement Reporting
* **Categorical / Multi-Label Decisions:** Cohen's $\kappa$ (single-label), Jaccard index (multi-label), and Krippendorff's $\alpha$ across packages and dimensions.
* **Episode Temporal Boundaries:** Precision, Recall, and F1 within temporal tolerance windows of $\pm 5\text{s}$, $\pm 10\text{s}$, and $\pm 15\text{s}$.
* **Continuous Episode Overlap:** Temporal Intersection-over-Union (IoU) across predicted and human-annotated instructional episodes:
  $$\text{IoU} = \frac{|\text{HumanSegment} \cap \text{PredictedSegment}|}{|\text{HumanSegment} \cup \text{PredictedSegment}|}$$

### 9.2 RQ1 Evaluation Metrics (Topic & Episode Reconstruction)
* **RQ1A Concept Reconstruction:** Hierarchical Precision, Recall, and F1 under the Concept-Unit Granularity Policy.
* **RQ1B Episode & Revisitation Capture:** Windowed boundary F1 ($\pm 10\text{s}$), segment IoU, activity classification F1, and capture rate of non-linear concept revisitations.

### 9.3 RQ2 Evaluation Metrics (Normative Profile Concordance)
To evaluate ordinal depth without scale distortion:
* **Dimension Selection:** Precision, Recall, F1, and Jaccard overlap of required/recommended dimensions.
* **Mean Absolute Depth Error (MADE):**
  $$\text{MADE} = \frac{1}{|D|} \sum_{d \in D} |\text{ExpectedDepth}^{\text{system}}_d - \text{ExpectedDepth}^{\text{human}}_d|$$
* **Signed Depth Bias (SDB):**
  $$\text{SDB} = \frac{1}{|D|} \sum_{d \in D} (\text{ExpectedDepth}^{\text{system}}_d - \text{ExpectedDepth}^{\text{human}}_d)$$
* **Profile Cosine Similarity:** Evaluating overall profile vector shape.

### 9.4 RQ3 Evaluation Metrics (Teaching Adequacy & Coverage Gaps)
* Precision, Recall, and F1 for `ACTIONABLE_COVERAGE_GAP` items.
* Specificity and true-negative rate for `PERMISSIBLE_SCOPE_OMISSION`.
* Rate of proper `INSUFFICIENT_EVIDENCE` flagging on degraded audio/transcript segments.

### 9.5 RQ4 Evaluation Metrics (Assessment Consequence)
* Phase 3 Grounding & Single-Key Determinism pass rates (required 100%).
* Distractor misconception classification (Percentage of distractors verified as Type A or Type B vs Type C).
* Blinded review of cognitive demand alignment across Easy, Medium, and Hard tiers.

---

## 10. Formal Phase 5 Execution Lifecycle

```
[Step 1: PROTOCOL FREEZE] (phase5_research_protocol.md cryptographically sealed)
           │
           ▼
[Step 2: CORPUS HARVEST] (Acquire and verify 6 heterogeneous packages)
           │
           ▼
[Step 3: BLINDED HUMAN ANNOTATION] (Independent dual-annotator reference generation)
           │
           ▼
[Step 4: ADJUDICATION & SEALING] (Adjudicate discrepancies, seal normative + observational GT)
           │
           ▼
[Step 5: RUNNER EXECUTION — RQ2] (p5_1_depth_profile_generator.js)
           │
           ▼
[Step 6: RUNNER EXECUTION — RQ1A] (p5_2a_topic_reconstructor.js)
           │
           ▼
[Step 7: RUNNER EXECUTION — RQ1B] (p5_2b_episode_reconstructor.js)
           │
           ▼
[Step 8: RUNNER EXECUTION — RQ3] (p5_3_coverage_gap_analyzer.js)
           │
           ▼
[Step 9: RUNNER EXECUTION — RQ4] (p5_4_assessment_demand_specifier.js via Phase 3 harness)
           │
           ▼
[Step 10: SCIENTIFIC VALIDITY AUDIT — RQ1-RQ4] (evaluate_phase5_scientific_validity.js)
           │
           ▼
[Step 11: BFS OBJECTIVE-CONDITIONING SENSITIVITY TEST] (Targeted pkg_03 vs pkg_04 analysis)
           │
           ▼
[Step 12: PHASE 5 AUDIT REPORT & CLOSURE] (Compile comprehensive scientific audit report)
```

---

*Protocol authored and cryptographically prepared under commit `b1b15535389df45151601a9a39bc3c5d8f46e1f0` (tag `v3.4-frozen`).*
