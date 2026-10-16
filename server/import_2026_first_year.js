/**
 * server/import_2026_first_year.js
 *
 * Imports 2026 First Year Students (CSE & CSM) from first_year_2026.json into Supabase PostgreSQL.
 * Sets:
 * - username: rollNo (e.g. "26BD1A0501")
 * - email: rollNo (e.g. "26BD1A0501")
 * - password: rollNo + "@kk" (e.g. "26BD1A0501@kk")
 * - name: full student name from official records
 * - role: "student"
 * - studentBranch: "CSE" | "CSM"
 * - section: "A" through "I"
 * - year: "1"
 * - semester: "1"
 */

'use strict';

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const prisma = require('./lib/prisma');

async function import2026Students() {
  const jsonPath = path.join(__dirname, 'student_data', 'first_year_2026.json');
  if (!fs.existsSync(jsonPath)) {
    console.error('❌ Data file not found:', jsonPath);
    process.exit(1);
  }

  const rawData = fs.readFileSync(jsonPath, 'utf8');
  const students = JSON.parse(rawData);
  console.log(`\n🎓 Found ${students.length} First-Year 2026 students to import.\n`);

  const salt = await bcrypt.genSalt(10);
  console.log('🔐 Salt generated. Starting batch import...\n');

  let successCount = 0;
  let updateCount = 0;
  let errorCount = 0;
  const errors = [];

  const BATCH_SIZE = 25;
  const total = students.length;

  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = students.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (s) => {
        const rollNo = s.rollNo.trim().toUpperCase();
        const rawPassword = `${rollNo}@kk`;
        const hashedPassword = await bcrypt.hash(rawPassword, salt);

        try {
          const existing = await prisma.user.findFirst({
            where: {
              OR: [{ username: rollNo }, { email: rollNo }]
            }
          });

          if (existing) {
            await prisma.user.update({
              where: { id: existing.id },
              data: {
                name: s.name,
                password: hashedPassword,
                role: 'student',
                studentBranch: s.branch,
                section: s.section,
                year: '1',
                semester: '1'
              }
            });
            updateCount++;
          } else {
            await prisma.user.create({
              data: {
                username: rollNo,
                email: rollNo,
                password: hashedPassword,
                name: s.name,
                role: 'student',
                studentBranch: s.branch,
                section: s.section,
                year: '1',
                semester: '1'
              }
            });
            successCount++;
          }
        } catch (err) {
          errorCount++;
          errors.push({ rollNo, error: err.message });
        }
      })
    );

    const processed = Math.min(i + BATCH_SIZE, total);
    process.stdout.write(`\r⏳ Processed ${processed}/${total} students (${Math.round((processed / total) * 100)}%)...`);
  }

  console.log('\n\n' + '='.repeat(50));
  console.log('🎉 2026 First Year Student Import Complete!');
  console.log(`✅ Newly Created: ${successCount}`);
  console.log(`🔄 Updated Existing: ${updateCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log('='.repeat(50) + '\n');

  if (errors.length > 0) {
    console.error('Sample errors:', errors.slice(0, 5));
  }

  // Self-verification on first student
  const sampleRoll = students[0].rollNo;
  const testUser = await prisma.user.findFirst({ where: { username: sampleRoll } });
  if (testUser) {
    const isPwMatch = await bcrypt.compare(`${sampleRoll}@kk`, testUser.password);
    console.log(`🔍 Verification check for ${sampleRoll}:`);
    console.log(`   - Name: ${testUser.name}`);
    console.log(`   - Branch: ${testUser.studentBranch} | Section: ${testUser.section} | Year: ${testUser.year}`);
    console.log(`   - Password (${sampleRoll}@kk) matches: ${isPwMatch ? 'YES ✅' : 'NO ❌'}`);
  }
}

import2026Students()
  .catch((err) => {
    console.error('❌ Fatal error during import:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
