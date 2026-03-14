const express = require('express');
const router = express.Router();
const { loginUser, getUserProfile, updateProfilePic, managementLogin, updateProfile } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/login', loginUser);
router.post('/management-login', managementLogin);
router.get('/profile', protect, getUserProfile);
router.put('/profile', protect, updateProfile);
router.put('/profile-pic', protect, updateProfilePic);

module.exports = router;
