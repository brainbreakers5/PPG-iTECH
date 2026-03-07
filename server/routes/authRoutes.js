const express = require('express');
const router = express.Router();
const { loginUser, getUserProfile, updateProfilePic } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/login', loginUser);
router.get('/profile', protect, getUserProfile);
router.put('/profile-pic', protect, updateProfilePic);

module.exports = router;
