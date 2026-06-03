# KMIT Kahoot - Requirements Specification

## Project Overview
An intelligent, AI-powered quiz platform designed for educational institutions, featuring real-time engagement, multi-source content generation, and comprehensive gamification to enhance student learning outcomes.

---

## 1. FUNCTIONAL REQUIREMENTS

### 1.1 User Management

#### FR-1.1.1: User Registration
- **Description**: System shall allow users to register as either Student or Teacher
- **Inputs**: Name, Email, Password, Role (Student/Teacher)
- **Outputs**: User account created, JWT token generated
- **Validation**: Email format validation, password strength requirements (min 6 characters)
- **Priority**: High

#### FR-1.1.2: User Authentication
- **Description**: System shall authenticate users using JWT tokens
- **Inputs**: Email, Password
- **Outputs**: JWT token, user profile data
- **Security**: Passwords hashed using bcrypt, tokens expire after session
- **Priority**: High

#### FR-1.1.3: Role-Based Access Control
- **Description**: System shall provide different dashboards based on user role
- **Student Access**: Join quizzes, create personal quizzes, view gamification stats
- **Teacher Access**: Create quizzes, host live sessions, view analytics
- **Priority**: High

---

### 1.2 Content Input & Processing

#### FR-1.2.1: Document Upload
- **Description**: System shall accept multiple document formats for quiz generation
- **Supported Formats**: PDF, DOCX, PPTX, TXT, JPG, PNG
- **File Size Limit**: 50MB maximum
- **Processing**: Extract text using pdf-parse, mammoth, officeparser, tesseract.js
- **Priority**: High

#### FR-1.2.2: YouTube Video Processing
- **Description**: System shall extract content from YouTube videos
- **Input**: YouTube URL (max 2 URLs per request)
- **Method 1**: Extract transcript using youtube-transcript library
- **Method 2**: Extract metadata (title + description) using ytdl-core
- **Output**: Text content for quiz generation
- **Priority**: High

#### FR-1.2.3: Voice Recording Processing
- **Description**: System shall transcribe audio recordings to text
- **Supported Formats**: MP3, WAV, M4A, WEBM, OGG
- **Transcription**: Groq Whisper API (whisper-large-v3 model)
- **File Size Limit**: 50MB maximum
- **Priority**: Medium

#### FR-1.2.4: Manual Text Input
- **Description**: System shall accept direct text/topic input for quiz generation
- **Input**: Text topic or content (min 50 characters)
- **Priority**: High

---

### 1.3 AI-Powered Quiz Generation

#### FR-1.3.1: Question Generation (Stage 1: Generator)
- **Description**: System shall generate multiple-choice questions using AI
- **AI Model**: Groq LLaMA 3.1 (primary), OpenAI GPT-3.5 (fallback), Gemini (fallback)
- **Parameters**: Question count (1-50), Difficulty (Easy/Medium/Thinkable/Hard)
- **Output**: Draft questions with 4 options, correct answer, explanation
- **Priority**: High

#### FR-1.3.2: Quality Assessment (Stage 2: Critic)
- **Description**: System shall evaluate question quality using multi-criteria scoring
- **Whole-Quiz Review**:
  - Detect repeated concepts (word overlap ≥60%)
  - Identify answer position bias (>50% in one position)
  - Validate difficulty distribution
- **Per-Question Scoring** (0-100 points):
  - Correctness: 30 points
  - Clarity: 20 points
  - Distractor Quality: 15 points
  - Explanation: 10 points
  - Difficulty Alignment: 15 points
  - Uniqueness: 10 points
- **Pass Threshold**: 90 points
- **Priority**: High

#### FR-1.3.3: Question Refinement (Stage 3: Refiner)
- **Description**: System shall automatically improve low-scoring questions
- **Refinement Bands**:
  - Score ≥95: LOCKED (no changes)
  - Score 85-94: Minor refinement (fix explanation, punctuation)
  - Score <85: Full refinement (rewrite if needed)
- **Max Iterations**: 2 refinement rounds per question
- **Early Exit**: If average score ≥92, skip refinement
- **Concurrency**: Process up to 10 questions in parallel
- **Priority**: High

