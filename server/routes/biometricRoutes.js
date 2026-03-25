const express = require('express');
const router = express.Router();
const {
	receiveLog,
	getBiometricData,
	getBiometricStats,
	backfillTodayFromAttendance,
	getAdmsLastSeen,
	markAdmsHeartbeatSeen,
	markAdmsCdataSeen,
} = require('../controllers/biometricController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

const admsTextParser = express.text({ type: '*/*', limit: '5mb' });

const parseAdmsLine = (line) => {
	const trimmed = String(line || '').trim();
	if (!trimmed) return null;
	if (/^(OK|ID|Device|GET|POST|SN=)/i.test(trimmed)) return null;

	const parts = trimmed.split(/\t|,/).map((p) => p.trim()).filter(Boolean);
	if (parts.length < 2) return null;

	const empId = parts[0];
	if (!empId) return null;

	let timestamp = null;
	for (let i = 0; i < parts.length; i += 1) {
		if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(parts[i])) {
			timestamp = parts[i].replace(' ', 'T');
			break;
		}
		if (
			i + 1 < parts.length &&
			/^\d{4}-\d{2}-\d{2}$/.test(parts[i]) &&
			/^\d{2}:\d{2}(:\d{2})?$/.test(parts[i + 1])
		) {
			timestamp = `${parts[i]}T${parts[i + 1]}`;
			break;
		}
	}

	if (!timestamp) return null;

	let type = null;
	const directionToken = parts.find((p) => /^(IN|OUT)$/i.test(p));
	if (directionToken) {
		type = directionToken.toUpperCase();
	} else {
		const statusToken = parts.find((p) => /^[01]$/.test(p));
		if (statusToken === '0') type = 'IN';
		if (statusToken === '1') type = 'OUT';
	}

	return { emp_id: empId, timestamp, type };
};

const getAdmsBodyText = (req) => {
	if (typeof req.body === 'string') return req.body;
	if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
	if (req.body && typeof req.body === 'object') {
		if (typeof req.body.data === 'string') return req.body.data;
		if (typeof req.body.table === 'string') return req.body.table;
	}
	return '';
};

// ADMS heartbeat endpoint (device polls this URL)
router.get('/getrequest', (req, res) => {
	markAdmsHeartbeatSeen({
		sn: req.query.SN || req.query.sn || null,
		ip: req.ip,
	});
	console.log('ADMS device connected:', {
		query: req.query,
		ip: req.ip,
		userAgent: req.get('user-agent')
	});
	res.type('text/plain').status(200).send('OK');
});

// ADMS attendance payload endpoint (some devices use POST, some can hit GET)
const handleCdata = async (req, res) => {
	markAdmsCdataSeen({
		sn: req.query.SN || req.query.sn || null,
		ip: req.ip,
	});
	console.log('ADMS attendance data received:', {
		query: req.query,
		body: req.body,
		ip: req.ip,
		userAgent: req.get('user-agent')
	});

	try {
		const rawBody = getAdmsBodyText(req);
		const lines = String(rawBody || '')
			.split(/\r?\n/)
			.map((l) => l.trim())
			.filter(Boolean)
			.slice(0, 1000);

		const parsed = lines
			.map(parseAdmsLine)
			.filter(Boolean);

		if (parsed.length === 0) {
			const fallbackEmpId = String(req.query.PIN || req.query.pin || req.query.emp_id || '').trim();
			const fallbackStamp = String(req.query.DateTime || req.query.datetime || req.query.timestamp || '').trim();
			if (fallbackEmpId && fallbackStamp) {
				parsed.push({
					emp_id: fallbackEmpId,
					timestamp: fallbackStamp.replace(' ', 'T'),
					type: null,
				});
			}
		}

		const deviceId = String(req.query.SN || req.query.sn || req.query.device_id || req.query.DeviceID || 'ADMS').trim();
		let processed = 0;
		let failed = 0;

		for (const punch of parsed) {
			const mockReq = {
				body: {
					device_id: deviceId,
					emp_id: punch.emp_id,
					timestamp: punch.timestamp,
					type: punch.type,
				},
				app: req.app,
			};

			const mockRes = {
				statusCode: 200,
				status(code) { this.statusCode = code; return this; },
				json(payload) { this.payload = payload; return this; },
				send(payload) { this.payload = payload; return this; },
			};

			await receiveLog(mockReq, mockRes);
			if (mockRes.statusCode >= 200 && mockRes.statusCode < 300) processed += 1;
			else failed += 1;
		}

		console.log(`ADMS cdata processed. device=${deviceId}, total=${parsed.length}, success=${processed}, failed=${failed}`);
	} catch (err) {
		console.error('ADMS cdata processing error:', err.message);
	}

	res.type('text/plain').status(200).send('OK');
};

router.get('/cdata', handleCdata);
router.post('/cdata', admsTextParser, handleCdata);

// Endpoint for biometric device to push data (No auth for device, but can add secret key check inside controller)
router.post('/log', receiveLog);

// Backfill today's manually entered attendance times into biometric live data
router.post('/backfill-today-from-attendance', protect, restrictTo('admin', 'management'), backfillTodayFromAttendance);

// Endpoints for web frontend to fetch data
router.get('/data', protect, getBiometricData);
router.get('/stats', protect, getBiometricStats);
router.get('/adms-last-seen', protect, restrictTo('admin'), getAdmsLastSeen);

module.exports = router;
