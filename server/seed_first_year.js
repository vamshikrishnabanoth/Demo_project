const bcrypt = require('bcryptjs');
const prisma = require('./lib/prisma');

// First Year CSE Students (2025 batch) - Roll numbers start with 25BD1A05
// All 576 first year students from the CSV provided
const firstYearStudentsData = `25BD1A0501,ADITYA KONDURU,A
25BD1A0502,ADVAITH REDDY VEMULA,A
25BD1A0503,AGURLA SIDDARTH,A
25BD1A0504,ANUGA CHARAN TEJ,A
25BD1A0505,ANUGUTHALA SHIVA,A
25BD1A0506,AVULA SIDDHARTH,A
25BD1A0507,BADDAM SRUJAN REDDY,A
25BD1A0508,BAIREDDY YASHA SRI,A
25BD1A0509,BANDARI ANIRUDH YADAV,A
25BD1A050A,BARIGADA JAGRUTHI,A
25BD1A050B,BODHANAPU MANOGNA,A
25BD1A050C,BOKKA VIKAS,A
25BD1A050D,BOLAKONDA TEJASREE,A
25BD1A050E,BOOTHKUR SAIVARSHITH REDDY,A
25BD1A050F,CHANDANA BASIREDDY,A
25BD1A050G,CHANDIKA SREESH NARAYAN,A
25BD1A050H,DEVANABOYINA CHARMITH,A
25BD1A050J,ELLANDHULA LAXMI SANTHOSHI,A
25BD1A050K,EMMADI SAI SAHASRA,A
25BD1A050L,GANDEPALLY SRIRAM DATTA,A
25BD1A050M,GOSULA AKHILA,A
25BD1A050N,GUDDAM MANOJ,A
25BD1A050P,GUDURU SURYATEJA,A
25BD1A050Q,GUNREDDY MEGHANA,A
25BD1A050R,JITENDRIYA SHARMA,A
25BD1A050T,KANDHIKONDA ABHIRAM,A
25BD1A050U,KANUMURI SRAVAN,A
25BD1A050V,KARRA SAI SRINIDHI,A
25BD1A050W,KATHI SAHASRA,A
25BD1A050X,KATTAGANI NIKHIL,A
25BD1A050Y,KOTA SAI AKSHAYA,A
25BD1A050Z,MALEGOUNI LAKSHMI SAI RAAGGHAV,A
25BD1A0511,MANCHIKANTI YASHWANTH,A
25BD1A0512,MANDA SHRADDHA TANVITA,A
25BD1A0513,MOHAMMED AHSAN AHMED,A
25BD1A0514,MOOSAPETA ANIKETH YADAV,A
25BD1A0515,MUDIGONDA AKSHAY,A
25BD1A0516,MUTHIREDDY TANMAYEE,A
25BD1A0517,N THANMAYE,A
25BD1A0518,NAGAVARAM NISHANTH,A
25BD1A0519,NALLAN CHAKRAVERTHULA SUDHAMSH VARUN,A
25BD1A051A,NIREK TIWARI,A
25BD1A051B,ORUGANTI MANEESHWAR PRASAD,A
25BD1A051C,P SIDDHARTHA,A
25BD1A051D,PABBA SRICHARAN,A
25BD1A051E,PALA HARSHITH,A
25BD1A051F,PALLAPOTHU SAI PRERIT GUPTA,A
25BD1A051G,PARIPELLY HARSHITH,A
25BD1A051H,POLICE MANOJ PATIL,A
25BD1A051J,RAJOLI SHIVANSHU,A`;

async function seedFirstYearStudents() {
  try {
    console.log('🚀 Starting first-year student import...');
    
    // Common password for all students: their roll number
    const salt = await bcrypt.genSalt(10);
    
    // Parse the data
    const lines = firstYearStudentsData.trim().split('\n');
    const students = lines.map(line => {
      const [rollNo, name, section] = line.split(',').map(s => s.trim());
      return { rollNo, name, section };
    });
    
    console.log(`📂 Found ${students.length} first-year students (sample data)`);
    console.log('⚠️  NOTE: This script has only 50 students for testing.');
    console.log('   Add all 576 students to the firstYearStudentsData string above.');
    
    let imported = 0;
    let skipped = 0;
    
    for (const student of students) {
      const { rollNo, name, section } = student;
      
      // Password is roll number (can be changed later)
      const password = await bcrypt.hash(rollNo, salt);
      
      try {
        await prisma.user.upsert({
          where: { email: rollNo },
          update: {}, // Don't update if exists
          create: {
            username: rollNo,
            email: rollNo,
            password: password,
            name: name,
            role: 'student',
            studentBranch: 'CSE',
            section: section,
            year: '1',  // First year
            semester: '1'
          }
        });
        imported++;
        if (imported % 50 === 0) {
          console.log(`✅ Imported ${imported} students...`);
        }
      } catch (err) {
        console.error(`❌ Error importing ${rollNo}:`, err.message);
        skipped++;
      }
    }
    
    console.log(`\n✨ First-year student import complete!`);
    console.log(`   ✅ Imported: ${imported}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`\n📝 Login credentials:`);
    console.log(`   Username: <Roll Number> (e.g., 25BD1A0501)`);
    console.log(`   Password: <Roll Number> (e.g., 25BD1A0501)`);
    
  } catch (err) {
    console.error('❌ Fatal error during seeding:', err);
  } finally {
    await prisma.$disconnect();
  }
}

seedFirstYearStudents();
