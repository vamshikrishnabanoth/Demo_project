# Phase 4 Experiment 4.2b Step 3 — Unseen-Teacher Generalization
## Annotation & Adjudication Protocol: Tapadia Sir & Asha Mam

**Evaluation Phase:** Phase 4 (Instructional Intent & Teaching Behaviors)  
**Experiment ID:** `EXP_4_2B_STEP_3`  
**Protocol Version:** 2.0.0-REVISED  
**Status:** Protocol Under User Review (Pre-Annotation Phase)  
**Baseline Git Commit:** `b1b15535389df45151601a9a39bc3c5d8f46e1f0`  
**Baseline Tag:** `v3.4-frozen`  
**Isolated Experiment Directory:** `experiments/experiment_4_2b_step3/`  

---

## 1. Executive Summary & Purpose

The objective of **Phase 4 Experiment 4.2b Step 3** is to evaluate the generalization capability of frozen teaching-behavior classifiers across **two previously unseen instructors and their associated lecture recordings**:

1. **`BENCH_05` — Tapadia Sir:** Long-form lecture recordings covering algorithmic problem solving (Longest Common Prefix, Koko Eating Bananas), Java memory management (stack vs. heap allocation, garbage collection eligibility), and defensive programming. Observably characterized by interactive questioning, student microphone responses, and live code refactoring.
2. **`BENCH_06` — Asha Mam:** Graduate-level lecture recordings covering Deep Learning theory, Autoencoder architectures, Variational Autoencoders (VAEs), Gaussian latent distributions, the reparameterization trick, and Google Colab code walkthroughs. Observably characterized by technical exposition, architectural contrasts, loss function derivations, and live notebook execution.

### Strict Methodological Boundary
To ensure scientific validity and eliminate confirmation bias:
- **Segmentation is strictly decoupled from behavior annotation.**
- **Candidate units are frozen and cryptographically registered before annotation begins.**
- **Human ground truth must be established, adjudicated, and cryptographically frozen BEFORE any model (C1, C4, or C5) is evaluated on these transcripts.**
- Ground truth must test the models; models must never shape the ground truth.

---

## 2. Segmentation & Unit-Selection Criteria

### Two-Stage Decoupled Workflow
To prevent behavior hypotheses from biasing segment boundaries:
1. **Stage 1 (Content-Agnostic Discourse Segmentation):** Segment boundaries are established solely based on discourse structure, topic shifts, slide/notebook transitions, and acoustic pause boundaries (>= 1.5 s). Segmentation is conducted without reference to the 12 behavior labels.
2. **Stage 2 (Unit Inventory Freeze):** The resulting unit inventory (unit IDs, start/end timestamps, durations, word counts, raw transcript text, and neutral topical descriptions) is sealed in `unit_inventory/step3_unit_inventory.json` and cryptographically hashed before human annotators receive it.
3. **Stage 3 (Independent Behavior Annotation):** Annotators receive only the locked unit boundaries and neutral topic descriptions. No behavior labels or assumed functions are provided.

### Duration & Sampling Design Principles:
- **Duration Guideline:** Target duration is **90 seconds to 400 seconds** (mean approx 230 s). This is an empirical guideline rather than a rigid filter: natural pedagogical episodes are not artificially truncated or merged merely to satisfy a duration constraint.
- **Sampling Volume (Parity Design Choice):** Selecting 8 units per instructor (16 units total) is a **sampling design choice** implemented to maintain statistical power and evaluation volume parity with the frozen 17-unit baseline from Steps 1 and 2 (`BENCH_04` = 10 units, `BENCH_03` = 7 units).

### Frozen Candidate Unit Inventory

#### Table 2.1: BENCH_05 — Tapadia Sir
| Unit ID | Neutral Topic Description | Start (s) | End (s) | Duration (s) | Word Count |
|---|---|:---:|:---:|:---:|:---:|
| `GT-T01` | Longest Common Prefix: Initial Problem Formulation and Example String Sets | 0.0 | 145.7 | 145.7 | 259 |
| `GT-T02` | Smallest String Upper Bound and Index Bounds Avoidance | 145.7 | 415.5 | 269.8 | 704 |
| `GT-T03` | HashSet Implementation Walkthrough: Outer Loop and Character Comparison | 426.6 | 635.8 | 209.2 | 526 |
| `GT-T04` | HashSet Relocation Outside the Iteration Loop and Test Execution | 786.6 | 1062.8 | 276.2 | 607 |
| `GT-T05` | Handling Retained State via set.clear() and Recompilation | 1062.8 | 1205.8 | 143.0 | 360 |
| `GT-T06` | Java Memory Model: Stack References, Heap Allocation, and Garbage Collection Scope | 1228.3 | 1562.3 | 334.0 | 740 |
| `GT-T07` | Minimum Value Search: a[0] vs Integer.MAX_VALUE and Empty Array Behavior | 2159.2 | 2475.4 | 316.2 | 644 |
| `GT-T08` | Koko Eating Bananas: Hourly Eating Rate Formulation and Speed Adjustment | 2814.1 | 3076.9 | 262.8 | 551 |

