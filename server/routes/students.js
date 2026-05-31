const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const prisma = require('../lib/prisma');

// @route   GET api/students/branches
// @desc    Fetch unique branches directly from database student records
router.get('/branches', auth, async (req, res) => {
    try {
        const branches = await prisma.user.groupBy({
            by: ['studentBranch'],
            where: {
                role: 'student',
                studentBranch: { not: null }
            }
        });
        const branchList = branches.map(b => b.studentBranch).filter(Boolean);
        res.json(branchList);
    } catch (err) {
        console.error('Error fetching branches:', err);
        res.status(500).json({ error: 'Server error fetching branches' });
    }
});

// @route   GET api/students/sections
// @desc    Fetch unique sections dynamically based on selected branch
router.get('/sections', auth, async (req, res) => {
    try {
        const { branch } = req.query;
        const whereClause = {
            role: 'student',
            section: { not: null }
        };

        if (branch) {
            if (Array.isArray(branch)) {
                whereClause.studentBranch = { in: branch };
            } else {
                whereClause.studentBranch = branch;
            }
        }

        const sections = await prisma.user.groupBy({
            by: ['section'],
            where: whereClause
        });
        const sectionList = sections.map(s => s.section).filter(Boolean).sort();
        res.json(sectionList);
    } catch (err) {
        console.error('Error fetching sections:', err);
        res.status(500).json({ error: 'Server error fetching sections' });
    }
});

// @route   GET api/students/years
// @desc    Fetch unique academic years directly from DB records
router.get('/years', auth, async (req, res) => {
    try {
        const years = await prisma.user.groupBy({
            by: ['year'],
            where: {
                role: 'student',
                year: { not: null }
            }
        });
        const yearList = years.map(y => y.year).filter(Boolean);
        // Fallback to "1st Year" if database years aren't populated yet
        res.json(yearList.length > 0 ? yearList : ['1st Year']);
    } catch (err) {
        console.error('Error fetching years:', err);
        res.status(500).json({ error: 'Server error fetching years' });
    }
});

// @route   GET api/students/semesters
// @desc    Fetch unique semesters directly from DB records
router.get('/semesters', auth, async (req, res) => {
    try {
        const semesters = await prisma.user.groupBy({
            by: ['semester'],
            where: {
                role: 'student',
                semester: { not: null }
            }
        });
        const semesterList = semesters.map(s => s.semester).filter(Boolean);
        // Fallback to "Semester 2" if database semesters aren't populated yet
        res.json(semesterList.length > 0 ? semesterList : ['Semester 2']);
    } catch (err) {
        console.error('Error fetching semesters:', err);
        res.status(500).json({ error: 'Server error fetching semesters' });
    }
});

// @route   GET api/students/search
// @desc    Production-grade dynamic database query and search matching rollNo, name, email, branch, section
router.get('/search', auth, async (req, res) => {
    try {
        const { q, branch, section, year, semester, page = 1, limit = 20 } = req.query;
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        // Build filtering clauses dynamically
        const andClauses = [{ role: 'student' }];

        if (branch) {
            if (Array.isArray(branch)) {
                andClauses.push({ studentBranch: { in: branch } });
            } else {
                andClauses.push({ studentBranch: branch });
            }
        }

        if (section) {
            if (Array.isArray(section)) {
                andClauses.push({ section: { in: section } });
            } else {
                andClauses.push({ section: section });
            }
        }

        if (year) {
            andClauses.push({ year: year });
        }

        if (semester) {
            andClauses.push({ semester: semester });
        }

        if (q && q.trim().length > 0) {
            const queryText = q.trim();
            // Typo-tolerant and flexible case-insensitive matching across rollNo (username), name, email
            andClauses.push({
                OR: [
                    { username: { contains: queryText, mode: 'insensitive' } },
                    { name: { contains: queryText, mode: 'insensitive' } },
                    { email: { contains: queryText, mode: 'insensitive' } }
                ]
            });
        }

        const whereClause = { AND: andClauses };

        // Fetch paginated results and total counts for frontend rendering
        const [students, total] = await Promise.all([
            prisma.user.findMany({
                where: whereClause,
                select: {
                    id: true,
                    username: true,
                    email: true,
                    name: true,
                    studentBranch: true,
                    section: true,
                    year: true,
                    semester: true
                },
                orderBy: [
                    { studentBranch: 'asc' },
                    { section: 'asc' },
                    { username: 'asc' }
                ],
                skip,
                take: limitNum
            }),
            prisma.user.count({ where: whereClause })
        ]);

        res.json({
            students,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                pages: Math.ceil(total / limitNum)
            }
        });
    } catch (err) {
        console.error('Error during student search:', err);
        res.status(500).json({ error: 'Server error during student search' });
    }
});

// --- GAMIFICATION ROUTES ---

