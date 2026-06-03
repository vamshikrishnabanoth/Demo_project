const bcrypt = require('bcryptjs');
const prisma = require('./lib/prisma');
const fs = require('fs');
const path = require('path');

/**
 * Seed First Year CSE Students (2025 batch)
 * Roll numbers: 25BD1A05xx
 * Year: 1 (First Year)
 * Branch: CSE
 * Sections: A-I
 */

async function seedFirstYearStudents() {
  try {
    console.log('🚀 Starting FIRST YEAR student import (2025 batch)...\n');
    
    // Read the data file
    const dataFile = path.join(__dirname, 'student_data', 'first_year_2025_cse.txt');
    
    if (!fs.existsSync(dataFile)) {
      console.error(`❌ Data file not found: ${dataFile}`);
      console.log('\n📝 Please create the file with format: RollNo,Name,Section');
      return;
    }
    
    const fileContent = fs.readFileSync(dataFile, 'utf8');
    const lines = fileContent.trim().split('\n').filter(line => line.trim());
    
    console.log(`📂 Found ${lines.length} first-year students in data file`);
    
    // Common hashed password for all students (their roll number)
    const salt = await bcrypt.genSalt(10);
    
    let imported = 0;
    let updated = 0;
    let skipped = 0;
    
    for (const line of lines) {
      const [rollNo, name, section] = line.split(',').map(s => s.trim());
      
      if (!rollNo || !name || !section) {
        console.log(`⚠️  Skipping invalid line: ${line}`);
        skipped++;
        continue;
      }
      
      // Password: roll number (students can change it later)
      const password = await bcrypt.hash(rollNo, salt);
      
      try {
        const result = await prisma.user.upsert({
          where: { email: rollNo },
          update: {
            // Update name and section if student already exists
            name: name,
            section: section,
            studentBranch: 'CSE',
            year: '1',
            semester: '1'
          },
          create: {
            username: rollNo,
            email: rollNo,
            password: password,
            name: name,
            role: 'student',
            studentBranch: 'CSE',
            section: section,
            year: '1',  // FIRST YEAR
            semester: '1'
          }
        });
        
        // Check if this was an insert or update
        const existing = await prisma.user.findUnique({
          where: { email: rollNo },
          select: { createdAt: true }
        });
        
        imported++;
        
        if (imported % 50 === 0) {
          console.log(`✅ Processed ${imported} students...`);
        }
      } catch (err) {
        console.error(`❌ Error processing ${rollNo} (${name}):`, err.message);
        skipped++;
      }
    }
    
    console.log(`\n✨ First-year student import complete!`);
    console.log(`   ✅ Processed: ${imported}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`\n📊 Database Summary:`);
    
    // Count students by year
    const firstYearCount = await prisma.user.count({
      where: { role: 'student', year: '1' }
    });
    const secondYearCount = await prisma.user.count({
      where: { role: 'student', year: '2' }
    });
    const totalStudents = await prisma.user.count({
      where: { role: 'student' }
    });
    
    console.log(`   👤 First Year Students: ${firstYearCount}`);
    console.log(`   👤 Second Year Students: ${secondYearCount}`);
    console.log(`   👥 Total Students: ${totalStudents}`);
    
    console.log(`\n🔑 Login credentials for first year students:`);
    console.log(`   Username: <Roll Number> (e.g., 25BD1A0501)`);
    console.log(`   Password: <Roll Number> (e.g., 25BD1A0501)`);
    console.log(`\n💡 Students identified by:`);
    console.log(`   - Roll numbers starting with 25BD1A05 = First Year (2025 batch)`);
    console.log(`   - Roll numbers starting with 24BD1A05/24BD1A66/24BD1A76 = Second Year (2024 batch)`);
    
  } catch (err) {
    console.error('❌ Fatal error during seeding:', err);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seeding
seedFirstYearStudents();
