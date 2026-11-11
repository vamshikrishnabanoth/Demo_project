# Troubleshooting 401 Error

## What's Happening

You're seeing two issues:
1. **401 Error in console** - "Failed to load resource: the server responded with a status of 401"
2. **YouTube processing error** - "Could not process the YouTube video"

## Diagnosis

### Issue 1: 401 Unauthorized Error

This could be caused by:

#### A. Server Not Restarted
**Most Likely Cause:** The server is still running the old code without Whisper implementation.

**Solution:**
```bash
# On your production server
pm2 restart app
# or
sudo systemctl restart your-service
# or if running locally
npm start
```

#### B. Token Expired
The authentication token in localStorage has expired.

**Solution:**
1. Open browser DevTools (F12)
2. Go to Application tab → Local Storage
3. Check if 'token' exists
4. Try logging out and logging back in

#### C. CORS Issue
The backend is rejecting requests from the frontend.

**Check:**
- Is the backend running?
- Is CORS configured correctly?
- Are you accessing from the correct domain?

### Issue 2: YouTube Processing Failed

The error message "Could not process the YouTube video. Please try a different video" suggests:

1. **All 3 methods failed:**
   - ❌ No transcript available
   - ❌ No metadata/description
   - ❌ Whisper transcription failed

2. **Possible causes:**
   - GROQ_API_KEY not configured
   - Server not restarted with new code
   - Video is actually unavailable
   - Network issues

## Quick Diagnostic Steps

### Step 1: Check if Server Has New Code

**On server, check the controller file:**
```bash
grep -n "METHOD 3: Whisper Audio Transcription" server/controllers/quizController.js
```

**Expected:** Should find the line with "METHOD 3: Whisper Audio Transcription"
**If not found:** Server doesn't have the new code yet

### Step 2: Check Server Logs

**Look for YouTube processing logs:**
```bash
# If using PM2
pm2 logs app | grep YouTube

# If using systemd
journalctl -u your-service | grep YouTube

# If running directly
# Check console output
```

**Expected logs:**
```
[YouTube] Method 1: Attempting transcript extraction
[YouTube] ⚠️ Transcript not available
[YouTube] Method 2: Fetching video metadata
[YouTube] ⚠️ Metadata extraction failed
[YouTube] Method 3: Downloading audio for transcription
```

### Step 3: Check GROQ_API_KEY

**On server:**
```bash
# Check if GROQ_API_KEY is set
grep GROQ_API_KEY .env

# Or check environment variables
echo $GROQ_API_KEY
```

**Expected:** Should show your Groq API key
**If empty:** Whisper fallback won't work

### Step 4: Test Authentication

**In browser console:**
```javascript
// Check if token exists
console.log('Token:', localStorage.getItem('token'));

// Test API call
fetch('https://your-backend-url/api/students/gamification', {
    headers: {
        'x-auth-token': localStorage.getItem('token')
    }
})
.then(r => r.json())
.then(d => console.log('Auth works:', d))
.catch(e => console.log('Auth failed:', e));
```

## Solutions

### Solution 1: Server Not Restarted (Most Common)

```bash
# Pull latest code
git pull origin main

# Restart server
pm2 restart app
# or
npm start
```

### Solution 2: GROQ_API_KEY Not Set

```bash
# Add to .env file
echo "GROQ_API_KEY=your-groq-api-key-here" >> .env

# Restart server
pm2 restart app
```

### Solution 3: Token Expired

**In browser:**
1. Open DevTools (F12)
2. Go to Application → Local Storage
3. Delete 'token'
4. Refresh page
5. Log in again

### Solution 4: Try Different Video

The video you're testing might actually not work. Try these known working videos:

**Videos with captions (should work instantly):**
- Khan Academy: https://www.youtube.com/watch?v=airT-m9LcoY
- TED Talk: https://www.youtube.com/watch?v=8S0FDjFBj8o

**Videos without captions (should use Whisper):**
- Try any short educational clip without captions

## Expected Behavior

### With New Code + GROQ_API_KEY:

**Video with captions:**
```
[YouTube] Method 1: Attempting transcript extraction
[YouTube] ✅ Transcript extracted: 5234 chars
[YouTube] ✅ Content extracted via transcript
```
**Result:** Works in ~5 seconds

**Video without captions:**
```
[YouTube] Method 1: Attempting transcript extraction
[YouTube] ⚠️ Transcript not available
[YouTube] Method 2: Fetching video metadata
[YouTube] ⚠️ Metadata extraction failed
[YouTube] Method 3: Downloading audio for transcription
[YouTube] ✅ Audio downloaded
[YouTube] ✅ Whisper transcription: 3456 chars
[YouTube] ✅ Content extracted via whisper-audio
```
**Result:** Works in ~30-60 seconds

### Without GROQ_API_KEY:

**Video without captions:**
```
[YouTube] Method 1: Attempting transcript extraction
[YouTube] ⚠️ Transcript not available
[YouTube] Method 2: Fetching video metadata
[YouTube] ⚠️ Metadata extraction failed
[YouTube] Method 3: Downloading audio for transcription
❌ Error: Could not extract content from this video. 
   Please configure GROQ_API_KEY for audio transcription
```

## Checklist

- [ ] Server has latest code (check with grep command)
- [ ] Server has been restarted
- [ ] GROQ_API_KEY is set in .env
- [ ] User is logged in (check localStorage token)
- [ ] Backend is running and accessible
- [ ] Tested with a video that has captions
- [ ] Checked server logs for errors

## Still Not Working?

### Get More Information:

1. **Check exact error in server logs:**
   ```bash
   pm2 logs app --lines 100
   ```

2. **Check network tab in browser:**
   - Open DevTools → Network tab
   - Try submitting YouTube URL
   - Look for the `/api/quiz/generate` request
   - Check the response

3. **Test backend directly:**
   ```bash
   curl -X POST http://localhost:5000/api/quiz/generate \
     -H "x-auth-token: YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"videoUrls": ["https://www.youtube.com/watch?v=dQw4w9WgXcQ"], "type": "topic", "questionCount": 10, "difficulty": "Medium"}'
   ```

## Common Mistakes

1. ❌ **Forgot to restart server** after pulling new code
2. ❌ **GROQ_API_KEY not set** in production .env
3. ❌ **Testing with video that has no captions** before configuring Groq
4. ❌ **Token expired** - need to log out and log back in
5. ❌ **Wrong backend URL** - check VITE_API_URL in frontend

## Quick Fix (Most Likely)

**If you just pushed the code:**

```bash
# On production server
cd /path/to/your/app
git pull origin main
pm2 restart app

# Check if it's running
pm2 status

# Watch logs
pm2 logs app
```

**Then test again with a YouTube video that has captions.**
