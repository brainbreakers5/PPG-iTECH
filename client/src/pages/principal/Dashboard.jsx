import { useState, useEffect } from 'react';
import { FaUserCheck, FaUserTimes, FaBus, FaFileAlt, FaBirthdayCake, FaCalendarDay, FaTimes, FaIdBadge, FaPhone, FaEnvelope, FaBuilding, FaArrowLeft, FaSuitcase, FaCalendarAlt, FaArrowRight, FaClipboardList, FaComments, FaShoppingBag, FaShoppingCart } from 'react-icons/fa';
import Layout from '../../components/Layout';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import AttendanceHistory from '../../components/AttendanceHistory';

// ── Small helper components ─────────────────────────────────────────────────
// InfoCard removed ... (it was already redundant or small)
const InfoCard = ({ icon, label, value, color }) => {
    const colors = {
        blue: 'text-sky-600 bg-sky-50 border-sky-100',
        indigo: 'text-indigo-600 bg-indigo-50 border-indigo-100',
        purple: 'text-purple-600 bg-purple-50 border-purple-100',
        emerald: 'text-emerald-600 bg-emerald-50 border-emerald-100',
    };
    return (
        <div className="bg-white p-6 rounded-[24px] border border-gray-100 flex items-start gap-4 shadow-sm group hover:shadow-md transition-shadow">
            <div className={`h-11 w-11 rounded-xl flex items-center justify-center text-sm ${colors[color] || colors.blue} transition-transform group-hover:rotate-12`}>
                {icon}
            </div>
            <div>
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">{label}</p>
                <p className="text-xs font-black text-gray-800 tracking-tight break-all uppercase">{value}</p>
            </div>
        </div>
    );
};

