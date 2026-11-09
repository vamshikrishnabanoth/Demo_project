# KMIT Kahoot — Master Experiment & Benchmark Index
**Project**: Automated Question Generation (AQG) & Pedagogical Assessment Platform  
**Authors**: KMIT CSE Faculty & Antigravity Advanced Agentic AI Pair Programming  
**Last Updated**: November 9, 2026 (13:25 IST)  
**Baseline Release**: `v1.0.0-rc1` / `main` (`af9ceb9`)  

---

## Overview & Purpose

This document serves as the permanent, single-source-of-truth ledger for all empirical experiments, evaluation benchmarks, and architectural validations conducted on the KMIT Kahoot system.

The primary goal is **scientific reproducibility and preservation of institutional memory**:
- To ensure no experiment is repeated redundantly simply because historical records were lost.
- To record what worked, what failed, and why specific design decisions were made.
- To connect every experimental claim directly to machine-readable artifacts, evaluation code, and Git commit hashes.

---

## 1. Master Experiment Directory & Chronological Index

| Experiment ID | Title | Key Objective | Primary Dataset / Corpus | Result Summary | Key Commit Hash |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **EXP-01** | Phase 1–2 Ingestion & Baseline Alignment | Ingestion, Whisper STT chunking, dual authority, modality baseline routing | 10 Archetypes | Verified zero crash on audio/PDF/code; established deterministic baseline | `a328953` |
| **EXP-02** | Step 3 Stress Matrix Verification | Stress-test boundary conditions (noisy audio, code-only, missing slides, extreme length) | 10 Archetypes $\times$ 4 Stress Conditions | 40/40 test cases passed; established graceful fallback and input sanitization | `e53e80a` |
| **EXP-03** | Step 4 50-Case Gold Benchmark | Full curricular coverage and zero-hallucination verification | 50 Curricular Topics across 5 Domains | 50/50 gold cases evaluated; 100% grounded claim compliance | `e53e80a` |
| **EXP-04** | Step 7 Real Lecture Academic Fidelity | Test real-world university lectures with spoken noise, digressions, and code switching | 8 Real Lectures + 1 Telugu-English Lecture | 94/94 tests passing cleanly; validated dual-source authority division | `e53e80a` |
| **EXP-05** | Experiment 4.1 Volume Scaling | Validate question scaling across $N=10$, $N=20$, $N=25$ without duplicate concepts | 14 Academic Disciplines | Replenishment ceilings scale proportionally; reserve pools prevent exhaustion | `b1b1553` |
| **EXP-06** | Experiment 4.2 Teaching Behavior Classification | Classify instructor teaching intent (Explanation, Demonstration, Exploration, Review) | 17 Curricular Teaching Units | Exploratory pilot archived; established intent-relative difficulty baseline | `b1b1553` |
| **EXP-07** | Experiment 4.2b Frozen Zero-Shot Classification | Measure zero-shot LLM intent classification accuracy against expert human labels | 17 Annotated Units | Micro-F1 0.82; identified confusion between Demonstration and Explanation | `b1b1553` |
| **EXP-08** | Experiment 4.2b-C5 C5 Parameter Locking | Calibrate and freeze decision thresholds for instructional behavior routing | Multi-Domain Corpus | Decision boundaries locked with SHA-256 hash `c5_config_lock.json` | `b1b1553` |
| **EXP-09** | Experiment 4.2b-Step3 Unseen Teacher Generalization | Test intent classification across previously unseen instructors and acoustic profiles | 5 Holdout Instructors | 88.2% generalization accuracy across unseen acoustic environments | `b1b1553` |
| **EXP-10** | Experiment 4.3 Blueprint Impact Assessment | Evaluate downstream question quality impact of behavior-conditioned blueprints | 146 Generated Items | Behavior-conditioned blueprints increased cognitive alignment by 23.4% | `b1b1553` |
| **EXP-11** | Experiment 5 Teaching Adequacy & PDI | Measure Pedagogical Delivery Index (PDI) across multimodal vs single-modality inputs | 6 Comprehensive Lecture Packages | Multi-modal guarantee PDI $\ge 0.800$; routed to UNIFIED path | `b1b1553` |
| **EXP-12** | Experiment 6 Q1 Human Educator Benchmarking | Dual-blind expert educator review of automated question generation vs human baselines | $N = 406$ Questions across 14 Disciplines | Inter-Rater Reliability (IRR) Cohen's $\kappa = 0.78$; verified academic parity | `ccf942f` |
| **EXP-13** | Rel-12 & Independent Answer Verification (IAV) | Eliminate evaluator collusion via blind solver, mathematical check, and false key rejection | Real ML & Theory Benchmarks | Caught false GAN key ($P=0.95 \to$ Rejected); prevented repair bypass | `eaba7d2` |
| **EXP-14** | Targeted MCQ Quality Improvements & 2-Lecture Validation | Eliminate polar inversion clones, SQL/DB filler in ML, giveaway adverbs, and stem verbosity | Architecture & GANs (75m) + Model Templates (10m) | 12/12 quality tests passed; deep lecture 10/10 delivered; intro lecture deficit preserved | `af9ceb9` |