#### FR-1.3.4: Final Validation (Stage 4: Validator)
- **Description**: System shall perform final quality checks before publishing
- **Validations**:
  - No empty fields (question text, options, answer, explanation)
  - No duplicate questions (word overlap check)
  - Answer distribution check (no option >60% of answers)
  - Minimum 2 valid options per question
  - Explanation length ≥10 characters
- **Priority**: High

#### FR-1.3.5: Fallback System
- **Description**: System shall provide fallback when AI services unavailable
- **Fallback Order**: Groq → OpenAI → Gemini → Mock Questions
- **Mock Questions**: Pre-formatted template questions that teachers can edit
- **Priority**: High

---

### 1.4 Content Moderation

#### FR-1.4.1: Safety Screening
- **Description**: System shall moderate all uploaded content for safety
- **Checks**:
  - Inappropriate content detection
  - Spam/low-quality content filtering
  - Minimum content length validation (≥50 characters)
- **Priority**: High

#### FR-1.4.2: Strike System
- **Description**: System shall track content violations per user
- **Strike Levels**:
  - Strike 1-2: Warning message
  - Strike 3+: Account suspension
- **Reset**: Strikes reset after 30 days of good behavior
- **Priority**: Medium

---

### 1.5 Quiz Management

#### FR-1.5.1: Quiz Creation
- **Description**: Teachers shall create quizzes manually or via AI
- **Manual Mode**: Add questions one by one with custom options
- **AI Mode**: Generate questions from content sources
- **Settings**: Title, difficulty, timer per question (0-300 seconds)
- **Priority**: High

#### FR-1.5.2: Quiz Editing
- **Description**: Teachers shall edit existing quiz questions
- **Editable Fields**: Question text, options, correct answer, explanation, points
- **Validation**: Ensure correct answer matches one of the options
- **Priority**: High

#### FR-1.5.3: Quiz Deletion
- **Description**: Teachers shall delete their own quizzes
- **Confirmation**: Require confirmation before deletion
- **Cascade**: Delete associated attempts and results
- **Priority**: Medium

#### FR-1.5.4: Quiz Listing
- **Description**: Teachers shall view all their created quizzes
- **Display**: Title, question count, creation date, status
- **Sorting**: By date (newest first)
- **Priority**: Medium

---

### 1.6 Live Quiz Sessions

#### FR-1.6.1: Session Creation
- **Description**: Teachers shall start live quiz sessions
- **Process**:
  1. Select quiz from library
  2. Generate unique 6-digit join code
  3. Open waiting room
- **Code Validity**: Active until session ends
- **Priority**: High

#### FR-1.6.2: Student Joining
- **Description**: Students shall join live sessions using join code
- **Input**: 6-digit code
- **Validation**: Code exists and session is active
- **Rate Limiting**: Max 20 join attempts per 15 minutes
- **Priority**: High

#### FR-1.6.3: Waiting Room
- **Description**: System shall display waiting room before quiz starts
- **Teacher View**: List of joined students, start button
- **Student View**: Waiting message, participant count
- **Real-Time**: Updates via Socket.IO
- **Priority**: High

#### FR-1.6.4: Question Display
- **Description**: System shall display questions one at a time
- **Teacher Control**: Next question button, pause/resume
- **Student View**: Question text, 4 options, countdown timer
- **Timer**: Configurable per question (0-300 seconds)
- **Priority**: High

#### FR-1.6.5: Answer Submission
- **Description**: Students shall submit answers in real-time
- **Submission**: Single selection from 4 options
- **Deadline**: Before timer expires
- **Feedback**: Immediate correct/incorrect indication
- **Points**: Based on speed and correctness
- **Priority**: High

#### FR-1.6.6: Live Leaderboard
- **Description**: System shall display real-time rankings
- **Update**: After each question
- **Display**: Rank, username, total points
- **Animation**: Smooth transitions for rank changes
- **Priority**: High

#### FR-1.6.7: Session Results
- **Description**: System shall display final results at session end
- **Teacher View**: Complete analytics, student performance breakdown
- **Student View**: Final rank, score, correct answers, XP earned
- **Storage**: Save results to database for history
- **Priority**: High

---

### 1.7 Game Modes (Student)

#### FR-1.7.1: Cyber Quest Mode
- **Description**: Progressive difficulty quiz with lifelines
- **Features**:
  - 10 difficulty tiers
  - 50:50 Shield lifeline (remove 2 wrong options)
  - Skip Question lifeline
  - Progressive challenge (harder questions as you advance)
