const prisma = require('../lib/prisma');
const { moderateContent } = require('../lib/moderator');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const officeParser = require('officeparser');
const Groq = require('groq-sdk');

// Initialize Groq for Whisper (Transcription)
let groq;
if (process.env.GROQ_API_KEY) {
    groq = new Groq({
        apiKey: process.env.GROQ_API_KEY
    });
} else {
    console.warn('⚠️ GROQ_API_KEY is missing. Audio transcription (Whisper) will be disabled.');
}


/**
 * Transcribes audio file using Groq Whisper
 */
const transcribeAudio = async (filePath) => {
    try {
        if (!groq) {
            console.error('❌ Transcription Error: Groq client not initialized (missing API key)');
            return null;
        }
        console.log('🎙️ Transcribing audio with Groq Whisper...');
        const transcription = await groq.audio.transcriptions.create({
            file: fs.createReadStream(filePath),
            model: "whisper-large-v3",
            prompt: "This is a transcript of a classroom lecture. Focus on educational concepts. Ignore classroom management talk like 'sit down' or 'be quiet'.", // Context hint
            response_format: "text",
        });
        return transcription;
    } catch (err) {
        console.error('❌ Transcription Error:', err.message);
        return null;
    }
};

// Mock AI Generation for fallback
const generateMockQuestions = (count = 5, errorMsg = "AI generation is temporarily unavailable.") => {
    const questions = [];
    for (let i = 1; i <= count; i++) {
        questions.push({
            questionText: `Sample Question ${i}: ${errorMsg}`,
            options: ['Option A', 'Option B', 'Option C', 'Option D'],
            correctAnswer: 'Option A',
            points: 10,
            type: 'multiple-choice'
        });
    }
    return questions;
};

// Simplified mock fallback as requested: beautiful, pre-formatted, easy-to-edit template
const generateFallbackMockQuestions = (count = 5) => {
    const questions = [];
    for (let i = 1; i <= count; i++) {
        questions.push({
            questionText: `AI quiz generation is temporarily offline. Would you like to edit Question #${i} to customize its text?`,
            options: ["Yes, let's edit this question!", "No, keep it simple.", "Maybe later.", "Show me configuration instructions."],
            correctAnswer: "Yes, let's edit this question!",
            points: 10,
            type: 'multiple-choice'
        });
    }
    return questions;
};

// Cloud-based Groq fallback or pre-formatted mock fallback
const generateFallbackQuestions = async (type, content, count = 5, difficulty = 'Medium') => {
    console.log(`🔄 Local AI failed. Initiating Groq Cloud Fallback...`);
    
    if (process.env.GROQ_API_KEY && groq) {
        try {
            console.log(`🤖 Calling Groq (llama-3.1-8b-instant) for resilient generation...`);
            
            const prompt = `
                You are an expert quiz generator.
                Generate a set of multiple-choice questions based on the following input:
                
                Topic/Content: ${content.substring(0, 4000)}
                Difficulty: ${difficulty}
                Count: ${count}
                
                Return a JSON object with a single key "questions", which contains an array of question objects.
                Each question object MUST have exactly these keys:
                - questionText (string)
                - options (array of exactly 4 strings)
                - correctAnswer (string, must exactly match one of the options)
                
                Do not return any conversational text, explanations, or markdown formatting wrapper except the JSON block.
            `;
            
            const chatCompletion = await groq.chat.completions.create({
                messages: [{ role: 'user', content: prompt }],
                model: 'llama-3.1-8b-instant',
                response_format: { type: 'json_object' },
                temperature: 0.5,
                max_tokens: 2000
            });
            
            const rawResponse = chatCompletion.choices[0].message.content;
            const parsed = JSON.parse(rawResponse);
            
            if (parsed && parsed.questions && parsed.questions.length > 0) {
                console.log(`✅ Groq Fallback successful! Generated ${parsed.questions.length} questions.`);
                return parsed.questions.map(q => ({
                    questionText: q.questionText,
                    options: q.options.slice(0, 4),
                    correctAnswer: q.correctAnswer,
                    points: 10,
                    type: 'multiple-choice'
                }));
            }
        } catch (groqErr) {
            console.error(`⚠️ Groq Fallback failed:`, groqErr.message);
        }
    }
    
    console.log(`⚠️ All AI services failed. Returning pre-formatted editable fallback questions.`);
    return generateFallbackMockQuestions(count);
};

// Text Extraction Helper
const extractText = async (filePath) => {
    try {
        const ext = path.extname(filePath).toLowerCase();
        if (ext === '.pdf') {
            const dataBuffer = fs.readFileSync(filePath);
            const data = await pdfParse(dataBuffer);
            return data.text;
        } else if (ext === '.docx') {
            const result = await mammoth.extractRawText({ path: filePath });
            return result.value;
        } else if (['.pptx', '.xlsx'].includes(ext)) {
            return new Promise((resolve, reject) => {
                officeParser.parseOffice(filePath, (data, err) => {
                    if (err) return reject(err);
                    resolve(data);
                });
            });
        }
        return fs.readFileSync(filePath, 'utf8');
    } catch (err) {
        console.error('❌ Extraction Error:', err.message);
        return null;
    }
};


const checkAiServiceOnline = async (url) => {
    try {
        console.log(`🔍 Probing local AI Service at ${url}...`);
        await axios.get(url, { 
            headers: { 'Bypass-Tunnel-Reminder': 'true' },
            timeout: 1500 
        });
        return true;
    } catch (err) {
        if (err.response) {
            console.log(`ℹ️ AI Service replied with HTTP status ${err.response.status}`);
            // 502/503/504 errors mean the Ngrok/Localhost tunnel is up but the local service itself is stopped
            if ([502, 503, 504].includes(err.response.status)) {
                console.log(`⚠️ AI Service tunnel is active but the local Python service is completely stopped.`);
                return false;
            }
            return true;
        }
        console.log(`❌ AI Service probe failed: ${err.message}`);
        return false;
    }
};

