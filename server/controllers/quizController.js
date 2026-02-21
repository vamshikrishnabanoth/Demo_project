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

// GEMINI AI Generation - Content-Specific Questions
const generateQuestions = async (type, content, count = 5, difficulty = 'Medium') => {
    console.log('--- DEBUG: PREPARING GENERATION ---');
    console.log('Key Status:', process.env.GEMINI_API_KEY ? 'Present' : 'Missing');
    if (process.env.GEMINI_API_KEY) console.log('Key Preview:', process.env.GEMINI_API_KEY.substring(0, 10) + '...');

    // Fallback to mock if API key is not provided or is placeholder
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'AIzaSyPlaceholder') {
        console.log('⚠️  Using Mock Quiz Generation (No Gemini API Key)');
        return generateMockQuestions(count);
    }

    // Initialize Gemini Client Lazily to ensure ENV is loaded
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        // Fallback to gemini-pro if flash fails or key is restricted
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        // Validate content (Relaxed for Topic)
        if (!content || (type !== 'topic' && content.trim().length < 20)) {
            console.error('❌ Content too short or empty:', content ? content.length : 'null');
            return generateMockQuestions(count);
        }

        const prompt = `You are an expert educational quiz generator. Create exactly ${count} questions with a difficulty level of "${difficulty}".
        
        CONTEXT/TOPIC:
        "${content.substring(0, 30000)}"

        CRITICAL RULES:
        1. If the input is a TOPIC (short text), generate relevant questions based on general knowledge of that topic.
        2. If the input is TEXT/PDF CONTENT (long text), ALL questions MUST be answerable using ONLY that content.
        3. Difficulty ${difficulty}: Adjust vocabulary and complexity accordingly.
        4. Format: Return a VALID JSON object with this exact structure:
        {
          "questions": [
            {
              "questionText": "string",
              "options": ["string", "string", "string", "string"],
              "correctAnswer": "string (must match one option exactly)",
              "points": 10,
              "type": "multiple-choice"
            }
          ]
        }
        
        Generate ONLY the JSON object. No preamble or markdown formatting.`;

        console.log(`🤖 Generating ${count} questions via Gemini...`);
        const result = await model.generateContent(prompt);
        const responseText = result.response.text().trim();

        // Handling Gemini's occasional markdown wrap
        const cleanJSON = responseText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
        console.log('--- DEBUG: RAW JSON ---', cleanJSON.substring(0, 50) + '...');
        const data = JSON.parse(cleanJSON);

        console.log('✅ Gemini generated', data.questions?.length || 0, 'questions');
        return Array.isArray(data.questions) ? data.questions : data;
    } catch (err) {
        console.error('❌ Gemini Error Detailed:', err);
        return generateMockQuestions(count);
    }
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
        const results = await Result.find({ quiz: req.params.quizId })
            .populate('student', 'username email')
            .sort({ score: -1, completedAt: 1 })
            .limit(10);

        res.json(results);
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
            const results = await Result.find({ quiz: quiz._id })
                .populate('student', 'username email')
                .sort({ completedAt: -1 });

            const completionCount = results.length;
            const averageScore = completionCount > 0
                ? (results.reduce((sum, r) => sum + r.score, 0) / completionCount / quiz.questions.length / 10) * 100
                : 0;

            return {
                quizId: quiz._id,
                title: quiz.title,
                completionCount,
                averageScore,
                results: results.map(r => ({
                    studentName: r.student.username,
                    score: r.score,
                    totalQuestions: r.totalQuestions,
                    completedAt: r.completedAt
                }))
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
