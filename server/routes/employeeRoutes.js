const express = require('express');
const router = express.Router();
const {
    getEmployees,
    getEmployeeById,
    createEmployee,
    updateEmployee,
    deleteEmployee,
    getTodayBirthdays
} = require('../controllers/employeeController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/birthdays/today', getTodayBirthdays);

router.get('/', getEmployees);
router.post('/', restrictTo('admin'), createEmployee);

router.route('/:id')
    .get(getEmployeeById)
    .put(restrictTo('admin'), updateEmployee)
    .delete(restrictTo('admin'), deleteEmployee);

module.exports = router;
