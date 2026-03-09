const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables immediately
dotenv.config();

const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { pool, connectDB } = require('./config/db');

// Connect to Database
connectDB();

// Routes
const authRoutes = require('./routes/authRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const leaveRoutes = require('./routes/leaveRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const timetableRoutes = require('./routes/timetableRoutes');
const salaryRoutes = require('./routes/salaryRoutes');
const purchaseRoutes = require('./routes/purchaseRoutes');
const conversationRoutes = require('./routes/conversationRoutes');
const holidayRoutes = require('./routes/holidayRoutes');
const leaveLimitRoutes = require('./routes/leaveLimitRoutes');
const leaveTypeRoutes = require('./routes/leaveTypeRoutes');
const biometricRoutes = require('./routes/biometricRoutes');

const app = express();

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: { origin: '*' }
});

// Pass io to express app
app.set('io', io);

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Global Request Logger for Debugging
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    next();
});

// Socket.io connection
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join', (userId) => {
        socket.join(userId);
        console.log(`User ${userId} joined their room`);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

// Routes Registration
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/timetable', timetableRoutes);
app.use('/api/salary', salaryRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/holidays', holidayRoutes);
app.use('/api/leave-limits', leaveLimitRoutes);
app.use('/api/leave-types', leaveTypeRoutes);
app.use('/api/biometric', biometricRoutes);

// Production Static Files
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../client/dist')));
    app.get('*', (req, res) => {
        res.sendFile(path.resolve(__dirname, '../client/dist', 'index.html'));
    });
}

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = { app, io };
