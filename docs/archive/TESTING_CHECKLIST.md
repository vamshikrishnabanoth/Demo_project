# 🧪 Complete Testing Checklist

## **Authentication Flow**
- [ ] Register new account (teacher, student, admin)
- [ ] Login with valid credentials
- [ ] Login with invalid credentials (error handling)
- [ ] Logout and session cleanup
- [ ] Role selection after first login
- [ ] Token refresh on page reload
- [ ] Suspended user cannot login

## **Teacher Dashboard**
- [ ] View statistics (quizzes, attempts, average score)
- [ ] Create quiz - Text Import
- [ ] Create quiz - PDF Upload
- [ ] Create quiz - AI Topic Generator
- [ ] Create quiz - Voice Dictation
- [ ] Edit existing quiz
- [ ] Delete quiz
- [ ] View My Quizzes list
- [ ] Search/filter quizzes
- [ ] Schedule quiz (start/end time)
- [ ] Assign quiz to specific students/groups
- [ ] Broadcast announcement to students
- [ ] View quiz analytics
- [ ] View question-level analysis

## **Student Dashboard**
- [ ] Join quiz with 6-digit code
- [ ] View assigned assessments
- [ ] Attempt quiz (normal mode)
- [ ] Attempt quiz (live mode)
- [ ] View quiz results
- [ ] View assessment history
- [ ] View leaderboard
- [ ] Receive broadcast notifications
- [ ] View profile and stats

## **Live Quiz Room (Teacher)**
- [ ] Start quiz session
- [ ] View real-time participants
- [ ] Navigate between questions
- [ ] Increase timer
- [ ] View live leaderboard
- [ ] Monitor student progress
- [ ] End quiz session
- [ ] Reconnect after disconnect
- [ ] Handle offline/online transitions

## **Live Quiz Room (Student)**
- [ ] Join with code
- [ ] See current question
- [ ] Submit answer
- [ ] View timer countdown
- [ ] See live leaderboard
- [ ] Reconnect after disconnect
- [ ] Handle quiz end gracefully

## **Admin Dashboard**
- [ ] View all users
- [ ] Suspend/unsuspend users
- [ ] View system statistics
- [ ] Manage user roles

## **AI Service**
- [ ] Generate questions from text
- [ ] Generate questions from PDF
- [ ] Generate questions from topic
- [ ] OCR from images
- [ ] Critic evaluation working
- [ ] Duplicate detection working
- [ ] Quality threshold enforcement

## **Edge Cases**
- [ ] Very long quiz titles (truncation)
- [ ] Very long usernames (truncation)
- [ ] Empty quiz (0 questions)
- [ ] Quiz with 100+ questions
- [ ] 50+ students in live room
- [ ] Network disconnect during quiz
- [ ] Browser refresh during quiz
- [ ] Multiple tabs open (same user)
- [ ] Expired quiz code
- [ ] Invalid quiz code

## **Browser Compatibility**
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Safari (iOS)
- [ ] Mobile Chrome (Android)

## **Responsive Design**
- [ ] Desktop (1920x1080)
- [ ] Laptop (1366x768)
- [ ] Tablet (768x1024)
- [ ] Mobile (375x667 - iPhone SE)
- [ ] Mobile (390x844 - iPhone 12)
- [ ] Mobile (360x800 - Android)

## **Performance**
- [ ] Page load time < 3s
- [ ] Time to interactive < 5s
- [ ] Smooth animations (60fps)
- [ ] No memory leaks (check DevTools)
- [ ] WebSocket reconnection working
- [ ] Large file upload (PDF > 10MB)

## **Security**
- [ ] JWT token expiration
- [ ] Protected routes (unauthorized access)
- [ ] SQL injection prevention
- [ ] XSS prevention
- [ ] CSRF protection
- [ ] Rate limiting working
- [ ] Input validation (all forms)

---

## **Bug Tracking Template**

### Bug #1
**Title:** [Brief description]
**Severity:** Critical / High / Medium / Low
**Steps to Reproduce:**
1. 
2. 
3. 

**Expected:** 
**Actual:** 
**Screenshot:** 
**Browser:** 
**Status:** Open / In Progress / Fixed

---

## **Testing Notes**
- Test with real data (not just "test123")
- Test with slow network (Chrome DevTools throttling)
- Test with disabled JavaScript (graceful degradation)
- Test with screen reader (NVDA/JAWS)
- Test with keyboard only (no mouse)
