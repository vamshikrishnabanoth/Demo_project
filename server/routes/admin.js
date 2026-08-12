const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const auth    = require('../middleware/authMiddleware');
const prisma  = require('../lib/prisma');

// ─── Admin-only middleware ────────────────────────────────────────────────────
const adminOnly = async (req, res, next) => {
    try {
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (!user || user.role !== 'admin') return res.status(403).json({ msg: 'Admin access required' });
        next();
    } catch { res.status(500).json({ msg: 'Server error' }); }
};

// ─── Activity logger helper ──────────────────────────────────────────────────
async function logActivity(adminId, adminName, action, target, targetId, details) {
    try {
        await prisma.activityLog.create({
            data: { adminId, adminName: adminName || 'Admin', action, target, targetId, details: details || {} }
        });
    } catch (e) {
        console.warn('[ActivityLog] Failed to write log:', e.message);
    }
}

// ─── Safe sort column whitelist ───────────────────────────────────────────────
const SAFE_USER_SORT_COLS = new Set(['username','name','email','createdAt','lastLogin','year','semester','section','studentBranch','isSuspended','isOnline']);
function safeSort(col, dir) {
    const column = SAFE_USER_SORT_COLS.has(col) ? col : 'createdAt';
    const direction = dir === 'asc' ? 'asc' : 'desc';
    return { [column]: direction };
}

// ─── Standard user select fields ─────────────────────────────────────────────
const USER_SELECT = {
    id: true, username: true, email: true, name: true, role: true,
    isOnline: true, isSuspended: true, suspensionReason: true,
    studentBranch: true, section: true, year: true, semester: true, academicYear: true,
    createdAt: true, updatedAt: true, lastLogin: true
};

