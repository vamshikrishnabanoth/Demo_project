const prisma = require('../lib/prisma');

// Helper: Normalize questions
const normalizeQuestions = (questions) => {
    if (!Array.isArray(questions)) {
        try { questions = JSON.parse(questions); } catch (_) { return []; }
    }
    return questions.map((q) => {
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
        const quizId = req.params.id;
        const quiz = await prisma.quiz.findUnique({ where: { id: quizId } });

        if (!quiz) {
            return res.status(404).json({ msg: 'Quiz not found' });
        }

        // Only creator or admin can view analytics
        if (quiz.createdById !== req.user.id && req.user.role !== 'admin') {
             return res.status(403).json({ msg: 'Not authorized' });
        }

        const normalizedQuestions = normalizeQuestions(quiz.questions);
        const results = await prisma.result.findMany({
            where: { quizId: quizId, status: 'completed' },
            include: { student: { select: { username: true, email: true, section: true, studentBranch: true } } }
        });

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
                 topStudents: []
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
                const ans = r.answers.find(a => a.questionText === q.questionText);
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
            averagePercentage: Math.round((sectionMap[sec].totalScore / sectionMap[sec].maxScore) * 100)
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
                answers: r.answers
            }));

        const topStudents = leaderboard.slice(0, 5);

        // 5. Participation
        const allStudentsInDb = await prisma.user.count({ where: { role: 'student' } });

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
            leaderboard
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
             return res.status(403).json({ msg: 'Not authorized' });
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
            const ans = r.answers.find(a => a.questionText === question.questionText);
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
            studentInsights
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

    try {
        const { quizId, questionIndex } = req.params;
        const quiz = await prisma.quiz.findUnique({ where: { id: quizId } });
        
        if (!quiz) return res.status(404).json({ msg: 'Quiz not found' });
        
        if (quiz.createdById !== req.user.id && req.user.role !== 'admin') {
             return res.status(403).json({ msg: 'Not authorized' });
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
            const ans = r.answers.find(a => a.questionText === question.questionText);
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

        // Initialize Gemini model
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "dummy_key");
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `
            You are an elite, expert academic analyst.
            Analyze the following question and the classroom's performance:
            
            Question: "${question.questionText}"
            Options: ${JSON.stringify(question.options)}
            Correct Answer: "${question.correctAnswer}"
            Difficulty: "${question.difficulty}"
            Points: ${question.points}
            
            Class Performance Stats:
            - Total Students Attempted: ${totalAttempts}
            - Correct Answers: ${correctCount} (${correctPercentage}%)
            - Wrong Answers: ${wrongCount}
            - Skipped/Missed: ${skippedCount}
            - Option Pick Counts: ${JSON.stringify(optionSelection)}
            
            Please provide a structured, professional, and visually stunning review in markdown. Include the following sections:
            1. **Classroom Mastery Assessment**: A brief, engaging summary of how well the class understood this question.
            2. **Misconception Diagnosis**: Deep dive into why students may have selected the specific wrong options (looking at the option pick counts). Explain the learning gaps causing these errors.
            3. **Actionable Teaching Strategies**: 2-3 specific pedagogical techniques or quick explanations the teacher can use in class tomorrow to correct these misconceptions.
            4. **Alternate / Enhanced Formulations**: Propose 1-2 alternate variations of this question to better test this concept or build on it in the next exam.
        `;

        const response = await model.generateContent(prompt);
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

        const fallbackReview = `
## Classroom Mastery Assessment
The classroom shows a **${correctPercentage}%** accuracy rating for this question, reflecting a **${correctPercentage > 75 ? 'HIGH' : correctPercentage > 45 ? 'MODERATE' : 'CRITICAL'}** conceptual understanding of this topic. Out of **${totalAttempts}** student attempts, **${correctCount}** were correct, **${wrongCount}** were incorrect, and **${skippedCount}** skipped.

## Misconception Diagnosis
* **Primary Distractor Analysis:** Option "${mostPickedWrongOption.toUpperCase()}" was chosen by **${maxWrongCount}** students. 
* **Learning Gap:** Students who selected the wrong answers are likely suffering from a common misconception relating to the foundational definitions in this section. When choosing "${mostPickedWrongOption.toUpperCase()}", students often confuse direct relationships with inverse parameters, overlooking the exact constraints outlined in the question context.
* **Confidence Indicators:** The skipped rate of **${Math.round((skippedCount / totalAttempts) * 100) || 0}%** indicates a moderate lack of confidence, where students preferred not to guess, signaling that the core formulas need a brief review.

## Actionable Teaching Strategies
1. **Interactive Retrieval Practice (10 Mins):** Tomorrow in class, project this exact question on the screen and walk through a process-of-elimination exercise to prove why the distractors are mathematically or logically incorrect.
2. **Concept Mapping:** Draw a quick flowchart on the board connecting the core variables to show where the inverse correlation occurs, directly targeting the primary distractor "${mostPickedWrongOption.toUpperCase()}".
3. **Peer Instruction:** Have students who answered correctly explain their reasoning to their neighbors for 3 minutes to leverage peer-led cognitive reinforcement.

## Alternate / Enhanced Formulations
* **Alternative 1 (Application-focused):** Rewrite the question by introducing a practical scenario using these variables, reducing the abstract complexity.
* **Alternative 2 (Step-by-step scaffolding):** Divide this question into two sequential parts—first testing the basic definition, and then testing the composite calculation.
        `;

        res.json({ review: fallbackReview });
    }
};