#### Table 2.2: BENCH_06 — Asha Mam
| Unit ID | Neutral Topic Description | Start (s) | End (s) | Duration (s) | Word Count |
|---|---|:---:|:---:|:---:|:---:|
| `GT-A01` | Autoencoder Structural Comparison: Fully Connected vs. Convolutional Architectures | 0.0 | 147.0 | 147.0 | 374 |
| `GT-A02` | Variational Autoencoders: Motivation for Continuous Latent Representations | 147.0 | 258.0 | 111.0 | 279 |
| `GT-A03` | Latent Space Modeling: Gaussian Mean, Variance, and KL Regularization | 258.0 | 430.0 | 172.0 | 420 |
| `GT-A04` | Compression Trade-offs: Detailed Feature Retention vs. Blurry Output | 430.0 | 580.0 | 150.0 | 385 |
| `GT-A05` | The Reparameterization Formulation: Stochastic Sampling and Backpropagation Flow | 580.0 | 780.0 | 200.0 | 515 |
| `GT-A06` | VAE Objective Function: Pixel Reconstruction Loss and KL Divergence Balance | 780.0 | 1050.0 | 270.0 | 668 |
| `GT-A07` | Encoder Implementation: Custom Layer Definition and Latent Parameter Output | 1050.0 | 1350.0 | 300.0 | 641 |
| `GT-A08` | Decoder Network Assembly and Latent Manifold Grid Visualization | 1350.0 | 1642.0 | 292.0 | 712 |

---

## 3. The Frozen 12-Behavior Taxonomy & Operational Definitions

Human annotators must assign labels strictly from the canonical 12-behavior taxonomy established in Phase 4.2. **Annotators may assign all applicable canonical behaviors supported by observable evidence. There is no arbitrary maximum label count; however, each label requires independent timestamped evidence.**

| # | Behavior | Operational Definition | Observable Indicators |
|---|---|---|---|
| 1 | **`EXPLAIN`** | Direct conceptual definition, theoretical overview, architectural summary, or mechanical explanation delivered via instructor exposition. | Definitions, structural summaries, theoretical context, declarative explanations of system mechanics. |
| 2 | **`DEMONSTRATE`** | Active live procedural execution, compilation, running terminal commands, navigating live tools, or evaluating code in a notebook/editor. | Instructor executing terminal commands, compiling code, running tests, or evaluating Colab notebook cells in real time. |
| 3 | **`COMPARE`** | Explicit comparative analysis evaluating trade-offs, structural contrasts, or relative advantages between two or more algorithms, systems, or data structures. | Explicit comparison phrasing (*"unlike in C++"*, *"versus standard AE"*, *"in a set we check one, here we check N"*). |
| 4 | **`DEBUG`** | Diagnosing, isolating, troubleshooting, or correcting a syntax error, runtime exception, or logical state flaw in code. | Identifying incorrect behavior, reviewing error traces, finding un-cleared state variables, explaining or executing the fix. |
| 5 | **`PREDICT_CHANGE`** | Explicitly prompting students or challenging them to predict the outcome, output, or behavioral consequence of a code or parameter modification. | Prompting questions (*"What do you think we're going to get now?"*, *"What happens if the array is empty?"*). |
| 6 | **`ASK_WHY`** | Posing deep causal, architectural, or conceptual questions probing the underlying rationale or theoretical justification for a design choice. | Probing questions (*"Why do you prefer this approach?"*, *"Why does Java not allow stack objects?"*, *"Why does backprop fail?"*). |
| 7 | **`PRACTICE`** | Directing students to independently solve, implement, calculate, or code an exercise during the instructional session. | Directives allocating time or tasks (*"Take five minutes to solve this"*, *"Implement this method on your laptop"*). |
| 8 | **`REAL_WORLD_APP`** | Grounding concepts in concrete production engineering practices, industry business use cases, system integration, or external deployment constraints. | Discussion of production code maintenance, production crash risks, business operational constraints, enterprise systems. |
| 9 | **`EDGE_CASE`** | Explicit analysis of boundary conditions, extreme inputs, null references, empty collections, or system capacity limits. | Empty array inputs, null pointer exceptions, array out-of-bounds, single-character strings, division by zero, extreme parameter values. |
| 10 | **`CODE_TRACE`** | Step-by-step manual sequential tracking of program state, variable values, loop iterations, memory references, or call stacks. | Stepping through loop iterations (*"first iteration H is added, second iteration E is added, size becomes 2..."*). |
| 11 | **`STUDENT_INTERACT`** | Observable conversational dialogue turn-taking where the instructor solicits, listens to, evaluates, or incorporates student verbal responses. | Audible student responses, passing the microphone, student answering a question, instructor acknowledging a specific student's input. |
| 12 | **`REINFORCE`** | Explicitly summarizing, emphasizing, or reiterating a core engineering principle, rule of thumb, or key takeaway for long-term retention. | High-emphasis summaries (*"Remember this rule"*, *"Never write code like this"*, *"The key takeaway is..."*). |

