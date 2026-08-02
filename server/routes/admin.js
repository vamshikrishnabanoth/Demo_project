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
        // Non-fatal — don't break main operation if logging fails
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
    studentBranch: true, section: true, year: true, semester: true,
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

        // Real activity log
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
            // ActivityLog table may not exist yet on older deployments
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

        // Charts
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
// GET /admin/stats  (lightweight — for quick refresh)
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
// GET /admin/activity  (paginated audit log)
// ══════════════════════════════════════════════════════════════════════════════
router.get('/activity', auth, adminOnly, async (req, res) => {
    try {
        const page  = parseInt(req.query.page,  10) || 1;
        const limit = parseInt(req.query.limit, 10) || 20;
        const skip  = (page - 1) * limit;
        let logs = [], totalCount = 0;
        try {
            [logs, totalCount] = await Promise.all([
                prisma.activityLog.findMany({ orderBy: { createdAt: 'desc' }, skip, take: limit }),
                prisma.activityLog.count()
            ]);
        } catch {
            // Table not yet created on this deployment
        }
        res.json({ logs, totalCount, totalPages: Math.ceil(totalCount / limit) || 1, currentPage: page });
    } catch (err) {
        res.status(500).json({ msg: 'Server error' });
    }
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /admin/users  (all users, paginated, filtered, sorted)
// ══════════════════════════════════════════════════════════════════════════════
router.get('/users', auth, adminOnly, async (req, res) => {
    try {
        const page        = parseInt(req.query.page,  10) || 1;
        const limit       = parseInt(req.query.limit, 10) || 20;
        const search      = (req.query.search || '').trim();
        const role        = (req.query.role   || '').trim();
        const status      = (req.query.status || '').trim();
        const sortCol     = req.query.sort    || 'createdAt';
        const sortDir     = req.query.sortDir || 'desc';
        const isUnpaginated = req.query.all === 'true';

        const where = {};
        if (role && role !== 'all') where.role = role;
        if (status === 'suspended') where.isSuspended = true;
        if (status === 'active')    where.isSuspended = false;
        if (search) {
            where.OR = [
                { username:     { contains: search, mode: 'insensitive' } },
                { email:        { contains: search, mode: 'insensitive' } },
                { name:         { contains: search, mode: 'insensitive' } },
                { studentBranch:{ contains: search, mode: 'insensitive' } },
                { section:      { contains: search, mode: 'insensitive' } },
            ];
        }

        const orderBy = safeSort(sortCol, sortDir);
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

        console.log('[Admin Students API] Incoming query params:', { page, limit, search, year, semester, section, branch, status, sortCol, sortDir });

        const where = { role: 'student' };

        if (year) {
            const numY = parseInt(year, 10);
            const yearOptions = [year];
            if (!isNaN(numY)) yearOptions.push(String(numY));
            where.year = { in: Array.from(new Set(yearOptions)) };
        }

        if (semester) {
            const numS = parseInt(semester, 10);
            const semOptions = [semester];
            if (!isNaN(numS)) semOptions.push(String(numS));
            where.semester = { in: Array.from(new Set(semOptions)) };
        }

        if (section)  where.section       = { equals: section, mode: 'insensitive' };
        if (branch)   where.studentBranch = { equals: branch, mode: 'insensitive' };
        if (status === 'suspended') where.isSuspended = true;
        if (status === 'active')    where.isSuspended = false;

        if (search) {
            where.OR = [
                { username:      { contains: search, mode: 'insensitive' } },
                { name:          { contains: search, mode: 'insensitive' } },
                { email:         { contains: search, mode: 'insensitive' } },
                { studentBranch: { contains: search, mode: 'insensitive' } },
                { section:       { contains: search, mode: 'insensitive' } },
            ];
        }

        // Mandated Multi-Column Sorting Order:
        // 1. Year (asc)
        // 2. Semester (asc)
        // 3. Branch (asc)
        // 4. Section (asc)
        // 5. Roll Number / Username (asc)
        // 6. Name (asc)
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

        console.log('[Admin Students API] Final DB filter (where):', JSON.stringify(where, null, 2));
        console.log('[Admin Students API] Final DB sort (orderBy):', JSON.stringify(orderBy, null, 2));

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
                years:     years.map(y => y.year),
                semesters: semesters.map(s => s.semester),
                sections:  sections.map(s => s.section),
                branches:  branches.map(b => b.studentBranch)
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

        const where = { role: 'teacher' };
        if (status === 'suspended') where.isSuspended = true;
        if (status === 'active')    where.isSuspended = false;
        // FIX: department filter now actually applied (uses studentBranch field for teachers)
        if (department) where.studentBranch = { contains: department, mode: 'insensitive' };
        if (search) {
            where.OR = [
                { username: { contains: search, mode: 'insensitive' } },
                { name:     { contains: search, mode: 'insensitive' } },
                { email:    { contains: search, mode: 'insensitive' } },
            ];
        }

        const orderBy = safeSort(sortCol, sortDir);
        const skip    = (page - 1) * limit;

        const [teachers, totalCount, deptList] = await Promise.all([
            prisma.user.findMany({
                where, select: USER_SELECT, skip, take: limit, orderBy
            }),
            prisma.user.count({ where }),
            // Real department list from DB
            prisma.user.findMany({
                where: { role: 'teacher', studentBranch: { not: null } },
                select: { studentBranch: true }, distinct: ['studentBranch'],
                orderBy: { studentBranch: 'asc' }
            })
        ]);

        // Map studentBranch → department for display; no hardcoded fake data
        const mappedTeachers = teachers.map(t => ({
            ...t,
            department: t.studentBranch || null,
        }));

        res.json({
            teachers: mappedTeachers, totalCount,
            totalPages: Math.ceil(totalCount / limit) || 1,
            currentPage: page,
            filterOptions: {
                departments: deptList.map(d => d.studentBranch)
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
        const where   = { role: 'admin' };
        if (status === 'suspended') where.isSuspended = true;
        if (status === 'active')    where.isSuspended = false;
        if (search) {
            where.OR = [
                { username: { contains: search, mode: 'insensitive' } },
                { email:    { contains: search, mode: 'insensitive' } },
                { name:     { contains: search, mode: 'insensitive' } },
            ];
        }
        const admins = await prisma.user.findMany({
            where, select: USER_SELECT, orderBy: safeSort(sortCol, sortDir)
        });
        res.json({ admins, totalCount: admins.length });
    } catch (err) {
        res.status(500).json({ msg: 'Server error' });
    }
});

// ══════════════════════════════════════════════════════════════════════════════
// POST /admin/users  (create single user)
// ══════════════════════════════════════════════════════════════════════════════
router.post('/users', auth, adminOnly, async (req, res) => {
    const { username, email, password, role, name, studentBranch, section, year, semester, department } = req.body;
    if (!username || !email || !password || !role)
        return res.status(400).json({ msg: 'Username, email, password and role are required' });
    if (!['teacher','student','admin','none'].includes(role))
        return res.status(400).json({ msg: 'Invalid role' });
    try {
        // Duplicate check
        const existing = await prisma.user.findFirst({
            where: { OR: [{ email: email.toLowerCase() }, { username }] }
        });
        if (existing) {
            const field = existing.email.toLowerCase() === email.toLowerCase() ? 'email' : 'username';
            return res.status(400).json({ msg: `A user with that ${field} already exists` });
        }
        const hashed = await bcrypt.hash(password, 10);
        const dept   = studentBranch || department || null;
        const user = await prisma.user.create({
            data: {
                username, email: email.toLowerCase(), password: hashed, role,
                name: name || null,
                studentBranch: dept,
                section: section || null,
                year:     year     ? String(year)     : null,
                semester: semester ? String(semester) : null,
            },
            select: USER_SELECT
        });
        // Log activity
        const admin = await prisma.user.findUnique({ where: { id: req.user.id }, select: { name: true, username: true } });
        await logActivity(req.user.id, admin?.name || admin?.username, `${role.toUpperCase()}_CREATED`, user.name || user.username, user.id, { role, branch: dept });
        res.status(201).json(user);
    } catch (err) {
        console.error('Create user error:', err.message);
        res.status(500).json({ msg: 'Server error: ' + err.message });
    }
});

// ══════════════════════════════════════════════════════════════════════════════
// PUT /admin/users/:id  (update user)
// ══════════════════════════════════════════════════════════════════════════════
router.put('/users/:id', auth, adminOnly, async (req, res) => {
    const { username, email, password, role, name, studentBranch, section, year, semester, department } = req.body;
    try {
        const user = await prisma.user.findUnique({ where: { id: req.params.id } });
        if (!user) return res.status(404).json({ msg: 'User not found' });

        // Duplicate check (exclude self)
        if (email && email.toLowerCase() !== user.email) {
            const dup = await prisma.user.findFirst({ where: { email: email.toLowerCase(), id: { not: req.params.id } } });
            if (dup) return res.status(400).json({ msg: 'Email already in use by another account' });
        }
        if (username && username !== user.username) {
            const dup = await prisma.user.findFirst({ where: { username, id: { not: req.params.id } } });
            if (dup) return res.status(400).json({ msg: 'Username already taken' });
        }

        const data = {};
        if (username !== undefined)  data.username     = username;
        if (email !== undefined)     data.email        = email.toLowerCase();
        if (name  !== undefined)     data.name         = name;
        if (role  !== undefined && ['teacher','student','admin','none'].includes(role)) data.role = role;
        if (password && password.trim())  data.password = await bcrypt.hash(password, 10);
        const dept = studentBranch !== undefined ? studentBranch : department;
        if (dept !== undefined)      data.studentBranch = dept || null;
        if (section  !== undefined)  data.section       = section || null;
        if (year     !== undefined)  data.year          = year ? String(year) : null;
        if (semester !== undefined)  data.semester      = semester ? String(semester) : null;

        const updated = await prisma.user.update({
            where: { id: req.params.id }, data, select: USER_SELECT
        });
        const admin = await prisma.user.findUnique({ where: { id: req.user.id }, select: { name: true, username: true } });
        await logActivity(req.user.id, admin?.name || admin?.username, 'USER_UPDATED', updated.name || updated.username, updated.id, { role: updated.role });
        res.json(updated);
    } catch (err) {
        console.error('Update user error:', err.message);
        res.status(500).json({ msg: 'Server error: ' + err.message });
    }
});

// ══════════════════════════════════════════════════════════════════════════════
// PUT /admin/users/:id/reset-password  (dedicated password reset)
// ══════════════════════════════════════════════════════════════════════════════
router.put('/users/:id/reset-password', auth, adminOnly, async (req, res) => {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.trim().length < 6)
        return res.status(400).json({ msg: 'Password must be at least 6 characters' });
    try {
        const user = await prisma.user.findUnique({ where: { id: req.params.id } });
        if (!user) return res.status(404).json({ msg: 'User not found' });
        const hashed = await bcrypt.hash(newPassword.trim(), 10);
        await prisma.user.update({
            where: { id: req.params.id },
            data: { password: hashed, tokenVersion: { increment: 1 } }
        });
        const admin = await prisma.user.findUnique({ where: { id: req.user.id }, select: { name: true, username: true } });
        await logActivity(req.user.id, admin?.name || admin?.username, 'PASSWORD_RESET', user.name || user.username, user.id, { role: user.role });
        res.json({ msg: 'Password reset successfully' });
    } catch (err) {
        res.status(500).json({ msg: 'Server error' });
    }
});

// ══════════════════════════════════════════════════════════════════════════════
// DELETE /admin/users/:id
// ══════════════════════════════════════════════════════════════════════════════
router.delete('/users/:id', auth, adminOnly, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({ where: { id: req.params.id } });
        if (!user) return res.status(404).json({ msg: 'User not found' });
        if (user.id === req.user.id) return res.status(400).json({ msg: 'You cannot delete your own account' });
        await prisma.user.delete({ where: { id: req.params.id } });
        const admin = await prisma.user.findUnique({ where: { id: req.user.id }, select: { name: true, username: true } });
        await logActivity(req.user.id, admin?.name || admin?.username, 'USER_DELETED', user.name || user.username, user.id, { role: user.role });
        res.json({ msg: 'User deleted successfully' });
    } catch (err) {
        console.error('Delete error:', err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

// ══════════════════════════════════════════════════════════════════════════════
// PUT /admin/users/suspend/:id  (toggle suspend)
// ══════════════════════════════════════════════════════════════════════════════
router.put('/users/suspend/:id', auth, adminOnly, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({ where: { id: req.params.id } });
        if (!user) return res.status(404).json({ msg: 'User not found' });
        if (user.id === req.user.id) return res.status(400).json({ msg: 'You cannot suspend yourself' });
        const nowSuspended = !user.isSuspended;
        const updated = await prisma.user.update({
            where: { id: req.params.id },
            data: {
                isSuspended:     nowSuspended,
                suspensionReason: nowSuspended ? (req.body.reason || 'Suspended by Administrator') : null,
                tokenVersion:    { increment: 1 }
            },
            select: { id: true, isSuspended: true, suspensionReason: true, username: true, name: true, role: true }
        });
        const admin = await prisma.user.findUnique({ where: { id: req.user.id }, select: { name: true, username: true } });
        await logActivity(req.user.id, admin?.name || admin?.username, nowSuspended ? 'USER_SUSPENDED' : 'USER_REINSTATED', user.name || user.username, user.id, { role: user.role });
        res.json(updated);
    } catch (err) {
        res.status(500).json({ msg: 'Server error' });
    }
});

// ══════════════════════════════════════════════════════════════════════════════
// POST /admin/users/bulk-delete
// ══════════════════════════════════════════════════════════════════════════════
router.post('/users/bulk-delete', auth, adminOnly, async (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0)
        return res.status(400).json({ msg: 'ids array is required' });
    // Never allow self-deletion in bulk
    const safeIds = ids.filter(id => id !== req.user.id);
    if (safeIds.length === 0)
        return res.status(400).json({ msg: 'Cannot delete your own account' });
    try {
        const result = await prisma.user.deleteMany({ where: { id: { in: safeIds } } });
        const admin  = await prisma.user.findUnique({ where: { id: req.user.id }, select: { name: true, username: true } });
        await logActivity(req.user.id, admin?.name || admin?.username, 'BULK_DELETED', `${result.count} users`, null, { count: result.count });
        res.json({ msg: `${result.count} user(s) deleted successfully`, count: result.count });
    } catch (err) {
        console.error('Bulk delete error:', err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

// ══════════════════════════════════════════════════════════════════════════════
// POST /admin/users/bulk-suspend
// ══════════════════════════════════════════════════════════════════════════════
router.post('/users/bulk-suspend', auth, adminOnly, async (req, res) => {
    const { ids, suspend } = req.body; // suspend: boolean
    if (!Array.isArray(ids) || ids.length === 0)
        return res.status(400).json({ msg: 'ids array is required' });
    const safeIds = ids.filter(id => id !== req.user.id);
    try {
        const result = await prisma.user.updateMany({
            where: { id: { in: safeIds } },
            data: {
                isSuspended:      !!suspend,
                suspensionReason: suspend ? 'Bulk suspended by Administrator' : null
            }
        });
        const admin = await prisma.user.findUnique({ where: { id: req.user.id }, select: { name: true, username: true } });
        await logActivity(req.user.id, admin?.name || admin?.username, suspend ? 'BULK_SUSPENDED' : 'BULK_REINSTATED', `${result.count} users`, null, { count: result.count });
        res.json({ msg: `${result.count} user(s) ${suspend ? 'suspended' : 'reinstated'} successfully`, count: result.count });
    } catch (err) {
        res.status(500).json({ msg: 'Server error' });
    }
});

// ══════════════════════════════════════════════════════════════════════════════
// POST /admin/promote/semester  (promote selected students by +1 semester)
// ══════════════════════════════════════════════════════════════════════════════
router.post('/promote/semester', auth, adminOnly, async (req, res) => {
    // Promote by filter OR by specific IDs
    const { ids, year, semester, branch, section } = req.body;
    try {
        let targetIds = ids;
        if (!targetIds || !Array.isArray(targetIds) || targetIds.length === 0) {
            // Build from filters
            const where = { role: 'student' };
            if (year)     where.year          = String(year);
            if (semester) where.semester      = String(semester);
            if (branch)   where.studentBranch = branch;
            if (section)  where.section       = section;
            const targets = await prisma.user.findMany({ where, select: { id: true } });
            targetIds = targets.map(t => t.id);
        }
        if (targetIds.length === 0)
            return res.status(400).json({ msg: 'No students matched the filter' });

        // Get all students to be promoted
        const students = await prisma.user.findMany({
            where: { id: { in: targetIds }, role: 'student' },
            select: { id: true, year: true, semester: true }
        });

        // Group by current year/semester to compute next
        const updates = students.map(s => {
            const curYear = parseInt(s.year || '1', 10);
            const curSem  = parseInt(s.semester || '1', 10);
            let newYear = curYear, newSem = curSem + 1;
            // When semester exceeds 2 per year (1,2 → 3,4 → 5,6 → 7,8), advance year
            if (newSem > curYear * 2) { newYear = curYear + 1; newSem = (curYear * 2) + 1; }
            // Cap at year 4 sem 8
            if (newYear > 4) { newYear = 4; newSem = 8; }
            return prisma.user.update({
                where: { id: s.id },
                data: { year: String(newYear), semester: String(newSem) }
            });
        });
        await Promise.all(updates);

        const admin = await prisma.user.findUnique({ where: { id: req.user.id }, select: { name: true, username: true } });
        await logActivity(req.user.id, admin?.name || admin?.username, 'SEMESTER_PROMOTED', `${students.length} students`, null, { count: students.length, year, semester, branch, section });
        res.json({ msg: `${students.length} student(s) promoted to next semester`, count: students.length });
    } catch (err) {
        console.error('Semester promote error:', err.message);
        res.status(500).json({ msg: 'Server error: ' + err.message });
    }
});

// ══════════════════════════════════════════════════════════════════════════════
// POST /admin/promote/year  (promote entire year cohort)
// ══════════════════════════════════════════════════════════════════════════════
router.post('/promote/year', auth, adminOnly, async (req, res) => {
    // graduateYear4: if true, delete 4th year students (graduated)
    const { fromYear, toYear, branch, section, graduateYear4 } = req.body;
    if (!fromYear || !toYear)
        return res.status(400).json({ msg: 'fromYear and toYear are required' });
    if (parseInt(toYear) !== parseInt(fromYear) + 1)
        return res.status(400).json({ msg: 'toYear must be fromYear + 1' });
    try {
        const where = { role: 'student', year: String(fromYear) };
        if (branch)  where.studentBranch = branch;
        if (section) where.section       = section;

        // Calculate new semester (first semester of new year)
        const newYear     = String(toYear);
        const newSemester = String((parseInt(toYear) - 1) * 2 + 1); // Year 2 → Sem 3, Year 3 → Sem 5 etc.

        let promotedCount = 0, graduatedCount = 0;

        if (parseInt(fromYear) === 4 && graduateYear4) {
            const result = await prisma.user.deleteMany({ where });
            graduatedCount = result.count;
        } else if (parseInt(fromYear) === 4 && !graduateYear4) {
            return res.status(400).json({ msg: 'Cannot promote Year 4 beyond 4th year without graduation flag' });
        } else {
            const result = await prisma.user.updateMany({
                where, data: { year: newYear, semester: newSemester }
            });
            promotedCount = result.count;
        }

        const admin = await prisma.user.findUnique({ where: { id: req.user.id }, select: { name: true, username: true } });
        await logActivity(req.user.id, admin?.name || admin?.username, 'YEAR_PROMOTED', `Year ${fromYear} → Year ${toYear}`, null, { fromYear, toYear, promoted: promotedCount, graduated: graduatedCount, branch, section });
        res.json({ msg: `Year promotion complete. Promoted: ${promotedCount}, Graduated: ${graduatedCount}`, promotedCount, graduatedCount });
    } catch (err) {
        console.error('Year promote error:', err.message);
        res.status(500).json({ msg: 'Server error: ' + err.message });
    }
});

// ══════════════════════════════════════════════════════════════════════════════
// POST /admin/promote  (legacy — full batch year shift, kept for compatibility)
// ══════════════════════════════════════════════════════════════════════════════
router.post('/promote', auth, adminOnly, async (req, res) => {
    try {
        const deleteRes = await prisma.user.deleteMany({ where: { role: 'student', year: '4' } });
        await prisma.user.updateMany({ where: { role: 'student', year: '3' }, data: { year: '4', semester: '7' } });
        await prisma.user.updateMany({ where: { role: 'student', year: '2' }, data: { year: '3', semester: '5' } });
        await prisma.user.updateMany({ where: { role: 'student', year: '1' }, data: { year: '2', semester: '3' } });
        const admin = await prisma.user.findUnique({ where: { id: req.user.id }, select: { name: true, username: true } });
        await logActivity(req.user.id, admin?.name || admin?.username, 'FULL_BATCH_PROMOTED', 'All students', null, { graduated: deleteRes.count });
        res.json({ msg: 'Full batch year promotion completed!', graduatedCount: deleteRes.count });
    } catch (err) {
        res.status(500).json({ msg: 'Server error: ' + err.message });
    }
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /admin/students/eligible  (Fetch eligible students for Promotion Wizard)
// ══════════════════════════════════════════════════════════════════════════════
router.get('/students/eligible', auth, adminOnly, async (req, res) => {
    try {
        const { branch, year, semester, section } = req.query;
        const where = { role: 'student' };
        if (branch && branch !== 'ALL')   where.studentBranch = branch;
        if (year && year !== 'ALL')       where.year          = String(year);
        if (semester && semester !== 'ALL') where.semester    = String(semester);
        if (section && section !== 'ALL')  where.section       = section;

        const students = await prisma.user.findMany({
            where,
            select: {
                id: true, username: true, name: true, email: true,
                studentBranch: true, year: true, semester: true, section: true, isSuspended: true
            },
            orderBy: [{ year: 'asc' }, { section: 'asc' }, { username: 'asc' }]
        });

        res.json({ students, count: students.length });
    } catch (err) {
        console.error('Eligible students error:', err.message);
        res.status(500).json({ msg: 'Server error: ' + err.message });
    }
});

// ══════════════════════════════════════════════════════════════════════════════
// POST /admin/promote/wizard  (Execute 8-step wizard promotion)
// ══════════════════════════════════════════════════════════════════════════════
router.post('/promote/wizard', auth, adminOnly, async (req, res) => {
    try {
        const { studentIds, targetYear, targetSemester, targetSection } = req.body;

        if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
            return res.status(400).json({ msg: 'No students selected for promotion' });
        }
        if (!targetYear || !targetSemester) {
            return res.status(400).json({ msg: 'Target year and semester are required' });
        }

        const updateData = {
            year: String(targetYear),
            semester: String(targetSemester)
        };
        if (targetSection) {
            updateData.section = targetSection;
        }

        const result = await prisma.user.updateMany({
            where: { id: { in: studentIds }, role: 'student' },
            data: updateData
        });

        const admin = await prisma.user.findUnique({ where: { id: req.user.id }, select: { name: true, username: true } });
        await logActivity(
            req.user.id,
            admin?.name || admin?.username,
            'STUDENT_PROMOTED',
            `${result.count} students promoted to Year ${targetYear} / Sem ${targetSemester}`,
            null,
            { count: result.count, targetYear, targetSemester, targetSection }
        );

        res.json({
            msg: `Successfully promoted ${result.count} student(s) to Year ${targetYear}, Semester ${targetSemester}${targetSection ? `, Section ${targetSection}` : ''}!`,
            promotedCount: result.count
        });
    } catch (err) {
        console.error('Wizard promote error:', err.message);
        res.status(500).json({ msg: 'Server error: ' + err.message });
    }
});

// ══════════════════════════════════════════════════════════════════════════════
// POST /admin/import/validate  (Pre-validate CSV batch against DB)
// ══════════════════════════════════════════════════════════════════════════════
router.post('/import/validate', auth, adminOnly, async (req, res) => {
    try {
        const { students } = req.body;
        if (!students || !Array.isArray(students)) {
            return res.status(400).json({ msg: 'students array is required' });
        }

        const usernames = students.map(s => s.rollNumber || s.username).filter(Boolean);
        const emails    = students.map(s => (s.email || '').toLowerCase()).filter(Boolean);

        // Fetch existing users from DB matching usernames or emails
        const existingUsers = await prisma.user.findMany({
            where: {
                OR: [
                    { username: { in: usernames } },
                    { email: { in: emails } }
                ]
            },
            select: { username: true, email: true }
        });

        const dbUsernames = new Set(existingUsers.map(u => u.username));
        const dbEmails    = new Set(existingUsers.map(u => u.email.toLowerCase()));

        const seenUsernames = new Set();
        const seenEmails    = new Set();

        const valid = [];
        const invalid = [];

        students.forEach((s, idx) => {
            const rollNumber = (s.rollNumber || s.username || '').trim();
            const name       = (s.name || s.fullName || '').trim();
            const email      = (s.email || '').trim().toLowerCase();
            const branch     = (s.branch || s.studentBranch || '').trim();
            const year       = String(s.year || '').trim();
            const semester   = String(s.semester || '').trim();
            const section    = (s.section || '').trim();

            const rowNum = idx + 1;
            const reasons = [];

            if (!rollNumber) reasons.push('Missing Roll Number');
            if (!name)       reasons.push('Missing Full Name');
            if (!email)      reasons.push('Missing Email');
            else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) reasons.push('Invalid Email Format');
            if (!branch)     reasons.push('Missing Branch');
            if (!year || !['1','2','3','4'].includes(year)) reasons.push('Invalid/Missing Academic Year (1-4)');
            if (!semester || !['1','2','3','4','5','6','7','8'].includes(semester)) reasons.push('Invalid/Missing Semester (1-8)');
            if (!section)    reasons.push('Missing Section');

            // DB Duplicates
            if (rollNumber && dbUsernames.has(rollNumber)) reasons.push(`Roll Number '${rollNumber}' already exists in database`);
            if (email && dbEmails.has(email))             reasons.push(`Email '${email}' already exists in database`);

            // File Duplicates
            if (rollNumber && seenUsernames.has(rollNumber)) reasons.push(`Duplicate Roll Number '${rollNumber}' in file`);
            if (email && seenEmails.has(email))             reasons.push(`Duplicate Email '${email}' in file`);

            if (rollNumber) seenUsernames.add(rollNumber);
            if (email)      seenEmails.add(email);

            if (reasons.length > 0) {
                invalid.push({ rowNum, rollNumber, name, email, reasons: reasons.join('; ') });
            } else {
                valid.push({
                    username: rollNumber,
                    name,
                    email,
                    password: `${rollNumber}@kk`,
                    studentBranch: branch,
                    year,
                    semester,
                    section,
                    role: 'student'
                });
            }
        });

        res.json({
            total: students.length,
            validCount: valid.length,
            invalidCount: invalid.length,
            valid,
            invalid
        });
    } catch (err) {
        console.error('Validation error:', err.message);
        res.status(500).json({ msg: 'Server error: ' + err.message });
    }
});

// ══════════════════════════════════════════════════════════════════════════════
// POST /admin/import  (bulk CSV import with transaction)
// ══════════════════════════════════════════════════════════════════════════════
router.post('/import', auth, adminOnly, async (req, res) => {
    const { students } = req.body;
    if (!students || !Array.isArray(students) || students.length === 0)
        return res.status(400).json({ msg: 'students array is required' });
    try {
        let successCount = 0;
        const errors = [];
        for (const s of students) {
            const { username, email, password, studentBranch, section, year, semester, name } = s;
            if (!username || !email || !password) {
                errors.push({ id: username || email || '?', reason: 'Missing username, email, or password' });
                continue;
            }
            try {
                const existing = await prisma.user.findFirst({ where: { OR: [{ email: email.toLowerCase() }, { username }] } });
                if (existing) { errors.push({ id: username, reason: 'Duplicate username or email' }); continue; }
                const hashed = await bcrypt.hash(password, 10);
                await prisma.user.create({
                    data: {
                        username, email: email.toLowerCase(), password: hashed, role: 'student',
                        name: name || null,
                        studentBranch: studentBranch || null,
                        section: section || null,
                        year:     year     ? String(year)     : '1',
                        semester: semester ? String(semester) : '1',
                    }
                });
                successCount++;
            } catch (innerErr) {
                errors.push({ id: username, reason: innerErr.message });
            }
        }
        const admin = await prisma.user.findUnique({ where: { id: req.user.id }, select: { name: true, username: true } });
        await logActivity(req.user.id, admin?.name || admin?.username, 'BULK_IMPORT', `${successCount} students imported`, null, { total: students.length, success: successCount, failed: errors.length });
        res.json({ msg: `Import complete. Imported: ${successCount}, Failed: ${errors.length}`, successCount, failureCount: errors.length, errors });
    } catch (err) {
        res.status(500).json({ msg: 'Server error: ' + err.message });
    }
});

module.exports = router;
