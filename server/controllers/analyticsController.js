const prisma = require('../lib/prisma');

// Helper: Safe answers parsing
const getAnswersArray = (answers) => {
    if (Array.isArray(answers)) return answers;
    if (typeof answers === 'string') {
        try {
            const parsed = JSON.parse(answers);
            if (Array.isArray(parsed)) return parsed;
        } catch (_) {}
    }
    return [];
};

// Helper: Normalize questions
const normalizeQuestions = (questions) => {
    if (!questions) return [];
    if (!Array.isArray(questions)) {
        try { questions = JSON.parse(questions); } catch (_) { return []; }
    }
    if (!Array.isArray(questions)) return [];
    return questions.filter(Boolean).map((q) => {
        let options = q.options;
        if (!Array.isArray(options)) {
            if (options && typeof options === 'object') {
                options = Object.values(options).map(String);
            } else {
                options = ['Option A', 'Option B', 'Option C', 'Option D'];
            }
        } else {
            options = options.map((o) => typeof o === 'string' ? o : (o?.text || o?.label || String(o)));
        }
        return {
            ...q,
            questionText: q.questionText || q.question || '',
            options,
            correctAnswer: q.correctAnswer || q.correct_answer || '',
            points: q.points || 10,
            difficulty: q.difficulty || 'Medium'
        };
    });
};

