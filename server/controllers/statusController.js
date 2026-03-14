const { pool } = require('../config/db');

// @desc    Get system status (Server, Database, Biometric Sync)
// @route   GET /api/status
// @access  Public
exports.getSystemStatus = async (req, res) => {
    try {
        const status = {
            server: true,
            database: false,
            biometric: false,
            timestamp: new Date().toISOString()
        };

        // 1. Check Database Connection
        try {
            await pool.query('SELECT 1');
            status.database = true;
        } catch (dbErr) {
            console.error('Status Check - DB Error:', dbErr.message);
            status.database = false;
        }

        // 2. Check Biometric Sync
        // We consider it "functioning" if we can query the biometric logs table.
        // A more advanced check would verify if a punch was received within a threshold (e.g. 24h).
        try {
            const { rows } = await pool.query('SELECT id FROM biometric_logs ORDER BY log_time DESC LIMIT 1');
            status.biometric = true;
        } catch (bioErr) {
            console.error('Status Check - Biometric Error:', bioErr.message);
            status.biometric = false;
        }

        res.json(status);
    } catch (error) {
        res.status(500).json({
            server: true,
            database: false,
            biometric: false,
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
};
