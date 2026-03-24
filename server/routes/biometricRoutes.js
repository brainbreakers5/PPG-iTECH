const express = require('express');
const router = express.Router();
const { receiveLog, getBiometricData, getBiometricStats } = require('../controllers/biometricController');
const { protect } = require('../middleware/authMiddleware');

router.post('/cdata', (req, res) => {
	console.log('Biometric Data Received ✅', req.body);
	res.status(200).send('OK');
});

// Endpoint for biometric device to push data (No auth for device, but can add secret key check inside controller)
router.post('/log', receiveLog);

// Endpoints for web frontend to fetch data
router.get('/data', protect, getBiometricData);
router.get('/stats', protect, getBiometricStats);

module.exports = router;
