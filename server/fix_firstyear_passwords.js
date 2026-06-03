const bcrypt = require('bcryptjs');
const prisma = require('./lib/prisma');

async function main() {
  // Get all first-year students
  const firstYearStudents = await prisma.user.findMany({
    where: { role: 'student', year: '1' },
    select: { id: true, username: true }
  });

  console.log(`Found ${firstYearStudents.length} first-year students. Resetting passwords to rollno@kk...`);

  const salt = await bcrypt.genSalt(10);
  let updated = 0;
  let failed = 0;

  for (const student of firstYearStudents) {
    try {
      const newPassword = await bcrypt.hash(`${student.username}@kk`, salt);
      await prisma.user.update({
        where: { id: student.id },
        data: { password: newPassword }
      });
      updated++;
      if (updated % 50 === 0) {
        console.log(`  Progress: ${updated}/${firstYearStudents.length}`);
      }
    } catch (err) {
      console.error(`  Failed for ${student.username}:`, err.message);
      failed++;
    }
  }

  console.log(`\n✅ Done! Updated: ${updated}, Failed: ${failed}`);

  // Verify the fix
  const verifyStudent = await prisma.user.findFirst({
    where: { username: '25BD1A669Q' },
    select: { password: true }
  });
  const matches = await bcrypt.compare('25BD1A669Q@kk', verifyStudent.password);
  console.log(`\nVerify 25BD1A669Q@kk matches: ${matches ? '✅ YES' : '❌ NO'}`);

  const verifyCSE = await prisma.user.findFirst({
    where: { username: '25BD1A0501' },
    select: { password: true }
  });
  const matchesCSE = await bcrypt.compare('25BD1A0501@kk', verifyCSE.password);
  console.log(`Verify 25BD1A0501@kk matches: ${matchesCSE ? '✅ YES' : '❌ NO'}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
