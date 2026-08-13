require('dotenv').config();

// Global Error Handlers to catch silent crashes
process.on('uncaughtException', (err) => {
    console.error('🔥 UNCAUGHT EXCEPTION:', err);
    // Note: In production, you might want to gracefully shutdown
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('🌊 UNHANDLED REJECTION at:', promise, 'reason:', reason);
});

const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const {
    requestIdMiddleware,
    sanitizeInput,
    sqlInjectionDetector,
    securityEventLogger,
} = require('./middleware/security');

const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const prisma = require('./lib/prisma'); // Using Prisma
const { verifyQuizIntegrity } = require('./lib/quizintegrity');
const { gradeAnswer, resolveCorrectOptionText } = require('./utils/grading');
const { getCache, setCache } = require('./lib/cache');
const { exec } = require('child_process');
const quizState = require('./lib/quizState'); // In-memory quiz state engine

const gzipCompressionMiddleware = require('./middleware/compression');

const app = express();

// Enable HTTP Gzip response compression for high throughput
app.use(gzipCompressionMiddleware);

// Trust proxy for rate limiting (needed for Render/Vercel)
app.set('trust proxy', 1);

// --- SECURITY LOGGING ---
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
}
const accessLogStream = fs.createWriteStream(path.join(logsDir, 'access.log'), { flags: 'a' });
app.use(morgan('combined', { stream: accessLogStream }));
app.use(morgan('dev')); // Keep dev logging for console

// --- SECURITY MIDDLEWARE ---

// 0. Request ID — generates unique X-Request-ID for every request (audit trail)
app.use(requestIdMiddleware);

// 0.5 Security Event Logger — logs auth failures, rate limits, suspicious activity
app.use(securityEventLogger);

