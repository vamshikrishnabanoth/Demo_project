const fs = require('fs');
const path = require('path');
const prisma = require('./lib/prisma');

async function seedStudents() {
  const filePath = path.join(__dirname, 'student_data', 'atlas_ready_students.json');
  
  if (!fs.existsSync(filePath)) {
    console.error('❌ Student data file not found!');
    return;
  }

  try {
    const students = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    console.log(`📂 Found ${students.length} students. Starting import...`);

    let count = 0;
    for (const student of students) {
      // Use upsert to avoid duplicates
      await prisma.user.upsert({
        where: { email: student.email },
        update: {}, // Don't update anything if they exist
        create: {
          username: student.username,
          email: student.email,
          password: student.password, // These are already hashed from MongoDB
          role: 'student'
        }
      });
      count++;
      if (count % 100 === 0) console.log(`✅ Imported ${count} students...`);
    }

    console.log('✨ Student import complete!');
  } catch (err) {
    console.error('❌ Error during seeding:', err);
  } finally {
    await prisma.$disconnect();
  }
}

seedStudents();
