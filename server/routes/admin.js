const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const auth = require('../middleware/authMiddleware');
const prisma = require('../lib/prisma');

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

// ─── GET /admin/dashboard ─────────────────────────────────────────────────────
// Returns overview stats, recent activity, system health counts
router.get('/dashboard', auth, adminOnly, async (req, res) => {
    try {
        // Accurate role-based counts via groupBy
        const roleCounts = await prisma.user.groupBy({
            by: ['role'],
            _count: { id: true }
        });

        const countMap = {};
        roleCounts.forEach(r => { countMap[r.role] = r._count.id; });

        const students = countMap['student'] || 0;
        const teachers = countMap['teacher'] || 0;
        const admins   = countMap['admin']   || 0;
        // Total = sum of known roles (excludes 'none' role users from total)
        const totalUsers = students + teachers + admins;

        // Active today: users who logged in within the last 24 hours
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const activeToday = await prisma.user.count({
            where: { lastLogin: { gte: yesterday } }
        });

        // Online right now
        const onlineNow = await prisma.user.count({ where: { isOnline: true } });

        // Recent activity: 10 most recently created users (as proxy for recent activity)
        const recentUsers = await prisma.user.findMany({
            orderBy: { createdAt: 'desc' },
            take: 6,
            select: { id: true, username: true, role: true, createdAt: true, name: true }
        });

        const recentActivity = recentUsers.map(u => ({
            id: u.id,
            type: u.role === 'teacher' ? 'teacher_added' : u.role === 'admin' ? 'admin_added' : 'student_added',
            message: `${u.role === 'teacher' ? '👨🏫 New Teacher' : u.role === 'admin' ? '🛡️ New Admin' : '🎓 New Student'} ${u.name || u.username} registered`,
            timestamp: u.createdAt,
            user: { name: u.name || u.username, role: u.role }
        }));

        // Branch distribution for students
        const branchDist = await prisma.user.groupBy({
            by: ['studentBranch'],
            where: { role: 'student', studentBranch: { not: null } },
            _count: { id: true },
            orderBy: { _count: { id: 'desc' } }
        });

        // Year distribution for students
        const yearDist = await prisma.user.groupBy({
            by: ['year'],
            where: { role: 'student', year: { not: null } },
            _count: { id: true },
            orderBy: { year: 'asc' }
        });

        res.json({
            totalUsers,
            students,
            teachers,
            admins,
            activeToday,
            onlineNow,
            recentActivity,
            charts: {
                branchDistribution: branchDist.map(b => ({ name: b.studentBranch, value: b._count.id })),
                yearDistribution:   yearDist.map(y => ({ name: `Year ${y.year}`, value: y._count.id }))
            }
        });
    } catch (err) {
        console.error('Dashboard fetch error:', err.message);
        res.status(500).json({ msg: 'Server error', error: err.message });
    }
});

// ─── GET /admin/stats ─────────────────────────────────────────────────────────
// Legacy stats endpoint — uses same accurate aggregation
router.get('/stats', auth, adminOnly, async (req, res) => {
    try {
        const roleCounts = await prisma.user.groupBy({
            by: ['role'],
            _count: { id: true }
        });
        const countMap = {};
        roleCounts.forEach(r => { countMap[r.role] = r._count.id; });
        const students = countMap['student'] || 0;
        const teachers = countMap['teacher'] || 0;
        const admins   = countMap['admin']   || 0;
        // FIXED: total = students + teachers + admins (no longer uses prisma.user.count() which includes 'none' role)
        const total = students + teachers + admins;
        res.json({ total, teachers, students, admins });
    } catch (err) {
        res.status(500).json({ msg: 'Server error' });
    }
});

