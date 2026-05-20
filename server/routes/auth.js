const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { check, validationResult } = require('express-validator');

// Rate limiter for authentication (Brute force protection)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 15, // limit each IP to 15 login attempts per window
    message: 'Too many login attempts from this IP, please try again after 15 minutes'
});
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma'); // Using Prisma
const auth = require('../middleware/authMiddleware');

// Validation Rules
const registerValidation = [
    check('username', 'Username is required and must be at least 3 characters').isLength({ min: 3 }).trim().escape(),
    check('email', 'Please include a valid email or roll number').isLength({ min: 3 }),
    check('password', 'Password must be 8+ chars, including 1 uppercase and 1 special char')
        .isLength({ min: 8 })
        .matches(/^(?=.*[A-Z])(?=.*[!@#$%^&*])/)
];

const loginValidation = [
    check('email', 'Username/Email is required').not().isEmpty().trim(),
    check('password', 'Password is required').exists()
];

// @route   POST api/auth/register
// @desc    Register user (Admin Only)
// @access  Private/Admin
router.post('/register', auth, authLimiter, registerValidation, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

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
                role: role || 'student',
                studentBranch: req.body.studentBranch || null,
                section: req.body.section || null
            }
        });

        res.json({ 
            msg: 'User created successfully', 
            user: { 
                id: user.id, 
                username: user.username, 
                role: user.role,
                tokenVersion: user.tokenVersion
            } 
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   POST api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', authLimiter, loginValidation, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
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

        // --- RULE 4: Suspension Check (Applies to all: Students & Teachers) ---
        if (user.isSuspended) {
            return res.status(403).json({ 
                msg: 'Account has been suspended!', 
                reason: user.suspensionReason || 'Violation of community guidelines.' 
            });
        }

        const payload = {
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                tokenVersion: user.tokenVersion
            }
        };

        // Update last login
        await prisma.user.update({
            where: { id: user.id },
            data: { lastLogin: new Date() }
        });

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
                studentBranch: true,
                section: true,
                createdAt: true,
                updatedAt: true,
                lastLogin: true
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
                username: user.username,
                role: user.role,
                tokenVersion: user.tokenVersion
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
            data: { 
                password: hashedPassword,
                tokenVersion: { increment: 1 } // SECURITY: Revoke all old sessions
            }
        });

        res.json({ msg: 'Password updated successfully.' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error: ' + err.message });
    }
});

// @route   POST api/auth/forgot-password
// @desc    Initiate password reset (Generate reset token)
// @access  Public
router.post('/forgot-password', authLimiter, [
    check('email', 'Please provide a valid email or username').not().isEmpty()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const { email } = req.body;
    try {
        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: { equals: email, mode: 'insensitive' } },
                    { username: { equals: email, mode: 'insensitive' } }
                ]
            }
        });
        if (!user) {
            // Under security guidelines, to prevent account enumeration, return success even if user not found
            return res.json({ msg: 'If that account exists, a password reset link has been generated.' });
        }

        // Generate brief 10-minute reset token containing user ID
        const payload = { resetUserId: user.id };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '10m' });

        res.json({
            msg: 'Password reset link generated successfully.',
            resetToken: token // Exposed so client can proceed with reset flow cleanly
        });
    } catch (err) {
        console.error('Forgot password error:', err);
        res.status(500).json({ msg: 'Server error: ' + err.message });
    }
});

// @route   POST api/auth/reset-password
// @desc    Complete password reset with token
// @access  Public
router.post('/reset-password', authLimiter, [
    check('token', 'Token is required').not().isEmpty(),
    check('newPassword', 'Password must be 8+ chars, including 1 uppercase and 1 special char')
        .isLength({ min: 8 })
        .matches(/^(?=.*[A-Z])(?=.*[!@#$%^&*])/)
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const { token, newPassword } = req.body;
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded.resetUserId) {
            return res.status(400).json({ msg: 'Invalid or expired password reset token.' });
        }

        const user = await prisma.user.findUnique({ where: { id: decoded.resetUserId } });
        if (!user) {
            return res.status(404).json({ msg: 'User not found.' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                tokenVersion: { increment: 1 } // Invalidate all existing tokens/sessions immediately
            }
        });

        res.json({ msg: 'Password has been reset successfully.' });
    } catch (err) {
        console.error('Reset password error:', err);
        res.status(400).json({ msg: 'Invalid or expired password reset token.' });
    }
});

module.exports = router;