// Keep track of processed game session IDs to prevent duplicate submissions (in-memory with TTL cleanup)
const processedSessions = new Map(); // sessionId -> timestamp (Date)

// Periodically clean up session IDs older than 6 hours to prevent memory leaks
setInterval(() => {
    const now = Date.now();
    const expiry = 6 * 60 * 60 * 1000; // 6 hours
    for (const [sid, timestamp] of processedSessions.entries()) {
        if (now - timestamp > expiry) {
            processedSessions.delete(sid);
        }
    }
}, 30 * 60 * 1000); // run every 30 minutes

// Helper function to generate daily missions
const generateDailyMissions = () => {
    // 1 Main Mission, 2 Bonus
    const mainMissions = [
        { id: 'm1', title: 'Play 2 games today', type: 'games_played', target: 2, current: 0, required: true },
        { id: 'm2', title: 'Score 50+ in any game', type: 'score_achieved', target: 50, current: 0, required: true },
        { id: 'm3', title: 'Achieve 70%+ accuracy', type: 'accuracy_achieved', target: 70, current: 0, required: true }
    ];
    const bonusMissions = [
        { id: 'b1', title: 'Play Match Up Match', type: 'play_matchup', target: 1, current: 0, required: false },
        { id: 'b2', title: 'Play Sprint Arena', type: 'play_sprint', target: 1, current: 0, required: false },
        { id: 'b3', title: 'Play Cyber Quest', type: 'play_cyber', target: 1, current: 0, required: false },
        { id: 'b4', title: 'Earn 100 XP', type: 'earn_xp', target: 100, current: 0, required: false }
    ];
    
    // Pick 1 random main, 2 random bonus
    const main = mainMissions[Math.floor(Math.random() * mainMissions.length)];
    const shuffledBonus = bonusMissions.sort(() => 0.5 - Math.random());
    const bonuses = shuffledBonus.slice(0, 2);
    
    return [main, ...bonuses];
};

// @route   GET api/students/gamification
// @desc    Get current gamification stats and daily missions (Read-Only)
router.get('/gamification', auth, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { xp: true, streak: true, highestStreak: true, dailyMissions: true, unlockedPerks: true }
        });

        if (!user) return res.status(404).json({ msg: 'User not found' });

        res.json({
            xp: user.xp,
            streak: user.streak,
            highestStreak: user.highestStreak || 0,
            dailyMissions: user.dailyMissions || [],
            unlockedPerks: user.unlockedPerks || []
        });

    } catch (err) {
        console.error('Gamification fetch error:', err);
        res.status(500).json({ error: 'Server error fetching gamification stats' });
    }
});

// @route   POST api/students/gamification/init
// @desc    Initialize daily state, handle streak saves and resets
router.post('/gamification/init', auth, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (!user) return res.status(404).json({ msg: 'User not found' });

        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const lastMissionStr = user.lastMissionsDate ? user.lastMissionsDate.toISOString().split('T')[0] : null;

        let missions = user.dailyMissions || [];
        let streak = user.streak;
        let highestStreak = user.highestStreak || 0;
        let xp = user.xp;
        let streakSavesUsed = user.streakSavesUsed || 0;
        let lastStreakSaveWeek = user.lastStreakSaveWeek;
        let lastStreakDate = user.lastStreakDate;
        
        let actionsTaken = [];

        if (todayStr !== lastMissionStr) {
            // New day detected. Generate new missions
            missions = generateDailyMissions();

            // Evaluate Streak Saves if they have an active streak and missed a day
            if (streak > 0 && lastStreakDate) {
                const yesterday = new Date();
                yesterday.setDate(now.getDate() - 1);
                const yesterdayStr = yesterday.toISOString().split('T')[0];
                const lastStreakStr = lastStreakDate.toISOString().split('T')[0];

                if (lastStreakStr !== yesterdayStr && lastStreakStr !== todayStr) {
                    // Weekly Reset Check for Streak Saves
                    const getMonday = (d) => {
                        const date = new Date(d);
                        const day = date.getDay();
                        const diff = date.getDate() - day + (day === 0 ? -6 : 1);
                        return new Date(date.setDate(diff)).toISOString().split('T')[0];
                    };
                    
                    const currentWeekStr = getMonday(now);
                    const lastSaveWeekStr = lastStreakSaveWeek ? getMonday(lastStreakSaveWeek) : null;
                    
                    if (currentWeekStr !== lastSaveWeekStr) {
                        streakSavesUsed = 0;
                        lastStreakSaveWeek = now;
                    }

                    // Calculate consecutive missed days
                    const diffTime = Math.abs(now.setHours(0,0,0,0) - lastStreakDate.setHours(0,0,0,0));
                    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                    const daysMissed = diffDays > 0 ? diffDays - 1 : 0; 

                    let streakBroken = false;

                    for (let i = 0; i < daysMissed; i++) {
                        let cost = 0;
                        if (streakSavesUsed === 0) cost = 30;
                        else if (streakSavesUsed === 1) cost = 60;
                        else {
                            streakBroken = true;
                            break;
                        }

                        if (xp >= cost) {
                            xp -= cost;
                            streakSavesUsed += 1;
                            actionsTaken.push(`Streak saved! Spent ${cost} XP.`);
                        } else {
                            streakBroken = true;
                            break;
                        }
                    }

                    if (streakBroken) {
                        streak = 0;
                        actionsTaken.push('Streak reset due to missed days.');
                    } else {
                        // Fast forward last streak date to yesterday so it is "saved"
                        const newLastStreakDate = new Date();
                        newLastStreakDate.setDate(now.getDate() - 1);
                        lastStreakDate = newLastStreakDate;
                    }
                }
            }

            // Save the state to DB
            await prisma.user.update({
                where: { id: user.id },
                data: {
                    dailyMissions: missions,
                    lastMissionsDate: now,
                    streak: streak,
                    xp: xp,
                    streakSavesUsed: streakSavesUsed,
                    lastStreakSaveWeek: lastStreakSaveWeek,
                    lastStreakDate: lastStreakDate,
                    highestStreak: highestStreak
                }
            });
        }

        res.json({
            xp: xp,
            streak: streak,
            highestStreak: highestStreak,
            dailyMissions: missions,
            actionsTaken: actionsTaken,
            unlockedPerks: user.unlockedPerks || []
        });

    } catch (err) {
        console.error('Gamification init error:', err);
        res.status(500).json({ error: 'Server error initializing gamification' });
    }
});

