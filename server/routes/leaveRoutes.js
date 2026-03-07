const express = require('express');
const router = express.Router();
const {
    applyLeave,
    getLeaveRequests,
    approveLeaveStep,
    deleteLeaveRequest,
    getLeaveConflicts
} = require('../controllers/leaveController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.use(protect);

router.route('/')
    .post(applyLeave)
    .get(getLeaveRequests);

router.get('/conflicts', getLeaveConflicts);

router.route('/:id/approve')
    .put(approveLeaveStep);

router.route('/:id')
    .delete(deleteLeaveRequest);

module.exports = router;
