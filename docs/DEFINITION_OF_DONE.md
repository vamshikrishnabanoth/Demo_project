# Definition of done — one paper, one product (27 Nov 2026)

**Product:** KMIT Kahoot — a post-class quiz platform with three roles.
- **Teacher:** gets proven MCQs from any class input, plus a teaching report.
- **Student:** plays a live quiz with perks (attendance +1%, lunch pass).
- **Institution:** gets analytics; this part is optional for this paper.

**Paper:** one paper describing the complete product. The research contribution is the MCQ pipeline and the teaching score. The live quiz and perks are described as the deployed system and its context.

## 1. What we claim (and only this)

| # | Claim | Evidence we have / will have tonight | Status |
|---|---|---|---|
| C1 | **Any class input → MCQs.** Covers audio, video, slides, PDF (typed, scanned or handwritten), DOCX, board photos, code, terminal sessions, a topic name and short notes, in English, Hindi and Telugu. Non-academic input is refused with a reason. | Input matrix of 33 cases (pass 1, 27 Nov) and a subset re-run tonight | Pass 1: every input type read and answered. Re-run pending |
| C2 | **No wrong key, no ungrounded question is delivered.** Every delivered question carries three proofs: an exact lecture quote, agreement from two independent key-blind solvers, and, for value answers, a sandboxed computation that reproduces the key. Unproven questions are never shown. | Proof-step logs, code checks run over every delivered question, hand review of keys | Live probes: every pass-1 wrong key stopped. Re-run pending |
| C3 | **Difficulty is relative to the lecture.** Easy, Medium and Hard are Bloom-anchored and calibrated against this class's own depth, so deeper lectures give more truly Hard questions. | Same-topic two-teacher pairs (Neso vs Striver, RAG beginners vs RAG 2 h) | Pass 1 was mixed (one pair was inverted). Re-run pending |
| C4 | **Assessment capacity.** The system tells the teacher how many distinct questions per difficulty this lecture can support, and why. It never pads with repeats. | Capacity vs delivered counts, and the notices shown to the teacher | Works (short notes → honest 3–5) |
| C5 | **Better than "paste the lecture into a chatbot".** On the same inputs, a single-prompt baseline using the same free model is compared with our pipeline. Measures: wrong keys, ungrounded or outside-syllabus questions, duplicates, the difficulty mix asked vs delivered, and questions on content the class never covered. | Baseline experiment tonight on the subset | To do |
| C6 | **A teaching report from the lecture.** Each mark has a reason and evidence: material used, examples, depth, structure, clarity, and accuracy (claims checked). | Teaching score v2, computed from measured lecture facts. Validated on strong/weak/planted-error lectures | v1 failed validity (22 Nov). v2 tonight |
| C7 | **Practical.** Within 2 minutes from clicking Generate, and within 5 minutes from upload to questions on screen, on free-tier models. | Latency per quiz (read time plus generate time), tokens per quiz | Today 2–8 min. Time budget tonight |
| C8 | **Request vs recommendation.** Asking for more than the lecture supports gives the teacher the distinct points first and says so. A second question on the same point must test another skill (remember / explain / work / apply), and repeats are dropped. Asking for fewer chooses by importance (core before peripheral), not by lecture order. | Short notes (3 points asked for 10), the 2-hour lecture asked for 5 and 10, the notices shown to the teacher | Works (design tests D13, D28, D31). Shown in the results |

### Candidate claims considered, and where they go

| Idea | Is it a real, distinct contribution? | Decision |
|---|---|---|
| **Cross-modal linkage** (what was said ↔ what was shown on slides or documents) | Yes, partly new: hybrid lexical + embedding linkage with a lecture-relative threshold, used to rank what the class actually covered. Most MCQ generators read one document | **Mechanism claim inside C1/C3.** Evidence: unrelated slides are correctly reported as "not covered" (C05); lecture-first planning. No linkage accuracy number tonight (that needs hand-labelled speech–slide pairs) |
| **Question quality** | Every MCQ paper claims it, so it isn't unique by itself. What is unique is *how* it's assured (C2 proofs plus code checks) | **Reported as measured outcomes inside C5:** gate pass rate, defects per 100 vs the baseline |
| **Distractor quality by difficulty** | Somewhat new: distractors drawn from the lecture's own misconceptions, with plausibility rising with tier, and throwaway or second-correct distractors caught | **Inside C5:** "second defensible option" and "throwaway distractor" counts, ours vs the baseline |
| **Question variety** | Somewhat new: question types follow how the teacher taught (code walkthrough → trace/debug; conceptual class → no code), plus skill families | **Inside C5/C8:** type mix ours vs the baseline; the teaching-style examples |

