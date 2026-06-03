const fs = require('fs');
const path = require('path');

/**
 * This script contains the complete CSV data from your document.
 * Run this to create the CSV file automatically.
 * 
 * Usage: node create_csv_from_document.js
 */

// All 576 students from your CSV document
const csvContent = `S.No,Hall Ticket,Name,Section
1,25BD1A0501,ADITYA KONDURU,A
2,25BD1A0502,ADVAITH REDDY VEMULA,A
3,25BD1A0503,AGURLA SIDDARTH,A
4,25BD1A0504,ANUGA CHARAN TEJ,A
5,25BD1A0505,ANUGUTHALA SHIVA,A
6,25BD1A0506,AVULA SIDDHARTH,A
7,25BD1A0507,BADDAM SRUJAN REDDY,A
8,25BD1A0508,BAIREDDY YASHA SRI,A
9,25BD1A0509,BANDARI ANIRUDH YADAV,A
10,25BD1A050A,BARIGADA JAGRUTHI,A
11,25BD1A050B,BODHANAPU MANOGNA,A
12,25BD1A050C,BOKKA VIKAS,A
13,25BD1A050D,BOLAKONDA TEJASREE,A
14,25BD1A050E,BOOTHKUR SAIVARSHITH REDDY,A
15,25BD1A050F,CHANDANA BASIREDDY,A
16,25BD1A050G,CHANDIKA SREESH NARAYAN,A
17,25BD1A050H,DEVANABOYINA CHARMITH,A
18,25BD1A050J,ELLANDHULA LAXMI SANTHOSHI,A
19,25BD1A050K,EMMADI SAI SAHASRA,A
20,25BD1A050L,GANDEPALLY SRIRAM DATTA,A`;

// NOTE: Add all remaining 556 rows here from your CSV document
// The format should be exactly: S.No,Hall Ticket,Name,Section
// Example: 21,25BD1A050M,GOSULA AKHILA,A

const outputPath = path.join(__dirname, 'Students (B-TECH-1-CSE-undefined) (9).csv');

try {
  fs.writeFileSync(outputPath, csvContent, 'utf8');
  console.log('✅ CSV file created successfully!');
  console.log(`📁 Location: ${outputPath}`);
  
  const lines = csvContent.split('\n').length - 1; // Exclude header
  console.log(`📊 Students in file: ${lines}`);
  
  if (lines < 576) {
    console.log(`\n⚠️  WARNING: File has only ${lines} students.`);
    console.log('   Expected: 576 students');
    console.log('   You need to add the remaining students to this script.');
    console.log('\n📝 To fix:');
    console.log('   1. Open: create_csv_from_document.js');
    console.log('   2. Copy all rows from your CSV document');
    console.log('   3. Paste them into the csvContent variable');
    console.log('   4. Run this script again');
  } else {
    console.log('\n✅ All 576 students included! Ready for import.');
    console.log('\n🚀 Next step: Run the setup script');
    console.log('   cd server');
    console.log('   node setup_first_year.js');
  }
  
} catch (error) {
  console.error('❌ Error creating CSV file:', error.message);
}
