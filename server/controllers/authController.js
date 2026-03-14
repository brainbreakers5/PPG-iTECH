const { pool } = require('../config/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const logActivity = require('../utils/activityLogger');

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

    const trimmedEmpId = emp_id?.trim();
    const trimmedPin = pin?.trim();

    if (!trimmedEmpId || !trimmedPin) {
        return res.status(400).json({ message: 'Please provide emp_id and pin' });
    }

    try {
        const { rows } = await pool.query(
            'SELECT * FROM users WHERE LOWER(emp_id) = LOWER($1)',
            [trimmedEmpId]
        );
        const user = rows[0];

        if (user) {
            // Check hashed password (priority) or hashed pin column if legacy
            // We use bcrypt.compare for both to ensure everything is hashed
            let isMatch = false;
            
            if (user.password) {
                isMatch = await bcrypt.compare(trimmedPin, user.password);
            } else if (user.pin) {
                // If pin is stored as plain text (legacy), we might need to handle it once 
                // but sebaiknya everything is already hashed.
                // Let's check both for safety during transition
                isMatch = (user.pin === trimmedPin);
                
                // Auto-upgrade to hashed password on successful plain-text login
                if (isMatch) {
                    const hashed = await bcrypt.hash(trimmedPin, 10);
                    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashed, user.id]);
                    console.log(`Auto-migrated password for user ${user.emp_id}`);
                }
            }

            if (isMatch) {
                await logActivity(user.id, 'LOGIN', { emp_id: user.emp_id, email_id: user.email }, req.ip);
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
                await logActivity(user.id, 'FAILED_LOGIN', { emp_id: user.emp_id, email_id: user.email, reason: 'Invalid PIN' }, req.ip);
                res.status(401).json({ message: 'Invalid credentials' });
            }
        } else {
            await logActivity(null, 'FAILED_LOGIN', { emp_id: trimmedEmpId, reason: 'Unknown Employee ID' }, req.ip);
            res.status(401).json({ message: 'Invalid credentials' });
        }
    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Management login with PIN
// @route   POST /api/auth/management-login
// @access  Public
exports.managementLogin = async (req, res) => {
    const { pin } = req.body;

    if (pin !== '1234') {
        return res.status(401).json({ message: 'Invalid management PIN' });
    }

    try {
        // Use the first admin user as the backing identity for API access
        const { rows } = await pool.query(
            "SELECT id FROM users WHERE role = 'admin' LIMIT 1"
        );

        if (rows.length === 0) {
            return res.status(500).json({ message: 'No admin user found for management access' });
        }

        res.json({
            role: 'management',
            name: 'Management',
            token: generateToken(rows[0].id),
        });
    } catch (error) {
        console.error('Management Login Error:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
exports.getUserProfile = async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT u.*, d.name as department_name
            FROM users u
            LEFT JOIN departments d ON u.department_id = d.id
            WHERE u.id = $1
        `, [req.user.id]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(rows[0]);
    } catch (error) {
        console.error('getProfile Error:', error);
        res.status(500).json({ message: 'Server Error' });
    }
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
        await logActivity(req.user.id, 'UPDATE_PROFILE_PIC', { emp_id: user.emp_id }, req.ip);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Update own profile (self-service)
// @route   PUT /api/auth/profile
// @access  Private
exports.updateProfile = async (req, res) => {
    const {
        mobile, whatsapp, email, blood_group, religion, nationality, caste, community,
        aadhar, pan, account_no, bank_name, branch, ifsc, pin_code,
        pf_number, uan_number, permanent_address, communication_address,
        father_name, mother_name, marital_status, profile_pic, pin
    } = req.body;

    try {
        let hashedPassword;
        if (pin) {
            hashedPassword = await bcrypt.hash(pin, 10);
        }

        const query = `
            UPDATE users SET 
                mobile = $1, whatsapp = $2, email = $3, blood_group = $4, religion = $5,
                nationality = $6, caste = $7, community = $8,
                aadhar = $9, pan = $10, account_no = $11, bank_name = $12, branch = $13,
                ifsc = $14, pin_code = $15, pf_number = $16, uan_number = $17,
                permanent_address = $18, communication_address = $19,
                father_name = $20, mother_name = $21, marital_status = $22,
                profile_pic = COALESCE($23, profile_pic),
                pin = COALESCE($24, pin), password = COALESCE($25, password)
            WHERE id = $26
            RETURNING id, emp_id, name, role, profile_pic, department_id
        `;

        const { rows } = await pool.query(query, [
            mobile || null, whatsapp || null, email || null, blood_group || null, religion || null,
            nationality || 'Indian', caste || null, community || null,
            aadhar || null, pan || null, account_no || null, bank_name || null, branch || null,
            ifsc || null, pin_code || null, pf_number || null, uan_number || null,
            permanent_address || null, communication_address || null,
            father_name || null, mother_name || null, marital_status || null,
            profile_pic || null, pin || null, hashedPassword || null,
            req.user.id
        ]);

        if (rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({ message: 'Profile updated successfully', user: rows[0] });
    } catch (error) {
        console.error('Update Profile Error:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};