---

## 4. Positive and Negative Boundary Rules

To prevent subjective annotation drift and maintain calibration with Phase 4.2/4.2b, annotators must adhere to explicit positive and negative boundary rules:

### Boundary A: Rhetorical Questions vs. `STUDENT_INTERACT`
- **Negative Boundary (Do NOT label `STUDENT_INTERACT`):**
  - Rhetorical questions where the instructor immediately provides the answer (*"To do that what do we do? We type git init"*).
  - Pacing/checking interjections that do not involve student responses (*"Are you all there?"*, *"Is that clear?"*, *"Right?"*).
  - **Rule on Secondary Classification:** A rhetorical question without a student response is not `STUDENT_INTERACT`. It does **not** automatically default to `EXPLAIN`. It may receive any other behavior label (such as `PREDICT_CHANGE`, `ASK_WHY`, `EDGE_CASE`, `CODE_TRACE`, or `EXPLAIN`) if the observable instructional action satisfies that label's operational definition.
- **Positive Boundary (DO label `STUDENT_INTERACT`):**
  - Requires clear evidence of conversational turn-taking: student speaks, microphone is passed, student provides a code answer, or instructor directly critiques a student's stated hypothesis (*"Lakshmi says assign max value, no that won't work..."*).

### Boundary B: Differentiating `REAL_WORLD_APP` from Instructional Analogies
- **Negative Boundary (Do NOT label `REAL_WORLD_APP`):**
  - Casual drop-in mentions of programming languages or tech brands (*"like in Java"*, *"Google"*, *"LLM"*).
  - Standard textbook code without real-world context.
  - **Instructional Analogies Rule:** Everyday physical metaphors (e.g. shoe laces disappearing in compression, car windows in rain, food digestion) used solely to illustrate abstract mathematical or algorithmic concepts do **NOT** qualify as `REAL_WORLD_APP` unless explicitly linked to external real-world industrial systems or business operational constraints. Default assignment: `EXPLAIN`.
- **Positive Boundary (DO label `REAL_WORLD_APP`):**
  - Explicit discussion of production code maintenance, production crash risks, concrete business application constraints, external database race conditions, or deployment engineering trade-offs.

### Boundary C: Verbal Syntax Walkthrough vs. `DEMONSTRATE`
- **Negative Boundary (Do NOT label `DEMONSTRATE`):**
  - Instructor verbally reciting or reading code lines or syntax without active execution or editor manipulation (*"Line 21 says set equals new hashset..."*). Default assignment: `EXPLAIN` or `CODE_TRACE`.
- **Positive Boundary (DO label `DEMONSTRATE`):**
  - Clear evidence in speech and context of active live execution: instructor running a script, compiling code on screen, evaluating terminal commands with live test cases, or executing Google Colab notebook cells.

### Boundary D: Instructor Example vs. Student `PRACTICE`
- **Negative Boundary (Do NOT label `PRACTICE`):**
  - Instructor presenting an example problem and solving it themselves on the board/screen.
  - Socratic questions answered in class during lecture flow. Default assignment: `EXPLAIN` or `CODE_TRACE`.
- **Positive Boundary (DO label `PRACTICE`):**
  - Explicit directives instructing students to independently write code, perform a calculation, or work through a problem during the class session.

