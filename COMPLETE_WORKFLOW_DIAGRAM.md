# KMIT Kahoot - Complete System Workflow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           USER AUTHENTICATION                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┴─────────────────┐
                    │                                   │
              ┌─────▼─────┐                      ┌─────▼─────┐
              │  STUDENT  │                      │  TEACHER  │
              │   LOGIN   │                      │   LOGIN   │
              └─────┬─────┘                      └─────┬─────┘
                    │                                   │
                    │                                   │
┌───────────────────▼───────────────────┐   ┌──────────▼──────────────────────┐
│      STUDENT DASHBOARD                │   │     TEACHER DASHBOARD           │
│  ┌─────────────────────────────────┐  │   │  ┌──────────────────────────┐  │
│  │  1. NEURAL LINK (Join Quiz)     │  │   │  │  1. CREATE QUIZ          │  │
│  │     • Enter 6-digit code        │  │   │  │     • Manual Entry       │  │
│  │     • Join live quiz            │  │   │  │     • AI Generation      │  │
│  │                                 │  │   │  │     • File Upload        │  │
│  │  2. GAME ARENA (Create Quiz)    │  │   │  │     • YouTube Links      │  │
│  │     • Upload Study Material     │  │   │  │     • Voice Recording    │  │
│  │     • YouTube Video Links       │  │   │  │                          │  │
│  │     • Select Game Mode:         │  │   │  │  2. MY QUIZZES           │  │
│  │       - Cyber Quest             │  │   │  │     • View All Quizzes   │  │
│  │       - Sprint Arena            │  │   │  │     • Edit Questions     │  │
│  │       - Match-Up Match          │  │   │  │     • Delete Quiz        │  │
│  │                                 │  │   │  │     • Start Live Session │  │
│  │  3. MISSIONS & PERKS            │  │   │  │                          │  │
│  │     • Daily Missions            │  │   │  │  3. LIVE QUIZ CONTROL    │  │
│  │     • XP & Streak Tracking      │  │   │  │     • Start/Stop Quiz    │  │
│  │     • Unlock Perks              │  │   │  │     • Monitor Students   │  │
│  │     • Redeem Rewards            │  │   │  │     • View Live Results  │  │
│  └─────────────────────────────────┘  │   │  │     • Control Questions  │  │
└───────────────────────────────────────┘   │  └──────────────────────────┘  │
                                            └─────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                        QUIZ GENERATION PIPELINE                              │
└─────────────────────────────────────────────────────────────────────────────┘

INPUT SOURCES:
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   PDF/DOCX   │  │  YouTube URL │  │ Voice Record │  │  Text Topic  │
│   PPTX/Image │  │   (Max 2)    │  │   (Audio)    │  │   (Manual)   │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │                 │
       └─────────────────┴─────────────────┴─────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │  CONTENT EXTRACTION   │
                    └───────────┬───────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
