# KMIT Kahoot - System Workflow (Poster Version)

```
╔═══════════════════════════════════════════════════════════════════════════════════════╗
║                         KMIT KAHOOT - INTELLIGENT QUIZ PLATFORM                       ║
║                    AI-Powered Learning with Real-Time Engagement                      ║
╚═══════════════════════════════════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                  USER ROLES                                          │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                        │
                    ┌───────────────────┴───────────────────┐
                    │                                       │
            ┌───────▼────────┐                     ┌───────▼────────┐
            │    STUDENT     │                     │    TEACHER     │
            │   Dashboard    │                     │   Dashboard    │
            └───────┬────────┘                     └───────┬────────┘
                    │                                       │
        ┌───────────┼───────────┐                  ┌────────┼────────┐
        │           │           │                  │        │        │
    ┌───▼───┐  ┌───▼───┐  ┌───▼───┐         ┌────▼───┐ ┌─▼────┐ ┌─▼────┐
    │ Join  │  │Create │  │Missions│         │ Create │ │ My   │ │ Live │
    │ Quiz  │  │ Quiz  │  │  & XP │         │  Quiz  │ │Quizzes│ │Host  │
    └───────┘  └───────┘  └───────┘         └────────┘ └──────┘ └──────┘


┌─────────────────────────────────────────────────────────────────────────────────────┐
│                          CONTENT INPUT SOURCES                                       │
└─────────────────────────────────────────────────────────────────────────────────────┘

    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
    │   PDF    │    │  YouTube │    │  Voice   │    │  PowerPt │    │   Text   │
    │  DOCX    │    │  Videos  │    │Recording │    │  Images  │    │  Topic   │
    └────┬─────┘    └────┬─────┘    └────┬─────┘    └────┬─────┘    └────┬─────┘
         │               │               │               │               │
         └───────────────┴───────────────┴───────────────┴───────────────┘
                                        │
                            ┌───────────▼───────────┐
                            │  CONTENT EXTRACTION   │
                            │  ┌─────────────────┐  │
                            │  │ • PDF Parser    │  │
                            │  │ • YT Transcript │  │
                            │  │ • Whisper STT   │  │
                            │  │ • OCR (Images)  │  │
                            │  └─────────────────┘  │
                            └───────────┬───────────┘
                                        │
                            ┌───────────▼───────────┐
                            │ CONTENT MODERATION    │
                            │ • Safety Check        │
                            │ • Strike System       │
                            └───────────┬───────────┘
                                        │
                                        ▼


┌─────────────────────────────────────────────────────────────────────────────────────┐
│                        AI AGENT PIPELINE (4 STAGES)                                  │
└─────────────────────────────────────────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────────────────────────────────┐
    │  STAGE 1: GENERATOR                                                         │
    │  ┌──────────────────────────────────────────────────────────────────────┐   │
    │  │  Groq LLaMA 3.1 → Generate Draft Questions                           │   │
    │  │  • Multiple Choice Questions  • Explanations  • Difficulty Matching  │   │
    │  └──────────────────────────────────────────────────────────────────────┘   │
    └─────────────────────────────────────┬───────────────────────────────────────┘
                                          │
    ┌─────────────────────────────────────▼───────────────────────────────────────┐
    │  STAGE 2: CRITIC (Quality Scoring 0-100)                                    │
    │  ┌──────────────────────────────────────────────────────────────────────┐   │
    │  │  Whole-Quiz Review:                Per-Question Analysis:            │   │
    │  │  • Repeated Concepts               • Correctness (30 pts)            │   │
    │  │  • Answer Position Bias            • Clarity (20 pts)                │   │
    │  │  • Difficulty Distribution         • Distractors (15 pts)            │   │
    │  │                                    • Explanation (10 pts)            │   │
    │  │                                    • Difficulty Match (15 pts)       │   │
    │  │                                    • Uniqueness (10 pts)             │   │
    │  └──────────────────────────────────────────────────────────────────────┘   │
    └─────────────────────────────────────┬───────────────────────────────────────┘
                                          │
    ┌─────────────────────────────────────▼───────────────────────────────────────┐
    │  STAGE 3: REFINER (Parallel Improvement)                                    │
    │  ┌──────────────────────────────────────────────────────────────────────┐   │
    │  │  Score ≥95  → LOCKED (No Changes)                                    │   │
    │  │  Score 85-94 → Minor Refinement (Fix explanation, punctuation)       │   │
    │  │  Score <85   → Full Refinement (Rewrite question if needed)          │   │
    │  │  • Max 2 refinement rounds per question                              │   │
    │  │  • Early exit if avg score ≥92                                       │   │
    │  └──────────────────────────────────────────────────────────────────────┘   │
    └─────────────────────────────────────┬───────────────────────────────────────┘
                                          │
    ┌─────────────────────────────────────▼───────────────────────────────────────┐
    │  STAGE 4: VALIDATOR (Final Quality Check)                                   │
    │  ┌──────────────────────────────────────────────────────────────────────┐   │
    │  │  • No empty fields  • No duplicates  • Answer distribution check     │   │
    │  │  • Difficulty alignment  • Explanation quality                       │   │
    │  └──────────────────────────────────────────────────────────────────────┘   │
    └─────────────────────────────────────┬───────────────────────────────────────┘
                                          │
                            ┌─────────────▼─────────────┐
                            │   FALLBACK SYSTEM         │
                            │   If AI Unavailable:      │
                            │   → Mock Questions        │
                            │   → Teacher Can Edit      │
                            └─────────────┬─────────────┘
                                          │
                                          ▼
                            ┌─────────────────────────┐
                            │   QUIZ READY TO USE     │
                            │   • Stored in Database  │
                            │   • Quality Report      │
                            └─────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           LIVE QUIZ SESSION (Real-Time)                              │
└─────────────────────────────────────────────────────────────────────────────────────┘

    TEACHER                          SOCKET.IO                         STUDENT
       │                          (Real-Time Sync)                        │
       │                                  │                               │
       ├─ 1. Start Quiz ─────────────────┼──────────────────────────────►│
       │    Generate 6-digit code        │                               │
       │                                  │                               │
       │◄─────────────────────────────────┼─ 2. Enter Code & Join ───────┤
       │    See joined students           │                               │
       │                                  │                               │
       ├─ 3. Start Question ─────────────►│──────────────────────────────►│
       │    Display question              │    Show question + timer      │
       │                                  │                               │
       │◄─────────────────────────────────┼─ 4. Submit Answer ───────────┤
       │    Receive all answers           │    Send selected option       │
       │                                  │                               │
       ├─ 5. Show Results ───────────────►│──────────────────────────────►│
       │    Display correct answer        │    See if correct + points    │
       │                                  │                               │
       ├─ 6. Update Leaderboard ─────────►│──────────────────────────────►│
       │    Show rankings                 │    See current rank           │
       │                                  │                               │
       │    (Repeat for each question)    │                               │
       │                                  │                               │
       ├─ 7. Final Results ──────────────►│──────────────────────────────►│
       │    Winner announcement           │    Final score + rank         │
       │    Complete analytics            │    XP & Streak update         │


┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              GAME MODES                                              │
└─────────────────────────────────────────────────────────────────────────────────────┘

    ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
    │   CYBER QUEST        │  │   SPRINT ARENA       │  │   MATCH-UP MATCH     │
    │                      │  │                      │  │                      │
    │  🎯 10 Difficulty    │  │  ⚡ Time-Based       │  │  🎴 Memory Cards     │
    │     Tiers            │  │     Survival         │  │                      │
    │                      │  │                      │  │  🧠 Concept          │
    │  🛡️ Lifelines:       │  │  ✅ Correct: +Time   │  │     Matching         │
    │     • 50:50 Shield   │  │  ❌ Wrong: -Time     │  │                      │
    │     • Skip Question  │  │                      │  │  📚 Vocabulary       │
    │                      │  │  🏃 Rapid-Fire MCQs  │  │     Focus            │
    │  🎮 Progressive      │  │                      │  │                      │
    │     Challenge        │  │  🔥 High-Speed Mode  │  │  🎯 Quick Recall     │
    └──────────────────────┘  └──────────────────────┘  └──────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         GAMIFICATION SYSTEM                                          │
└─────────────────────────────────────────────────────────────────────────────────────┘

    ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
    │   XP & LEVELS   │      │ DAILY MISSIONS  │      │ PERKS & REWARDS │
    │                 │      │                 │      │                 │
    │  ⭐ Earn XP     │      │  📋 Complete 3  │      │  🎁 Unlock with │
    │     per quiz    │      │     quizzes     │      │     XP points   │
    │                 │      │                 │      │                 │
    │  🔥 Daily       │      │  🎯 Score 80%+  │      │  🎫 Redeem      │
    │     Streak      │      │     twice       │      │     tickets     │
    │                 │      │                 │      │                 │
    │  📈 Level       │      │  🏆 Win a live  │      │  ✨ Special     │
    │     Progress    │      │     quiz        │      │     abilities   │
    │                 │      │                 │      │                 │
    │  🏅 Highest     │      │  📅 7-day       │      │  🎨 Cosmetic    │
    │     Streak      │      │     streak      │      │     items       │
    └─────────────────┘      └─────────────────┘      └─────────────────┘


┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           TECHNICAL ARCHITECTURE                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘

    ┌──────────────────────────────────────────────────────────────────────────┐
    │  FRONTEND                    BACKEND                    AI SERVICES       │
    │  ┌────────────────┐         ┌────────────────┐        ┌──────────────┐   │
    │  │ React + Vite   │         │ Node.js        │        │ Groq LLaMA   │   │
    │  │ Framer Motion  │◄───────►│ Express.js     │◄──────►│ Groq Whisper │   │
    │  │ Socket.IO      │         │ Socket.IO      │        │ OpenAI       │   │
    │  │ Tailwind CSS   │         │ Prisma ORM     │        │ Gemini       │   │
    │  └────────────────┘         │ PostgreSQL     │        └──────────────┘   │
    │                              │ JWT Auth       │                           │
    │                              └────────────────┘                           │
    └──────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              KEY FEATURES                                            │
└─────────────────────────────────────────────────────────────────────────────────────┘

    ✅ Multi-Source Content Input        ✅ AI-Powered Quality Assurance
    ✅ Real-Time Live Quiz Sessions      ✅ Multiple Engaging Game Modes
    ✅ Comprehensive Gamification        ✅ Content Safety & Moderation
    ✅ Teacher Analytics Dashboard       ✅ Student Progress Tracking
    ✅ Responsive Cross-Platform         ✅ Robust Fallback Systems


╔═══════════════════════════════════════════════════════════════════════════════════════╗
║                              DATA FLOW SUMMARY                                        ║
╠═══════════════════════════════════════════════════════════════════════════════════════╣
║                                                                                       ║
║  INPUT → EXTRACT → MODERATE → AI GENERATE → VALIDATE → STORE → PLAY → TRACK         ║
║                                                                                       ║
║  1. User uploads content (PDF/YouTube/Voice/Text)                                    ║
║  2. System extracts text using appropriate parser                                    ║
║  3. Content moderation checks for safety                                             ║
║  4. AI Agent Pipeline generates high-quality questions                               ║
║  5. Questions validated and stored in database                                       ║
║  6. Teacher hosts live quiz or student plays game mode                               ║
║  7. Real-time sync via Socket.IO for live sessions                                   ║
║  8. Results tracked, XP awarded, missions updated                                    ║
║                                                                                       ║
╚═══════════════════════════════════════════════════════════════════════════════════════╝
```

---

## For Poster Design:

### Color Scheme Suggestions:
- **Primary**: Deep Blue (#1a1f3a) - Professional, trustworthy
- **Accent**: Bright Red (#ff4757) - Energy, engagement
- **Success**: Green (#2ed573) - Positive feedback
- **Warning**: Yellow (#ffa502) - Attention, alerts
- **Background**: White/Light Gray - Clean, readable

### Typography:
- **Headings**: Bold, Sans-serif (Montserrat, Poppins)
- **Body**: Clean, Readable (Inter, Roboto)
- **Code/Tech**: Monospace (Fira Code, JetBrains Mono)

### Layout Tips:
1. **Top Section**: Title + User Roles (20% of poster)
2. **Middle Section**: AI Pipeline + Live Quiz (50% of poster)
3. **Bottom Section**: Game Modes + Features (30% of poster)
4. Use **icons** instead of text where possible
5. Add **arrows** to show flow direction
6. Use **boxes with shadows** for depth
7. Keep **white space** for readability

### Key Highlights to Emphasize:
- **4-Stage AI Pipeline** (unique selling point)
- **Real-Time Engagement** (Socket.IO)
- **Multi-Source Input** (versatility)
- **Gamification** (student engagement)
