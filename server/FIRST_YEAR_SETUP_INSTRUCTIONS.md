# First Year Student Setup Instructions

## Overview
This document explains how to add all 576 first-year students (2025 batch) to the database.

## Key Differentiators

### Second Year Students (Existing)
- Roll numbers: `24BD1A05xx`, `24BD1A66xx`, `24BD1A76xx`
- Year field in database: `"2"`
- Already in database

### First Year Students (New)
- Roll numbers: `25BD1A05xx`
- Year field in database: `"1"`
- Being added now

## Step-by-Step Process

### Step 1: Save the CSV File
Save your CSV file as: `Students (B-TECH-1-CSE-undefined) (9).csv` in the project root directory.

### Step 2: Run the Import Script
```bash
cd server
node import_first_year_from_csv.js
```

This script will:
1. Read your CSV file
2. Parse all 576 students
3. Hash passwords (roll number as default password)
4. Insert into database with:
   - `year: "1"` (First Year)
   - `studentBranch: "CSE"`
   - `role: "student"`
   - `section: A-I`
   - `semester: "1"`

### Step 3: Verify the Import
```bash
node verify_students.js
```

This will show:
- Total first-year students
- Total second-year students
- Breakdown by section
- Sample student records

## Login Credentials

After import, students can login with:
- **Username**: Their roll number (e.g., `25BD1A0501`)
- **Password**: Their roll number (e.g., `25BD1A0501`)

Students can change their password after first login.

## Database Schema

The User table has these key fields for students:
```
username: String (roll number)
email: String (roll number)
password: String (hashed)
name: String (full name)
role: "student"
studentBranch: "CSE"
section: "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I"
year: "1" | "2"
semester: "1" | "2"
```

## Testing with 300 Students

For tomorrow's test with ~300 students:

1. **Connection Load**: The WebSocket server can handle this. Check:
   ```bash
   node check_server_health.js
   ```

2. **Live Quiz Flow**: Test with a small group first (10-20 students) to verify:
   - Login works
   - Quiz joining works
   - Real-time answer submission
   - Leaderboard updates
   - Result calculation

3. **Performance Monitoring**: Keep an eye on:
   - Server CPU/Memory usage
   - Database query performance
   - WebSocket connection count
   - Network latency

## Troubleshooting

### Students Can't Login
- Verify the student exists: Check database for their roll number
- Ensure `year` field is set to `"1"`
- Password should be their roll number (case-sensitive)

### Data Not Showing Correctly
- Check the `name`, `section`, and `year` fields in database
- Ensure frontend filters by year correctly

### Database Errors
- Check PostgreSQL is running
- Verify DATABASE_URL in `.env`
- Check Prisma client is generated: `npx prisma generate`

## Files Created

1. `import_first_year_from_csv.js` - Main import script
2. `verify_students.js` - Verification script
3. `check_server_health.js` - Health check utility
4. `FIRST_YEAR_SETUP_INSTRUCTIONS.md` - This file

## Next Steps After Import

1. Test login with a few students
2. Create a test quiz
3. Have 10 students join and test the flow
4. Monitor server performance
5. Scale to full class (300 students)
6. Prepare for E2E deployment

## Important Notes

⚠️ **Do NOT delete second-year students** - They should remain in the database with `year: "2"`

⚠️ **Backup database** before running import:
```bash
pg_dump your_database > backup_before_first_year.sql
```

⚠️ **Year field is critical** - It's how the system differentiates first and second year students.
