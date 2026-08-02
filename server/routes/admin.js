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
        const status      = (req.query.status || '').trim();
        const sortCol     = req.query.sort    || 'createdAt';
        const sortDir     = req.query.sortDir || 'desc';
        const isUnpaginated = req.query.all === 'true';

        const AND_CONDITIONS = [];

        if (role && role !== 'all') AND_CONDITIONS.push({ role });
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

        const AND_CONDITIONS = [{ role: 'student' }];

        if (year) {
            AND_CONDITIONS.push({ year: { equals: year, mode: 'insensitive' } });
        }
        if (semester) {
            AND_CONDITIONS.push({ semester: { equals: semester, mode: 'insensitive' } });
        }
        if (section) {
            AND_CONDITIONS.push({ section: { equals: section, mode: 'insensitive' } });
        }
        if (branch) {
            AND_CONDITIONS.push({ studentBranch: { equals: branch, mode: 'insensitive' } });
        }
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
        if (department) AND_CONDITIONS.push({ studentBranch: { equals: department, mode: 'insensitive' } });

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

module.exports = router;
