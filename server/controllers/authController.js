const { pool } = require('../config/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Generate JWT
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
exports.loginUser = async (req, res) => {
    const { emp_id, pin } = req.body;

    // Trim inputs
    const trimmedEmpId = emp_id?.trim();
    const trimmedPin = pin?.trim();

    if (!trimmedEmpId || !trimmedPin) {
        return res.status(400).json({ message: 'Please provide emp_id and pin' });
    }

    try {
        // Find user by emp_id (case-insensitive)
        const { rows } = await pool.query(
            'SELECT * FROM users WHERE LOWER(emp_id) = LOWER($1)',
            [trimmedEmpId]
        );
        const user = rows[0];

        if (user) {
            // Check pin (Direct check for numeric PIN as string, or hashed if password field logic used)
            const isPinMatch = user.pin === trimmedPin;
            const isPasswordMatch = user.password ? await bcrypt.compare(trimmedPin, user.password) : false;

            if (isPinMatch || isPasswordMatch) {
                console.log('Login successful');
                res.json({
                    id: user.id,
                    emp_id: user.emp_id,
                    name: user.name,
                    role: user.role,
                    department_id: user.department_id,
                    profile_pic: user.profile_pic,
                    token: generateToken(user.id),
                });
            } else {
                console.log('Login failed: Invalid PIN/Password');
                res.status(401).json({ message: 'Invalid credentials (PIN)' });
            }
        } else {
            console.log('Login failed: User not found');
            res.status(401).json({ message: 'Invalid credentials (User not found)' });
        }
    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
exports.getUserProfile = async (req, res) => {
    res.json(req.user);
};

// @desc    Update profile picture
// @route   PUT /api/auth/profile-pic
// @access  Private
exports.updateProfilePic = async (req, res) => {
    const { profile_pic } = req.body;

    if (!profile_pic) {
        return res.status(400).json({ message: 'Please provide profile_pic URL' });
    }

    try {
        const { rows } = await pool.query(
            'UPDATE users SET profile_pic = $1 WHERE id = $2 RETURNING *',
            [profile_pic, req.user.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const user = rows[0];
        res.json({
            message: 'Profile picture updated successfully',
            user: {
                id: user.id,
                emp_id: user.emp_id,
                name: user.name,
                role: user.role,
                profile_pic: user.profile_pic
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};
