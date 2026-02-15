const Quiz = require('../models/Quiz');
const Result = require('../models/Result');
const OpenAI = require('openai');
const pdfParse = require('pdf-parse');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'sk-placeholder-key-for-startup'
});

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

// IMPROVED AI Generation - Content-Specific Questions
const generateQuestions = async (type, content, count = 5, difficulty = 'Medium') => {
    // Fallback to mock if API key is not provided or is placeholder
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'sk-placeholder-key-for-startup') {
        console.log('⚠️  Using Mock Quiz Generation (No API Key)');
        return generateMockQuestions(count);
    }

    // Validate content
    if (!content || content.trim().length < 50) {
        console.error('❌ Content too short or empty. Minimum 50 characters required.');
        console.log('Content received:', content?.substring(0, 100));
        return generateMockQuestions(count);
    }

    try {
        // IMPROVED SYSTEM PROMPT - Emphasizes content-specific questions
        const systemPrompt = `You are an expert educational quiz generator. Your ONLY job is to create quiz questions that are DIRECTLY based on the content provided by the user.

CRITICAL RULES:
1. ALL questions MUST be answerable using ONLY the information in the provided content
2. DO NOT use general knowledge or external information  
3. Questions should test understanding of the SPECIFIC content provided
4. Extract key facts, concepts, and details from the content
5. Ensure questions are relevant to the actual content, not generic topics

Generate ONLY questions that someone who read the provided content could answer.`;

        // IMPROVED USER PROMPT - More explicit instructions
        const userPrompt = `Based EXCLUSIVELY on the following content, generate exactly ${count} ${difficulty} level quiz questions.

INSTRUCTIONS:
- Read the content carefully and identify the main topics, facts, and concepts
- Create questions that test understanding of SPECIFIC information from the content
- DO NOT create generic questions that could apply to any content
- Questions must be answerable using ONLY the information provided below
- Reference specific details, names, dates, concepts, or facts from the content

DIFFICULTY LEVEL: ${difficulty}
- Easy: Direct facts and information from the content
- Medium: Understanding and application of concepts from the content
- Thinkable: Analysis and connections between ideas in the content
- Hard: Deep analysis and critical thinking about the content

FORMAT: Return a valid JSON object with this exact structure:
{
  "questions": [
    {
      "questionText": "string (question based on specific content)",
      "options": ["string", "string", "string", "string"],
      "correctAnswer": "string (must match one option exactly)",
      "points": 10,
      "type": "multiple-choice"
    }
  ]
}

CONTENT TO ANALYZE:
---
${content.substring(0, 8000)}
---

Generate ${count} questions that are SPECIFICALLY about the content above. Each question should reference specific information, facts, or concepts from the content.`;

        console.log('🤖 Generating', count, difficulty, 'questions from content (', content.length, 'chars )');
        console.log('📄 Content preview:', content.substring(0, 200).replace(/\s+/g, ' ') + '...');

        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            response_format: { type: "json_object" },
            temperature: 0.7, // Balanced creativity
            max_tokens: 2000 // Enough for detailed questions
        });

        const result = JSON.parse(response.choices[0].message.content);
        console.log('✅ AI generated', result.questions?.length || 0, 'questions');

        // Log first question for verification
        if (result.questions && result.questions[0]) {
            console.log('📝 First question:', result.questions[0].questionText.substring(0, 100));
        }

        return Array.isArray(result.questions) ? result.questions : result;
    } catch (err) {
        console.error('❌ OpenAI Error:', err.message);
        console.log('⚠️  Falling back to Mock Quiz Generation due to AI error');
        return generateMockQuestions(count);
    }
};

const generateJoinCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

exports.createQuiz = async (req, res) => {
    try {
        let { title, type, content, questions: manualQuestions, questionCount, difficulty, timerPerQuestion, topic, isLive } = req.body;
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
            isActive: true, // Auto-active for code joining
            joinCode,
            difficulty: difficulty || 'Medium',
            timerPerQuestion: timerPerQuestion || 30,
            topic: topic || '',
            isLive: isLive === 'true' || isLive === true,
            status: isLive ? 'waiting' : 'started'
        });

        const quiz = await newQuiz.save();
        res.json(quiz);

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error: ' + err.message);
    }
};

exports.joinByCode = async (req, res) => {
    try {
        const { code } = req.body;
        const quiz = await Quiz.findOne({ joinCode: code, isActive: true });

        if (!quiz) {
            return res.status(404).json({ msg: 'Quiz not found or not active' });
        }

        res.json({
            quizId: quiz._id,
            isLive: quiz.isLive,
            status: quiz.status
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

exports.getMyQuizzes = async (req, res) => {
    try {
        const quizzes = await Quiz.find({ createdBy: req.user.id }).sort({ createdAt: -1 });
        res.json(quizzes);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
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
        res.status(500).send('Server Error');
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
        res.status(500).send('Server Error');
    }
};

exports.getQuizById = async (req, res) => {
    try {
        const quiz = await Quiz.findById(req.params.id);

        if (!quiz) {
            return res.status(404).json({ msg: 'Quiz not found' });
        }

        res.json(quiz);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
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
            completedAt: Date.now()
        });

        await result.save();
        res.json(result);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
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
        res.status(500).send('Server Error');
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
        res.status(500).send('Server Error');
    }
};

exports.getTeacherStats = async (req, res) => {
    try {
        const quizzes = await Quiz.find({ createdBy: req.user.id });

        const stats = await Promise.all(quizzes.map(async (quiz) => {
            const results = await Result.find({ quiz: quiz._id }).populate('student', 'username email');

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
        res.status(500).send('Server Error');
    }
};

exports.submitAttempt = async (req, res) => {
    // Alias for submitQuiz
    return exports.submitQuiz(req, res);
};

