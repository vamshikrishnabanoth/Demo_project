const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const analyticsController = require('../controllers/analyticsController');

// @route   GET api/analytics/quiz/:id
// @desc    Get detailed analytics for a single quiz
router.get('/quiz/:id', auth, analyticsController.getQuizAnalytics);

// @route   GET api/analytics/teacher
// @desc    Get advanced analytics for all teacher's quizzes
router.get('/teacher', auth, analyticsController.getTeacherAdvancedAnalytics);

// @route   GET api/analytics/question/:quizId/:questionIndex
// @desc    Get detailed analysis for a single question
router.get('/question/:quizId/:questionIndex', auth, analyticsController.getQuestionAnalysis);

// @route   GET api/analytics/question-review/:quizId/:questionIndex
// @desc    Get AI review for a single question
router.get('/question-review/:quizId/:questionIndex', auth, analyticsController.getQuestionAIReview);

module.exports = router;