---

## 2. Detailed Experiment Records

### EXP-13: Independent Answer Verification (IAV) & Macro-Window Extraction
- **Objective**: Prevent the evaluator agent (Agent 3) from blindly accepting the generator's supplied answer key or hallucinated mathematical justifications; eliminate timeout bottlenecks on long lectures.
- **Architectural Modification**:
  - Implemented `IndependentAnswerVerifier` in `server/engine/validators/independentAnswerVerifier.js`.
  - Blind Solver: Evaluator is given only the stem and options (stripped of `correctAnswer`, rationales, and generator metadata) with randomized option order.
  - Mathematical & Causal Verifier: Independently calculates derivatives, signs, invariants, and state transitions.
  - Parallel Macro-Window Extraction: Converted sequential chunk extraction into 28-second parallel macro-windows with parent-child hierarchical indexing.
- **Key Results**:
  - False GAN Key Rejection: Candidate question with mathematically inverted loss key (`log(D(G(z)))` vs `log(1 - D(G(z)))`), which previously passed Agent 3 with score 0.95, was strictly rejected by IAV.
  - Extraction latency on 75-minute lecture dropped from 180s+ to 28.4s.
  - 6 / 6 IAV acceptance regression tests passed (100%).
- **Commit Reference**: `eaba7d2`, `2114ec0`.

---

### EXP-14: Targeted MCQ Quality Improvements & Real-Lecture Validation
- **Objective**: Address specific distractor and readability defects identified during the real-lecture audit without reopening the pipeline architecture.
- **Target Defects Addressed**:
  1. *Polar Inversion Clones*: 3 distractors rephrasing the exact same Subject A vs B role reversal.
  2. *Foreign Domain Contamination*: Irrelevant SQL / relational database options appearing in machine learning questions.
  3. *Accidental Double Keys*: Distractors containing technical truths outside the lecture that become defensible answers under the question's specific stem conditions.
  4. *Giveaway Adverbs*: Test-taking cues such as "entirely eliminates" or "completely guarantees".
  5. *Subsumptive Learning Objective Collision*: Duplicate questions testing the identical operational goal of a component (e.g., Q9 and Q10 both testing the generator fooling the discriminator).
  6. *Live-Quiz Readability & Length*: Stems exceeding 28 words with formulaic clauses (*"When comparing Generative Adversarial Networks with..."*); options exceeding 140 characters.
- **Architectural & Evaluator Modifications**:
  - `difficultyAwareDistractorValidator.js`: Added 3-way polar clone detection with false-positive shields for distinct technical dimensions (memory vs time vs stability); added SQL/database foreign topic filter for ML contexts; enforced 180-char ceiling and 130-char soft threshold.
  - `deterministicValidator.js`: Added Check 5d detecting subsumptive objective collisions while explicitly protecting functional role vs loss-gradient co-existence.
  - `agent3Evaluator.js`: Updated distractor audit prompt rubric with context-aware accidental double key rejection (`ACCIDENTAL_CORRECT_DISTRACTOR`).
  - `agent2Generator.js`: Added stem brevity targets ($\le 25$ words, max 35 words, forbidding formulaic *"When [verb-ing]..."* clauses) and option brevity targets ($\le 14$ words, $\le 80$ characters).
- **Test Evidence & Results**:
  - 12 / 12 targeted quality tests passed (6 negative tests N1–N6 + 6 positive tests P1–P6).
  - Deep Technical Lecture (*Architecture & GANs*, 75m, 59,390 chars): Delivered 10 / 10 questions in Balanced mode. Average stem: 19.3 words; options: 7–13 words; zero database fillers; zero polar clones; zero giveaway adverbs.
  - Introductory Lecture (*Introduction to Model Templates*, 10m, 6,770 chars): Delivered 7 questions with `COMPLETED_WITH_CAPACITY_DEFICIT`. Hard candidate targets lacking genuine causal depth were rejected for `TIER_COGNITIVE_MISMATCH`, preserving honest capacity limits without fabricating complexity.
- **Commit Reference**: `af9ceb9`.

---

### EXP-12: Q1 Human Educator Dual-Blind Empirical Evaluation
- **Objective**: Establish whether Automated Question Generation (AQG) via the KMIT Kahoot 3-Agent Pipeline meets university-level exam standards compared to human faculty item writers.
- **Methodology**: Dual-blind review of $N = 406$ questions across 14 academic disciplines evaluated by two independent subject-matter professors per discipline.
- **Evaluation Criteria**: 
  1. Option Correctness & Key Integrity (1–4 scale).
  2. Evidence Grounding & Non-Hallucination (1–4 scale).
  3. Cognitive Demand & Blooms Level Match (1–4 scale).
  4. Distractor Plausibility & Trap Quality (1–4 scale).
  5. Live-Quiz Readability & Clarity (1–4 scale).
  6. Curricular Alignment & Relevance (1–4 scale).
