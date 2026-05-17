const prisma = require('../lib/prisma');

// Levenshtein Distance for Typo Tolerance / Fuzzy Matching
function getLevenshteinDistance(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    matrix[i][j - 1] + 1,     // insertion
                    matrix[i - 1][j] + 1      // deletion
                );
            }
        }
    }
    return matrix[b.length][a.length];
}

// Typo-tolerant, fuzzy relevance ranking score
function calculateRelevanceScore(query, target) {
    if (!target) return 0;
    query = query.toLowerCase().trim();
    target = target.toLowerCase().trim();
    
    // 1. Perfect exact match
    if (target === query) return 1.0;
    
    // 2. Starts with (High weight prefix matching)
    if (target.startsWith(query)) return 0.85;
    
    // 3. Contains (Substring matching)
    if (target.includes(query)) return 0.70;
    
    // 4. Fuzzy Matching via Levenshtein Distance (Typo Tolerance)
    // Allow 1 typo for short queries, 2 typos for medium, 3 for long queries
    const distance = getLevenshteinDistance(query, target);
    const maxAllowedTypos = query.length > 8 ? 3 : query.length > 5 ? 2 : 1;
    if (distance <= maxAllowedTypos && query.length > 2) {
        return 0.50 - (distance * 0.10); // Proximity-scaled score
    }
    
    // 5. Tokenized matching (e.g. "data structures" matches "Structures Data")
    const queryTokens = query.split(/\s+/);
    const targetTokens = target.split(/\s+/);
    let matchedTokensCount = 0;
    
    queryTokens.forEach(qToken => {
        if (targetTokens.some(tToken => tToken.includes(qToken) || getLevenshteinDistance(qToken, tToken) <= 1)) {
            matchedTokensCount++;
        }
    });
    
    if (matchedTokensCount > 0) {
        return 0.40 * (matchedTokensCount / queryTokens.length);
    }
    
    return 0;
}