- **Scoring**: Points based on difficulty tier
- **Priority**: Medium

#### FR-1.7.2: Sprint Arena Mode
- **Description**: Time-based rapid-fire quiz
- **Features**:
  - Countdown timer starts at fixed time
  - Correct answer: +10 seconds
  - Wrong answer: -5 seconds
  - Game ends when timer reaches 0
- **Scoring**: Number of correct answers
- **Priority**: Medium

#### FR-1.7.3: Match-Up Match Mode
- **Description**: Memory card matching game
- **Features**:
  - Flip cards to match concepts
  - Vocabulary and definition pairs
  - Time tracking
  - Mistake counting
- **Scoring**: Based on time and mistakes
- **Priority**: Low

---

### 1.8 Gamification System

#### FR-1.8.1: XP (Experience Points)
- **Description**: Students shall earn XP for quiz activities
- **XP Awards**:
  - Complete quiz: 50 XP
  - Score 80%+: +25 bonus XP
  - Win live quiz: +50 bonus XP
  - Daily login: 10 XP
- **Display**: Total XP, level progress bar
- **Priority**: Medium

#### FR-1.8.2: Streak Tracking
- **Description**: System shall track consecutive daily logins
- **Calculation**: Days with at least one quiz completed
- **Reset**: Breaks if no activity for 24+ hours
- **Display**: Current streak, highest streak
- **Priority**: Medium

#### FR-1.8.3: Daily Missions
- **Description**: System shall generate daily challenges
- **Mission Types**:
  - Complete 3 quizzes
  - Score 80%+ in 2 quizzes
  - Win a live quiz
  - Maintain 7-day streak
- **Rewards**: Bonus XP upon completion
- **Reset**: New missions generated daily at midnight
- **Priority**: Medium

#### FR-1.8.4: Perks & Rewards
- **Description**: Students shall unlock perks using XP
- **Perk Types**:
  - Extra lifelines
  - Custom avatars
  - Special badges
  - Cosmetic items
- **Redemption**: Spend XP to unlock, receive ticket
- **Priority**: Low

---

### 1.9 Analytics & Reporting

#### FR-1.9.1: Teacher Analytics
- **Description**: Teachers shall view quiz performance analytics
- **Metrics**:
  - Total attempts
  - Average score
  - Question difficulty analysis
  - Time spent per question
  - Student performance breakdown
- **Visualization**: Charts and graphs
- **Priority**: Medium

#### FR-1.9.2: Student History
- **Description**: Students shall view their quiz history
- **Display**: Past quizzes, scores, dates, time taken
- **Filtering**: By date, score, quiz type
- **Priority**: Low

---

### 1.10 Real-Time Communication

#### FR-1.10.1: Socket.IO Integration
- **Description**: System shall use WebSocket for real-time updates
- **Events**:
  - Student joins/leaves session
  - Question display
  - Answer submission
  - Leaderboard updates
  - Session end
- **Reconnection**: Automatic reconnection on disconnect
- **Priority**: High

---

## 2. NON-FUNCTIONAL REQUIREMENTS

### 2.1 Performance

#### NFR-2.1.1: Response Time
- **API Response**: <2 seconds for 95% of requests
- **Page Load**: <3 seconds for initial load
- **Real-Time Updates**: <500ms latency for Socket.IO events
- **AI Generation**: <60 seconds for 10 questions
- **Priority**: High

#### NFR-2.1.2: Throughput
- **Concurrent Users**: Support 1000+ simultaneous users
- **Live Sessions**: Support 100+ concurrent live quiz sessions
- **API Requests**: Handle 10,000+ requests per minute
- **Priority**: High

#### NFR-2.1.3: Database Performance
- **Query Time**: <100ms for 95% of database queries
- **Indexing**: Proper indexes on frequently queried fields
- **Connection Pooling**: Efficient connection management
- **Priority**: High

---

### 2.2 Scalability

#### NFR-2.2.1: Horizontal Scaling
- **Description**: System shall scale horizontally by adding more servers
- **Load Balancing**: Distribute traffic across multiple instances
- **Stateless Design**: No server-side session storage (use JWT)
- **Priority**: Medium

#### NFR-2.2.2: Database Scaling
- **Description**: Database shall handle growing data volume
- **Strategy**: Read replicas for query distribution
- **Partitioning**: Consider sharding for large datasets
- **Priority**: Medium

