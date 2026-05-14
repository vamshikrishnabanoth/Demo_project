const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: {
      username: true,
      email: true,
      role: true
    }
  });
  console.log('--- ALL USERS IN DATABASE ---');
  users.forEach(u => console.log(`[${u.role}] Name: ${u.username} | Roll/Email: ${u.email}`));
  console.log('-----------------------------');
  console.log(`Total Count: ${users.length}`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
