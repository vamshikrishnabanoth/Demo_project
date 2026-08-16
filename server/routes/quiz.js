const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const quizController = require('../controllers/quizController');
const { getTask } = require('../services/taskManager');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { check, validationResult } = require('express-validator');

// ── SECURITY: Role-based access control for teacher-only operations ───────────
const teacherOrAdmin = (req, res, next) => {
    if (!req.user || !['teacher', 'admin'].includes(req.user.role)) {
        return res.status(403).json({ msg: 'Teacher or admin access required' });
    }
    next();
};

// ── MIME Magic Bytes Verification ─────────────────────────────────────────────
// Validates actual file content signatures (magic bytes) rather than trusting extensions alone.
// Prevents extension spoofing (e.g., renaming malware.exe to malware.pdf).
const FILE_SIGNATURES = {
    '.pdf':  [Buffer.from([0x25, 0x50, 0x44, 0x46])],           // %PDF
    '.docx': [Buffer.from([0x50, 0x4B, 0x03, 0x04])],           // PK (ZIP-based)
    '.pptx': [Buffer.from([0x50, 0x4B, 0x03, 0x04])],           // PK (ZIP-based)
    '.jpg':  [Buffer.from([0xFF, 0xD8, 0xFF])],                   // JFIF
    '.jpeg': [Buffer.from([0xFF, 0xD8, 0xFF])],                   // JFIF
    '.png':  [Buffer.from([0x89, 0x50, 0x4E, 0x47])],            // PNG
    '.mp3':  [Buffer.from([0xFF, 0xFB]), Buffer.from([0xFF, 0xF3]), Buffer.from([0xFF, 0xF2]), Buffer.from([0x49, 0x44, 0x33])], // MP3/ID3
    '.wav':  [Buffer.from([0x52, 0x49, 0x46, 0x46])],            // RIFF
    '.m4a':  [Buffer.from([0x00, 0x00, 0x00])],                   // ftyp (MPEG-4)
    '.webm': [Buffer.from([0x1A, 0x45, 0xDF, 0xA3])],            // EBML
    '.ogg':  [Buffer.from([0x4F, 0x67, 0x67, 0x53])],            // OggS
    // .txt files don't have magic bytes — rely on extension only
};

function verifyFileMagicBytes(filePath, ext) {
    const isAudioExt = ['.webm', '.mp3', '.wav', '.m4a', '.ogg'].includes(ext);
    
    try {
        const fs = require('fs');
        const buffer = Buffer.alloc(256);
        const fd = fs.openSync(filePath, 'r');
        const bytesRead = fs.readSync(fd, buffer, 0, 256, 0);
        fs.closeSync(fd);
        
        const matchSignature = (targetExt) => {
            const signatures = FILE_SIGNATURES[targetExt];
            if (!signatures) return false;
            return signatures.some(sig => buffer.slice(0, sig.length).equals(sig));
        };

        if (matchSignature(ext)) return true;

        if (ext === '.webm') {
            const webmHeader = Buffer.from([0x1A, 0x45, 0xDF, 0xA3]);
            for (let i = 0; i <= bytesRead - 4; i++) {
                if (buffer[i] === 0x1A && buffer[i+1] === 0x45 && buffer[i+2] === 0xDF && buffer[i+3] === 0xA3) {
                    return true;
                }
            }
        }

        if (isAudioExt) {
            const audioExts = ['.webm', '.mp3', '.wav', '.m4a', '.ogg'];
            for (const aExt of audioExts) {
                if (matchSignature(aExt)) return true;
            }
        }
        
        const signatures = FILE_SIGNATURES[ext];
        if (!signatures) return true;
        
        return false;
    } catch (err) {
        console.error('MIME verification error:', err.message);
        return false;
    }
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Ensure uploads directory exists
        const fs = require('fs');
        if (!fs.existsSync('uploads/')) fs.mkdirSync('uploads/', { recursive: true });
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        // SECURITY: Use cryptographically random filenames to prevent enumeration & path traversal
        const randomName = crypto.randomBytes(16).toString('hex');
        // Sanitize the extension — strip any path traversal characters
        const safeExt = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, '');
        cb(null, randomName + safeExt);
    }
});

