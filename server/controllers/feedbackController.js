const { pool } = require('../config/db');

// @desc    Submit app feedback (sent to emp_id 5001)
// @route   POST /api/feedback
// @access  Private
exports.submitFeedback = async (req, res) => {
    try {
        const fromEmpId = String(req.user?.emp_id || '').trim();
        const toEmpId = '5001';
        const ratingRaw = String(req.body?.rating || '').trim().toLowerCase();
        const message = String(req.body?.message || '').trim();

        const ratingMap = {
            difficult: 'Difficult',
            good: 'Good',
            excellent: 'Excellent'
        };

        const rating = ratingMap[ratingRaw] || null;

        if (!fromEmpId) {
            return res.status(400).json({ message: 'Invalid sender employee id.' });
        }
        if (!rating) {
            return res.status(400).json({ message: 'Please select a valid feedback rating.' });
        }
        if (!message) {
            return res.status(400).json({ message: 'Please enter your feedback message.' });
        }

        await pool.query(
            `INSERT INTO feedback_messages (from_emp_id, to_emp_id, rating, message, submitted_by_role)
             VALUES ($1, $2, $3, $4, $5)`,
            [fromEmpId, toEmpId, rating, message, req.user?.role || null]
        );

        return res.status(201).json({ message: 'Feedback submitted successfully.' });
    } catch (error) {
        console.error('submitFeedback error:', error);
        return res.status(500).json({ message: 'Failed to submit feedback.' });
    }
};

// @desc    Get all feedbacks sent to emp_id 5001
// @route   GET /api/feedback/inbox
// @access  Private (emp_id 5001 only)
exports.getFeedbackInbox = async (req, res) => {
    try {
        const requesterEmpId = String(req.user?.emp_id || '').trim();
        if (requesterEmpId !== '5001') {
            return res.status(403).json({ message: 'Only employee 5001 can view feedback inbox.' });
        }

        const { rows } = await pool.query(
            `SELECT f.id,
                    f.from_emp_id,
                    f.to_emp_id,
                    f.rating,
                    f.message,
                    f.submitted_by_role,
                    f.created_at,
                    u.name AS from_name,
                    u.department_id,
                    d.name AS department_name,
                    u.designation
             FROM feedback_messages f
             LEFT JOIN users u ON TRIM(u.emp_id) = TRIM(f.from_emp_id)
             LEFT JOIN departments d ON d.id = u.department_id
             WHERE TRIM(f.to_emp_id) = '5001'
             ORDER BY f.created_at DESC`
        );

        return res.json(rows);
    } catch (error) {
        console.error('getFeedbackInbox error:', error);
        return res.status(500).json({ message: 'Failed to load feedback inbox.' });
    }
};