### Boundary E: General Explanation vs. `CODE_TRACE`
- **Negative Boundary (Do NOT label `CODE_TRACE`):** High-level descriptions of what a method returns or does.
- **Positive Boundary (DO label `CODE_TRACE`):** Granular, sequential tracking of variables across specific loop iterations or stack frames (*"i=0: set has H; i=1: set gets E; size is 2, so condition fails"*).

### Boundary F: Routine Code Walkthrough vs. `DEBUG`
- **Negative Boundary (Do NOT label `DEBUG`):** Describing how correct code functions.
- **Positive Boundary (DO label `DEBUG`):** Identifying an explicit malfunction, unexpected output, memory retention bug, or crash, and investigating or implementing the corrective code modification.

### Boundary G: General Description vs. `COMPARE`
- **Negative Boundary (Do NOT label `COMPARE`):** Describing a single technology or data structure in isolation.
- **Positive Boundary (DO label `COMPARE`):** Explicit side-by-side evaluation of two alternative mechanisms (e.g. `HashSet` vs `HashMap`, Stack vs Heap, FC-AE vs Conv-AE, `a[0]` vs `Integer.MAX_VALUE`).

### Boundary H: Edge / Corner Case vs. Generic Logic
- **Negative Boundary (Do NOT label `EDGE_CASE`):** Standard typical inputs (e.g. sorting a normal array of 10 distinct numbers).
- **Positive Boundary (DO label `EDGE_CASE`):** Explicitly testing empty arrays, null references, single-character strings, or boundary overflow values.

---

## 5. Independent Human Annotation Procedure

### Annotation Roles
- **Annotator 1 (A1):** Independent annotator specializing in computer science pedagogy.
- **Annotator 2 (A2):** Independent annotator specializing in software engineering and machine learning.
- **Lead Adjudicator (LA):** Senior researcher responsible for convening the consensus review and authoring the cryptographic lock manifest.

### Workflow Steps:
1. **Blinding:** Both annotators receive the blank annotation templates:
   - `templates/annotation_template_tapadia.json`
   - `templates/annotation_template_ashamam.json`
   - Neither annotator is provided access to any model predictions (C1, C4, C5), prompts, or evaluation scripts.
2. **Independent Labeling:**
   - For each unit (`GT-T01`..`GT-T08` and `GT-A01`..`GT-A08`), the annotator reads the full transcript text and inspects audio where needed.
   - The annotator selects all applicable canonical behaviors supported by observable evidence.
   - **Mandatory Timestamped Evidence:** For every assigned behavior, the annotator must record structured evidence with start timestamp, end timestamp, and verbatim quote:
     ```json
     {
       "behavior": "DEBUG",
       "evidence": [
         {
           "start": 1068.4,
           "end": 1081.2,
           "quote": "What do you now need to do to fix it? Don't tell me please undo code..."
         }
       ]
     }
     ```
3. **Independent Submission:**
   - Annotator 1 submits: `raw_annotations/annotator1_submissions.json`.
   - Annotator 2 submits: `raw_annotations/annotator2_submissions.json`.
   - Raw annotations are permanently archived and never overwritten by subsequent consensus.

---

## 6. Peer-Review & Adjudication Procedure

### Step 1: Automated Agreement Profiling
Upon receiving both independent submissions, an automated audit script computes:
1. **Exact Set Match Rate:** Proportion of units where Set(A1) === Set(A2).
2. **Jaccard Similarity Index:**
   $$\text{Jaccard}(u) = \frac{|\text{Labels}_{A1} \cap \text{Labels}_{A2}|}{|\text{Labels}_{A1} \cup \text{Labels}_{A2}|}$$
3. **Inter-Annotator Micro F1:** Harmonic mean of precision and recall between annotator label sets.

### Step 2: Discrepancy Flagging
Any unit where Jaccard(u) < 1.0 is automatically flagged as a **Discrepancy Unit**:
- **Additive Discrepancy:** One annotator assigned a label that the other omitted.
- **Substitutive Discrepancy:** Annotators assigned competing labels to the same underlying textual evidence.

### Step 3: Formal Adjudication Session
The Lead Adjudicator convenes a formal adjudication meeting with A1 and A2:
1. Each flagged discrepancy is reviewed against the transcript text and cited evidence snippets.
2. The operational definitions (§3) and boundary rules (§4) are applied to determine whether the label is justified.
3. **Consensus Requirement:** A label is accepted into the final canonical set if and only if consensus is reached between the adjudicator and at least one annotator, supported by transcript evidence.
4. **Mandatory Documentation:** For every unit, the adjudicator must enter a formal `consensus_rationale` explaining why disputed labels were included or excluded.
5. The completed consensus results are recorded in `templates/adjudication_sheet_template.md`.