// File upload security: Strict types, size limits, and path traversal protection
// Voice files can be large; allow up to 50 MB for audio
const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 200 * 1024 * 1024, // 200MB limit (supports ~2.5 hour lecture recordings)
        files: 10, // Maximum 10 files per request (for mixed RAG ingestion)
    },
    fileFilter: (req, file, cb) => {
        // SECURITY: Sanitize original filename — strip path traversal sequences
        file.originalname = path.basename(file.originalname)
            .replace(/\.\./g, '')
            .replace(/\0/g, '');

        const allowedTypes = [
            '.pdf', '.docx', '.pptx', '.jpg', '.jpeg', '.png', 
            '.mp3', '.wav', '.m4a', '.webm', '.ogg', '.txt'
        ];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only documents, images, and audio files are allowed.'), false);
        }
    }
});

// Rate limiter for joining quizzes (prevents brute force on codes)
const joinLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: process.env.DISABLE_LIMITS === 'true' ? 100000000 : 20,
    message: 'Too many attempts to join quizzes. Please try again later.'
});

const quizValidation = [
    check('title', 'Title must be at least 1 character').optional().isLength({ min: 1 }).trim(),
    check('questionCount', 'Question count must be between 1 and 50').optional().isInt({ min: 1, max: 50 }),
    check('difficulty', 'Invalid difficulty').optional().isIn(['Easy', 'Medium', 'Thinkable', 'Hard', 'Balanced', 'balanced']),
    check('timerPerQuestion', 'Timer must be between 0 and 300 seconds').optional().isInt({ min: 0, max: 300 }),
];

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};

// SECURITY: Post-upload MIME verification middleware
// Runs AFTER multer writes the file — verifies magic bytes match the claimed extension
const verifyUploadedFile = (req, res, next) => {
    if (!req.file) return next();
    
    const ext = path.extname(req.file.originalname).toLowerCase();
    const filePath = path.resolve(req.file.path);
    
    if (!verifyFileMagicBytes(filePath, ext)) {
        // Delete the suspicious file immediately
        const fs = require('fs');
        try { fs.unlinkSync(filePath); } catch (e) { /* ignore */ }
        
        console.warn(`[SECURITY] MIME mismatch blocked: ${req.file.originalname} (claimed ${ext}, failed magic bytes check)`);
        return res.status(400).json({ 
            msg: 'File rejected: file content does not match the declared file type. Possible extension spoofing detected.' 
        });
    }
    next();
};

const verifyUploadedFiles = (req, res, next) => {
    const files = (req.files && req.files.length > 0) ? req.files : (req.file ? [req.file] : []);
    if (files.length === 0) return next();
    
    const fs = require('fs');
    for (const file of files) {
        const ext = path.extname(file.originalname).toLowerCase();
        const filePath = path.resolve(file.path);
        
        if (!verifyFileMagicBytes(filePath, ext)) {
            for (const f of req.files) {
                try { fs.unlinkSync(path.resolve(f.path)); } catch (_) {}
            }
            console.warn(`[SECURITY] MIME mismatch blocked: ${file.originalname} (claimed ${ext}, failed magic bytes check)`);
            return res.status(400).json({ 
                msg: 'File rejected: file content does not match the declared file type. Possible extension spoofing detected.' 
            });
        }
    }
    next();
};

// @route   POST api/quiz/analyze-sources
// @desc    Analyze multiple mixed input sources (PDFs, texts)
router.post('/analyze-sources', auth, upload.array('files', 10), verifyUploadedFiles, quizController.analyzeSources);

// @route   POST api/quiz/transcribe
// @desc    Transcribe audio for inputs docket
router.post('/transcribe', auth, upload.single('file'), verifyUploadedFile, quizController.transcribe);

// @route   POST api/quiz/analyze-depth
// @desc    Analyze lecture text/transcript for pedagogical depth and focus
router.post('/analyze-depth', auth, quizController.analyzeDepth);

// @route   POST api/quiz/file-metadata
// @desc    Get total pages / slides metadata for an uploaded file
router.post('/file-metadata', auth, upload.single('file'), verifyUploadedFile, quizController.getFileMetadata);

// @route   POST api/quiz/generate-voice
// @desc    Transcribe audio and generate quiz questions
router.post('/generate-voice', auth, upload.single('file'), verifyUploadedFile, quizController.generateQuizFromVoice);

// @route   POST api/quiz/create
// @desc    Create a new quiz (Manual or AI generated)
router.post('/create', auth, teacherOrAdmin, upload.single('file'), verifyUploadedFile, quizValidation, validate, quizController.createQuiz);

// @route   POST api/quiz/join
// @desc    Join a quiz by code
router.post('/join', auth, joinLimiter, quizController.joinByCode);

// @route   POST api/quiz/submit
// @desc    Submit a quiz attempt
router.post('/submit', auth, quizController.submitAttempt);

