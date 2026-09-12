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


============================================================
              GIT COMMANDS – EXAM CHEAT SHEET
============================================================

1. CLONE REPOSITORY
-------------------
git clone <REPOSITORY-URL>
cd <PROJECT-FOLDER>


2. CHECK REMOTE REPOSITORY
--------------------------
git remote -v


3. CHECK CURRENT STATUS
-----------------------
git status


4. CREATE + SWITCH TO NEW BRANCH
---------------------------------
git checkout -b feature/branch-name

OR (modern Git):
git switch -c feature/branch-name


5. VIEW ALL BRANCHES + CURRENT BRANCH
-------------------------------------
git branch -a

OR:
git branch -av


6. ADD ONE SPECIFIC FILE
------------------------
git add <file-path>

Example:
git add src/main/webapp/index.jsp


7. ADD ALL CHANGES
------------------
git add .


8. COMMIT CHANGES
-----------------
git commit -m "Meaningful commit message"

Example:
git commit -m "Add player registration servlet"


9. VERIFY COMMITS / HISTORY
---------------------------
git log

Compact:
git log --oneline


10. ADD MISSED FILE TO LAST COMMIT
----------------------------------
git add <file-path>
git commit --amend --no-edit


11. GET REMOTE CHANGES WITHOUT
    CHANGING WORKING FILES
-------------------------------
git fetch origin


12. CHECK WHETHER LOCAL BRANCH
    IS BEHIND REMOTE
--------------------------------
git fetch origin
git status


13. GET + MERGE REMOTE CHANGES
------------------------------
git pull origin main


14. UPDATE LOCAL MAIN
---------------------
git checkout main
git pull origin main


15. MERGE MAIN INTO CURRENT FEATURE
-----------------------------------
git merge main


16. REBASE FEATURE ON UPDATED MAIN
----------------------------------
git fetch origin
git rebase origin/main

OR:
git checkout main
git pull origin main
git checkout feature/branch-name
git rebase main


17. REBASE CONFLICT – CHECK FILES
---------------------------------
git status


18. AFTER FIXING CONFLICT
-------------------------
git add <resolved-file>
git rebase --continue


19. CANCEL REBASE COMPLETELY
----------------------------
git rebase --abort


20. SEE DIFFERENCES IN A FILE
-----------------------------
git diff feature/branch-name main -- <file-path>

Example:
git diff feature/player-registration main -- src/main/webapp/index.jsp


21. SEE ALL UNCOMMITTED DIFFERENCES
-----------------------------------
git diff


22. SEE STAGED DIFFERENCES
--------------------------
git diff --staged


23. VISUAL COMPACT BRANCH HISTORY
---------------------------------
git log --oneline --graph --all --decorate


24. UNDO A COMMIT SAFELY
    (KEEP HISTORY)
--------------------------------
git revert <commit-id>


25. UNDO LAST COMMIT
    KEEP CHANGES STAGED
--------------------------------
git reset --soft HEAD~1


26. REMOVE FILE FROM GIT BUT
    KEEP IT ON LOCAL COMPUTER
--------------------------------
git rm --cached <file-path>

Example:
git rm --cached src/main/resources/db-config.env


27. SAVE UNCOMMITTED WORK
    WITHOUT COMMIT
--------------------------------
git stash


28. VIEW SAVED STASHES
----------------------
git stash list


29. RESTORE SAVED STASH
-----------------------
git stash pop


30. SWITCH BRANCH
-----------------
git checkout <branch-name>

OR:
git switch <branch-name>


31. MERGE FEATURE INTO MAIN
---------------------------
git checkout main
git merge feature/branch-name


32. PUSH MAIN TO GITHUB
-----------------------
git push origin main


33. VERIFY LOCAL + REMOTE
    ARE SYNCHRONIZED
--------------------------------
git fetch origin
git status


34. PUSH NEW FEATURE BRANCH
---------------------------
git push -u origin feature/branch-name


35. CHECK COMMIT DETAILS
------------------------
git show <commit-id>


36. CHECK FILE HISTORY
----------------------
git log -- <file-path>


37. FIND MISSING CHANGES / HISTORY
----------------------------------
git log --oneline --all
git reflog


38. SSH KEY – GENERATE
----------------------
ssh-keygen -t ed25519 -C "your_email@example.com"


39. TEST GITHUB SSH CONNECTION
------------------------------
ssh -T git@github.com


40. PUSH AFTER REBASE
---------------------
git push --force-with-lease origin feature/branch-name


============================================================
                 MOST IMPORTANT FLOW
============================================================

git clone <URL>
        ↓
cd <project>
        ↓
git status
        ↓
git remote -v
        ↓
git checkout -b feature/branch
        ↓
EDIT FILE
        ↓
git diff
        ↓
git add <file>
        ↓
git commit -m "message"
        ↓
git fetch origin
        ↓
git pull origin main
        ↓
git rebase origin/main
        ↓
FIX CONFLICTS if any
        ↓
git add <file>
git rebase --continue
        ↓
git checkout main
        ↓
git merge feature/branch
        ↓
git push origin main
        ↓
git fetch origin
git status


============================================================
              EMERGENCY COMMANDS TO REMEMBER
============================================================

Conflict during rebase:
    git status
    [edit conflict]
    git add <file>
    git rebase --continue

Cancel rebase:
    git rebase --abort

Undo commit but KEEP history:
    git revert <commit-id>

Undo last commit, KEEP changes STAGED:
    git reset --soft HEAD~1

Remove file from Git but KEEP local file:
    git rm --cached <file>

Temporarily save unfinished work:
    git stash

See saved work:
    git stash list

Restore saved work:
    git stash pop

After rebase:
    git push --force-with-lease origin <branch>


============================================================
