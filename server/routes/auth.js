const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma'); // Using Prisma
const auth = require('../middleware/authMiddleware');

// @route   POST api/auth/register
// @desc    Register user (Admin Only)
// @access  Private/Admin
router.post('/register', auth, async (req, res) => {
    // --- RULE 1: Admin Authorization ---
    try {
        const adminUser = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (!adminUser || adminUser.role !== 'admin') {
            return res.status(403).json({ msg: 'Only administrators can create new accounts.' });
        }

        const { username, email, password, role } = req.body;

        // --- RULE 2: Role Handling ---
        // Any number of teachers/students can be added by the admin

        let user = await prisma.user.findFirst({
            where: {
                OR: [{ email }, { username }]
            }
        });

        if (user) {
            return res.status(400).json({ msg: 'User already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        user = await prisma.user.create({
            data: {
                username,
                email,
                password: hashedPassword,
                role: role || 'student'
            }
        });

        res.json({ msg: 'User created successfully', user: { id: user.id, username: user.username, role: user.role } });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   POST api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', async (req, res) => {
    const { email, password } = req.body; // email field is used for Roll Number/Username

    try {
        // --- RULE 3: Support Username or Email for Login ---
        let user = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: { equals: email, mode: 'insensitive' } },
                    { username: { equals: email, mode: 'insensitive' } }
                ]
            }
        });

        if (!user) {
            return res.status(400).json({ msg: 'Invalid Credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ msg: 'Invalid Credentials' });
        }

        const payload = {
            user: {
                id: user.id,
                role: user.role
            }
        };

        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '1h' },
            (err, token) => {
                if (err) throw err;
                res.json({ token, role: user.role });
            }
        );
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error: ' + err.message });
    }
});

// Get User
router.get('/me', auth, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: {
                id: true,
                username: true,
                email: true,
                role: true,
                createdAt: true
            }
        });
        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error: ' + err.message });
    }
});

// Set Role (Only once)
router.post('/set-role', auth, async (req, res) => {
    const { role } = req.body;

    if (!['teacher', 'student', 'admin'].includes(role)) {
        return res.status(400).json({ msg: 'Invalid role' });
    }

    try {
        let user = await prisma.user.findUnique({
            where: { id: req.user.id }
        });

        if (user.role !== 'none') {
            return res.status(400).json({ msg: 'Role already set. Cannot change.' });
        }

        user = await prisma.user.update({
            where: { id: req.user.id },
            data: { role: role }
        });

        const payload = {
            user: {
                id: user.id,
                role: user.role
            }
        };

        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '1h' },
            (err, token) => {
                if (err) throw err;
                res.json({ token, role: user.role });
            }
        );

    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error: ' + err.message });
    }
});

// @route   PUT api/auth/change-password
// @desc    Change logged-in user's password
// @access  Private
router.put('/change-password', auth, async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ msg: 'Please provide current and new password.' });
    }
    if (newPassword.length < 6) {
        return res.status(400).json({ msg: 'New password must be at least 6 characters.' });
    }

    try {
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (!user) return res.status(404).json({ msg: 'User not found.' });

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) return res.status(400).json({ msg: 'Current password is incorrect.' });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        await prisma.user.update({
            where: { id: req.user.id },
            data: { password: hashedPassword }
        });

        res.json({ msg: 'Password updated successfully.' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error: ' + err.message });
    }
});

module.exports = router;