- **Results**:
  - Inter-Rater Reliability (Cohen's $\kappa$): **0.78** (Substantial Agreement).
  - Overall Acceptability Rate: **91.4%** across all academic departments.
  - Distractor Plausibility Score: **3.62 / 4.00**.
  - Grounding Verification: Zero hallucinated facts detected in verified passing pool.
- **Artifacts**: `experiments/experiment_6_q1_benchmarking/blinded_eval_sheets.md`, `blinded_eval_portfolio.json`.

---

### EXP-05 to EXP-10: Phase 4 Volume Scaling & Teaching-Behavior Classifiers
- **Objectives**: Enable dynamic question-count scaling ($N=10 \to 25 \to 50$) and test whether behavior-conditioned blueprints (separating demonstration vs explanation vs exploration) improve question relevance.
- **Key Findings**:
  - Unconstrained volume scaling without evidence capacity limits causes distractor exhaustion and hallucination beyond 20 questions on short lectures ($< 30$ mins).
  - Implemented evidence capacity clamping: maximum questions recommended and delivered is mathematically bounded by detected lecture depth and concept count.
  - Behavior-conditioned blueprints achieved **23.4% higher cognitive alignment** than flat keyword prompting.
- **Artifacts**: `experiments/experiment_4_1/`, `experiments/experiment_4_2/`, `experiments/experiment_4_2b/`, `experiments/experiment_4_3_blueprint_impact/`.

---

## 3. Failed Approaches & Engineering Anti-Patterns (What NOT to Repeat)

To avoid recurring failures, the following approaches were evaluated, found fundamentally defective, and permanently deprecated:

| Deprecated Approach | Why It Failed | Permanent Replacement |
| :--- | :--- | :--- |
| **Evaluator Answer Agreement (Single-Pass)** | Evaluator agent was prompted to "check if the answer is correct". In practice, LLM evaluators suffer from confirmation bias and confirm plausible-sounding but mathematically false keys (e.g. GAN loss key error scored 0.95). | **Independent Answer Verification (IAV)**: Evaluator acts as a blind solver with zero knowledge of the proposed key. If derived answer $\ne$ proposed key, candidate is immediately rejected. |
| **Sequential Segment-by-Segment Extraction** | Iterating through audio chunks sequentially caused cumulative latency ($> 180$ seconds on 75m lectures), causing HTTP gateway timeouts (504). | **Parallel Macro-Window Extraction (28s)**: Overlapping parent windows processed concurrently with child segment indexing. |
| **Forced Question-Count Fulfillment** | Forcing the pipeline to always deliver the user's requested count (e.g. 10 questions on a 5-minute video) forced the generator to hallucinate facts outside the video or repeat identical questions. | **Honest Capacity Limitation & Capacity Deficit**: System truthfully reports `COMPLETED_WITH_CAPACITY_DEFICIT` when lecture evidence is exhausted. |
| **Surface Token Overlap for Deduplication** | Relying purely on Jaccard token overlap between options either missed paraphrased polar flips or falsely rejected legitimate algorithmic comparisons (e.g. MergeSort memory vs time tradeoffs). | **Semantic Contrast Cluster Matching + False-Positive Shields**: Uses structural comparison splitting, head subject extraction, and explicit protection for distinct technical dimensions. |
| **Generic Foreign Topic Keywords** | Blanket keyword blacklists incorrectly flagged legitimate terms (e.g., flagging "water" in computer cooling, or "trees" in computer science). | **Context-Aware Foreign Topic Signals**: Foreign checks verify both candidate options and source evidence context before flagging contamination. |

---

## 4. Benchmark Datasets & Golden Test Corpora

| Dataset Name | Location | Contents | Intended Evaluation Stage |
| :--- | :--- | :--- | :--- |
| **Golden 50-Case Benchmark** | `evaluation_dataset/golden_benchmarks/step4_50_case_benchmark.json` | 50 canonical curriculum cases across 5 disciplines | Core regression & zero-hallucination verification |
| **Real Lecture Golden Benchmark** | `evaluation_dataset/golden_benchmarks/step7_real_lecture_benchmark.json` | Real university lectures (`ARCH_05` Recursion, etc.) | Real-world spoken lecture fidelity |
| **Multi-Subject Corpora (MULTI 001–005)** | `evaluation_dataset/VOICE_PLUS_MATERIAL/` | Paired audio and slides across OS, Networks, DB, DSA, Math | Dual-source authority & PDI testing |
| **Architecture & GANs (75m)** | `server/test/fixtures/lecture_arch_gans.json` | 59,390 character spoken lecture on Deep Learning | Heavy technical volume scaling & distractor benchmarking |
| **Model Templates (10m)** | `archive/pipeline_experiment/data/transcripts/ml_madhurikamam_transcript.json` | 6,770 character introductory PyTorch lecture | Short-lecture evidence capacity & deficit verification |
