const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const auth = require('../middleware/authMiddleware');
const prisma = require('../lib/prisma'); // Using Prisma

// Middleware: admin only
const adminOnly = async (req, res, next) => {
    try {
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ msg: 'Admin access required' });
        }
        next();
    } catch (err) {
        res.status(500).json({ msg: 'Server error' });
    }
};

// GET all users
router.get('/users', auth, adminOnly, async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                username: true,
                email: true,
                role: true,
                isOnline: true,
                isSuspended: true,
                suspensionReason: true,
                studentBranch: true,
                section: true,
                createdAt: true,
                updatedAt: true,
                lastLogin: true
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(users);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

// POST create new user (admin provisions)
router.post('/users', auth, adminOnly, async (req, res) => {
    const { username, email, password, role } = req.body;

    if (!username || !email || !password || !role) {
        return res.status(400).json({ msg: 'All fields are required' });
    }

    if (!['teacher', 'student', 'admin', 'none'].includes(role)) {
        return res.status(400).json({ msg: 'Invalid role' });
    }

    try {
        let existingUser = await prisma.user.findFirst({
            where: {
                OR: [{ email }, { username }]
            }
        });
        if (existingUser) {
            return res.status(400).json({ msg: 'User with that email or username already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const user = await prisma.user.create({
            data: { 
                username, 
                email, 
                password: hashedPassword, 
                role,
                studentBranch: req.body.studentBranch || null,
                section: req.body.section || null
            },
            select: {
                id: true,
                username: true,
                email: true,
                role: true,
                studentBranch: true,
                section: true,
                createdAt: true
            }
        });

        res.status(201).json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error: ' + err.message });
    }
});

// PUT update user (role, username, email, password)
router.put('/users/:id', auth, adminOnly, async (req, res) => {
    const { username, email, password, role } = req.body;

    try {
        const user = await prisma.user.findUnique({ where: { id: req.params.id } });
        if (!user) return res.status(404).json({ msg: 'User not found' });

        const updateData = {};
        if (username) updateData.username = username;
        if (email) updateData.email = email;
        if (role && ['teacher', 'student', 'admin', 'none'].includes(role)) updateData.role = role;
        if (password && password.trim() !== '') {
            const salt = await bcrypt.genSalt(10);
            updateData.password = await bcrypt.hash(password, salt);
        }
        if (req.body.studentBranch !== undefined) updateData.studentBranch = req.body.studentBranch;
        if (req.body.section !== undefined) updateData.section = req.body.section;

        const updatedUser = await prisma.user.update({
            where: { id: req.params.id },
            data: updateData,
            select: {
                id: true,
                username: true,
                email: true,
                role: true,
                studentBranch: true,
                section: true,
                createdAt: true,
                updatedAt: true,
                lastLogin: true
            }
        });

        res.json(updatedUser);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error: ' + err.message });
    }
});

// DELETE user
router.delete('/users/:id', auth, adminOnly, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({ where: { id: req.params.id } });
        if (!user) return res.status(404).json({ msg: 'User not found' });

        await prisma.user.delete({ where: { id: req.params.id } });
        res.json({ msg: 'User deleted successfully' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

// GET stats
router.get('/stats', auth, adminOnly, async (req, res) => {
    try {
        const total = await prisma.user.count();
        const teachers = await prisma.user.count({ where: { role: 'teacher' } });
        const students = await prisma.user.count({ where: { role: 'student' } });
        const admins = await prisma.user.count({ where: { role: 'admin' } });
        res.json({ total, teachers, students, admins });
    } catch (err) {
        res.status(500).json({ msg: 'Server error' });
    }
});

// PUT toggle suspension
router.put('/users/suspend/:id', auth, adminOnly, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({ where: { id: req.params.id } });
        if (!user) return res.status(404).json({ msg: 'User not found' });

        if (user.id === req.user.id) {
            return res.status(400).json({ msg: 'You cannot suspend yourself.' });
        }

        const updated = await prisma.user.update({
            where: { id: req.params.id },
            data: { 
                isSuspended: !user.isSuspended,
                suspensionReason: !user.isSuspended ? 'Suspended by Administrator' : null,
                tokenVersion: { increment: 1 } // SECURITY: Force logout on suspension
            },
            select: {
                id: true,
                isSuspended: true,
                suspensionReason: true
            }
        });

        res.json(updated);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

// POST batch promotion of student year levels
router.post('/promote', auth, adminOnly, async (req, res) => {
    try {
        // 1. Delete year 4 students (graduating seniors)
        const deleteRes = await prisma.user.deleteMany({
            where: { role: 'student', year: '4' }
        });

        // 2. Upgrade Year 3 -> 4
        await prisma.user.updateMany({
            where: { role: 'student', year: '3' },
            data: { year: '4' }
        });

        // 3. Upgrade Year 2 -> 3
        await prisma.user.updateMany({
            where: { role: 'student', year: '2' },
            data: { year: '3' }
        });

        // 4. Upgrade Year 1 -> 2
        await prisma.user.updateMany({
            where: { role: 'student', year: '1' },
            data: { year: '2' }
        });

        res.json({
            msg: 'Batch year promotion completed successfully!',
            graduatedCount: deleteRes.count
        });
    } catch (err) {
        console.error('Promotion error:', err.message);
        res.status(500).json({ msg: 'Server error: ' + err.message });
    }
});

// POST batch import students from CSV data
router.post('/import', auth, adminOnly, async (req, res) => {
    const { students } = req.body;
    if (!students || !Array.isArray(students)) {
        return res.status(400).json({ msg: 'Invalid payload: students list is required' });
    }

    try {
        let successCount = 0;
        let errors = [];

        // Loop through students sequentially to hash and insert securely
        for (const s of students) {
            const { username, email, password, studentBranch, section, year } = s;
            if (!username || !email || !password) {
                errors.push({ email: email || 'unknown', reason: 'Missing username, email, or password' });
                continue;
            }

            try {
                // Check if user already exists
                const existing = await prisma.user.findFirst({
                    where: { OR: [{ email }, { username }] }
                });
                if (existing) {
                    errors.push({ email, reason: 'Duplicate username or email already in database' });
                    continue;
                }

                // Hash password
                const salt = await bcrypt.genSalt(10);
                const hashedPassword = await bcrypt.hash(password, salt);

                // Create user
                await prisma.user.create({
                    data: {
                        username,
                        email,
                        password: hashedPassword,
                        role: 'student',
                        studentBranch: studentBranch || null,
                        section: section || null,
                        year: year ? String(year) : '1'
                    }
                });
                successCount++;
            } catch (innerErr) {
                errors.push({ email, reason: innerErr.message });
            }
        }

        res.json({
            msg: `Batch import complete. Imported ${successCount} students.`,
            successCount,
            failureCount: errors.length,
            errors
        });
    } catch (err) {
        console.error('Import error:', err.message);
        res.status(500).json({ msg: 'Server error: ' + err.message });
    }
});

module.exports = router;