// ─── GET /admin/users ─────────────────────────────────────────────────────────
// Paginated users with search and role filter
router.get('/users', auth, adminOnly, async (req, res) => {
    try {
        const page   = parseInt(req.query.page,  10) || 1;
        const limit  = parseInt(req.query.limit, 10) || 20;
        const search = (req.query.search || '').trim();
        const role   = (req.query.role   || '').trim();
        const isUnpaginated = req.query.all === 'true';

        const whereClause = {};
        if (role && role !== 'all') whereClause.role = role;
        if (search) {
            whereClause.OR = [
                { username:     { contains: search, mode: 'insensitive' } },
                { email:        { contains: search, mode: 'insensitive' } },
                { name:         { contains: search, mode: 'insensitive' } },
                { studentBranch:{ contains: search, mode: 'insensitive' } },
                { section:      { contains: search, mode: 'insensitive' } },
                { department:   { contains: search, mode: 'insensitive' } },
            ];
        }

        const selectFields = {
            id: true, username: true, email: true, name: true, role: true,
            isOnline: true, isSuspended: true, suspensionReason: true,
            studentBranch: true, section: true, year: true, semester: true,
            department: true, subjects: true, employeeId: true,
            createdAt: true, updatedAt: true, lastLogin: true
        };

        if (isUnpaginated) {
            const users = await prisma.user.findMany({ where: whereClause, select: selectFields, orderBy: { createdAt: 'desc' } });
            return res.json(users);
        }

        const skip = (page - 1) * limit;
        const [users, totalCount] = await Promise.all([
            prisma.user.findMany({ where: whereClause, select: selectFields, skip, take: limit, orderBy: { createdAt: 'desc' } }),
            prisma.user.count({ where: whereClause })
        ]);
        const totalPages = Math.ceil(totalCount / limit) || 1;
        res.json({ users, totalCount, totalPages, currentPage: page, limit });
    } catch (err) {
        console.error('Error fetching admin users:', err.message);
        res.status(500).json({ msg: 'Server error', error: err.message });
    }
});

// ─── GET /admin/students ──────────────────────────────────────────────────────
// Students only, with year/semester/section/branch filters
router.get('/students', auth, adminOnly, async (req, res) => {
    try {
        const page     = parseInt(req.query.page,  10) || 1;
        const limit    = parseInt(req.query.limit, 10) || 50;
        const search   = (req.query.search   || '').trim();
        const year     = (req.query.year     || '').trim();
        const semester = (req.query.semester || '').trim();
        const section  = (req.query.section  || '').trim();
        const branch   = (req.query.branch   || '').trim();

        const where = { role: 'student' };
        if (year)     where.year         = year;
        if (semester) where.semester     = semester;
        if (section)  where.section      = section;
        if (branch)   where.studentBranch = branch;
        if (search) {
            where.OR = [
                { username: { contains: search, mode: 'insensitive' } },
                { name:     { contains: search, mode: 'insensitive' } },
                { email:    { contains: search, mode: 'insensitive' } },
            ];
        }

        const skip = (page - 1) * limit;
        const [students, totalCount] = await Promise.all([
            prisma.user.findMany({
                where,
                select: {
                    id: true, username: true, email: true, name: true,
                    studentBranch: true, section: true, year: true, semester: true,
                    isOnline: true, isSuspended: true, lastLogin: true, createdAt: true
                },
                skip, take: limit,
                orderBy: [{ year: 'asc' }, { section: 'asc' }, { username: 'asc' }]
            }),
            prisma.user.count({ where })
        ]);

        // Also return distinct values for filter dropdowns
        const [years, semesters, sections, branches] = await Promise.all([
            prisma.user.findMany({ where: { role: 'student', year: { not: null } }, select: { year: true }, distinct: ['year'], orderBy: { year: 'asc' } }),
            prisma.user.findMany({ where: { role: 'student', semester: { not: null } }, select: { semester: true }, distinct: ['semester'], orderBy: { semester: 'asc' } }),
            prisma.user.findMany({ where: { role: 'student', section: { not: null } }, select: { section: true }, distinct: ['section'], orderBy: { section: 'asc' } }),
            prisma.user.findMany({ where: { role: 'student', studentBranch: { not: null } }, select: { studentBranch: true }, distinct: ['studentBranch'], orderBy: { studentBranch: 'asc' } }),
        ]);

        res.json({
            students,
            totalCount,
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
        console.error('Error fetching students:', err.message);
        res.status(500).json({ msg: 'Server error', error: err.message });
    }
});

// ─── GET /admin/teachers ──────────────────────────────────────────────────────
router.get('/teachers', auth, adminOnly, async (req, res) => {
    try {
        const page       = parseInt(req.query.page,  10) || 1;
        const limit      = parseInt(req.query.limit, 10) || 50;
        const search     = (req.query.search     || '').trim();
        const department = (req.query.department || '').trim();
        const status     = (req.query.status     || '').trim();

        const where = { role: 'teacher' };
        if (department) where.department = department;
        if (status === 'suspended') where.isSuspended = true;
        if (status === 'active')    where.isSuspended = false;
        if (search) {
            where.OR = [
                { username:   { contains: search, mode: 'insensitive' } },
                { name:       { contains: search, mode: 'insensitive' } },
                { email:      { contains: search, mode: 'insensitive' } },
                { department: { contains: search, mode: 'insensitive' } },
                { subjects:   { contains: search, mode: 'insensitive' } },
                { employeeId: { contains: search, mode: 'insensitive' } },
            ];
        }

        const skip = (page - 1) * limit;
        const [teachers, totalCount] = await Promise.all([
            prisma.user.findMany({
                where,
                select: {
                    id: true, username: true, email: true, name: true,
                    department: true, subjects: true, employeeId: true,
                    isOnline: true, isSuspended: true, lastLogin: true, createdAt: true
                },
                skip, take: limit,
                orderBy: [{ department: 'asc' }, { username: 'asc' }]
            }),
            prisma.user.count({ where })
        ]);

        const deptList = await prisma.user.findMany({
            where: { role: 'teacher', department: { not: null } },
            select: { department: true },
            distinct: ['department'],
            orderBy: { department: 'asc' }
        });

        res.json({
            teachers,
            totalCount,
            totalPages: Math.ceil(totalCount / limit) || 1,
            currentPage: page,
            filterOptions: { departments: deptList.map(d => d.department) }
        });
    } catch (err) {
        console.error('Error fetching teachers:', err.message);
        res.status(500).json({ msg: 'Server error', error: err.message });
    }
});

// ─── GET /admin/admins ────────────────────────────────────────────────────────
router.get('/admins', auth, adminOnly, async (req, res) => {
    try {
        const search = (req.query.search || '').trim();
        const status = (req.query.status || '').trim();
        const where  = { role: 'admin' };
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
            where,
            select: {
                id: true, username: true, email: true, name: true,
                isOnline: true, isSuspended: true, lastLogin: true, createdAt: true
            },
            orderBy: { createdAt: 'asc' }
        });
        res.json({ admins, totalCount: admins.length });
    } catch (err) {
        console.error('Error fetching admins:', err.message);
        res.status(500).json({ msg: 'Server error', error: err.message });
    }
});

