const express = require('express');
const router = express.Router();
const {
    getAllLeaveLimits,
    getMyLeaveLimits,
    updateLeaveLimit
} = require('../controllers/leaveLimitController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.use(protect);

// Staff: get their own limits
router.get('/my', getMyLeaveLimits);

// Admin: get all staff limits & update
router.get('/', restrictTo('admin'), getAllLeaveLimits);
router.put('/:emp_id', restrictTo('admin'), updateLeaveLimit);

module.exports = router;
