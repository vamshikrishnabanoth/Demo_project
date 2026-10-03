# Human Ground-Truth Benchmark & Evaluation Scorecard: Git Lecture

**Benchmark Target:** Baseline Production Pipeline Run (`controlled_git_lecture_run_01`)  
**Lecture Corpus:** `test_assets/git_lecture.mp3` (12.8 minutes audio, 10,731 characters transcript) + `test_assets/git_lecture_slides.pptx` (5 slides)  
**Auditor / SME Reviewer:** Senior Software Architect & Educational Assessment Engineer  
**Date:** 2026-10-03  
**Repository State:** `main` at `73c3e1a8a2575f8fbe15cb1d61858a74ecdf3679` (Synced with `origin/main`)  
**Raw Trace Location:** [`server/logs/debug/sessions/controlled_git_lecture_run_01/final_session_trace.json`](file:///c:/Users/samanvi/OneDrive/Desktop/git_kahoot/Demo_project/server/logs/debug/sessions/controlled_git_lecture_run_01/final_session_trace.json)  
**Raw Results Location:** [`server/logs/debug/sessions/controlled_git_lecture_run_01/controlled_benchmark_results.json`](file:///c:/Users/samanvi/OneDrive/Desktop/git_kahoot/Demo_project/server/logs/debug/sessions/controlled_git_lecture_run_01/controlled_benchmark_results.json)  

---

## 1. Executive Summary & Benchmark Purpose

This document establishes the first **Human Ground-Truth Benchmark** for the AI Live Quiz generation pipeline on an authentic 12.8-minute university classroom lecture.

While the automated production pipeline reported a self-computed "Teaching Coverage (TC) Score of 100/100", **that score reflects internal target quota fulfillment ($N=3$), not genuine pedagogical coverage of the lecture's full curriculum.**

To measure true educational quality, this benchmark:
1. Catalogs the complete **Human Reference Concept Inventory (17 distinct concepts)** taught across the spoken lecture and slide deck.
2. Performs a rigorous **Subject-Matter Expert (SME) Distractor & Derivability Audit** on the 3 delivered questions.
3. Quantifies **True Pedagogical Coverage** vs internal pipeline scores.
4. Provides a **Standardized Repeatable Scorecard** for all future benchmark runs.

---

## 2. Human Reference Concept Inventory (Ground Truth)

A comprehensive human pedagogical audit of the 12.8-minute audio transcript and 5-slide presentation identifies **17 discrete instructional concepts**, grouped into 5 thematic modules.

| Concept ID | Thematic Module | Concept Name & Description | Pedagogical Importance | Modality Source | Exact Evidence Citation | Target Cognitive Level |
| :--- | :--- | :--- | :---: | :---: | :--- | :---: |
| **REF-01** | Architecture | **Distributed vs Centralized VCS**: Git as a distributed version control system tracking history locally without requiring constant server connectivity. | **Core** | Dual (Voice + Slide 1) | Audio 00:00–00:22; Slide 1 ("Distributed version control...") | Understand |
| **REF-02** | Architecture | **Three Trees & Snapshot Model**: Working directory, Staging area (Index), and Local Repo (DAG of immutable SHA-1 snapshots, not file diffs). | **Core** | Dual (Voice + Slide 1) | Audio 03:30–04:10; Slide 1 ("Three Trees & Snapshot Model") | Understand |
| **REF-03** | Configuration | **Environment Verification (`git --version`)**: Validating local Git installation and runtime version. | **Peripheral** | Voice Only | Audio 00:40–01:05, 05:00–05:15 | Remember |
| **REF-04** | Configuration | **Author Attribution (`git config --global`)**: Setting `user.name` and `user.email` to bind developer identity to commit metadata. | **Secondary** | Voice Only | Audio 01:05–02:25 | Apply |
| **REF-05** | Core Lifecycle | **Repository Initialization (`git init`)**: Creating the hidden `.git` directory to convert a standard folder into a version-controlled repository. | **Core** | Dual (Voice + Slide 2) | Audio 02:25–03:10, 05:15–05:40; Slide 2 | Apply |
| **REF-06** | Core Lifecycle | **Working Tree Inspection (`git status`)**: Inspecting modified/untracked files; understanding red (unstaged) vs green (staged) state cues. | **Core** | Dual (Voice + Slide 2) | Audio 03:10–03:30, 05:40–06:20; Slide 2 | Apply |
| **REF-07** | Core Lifecycle | **Selective Staging (`git add <file>` vs `git add .`)**: Caching snapshot changes from working directory into the index/staging area. | **Core** | Dual (Voice + Slide 2) | Audio 03:30–04:05, 06:00–06:30; Slide 2 | Apply |
| **REF-08** | Core Lifecycle | **Commit Sealing (`git commit -m`)**: Permanently recording staged snapshots into the repository DAG with descriptive messages. | **Core** | Dual (Voice + Slide 2) | Audio 04:05–04:40, 06:30–07:05; Slide 2 | Apply |
| **REF-09** | Inspection | **Version Comparison (`git diff`)**: Inspecting unstaged line additions and deletions against the previous commit. | **Secondary** | Voice Only | Audio 04:40–05:10, 07:15–08:00 | Analyze |
| **REF-10** | Safe Undo | **Un-staging Changes (`git reset`)**: Moving files from the staging area back to the working directory without destroying file edits. | **Secondary** | Dual (Voice + Slide 5) | Audio 08:20–08:50; Slide 5 | Apply |
| **REF-11** | Safe Undo | **Discarding Modifications (`git restore .`)**: Discarding working directory edits and restoring files to the last committed state. | **Secondary** | Voice Only | Audio 08:50–09:15 | Apply |
| **REF-12** | Documentation | **Manual Page Lookup (`git help <cmd>`)**: Accessing built-in man-pages for syntax, flags, and usage examples. | **Peripheral** | Voice Only | Audio 05:10–05:35, 09:15–09:35 | Remember |
| **REF-13** | Branching | **Branch Pointers & HEAD Mechanics**: Branches as 41-byte movable pointers; HEAD as the symbolic reference to the checked-out commit. | **Core** | Slide Only | Slide 3 ("Branching, Merging & HEAD Pointer Mechanics") | Understand |
| **REF-14** | Branching | **Fast-Forward vs 3-Way Merge**: Fast-forward linear pointer advancement (zero divergence) vs synthetic merge commits (divergent histories). | **Core** | Slide Only | Slide 3 | Analyze / Evaluate |
| **REF-15** | Branching | **Merge Conflict Dynamics**: Resolution requirements when identical lines are modified incompatibly across divergent branches. | **Core** | Slide Only | Slide 3 | Analyze |
| **REF-16** | Collaboration | **Remote Synchronization**: `git remote add`, `git push -u`, `git fetch` vs `git pull` (`fetch + merge`). | **Secondary** | Slide Only | Slide 4 ("Remote Collaboration & Distributed Sync") | Understand |
| **REF-17** | Safe Undo | **Reset Levels & History Manipulation**: `--soft` vs `--mixed` vs `--hard`; `git revert` forward-moving inversion; Detached HEAD state. | **Secondary** | Slide Only | Slide 5 ("Reset, Revert & Safe History Manipulation") | Analyze / Evaluate |

---

## 3. Detailed Audit of Delivered Questions

### Question 1 (Q1)
* **Question Text:** Which statement correctly defines Git and explains why its distributed nature is useful?
* **Mapped Reference Concept:** **REF-01** (Distributed vs Centralized VCS)
* **Cognitive Dimension:** Conceptual (Bloom: Understand)
* **Intended Difficulty:** Easy | **Realized Difficulty:** Easy
* **Assigned Key:** `B`

#### Options & Distractor Rationale
| Option | Text | Key Classification | Misconception / Distractor Analysis |
| :---: | :--- | :---: | :--- |
| A | Git is a programming language designed for writing automation scripts. | Incorrect | **Category Mistake:** Tests whether students confuse developer tools/utilities with programming languages (e.g., Python/Bash). Plausible for complete novices. |
| B | Git is a distributed version control system that helps developers track changes in their projects. | **CORRECT** | **Accurate Definition:** Verbatim alignment with both spoken audio and slide definitions. |
| C | Git is a centralized version control system that stores all code on a single server. | Incorrect | **Architectural Inversion:** Directly targets the classic misconception confusing Git with centralized VCS architectures (SVN/CVS). Highly diagnostic. |
| D | Git is a project management tool used for assigning tasks and tracking time. | Incorrect | **Functional Confusion:** Confuses version control systems with project management software (Jira, Trello, Asana). Useful for identifying workplace tool confusion. |

* **SME Evaluation:** **EXCELLENT.** The distractors are distinct, non-overlapping, and test genuine conceptual boundaries without linguistic giveaway clues.

---

### Question 2 (Q2)
* **Question Text:** Which Git command moves the changes from the working directory into the staging area for all modified files?
* **Mapped Reference Concept:** **REF-07** (Selective Staging via `git add`)
* **Cognitive Dimension:** Flow / Trace (Bloom: Apply)
* **Intended Difficulty:** Medium | **Realized Difficulty:** Easy–Medium
* **Assigned Key:** `D`

#### Options & Distractor Rationale
| Option | Text | Key Classification | Misconception / Distractor Analysis |
| :---: | :--- | :---: | :--- |
| A | `git push origin main` | Incorrect | **Remote Stage Leap:** Tests whether students confuse staging files locally with publishing commits to a remote host. |
| B | `git commit -m "message"` | Incorrect | **Lifecycle Phase Skip:** Tests whether students conflate staging (preparing the snapshot) with committing (sealing the snapshot into the DAG). |
| C | `git status` | Incorrect | **Inspection vs Action:** Tests whether students confuse passive state observation with active staging mutation. |
| D | `git add .` | **CORRECT** | **Accurate Syntax:** Correct command and dot argument for staging all modified working directory files. |

* **SME Evaluation:** **STRONG.** Options represent distinct lifecycle phases. Note that `git commit -a -m` was avoided, keeping the distractor cleanly focused on the three-area workflow taught in this introductory lecture.

---

### Question 3 (Q3)
* **Question Text:** Which of the following statements accurately describes the scenario in which Git performs a fast‑forward merge?
* **Mapped Reference Concept:** **REF-14** (Fast-Forward vs 3-Way Merge)
* **Cognitive Dimension:** Comparison / Tradeoff (Bloom: Evaluate)
* **Intended Difficulty:** Hard | **Realized Difficulty:** Medium–Hard
* **Assigned Key:** `C`

#### Options & Distractor Rationale
| Option | Text | Key Classification | Misconception / Distractor Analysis |
| :---: | :--- | :---: | :--- |
| A | Merge conflicts occur only when a branch has no common ancestor with the target branch. | Incorrect | **False Technical Constraint:** Plausible misconception about merge conflict preconditions. |
| B | A 3‑way merge always results in a merge conflict. | Incorrect | **Deterministic Over-generalization:** Tests the student belief that branching divergence inevitably causes conflict, ignoring clean automatic 3-way merges. |
| C | Fast-forward merge moves the branch pointer forward linearly when no divergence exists. | **CORRECT** | **Technically Precise:** Accurately reflects linear pointer mechanics defined in Slide 3. |
| D | Fast-forward merge is used when branches have diverged and a new merge commit is created. | Incorrect | **Direct Definition Inversion:** Directly swaps the definition of 3-way merge into fast-forward merge. |

* **SME Evaluation:** **HIGH QUALITY.** Tests structural understanding of Git DAG mechanics rather than rote memorization. Distractor B and D are particularly effective for identifying students who don't understand divergence.

---

## 4. Coverage Analysis: Pipeline Score vs Ground Truth

| Metric | Internal Pipeline Report | Human Ground-Truth Audit | Discrepancy Analysis |
| :--- | :---: | :---: | :--- |
| **Teaching Coverage (TC) Score** | `100 / 100` | `3 / 17 Concepts (17.6%)` | The pipeline's TC score measures internal satisfaction of requested targets ($N=3$), **not total lecture curriculum coverage**. |
| **Core Concepts Covered** | 3 / 3 (100% of generated) | 3 / 8 Core Concepts (37.5%) | Generated questions covered REF-01, REF-07, and REF-14. Core concepts REF-02, REF-05, REF-06, REF-08, and REF-13 were unaddressed. |
| **Cognitive Dimension Diversity** | 3 Dimensions | 3 / 5 Target Dimensions | Good distribution across Conceptual, Flow/Trace, and Comparison. Procedural troubleshooting and prerequisites were unexercised. |
| **Dual-Source Material Utilization** | UNIFIED Mode (PDI=0.98) | 2 Voice-dominated, 1 Slide-dominated | Q1 & Q2 drew primarily from spoken audio; Q3 drew exclusively from Slide 3. Dual-source cross-referencing worked as intended. |

---

## 5. Subject-Matter Distractor Review Summary

| Evaluation Dimension | Rating (1–5) | SME Notes |
| :--- | :---: | :--- |
| **Technical Accuracy** | **5.0 / 5.0** | All correct keys are 100% indisputable; explanations cite exact transcript/slide evidence. |
| **Distractor Plausibility** | **4.7 / 5.0** | Incorrect options reflect genuine misconceptions (SVN centralized model, phase skipping, merge confusion). |
| **Option Exclusivity** | **5.0 / 5.0** | No overlapping options, no additive parameter variants (`--flag1`, `--flag1 --flag2`), zero ambiguity. |
| **Absence of Clues** | **4.7 / 5.0** | Option lengths are relatively balanced; correct answers do not contain grammatical giveaway qualifiers. |
| **Key Position Balance** | **5.0 / 5.0** | Keys distributed across B, D, and C (zero position clustering). |

---

## 6. Standardized Repeatable Scorecard Template

To evaluate future runs across larger question batches ($N=5, 10$) and other lecture topics, record results against this standardized scorecard:

```markdown
### Benchmark Scorecard: [Session ID / Topic]
- **Run Date:** YYYY-MM-DD
- **Target Commit:** [Git SHA]
- **Input Modalities:** [Audio duration / Document page count]
- **Requested / Delivered Count:** [N_req / N_deliv]

#### Quantitative Metrics
1. **Factuality & Evidence Grounding Rate:** ___% (Target: >= 95%)
2. **Human Reference Coverage (Core):** ___% ([Covered] / [Total Core])
3. **Human Reference Coverage (Total):** ___% ([Covered] / [Total Concepts])
4. **Distractor Quality Score (SME Audited):** ___ / 5.0 (Target: >= 4.5)
5. **Answer Key Entropy (A/B/C/D Split):** [A: %, B: %, C: %, D: %] (Target: ~25% each)
6. **Agent 3 Diagnostic Match Rate:** ___% (Provisional until domain-stratified rubric is designed)
7. **End-to-End Latency:** ___ ms
```

---

## 7. Governance Rulings on Open Issues

### 7.1 Agent 3 Evaluation Architecture
* **Ruling:** **Do NOT integrate experimental P5.3 candidates (v1.1.0 or v1.2.0) into production Agent 3.**
* **Rationale:** As proven in Phase 8, P5.3 failed Release Gate 6 calibration due to severe cross-domain rule collisions (e.g. formal truth-valuation logic interfering with classical probability).
* **Next Action:** Conduct an isolated, offline research study on **Domain-Stratified Rubrics** before altering production Agent 3.

### 7.2 Python Service Probe Latency
* **Ruling:** **Do NOT bypass or remove the 2.5-second Python probe without strict environment verification.**
* **Rationale:** While Render currently deploys only Node.js, developer and GPU-accelerated local deployments (`AI_SERVICE_URL: 8000`) rely on this probe for local Faster-Whisper execution.
* **Safe Protocol:** If optimization is required in the future, gate the bypass strictly behind an environment flag (e.g. `if (process.env.RENDER || process.env.SKIP_LOCAL_AI_PROBE)`), and verify that local GPU environments remain unaffected with before-and-after latency benchmarks.