// LOCAL/CLOUD AI Generation - Using Your Fine-Tuned Llama-3 Brain
const generateQuestions = async (type, content, count = 5, difficulty = 'Medium') => {
    const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    
    // Probe the AI Service first to ensure we fallback instantly if it is down/offline
    const isOnline = await checkAiServiceOnline(AI_SERVICE_URL);
    if (!isOnline) {
        console.log(`⚠️ AI Service is offline/down. Bypassing directly to Groq Fallback!`);
        return generateFallbackQuestions(type, content, count, difficulty);
    }

    try {
        console.log(`🚀 Sending to AI Service at ${AI_SERVICE_URL}: ${type} | Count: ${count}`);
        
        const response = await axios.post(`${AI_SERVICE_URL}/generate`, {
            type: type,
            content: content, 
            count: parseInt(count),
            difficulty: difficulty
        }, {
            headers: {
                'Bypass-Tunnel-Reminder': 'true' // Bypasses the localtunnel landing page
            },
            timeout: 300000 // Increased timeout to 5 minutes for slow local AI generation
        });

        if (response.data && response.data.questions) {
            console.log(`✅ Received ${response.data.questions.length} questions from Local AI`);
            return response.data.questions;
        }
        
        return generateFallbackQuestions(type, content, count, difficulty);
    } catch (err) {
        console.error('❌ AI Service Error:', err.message);
        return generateFallbackQuestions(type, content, count, difficulty);
    }
};

// No longer need extractCloudText because the Python service handles it now

const autoBroadcastLiveQuiz = async (quiz, req) => {
    try {
        // Only auto-broadcast if it is an active live quiz and is not scheduled in the future and autoBroadcast is allowed
        if (!quiz.isLive || !quiz.isActive || quiz.autoBroadcast === false) return;

        const now = new Date();
        if (quiz.startTime && new Date(quiz.startTime) > now) {
            return;
        }

        // Avoid duplicate broadcasts for the same quiz
        const existingBroadcast = await prisma.broadcast.findFirst({
            where: { quizId: quiz.id }
        });
        if (existingBroadcast) return;

        // Fetch teacher details
        const teacher = await prisma.user.findUnique({
            where: { id: quiz.createdById },
            select: { name: true, username: true }
        });

        const title = `🚨 Live Arena Invitation: ${quiz.title}`;
        const message = `Professor ${teacher.name || teacher.username} has launched a live quiz lobby! Click below to enter the Arena and start competing instantly.`;

        // Save Broadcast to PostgreSQL
        const broadcast = await prisma.broadcast.create({
            data: {
                senderId: quiz.createdById,
                quizId: quiz.id,
                title,
                message,
                pin: quiz.joinCode,
                assignedGroups: quiz.assignedGroups || [],
                assignedStudents: quiz.assignedStudents || [],
                expiresAt: quiz.endTime ? new Date(quiz.endTime) : new Date(now.getTime() + 2 * 60 * 60 * 1000), // Default 2 hours expiry
                isPinned: true,
                deliveryStatus: 'delivered'
            },
            include: {
                sender: { select: { name: true, username: true } },
                quiz: { select: { title: true } }
            }
        });

        console.log(`📡 [AUTO-BROADCAST] Generated broadcast for Live Quiz: ${quiz.title}`);

        // Trigger Socket.io real-time notifications to online targeted students
        const io = req.app.get('io');
        const userSockets = req.app.get('userSockets');

        if (io && userSockets) {
            const activeStudents = await prisma.user.findMany({
                where: { role: 'student' }
            });

            const isStudentTargeted = (student, assignedGroups, assignedStudents) => {
                if ((!assignedGroups || assignedGroups.length === 0) && 
                    (!assignedStudents || assignedStudents.length === 0)) {
                    return true;
                }
                if (assignedStudents && assignedStudents.includes(student.id)) {
                    return true;
                }
                if (assignedGroups && assignedGroups.length > 0 && student.studentBranch) {
                    return assignedGroups.some(g => {
                        const branchMatch = g.branch.toLowerCase() === student.studentBranch.toLowerCase();
                        const secMatch = !g.section || g.section.toLowerCase() === (student.section || '').toLowerCase();
                        return branchMatch && secMatch;
                    });
                }
                return false;
            };

            activeStudents.forEach(student => {
                if (isStudentTargeted(student, quiz.assignedGroups, quiz.assignedStudents)) {
                    const socketSet = userSockets.get(student.id);
                    if (socketSet && socketSet.size > 0) {
                        socketSet.forEach(socketId => {
                            io.to(socketId).emit('new_broadcast', {
                                id: broadcast.id,
                                title: broadcast.title,
                                message: broadcast.message,
                                senderName: broadcast.sender.name || broadcast.sender.username,
                                quizTitle: broadcast.quiz.title,
                                pin: broadcast.pin,
                                createdAt: broadcast.createdAt,
                                expiresAt: broadcast.expiresAt,
                                isPinned: broadcast.isPinned
                            });
                        });
                    }
                }
            });
        }
    } catch (err) {
        console.error('❌ Error executing auto-broadcast:', err);
    }
};

const generateJoinCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

