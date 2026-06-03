const prisma = require('./lib/prisma');
const bcrypt = require('bcryptjs');

async function main() {
  // 1. Check if 25BD1A669Q exists
  const firstYearStudent = await prisma.user.findFirst({
    where: { OR: [{ username: '25BD1A669Q' }, { email: '25BD1A669Q' }] },
    select: { id: true, username: true, email: true, name: true, year: true, section: true, studentBranch: true, password: true }
  });
  console.log('\n=== 25BD1A669Q (First-year CSM login attempt) ===');
  if (!firstYearStudent) {
    console.log('❌ Student NOT FOUND in the database!');
  } else {
    console.log('✅ Found student:', { ...firstYearStudent, password: '[hidden]' });
    // Test password
    const testPw = await bcrypt.compare('25BD1A669Q@kk', firstYearStudent.password);
    console.log(`Password "25BD1A669Q@kk" matches: ${testPw}`);
  }

  // 2. Check second-year student 24BD1A059H
  const secondYearStudent = await prisma.user.findFirst({
    where: { OR: [{ username: '24BD1A059H' }, { email: '24BD1A059H' }] },
    select: { id: true, username: true, name: true, year: true, section: true, studentBranch: true }
  });
  console.log('\n=== 24BD1A059H (Second-year student profile) ===');
  if (!secondYearStudent) {
    console.log('❌ Student NOT FOUND in the database!');
  } else {
    console.log('Student data:', secondYearStudent);
  }

  // 3. Check how many second-year students are missing name or year
  const missingName = await prisma.user.count({
    where: { role: 'student', year: '2', OR: [{ name: null }, { name: '' }] }
  });
  const missingYear = await prisma.user.count({
    where: { role: 'student', year: null, username: { startsWith: '24' } }
  });
  console.log(`\n=== Second-year data gaps ===`);
  console.log(`Second-year students missing name: ${missingName}`);
  console.log(`24xxx students missing year field: ${missingYear}`);

  // 4. Sample a few second-year students with names
  const sampleWithName = await prisma.user.findMany({
    where: { role: 'student', year: '2', name: { not: null } },
    select: { username: true, name: true, year: true },
    take: 3
  });
  const sampleWithoutName = await prisma.user.findMany({
    where: { role: 'student', year: '2', OR: [{ name: null }, { name: '' }] },
    select: { username: true, name: true, year: true },
    take: 3
  });
  console.log('\nSample WITH name:', sampleWithName);
  console.log('Sample WITHOUT name:', sampleWithoutName);
}

main().catch(console.error).finally(() => prisma.$disconnect());
