const bcrypt = require('bcryptjs');
const prisma = require('./lib/prisma');

async function seedTestStudents() {
  console.log('⚡ Generating common password hash for KMIT@1234...');
  const salt = await bcrypt.genSalt(10);
  const commonPassword = await bcrypt.hash('KMIT@1234', salt);

  console.log('⚡ Generating 2000 student payloads...');
  const students = [];
  for (let i = 1; i <= 2000; i++) {
    students.push({
      username: `test_student_${i}`,
      email: `test_student_${i}@kmit.in`,
      password: commonPassword,
      role: 'student',
      studentBranch: 'CSE',
      section: 'A',
      isSuspended: false,
      isOnline: false
    });
  }

  console.log('⚡ Seeding 2000 students to database in batches...');
  try {
    const chunkSize = 500;
    for (let i = 0; i < students.length; i += chunkSize) {
      const chunk = students.slice(i, i + chunkSize);
      await prisma.user.createMany({
        data: chunk,
        skipDuplicates: true
      });
      console.log(`✅ Seeded students ${i + 1} to ${Math.min(i + chunkSize, students.length)}`);
    }
    console.log('✨ 2000 Test Students seeding completed successfully!');
  } catch (err) {
    console.error('❌ Error seeding test students:', err);
  } finally {
    await prisma.$disconnect();
  }
}

seedTestStudents();
