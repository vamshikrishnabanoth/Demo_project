# Proof-Gated Question Generation from Real Classroom Lectures: Lecture-Relative Difficulty, Assessment Capacity and an Evidence-Based Teaching Report

*Draft for the authors to rewrite in their own words. Numbers are from the 27 Nov 2026 evaluation runs (`experiments/input_matrix/`). References were found by web search; the authors must read and check each one.*

---

## Abstract

Teachers who want a short quiz after every class rarely have time to write one. Large language models (LLMs) can draft questions from a lecture in seconds, but a teacher cannot trust them unread: keys are sometimes wrong, questions drift outside what was taught, and "Hard" often means "longer". We present a post-class quiz platform built around a different principle: a question reaches students only if its key and its grounding have been *proven*. The system first turns any class input into a structured reading of the lecture: audio, video, slides, documents, handwritten notes, board photos, code, terminal sessions or a topic name. From that reading it computes what the lecture can be assessed on, deterministically: its assessment capacity, a difficulty scale relative to this lecture, and a blueprint chosen by importance. Questions written by an LLM are then accepted only with three proofs that are checked in code: an exact quotation from the lecture, agreement between two independent key-blind solvers, and, for value answers, a sandboxed computation that reproduces the key. The same reading yields a teaching report in which every mark is computed from measured lecture facts, and accuracy is checked on the teacher's own words. On real inputs spanning more than fifteen input types (audio, video, slides, documents, handwriting, code, terminal sessions, a topic name), three languages and lectures up to two hours, the proof step stopped wrong keys that a quality gate had passed, including computed values matching no option and a misconception shared by two models. Against a single-prompt chatbot baseline on the same lectures, our questions asked students to apply or analyze about six times as often (29% vs 5%). The teaching report separated deep from introductory teaching of the same topic (97 vs 60) and dropped when errors were planted in a lecture. The system runs on free-tier model APIs.

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
- **C4. An evaluation on real, messy classroom input.** More than fifteen input types and three languages, including same-topic lectures by two teachers, compared with a single-prompt chatbot baseline.

The platform also runs live quizzes for students with points and perks (for example, an attendance bonus or a lunch pass) that students redeem for participation. We describe this context briefly; the research contributions are C1–C4.

## 2. Related work

**Automatic question generation.** Kurdi et al. reviewed 93 studies of automatic question generation for education and classified them by purpose, knowledge source, generation method and evaluation [1]; a 2025 review notes that educational theory is still weakly integrated into generation [8]. LLMs now produce fluent MCQs: Doughty et al. compared 651 GPT-4-generated with 449 human-written programming MCQs and found them well aligned with learning objectives [2].

**From lectures to questions.** Closest to our setting, MCQs have been generated at scale from video-lecture transcripts and judged by humans, rules and LLMs [10]; context selection from transcripts and keyframes improves video-based question generation [11]; agentic workflows target all Bloom levels on engineering-course transcripts [12]; and a self-hosted lecture-to-quiz pipeline adds deterministic checks for duplicated options, multiple correct answers and numerically equivalent distractors [13]. These systems generate from the lecture; none measures what the lecture can support (capacity), calibrates difficulty to this lecture, or withholds a question until its key is proven by computation and independent solvers.

**Speech–slide alignment.** Aligning lecture speech with slides has a long history, from phoneme-level HMMs and structured SVMs to multimodal embeddings with a public benchmark [14]. We use alignment not as an end but to tell taught material from material that was only uploaded.

**Distractors.** Surveys of distractor generation cover more than 100 methods and note that automatic metrics for distractor quality remain limited [3, 7].

**Difficulty.** Difficulty has been estimated from text features, anchored to Bloom's taxonomy [1], conditioned in fine-tuned generators [15], or controlled with item response theory parameters [15]; LLM-assigned difficulty does not always match student performance [15]. We instead calibrate Easy, Medium and Hard against the depth of the specific lecture, and report how many distinct questions each level can support.

