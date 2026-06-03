# KMIT Kahoot - Technology Stack

## Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 18.x | UI Framework |
| **Vite** | 5.x | Build Tool & Dev Server |
| **Tailwind CSS** | 3.x | Styling Framework |
| **Framer Motion** | 11.x | Animations |
| **React Router** | 6.x | Client-side Routing |
| **Socket.IO Client** | 4.x | Real-time Communication |
| **Axios** | 1.x | HTTP Client |
| **React Hot Toast** | 2.x | Notifications |

## Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| **Node.js** | 18+ | JavaScript Runtime |
| **Express.js** | 4.x | Web Framework |
| **Socket.IO** | 4.x | WebSocket Server |
| **Prisma** | 6.x | ORM (Database) |
| **PostgreSQL** | 14+ | Relational Database |
| **JWT** | 9.x | Authentication |
| **bcryptjs** | 3.x | Password Hashing |
| **Multer** | 1.x | File Upload Handling |

## AI & ML Services
| Service | Model | Purpose |
|---------|-------|---------|
| **Groq** | LLaMA 3.1 8B | Question Generation (Primary) |
| **Groq** | Whisper Large v3 | Audio Transcription |
| **OpenAI** | GPT-3.5-turbo | Question Generation (Fallback) |
| **Google Gemini** | Gemini 1.5 Flash | Question Generation (Fallback) |

## Content Processing
| Library | Purpose |
|---------|---------|
| **pdf-parse** | PDF Text Extraction |
| **mammoth** | DOCX Text Extraction |
| **officeparser** | PPTX Text Extraction |
| **tesseract.js** | OCR (Image to Text) |
| **youtube-transcript** | YouTube Caption Extraction |
| **@distube/ytdl-core** | YouTube Metadata Extraction |

## Security & Validation
| Library | Purpose |
|---------|---------|
| **express-validator** | Input Validation |
| **express-rate-limit** | Rate Limiting |
| **helmet** | Security Headers |
| **cors** | Cross-Origin Resource Sharing |
| **express-mongo-sanitize** | NoSQL Injection Prevention |
| **xss-clean** | XSS Attack Prevention |
| **hpp** | HTTP Parameter Pollution Prevention |

## Development Tools
| Tool | Purpose |
|------|---------|
| **ESLint** | Code Linting |
| **Prettier** | Code Formatting |
| **Nodemon** | Auto-restart Server |
| **Git** | Version Control |

## Deployment
| Platform | Purpose |
|----------|---------|
| **Vercel/Netlify** | Frontend Hosting |
| **Render/Railway** | Backend Hosting |
| **PostgreSQL Cloud** | Database Hosting |

---

## Quick Summary

```
┌─────────────────────────────────────────────────────────┐
│                    TECH STACK                            │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  FRONTEND:  React + Vite + Tailwind + Framer Motion    │
│                                                          │
│  BACKEND:   Node.js + Express + Socket.IO + Prisma      │
│                                                          │
│  DATABASE:  PostgreSQL                                   │
│                                                          │
│  AI:        Groq (LLaMA + Whisper) + OpenAI + Gemini   │
│                                                          │
│  REAL-TIME: Socket.IO (WebSocket)                       │
│                                                          │
│  AUTH:      JWT + bcrypt                                │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Core Dependencies

### Frontend (`client/package.json`)
```json
{
  "react": "^18.3.1",
  "vite": "^5.4.11",
  "tailwindcss": "^3.4.17",
  "framer-motion": "^11.15.0",
  "socket.io-client": "^4.8.3",
  "axios": "^1.7.9",
  "react-router-dom": "^6.28.0"
}
```

### Backend (`server/package.json`)
```json
{
  "express": "^4.21.2",
  "socket.io": "^4.7.2",
  "@prisma/client": "^6.19.3",
  "jsonwebtoken": "^9.0.0",
  "bcryptjs": "^3.0.3",
  "groq-sdk": "^1.1.2",
  "@google/generative-ai": "^0.24.1",
  "openai": "^4.0.0"
}
```

## Why These Technologies?

### React + Vite
- **Fast**: Vite provides instant HMR
- **Modern**: Latest React features
- **Popular**: Large community support

### Tailwind CSS
- **Utility-first**: Rapid UI development
- **Responsive**: Mobile-first design
- **Customizable**: Easy theming

### Socket.IO
- **Reliable**: Auto-reconnection
- **Compatible**: Fallback to polling
- **Easy**: Simple event-based API

### Prisma + PostgreSQL
- **Type-safe**: TypeScript support
- **Migrations**: Schema versioning
- **Reliable**: ACID compliance

### Groq API
- **Fast**: Low latency inference
- **Cost-effective**: Competitive pricing
- **Quality**: State-of-the-art models

---

## Architecture Pattern

**Three-Tier Architecture**
```
Client (React) ←→ Server (Node.js) ←→ Database (PostgreSQL)
                      ↓
                  AI Services
```

## Communication

- **REST API**: HTTP/HTTPS (JSON)
- **WebSocket**: Socket.IO (Real-time)
- **Authentication**: JWT tokens

---

**Total Technologies**: 30+
**Primary Language**: JavaScript/TypeScript
**Architecture**: Client-Server-Database (3-Tier)
