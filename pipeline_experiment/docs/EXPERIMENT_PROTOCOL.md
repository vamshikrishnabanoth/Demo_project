# Master Research Protocol: Pedagogical Representation & Adaptive Routing

## 1. Primary Research Question
> **"Can observable instructional characteristics of real educational material predict whether a summary-based or instructional-blueprint-based representation will produce higher-quality assessments?"**

---

## 2. The 4-Stage Research Methodology

```
                          REAL EDUCATIONAL INPUT
                                     │
                                     ▼
  ┌────────────────────────────────────────────────────────────────────────────┐
  │ STAGE A: STT RELIABILITY & PEDAGOGICAL STATEMENT VALIDATION                │
  │ • Overall WER & CER                                                        │
  │ • Technical-Term & Code Entity Accuracy                                    │
  │ • Number & Mathematical Formula Preservation                               │
  │ • Negation Accuracy ('not', 'don't', 'never', 'cannot')                     │
  │ • Omission Rate of Pedagogically Critical Statements                       │
  └──────────────────────────────────┬─────────────────────────────────────────┘
                                     │
                                     ▼
  ┌────────────────────────────────────────────────────────────────────────────┐
  │ STAGE B: BLUEPRINT VALIDITY & INTENT GROUNDING                             │
  │ (Evaluated BEFORE MCQ Generation)                                          │
  │ Benchmark: Human Ground-Truth Intent ◄──► System Inferred Blueprint        │
  │ • Concept Recall & Salience Precision                                      │
  │ • Cognitive Activity Alignment (explain, derive, apply, debug)             │
  │ • Worked Example & Misconception Capture                                   │
  └──────────────────────────────────┬─────────────────────────────────────────┘
                                     │
                                     ▼
  ┌────────────────────────────────────────────────────────────────────────────┐
  │ STAGE C: CONTROLLED REPRESENTATION EXPERIMENT                              │
  │ (Summary vs. 4-Layer Blueprint on Held-Out Validation Corpus)              │
  │ • Strict Primary Model Parity (No silent fallbacks)                        │
  │ • Symmetrical Prompt Scaffolding (Identical system & task prompts)         │
  │ • Objective Evaluation: Grounding, Answerability, Bloom, Specificity       │
  │ • Empirical Delta: ΔQ = Q_Blueprint - Q_Summary                            │
  └──────────────────────────────────┬─────────────────────────────────────────┘
                                     │
                                     ▼
  ┌────────────────────────────────────────────────────────────────────────────┐
  │ STAGE D: BLIND ROUTER GENERALIZATION VALIDATION                            │
  │ • Feature Extractor computes 8-D vector x without generating questions     │
  │ • Rule-Based Router predicts optimal representation (SUMMARY vs. BLUEPRINT)│
  │ • Decision is evaluated against Ground-Truth argmax(Q_A, Q_B) on UNSEEN data│
  └────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. The 4 Distinct Real Modality Groups for Next Data Collection

1. **Group A: Voice Only** (Pure conceptual explanation, algorithm proofs, whiteboard math).
2. **Group B: Voice + PPT** (Spoken audio with explicit slide anchors: *"Look at slide 4...", "This diagram is important..."*).
3. **Group C: Voice + Code** (Instructor walking through code execution and live bug diagnosis $\longleftrightarrow$ testing whether *Voice + Code* behaves differently from *Static Code Manuals*).
4. **Group D: Voice + PPT + Q&A** (Classroom interaction, student confusion, clarifying questions, bottleneck resolution).

---

## 4. Ground-Truth Instructional Intent Annotation Protocol

For every validation lecture, human evaluators annotate the ground truth intent independently:

```json
{
  "topic": "Binary Trees and Tree Properties",
  "teacher_emphasis": [
    "Strict binary tree property (every node has 0 or 2 children)",
    "Leaf node relation: L = I + 1"
  ],
  "worked_examples": [
    "Derivation of leaf node count from internal nodes on whiteboard",
    "In-order and Pre-order tree reconstruction"
  ],
  "student_questions": [
    "Difference between full binary tree and complete binary tree"
  ],
  "important_concepts": [
    "Degree of a node",
    "Hierarchical non-linear storage",
    "Pre-order, In-order, Post-order traversal sequences"
  ],
  "observed_cognitive_activity": [
    "EXPLAIN",
    "DERIVE",
    "APPLY"
  ]
}
```

---

## 5. Strict Generation & Experimental Controls

1. **No Silent Fallbacks**: If primary model encounters rate limits, execution retries with backoff on the exact primary model. Silent switching is disabled.
2. **Deterministic Objective Scoring**: Composite $Q$ is computed via standardized mathematical equations, preventing evaluator subjectivity.
3. **Blind Human Validation**: Shuffled `Q_BLIND_XXXX` packages with private decryption keys for unbiased SME Likert scoring.
