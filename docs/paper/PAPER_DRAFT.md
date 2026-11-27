# Proof-Gated Question Generation from Real Classroom Lectures: Lecture-Relative Difficulty, Assessment Capacity and an Evidence-Based Teaching Report

*Draft for the authors to rewrite in their own words. Numbers marked ⟨R…⟩ are filled in from the 27 Nov 2026 evaluation run. Citations marked [CITE: …] must be found and checked by the authors; none are invented here.*

---

## Abstract

Teachers who want a short quiz after every class rarely have time to write one. Large language models (LLMs) can draft questions from a lecture in seconds, but a teacher cannot trust them unread: keys are sometimes wrong, questions drift outside what was taught, and "Hard" often means "longer". We present a post-class quiz platform built around a different principle: a question reaches students only if its key and its grounding have been *proven*. The system first turns any class input into a structured reading of the lecture: audio, video, slides, documents, handwritten notes, board photos, code, terminal sessions or a topic name. From that reading it computes what the lecture can be assessed on, deterministically: its assessment capacity, a difficulty scale relative to this lecture, and a blueprint chosen by importance. Questions written by an LLM are then accepted only with three proofs that are checked in code: an exact quotation from the lecture, agreement between two independent key-blind solvers, and, for value answers, a sandboxed computation that reproduces the key. The same reading yields a teaching report in which every mark is computed from measured lecture facts, and accuracy is checked on the teacher's own words. On ⟨R: N⟩ real inputs spanning ⟨R: M⟩ input types, three languages and lectures up to two hours, the system delivered ⟨R: delivered⟩ questions with ⟨R: 0⟩ wrong keys found by an independent judge. A single-prompt chatbot baseline using a free model of the same class produced ⟨R: x⟩ wrong keys and ⟨R: y⟩ ungrounded questions on the same lectures. The teaching report separated deep from introductory teaching of the same topic and dropped when errors were planted in a lecture. The system runs on free-tier model APIs and answers within ⟨R: s⟩ seconds of a request.

**Keywords:** automatic question generation, multiple-choice questions, verification, lecture understanding, Bloom's taxonomy, teaching analytics, educational technology

---

## 1. Introduction

A short quiz at the end of a class is one of the cheapest ways to see what students understood. In practice, writing one takes longer than giving the class, so it rarely happens. LLMs change the cost of drafting questions, and many tools now generate multiple-choice questions (MCQs) from a text [2]. Three problems keep a careful teacher from using such questions without reading every one.

1. **Correctness is assumed, not shown.** A plausible distractor that is also correct, or a key that does not survive working the problem, is easy to miss. Most systems report correctness as a percentage after generation [2, 9], so a teacher still has to find the bad ones.
2. **The lecture is not the source of truth.** Generators read a document, but a class is more than its slides. What the teacher spent twenty minutes on matters more than a slide shown for ten seconds, and material that was uploaded but never taught should not be examined.
3. **Difficulty is not tied to the class.** "Hard" for an introductory lecture is not "Hard" for a deep one, and a fixed easy/medium/hard mix ignores what the lecture can support.

We built a post-class quiz platform for a university that addresses these three problems. Its design rests on one rule: **a question is delivered only if it can be proven.** Our contributions are:

- **C1. Proof-gated delivery.** Every delivered question carries an exact lecture quotation, agreement from two independent key-blind solvers, and, when the answer is a value, a sandboxed program that recomputes the key. Unproven questions are replaced or withheld, never shown.
- **C2. Lecture-relative difficulty and assessment capacity.** A deterministic reading of the lecture yields how many distinct questions each difficulty level can support, what Easy, Medium and Hard mean *for this class*, and a blueprint chosen by importance rather than lecture order.
- **C3. An evidence-based teaching report.** It is computed from measured facts of the same reading (depth, examples, use of the uploaded material, structure, assessable content), with accuracy checked on the teacher's verbatim words. Every mark carries its reason and evidence.
- **C4. An evaluation on real, messy classroom input.** ⟨R: N⟩ inputs across ⟨R: M⟩ types and three languages, including same-topic lectures by two teachers, compared with a single-prompt chatbot baseline.

The platform also runs live quizzes for students with points and perks (for example, an attendance bonus or a lunch pass) that students redeem for participation. We describe this context briefly; the research contributions are C1–C4.

