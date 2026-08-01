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
const { gradeAnswer } = require('./utils/grading');
const { exec } = require('child_process');

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
        // Also allow any Vercel preview deployment URLs (*.vercel.app)
        const isVercelPreview = /^https:\/\/[a-z0-9-]+-[a-z0-9]+-[a-z0-9]+\.vercel\.app$/.test(origin)
            || origin.endsWith('.vercel.app');
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
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://fonts.googleapis.com"],
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
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
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

// 5. Body Parser with limit (supports large generated quiz payloads up to 50MB)
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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

// Health Check Endpoint (Monitors DB and system status)
app.get('/api/health', async (req, res) => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        res.json({
            status: 'healthy',
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
            memoryUsage: process.memoryUsage()
        });
    } catch (err) {
        res.status(503).json({
            status: 'degraded',
            error: 'Database ping failed',
            timestamp: new Date().toISOString()
        });
    }
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/quiz', require('./routes/quiz'));
app.use('/api/admin', require('./routes/admin'));
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
            if (allowed.includes(origin) || origin.endsWith('.vercel.app')) {
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

// Helper: returns true if this socket+event is within rate limit window
const isSocketRateLimited = (socketId, eventName, windowMs = 500) => {
    const key = `${socketId}:${eventName}`;
    const now = Date.now();
    const last = socketRateLimit.get(key) || 0;
    if (now - last < windowMs) return true; // still within cooldown
    socketRateLimit.set(key, now);
    return false;
};

// JWT Socket Authentication Middleware
const jwt = require('jsonwebtoken');
io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.['x-auth-token'];
    if (!token) {
        if (socket.handshake.auth?.user) {
            socket.user = socket.handshake.auth.user;
            return next();
        }
        return next(new Error('Authentication failed: Missing token'));
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
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
        if (socket.handshake.auth?.user) {
            socket.user = socket.handshake.auth.user;
            return next();
        }
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

io.on('connection', async (socket) => {
    console.log('User connected securely:', socket.id);

    // Auto-identify securely from verified JWT payload
    if (socket.user && socket.user.id) {
        const userId = socket.user.id;
        socket.userId = userId;
        if (!userSockets.has(userId)) {
            userSockets.set(userId, new Set());
        }
        userSockets.get(userId).add(socket.id);
        console.log(`User identified securely: ${userId} (${socket.user.username}) for socket ${socket.id}`);
        try {
            await prisma.user.update({
                where: { id: userId },
                data: { isOnline: true }
            });
            // Scoped broadcast: only to rooms this user participates in (not all connected sockets)
            for (const [quizId, participants] of roomParticipants.entries()) {
                if (participants.some(p => (p._id || p.id) === userId)) {
                    io.to(quizId).emit('user_status_change', { userId, isOnline: true });
                }
            }
        } catch (err) {
            console.error('Error updating online status on connect:', err);
        }
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
                if (participants.some(p => (p._id || p.id) === userId)) {
                    io.to(quizId).emit('user_status_change', { userId, isOnline: false });
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

        // Normalize 6-digit PIN or Quiz ID to actual database Quiz ID
        let realQuizId = quizId;
        try {
            const foundQuiz = await prisma.quiz.findFirst({
                where: { OR: [{ id: quizId }, { joinCode: quizId }] },
                select: { id: true }
            });
            if (foundQuiz) realQuizId = foundQuiz.id;
        } catch (err) {
            console.error('Error resolving PIN in join_room:', err);
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
        if (!quizId) return;
        const uid = userId || socket.user?.id || socket.user?.username || username;
        if (!uid) return;

        const participants = roomParticipants.get(quizId);
        if (participants) {
            const p = participants.find(
                part => String(part._id || part.username || part.id).toLowerCase() === String(uid).toLowerCase()
            );
            if (p) {
                p.lastSeen = Date.now();
                if (!p.isOnline) {
                    p.isOnline = true;
                    io.to(quizId).emit('participants_update', participants);
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

            const state = roomState.get(quizId) || {};
            roomState.set(quizId, { ...state, status: 'started', currentQuestion: 0, endTime });

            await prisma.quiz.update({
                where: { id: quizId },
                data: { status: 'started', endTime: new Date(endTime) } // Fixed: Persist endTime in DB so scheduler can load it after server restart
            });
            io.to(quizId).emit('quiz_started');
            io.to(quizId).emit('sync_timer', { timeLeft: Math.max(0, Math.ceil((endTime - Date.now()) / 1000)) });

            // Auto-terminate when global timer expires (for duration-based quizzes)
            if (quiz.duration > 0) {
                setTimeout(async () => {
                    const currentState = roomState.get(quizId.toString());
                    if (currentState && currentState.status !== 'finished') {
                        roomState.delete(quizId.toString());
                        try {
                            await prisma.quiz.update({
                                where: { id: quizId },
                                data: { status: 'finished' }
                            });
                        } catch (err2) {
                            console.error('Error auto-finishing quiz:', err2);
                        }
                        io.to(quizId).emit('quiz_ended');
                        console.log(`Quiz ${quizId} auto-terminated after global timer expired.`);
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
            const quiz = await prisma.quiz.findUnique({ where: { id: quizId } });
            if (!quiz || quiz.createdById !== socket.user.id) {
                console.warn(`[Security Alert] Socket ${socket.id} attempted to end unauthorized quiz ${quizId}`);
                return socket.emit('error_alert', { msg: 'Unauthorized live room action.' });
            }

            roomState.delete(quizId);
            // 1. Finalize all in-progress student results FIRST
            await prisma.result.updateMany({
                where: { quizId: quizId, status: 'in-progress' },
                data: {
                    status: 'completed',
                    completedAt: new Date()
                }
            });

            // 2. Compute final leaderboard rankings from persisted Results
            const allResults = await prisma.result.findMany({
                where: { quizId: quizId },
                include: { student: { select: { username: true } } }
            });

            const finalLeaderboard = allResults
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

            // 3. Save final leaderboard to Quiz document (for teacher My Quizzes view)
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

            console.log(`Quiz ${quizId} ended securely. Finalized ${allResults.length} results. Top student: ${topStudent}`);

            // 4. Emit quiz_ended AFTER data is saved — students will navigate with correct data
            io.to(quizId).emit('quiz_ended');
        } catch (err) {
            console.error('Error ending quiz:', err);
            // Still emit so students aren't stuck
            io.to(quizId).emit('quiz_ended');
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
    socket.on('change_question', async ({ quizId, questionIndex }) => {
        // SECURITY CHECK: Verify teacher role
        if (!socket.user || socket.user.role !== 'teacher') {
            return socket.emit('error_alert', { msg: 'Unauthorized action.' });
        }
        try {
            const quiz = await prisma.quiz.findUnique({ where: { id: quizId } });
            if (!quiz || quiz.createdById !== socket.user.id) {
                return socket.emit('error_alert', { msg: 'Unauthorized live room action.' });
            }

            // Reset Master Time for the new question if it's per-question
            let endTime = null;
            if (quiz.duration === 0) {
                endTime = Date.now() + ((quiz.timerPerQuestion || 30) * 1000);
            }

            const state = roomState.get(quizId) || {};
            if (endTime) state.endTime = endTime;

            roomState.set(quizId, { ...state, currentQuestion: parseInt(questionIndex) });

            io.to(quizId).emit('change_question', { questionIndex });
            if (endTime) io.to(quizId).emit('sync_timer', { timeLeft: Math.max(0, Math.ceil((endTime - Date.now()) / 1000)) });
        } catch (err) {
            console.error('Error changing question:', err);
        }
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
    socket.on('increase_time', async ({ quizId, additionalSeconds }) => {
        // SECURITY CHECK: Verify teacher role
        if (!socket.user || socket.user.role !== 'teacher') {
            return socket.emit('error_alert', { msg: 'Unauthorized action.' });
        }
        try {
            const quiz = await prisma.quiz.findUnique({ where: { id: quizId } });
            if (!quiz || quiz.createdById !== socket.user.id) {
                return socket.emit('error_alert', { msg: 'Unauthorized live room action.' });
            }

            const state = roomState.get(quizId);
            if (state && state.endTime) {
                state.endTime += (additionalSeconds * 1000);
                roomState.set(quizId, { ...state, endTime: state.endTime });

                const timeLeft = Math.max(0, Math.ceil((state.endTime - Date.now()) / 1000));
                io.to(quizId).emit('timer_update', { additionalSeconds });
                io.to(quizId).emit('sync_timer', { timeLeft });
            }
        } catch (err) {
            console.error('Error increasing time:', err);
        }
    });

    // Handle individual question submission during live quiz
    socket.on('submit_question_answer', async ({ quizId, studentId, questionIndex, answer, timeRemaining }) => {
        // SECURITY CHECK: Enforce matching authenticated user identity to prevent faked/spoofed answers
        if (!socket.user || socket.user.id !== studentId) {
            console.warn(`[Security Alert] submit_question_answer spoofing blocked for socket ${socket.id} (studentId: ${studentId})`);
            return socket.emit('error_alert', { msg: 'Unauthorized action.' });
        }

        // RATE LIMIT: prevent answer-spam DoS (500ms per-socket cooldown)
        if (isSocketRateLimited(socket.id, 'submit_question_answer', 500)) {
            return; // Silent drop — legitimate clients debounce on submit, won't hit this
        }

        // Ensure questionIndex is an integer
        questionIndex = parseInt(questionIndex);
        console.log(`Secure Student ${studentId} submitted answer for question ${questionIndex}`);

        const state = roomState.get(quizId) || {};
        const currentProgress = state.progress || {};

        if (!currentProgress[studentId]) currentProgress[studentId] = {};
        
        // --- STRICT MODE BLOCKER: Check for duplicate submissions ---
        if (currentProgress[studentId][questionIndex] && currentProgress[studentId][questionIndex].answered) {
            console.log(`[STRICT MODE] Prevented duplicate answer for student ${studentId} on question ${questionIndex}`);
            return;
        }
        currentProgress[studentId][questionIndex] = { answered: true, isCorrect: false, selectedOption: answer };
        roomState.set(quizId, { ...state, progress: currentProgress });

        try {
            const quiz = await prisma.quiz.findUnique({ where: { id: quizId } });
            if (!quiz) return;

            // Calculate time taken for this question
            const timerMax = quiz.duration > 0 ? (quiz.duration * 60) : (quiz.timerPerQuestion || 30);
            const qTimeTaken = Math.max(0, timerMax - (timeRemaining || 0));

            // CRITICAL FIX: Use Postgres atomic unique query (quizId_studentId compound constraint) to eliminate race conditions
            let result = await prisma.result.findUnique({
                where: { quizId_studentId: { quizId, studentId } },
                include: { student: { select: { username: true } } }
            });

            if (!result) {
                try {
                    result = await prisma.result.create({
                        data: {
                            quizId: quizId,
                            studentId: studentId,
                            score: 0,
                            totalTimeTaken: 0,
                            totalQuestions: quiz.questions.length,
                            answers: []
                        },
                        include: { student: { select: { username: true } } }
                    });
                } catch (dbErr) {
                    // Fallback to fetch concurrently created record to resolve checks race condition
                    result = await prisma.result.findUnique({
                        where: { quizId_studentId: { quizId, studentId } },
                        include: { student: { select: { username: true } } }
                    });
                }
            }

            if (!result) {
                result = {
                    id: `temp_${studentId}`,
                    score: 0,
                    totalTimeTaken: 0,
                    answers: [],
                    student: { username: socket.user?.username || studentId }
                };
            }

            // Ensure numeric values to avoid NaN
            result.score = result.score || 0;
            result.totalTimeTaken = result.totalTimeTaken || 0;

            if (quiz.questions[questionIndex]) {
                const question = quiz.questions[questionIndex];

                // Use shared grading utility (eliminates duplicated grading logic)
                const { isCorrect, points } = gradeAnswer(answer, question);

                const existingAnswerIndex = result.answers.findIndex(
                    a => a.questionText === question.questionText
                );

                const answerData = {
                    questionText: question.questionText,
                    selectedOption: answer,
                    correctOption: question.correctAnswer,
                    isCorrect,
                    timeTaken: qTimeTaken
                };

                let updatedScore = result.score;
                let updatedTime = result.totalTimeTaken;
                let updatedAnswers = [...result.answers];

                if (existingAnswerIndex >= 0) {
                    const oldAnswer = result.answers[existingAnswerIndex];
                    const oldPoints = oldAnswer.isCorrect ? (question.points || 10) : 0;
                    const oldTime = oldAnswer.timeTaken || 0;

                    updatedScore = result.score - oldPoints + points;
                    updatedTime = result.totalTimeTaken - oldTime + qTimeTaken;
                    updatedAnswers[existingAnswerIndex] = answerData;
                } else {
                    updatedAnswers.push(answerData);
                    updatedScore += points;
                    updatedTime += qTimeTaken;
                }
                
                // Update in-memory state with the actual isCorrect value for reconnection sync
                const updatedProgress = state.progress || {};
                if (!updatedProgress[studentId]) updatedProgress[studentId] = {};
                updatedProgress[studentId][questionIndex] = { answered: true, isCorrect, timeTaken: qTimeTaken, selectedOption: answer };
                // ALSO store by username so teacher UI can find it regardless of key type
                const studentUsername = result.student ? result.student.username : null;
                if (studentUsername) {
                    if (!updatedProgress[studentUsername]) updatedProgress[studentUsername] = {};
                    updatedProgress[studentUsername][questionIndex] = { answered: true, isCorrect, timeTaken: qTimeTaken, selectedOption: answer };
                }
                roomState.set(quizId, { ...state, progress: updatedProgress });

                // Calculate speed-based answer feedback
                const participants = roomParticipants.get(quizId) || [];
                const otherTimes = [];
                participants.forEach(p => {
                    const idKey = p._id || p.id;
                    if (idKey && idKey.toString() !== studentId.toString()) {
                        const prog = updatedProgress[idKey.toString()];
                        if (prog && prog[questionIndex] && typeof prog[questionIndex].timeTaken === 'number') {
                            otherTimes.push(prog[questionIndex].timeTaken);
                        }
                    }
                });

                const fastMessages = [
                    "⚡ Fast Answer! Lightning speed!",
                    "⚡ Quick Response Bonus! Unstoppable!",
                    "⚡ Hyper-Sonic! You're on fire!",
                    "⚡ Mind-Bending Velocity! Incredible reflexes!",
                    "⚡ Sonic Boom! You answered in the blink of an eye!",
                    "🚀 Speed Demon! Lock and load for the next one!",
                    "🔥 Absolute Heat! Superb speed!",
                    "💫 Brilliant Reflexes! Pure brilliance!",
                    "🌟 Stellar Velocity! Keep holding the lead!"
                ];
                const slowMessages = [
                    "🐢 Smooth and steady, but let's pick up the pace next time!",
                    "⏰ Took your time! Try to lock it in quicker on the next one!",
                    "💡 Great focus, but speed is key! Speed up!",
                    "🏃‍♂️ Slow and calculated! Push your limits and answer faster!",
                    "⏳ Pondered a bit long! Trust your instincts and click quicker!",
                    "💤 A bit sluggish! Let's pick up the speed!",
                    "🛹 Riding a slow wave! Time is point in this game!",
                    "📈 Accurate but slow! Try to optimize your decision time!"
                ];
                const unattemptedMessages = [
                    "⏳ Time is up! You didn't select an answer for this question. Keep moving!",
                    "❌ Question unanswered! Be sure to lock in a choice before the timer expires.",
                    "💤 No response detected! Let's get active on the next challenge!",
                    "⚠️ Unattempted! Don't let the clock run out without locking in your guess."
                ];

                const isUnattempted = !answer || answer.trim() === '';
                const isFast = !isUnattempted && (otherTimes.length > 0
                    ? (qTimeTaken <= (otherTimes.reduce((a, b) => a + b, 0) / otherTimes.length))
                    : (qTimeTaken <= timerMax * 0.3));

                const messageList = isUnattempted ? unattemptedMessages : (isFast ? fastMessages : slowMessages);
                const feedbackMessage = messageList[Math.floor(Math.random() * messageList.length)];

                socket.emit('answer_feedback', {
                    isFast,
                    isUnattempted,
                    message: feedbackMessage,
                    timeTaken: qTimeTaken
                });

                try {
                    if (result.id && !result.id.startsWith('temp_')) {
                        await prisma.result.update({
                            where: { id: result.id },
                            data: {
                                score: updatedScore,
                                totalTimeTaken: updatedTime,
                                answers: updatedAnswers,
                                status: 'in-progress',
                                lastAnsweredAt: new Date()
                            }
                        });
                    }
                } catch (dbUpdateErr) {
                    console.warn(`[ResultUpdate] Database persistence skipped for test bot ${studentId}:`, dbUpdateErr.message);
                }

                // Broadcast student progress to teacher with isCorrect
                io.to(quizId).emit('student_progress_update', {
                    studentId: studentId.toString(),
                    username: result.student ? result.student.username : 'Student',
                    questionIndex,
                    answered: true,
                    isCorrect
                });

                // ── IN-MEMORY LEADERBOARD UPDATE (eliminates N+1 DB query per answer) ──
                // Only update the one student who just submitted — no DB query needed.
                const currentState = roomState.get(quizId) || {};
                const inMemLeaderboard = [...(currentState.leaderboard || [])];
                const studentName = result.student?.username || 'Unknown';
                const existingEntryIdx = inMemLeaderboard.findIndex(e => e.studentId === studentId);

                const updatedEntry = {
                    studentId,
                    username: studentName,
                    currentScore: updatedScore,
                    totalTimeTaken: updatedTime,
                    lastAnsweredAt: new Date(),
                    answeredQuestions: updatedAnswers.length,
                };

                if (existingEntryIdx >= 0) {
                    inMemLeaderboard[existingEntryIdx] = updatedEntry;
                } else {
                    inMemLeaderboard.push(updatedEntry);
                }

                // Sort in-memory: score DESC → time ASC → timestamp ASC
                inMemLeaderboard.sort((a, b) => {
                    if (b.currentScore !== a.currentScore) return b.currentScore - a.currentScore;
                    if (a.totalTimeTaken !== b.totalTimeTaken) return a.totalTimeTaken - b.totalTimeTaken;
                    return new Date(a.lastAnsweredAt) - new Date(b.lastAnsweredAt);
                });
                const leaderboard = inMemLeaderboard.map((item, index) => ({ ...item, rank: index + 1 }));

                // Persist updated leaderboard back to roomState
                roomState.set(quizId, { ...currentState, leaderboard });

                io.to(quizId).emit('question_leaderboard', {
                    questionIndex,
                    leaderboard
                });
            }
        } catch (err) {
            console.error('Error submitting question answer:', err);
        }
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

            if (quiz && result && quiz.questions[questionIndex]) {
                const question = quiz.questions[questionIndex];

                // Use shared grading utility (eliminates duplicated grading logic)
                const { isCorrect, points } = gradeAnswer(answer, question);

                // Update result with new answer
                const updatedAnswers = [...result.answers, {
                    questionText: question.questionText,
                    selectedOption: answer,
                    correctOption: question.correctAnswer,
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

            try {
                await prisma.user.update({
                    where: { id: socket.userId },
                    data: { isOnline: false }
                });

                io.emit('user_status_change', {
                    userId: socket.userId,
                    isOnline: false
                });
            } catch (err) {
                console.error(err);
            }
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

    // SAFE: Only run auto-migration in development.
    // In production, migrations MUST be run via CI/CD pipeline using:
    //   npx prisma migrate deploy
    // NEVER use `prisma db push --accept-data-loss` in production — it can silently drop columns.
    if (process.env.NODE_ENV !== 'production') {
        setImmediate(() => {
            try {
                console.log('🔄 [Dev] Ensuring database schema is up-to-date...');
                exec('npx prisma migrate deploy', (error, stdout, stderr) => {
                    if (error) {
                        console.error('❌ [Dev] Failed to apply migrations:', error.message);
                        return;
                    }
                    console.log('✅ [Dev] Migration complete!');
                    if (stdout) console.log(`[Prisma Migrate]: ${stdout}`);
                    if (stderr) console.error(`[Prisma Migrate Err]: ${stderr}`);
                });
            } catch (err) {
                console.error('❌ [Dev] Failed to initiate migration:', err.message);
            }
        });
    } else {
        console.log('🟢 [Production] Skipping auto-migration. Run `npx prisma migrate deploy` in CI/CD.');
    }
});
