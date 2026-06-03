const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

/**
 * Master Setup Script for First Year Students
 * 
 * This script runs all necessary steps in sequence:
 * 1. Update second-year students (set year="2")
 * 2. Import first-year students (set year="1")
 * 3. Verify the import
 */

async function runScript(scriptName, description) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🚀 ${description}`);
  console.log(`${'='.repeat(70)}\n`);
  
  try {
    const { stdout, stderr } = await execPromise(`node ${scriptName}`);
    console.log(stdout);
    if (stderr) console.error(stderr);
    return true;
  } catch (error) {
    console.error(`❌ Error running ${scriptName}:`, error.message);
    return false;
  }
}

async function setupFirstYear() {
  console.log('\n');
  console.log('╔' + '═'.repeat(68) + '╗');
  console.log('║' + ' '.repeat(15) + 'FIRST YEAR STUDENT SETUP' + ' '.repeat(29) + '║');
  console.log('║' + ' '.repeat(20) + '2025 CSE Batch' + ' '.repeat(34) + '║');
  console.log('╚' + '═'.repeat(68) + '╝');
  console.log('\n');
  
  // Step 1: Update second-year students
  const step1Success = await runScript(
    'update_second_year_field.js',
    'STEP 1/3: Updating Second-Year Students'
  );
  
  if (!step1Success) {
    console.log('\n❌ Setup failed at Step 1. Please fix errors and try again.\n');
    return;
  }
  
  // Step 2: Import first-year students
  const step2Success = await runScript(
    'import_first_year_from_csv.js',
    'STEP 2/3: Importing First-Year Students'
  );
  
  if (!step2Success) {
    console.log('\n❌ Setup failed at Step 2. Please fix errors and try again.\n');
    return;
  }
  
  // Step 3: Verify everything
  const step3Success = await runScript(
    'verify_students.js',
    'STEP 3/3: Verifying Student Database'
  );
  
  // Final summary
  console.log('\n');
  console.log('╔' + '═'.repeat(68) + '╗');
  console.log('║' + ' '.repeat(25) + 'SETUP COMPLETE' + ' '.repeat(29) + '║');
  console.log('╚' + '═'.repeat(68) + '╝');
  console.log('\n');
  
  if (step1Success && step2Success && step3Success) {
    console.log('✨ All steps completed successfully!\n');
    console.log('📋 Next Steps:');
    console.log('   1. Test login with a first-year student (e.g., 25BD1A0501)');
    console.log('   2. Test login with a second-year student (e.g., 24BD1A0501)');
    console.log('   3. Create a test quiz');
    console.log('   4. Test with 10 students joining the quiz');
    console.log('   5. Gradually scale up to 300 students\n');
    console.log('🔑 Login Credentials:');
    console.log('   Username: Roll Number');
    console.log('   Password: Roll Number@kk (e.g. 25BD1A0501@kk)\n');
  } else {
    console.log('⚠️  Setup completed with some issues. Review logs above.\n');
  }
}

// Run the setup
setupFirstYear().catch(err => {
  console.error('\n❌ Fatal error:', err);
  process.exit(1);
});