// @route   POST api/quiz/generate
// @desc    Generate quiz questions (async — returns taskId immediately)
router.post('/generate', auth, teacherOrAdmin, upload.array('files', 10), verifyUploadedFiles, quizValidation, validate, quizController.generateQuizQuestions);
// SECURITY: Require auth on callback to prevent injection of fake task results
router.post('/generate/callback/:taskId', auth, quizController.taskCompleteCallback);

// @route   GET api/quiz/generate/status/:taskId
// @desc    Poll status of an async generation task
router.get('/generate/status/:taskId', auth, (req, res) => {
    const task = getTask(req.params.taskId);
    if (!task) {
        return res.status(404).json({ status: 'NOT_FOUND', msg: 'Task not found or expired' });
    }
    if (task.status === 'EXPIRED') {
        return res.status(410).json({ status: 'EXPIRED', msg: 'Generation result expired. Please generate again.' });
    }
    // Return full result payload when completed
    if (task.status === 'COMPLETED') {
        return res.json({
            status: task.status,
            stage: task.stage,
            stageLabel: task.stageLabel,
            result: task.result,
        });
    }
    // RUNNING or FAILED
    res.json({
        status: task.status,
        stage: task.stage,
        stageLabel: task.stageLabel,
        error: task.error || null,
    });
});

// @route   POST api/quiz/save-template
// @desc    Save quiz template to Saved Quizzes Repository
router.post('/save-template', auth, quizController.saveTemplate);

// @route   GET api/quiz/templates
// @desc    Get all saved quiz templates created by current teacher
router.get('/templates', auth, quizController.getSavedTemplates);

// @route   POST api/quiz/templates/:id/instantiate
// @desc    Instantiate / clone a saved quiz template to a live broadcast session
router.post('/templates/:id/instantiate', auth, quizController.instantiateTemplate);

// @route   GET api/quiz/my-quizzes
// @desc    Get all quizzes created by current user
router.get('/my-quizzes', auth, quizController.getMyQuizzes);

// @route   GET api/quiz/documents
// @desc    Get all unique sources of ingested documents
router.get('/documents', auth, quizController.getIngestedDocuments);

// @route   GET api/quiz/live
// @desc    Get all active quizzes for students
router.get('/live', auth, quizController.getLiveQuizzes);

// @route   GET api/quiz/available
// @desc    Get all available quizzes for the assessment arena
router.get('/available', auth, quizController.getLiveQuizzes);

// @route   GET api/quiz/stats
// @desc    Get performance stats for teacher
router.get('/stats', auth, quizController.getTeacherStats);

// @route   GET api/quiz/leaderboard/:quizId
// @desc    Get leaderboard for a quiz
router.get('/leaderboard/:quizId', auth, quizController.getLeaderboard);

// @route   GET api/quiz/history/student
// @desc    Get current student's quiz history (completed and missed)
router.get('/history/student', auth, quizController.getStudentHistory);

// @route   GET api/quiz/result/:quizId
// @desc    Get the latest completed result for a quiz (student review)
// NOTE: Must be above the /:id wildcard route or Express will match "result" as an id!
router.get('/result/:quizId', auth, quizController.getLatestResult);

// ── Wildcard param routes – must come LAST so specific paths above are matched first ──

// @route   PATCH api/quiz/:id/schedule
// @desc    Securely edit a quiz schedule if permitted
router.patch('/:id/schedule', auth, quizController.updateSchedule);

// @route   GET api/quiz/:id/suspicious-activities
// @desc    Get all persistent cheating logs / suspicious activities for a quiz
router.get('/:id/suspicious-activities', auth, quizController.getSuspiciousActivities);

// @route   GET api/quiz/:id/schedule-status
// @desc    Get the current scheduling lock status
router.get('/:id/schedule-status', auth, quizController.getScheduleStatus);

// @route   GET api/quiz/:id
// @desc    Get quiz by ID
router.get('/:id', auth, quizController.getQuizById);

// @route   PUT api/quiz/publish/:id
// @desc    Publish/Unpublish a quiz
router.put('/publish/:id', auth, teacherOrAdmin, quizController.publishQuiz);

// @route   DELETE api/quiz/:id
// @desc    Delete a quiz
router.delete('/:id', auth, teacherOrAdmin, quizController.deleteQuiz);

// @route   PUT api/quiz/:id
// @desc    Update a quiz
router.put('/:id', auth, teacherOrAdmin, quizController.updateQuiz);

// @route   POST api/quiz/assign/:id
// @desc    Assign a quiz to student groups and manually targeted student list
router.post('/assign/:id', auth, teacherOrAdmin, quizController.assignQuiz);

module.exports = router;
