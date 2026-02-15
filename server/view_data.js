const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load env vars
dotenv.config();

// Connect to DB
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ai-quiz-platform');
        console.log(`MongoDB Connected: ${conn.connection.host}`);

        // Load Models
        const User = require('./models/User');
        const Quiz = require('./models/Quiz');
        const Result = require('./models/Result');

        console.log('\n--- USERS ---');
        const users = await User.find({}).lean();
        console.table(users.map(u => ({ id: u._id, username: u.username, email: u.email, role: u.role })));

        console.log('\n--- QUIZZES ---');
        const quizzes = await Quiz.find({}).lean();
        console.table(quizzes.map(q => ({ id: q._id, title: q.title, topic: q.topic, creator: q.creator, questions: q.questions?.length })));

        console.log('\n--- RESULTS ---');
        const results = await Result.find({}).populate('student', 'username').populate('quiz', 'title').lean();
        console.table(results.map(r => ({
            id: r._id,
            student: r.student?.username,
            quiz: r.quiz?.title,
            score: r.score
        })));

        process.exit();
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

connectDB();