// 1. CORS - MUST BE FIRST to handle preflights correctly
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, Postman)
        if (!origin) return callback(null, true);
        const allowed = [
            'https://kmit-khaoot.vercel.app',
            'http://localhost:5173',
            'http://127.0.0.1:5173',
        ];
        // SECURITY: Only allow preview URLs matching the project name pattern
        const isVercelPreview = /^https:\/\/kmit-khaoot(-[a-z0-9]+)*\.vercel\.app$/.test(origin);
        if (allowed.includes(origin) || isVercelPreview) {
            callback(null, true);
        } else {
            console.warn(`[CORS] Blocked origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token', 'Accept', 'X-Request-ID']
}));

// 2. Set Security HTTP Headers (Full OWASP recommended suite)
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
            imgSrc: ["'self'", "data:", "blob:", "https:"],
            connectSrc: ["'self'", "https://kmit-khaoot.vercel.app", "https://quiz-backend-qgro.onrender.com", "wss:", "ws:", "http://localhost:5000", "http://localhost:5173"],
            frameSrc: ["'none'"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            frameAncestors: ["'none'"],  // Clickjacking protection
            upgradeInsecureRequests: [],
        },
    },
    // Strict Transport Security — force HTTPS for 1 year
    strictTransportSecurity: {
        maxAge: 31536000, // 1 year in seconds
        includeSubDomains: true,
        preload: true,
    },
    // Prevent MIME sniffing
    xContentTypeOptions: true,
    // Clickjacking protection
    xFrameOptions: { action: 'deny' },
    // Referrer Policy
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    // Cross-Origin policies
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    // DNS Prefetch Control
    dnsPrefetchControl: { allow: false },
    // Disable X-Powered-By
    hidePoweredBy: true,
    // Permissions Policy — restrict browser APIs
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },
}));

// 2.5 Additional Permissions-Policy header (camera, microphone, geolocation restrictions)
app.use((req, res, next) => {
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(self), geolocation=(), payment=(), usb=()');
    next();
});

// 3. Rate Limiting (Brute Force / DOS protection)
// 500 req / 15 min per IP: enough for a full class session (login + quiz join + answers = ~4 req/action)
// while still blocking automated brute-force attacks (which hit thousands of req/min)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.DISABLE_LIMITS === 'true' ? 100000000 : 500, // limit each IP to 500 requests per windowMs
    message: 'Too many requests from this IP, please try again after 15 minutes',
    standardHeaders: true,  // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false,   // Disable `X-RateLimit-*` headers
});
app.use('/api/', limiter); // Apply to all API routes

// 3.5 Progressive Speed Limiting (DDoS mitigation — slows down repeat offenders)
const speedLimiter = slowDown({
    windowMs: 15 * 60 * 1000, // 15 minutes
    delayAfter: process.env.DISABLE_LIMITS === 'true' ? 100000000 : 300, // allow 300 requests per windowMs without delay
    delayMs: (hits) => (hits - 300) * 100, // add 100ms delay per request above 300
    maxDelayMs: 5000, // max 5 second delay
});
app.use('/api/', speedLimiter);

// 4. Cookie Parser (for secure cookie-based token transport)
app.use(cookieParser(process.env.COOKIE_SECRET || process.env.JWT_SECRET));

// 5. Body Parser with limit (file uploads handled by multer separately)
app.use(express.json({ limit: '10mb' })); 
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// 6. Input Sanitization (PostgreSQL-appropriate — strips null bytes, control chars, prototype pollution)
app.use(sanitizeInput);

// 7. SQL Injection Detection (defense-in-depth — Prisma already uses parameterized queries)
app.use(sqlInjectionDetector);

// 8. Prevent HTTP Parameter Pollution
app.use(hpp());

const server = http.createServer(app);

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
    console.log('📁 Created uploads directory');
}

// Middleware

// Routes
const errorMiddleware = require('./middleware/errorMiddleware');

// Root & Health Check Endpoint
app.get('/', (req, res) => {
    res.status(200).json({ status: 'online', service: 'KMIT Quiz Backend', timestamp: new Date().toISOString() });
});

app.get('/api/health', async (req, res) => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        res.json({
            status: 'healthy',
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
            memoryUsage: process.memoryUsage(),
            quizEngine: quizState.getStats(),
        });
    } catch (err) {
        res.status(503).json({
            status: 'degraded',
            error: 'Database ping failed',
            timestamp: new Date().toISOString(),
            quizEngine: quizState.getStats(),
        });
    }
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/quiz', require('./routes/quiz'));
app.use('/api/admin', require('./routes/admin'));
app.use('/admin', require('./routes/admin'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/search', require('./routes/search'));
app.use('/api/students', require('./routes/students'));
app.use('/api/broadcast', require('./routes/broadcast'));
app.use('/api/developer', require('./routes/developer'));
app.use('/api/knowledge', require('./routes/knowledge'));

// Global Express Error Middleware Isolation
app.use(errorMiddleware);

// Unhandled Rejection & Uncaught Exception Process Guards
process.on('unhandledRejection', (reason, promise) => {
    console.error('[UNHANDLED_REJECTION_GUARD]', { reason, promise });
});

process.on('uncaughtException', (err) => {
    console.error('[UNCAUGHT_EXCEPTION_GUARD]', err);
});


// Socket.io Setup - Secure CORS
const io = new Server(server, {
    pingTimeout: 60000,
    pingInterval: 25000,
    cors: {
        origin: (origin, callback) => {
            if (!origin) return callback(null, true);
            const allowed = ['https://kmit-khaoot.vercel.app', 'http://localhost:5173'];
            const isVercelPreview = /^https:\/\/kmit-khaoot(-[a-z0-9]+)*\.vercel\.app$/.test(origin);
            if (allowed.includes(origin) || isVercelPreview) {
                callback(null, true);
            } else {
                callback(new Error('Not allowed by CORS'));
            }
        },
        methods: ["GET", "POST"]
    }
});

// Expose io and userSockets to routes
app.set('io', io);
const userSockets = new Map(); // Keep this globally declared and track sockets below
app.set('userSockets', userSockets);

// Per-socket rate limiter for high-frequency events (prevents DoS via event spam)
// Key: `${socketId}:${eventName}`, Value: timestamp of last emit
const socketRateLimit = new Map();
const SOCKET_RATE_LIMIT_MAX_ENTRIES = 50000; // Safety cap to prevent unbounded growth

// Helper: returns true if this socket+event is within rate limit window
const isSocketRateLimited = (socketId, eventName, windowMs = 500) => {
    const key = `${socketId}:${eventName}`;
    const now = Date.now();
    const last = socketRateLimit.get(key) || 0;
    if (now - last < windowMs) return true; // still within cooldown
    // Safety valve: if Map is too large, evict oldest entries
    if (socketRateLimit.size >= SOCKET_RATE_LIMIT_MAX_ENTRIES) {
        const oldestKey = socketRateLimit.keys().next().value;
        if (oldestKey) socketRateLimit.delete(oldestKey);
    }
    socketRateLimit.set(key, now);
    return false;
};

// Periodic cleanup: remove entries older than 60 seconds (stale disconnected sockets)
setInterval(() => {
    const cutoff = Date.now() - 60000;
    for (const [key, ts] of socketRateLimit.entries()) {
        if (ts < cutoff) socketRateLimit.delete(key);
    }
}, 30000); // Every 30 seconds

// JWT Socket Authentication Middleware
const jwt = require('jsonwebtoken');
io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.['x-auth-token'];
    if (!token) {
        // SECURITY: No fallback to client-provided user — require valid JWT
        return next(new Error('Authentication failed: Missing token'));
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.user = decoded.user;
        
        // Fetch username & name from DB to ensure it's up-to-date and complete
        if (socket.user && socket.user.id) {
            try {
                const dbUser = await prisma.user.findUnique({
                    where: { id: socket.user.id },
                    select: { username: true, name: true }
                });
                if (dbUser) {
                    socket.user.username = dbUser.username;
                    socket.user.name = dbUser.name || dbUser.username;
                }
            } catch (dbErr) {
                console.error('Error fetching user info for socket auth:', dbErr);
            }
        }
        
        next();
    } catch (err) {
        // SECURITY: No fallback — reject invalid tokens
        return next(new Error('Authentication failed: Invalid token'));
    }
});

// Store participants for each room
const roomParticipants = new Map(); // { quizId: [{ username, role, socketId }] }
// Store current state for each room
const roomState = new Map(); // { quizId: { currentQuestion: 0, status: 'started', endTime: TIMESTAMP } }
// Map to track which room/user a socket belongs to
const socketToUser = new Map(); // { socketId: { quizId, username } }

// HEARTBEAT SWEEPER: Every 5 seconds, check for stale connections
setInterval(() => {
    const now = Date.now();
    for (const [quizId, participants] of roomParticipants.entries()) {
        let updated = false;
        participants.forEach(p => {
            if (p.isOnline && p.lastSeen && (now - p.lastSeen > 10000)) {
                p.isOnline = false;
                p.socketId = null;
                updated = true;
                console.log(`[Heartbeat Timeout] User ${p.username} marked offline in room ${quizId}`);
            }
        });
        if (updated) {
            io.to(quizId).emit('participants_update', participants);
        }
    }
}, 5000);

// Global map to track user ID to socket IDs is already declared above and bound to express app

/**
 * Legacy answer submission path — used ONLY when the quiz is not in quizState memory.
 * This happens if the server restarted during an active quiz and the quiz data was lost.
 * It falls back to the original DB-backed approach so no answers are silently dropped.
 * Under normal 1000-student conditions this function is never called.
 */
async function _submitAnswerLegacy({ socket, quizId, studentId, questionIndex, answer, timeRemaining, realQuizId }) {
    try {
        console.warn(`[LegacyPath] Quiz ${realQuizId} not in memory — using legacy DB path for student ${studentId}`);
        let quiz = await getCache(`quiz:${realQuizId}`);
        if (!quiz) {
            quiz = await prisma.quiz.findUnique({ where: { id: realQuizId } });
            if (quiz) await setCache(`quiz:${realQuizId}`, quiz, 60000);
        }
        if (!quiz) return;

        if (quiz.questions && typeof quiz.questions === 'string') {
            try { quiz.questions = JSON.parse(quiz.questions); } catch (_) { quiz.questions = []; }
        }
        if (!Array.isArray(quiz.questions)) quiz.questions = [];
        quiz.questions = quiz.questions.map(q => {
            if (!q) return q;
            const options = Array.isArray(q.options)
                ? q.options.map(o => typeof o === 'string' ? o : (o?.text || o?.label || String(o)))
                : [];
            return { ...q, options };
        });

        const timerMax = quiz.duration > 0 ? (quiz.duration * 60) : (quiz.timerPerQuestion || 30);
        const qTimeTaken = Math.max(0, timerMax - (timeRemaining || 0));

        const question = quiz.questions[questionIndex];
        if (!question) return;

        const { isCorrect, points, resolvedCorrect } = gradeAnswer(answer, question);
        const username = socket.user?.username || studentId;

        // Upsert result in DB
        const resultUpsert = await prisma.result.upsert({
            where: { quizId_studentId: { quizId: realQuizId, studentId } },
            update: {},
            create: {
                quizId: realQuizId, studentId,
                score: 0, totalTimeTaken: 0,
                totalQuestions: quiz.questions.length, answers: []
            },
            include: { student: { select: { username: true } } }
        });

        const updatedAnswers = [...(resultUpsert.answers || [])];
        const existingIdx = updatedAnswers.findIndex(a => Number(a.questionIndex) === questionIndex);
        const answerData = { questionIndex, questionText: question.questionText, selectedOption: answer, correctOption: resolvedCorrect, isCorrect, timeTaken: qTimeTaken };
        let newScore = resultUpsert.score || 0;
        let newTime  = resultUpsert.totalTimeTaken || 0;
        if (existingIdx >= 0) {
            const old = updatedAnswers[existingIdx];
            newScore = newScore - (old.isCorrect ? (question.points || 10) : 0) + points;
            newTime  = newTime - (old.timeTaken || 0) + qTimeTaken;
            updatedAnswers[existingIdx] = answerData;
        } else {
            updatedAnswers.push(answerData);
            newScore += points;
            newTime  += qTimeTaken;
        }

        await prisma.result.update({
            where: { id: resultUpsert.id },
            data: { score: newScore, totalTimeTaken: newTime, answers: updatedAnswers, status: 'in-progress', lastAnsweredAt: new Date() }
        });

        socket.emit('answer_feedback', { isFast: false, isUnattempted: false, message: '✅ Answer recorded!', timeTaken: qTimeTaken });
        io.to(realQuizId).emit('student_progress_update', { studentId, username, questionIndex, answered: true, isCorrect });
    } catch (err) {
        console.error('[LegacyPath] Error in legacy submit:', err.message);
    }
}

io.on('connection', async (socket) => {
    console.log('User connected securely:', socket.id);


    // SECURITY: Validate JWT expiration and signature on every incoming socket event
    socket.use(async ([event, ...args], next) => {
        if (event === 'disconnect') return next();

        const token = socket.handshake.auth?.token || socket.handshake.headers?.['x-auth-token'];
        if (token) {
            try {
                jwt.verify(token, process.env.JWT_SECRET || 'secret');
            } catch (err) {
                console.warn(`[Security Alert] Socket event '${event}' blocked: Token expired or invalid for socket ${socket.id}`);
                return socket.emit('error_alert', { msg: 'Session expired. Please login again.', code: 'SESSION_EXPIRED' });
            }
        }
        next();
    });

    // Auto-identify securely from verified JWT payload
    if (socket.user && socket.user.id) {
        const userId = socket.user.id;
        socket.userId = userId;
        if (!userSockets.has(userId)) {
            userSockets.set(userId, new Set());
        }
        userSockets.get(userId).add(socket.id);
        console.log(`User identified securely: ${userId} (${socket.user.username}) for socket ${socket.id}`);
        // Fire-and-forget: online status update must NOT block connection setup.
        // With 1000 simultaneous joins, awaiting 1000 DB writes here would saturate the pool.
        prisma.user.update({
            where: { id: userId },
            data: { isOnline: true }
        }).then(() => {
            // Scoped broadcast: only to rooms this user participates in (not all connected sockets)
            for (const [quizId, participants] of roomParticipants.entries()) {
                if (participants.some(p => (p._id || p.id) === userId)) {
                    io.to(quizId).emit('user_status_change', { userId, isOnline: true });
                }
            }
        }).catch(err => {
            console.error('Error updating online status on connect:', err.message);
        });
    }

    // Global Identity check fallback (fully validated)
    socket.on('identify', async (userId) => {
        if (!userId) return;
        if (!socket.user || socket.user.id !== userId) {
            console.warn(`[Security Alert] Spoofed identify event blocked for user ${userId} on socket ${socket.id}`);
            return socket.emit('error_alert', { msg: 'Unauthorized identity spoofing blocked.' });
        }
        
        console.log(`User identified securely (fallback): ${userId} for socket ${socket.id}`);
        if (!userSockets.has(userId)) {
            userSockets.set(userId, new Set());
        }
        userSockets.get(userId).add(socket.id);
        socket.userId = userId;

        try {
            await prisma.user.update({
                where: { id: userId },
                data: { isOnline: true }
            });
            // Scoped broadcast: only to rooms this user participates in
            for (const [quizId, participants] of roomParticipants.entries()) {
                if (participants.some(p => (p._id || p.id) === userId)) {
                    io.to(quizId).emit('user_status_change', { userId, isOnline: true });
                }
            }
        } catch (err) {
            console.error('Error updating online status:', err);
        }
    });

    socket.on('logout', async (userId) => {
        if (!userId) return;
        if (!socket.user || socket.user.id !== userId) {
            return socket.emit('error_alert', { msg: 'Unauthorized logout action.' });
        }
        try {
            await prisma.user.update({
                where: { id: userId },
                data: { isOnline: false }
            });
            userSockets.delete(userId);
            // Scoped broadcast: only to rooms this user participates in
            for (const [quizId, participants] of roomParticipants.entries()) {
                let updated = false;
                participants.forEach(p => {
                    if (String(p._id || p.id) === String(userId)) {
                        p.isOnline = false;
                        p.socketId = null;
                        p.lastSeen = Date.now();
                        updated = true;
                    }
                });
                if (updated) {
                    io.to(quizId).emit('participants_update', participants);
                }
            }
            console.log(`User ${userId} logged out securely and marked offline`);
        } catch (err) {
            console.error('Error on logout status update:', err);
        }
    });


    socket.on('join_room', async ({ quizId, user }) => {
        // SECURITY CHECK: Verify user identity matches socket.user payload safely
        if (!socket.user) {
            console.warn(`[Security Alert] Unauthenticated socket ${socket.id} attempted join_room`);
            return socket.emit('error_alert', { msg: 'Authentication token missing or invalid.' });
        }

        const clientUsername = (user?.username || socket.user.username || '').toString().trim();
        const verifiedUsername = (socket.user.username || '').toString().trim();

        if (clientUsername.toLowerCase() !== verifiedUsername.toLowerCase()) {
            console.warn(`[Security Alert] join_room username mismatch blocked for socket ${socket.id} (client: ${clientUsername}, token: ${verifiedUsername})`);
            return socket.emit('error_alert', { msg: 'Unauthorized identity mismatch.' });
        }

        // Normalize 6-digit PIN or Quiz ID to actual database Quiz ID.
        // First try in-memory cache (populated when teacher starts the quiz) — O(1), zero DB.
        // Fall back to DB only when the quiz hasn't been started yet or cache miss.
        let realQuizId = quizState.resolveQuizId(quizId);
        if (realQuizId === quizId) {
            // Cache miss — check if it looks like a UUID (already a quiz ID) or needs DB lookup
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(quizId);
            if (!isUUID) {
                // Only hit DB for non-UUID values (i.e. join codes / PINs)
                try {
                    const foundQuiz = await prisma.quiz.findFirst({
                        where: { OR: [{ id: quizId }, { joinCode: quizId }] },
                        select: { id: true, joinCode: true }
                    });
                    if (foundQuiz) {
                        realQuizId = foundQuiz.id;
                        // Cache it for future lookups (heartbeats, reconnects, etc.)
                        if (foundQuiz.joinCode) quizState.registerPin(foundQuiz.joinCode, foundQuiz.id);
                    }
                } catch (err) {
                    console.error('Error resolving PIN in join_room:', err.message);
                }
            }
        }

        socket.join(realQuizId);

        // Fetch and emit lobby study summary to the user
        prisma.quiz.findUnique({
            where: { id: realQuizId },
            select: { lobbySummary: true }
        }).then(q => {
            if (q && q.lobbySummary) {
                socket.emit('lobby_summary_update', { lobbySummary: q.lobbySummary });
            }
        }).catch(err => {
            console.error('Error fetching lobby summary on join_room:', err);
        });

        // Track this socket's association for disconnect cleanup
        socketToUser.set(socket.id, { quizId: realQuizId, username: verifiedUsername });

        if (!roomParticipants.has(realQuizId)) {
            roomParticipants.set(realQuizId, []);
        }

        const participants = roomParticipants.get(realQuizId);
        const existingIdx = participants.findIndex(p => (p.username || '').toLowerCase() === verifiedUsername.toLowerCase());

        // Reconstruct secure user properties from JWT context
        const secureUser = {
            _id: socket.user.id,
            username: socket.user.username,
            role: socket.user.role
        };

        const userData = {
    ...secureUser,
    socketId: socket.id,
    isOnline: true,
    lastSeen: Date.now(),
    joinedAt:
        existingIdx !== -1
            ? participants[existingIdx]?.joinedAt || Date.now()
            : Date.now()
};
        if (existingIdx !== -1) {
            participants[existingIdx] = userData;
        } else {
            participants.push(userData);
        }

        console.log(`Secure User ${socket.user.username} (${socket.user.role}) joined room ${realQuizId}. Total participants: ${participants.length}`);
        // Always send the full current participant list directly to the socket that just joined,
        // so the teacher always sees the latest list even if they join after students.
        const cleanedParticipants = [...participants];

socket.emit('participants_update', cleanedParticipants);

io.to(realQuizId).emit(
    'participants_update',
    cleanedParticipants
);

        // SYNC STATE
        const state = roomState.get(realQuizId);
        if (state) {
            if (state.status === 'started') socket.emit('quiz_started');
            if (state.currentQuestion !== undefined) socket.emit('change_question', { questionIndex: state.currentQuestion });

            // MASTER TIMER SYNC
            if (state.endTime) {
                const timeLeft = Math.max(0, Math.ceil((state.endTime - Date.now()) / 1000));
                socket.emit('sync_timer', { timeLeft });
            }
            // Send persisted progress to teacher
            if (state.progress) {
                console.log(`Sending progress history to secure ${socket.user.username}`);
                socket.emit('progress_history', state.progress);
            }
            // Sync leaderboard for all participants (Teacher and Students) on join/reconnect
            if (state.leaderboard) {
                socket.emit('question_leaderboard', {
                    questionIndex: state.currentQuestion || 0,
                    leaderboard: state.leaderboard,
                    liveInsights: state.liveInsights || null
                });
            }
        }
    });

    socket.on('heartbeat', ({ quizId, userId, username }) => {
        // PERFORMANCE: heartbeats fire every 5s from every student.
        // Must NEVER hit the DB. Use in-memory PIN cache for ID resolution.
        if (!quizId) return;
        const uid = userId || socket.user?.id || socket.user?.username || username;
        if (!uid) return;

        // Resolve PIN → UUID in memory (zero DB)
        const realQuizId = quizState.resolveQuizId(quizId);

        const participants = roomParticipants.get(realQuizId);
        if (participants) {
            const p = participants.find(
                part => String(part._id || part.username || part.id).toLowerCase() === String(uid).toLowerCase()
            );
            if (p) {
                p.lastSeen = Date.now();
                if (!p.isOnline) {
                    p.isOnline = true;
                    io.to(realQuizId).emit('participants_update', participants);
                }
            }
        }
    });

    socket.on('reconnectUser', ({ quizId, user }) => {
        // SECURITY CHECK: Verify identity matches socket.user payload safely
        if (!socket.user) {
            console.warn(`[Security Alert] Unauthenticated socket ${socket.id} attempted reconnectUser`);
            return socket.emit('error_alert', { msg: 'Authentication token missing or invalid.' });
        }

        const clientUsername = (user?.username || socket.user.username || '').toString().trim();
        const verifiedUsername = (socket.user.username || '').toString().trim();

        if (clientUsername.toLowerCase() !== verifiedUsername.toLowerCase()) {
            console.warn(`[Security Alert] reconnectUser username mismatch blocked for socket ${socket.id} (client: ${clientUsername}, token: ${verifiedUsername})`);
            return socket.emit('error_alert', { msg: 'Unauthorized identity mismatch.' });
        }

        socket.join(quizId);
        socketToUser.set(socket.id, { quizId, username: verifiedUsername });

        if (!roomParticipants.has(quizId)) {
            roomParticipants.set(quizId, []);
        }

        const participants = roomParticipants.get(quizId);
        const existingIdx = participants.findIndex(p => (p.username || '').toLowerCase() === verifiedUsername.toLowerCase());

        const secureUser = {
            _id: socket.user.id,
            username: socket.user.username,
            role: socket.user.role
        };

        const userData = {
    ...secureUser,
    socketId: socket.id,
    isOnline: true,
    lastSeen: Date.now(),
    joinedAt:
        existingIdx !== -1
            ? participants[existingIdx]?.joinedAt || Date.now()
            : Date.now()
};
        if (existingIdx !== -1) {
            participants[existingIdx] = userData;
        } else {
            participants.push(userData);
        }

        console.log(`Secure User ${socket.user.username} (${socket.user.role}) reconnected to room ${quizId}. ID: ${socket.user.id}`);
        io.to(quizId).emit(
    'participants_update',
    [...participants]
);

        const sendRestoreState = async () => {
            let state = roomState.get(quizId) || {};
            
            // Re-fetch/Rebuild state logic ...
             if (!state.leaderboard || !state.progress) {
                 try {
                     const quizInfo = await prisma.quiz.findUnique({ where: { id: quizId } });
                     
                     if (quizInfo) {
                         const allResults = await prisma.result.findMany({
                             where: { quizId: quizId },
                             include: { student: { select: { username: true } } }
                         });
                         
                         // Rebuild Leaderboard
                         const leaderboard = allResults
                             .map(r => ({
                                 studentId: r.studentId,
                                 username: r.student?.username || 'Unknown',
                                 currentScore: r.score || 0,
                                 totalTimeTaken: r.totalTimeTaken || 0,
                                 lastAnsweredAt: r.lastAnsweredAt || r.startedAt || new Date(),
                                 answeredQuestions: r.answers?.length || 0
                             }))
                             .sort((a, b) => {
                                 if (b.currentScore !== a.currentScore) return b.currentScore - a.currentScore;
                                 if (a.totalTimeTaken !== b.totalTimeTaken) return a.totalTimeTaken - b.totalTimeTaken;
                                 return new Date(a.lastAnsweredAt) - new Date(b.lastAnsweredAt);
                             })
                             .map((item, index) => ({ ...item, rank: index + 1 }));

                         // Rebuild Progress Dictionary
                         const progress = {};
                         allResults.forEach(r => {
                             const studentIdStr = r.studentId;
                             if (studentIdStr) {
                                  progress[studentIdStr] = {};
                                  r.answers.forEach(ans => {
                                      const qIdx = quizInfo.questions.findIndex(q => q.questionText === ans.questionText);
                                      if (qIdx !== -1) {
                                          progress[studentIdStr][qIdx] = {
                                              answered: true,
                                              isCorrect: ans.isCorrect,
                                              selectedOption: ans.selectedOption
                                          };
                                      }
                                  });
                             }
                         });

                         state = { ...state, leaderboard, progress, status: quizInfo.status };
                         roomState.set(quizId, state);
                     }
                 } catch (err) {
                     console.error('Error rebuilding state on reconnect:', err);
                 }
             }

             let timeLeft = 0;
             if (state.endTime) {
                 timeLeft = Math.max(0, Math.ceil((state.endTime - Date.now()) / 1000));
             }

             const restoreStatePayload = {
                 currentQuestionIndex: state.currentQuestion || 0,
                 remainingTime: timeLeft,
                 quizStatus: state.status,
                 leaderboard: state.leaderboard || [],
                 participants: participants,
                 progress: state.progress || {},
                 cheatAlerts: state.cheatAlerts || []
             };
             if (state.currentQuestion !== undefined) {
                 socket.emit('change_question', { questionIndex: state.currentQuestion });
             }
             socket.emit('restoreState', restoreStatePayload);
             console.log(`Sent secure restoreState to ${socket.user.username}`);
        };
        
        sendRestoreState();
    });

    socket.on('start_quiz', async (quizId) => {
        // SECURITY CHECK: Verify teacher role
        if (!socket.user || socket.user.role !== 'teacher') {
            console.warn(`[Security Alert] Non-teacher socket ${socket.id} attempted to start quiz ${quizId}`);
            return socket.emit('error_alert', { msg: 'Unauthorized action.' });
        }
        try {
            // SECURITY: Always load from DB — never trust frontend cached questions
            const quiz = await prisma.quiz.findUnique({ where: { id: quizId } });
            if (!quiz || quiz.createdById !== socket.user.id) {
                console.warn(`[Security Alert] Socket ${socket.id} attempted to start unauthorized quiz ${quizId}`);
                return socket.emit('error_alert', { msg: 'Unauthorized live room action.' });
            }

            // Normalize questions array (parse JSON string if stored as string)
            if (quiz.questions && typeof quiz.questions === 'string') {
                try { quiz.questions = JSON.parse(quiz.questions); } catch (_) { quiz.questions = []; }
            }
            if (!Array.isArray(quiz.questions)) quiz.questions = [];
            // Normalize options to plain strings
            quiz.questions = quiz.questions.map(q => {
                if (!q) return q;
                const options = Array.isArray(q.options)
                    ? q.options.map(o => typeof o === 'string' ? o : (o?.text || o?.label || String(o)))
                    : [];
                return { ...q, options };
            });

            // INTEGRITY CHECK: Verify locked quiz has not been tampered before going live
            if (quiz.isLocked && quiz.quizHash) {
                const integrity = verifyQuizIntegrity(quiz);
                if (!integrity.valid) {
                    console.error(
                        `[QuizIntegrityViolation] start_quiz blocked for quiz ${quizId}:`,
                        `stored=${integrity.stored?.slice(0, 16)}...`,
                        `computed=${integrity.computed?.slice(0, 16)}...`
                    );
                    return socket.emit('error_alert', {
                        msg: 'Quiz integrity check failed — questions may have been tampered with. Cannot start quiz.',
                        code: 'INTEGRITY_VIOLATION'
                    });
                }
                console.log(`[QuizStart] Integrity verified for quiz ${quizId} (hash OK)`);
            }

            // Calculate duration in ms
            let durationMs = 0;
            if (quiz.duration > 0) {
                durationMs = quiz.duration * 60 * 1000;
            } else {
                // Per-question: estimate total time
                durationMs = (quiz.questions.length * (quiz.timerPerQuestion || 30)) * 1000;
            }
            const endTime = Date.now() + durationMs;

            // ── Initialize authoritative in-memory quiz state ─────────────────
            // This pre-loads quiz data so answer submissions require ZERO DB reads.
            quizState.initQuiz(quizId, quiz, { currentQuestion: 0, endTime, status: 'started' });
            // ─────────────────────────────────────────────────────────────────

            const state = roomState.get(quizId) || {};
            roomState.set(quizId, { ...state, status: 'started', currentQuestion: 0, endTime });

            await prisma.quiz.update({
                where: { id: quizId },
                data: { status: 'started', endTime: new Date(endTime) } // Persist endTime so scheduler can reload after server restart
            });
            io.to(quizId).emit('quiz_started');
            io.to(quizId).emit('sync_timer', { timeLeft: Math.max(0, Math.ceil((endTime - Date.now()) / 1000)) });

            // Auto-terminate when global timer expires (for duration-based quizzes)
            if (quiz.duration > 0) {
                setTimeout(async () => {
                    const currentState = roomState.get(quizId.toString());
                    if (currentState && currentState.status !== 'finished') {
                        roomState.delete(quizId.toString());
                        quizState.closeQuiz(quizId);
                        try {
                            // Drain pending writes before auto-finishing
                            await quizState.drainWrites(quizId, 8000);
                            await prisma.quiz.update({
                                where: { id: quizId },
                                data: { status: 'finished' }
                            });
                        } catch (err2) {
                            console.error('Error auto-finishing quiz:', err2.message);
                        }
                        io.to(quizId).emit('quiz_ended');
                        console.log(`Quiz ${quizId} auto-terminated after global timer expired.`);
                        quizState.cleanupQuiz(quizId);
                    }
                }, durationMs + 3000); // small buffer
            }
        } catch (err) {
            console.error('Error starting quiz:', err);
        }
    });

    socket.on('end_quiz', async (quizId) => {
        // SECURITY CHECK: Verify teacher role
        if (!socket.user || socket.user.role !== 'teacher') {
            console.warn(`[Security Alert] Non-teacher socket ${socket.id} attempted to end quiz ${quizId}`);
            return socket.emit('error_alert', { msg: 'Unauthorized action.' });
        }
        try {
            // SECURITY: Always verify teacher owns the quiz from DB
            const quiz = await prisma.quiz.findUnique({ where: { id: quizId } });
            if (!quiz || quiz.createdById !== socket.user.id) {
                console.warn(`[Security Alert] Socket ${socket.id} attempted to end unauthorized quiz ${quizId}`);
                return socket.emit('error_alert', { msg: 'Unauthorized live room action.' });
            }

            // ── STEP 1: Stop accepting new submissions immediately ─────────────
            quizState.closeQuiz(quizId);
            roomState.delete(quizId);
            console.log(`[QuizEnd] Quiz ${quizId} closed to new submissions.`);

            // ── STEP 2: Wait briefly for any in-flight answer processing to settle ─
            // processAnswer() is synchronous so any in-flight calls complete on
            // the current event loop tick. A small async yield is sufficient.
            await new Promise(resolve => setTimeout(resolve, 100));

            // ── STEP 3: Drain the write buffer to DB before finalizing ──────────
            // This ensures all pending in-memory writes are persisted before we
            // compute the final leaderboard from DB.
            console.log(`[QuizEnd] Draining write buffer for quiz ${quizId}...`);
            const drainResult = await quizState.drainWrites(quizId, 10000);
            console.log(`[QuizEnd] Drain complete: ${drainResult.flushed} flushed, ${drainResult.failed} failed.`);

            // ── STEP 4: Create missing zero-score records for non-answerers ──────
            // Use a single DB query to find which students already have records,
            // then batch-create only the missing ones. Avoids N individual findFirst() calls.
            const participants = roomParticipants.get(quizId) || [];
            const realStudents = participants.filter(p =>
                p.role?.toLowerCase() !== 'teacher' && !((p._id || p.id || '').toString().startsWith('bot_student_'))
            );
            const totalQuestions = Array.isArray(quiz.questions) ? quiz.questions.length : 0;

            if (realStudents.length > 0) {
                // Fetch all existing result records in one query
                const existingResults = await prisma.result.findMany({
                    where: { quizId, studentId: { in: realStudents.map(p => (p._id || p.id || '').toString()) } },
                    select: { studentId: true }
                });
                const existingIds = new Set(existingResults.map(r => r.studentId));

                // Build list of students without any result record
                const missingStudents = realStudents.filter(p => {
                    const sid = (p._id || p.id || '').toString();
                    return sid && !existingIds.has(sid);
                });

                if (missingStudents.length > 0) {
                    console.log(`[QuizEnd] Creating ${missingStudents.length} zero-score records...`);
                    // Create in bounded batches to avoid exhausting the connection pool
                    const BATCH = 10;
                    for (let i = 0; i < missingStudents.length; i += BATCH) {
                        const batch = missingStudents.slice(i, i + BATCH);
                        await Promise.allSettled(batch.map(p => {
                            const studentId = (p._id || p.id || '').toString();
                            return prisma.result.create({
                                data: {
                                    quizId,
                                    studentId,
                                    score: 0,
                                    totalTimeTaken: 0,
                                    totalQuestions,
                                    answers: [],
                                    status: 'completed',
                                    startedAt: new Date(),
                                    completedAt: new Date(),
                                    lastAnsweredAt: new Date()
                                }
                            }).catch(() => {}); // ignore unique constraint violations
                        }));
                    }
                }
            }

            // ── STEP 5: Mark all remaining in-progress results as completed ──────
            await prisma.result.updateMany({
                where: { quizId, status: 'in-progress' },
                data: { status: 'completed', completedAt: new Date() }
            });

            // ── STEP 6: Build final leaderboard from in-memory state (authoritative) ─
            // Fall back to DB if memory state is unavailable (e.g. server restarted).
            let finalLeaderboard;
            const memLeaderboard = quizState.getLeaderboard(quizId);

            if (memLeaderboard.length > 0) {
                // Use in-memory state — it's authoritative and already sorted
                finalLeaderboard = memLeaderboard;
                console.log(`[QuizEnd] Final leaderboard built from memory: ${finalLeaderboard.length} students.`);
            } else {
                // Memory state unavailable — fall back to DB
                console.log(`[QuizEnd] Memory state unavailable, falling back to DB for leaderboard.`);
                const allResults = await prisma.result.findMany({
                    where: { quizId },
                    include: { student: { select: { username: true } } }
                });
                finalLeaderboard = allResults
                    .map(r => ({
                        studentId: r.studentId,
                        username: r.student?.username || 'Unknown',
                        currentScore: r.score || 0,
                        totalTimeTaken: r.totalTimeTaken || 0,
                        lastAnsweredAt: r.lastAnsweredAt || r.startedAt || new Date(),
                        answeredQuestions: r.answers?.length || 0
                    }))
                    .sort((a, b) => {
                        if (b.currentScore !== a.currentScore) return b.currentScore - a.currentScore;
                        if (a.totalTimeTaken !== b.totalTimeTaken) return a.totalTimeTaken - b.totalTimeTaken;
                        return new Date(a.lastAnsweredAt) - new Date(b.lastAnsweredAt);
                    })
                    .map((item, index) => ({ ...item, rank: index + 1 }));
            }

            // ── STEP 7: Save final leaderboard to DB ─────────────────────────────
            const topStudent = finalLeaderboard[0]?.username || null;
            await prisma.quiz.update({
                where: { id: quizId },
                data: {
                    status: 'finished',
                    finalLeaderboard: finalLeaderboard.map(r => ({
                        studentId: r.studentId,
                        username: r.username,
                        currentScore: r.currentScore,
                        answeredQuestions: r.answeredQuestions,
                        rank: r.rank
                    })),
                    finalInsights: {
                        topStudent,
                        hardestQuestion: null,
                        easiestQuestion: null
                    }
                }
            });

            console.log(`[QuizEnd] Quiz ${quizId} finalized. Students: ${finalLeaderboard.length}. Top: ${topStudent}.`);

            // ── STEP 8: Broadcast — AFTER DB is confirmed written ────────────────
            io.to(quizId).emit('quiz_ended');
            socket.emit('quiz_ended_success', { quizId });

            // ── STEP 9: Clean up in-memory state ─────────────────────────────────
            quizState.cleanupQuiz(quizId);

        } catch (err) {
            console.error('[QuizEnd] Error ending quiz:', err.message);
            // Ensure students are not stuck even if finalization partially fails
            io.to(quizId).emit('quiz_ended');
            socket.emit('quiz_ended_success', { quizId });
            // Attempt cleanup even on error
            try { quizState.cleanupQuiz(quizId); } catch (_) {}
        }
    });

    // Add question to live quiz
    socket.on('add_question', async ({ quizId, question }) => {
        // SECURITY CHECK: Verify teacher role
        if (!socket.user || socket.user.role !== 'teacher') {
            return socket.emit('error_alert', { msg: 'Unauthorized action.' });
        }
        try {
            const quiz = await prisma.quiz.findUnique({ where: { id: quizId } });
            if (!quiz || quiz.createdById !== socket.user.id) {
                return socket.emit('error_alert', { msg: 'Unauthorized live room action.' });
            }

            // IMMUTABILITY GUARD: Cannot add questions to a locked (published) quiz
            if (quiz.isLocked) {
                console.warn(`[ImmutabilityBlock] add_question blocked for locked quiz ${quizId} by ${socket.user.id}`);
                return socket.emit('error_alert', {
                    msg: 'Quiz is locked after publishing. Questions cannot be added or modified.',
                    code: 'QUIZ_LOCKED'
                });
            }

            console.log(`Adding question to quiz: ${quizId}`);
            const updatedQuestions = [...quiz.questions, question];
            await prisma.quiz.update({
                where: { id: quizId },
                data: { questions: updatedQuestions }
            });

            // Broadcast new question to all students in the room
            io.to(quizId).emit('new_question_added', {
                question,
                questionIndex: updatedQuestions.length - 1,
                totalQuestions: updatedQuestions.length
            });

            console.log(`Question added successfully to quiz ${quizId}`);
        } catch (err) {
            console.error('Error adding question:', err);
        }
    });

    // Handle teacher changing question (Navigation)
    socket.on('change_question', ({ quizId, questionIndex }) => {
        // SECURITY CHECK: Verify teacher role
        if (!socket.user || socket.user.role !== 'teacher') {
            return socket.emit('error_alert', { msg: 'Unauthorized action.' });
        }

        // PERFORMANCE: Use in-memory quiz state instead of DB lookup.
        // Ownership was verified at start_quiz. JWT guarantees role=teacher here.
        const memState = quizState.getQuizState(quizId);
        const state = roomState.get(quizId) || {};

        // Get quiz timing from in-memory state (loaded at start_quiz)
        const quizData = memState?.quiz;

        // Reset Master Time for the new question if it's per-question
        let endTime = null;
        if (quizData && quizData.duration === 0) {
            endTime = Date.now() + ((quizData.timerPerQuestion || 30) * 1000);
        } else if (!quizData && state.endTime) {
            // Memory state unavailable — keep existing timer
        }

        if (endTime) state.endTime = endTime;
        roomState.set(quizId, { ...state, currentQuestion: parseInt(questionIndex) });

        // Also update quizState for reconnect sync
        quizState.updateQuizState(quizId, { currentQuestion: parseInt(questionIndex), ...(endTime ? { endTime } : {}) });

        io.to(quizId).emit('change_question', { questionIndex });
        if (endTime) io.to(quizId).emit('sync_timer', { timeLeft: Math.max(0, Math.ceil((endTime - Date.now()) / 1000)) });
    });

    // Tracking which question a student is currently viewing
    socket.on('student_question_focus', ({ quizId, studentId, username, questionIndex }) => {
        // SECURITY CHECK: Verify student identity matches socket.user payload
        if (!socket.user || socket.user.id !== studentId) {
            return;
        }
        console.log(`Student ${username} focused on question ${questionIndex} in quiz ${quizId}`);

        io.to(quizId).emit('student_focus_update', {
            studentId,
            username,
            questionIndex
        });
    });

    socket.on('student_cheated_alert', async (payload) => {
        const { quizId, studentId, action, timestamp } = payload;
        // SECURITY CHECK: Verify student identity matches socket.user payload
        if (!socket.user || socket.user.id !== studentId) {
            return;
        }
        console.log(`[Exam Security Alert] Student ${socket.user.username || studentId} triggered cheat alert: ${action} in quiz ${quizId}`);

        const warningPayload = {
            ...payload,
            name: socket.user.name || socket.user.username || 'Student',
            rollNumber: socket.user.username || 'N/A',
            timestamp: timestamp || new Date()
        };

        // Persist to CheatingLog database table
        try {
            await prisma.cheatingLog.create({
                data: {
                    quizId,
                    studentId,
                    action: action || 'suspicious_activity',
                    details: payload,
                    studentName: socket.user.name || socket.user.username || 'Student',
                    studentRollNumber: socket.user.username || 'N/A',
                    timestamp: new Date(warningPayload.timestamp)
                }
            });
        } catch (dbErr) {
            console.error('[Exam Security Alert] Failed to persist CheatingLog:', dbErr);
        }

        // Save in roomState
        const state = roomState.get(quizId);
        if (state) {
            if (!state.cheatAlerts) {
                state.cheatAlerts = [];
            }
            state.cheatAlerts.push(warningPayload);
        } else {
            roomState.set(quizId, {
                cheatAlerts: [warningPayload]
            });
        }

        // Broadcast to the quiz room so the teacher dashboard receives the cheat warning in real-time
        io.to(quizId).emit('student_cheat_warning', warningPayload);
    });

    // Increase time for the current question
    socket.on('increase_time', ({ quizId, additionalSeconds }) => {
        // SECURITY CHECK: Verify teacher role
        if (!socket.user || socket.user.role !== 'teacher') {
            return socket.emit('error_alert', { msg: 'Unauthorized action.' });
        }
        // PERFORMANCE: No DB lookup needed — teacher role verified by JWT.
        // In-memory state has the current endTime.
        const state = roomState.get(quizId);
        if (state && state.endTime) {
            state.endTime += (additionalSeconds * 1000);
            roomState.set(quizId, { ...state, endTime: state.endTime });
            // Keep quizState in sync for reconnect accuracy
            quizState.updateQuizState(quizId, { endTime: state.endTime });

            const timeLeft = Math.max(0, Math.ceil((state.endTime - Date.now()) / 1000));
            io.to(quizId).emit('timer_update', { additionalSeconds });
            io.to(quizId).emit('sync_timer', { timeLeft });
        }
    });

    // Handle individual question submission during live quiz
    // ────────────────────────────────────────────────────────────────────────────
    // HOT PATH — ZERO DATABASE CALLS IN NORMAL OPERATION
    // Flow: JWT auth → in-memory validation → in-memory grade → in-memory result
    //       → immediate WS response → async DB queue (non-blocking)
    // ────────────────────────────────────────────────────────────────────────────
    socket.on('submit_question_answer', ({ quizId, studentId, questionIndex, answer, timeRemaining }) => {
        // ── SECURITY: Verify authenticated user identity ─────────────────────
        if (!socket.user || socket.user.id !== studentId) {
            console.warn(`[Security Alert] submit_question_answer spoofing blocked for socket ${socket.id} (studentId: ${studentId})`);
            return socket.emit('error_alert', { msg: 'Unauthorized action.' });
        }

        // ── RATE LIMIT: prevent answer-spam DoS (500ms per-socket cooldown) ──
        if (isSocketRateLimited(socket.id, 'submit_question_answer', 500)) {
            return; // Silent drop — legitimate clients debounce on submit
        }

        // ── Input normalization ───────────────────────────────────────────────
        questionIndex = parseInt(questionIndex);
        if (isNaN(questionIndex) || questionIndex < 0) return;

        // ── Resolve quiz ID (in-memory PIN cache — zero DB) ───────────────────
        const realQuizId = quizState.resolveQuizId(quizId);

        // ── Validate quiz is active in memory ─────────────────────────────────
        const memState = quizState.getQuizState(realQuizId);
        if (!memState) {
            // Quiz not in memory — fall back to legacy path for robustness
            // (e.g. server restarted during an active quiz)
            _submitAnswerLegacy({ socket, quizId, studentId, questionIndex, answer, timeRemaining, realQuizId });
            return;
        }

        // ── Get quiz data for timer calculation (from memory — no DB read) ────
        const quizData = memState.quiz;
        const timerMax = quizData.duration > 0 ? (quizData.duration * 60) : (quizData.timerPerQuestion || 30);
        const qTimeTaken = Math.max(0, timerMax - (timeRemaining || 0));
        const username = socket.user.username || socket.user.name || studentId;

        // ── Process answer in memory (synchronous — no DB, no await) ──────────
        const result = quizState.processAnswer({
            quizId:        realQuizId,
            studentId,
            username,
            questionIndex,
            answer,
            qTimeTaken,
            gradeAnswer,
        });

        if (!result.accepted) {
            if (result.reason === 'duplicate') {
                console.log(`[STRICT MODE] Duplicate answer blocked: student=${studentId} q=${questionIndex}`);
            } else if (result.reason === 'quiz_ended') {
                console.log(`[AnswerReject] Quiz ended — answer rejected for student=${studentId}`);
            }
            return;
        }

        // ── Grading diagnostics (only in development) ─────────────────────────
        if (process.env.NODE_ENV !== 'production') {
            const q = Array.isArray(quizData.questions) ? quizData.questions[questionIndex] : null;
            console.log(`[GRADE] student=${studentId} q=${questionIndex} answer="${answer}" correct="${q?.correctAnswer}" isCorrect=${result.isCorrect} points=${result.points}`);
        }

        // ── Update legacy roomState progress (for teacher dashboard compat) ───
        const currentRoomState = roomState.get(realQuizId) || {};
        const updatedProgress = quizState.getProgress(realQuizId);
        roomState.set(realQuizId, { ...currentRoomState, progress: updatedProgress });

        // ── Immediate: emit result to this student ────────────────────────────
        // Speed feedback calculation (uses in-memory progress for peer comparison)
        const isUnattempted = answer === null || answer === undefined || String(answer).trim() === '';
        const otherTimes = [];
        const participants = roomParticipants.get(realQuizId) || [];
        participants.forEach(p => {
            const idKey = p._id || p.id;
            if (idKey && idKey.toString() !== studentId.toString()) {
                const prog = updatedProgress[idKey.toString()];
                if (prog && prog[questionIndex] && typeof prog[questionIndex].timeTaken === 'number') {
                    otherTimes.push(prog[questionIndex].timeTaken);
                }
            }
        });
        const isFast = !isUnattempted && (otherTimes.length > 0
            ? (qTimeTaken <= (otherTimes.reduce((a, b) => a + b, 0) / otherTimes.length))
            : (qTimeTaken <= timerMax * 0.3));

        const fastMessages = ['⚡ Fast Answer! Lightning speed!', '⚡ Quick Response Bonus! Unstoppable!', '🚀 Speed Demon! Lock and load for the next one!', '🔥 Absolute Heat! Superb speed!'];
        const slowMessages = ["🐢 Smooth and steady, but let's pick up the pace next time!", '⏰ Took your time! Try to lock it in quicker!', '💡 Great focus, but speed is key!'];
        const unattemptedMessages = ["⏳ Time is up! You didn't select an answer.", '❌ Question unanswered! Lock in a choice before the timer expires.'];
        const messageList = isUnattempted ? unattemptedMessages : (isFast ? fastMessages : slowMessages);

        socket.emit('answer_feedback', {
            isFast,
            isUnattempted,
            message: messageList[Math.floor(Math.random() * messageList.length)],
            timeTaken: qTimeTaken,
        });

        // ── Immediate: notify teacher of student progress ─────────────────────
        io.to(realQuizId).emit('student_progress_update', {
            studentId:     studentId.toString(),
            username:      username,
            questionIndex,
            answered:      true,
            isCorrect:     result.isCorrect,
        });

        // ── Throttled: broadcast leaderboard to all (not on every answer) ─────
        // Prevents broadcasting a full sorted array to 1000 clients every ms.
        if (quizState.shouldBroadcastLeaderboard(realQuizId)) {
            const leaderboard = quizState.getLeaderboard(realQuizId);
            // Also update legacy roomState leaderboard for reconnect sync
            roomState.set(realQuizId, { ...(roomState.get(realQuizId) || {}), leaderboard });
            io.to(realQuizId).emit('question_leaderboard', { questionIndex, leaderboard });
        }

        // ── Persistence is already queued inside processAnswer() ──────────────
        // No DB calls here. The write buffer will flush within FLUSH_INTERVAL_MS.
    });

    // Handle student submission of new question (added by student)
    socket.on('submit_new_question', async ({ quizId, studentId, questionIndex, answer }) => {
        // SECURITY CHECK: Verify student identity matches socket.user payload
        if (!socket.user || socket.user.id !== studentId) {
            return;
        }
        console.log(`Student ${studentId} submitted answer for question ${questionIndex} in quiz ${quizId}`);
        try {
            const quiz = await prisma.quiz.findUnique({ where: { id: quizId } });
            const result = await prisma.result.findFirst({ where: { quizId, studentId } });

            // Parse questions JSON string from DB if needed
            if (quiz && quiz.questions && typeof quiz.questions === 'string') {
                try { quiz.questions = JSON.parse(quiz.questions); } catch (_) { quiz.questions = []; }
            }

            if (quiz && result && Array.isArray(quiz.questions) && quiz.questions[questionIndex]) {
                const question = quiz.questions[questionIndex];

                // Use shared grading utility (eliminates duplicated grading logic)
                const { isCorrect, points } = gradeAnswer(answer, question);

                // Update result with new answer
                const updatedAnswers = [...result.answers, {
                    questionText: question.questionText,
                    selectedOption: answer,
                    correctOption: getCorrectOptionText(question),
                    isCorrect
                }];

                const updatedResult = await prisma.result.update({
                    where: { id: result.id },
                    data: {
                        answers: updatedAnswers,
                        score: result.score + points,
                        totalQuestions: quiz.questions.length
                    }
                });

                // Broadcast updated score to the room
                io.to(quizId).emit('score_updated', {
                    studentId,
                    newScore: updatedResult.score,
                    questionIndex
                });

                console.log(`Answer submitted successfully. New score: ${updatedResult.score}`);
            }
        } catch (err) {
            console.error('Error submitting new question answer:', err);
        }
    });

    // MEMORY LEAK REMEDIATION: Clean exit handler on leave_room
    // NOTE: We mark offline instead of deleting so reconnecting users keep their spot
    socket.on('leave_room', ({ quizId }) => {
        if (!quizId) return;
        socket.leave(quizId);
        
        const participants = roomParticipants.get(quizId);
        if (participants) {
            const idx = participants.findIndex(p => p.socketId === socket.id);
            if (idx !== -1) {
                // Only mark offline — do NOT remove. Reconnects restore them.
                participants[idx].isOnline = false;
                participants[idx].socketId = null;
                io.to(quizId).emit('participants_update', participants);
            }
            console.log(`Socket ${socket.id} securely left room ${quizId}. Participant marked offline (not removed).`);
        }
        socketToUser.delete(socket.id);
    });

    socket.on('disconnect', async () => {
    console.log('Socket disconnected:', socket.id);

    const userInfo = socketToUser.get(socket.id);

    if (userInfo) {
        const { quizId, username } = userInfo;

        const participants = roomParticipants.get(quizId);

        if (participants) {
            const idx = participants.findIndex(
                p => p.username === username
            );

            if (idx !== -1) {
                participants[idx].isOnline = false;
                participants[idx].lastSeen = Date.now();
participants[idx].socketId = null;

                console.log(
                    `${username} marked offline temporarily`
                );

                io.to(quizId).emit(
                    'participants_update',
                    [...participants]
                );
            }
        }

        socketToUser.delete(socket.id);
    }

    if (socket.userId && userSockets.has(socket.userId)) {
        const sockets = userSockets.get(socket.userId);

        sockets.delete(socket.id);

        if (sockets.size === 0) {
            userSockets.delete(socket.userId);

            // Fire-and-forget: same pattern as the connect handler.
            // Many students disconnecting at once (quiz end) must not cause a DB burst.
            prisma.user.update({
                where: { id: socket.userId },
                data: { isOnline: false }
            }).then(() => {
                io.emit('user_status_change', {
                    userId: socket.userId,
                    isOnline: false
                });
            }).catch(err => {
                console.error('Error updating offline status on disconnect:', err.message);
            });
        }
    }

    // Clean up rate limiter entries for this socket ID
    for (const key of socketRateLimit.keys()) {
        if (key.startsWith(`${socket.id}:`)) {
            socketRateLimit.delete(key);
        }
    }
});
});

// Render injects a default PORT (often 10000) inside all containers, but routes traffic 
// to the Dockerfile EXPOSE port (5000). To prevent port scan mismatch, we force 
// port 5000 when running on Render.
const PORT = process.env.RENDER === 'true' ? 5000 : (process.env.PORT || 5000);

// ─── HEALTH CHECK ENDPOINT ────────────────────────────────────────────────────
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// ─── GLOBAL SECURITY ERROR HANDLER ────────────────────────────────────────────
// Catches unhandled errors and masks internal details in production
app.use((err, req, res, _next) => {
    const { logSecurityEvent } = require('./middleware/security');
    const clientIp = req.ip || req.connection?.remoteAddress || 'unknown';

    logSecurityEvent({
        type: 'UNHANDLED_ERROR',
        message: err.message,
        ip: clientIp,
        method: req.method,
        path: req.originalUrl,
        requestId: req.requestId,
        stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
    });

    // CORS errors
    if (err.message === 'Not allowed by CORS') {
        return res.status(403).json({ msg: 'CORS policy violation' });
    }

    // Multer file upload errors
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ msg: 'File too large. Maximum size is 50MB.' });
    }
    if (err.message && err.message.includes('Invalid file type')) {
        return res.status(400).json({ msg: err.message });
    }

    // Generic error — mask internals in production
    const statusCode = err.statusCode || err.status || 500;
    const isProduction = process.env.NODE_ENV === 'production';
    res.status(statusCode).json({
        msg: isProduction && statusCode === 500
            ? 'Internal server error'
            : (err.message || 'Internal server error'),
        requestId: req.requestId,
        // Stack and details only exposed in development
        ...(isProduction ? {} : { stack: err.stack, detail: err.message }),
    });
});

// ─── DATABASE KEEP-ALIVE PING ─────────────────────────────────────────────────
// Serverless PostgreSQL providers (Neon, Supabase) pause after prolonged inactivity.
// Pinging every 9 minutes keeps the connection warm and avoids cold-start latency.
const DB_PING_INTERVAL = 9 * 60 * 1000; // 9 minutes
setInterval(async () => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        console.log('[DB Keep-Alive] Ping OK -', new Date().toLocaleTimeString());
    } catch (err) {
        console.warn('[DB Keep-Alive] Ping failed:', err.message);
    }
}, DB_PING_INTERVAL);

// ─── AUTOMATED QUIZ SCHEDULER ─────────────────────────────────────────────────
// Automatically starts and ends quizzes based on their schedule
setInterval(async () => {
    try {
        const now = new Date();

        // 1. Find quizzes that should START (only non-live/assessment quizzes are auto-started by scheduler)
        // Live quizzes must be started manually by the teacher from the lobby.
        const quizzesToStart = await prisma.quiz.findMany({
            where: {
                startTime: { lte: now },
                status: 'waiting',
                isActive: true,
                isLive: false  // Only auto-start assessments, not live quizzes
            }
        });

        for (const quiz of quizzesToStart) {
            await prisma.quiz.update({
                where: { id: quiz.id },
                data: { status: 'started' }
            });
            console.log(`[Scheduler] Auto-started quiz ${quiz.id}`);

            if (quiz.isLive) {
                let durationMs = 0;
                if (quiz.duration > 0) {
                    durationMs = quiz.duration * 60 * 1000;
                } else if (quiz.questions && Array.isArray(quiz.questions)) {
                    durationMs = (quiz.questions.length * (quiz.timerPerQuestion || 30)) * 1000;
                }
                const endTime = Date.now() + durationMs;
                const state = roomState.get(quiz.id) || {};
                roomState.set(quiz.id, { ...state, status: 'started', currentQuestion: 0, endTime });
                
                io.to(quiz.id).emit('quiz_started');
                io.to(quiz.id).emit('sync_timer', { timeLeft: Math.max(0, Math.ceil((endTime - Date.now()) / 1000)) });
            }
        }

        // 2. Find quizzes that should END
        const quizzesToEnd = await prisma.quiz.findMany({
            where: {
                endTime: { lte: now },
                isActive: true
            }
        });

        for (const quiz of quizzesToEnd) {
            await prisma.quiz.update({
                where: { id: quiz.id },
                data: { status: 'finished', isActive: false }
            });
            console.log(`[Scheduler] Auto-finished quiz ${quiz.id}`);

            if (quiz.isLive) {
                roomState.delete(quiz.id);
                io.to(quiz.id).emit('quiz_ended');
            }
        }
    } catch (err) {
        console.error('[Scheduler Error]', err.message);
    }
}, 10000); // Check every 10 seconds

// Reset all users' online status to false on server startup to avoid lockouts from prior crashes
prisma.user.updateMany({
    data: { isOnline: false }
}).then(() => {
    console.log('[Startup] Successfully reset all user online statuses.');
}).catch(err => {
    console.error('[Startup Error] Failed to reset user online statuses:', err.message);
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`[DB Keep-Alive] Pinging every 9 minutes to prevent cold starts`);

    // Environment-aware Prisma Database Initialization
    setImmediate(() => {
        try {
            if (process.env.NODE_ENV === 'production') {
                console.log('🔄 [Production] Deploying database migrations via prisma migrate deploy...');
                exec('npx prisma migrate deploy', (error, stdout, stderr) => {
                    if (error) {
                        console.error('❌ [Production] Failed to apply migrations:', error.message);
                        return;
                    }
                    console.log('✅ [Production] Migration complete!');
                    if (stdout) console.log(`[Prisma Migrate]: ${stdout}`);
                    if (stderr) console.error(`[Prisma Migrate Err]: ${stderr}`);
                });
            } else {
                console.log('🔄 [Dev] Syncing database schema via db push...');
                exec('npx prisma db push', (error, stdout, stderr) => {
                    if (error) {
                        console.error('❌ [Dev] Failed to push schema:', error.message);
                        return;
                    }
                    console.log('[Dev] Database schema synced via db push.');
                    if (stdout) console.log(`[Prisma DB Push]: ${stdout}`);
                    if (stderr) console.error(`[Prisma DB Push Err]: ${stderr}`);
                });
            }
        } catch (err) {
            console.error('❌ Failed to initiate database sync:', err.message);
        }
    });
});
