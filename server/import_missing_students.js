const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

// Must load the properly initialized Prisma client from lib/prisma
const prisma = require('./lib/prisma');

async function importStudents() {
    console.log('🚀 Starting Missing Students Import...');
    
    // Read the raw text file
    const filePath = path.join(__dirname, 'student_data', 'missing_students.txt');
    const rawData = fs.readFileSync(filePath, 'utf-8');
    
    // Split by lines and filter empty ones
    const lines = rawData.split('\n').map(line => line.trim()).filter(line => line.length > 0 && !line.includes('JNTUH Roll No'));
    
    console.log(`Found ${lines.length} student records to process.`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Use a regular expression to split by tabs or multiple spaces
        const parts = line.split(/\t|  +/);
        
        if (parts.length >= 3) {
            const rollNo = parts[0].trim();
            const email = `${rollNo.toLowerCase()}@kmit.in`;

            // Dynamic password: lowercase username + @kk
            const rawPassword = `${rollNo.toLowerCase()}@kk`;
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(rawPassword, salt);

            try {
                // Upsert to update existing users with the new password
                await prisma.user.upsert({
                    where: { username: rollNo },
                    update: {
                        password: hashedPassword // UPDATE their password if they exist!
                    }, 
                    create: {
                        username: rollNo,
                        email: email,
                        password: hashedPassword,
                        role: 'student'
                    }
                });
                successCount++;
                if (successCount % 50 === 0) console.log(`✅ Processed & Updated ${successCount} students...`);
            } catch (err) {
                console.error(`❌ Error inserting/updating ${rollNo}:`, err.message);
                errorCount++;
            }
        } else {
            console.warn(`⚠️ Skipping malformed line: ${line}`);
            errorCount++;
        }
    }

    console.log('\n=======================================');
    console.log(`🎉 Import Complete!`);
    console.log(`✅ Successfully added/verified: ${successCount}`);
    console.log(`❌ Errors/Skipped: ${errorCount}`);
    console.log('=======================================');
}

importStudents()
    .catch(e => console.error('Fatal Error:', e))
    .finally(async () => {
        await prisma.$disconnect();
    });
