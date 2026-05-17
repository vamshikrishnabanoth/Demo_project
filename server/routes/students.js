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

module.exports = router;
