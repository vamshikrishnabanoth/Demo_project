const bcrypt = require('bcryptjs');
const prisma = require('./lib/prisma');

async function main() {
  const s = await prisma.user.findFirst({
    where: { username: '25BD1A669Q' },
    select: { password: true }
  });

  const tests = [
    '25BD1A669Q@kk',
    '25bd1a669q@kk',
    '25BD1A669Q',
    '25bd1a669q',
    'rollno@kk',
    '25BD1A669q@kk',
    'password',
    '123456'
  ];

  for (const t of tests) {
    const ok = await bcrypt.compare(t, s.password);
    console.log(`${ok ? '✅ MATCH' : '❌ no match'}: "${t}"`);
  }

  // Also check a first-year CSE student (25BD1A0501)
  const cseStudent = await prisma.user.findFirst({
    where: { username: '25BD1A0501' },
    select: { username: true, name: true, password: true }
  });
  if (cseStudent) {
    console.log('\n--- Testing CSE first-year 25BD1A0501 ---');
    for (const t of ['25BD1A0501@kk', '25bd1a0501@kk', '25BD1A0501']) {
      const ok = await bcrypt.compare(t, cseStudent.password);
      console.log(`${ok ? '✅ MATCH' : '❌ no match'}: "${t}"`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