// ─── POST /admin/users ────────────────────────────────────────────────────────
router.post('/users', auth, adminOnly, async (req, res) => {
    const { username, email, password, role, name, studentBranch, section, year, semester, department, subjects, employeeId } = req.body;
    if (!username || !email || !password || !role) {
        return res.status(400).json({ msg: 'All fields are required' });
    }
    if (!['teacher', 'student', 'admin', 'none'].includes(role)) {
        return res.status(400).json({ msg: 'Invalid role' });
    }
    try {
        const existingUser = await prisma.user.findFirst({ where: { OR: [{ email }, { username }] } });
        if (existingUser) return res.status(400).json({ msg: 'User with that email or username already exists' });
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const user = await prisma.user.create({
            data: {
                username, email, password: hashedPassword, role,
                name: name || null,
                studentBranch: studentBranch || null,
                section: section || null,
                year: year ? String(year) : null,
                semester: semester ? String(semester) : null,
                department: department || null,
                subjects: subjects || null,
                employeeId: employeeId || null,
            },
            select: {
                id: true, username: true, email: true, name: true, role: true,
                studentBranch: true, section: true, year: true, semester: true,
                department: true, subjects: true, employeeId: true, createdAt: true
            }
        });
        res.status(201).json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error: ' + err.message });
    }
});