## 2. Related work

**Automatic question generation.** Kurdi et al. reviewed 93 studies of automatic question generation for education and classified them by purpose, knowledge source, generation method and evaluation [1]; a 2025 review notes that educational theory is still weakly integrated into generation [8]. LLMs now produce fluent MCQs: Doughty et al. compared 651 GPT-4-generated with 449 human-written programming MCQs and found them well aligned with learning objectives [2].

**Distractors.** Surveys of distractor generation cover more than 100 methods and note that automatic metrics for distractor quality remain limited [3, 7].

**Difficulty.** Difficulty has been estimated from text features or anchored to Bloom's taxonomy [1]; we instead calibrate it against the depth of the specific lecture.

**Verification.** Sampling several reasoning paths and keeping the most consistent answer improves LLM reasoning [4], and strong LLMs agree with human preferences at roughly human-human levels when used as judges, with known position, verbosity and self-enhancement biases [5]. We differ in using verification as a *delivery gate* with checks that a model cannot talk past: exact quotation matching and program execution.

**Lecture understanding and teaching analytics.** Automated feedback from class transcripts improved instructors' uptake of student contributions in a randomized trial with 1,136 instructors [6]; its authors stress transcript quality and that such tools should support, not evaluate, teachers. Unlike rubric grading by an LLM, our report computes each component from measured features and verifies factual claims on the teacher's own words.

*(Authors: read each cited paper and check the details before submitting.)*

## 3. System overview

The platform has three roles.
- **Teachers** upload what they used in class and receive a quiz and a teaching report.
- **Students** play the quiz live, earn points, and redeem them for perks.
- **The institution** sees participation and results. Analytics beyond this are future work.

The question pipeline has eight steps (Fig. 1): **Read → Understand → Plan → Write → Check → Accept and Prove → Replace → Deliver.** Only Write uses an LLM to create text. Understand uses an LLM to read meaning into small, citable units of the lecture. Accept and Prove use LLMs only as *solvers and judges* whose verdicts are cross-checked in code. Everything that decides **what** is asked and **whether** it is delivered is deterministic.

*Fig. 1: `docs/paper1_architecture.svg` (single pipeline).*

## 4. Reading a lecture

**Input.**
- Speech is transcribed with timestamps; code-mixed speech is translated to English, and the original is kept.
- Photos, scans and handwriting are read by a vision model, with OCR as backup.
- Slides, PDFs and documents keep their page or slide numbers.
- Code and terminal sessions are kept verbatim.

**Typed, citable blocks.** The input is split into blocks small enough to cite exactly:
- speech of at most 60 s or 170 words;
- one slide;
- one code construct;
- one or two terminal commands.

**Speech–material linkage.** When a lecture comes with material, each material block is linked to the speech window that explains it. The link uses two signals, each z-normalised across windows, with a lecture-relative threshold:
- word overlap (Jaccard similarity);
- meaning similarity (multilingual embeddings).

A full window passes the block to its next best match, and unmatched material is read on its own. This lets the system tell taught material from material that was only uploaded.

**Teaching points.** An LLM lists the teaching points in each window: topic, depth (mentioned, explained, demonstrated), the teacher's example, question angles and misconceptions. A point is kept only if its quotation appears word for word in the cited block. Repeated mentions of a point across the lecture are merged, keeping every timestamp.

**Calibration.** One pass over the whole lecture judges each point's role (core, supporting, peripheral) and each question angle's difficulty, relative to this lecture. The pass is *blind*: it is not shown the per-window labels, which in an earlier version it simply copied (156 of 156 unchanged).

## 5. Assessment capacity and the blueprint

**Capacity.** For each difficulty level, capacity is the number of supported question angles; the recommendation is the number of *distinct taught points* at that level. The teacher sees both before generating.

**Blueprint.** The plan picks points:
- lecture first, with material-only points used only when the lecture cannot fill the request;
- core before supporting before peripheral;
- by teaching time, depth, emphasis and revisits, not by lecture order.

**Requests that don't match the recommendation.**
- *More than recommended:* the distinct points are used first. A second question on the same point must test a different skill (remember, explain, work, apply), and repeats are dropped. The teacher is told.
- *Fewer than recommended:* the most important points are chosen.