// @route   POST api/students/game-score
// @desc    Submit game score metrics, compute XP natively to prevent cheating
router.post('/game-score', auth, async (req, res) => {
    try {
        const { gameType, correctAnswers, totalQuestions, duration, sessionId, ...gameSpecificData } = req.body;
        
        if (!sessionId) {
            return res.status(400).json({ msg: 'Session ID is required.' });
        }

        if (processedSessions.has(sessionId)) {
            console.warn(`[GameScore] Blocked duplicate submission for session ${sessionId} (user: ${req.user.id})`);
            return res.status(400).json({ msg: 'Score for this game session has already been submitted.', duplicate: true });
        }

        // Register session ID to prevent duplicate submissions
        processedSessions.set(sessionId, Date.now());

        let xpGained = 0;
        let accuracy = 0;
        let farmed = false; // Set true if minimum requirements are not met

        // Anti-Farming + Anti-Cheat: Validate minimum thresholds per game
        // then compute XP server-side from raw metrics.
        if (gameType === 'cyber_quest') {
            // Minimum: at least 3 questions answered
            if (!correctAnswers || correctAnswers < 3) farmed = true;
            else {
                accuracy = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;
                xpGained = Math.min(correctAnswers * 10, 100);
            }
        } else if (gameType === 'sprint_arena') {
            // Minimum: at least 3 correct answers AND at least 20 seconds played
            if (!correctAnswers || correctAnswers < 3 || !duration || duration < 20) farmed = true;
            else {
                const attemptedTotal = correctAnswers + (gameSpecificData.wrongAnswers || 0);
                accuracy = attemptedTotal > 0 ? (correctAnswers / attemptedTotal) * 100 : 0;
                xpGained = Math.min((correctAnswers * 10) + Math.max(0, Math.floor(duration / 10)), 100);
            }
        } else if (gameType === 'match_up') {
            // Minimum: at least 2 pairs matched AND at least 30 seconds played AND 50%+ completion
            const totalPairs = totalQuestions || 1;
            const completionPct = (correctAnswers / totalPairs) * 100;
            if (!correctAnswers || correctAnswers < 2 || !duration || duration < 30 || completionPct < 50) farmed = true;
            else {
                const moves = gameSpecificData.moves || 1;
                accuracy = moves > 0 ? (correctAnswers / moves) * 100 : 0;
                const accuracyBonus = Math.max(0, accuracy * 0.1);
                const speedBonus = Math.max(0, (240 - duration) * 0.05);
                xpGained = Math.min(Math.floor((correctAnswers * 10) + accuracyBonus + speedBonus), 100);
            }
        } else {
            return res.status(400).json({ msg: 'Unknown game type.' });
        }

        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (!user) return res.status(404).json({ msg: 'User not found' });

        let missions = Array.isArray(user.dailyMissions) ? user.dailyMissions : [];
        let mainCompletedToday = false;
        let progressMade = false;

        // Process mission progress — play-type missions still count even if farmed.
        // XP-based missions only count if the session was not farmed.
        missions = missions.map(m => {
            if (m.current >= m.target) {
                if (m.required) mainCompletedToday = true;
                return m;
            }

            let previous = m.current;
            // Always track play-based missions (can't be farmed — student still played)
            if (m.type === 'games_played') m.current += 1;
            else if (m.type === 'play_matchup' && gameType === 'match_up') m.current += 1;
            else if (m.type === 'play_sprint' && gameType === 'sprint_arena') m.current += 1;
            else if (m.type === 'play_cyber' && gameType === 'cyber_quest') m.current += 1;
            // XP/accuracy-based missions only count for legitimate sessions
            else if (!farmed) {
                if (m.type === 'score_achieved' && xpGained >= m.target) m.current = m.target;
                else if (m.type === 'accuracy_achieved' && accuracy >= m.target) m.current = m.target;
                else if (m.type === 'earn_xp') m.current += xpGained;
            }

            if (m.current > m.target) m.current = m.target;
            if (m.current > previous) progressMade = true;
            if (m.required && m.current >= m.target) mainCompletedToday = true;

            return m;
        });

        let newStreak = user.streak;
        let highestStreak = user.highestStreak || 0;
        let streakBonus = 0;
        let lastStreakDate = user.lastStreakDate;
        const todayStr = new Date().toISOString().split('T')[0];
        const lastStreakStr = lastStreakDate ? lastStreakDate.toISOString().split('T')[0] : null;

        let streakIncremented = false;
        // Only update streak if session was legitimate (not farmed)
        if (!farmed && mainCompletedToday && lastStreakStr !== todayStr) {
            newStreak += 1;
            lastStreakDate = new Date();
            streakIncremented = true;
            
            if (newStreak > highestStreak) highestStreak = newStreak;
            
            if (newStreak === 3) streakBonus = 15;
            else if (newStreak === 7) streakBonus = 25;
            else if (newStreak === 14) streakBonus = 50;
        }

        const totalXpGained = farmed ? 0 : (xpGained + streakBonus);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                xp: { increment: totalXpGained },
                streak: newStreak,
                highestStreak: highestStreak,
                lastStreakDate: lastStreakDate,
                dailyMissions: missions
            }
        });

        res.json({
            msg: farmed ? 'Session too short — play longer to earn XP!' : 'Score saved successfully!',
            farmed: farmed,
            xpGained: totalXpGained,
            baseXp: xpGained,
            streakBonus: streakBonus,
            newStreak: newStreak,
            highestStreak: highestStreak,
            streakIncremented: streakIncremented,
            missions: missions
        });

    } catch (err) {
        console.error('Game score error:', err);
        res.status(500).json({ error: 'Server error saving game score' });
    }
});