┌───────▼────────┐   ┌──────────▼─────────┐   ┌───────▼────────┐
│  PDF/DOC TEXT  │   │  YOUTUBE CONTENT   │   │  VOICE → TEXT  │
│  • pdf-parse   │   │  1. Transcript     │   │  • Groq Whisper│
│  • mammoth     │   │  2. Metadata       │   │  • Audio→Text  │
│  • tesseract   │   │     (Title+Desc)   │   │                │
└───────┬────────┘   └──────────┬─────────┘   └───────┬────────┘
        │                       │                       │
        └───────────────────────┴───────────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │  CONTENT MODERATION   │
                    │  • Safety Check       │
                    │  • Strike System      │
                    │  • Account Suspension │
                    └───────────┬───────────┘
                                │
                    ┌───────────▼───────────┐
                    │   AI AGENT PIPELINE   │
                    │                       │
                    │  STAGE 1: GENERATOR   │
                    │  ┌─────────────────┐  │
                    │  │ Groq LLaMA 3.1  │  │
                    │  │ Generate Draft  │  │
                    │  │ Questions       │  │
                    │  └────────┬────────┘  │
                    │           │           │
                    │  STAGE 2: CRITIC      │
                    │  ┌────────▼────────┐  │
                    │  │ Whole-Quiz      │  │
                    │  │ Review          │  │
                    │  │ • Repeated      │  │
                    │  │   Concepts      │  │
                    │  │ • Answer Bias   │  │
                    │  │ • Difficulty    │  │
                    │  └────────┬────────┘  │
                    │           │           │
                    │  ┌────────▼────────┐  │
                    │  │ Per-Question    │  │
                    │  │ Scoring (0-100) │  │
                    │  │ • Correctness   │  │
                    │  │ • Clarity       │  │
                    │  │ • Distractors   │  │
                    │  │ • Explanation   │  │
                    │  │ • Difficulty    │  │
                    │  │ • Uniqueness    │  │
                    │  └────────┬────────┘  │
                    │           │           │
                    │  STAGE 3: REFINER     │
                    │  ┌────────▼────────┐  │
                    │  │ Score ≥95?      │  │
                    │  │ → LOCKED        │  │
                    │  │                 │  │
                    │  │ Score 85-94?    │  │
                    │  │ → Minor Fix     │  │
                    │  │                 │  │
                    │  │ Score <85?      │  │
                    │  │ → Full Refine   │  │
                    │  └────────┬────────┘  │
                    │           │           │
                    │  STAGE 4: VALIDATOR   │
                    │  ┌────────▼────────┐  │
                    │  │ Final Quality   │  │
                    │  │ Check           │  │
                    │  │ • No Empty      │  │
                    │  │ • No Duplicates │  │
                    │  │ • Answer Dist.  │  │
                    │  └────────┬────────┘  │
                    └───────────┼───────────┘
                                │
                    ┌───────────▼───────────┐
                    │   FALLBACK SYSTEM     │
                    │  If AI Fails:         │
                    │  → Mock Questions     │
                    │  → Teacher Can Edit   │
                    └───────────┬───────────┘
                                │
                    ┌───────────▼───────────┐
                    │   QUIZ CREATED        │
                    │  • Questions Stored   │
                    │  • Quality Report     │
                    │  • Ready to Launch    │
                    └───────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                          LIVE QUIZ SESSION                                   │
└─────────────────────────────────────────────────────────────────────────────┘

TEACHER SIDE:                          STUDENT SIDE:
┌──────────────────────┐              ┌──────────────────────┐
│  1. START LIVE QUIZ  │              │  1. ENTER JOIN CODE  │
│     • Generate Code  │              │     • 6-digit code   │
│     • Share Code     │              │                      │
└──────────┬───────────┘              └──────────┬───────────┘
           │                                     │
           │         ┌───────────────────────────┘
           │         │
           │    ┌────▼─────┐
           │    │  SOCKET  │
           │    │   .IO    │
           │    │ REAL-TIME│
           │    └────┬─────┘
           │         │
┌──────────▼─────────▼───────────┐
│  2. WAITING ROOM               │
│     Teacher: See joined users  │
│     Student: Wait for start    │
└──────────┬─────────────────────┘
           │
┌──────────▼─────────────────────┐
│  3. QUESTION DISPLAY           │
│     Teacher: Control flow      │
│     Student: Answer question   │
│     • Timer countdown          │
│     • Multiple choice options  │
└──────────┬─────────────────────┘
           │
┌──────────▼─────────────────────┐
│  4. ANSWER SUBMISSION          │
│     • Real-time sync           │
│     • Instant feedback         │
│     • Points calculation       │
└──────────┬─────────────────────┘
           │
┌──────────▼─────────────────────┐
│  5. LEADERBOARD                │
│     • Live rankings            │
│     • Score updates            │
│     • Top performers           │
└──────────┬─────────────────────┘
           │
           │ (Repeat for each question)
           │
┌──────────▼─────────────────────┐
│  6. FINAL RESULTS              │
│     • Winner announcement      │
│     • Complete rankings        │
│     • Performance stats        │
│     • XP & Streak updates      │
└────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                         GAME MODES (STUDENT)                                 │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│   CYBER QUEST        │  │   SPRINT ARENA       │  │   MATCH-UP MATCH     │
│                      │  │                      │  │                      │
│  • 10 Cyberpunk      │  │  • Rapid-fire MCQs   │  │  • Memory card game  │
│    difficulty tiers  │  │  • Beat the clock    │  │  • Match concepts    │
│  • Use 50:50 Shield  │  │  • Time survival     │  │  • Vocabulary focus  │
│  • Skip lifelines    │  │  • Correct adds time │  │  • Visual learning   │
│  • Progressive       │  │  • Wrong subtracts   │  │  • Pattern matching  │
│    challenge         │  │  • High-speed mode   │  │  • Quick recall      │
└──────────────────────┘  └──────────────────────┘  └──────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                      GAMIFICATION SYSTEM                                     │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────┐
│   XP & STREAK        │
│  • Earn XP per quiz  │
│  • Daily login bonus │
│  • Streak tracking   │
│  • Level progression │
└──────────┬───────────┘
           │