exports.createQuiz = async (req, res) => {
    try {
        let { title, type, content, questions: manualQuestions, questionCount, difficulty, timerPerQuestion, topic, isLive, isAssessment, isActive, duration, assignedGroups, assignedStudents, startTime, endTime, timerType, accessType, autoBroadcast } = req.body;
        let finalQuestions = [];

        // --- AI MODERATION GUARD ---
        if (req.file) {
            const ext = path.extname(req.file.originalname).toLowerCase();
            const isImage = ['.jpg', '.jpeg', '.png'].includes(ext);
            const moderation = await moderateContent(req.user.id, title || topic || '', isImage ? 'image' : 'text', path.resolve(req.file.path));
            if (!moderation.isSafe) {
                return res.status(403).json({ msg: 'Account suspended due to content violation.', reason: moderation.reason });
            }
        } else if (content || topic || title) {
            const moderation = await moderateContent(req.user.id, `${title} ${topic} ${content}`, 'text');
            if (!moderation.isSafe) {
                return res.status(403).json({ msg: 'Account suspended due to content violation.', reason: moderation.reason });
            }
        }

        if (manualQuestions && manualQuestions.length > 0) {
            finalQuestions = Array.isArray(manualQuestions) ? manualQuestions : JSON.parse(manualQuestions);
        } else if (req.file) {
            const absolutePath = path.resolve(req.file.path);
            const extractedText = await extractText(absolutePath);
            if (extractedText) {
                finalQuestions = await generateQuestions('topic', extractedText, questionCount, difficulty);
            } else {
                finalQuestions = await generateQuestions(type, absolutePath, questionCount, difficulty);
            }
        } else if (content || topic) {
            finalQuestions = await generateQuestions('topic', content || topic, questionCount, difficulty);
        }

        if (isLive === 'true' || isLive === true) {
            // Automatic Cleanup: Deactivate existing active live quizzes for this teacher
            await prisma.quiz.updateMany({
                where: {
                    createdById: req.user.id,
                    isLive: true,
                    status: { in: ['waiting', 'started'] }
                },
                data: {
                    isActive: false,
                    status: 'finished'
                }
            });
        }

        // Generate a unique join code
        let joinCode = generateJoinCode();
        let codeExists = await prisma.quiz.findUnique({ where: { joinCode } });
        while (codeExists) {
            joinCode = generateJoinCode();
            codeExists = await prisma.quiz.findUnique({ where: { joinCode } });
        }

        // Parse JSON/Arrays safely
        let parsedGroups = null;
        if (assignedGroups) {
            parsedGroups = typeof assignedGroups === 'string' ? JSON.parse(assignedGroups) : assignedGroups;
        }
        let parsedStudents = [];
        if (assignedStudents) {
            parsedStudents = typeof assignedStudents === 'string' ? JSON.parse(assignedStudents) : assignedStudents;
        }

        let parsedAutoBroadcast = true;
        if (autoBroadcast !== undefined) {
            parsedAutoBroadcast = autoBroadcast === 'true' || autoBroadcast === true;
        }

        const newQuiz = await prisma.quiz.create({
            data: {
                title: title || `${topic || content || 'Untitled'} Quiz`,
                description: `Level: ${difficulty || 'Medium'}`,
                questions: finalQuestions,
                createdById: req.user.id,
                isActive: isActive === undefined ? true : (isActive === 'true' || isActive === true),
                joinCode,
                difficulty: difficulty || 'Medium',
                timerPerQuestion: timerPerQuestion ? parseInt(timerPerQuestion) : 30,
                duration: duration ? parseInt(duration) : 0,
                timerType: timerType || 'timePerQuestion',
                accessType: accessType || 'private',
                startTime: startTime ? new Date(startTime) : null,
                endTime: endTime ? new Date(endTime) : null,
                topic: topic || content || '',
                isLive: isLive === 'true' || isLive === true,
                isAssessment: isAssessment === 'true' || isAssessment === true,
                status: isLive === 'true' || isLive === true ? 'waiting' : 'finished',
                assignedGroups: parsedGroups,
                assignedStudents: parsedStudents,
                autoBroadcast: parsedAutoBroadcast
            }
        });

        // Trigger background automated broadcast if the live quiz is active
        await autoBroadcastLiveQuiz(newQuiz, req);

        res.status(201).json(newQuiz);

    } catch (err) {
        console.error('❌ Final CreateQuiz Error:', err.message);
        res.status(500).json({ 
            message: 'Failed to create quiz', 
            error: err.message
        });
    }
};


