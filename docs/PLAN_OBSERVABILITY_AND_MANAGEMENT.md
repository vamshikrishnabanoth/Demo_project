# Plan — Pipeline Explorer (observability) and Management role

*Draft for approval, 2026-11-12. Nothing here is implemented yet.*

## 0. Is the MCQ pipeline done?

**In code: yes.** Everything in the mentor's plan is implemented and merged to `main`, all tests pass.
Still open, none of it code:
- The AWS backend must be redeployed (teammate) — until then the live site runs the old backend.
- `ci/deploy-backend` (auto-deploy) goes to `main` once the GitHub secrets are added.
- A logged-in click-through in the real UI, the teacher pilot, and the research validation (teaching score vs faculty, expert ratings).

One gap that the new work needs: **teaching analyses are not saved in the database.** The lecture model lives in a
file cache and the quiz does not record which lecture it came from. Management analytics cannot relate teaching to
student results without this, so it is step 1 below.

---

## 1. Pipeline Explorer — show every step live

**Goal:** during a live demo (or later, as a replay) everyone sees exactly what the system does with a lecture,
step by step, with the real data, in plain language.

### Steps shown
| # | Step | What the audience sees |
|---|---|---|
| 1 | Input received | type (audio / slides / photo / code / terminal), size, duration |
| 2 | Transcription | time taken, length, a few timestamped lines |
| 3 | Reading the lecture | blocks and windows, which AI model read each part, time |
| 4 | Understanding | timeline of segments, topics, teaching points with their **verified quotes**; how many unverified points were dropped |
| 5 | Teaching score | each dimension, rating, quoted evidence, suggestion, confidence |
| 6 | Capacity and plan | question opportunities per difficulty and topic, the allocation for this request and why |
| 7 | Writing questions | each batch, model used (Hard: reasoning model + solution steps) |
| 8 | Quality checks | every candidate: passed / repaired / relabelled / rejected, with the reason in words |
| 9 | Independent answer check | agree / flagged, per question |
| 10 | Final quiz | questions, difficulty mix, total time, number of AI calls |

### Modes
- **Live:** steps light up as they happen during generation (uses the existing task event stream).
- **Replay:** any finished run can be stepped through again ("Next step" button) — for talks, reviews and the paper.
- **Presenter view:** large text, one step per screen, short explanation of *why* each step exists; no API keys,
  internal IDs or student data shown.

### Build
- Server: one `PipelineRun` record per generation — lecture-model id, plan, every candidate with its outcome and
  reasons, models used, timings, call counts. The orchestrator and lecture model already produce this data; it is
  collected instead of only logged. Endpoint `GET /api/runs/:id` (owner teacher, admin, management).
- Client: new page `PipelineExplorer` (reuses the existing pipeline viewer components where they fit), a link from
  the review page ("See how these questions were made") and from the generation progress screen.

---

## 2. Management role — teachers, students and the link between them

**Who:** HOD / principal / academic director / coaching-centre management. Read-only.
**Scope:** whole institution, or one department (configurable per user).

### Data foundation (needed first)
1. `LectureAnalysis` table: id (= lecture-model id), teacher, subject/topic, date, duration, input types,
   teaching score + dimensions + confidence, capacity. Saved when a teacher analyses a lecture.
2. `Quiz.lectureAnalysisId`: which lecture a quiz came from.
3. `User.department` (teachers and management) and a `subject` on quizzes/lectures, so comparisons are like-for-like.
4. Question-level fields already saved (difficulty, topic, question type) + student answers → per-item statistics.

### Dashboards
**a. Institution overview** — active teachers, lectures analysed, quizzes run, participation, average scores and
trends; filter by department, branch, year, section, subject, date range.

**b. Teachers** — per teacher: lectures, quizzes, teaching score over time (with confidence and per-dimension
breakdown), how their students do on their quizzes (overall, by difficulty, by topic), participation, question
quality (difficulty p, discrimination D, non-functioning distractors).

**c. Students** — per cohort (branch / section / year) and per student: performance across subjects and teachers,
by difficulty and topic, trend, weak topics, at-risk list (low or falling scores, low participation).

**d. Teaching ↔ learning relation** (the differentiator)
- Teacher × cohort matrix: how the same cohort performs with different teachers, and the same teacher across cohorts.
- Which teaching dimensions (clarity, explaining why, examples, …) go with better student results on the related
  quizzes — shown as correlations **with sample sizes and confidence**, never as a verdict.
- Topic view: where students struggle for each teacher's lectures, linked to that lecture's teaching evidence
  (e.g. "students missed 3 of 4 questions on X; the lecture explained the steps of X but not why").
- Fair comparisons: normalised for subject and question difficulty; minimum sample sizes before showing a number.

**e. Reports** — CSV / PDF export per department, teacher, cohort, term.

### Safeguards (important for selling to institutions)
- Shown as **support for teachers**, not a ranking or appraisal tool, until the teaching score is validated.
- Every metric shows its sample size and confidence; nothing shown below a minimum sample.
- Teachers can see their own data first; an option to hide teacher names from management.
- Access is logged (who viewed what).

---

## 3. Order of work (single implementation prompt once approved)

1. Data foundation (LectureAnalysis, Quiz link, department/subject) + Prisma migration — additive only.
2. PipelineRun collection + `GET /api/runs/:id`.
3. Pipeline Explorer page (live + replay + presenter view).
4. Management role: middleware, routes, user creation by admin, login routing.
5. Management API: overview, teachers, students, relation, reports.
6. Management dashboard pages.
7. Tests (unit + API with stubbed DB), build, end-to-end check with seeded demo data.

## 4. Decisions needed before implementation
1. Role name shown in the app: "Management", "HOD" or "Academic Head"?
2. Scope: institution-wide only, or department-scoped users too?
3. Should management see teacher names, or anonymised teachers by default?
4. Where do departments/subjects come from — admin enters them, or imported from a CSV like students?
5. Explorer for demos: login required, or a shareable replay link without login (data anonymised)?
6. Database: the migration adds tables/columns to the shared Supabase database — OK to run it there, or on a copy first?
