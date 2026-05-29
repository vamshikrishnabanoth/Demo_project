const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const quizController = require('../controllers/quizController');
const { getTask } = require('../services/taskManager');
const multer = require('multer');
const path = require('path');

const rateLimit = require('express-rate-limit');

const { check, validationResult } = require('express-validator');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Ensure uploads directory exists
        const fs = require('fs');
        if (!fs.existsSync('uploads/')) fs.mkdirSync('uploads/', { recursive: true });
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// File upload security: Strict types and size limits
// Voice files can be large; allow up to 50 MB for audio
const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit (voice recordings can be large)
    },
    fileFilter: (req, file, cb) => {
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
    check('title', 'Title must be at least 1 character').optional().isLength({ min: 1 }).trim().escape(),
    check('questionCount', 'Question count must be between 1 and 50').optional().isInt({ min: 1, max: 50 }),
    check('difficulty', 'Invalid difficulty').optional().isIn(['Easy', 'Medium', 'Thinkable', 'Hard']),
    check('timerPerQuestion', 'Timer must be between 0 and 300 seconds').optional().isInt({ min: 0, max: 300 }),
];

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};

// @route   POST api/quiz/generate-voice
// @desc    Transcribe audio and generate quiz questions
router.post('/generate-voice', auth, upload.single('file'), quizController.generateQuizFromVoice);

// @route   POST api/quiz/create
// @desc    Create a new quiz (Manual or AI generated)
router.post('/create', auth, upload.single('file'), quizValidation, validate, quizController.createQuiz);

// @route   POST api/quiz/join
// @desc    Join a quiz by code
router.post('/join', auth, joinLimiter, quizController.joinByCode);

// @route   POST api/quiz/submit
// @desc    Submit a quiz attempt
router.post('/submit', auth, quizController.submitAttempt);

// @route   POST api/quiz/generate
// @desc    Generate quiz questions (async — returns taskId immediately)
router.post('/generate', auth, upload.single('file'), quizValidation, validate, quizController.generateQuizQuestions);

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

// @route   GET api/quiz/my-quizzes
// @desc    Get all quizzes created by current user
router.get('/my-quizzes', auth, quizController.getMyQuizzes);

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

// @route   GET api/quiz/:id/schedule-status
// @desc    Get the current scheduling lock status
router.get('/:id/schedule-status', auth, quizController.getScheduleStatus);

// @route   GET api/quiz/:id
// @desc    Get quiz by ID
router.get('/:id', auth, quizController.getQuizById);

// @route   PUT api/quiz/publish/:id
// @desc    Publish/Unpublish a quiz
router.put('/publish/:id', auth, quizController.publishQuiz);

// @route   DELETE api/quiz/:id
// @desc    Delete a quiz
router.delete('/:id', auth, quizController.deleteQuiz);

// @route   PUT api/quiz/:id
// @desc    Update a quiz
router.put('/:id', auth, quizController.updateQuiz);

// @route   POST api/quiz/assign/:id
// @desc    Assign a quiz to student groups and manually targeted student list
router.post('/assign/:id', auth, quizController.assignQuiz);

module.exports = router;