// ─── PUT /admin/users/:id ─────────────────────────────────────────────────────
router.put('/users/:id', auth, adminOnly, async (req, res) => {
    const { username, email, password, role, name, studentBranch, section, year, semester, department, subjects, employeeId } = req.body;
    try {
        const user = await prisma.user.findUnique({ where: { id: req.params.id } });
        if (!user) return res.status(404).json({ msg: 'User not found' });
        const updateData = {};
        if (username)   updateData.username   = username;
        if (email)      updateData.email      = email;
        if (name !== undefined) updateData.name = name;
        if (role && ['teacher', 'student', 'admin', 'none'].includes(role)) updateData.role = role;
        if (password && password.trim() !== '') {
            const salt = await bcrypt.genSalt(10);
            updateData.password = await bcrypt.hash(password, salt);
        }
        if (studentBranch !== undefined) updateData.studentBranch = studentBranch;
        if (section      !== undefined) updateData.section      = section;
        if (year         !== undefined) updateData.year         = year ? String(year) : null;
        if (semester     !== undefined) updateData.semester     = semester ? String(semester) : null;
        if (department   !== undefined) updateData.department   = department;
        if (subjects     !== undefined) updateData.subjects     = subjects;
        if (employeeId   !== undefined) updateData.employeeId   = employeeId;
        const updatedUser = await prisma.user.update({
            where: { id: req.params.id },
            data: updateData,
            select: {
                id: true, username: true, email: true, name: true, role: true,
                studentBranch: true, section: true, year: true, semester: true,
                department: true, subjects: true, employeeId: true,
                createdAt: true, updatedAt: true, lastLogin: true
            }
        });
        res.json(updatedUser);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error: ' + err.message });
    }
});

// ─── DELETE /admin/users/:id ──────────────────────────────────────────────────
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

// ─── PUT /admin/users/suspend/:id ─────────────────────────────────────────────
router.put('/users/suspend/:id', auth, adminOnly, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({ where: { id: req.params.id } });
        if (!user) return res.status(404).json({ msg: 'User not found' });
        if (user.id === req.user.id) return res.status(400).json({ msg: 'You cannot suspend yourself.' });
        const updated = await prisma.user.update({
            where: { id: req.params.id },
            data: {
                isSuspended: !user.isSuspended,
                suspensionReason: !user.isSuspended ? 'Suspended by Administrator' : null,
                tokenVersion: { increment: 1 }
            },
            select: { id: true, isSuspended: true, suspensionReason: true }
        });
        res.json(updated);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

// ─── POST /admin/promote ──────────────────────────────────────────────────────
router.post('/promote', auth, adminOnly, async (req, res) => {
    try {
        const deleteRes = await prisma.user.deleteMany({ where: { role: 'student', year: '4' } });
        await prisma.user.updateMany({ where: { role: 'student', year: '3' }, data: { year: '4' } });
        await prisma.user.updateMany({ where: { role: 'student', year: '2' }, data: { year: '3' } });
        await prisma.user.updateMany({ where: { role: 'student', year: '1' }, data: { year: '2' } });
        res.json({ msg: 'Batch year promotion completed successfully!', graduatedCount: deleteRes.count });
    } catch (err) {
        console.error('Promotion error:', err.message);
        res.status(500).json({ msg: 'Server error: ' + err.message });
    }
});

// ─── POST /admin/import ───────────────────────────────────────────────────────
router.post('/import', auth, adminOnly, async (req, res) => {
    const { students } = req.body;
    if (!students || !Array.isArray(students)) {
        return res.status(400).json({ msg: 'Invalid payload: students list is required' });
    }
    try {
        let successCount = 0;
        const errors = [];
        for (const s of students) {
            const { username, email, password, studentBranch, section, year, semester, name } = s;
            if (!username || !email || !password) {
                errors.push({ email: email || 'unknown', reason: 'Missing username, email, or password' });
                continue;
            }
            try {
                const existing = await prisma.user.findFirst({ where: { OR: [{ email }, { username }] } });
                if (existing) { errors.push({ email, reason: 'Duplicate username or email' }); continue; }
                const salt = await bcrypt.genSalt(10);
                const hashedPassword = await bcrypt.hash(password, salt);
                await prisma.user.create({
                    data: {
                        username, email, password: hashedPassword, role: 'student',
                        name: name || null,
                        studentBranch: studentBranch || null,
                        section: section || null,
                        year: year ? String(year) : '1',
                        semester: semester ? String(semester) : null,
                    }
                });
                successCount++;
            } catch (innerErr) {
                errors.push({ email, reason: innerErr.message });
            }
        }
        res.json({ msg: `Batch import complete. Imported ${successCount} students.`, successCount, failureCount: errors.length, errors });
    } catch (err) {
        console.error('Import error:', err.message);
        res.status(500).json({ msg: 'Server error: ' + err.message });
    }
});

module.exports = router;
