# Milestone v3.6 Phase 7.5: Auditable Evidence Dossier & Raw Output Excerpts

**Document:** `phase7_5_auditable_evidence_dossier.md`  
**Milestone Target:** Milestone v3.6 Phase 7.5 Track 2 Model Alignment  
**Evaluation Mode:** P5.3-ONLY Scope (Baseline P5.2A Concepts 100% Frozen)  
**Execution Protocol:** Decoupled Blind Generation + Post-Generation Adjudication  
**Evaluation Model:** `openai/gpt-oss-120b` via Groq Cloud SDK  
**Generation Timestamp:** 2026-10-02T16:36:52.280Z  

---

## 1. Cryptographic Inventory of Evaluation Artifacts

The following table records the exact filesystem paths, byte sizes, and SHA-256 cryptographic hashes for all candidate prompt variants, frozen baselines, inputs, ground truth references, and runner execution scripts:

| Artifact Role & Description | Relative Path | Size (Bytes) | SHA-256 Hash |
| :--- | :--- | :---: | :---: |
| **Candidate Prompt Spec Markdown** | `experiments\experiment_5_teaching_adequacy\dev_2a\candidate_interventions\candidate_prompt_intervention_v1_2_0.md` | 11,664 | `d940ac8b7728485ad7f06ebed5c30ccb589bc106072e7e4c4715618779f810f1` |
| **Candidate P5.3 Analyzer Module** | `experiments\experiment_5_teaching_adequacy\dev_2a\candidate_interventions\candidate_p5_3_coverage_gap_analyzer_v1_2_0.js` | 10,677 | `e9d2b53e3ea78c7182e35a696645fa82f5be0d6f075da1c6e375431a56e1f94d` |
| **Frozen Baseline P5.3 Analyzer** | `experiments\experiment_5_teaching_adequacy\runner\p5_3_coverage_gap_analyzer.js` | 25,483 | `0884d2923fc5581a2e0e193c285e98acc646e9ea282a09db67238e4541bee9ee` |
| **Frozen P5.1 Normative Profiles (dev_2b)** | `experiments\experiment_5_teaching_adequacy\dev_2b\p5_1_profiles_dev2b.json` | 18,456 | `ac354a6fb8d1f799f5fed76627b029b7bb110fbed235ea24b1c74a960eca814c` |
| **Frozen Baseline P5.2A Concepts (dev_2b)** | `experiments\experiment_5_teaching_adequacy\dev_2b\frozen_baseline_p5_2a_dev2b_segment_concepts.json` | 42,050 | `2089e6a739dca628a52048c947e84e713f214c2acf7ce96a76093b7f6a550ca5` |
| **Phase 7.5 Raw Model Outputs** | `experiments\experiment_5_teaching_adequacy\dev_2b\phase7_5_dev2b_raw_outputs.json` | 59,755 | `55537f2e29abb0c1d53e77dc56ad6619ff844e92382ed2319182f42ae745541a` |
| **Phase 7.5 Scored Evaluation Results** | `experiments\experiment_5_teaching_adequacy\dev_2b\phase7_5_dev2b_challenge_results.json` | 20,137 | `e92f69374a6ea436274b160173f5849ee818dccc5ab707d331bd70c573ac92c5` |
| **Sealed Human Adjudication Ground Truth** | `experiments\experiment_5_teaching_adequacy\dev_2b\dev_2b_adjudication_summary.json` | 7,145 | `344d8b2efe1672a45419cae8eed524d0f339015cbed8ff1402f3ff1f936d8e14` |
| **Track 1 Human Reliability Manifest** | `experiments\experiment_5_teaching_adequacy\dev_2b\dev_2b_track1_manifest.json` | 886 | `84cee24d7be0150c71ffba1f9b5923174722142b73049834520020e02eba4417` |
| **Challenge Corpus Manifest (dev_2b)** | `experiments\experiment_5_teaching_adequacy\dev_2b\dev_2b_corpus_manifest.json` | 2,098 | `d7aa61fc75680ae5fe036031fa90e0a16ef680275ac147cb5b805aa3493e416e` |
| **Phase 7.5 Evaluation Runner** | `experiments\experiment_5_teaching_adequacy\dev_2b\run_phase7_5_challenge_eval.js` | 28,378 | `80ff3a1316bfd625b0c7b91c3ad8c15f31e6086e44ad78b6f2a75eef38663839` |


