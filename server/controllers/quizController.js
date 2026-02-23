const Quiz = require('../models/Quiz');
const Result = require('../models/Result');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const pdfParse = require('pdf-parse');

// Mock AI Generation for testing without API Key
const generateMockQuestions = (count = 5) => {
    const questions = [];
    for (let i = 1; i <= count; i++) {
        questions.push({
            questionText: `Sample Question ${i}: Is this a real AI generated question?`,
            options: ['Yes', 'No', 'Maybe', 'I am a mock'],
            correctAnswer: 'I am a mock',
            points: 10,
            type: 'multiple-choice'
        });
    }
    return questions;
};

// GEMINI AI Generation - Direct REST API call (more reliable than SDK)
const generateQuestions = async (type, content, count = 5, difficulty = 'Medium') => {
    const apiKey = process.env.GEMINI_API_KEY;
    console.log('Key Status:', apiKey ? 'Present (' + apiKey.substring(0, 10) + '...)' : 'Missing');

    if (!apiKey || apiKey === 'AIzaSyPlaceholder') {
        console.log('⚠️  Using Mock Quiz Generation (No Gemini API Key)');
        return generateMockQuestions(count);
    }

    if (!content || (type !== 'topic' && content.trim().length < 20)) {
        console.error('❌ Content too short or empty');
        return generateMockQuestions(count);
    }

    const prompt = `You are an expert educational quiz generator. Create exactly ${count} multiple choice questions. Difficulty: ${difficulty}.

TOPIC/CONTENT: "${content.substring(0, 20000)}"

RULES:
- For a TOPIC: generate general knowledge questions about it.
- For PDF CONTENT: questions must be answerable from the provided text only.
- Return ONLY valid JSON, no markdown, no explanation.

JSON FORMAT:
{"questions":[{"questionText":"string","options":["A","B","C","D"],"correctAnswer":"A","points":10,"type":"multiple-choice"}]}`;

    const makeRequest = (model) => new Promise((resolve, reject) => {
        const https = require('https');
        const body = JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] });
        const options = {
            hostname: 'generativelanguage.googleapis.com',
            path: `/v1beta/models/${model}:generateContent?key=${apiKey}`,
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, body: data }));
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });

    const models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-latest'];

    for (const model of models) {
        try {
            console.log(`🤖 Trying ${model}...`);
            let { status, body } = await makeRequest(model);

            // Retry once on 429
            if (status === 429) {
                console.log('⏳ Rate limited, waiting 3s...');
                await new Promise(r => setTimeout(r, 3000));
                ({ status, body } = await makeRequest(model));
            }

            if (status !== 200) {
                console.log(`❌ ${model} failed with status ${status}:`, body.substring(0, 150));
                continue;
            }

            const parsed = JSON.parse(body);
            const rawText = parsed.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            if (!rawText) { console.log(`❌ ${model} returned empty text`); continue; }

            const cleanJSON = rawText.replace(/^```json\n?/, '').replace(/\n?```$/, '').replace(/^```\n?/, '').trim();
            const data = JSON.parse(cleanJSON);
            const questions = Array.isArray(data.questions) ? data.questions : data;
            console.log(`✅ ${model} generated ${questions.length} questions`);
            return questions;

        } catch (err) {
            console.error(`❌ ${model} error:`, err.message?.substring(0, 100));
        }
    }

    console.log('⚠️  All models failed — using mock questions');
    return generateMockQuestions(count);
};

const generateJoinCode = () => {

    return Math.floor(100000 + Math.random() * 900000).toString();
};

exports.createQuiz = async (req, res) => {
    try {
        let { title, type, content, questions: manualQuestions, questionCount, difficulty, timerPerQuestion, topic, isLive, isAssessment, isActive, duration } = req.body;
        let finalQuestions = [];

        if (manualQuestions && manualQuestions.length > 0) {
            finalQuestions = Array.isArray(manualQuestions) ? manualQuestions : JSON.parse(manualQuestions);
        } else if (req.file && type === 'pdf') {
            try {
                console.log('📄 Parsing PDF:', req.file.originalname, 'Size:', req.file.size, 'bytes');

                // Use pdf-parse directly
                const data = await pdfParse(req.file.buffer);

                console.log('📝 PDF extracted text length:', data.text?.length || 0, 'characters');
                console.log('📄 PDF text preview:', data.text?.substring(0, 300).replace(/\s+/g, ' '));

                // Validate extracted text
                if (!data.text || data.text.trim().length < 100) {
                    throw new Error('PDF text extraction failed or content too short (minimum 100 characters required)');
                }

                // Clean up the text (remove excessive whitespace)
                const cleanedText = data.text
                    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
                    .replace(/\n+/g, '\n') // Replace multiple newlines with single newline
                    .trim();

                console.log('✨ Cleaned text length:', cleanedText.length, 'characters');

                finalQuestions = await generateQuestions('pdf', cleanedText, questionCount, difficulty);
            } catch (pdfErr) {
                console.error('❌ PDF Parsing Error:', pdfErr.message);
                // If PDF parsing fails, try to generate mock questions instead
                console.log('⚠️  Falling back to mock questions due to PDF error');
                finalQuestions = generateMockQuestions(questionCount || 5);
            }
        } else if (content || topic) {
            console.log('📚 Generating from topic/content:', (content || topic).substring(0, 100));
            finalQuestions = await generateQuestions(type, content || topic, questionCount, difficulty);
        }

        if (isLive === 'true' || isLive === true) {
            // Automatic Cleanup: Deactivate existing active live quizzes for this teacher
            await Quiz.updateMany(
                {
                    createdBy: req.user.id,
                    isLive: true,
                    status: { $in: ['waiting', 'started'] }
                },
                {
                    $set: {
                        isActive: false,
                        status: 'finished'
                    }
                }
            );
        }

        // Generate a unique join code
        let joinCode = generateJoinCode();
        let codeExists = await Quiz.findOne({ joinCode });
        while (codeExists) {
            joinCode = generateJoinCode();
            codeExists = await Quiz.findOne({ joinCode });
        }

        const newQuiz = new Quiz({
            title: title || `${topic || 'Untitled'} ${type} Quiz`,
            description: `Level: ${difficulty || 'Medium'}`,
            questions: finalQuestions,
            createdBy: req.user.id,
            isActive: isActive === undefined ? true : (isActive === 'true' || isActive === true),
            joinCode,
            difficulty: difficulty || 'Medium',
            timerPerQuestion: timerPerQuestion || 30,
            duration: duration || 0, // 0 means no global limit
            topic: topic || '',
            isLive: isLive === 'true' || isLive === true,
            isAssessment: isAssessment === 'true' || isAssessment === true,
            status: (isLive === 'true' || isLive === true) ? 'waiting' : 'started'
        });

        const quiz = await newQuiz.save();
        res.json(quiz);

    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error: ' + err.message });
    }
};

exports.joinByCode = async (req, res) => {
    try {
        const { code } = req.body;
        console.log(`🔍 Try join by code: ${code} (User: ${req.user.id})`);
        const quiz = await Quiz.findOne({ joinCode: code.toString(), isActive: true });

        if (!quiz) {
            console.log(`❌ Quiz not found or not active for code: ${code}`);
            return res.status(404).json({ msg: 'Quiz not found or not active' });
        }
        console.log(`✅ Found quiz: ${quiz.title} (${quiz._id})`);

        // Check for existing result to handle resume/blocking
        const existingResult = await Result.findOne({ quiz: quiz._id, student: req.user.id });

        res.json({
            quizId: quiz._id,
            isLive: quiz.isLive,
            status: quiz.status,
            previousAttempt: existingResult ? {
                status: existingResult.status,
                startedAt: existingResult.startedAt
            } : null
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error: ' + err.message });
    }
};

exports.getMyQuizzes = async (req, res) => {
    try {
        const quizzes = await Quiz.find({ createdBy: req.user.id }).sort({ createdAt: -1 });
        res.json(quizzes);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error: ' + err.message });
    }
};

exports.deleteQuiz = async (req, res) => {
    try {
        const quiz = await Quiz.findById(req.params.id);

        if (!quiz) {
            return res.status(404).json({ msg: 'Quiz not found' });
        }

        // Check user
        if (quiz.createdBy.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'User not authorized' });
        }

        await Quiz.findByIdAndDelete(req.params.id);

        res.json({ msg: 'Quiz removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error: ' + err.message });
    }
};

exports.getLiveQuizzes = async (req, res) => {
    try {
        const quizzes = await Quiz.find({ isActive: true }).sort({ createdAt: -1 });

        const quizzesWithAttempts = await Promise.all(quizzes.map(async (quiz) => {
            const result = await Result.findOne({ quiz: quiz._id, student: req.user.id });
            return {
                ...quiz.toObject(),
                isAttempted: !!result,
                score: result ? result.score : 0,
                totalQuestions: quiz.questions.length
            };
        }));

        res.json(quizzesWithAttempts);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error: ' + err.message });
    }
};

exports.getQuizById = async (req, res) => {
    try {
        const quiz = await Quiz.findById(req.params.id);

        if (!quiz) {
            return res.status(404).json({ msg: 'Quiz not found' });
        }

        // Attach previous result if it exists (for resume functionality)
        const previousResult = await Result.findOne({ quiz: req.params.id, student: req.user.id });

        res.json({
            ...quiz.toObject(),
            previousResult
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error: ' + err.message });
    }
};

exports.submitQuiz = async (req, res) => {
    try {
        const { quizId, answers } = req.body;

        const quiz = await Quiz.findById(quizId);
        if (!quiz) {
            return res.status(404).json({ msg: 'Quiz not found' });
        }

        let score = 0;
        const formattedAnswers = quiz.questions.map((q, idx) => {
            const selectedOption = answers[idx]?.selectedOption || '';
            const isCorrect = selectedOption === q.correctAnswer;
            if (isCorrect) {
                score += q.points || 10;
            }
            return {
                questionText: q.questionText,
                selectedOption,
                correctOption: q.correctAnswer,
                isCorrect
            };
        });

        const existingResult = await Result.findOne({ quiz: quizId, student: req.user.id });

        if (existingResult) {
            existingResult.score = score;
            existingResult.answers = formattedAnswers;
            existingResult.totalQuestions = quiz.questions.length;
            existingResult.status = 'completed';
            existingResult.completedAt = Date.now();
            await existingResult.save();
            return res.json(existingResult);
        }

        const result = new Result({
            quiz: quizId,
            student: req.user.id,
            score,
            totalQuestions: quiz.questions.length,
            answers: formattedAnswers,
            status: 'completed',
            startedAt: Date.now(), // Fallback if no start time recorded
            completedAt: Date.now()
        });

        await result.save();
        res.json(result);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error: ' + err.message });
    }
};

exports.getLeaderboard = async (req, res) => {
    try {
        const quiz = await Quiz.findById(req.params.quizId);
        if (!quiz) return res.status(404).json({ msg: 'Quiz not found' });

        // If quiz is finished and has stored leaderboard, return that
        if (quiz.status === 'finished' && quiz.finalLeaderboard && quiz.finalLeaderboard.length > 0) {
            return res.json({
                results: quiz.finalLeaderboard,
                insights: quiz.finalInsights,
                isFinal: true
            });
        }

        // Otherwise (or for live updates), fetch from Results model
        const results = await Result.find({ quiz: req.params.quizId })
            .populate('student', 'username email')
            .sort({ score: -1, completedAt: 1 });

        const leaderboard = results.map((r, index) => ({
            studentId: r.student._id,
            username: r.student.username,
            currentScore: r.score,
            answeredQuestions: r.answers.length,
            rank: index + 1
        }));

        res.json({
            results: leaderboard,
            isFinal: quiz.status === 'finished'
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error: ' + err.message });
    }
};

// Missing functions that routes expect
exports.publishQuiz = async (req, res) => {
    try {
        const quiz = await Quiz.findById(req.params.id);

        if (!quiz) {
            return res.status(404).json({ msg: 'Quiz not found' });
        }

        // Check user
        if (quiz.createdBy.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'User not authorized' });
        }

        quiz.isActive = !quiz.isActive;
        await quiz.save();

        res.json(quiz);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error: ' + err.message });
    }
};

exports.getTeacherStats = async (req, res) => {
    try {
        const quizzes = await Quiz.find({ createdBy: req.user.id }).sort({ createdAt: -1 });

        const stats = await Promise.all(quizzes.map(async (quiz) => {
            let results;

            if (quiz.status === 'finished' && quiz.finalLeaderboard && quiz.finalLeaderboard.length > 0) {
                // Use stored results for finished quizzes
                results = quiz.finalLeaderboard.map(r => ({
                    studentName: r.username,
                    score: r.currentScore,
                    totalQuestions: quiz.questions.length,
                    completedAt: quiz.updatedAt || quiz.createdAt // Approximate
                }));
            } else {
                // Fetch live/active results
                const dbResults = await Result.find({ quiz: quiz._id })
                    .populate('student', 'username email')
                    .sort({ completedAt: -1 });

                results = dbResults.map(r => ({
                    studentName: r.student?.username || 'Unknown',
                    score: r.score,
                    totalQuestions: r.totalQuestions,
                    completedAt: r.completedAt
                }));
            }

            const completionCount = results.length;
            const averageScore = completionCount > 0
                ? (results.reduce((sum, r) => sum + r.score, 0) / completionCount / (quiz.questions.length * 10)) * 100
                : 0;

            return {
                quizId: quiz._id,
                title: quiz.title,
                completionCount,
                averageScore,
                results
            };
        }));

        res.json(stats);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error: ' + err.message });
    }
};

exports.submitAttempt = async (req, res) => {
    // Alias for submitQuiz
    return exports.submitQuiz(req, res);
};

exports.updateQuiz = async (req, res) => {
    try {
        const { title, description, questions, difficulty, timerPerQuestion, duration, isLive, isActive, isAssessment } = req.body;

        let quiz = await Quiz.findById(req.params.id);

        if (!quiz) {
            return res.status(404).json({ msg: 'Quiz not found' });
        }

        // Check user
        if (quiz.createdBy.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'User not authorized' });
        }

        // Update fields
        if (title) quiz.title = title;
        if (description) quiz.description = description;
        if (questions) {
            quiz.questions = Array.isArray(questions) ? questions : JSON.parse(questions);
        }
        if (difficulty) quiz.difficulty = difficulty;
        if (timerPerQuestion !== undefined) quiz.timerPerQuestion = timerPerQuestion;
        if (duration !== undefined) quiz.duration = duration;
        if (isAssessment !== undefined) quiz.isAssessment = isAssessment === 'true' || isAssessment === true;

        // Activation / Deactivation logic
        if (isActive !== undefined) {
            const requestedActive = isActive === 'true' || isActive === true;

            if (requestedActive && !quiz.isActive) {
                // Automatic Cleanup: Deactivate other active sessions for this teacher
                await Quiz.updateMany(
                    {
                        createdBy: req.user.id,
                        isActive: true,
                        _id: { $ne: quiz._id }
                    },
                    {
                        $set: {
                            isActive: false,
                            status: 'finished'
                        }
                    }
                );

                quiz.isActive = true;
                // If turning on, sync status
                if (quiz.isLive) quiz.status = 'waiting';
                else quiz.status = 'started';
            } else if (!requestedActive) {
                quiz.isActive = false;
                if (quiz.isLive) quiz.status = 'finished';
            }
        }

        // Handle isLive change
        if (isLive !== undefined) {
            quiz.isLive = isLive === 'true' || isLive === true;
            if (quiz.isActive) {
                quiz.status = quiz.isLive ? 'waiting' : 'started';
            }
        }

        await quiz.save();
        res.json(quiz);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error: ' + err.message });
    }
};

exports.generateQuizQuestions = async (req, res) => {
    try {
        let { type, content, questionCount, difficulty, topic } = req.body;
        let finalQuestions = [];
        let extractedTitle = topic || '';

        if (req.file && type === 'pdf') {
            try {
                const data = await pdfParse(req.file.buffer);
                const cleanedText = data.text.replace(/\s+/g, ' ').trim();
                finalQuestions = await generateQuestions('pdf', cleanedText, questionCount, difficulty);
                extractedTitle = req.file.originalname.replace('.pdf', '');
            } catch (pdfErr) {
                console.error('❌ PDF Parsing Error:', pdfErr.message);
                finalQuestions = generateMockQuestions(questionCount || 5);
            }
        } else if (content || topic) {
            finalQuestions = await generateQuestions(type, content || topic, questionCount, difficulty);
        }

        res.json({
            questions: finalQuestions,
            title: extractedTitle,
            duration: 10 // Default duration for review
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Generation Error: ' + err.message });
    }
};

exports.getStudentHistory = async (req, res) => {
    try {
        // Find all quizzes that are finished
        const finishedQuizzes = await Quiz.find({
            $or: [
                { status: 'finished' },
                { isActive: false }
            ]
        }).sort({ createdAt: -1 });

        const history = await Promise.all(finishedQuizzes.map(async (quiz) => {
            const result = await Result.findOne({ quiz: quiz._id, student: req.user.id });

            return {
                _id: quiz._id,
                title: quiz.title,
                topic: quiz.topic,
                description: quiz.description,
                date: quiz.createdAt,
                completedAt: result ? result.completedAt : null,
                score: result ? result.score : 0,
                totalQuestions: quiz.questions.length,
                status: result ? 'Completed' : 'Missed',
                isAttempted: !!result
            };
        }));

        res.json(history);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error: ' + err.message });
    }
};
