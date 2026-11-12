# Research Readiness & Teacher Testing Plan

*Written 2026-11-12, against `main` after the teacher-role work. Honest status, not a claim of completeness.*

---

## 1. Are we ready to start testing with teachers?

**Yes — for a supervised pilot, after one smoke test by you.** The pipeline runs end to end on every input type the teachers will use (Section 2), and all 9 automated test suites pass. Two things are still unverified and should be checked by you before the first teacher session:

1. **Click through the real app once yourself** (login → add input → overview + timeline + score → generate → review → publish). This has never been done with a teacher account; only the pipeline functions and the components were tested.
2. **Run one complete live class recording** (≥ 30 min) from the browser recorder, not an uploaded file.

Not ready for: production use, unsupervised use, or any claim of validated teaching quality.

---

## 2. What each test input will do

| How the teacher teaches | What you give the system | Supported? | Notes |
|---|---|---|---|
| Speaks in class | Browser recording, or audio file | **Yes** | 13 min transcribed in 6.5 s; 2 h 12 min in 53 s. Real timestamps. |
| Speaks + slides/notes | Recording + PPTX/PDF | **Yes** | Slides cross-referenced with speech; slide-only content marked. |
| Whiteboard | Photo (JPG/PNG) | **Yes** | Read by Gemini (incl. handwriting); diagrams become a one-line text description. |
| Handwritten notes | Scanned PDF | **Yes** | 24 MB scan read in 81 s. Needs Gemini quota; OCR fallback stops after ~2.5 min. |
| Codes in VS Code while explaining | Recording + pasted code | **Yes** | Code is split per construct; questions on output, tracing, debugging. |
| DBMS on command prompt | Recording + pasted session (Ctrl+A/C/V) | **Yes** | `mysql>`, `MariaDB [db]>`, Oracle `SQL>`, `psql`, `sqlite>`, Windows `C:\…>`, bash, PowerShell, Python `>>>` sessions are recognised and split per command. |
| Only a topic name | Text | Yes | Labelled "general knowledge, not your lecture"; no teaching score. |
| Diagram-heavy lecture | Photo / slides | **Partly** | Diagrams are described in text and questions can be about them, but a question cannot show an image. |

---

## 3. Question variety

Measured on 231 real generated questions, then improved:

* Supported question types: recall, concept, mechanism, **trace**, **output prediction**, **calculation**, **debugging**, **comparison**, **edge case**, **application**, **real-world scenario**. The type is chosen from what was actually taught (e.g. no output-prediction question unless code/commands were shown).
* Before the fix, ~60% of questions were concept/recall. The planner now prefers the least-used question type when several are equally valid; on saved real lectures a 10-question Balanced quiz now spans **5–7 types**.
* Not supported: image-based questions (a diagram shown inside the question). Diagram content can only be asked about in words. → future work.

---

## 4. Hard questions and wrong answer keys without a GPU server

| Problem | What is already in place | What to do for the research |
|---|---|---|
| Hard questions often fall back to Medium | Hard recipe (≥ 2 dependent steps on data in the stem), strongest model reserved for Hard generation, 3 attempts then fill at Medium, honest notice | Report Hard as a **measured limitation**, not hide it. Run the Hard experiments (E6) on days with fresh quota, in small batches, and record which model produced each question. |
| A wrong key can pass | Evaluator + independent answer check (different model family, works the problem first) + flags for duplicates and give-aways | Make **teacher review part of the method** ("human-in-the-loop"). Measure how often flags were right/wrong (E4). |
| Free quota limits | Strongest model now reserved for Hard generation, the answer check and the teaching score; batched checks (−20% calls) | Test in sessions spread across days; avoid running many lectures back to back. |

What *not* to do: report only the good runs, or present Hard-question quality as solved.

### How to prove Hard-question capability without a GPU server