---

## 2. Side-by-Side Provenance Audit: Case 2A (`dev_2a` vs. `dev_2b`)

To ensure complete auditable clarity regarding the discrepancy identified in Case 2A across Phase 7.4 and Phase 7.5, the underlying inputs and outputs are documented side-by-side:

| Audit Dimension | Phase 7.4 Case 2A (`dev_2a`) | Phase 7.5 Case 2A (`dev_2b`) |
| :--- | :--- | :--- |
| **Corpus Origin** | Calibration Corpus `dev_2a` | Sealed Targeted Challenge Set `dev_2b` |
| **Package ID** | `dev_2a_02_pharmacology_clearance` | `dev_2b_02_hepatic_metabolism` |
| **Topic & Segment** | Single-compartment IV bolus PK derivation ($CL = k_e \cdot V_d$) | Hepatic clearance & intrinsic clearance ($CL_H = f_e \cdot k_{el} \cdot V_d$) |
| **Upstream P5.2A Concept Routing** | **Concept C06 explicitly extracted under `JUSTIFICATION_WHY`:**<br>`{"concept_id": "C06", "name": "Derivation of CL = k_e·V_d", "epistemic_dimension": "JUSTIFICATION_WHY"}` | **Zero concepts extracted under `JUSTIFICATION_WHY`:**<br>Clearance formulas routed to `RELATIONSHIPS_MECHANISM` (C02, C04, C05) and `APPLICATION_INTERPRETATION` (C06). |
| **P5.3 Input Concepts Received** | Received Concept C06 with explicit algebraic derivation text | Received **0 concepts** for `JUSTIFICATION_WHY` |
| **Baseline P5.3 Raw Depth** | **Depth 5** (`COVERED`, overcredited equation manipulation) | **Depth 0** (`ACTIONABLE_COVERAGE_GAP`, zero concepts available) |
| **Baseline P5.3 Synthesis Quote** | *"C06 derives CL = k_e·Vd by equating elimination‑rate expressions, providing a step‑by‑step rationale."* | *"No taught concept or episode provides a rationale or theoretical justification for the clearance formulas or enzyme kinetics."* |
| **Candidate P5.3 v1.2.0 Raw Depth** | **Depth 4** (`PARTIALLY_COVERED`, exact match with Reference 4) | **Depth 0** (`ACTIONABLE_COVERAGE_GAP`, zero concepts available) |
| **Candidate P5.3 Synthesis Quote** | *"C06 algebraically derives CL = ke·Vd without invoking a physiological mechanism, qualifying as a formal identity (Level 4)."* | *"No concept or episode offers a causal or mechanistic justification for the clearance formulas; only statements of relationships are given."* |
| **Outcome on Phase Gate** | **Depth & Boundary Improvement** on `dev_2a` (Baseline 5 $\to$ Cand 4) | **Inexact Match on both Baseline and Candidate** (Depth 0 vs Ref 4); **not an improvement on `dev_2b`**. |

---

## 3. Verbatim Raw-Output Excerpts Across All 8 Challenge Segments

The following excerpts reproduce the exact raw model outputs and metadata stored in `phase7_5_dev2b_raw_outputs.json` (SHA-256: `55537f2e29abb0c1d53e77dc56ad6619ff844e92382ed2319182f42ae745541a`):


