const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { submitFeedback, getFeedbackInbox } = require('../controllers/feedbackController');

router.post('/', protect, submitFeedback);
router.get('/inbox', protect, getFeedbackInbox);

module.exports = router;
