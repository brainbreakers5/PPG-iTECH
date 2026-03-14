const express = require('express');
const router = express.Router();
const { calculateSalary, getSalaryRecords, updateSalaryStatus, publishSalaries } = require('../controllers/salaryController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.use(protect);

router.post('/calculate', restrictTo('admin'), calculateSalary);
router.post('/publish', restrictTo('admin'), publishSalaries);
router.get('/', getSalaryRecords);
router.put('/:id/status', restrictTo('admin'), updateSalaryStatus);

module.exports = router;