#### Case [1A] — dev_2b_01_set_theory_relations (MEANING)
- **Target Boundary:** Threshold Level 4
- **Human Reference Standard:**
  - Adjudicated Depth: **Level 2**
  - Operational Boundary Verdict: **`FALLS_SHORT_OF_LEVEL_4_SEMANTICS`**
  - Adjudication Rationale: *"Axiomatic recitation of reflexivity, symmetry, and transitivity without universe elements or valuations. Constrained to Level 2."*
- **Baseline P5.3 (Raw Output):**
  - Observed Depth: **Level 2**
  - Status: `PARTIALLY_COVERED`
  - Boundary Verdict: `FALLS_SHORT_OF_LEVEL_4_SEMANTICS`
  - Boundary Agreement: **MATCH (TN)**
  - Exact-Depth Agreement: **MATCH**
  - Verbatim Evidence Synthesis: *"C02 defined equivalence relation via three axioms but did not illustrate operational use."*
  - Execution Meta: Model `openai/gpt-oss-120b`, Key `key_slot_0` (`gsk_AieJ...`), Timestamp `2026-10-02T16:32:55.557Z`
- **Candidate P5.3 v1.2.0 (Raw Output):**
  - Observed Depth: **Level 2**
  - Status: `PARTIALLY_COVERED`
  - Boundary Verdict: `FALLS_SHORT_OF_LEVEL_4_SEMANTICS`
  - Boundary Agreement: **MATCH (TN)**
  - Exact-Depth Agreement: **MATCH**
  - Verbatim Evidence Synthesis: *"C02 gives a formal definition of an equivalence relation and lists its three axioms, but no operational or causal explanation (Level 2)."*
  - Execution Meta: Model `openai/gpt-oss-120b`, Key `key_slot_2` (`gsk_Lc67...`), Timestamp `2026-10-02T16:33:02.334Z`

---

#### Case [1B] — dev_2b_01_set_theory_relations (MEANING)
- **Target Boundary:** Threshold Level 4
- **Human Reference Standard:**
  - Adjudicated Depth: **Level 4**
  - Operational Boundary Verdict: **`SATISFIES_LEVEL_4_SEMANTICS`**
  - Adjudication Rationale: *"Full concordance: Concrete partition model over S={a,b,c,d} with truth valuations for equivalence classes satisfies Level 4 Semantic Models."*
- **Baseline P5.3 (Raw Output):**
  - Observed Depth: **Level 4**
  - Status: `COVERED`
  - Boundary Verdict: `SATISFIES_LEVEL_4_SEMANTICS`
  - Boundary Agreement: **MATCH (TP)**
  - Exact-Depth Agreement: **MATCH**
  - Verbatim Evidence Synthesis: *"C05 and C06 discuss covering, disjointness, and the equivalence‑partition correspondence, showing set‑level properties."*
  - Execution Meta: Model `openai/gpt-oss-120b`, Key `key_slot_0` (`gsk_AieJ...`), Timestamp `2026-10-02T16:33:20.468Z`
- **Candidate P5.3 v1.2.0 (Raw Output):**
  - Observed Depth: **Level 4**
  - Status: `COVERED`
  - Boundary Verdict: `SATISFIES_LEVEL_4_SEMANTICS`
  - Boundary Agreement: **MATCH (TP)**
  - Exact-Depth Agreement: **MATCH**
  - Verbatim Evidence Synthesis: *"C05 explains covering and disjointness of classes, and C06 links equivalence relations to partitions, showing systemic interaction between relational semantics and set partitions."*
  - Execution Meta: Model `openai/gpt-oss-120b`, Key `key_slot_2` (`gsk_Lc67...`), Timestamp `2026-10-02T16:33:28.864Z`

---

#### Case [2A] — dev_2b_02_hepatic_metabolism (JUSTIFICATION_WHY)
- **Target Boundary:** Threshold Level 5
- **Human Reference Standard:**
  - Adjudicated Depth: **Level 4**
  - Operational Boundary Verdict: **`FALLS_SHORT_OF_LEVEL_5_MECHANISM`**
  - Adjudication Rationale: *"Full concordance: Algebraic clearance derivation CL_H = f_e * k_el * V_d is capped at Level 4 FORMAL_MATHEMATICAL_IDENTITY; provides zero tissue/cellular transport mechanism."*