exports.globalSearch = async (req, res) => {
    try {
        const query = req.query.q || '';
        const limit = parseInt(req.query.limit) || 20;
        const isStudent = req.user && req.user.role === 'student';
        
        if (!query || query.trim() === '') {
            return res.json({ quizzes: [], users: [] });
        }

        // Fetch Quizzes
        const allQuizzes = await prisma.quiz.findMany({
            select: {
                id: true,
                title: true,
                topic: true,
                description: true,
                difficulty: true,
                joinCode: true,
                isActive: true,
                createdBy: {
                    select: {
                        id: true,
                        username: true,
                        email: true
                    }
                },
                createdAt: true,
                questions: true
            }
        });

        // Fetch Users (Strictly Admin-only operational database access)
        let allUsers = [];
        if (req.user && req.user.role === 'admin') {
            allUsers = await prisma.user.findMany({
                select: {
                    id: true,
                    username: true,
                    email: true,
                    role: true,
                    studentBranch: true,
                    section: true
                }
            });
        }

        // If user is a student, fetch their completed quiz results
        let completedQuizIds = new Set();
        let quizToResultMap = {};
        if (isStudent) {
            const studentResults = await prisma.result.findMany({
                where: {
                    studentId: req.user.id,
                    status: 'completed'
                },
                select: {
                    id: true,
                    quizId: true
                }
            });
            studentResults.forEach(r => {
                completedQuizIds.add(r.quizId);
                quizToResultMap[r.quizId] = r.id;
            });
        }

        const scoredQuizzes = [];
        const scoredUsers = [];

        // 1. Score Quizzes
        allQuizzes.forEach(quiz => {
            // Security: Students should not see inactive/draft quizzes at all
            if (isStudent && !quiz.isActive) return;

            // Security: Teachers should only see their own drafts/inactive quizzes
            if (req.user && req.user.role === 'teacher' && !quiz.isActive && quiz.createdBy?.id !== req.user.id) return;

            let maxScore = 0;
            let matchingField = 'title';
            let matchedQuestionIndex = null;

            // Check Title
            const titleScore = calculateRelevanceScore(query, quiz.title);
            if (titleScore > maxScore) {
                maxScore = titleScore;
                matchingField = 'title';
            }

            // Check Topic
            const topicScore = calculateRelevanceScore(query, quiz.topic || '');
            if (topicScore > maxScore) {
                maxScore = topicScore;
                matchingField = 'topic';
            }

            // Check Creator/Faculty name
            const creatorScore = calculateRelevanceScore(query, quiz.createdBy?.username || '');
            if (creatorScore > maxScore) {
                maxScore = creatorScore;
                matchingField = 'faculty';
            }

            // Check Questions Text (Only search questions for Teachers/Admins to prevent student cheating!)
            if (!isStudent) {
                let questionsList = [];
                try {
                    questionsList = typeof quiz.questions === 'string' ? JSON.parse(quiz.questions) : quiz.questions;
                } catch (_) {}
                
                if (Array.isArray(questionsList)) {
                    questionsList.forEach((q, idx) => {
                        const qText = q.questionText || q.question || '';
                        const qScore = calculateRelevanceScore(query, qText);
                        if (qScore > maxScore) {
                            maxScore = qScore * 0.95; // High weight for exact question hits
                            matchingField = 'question';
                            matchedQuestionIndex = idx;
                        }
                    });
                }
            }

            if (maxScore > 0.15) {
                const quizPayload = {
                    id: quiz.id,
                    title: quiz.title,
                    topic: quiz.topic || 'General',
                    description: quiz.description,
                    difficulty: quiz.difficulty,
                    joinCode: quiz.joinCode,
                    isActive: quiz.isActive,
                    faculty: quiz.createdBy?.username || 'Unknown',
                    createdAt: quiz.createdAt,
                    score: maxScore,
                    matchedOn: matchingField
                };

                if (isStudent) {
                    const hasCompleted = completedQuizIds.has(quiz.id);
                    quizPayload.completed = hasCompleted;
                    if (hasCompleted) {
                        quizPayload.resultId = quizToResultMap[quiz.id];
                    }
                } else {
                    quizPayload.matchedQuestionIndex = matchedQuestionIndex;
                }

                scoredQuizzes.push(quizPayload);
            }
        });

        // 2. Score Users
        allUsers.forEach(user => {
            let maxScore = 0;
            let matchingField = 'username';

            // Check Username
            const userScore = calculateRelevanceScore(query, user.username);
            if (userScore > maxScore) {
                maxScore = userScore;
                matchingField = 'username';
            }

            // Check Email
            const emailScore = calculateRelevanceScore(query, user.email);
            if (emailScore > maxScore) {
                maxScore = emailScore;
                matchingField = 'email';
            }

            // Check Student Branch
            const branchScore = calculateRelevanceScore(query, user.studentBranch || '');
            if (branchScore > maxScore) {
                maxScore = branchScore;
                matchingField = 'branch';
            }

            // Check Student Section
            const sectionScore = calculateRelevanceScore(query, user.section || '');
            if (sectionScore > maxScore) {
                maxScore = sectionScore;
                matchingField = 'section';
            }

            if (maxScore > 0.15) {
                scoredUsers.push({
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    role: user.role,
                    studentBranch: user.studentBranch || 'N/A',
                    section: user.section || 'N/A',
                    score: maxScore,
                    matchedOn: matchingField
                });
            }
        });

        // Sort by relevance score desc
        const sortedQuizzes = scoredQuizzes.sort((a, b) => b.score - a.score).slice(0, limit);
        const sortedUsers = scoredUsers.sort((a, b) => b.score - a.score).slice(0, limit);

        res.json({
            quizzes: sortedQuizzes,
            users: sortedUsers
        });

    } catch (err) {
        console.error('Error executing global search:', err);
        res.status(500).json({ msg: 'Server Error executing global search', error: err.message });
    }
};
