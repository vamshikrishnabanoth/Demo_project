# ✅ Pre-Launch Checklist - First Year Live Quiz Test

## 📅 Timeline: Today → Tomorrow's Live Test

---

## TODAY - Setup & Testing

### ✅ Database Setup (30 minutes)

- [ ] PostgreSQL database is running
- [ ] `.env` file has correct `DATABASE_URL`
- [ ] Prisma client is generated: `npx prisma generate`
- [ ] **IMPORTANT**: Take database backup:
  ```bash
  pg_dump your_database > backup_before_first_year_$(date +%Y%m%d).sql
  ```

### ✅ CSV File (5 minutes)

- [ ] CSV file saved as: `Students (B-TECH-1-CSE-undefined) (9).csv`
- [ ] File location: Project root (`Demo_project/` folder)
- [ ] File has 577 lines (1 header + 576 students)
- [ ] File encoding is UTF-8

### ✅ Run Setup Scripts (10 minutes)

```bash
cd server
```

- [ ] Run: `node setup_first_year.js`
- [ ] Script completed without fatal errors
- [ ] See message: "✨ All steps completed successfully!"

### ✅ Verification (5 minutes)

- [ ] Run: `node verify_students.js`
- [ ] First Year Students count: **576**
- [ ] Second Year Students count: **(check your existing count)**
- [ ] No warnings about missing year field
- [ ] Sample records look correct

---

## Testing Phase 1: Login (15 minutes)

### ✅ First Year Student Login

- [ ] Open website
- [ ] Login with: `25BD1A0501` / `25BD1A0501`
- [ ] Student name displays: "ADITYA KONDURU"
- [ ] Section shows: "A"
- [ ] Year shows correctly (if displayed on UI)

- [ ] Try another: `25BD1A0521` / `25BD1A0521`
- [ ] Student name displays: "A SAI PRAPUL SHASHANK"
- [ ] Section shows: "B"

### ✅ Second Year Student Login (if testing both)

- [ ] Login with a second-year roll number (e.g., `24BD1A0501`)
- [ ] Student details display correctly
- [ ] No interference between year groups

### ✅ Password Reset/Change (if implemented)

- [ ] Test password change functionality
- [ ] Verify student can login with new password

---

## Testing Phase 2: Quiz Flow (30 minutes)

### ✅ Teacher Setup

- [ ] Login as teacher
- [ ] Create a new quiz
  - [ ] Title: "Test Quiz for First Year"
  - [ ] 5 questions
  - [ ] 30 seconds per question
  - [ ] Access type: Public or with join code

### ✅ Student Join (10 students)

- [ ] Have 10 students ready to join
- [ ] Students can see the quiz (if public) or enter join code
- [ ] All 10 successfully join
- [ ] Student list updates in real-time
- [ ] No connection errors

### ✅ Live Quiz Execution

- [ ] Teacher starts the quiz
- [ ] Students see questions in real-time
- [ ] Students can select answers
- [ ] Timer displays correctly
- [ ] Students can submit answers
- [ ] No lag or delays

### ✅ Leaderboard & Results

- [ ] Leaderboard updates after each question
- [ ] Scores calculate correctly
- [ ] Ranks display properly
- [ ] Final results show at the end
- [ ] Students can view their performance

---

## Testing Phase 3: Load Test (45 minutes)

### ✅ Scale to 50 Students

- [ ] 50 students login successfully
- [ ] Create a quiz
- [ ] All 50 join
- [ ] Quiz executes smoothly
- [ ] No performance degradation

### ✅ Scale to 100 Students

- [ ] 100 students login
- [ ] Join quiz
- [ ] Answer questions
- [ ] System remains stable

### ✅ Monitor Server

- [ ] CPU usage < 70%
- [ ] Memory usage < 80%
- [ ] Database connections stable
- [ ] No error logs
- [ ] Response times < 2 seconds

---

## System Health Check

### ✅ Server

- [ ] Backend server running
- [ ] No error logs in console
- [ ] Health check endpoint responding (if exists)
- [ ] WebSocket server active

### ✅ Database

