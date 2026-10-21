# Repository Cleanup & Architecture Audit Reference

**Date**: October 21, 2026  
**Audience**: KMIT Engineering & Teaching Development Team  
**Scope**: Repository Cleanliness, Database Architecture Clarification, Dead Files & Key Deprecation  

---

## 1. Executive Summary

As the KMIT AI Live Quiz platform transitioned into its production-hardened multi-agent architecture (3-Agent Pipeline + Prisma + PostgreSQL + Vite React 19), several legacy prototypes, abandoned experiments, and dead configuration keys remained in the workspace.

To prevent confusion among teammates, improve build hygiene, and ensure zero accidental deployments of obsolete code, we performed a **non-destructive cleanup**:
* Legacy experimental folders and dead models were relocated to `archive/` (nothing has been permanently lost).
* Dead environment keys were removed from `.env`.
* The fine-tuned LLaMA model and its Python bridge (`ai_service.py`) were **strictly preserved** for future activation.
* All 45/45 pipeline integrity tests and the Vite production build continue to pass with 100% green status.

---

## 2. Database Architecture: What Actually Powers the Platform?

### The True Production Database: PostgreSQL via Prisma ORM
* **Schema Definition**: [`server/prisma/schema.prisma`](file:///c:/Users/samanvi/OneDrive/Desktop/git_kahoot/Demo_project/server/prisma/schema.prisma)
* **Client Singleton**: [`server/lib/prisma.js`](file:///c:/Users/samanvi/OneDrive/Desktop/git_kahoot/Demo_project/server/lib/prisma.js)
* **Configuration**: `DATABASE_URL` with connection pooling (`connection_limit=5`, `pool_timeout=15s`).
* **Active Production Models**:
  * `User`: Authentication, roles (`teacher`, `student`, `admin`), student targeting (`year`, `branch`, `section`), progressive account lockout (brute-force defense), streak tracking, and attendance XP.
  * `Quiz`: Stores quiz title, join codes, question payloads (JSON), targeting rules, timers, and live room states.
  * `Result`: Stores student submissions, scores, response times, and question analytics.
  * `Broadcast`, `CheatingLog`, `PointTransaction`: Real-time student alerts, anti-cheat detection, and gamification points.

### What Was Cleaned Up (and Why)
* **`server/config/db.js`**:
  * *Original Content*: Attempted to connect to `mongoose.connect(process.env.MONGO_URI)`.
  * *Why Archived*: Never imported anywhere in the server. `mongoose` is not even installed in `server/package.json`.
* **`server/models/Quiz.js`**:
  * *Original Content*: Despite being in the `models/` directory, this file was actually an old Express router file containing endpoints like `router.post('/create')`.
  * *Why Archived*: The real quiz router is in `server/routes/quiz.js`, and the real Quiz data model is in `server/prisma/schema.prisma`.
* **`server/models/User.js` & `server/models/Result.js`**:
  * *Original Content*: Old Mongoose schemas from the early MongoDB prototype.
  * *Why Archived*: Completely unused; all user and result queries use `prisma.user` and `prisma.result`.

---

## 3. Detailed Inventory of Cleaned / Archived Items

| Item | Original Location | Destination / Action | What It Contained | Why It Was Cleaned Up |
| :--- | :--- | :--- | :--- | :--- |
| **`backend/`** | `Demo_project/backend/` | `archive/backend_ts_experiment/` | TypeScript Express + MongoDB experimental server (`src/index.ts`, `tsconfig.json`). | Abandoned prototype. Production backend is in `server/` (Node.js/Prisma). |
| **`frontend-v2/`** | `Demo_project/frontend-v2/` | `archive/frontend_v2_nextjs_experiment/` | Incomplete Next.js 14 app (`next.config`, `tailwind.config.ts`, `src/`). | Abandoned frontend experiment. Production frontend is in `client/` (Vite + React 19). |
| **`models/`** | `Demo_project/models/` | `archive/python_models_legacy/` | Python test wrappers: `cartesia_model.py`, `deepgram_model.py`, `gemini_model.py`, etc. | Early Python STT/LLM benchmarking scripts. Replaced by `server/engine/adapter/llmRouter.js`. |
| **`pipeline_experiment/`** | `Demo_project/pipeline_experiment/` | `archive/pipeline_experiment/` | Early draft scripts of the MCQ pipeline. | Replaced by the production `server/engine/pipelineOrchestrator.js`. |
| **`server/models/`** | `Demo_project/server/models/` | `archive/server_mongoose_models/` | Dead Mongoose schemas (`User.js`, `Result.js`) and misplaced router (`Quiz.js`). | Dead code; all DB models live in `server/prisma/schema.prisma`. |
| **`server/config/db.js`** | `Demo_project/server/config/` | `archive/server_mongoose_models/db.js` | Unused Mongoose connection script. | Dead code; Prisma connects via `server/lib/prisma.js`. |
| **`original_StudentDashboard.jsx`** | Root directory | `archive/loose_root_backups/` | Loose JSX backup of Student Dashboard. | Redundant copy; active component is in `client/src/pages/StudentDashboard.jsx`. |
| **`test_local.db`** | Root directory | `archive/test_local.db` | Temporary SQLite scratch database file. | Leftover test artifact from local testing. |
| **`Students (...).csv`** | Root directory | `archive/Students_roster_backup.csv` | Student roster CSV file. | Removed from root for security and cleanliness. |
| **`AssessmentReport.jsx`** | `client/src/pages/` | `archive/client_legacy_pages/` | 712-line legacy report page. | Orphaned; route `/report/:id` now renders `QuizAnalytics.jsx`. |
| **`AdminStudents/Teachers/Admins/Users.jsx`** | `client/src/pages/` | `archive/client_legacy_pages/` | 4 older standalone admin view pages. | Redundant; their logic was completely consolidated into tabs inside `AdminDashboard.jsx`. |
| **`CreateQuizPDF/Voice.jsx`** | `client/src/pages/` | `archive/client_legacy_pages/` | 2 older single-input quiz generator pages. | Redundant; unified into `CreateQuizTopic.jsx` (multimodal audio, PDF, and text). |
| **Direct localhost:8000 in Topic Creator** | `client/src/pages/CreateQuizTopic.jsx` | Fixed in place | Direct browser fetch to `http://localhost:8000/transcribe`. | Caused CORS / mixed-content errors in browser; routed cleanly via `POST /api/quiz/transcribe`. |

---

## 4. Environment Variables (`.env`) Audit

### Removed Dead Keys
The following keys have been removed from `server/.env` and root `.env` because no production code uses them:
* ❌ `MONGO_URI`: Removed because the platform does not use MongoDB.
* ❌ `DEEPGRAM_API_KEY`: Removed because STT is standardized on Groq Whisper Turbo + Gemini Flash.
* ❌ `WHISPER_MODEL`: Removed because model selection is managed in `server/config/providerConfig.js`.
* ❌ `GROQ_API_KEY_3`, `GROQ_API_KEY_4`, `GROQ_API_KEY_5`: Removed as part of the ADR-009 simplification to **1 Primary Key + 1 Fallback Provider**.

### Deliberately Preserved Active Keys
* ✅ `DATABASE_URL` & `DIRECT_URL`: PostgreSQL connection strings for Prisma.
* ✅ `JWT_SECRET`: Signs user authentication tokens.
* ✅ `PORT`: Port 5000 server listen port.
* ✅ `GROQ_API_KEY` & `GROQ_API_KEY_BACKUP`: Primary STT (Whisper Turbo) and LLM (120B / 70B).
* ✅ `GEMINI_API_KEY`: Fallback STT and LLM (Gemini 2.5 Flash).
* ✅ `AI_SERVICE_URL` & `OLLAMA_BASE_URL`: **Preserved for the Fine-Tuned LLaMA model** (see Section 5 below).
* ✅ `CACHE_*` variables: Deterministic SHA-256 caching layers (OCR, analysis, planner, validator).

---

## 5. Fine-Tuned LLaMA Model: Current Status & Future Activation

Per team instructions, the **fine-tuned LLaMA model is preserved 100% intact**:
* **Model Binary**: `llama-3-8b.Q4_K_M.gguf` (Kept in root)
* **Colab Training Assets**: `llama_quiz_expert/` & `llama_quiz_expert_for_colab.zip` (Kept in root)
* **Ollama Definition**: `Modelfile` (Kept in root)
* **FastAPI Bridge**: `ai_service.py` (Kept in root)
* **Configuration**: `AI_SERVICE_URL=http://localhost:8000` and `OLLAMA_BASE_URL` in `.env`.

### How It Connects When You Decide to Run It:
1. When you start the Python bridge (`python ai_service.py` or via Ollama `ollama run quiz-expert`), it listens on port 8000.
2. In `server/controllers/quizController.js`, the function `checkAiServiceOnline(AI_SERVICE_URL)` checks if port 8000 is active:
   * **If port 8000 is UP**: The system routes questions to your fine-tuned LLaMA model!
   * **If port 8000 is DOWN**: The system automatically and gracefully falls back to the cloud 3-agent pipeline (Groq 120B/70B + Gemini).
3. This architecture means you can turn your fine-tuned model on or off at any time without needing to modify backend code.

---

## 6. Verification Checklist

Following this cleanup:
* [x] `Demo_project/server`: `npm test` runs all 45 automated test suites with **100% pass rate**.
* [x] `Demo_project/client`: `npm run build` generates the Vite production bundle in **~6.5s with zero errors**.
* [x] All active routes (`/api/quiz/*`, `/api/auth/*`, `/api/telemetry/*`) operate strictly against Prisma and PostgreSQL.
* [x] No sensitive files or loose test databases remain in the repository root.
