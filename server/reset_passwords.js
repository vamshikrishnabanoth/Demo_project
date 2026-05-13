const bcrypt = require('bcryptjs');
const prisma = require('./lib/prisma');

async function resetAllPasswords() {
  try {
    const users = await prisma.user.findMany();
    console.log(`🔄 Updating passwords for ${users.length} users...`);

    let count = 0;
    for (const user of users) {
      const plainPassword = `${user.username}@kk`;
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(plainPassword, salt);

      await prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword }
      });

      count++;
      if (count % 100 === 0) console.log(`✅ Updated ${count} users...`);
    }

    console.log('✨ All passwords have been reset to [username]@kk');
  } catch (err) {
    console.error('❌ Error resetting passwords:', err);
  } finally {
    await prisma.$disconnect();
  }
}

resetAllPasswords();
