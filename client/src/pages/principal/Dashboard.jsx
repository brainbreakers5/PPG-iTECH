import { useState, useEffect } from 'react';
import { FaUserCheck, FaUserTimes, FaBus, FaFileAlt, FaBirthdayCake, FaCalendarDay, FaTimes, FaIdBadge, FaPhone, FaEnvelope, FaBuilding, FaArrowLeft, FaSuitcase, FaCalendarAlt, FaArrowRight, FaClipboardList, FaComments, FaShoppingBag, FaShoppingCart, FaStar, FaBriefcase } from 'react-icons/fa';
import Layout from '../../components/Layout';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { motion, AnimatePresence } from 'framer-motion';
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
        present: 0, absent: 0, od: 0, cl: 0, ml: 0, comp_leave: 0,
        principal: { present: 0, absent: 0, od: 0, cl: 0, ml: 0, comp_leave: 0 },
        hod: { present: 0, absent: 0, od: 0, cl: 0, ml: 0, comp_leave: 0 },
        staff: { present: 0, absent: 0, od: 0, cl: 0, ml: 0, comp_leave: 0 }
    });
    const [myStats, setMyStats] = useState({ present: 0, absent: 0, od: 0, cl: 0, ml: 0, comp_leave: 0 });
    const [birthdays, setBirthdays] = useState([]);
    const [allEmployees, setAllEmployees] = useState([]);
    const [attendanceMap, setAttendanceMap] = useState({});
    const [monthStats, setMonthStats] = useState({ workingDays: 0, holidays: 0, specialEvents: 0 });
    const [employeeModal, setEmployeeModal] = useState(null);
    const socket = useSocket();

    const fetchDashboardData = async () => {
        try {
            const date = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
            const { data: summary } = await api.get(`/attendance/summary?date=${date}`);
            const { data: bdays } = await api.get('/employees/birthdays/today');
            setBirthdays(bdays);
            const { data: emps } = await api.get('/employees');
            setAllEmployees(emps);
            const month = date.slice(0, 7);
            const { data: records } = await api.get(`/attendance?month=${month}&emp_id=${user.emp_id}`);
            const counts = { present: 0, absent: 0, od: 0, cl: 0, ml: 0, comp_leave: 0 };
            (records || []).forEach(r => {
                const s = r.status || '';
                if (s === 'Present') counts.present++;
                else if (s === 'OD') counts.od++;
                else if (s === 'CL' || s === 'Leave') counts.cl++;
                else if (s === 'ML') counts.ml++;
                else if (s === 'Comp Leave') counts.comp_leave++;
                else if (s === 'Absent') counts.absent++;
            });
            setMyStats(counts);
            // Build today's attendance map
            const { data: todayAtt } = await api.get(`/attendance?date=${date}`);
            const map = {};
            (todayAtt || []).forEach(r => { map[r.emp_id] = r.status; });
            setAttendanceMap(map);
            // Aggregate per-user rows into role-based stats
            const agg = {
                present: 0, absent: 0, od: 0, cl: 0, ml: 0, comp_leave: 0,
                principal: { present: 0, absent: 0, od: 0, cl: 0, ml: 0, comp_leave: 0 },
                hod: { present: 0, absent: 0, od: 0, cl: 0, ml: 0, comp_leave: 0 },
                staff: { present: 0, absent: 0, od: 0, cl: 0, ml: 0, comp_leave: 0 }
            };
            (summary || []).forEach(r => {
                const role = (r.role || '').toLowerCase();
                const bucket = agg[role] || agg.staff;
                const p = Number(r.total_present) || 0;
                const l = Number(r.total_leave) || 0;
                const o = Number(r.total_od) || 0;
                const lp = Number(r.total_lop) || 0;
                bucket.present += p;
                bucket.od += o;
                if (p === 0 && l === 0 && o === 0 && lp === 0) bucket.absent += 1;
                agg.present += p;
                agg.od += o;
            });
            // Count individual leave types from attendance map
            (emps || []).forEach(emp => {
                const s = map[emp.emp_id] || '';
                const role = (emp.role || '').toLowerCase();
                const bucket = agg[role] || agg.staff;
                if (s === 'CL' || s === 'Leave') { bucket.cl++; agg.cl++; }
                else if (s === 'ML') { bucket.ml++; agg.ml++; }
                else if (s === 'Comp Leave') { bucket.comp_leave++; agg.comp_leave++; }
            });
            setStats(agg);
            // Fetch holiday/calendar data for month summary
            const now = new Date();
            const curMonth = now.getMonth() + 1;
            const curYear = now.getFullYear();
            const { data: holidayData } = await api.get(`holidays?month=${curMonth}&year=${curYear}`);
            const daysInMonth = new Date(curYear, curMonth, 0).getDate();
            let hCount = 0, sCount = 0;
            const holidayDateSet = new Set();
            (holidayData || []).forEach(h => {
                holidayDateSet.add(h.h_date);
                if (h.type === 'Holiday') hCount++;
                else if (h.type === 'Special') sCount++;
            });
            for (let d = 1; d <= daysInMonth; d++) {
                const dow = new Date(curYear, curMonth - 1, d).getDay();
                const ds = `${curYear}-${String(curMonth).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                if ((dow === 0 || dow === 6) && !holidayDateSet.has(ds)) hCount++;
            }
            setMonthStats({ workingDays: daysInMonth - hCount - sCount, holidays: hCount, specialEvents: sCount });
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

    const getFilteredEmployees = (roleKey, statusLabel) => {
        const roleEmps = allEmployees.filter(e => (e.role || '').toLowerCase() === roleKey);
        return roleEmps.filter(emp => {
            const s = attendanceMap[emp.emp_id] || '';
            if (statusLabel === 'Present') return s === 'Present';
            if (statusLabel === 'Absent') return !s || s === 'Absent';
            if (statusLabel === 'On Duty') return s === 'OD';
            if (statusLabel === 'Casual Leave') return s === 'CL' || s === 'Leave';
            if (statusLabel === 'Medical Leave') return s === 'ML';
            if (statusLabel === 'Comp Leave') return s === 'Comp Leave';
            return false;
        });
    };

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
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-10">
                <div className="grid grid-cols-3 gap-4">
                    <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 flex items-center gap-4">
                        <div className="h-11 w-11 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-sm">
                            <FaCalendarAlt />
                        </div>
                        <div>
                            <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Working Days</p>
                            <p className="text-2xl font-black text-emerald-700 tracking-tighter">{monthStats.workingDays}</p>
                        </div>
                    </div>
                    <div className="bg-rose-50 border border-rose-100 rounded-2xl p-5 flex items-center gap-4">
                        <div className="h-11 w-11 rounded-xl bg-rose-500 text-white flex items-center justify-center shadow-sm">
                            <FaCalendarDay />
                        </div>
                        <div>
                            <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest">Holidays</p>
                            <p className="text-2xl font-black text-rose-700 tracking-tighter">{monthStats.holidays}</p>
                        </div>
                    </div>
                    <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5 flex items-center gap-4">
                        <div className="h-11 w-11 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-sm">
                            <FaStar />
                        </div>
                        <div>
                            <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest">Special Events</p>
                            <p className="text-2xl font-black text-amber-700 tracking-tighter">{monthStats.specialEvents}</p>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Personal Attendance Section */}
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
                        { label: 'On Duty', value: myStats.od, icon: <FaBriefcase />, color: 'text-emerald-600', bg: 'bg-emerald-50', gradient: 'from-emerald-500 to-emerald-700' },
                        { label: 'Casual Leave', value: myStats.cl, icon: <FaCalendarDay />, color: 'text-amber-600', bg: 'bg-amber-50', gradient: 'from-amber-500 to-amber-700' },
                        { label: 'Medical Leave', value: myStats.ml, icon: <FaFileAlt />, color: 'text-purple-600', bg: 'bg-purple-50', gradient: 'from-purple-500 to-purple-700' },
                        { label: 'Comp Leave', value: myStats.comp_leave, icon: <FaStar />, color: 'text-indigo-600', bg: 'bg-indigo-50', gradient: 'from-indigo-500 to-indigo-700' },
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
                                { label: 'On Duty', value: stats[role.key]?.od, icon: <FaBriefcase />, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                                { label: 'Casual Leave', value: stats[role.key]?.cl, icon: <FaCalendarDay />, color: 'text-amber-600', bg: 'bg-amber-50' },
                                { label: 'Medical Leave', value: stats[role.key]?.ml, icon: <FaFileAlt />, color: 'text-purple-600', bg: 'bg-purple-50' },
                                { label: 'Comp Leave', value: stats[role.key]?.comp_leave, icon: <FaStar />, color: 'text-indigo-600', bg: 'bg-indigo-50' }
                            ].map((stat) => (
                                <div
                                    key={stat.label}
                                    onClick={() => setEmployeeModal({ role: role.key, statusLabel: stat.label, title: role.title })}
                                    className="flex items-center justify-between p-4 rounded-2xl bg-gray-50/50 hover:bg-white transition-all border border-transparent hover:border-gray-100 group/item cursor-pointer"
                                >
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

            {/* Employee List Full Screen */}
            <AnimatePresence>
                {employeeModal && (() => {
                    const filtered = getFilteredEmployees(employeeModal.role, employeeModal.statusLabel);
                    return (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-white z-50 flex flex-col"
                        >
                            {/* Full Screen Header */}
                            <div className="px-6 md:px-10 py-5 border-b border-gray-100 bg-gradient-to-r from-sky-50 to-blue-50 flex items-center justify-between flex-shrink-0">
                                <div className="flex items-center gap-4">
                                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-sky-500 to-sky-700 flex items-center justify-center text-white shadow-lg">
                                        <FaUserCheck size={20} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{employeeModal.title}</p>
                                        <p className="text-xl font-black text-gray-800 tracking-tight">{employeeModal.statusLabel}</p>
                                    </div>
                                    <span className="ml-2 bg-sky-100 text-sky-700 px-4 py-1.5 rounded-xl text-xs font-black">{filtered.length} Employees</span>
                                </div>
                                <button onClick={() => setEmployeeModal(null)} className="p-3 rounded-2xl bg-white hover:bg-rose-50 text-gray-400 hover:text-rose-500 transition-all border border-gray-200 shadow-sm">
                                    <FaTimes size={18} />
                                </button>
                            </div>
                            {/* Full Screen Table */}
                            <div className="flex-1 overflow-auto px-6 md:px-10 py-6">
                                {filtered.length === 0 ? (
                                    <div className="flex items-center justify-center h-full">
                                        <p className="text-gray-400 text-lg font-bold">No employees found</p>
                                    </div>
                                ) : (
                                    <table className="min-w-full text-left">
                                        <thead className="sticky top-0 z-10">
                                            <tr className="bg-gray-50">
                                                <th className="px-5 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">#</th>
                                                <th className="px-5 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Emp ID</th>
                                                <th className="px-5 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Name</th>
                                                <th className="px-5 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Department</th>
                                                <th className="px-5 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                                                <th className="px-5 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center no-print">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {filtered.map((emp, idx) => (
                                                <motion.tr
                                                    key={emp.emp_id}
                                                    initial={{ opacity: 0, y: 5 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: idx * 0.02 }}
                                                    className="hover:bg-sky-50/50 transition-colors cursor-pointer"
                                                    onClick={() => { navigate(`/principal/profile/${emp.emp_id}`); setEmployeeModal(null); window.dispatchEvent(new CustomEvent('closeSidebar')); }}
                                                >
                                                    <td className="px-5 py-4 text-sm font-black text-gray-400">{idx + 1}</td>
                                                    <td className="px-5 py-4 text-sm font-black text-sky-900">{emp.emp_id}</td>
                                                    <td className="px-5 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-9 w-9 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center font-black text-sm shrink-0">
                                                                {(emp.name || '?').charAt(0)}
                                                            </div>
                                                            <span className="text-sm font-bold text-gray-800">{emp.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-4 text-sm font-medium text-gray-600">{emp.department_name || '—'}</td>
                                                    <td className="px-5 py-4">
                                                        <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border bg-sky-50 text-sky-600 border-sky-100">
                                                            {attendanceMap[emp.emp_id] || 'N/A'}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-4 text-center no-print">
                                                        <FaEye className="inline text-gray-300 group-hover:text-sky-500" size={14} />
                                                    </td>
                                                </motion.tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </motion.div>
                    );
                })()}
            </AnimatePresence>

        </Layout>
    );
};

export default Dashboard;
