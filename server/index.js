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
const hpp = require('hpp');
const xss = require('xss-clean');
const mongoSanitize = require('express-mongo-sanitize');
const morgan = require('morgan');

const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const prisma = require('./lib/prisma'); // Using Prisma

const app = express();

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

// 1. CORS - MUST BE FIRST to handle preflights correctly
app.use(cors({
    origin: ['https://kmit-khaoot.vercel.app', 'http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token', 'Accept']
}));

// 2. Set Security HTTP Headers
app.use(helmet({
    contentSecurityPolicy: false,
}));

// 3. Rate Limiting (Brute Force / DOS protection)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again after 15 minutes'
});
app.use('/api/', limiter); // Apply to all API routes

// 4. Body Parser with limit
app.use(express.json({ limit: '10kb' })); 

// 5. Data Sanitization against NoSQL injection
app.use(mongoSanitize());

// 6. Data Sanitization against XSS
app.use(xss());

// 7. Prevent HTTP Parameter Pollution
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
app.use('/api/auth', require('./routes/auth'));
app.use('/api/quiz', require('./routes/quiz'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/search', require('./routes/search'));
app.use('/api/students', require('./routes/students'));
app.use('/api/broadcast', require('./routes/broadcast'));

// Socket.io Setup - Secure CORS
const io = new Server(server, {
    cors: {
        origin: ['https://kmit-khaoot.vercel.app', 'http://localhost:5173'],
        methods: ["GET", "POST"]
    }
});

// Expose io and userSockets to routes
app.set('io', io);
const userSockets = new Map(); // Keep this globally declared and track sockets below
app.set('userSockets', userSockets);

// JWT Socket Authentication Middleware
const jwt = require('jsonwebtoken');
io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.['x-auth-token'];
    if (!token) {
        return next(new Error('Authentication failed: Missing token'));
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.user = decoded.user;
        
        // Fetch username from DB if not present in the token (legacy/existing tokens)
        if (socket.user && socket.user.id && !socket.user.username) {
            try {
                const dbUser = await prisma.user.findUnique({
                    where: { id: socket.user.id },
                    select: { username: true }
                });
                if (dbUser) {
                    socket.user.username = dbUser.username;
                }
            } catch (dbErr) {
                console.error('Error fetching username for socket auth:', dbErr);
            }
        }
        
        next();
    } catch (err) {
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
            io.emit('user_status_change', { userId, isOnline: true });
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
            io.emit('user_status_change', { userId, isOnline: true });
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
            io.emit('user_status_change', { userId, isOnline: false });
            console.log(`User ${userId} logged out securely and marked offline`);
        } catch (err) {
            console.error('Error on logout status update:', err);
        }
    });


    socket.on('join_room', ({ quizId, user }) => {
        // SECURITY CHECK: Verify user identity matches socket.user payload
        if (!socket.user || socket.user.username !== user.username) {
            console.warn(`[Security Alert] join_room spoofing blocked for socket ${socket.id} (username: ${user.username})`);
            return socket.emit('error_alert', { msg: 'Unauthorized action.' });
        }

        socket.join(quizId);

        // Track this socket's association for disconnect cleanup
        socketToUser.set(socket.id, { quizId, username: socket.user.username });

        if (!roomParticipants.has(quizId)) {
            roomParticipants.set(quizId, []);
        }

        const participants = roomParticipants.get(quizId);
        const existingIdx = participants.findIndex(p => p.username === socket.user.username);

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

        console.log(`Secure User ${socket.user.username} (${socket.user.role}) joined room ${quizId}. Total participants: ${participants.length}`);
        // Always send the full current participant list directly to the socket that just joined,
        // so the teacher always sees the latest list even if they join after students.
        const cleanedParticipants = [...participants];

socket.emit('participants_update', cleanedParticipants);

io.to(quizId).emit(
    'participants_update',
    cleanedParticipants
);

        // SYNC STATE
        const state = roomState.get(quizId);
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

    socket.on('heartbeat', ({ quizId, userId }) => {
        if (!quizId) return;
        // SECURITY CHECK: Verify identity matches socket.user payload
        if (!socket.user || socket.user.id !== userId) {
            return;
        }
        const participants = roomParticipants.get(quizId);
        if (participants) {
            const p = participants.find(
    part =>
        String(part._id) === String(userId)
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
        // SECURITY CHECK: Verify identity matches socket.user payload
        if (!socket.user || socket.user.username !== user.username) {
            console.warn(`[Security Alert] reconnectUser spoofing blocked for socket ${socket.id} (username: ${user.username})`);
            return socket.emit('error_alert', { msg: 'Unauthorized action.' });
        }

        socket.join(quizId);
        socketToUser.set(socket.id, { quizId, username: socket.user.username });

        if (!roomParticipants.has(quizId)) {
            roomParticipants.set(quizId, []);
        }

        const participants = roomParticipants.get(quizId);
        const existingIdx = participants.findIndex(p => p.username === socket.user.username);

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
                                              isCorrect: ans.isCorrect
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
                 progress: state.progress || {}
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
            const quiz = await prisma.quiz.findUnique({ where: { id: quizId } });
            if (!quiz || quiz.createdById !== socket.user.id) {
                console.warn(`[Security Alert] Socket ${socket.id} attempted to start unauthorized quiz ${quizId}`);
                return socket.emit('error_alert', { msg: 'Unauthorized live room action.' });
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

    // Tracking student cheating attempts (tab switching, focus loss)
    socket.on('student_cheated_alert', ({ quizId, studentId, action, timestamp }) => {
        // SECURITY CHECK: Verify student identity matches socket.user payload
        if (!socket.user || socket.user.id !== studentId) {
            return;
        }
        console.log(`[Exam Security Alert] Student ${socket.user.username || studentId} triggered cheat alert: ${action} in quiz ${quizId}`);

        // Broadcast to the quiz room so the teacher dashboard receives the cheat warning in real-time
        io.to(quizId).emit('student_cheat_warning', {
            studentId,
            username: socket.user.username || 'Student',
            action,
            timestamp: timestamp || new Date()
        });
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
        
        currentProgress[studentId][questionIndex] = { answered: true, isCorrect: false };
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

            // Ensure numeric values to avoid NaN
            result.score = result.score || 0;
            result.totalTimeTaken = result.totalTimeTaken || 0;

            if (quiz.questions[questionIndex]) {
                const question = quiz.questions[questionIndex];

                // Extra robust normalization
                const studentAnswer = (answer || "").toString().trim().toLowerCase();
                const correctAnswer = (question.correctAnswer || "").toString().trim().toLowerCase();

                let isCorrect = studentAnswer === correctAnswer;

                // Fallback for AI-generated labels (A, B, C...) or indices (0, 1, 2...)
                if (!isCorrect && question.options) {
                    const labels = ['a', 'b', 'c', 'd', 'e'];
                    const labelIdx = labels.indexOf(correctAnswer);
                    if (labelIdx !== -1 && question.options[labelIdx]) {
                        isCorrect = studentAnswer === question.options[labelIdx].toString().trim().toLowerCase();
                    } else if (correctAnswer !== '' && !isNaN(correctAnswer) && question.options[parseInt(correctAnswer)]) {
                        isCorrect = studentAnswer === question.options[parseInt(correctAnswer)].toString().trim().toLowerCase();
                    }
                }

                const points = isCorrect ? (question.points || 10) : 0;

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
                updatedProgress[studentId][questionIndex] = { answered: true, isCorrect };
                // ALSO store by username so teacher UI can find it regardless of key type
                const studentUsername = result.student ? result.student.username : null;
                if (studentUsername) {
                    if (!updatedProgress[studentUsername]) updatedProgress[studentUsername] = {};
                    updatedProgress[studentUsername][questionIndex] = { answered: true, isCorrect };
                }
                roomState.set(quizId, { ...state, progress: updatedProgress });

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

                // Broadcast student progress to teacher with isCorrect
                io.to(quizId).emit('student_progress_update', {
                    studentId: studentId.toString(),
                    username: result.student ? result.student.username : 'Student',
                    questionIndex,
                    answered: true,
                    isCorrect
                });

                // Leaderboard calculation with speed tie-breaker
                const allResults = await prisma.result.findMany({
                    where: { quizId: quizId },
                    include: { student: { select: { username: true } } }
                });

                const leaderboard = allResults
                    .map(r => ({
                        studentId: r.studentId,
                        username: r.student?.username || 'Unknown',
                        currentScore: r.score,
                        totalTimeTaken: r.totalTimeTaken || 0,
                        lastAnsweredAt: r.lastAnsweredAt || r.startedAt || new Date(),
                        answeredQuestions: r.answers.length
                    }))
                    .sort((a, b) => {
                        if (b.currentScore !== a.currentScore) return b.currentScore - a.currentScore;
                        if (a.totalTimeTaken !== b.totalTimeTaken) return a.totalTimeTaken - b.totalTimeTaken;
                        return new Date(a.lastAnsweredAt) - new Date(b.lastAnsweredAt);
                    })
                    .map((item, index) => ({ ...item, rank: index + 1 }));

                // Track leaderboard in state
                const updatedState = roomState.get(quizId) || {};
                roomState.set(quizId, { ...updatedState, leaderboard });

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
                const studentAnswer = (answer || "").toString().trim().toLowerCase();
                const correctAnswer = (question.correctAnswer || "").toString().trim().toLowerCase();

                let isCorrect = studentAnswer === correctAnswer;

                // Fallback for AI-generated labels (A, B, C...) or indices (0, 1, 2...)
                if (!isCorrect && question.options) {
                    const labels = ['a', 'b', 'c', 'd', 'e'];
                    const labelIdx = labels.indexOf(correctAnswer);
                    if (labelIdx !== -1 && question.options[labelIdx]) {
                        isCorrect = studentAnswer === question.options[labelIdx].toString().trim().toLowerCase();
                    } else if (correctAnswer !== '' && !isNaN(correctAnswer) && question.options[parseInt(correctAnswer)]) {
                        isCorrect = studentAnswer === question.options[parseInt(correctAnswer)].toString().trim().toLowerCase();
                    }
                }

                const points = isCorrect ? (question.points || 10) : 0;

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
});
});

const PORT = process.env.PORT || 5000;

// ─── HEALTH CHECK ENDPOINT ────────────────────────────────────────────────────
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// ─── DATABASE KEEP-ALIVE PING ─────────────────────────────────────────────────
// MongoDB Atlas M0 (free tier) pauses after 60 minutes of inactivity.
// This causes a 5-10 second cold start delay on the first login after idle.
// Pinging every 9 minutes keeps the connection warm.
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
});