---

## 7. Rules Preventing Exposure to Model Outputs (Anti-Contamination)

To protect the integrity of the generalization test:
1. **Absolute Model Lockout:** No classifier script (`run_experiment_4_2.js`, `run_experiment_4_2b.js`, `run_c5_calibration.js`, or any Step 3 evaluation script) may be executed on `BENCH_05` or `BENCH_06` transcripts until the final ground-truth artifact is hashed and locked.
2. **Blinded Annotation:** Annotators and adjudicators must not inspect model prompts, few-shot examples, or model prediction logs during annotation or adjudication.
3. **Zero Post-Hoc GT Modification:** Once the ground-truth JSON is cryptographically frozen (SHA-256 registered), **no ground-truth label may be altered under any circumstances**. If a model disagrees with the frozen ground truth during evaluation, this must be analyzed and reported as a model classification outcome, never as a ground-truth flaw.
4. **Violation Penalty:** Any execution of model classifiers on candidate units prior to ground-truth freeze invalidates the experiment and requires starting over with alternative lecture segments.

---

## 8. Auditable Ground-Truth Artifact Structure

The final ground-truth dataset preserves raw annotator data, discrepancy metrics, and consensus evidence:
`experiments/experiment_4_2b_step3/ground_truth/step3_behavior_annotations.json`