- [ ] PostgreSQL running
- [ ] Connection pool not exhausted
- [ ] Query performance acceptable
- [ ] No connection timeout errors

### ✅ Network

- [ ] Server has stable internet
- [ ] No firewall blocking WebSocket connections
- [ ] SSL/TLS working (if using HTTPS)

---

## TOMORROW - Live Event with 300 Students

### ✅ Pre-Event (30 min before)

- [ ] Server is running
- [ ] Database is online
- [ ] Test login with a sample student
- [ ] Create the actual quiz for the event
- [ ] Test quiz flow one more time
- [ ] Have backup plan ready (database restore)

### ✅ During Event

- [ ] Monitor dashboard/logs
- [ ] Watch CPU and memory usage
- [ ] Check for error messages
- [ ] Note any performance issues
- [ ] Have terminal open for quick commands

### ✅ Student Experience

- [ ] Students can login quickly
- [ ] Join quiz without errors
- [ ] Answer submission works
- [ ] Leaderboard updates in real-time
- [ ] No students get disconnected
- [ ] Results display correctly

### ✅ Post-Event

- [ ] Collect feedback from students
- [ ] Review error logs (if any)
- [ ] Check database for consistency
- [ ] Document any issues encountered
- [ ] Plan fixes for any problems

---

## Emergency Procedures

### If Students Can't Login

1. Verify student exists: `node verify_students.js`
2. Check password is correct (case-sensitive)
3. Check `year` field is set
4. Try with different student
5. Check server logs for authentication errors

### If Quiz Won't Start

1. Check WebSocket connections
2. Verify database connectivity
3. Check server logs
4. Restart server if needed
5. Have students re-join

### If Server Overloads

1. Monitor resources
2. Limit concurrent connections if possible
3. Restart server
4. Use backup server if available
5. Notify students of delay

### If Database Issues

1. Check PostgreSQL is running
2. Verify connection string
3. Check connection pool
4. Restart database if needed
5. Restore from backup if corrupted

---

## Rollback Plan

If everything fails:

1. **Database Restore**:
   ```bash
   psql your_database < backup_before_first_year_YYYYMMDD.sql
   ```

2. **Inform Students**: 
   - Technical difficulties encountered
   - Will reschedule
   - Keep them informed via announcements

3. **Debug Offline**:
   - Review logs thoroughly
   - Test with smaller groups
   - Fix issues before rescheduling

---

## Success Criteria

### Minimum Success

- [ ] At least 250/300 students can join
- [ ] Quiz completes without major issues
- [ ] Most students can submit answers
- [ ] Leaderboard shows (even if some lag)
- [ ] Results are calculated

### Complete Success

- [ ] All 300 students join smoothly
- [ ] Zero connection drops
- [ ] Real-time updates work perfectly
- [ ] No lag or delays
- [ ] All scores accurate
- [ ] Students satisfied with experience

---

## Post-Launch Next Steps

### After Successful Test

- [ ] Document what worked well
- [ ] Note any issues (minor or major)
- [ ] Plan improvements
- [ ] Prepare for E2E deployment
- [ ] Set up production environment

### E2E Deployment Checklist

- [ ] Production server setup
- [ ] Environment configuration
- [ ] SSL certificates
- [ ] Domain setup
- [ ] CDN configuration (if needed)
- [ ] Monitoring and logging
- [ ] Backup procedures
- [ ] CI/CD pipeline (if applicable)

---

## Contact Information

**Technical Support**:
- Database issues: [Your database admin]
- Server issues: [Your server admin]
- Application issues: [Your dev team]

**Student Support**:
- Login issues: [Support email/number]
- Quiz issues: [Support email/number]

---

## Final Notes

⚠️ **Remember**:
- Take database backup BEFORE running setup
- Test with small group BEFORE live event
- Have rollback plan ready
- Monitor server during live event
- Document everything for future reference

✅ **You're Prepared**:
- Scripts are ready
- Database is set up
- Testing plan is clear
- Emergency procedures in place
- Success criteria defined

🚀 **Good Luck with Tomorrow's Live Test!**

---

**Last Updated**: Setup for 300-student live quiz test  
**Next Review**: After live event