#### NFR-2.2.3: File Storage Scaling
- **Description**: System shall handle increasing file uploads
- **Strategy**: Cloud storage (S3, Cloudinary) for production
- **Cleanup**: Automatic deletion of temporary files
- **Priority**: Medium

---

### 2.3 Reliability

#### NFR-2.3.1: Availability
- **Uptime**: 99.5% availability (43.8 hours downtime/year)
- **Maintenance Windows**: Scheduled during low-traffic periods
- **Monitoring**: Real-time health checks and alerts
- **Priority**: High

#### NFR-2.3.2: Fault Tolerance
- **AI Fallback**: Multiple AI providers with automatic fallback
- **Error Handling**: Graceful degradation when services fail
- **Data Backup**: Daily automated backups
- **Priority**: High

#### NFR-2.3.3: Data Integrity
- **Transactions**: Use database transactions for critical operations
- **Validation**: Server-side validation for all inputs
- **Consistency**: Ensure data consistency across operations
- **Priority**: High

---

### 2.4 Security

#### NFR-2.4.1: Authentication Security
- **Password Hashing**: bcrypt with salt rounds ≥10
- **JWT Tokens**: Secure, signed tokens with expiration
- **Session Management**: Automatic logout on token expiration
- **Priority**: High

#### NFR-2.4.2: Authorization
- **Role-Based Access**: Enforce role permissions on all endpoints
- **Resource Ownership**: Users can only access their own resources
- **API Protection**: All sensitive endpoints require authentication
- **Priority**: High

#### NFR-2.4.3: Data Protection
- **HTTPS**: All communication over encrypted HTTPS
- **Input Sanitization**: Prevent XSS, SQL injection, NoSQL injection
- **File Upload Security**: Validate file types and sizes
- **Rate Limiting**: Prevent brute force and DoS attacks
- **Priority**: High

#### NFR-2.4.4: Content Security
- **Moderation**: Automated content screening
- **User Reporting**: Allow users to report inappropriate content
- **Strike System**: Track and penalize violations
- **Priority**: High

---

### 2.5 Usability

#### NFR-2.5.1: User Interface
- **Responsive Design**: Work on desktop, tablet, mobile (320px+)
- **Intuitive Navigation**: Clear menu structure, breadcrumbs
- **Accessibility**: WCAG 2.1 Level AA compliance
- **Loading States**: Show progress indicators for long operations
- **Priority**: High

#### NFR-2.5.2: User Experience
- **Onboarding**: Clear instructions for first-time users
- **Error Messages**: Helpful, actionable error messages
- **Feedback**: Visual feedback for all user actions
- **Animations**: Smooth transitions (Framer Motion)
- **Priority**: High

#### NFR-2.5.3: Internationalization
- **Language Support**: English (primary), extensible for other languages
- **Date/Time**: Localized date and time formats
- **Currency**: Support for multiple currencies (if applicable)
- **Priority**: Low

---

### 2.6 Maintainability

#### NFR-2.6.1: Code Quality
- **Code Style**: Consistent coding standards (ESLint, Prettier)
- **Documentation**: Inline comments for complex logic
- **Modularity**: Separation of concerns, reusable components
- **Priority**: Medium

#### NFR-2.6.2: Testing
- **Unit Tests**: Critical business logic covered
- **Integration Tests**: API endpoints tested
- **Manual Testing**: UI/UX testing before releases
- **Priority**: Medium

#### NFR-2.6.3: Version Control
- **Git**: All code in version control (GitHub)
- **Branching**: Feature branches, pull requests for review
- **Commit Messages**: Descriptive, conventional commits
- **Priority**: High

#### NFR-2.6.4: Deployment
- **CI/CD**: Automated deployment pipeline
- **Environment Separation**: Dev, staging, production environments
- **Rollback**: Ability to rollback to previous version
- **Priority**: Medium

---

### 2.7 Compatibility

#### NFR-2.7.1: Browser Support
- **Modern Browsers**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **Mobile Browsers**: iOS Safari 14+, Chrome Mobile 90+
- **Fallbacks**: Graceful degradation for older browsers
- **Priority**: High

#### NFR-2.7.2: Device Support
- **Desktop**: Windows, macOS, Linux
- **Mobile**: iOS 14+, Android 8+
- **Tablets**: iPad, Android tablets
- **Priority**: High

