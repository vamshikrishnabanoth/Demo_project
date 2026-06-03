# KMIT Kahoot - System Architecture

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER (Frontend)                         │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  React 18 + Vite                                                   │ │
│  │  • Component-based UI                                              │ │
│  │  • Framer Motion (animations)                                      │ │
│  │  • Tailwind CSS (styling)                                          │ │
│  │  • React Router (navigation)                                       │ │
│  │  • Socket.IO Client (real-time)                                    │ │
│  │  • Axios (HTTP requests)                                           │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                  HTTPS         WebSocket         HTTPS
                    │               │               │
┌───────────────────▼───────────────▼───────────────▼─────────────────────┐
│                        APPLICATION LAYER (Backend)                       │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  Node.js + Express.js                                              │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐ │ │
│  │  │   REST API   │  │  Socket.IO   │  │   Middleware Layer       │ │ │
│  │  │              │  │   Server     │  │  • Authentication (JWT)  │ │ │
│  │  │ • Auth       │  │              │  │  • Authorization         │ │ │
│  │  │ • Quiz CRUD  │  │ • Live Quiz  │  │  • Rate Limiting         │ │ │
│  │  │ • Upload     │  │ • Real-time  │  │  • Input Validation      │ │ │
│  │  │ • Analytics  │  │   Sync       │  │  • Error Handling        │ │ │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
┌───────────────────▼───┐  ┌────────▼────────┐  ┌──▼──────────────────────┐
│   DATA LAYER          │  │  SERVICE LAYER  │  │  EXTERNAL SERVICES      │
│  ┌─────────────────┐  │  │  ┌───────────┐  │  │  ┌──────────────────┐   │
│  │  PostgreSQL     │  │  │  │ Content   │  │  │  │  Groq API        │   │
│  │  (Prisma ORM)   │  │  │  │ Extractor │  │  │  │  • LLaMA 3.1     │   │
│  │                 │  │  │  │           │  │  │  │  • Whisper       │   │
│  │ • Users         │  │  │  │ • PDF     │  │  │  └──────────────────┘   │
│  │ • Quizzes       │  │  │  │ • DOCX    │  │  │  ┌──────────────────┐   │
│  │ • Questions     │  │  │  │ • PPTX    │  │  │  │  OpenAI API      │   │
│  │ • Attempts      │  │  │  │ • Images  │  │  │  │  (Fallback)      │   │
│  │ • Gamification  │  │  │  │ • Audio   │  │  │  └──────────────────┘   │
│  │ • Live Sessions │  │  │  └───────────┘  │  │  ┌──────────────────┐   │
│  └─────────────────┘  │  │  ┌───────────┐  │  │  │  Gemini API      │   │
│                       │  │  │ AI Agent  │  │  │  │  (Fallback)      │   │
│                       │  │  │ Pipeline  │  │  │  └──────────────────┘   │
│                       │  │  │           │  │  │  ┌──────────────────┐   │
│                       │  │  │ • Generator│ │  │  │  YouTube         │   │
│                       │  │  │ • Critic  │  │  │  │  • Transcript    │   │
│                       │  │  │ • Refiner │  │  │  │  • Metadata      │   │
│                       │  │  │ • Validator│ │  │  └──────────────────┘   │
│                       │  │  └───────────┘  │  │                         │
│                       │  │  ┌───────────┐  │  │                         │
│                       │  │  │ Content   │  │  │                         │
│                       │  │  │ Moderator │  │  │                         │
│                       │  │  └───────────┘  │  │                         │
└───────────────────────┘  └─────────────────┘  └─────────────────────────┘
```

---

## 1. Architecture Pattern

**Type**: Three-Tier Architecture (Client-Server-Database)
**Style**: Microservices-ready Monolith
**Communication**: RESTful API + WebSocket (Socket.IO)

---

## 2. Layer Breakdown

### 2.1 Client Layer (Frontend)

**Technology Stack:**
- React 18 (UI framework)
- Vite (build tool)
- Framer Motion (animations)
- Tailwind CSS (styling)
- Socket.IO Client (real-time)
- Axios (HTTP client)

**Responsibilities:**
- User interface rendering
- User interaction handling
- State management (React hooks)
- Real-time updates (Socket.IO)
- Client-side validation
- Responsive design

**Key Components:**
- Authentication (Login/Register)
- Dashboards (Student/Teacher)
- Quiz Creation/Management
- Live Quiz Interface
- Game Modes
- Gamification UI

---

### 2.2 Application Layer (Backend)

**Technology Stack:**
- Node.js (runtime)
- Express.js (web framework)
- Socket.IO (WebSocket)
- Prisma (ORM)
- JWT (authentication)
- Multer (file upload)

**Responsibilities:**
- Business logic execution
- API endpoint handling
- Real-time communication
- Authentication & authorization
- Request validation
- Error handling

**Core Modules:**

#### A. REST API
- `/api/auth` - Authentication endpoints
- `/api/quiz` - Quiz CRUD operations
- `/api/students` - Student-specific features
- `/api/teachers` - Teacher-specific features

#### B. Socket.IO Server
- Live quiz session management
- Real-time event broadcasting
- Connection handling
- Room management

#### C. Middleware
- `authMiddleware` - JWT verification
- `rateLimiter` - Request throttling
- `validator` - Input validation
- `errorHandler` - Centralized error handling

---

### 2.3 Service Layer

**Content Extraction Service:**
- PDF parsing (pdf-parse)
- DOCX parsing (mammoth)
- PPTX parsing (officeparser)
- Image OCR (tesseract.js)
- Audio transcription (Groq Whisper)
- YouTube transcript (youtube-transcript)
- YouTube metadata (ytdl-core)

**AI Agent Pipeline Service:**
- **Stage 1 - Generator**: Create draft questions
- **Stage 2 - Critic**: Score questions (0-100)
- **Stage 3 - Refiner**: Improve low-scoring questions
- **Stage 4 - Validator**: Final quality check

**Content Moderation Service:**
- Safety screening
- Strike system management
- Account suspension logic

**Task Manager Service:**
- Async task tracking
- Progress updates
- Task expiration

---

### 2.4 Data Layer

**Database**: PostgreSQL 14+
**ORM**: Prisma

**Schema:**
```
Users
├─ id, name, email, password, role, createdAt