**Verification.** Sampling several reasoning paths and keeping the most consistent answer improves LLM reasoning [4], and strong LLMs agree with human preferences at roughly human-human levels when used as judges, with known position, verbosity and self-enhancement biases [5]. Programs have also been used as verifiers to improve self-consistency in math reasoning [16], and execution alone is known to show only that a program runs, not that its answer is right [16]. We differ in using verification as a *delivery gate*: two independently written programs, from different model families, must both reproduce the key, plus an exact lecture quotation and two agreeing blind solvers. Unproven questions never reach students.

**Lecture understanding and teaching analytics.** Automated feedback from class transcripts improved instructors' uptake of student contributions in a randomized trial with 1,136 instructors [6]; its authors stress transcript quality and that such tools should support, not evaluate, teachers. Teaching features have been detected from annotated lecture recordings [17], lecture style has been scored from audio and video cues [18], and LecEval uses LLMs to judge slide-based lectures, noting that LLM judges still diverge from humans [19]. Our report differs in computing every mark from measured features of the same lecture reading that drives question generation, and in checking accuracy on the teacher's verbatim statements. Unlike rubric grading by an LLM, our report computes each component from measured features and verifies factual claims on the teacher's own words.

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

**Inputs.** 33 cases in the first pass and a 15-case re-run on the final code covered:
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

*Measured on 27 Nov 2026 with free-tier models (Groq gpt-oss-120b / gpt-oss-20b / qwen3.8-27b; Gemini flash-lite). Hand review of every delivered key by the authors. Teacher rating study: §9.7 (to be added).*

### 9.1 Every input type (Table 1)

| Input | Points read | Recommended (Balanced) | Balanced 10: delivered | Generate time |
|---|---|---|---|---|
| 2-hour OS lecture (audio) | 77 | 30 | 10 | 223 s |
| Handwritten notes (scanned PDF) | 22 | 19 | 10 | 220 s |
| DOCX (Git workflow) | 26 | 24 | 10 | 43 s |
| Hindi lecture (CI/CD) | 14 | 12 | 10 | 54 s |
| Audio + PPTX (binary trees) | 25 | 23 | 9 | 161 s |
| Audio + PDF (autoencoders) | 29 | 15 | 7 | 160 s |
| Audio + SQL terminal session | 44 | 30 | 7 | 100 s |
| Video (mp4, PyTorch) | 7 | 6 | 6 | 141 s |
| Topic name only (arrays in Python) | 6 | 6 | 6 | 79 s |
| Code file only | 4–8 | 4–8 | 2–4 | 110–161 s |
| Three-line notes (stacks) | 3 | 3 | 4 | 12 s |
| Greeting / banter / prompt injection | 0 | 0 | 0, refused with reason; the injected instruction was ignored | — |

Reading the input took 39–58 s. When an input supports fewer questions than were asked for (short notes, a single video, a topic name), the system delivers about the recommended number and says why, instead of padding with repeats.

### 9.2 Assessment capacity separates deep from introductory teaching (Table 4)

| Same topic, two teachers | Points | Demonstrated | Hard capacity | Teaching report |
|---|---|---|---|---|
| Linked lists — introductory (Neso) | 5 | 1 | 2 | 60 |
| Linked lists — deep (Striver) | 23 | 11 | 12 | 97 |
| RAG — beginners | 45 | 14 | 31 | — |
| RAG — complete 2-hour | 58 | 39 | 42 | — |

The reading measures depth as the teacher delivered it: what was demonstrated vs only explained, and how many multi-step questions the lecture supports. **Delivered Hard questions did not yet follow capacity** (2 truly Hard of 5 for both linked-list lectures). The free writer models often produce one-step "Hard" questions, which the proof refuses or relabels honestly (§10).

### 9.3 What the proof step stopped (Table 3)

Questions that passed the quality gate and were stopped before delivery:

| Defect | Example | Stopped by |
|---|---|---|
| Computed value matches no option | torque: the notes' formula gives 20/4.25 ≈ 4.71; key 1.82 | computation |
| Shared misconception | binary tree of height 3: key "min 7, max 8"; an independent computation gives 4 and 15 | second computation |
| Invented tool output | a MySQL error message for a query the class never ran | code check, and computation (fixed answer) |
| Wrong claim | dot product of raw embeddings "between 0 and 1"; swapped TF-IDF/BM25 behaviour | independent solvers |
| False premise | "GPT-4 is 3 TB" used as a given | blind solver |
| Missing information | "the provided search function", "this 100-epoch training loop" without the code; an unnamed "taught algorithm"; a stem that asks nothing | code checks |

