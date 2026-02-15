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
        origin: "http://localhost:5173", // Vite default port
        methods: ["GET", "POST"]
    }
});

// Store participants for each room
const roomParticipants = new Map();

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join_room', ({ quizId, user }) => {
        socket.join(quizId);
        console.log(`User ${user.username} (${user.role}) joined room: ${quizId}`);

        // Initialize room if it doesn't exist
        if (!roomParticipants.has(quizId)) {
            roomParticipants.set(quizId, []);
        }

        // Add user to room participants if not already there
        const participants = roomParticipants.get(quizId);
        if (!participants.find(p => p.username === user.username)) {
            participants.push(user);
        }

        // Broadcast updated participant list to everyone in the room (including sender)
        io.to(quizId).emit('participants_update', participants);

        // Also emit user_joined for backward compatibility
        io.to(quizId).emit('user_joined', user);
    });

    socket.on('start_quiz', async (quizId) => {
        console.log(`Starting quiz: ${quizId}`);

        // Update quiz status in database
        try {
            const Quiz = require('./models/Quiz');
            await Quiz.findByIdAndUpdate(quizId, { status: 'started' });
            console.log(`Quiz ${quizId} status updated to 'started'`);
        } catch (err) {
            console.error('Error updating quiz status:', err);
        }

        io.to(quizId).emit('quiz_started');

        // Clean up participants after quiz starts
        setTimeout(() => {
            roomParticipants.delete(quizId);
        }, 5000);
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

    // Handle individual question submission during live quiz
    socket.on('submit_question_answer', async ({ quizId, studentId, questionIndex, answer, timeRemaining }) => {
        console.log(`Student ${studentId} submitted answer for question ${questionIndex}`);
        try {
            const Quiz = require('./models/Quiz');
            const Result = require('./models/Result');
            const User = require('./models/User');

            const quiz = await Quiz.findById(quizId);
            let result = await Result.findOne({ quiz: quizId, student: studentId });

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

                await result.save();

                // Get all results for this quiz to build leaderboard
                const allResults = await Result.find({ quiz: quizId }).populate('student', 'username');
                const leaderboard = allResults
                    .map(r => ({
                        studentId: r.student._id,
                        username: r.student.username,
                        currentScore: r.score,
                        answeredQuestions: r.answers.length
                    }))
                    .sort((a, b) => b.currentScore - a.currentScore)
                    .map((item, index) => ({ ...item, rank: index + 1 }));

                // Broadcast leaderboard to all students in the room
                io.to(quizId).emit('question_leaderboard', {
                    questionIndex,
                    leaderboard
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
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
