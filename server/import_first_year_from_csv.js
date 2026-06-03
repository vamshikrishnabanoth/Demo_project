const bcrypt = require('bcryptjs');
const prisma = require('./lib/prisma');
const fs = require('fs');
const path = require('path');

/**
 * Import First Year CSE & CSM Students from CSV
 * 
 * Reads:
 * - "Students (B.TECH_1_CSE-undefined) (9).csv" (Branch: CSE)
 * - "Students (B.TECH_1_CSM-undefined) (9).csv" (Branch: CSM)
 * 
 * Copies them from the Desktop to server/student_data if found.
 * Sets: year="1", studentBranch="CSE"|"CSM", role="student"
 * Password: Roll number (students can change later)
 */

async function importFirstYearStudents() {
  try {
    console.log('🎓 FIRST YEAR STUDENT IMPORT - 2025 BATCH (CSE & CSM)\n');
    console.log('='.repeat(60));
    
    const desktopDir = 'C:\\Users\\samanvi\\OneDrive\\Desktop';
    const targetDir = path.join(__dirname, 'student_data');
    
    // Create target dir if it doesn't exist
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    const filesToImport = [
      {
        fileName: 'Students (B.TECH_1_CSE-undefined) (9).csv',
        branch: 'CSE',
        rollPattern: /^25BD1A05[0-9A-Z]{2}$/i
      },
      {
        fileName: 'Students (B.TECH_1_CSM-undefined) (9).csv',
        branch: 'CSM',
        rollPattern: /^25BD1A66[0-9A-Z]{2}$/i
      }
    ];
    
    // Copy files from Desktop to student_data if available
    for (const fileInfo of filesToImport) {
      const desktopPath = path.join(desktopDir, fileInfo.fileName);
      const destPath = path.join(targetDir, fileInfo.fileName);
      
      if (fs.existsSync(desktopPath)) {
        console.log(`📋 Found ${fileInfo.fileName} on Desktop. Copying to server/student_data...`);
        fs.copyFileSync(desktopPath, destPath);
        console.log(`   ✅ Copied successfully.`);
      } else {
        console.log(`ℹ️ Checked Desktop for ${fileInfo.fileName} (not found, will check local target dir).`);
      }
    }
    
    // Check if files exist locally now
    let allFilesExist = true;
    for (const fileInfo of filesToImport) {
      const localPath = path.join(targetDir, fileInfo.fileName);
      if (!fs.existsSync(localPath)) {
        console.error(`❌ Missing file: ${fileInfo.fileName} is not in server/student_data/ or Desktop.`);
        allFilesExist = false;
      }
    }
    
    if (!allFilesExist) {
      console.error('\n❌ Please place both CSV files on your Desktop or in server/student_data/ and run this script again.');
      return;
    }
    
    // Generate hashed password salt
    console.log('\n🔐 Generating secure password salt...');
    const salt = await bcrypt.genSalt(10);
    
    let totalImported = 0;
    let totalErrors = [];
    
    for (const fileInfo of filesToImport) {
      const localPath = path.join(targetDir, fileInfo.fileName);
      console.log(`\n📖 Reading CSV file: ${fileInfo.fileName} (${fileInfo.branch})`);
      
      const csvContent = fs.readFileSync(localPath, 'utf8');
      const lines = csvContent.trim().split('\n');
      
      // Skip header and BOM if present
      const dataLines = lines.slice(1).filter(line => {
        const trimmed = line.trim();
        return trimmed && !trimmed.startsWith('S.No');
      });
      
      console.log(`📊 Found ${dataLines.length} entries in CSV`);
      
      let fileImported = 0;
      
      for (let i = 0; i < dataLines.length; i++) {
        const line = dataLines[i].trim();
        
        // Handle BOM and split CSV columns
        const cleanLine = line.replace(/^\uFEFF/, '');
        const parts = cleanLine.split(',');
        
        if (parts.length < 4) {
          totalErrors.push(`[${fileInfo.branch}] Line ${i + 2}: Invalid format - ${line}`);
          continue;
        }
        
        const sno = parts[0].trim();
        const rollNo = parts[1].trim().toUpperCase();
        const name = parts[2].trim();
        const section = parts[3].trim().toUpperCase();
        
        if (!rollNo || !name || !section) {
          totalErrors.push(`[${fileInfo.branch}] Line ${i + 2}: Missing data - ${line}`);
          continue;
        }
        
        // Validate roll number format
        if (!rollNo.match(fileInfo.rollPattern)) {
          totalErrors.push(`[${fileInfo.branch}] Line ${i + 2}: Invalid roll number format - ${rollNo}`);
          continue;
        }
        
        try {
          // Hash password (use roll number in uppercase + @kk as password)
          const password = await bcrypt.hash(`${rollNo}@kk`, salt);
          
          // Upsert student
          await prisma.user.upsert({
            where: { email: rollNo },
            update: {
              name: name,
              section: section,
              studentBranch: fileInfo.branch,
              year: '1',
              semester: '1'
            },
            create: {
              username: rollNo,
              email: rollNo,
              password: password,
              name: name,
              role: 'student',
              studentBranch: fileInfo.branch,
              section: section,
              year: '1',
              semester: '1'
            }
          });
          
          fileImported++;
          totalImported++;
          
          if (fileImported % 50 === 0) {
            console.log(`   ✅ Processed ${fileImported}/${dataLines.length} students...`);
          }
        } catch (err) {
          totalErrors.push(`[${fileInfo.branch}] ${rollNo} (${name}): ${err.message}`);
        }
      }
      
      console.log(`✅ Successfully imported/updated ${fileImported} students for ${fileInfo.branch}.`);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 IMPORT SUMMARY\n');
    console.log(`✅ Successfully imported: ${totalImported} first-year students`);
    console.log(`❌ Errors encountered: ${totalErrors.length}`);
    
    if (totalErrors.length > 0) {
      console.log('\n⚠️  ERROR DETAILS:');
      totalErrors.slice(0, 15).forEach(err => console.log(`   - ${err}`));
      if (totalErrors.length > 15) {
        console.log(`   ... and ${totalErrors.length - 15} more errors`);
      }
    }
    
    // Database statistics
    console.log('\n' + '='.repeat(60));
    console.log('📈 DATABASE STATISTICS\n');
    
    const firstYearCount = await prisma.user.count({
      where: { role: 'student', year: '1' }
    });
    
    const secondYearCount = await prisma.user.count({
      where: { role: 'student', year: '2' }
    });
    
    const totalStudents = await prisma.user.count({
      where: { role: 'student' }
    });
    
    console.log(`👤 First Year Students (year="1"):  ${firstYearCount}`);
    console.log(`👤 Second Year Students (year="2"): ${secondYearCount}`);
    console.log(`👥 Total Students in DB:            ${totalStudents}`);
    
    // Section breakdown for first year
    console.log('\n📋 First Year Breakdown by Branch and Section:');
    for (const fileInfo of filesToImport) {
      console.log(`\n  Branch: ${fileInfo.branch}`);
      const sections = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
      for (const sec of sections) {
        const count = await prisma.user.count({
          where: { role: 'student', year: '1', section: sec, studentBranch: fileInfo.branch }
        });
        if (count > 0) {
          console.log(`    Section ${sec}: ${count} students`);
        }
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('🔑 LOGIN CREDENTIALS\n');
    console.log('First-year students can login with:');
    console.log('   Username: <Roll Number> (e.g., 25BD1A0501 or 25BD1A6601)');
    console.log('   Password: <Roll Number>@kk (e.g., 25BD1A0501@kk or 25BD1A6601@kk)');
    console.log('\n💡 Students can change their password after first login.');
    console.log('\n' + '='.repeat(60));
    console.log('✨ Import complete! Students are ready to use the system.\n');
    
  } catch (err) {
    console.error('\n❌ FATAL ERROR:', err);
    console.error(err.stack);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the import
importFirstYearStudents();
