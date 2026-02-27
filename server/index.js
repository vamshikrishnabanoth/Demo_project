require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const connectDB = require('./config/db');

const app = express();
const server = http.createServer(app);

// Connect Database
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/quiz', require('./routes/quiz'));

// Socket.io Setup
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all origins for the live app
        methods: ["GET", "POST"]
    }
});

// Store participants for each room
const roomParticipants = new Map(); // { quizId: [{ username, role, socketId }] }
// Store current state for each room
const roomState = new Map(); // { quizId: { currentQuestion: 0, status: 'started', endTime: TIMESTAMP } }
// Map to track which room/user a socket belongs to
const socketToUser = new Map(); // { socketId: { quizId, username } }

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join_room', ({ quizId, user }) => {
        socket.join(quizId);

        // Track this socket's association for disconnect cleanup
        socketToUser.set(socket.id, { quizId, username: user.username });

        if (!roomParticipants.has(quizId)) {
            roomParticipants.set(quizId, []);
        }

        const participants = roomParticipants.get(quizId);
        const existingIdx = participants.findIndex(p => p.username === user.username);

        const userData = { ...user, socketId: socket.id, isOnline: true };
        if (existingIdx !== -1) {
            participants[existingIdx] = userData;
        } else if (user.username && user.username.toLowerCase() !== 'student') {
            participants.push(userData);
        }

        io.to(quizId).emit('participants_update', participants);

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
                console.log(`Sending progress history to ${user.username} (${user.role})`);
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

    const finalizeQuiz = async (quizId) => {
        try {
            const Quiz = require('./models/Quiz');
            const Result = require('./models/Result');

            // 1. Get current state to capture leaderboard
            const state = roomState.get(quizId.toString());
            const finalLeaderboard = state?.leaderboard || [];
            const finalInsights = state?.liveInsights || null;

            // 2. Mark quiz as finished and store final standings
            await Quiz.findByIdAndUpdate(quizId, {
                status: 'finished',
                isActive: false,
                finalLeaderboard,
                finalInsights
            });

            // 3. Finalize all in-progress student results
            const updateResult = await Result.updateMany(
                { quiz: quizId, status: 'in-progress' },
                {
                    $set: {
                        status: 'completed',
                        completedAt: Date.now()
                    }
                }
            );

            console.log(`Quiz ${quizId} finalized. Standings saved. Updated ${updateResult.modifiedCount} results.`);

            // 4. Cleanup state
            roomState.delete(quizId.toString());

            // 5. Notify all in room
            io.to(quizId).emit('quiz_ended');
        } catch (err) {
            console.error('Error in finalizeQuiz:', err);
        }
    };

    socket.on('start_quiz', async (quizId) => {
        try {
            const Quiz = require('./models/Quiz');
            const quiz = await Quiz.findById(quizId);
            if (!quiz) return;

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

            await Quiz.findByIdAndUpdate(quizId, { status: 'started' });
            io.to(quizId).emit('quiz_started');
            io.to(quizId).emit('sync_timer', { timeLeft: Math.max(0, Math.ceil((endTime - Date.now()) / 1000)) });

            // Auto-terminate when global timer expires
            if (quiz.duration > 0) {
                setTimeout(async () => {
                    const currentState = roomState.get(quizId.toString());
                    if (currentState && currentState.status !== 'finished') {
                        await finalizeQuiz(quizId);
                        console.log(`Quiz ${quizId} auto-terminated after global timer expired.`);
                    }
                }, durationMs + 3000);
            }
        } catch (err) {
            console.error('Error starting quiz:', err);
        }
    });

    socket.on('end_quiz', async (quizId) => {
        await finalizeQuiz(quizId);
    });

    // Add question to live quiz
    socket.on('add_question', async ({ quizId, question }) => {
        console.log(`Adding question to quiz: ${quizId}`);
        try {
            const Quiz = require('./models/Quiz');
            const quiz = await Quiz.findById(quizId);

            if (quiz) {
                quiz.questions.push(question);
                await quiz.save();

                // Broadcast new question to all students in the room
                io.to(quizId).emit('new_question_added', {
                    question,
                    questionIndex: quiz.questions.length - 1,
                    totalQuestions: quiz.questions.length
                });

                console.log(`Question added successfully to quiz ${quizId}`);
            }
        } catch (err) {
            console.error('Error adding question:', err);
        }
    });

    // Handle teacher changing question (Navigation)
    socket.on('change_question', async ({ quizId, questionIndex }) => {
        try {
            const Quiz = require('./models/Quiz');
            const quiz = await Quiz.findById(quizId);
            if (!quiz) return;

            // Reset Master Time for the new question if it's per-question
            let endTime = null;
            if (quiz.duration === 0) {
                endTime = Date.now() + ((quiz.timerPerQuestion || 30) * 1000);
            }

            const state = roomState.get(quizId) || {};
            if (endTime) state.endTime = endTime;

            roomState.set(quizId, { ...state, currentQuestion: parseInt(questionIndex) });

            io.to(quizId).emit('change_question', { questionIndex: parseInt(questionIndex) });
            if (endTime) io.to(quizId).emit('sync_timer', { timeLeft: Math.max(0, Math.ceil((endTime - Date.now()) / 1000)) });
        } catch (err) {
            console.error('Error changing question:', err);
        }
    });

    // Tracking which question a student is currently viewing
    socket.on('student_question_focus', ({ quizId, studentId, username, questionIndex }) => {
        console.log(`Student ${username} focused on question ${questionIndex} in quiz ${quizId}`);

        // Broadcast to teacher only (or everyone in room if room UI needs it)
        io.to(quizId).emit('student_focus_update', {
            studentId,
            username,
            questionIndex
        });
    });

    // Increase time for the current question
    socket.on('increase_time', ({ quizId, additionalSeconds }) => {
        const state = roomState.get(quizId);
        if (state && state.endTime) {
            state.endTime += (additionalSeconds * 1000);
            roomState.set(quizId, state);

            const timeLeft = Math.max(0, Math.ceil((state.endTime - Date.now()) / 1000));
            io.to(quizId).emit('timer_update', { additionalSeconds });
            io.to(quizId).emit('sync_timer', { timeLeft });
        }
    });

    // Handle individual question submission during live quiz
    socket.on('submit_question_answer', async ({ quizId, studentId, questionIndex, answer, timeRemaining }) => {
        // Ensure questionIndex is an integer
        questionIndex = parseInt(questionIndex);
        console.log(`Student ${studentId} submitted answer for question ${questionIndex}`);

        // PERSISTENCE: Save to In-Memory Room State for immediate access/recovery
        const state = roomState.get(quizId) || {};
        const currentProgress = state.progress || {};

        if (!currentProgress[studentId]) currentProgress[studentId] = {};
        currentProgress[studentId][questionIndex] = true;

        roomState.set(quizId, { ...state, progress: currentProgress });

        try {
            const Quiz = require('./models/Quiz');
            const Result = require('./models/Result');
            const User = require('./models/User');

            const quiz = await Quiz.findById(quizId);
            // Populate student to get username for progress update
            let result = await Result.findOne({ quiz: quizId, student: studentId }).populate('student', 'username');

            if (!result) {
                // Create new result if doesn't exist
                result = new Result({
                    quiz: quizId,
                    student: studentId,
                    score: 0,
                    totalQuestions: quiz.questions.length,
                    answers: []
                });
            }

            if (quiz && quiz.questions[questionIndex]) {
                const question = quiz.questions[questionIndex];
                const isCorrect = answer === question.correctAnswer;
                const points = isCorrect ? (question.points || 10) : 0;

                // Add or update answer for this question
                const existingAnswerIndex = result.answers.findIndex(
                    a => a.questionText === question.questionText
                );

                const answerData = {
                    questionText: question.questionText,
                    selectedOption: answer,
                    correctOption: question.correctAnswer,
                    isCorrect
                };

                if (existingAnswerIndex >= 0) {
                    // Update existing answer
                    const oldAnswer = result.answers[existingAnswerIndex];
                    const oldPoints = oldAnswer.isCorrect ? (question.points || 10) : 0;
                    result.score = result.score - oldPoints + points;
                    result.answers[existingAnswerIndex] = answerData;
                } else {
                    // Add new answer
                    result.answers.push(answerData);
                    result.score += points;
                }

                // Ensure status is in-progress and tracking start time
                result.status = 'in-progress';
                if (!result.startedAt) {
                    result.startedAt = Date.now();
                }
                // Track when the last answer was submitted for tiebreaking
                result.lastAnsweredAt = new Date();

                await result.save();

                // Ensure submitting student is always visible in participants list
                // (covers reconnect race conditions where join_room may have been missed)
                const roomParts = roomParticipants.get(quizId) || [];
                const studentUsername = result.student ? result.student.username : null;
                if (studentUsername) {
                    const alreadyInRoom = roomParts.findIndex(p => p.username === studentUsername);
                    if (alreadyInRoom === -1) {
                        roomParts.push({
                            username: studentUsername,
                            _id: studentId,
                            role: 'student',
                            socketId: socket.id,
                            isOnline: true
                        });
                        roomParticipants.set(quizId, roomParts);
                        io.to(quizId).emit('participants_update', roomParts);
                    }
                }

                // Broadcast student progress to teacher
                io.to(quizId).emit('student_progress_update', {
                    studentId: studentId.toString(), /* Ensure string ID */
                    username: result.student ? result.student.username : 'Student',
                    questionIndex,
                    answered: true,
                    isCorrect: isCorrect // Pass correctness to teacher
                });

                // Get all results for this quiz to build leaderboard
                const allResults = await Result.find({ quiz: quizId }).populate('student', 'username');
                const sortedResults = allResults
                    .map(r => ({
                        studentId: r.student._id,
                        username: r.student.username,
                        currentScore: r.score,
                        answeredQuestions: r.answers.length,
                        lastAnsweredAt: r.lastAnsweredAt || r.startedAt || new Date(),
                        answers: r.answers
                    }))
                    .sort((a, b) => {
                        // Primary: higher score first
                        if (b.currentScore !== a.currentScore) return b.currentScore - a.currentScore;
                        // Tiebreaker: whoever reached this score first (earlier lastAnsweredAt)
                        return new Date(a.lastAnsweredAt) - new Date(b.lastAnsweredAt);
                    });

                // Assign unique positions (1, 2, 3...) — already sorted by score then time
                const leaderboard = sortedResults.map((item, index) => {
                    const { answers: _a, lastAnsweredAt: _l, ...cleanItem } = item;
                    return { ...cleanItem, rank: index + 1 };
                });

                // Broadcast leaderboard to all students in the room
                // Calculate insights: Hardest (most wrong), Easiest (most correct)
                const questionStats = {};
                allResults.forEach(r => {
                    r.answers.forEach(ans => {
                        if (!questionStats[ans.questionText]) {
                            questionStats[ans.questionText] = { correct: 0, wrong: 0 };
                        }
                        if (ans.isCorrect) questionStats[ans.questionText].correct++;
                        else questionStats[ans.questionText].wrong++;
                    });
                });

                let hardestQuestion = null;
                let easiestQuestion = null;
                let maxWrong = -1;
                let maxCorrect = -1;

                Object.keys(questionStats).forEach(qText => {
                    if (questionStats[qText].wrong > maxWrong) {
                        maxWrong = questionStats[qText].wrong;
                        hardestQuestion = qText;
                    }
                    if (questionStats[qText].correct > maxCorrect) {
                        maxCorrect = questionStats[qText].correct;
                        easiestQuestion = qText;
                    }
                });

                const liveInsights = {
                    hardestQuestion,
                    easiestQuestion,
                    topStudent: leaderboard[0]?.username
                };

                // Persist leaderboard in roomState for teacher refresh recovery
                const updatedState = roomState.get(quizId) || {};
                roomState.set(quizId, { ...updatedState, leaderboard, liveInsights });

                io.to(quizId).emit('question_leaderboard', {
                    questionIndex,
                    leaderboard,
                    liveInsights
                });

                console.log(`Answer submitted. Score: ${result.score}. Leaderboard broadcast.`);
            }
        } catch (err) {
            console.error('Error submitting question answer:', err);
        }
    });

    // Handle student submission of new question
    socket.on('submit_new_question', async ({ quizId, studentId, questionIndex, answer }) => {
        console.log(`Student ${studentId} submitted answer for question ${questionIndex} in quiz ${quizId}`);
        try {
            const Quiz = require('./models/Quiz');
            const Result = require('./models/Result');

            const quiz = await Quiz.findById(quizId);
            const result = await Result.findOne({ quiz: quizId, student: studentId });

            if (quiz && result && quiz.questions[questionIndex]) {
                const question = quiz.questions[questionIndex];
                const isCorrect = answer === question.correctAnswer;
                const points = isCorrect ? (question.points || 10) : 0;

                // Update result with new answer
                result.answers.push({
                    questionText: question.questionText,
                    selectedOption: answer,
                    correctOption: question.correctAnswer,
                    isCorrect
                });

                result.score += points;
                result.totalQuestions = quiz.questions.length;
                await result.save();

                // Broadcast updated score to the room
                io.to(quizId).emit('score_updated', {
                    studentId,
                    newScore: result.score,
                    questionIndex
                });

                console.log(`Answer submitted successfully. New score: ${result.score}`);
            }
        } catch (err) {
            console.error('Error submitting new question answer:', err);
        }
    });

    socket.on('disconnect', () => {
        const info = socketToUser.get(socket.id);
        if (info) {
            const { quizId, username } = info;
            const participants = roomParticipants.get(quizId);
            if (participants) {
                // Instead of filtering out, mark as offline so teacher dashboard can show status
                const idx = participants.findIndex(p => p.socketId === socket.id);
                if (idx !== -1) {
                    participants[idx].isOnline = false;
                    participants[idx].socketId = null; // Clear socket ID
                }
                io.to(quizId).emit('participants_update', participants);
            }
            socketToUser.delete(socket.id);
        }
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