exports.getQuizAnalytics = async (req, res) => {
    try {
        const paramId = req.params.id;
        let quiz = await prisma.quiz.findUnique({ where: { id: paramId } });
        if (!quiz) {
            quiz = await prisma.quiz.findUnique({ where: { joinCode: paramId } });
        }

        if (!quiz) {
            return res.status(404).json({ msg: 'Quiz not found' });
        }

        const quizId = quiz.id;

        // Authorization check: creator, admin, or student who has attempted/participated in the quiz
        if (quiz.createdById !== req.user.id && req.user.role !== 'admin') {
            if (req.user.role === 'student') {
                const hasAttempted = await prisma.result.findFirst({
                    where: { quizId: quizId, studentId: req.user.id }
                });
                const isPublicQuiz = quiz.isPublic || quiz.accessType === 'public';
                if (!hasAttempted && !isPublicQuiz) {
                    return res.status(403).json({ msg: 'Not authorized to view analytics for this quiz' });
                }
            } else {
                return res.status(403).json({ msg: 'Not authorized' });
            }
        }

        // Query with 4-second hard timeout for graceful degradation
        const fetchAnalyticsData = async () => {
            const normalizedQuestions = normalizeQuestions(quiz.questions);
            const results = await prisma.result.findMany({
                where: { quizId: quizId, status: 'completed' },
                include: { student: { select: { username: true, email: true, section: true, studentBranch: true } } }
            });
            return { normalizedQuestions, results };
        };

        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('ANALYTICS_TIMEOUT')), 4000)
        );

        let normalizedQuestions, results;
        try {
            const data = await Promise.race([fetchAnalyticsData(), timeoutPromise]);
            normalizedQuestions = data.normalizedQuestions;
            results = data.results;
        } catch (timeoutErr) {
            console.warn(`[ANALYTICS_DEGRADATION] Quiz ${quizId} analytics query timed out/failed. Serving fallback payload.`);
            return res.json({
                degraded: true,
                quizTitle: quiz.title || 'Live Quiz',
                topic: quiz.topic || '',
                totalQuestions: Array.isArray(quiz.questions) ? quiz.questions.length : 0,
                totalParticipants: 0,
                averageScore: 0,
                highestScore: 0,
                scoreDistribution: { '0-20': 0, '21-40': 0, '41-60': 0, '61-80': 0, '81-100': 0 },
                questionPerformance: [],
                sectionPerformance: [],
                participationRate: { attempted: 0, totalEligible: 0 },
                leaderboard: []
            });
        }

        const totalParticipants = results.length;
        if (totalParticipants === 0) {
             return res.json({
                 quizTitle: quiz.title,
                 topic: quiz.topic,
                 totalQuestions: normalizedQuestions.length,
                 totalParticipants: 0,
                 averageScore: 0,
                 highestScore: 0,
                 scoreDistribution: [],
                 questionPerformance: [],
                 sectionPerformance: [],
                 participationRate: { attempted: 0, totalEligible: 0 },
                 topStudents: [],
                 leaderboard: [],
                 cheatingLogs: []
             });
        }

        // 1. Score Distribution
        const scoreDistribution = {
            '0-20': 0, '21-40': 0, '41-60': 0, '61-80': 0, '81-100': 0
        };
        
        let totalScore = 0;
        let highestScore = 0;
        
        const maxScore = normalizedQuestions.reduce((acc, q) => acc + (q.points || 10), 0) || 100;

        results.forEach(r => {
            const percentage = Math.round((r.score / maxScore) * 100) || 0;
            
            totalScore += r.score;
            if (r.score > highestScore) highestScore = r.score;

            if (percentage <= 20) scoreDistribution['0-20']++;
            else if (percentage <= 40) scoreDistribution['21-40']++;
            else if (percentage <= 60) scoreDistribution['41-60']++;
            else if (percentage <= 80) scoreDistribution['61-80']++;
            else scoreDistribution['81-100']++;
        });

        // 2. Question Performance
        const questionPerformance = normalizedQuestions.map((q, idx) => {
            let correct = 0;
            let wrong = 0;
            let skipped = 0;
            let totalTimeSpent = 0;
            let answeredCount = 0;
            const optionSelection = {};
            q.options.forEach(opt => optionSelection[opt.toLowerCase()] = 0);

            results.forEach(r => {
                const answersArray = getAnswersArray(r.answers);
                const ans = answersArray.find(a => a && (
                    (a.questionIndex !== undefined && Number(a.questionIndex) === idx) ||
                    (a.questionText && q.questionText && a.questionText.toString().trim().toLowerCase() === q.questionText.toString().trim().toLowerCase())
                ));
                if (!ans || !ans.selectedOption || ans.selectedOption === '') {
                    skipped++;
                } else {
                    if (ans.isCorrect) correct++;
                    else wrong++;
                    
                    const selOpt = (ans.selectedOption || '').toLowerCase();
                    if (optionSelection[selOpt] !== undefined) {
                        optionSelection[selOpt]++;
                    } else {
                        // find closest match or just add
                        optionSelection[selOpt] = 1;
                    }
                    totalTimeSpent += (ans.timeTaken || 0);
                    answeredCount++;
                }
            });

            return {
                questionIndex: idx,
                questionText: q.questionText,
                difficulty: q.difficulty,
                correct,
                wrong,
                skipped,
                accuracy: totalParticipants > 0 ? Math.round((correct / totalParticipants) * 100) : 0,
                avgTimeSpent: answeredCount > 0 ? Math.round(totalTimeSpent / answeredCount) : 0,
                optionSelection
            };
        });

        // 3. Section/Topic Performance (if applicable, using student branch/section)
        const sectionMap = {};
        results.forEach(r => {
            const section = r.student?.section || r.student?.studentBranch || 'General';
            if (!sectionMap[section]) sectionMap[section] = { totalScore: 0, count: 0, maxScore: 0 };
            sectionMap[section].totalScore += r.score;
            sectionMap[section].count++;
            sectionMap[section].maxScore += maxScore;
        });

        const sectionPerformance = Object.keys(sectionMap).map(sec => ({
            section: sec,
            averagePercentage: Math.round((sectionMap[sec].totalScore / sectionMap[sec].maxScore) * 100),
            averageScore: Math.round((sectionMap[sec].totalScore / sectionMap[sec].count) * 10) / 10
        }));

        // 4. Leaderboard (All students)
        const leaderboard = [...results]
            .sort((a, b) => b.score - a.score || a.totalTimeTaken - b.totalTimeTaken)
            .map((r, idx) => ({
                id: r.studentId,
                email: r.student?.email || 'N/A',
                rank: idx + 1,
                username: r.student?.username || 'Unknown',
                score: r.score,
                timeTaken: r.totalTimeTaken,
                accuracy: Math.round((r.score / maxScore) * 100),
                answers: getAnswersArray(r.answers)
            }));

        const topStudents = leaderboard.slice(0, 5);

        const studentRank = req.user?.role === 'student'
            ? (leaderboard.find(student => student.id === req.user.id)?.rank || null)
            : null;

        const allStudentsInDb = await prisma.user.count({ where: { role: 'student' } });

        let formattedCheatingLogs = [];
        try {
            const cheatingLogs = await prisma.cheatingLog.findMany({
                where: { quizId: quizId },
                include: {
                    student: {
                        select: { username: true, name: true, email: true, section: true, studentBranch: true }
                    }
                },
                orderBy: { timestamp: 'desc' }
            });

            // Group by Roll Number / Student ID on the Backend
            const studentMap = new Map();

            for (const log of cheatingLogs) {
                const rollNumber = log.student?.username || log.studentRollNumber || log.studentId || 'UNKNOWN';
                const studentName = log.student?.name || log.studentName || rollNumber;
                const department = log.student?.studentBranch || 'General';
                const section = log.student?.section || 'A';

                if (!studentMap.has(rollNumber)) {
                    studentMap.set(rollNumber, {
                        studentId: log.studentId,
                        studentName,
                        rollNumber,
                        quizName: quiz.title,
                        department,
                        section,
                        totalViolations: 0,
                        lastIncident: log.timestamp,
                        eventCounts: {
                            WINDOW_BLUR: 0,
                            TAB_SWITCH: 0,
                            FULLSCREEN_EXIT: 0,
                            SPLIT_SCREEN: 0,
                            COPY: 0,
                            PASTE: 0,
                            RIGHT_CLICK: 0,
                            DEVTOOLS: 0,
                            OTHER: 0
                        },
                        timeline: []
                    });
                }

                const record = studentMap.get(rollNumber);
                record.totalViolations += 1;

                // Normalize Action Type
                let actionType = 'OTHER';
                const rawAction = (log.action || '').toLowerCase();
                if (rawAction.includes('blur') || rawAction.includes('focus')) actionType = 'WINDOW_BLUR';
                else if (rawAction.includes('tab')) actionType = 'TAB_SWITCH';
                else if (rawAction.includes('fullscreen')) actionType = 'FULLSCREEN_EXIT';
                else if (rawAction.includes('split')) actionType = 'SPLIT_SCREEN';
                else if (rawAction.includes('copy')) actionType = 'COPY';
                else if (rawAction.includes('paste')) actionType = 'PASTE';
                else if (rawAction.includes('context') || rawAction.includes('click') || rawAction.includes('inspect')) actionType = 'RIGHT_CLICK';
                else if (rawAction.includes('devtools')) actionType = 'DEVTOOLS';

                if (record.eventCounts.hasOwnProperty(actionType)) {
                    record.eventCounts[actionType] += 1;
                } else {
                    record.eventCounts.OTHER += 1;
                }

                // Add to Timeline (Newest first because cheatingLogs is ordered desc)
                record.timeline.push({
                    id: log.id,
                    type: actionType,
                    rawAction: log.action,
                    time: new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                    fullTimestamp: log.timestamp,
                    details: log.details
                });
            }

            // Calculate Risk Levels and Scores
            formattedCheatingLogs = Array.from(studentMap.values()).map(student => {
                const total = student.totalViolations;
                let riskLevel = 'LOW';
                if (total > 30) riskLevel = 'CRITICAL';
                else if (total >= 16) riskLevel = 'HIGH';
                else if (total >= 6) riskLevel = 'MEDIUM';

                // Risk score out of 100%
                const riskScore = Math.min(100, Math.round((total / 35) * 100));

                return {
                    ...student,
                    riskLevel,
                    riskScore
                };
            });
        } catch (cheatingErr) {
            console.error('Error fetching cheating logs, falling back to empty list:', cheatingErr);
        }

        let studentAttempt = null;
        if (req.user && req.user.id) {
            const studentResult = results.find(r => r.studentId === req.user.id);
            if (studentResult) {
                studentAttempt = {
                    id: studentResult.id,
                    score: studentResult.score,
                    totalTimeTaken: studentResult.totalTimeTaken,
                    answers: getAnswersArray(studentResult.answers)
                };
            }
        }

        res.json({
            quizTitle: quiz.title,
            topic: quiz.topic,
            totalQuestions: normalizedQuestions.length,
            totalParticipants,
            averageScore: Math.round(totalScore / totalParticipants),
            highestScore,
            scoreDistribution: Object.entries(scoreDistribution).map(([range, count]) => ({ range, count })),
            questionPerformance,
            sectionPerformance,
            participationRate: { attempted: totalParticipants, totalEligible: allStudentsInDb },
            topStudents,
            leaderboard,
            cheatingLogs: formattedCheatingLogs,
            studentAttempt,
            studentRank
        });

    } catch (err) {
        console.error('Error fetching quiz analytics:', err);
        res.status(500).json({ msg: 'Server Error', error: err.message });
    }
};