// ══════════════════════════════════════════════════════════════════════════════
// GET /admin/dashboard
// ══════════════════════════════════════════════════════════════════════════════
router.get('/dashboard', auth, adminOnly, async (req, res) => {
    try {
        const roleCounts = await prisma.user.groupBy({ by: ['role'], _count: { id: true } });
        const countMap = {};
        roleCounts.forEach(r => { countMap[r.role] = r._count.id; });

        const students   = countMap['student'] || 0;
        const teachers   = countMap['teacher'] || 0;
        const admins     = countMap['admin']   || 0;
        const totalUsers = students + teachers + admins;

        const yesterday   = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const [activeToday, onlineNow] = await Promise.all([
            prisma.user.count({ where: { lastLogin: { gte: yesterday } } }),
            prisma.user.count({ where: { isOnline: true } })
        ]);

        let recentActivity = [];
        try {
            const logs = await prisma.activityLog.findMany({
                orderBy: { createdAt: 'desc' }, take: 10
            });
            recentActivity = logs.map(l => ({
                id: l.id, action: l.action, target: l.target, targetId: l.targetId,
                adminName: l.adminName, details: l.details, timestamp: l.createdAt
            }));
        } catch {
            const recentUsers = await prisma.user.findMany({
                orderBy: { createdAt: 'desc' }, take: 8,
                select: { id: true, username: true, role: true, createdAt: true, name: true }
            });
            recentActivity = recentUsers.map(u => ({
                id: u.id,
                action: u.role === 'teacher' ? 'TEACHER_CREATED' : u.role === 'admin' ? 'ADMIN_CREATED' : 'STUDENT_CREATED',
                target: u.name || u.username, targetId: u.id,
                adminName: 'System', details: { role: u.role }, timestamp: u.createdAt
            }));
        }

        const [branchDist, yearDist, semesterDist] = await Promise.all([
            prisma.user.groupBy({
                by: ['studentBranch'], where: { role: 'student', studentBranch: { not: null } },
                _count: { id: true }, orderBy: { _count: { id: 'desc' } }
            }),
            prisma.user.groupBy({
                by: ['year'], where: { role: 'student', year: { not: null } },
                _count: { id: true }, orderBy: { year: 'asc' }
            }),
            prisma.user.groupBy({
                by: ['semester'], where: { role: 'student', semester: { not: null } },
                _count: { id: true }, orderBy: { semester: 'asc' }
            })
        ]);

        res.json({
            totalUsers, students, teachers, admins, activeToday, onlineNow, recentActivity,
            charts: {
                branchDistribution: branchDist.map(b => ({ name: b.studentBranch, value: b._count.id })),
                yearDistribution:   yearDist.map(y   => ({ name: `Year ${y.year}`, value: y._count.id })),
                semesterDistribution: semesterDist.map(s => ({ name: `Sem ${s.semester}`, value: s._count.id }))
            }
        });
    } catch (err) {
        console.error('Dashboard error:', err.message);
        res.status(500).json({ msg: 'Server error', error: err.message });
    }
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /admin/stats
// ══════════════════════════════════════════════════════════════════════════════
router.get('/stats', auth, adminOnly, async (req, res) => {
    try {
        const roleCounts = await prisma.user.groupBy({ by: ['role'], _count: { id: true } });
        const countMap = {};
        roleCounts.forEach(r => { countMap[r.role] = r._count.id; });
        const students = countMap['student'] || 0;
        const teachers = countMap['teacher'] || 0;
        const admins   = countMap['admin']   || 0;
        const total    = students + teachers + admins;
        res.json({ total, teachers, students, admins });
    } catch (err) {
        res.status(500).json({ msg: 'Server error' });
    }
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /admin/users (All directory)
// ══════════════════════════════════════════════════════════════════════════════
router.get('/users', auth, adminOnly, async (req, res) => {
    try {
        const page        = parseInt(req.query.page,  10) || 1;
        const limit       = parseInt(req.query.limit, 10) || 30;
        const search      = (req.query.search || '').trim();
        const role        = (req.query.role   || '').trim();
        const branch      = (req.query.branch || req.query.studentBranch || '').trim();
        const year        = (req.query.year || '').trim();
        const semester    = (req.query.semester || '').trim();
        const section     = (req.query.section || '').trim();
        const status      = (req.query.status || '').trim();
        const sortCol     = req.query.sort    || 'createdAt';
        const sortDir     = req.query.sortDir || 'desc';
        const sortBy      = req.query.sortBy;
        const isUnpaginated = req.query.all === 'true';

        const AND_CONDITIONS = [];

        if (role && role !== 'all') AND_CONDITIONS.push({ role });
        if (branch && branch !== 'all') AND_CONDITIONS.push({ studentBranch: { equals: branch, mode: 'insensitive' } });
        if (year && year !== 'all') AND_CONDITIONS.push({ year });
        if (semester && semester !== 'all') AND_CONDITIONS.push({ semester });
        if (section && section !== 'all') AND_CONDITIONS.push({ section: { equals: section, mode: 'insensitive' } });
        if (status === 'suspended') AND_CONDITIONS.push({ isSuspended: true });
        if (status === 'active')    AND_CONDITIONS.push({ isSuspended: false });
        if (search) {
            AND_CONDITIONS.push({
                OR: [
                    { username:     { contains: search, mode: 'insensitive' } },
                    { email:        { contains: search, mode: 'insensitive' } },
                    { name:         { contains: search, mode: 'insensitive' } },
                    { studentBranch:{ contains: search, mode: 'insensitive' } },
                    { section:      { contains: search, mode: 'insensitive' } },
                ]
            });
        }

        const where = AND_CONDITIONS.length > 0 ? { AND: AND_CONDITIONS } : {};

        let orderBy = [];
        if (typeof sortBy === 'string' && sortBy.trim()) {
            const sortPairs = sortBy.split(',');
            sortPairs.forEach(pair => {
                const [field, dir] = pair.split(':');
                if (field && SAFE_USER_SORT_COLS.has(field)) {
                    const direction = dir && dir.toLowerCase() === 'asc' ? 'asc' : 'desc';
                    orderBy.push({ [field]: direction });
                }
            });
        }
        if (orderBy.length === 0) {
            orderBy = safeSort(sortCol, sortDir);
        }

        if (isUnpaginated) {
            const users = await prisma.user.findMany({ where, select: USER_SELECT, orderBy });
            return res.json(users);
        }

        const skip = (page - 1) * limit;
        const [users, totalCount] = await Promise.all([
            prisma.user.findMany({ where, select: USER_SELECT, skip, take: limit, orderBy }),
            prisma.user.count({ where })
        ]);
        res.json({ users, totalCount, totalPages: Math.ceil(totalCount / limit) || 1, currentPage: page, limit });
    } catch (err) {
        console.error('Users fetch error:', err.message);
        res.status(500).json({ msg: 'Server error', error: err.message });
    }
});

// POST create new user
router.post('/users', auth, adminOnly, async (req, res) => {
    const { username, email, password, role, name, studentBranch, section, year, semester, academicYear } = req.body;

    if (!username || !email || !password || !role) {
        return res.status(400).json({ msg: 'Username, email, password, and role are required' });
    }

    if (!['teacher', 'student', 'admin', 'none'].includes(role)) {
        return res.status(400).json({ msg: 'Invalid role' });
    }

    try {
        const cleanUsername = username.trim();
        const cleanEmail = email.trim().toLowerCase();

        let existingUser = await prisma.user.findFirst({
            where: { OR: [{ email: cleanEmail }, { username: cleanUsername }] }
        });
        if (existingUser) {
            return res.status(400).json({ msg: 'User with that email or username already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password.trim(), salt);

        const isStudent = role === 'student';

        const user = await prisma.user.create({
            data: { 
                username: cleanUsername, 
                email: cleanEmail, 
                password: hashedPassword, 
                role,
                name: name ? name.trim() : null,
                studentBranch: studentBranch ? studentBranch.trim() : null,
                section: isStudent ? (section ? section.trim() : null) : null,
                year: isStudent ? (year ? String(year).trim() : null) : null,
                semester: isStudent ? (semester ? String(semester).trim() : null) : null,
                academicYear: isStudent ? (academicYear ? academicYear.trim() : null) : null
            },
            select: USER_SELECT
        });

        const adminUser = await prisma.user.findUnique({ where: { id: req.user.id } });
        logActivity(req.user.id, adminUser?.name || adminUser?.username || 'Admin', `${role.toUpperCase()}_CREATED`, 'User', user.id, { username: user.username, role: user.role });

        res.status(201).json(user);
    } catch (err) {
        console.error('Error creating user:', err.message);
        res.status(500).json({ msg: 'Server error: ' + err.message });
    }
});

// PUT update user
router.put('/users/:id', auth, adminOnly, async (req, res) => {
    const { username, email, password, role, name, studentBranch, section, year, semester, academicYear } = req.body;

    try {
        const user = await prisma.user.findUnique({ where: { id: req.params.id } });
        if (!user) return res.status(404).json({ msg: 'User not found' });

        const updateData = {};
        if (username) updateData.username = username.trim();
        if (email) updateData.email = email.trim().toLowerCase();
        if (name !== undefined) updateData.name = name ? name.trim() : null;
        if (role && ['teacher', 'student', 'admin', 'none'].includes(role)) updateData.role = role;
        if (password && password.trim() !== '') {
            const salt = await bcrypt.genSalt(10);
            updateData.password = await bcrypt.hash(password.trim(), salt);
            updateData.tokenVersion = { increment: 1 };
        }
        if (studentBranch !== undefined) updateData.studentBranch = studentBranch ? studentBranch.trim() : null;
        
        const targetRole = updateData.role || user.role;
        if (targetRole === 'student') {
            if (section !== undefined) updateData.section = section ? section.trim() : null;
            if (year !== undefined) updateData.year = year ? String(year).trim() : null;
            if (semester !== undefined) updateData.semester = semester ? String(semester).trim() : null;
            if (academicYear !== undefined) updateData.academicYear = academicYear ? academicYear.trim() : null;
        } else {
            updateData.section = null;
            updateData.year = null;
            updateData.semester = null;
            updateData.academicYear = null;
        }

        const updatedUser = await prisma.user.update({
            where: { id: req.params.id },
            data: updateData,
            select: USER_SELECT
        });

        const adminUser = await prisma.user.findUnique({ where: { id: req.user.id } });
        logActivity(req.user.id, adminUser?.name || adminUser?.username || 'Admin', 'USER_UPDATED', 'User', updatedUser.id, { username: updatedUser.username, role: updatedUser.role });

        res.json(updatedUser);
    } catch (err) {
        console.error('Error updating user:', err.message);
        res.status(500).json({ msg: 'Server error: ' + err.message });
    }
});

// POST reset password strictly to default `${username}@kk`
router.post('/users/:id/reset-password', auth, adminOnly, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({ where: { id: req.params.id } });
        if (!user) return res.status(404).json({ msg: 'User not found' });

        const defaultPassword = `${user.username}@kk`;
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(defaultPassword, salt);

        await prisma.user.update({
            where: { id: req.params.id },
            data: { 
                password: hashedPassword,
                tokenVersion: { increment: 1 }
            }
        });

        res.json({
            msg: `Password successfully reset to default: ${defaultPassword}`,
            defaultPassword,
            username: user.username
        });
    } catch (err) {
        console.error('Error resetting password:', err.message);
        res.status(500).json({ msg: 'Server error: ' + err.message });
    }
});

// Helper function for safe cascading user deletion
async function safeDeleteUser(userId) {
    // 1. Delete student results
    await prisma.result.deleteMany({ where: { studentId: userId } });
    // 2. Delete broadcasts sent by user
    await prisma.broadcast.deleteMany({ where: { senderId: userId } });
    // 3. If user is a teacher, delete quizzes created by them and related data
    const teacherQuizzes = await prisma.quiz.findMany({ where: { createdById: userId }, select: { id: true } });
    if (teacherQuizzes.length > 0) {
        const quizIds = teacherQuizzes.map(q => q.id);
        await prisma.result.deleteMany({ where: { quizId: { in: quizIds } } });
        await prisma.broadcast.deleteMany({ where: { quizId: { in: quizIds } } });
        await prisma.quiz.deleteMany({ where: { id: { in: quizIds } } });
    }
    // 4. Delete user record
    return await prisma.user.delete({ where: { id: userId } });
}

// PUT toggle suspend user status
const handleUserSuspendToggle = async (req, res) => {
    try {
        const user = await prisma.user.findUnique({ where: { id: req.params.id } });
        if (!user) return res.status(404).json({ msg: 'User not found' });
        if (user.id === req.user.id) return res.status(400).json({ msg: 'Cannot suspend yourself' });

        const updatedUser = await prisma.user.update({
            where: { id: req.params.id },
            data: {
                isSuspended: !user.isSuspended,
                tokenVersion: { increment: 1 }
            },
            select: USER_SELECT
        });

        const adminUser = await prisma.user.findUnique({ where: { id: req.user.id } });
        logActivity(
            req.user.id,
            adminUser?.name || adminUser?.username || 'Admin',
            updatedUser.isSuspended ? 'USER_SUSPENDED' : 'USER_REINSTATED',
            'User',
            updatedUser.id,
            { username: updatedUser.username, role: updatedUser.role }
        );

        res.json(updatedUser);
    } catch (err) {
        console.error('Suspend error:', err.message);
        res.status(500).json({ msg: 'Server error: ' + err.message });
    }
};

router.put('/users/suspend/:id', auth, adminOnly, handleUserSuspendToggle);
router.put('/users/:id/suspend', auth, adminOnly, handleUserSuspendToggle);

// POST bulk suspend users
router.post('/users/bulk-suspend', auth, adminOnly, async (req, res) => {
    try {
        const ids = req.body.ids || req.body.userIds || [];
        const suspend = req.body.suspend !== undefined ? Boolean(req.body.suspend) : true;

        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ msg: 'No user IDs provided' });
        }

        const validIds = ids.filter(id => id !== req.user.id);

        const result = await prisma.user.updateMany({
            where: { id: { in: validIds } },
            data: {
                isSuspended: suspend,
                tokenVersion: { increment: 1 }
            }
        });

        const adminUser = await prisma.user.findUnique({ where: { id: req.user.id } });
        logActivity(
            req.user.id,
            adminUser?.name || adminUser?.username || 'Admin',
            suspend ? 'BULK_USERS_SUSPENDED' : 'BULK_USERS_REINSTATED',
            'Users',
            null,
            { count: result.count, suspend }
        );

        res.json({ msg: `Successfully ${suspend ? 'suspended' : 'reinstated'} ${result.count} users`, count: result.count });
    } catch (err) {
        console.error('Bulk suspend error:', err.message);
        res.status(500).json({ msg: 'Server error: ' + err.message });
    }
});

// DELETE single user
router.delete('/users/:id', auth, adminOnly, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({ where: { id: req.params.id } });
        if (!user) return res.status(404).json({ msg: 'User not found' });
        if (user.id === req.user.id) return res.status(400).json({ msg: 'Cannot delete your own account' });

        await safeDeleteUser(user.id);

        const adminUser = await prisma.user.findUnique({ where: { id: req.user.id } });
        logActivity(req.user.id, adminUser?.name || adminUser?.username || 'Admin', 'USER_DELETED', 'User', user.id, { username: user.username, role: user.role });

        res.json({ msg: 'User deleted successfully' });
    } catch (err) {
        console.error('Error deleting user:', err.message);
        res.status(500).json({ msg: 'Server error: ' + err.message });
    }
});

