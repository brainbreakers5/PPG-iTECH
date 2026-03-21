const express = require('express');
const router = express.Router();
const {
    calculateSalary,
    getSalaryRecords,
    getDailyBreakdown,
    updateSalaryStatus,
    publishSalaries,
    notifyPaid
} = require('../controllers/salaryController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.use(protect);

router.post('/calculate', restrictTo('admin'), calculateSalary);
router.post('/publish', restrictTo('admin'), publishSalaries);
router.post('/notify-paid', restrictTo('admin'), notifyPaid);
router.get('/daily', getDailyBreakdown);
router.get('/', getSalaryRecords);
router.put('/:id/status', restrictTo('admin'), updateSalaryStatus);

module.exports = router;
