const express = require('express');
const router = express.Router();
const { receiveLog, getBiometricData, getBiometricStats, backfillTodayFromAttendance } = require('../controllers/biometricController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

// ADMS heartbeat endpoint (device polls this URL)
router.get('/getrequest', (req, res) => {
	console.log('ADMS device connected:', {
		query: req.query,
		ip: req.ip,
		userAgent: req.get('user-agent')
	});
	res.type('text/plain').status(200).send('OK');
});

// ADMS attendance payload endpoint (some devices use POST, some can hit GET)
const handleCdata = (req, res) => {
	console.log('ADMS attendance data received:', {
		query: req.query,
		body: req.body,
		ip: req.ip,
		userAgent: req.get('user-agent')
	});
	res.type('text/plain').status(200).send('OK');
};

router.get('/cdata', handleCdata);
router.post('/cdata', handleCdata);

// Endpoint for biometric device to push data (No auth for device, but can add secret key check inside controller)
router.post('/log', receiveLog);

// Backfill today's manually entered attendance times into biometric live data
router.post('/backfill-today-from-attendance', protect, restrictTo('admin', 'management'), backfillTodayFromAttendance);

// Endpoints for web frontend to fetch data
router.get('/data', protect, getBiometricData);
router.get('/stats', protect, getBiometricStats);

module.exports = router;
