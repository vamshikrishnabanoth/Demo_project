const bcrypt = require('bcryptjs');
const prisma = require('./lib/prisma');

async function seedSystemAccounts() {
  const salt = await bcrypt.genSalt(10);
  const commonPassword = await bcrypt.hash('KMIT@1234', salt);

  try {
    // 1. Create Admin
    await prisma.user.upsert({
      where: { email: 'admin@kmit.in' },
      update: {},
      create: {
        username: 'admin',
        email: 'admin@kmit.in',
        password: commonPassword,
        role: 'admin'
      }
    });
    console.log('👑 Admin account created: admin / KMIT@1234');

    // 2. Create 5 Teachers
    for (let i = 1; i <= 5; i++) {
      const username = `teacher${i}`;
      await prisma.user.upsert({
        where: { email: `${username}@kmit.in` },
        update: {},
        create: {
          username: username,
          email: `${username}@kmit.in`,
          password: commonPassword,
          role: 'teacher'
        }
      });
      console.log(`👨‍🏫 Teacher ${i} created: ${username} / KMIT@1234`);
    }

    console.log('✨ System accounts initialized!');
  } catch (err) {
    console.error('❌ Error seeding system accounts:', err);
  } finally {
    await prisma.$disconnect();
  }
}

seedSystemAccounts();