exports.getTeacherAdvancedAnalytics = async (req, res) => {
    // Advanced metrics across all quizzes
    res.json({ msg: 'Not implemented yet' });
};

exports.getQuestionAnalysis = async (req, res) => {
    try {
        const { quizId, questionIndex } = req.params;
        const quiz = await prisma.quiz.findUnique({ where: { id: quizId } });
        
        if (!quiz) return res.status(404).json({ msg: 'Quiz not found' });
        
        if (quiz.createdById !== req.user.id && req.user.role !== 'admin') {
            if (req.user.role === 'student') {
                const hasAttempted = await prisma.result.findFirst({
                    where: { quizId: quizId, studentId: req.user.id }
                });
                const isPublicQuiz = quiz.isPublic || quiz.accessType === 'public';
                if (!hasAttempted && !isPublicQuiz) {
                    return res.status(403).json({ msg: 'Not authorized to view question analysis' });
                }
            } else {
                return res.status(403).json({ msg: 'Not authorized' });
            }
        }

        const normalizedQuestions = normalizeQuestions(quiz.questions);
        const qIndex = parseInt(questionIndex);
        
        if (qIndex < 0 || qIndex >= normalizedQuestions.length) {
            return res.status(404).json({ msg: 'Question not found' });
        }

        const question = normalizedQuestions[qIndex];
        
        const results = await prisma.result.findMany({
            where: { quizId: quizId, status: 'completed' },
            include: { student: { select: { username: true } } }
        });

        let correctCount = 0;
        let wrongCount = 0;
        let skippedCount = 0;
        let totalTimeSpent = 0;
        
        const optionSelection = {};
        question.options.forEach(opt => optionSelection[opt.toLowerCase()] = 0);
        
        const studentInsights = { correct: [], wrong: [], skipped: [] };

        results.forEach(r => {
            const answersArray = getAnswersArray(r.answers);
            const ans = answersArray.find(a => a && a.questionText === question.questionText);
            const studentName = r.student?.username || 'Unknown';
            if (!ans || !ans.selectedOption || ans.selectedOption === '') {
                skippedCount++;
                studentInsights.skipped.push(studentName);
            } else {
                if (ans.isCorrect) {
                    correctCount++;
                    studentInsights.correct.push(studentName);
                } else {
                    wrongCount++;
                    studentInsights.wrong.push(studentName);
                }
                
                const selOpt = (ans.selectedOption || '').toLowerCase();
                if (optionSelection[selOpt] !== undefined) {
                    optionSelection[selOpt]++;
                } else {
                    optionSelection[selOpt] = 1;
                }
                totalTimeSpent += (ans.timeTaken || 0);
            }
        });

        const totalAttempts = correctCount + wrongCount + skippedCount;
        const answeredCount = correctCount + wrongCount;

        let userAnswer = null;
        if (req.user) {
            const userResult = await prisma.result.findFirst({
                where: { quizId: quizId, studentId: req.user.id }
            });
            if (userResult) {
                const answersArray = getAnswersArray(userResult.answers);
                const ans = answersArray.find(a => a && (a.questionText === question.questionText || a.questionIndex === qIndex));
                if (ans) {
                    const hasTimeTaken = Object.prototype.hasOwnProperty.call(ans, 'timeTaken') && Number.isFinite(Number(ans.timeTaken));
                    userAnswer = {
                        selectedOption: ans.selectedOption || null,
                        isCorrect: ans.isCorrect || false,
                        timeTaken: hasTimeTaken ? Number(ans.timeTaken) : null
                    };
                }
            }
        }

        res.json({
            question,
            analytics: {
                totalAttempts,
                correctCount,
                wrongCount,
                skippedCount,
                correctPercentage: totalAttempts > 0 ? Math.round((correctCount / totalAttempts) * 100) : 0,
                wrongPercentage: totalAttempts > 0 ? Math.round((wrongCount / totalAttempts) * 100) : 0,
                skippedPercentage: totalAttempts > 0 ? Math.round((skippedCount / totalAttempts) * 100) : 0,
                avgTimeSpent: answeredCount > 0 ? Math.round(totalTimeSpent / answeredCount) : 0,
                optionSelection: Object.entries(optionSelection).map(([opt, count]) => ({ option: opt, count }))
            },
            studentInsights,
            userAnswer
        });

    } catch (err) {
        console.error('Error fetching question analysis:', err);
        res.status(500).json({ msg: 'Server Error', error: err.message });
    }
};