Quizzes
├─ id, title, creatorId, difficulty, createdAt
└─ Questions (1:many)
   ├─ id, quizId, questionText, options, correctAnswer, explanation

Attempts
├─ id, userId, quizId, score, completedAt

LiveSessions
├─ id, quizId, hostId, code, status, createdAt

Gamification
├─ userId, xp, streak, highestStreak, dailyMissions, unlockedPerks
```

---

### 2.5 External Services

**AI Services:**
1. **Groq API** (Primary)
   - LLaMA 3.1 (question generation)
   - Whisper Large v3 (audio transcription)

2. **OpenAI API** (Fallback)
   - GPT-3.5-turbo (question generation)

3. **Google Gemini API** (Fallback)
   - Gemini 1.5 Flash (question generation)

**Content Services:**
- YouTube (transcript & metadata extraction)

---

## 3. Data Flow

### 3.1 Quiz Generation Flow
```
User Upload → Content Extraction → Moderation → AI Pipeline → Database
```

### 3.2 Live Quiz Flow
```
Teacher Start → Generate Code → Students Join (Socket.IO) → 
Question Display → Answer Submit → Leaderboard Update → Results
```

### 3.3 Authentication Flow
```
Login → JWT Token → Store in localStorage → 
Send with each request → Verify on server → Grant access
```

---

## 4. Communication Protocols

### 4.1 HTTP/HTTPS (REST API)
- **Methods**: GET, POST, PUT, DELETE
- **Format**: JSON
- **Authentication**: JWT in `x-auth-token` header
- **Status Codes**: 200, 201, 400, 401, 403, 404, 500

### 4.2 WebSocket (Socket.IO)
- **Events**: 
  - `join-session`, `leave-session`
  - `start-question`, `submit-answer`
  - `update-leaderboard`, `end-session`
- **Rooms**: Session-based rooms for isolation
- **Reconnection**: Automatic with exponential backoff

---

## 5. Security Architecture

### 5.1 Authentication
- **Method**: JWT (JSON Web Tokens)
- **Storage**: localStorage (client)
- **Expiration**: Session-based
- **Password**: bcrypt hashing (10 rounds)

### 5.2 Authorization
- **Role-Based**: Student vs Teacher permissions
- **Resource-Based**: Users can only access their own data
- **Middleware**: `auth` middleware on protected routes

### 5.3 Data Protection
- **HTTPS**: All communication encrypted
- **Input Sanitization**: XSS, SQL injection prevention
- **Rate Limiting**: Prevent brute force attacks
- **File Validation**: Type and size checks

---

## 6. Scalability Strategy

### 6.1 Horizontal Scaling
- **Stateless Design**: No server-side sessions
- **Load Balancing**: Distribute across multiple instances
- **Database**: Read replicas for query distribution

### 6.2 Caching
- **AI Responses**: Cache similar questions
- **Static Assets**: CDN for frontend files
- **Database Queries**: Redis for frequent queries (future)

### 6.3 Async Processing
- **Task Queue**: Background job processing
- **AI Generation**: Async with polling
- **File Processing**: Non-blocking operations

---

## 7. Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    PRODUCTION ENVIRONMENT                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐         ┌──────────────────┐          │
│  │   Frontend       │         │   Backend        │          │
│  │   (Vercel)       │◄───────►│   (Render)       │          │
│  │                  │  HTTPS  │                  │          │
│  │  • React App     │         │  • Node.js       │          │
│  │  • Static Files  │         │  • Express API   │          │
│  │  • CDN           │         │  • Socket.IO     │          │
│  └──────────────────┘         └────────┬─────────┘          │
│                                        │                     │
│                               ┌────────▼─────────┐           │
│                               │   Database       │           │
│                               │   (PostgreSQL)   │           │
│                               │                  │           │
│                               │  • Prisma ORM    │           │
│                               │  • Auto Backup   │           │
│                               └──────────────────┘           │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │            External Services (APIs)                   │   │
│  │  • Groq (AI)  • OpenAI (AI)  • Gemini (AI)          │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**Hosting:**
- **Frontend**: Vercel / Netlify (auto-deploy from Git)
- **Backend**: Render / Railway (Node.js hosting)
- **Database**: Render PostgreSQL / Supabase
- **File Storage**: Server uploads (temp files)

---

## 8. Technology Stack Summary

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 18 | UI framework |
| | Vite | Build tool |
| | Tailwind CSS | Styling |
| | Framer Motion | Animations |
| | Socket.IO Client | Real-time |
| **Backend** | Node.js | Runtime |
| | Express.js | Web framework |
| | Socket.IO | WebSocket |
| | Prisma | ORM |
| | JWT | Authentication |
| | Multer | File upload |
| **Database** | PostgreSQL | Relational DB |
| **AI Services** | Groq LLaMA 3.1 | Question generation |
| | Groq Whisper | Audio transcription |
| | OpenAI GPT-3.5 | Fallback AI |
| | Google Gemini | Fallback AI |
| **Utilities** | pdf-parse | PDF extraction |
| | mammoth | DOCX extraction |
| | tesseract.js | OCR |
| | ytdl-core | YouTube metadata |
| | youtube-transcript | YouTube captions |

---

## 9. Key Design Decisions

### 9.1 Why Three-Tier Architecture?
- **Separation of Concerns**: Clear boundaries between layers
- **Maintainability**: Easy to update individual layers
- **Scalability**: Each layer can scale independently
- **Testability**: Layers can be tested in isolation

### 9.2 Why Socket.IO for Real-Time?
- **Reliability**: Automatic reconnection
- **Compatibility**: Fallback to polling if WebSocket unavailable
- **Room Support**: Easy session isolation
- **Event-Based**: Clean, intuitive API

### 9.3 Why Prisma ORM?
- **Type Safety**: TypeScript support
- **Migrations**: Database schema versioning
- **Query Builder**: Intuitive, readable queries
- **Performance**: Optimized query generation

### 9.4 Why Multiple AI Providers?
- **Reliability**: Fallback if primary fails
- **Cost Optimization**: Use cheaper options first
- **Quality**: Different models for different needs
- **Vendor Lock-in**: Avoid dependency on single provider

---

## 10. Performance Optimizations

1. **Lazy Loading**: Load components on demand
2. **Code Splitting**: Separate bundles for routes
3. **Image Optimization**: Compress and lazy load images
4. **Database Indexing**: Index frequently queried fields
5. **Connection Pooling**: Reuse database connections
6. **Caching**: Cache AI responses and static data
7. **Compression**: Gzip/Brotli for API responses
8. **CDN**: Serve static assets from edge locations

---

## Architecture Diagram Legend

- **→** : HTTP/HTTPS Request
- **⟷** : WebSocket Connection
- **├─** : One-to-Many Relationship
- **└─** : Last Child in Hierarchy
