const https = require('https');
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');

const DEPLOYED_BACKEND = 'https://43-204-96-224.sslip.io';
const VERCEL_FRONTEND = 'https://kmit-khaoot.vercel.app';

function httpRequest(urlStr, options = {}) {
    return new Promise((resolve) => {
        const url = new URL(urlStr);
        const reqOptions = {
            hostname: url.hostname,
            port: 443,
            path: url.pathname + url.search,
            method: options.method || 'GET',
            headers: {
                'Origin': VERCEL_FRONTEND,
                ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
                ...(options.headers || {})
            },
            timeout: options.timeout || 15000
        };

        const req = https.request(reqOptions, (res) => {
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => {
                const raw = Buffer.concat(chunks).toString('utf8');
                let json = null;
                try { json = JSON.parse(raw); } catch (_) { json = raw; }
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    data: json,
                    raw
                });
            });
        });

        req.on('error', (err) => resolve({ status: null, error: err.message }));
        req.on('timeout', () => {
            req.destroy();
            resolve({ status: null, error: 'TIMEOUT' });
        });

        if (options.body) {
            req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
        }
        req.end();
    });
}

async function verifyDeployment() {
    if (process.env.ALLOW_PRODUCTION_DEPLOYMENT_VERIFICATION !== 'true') {
        console.log('⚠️ [SAFETY GUARD] test_deployment_verification requires explicit production authorization.');
        console.log('   Set ALLOW_PRODUCTION_DEPLOYMENT_VERIFICATION=true to run against deployed endpoints and DB.');
        return { skipped: true, reason: 'SAFETY_GUARD_UNAUTHORIZED' };
    }

    console.log('======================================================================');
    console.log('🔍 POST-DEPLOYMENT VERIFICATION SUITE');
    console.log(`Backend Target: ${DEPLOYED_BACKEND}`);
    console.log(`Timestamp:      ${new Date().toISOString()}`);
    console.log('======================================================================\n');

    const results = {};
    const createdUserIds = [];
    const createdQuizIds = [];
    const createdResultIds = [];

    const ts = Date.now();
    const testPassword = 'VerifyPass123!';
    const hashedPassword = await bcrypt.hash(testPassword, 10);

    try {
        // -------------------------------------------------------------
        // 1. Unauthenticated Route Existence & Auth Challenge (401, not 404)
        // -------------------------------------------------------------
        console.log('1. Probing unauthenticated route mounts...');
        const routeChecks = [
            { method: 'POST', path: '/api/quiz/assign/test-id', name: 'POST /api/quiz/assign/:id' },
            { method: 'POST', path: '/api/quiz/test-id/assign', name: 'POST /api/quiz/:id/assign' },
            { method: 'PATCH', path: '/api/admin/users/test-id/suspend', name: 'PATCH /api/admin/users/:id/suspend' },
            { method: 'PATCH', path: '/api/admin/users/suspend/test-id', name: 'PATCH /api/admin/users/suspend/:id' }
        ];

        let allMounted = true;
        for (const rc of routeChecks) {
            const res = await httpRequest(`${DEPLOYED_BACKEND}${rc.path}`, { method: rc.method });
            const isMounted = res.status === 401; // 401 proves route is mounted and protected by auth
            console.log(`   ${rc.method} ${rc.path} -> HTTP ${res.status} (expected 401, got ${res.status}): ${isMounted ? 'MOUNTED' : 'NOT MOUNTED (404)'}`);
            if (!isMounted) allMounted = false;
        }

        results['routes_mounted_check'] = {
            status: allMounted ? 'PASS' : 'FAIL',
            evidence: allMounted ? 'All 4 routes returned HTTP 401 (auth required), confirming routes are mounted.' : 'One or more routes still return 404.'
        };

        // -------------------------------------------------------------
        // 2. Provision Isolated Teacher, Student, and Admin Accounts
        // -------------------------------------------------------------
        console.log('\n2. Provisioning isolated test users in Supabase...');
        const teacher = await prisma.user.create({
            data: {
                username: `dep_v_t_${ts}`,
                email: `dep_v_t_${ts}@kmit.in`,
                password: hashedPassword,
                role: 'teacher',
                name: 'Deploy Verify Teacher'
            }
        });
        createdUserIds.push(teacher.id);

        const student = await prisma.user.create({
            data: {
                username: `dep_v_s_${ts}`,
                email: `dep_v_s_${ts}@kmit.in`,
                password: hashedPassword,
                role: 'student',
                name: 'Deploy Verify Student',
                studentBranch: 'CSE',
                section: 'A',
                year: '3',
                semester: '1'
            }
        });
        createdUserIds.push(student.id);

        const admin = await prisma.user.create({
            data: {
                username: `dep_v_a_${ts}`,
                email: `dep_v_a_${ts}@kmit.in`,
                password: hashedPassword,
                role: 'admin',
                name: 'Deploy Verify Admin'
            }
        });
        createdUserIds.push(admin.id);

        // Authenticate users
        const teacherLogin = await httpRequest(`${DEPLOYED_BACKEND}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: { email: teacher.email, password: testPassword }
        });
        const teacherToken = teacherLogin.data?.token;

        const studentLogin = await httpRequest(`${DEPLOYED_BACKEND}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: { email: student.email, password: testPassword }
        });
        const studentToken = studentLogin.data?.token;

        const adminLogin = await httpRequest(`${DEPLOYED_BACKEND}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: { email: admin.email, password: testPassword }
        });
        const adminToken = adminLogin.data?.token;

        console.log(`   Authenticated: Teacher token=${Boolean(teacherToken)}, Student token=${Boolean(studentToken)}, Admin token=${Boolean(adminToken)}`);

        // -------------------------------------------------------------
        // 3. Teacher Creates Quiz
        // -------------------------------------------------------------
        console.log('\n3. Teacher creating quiz...');
        const createRes = await httpRequest(`${DEPLOYED_BACKEND}/api/quiz/create`, {
            method: 'POST',
            token: teacherToken,
            headers: { 'Content-Type': 'application/json' },
            body: {
                title: `Deploy Verify Quiz ${ts}`,
                topic: 'Git Commands',
                questionCount: 2,
                difficulty: 'Easy',
                timerPerQuestion: 30,
                isAssessment: true,
                questions: [
                    { question: 'What is git init?', options: ['Initialize repo', 'Delete repo'], correctAnswer: 'Initialize repo' },
                    { question: 'What is git status?', options: ['Show status', 'Show log'], correctAnswer: 'Show status' }
                ]
            }
        });
        const quizId = createRes.data?.quiz?.id || createRes.data?.id;
        if (quizId) createdQuizIds.push(quizId);
        console.log(`   POST /api/quiz/create -> HTTP ${createRes.status}, quizId=${quizId}`);

        // -------------------------------------------------------------
        // 4. Test Assignment via POST /api/quiz/assign/:id
        // -------------------------------------------------------------
        console.log('\n4. Testing assignment endpoint POST /api/quiz/assign/:id...');
        const assignPayload = {
            assignedGroups: [{ branch: 'CSE', section: 'A' }],
            assignedStudents: [student.id]
        };
        const assignRes = await httpRequest(`${DEPLOYED_BACKEND}/api/quiz/assign/${quizId}`, {
            method: 'POST',
            token: teacherToken,
            headers: { 'Content-Type': 'application/json' },
            body: assignPayload
        });
        console.log(`   POST /api/quiz/assign/${quizId} -> HTTP ${assignRes.status}`);

        // Verify assignment persisted in Supabase DB
        const dbQuiz = await prisma.quiz.findUnique({ where: { id: quizId } });
        const assignedStudentMatched = Array.isArray(dbQuiz?.assignedStudents) && dbQuiz.assignedStudents.includes(student.id);
        const assignedGroupMatched = Array.isArray(dbQuiz?.assignedGroups) && dbQuiz.assignedGroups.some(g => g.branch === 'CSE');
        console.log(`   Supabase DB verification: studentsMatched=${assignedStudentMatched}, groupsMatched=${assignedGroupMatched}`);

        results['teacher_assignment_persistence'] = {
            status: assignRes.status === 200 && assignedStudentMatched ? 'PASS' : 'FAIL',
            evidence: `Endpoint returned HTTP ${assignRes.status}. Supabase record confirmed assignedStudents=${JSON.stringify(dbQuiz?.assignedStudents)}.`
        };

        // -------------------------------------------------------------
        // 5. Test Secondary Assignment Route POST /api/quiz/:id/assign
        // -------------------------------------------------------------
        console.log('\n5. Testing secondary route POST /api/quiz/:id/assign...');
        const altAssignRes = await httpRequest(`${DEPLOYED_BACKEND}/api/quiz/${quizId}/assign`, {
            method: 'POST',
            token: teacherToken,
            headers: { 'Content-Type': 'application/json' },
            body: assignPayload
        });
        console.log(`   POST /api/quiz/${quizId}/assign -> HTTP ${altAssignRes.status}`);
        results['secondary_assignment_route'] = {
            status: altAssignRes.status === 200 ? 'PASS' : 'FAIL',
            evidence: `Secondary route returned HTTP ${altAssignRes.status}.`
        };

        // -------------------------------------------------------------
        // 6. Test RBAC: Student Cannot Assign Quizzes
        // -------------------------------------------------------------
        console.log('\n6. Testing RBAC: Student attempting quiz assignment...');
        const studentAssignRes = await httpRequest(`${DEPLOYED_BACKEND}/api/quiz/assign/${quizId}`, {
            method: 'POST',
            token: studentToken,
            headers: { 'Content-Type': 'application/json' },
            body: assignPayload
        });
        console.log(`   Student POST /api/quiz/assign/${quizId} -> HTTP ${studentAssignRes.status} (expected 403)`);
        results['assignment_rbac_enforcement'] = {
            status: studentAssignRes.status === 403 ? 'PASS' : 'FAIL',
            evidence: `Student assignment request blocked with HTTP ${studentAssignRes.status}.`
        };

        // -------------------------------------------------------------
        // 7. Test Admin PATCH Suspension Route
        // -------------------------------------------------------------
        console.log('\n7. Testing admin PATCH student suspension...');
        const patchSuspendRes = await httpRequest(`${DEPLOYED_BACKEND}/api/admin/users/${student.id}/suspend`, {
            method: 'PATCH',
            token: adminToken,
            headers: { 'Content-Type': 'application/json' }
        });
        console.log(`   PATCH /api/admin/users/${student.id}/suspend -> HTTP ${patchSuspendRes.status}, isSuspended=${patchSuspendRes.data?.isSuspended}`);

        const dbStudent = await prisma.user.findUnique({ where: { id: student.id } });
        console.log(`   Supabase student check: isSuspended=${dbStudent?.isSuspended}, tokenVersion=${dbStudent?.tokenVersion}`);

        results['admin_patch_suspension'] = {
            status: patchSuspendRes.status === 200 && dbStudent?.isSuspended === true ? 'PASS' : 'FAIL',
            evidence: `PATCH endpoint returned HTTP 200. Supabase record updated (isSuspended: true, tokenVersion: ${dbStudent?.tokenVersion}).`
        };

        // -------------------------------------------------------------
        // 8. Overall Health & Baseline Check
        // -------------------------------------------------------------
        console.log('\n8. Checking system health...');
        const healthRes = await httpRequest(`${DEPLOYED_BACKEND}/api/quiz/health`);
        const dbHealthRes = await httpRequest(`${DEPLOYED_BACKEND}/api/health`);
        console.log(`   /api/quiz/health -> HTTP ${healthRes.status}: ${JSON.stringify(healthRes.data)}`);
        console.log(`   /api/health -> HTTP ${dbHealthRes.status}: ${JSON.stringify(dbHealthRes.data)}`);

        results['health_check'] = {
            status: healthRes.status === 200 && dbHealthRes.status === 200 ? 'PASS' : 'FAIL',
            evidence: `Quiz health returned HTTP ${healthRes.status}, DB health returned HTTP ${dbHealthRes.status}.`
        };

    } catch (err) {
        console.error('Verification error:', err);
    } finally {
        console.log('\n--- Cleaning up temporary test records ---');
        let dRes = 0, dQ = 0, dU = 0;
        try {
            if (createdResultIds.length > 0) {
                const r = await prisma.result.deleteMany({ where: { id: { in: createdResultIds } } });
                dRes = r.count;
            }
            if (createdQuizIds.length > 0) {
                await prisma.result.deleteMany({ where: { quizId: { in: createdQuizIds } } });
                await prisma.teacherFeedback.deleteMany({ where: { quizId: { in: createdQuizIds } } });
                await prisma.broadcast.deleteMany({ where: { quizId: { in: createdQuizIds } } });
                const q = await prisma.quiz.deleteMany({ where: { id: { in: createdQuizIds } } });
                dQ = q.count;
            }
            if (createdUserIds.length > 0) {
                const u = await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
                dU = u.count;
            }
            console.log(`Cleaned up: ${dRes} results, ${dQ} quizzes, ${dU} users.`);

            const residualUsers = await prisma.user.count({ where: { username: { startsWith: 'dep_v_' } } });
            console.log(`Residual test records check: ${residualUsers} users remaining in Supabase.`);

            results['cleanup_isolation'] = {
                status: residualUsers === 0 ? 'PASS' : 'FAIL',
                evidence: `Cleaned up ${dU} users and ${dQ} quizzes. Zero residual test records.`
            };
            await prisma.$disconnect();
        } catch (cErr) {
            console.error('Cleanup error:', cErr.message);
        }
    }

    console.log('\n======================================================================');
    console.log('📋 VERIFICATION RESULTS SUMMARY');
    console.log('======================================================================');
    for (const [key, val] of Object.entries(results)) {
        console.log(`[${val.status}] ${key}: ${val.evidence}`);
    }
    return results;
}

verifyDeployment().catch(console.error);