const Dashboard = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [stats, setStats] = useState({
        present: 0, leave: 0, od: 0, lop: 0, absent: 0,
        principal: { present: 0, leave: 0, od: 0, lop: 0, absent: 0 },
        hod: { present: 0, leave: 0, od: 0, lop: 0, absent: 0 },
        staff: { present: 0, leave: 0, od: 0, lop: 0, absent: 0 }
    });
    const [myStats, setMyStats] = useState({ present: 0, absent: 0, leave: 0, od: 0, lop: 0 });
    const [birthdays, setBirthdays] = useState([]);
    const [allEmployees, setAllEmployees] = useState([]);
    const [attendanceMap, setAttendanceMap] = useState({});
    const [now, setNow] = useState(new Date());
    const socket = useSocket();

    // Update time every second
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const fetchDashboardData = async () => {
        try {
            const date = new Date().toISOString().split('T')[0];
            const { data: summary } = await api.get(`/attendance/summary?date=${date}`);
            setStats(summary || { present: 0, leave: 0, od: 0, lop: 0, absent: 0, principal: { present: 0, leave: 0, od: 0, lop: 0, absent: 0 }, hod: { present: 0, leave: 0, od: 0, lop: 0, absent: 0 }, staff: { present: 0, leave: 0, od: 0, lop: 0, absent: 0 } });
            const { data: bdays } = await api.get('/employees/birthdays/today');
            setBirthdays(bdays);
            const { data: emps } = await api.get('/employees');
            setAllEmployees(emps);
            const month = new Date().toISOString().slice(0, 7);
            const { data: records } = await api.get(`/attendance?month=${month}&emp_id=${user.emp_id}`);
            const counts = { present: 0, absent: 0, leave: 0, od: 0, lop: 0 };
            (records || []).forEach(r => {
                const s = r.status || '';
                if (s === 'Present') counts.present++;
                else if (s === 'OD') counts.od++;
                else if (s === 'LOP') counts.lop++;
                else if (['Leave', 'CL', 'ML', 'Comp Leave'].includes(s)) counts.leave++;
                else if (s === 'Absent') counts.absent++;
            });
            setMyStats(counts);
            // Build today's attendance map
            const { data: todayAtt } = await api.get(`/attendance?date=${date}`);
            const map = {};
            (todayAtt || []).forEach(r => { map[r.emp_id] = r.status; });
            setAttendanceMap(map);
        } catch (error) { console.error("Error fetching dashboard data", error); }
    };

    useEffect(() => {
        fetchDashboardData();
        const interval = setInterval(fetchDashboardData, 10000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (!socket) return;
        socket.on('employee_updated', fetchDashboardData);
        socket.on('attendance_updated', fetchDashboardData);
        return () => {
            socket.off('employee_updated', fetchDashboardData);
            socket.off('attendance_updated', fetchDashboardData);
        };
    }, [socket, fetchDashboardData]);

    const hodList = allEmployees.filter(e => (e.role || '').toLowerCase() === 'hod');
    const staffList = allEmployees.filter(e => (e.role || '').toLowerCase() === 'staff');

    const menuItems = [];

    const menuColorStyles = {
        blue: { bg: 'bg-sky-50', text: 'text-sky-600', border: 'border-sky-100', accent: 'bg-sky-500' },
        amber: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-100', accent: 'bg-amber-500' },
        indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-100', accent: 'bg-indigo-500' },
        emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100', accent: 'bg-emerald-500' },
        purple: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-100', accent: 'bg-purple-500' },
        pink: { bg: 'bg-pink-50', text: 'text-pink-600', border: 'border-pink-100', accent: 'bg-pink-500' }
    };

    // const navigate = (path) => window.location.href = path; // Removed to avoid collision with useNavigate hook

    return (
        <Layout>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-10"
            >
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-4xl font-black text-gray-800 tracking-tighter">
                            Portal <span className="text-[#4A90E2]">Dashboard</span>
                        </h1>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mt-2 flex items-center gap-2">
                            System Dynamics & Operational Intelligence
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        {/* Real-time Date & Time - Dashboard Only */}
                        <div className="flex flex-col items-end px-5 py-3 rounded-2xl border-2 border-sky-200 bg-gradient-to-br from-sky-50 to-white shadow-lg">
                            <p className="text-[9px] font-black uppercase tracking-wider text-sky-600 flex items-center gap-1.5">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                                </svg>
                                {now.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                            </p>
                            <p className="text-base font-black text-gray-800 tracking-wide mt-1 flex items-center gap-1.5">
                                <svg className="w-3.5 h-3.5 text-sky-500" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                </svg>
                                {now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                            </p>
                        </div>
                        {birthdays.length > 0 && (
                            <motion.div
                                whileHover={{ scale: 1.05 }}
                                className="bg-gradient-to-tr from-[#FF9A9E] to-[#FAD0C4] p-[1px] rounded-3xl shadow-2xl shadow-rose-200/50"
                            >
                                <div className="bg-white/90 backdrop-blur-md px-6 py-3 rounded-[23px] flex items-center gap-4">
                                    <div className="h-8 w-8 rounded-full bg-rose-50 flex items-center justify-center">
                                        <FaBirthdayCake className="text-rose-500 animate-bounce" />
                                    </div>
                                    <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest">
                                        {birthdays.length} Personnel Birthdays Today!
                                    </span>
                                </div>
                            </motion.div>
                        )}
                    </div>
                </div>
            </motion.div>

            {/* Personal Attendance Section - Top of the page */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-16"
            >
                <div className="flex items-center gap-4 mb-8">
                    <div className="h-1 w-12 bg-sky-600 rounded-full"></div>
                    <h2 className="text-xl font-black text-gray-800 tracking-tight uppercase tracking-[0.1em]">Your Personal Attendance</h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    {[
                        { label: 'Present', value: myStats.present, icon: <FaUserCheck />, color: 'text-sky-600', bg: 'bg-sky-50', gradient: 'from-sky-500 to-sky-700' },
                        { label: 'Absent', value: myStats.absent, icon: <FaUserTimes />, color: 'text-rose-600', bg: 'bg-rose-50', gradient: 'from-rose-500 to-rose-700' },
                        { label: 'On Duty', value: myStats.od, icon: <FaBus />, color: 'text-emerald-600', bg: 'bg-emerald-50', gradient: 'from-emerald-500 to-emerald-700' },
                        { label: 'Loss of Pay', value: myStats.lop, icon: <FaFileAlt />, color: 'text-purple-600', bg: 'bg-purple-50', gradient: 'from-purple-500 to-purple-700' },
                    ].map((stat, idx) => (
                        <motion.div
                            key={stat.label}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.08 }}
                            whileHover={{ y: -6, scale: 1.03 }}
                            className="bg-white rounded-[32px] shadow-lg shadow-sky-50/50 border border-sky-50 p-8 group relative overflow-hidden flex flex-col items-center text-center"
                        >
                            {/* Gradient top accent bar */}
                            <div className={`absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r ${stat.gradient}`} />

                            <div className={`h-14 w-14 rounded-[20px] ${stat.bg} ${stat.color} flex items-center justify-center text-xl shadow-sm mb-5 group-hover:rotate-6 transition-transform duration-500`}>
                                {stat.icon}
                            </div>

                            <span className="text-4xl font-black text-gray-800 tracking-tighter mb-2 leading-none">
                                {stat.value}
                            </span>
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                                {stat.label}
                            </span>

                            {/* Background decor */}
                            <div className="absolute -bottom-8 -right-8 w-24 h-24 bg-gray-50 rounded-full blur-2xl opacity-60" />
                        </motion.div>
                    ))}
                </div>
            </motion.div>

            {/* Stats Grid - Role Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                {[
                    { key: 'hod', title: 'HODs', color: 'amber' },
                    { key: 'staff', title: 'Staff', color: 'purple' }
                ].map((role) => (
                    <motion.div
                        key={role.key}
                        whileHover={{ y: -8, scale: 1.02 }}
                        className="modern-card p-10 bg-white/70 backdrop-blur-xl border border-white/50 group relative overflow-hidden"
                    >
                        <div className="flex justify-between items-center mb-8 relative z-10">
                            <div>
                                <h2 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.3em]">{role.title}</h2>
                                <p className="text-xl font-black text-gray-800 tracking-tighter mt-1">Attendance Core</p>
                            </div>
                            <div className={`p-4 rounded-2xl ${role.color === 'amber' ? 'bg-amber-500' : 'bg-purple-600'} text-white shadow-lg`}>
                                <FaUserCheck />
                            </div>
                        </div>

                        {/* Total Count Button */}
                        <button
                            onClick={() => {
                                navigate(`/principal/personnel/${role.key === 'hod' ? 'hod' : 'staff'}`);
                                window.dispatchEvent(new CustomEvent('closeSidebar'));
                            }}
                            className="w-full mb-6 py-3 px-5 rounded-[20px] bg-gray-50 border border-gray-100 text-[10px] font-black text-gray-500 uppercase tracking-widest hover:bg-sky-50 hover:border-sky-100 hover:text-sky-600 transition-all flex items-center justify-between group/btn relative z-10"
                        >
                            <span>Total {role.title}</span>
                            <div className="flex items-center gap-2">
                                <span className="flex items-center gap-1 bg-emerald-50 border border-emerald-100 text-emerald-600 font-black px-2 py-1 rounded-xl text-[9px] uppercase tracking-widest">
                                    <FaUserCheck size={8} /> {stats[role.key]?.present || 0} Available
                                </span>
                                <span className="bg-white border border-gray-200 text-gray-800 font-black px-3 py-1 rounded-xl text-sm group-hover/btn:bg-sky-600 group-hover/btn:text-white group-hover/btn:border-sky-600 transition-all">
                                    {role.key === 'hod' ? hodList.length : staffList.length}
                                </span>
                            </div>
                        </button>

                        <div className="space-y-6 relative z-10">
                            {[
                                { label: 'Present', value: stats[role.key]?.present, icon: <FaUserCheck />, color: 'text-sky-600', bg: 'bg-sky-50' },
                                { label: 'Absent', value: stats[role.key]?.absent, icon: <FaUserTimes />, color: 'text-rose-600', bg: 'bg-rose-50' },
                                { label: 'On Leave', value: stats[role.key]?.leave, icon: <FaCalendarDay />, color: 'text-amber-600', bg: 'bg-amber-50' },
                                { label: 'On Duty', value: stats[role.key]?.od, icon: <FaBus />, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                                { label: 'Loss of Pay', value: stats[role.key]?.lop, icon: <FaFileAlt />, color: 'text-purple-600', bg: 'bg-purple-50' }
                            ].map((stat) => (
                                <div key={stat.label} className="flex items-center justify-between p-4 rounded-2xl bg-gray-50/50 hover:bg-white transition-all border border-transparent hover:border-gray-100 group/item">
                                    <div className="flex items-center gap-4">
                                        <div className={`h-10 w-10 rounded-xl ${stat.bg} ${stat.color} flex items-center justify-center text-sm shadow-sm transition-transform group-hover/item:rotate-12`}>
                                            {stat.icon}
                                        </div>
                                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{stat.label}</span>
                                    </div>
                                    <span className="text-lg font-black text-gray-800 tracking-tighter">{stat.value || 0}</span>
                                </div>
                            ))}
                        </div>

                        {/* Background Decor */}
                        <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-gray-50 rounded-full blur-3xl opacity-50"></div>
                    </motion.div>
                ))}
            </div>

            {/* Quick Access Menu Grid Removed */}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                {birthdays.length > 0 && (
                    <div className="bg-gradient-to-br from-[#8E9EFF] to-[#4A90E2] rounded-[40px] shadow-2xl shadow-sky-200/50 p-10 text-white relative overflow-hidden group">
                        <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000"></div>
                        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] mb-10 flex items-center relative z-10">
                            Milestone <FaBirthdayCake className="ml-3 text-white animate-bounce" />
                        </h2>
                        <div className="space-y-4 relative z-10">
                            {birthdays.map(b => (
                                <div
                                    key={b.emp_id}
                                    onClick={() => {
                                        const rolePrefix = user?.role === 'admin' ? 'admin' :
                                            user?.role === 'principal' ? 'principal' :
                                                user?.role === 'hod' ? 'hod' : 'staff';
                                        navigate(`/${rolePrefix}/profile/${b.emp_id}`);
                                        window.dispatchEvent(new CustomEvent('closeSidebar'));
                                    }}
                                    className="flex items-center space-x-5 bg-white/10 backdrop-blur-md p-5 rounded-[24px] border border-white/10 hover:bg-white/20 transition-all cursor-pointer"
                                >
                                    <div className="h-12 w-12 rounded-[18px] bg-white flex items-center justify-center font-black text-[#4A90E2] text-xl shadow-lg">
                                        {b.name?.charAt(0) || '?'}
                                    </div>
                                    <div>
                                        <p className="text-sm font-black tracking-tight">{b.name}</p>
                                        <p className="text-[9px] font-bold text-sky-100 uppercase tracking-widest mt-0.5">Celebration Mode</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <AttendanceHistory empId={user?.emp_id} />
        </Layout>
    );
};

export default Dashboard;