### JSON Schema:
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Phase 4 Experiment 4.2b Step 3 Frozen Auditable Ground Truth",
  "type": "object",
  "required": ["metadata", "taxonomy", "benchmarks"],
  "properties": {
    "metadata": {
      "type": "object",
      "required": ["experiment_id", "status", "baseline_commit", "frozen_at", "total_units"],
      "properties": {
        "experiment_id": { "type": "string" },
        "status": { "type": "string", "enum": ["FROZEN_ARCHIVED"] },
        "baseline_commit": { "type": "string" },
        "frozen_at": { "type": "string" },
        "total_units": { "type": "integer" }
      }
    },
    "taxonomy": {
      "type": "array",
      "items": { "type": "string" }
    },
    "benchmarks": {
      "type": "object",
      "required": ["BENCH_05", "BENCH_06"],
      "properties": {
        "BENCH_05": {
          "type": "array",
          "items": { "$ref": "#/definitions/AuditableUnitRecord" }
        },
        "BENCH_06": {
          "type": "array",
          "items": { "$ref": "#/definitions/AuditableUnitRecord" }
        }
      }
    }
  },
  "definitions": {
    "AuditableUnitRecord": {
      "type": "object",
      "required": [
        "benchmark", "unit_id", "instructor", "topic_description",
        "start", "end", "duration", "word_count", "transcript_text",
        "annotator_1_raw", "annotator_2_raw", "inter_annotator_metrics",
        "human_canonical_labels", "adjudicated_evidence", "adjudication_rationale"
      ],
      "properties": {
        "benchmark": { "type": "string" },
        "unit_id": { "type": "string" },
        "instructor": { "type": "string" },
        "topic_description": { "type": "string" },
        "start": { "type": "number" },
        "end": { "type": "number" },
        "duration": { "type": "number" },
        "word_count": { "type": "integer" },
        "transcript_text": { "type": "string" },
        "annotator_1_raw": {
          "type": "object",
          "required": ["annotator_id", "assigned_labels", "timestamp"],
          "properties": {
            "annotator_id": { "type": "string" },
            "assigned_labels": {
              "type": "array",
              "items": {
                "type": "object",
                "required": ["behavior", "evidence"],
                "properties": {
                  "behavior": { "type": "string" },
                  "evidence": {
                    "type": "array",
                    "items": {
                      "type": "object",
                      "required": ["start", "end", "quote"],
                      "properties": {
                        "start": { "type": "number" },
                        "end": { "type": "number" },
                        "quote": { "type": "string" }
                      }
                    }
                  }
                }
              }
            },
            "timestamp": { "type": "string" }
          }
        },
        "annotator_2_raw": {
          "type": "object",
          "required": ["annotator_id", "assigned_labels", "timestamp"],
          "properties": {
            "annotator_id": { "type": "string" },
            "assigned_labels": { "type": "array" },
            "timestamp": { "type": "string" }
          }
        },
        "inter_annotator_metrics": {
          "type": "object",
          "required": ["exact_match", "jaccard_similarity", "disputed_behaviors"],
          "properties": {
            "exact_match": { "type": "boolean" },
            "jaccard_similarity": { "type": "number" },
            "disputed_behaviors": { "type": "array", "items": { "type": "string" } }
          }
        },
        "human_canonical_labels": {
          "type": "array",
          "items": { "type": "string" }
        },
        "adjudicated_evidence": {
          "type": "object",
          "additionalProperties": {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["start", "end", "quote"],
              "properties": {
                "start": { "type": "number" },
                "end": { "type": "number" },
                "quote": { "type": "string" }
              }
            }
          }
        },
        "adjudication_rationale": { "type": "string" }
      }
    }
  }
}
```

---

## 9. End-to-End Cryptographic Provenance Chain

To guarantee complete reproducibility and eliminate post-hoc tampering, the freeze manifest records a complete cryptographic provenance chain:

$$\text{Protocol} \longrightarrow \text{Unit Inventory} \longrightarrow \text{Taxonomy} \longrightarrow \text{Raw Annotations} \longrightarrow \text{Adjudication Log} \longrightarrow \text{Ground Truth} \longrightarrow \text{Manifest}$$

### Manifest Schema (`step3_freeze_manifest.json`):
```json
{
  "manifest_version": "1.0.0",
  "experiment_id": "EXP_4_2B_STEP_3",
  "timestamp_utc": "[ISO-8601 Timestamp]",
  "git_baseline": {
    "commit": "b1b15535389df45151601a9a39bc3c5d8f46e1f0",
    "tag": "v3.4-frozen"
  },
  "cryptographic_hashes": {
    "protocol_sha256": "[SHA-256 of step3_annotation_protocol.md]",
    "unit_inventory_sha256": "8ffbe82f24dd7ad0bed7b024a97edb94e0fd92a3b4ca0bb874b91c3ff583dbd9",
    "taxonomy_sha256": "57dba85d3fc92d1e9568e105f342d7ecc686f8cf03b185426dee7145487039e6",
    "annotator_1_raw_sha256": "[SHA-256 of annotator1_submissions.json]",
    "annotator_2_raw_sha256": "[SHA-256 of annotator2_submissions.json]",
    "adjudication_sheet_sha256": "[SHA-256 of completed adjudication_sheet.md]",
    "ground_truth_sha256": "[SHA-256 of step3_behavior_annotations.json]"
  },
  "dataset_summary": {
    "total_units": 16,
    "benchmarks": {
      "BENCH_05": { "instructor": "Tapadia Sir", "unit_count": 8 },
      "BENCH_06": { "instructor": "Asha Mam", "unit_count": 8 }
    },
    "inter_annotator_agreement": {
      "exact_match_rate": "[XX.X%]",
      "mean_jaccard": "[0.XXXX]",
      "micro_f1": "[XX.XX%]"
    }
  }
}
```

---

## 10. Pre-Evaluation Verification Checklist

Before launching any model evaluation script for Step 3, the following 8 items must be formally verified:

| # | Check Item | Verification Criterion | Status |
|---|---|---|:---:|
| 1 | **Git Repository State** | Working tree clean on tracked files; commit is `b1b15535389df45151601a9a39bc3c5d8f46e1f0` (`v3.4-frozen`) | [ ] PENDING |
| 2 | **Production Code Isolation** | Zero modifications to `server/engine/**`, Agent 1/2/3, PDI, grounding gate | [ ] PENDING |
| 3 | **Baseline Artifact Immutability** | Experiment 4.2, 4.2b, and 4.2b_c5 artifacts remain unmodified and untampered | [ ] PENDING |
| 4 | **Independent Human Annotation** | Annotator 1 and Annotator 2 submitted independent annotations without cross-talk | [ ] PENDING |
| 5 | **Adjudication Consensus** | 100% of units adjudicated with written consensus rationales and timestamped evidence | [ ] PENDING |
| 6 | **Zero Prior Model Exposure** | Confirmed that neither C1, C4, nor C5 was executed on BENCH_05 or BENCH_06 prior to freeze | [ ] PENDING |
| 7 | **Cryptographic Lock Match** | All 7 cryptographic hashes match in `step3_freeze_manifest.json` | [ ] PENDING |
| 8 | **Model Code Freeze** | C1 lexical rules, C4 prompt, and C5 calibrated prompt match their respective frozen baselines | [ ] PENDING |

---

*Protocol authored under commit `b1b15535389df45151601a9a39bc3c5d8f46e1f0` (tag `v3.4-frozen`).*