// @route   POST api/students/redeem-perk
// @desc    Redeem a gamification perk using XP
router.post('/redeem-perk', auth, async (req, res) => {
    try {
        const { perkId, perkName, cost } = req.body;

        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (!user) return res.status(404).json({ msg: 'User not found' });

        // Enforce monthly limits for perks
        const PERK_LIMITS = {
            perk_att: 1, // Attendance Pass: max 1/month
            perk_late: 2  // Late Pass: max 2/month
        };

        const limit = PERK_LIMITS[perkId];
        const unlockedPerks = Array.isArray(user.unlockedPerks) ? user.unlockedPerks : [];

        if (limit !== undefined) {
            const now = new Date();
            const currentYear = now.getFullYear();
            const currentMonth = now.getMonth();

            const redemptionsThisMonth = unlockedPerks.filter(p => {
                if (p.id !== perkId) return false;
                const d = new Date(p.redeemedAt);
                return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
            }).length;

            if (redemptionsThisMonth >= limit) {
                return res.status(400).json({ msg: `Monthly redemption limit reached. You can only redeem this perk ${limit} time(s) per month.` });
            }
        }

        if (user.xp < cost) {
            return res.status(400).json({ msg: 'Insufficient XP to redeem this perk.' });
        }
        
        // Generate cryptographic Unique ID for the ticket
        const crypto = require('crypto');
        const uniqueId = 'PRK-' + crypto.randomBytes(3).toString('hex').toUpperCase() + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();

        // 7-day expiry date
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 7);

        const newPerk = {
            id: perkId,
            name: perkName,
            redeemedAt: new Date(),
            uniqueId: uniqueId,
            expiryDate: expiryDate,
            status: 'UNUSED',
            downloaded: false
        };

        unlockedPerks.push(newPerk);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                xp: { decrement: cost },
                unlockedPerks: unlockedPerks
            }
        });

        res.json({
            msg: 'Perk redeemed successfully!',
            perk: newPerk,
            remainingXp: user.xp - cost
        });

    } catch (err) {
        console.error('Redeem perk error:', err);
        res.status(500).json({ error: 'Server error redeeming perk' });
    }
});

module.exports = router;
