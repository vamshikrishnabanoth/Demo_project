# 🚀 Quick Start: First Year Student Setup

## One-Line Summary
Add 576 first-year students to your quiz platform while keeping second-year students separate and functional.

## ⚡ Super Quick Setup (5 Minutes)

### Step 1: Save Your CSV
Put your CSV file here:
```
Demo_project/Students (B-TECH-1-CSE-undefined) (9).csv
```

### Step 2: Run Setup
```bash
cd server
node setup_first_year.js
```

**That's it!** ✨

The script will:
1. ✅ Mark existing students as year "2" (second year)
2. ✅ Import new students as year "1" (first year)
3. ✅ Verify everything is correct

## 🎯 What Gets Done

### Before
- Second year students: No year field or mixed values
- First year students: Not in database

### After
- Second year students: `year = "2"`, roll numbers 24BD1Axxxx
- First year students: `year = "1"`, roll numbers 25BD1A05xx
- Both can login and use the platform independently

## 🔑 Login After Setup

**All Students**:
- Username: Roll Number (e.g., `25BD1A0501`)
- Password: Roll Number (e.g., `25BD1A0501`)

Students should change password after first login.

## ✅ Quick Verification

Run this to check everything:
```bash
node verify_students.js
```

You should see:
- ~576 first year students (year="1")
- ~XXX second year students (year="2")  
- All with correct names and sections

## 🧪 Test Before Live Event

```bash
# 1. Test login
# Open website → Login with: 25BD1A0501 / 25BD1A0501

# 2. Create test quiz
# Login as teacher → Create quiz

# 3. Have 10 students join and test
# They login → Join quiz → Answer → See results

# 4. Check it works smoothly
```

## 📁 Important Files

### Scripts (All in `server/` folder)
- `setup_first_year.js` - Main setup script (run this!)
- `verify_students.js` - Check everything is correct
- `import_first_year_from_csv.js` - Import first year students
- `update_second_year_field.js` - Update second year students

### Documentation
- `SETUP_SUMMARY.md` - Complete overview
- `README_FIRST_YEAR_IMPORT.md` - Detailed guide
- `QUICK_START.md` - This file

## 🐛 Common Issues

### "CSV file not found"
Put CSV in project root (not in `server/` folder):
```
Demo_project/
├── Students (B-TECH-1-CSE-undefined) (9).csv  ← Here
└── server/
    └── setup_first_year.js
```

### "Can't login"
- Username and password are case-sensitive
- Must be exact roll number
- Run `node verify_students.js` to check student exists

### "Database error"
- Check PostgreSQL is running
- Check `.env` has correct DATABASE_URL
- Try: `npx prisma generate` then run setup again

## 📊 Expected Numbers

After setup:
- Total students: ~800-900
- First year: 576 students
- Second year: Your existing count
- All can login and use platform

## 🎓 Database Fields

Each student has:
```
username: "25BD1A0501"
name: "ADITYA KONDURU"
section: "A"
year: "1"           ← KEY FIELD (1=first year, 2=second year)
studentBranch: "CSE"
role: "student"
```

## 🚀 Tomorrow's Live Test

1. Run setup today
2. Test with 10 students
3. Tomorrow: 300 students join live quiz
4. Monitor: Server stays responsive
5. Verify: Scores and ranks work correctly

## 📞 Need Help?

Read the detailed guide:
```bash
cat server/README_FIRST_YEAR_IMPORT.md
```

Check everything is working:
```bash
cd server
node verify_students.js
```

## ⚠️ Important Notes

- ✅ Safe to run setup multiple times
- ✅ Won't delete existing students
- ✅ Won't create duplicates
- ⚠️ Take database backup first (recommended)
- ⚠️ Year field is critical for differentiation

## 🎉 You're Ready!

After running `node setup_first_year.js`:
1. ✅ All students are in database
2. ✅ Correctly differentiated by year
3. ✅ Can login and use platform
4. ✅ Ready for tomorrow's test

**Good luck with the live event! 🚀**

---

**Questions?** Check `SETUP_SUMMARY.md` for more details.
