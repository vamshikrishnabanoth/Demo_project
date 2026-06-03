const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { check, validationResult } = require('express-validator');
const { logSecurityEvent } = require('../middleware/security');

// Rate limiter for authentication (Brute force protection)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.DISABLE_LIMITS === 'true' ? 100000000 : 15, // limit each IP to 15 login attempts per window
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

// Debug DB route
router.get('/debug-db', async (req, res) => {
    try {
        const result = await prisma.$queryRaw`SELECT 1 as result`;
        const userCount = await prisma.user.count();
        res.json({ success: true, message: 'Database connection successful!', result, userCount });
    } catch (err) {
        console.error('Debug DB Error:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Database connection failed!', 
            error: err.message, 
            code: err.code,
            meta: err.meta,
            stack: err.stack 
        });
    }
});

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
    const clientIp = req.ip || req.connection?.remoteAddress || 'unknown';

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
            // Log failed attempt (user not found) — use generic message to prevent enumeration
            logSecurityEvent({
                type: 'LOGIN_FAILED',
                message: `Failed login attempt for non-existent account`,
                ip: clientIp,
                userAgent: req.headers['user-agent']?.substring(0, 200),
            });
            return res.status(400).json({ msg: 'Invalid Credentials' });
        }

        // --- PROGRESSIVE ACCOUNT LOCKOUT ---
        if (user.lockoutUntil && new Date() < new Date(user.lockoutUntil)) {
            const remainingMs = new Date(user.lockoutUntil) - new Date();
            const remainingMin = Math.ceil(remainingMs / 60000);
            logSecurityEvent({
                type: 'LOGIN_LOCKED_OUT',
                message: `Locked out user attempted login (${remainingMin}min remaining)`,
                ip: clientIp,
                userId: user.id,
            });
            return res.status(423).json({
                msg: `Account temporarily locked due to too many failed attempts. Try again in ${remainingMin} minute(s).`
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            // Increment failed login attempts and compute lockout duration
            const newFailedAttempts = (user.failedLoginAttempts || 0) + 1;
            let lockoutUntil = null;

            if (newFailedAttempts >= 15) {
                lockoutUntil = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
            } else if (newFailedAttempts >= 10) {
                lockoutUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
            } else if (newFailedAttempts >= 5) {
                lockoutUntil = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
            }

            await prisma.user.update({
                where: { id: user.id },
                data: {
                    failedLoginAttempts: newFailedAttempts,
                    lastFailedLoginAt: new Date(),
                    lockoutUntil: lockoutUntil,
                }
            });

            logSecurityEvent({
                type: 'LOGIN_FAILED',
                message: `Failed login attempt #${newFailedAttempts}${lockoutUntil ? ' (account locked)' : ''}`,
                ip: clientIp,
                userId: user.id,
                failedAttempts: newFailedAttempts,
                userAgent: req.headers['user-agent']?.substring(0, 200),
            });

            return res.status(400).json({ msg: 'Invalid Credentials' });
        }

        // --- RULE 4: Suspension Check (Applies to all: Students & Teachers) ---
        if (user.isSuspended) {
            return res.status(403).json({ 
                msg: 'Account has been suspended!', 
                reason: user.suspensionReason || 'Violation of community guidelines.' 
            });
        }

        // --- RULE 5: Prevent Duplicate Logins for Students ---
        if (user.role === 'student' && user.isOnline && process.env.DISABLE_LIMITS !== 'true') {
            return res.status(403).json({
                msg: 'This account is already logged in on another device or tab.'
            });
        }

        // --- SUCCESSFUL LOGIN: Reset lockout counter ---
        await prisma.user.update({
            where: { id: user.id },
            data: {
                failedLoginAttempts: 0,
                lockoutUntil: null,
                lastFailedLoginAt: null,
                lastLogin: new Date()
            }
        });

        logSecurityEvent({
            type: 'LOGIN_SUCCESS',
            message: `Successful login`,
            ip: clientIp,
            userId: user.id,
            role: user.role,
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
                res.json({ 
                    token, 
                    user: { 
                        id: user.id, 
                        username: user.username, 
                        email: user.email, 
                        role: user.role,
                        studentBranch: user.studentBranch,
                        section: user.section
                    } 
                });
            }
        );
    } catch (err) {
        console.error("Login Error:", err);
        res.status(500).json({ msg: 'Server error: ' + err.message });
    }
});

// @route   POST api/auth/register-public
// @desc    Self-registration for new users (from login page)
// @access  Public
router.post('/register-public', authLimiter, registerValidation, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ msg: errors.array().map(e => e.msg).join('. ') });
    }

    const { username, email, password } = req.body;

    try {
        let existingUser = await prisma.user.findFirst({
            where: {
                OR: [{ email }, { username }]
            }
        });

        if (existingUser) {
            return res.status(400).json({ msg: 'User already exists with that email or username.' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const user = await prisma.user.create({
            data: {
                username,
                email,
                password: hashedPassword,
                role: 'none'
            }
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
                res.json({ 
                    token, 
                    user: { 
                        id: user.id, 
                        username: user.username, 
                        email: user.email, 
                        role: user.role 
                    } 
                });
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
router.put('/change-password', auth, [
    check('currentPassword', 'Current password is required').not().isEmpty(),
    check('newPassword', 'New password must be 8+ chars, including 1 uppercase and 1 special char')
        .isLength({ min: 8 })
        .matches(/^(?=.*[A-Z])(?=.*[!@#$%^&*])/)
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { currentPassword, newPassword } = req.body;

    try {
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (!user) return res.status(404).json({ msg: 'User not found.' });

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) return res.status(400).json({ msg: 'Current password is incorrect.' });

        // Prevent reuse of the same password
        const isSamePassword = await bcrypt.compare(newPassword, user.password);
        if (isSamePassword) {
            return res.status(400).json({ msg: 'New password must be different from the current password.' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        await prisma.user.update({
            where: { id: req.user.id },
            data: { 
                password: hashedPassword,
                tokenVersion: { increment: 1 } // SECURITY: Revoke all old sessions
            }
        });

        logSecurityEvent({
            type: 'PASSWORD_CHANGED',
            message: 'User changed their password',
            userId: req.user.id,
            ip: req.ip || 'unknown',
        });

        res.json({ msg: 'Password updated successfully.' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error' });
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

// @route   POST api/auth/logout
// @desc    Logout user & invalidate token immediately (defense-in-depth)
// @access  Private
router.post('/logout', auth, async (req, res) => {
    try {
        await prisma.user.update({
            where: { id: req.user.id },
            data: {
                isOnline: false,
                tokenVersion: { increment: 1 } // Invalidate the current session token immediately
            }
        });

        logSecurityEvent({
            type: 'LOGOUT',
            message: 'User logged out securely',
            userId: req.user.id,
            ip: req.ip || 'unknown',
        });

        res.json({ msg: 'Logged out successfully.' });
    } catch (err) {
        console.error('Logout error:', err);
        res.status(500).json({ msg: 'Server Error' });
    }
});

module.exports = router;