Hard questions are now produced by a dedicated path: Hard targets are batched separately, use a Hard-only prompt that
forces the model to write its own **solution steps first** (≥ 2 dependent steps; fewer → discarded before review),
run on the strongest available model (Gemini 3.5-flash, else Groq `gpt-oss-120b` with full reasoning — never a light
model), and are accepted only if the reviewer judges them Hard *relative to the lecture* and the independent check agrees.

Evidence so far (handwritten statistics notes, 5 Hard requested, free tier): **0/11 candidates passed → 2/5 delivered**
after the dedicated path, e.g. a complete two-sample z-test decision (|z| = 9.906 vs 2.33 → reject H0) and a Welch
t-statistic from raw data (−2.04, hand-verified). Both confirmed by the independent check.

**Experiment E6b — Hard capability benchmark** (put this in the paper instead of hiding the limitation):
- 6–8 deep lectures/materials (statistics, OS algorithms, DBMS queries, code-heavy labs).
- For each: request Hard questions; log *every* candidate (accepted and rejected) with the model that wrote it.
- Report: acceptance rate per candidate, expert-confirmed **correctness** and **hardness** of accepted items (precision),
  number of solution steps, time per accepted Hard item.
- Baseline: the same lectures with a single "write 5 hard MCQs" prompt to the same model; experts rate both blind.
- The claim to test: *every Hard item the system delivers is correct and genuinely multi-step* (high precision), at the
  cost of yield and time — a stronger, defensible claim than "it always delivers N Hard questions".

### Generation time (measured)
10 Balanced questions from the 2 h 12 min OS lecture: **116.5 s** (batches of a round are generated and checked in parallel).
Hard-only requests take longer (≈ 3 min for 5) because every Hard candidate needs the reasoning model and a full check.

---

## 5. What you need to be sure of with people (short checklist)

**Before testing**
- [ ] Written **consent** from each teacher (recording their class) and, if students take quizzes, from students / the institution. Ask your college whether an ethics committee approval is needed — most Q1 journals require it for studies with people.
- [ ] Teachers know the score is **feedback, not an evaluation of them**.

**For every session (one row per lecture — keep a sheet)**
- [ ] Subject, topic, input types used, lecture length.
- [ ] Did the overview/timeline match what was taught? (yes / mostly / no + what was wrong)
- [ ] Requested count & difficulty → delivered count & mix.
- [ ] For each question, the teacher marks: **correct? clear? grounded in my class? difficulty right? distractors believable?** (1–4 each) and would-use / edit / reject.
- [ ] Teaching score: does the teacher agree with each dimension? Is each suggestion accurate and useful? (1–4)
- [ ] Time from input to questions.

**To make the results publishable**
- [ ] At least **2 subject experts rate the same questions independently** (gives inter-rater agreement).
- [ ] For the teaching score: 2–3 senior faculty rate the **same lectures** with the same rubric, without seeing the system's score.
- [ ] If students take the quizzes: ≥ 30 students per quiz for item statistics (the analytics page computes p, D and distractor efficiency).

---

## 6. Formulas and constants in the system (be ready to justify them)

| What | Formula | Status |
|---|---|---|
| Question capacity | Sum over teaching points of the distinct question angles each supports (rules: trace/output/debug only with code or commands; calculation only with formulas; a merely mentioned point → 1 easy; recall never Hard) | Principled; the angle list comes from the model, so it varies between runs → report variability (E2) |
| Recommended count | min(30, total ≤ 4 ? total : max(3, round(0.75 × total))) | **Heuristic constant 0.75** — justify or test sensitivity |
| Topic allocation | Largest remainder by weight = 0.5 × topic capacity share + 0.5 × teaching-time share; never above a topic's capacity | **Heuristic 50/50** — sensitivity analysis |
| Balanced mix | Proportional to capacity per difficulty | Principled |
| Teaching score | Mean of judged rubric dimensions, each 1–4 → ×25; shown only if ≥ 4 of 6 judged; every rating must cite verified evidence | Transparent, but **not validated** — needs E7 |
| Confidence | HIGH if ≥ 5 dims, ≥ 1200 words, ≥ 8 evidence items; MEDIUM if ≥ 4, ≥ 400, ≥ 5; else LOW | Heuristic thresholds |
| Relabel cap | ≤ 10% of a Balanced quiz may be relabelled to its measured difficulty | Heuristic |
| Item analysis (after students answer) | p = proportion correct; D = upper 27% − lower 27%; distractor non-functioning if chosen by < 5% or more by stronger students | **Standard classical test theory** |