- **Baseline P5.3 (Raw Output):**
  - Observed Depth: **Level 0**
  - Status: `ACTIONABLE_COVERAGE_GAP`
  - Boundary Verdict: `FALLS_SHORT_OF_LEVEL_5_MECHANISM`
  - Boundary Agreement: **MATCH (TN)**
  - Exact-Depth Agreement: **MISMATCH**
  - Verbatim Evidence Synthesis: *"No taught concept or episode provides a rationale or theoretical justification for the clearance formulas or enzyme kinetics."*
  - Execution Meta: Model `openai/gpt-oss-120b`, Key `key_slot_0` (`gsk_AieJ...`), Timestamp `2026-10-02T16:33:45.672Z`
- **Candidate P5.3 v1.2.0 (Raw Output):**
  - Observed Depth: **Level 0**
  - Status: `ACTIONABLE_COVERAGE_GAP`
  - Boundary Verdict: `FALLS_SHORT_OF_LEVEL_5_MECHANISM`
  - Boundary Agreement: **MATCH (TN)**
  - Exact-Depth Agreement: **MISMATCH**
  - Verbatim Evidence Synthesis: *"No concept or episode offers a causal or mechanistic justification for the clearance formulas; only statements of relationships are given."*
  - Execution Meta: Model `openai/gpt-oss-120b`, Key `key_slot_2` (`gsk_Lc67...`), Timestamp `2026-10-02T16:34:03.401Z`

---

#### Case [2B] — dev_2b_02_hepatic_metabolism (JUSTIFICATION_WHY)
- **Target Boundary:** Threshold Level 5
- **Human Reference Standard:**
  - Adjudicated Depth: **Level 5**
  - Operational Boundary Verdict: **`SATISFIES_LEVEL_5_MECHANISM`**
  - Adjudication Rationale: *"Full concordance: Sinusoidal blood perfusion, OATP1B1 transporter influx, and CYP3A4 microsomal kinetics satisfy Level 5 Causal Biological Mechanism."*
- **Baseline P5.3 (Raw Output):**
  - Observed Depth: **Level 2**
  - Status: `ACTIONABLE_COVERAGE_GAP`
  - Boundary Verdict: `FALLS_SHORT_OF_LEVEL_5_MECHANISM`
  - Boundary Agreement: **MISMATCH (FN)**
  - Exact-Depth Agreement: **MISMATCH**
  - Verbatim Evidence Synthesis: *"Michaelis‑Menten kinetics were stated without derivation or rationale for its applicability to microsomal metabolism."*
  - Execution Meta: Model `openai/gpt-oss-120b`, Key `key_slot_0` (`gsk_AieJ...`), Timestamp `2026-10-02T16:34:22.195Z`
- **Candidate P5.3 v1.2.0 (Raw Output):**
  - Observed Depth: **Level 2**
  - Status: `ACTIONABLE_COVERAGE_GAP`
  - Boundary Verdict: `FALLS_SHORT_OF_LEVEL_5_MECHANISM`
  - Boundary Agreement: **MISMATCH (FN)**
  - Exact-Depth Agreement: **MISMATCH**
  - Verbatim Evidence Synthesis: *"No step‑by‑step derivation or causal mechanistic explanation of clearance equations was provided."*
  - Execution Meta: Model `openai/gpt-oss-120b`, Key `key_slot_2` (`gsk_Lc67...`), Timestamp `2026-10-02T16:34:32.125Z`

---

