const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

// Protect routes - Verify JWT
exports.protect = async (req, res, next) => {
    let token;

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        try {
            // Get token from header
            token = req.headers.authorization.split(' ')[1];

            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Get user from token with all personal details
            const { rows } = await pool.query(`
                SELECT u.*, d.name as department_name 
                FROM users u 
                LEFT JOIN departments d ON u.department_id = d.id 
                WHERE u.id = $1
            `, [decoded.id]);

            if (rows.length === 0) {
                return res.status(401).json({ message: 'User not found' });
            }

            req.user = rows[0];
            next();
        } catch (error) {
            console.error('AUTH ERROR:', error.message);
            res.status(401).json({ message: 'Not authorized, token failed: ' + error.message });
        }
    }

    if (!token) {
        res.status(401).json({ message: 'Not authorized, no token' });
    }
};

// Restrict to specific roles
exports.restrictTo = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                message: `User role '${req.user.role}' is not authorized to access this route`
            });
        }
        next();
    };
};