const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.getQuestionAIReview = async (req, res) => {
    let correctCount = 0;
    let wrongCount = 0;
    let skippedCount = 0;
    let optionSelection = {};
    let question = { questionText: 'Unknown', correctAnswer: '', options: [] };
    let fallbackReview = '';

    try {
        const { quizId, questionIndex } = req.params;
        const followUp = typeof req.query.followUp === 'string' ? req.query.followUp.trim() : '';
        const quiz = await prisma.quiz.findUnique({ where: { id: quizId } });
        
        if (!quiz) return res.status(404).json({ msg: 'Quiz not found' });
        
        if (quiz.createdById !== req.user.id && req.user.role !== 'admin') {
            if (req.user.role === 'student') {
                const hasAttempted = await prisma.result.findFirst({
                    where: { quizId: quizId, studentId: req.user.id }
                });
                const isPublicQuiz = quiz.isPublic || quiz.accessType === 'public';
                if (!hasAttempted && !isPublicQuiz) {
                    return res.status(403).json({ msg: 'Not authorized to view question review' });
                }
            } else {
                return res.status(403).json({ msg: 'Not authorized' });
            }
        }

        const normalizedQuestions = normalizeQuestions(quiz.questions);
        const qIndex = parseInt(questionIndex);
        
        if (qIndex < 0 || qIndex >= normalizedQuestions.length) {
            return res.status(404).json({ msg: 'Question not found' });
        }

        question = normalizedQuestions[qIndex];
        
        const results = await prisma.result.findMany({
            where: { quizId: quizId, status: 'completed' },
            include: { student: { select: { username: true } } }
        });

        question.options.forEach(opt => optionSelection[opt.toLowerCase()] = 0);

        results.forEach(r => {
            const answersArray = getAnswersArray(r.answers);
            const ans = answersArray.find(a => a && a.questionText === question.questionText);
            if (!ans || !ans.selectedOption || ans.selectedOption === '') {
                skippedCount++;
            } else {
                if (ans.isCorrect) {
                    correctCount++;
                } else {
                    wrongCount++;
                }
                const selOpt = (ans.selectedOption || '').toLowerCase();
                if (optionSelection[selOpt] !== undefined) {
                    optionSelection[selOpt]++;
                } else {
                    optionSelection[selOpt] = 1;
                }
            }
        });

        const totalAttempts = correctCount + wrongCount + skippedCount;
        const correctPercentage = totalAttempts > 0 ? Math.round((correctCount / totalAttempts) * 100) : 0;

        fallbackReview = `The correct answer is "${question.correctAnswer}". It is correct because it directly matches the relationship or definition described in the question.`;

        // Do not send requests with a placeholder key. Return a useful grounded answer immediately.
        if (!process.env.GEMINI_API_KEY?.trim()) {
            return res.json({ review: fallbackReview, source: 'grounded-fallback' });
        }

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY.trim());
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `
            You are a precise question-answering tutor. Answer only the question below.
            Use only the question, its options, and the verified correct answer provided here.
            Do not produce a classroom report, mastery statistics, misconception diagnosis,
            teaching strategies, alternate questions, headings, or unrelated details.
            State the correct answer and explain briefly why it is correct. Never change the
            verified answer or invent information not supported by the question.

            Question: ${question.questionText}
            Options: ${JSON.stringify(question.options)}
            Verified correct answer: ${question.correctAnswer}
            ${followUp ? `Student follow-up question: ${followUp}` : 'Student request: Explain the correct answer.'}

            Return a concise answer in 2-5 sentences. If the follow-up asks about something
            unrelated to this question, say that you can only help with this question.
        `;

        const aiTimeout = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('AI_REVIEW_TIMEOUT')), 20000);
        });
        const response = await Promise.race([model.generateContent(prompt), aiTimeout]);
        const review = response.response.text();

        res.json({ review });
    } catch (err) {
        console.error('Error generating AI review, using premium local fallback:', err);
        
        const totalAttempts = correctCount + wrongCount + skippedCount;
        const correctPercentage = totalAttempts > 0 ? Math.round((correctCount / totalAttempts) * 100) : 0;
        
        let mostPickedWrongOption = 'None';
        let maxWrongCount = 0;
        Object.entries(optionSelection).forEach(([opt, count]) => {
            if (opt.toLowerCase() !== question.correctAnswer.toLowerCase() && count > maxWrongCount) {
                maxWrongCount = count;
                mostPickedWrongOption = opt;
            }
        });

        res.json({ review: fallbackReview });
    }
};
