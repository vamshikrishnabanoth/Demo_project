/**
 * server/test/test_website_readiness_routes.js
 *
 * Dedicated Verification Suite for Website Production-Readiness Route Integrity:
 * 1. POST /api/quiz/assign/:id and POST /api/quiz/:id/assign route mounting
 * 2. PATCH /api/admin/users/:id/suspend and PATCH /api/admin/users/suspend/:id method support
 * 3. Client navigation targets matching App.jsx routes
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('======================================================================');
console.log('🧪 RUNNING WEBSITE PRODUCTION-READINESS ROUTE INTEGRITY TESTS');
console.log('======================================================================\n');

let passCount = 0;
function runTest(name, fn) {
  try {
    fn();
    passCount++;
    console.log(` ✅ PASS [${passCount}]: ${name}`);
  } catch (err) {
    console.error(` ❌ FAIL: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

// -----------------------------------------------------------------------------
// Test 1: Quiz Assignment Routes Mounted
// -----------------------------------------------------------------------------
runTest('T1: server/routes/quiz.js mounts POST /assign/:id and /:id/assign for StudentAssignDrawer', () => {
  const quizRoutesPath = path.resolve(__dirname, '../routes/quiz.js');
  const code = fs.readFileSync(quizRoutesPath, 'utf8');

  assert.ok(code.includes("router.post('/assign/:id', auth, teacherOrAdmin, quizController.assignQuiz)"), 'Must mount /assign/:id');
  assert.ok(code.includes("router.post('/:id/assign', auth, teacherOrAdmin, quizController.assignQuiz)"), 'Must mount /:id/assign');
});

// -----------------------------------------------------------------------------
// Test 2: Admin User Suspend Supports Both PUT and PATCH
// -----------------------------------------------------------------------------
runTest('T2: server/routes/admin.js supports PATCH for student suspension from AdminStudentProfile', () => {
  const adminRoutesPath = path.resolve(__dirname, '../routes/admin.js');
  const code = fs.readFileSync(adminRoutesPath, 'utf8');

  assert.ok(code.includes("router.patch('/users/:id/suspend', auth, adminOnly, handleUserSuspendToggle)"), 'Must support PATCH /users/:id/suspend');
  assert.ok(code.includes("router.patch('/users/suspend/:id', auth, adminOnly, handleUserSuspendToggle)"), 'Must support PATCH /users/suspend/:id');
  assert.ok(code.includes("router.put('/users/:id/suspend', auth, adminOnly, handleUserSuspendToggle)"), 'Must preserve PUT /users/:id/suspend');
});

// -----------------------------------------------------------------------------
// Test 3: Client StudentAssignDrawer Contract Consistency
// -----------------------------------------------------------------------------
runTest('T3: StudentAssignDrawer.jsx API call matches mounted backend endpoint', () => {
  const drawerPath = path.resolve(__dirname, '../../client/src/components/quiz/StudentAssignDrawer.jsx');
  const code = fs.readFileSync(drawerPath, 'utf8');

  assert.ok(code.includes('api.post(`/quiz/assign/${quiz.id}`'), 'StudentAssignDrawer must target /quiz/assign/:id');
});

// -----------------------------------------------------------------------------
// Test 4: Client AdminStudentProfile Contract Consistency
// -----------------------------------------------------------------------------
runTest('T4: AdminStudentProfile.jsx suspend toggle matches mounted backend endpoint', () => {
  const profilePath = path.resolve(__dirname, '../../client/src/pages/AdminStudentProfile.jsx');
  const code = fs.readFileSync(profilePath, 'utf8');

  assert.ok(code.includes('api.patch(`/admin/users/${student.id}/suspend`)'), 'AdminStudentProfile must call /admin/users/:id/suspend');
});

console.log('\n======================================================================');
console.log(`🎉 ALL ${passCount} WEBSITE READINESS ROUTE TESTS PASSED CLEANLY!`);
console.log('======================================================================\n');