#### Case [3A] — dev_2b_03_aminoglycoside_dosing (APPLICATION_INTERPRETATION)
- **Target Boundary:** Threshold Level 6
- **Human Reference Standard:**
  - Adjudicated Depth: **Level 3**
  - Operational Boundary Verdict: **`FALLS_SHORT_OF_LEVEL_6_TRACE`**
  - Adjudication Rationale: *"Full concordance: Conversational bedside mental math and heuristic interval stretching capped at Level 3 INFORMAL_CLINICAL_ESTIMATION."*
- **Baseline P5.3 (Raw Output):**
  - Observed Depth: **Level 6**
  - Status: `COVERED`
  - Boundary Verdict: `SATISFIES_LEVEL_6_TRACE`
  - Boundary Agreement: **MISMATCH (FP)**
  - Exact-Depth Agreement: **MISMATCH**
  - Verbatim Evidence Synthesis: *"Performs mental multiplication (7 mg/kg × 70 kg ≈ 490 mg) and rounds to a 500 mg vial, demonstrating a concrete numeric calculation."*
  - Execution Meta: Model `openai/gpt-oss-120b`, Key `key_slot_0` (`gsk_AieJ...`), Timestamp `2026-10-02T16:34:50.228Z`
- **Candidate P5.3 v1.2.0 (Raw Output):**
  - Observed Depth: **Level 3**
  - Status: `ACTIONABLE_COVERAGE_GAP`
  - Boundary Verdict: `FALLS_SHORT_OF_LEVEL_6_TRACE`
  - Boundary Agreement: **MATCH (TN)**
  - Exact-Depth Agreement: **MATCH**
  - Verbatim Evidence Synthesis: *"C02 and C03 walk through mental multiplication and rounding to a vial size, each a single‑step calculation (Level 3)."*
  - Execution Meta: Model `openai/gpt-oss-120b`, Key `key_slot_2` (`gsk_Lc67...`), Timestamp `2026-10-02T16:34:57.974Z`

---

#### Case [3B] — dev_2b_03_aminoglycoside_dosing (APPLICATION_INTERPRETATION)
- **Target Boundary:** Threshold Level 6
- **Human Reference Standard:**
  - Adjudicated Depth: **Level 6**
  - Operational Boundary Verdict: **`SATISFIES_LEVEL_6_TRACE`**
  - Adjudication Rationale: *"Full concordance: Chained 6-step calculation trace (weight adjustment, Cockcroft-Gault, vial rounding, Hartford nomogram) satisfies Level 6 Rigorous Stepwise Execution Trace."*
- **Baseline P5.3 (Raw Output):**
  - Observed Depth: **Level 5**
  - Status: `PARTIALLY_COVERED`
  - Boundary Verdict: `FALLS_SHORT_OF_LEVEL_6_TRACE`
  - Boundary Agreement: **MISMATCH (FN)**
  - Exact-Depth Agreement: **MISMATCH**
  - Verbatim Evidence Synthesis: *"C06 and C07 walk through a single concrete example (CrCl = 45.8 mL/min → 36‑h interval; serum level plotted) but lack a full step‑by‑step worked problem trace."*
  - Execution Meta: Model `openai/gpt-oss-120b`, Key `key_slot_0` (`gsk_AieJ...`), Timestamp `2026-10-02T16:35:15.938Z`
- **Candidate P5.3 v1.2.0 (Raw Output):**
  - Observed Depth: **Level 4**
  - Status: `ACTIONABLE_COVERAGE_GAP`
  - Boundary Verdict: `FALLS_SHORT_OF_LEVEL_6_TRACE`
  - Boundary Agreement: **MISMATCH (FN)**
  - Exact-Depth Agreement: **MISMATCH**
  - Verbatim Evidence Synthesis: *"Hartford nomogram interval selection and monitoring plan were described, but without a worked numerical trace or concrete code‑level execution."*
  - Execution Meta: Model `openai/gpt-oss-120b`, Key `key_slot_2` (`gsk_Lc67...`), Timestamp `2026-10-02T16:35:50.862Z`

---