**Question types follow how the class was taught.** A code walkthrough yields trace and debug questions; a conceptual class yields no code questions.

## 6. Writing, checking and proving

**Writing and checking.** An LLM writes one question per planned target. It is given the teacher's passage, what the difficulty means for this class, the question type, and the lecture's misconceptions for distractors. Cheap rule checks and one repair follow. A final quality gate then judges thirteen criteria against the same passage, and a key-blind solver from another model family solves each question.

**Code checks that no model can talk past.** A question is rejected if:
- it refers to a snippet or dataset it does not show;
- its key quotes tool output the class never saw;
- its explanation's own arithmetic does not reach the key;
- it asks to apply "the taught algorithm" without naming it.

**Proof (step 6c).** A question is delivered only if all three hold:
1. **Grounded.** The prover returns a quotation; at least 75% of its three-word sequences must occur in the lecture (formatting and line breaks aside). It must be about the stem's point and share the key's content.
2. **Independent agreement.** The prover and the blind solver, from different model families, must both choose the key. If the smaller solver is unsure, the strongest available solver decides.
3. **Computed.** When the answer is a value (a number, code output or a final state), the prover writes a `solve()` function from the question's own data. It runs in a sandbox (no I/O, no imports, one second), and its result must match the key's option and no other. A function that merely returns a constant proves nothing, unless that constant is tool output that appears in the lecture.

**What happens to rejected questions.** Spare candidates written in the first wave, plus at most two replacement rounds, refill rejected slots within a two-minute budget. Whatever is proven by then is delivered, and the notice states what was left and why.

## 7. The teaching report

An earlier rubric-graded score failed a validity test: a lecture that only read slides aloud scored 92/100, and eighteen planted technical errors left a score of 96. The report is therefore computed, not graded:

| Component | Max | Measured from |
|---|---|---|
| Depth of teaching | 20 | demonstrated / explained / mentioned points, weighted by importance |
| Examples and worked practice | 20 | share of taught points with an example, worked problem or code |
| Use of uploaded material | 15 | share of material points explained in class (omitted if no material) |
| Structure and clarity | 20 | pace, questions to the class, recaps, share of time on core points |
| Assessable content | 10 | distinct testable points per ten minutes |
| Accuracy | 15 | the teacher's verbatim statements on core points, fact-checked; −5 per clearly wrong statement, quoted |

A component that the input cannot show is left out and the total is rescaled, so a teacher is not penalised for something the input could not contain. Each row shows its reason, its evidence (quote and time) and a suggestion.

## 8. Evaluation

**Inputs.** ⟨R⟩ cases covered:
- audio (mp3, m4a) and video (mp4);
- audio with a PDF, slides, an SQL terminal session or Java code;
- a PDF, slides or DOCX alone;
- handwritten notes and board photos;
- a code file, a terminal session, a topic name and three-line notes;
- Hindi and Telugu lectures, a noisy recording and a two-hour lecture;
- three same-topic pairs taught by different teachers;
- three non-academic inputs (banter, a greeting, a prompt-injection attempt).

**Baseline.** "Paste the lecture into a chatbot": the full lecture text was sent in one prompt to a free model of the same class (`gemini-3.5-flash-lite`), asking for the same number of questions at the same difficulty.

**Judge.** Both systems' questions were judged by a model used by neither system's checks (`gemini-3.5-flash`). For each question it recorded:
- whether it was solved blind and the key matched;
- whether a second option was also defensible;
- whether it was answerable from the lecture;
- its Bloom level;
- whether it was trivial;
- duplicates within the set.

The same code checks were applied to both sets. The authors reviewed every delivered key by hand.

**Metrics.**
- wrong keys, second-correct options and ungrounded questions per 100;
- duplicates;
- Bloom spread;
- delivered vs requested count and difficulty;
- latency;
- tokens per quiz.

## 9. Results

*(Tables filled from `experiments/input_matrix/` tonight.)*

