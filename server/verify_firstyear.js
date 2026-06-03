const prisma = require('./lib/prisma');

async function main() {
  const cse = await prisma.user.count({ where: { role: 'student', year: '1', studentBranch: 'CSE' } });
  const csm = await prisma.user.count({ where: { role: 'student', year: '1', studentBranch: 'CSM' } });
  const total = await prisma.user.count({ where: { role: 'student', year: '1' } });
  const noName = await prisma.user.count({ where: { role: 'student', year: '1', OR: [{ name: null }, { name: '' }] } });
  const noSection = await prisma.user.count({ where: { role: 'student', year: '1', OR: [{ section: null }, { section: '' }] } });

  console.log('=== FIRST-YEAR VERIFICATION ===');
  console.log(`CSE (25BD1A05xx): ${cse}  (expected: 576)`);
  console.log(`CSM (25BD1A66xx): ${csm}  (expected: 318)`);
  console.log(`Total first-year: ${total}  (expected: 894)`);
  console.log(`Missing Name: ${noName}`);
  console.log(`Missing Section: ${noSection}`);

  // Section breakdown for CSE
  const cseSections = await prisma.user.groupBy({
    by: ['section'],
    where: { role: 'student', year: '1', studentBranch: 'CSE' },
    _count: { section: true },
    orderBy: { section: 'asc' }
  });
  console.log('\nCSE sections:');
  cseSections.forEach(s => console.log(`  Section ${s.section}: ${s._count.section} students`));

  const csmSections = await prisma.user.groupBy({
    by: ['section'],
    where: { role: 'student', year: '1', studentBranch: 'CSM' },
    _count: { section: true },
    orderBy: { section: 'asc' }
  });
  console.log('\nCSM sections:');
  csmSections.forEach(s => console.log(`  Section ${s.section}: ${s._count.section} students`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