These four are supporting results, not separate headline claims. Reviewers reward three or four strong, proven claims more than eight thin ones. Headline: **C2** (proven delivery), **C3+C4** (lecture-relative difficulty and capacity), **C5** (vs a chatbot), **C6** (teaching report). C1, C7 and C8 show that it works as a product.

## 2. What is deterministic (not "send it to an LLM")

| Step | Kind | What it does |
|---|---|---|
| Typed blocks, timestamps, slide numbers | algorithm | Splits input into citable units |
| Speech–material linkage | algorithm (Jaccard plus embedding z-score, lecture-relative threshold) | Links what was said to what was shown |
| Revisit merging, teaching time per topic, importance | algorithm | Builds the course memory of one class |
| Assessment capacity and blueprint (count by importance, lecture first, Bloom tiers) | algorithm | Decides what to ask before any question is written |
| Skill families, duplicate check by meaning | algorithm and embeddings | Gives variety without repeats |
| Code checks | rules | Catches a snippet named but not shown, invented tool output, a numeric key the working doesn't reach, an unnamed "taught algorithm" |
| Key proof | sandboxed program execution and quote matching | Proves value keys by computing them; checks the lecture quote by exact 3-gram match |
| Two-solver agreement | protocol over two independent models | Neither model's say-so alone delivers a question |
| Key pools, size-aware calls, waiting out limits | systems | Runs on the free tier |

The LLM is used for: reading meaning into units, writing the question, and judging it. Everything that decides **what** is asked and **whether** it is delivered is an algorithm or a check that a model cannot talk past.

## 3. Known limits — the exact cause and what would remove each one

| Limit | Cause | What removes it | Needs |
|---|---|---|---|
| Fewer questions than asked when proofs fail (most often Hard) | The free writer models often produce one-step "Hard" questions, and strict proof refuses them | A stronger writer model, or a writer fine-tuned on proven multi-step questions | Paid API, or a GPU to fine-tune a 7–8B model on the pipeline's own proven questions (about 2–5k) |
| A conceptual key that is subtly wrong but that both solvers agree on | Both solvers are free models and can share the same misconception | A third, stronger solver, or expert review on a sample | Paid model, or a teacher in the loop (the teacher can replace a question in one click) |
| Proof falsely refuses a good question whose key is paraphrased | The quote-support check uses word overlap | A trained entailment model (quote ⇒ key) | A small NLI model fine-tuned on the pipeline's own data; CPU is enough |
| Speech-recognition slips ("headphone" for "head pointer") | Free ASR on noisy classroom audio | A better ASR model, or classroom-adapted fine-tuning | A GPU for Whisper large, or a paid ASR |
| Throughput: a deep quiz uses a large share of one free account's daily budget | Free-tier daily token limits per account | A paid tier, or a self-hosted model | Paid API, or a GPU server |
| Latency over 2 minutes for long or deep lectures | Sequential replacement rounds and per-minute token limits | A time budget (deliver what is proven by the deadline), plus caching | Tonight: time budget. Later: paid throughput |

## 4. Teaching score v2 (tonight): measured, explained, and not the LLM's opinion

The score is built from lecture-model facts. An LLM is used only to check claims, never to grade.

| Component | Measured from | Max |
|---|---|---|
| Material used | Share of the uploaded material's topics that the lecture actually explained (linkage) | 15 |
| Depth | Share of points demonstrated or explained, versus only mentioned | 20 |
| Examples and practice | Examples, worked problems and code shown per teaching point (teaching style profile) | 20 |
| Structure and clarity | Revisits and recaps, time balance across topics, pace in range, questions put to the class | 20 |
| Assessable content | Distinct taught points per hour (assessment capacity) | 10 |
| Accuracy | Claims disputed by the key-blind solvers and confirmed wrong by the tie-breaker. Each one deducts, with its quote | 15 |

Every mark is shown with its reason and the evidence (quote or timestamp). Validation: the weak vs strong lectures from 22 Nov, and a lecture with planted errors. The score must drop for both.

## 5. Tonight (keys: the last 8 accounts; nothing past 12:00)

1. Time budget so a quiz returns within 2 minutes of Generate with whatever is proven, and the notice reports the rest.
2. Teaching score v2, plus its validity check.
3. Subset run (15 cases), with token cost per case. Baseline experiment (C5) on the same cases.
4. Review, results tables, GO/no-GO.
5. If GO: merge, push, deploy, live check. Then the paper draft.
