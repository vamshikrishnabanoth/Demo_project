# 🎯 START HERE - First Year Student Setup

## What You Need to Do (3 Simple Steps)

### Step 1️⃣: Save the CSV File

You have a file called: **`Students (B-TECH-1-CSE-undefined) (9).csv`**

Save it in this folder:
```
Demo_project/   ← Save CSV here (next to this README)
```

**Important**: The file must be in the **main project folder**, not inside the `server/` folder.

### Step 2️⃣: Run the Setup

Open terminal and run:
```bash
cd server
node setup_first_year.js
```

Wait for it to complete (about 1-2 minutes).

### Step 3️⃣: Verify It Worked

```bash
node verify_students.js
```

You should see:
- ✅ First Year Students: 576
- ✅ Second Year Students: (your existing count)
- ✅ No errors or warnings

## ✅ You're Done!

Students can now login with:
- **Username**: Roll Number (e.g., `25BD1A0501`)
- **Password**: Roll Number (e.g., `25BD1A0501`)

## 🧪 Test Before Tomorrow

1. Open your website
2. Login with a first-year student: `25BD1A0501` / `25BD1A0501`
3. Check that their name appears correctly: "ADITYA KONDURU"
4. Create a quiz as teacher
5. Have 5-10 students join and test the flow

## 📞 Need Help?

### Common Problems:

**"CSV file not found"**
- Make sure CSV is in `Demo_project/` folder (not in `server/`)
- Check the filename is exactly: `Students (B-TECH-1-CSE-undefined) (9).csv`

**"Can't login with student roll number"**
- Username and password are case-sensitive
- Must be the exact roll number
- Run `node verify_students.js` to check if student exists

**"Database error"**
- Check PostgreSQL is running
- Verify `.env` file has DATABASE_URL
- Try: `npx prisma generate` then run setup again

### More Information:

- Quick guide: `QUICK_START.md`
- Complete details: `server/README_FIRST_YEAR_IMPORT.md`
- Full overview: `SETUP_SUMMARY.md`

## 📊 What Happens

### Before Setup:
```
Database:
├── Second year students (no year field)
└── No first year students
```

### After Setup:
```
Database:
├── Second year students (year="2") ← Updated
└── First year students (year="1")  ← Added (576 students)
```

## 🎓 Student Data Structure

Each student has:
```
Roll Number: 25BD1A0501
Name: ADITYA KONDURU
Section: A
Year: 1              ← This is the key field!
Branch: CSE
```

## ⚡ Quick Commands Reference

```bash
# Run complete setup
cd server
node setup_first_year.js

# Just verify (doesn't change anything)
node verify_students.js

# Update only second-year students
node update_second_year_field.js

# Import only first-year students
node import_first_year_from_csv.js
```

## 🎉 Tomorrow's Test

After setup is complete:
1. ✅ All 576 first-year students can login
2. ✅ They can join the live quiz
3. ✅ Answer in real-time
4. ✅ See leaderboard
5. ✅ View their results

## ⚠️ Important Notes

- The setup script is **safe to run multiple times**
- It won't create duplicate students
- It won't delete existing data
- It only adds/updates the `year` field

---

**That's it! Follow the 3 steps above and you're ready for tomorrow's test! 🚀**

**Questions?** Read the other documentation files for more details.