// POST bulk delete users
router.post('/users/bulk-delete', auth, adminOnly, async (req, res) => {
    try {
        const ids = req.body.ids || req.body.userIds || [];
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ msg: 'No user IDs provided' });
        }

        const validIds = ids.filter(id => id !== req.user.id);
        let deletedCount = 0;

        for (const userId of validIds) {
            try {
                await safeDeleteUser(userId);
                deletedCount++;
            } catch (e) {
                console.error(`Failed to delete user ${userId}:`, e.message);
            }
        }

        const adminUser = await prisma.user.findUnique({ where: { id: req.user.id } });
        logActivity(req.user.id, adminUser?.name || adminUser?.username || 'Admin', 'BULK_USERS_DELETED', 'Users', null, { count: deletedCount });

        res.json({ msg: `Successfully deleted ${deletedCount} users`, count: deletedCount });
    } catch (err) {
        console.error('Bulk delete error:', err.message);
        res.status(500).json({ msg: 'Server error: ' + err.message });
    }
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /admin/students
// ══════════════════════════════════════════════════════════════════════════════
router.get('/students', auth, adminOnly, async (req, res) => {
    try {
        const page     = parseInt(req.query.page,  10) || 1;
        const limit    = parseInt(req.query.limit, 10) || 50;
        const search   = (req.query.search   || '').trim();
        const year     = (req.query.year     || '').trim();
        const semester = (req.query.semester || '').trim();
        const section  = (req.query.section  || '').trim();
        const branch   = (req.query.branch   || '').trim();
        const status   = (req.query.status   || '').trim();
        const sortCol  = req.query.sort      || '';
        const sortDir  = req.query.sortDir   || 'asc';

        const AND_CONDITIONS = [{ role: 'student' }];

        if (year && year !== 'all') AND_CONDITIONS.push({ year: String(year) });
        if (semester && semester !== 'all') AND_CONDITIONS.push({ semester: String(semester) });
        if (section && section !== 'all') AND_CONDITIONS.push({ section: { equals: section, mode: 'insensitive' } });
        if (branch && branch !== 'all') AND_CONDITIONS.push({ studentBranch: { equals: branch, mode: 'insensitive' } });
        if (status === 'suspended') AND_CONDITIONS.push({ isSuspended: true });
        if (status === 'active')    AND_CONDITIONS.push({ isSuspended: false });

        if (search) {
            AND_CONDITIONS.push({
                OR: [
                    { username:      { contains: search, mode: 'insensitive' } },
                    { name:          { contains: search, mode: 'insensitive' } },
                    { email:         { contains: search, mode: 'insensitive' } },
                    { studentBranch: { contains: search, mode: 'insensitive' } },
                    { section:       { contains: search, mode: 'insensitive' } },
                ]
            });
        }

        const where = { AND: AND_CONDITIONS };

        const defaultSortFields = [
            { year: 'asc' },
            { semester: 'asc' },
            { studentBranch: 'asc' },
            { section: 'asc' },
            { username: 'asc' },
            { name: 'asc' }
        ];

        let orderBy = [];
        if (sortCol && SAFE_USER_SORT_COLS.has(sortCol)) {
            const primaryDir = sortDir === 'desc' ? 'desc' : 'asc';
            orderBy.push({ [sortCol]: primaryDir });
            defaultSortFields.forEach(field => {
                const key = Object.keys(field)[0];
                if (key !== sortCol) {
                    orderBy.push(field);
                }
            });
        } else {
            orderBy = defaultSortFields;
        }

        const skip = (page - 1) * limit;

        const [students, totalCount, years, semesters, sections, branches] = await Promise.all([
            prisma.user.findMany({
                where,
                select: { ...USER_SELECT, violationCount: true },
                skip, take: limit, orderBy
            }),
            prisma.user.count({ where }),
            prisma.user.findMany({ where: { role: 'student', year: { not: null } },          select: { year: true },          distinct: ['year'],          orderBy: { year: 'asc' } }),
            prisma.user.findMany({ where: { role: 'student', semester: { not: null } },      select: { semester: true },      distinct: ['semester'],      orderBy: { semester: 'asc' } }),
            prisma.user.findMany({ where: { role: 'student', section: { not: null } },       select: { section: true },       distinct: ['section'],       orderBy: { section: 'asc' } }),
            prisma.user.findMany({ where: { role: 'student', studentBranch: { not: null } }, select: { studentBranch: true }, distinct: ['studentBranch'], orderBy: { studentBranch: 'asc' } }),
        ]);

        res.json({
            students, totalCount,
            totalPages: Math.ceil(totalCount / limit) || 1,
            currentPage: page,
            filterOptions: {
                years:     years.map(y => y.year).filter(Boolean),
                semesters: semesters.map(s => s.semester).filter(Boolean),
                sections:  sections.map(s => s.section).filter(Boolean),
                branches:  branches.map(b => b.studentBranch).filter(Boolean)
            }
        });
    } catch (err) {
        console.error('Students fetch error:', err.message);
        res.status(500).json({ msg: 'Server error', error: err.message });
    }
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /admin/teachers
// ══════════════════════════════════════════════════════════════════════════════
router.get('/teachers', auth, adminOnly, async (req, res) => {
    try {
        const page       = parseInt(req.query.page,  10) || 1;
        const limit      = parseInt(req.query.limit, 10) || 50;
        const search     = (req.query.search     || '').trim();
        const department = (req.query.department || '').trim();
        const status     = (req.query.status     || '').trim();
        const sortCol    = req.query.sort         || 'username';
        const sortDir    = req.query.sortDir      || 'asc';

        const AND_CONDITIONS = [{ role: 'teacher' }];

        if (status === 'suspended') AND_CONDITIONS.push({ isSuspended: true });
        if (status === 'active')    AND_CONDITIONS.push({ isSuspended: false });
        if (department) AND_CONDITIONS.push({ studentBranch: department });

        if (search) {
            AND_CONDITIONS.push({
                OR: [
                    { username: { contains: search, mode: 'insensitive' } },
                    { name:     { contains: search, mode: 'insensitive' } },
                    { email:    { contains: search, mode: 'insensitive' } },
                ]
            });
        }

        const where = { AND: AND_CONDITIONS };
        const orderBy = safeSort(sortCol, sortDir);
        const skip    = (page - 1) * limit;

        const [teachers, totalCount, deptList] = await Promise.all([
            prisma.user.findMany({
                where, select: USER_SELECT, skip, take: limit, orderBy
            }),
            prisma.user.count({ where }),
            prisma.user.findMany({
                where: { role: 'teacher', studentBranch: { not: null } },
                select: { studentBranch: true }, distinct: ['studentBranch'],
                orderBy: { studentBranch: 'asc' }
            })
        ]);

        const mappedTeachers = teachers.map(t => ({
            ...t,
            department: t.studentBranch || null,
        }));

        res.json({
            teachers: mappedTeachers, totalCount,
            totalPages: Math.ceil(totalCount / limit) || 1,
            currentPage: page,
            filterOptions: {
                departments: deptList.map(d => d.studentBranch).filter(Boolean)
            }
        });
    } catch (err) {
        console.error('Teachers fetch error:', err.message);
        res.status(500).json({ msg: 'Server error', error: err.message });
    }
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /admin/admins
// ══════════════════════════════════════════════════════════════════════════════
router.get('/admins', auth, adminOnly, async (req, res) => {
    try {
        const search  = (req.query.search || '').trim();
        const status  = (req.query.status || '').trim();
        const sortCol = req.query.sort    || 'createdAt';
        const sortDir = req.query.sortDir || 'asc';

        const AND_CONDITIONS = [{ role: 'admin' }];
        if (status === 'suspended') AND_CONDITIONS.push({ isSuspended: true });
        if (status === 'active')    AND_CONDITIONS.push({ isSuspended: false });
        if (search) {
            AND_CONDITIONS.push({
                OR: [
                    { username: { contains: search, mode: 'insensitive' } },
                    { email:    { contains: search, mode: 'insensitive' } },
                    { name:     { contains: search, mode: 'insensitive' } },
                ]
            });
        }

        const where = { AND: AND_CONDITIONS };
        const admins = await prisma.user.findMany({
            where, select: USER_SELECT, orderBy: safeSort(sortCol, sortDir)
        });
        res.json({ admins, totalCount: admins.length });
    } catch (err) {
        res.status(500).json({ msg: 'Server error' });
    }
});

// Helper to build normalized semester query filter
function buildSemesterFilter(semStr) {
    if (!semStr || semStr === 'ALL') return null;
    const sem = String(semStr);
    const semValues = [sem];
    if (sem === '3') semValues.push('1');
    if (sem === '4') semValues.push('2');
    if (sem === '5') semValues.push('1');
    if (sem === '6') semValues.push('2');
    if (sem === '7') semValues.push('1');
    if (sem === '8') semValues.push('2');
    return { semester: { in: semValues } };
}

// GET /admin/students/eligible - Query matching students for batch promotion preview
router.get('/students/eligible', auth, adminOnly, async (req, res) => {
    try {
        const { branch = 'ALL', year = 'ALL', semester = 'ALL', section = 'ALL' } = req.query;

        const whereConditions = [{ role: 'student' }];
        if (branch && branch !== 'ALL') whereConditions.push({ studentBranch: { equals: branch, mode: 'insensitive' } });
        if (year && year !== 'ALL') whereConditions.push({ year: String(year) });
        
        const semFilter = buildSemesterFilter(semester);
        if (semFilter) whereConditions.push(semFilter);

        if (section && section !== 'ALL') whereConditions.push({ section: { equals: section, mode: 'insensitive' } });

        const where = { AND: whereConditions };

        const [students, totalCount, availableSections] = await Promise.all([
            prisma.user.findMany({
                where,
                select: { id: true, username: true, name: true, studentBranch: true, year: true, semester: true, section: true },
                take: 200,
                orderBy: [{ year: 'asc' }, { studentBranch: 'asc' }, { section: 'asc' }, { username: 'asc' }]
            }),
            prisma.user.count({ where }),
            prisma.user.findMany({
                where: { role: 'student', section: { not: null } },
                select: { section: true },
                distinct: ['section'],
                orderBy: { section: 'asc' }
            })
        ]);

        res.json({ 
            students, 
            totalCount,
            availableSections: availableSections.map(s => s.section).filter(Boolean)
        });
    } catch (err) {
        console.error('Eligible fetch error:', err.message);
        res.status(500).json({ msg: 'Server error: ' + err.message });
    }
});

// POST /admin/promote/quick - Single-step batch student promotion
router.post('/promote/quick', auth, adminOnly, async (req, res) => {
    try {
        const {
            branch = 'ALL',
            sourceYear = 'ALL',
            sourceSemester = 'ALL',
            sourceSection = 'ALL',
            targetYear = '2',
            targetSemester = '3',
            targetSection = '',
            studentIds = []
        } = req.body;

        const whereConditions = [{ role: 'student' }];

        if (Array.isArray(studentIds) && studentIds.length > 0) {
            whereConditions.push({ id: { in: studentIds } });
        } else {
            if (branch && branch !== 'ALL') whereConditions.push({ studentBranch: { equals: branch, mode: 'insensitive' } });
            if (sourceYear && sourceYear !== 'ALL') whereConditions.push({ year: String(sourceYear) });
            
            const semFilter = buildSemesterFilter(sourceSemester);
            if (semFilter) whereConditions.push(semFilter);

            if (sourceSection && sourceSection !== 'ALL') whereConditions.push({ section: { equals: sourceSection, mode: 'insensitive' } });
        }

        const where = { AND: whereConditions };

        // Handle graduation
        if (targetYear === 'graduated' || targetYear === 'alumni' || targetYear === '5') {
            const deleteRes = await prisma.user.deleteMany({ where });
            const adminUser = await prisma.user.findUnique({ where: { id: req.user.id } });
            logActivity(req.user.id, adminUser?.name || adminUser?.username || 'Admin', 'BATCH_STUDENT_GRADUATED', 'Students', null, { count: deleteRes.count });
            return res.json({
                msg: `Batch graduation completed! ${deleteRes.count} senior student(s) graduated.`,
                promotedCount: 0,
                graduatedCount: deleteRes.count
            });
        }

        const updateData = {
            year: String(targetYear),
            semester: String(targetSemester || '1')
        };
        if (targetSection && targetSection.trim() !== '' && targetSection !== 'keep') {
            updateData.section = targetSection.trim();
        }

        const result = await prisma.user.updateMany({
            where,
            data: updateData
        });

        const adminUser = await prisma.user.findUnique({ where: { id: req.user.id } });
        logActivity(
            req.user.id,
            adminUser?.name || adminUser?.username || 'Admin',
            'BATCH_STUDENT_PROMOTION',
            'Students',
            null,
            { count: result.count, targetYear, targetSemester, targetSection }
        );

        res.json({
            msg: `Successfully promoted ${result.count} student(s) to Year ${targetYear}, Semester ${targetSemester}${targetSection && targetSection !== 'keep' ? `, Section ${targetSection}` : ''}!`,
            promotedCount: result.count
        });
    } catch (err) {
        console.error('Single-step promotion error:', err.message);
        res.status(500).json({ msg: 'Server error: ' + err.message });
    }
});

// Support wizard endpoint fallback
router.post('/promote/wizard', auth, adminOnly, async (req, res) => {
    try {
        const { studentIds, targetYear, targetSemester, targetSection } = req.body;
        if (!Array.isArray(studentIds) || studentIds.length === 0) {
            return res.status(400).json({ msg: 'No students selected for promotion' });
        }

        if (targetYear === 'graduated' || targetYear === '5') {
            const deleteRes = await prisma.user.deleteMany({ where: { id: { in: studentIds } } });
            return res.json({ msg: `Graduated ${deleteRes.count} student(s)`, count: deleteRes.count });
        }

        const updateData = {
            year: String(targetYear),
            semester: String(targetSemester || '1')
        };
        if (targetSection && targetSection !== 'keep') updateData.section = targetSection;

        const result = await prisma.user.updateMany({
            where: { id: { in: studentIds } },
            data: updateData
        });

        res.json({ msg: `Successfully promoted ${result.count} student(s)!`, count: result.count });
    } catch (err) {
        res.status(500).json({ msg: 'Server error: ' + err.message });
    }
});

// POST Step 1 Promotion Preview
router.post('/promote/preview', auth, adminOnly, async (req, res) => {
    try {
        const { sourceYear = '1', targetYear = '2', targetSemester = '1', academicYear = '2025-2026', targetSectionOverride } = req.body;

        const whereClause = { role: 'student' };
        if (sourceYear !== 'all') {
            whereClause.year = String(sourceYear);
        }

        const affectedCount = await prisma.user.count({ where: whereClause });
        const graduatingCount = sourceYear === '4' ? affectedCount : await prisma.user.count({ where: { role: 'student', year: '4' } });

        const students = await prisma.user.findMany({
            where: whereClause,
            select: {
                id: true,
                username: true,
                email: true,
                studentBranch: true,
                section: true,
                year: true,
                semester: true
            },
            take: 15,
            orderBy: [{ section: 'asc' }, { username: 'asc' }]
        });

        const allStudents = await prisma.user.findMany({
            where: whereClause,
            select: { section: true, studentBranch: true }
        });

        const sectionBreakdown = {};
        allStudents.forEach(s => {
            const key = `${s.studentBranch || 'General'}-${s.section || 'Unassigned'}`;
            sectionBreakdown[key] = (sectionBreakdown[key] || 0) + 1;
        });

        res.json({
            sourceYear,
            targetYear,
            targetSemester,
            academicYear,
            targetSectionOverride: targetSectionOverride || 'Keep Current',
            affectedCount,
            graduatingCount,
            sectionBreakdown,
            previewStudents: students
        });
    } catch (err) {
        console.error('Promotion preview error:', err.message);
        res.status(500).json({ msg: 'Server error: ' + err.message });
    }
});

// POST Step 2 Promotion Execution (Batch DB Transaction)
router.post('/promote/confirm', auth, adminOnly, async (req, res) => {
    try {
        const { sourceYear, targetYear, targetSemester, academicYear, targetSectionOverride } = req.body;

        let promotedCount = 0;
        let graduatedCount = 0;

        if (sourceYear === '4') {
            const delRes = await prisma.user.deleteMany({
                where: { role: 'student', year: '4' }
            });
            graduatedCount = delRes.count;
        } else if (sourceYear === 'all') {
            const deleteRes = await prisma.user.deleteMany({
                where: { role: 'student', year: '4' }
            });
            graduatedCount = deleteRes.count;

            const updateData = { semester: targetSemester || '1' };
            if (academicYear) updateData.academicYear = academicYear;
            if (targetSectionOverride && targetSectionOverride !== 'keep') {
                updateData.section = targetSectionOverride;
            }

            const p3 = await prisma.user.updateMany({
                where: { role: 'student', year: '3' },
                data: { ...updateData, year: '4' }
            });

            const p2 = await prisma.user.updateMany({
                where: { role: 'student', year: '2' },
                data: { ...updateData, year: '3' }
            });

            const p1 = await prisma.user.updateMany({
                where: { role: 'student', year: '1' },
                data: { ...updateData, year: '2' }
            });

            promotedCount = p3.count + p2.count + p1.count;
        } else {
            const updateData = {
                year: String(targetYear),
                semester: targetSemester ? String(targetSemester) : '1'
            };
            if (academicYear) updateData.academicYear = academicYear;
            if (targetSectionOverride && targetSectionOverride !== 'keep') {
                updateData.section = targetSectionOverride;
            }

            const promoRes = await prisma.user.updateMany({
                where: { role: 'student', year: String(sourceYear) },
                data: updateData
            });

            promotedCount = promoRes.count;
        }

        res.json({
            msg: `Batch promotion executed successfully! ${promotedCount} students promoted. ${graduatedCount} seniors graduated.`,
            promotedCount,
            graduatedCount
        });
    } catch (err) {
        console.error('Promotion confirmation error:', err.message);
        res.status(500).json({ msg: 'Server error: ' + err.message });
    }
});

// Legacy route fallback for /promote
router.post('/promote', auth, adminOnly, async (req, res) => {
    try {
        const deleteRes = await prisma.user.deleteMany({
            where: { role: 'student', year: '4' }
        });

        await prisma.user.updateMany({
            where: { role: 'student', year: '3' },
            data: { year: '4' }
        });

        await prisma.user.updateMany({
            where: { role: 'student', year: '2' },
            data: { year: '3' }
        });

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

        for (const s of students) {
            const { username, email, password, studentBranch, section, year, semester, academicYear } = s;
            if (!username || !email || !password) {
                errors.push({ email: email || 'unknown', reason: 'Missing username, email, or password' });
                continue;
            }

            try {
                const existing = await prisma.user.findFirst({
                    where: { OR: [{ email }, { username }] }
                });
                if (existing) {
                    errors.push({ email, reason: 'Duplicate username or email already in database' });
                    continue;
                }

                const salt = await bcrypt.genSalt(10);
                const hashedPassword = await bcrypt.hash(password, salt);

                await prisma.user.create({
                    data: {
                        username,
                        email,
                        password: hashedPassword,
                        role: 'student',
                        studentBranch: studentBranch || null,
                        section: section || null,
                        year: year ? String(year) : '1',
                        semester: semester ? String(semester) : '1',
                        academicYear: academicYear || null
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

// ══════════════════════════════════════════════════════════════════════════════
// PIPELINE OBSERVABILITY & REPLAY FRAMEWORK ENDPOINTS
// ══════════════════════════════════════════════════════════════════════════════
const PipelineTracer = require('../engine/tracing/pipelineTracer');
const { renderTraceDashboard } = require('../engine/tracing/dashboardRenderer');
const { replayPipeline } = require('../engine/tracing/replayEngine');

// List recent trace logs
router.get('/traces', async (req, res) => {
    try {
        const traces = PipelineTracer.listTraces(30);
        res.json({ success: true, count: traces.length, traces });
    } catch (err) {
        res.status(500).json({ success: false, msg: err.message });
    }
});

// Render Visual HTML Trace Dashboard
router.get('/trace/:requestId', async (req, res) => {
    try {
        const trace = PipelineTracer.loadTrace(req.params.requestId);
        if (!trace) {
            return res.status(404).send(`<h1>Trace Not Found</h1><p>No trace file found for request ID: ${req.params.requestId}</p>`);
        }
        const html = renderTraceDashboard(trace);
        res.setHeader('Content-Type', 'text/html');
        res.send(html);
    } catch (err) {
        res.status(500).send(`<h1>Dashboard Error</h1><p>${err.message}</p>`);
    }
});

// Download Raw Trace JSON
router.get('/trace/:requestId/json', async (req, res) => {
    try {
        const trace = PipelineTracer.loadTrace(req.params.requestId);
        if (!trace) {
            return res.status(404).json({ success: false, msg: 'Trace not found' });
        }
        res.json(trace);
    } catch (err) {
        res.status(500).json({ success: false, msg: err.message });
    }
});

// Trigger Pipeline Replay & Drift Analysis
router.post('/trace/:requestId/replay', async (req, res) => {
    try {
        const replayResult = await replayPipeline(req.params.requestId);
        res.json({ success: true, ...replayResult });
    } catch (err) {
        res.status(500).json({ success: false, msg: err.message });
    }
});

module.exports = router;
