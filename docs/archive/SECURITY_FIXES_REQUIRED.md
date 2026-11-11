# 🔒 CRITICAL SECURITY FIXES REQUIRED

## Priority Assessment

### 🚨 CRITICAL (Fix TODAY - Before Tomorrow's Test)

#### Issue #6: Correct Answers Exposed in API Response
**Severity**: CRITICAL 🔴  
**Impact**: Students can cheat by viewing correct answers in DevTools  
**Must Fix**: YES - This defeats the entire purpose of the quiz

**Current Problem**:
```javascript
// API response includes correctAnswer
{
  "questions": [
    {
      "text": "What is 2+2?",
      "options": ["2", "3", "4", "5"],
      "correctAnswer": 2  // ← EXPOSED TO STUDENTS!
    }
  ]
}
```

**Solution**: Strip `correctAnswer` from student-facing endpoints

---

### ⚠️ HIGH PRIORITY (Fix Before Production)

#### Issue #2: Auto-submit on Tab Switching
**Severity**: HIGH 🟠  
**Impact**: Students switching tabs lose their work  
**Recommendation**: Implement with warning first

#### Issue #3: Tab Switch Limit
**Severity**: HIGH 🟠  
**Impact**: Prevents excessive cheating attempts  
**Recommendation**: Set to 2-3 switches, then auto-submit

---

### 📋 MEDIUM PRIORITY (Nice to Have)

#### Issue #1: Strict Fullscreen Mode
**Severity**: MEDIUM 🟡  
**Impact**: Reduces cheating via external resources  
**Note**: Can be bypassed, but adds friction

#### Issue #4: Disable Developer Tools
**Severity**: MEDIUM 🟡  
**Impact**: Makes cheating harder but not impossible  
**Note**: Can be bypassed by tech-savvy students

#### Issue #5: Window Size Detection
**Severity**: MEDIUM 🟡  
**Impact**: Detects DevTools opening  
**Note**: Good supplement to other measures

---

## Implementation Priority

### TODAY (Before Tomorrow's Test):
1. ✅ **Fix #6**: Remove correct answers from API response

### This Week (Before Next Quiz):
2. ⚠️ **Fix #2 & #3**: Tab switching detection + auto-submit
3. ⚠️ **Fix #4**: Disable F12 and dev tool shortcuts

### Later (For Production):
4. 📋 **Fix #1 & #5**: Fullscreen + window size detection

---

## Detailed Fix Plans Below