┌──────────▼───────────┐
│   DAILY MISSIONS     │
│  • Complete 3 quizzes│
│  • Score 80%+ twice  │
│  • Win a live quiz   │
│  • 7-day streak      │
└──────────┬───────────┘
           │
┌──────────▼───────────┐
│   PERKS & REWARDS    │
│  • Unlock with XP    │
│  • Redeem tickets    │
│  • Special abilities │
│  • Cosmetic items    │
└──────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                         TECHNICAL STACK                                      │
└─────────────────────────────────────────────────────────────────────────────┘

FRONTEND:                          BACKEND:
┌──────────────────┐              ┌──────────────────┐
│  React + Vite    │              │  Node.js         │
│  Framer Motion   │              │  Express.js      │
│  Socket.IO Client│              │  Socket.IO       │
│  Axios           │              │  Prisma ORM      │
│  React Router    │              │  PostgreSQL      │
│  Tailwind CSS    │              │  JWT Auth        │
└──────────────────┘              └──────────────────┘

AI SERVICES:                       UTILITIES:
┌──────────────────┐              ┌──────────────────┐
│  Groq LLaMA 3.1  │              │  Multer (Upload) │
│  Groq Whisper    │              │  pdf-parse       │
│  OpenAI (backup) │              │  mammoth         │
│  Gemini (backup) │              │  tesseract.js    │
└──────────────────┘              │  ytdl-core       │
                                  │  youtube-trans.  │
                                  └──────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                         DATA FLOW SUMMARY                                    │
└─────────────────────────────────────────────────────────────────────────────┘

1. USER AUTHENTICATION
   └─> JWT Token → Stored in localStorage → Sent with every API request

2. QUIZ CREATION
   └─> Upload/Input → Extract Content → Moderate → AI Generate → Store DB

3. LIVE QUIZ
   └─> Teacher Start → Socket.IO → Students Join → Real-time Sync → Results

4. GAME MODES
   └─> Student Select → Load Questions → Play Game → Calculate Score → Update XP

5. GAMIFICATION
   └─> Track Actions → Update XP/Streak → Check Missions → Unlock Perks


┌─────────────────────────────────────────────────────────────────────────────┐
│                         KEY FEATURES                                         │
└─────────────────────────────────────────────────────────────────────────────┘

✅ Multi-source content input (PDF, YouTube, Voice, Text)
✅ AI-powered question generation with quality assurance
✅ Real-time live quiz sessions with Socket.IO
✅ Multiple game modes for varied learning
✅ Gamification with XP, streaks, missions, and perks
✅ Content moderation and safety system
✅ Responsive design for all devices
✅ Teacher analytics and student tracking
✅ Fallback systems for reliability
✅ Secure authentication and authorization


┌─────────────────────────────────────────────────────────────────────────────┐
│                         DEPLOYMENT                                           │
└─────────────────────────────────────────────────────────────────────────────┘

FRONTEND:                          BACKEND:
┌──────────────────┐              ┌──────────────────┐
│  Vercel/Netlify  │              │  Render/Railway  │
│  • Auto Deploy   │              │  • PostgreSQL    │
│  • CDN           │              │  • Auto Scale    │
│  • HTTPS         │              │  • Environment   │
└──────────────────┘              │    Variables     │
                                  └──────────────────┘

DATABASE:                          STORAGE:
┌──────────────────┐              ┌──────────────────┐
│  PostgreSQL      │              │  Server Uploads  │
│  • Prisma ORM    │              │  • Temp Files    │
│  • Migrations    │              │  • Audio/Docs    │
└──────────────────┘              └──────────────────┘
```

## Quick Reference

### User Roles
- **Student**: Join quizzes, play games, earn XP, complete missions
- **Teacher**: Create quizzes, host live sessions, view analytics

### Content Sources
1. **Documents**: PDF, DOCX, PPTX, Images
2. **YouTube**: Video transcripts or metadata
3. **Voice**: Audio recordings transcribed
4. **Text**: Manual topic input

### AI Pipeline Stages
1. **Generator**: Create draft questions
2. **Critic**: Score and identify issues
3. **Refiner**: Improve low-scoring questions
4. **Validator**: Final quality check

### Game Modes
1. **Cyber Quest**: Progressive difficulty with lifelines
2. **Sprint Arena**: Time-based rapid-fire questions
3. **Match-Up Match**: Memory card matching game

### Real-time Features
- Live quiz sessions via Socket.IO
- Instant answer feedback
- Live leaderboards
- Real-time student monitoring
