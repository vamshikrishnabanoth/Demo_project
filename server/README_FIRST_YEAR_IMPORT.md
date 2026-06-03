# First Year Student Import - Complete Guide

## 🎯 Objective
Add 576 first-year CSE students (2025 batch) to the database while maintaining existing second-year students (2024 batch).

## 📋 Prerequisites
- PostgreSQL database running
- Node.js and npm installed
- Prisma setup complete
- CSV file with first-year student data

## 🚀 Quick Start (3 Simple Steps)

### Step 1: Save the CSV File
Copy your CSV file (`Students (B-TECH-1-CSE-undefined) (9).csv`) to the project root:
```
Demo_project/
├── Students (B-TECH-1-CSE-undefined) (9).csv  ← Here
├── server/
├── client/
└── ...
```

### Step 2: Update Existing Second-Year Students
```bash
cd server
node update_second_year_field.js
```

This ensures all existing students (roll numbers 24BD1Axxxx) have `year="2"` set.

### Step 3: Import First-Year Students
```bash
node import_first_year_from_csv.js
```

This imports all 576 first-year students with `year="1"`.

### Step 4: Verify Everything
```bash
node verify_students.js
```

## 📊 What Gets Set in the Database

### Second Year Students (Existing - 2024 Batch)
- **Roll Numbers**: `24BD1A05xx`, `24BD1A66xx`, `24BD1A76xx`
- **Year Field**: `"2"`
- **Semester**: `"2"` (or as appropriate)
- **Branch**: CSE, CSM, CSD (as per existing data)

### First Year Students (New - 2025 Batch)
- **Roll Numbers**: `25BD1A05xx`
- **Year Field**: `"1"` ✨ KEY DIFFERENTIATOR
- **Semester**: `"1"`
- **Branch**: `"CSE"`
- **Sections**: A, B, C, D, E, F, G, H, I
- **Role**: `"student"`
- **Password**: Roll number (hashed)

## 🔐 Login Credentials

After import, students login with:
- **Username**: Roll Number (e.g., `25BD1A0501`)
- **Password**: Roll Number (e.g., `25BD1A0501`)

## 🧪 Testing Before Live Event

### Test with Small Group (10-20 students)
```bash
# 1. Have 10 students login
# 2. Create a test quiz
# 3. Students join the quiz
# 4. Submit answers
# 5. Check leaderboard updates
# 6. Verify results are calculated correctly
```

### Monitor Server Health
```bash
node check_server_health.js  # (create this if needed)
```

Watch for:
- CPU usage < 70%
- Memory usage < 80%
- WebSocket connections active
- Database response time < 100ms

### Scale Up Gradually
1. ✅ Test with 10 students
2. ✅ Test with 50 students
3. ✅ Test with 100 students
4. ✅ Test with 300 students (your tomorrow's test)

## 🎓 Database Schema Reference

```javascript
User {
  id: String (UUID)
  username: String (roll number)
  email: String (roll number)
  password: String (hashed)
  name: String (full name)
  role: "student" | "teacher" | "admin"
  
  // KEY FIELDS FOR DIFFERENTIATION
  year: "1" | "2"           // ← First vs Second year
  semester: "1" | "2"
  studentBranch: "CSE" | "CSM" | "CSD"
  section: "A" | "B" | "C" | ...
  
  // Other fields...
  xp: Int
  streak: Int
  createdAt: DateTime
  ...
}
```

## 🔍 How to Check Student Data

### Via Database Query
```sql
-- Count by year
SELECT year, COUNT(*) as count 
FROM "User" 
WHERE role = 'student' 
GROUP BY year;

-- Sample first-year students
SELECT username, name, section, year 
FROM "User" 
WHERE role = 'student' AND year = '1' 
LIMIT 10;

-- Sample second-year students
SELECT username, name, section, year 
FROM "User" 
WHERE role = 'student' AND year = '2' 
LIMIT 10;
```

### Via Node.js Script
```bash
node verify_students.js
```

## 🐛 Troubleshooting

### Issue: CSV File Not Found
**Error**: `❌ CSV file not found`

**Solution**:
1. Check file name exactly: `Students (B-TECH-1-CSE-undefined) (9).csv`
2. Place it in project root (not in `server/` folder)
3. Check for hidden extensions (.csv.txt)

### Issue: Students Can't Login
**Error**: Invalid credentials

**Solution**:
1. Verify student exists:
   ```bash
   node -e "require('./lib/prisma').user.findUnique({where:{email:'25BD1A0501'}}).then(console.log)"
   ```
2. Password is case-sensitive (must match roll number exactly)
3. Check `year` field is set to `"1"`

### Issue: Wrong Student Name/Details Shown
**Check**: 
- Ensure `year` field is correctly set
- Frontend queries should filter by year if needed
- Check the `name` field in database

### Issue: Import Script Fails Midway
**Recovery**:
1. Script uses `upsert` - safe to re-run
2. Already imported students won't be duplicated
3. Re-run: `node import_first_year_from_csv.js`

## 📈 Performance Considerations

### For 300 Concurrent Users:
- **WebSocket Connections**: Ensure server supports 300+ concurrent connections
- **Database Connections**: Use connection pooling (Prisma handles this)
- **Memory**: Monitor server memory usage
- **Network**: Ensure adequate bandwidth

### Recommended Server Specs:
- CPU: 4+ cores
- RAM: 8GB+ 
- Database: PostgreSQL with proper indexing
- Network: Stable connection with low latency

## 🔒 Security Notes

1. **Default Passwords**: Students use roll number - remind them to change it
2. **Rate Limiting**: Consider adding rate limiting for login attempts
3. **HTTPS**: Ensure production deployment uses HTTPS
4. **Environment Variables**: Never commit `.env` files

## 📝 Frontend Updates Needed

Make sure your frontend correctly handles the `year` field:

```javascript
// Example: Filtering students by year
const firstYearStudents = students.filter(s => s.year === '1');
const secondYearStudents = students.filter(s => s.year === '2');

// Example: Display logic
{user.year === '1' && <Badge>First Year</Badge>}
{user.year === '2' && <Badge>Second Year</Badge>}
```

## 📞 Support

If you encounter issues:
1. Check `verify_students.js` output
2. Review error logs
3. Check database directly with SQL queries
4. Ensure all scripts completed successfully

## ✅ Pre-Launch Checklist

Before tomorrow's test with 300 students:

- [ ] Second-year students have `year="2"` set
- [ ] First-year students imported with `year="1"`
- [ ] Verified with `verify_students.js`
- [ ] Tested login with sample students (both years)
- [ ] Created a test quiz
- [ ] Tested with 10 students successfully
- [ ] Server health monitoring in place
- [ ] Database backup taken
- [ ] Live quiz flow tested end-to-end
- [ ] Leaderboard updates working
- [ ] Results calculation correct
- [ ] WebSocket connections stable

## 🎉 Success Criteria

After import, you should see:
- ✅ ~576 first-year students with `year="1"`
- ✅ All existing second-year students with `year="2"`
- ✅ Students can login with roll number
- ✅ Student details (name, section) display correctly
- ✅ Live quiz features work for all students
- ✅ No impact on existing second-year data

---

**Created**: For 2025 First Year CSE Student Import  
**Last Updated**: Setup for live testing with 300+ students
