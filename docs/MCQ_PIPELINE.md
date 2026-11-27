# The MCQ pipeline

One path for every input: lecture audio, audio with supporting material, material only (PDF, slides, a photo of the
whiteboard, code, pasted text), or a topic name. Code: `server/engine/mcq/lecturePipeline.js` (overview and steps 4–5),
`server/engine/intelligence/lectureModel.js` (steps 2–3), `server/controllers/quizController.js` (steps 1, 6–8).
Removed earlier design: `legacy/pre_single_pipeline/README.md`.

## Steps

| # | Step | Intention | How |
|---|---|---|---|
| 1 | Read | Turn every input into text without losing where it came from | Whisper (timed segments; code-mixed speech translated to English, original kept); Gemini vision for photos, scans and handwriting (OCR as backup); PDF/PPTX/DOCX text with slide numbers; code and terminal sessions kept verbatim |
| 2a | Typed blocks | Units small enough to cite exactly | Speech ≤ 60 s or 170 words; one slide (≤ 220 words) keeping its number; code by construct (≤ 12 lines); 1–2 terminal commands. Every block keeps its source file |
| 2b | Linkage (only when speech and material both exist) | Read each slide beside the part of the talk that explains it | Each material block joins the speech window it matches best by shared words and by meaning (multilingual embeddings), each signal normalised across windows; a window that is full passes it to the next good match; material that matches nothing is read on its own |
| 2c | Teaching points | What was actually taught, nothing else | An LLM reads each window and lists points (topic, subtopic, kind, depth, emphasis, teacher's example, question angles with difficulty, misconceptions). A point is kept only if its quote appears word for word in the cited block |
| 2d | Merge repeats | A topic revisited at minute 40 is the same point as at minute 5 | One call groups duplicate points and topic names across the whole lecture; the revisit is counted and both timestamps kept |
| 2e | Calibrate | Judge every question angle against the whole lecture, not one window | One call returns the teacher's intent, what Easy/Medium/Hard mean for this class, each point's role (core/supporting/peripheral), each angle's difficulty and whether it fits the intent. Rules: a merely mentioned point stays Easy; no point loses all angles. If the call fails the window labels stand (recorded) |
| 2f | Capacity | How many questions this lecture can carry | Capacity = supported angles per difficulty; recommended = distinct taught points per difficulty (Balanced: non-peripheral taught points); material-only points reported as a supplement |
| 3 | Plan (blueprint) | Which points, how many, at which difficulty | Lecture first (material-only points only for what the lecture cannot fill); Balanced mix from the calibrated capacity; topics by capacity and teaching time; within a topic: unassessed points, teaching-style fit, type variety, then importance (role, depth, emphasis, revisits, time); a Hard form per Hard point; reserves ordered taught-first by importance |
| 4 | Write | One crisp question per target | The writer gets the teacher's passage for that point, the lecture's intent, what the difficulty means for this class, the question type, the Hard recipe and the lecture's misconceptions for distractors. Stems ≤ 45 words (55 for scenarios) |
| 5 | Check each | Catch broken questions cheaply, repair once | Rule checks (format, key, distractor plausibility and relatedness, code); a failing question gets the critic and one repair; still failing → a reserve of the same difficulty |
| 6 | Accept | Every question must pass every criterion | Final Quality Gate (13 criteria, judged against the same teacher passage) beside a key-blind solve by another model family; duplicates by meaning |
| 6c | Prove | Never deliver a wrong key or an ungrounded question | Delivered only if proven, checked in code: (1) an exact lecture quote (≥75% of its 3-word sequences found in the lecture, LaTeX/line breaks aside) that is about the stem's point and shares the key's words; (2) two independent key-blind solves, from different models, both choose the key; (3) a question whose answer is a value (number, code output, final state) carries a JavaScript `solve()` written from the question's own data, run in a sandbox (no require/process, 1 s), whose result matches the key's option and no other (integers exact, decimals 1%, percent-aware). A `solve()` that only returns a fixed string proves nothing unless that text is output the class actually saw. A proof that fails on computation or quote is asked once more with the reason; anything unproven is rejected and refilled. A checker that cannot be reached is retried, never skipped. `server/engine/validators/keyProof.js` |
| 7 | Replace | Keep the requested count without lowering the bar | Spare candidates are written in the first wave (Hard +40%, Easy/Medium +20%) and the planned number per level is kept; rejected slots are then refilled from reserves in up to two rounds (depth strict until the last), each checked and proven again. Time budget: a quiz answers within 2 minutes of Generate with what is proven by then |
| 8 | Deliver | Tell the teacher exactly what happened | Notice: delivered count and mix, shortfall and why, points from material only, coverage |

## Fallbacks (each explicit and reported)

| When | Then |
|---|---|
| The lecture cannot be read (provider busy) | The teacher is told and can retry; no second reader is substituted |
| Embeddings unavailable (quota) | Linkage by shared words only; logged |
| Calibration unavailable | Window difficulty labels stand; `calibration.status = unavailable` |
| A writer batch fails | Its targets are written one by one |
| A question fails its checks | Replaced from reserves of the same difficulty (nearest difficulty only if none is left); any shortfall stated |
| The provider is busy | The same point is retried after a pause (twice at most); the model is not swapped for a short reset |
| The request exceeds what the lecture supports | Capped; the reason is stated; optional fill from the neighbouring difficulty |

## Integration check (Autoencoders lecture, 27 Nov 2026; same writer, keys and time for both)

| | Earlier pipeline | This pipeline |
|---|---|---|
| Balanced 10: delivered / time / tokens | 10/10, 47 s, 59k | 10/10, 46 s, 85k (stricter gate: 4 rejected, all 4 replaced) |
| Hard 5: delivered / truly Hard / time / tokens | 5/5, 0 Hard (all relabelled Medium), 62 s, 139k | 5/5, 3 Hard, 31 s, 70k |

Runs: `experiments/cmp/ab/`. Planning also treats two points with the same meaning (embedding similarity ≥ 0.92) as one.

## Design points and their tests

`server/test/test_mcq_pipeline_design.js` (no network; model calls stubbed). The full pipeline on one real lecture is
the integration check.

| # | Design point | Test |
|---|---|---|
| D1 | Audio only → no linkage | D1 |
| D2 | Audio + material linked (words; meaning when wording differs) | D2a, D2b |
| D3 | Material only (notes, code, terminal, photos via vision) | D3 |
| D4 | Several materials: source kept, equal priority | D4 |
| D5 | Lecture first; material-only points fill only the shortfall, and the notice says so | D5a, D5b |
| D6 | Teacher's intent understood and given to the writer (e.g. no code for a conceptual class) | D6a, D6b |
| D7 | Topics, time per topic, subtopics, revisits merged | D7 |
| D8 | How well it was taught | Teaching score (Paper 2) |
| D9 | Capacity and an honest recommended count | D9 |
| D10 | Difficulty relative to this lecture, with guards; failure fallback | D10, D10b |
| D11 | Balanced follows the lecture | D11 |
| D12 | Fewer questions → most important points kept | D12 |
| D13 | More questions than supported → capped, explained | D13 |
| D14 | Grounded = answerable from what was taught; writer and gate see the same passage | D14 |
| D15 | Not trivial: per-difficulty demands | D15 |
| D16 | Several ways to make a question Hard | D16 |
| D17 | Variety of question types | D17 |
| D18 | Crisp questions | D18 |
| D19 | Distractors from lecture misconceptions; throwaways caught | D19 |
| D20 | Write → check → replace → accept; duplicates by meaning; a busy provider retried on the same point | D20a, D20b, D20c |
| D21 | Smart key use: the chosen model on every key (most token budget first) before any other model; short resets waited for | D21 |
| D22 | Medium/Hard must give a concrete case to work on; a recall-only stem gets one rewrite | D22 |
| D23 | Only planned code questions (output/trace/debug) must show code | D23 |
| D24 | No wrong key, no ungrounded question: delivered only with an exact lecture quote, two agreeing independent solves, and (for values) a sandboxed computation that reproduces the key; unproven → refilled | D42, D43 |
| D25 | Code checks no model can talk past: invented tool output, a numeric key the working does not reach, a snippet named but not shown, an unnamed "taught algorithm" | D37, D38, D40 |