Over 489 delivered questions from the earlier runs, the code checks flag 8, and all 8 were real defects.

### 9.4 Ours vs a chatbot (Table 2)

Five lectures were judged by an independent model (gemini-3.5-flash). The judge's daily limit stopped the remaining ten.

| | Ours | Chatbot (one prompt) |
|---|---|---|
| Questions judged | 41 | 40 |
| Wrong keys (judge) | 1 | 0 |
| Apply or analyze level | **12 (29%)** | 2 (5%) |
| Remember level | 10 (24%) | 25 (63%) |
| Duplicate pairs | 2 (before fix #45) | 1 |
| Input with no deliverable quiz | 0 | 1 (returned no questions) |

The chatbot is faster (about 5 s) and always returns the requested number. On these lectures both produce few wrong keys; **the measurable difference is depth**: our questions ask students to apply and analyze far more often. Our pipeline also states what the lecture supports and what it refused. *(The judge saw the first 60,000 characters of each lecture, so "ungrounded" counts on the 2-hour lecture are not reliable for either system and are not reported.)*

### 9.5 Teaching report validity (Table 5)

| Check | Result |
|---|---|
| Deep vs introductory teaching of the same topic | Striver 97, Neso 60 |
| Uploaded slides unrelated to the lecture | material use 0/15 (matched PDF: 7.1/15) |
| Six false statements planted in a strong lecture | 83 → 72; two corrupted points flagged with their quotes |
| Material-only or non-teaching input | no report, with the reason |

### 9.6 Cost and latency

- **Tokens:** a deep 2-hour lecture used about 110k tokens of gpt-oss-120b, plus about 350k of smaller models, for a Balanced and a Hard quiz together.
- **Generation:** 12–223 s per request, with several quizzes running at once on shared free keys.
- **Lean mode:** on a server with few keys, the strong-solver tie-break and the second computation are skipped (§6).

### 9.7 Teacher rating study *(to be added)*

*Two or three faculty rate 50 delivered questions each, blind to the source, for correctness, relevance to the class, difficulty, distractor quality and usefulness. They also rate the teaching reports of 5 lectures.*

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
10. University of Michigan, "Generation and assessment of multiple-choice questions from video transcripts using large language models," 2024 (work in progress; public.websites.umich.edu/~kevynct/pubs/).
11. "Context Selection and Rewriting for Video-based Educational Question Generation," arXiv:2504.19406 (AAAI 2026).
12. "A Rigorous Evaluation of Agentic Large Language Model Workflows for Multiple Choice Question Generation in Advanced Engineering Courses," ASEE 2026 (peer.asee.org/59134).
13. "Self-hosted Lecture-to-Quiz: Local LLM MCQ Generation with Deterministic Quality Control," arXiv:2603.08729, 2026.
14. Anderer et al., "MaViLS, a Benchmark Dataset for Video-to-Slide Alignment," arXiv:2409.16765 (Interspeech 2024); Lu et al., Interspeech 2014.
15. Bloom-conditioned and IRT-based difficulty control, e.g. DiffiQG (arXiv:2505.07618) and related 2025–2026 work. *(Authors: pick the one or two you read.)*
16. "Not All Votes Count! Programs as Verifiers Improve Self-Consistency of Language Models for Math Reasoning," arXiv:2410.12608, 2024.
17. Wróblewska et al., "A Deep Learning Approach for Automatic Detection of Qualitative Features of Lecturing," arXiv:2205.14919, 2022.
18. Dimitriadou and Lanitis, "An integrated framework for developing and evaluating an automated lecture style assessment system," arXiv:2312.00201, 2023.
19. "LecEval," arXiv:2505.02078, 2025.
9. *(Optional)* Systematic review and network meta-analysis of LLM-generated MCQs in health professions education (PMC12758716), 2026.
