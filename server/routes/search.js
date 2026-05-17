const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const searchController = require('../controllers/searchController');

// @route   GET api/search/global
// @desc    Perform full-text fuzzy tokenized relevance search across quizzes & users
router.get('/global', auth, searchController.globalSearch);

module.exports = router;