#### NFR-2.7.3: Screen Sizes
- **Minimum**: 320px width (mobile)
- **Optimal**: 1920px width (desktop)
- **Responsive Breakpoints**: 640px, 768px, 1024px, 1280px
- **Priority**: High

---

### 2.8 Compliance

#### NFR-2.8.1: Data Privacy
- **GDPR Compliance**: User consent for data collection
- **Data Retention**: Clear policies on data storage duration
- **Right to Deletion**: Users can request account deletion
- **Priority**: High

#### NFR-2.8.2: Educational Standards
- **Content Quality**: Ensure educational value of generated content
- **Age Appropriateness**: Content suitable for target age group
- **Accessibility**: Comply with educational accessibility standards
- **Priority**: Medium

---

### 2.9 Monitoring & Logging

#### NFR-2.9.1: Application Monitoring
- **Error Tracking**: Log all errors with stack traces
- **Performance Monitoring**: Track API response times
- **User Analytics**: Track user behavior (anonymized)
- **Priority**: Medium

#### NFR-2.9.2: Logging
- **Log Levels**: Debug, Info, Warning, Error, Critical
- **Log Rotation**: Automatic log file rotation
- **Centralized Logging**: Aggregate logs from all services
- **Priority**: Medium

---

### 2.10 Cost Efficiency

#### NFR-2.10.1: AI API Costs
- **Groq**: Primary provider (cost-effective)
- **Fallback Strategy**: Use cheaper alternatives first
- **Caching**: Cache AI responses where appropriate
- **Priority**: Medium

#### NFR-2.10.2: Infrastructure Costs
- **Cloud Hosting**: Use free tiers for development
- **Database**: Optimize queries to reduce compute costs
- **Storage**: Implement file cleanup to minimize storage costs
- **Priority**: Medium

---

## 3. CONSTRAINTS

### 3.1 Technical Constraints
- **Backend**: Node.js v18+
- **Frontend**: React 18+
- **Database**: PostgreSQL 14+
- **Real-Time**: Socket.IO 4+
- **AI Models**: Groq LLaMA 3.1, Whisper Large v3

### 3.2 Business Constraints
- **Budget**: Limited budget for AI API calls
- **Timeline**: MVP delivery within project timeline
- **Resources**: Small development team

### 3.3 Regulatory Constraints
- **Data Privacy**: Comply with GDPR and local data protection laws
- **Educational Standards**: Meet institutional requirements
- **Content Safety**: Ensure appropriate content for educational use

---

## 4. ASSUMPTIONS

1. Users have stable internet connection for real-time features
2. AI API services (Groq, OpenAI, Gemini) are available
3. Users have modern browsers with JavaScript enabled
4. Educational content provided by users is accurate
5. PostgreSQL database is properly configured and maintained
6. Server infrastructure can handle expected load
7. Users understand basic quiz concepts and gameplay

---

## 5. DEPENDENCIES

### 5.1 External Services
- **Groq API**: AI question generation and audio transcription
- **OpenAI API**: Fallback AI generation
- **Google Gemini API**: Secondary fallback
- **YouTube**: Video transcript extraction
- **PostgreSQL**: Database hosting

### 5.2 Third-Party Libraries
- **Frontend**: React, Framer Motion, Socket.IO Client, Axios
- **Backend**: Express, Prisma, Socket.IO, Multer, JWT
- **AI/ML**: Groq SDK, OpenAI SDK, Google Generative AI
- **Utilities**: pdf-parse, mammoth, tesseract.js, ytdl-core

---

## 6. FUTURE ENHANCEMENTS (Out of Scope for MVP)

1. **Mobile Apps**: Native iOS and Android applications
2. **Advanced Analytics**: ML-based learning insights
3. **Collaborative Quizzes**: Team-based quiz modes
4. **Video Explanations**: Embed video explanations for answers
5. **API for Third-Party**: Public API for integrations
6. **White-Label Solution**: Customizable branding for institutions
7. **Offline Mode**: Progressive Web App with offline support
8. **Advanced Gamification**: Achievements, badges, tournaments
9. **Social Features**: Friend system, challenges, leaderboards
10. **Content Marketplace**: Share and sell quiz content

---

## Document Version
- **Version**: 1.0
- **Last Updated**: 2024
- **Status**: Final