exports.joinByCode = async (req, res) => {
    try {
        const { code } = req.body;
        console.log(`🔍 Try join by code: ${code} (User: ${req.user.id})`);
        const quiz = await prisma.quiz.findFirst({
            where: {
                joinCode: code.toString(),
                isActive: true
            }
        });

        if (!quiz) {
            console.log(`❌ Quiz not found or not active for code: ${code}`);
            return res.status(404).json({ msg: 'Quiz not found or not active' });
        }
        console.log(`✅ Found quiz: ${quiz.title} (${quiz.id})`);

        // Start/End Time Validation (Exempt the teacher/creator and admin)
        const now = new Date();
        const isCreator = quiz.createdById === req.user.id;
        const isAdmin = req.user.role === 'admin';

        if (!isCreator && !isAdmin) {
            if (quiz.startTime && new Date(quiz.startTime) > now) {
                return res.status(403).json({ msg: `This quiz is scheduled to start at ${new Date(quiz.startTime).toLocaleString()}.` });
            }
            if (quiz.endTime && new Date(quiz.endTime) < now) {
                return res.status(403).json({ msg: 'This quiz has expired and is no longer accepting responses.' });
            }
        }

        // Check for existing result to handle resume/blocking
        const existingResult = await prisma.result.findFirst({
            where: {
                quizId: quiz.id,
                studentId: req.user.id
            }
        });

        res.json({
            quizId: quiz.id,
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
        const quizzes = await prisma.quiz.findMany({
            where: { createdById: req.user.id },
            orderBy: { createdAt: 'desc' }
        });

        const enriched = await Promise.all(quizzes.map(async (quiz) => {
            const results = await prisma.result.findMany({
                where: { quizId: quiz.id }
            });
            const completionCount = results.length;
            const averageScore = completionCount > 0
                ? results.reduce((sum, r) => sum + r.score, 0) / completionCount
                : 0;
            return {
                ...quiz,
                completionCount,
                averageScore,
                results: results
                    .sort((a, b) => b.score - a.score)
                    .slice(0, 3)
                    .map(r => ({
                        studentName: r.studentName || 'Student',
                        score: r.score
                    }))
            };
        }));

        res.json(enriched);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error: ' + err.message });
    }
};

exports.deleteQuiz = async (req, res) => {
    try {
        const quiz = await prisma.quiz.findUnique({
            where: { id: req.params.id }
        });

        if (!quiz) {
            return res.status(404).json({ msg: 'Quiz not found' });
        }

        // Check user
        if (quiz.createdById !== req.user.id) {
            return res.status(401).json({ msg: 'User not authorized' });
        }

        // Delete all related results first to avoid foreign key violations
        await prisma.result.deleteMany({
            where: { quizId: req.params.id }
        });

        // Delete all related broadcasts first to avoid foreign key violations
        await prisma.broadcast.deleteMany({
            where: { quizId: req.params.id }
        });

        await prisma.quiz.delete({
            where: { id: req.params.id }
        });

        res.json({ msg: 'Quiz removed' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server Error: ' + err.message });
    }
};

exports.getLiveQuizzes = async (req, res) => {
    try {
        const quizzes = await prisma.quiz.findMany({
            where: { isActive: true },
            orderBy: { createdAt: 'desc' }
        });

        const now = new Date();

        const quizzesWithAttempts = await Promise.all(quizzes.map(async (quiz) => {
            const result = await prisma.result.findFirst({
                where: { quizId: quiz.id, studentId: req.user.id }
            });

            // Determine timing status for assessments
            let isLocked = false;
            let isExpired = false;

            if (quiz.isAssessment) {
                if (quiz.startTime && new Date(quiz.startTime) > now) {
                    isLocked = true;
                }
                if (quiz.endTime && new Date(quiz.endTime) < now) {
                    isExpired = true;
                }
            }

            // Cleanly calculate total questions
            let totalQ = 0;
            if (Array.isArray(quiz.questions)) {
                totalQ = quiz.questions.length;
            } else if (quiz.questions && typeof quiz.questions === 'object') {
                try {
                    const parsed = typeof quiz.questions === 'string' ? JSON.parse(quiz.questions) : quiz.questions;
                    totalQ = Array.isArray(parsed) ? parsed.length : (parsed.questions ? parsed.questions.length : 0);
                } catch (_) {}
            }

            // Strip raw questions column for security against sniffing
            const { questions, ...quizData } = quiz;

            return {
                ...quizData,
                isAttempted: !!result,
                score: result ? result.score : 0,
                totalQuestions: totalQ,
                isLocked,
                isExpired
            };
        }));

        res.json(quizzesWithAttempts);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error: ' + err.message });
    }
};

// Helper: Normalize a questions array from PostgreSQL JSON field.
// Prisma returns Json columns as plain JS values, but edge cases (double-
// serialized strings, objects instead of strings in the options array) can
// appear after a MongoDB→PostgreSQL migration.  This function guarantees
// every question object has:
//   questionText  – string
//   options       – array of strings (never null / undefined / object)
//   correctAnswer – string
const normalizeQuestions = (questions) => {
    if (!Array.isArray(questions)) {
        // Prisma may return a JSON string in rare Supabase/direct-SQL inserts
        try { questions = JSON.parse(questions); } catch (_) { return []; }
    }
    return questions.map((q) => {
        // Normalize options: always produce an array of strings
        let options = q.options;
        if (!Array.isArray(options)) {
            // options might be an object like { a: "...", b: "..." }
            if (options && typeof options === 'object') {
                options = Object.values(options).map(String);
            } else {
                options = ['Option A', 'Option B', 'Option C', 'Option D'];
            }
        } else {
            // Make sure every element is a plain string (not an object)
            options = options.map((o) =>
                typeof o === 'string' ? o : (o?.text || o?.label || String(o))
            );
        }
        return {
            ...q,
            questionText: q.questionText || q.question || '',
            options,
            correctAnswer: q.correctAnswer || q.correct_answer || '',
            points: q.points || 10,
        };
    });
};

exports.getQuizById = async (req, res) => {
    try {
        const quiz = await prisma.quiz.findUnique({
            where: { id: req.params.id }
        });

        if (!quiz) {
            return res.status(404).json({ msg: 'Quiz not found' });
        }

        // Attach previous result if it exists (for resume functionality)
        const previousResult = await prisma.result.findFirst({
            where: { quizId: req.params.id, studentId: req.user.id }
        });

        // Normalize questions to guarantee options are plain strings
        let normalizedQuestions = normalizeQuestions(quiz.questions);

        // SECURITY: Strip correct answers if user is not the creator or an admin
        const isCreator = quiz.createdById === req.user.id;
        const isAdmin = req.user.role === 'admin';
        
        if (!isCreator && !isAdmin) {
            const now = new Date();
            if (quiz.isAssessment) {
                if (quiz.startTime && new Date(quiz.startTime) > now) {
                    return res.status(403).json({ msg: `This quiz is scheduled to start at ${new Date(quiz.startTime).toLocaleString()}.` });
                }
                if (quiz.endTime && new Date(quiz.endTime) < now) {
                    return res.status(403).json({ msg: 'This quiz has expired and is no longer accepting responses.' });
                }
            }
            normalizedQuestions = normalizedQuestions.map(q => {
                const { correctAnswer, explanation, ...safeQuestion } = q;
                return safeQuestion;
            });
        }

        res.json({
            ...quiz,
            questions: normalizedQuestions,
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

        const quiz = await prisma.quiz.findUnique({
            where: { id: quizId }
        });
        if (!quiz) {
            return res.status(404).json({ msg: 'Quiz not found' });
        }

        // SECURITY & HARDENING: If it is an ACTIVE live (synchronous) quiz, answers must ONLY be
        // submitted via WebSockets to prevent spoofing/tampering.
        // EXCEPTION: If the live quiz is already 'finished', the student is in async practice mode —
        // allow normal HTTP submission so a new practice result record is created.
        if (quiz.isLive && quiz.status !== 'finished') {
            const existingResult = await prisma.result.findFirst({
                where: { quizId: quizId, studentId: req.user.id }
            });
            if (existingResult) {
                if (existingResult.status === 'completed') {
                    return res.json(existingResult);
                }
                const updated = await prisma.result.update({
                    where: { id: existingResult.id },
                    data: {
                        status: 'completed',
                        completedAt: new Date(),
                        lastAnsweredAt: new Date()
                    }
                });
                return res.json(updated);
            } else {
                // If they joined but never answered any question, create a zero score completed result
                const result = await prisma.result.create({
                    data: {
                        quizId: quizId,
                        studentId: req.user.id,
                        score: 0,
                        totalTimeTaken: 0,
                        totalQuestions: quiz.questions.length,
                        answers: [],
                        status: 'completed',
                        startedAt: new Date(),
                        completedAt: new Date(),
                        lastAnsweredAt: new Date()
                    }
                });
                return res.json(result);
            }
        }

        // Validate scheduled start and end times
        const now = new Date();
        if (quiz.startTime && new Date(quiz.startTime) > now) {
            return res.status(403).json({ msg: `This quiz has not started yet. It is scheduled to start at ${new Date(quiz.startTime).toLocaleString()}.` });
        }
        if (quiz.endTime && new Date(quiz.endTime) < now) {
            return res.status(403).json({ msg: 'This quiz has expired and is no longer accepting submissions.' });
        }

        let score = 0;
        let totalTimeTaken = 0;
        const formattedAnswers = quiz.questions.map((q, idx) => {
            const selectedOption = (answers[idx]?.selectedOption || '').toString().trim();
            const timeTaken = parseInt(answers[idx]?.timeTaken || 0);
            const correctOption = (q.correctAnswer || '').toString().trim();

            totalTimeTaken += timeTaken;

            let isCorrect = selectedOption.toLowerCase() === correctOption.toLowerCase();

            // Fallback for labels (A, B, C...) or indices
            if (!isCorrect && q.options) {
                const labels = ['a', 'b', 'c', 'd', 'e'];
                const labelIdx = labels.indexOf(correctOption.toLowerCase());
                if (labelIdx !== -1 && q.options[labelIdx]) {
                    isCorrect = selectedOption.toLowerCase() === q.options[labelIdx].toString().trim().toLowerCase();
                } else if (correctOption !== '' && !isNaN(correctOption) && q.options[parseInt(correctOption)]) {
                    isCorrect = selectedOption.toLowerCase() === q.options[parseInt(correctOption)].toString().trim().toLowerCase();
                }
            }

            if (isCorrect) {
                score += q.points || 10;
            }
            return {
                questionText: q.questionText,
                selectedOption,
                correctOption,
                isCorrect,
                timeTaken: timeTaken
            };
        });

        // Assessments allow unlimited re-attempts → always create a new record.
        // Live quizzes keep the old upsert behaviour.
        if (quiz.isAssessment) {
            const now = new Date();
            const startedAt = new Date(now.getTime() - (totalTimeTaken * 1000));
            const result = await prisma.result.create({
                data: {
                    quizId: quizId,
                    studentId: req.user.id,
                    score,
                    totalTimeTaken,
                    totalQuestions: quiz.questions.length,
                    answers: formattedAnswers,
                    status: 'completed',
                    startedAt: startedAt,
                    completedAt: now,
                    lastAnsweredAt: now
                }
            });
            return res.json(result);
        }

        const existingResult = await prisma.result.findFirst({
            where: { quizId: quizId, studentId: req.user.id }
        });

        if (existingResult) {
            // SECURITY: Prevent re-submission if already completed
            if (existingResult.status === 'completed') {
                return res.status(403).json({ msg: 'Quiz already submitted. Answers cannot be changed.' });
            }

            const updated = await prisma.result.update({
                where: { id: existingResult.id },
                data: {
                    score,
                    totalTimeTaken,
                    answers: formattedAnswers,
                    totalQuestions: quiz.questions.length,
                    status: 'completed',
                    completedAt: new Date(),
                    lastAnsweredAt: new Date()
                }
            });
            return res.json(updated);
        }

        const result = await prisma.result.create({
            data: {
                quizId: quizId,
                studentId: req.user.id,
                score,
                totalTimeTaken,
                totalQuestions: quiz.questions.length,
                answers: formattedAnswers,
                status: 'completed',
                startedAt: new Date(),
                completedAt: new Date(),
                lastAnsweredAt: new Date()
            }
        });

        res.json(result);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error: ' + err.message });
    }
};

// GET /quiz/result/:quizId  – latest result for the current student (any status)
// Used by the Review page to show question-by-question breakdown.
// We intentionally do NOT filter by status:'completed' because migrated records
// from MongoDB may have status='in-progress' even though they are finished.
exports.getLatestResult = async (req, res) => {
    try {
        // Try completed results first (newest first), then fall back to any result
        let result = await prisma.result.findFirst({
            where: { quizId: req.params.quizId, studentId: req.user.id },
            orderBy: [{ completedAt: 'desc' }, { lastAnsweredAt: 'desc' }]
        });

        if (!result) {
            return res.status(404).json({ msg: 'No attempt found for this quiz.' });
        }

        // Also return the quiz questions so the review page can show correct answers
        const quiz = await prisma.quiz.findUnique({ where: { id: req.params.quizId } });

        // SECURITY: If not completed, don't send questions with answers
        let questions = quiz ? (quiz.questions || []) : [];
        if (result.status !== 'completed') {
            questions = questions.map(q => {
                const { correctAnswer, explanation, ...safeQuestion } = q;
                return safeQuestion;
            });
        }

        res.json({
            ...result,
            quizTitle: quiz ? quiz.title : '',
            questions
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error: ' + err.message });
    }
};

exports.getLeaderboard = async (req, res) => {
    try {
        const quiz = await prisma.quiz.findUnique({
            where: { id: req.params.quizId }
        });
        if (!quiz) return res.status(404).json({ msg: 'Quiz not found' });

        const isTeacher = req.user.id === quiz.createdById;
        const isAdmin = req.user.role === 'admin';
        const canSeeFullLeaderboard = isTeacher || isAdmin;

        // Fetch all results for this quiz
        const allResults = await prisma.result.findMany({
            where: { quizId: req.params.quizId },
            include: { student: { select: { username: true, email: true, isOnline: true, isSuspended: true } } }
        });

        if (allResults.length === 0) {
            return res.json({
                results: [],
                stats: {
                    averageScore: 0,
                    highestScore: 0,
                    totalParticipants: 0,
                    userRank: null,
                    userScore: 0
                },
                isFinal: quiz.status === 'finished'
            });
        }

        // Calculate total time and sort: score DESC, totalTime ASC
        const processedResults = allResults.map(r => {
            const startedAt = r.startedAt ? new Date(r.startedAt).getTime() : 0;
            const completedAt = r.completedAt ? new Date(r.completedAt).getTime() : Date.now();
            const totalTime = completedAt - startedAt;
            return {
                ...r,
                totalTime
            };
        }).sort((a, b) => {
            if ((b.score || 0) !== (a.score || 0)) {
                return (b.score || 0) - (a.score || 0);
            }
            return (a.totalTime || 0) - (b.totalTime || 0);
        });

        const totalParticipants = processedResults.length;
        const totalScore = processedResults.reduce((sum, r) => sum + r.score, 0);
        const averageScore = totalScore / totalParticipants;
        const highestScore = processedResults[0].score;

        // Build ranked list with TIES
        const rankedResults = [];
        let currentRank = 1;

        for (let i = 0; i < processedResults.length; i++) {
            const r = processedResults[i];

            if (i > 0) {
                const prev = processedResults[i - 1];
                if (r.score !== prev.score || r.totalTime !== prev.totalTime) {
                    currentRank = i + 1;
                }
            }

            rankedResults.push({
                studentId: r.studentId,
                username: r.student.username,
                isOnline: r.student.isOnline,
                isSuspended: r.student.isSuspended,
                currentScore: r.score,
                totalTimeTaken: r.totalTimeTaken || r.totalTime || 0,
                answeredQuestions: r.answers.length,
                answers: r.answers,
                rank: currentRank
            });
        }

        const studentEntry = rankedResults.find(r => r.studentId === req.user.id);
        const studentRank = studentEntry ? studentEntry.rank : null;
        const studentScore = studentEntry ? studentEntry.currentScore : 0;

        let leaderboardData = [];
        if (canSeeFullLeaderboard) {
            leaderboardData = rankedResults;
        } else if (studentEntry) {
            const { answers, ...cleanEntry } = studentEntry;
            leaderboardData = [cleanEntry];
        }

        res.json({
            results: leaderboardData,
            stats: {
                averageScore,
                highestScore,
                totalParticipants,
                userRank: studentRank,
                userScore: studentScore
            },
            isFinal: quiz.status === 'finished' || !quiz.isActive
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error: ' + err.message });
    }
};

exports.publishQuiz = async (req, res) => {
    try {
        const quiz = await prisma.quiz.findUnique({
            where: { id: req.params.id }
        });

        if (!quiz) {
            return res.status(404).json({ msg: 'Quiz not found' });
        }

        if (quiz.createdById !== req.user.id) {
            return res.status(401).json({ msg: 'User not authorized' });
        }

        const updated = await prisma.quiz.update({
            where: { id: req.params.id },
            data: { isActive: !quiz.isActive }
        });

        // Trigger background automated broadcast if the live quiz is being activated
        if (updated.isActive) {
            await autoBroadcastLiveQuiz(updated, req);
        }

        res.json(updated);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error: ' + err.message });
    }
};

exports.getTeacherStats = async (req, res) => {
    try {
        const quizzes = await prisma.quiz.findMany({
            where: { createdById: req.user.id },
            orderBy: { createdAt: 'desc' }
        });

        const stats = await Promise.all(quizzes.map(async (quiz) => {
            const dbResults = await prisma.result.findMany({
                where: { quizId: quiz.id },
                include: { student: { select: { username: true, email: true } } },
                orderBy: [{ score: 'desc' }, { completedAt: 'asc' }]
            });

            const results = dbResults.map(r => ({
                studentName: r.student?.username || 'Unknown',
                score: r.score,
                totalQuestions: r.totalQuestions,
                completedAt: r.completedAt,
                answers: r.answers
            }));

            const completionCount = results.length;
            const averageScore = completionCount > 0
                ? (results.reduce((sum, r) => sum + r.score, 0) / completionCount)
                : 0;

            return {
                quizId: quiz.id,
                title: quiz.title,
                topic: quiz.topic,
                createdAt: quiz.createdAt,
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
    return exports.submitQuiz(req, res);
};

exports.updateQuiz = async (req, res) => {
    try {
        const { title, description, questions, difficulty, timerPerQuestion, duration, isLive, isActive, isAssessment, startTime, endTime, timerType, accessType } = req.body;

        let quiz = await prisma.quiz.findUnique({
            where: { id: req.params.id }
        });

        if (!quiz) {
            return res.status(404).json({ msg: 'Quiz not found' });
        }

        if (quiz.createdById !== req.user.id) {
            return res.status(401).json({ msg: 'User not authorized' });
        }

        const updateData = {};
        if (title) updateData.title = title;
        if (description) updateData.description = description;
        if (questions) {
            updateData.questions = Array.isArray(questions) ? questions : JSON.parse(questions);
        }
        if (difficulty) updateData.difficulty = difficulty;
        if (timerPerQuestion !== undefined) updateData.timerPerQuestion = parseInt(timerPerQuestion);
        if (duration !== undefined) updateData.duration = parseInt(duration);
        if (isAssessment !== undefined) updateData.isAssessment = isAssessment === 'true' || isAssessment === true;
        if (timerType) updateData.timerType = timerType;
        if (accessType) updateData.accessType = accessType;
        if (startTime !== undefined) updateData.startTime = startTime ? new Date(startTime) : null;
        if (endTime !== undefined) updateData.endTime = endTime ? new Date(endTime) : null;

        if (isActive !== undefined) {
            const requestedActive = isActive === 'true' || isActive === true;
            if (requestedActive && !quiz.isActive) {
                await prisma.quiz.updateMany({
                    where: {
                        createdById: req.user.id,
                        isActive: true,
                        id: { not: quiz.id }
                    },
                    data: {
                        isActive: false,
                        status: 'finished'
                    }
                });
                updateData.isActive = true;
                updateData.status = quiz.isLive ? 'waiting' : 'started';
            } else if (!requestedActive) {
                updateData.isActive = false;
                if (quiz.isLive) updateData.status = 'finished';
            }
        }

        if (isLive !== undefined) {
            updateData.isLive = isLive === 'true' || isLive === true;
            if (quiz.isActive || updateData.isActive) {
                updateData.status = updateData.isLive ? 'waiting' : 'started';
            }
        }

        const updated = await prisma.quiz.update({
            where: { id: req.params.id },
            data: updateData
        });
        res.json(updated);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error: ' + err.message });
    }
};

exports.generateQuizQuestions = async (req, res) => {
    try {
        let { type, questionCount, difficulty, topic } = req.body;
        let finalQuestions = [];
        let extractedTitle = topic || 'AI Generated Quiz';
        let sourceType = type || 'topic';

        // --- AI MODERATION GUARD ---
        if (req.file) {
            const ext = path.extname(req.file.originalname).toLowerCase();
            const isImage = ['.jpg', '.jpeg', '.png'].includes(ext);
            const moderation = await moderateContent(req.user.id, topic || '', isImage ? 'image' : 'text', path.resolve(req.file.path));
            if (!moderation.isSafe) {
                return res.status(403).json({ msg: 'Account suspended due to content violation.', reason: moderation.reason });
            }
        } else if (topic) {
            const moderation = await moderateContent(req.user.id, topic, 'text');
            if (!moderation.isSafe) {
                return res.status(403).json({ msg: 'Account suspended due to content violation.', reason: moderation.reason });
            }
        }

        if (req.file) {
            const absolutePath = path.resolve(req.file.path);
            const extractedText = await extractText(absolutePath);
            if (extractedText) {
                finalQuestions = await generateQuestions('topic', extractedText, questionCount, difficulty);
            } else {
                finalQuestions = await generateQuestions(sourceType, absolutePath, questionCount, difficulty);
            }
            extractedTitle = req.file.originalname.replace(/\.[^/.]+$/, "");
        } else if (topic) {
            finalQuestions = await generateQuestions('topic', topic, questionCount, difficulty);
        }

        res.json({
            questions: finalQuestions,
            title: extractedTitle,
            duration: 10
        });

    } catch (err) {
        console.error('❌ Generation Controller Error:', err.message);
        res.status(500).json({ msg: 'Generation Error: ' + err.message });
    }
};

exports.getStudentHistory = async (req, res) => {
    try {
        const finishedQuizzes = await prisma.quiz.findMany({
            where: {
                OR: [
                    { status: 'finished' },
                    { isActive: false }
                ]
            },
            orderBy: { createdAt: 'desc' }
        });

        const history = await Promise.all(finishedQuizzes.map(async (quiz) => {
            const result = await prisma.result.findFirst({
                where: { quizId: quiz.id, studentId: req.user.id }
            });

            const teacher = await prisma.user.findUnique({
                where: { id: quiz.createdById },
                select: { username: true }
            });

            // Calculate Rank
            let rank = null;
            if (result) {
                const allResults = await prisma.result.findMany({
                    where: { quizId: quiz.id },
                    orderBy: [
                        { score: 'desc' },
                        { completedAt: 'asc' }
                    ]
                });
                const studentIndex = allResults.findIndex(r => r.studentId === req.user.id);
                rank = studentIndex !== -1 ? studentIndex + 1 : null;
            }

            return {
                id: quiz.id,
                title: quiz.title,
                topic: quiz.topic,
                subject: quiz.topic || 'General',
                conductedBy: teacher ? teacher.username : 'Unknown',
                description: quiz.description,
                date: result ? result.completedAt : quiz.createdAt,
                startedAt: result ? result.startedAt : null,
                completedAt: result ? result.completedAt : null,
                score: result ? result.score : 0,
                totalQuestions: quiz.questions.length,
                status: result ? 'Completed' : 'Missed',
                isAttempted: !!result,
                rank: rank
            };
        }));

        res.json(history);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error: ' + err.message });
    }
};

exports.getLiveQuizzes = async (req, res) => {
    try {
        // Fetch currently active quizzes AND finished live quizzes (for async practice)
        const quizzes = await prisma.quiz.findMany({
            where: {
                OR: [
                    { isActive: true },
                    // Finished live quizzes are surfaced in the Assessments tab for async practice
                    { isLive: true, status: 'finished' }
                ]
            },
            orderBy: { createdAt: 'desc' }
        });

        const now = new Date();

        const quizzesWithAttempts = await Promise.all(quizzes.map(async (quiz) => {
            // Get the student's LATEST result for this quiz (for resultId link)
            const result = await prisma.result.findFirst({
                where: { quizId: quiz.id, studentId: req.user.id },
                orderBy: [{ completedAt: 'desc' }, { lastAnsweredAt: 'desc' }]
            });

            // Determine timing status for assessments
            let isLocked = false;
            let isExpired = false;

            if (quiz.isAssessment) {
                if (quiz.startTime && new Date(quiz.startTime) > now) {
                    isLocked = true;
                }
                if (quiz.endTime && new Date(quiz.endTime) < now) {
                    isExpired = true;
                }
            }

            // Cleanly calculate total questions
            let totalQ = 0;
            if (Array.isArray(quiz.questions)) {
                totalQ = quiz.questions.length;
            } else if (quiz.questions && typeof quiz.questions === 'object') {
                try {
                    const parsed = typeof quiz.questions === 'string' ? JSON.parse(quiz.questions) : quiz.questions;
                    totalQ = Array.isArray(parsed) ? parsed.length : (parsed.questions ? parsed.questions.length : 0);
                } catch (_) {}
            }

            // Strip raw questions column for security against sniffing
            const { questions, ...quizData } = quiz;

            // wasLiveCompleted: true when this quiz was a live session that has now finished.
            // The Assessments tab uses this flag to show START (async practice) + RESULT buttons.
            const wasLiveCompleted = quiz.isLive && quiz.status === 'finished';

            return {
                ...quizData,
                isAttempted: !!result,
                score: result ? result.score : 0,
                totalQuestions: totalQ,
                isLocked,
                isExpired,
                wasLiveCompleted,
                resultId: result ? result.id : null
            };
        }));

        res.json(quizzesWithAttempts);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error: ' + err.message });
    }
};

exports.generateQuizFromVoice = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ msg: 'No audio file uploaded' });
        }

        const { questionCount, difficulty } = req.body;
        const absolutePath = path.resolve(req.file.path);
        
        // 1. Transcribe
        const transcript = await transcribeAudio(absolutePath);
        
        if (!transcript || transcript.trim().length < 20) {
            try { fs.unlinkSync(absolutePath); } catch(e) {}
            return res.status(400).json({ msg: 'Could not capture clear speech. Please try speaking closer to the mic.' });
        }

        // --- AI MODERATION GUARD ---
        const moderation = await moderateContent(req.user.id, transcript, 'text');
        if (!moderation.isSafe) {
            try { fs.unlinkSync(absolutePath); } catch(e) {}
            return res.status(403).json({ msg: 'Account suspended due to content violation.', reason: moderation.reason });
        }

        console.log(`✅ Transcript length: ${transcript.length} chars`);

        // 2. Filter & Generate
        const finalQuestions = await generateQuestions('topic', transcript, questionCount || 5, difficulty || 'Medium');

        // 3. Cleanup
        try { fs.unlinkSync(absolutePath); } catch(e) {}

        res.json({
            questions: finalQuestions,
            title: `Voice Quiz: ${new Date().toLocaleTimeString()}`,
            transcript: transcript,
            duration: 10
        });
    } catch (err) {
        console.error('❌ Voice Generation Error:', err.message);
        if (req.file) {
            try { fs.unlinkSync(path.resolve(req.file.path)); } catch(e) {}
        }
        res.status(500).json({ msg: 'Voice Generation Error: ' + err.message });
    }
};

exports.assignQuiz = async (req, res) => {
    try {
        const { id } = req.params;
        const { assignedGroups, assignedStudents } = req.body;

        const quiz = await prisma.quiz.findUnique({
            where: { id }
        });

        if (!quiz) {
            return res.status(404).json({ msg: 'Quiz not found' });
        }

        const updatedQuiz = await prisma.quiz.update({
            where: { id },
            data: {
                assignedGroups: assignedGroups || null,
                assignedStudents: assignedStudents || []
            }
        });

        // Trigger background automated broadcast if the live quiz is active
        await autoBroadcastLiveQuiz(updatedQuiz, req);

        res.json({
            msg: 'Quiz assigned successfully!',
            quiz: updatedQuiz
        });
    } catch (err) {
        console.error('Error assigning quiz:', err);
        res.status(500).json({ msg: 'Server error assigning quiz: ' + err.message });
    }
};

exports.getScheduleStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const quiz = await prisma.quiz.findUnique({ where: { id } });
        if (!quiz) return res.status(404).json({ msg: 'Quiz not found' });
        
        // Ensure only creator or admin can view status
        if (quiz.createdById !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ msg: 'Unauthorized' });
        }

        const broadcastsCount = await prisma.broadcast.count({ where: { quizId: id } });
        const attemptsCount = await prisma.result.count({ where: { quizId: id } });

        const isLocked = broadcastsCount > 0 || attemptsCount > 0 || quiz.isLive;

        // Sync with DB if needed
        if (quiz.broadcastStatus !== (broadcastsCount > 0) || quiz.attemptCount !== attemptsCount || quiz.scheduleLocked !== isLocked) {
            await prisma.quiz.update({
                where: { id },
                data: {
                    broadcastStatus: broadcastsCount > 0,
                    attemptCount: attemptsCount,
                    scheduleLocked: isLocked
                }
            });
        }

        res.json({
            isLocked,
            broadcastsCount,
            attemptsCount,
            isLive: quiz.isLive,
            status: quiz.status,
            startTime: quiz.startTime,
            endTime: quiz.endTime
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server Error' });
    }
};

exports.updateSchedule = async (req, res) => {
    try {
        const { id } = req.params;
        const { startTime, endTime } = req.body;
        
        const quiz = await prisma.quiz.findUnique({ where: { id } });
        if (!quiz) return res.status(404).json({ msg: 'Quiz not found' });
        
        if (quiz.createdById !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ msg: 'Unauthorized' });
        }

        // Validate time
        if (startTime && endTime && new Date(endTime) <= new Date(startTime)) {
            return res.status(400).json({ msg: 'End time must be after start time' });
        }

        const broadcastsCount = await prisma.broadcast.count({ where: { quizId: id } });
        const attemptsCount = await prisma.result.count({ where: { quizId: id } });
        const isLocked = broadcastsCount > 0 || attemptsCount > 0 || quiz.isLive;

        if (isLocked) {
            // Optional: allow end-time extension ONLY if it's strictly > current endTime? 
            // The prompt says "OR optionally: allow only: end-time extension but NOT: start-time modification". 
            // Let's implement full lock for safety to strictly follow "If ANY student interaction exists: Disable schedule editing"
            return res.status(403).json({ msg: 'Schedule can no longer be edited because students have already joined or interacted with this quiz.' });
        }

        const updated = await prisma.quiz.update({
            where: { id },
            data: {
                startTime: startTime ? new Date(startTime) : null,
                endTime: endTime ? new Date(endTime) : null,
                lastScheduleEditAt: new Date(),
                lastEditedBy: req.user.id
            }
        });

        res.json({ msg: 'Schedule updated successfully', quiz: updated });
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server Error' });
    }
};
