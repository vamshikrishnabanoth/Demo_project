const prisma = require('./lib/prisma');

/**
 * Update Second Year Students
 * 
 * This script ensures all existing second-year students have year="2" set.
 * Identifies them by roll number patterns: 24BD1A05xx, 24BD1A66xx, 24BD1A76xx
 */

async function updateSecondYearStudents() {
  try {
    console.log('🔄 UPDATING SECOND YEAR STUDENT RECORDS\n');
    console.log('='.repeat(60));
    
    // Patterns for second year (2024 batch)
    const secondYearPatterns = ['24BD1A05', '24BD1A66', '24BD1A76'];
    
    let totalUpdated = 0;
    
    for (const pattern of secondYearPatterns) {
      console.log(`\n📝 Processing roll numbers starting with: ${pattern}xx`);
      
      // Find students matching this pattern
      const students = await prisma.user.findMany({
        where: {
          role: 'student',
          username: { startsWith: pattern }
        },
        select: { id: true, username: true, name: true, year: true }
      });
      
      console.log(`   Found ${students.length} students`);
      
      // Update those without year="2"
      const needsUpdate = students.filter(s => s.year !== '2');
      
      if (needsUpdate.length > 0) {
        console.log(`   Updating ${needsUpdate.length} students to year="2"`);
        
        for (const student of needsUpdate) {
          await prisma.user.update({
            where: { id: student.id },
            data: { year: '2', semester: '2' }  // Assuming they're in second semester
          });
        }
        
        totalUpdated += needsUpdate.length;
      } else {
        console.log(`   ✅ All students already have year="2"`);
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log(`\n✨ Update complete! Updated ${totalUpdated} student records.\n`);
    
    // Verify the update
    console.log('📊 Verification:\n');
    
    const secondYearCount = await prisma.user.count({
      where: { role: 'student', year: '2' }
    });
    
    console.log(`   Second Year Students (year="2"): ${secondYearCount}`);
    
    for (const pattern of secondYearPatterns) {
      const count = await prisma.user.count({
        where: {
          role: 'student',
          username: { startsWith: pattern },
          year: '2'
        }
      });
      
      console.log(`   ${pattern}xx: ${count} students`);
    }
    
    console.log('\n✅ All second-year students now have year="2" set correctly!\n');
    
  } catch (err) {
    console.error('\n❌ ERROR:', err);
    console.error(err.stack);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the update
updateSecondYearStudents();
