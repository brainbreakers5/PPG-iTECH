const express = require('express');
const router = express.Router();
const { getSystemStatus } = require('../controllers/statusController');

router.get('/', getSystemStatus);

module.exports = router;
