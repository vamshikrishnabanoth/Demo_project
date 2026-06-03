const prisma = require('./lib/prisma');

/**
 * Verify Student Database
 * 
 * This script verifies that students are correctly imported and differentiated.
 */

async function verifyStudents() {
  try {
    console.log('🔍 STUDENT DATABASE VERIFICATION\n');
    console.log('='.repeat(70));
    
    // Overall counts
    const totalUsers = await prisma.user.count();
    const totalStudents = await prisma.user.count({ where: { role: 'student' } });
    const totalTeachers = await prisma.user.count({ where: { role: 'teacher' } });
    const totalAdmins = await prisma.user.count({ where: { role: 'admin' } });
    
    console.log('\n📊 OVERALL DATABASE STATISTICS\n');
    console.log(`Total Users:    ${totalUsers}`);
    console.log(`  - Students:   ${totalStudents}`);
    console.log(`  - Teachers:   ${totalTeachers}`);
    console.log(`  - Admins:     ${totalAdmins}`);
    
    // Year-wise breakdown
    console.log('\n' + '='.repeat(70));
    console.log('\n👥 STUDENT BREAKDOWN BY YEAR\n');
    
    const firstYearStudents = await prisma.user.count({
      where: { role: 'student', year: '1' }
    });
    
    const secondYearStudents = await prisma.user.count({
      where: { role: 'student', year: '2' }
    });
    
    const noYearStudents = await prisma.user.count({
      where: { role: 'student', year: null }
    });
    
    console.log(`First Year (year="1"):   ${firstYearStudents} students`);
    console.log(`Second Year (year="2"):  ${secondYearStudents} students`);
    if (noYearStudents > 0) {
      console.log(`⚠️  No Year Assigned:     ${noYearStudents} students`);
    }
    
    // First year section breakdown
    if (firstYearStudents > 0) {
      console.log('\n' + '='.repeat(70));
      console.log('\n📋 FIRST YEAR - SECTION BREAKDOWN\n');
      
      const branches = ['CSE', 'CSM'];
      const sections = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
      for (const branch of branches) {
        console.log(`\n  Branch: ${branch}`);
        for (const sec of sections) {
          const count = await prisma.user.count({
            where: { role: 'student', year: '1', section: sec, studentBranch: branch }
          });
          if (count > 0) {
            console.log(`    Section ${sec}: ${count.toString().padStart(3)} students`);
          }
        }
      }
    }
    
    // Second year section breakdown
    if (secondYearStudents > 0) {
      console.log('\n' + '='.repeat(70));
      console.log('\n📋 SECOND YEAR - SECTION BREAKDOWN\n');
      
      const sections = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
      for (const sec of sections) {
        const count = await prisma.user.count({
          where: { role: 'student', year: '2', section: sec }
        });
        if (count > 0) {
          console.log(`Section ${sec}: ${count.toString().padStart(3)} students`);
        }
      }
    }
    
    // Sample records
    console.log('\n' + '='.repeat(70));
    console.log('\n📝 SAMPLE RECORDS\n');
    
    // First year samples
    if (firstYearStudents > 0) {
      console.log('First Year Students (3 samples):');
      const firstYearSamples = await prisma.user.findMany({
        where: { role: 'student', year: '1' },
        select: { username: true, name: true, section: true, year: true },
        take: 3
      });
      
      firstYearSamples.forEach(s => {
        console.log(`  ${s.username} - ${s.name} - Section ${s.section} - Year ${s.year}`);
      });
    }
    
    // Second year samples
    if (secondYearStudents > 0) {
      console.log('\nSecond Year Students (3 samples):');
      const secondYearSamples = await prisma.user.findMany({
        where: { role: 'student', year: '2' },
        select: { username: true, name: true, section: true, year: true },
        take: 3
      });
      
      secondYearSamples.forEach(s => {
        console.log(`  ${s.username} - ${s.name} - Section ${s.section || 'N/A'} - Year ${s.year}`);
      });
    }
    
    // Roll number patterns
    console.log('\n' + '='.repeat(70));
    console.log('\n🔢 ROLL NUMBER PATTERNS\n');
    
    const rollPatterns = [
      { pattern: '25BD1A05', description: 'First Year CSE 2025', year: '1' },
      { pattern: '25BD1A66', description: 'First Year CSM 2025', year: '1' },
      { pattern: '24BD1A05', description: 'Second Year CSE 2024', year: '2' },
      { pattern: '24BD1A66', description: 'Second Year CSM 2024', year: '2' },
      { pattern: '24BD1A76', description: 'Second Year CSD 2024', year: '2' }
    ];
    
    for (const { pattern, description, year } of rollPatterns) {
      const count = await prisma.user.count({
        where: {
          role: 'student',
          username: { startsWith: pattern }
        }
      });
      
      if (count > 0) {
        const yearMatch = await prisma.user.count({
          where: {
            role: 'student',
            username: { startsWith: pattern },
            year: year
          }
        });
        
        const status = yearMatch === count ? '✅' : '⚠️';
        console.log(`${status} ${pattern}xx - ${description}: ${count} students (${yearMatch} with correct year field)`);
      }
    }
    
    // Warnings
    console.log('\n' + '='.repeat(70));
    console.log('\n⚠️  POTENTIAL ISSUES\n');
    
    let issuesFound = false;
    
    // Students without year
    if (noYearStudents > 0) {
      console.log(`❌ ${noYearStudents} students don't have a year assigned`);
      issuesFound = true;
    }
    
    // First year students with wrong pattern
    const firstYearWrongPattern = await prisma.user.count({
      where: {
        role: 'student',
        year: '1',
        NOT: {
          OR: [
            { username: { startsWith: '25BD1A05' } },
            { username: { startsWith: '25BD1A66' } }
          ]
        }
      }
    });
    
    if (firstYearWrongPattern > 0) {
      console.log(`⚠️  ${firstYearWrongPattern} students marked as year="1" but don't have 25BD1A05xx or 25BD1A66xx roll numbers`);
      issuesFound = true;
    }
    
    // Second year students with wrong pattern
    const secondYearWrongPattern = await prisma.user.count({
      where: {
        role: 'student',
        year: '2',
        NOT: {
          OR: [
            { username: { startsWith: '24BD1A05' } },
            { username: { startsWith: '24BD1A66' } },
            { username: { startsWith: '24BD1A76' } }
          ]
        }
      }
    });
    
    if (secondYearWrongPattern > 0) {
      console.log(`⚠️  ${secondYearWrongPattern} students marked as year="2" but don't have 24BD1Axx roll numbers`);
      issuesFound = true;
    }
    
    if (!issuesFound) {
      console.log('✅ No issues found! All students are correctly configured.');
    }
    
    console.log('\n' + '='.repeat(70));
    console.log('\n✨ Verification complete!\n');
    
  } catch (err) {
    console.error('\n❌ ERROR:', err);
    console.error(err.stack);
  } finally {
    await prisma.$disconnect();
  }
}

// Run verification
verifyStudents();