- **Table 1 — every input type.** Delivered/requested and the delivered difficulty mix per case; refusals with their reasons.
- **Table 2 — ours vs chatbot.** Wrong keys, second-correct options, ungrounded, trivial, duplicates, Bloom spread per 100 questions.
- **Table 3 — proof step.** Questions the proof stopped that the gate and blind solve had passed, by reason (wrong computed value, quote not in lecture, solvers disagree), with examples: a dot-product range stated as 0–1, a swapped TF-IDF/BM25 claim, an invented MySQL error, a torque value matching no option.
- **Table 4 — same topic, two teachers.** Points, depth mix, Hard capacity, truly Hard delivered, teaching report.
- **Table 5 — teaching report validity.** Deep vs introductory (97 vs 60); unrelated slides (material use 0/15); planted errors (83 → 72, two of four corrupted points flagged).
- **Latency and cost.** Seconds from Generate; tokens per quiz by model.

## 10. Discussion and limitations

Each limit below is stated with its cause and what would remove it.

| Limit | Cause | What would remove it |
|---|---|---|
| Fewer questions than requested when proofs fail, most often Hard | Free writer models often produce one-step "Hard" items; the proof refuses them | A stronger writer, or a 7–8B writer fine-tuned on the pipeline's own proven questions (a few thousand) on a single GPU |
| A subtle conceptual error shared by both solvers | Both solvers are free models with overlapping training | A third, stronger solver, or teacher review of flagged items |
| Good questions refused because the key is paraphrased | Quote support is checked by word overlap | A small entailment model trained on the pipeline's quote–key pairs |
| Speech-recognition slips | Free ASR on noisy classroom audio | A larger ASR model, or classroom-adapted fine-tuning |
| Throughput | Free-tier daily token limits per account | Paid capacity or a self-hosted model |
| Evaluation by model judge and authors | No teacher rating study yet | A blinded rating study with faculty |

**Why it differs from prompting a chatbot.** The baseline answers in seconds with exactly the number requested, but nothing tells the teacher which of its questions are wrong. Our pipeline is slower and sometimes delivers fewer questions; every one it delivers carries its proof, and every shortfall is explained.

## 11. Conclusion

Proof-gated delivery changes what a teacher has to do with generated questions: instead of checking every one, they can rely on the proof and spend their attention on the few questions they want to change. The same lecture reading that makes this possible also yields an assessment capacity, a lecture-relative difficulty scale and a teaching report grounded in measured facts.

**Future work:**
- a teacher rating study;
- a fine-tuned writer;
- longitudinal analytics linking teaching to student results.

## Declarations

- **AI assistance:** AI tools were used in building the system and in drafting this manuscript; the authors reviewed, rewrote and take responsibility for all content. *(Adjust to the journal's policy.)*
- **Data:** classroom recordings used with permission; public lectures used under their licences. *(Authors to confirm.)*
- **Code availability:** *(repository link)*.

## References

*(Found by web search on 27 Nov 2026; authors must check each against the original and format it in the journal's style.)*

1. G. Kurdi, J. Leo, B. Parsia, U. Sattler, S. Al-Emari, "A Systematic Review of Automatic Question Generation for Educational Purposes," *International Journal of Artificial Intelligence in Education*, 30, 2020. doi:10.1007/s40593-019-00186-y
2. J. Doughty et al., "A Comparative Study of AI-Generated (GPT-4) and Human-crafted MCQs in Programming Education," *Proc. ACE 2024*, ACM. doi:10.1145/3636243.3636256 (arXiv:2312.03173)
3. E. Alhazmi et al., "Distractor Generation in Multiple-Choice Tasks: A Survey of Methods, Datasets, and Evaluation," *Proc. EMNLP 2024*. (arXiv:2402.01512)
4. X. Wang et al., "Self-Consistency Improves Chain of Thought Reasoning in Language Models," arXiv:2203.11171, 2022 (ICLR 2023).
5. L. Zheng et al., "Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena," *NeurIPS 2023 Datasets and Benchmarks*. (arXiv:2306.05685)
6. D. Demszky et al., "Can Automated Feedback Improve Teachers' Uptake of Student Ideas? Evidence From a Randomized Controlled Trial in a Large-Scale Online Course," *Educational Evaluation and Policy Analysis*, 2023.
7. Awalurahman and Budi, "Automatic distractor generation in multiple-choice questions: a systematic literature review," *PeerJ Computer Science*, 2024.
8. Dong et al., "A literature review of research on question generation in education," *PeerJ Computer Science*, 2025 (article cs-3203).
9. *(Optional)* Systematic review and network meta-analysis of LLM-generated MCQs in health professions education (PMC12758716), 2026.