#### Case [4A] — dev_2b_04_iir_filter_realization (STRUCTURE_COMPONENTS)
- **Target Boundary:** Threshold Level 5
- **Human Reference Standard:**
  - Adjudicated Depth: **Level 2**
  - Operational Boundary Verdict: **`FALLS_SHORT_OF_LEVEL_5_PRIMITIVES`**
  - Adjudication Rationale: *"Full concordance: Itemized roster of 6 scalar specification parameters and design bounds capped at Level 2 PARAMETER_SPECIFICATION_ROSTER."*
- **Baseline P5.3 (Raw Output):**
  - Observed Depth: **Level 3**
  - Status: `PARTIALLY_COVERED`
  - Boundary Verdict: `FALLS_SHORT_OF_LEVEL_5_PRIMITIVES`
  - Boundary Agreement: **MATCH (TN)**
  - Exact-Depth Agreement: **MISMATCH**
  - Verbatim Evidence Synthesis: *"C06 defines filter order and pole count and notes that order affects transition steepness, a single cause‑effect link."*
  - Execution Meta: Model `openai/gpt-oss-120b`, Key `key_slot_3` (`gsk_82zS...`), Timestamp `2026-10-02T16:36:11.612Z`
- **Candidate P5.3 v1.2.0 (Raw Output):**
  - Observed Depth: **Level 2**
  - Status: `ACTIONABLE_COVERAGE_GAP`
  - Boundary Verdict: `FALLS_SHORT_OF_LEVEL_5_PRIMITIVES`
  - Boundary Agreement: **MATCH (TN)**
  - Exact-Depth Agreement: **MATCH**
  - Verbatim Evidence Synthesis: *"C06 mentions filter order N as the integer pole count but gives no deeper structural detail."*
  - Execution Meta: Model `openai/gpt-oss-120b`, Key `key_slot_0` (`gsk_AieJ...`), Timestamp `2026-10-02T16:36:23.515Z`

---

#### Case [4B] — dev_2b_04_iir_filter_realization (STRUCTURE_COMPONENTS)
- **Target Boundary:** Threshold Level 5
- **Human Reference Standard:**
  - Adjudicated Depth: **Level 5**
  - Operational Boundary Verdict: **`SATISFIES_LEVEL_5_PRIMITIVES`**
  - Adjudication Rationale: *"Full concordance: Direct Form II canonical hardware signal flow graph primitives (z^-1 registers, multipliers, adder tree) satisfy Level 5 Architectural Constituent Primitives."*
- **Baseline P5.3 (Raw Output):**
  - Observed Depth: **Level 4**
  - Status: `COVERED`
  - Boundary Verdict: `FALLS_SHORT_OF_LEVEL_5_PRIMITIVES`
  - Boundary Agreement: **MISMATCH (FN)**
  - Exact-Depth Agreement: **MISMATCH**
  - Verbatim Evidence Synthesis: *"C03‑C05 described the shared tapped delay line, feedback multiplier bank, and feedforward multiplier bank, detailing the primitive hardware blocks."*
  - Execution Meta: Model `openai/gpt-oss-120b`, Key `key_slot_2` (`gsk_Lc67...`), Timestamp `2026-10-02T16:36:32.293Z`
- **Candidate P5.3 v1.2.0 (Raw Output):**
  - Observed Depth: **Level 5**
  - Status: `COVERED`
  - Boundary Verdict: `SATISFIES_LEVEL_5_PRIMITIVES`
  - Boundary Agreement: **MATCH (TP)**
  - Exact-Depth Agreement: **MATCH**
  - Verbatim Evidence Synthesis: *"C03‑C05 detailed the shared tapped delay line, feedback and feedforward multiplier banks, and adder tree, delivering a complete architectural blueprint of the Direct Form II primitives."*
  - Execution Meta: Model `openai/gpt-oss-120b`, Key `key_slot_0` (`gsk_AieJ...`), Timestamp `2026-10-02T16:36:51.766Z`

---