The core idea — **one shared, evidence-verified model of the lecture drives question capacity, difficulty, generation and the teaching score** — is coherent and is the main contribution to argue. The constants above should be presented as design parameters with a sensitivity analysis, not as discovered truths.

---

## 7. Experiments for the paper

| # | Experiment | Data | Metric |
|---|---|---|---|
| E1 | **Lecture understanding** — are units, topics and segments correct? | 15–20 real lectures, teacher check | Precision/recall of taught points vs teacher list; segment boundary error (minutes) |
| E2 | **Stability** — same lecture analysed 3× | 10 lectures | Variance of capacity, topics, teaching score |
| E3 | **Question quality** vs baselines | Same lectures; system vs (a) one-prompt LLM with the transcript, (b) teacher-written quiz where available | Expert ratings (correct, clear, grounded, distractor plausibility), % usable without edits; inter-rater agreement (Cohen's / Fleiss' κ or Krippendorff's α) |
| E4 | **Answer-key safety** | All generated questions | % wrong keys found by experts; precision/recall of the independent-check flags |
| E5 | **Count satisfaction** | Requests 5/10/15/20/30 on short vs long lectures | Delivered / requested; honesty of shortfall messages (expert check) |
| E6 | **Difficulty calibration** | Easy/Medium/Hard requests | Expert-rated difficulty vs label (agreement); later student p-values by label |
| E7 | **Teaching score validity** | 20–30 lectures, 2–3 faculty raters | Spearman ρ / ICC between system and faculty; agreement per dimension; usefulness of suggestions (1–4) |
| E8 | **Input modalities** | audio, audio+slides, whiteboard photo, code, terminal/DB, scan | E3 metrics per modality |
| E9 | **Ablations** | Same lectures | Without slide cross-referencing; without coverage/expansion passes; without independent check; batched vs single checks |
| E10 | **Student outcomes** (if possible) | Real quizzes, ≥ 30 students | p, D, distractor efficiency; link to teaching-score dimensions (exploratory only) |
| E11 | **Teacher acceptance** | All pilot teachers | Short survey (e.g. SUS + trust/usefulness items), time saved |

---

## 8. Are we ready for a Q1 journal?

**Not yet.** The system is ready to *collect the evidence*; the paper is not ready to be written as a Q1 submission. Missing:

1. **Related work / novelty check** — a literature review of automatic question generation, LLM MCQ generation, distractor generation, and automated teaching-quality feedback. The novelty claim ("one lecture model linking teaching quality, question capacity and assessment") must be checked against this.
2. **Human evaluation** with ≥ 2 independent expert raters and reported agreement (E3, E4, E6, E7).
3. **Baselines** (E3) — reviewers will ask "better than just prompting an LLM with the transcript?"
4. **Teaching-score validity** against faculty ratings (E7) — without it, do not claim the system measures teaching quality.
5. **Student data** for item statistics (E10) — needed for any claim about discrimination or learning.
6. **Ethics approval and consent** for recording classes and using student responses.
7. **Statistics plan** fixed *before* collecting data (sample sizes, tests, which lectures are held out).

A realistic path: pilot with teachers (4–6 weeks) → E1–E9 → conference / workshop paper → add E7 and E10 → journal version.

## 9. Claims we can and cannot make today

* **Can:** the architecture; that it handles audio, slides, scans, code and command sessions; measured delivery counts and timings from Section 2 and `MCQ_PIPELINE_PROGRESS.md`; that shortfalls are reported honestly.
* **Cannot (yet):** question quality is high (no expert ratings), the teaching score measures teaching (not validated), questions discriminate between students (no student data), Hard questions are reliable, the system beats a simple LLM baseline.
