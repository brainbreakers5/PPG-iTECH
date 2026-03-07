import { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/Layout';
import api from '../../utils/api';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { FaIdBadge, FaBirthdayCake, FaUserCheck, FaUserTimes, FaCalendarDay, FaBus, FaFileAlt } from 'react-icons/fa';

// ── Small helper components ─────────────────────────────────────────────────
// Small helper components removed ...
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

// ── Main Component ──────────────────────────────────────────────────────────
const AdminDashboard = () => {
    const { user } = useAuth();
    const socket = useSocket();
    const navigate = useNavigate();
    const [stats, setStats] = useState({
        present: 0, leave: 0, od: 0, lop: 0, absent: 0,
        principal: { present: 0, leave: 0, od: 0, lop: 0, absent: 0 },
        hod: { present: 0, leave: 0, od: 0, lop: 0, absent: 0 },
        staff: { present: 0, leave: 0, od: 0, lop: 0, absent: 0 }
    });
    const [birthdays, setBirthdays] = useState([]);
    const [allEmployees, setAllEmployees] = useState([]);
    const [attendanceMap, setAttendanceMap] = useState({});
    const [now, setNow] = useState(new Date());

    // Update time every second
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const fetchDashboardData = useCallback(async () => {
        try {
            const date = new Date().toISOString().split('T')[0];
            const { data: summary } = await api.get(`/attendance/summary?date=${date}`);
            setStats(summary || {
                present: 0, leave: 0, od: 0, lop: 0, absent: 0,
                principal: { present: 0, leave: 0, od: 0, lop: 0, absent: 0 },
                hod: { present: 0, leave: 0, od: 0, lop: 0, absent: 0 },
                staff: { present: 0, leave: 0, od: 0, lop: 0, absent: 0 }
            });
            const { data: bdays } = await api.get('/employees/birthdays/today');
            setBirthdays(bdays);
            const { data: emps } = await api.get('/employees');
            setAllEmployees(emps);
            // Build attendance map: emp_id -> status for today
            const { data: todayAtt } = await api.get(`/attendance?date=${date}`);
            const map = {};
            (todayAtt || []).forEach(r => { map[r.emp_id] = r.status; });
            setAttendanceMap(map);
        } catch (error) { console.error('Dashboard error', error); }
    }, []);

    // Auto-refresh every 10 seconds
    useEffect(() => {
        fetchDashboardData();
        const interval = setInterval(fetchDashboardData, 10000);
        return () => clearInterval(interval);
    }, [fetchDashboardData]);

    // Real-time: refresh instantly when an employee is added/updated/deleted
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
    const principalList = allEmployees.filter(e => (e.role || '').toLowerCase() === 'principal');

    const roleConfigs = [
        {
            key: 'principal', title: 'Principal',
            accentClass: 'from-sky-500 to-sky-700',
            canViewAll: true,
            modalRole: 'principal',
            totalCount: principalList.length
        },
        {
            key: 'hod', title: 'HODs',
            accentClass: 'from-amber-400 to-amber-600',
            canViewAll: true,
            modalRole: 'hod',
            totalCount: hodList.length
        },
        {
            key: 'staff', title: 'Staff',
            accentClass: 'from-purple-500 to-purple-700',
            canViewAll: true,
            modalRole: 'staff',
            totalCount: staffList.length
        }
    ];

    const menuItems = [];

    const menuColorStyles = {
        blue: { bg: 'bg-sky-50', text: 'text-sky-600', border: 'border-sky-100', accent: 'bg-sky-500' },
        amber: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-100', accent: 'bg-amber-500' },
        indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-100', accent: 'bg-indigo-500' },
        emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100', accent: 'bg-emerald-500' },
        purple: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-100', accent: 'bg-purple-500' },
        pink: { bg: 'bg-pink-50', text: 'text-pink-600', border: 'border-pink-100', accent: 'bg-pink-500' }
    };

    // const navigate = (path) => window.location.href = path; // Removed manual navigation function collision

    return (
        <Layout>
            {/* Page Header */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-4xl font-black text-gray-800 tracking-tighter">
                            Admin <span className="text-[#0EA5E9]">Dashboard</span>
                        </h1>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mt-2">
                            Institutional Attendance Intelligence
                        </p>
                    </div>

                    <div className="flex items-center gap-6">
                        {/* Real-time Date & Time */}
                        <div className="flex flex-col items-end px-5 py-3 rounded-2xl border-2 border-sky-200 bg-gradient-to-br from-sky-50 to-white shadow-lg">
                            <p className="text-[9px] font-black uppercase tracking-wider text-sky-600 flex items-center gap-1.5">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                {now.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                            </p>
                            <p className="text-base font-black text-gray-800 tracking-wide mt-1 flex items-center gap-1.5">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                            </p>
                        </div>

                        {birthdays.length > 0 && (
                            <motion.div
                                whileHover={{ scale: 1.05 }}
                                className="bg-gradient-to-tr from-[#FF9A9E] to-[#FAD0C4] p-[1px] rounded-3xl shadow-2xl shadow-rose-200/50 cursor-pointer"
                                onClick={() => {
                                    document.getElementById('birthdays-section')?.scrollIntoView({ behavior: 'smooth' });
                                }}
                            >
                                <div className="bg-white/90 backdrop-blur-md px-6 py-3 rounded-[23px] flex items-center gap-4">
                                    <div className="h-8 w-8 rounded-full bg-rose-50 flex items-center justify-center">
                                        <FaBirthdayCake className="text-rose-500 animate-bounce" />
                                    </div>
                                    <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest hover:text-rose-700 transition-colors">
                                        {birthdays.length} Personnel Birthdays Today! (Click to View)
                                    </span>
                                </div>
                            </motion.div>
                        )}
                    </div>
                </div>
            </motion.div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
                {roleConfigs.map((role) => (
                    <motion.div
                        key={role.key}
                        whileHover={{ y: -8, scale: 1.02 }}
                        className="modern-card p-10 bg-white/70 backdrop-blur-xl border border-white/50 group relative overflow-hidden"
                    >
                        {/* Card Header */}
                        <div className="flex justify-between items-center mb-6 relative z-10">
                            <div>
                                <h2 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.3em]">{role.title}</h2>
                                <p className="text-xl font-black text-gray-800 tracking-tighter mt-1">Attendance Core</p>
                            </div>
                            <div className={`p-3 rounded-2xl bg-gradient-to-br ${role.accentClass} text-white shadow-lg`}>
                                <FaUserCheck />
                            </div>
                        </div>

                        {/* "Total" button for HOD and Staff */}
                        {role.canViewAll && (
                            <button
                                onClick={() => {
                                    navigate(`/admin/personnel/${role.modalRole}`);
                                    window.dispatchEvent(new CustomEvent('closeSidebar'));
                                }}
                                className="w-full mb-6 py-3 px-4 rounded-2xl bg-gray-50 border border-gray-100 text-[10px] font-black text-gray-500 uppercase tracking-widest hover:bg-sky-50 hover:border-sky-100 hover:text-sky-600 transition-all flex items-center justify-between group/btn relative z-10"
                            >
                                <span>Total {role.title}</span>
                                <div className="flex items-center gap-2">
                                    <span className="flex items-center gap-1 bg-emerald-50 border border-emerald-100 text-emerald-600 font-black px-2 py-1 rounded-xl text-[9px] uppercase tracking-widest">
                                        <FaUserCheck size={8} /> {stats[role.key]?.present || 0} Available
                                    </span>
                                    <span className="bg-white border border-gray-200 text-gray-800 font-black px-3 py-1 rounded-xl text-sm group-hover/btn:bg-sky-600 group-hover/btn:text-white group-hover/btn:border-sky-600 transition-all">
                                        {role.totalCount}
                                    </span>
                                </div>
                            </button>
                        )}

                        {/* Attendance Stats */}
                        <div className="space-y-4 relative z-10">
                            {[
                                { label: 'Present', value: stats[role.key]?.present, icon: <FaUserCheck />, color: 'text-sky-600', bg: 'bg-sky-50' },
                                { label: 'Absent', value: stats[role.key]?.absent, icon: <FaUserTimes />, color: 'text-rose-600', bg: 'bg-rose-50' },
                                { label: 'On Leave', value: stats[role.key]?.leave, icon: <FaCalendarDay />, color: 'text-amber-600', bg: 'bg-amber-50' },
                                { label: 'On Duty', value: stats[role.key]?.od, icon: <FaBus />, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                                { label: 'LOP Count', value: stats[role.key]?.lop, icon: <FaFileAlt />, color: 'text-purple-600', bg: 'bg-purple-50' }
                            ].map((stat) => (
                                <div key={stat.label} className="flex items-center justify-between p-3 rounded-2xl bg-gray-50/50 hover:bg-white transition-all border border-transparent hover:border-gray-100 group/item">
                                    <div className="flex items-center gap-3">
                                        <div className={`h-9 w-9 rounded-xl ${stat.bg} ${stat.color} flex items-center justify-center text-sm shadow-sm transition-transform group-hover/item:rotate-12`}>
                                            {stat.icon}
                                        </div>
                                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{stat.label}</span>
                                    </div>
                                    <span className="text-lg font-black text-gray-800 tracking-tighter">{stat.value || 0}</span>
                                </div>
                            ))}
                        </div>

                        {/* Background Decor */}
                        <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-gray-50 rounded-full blur-3xl opacity-50" />
                    </motion.div>
                ))}
            </div>

            {/* Quick Access Menu Grid Removed */}

            {/* Birthdays */}
            {birthdays.length > 0 && (
                <div id="birthdays-section" className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                    <div className="bg-gradient-to-br from-[#8E9EFF] to-[#4A90E2] rounded-[40px] shadow-2xl shadow-sky-200/50 p-10 text-white relative overflow-hidden group">
                        <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000" />
                        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] mb-10 flex items-center relative z-10">
                            Milestone <FaBirthdayCake className="ml-3 text-white animate-bounce" />
                        </h2>
                        <div className="space-y-4 relative z-10">
                            {birthdays.map(b => (
                                <motion.div
                                    key={b.emp_id}
                                    whileHover={{ x: 8 }}
                                    onClick={() => {
                                        const rolePrefix = user?.role === 'admin' ? 'admin' :
                                            user?.role === 'principal' ? 'principal' :
                                                user?.role === 'hod' ? 'hod' : 'staff';
                                        navigate(`/${rolePrefix}/profile/${b.emp_id}`);
                                        window.dispatchEvent(new CustomEvent('closeSidebar'));
                                    }}
                                    className="flex items-center space-x-5 bg-white/10 backdrop-blur-md p-5 rounded-[28px] border border-white/20 hover:bg-white/25 transition-all cursor-pointer group shadow-lg shadow-black/5"
                                >
                                    <div className="h-14 w-14 rounded-2xl bg-white flex items-center justify-center shadow-xl overflow-hidden border-2 border-white ring-4 ring-white/10 shrink-0">
                                        <img
                                            src={b.profile_pic || `https://ui-avatars.com/api/?name=${encodeURIComponent(b.name || '?')}&background=ffffff&color=0EA5E9&bold=true`}
                                            alt={b.name}
                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                        />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[13px] font-black tracking-tight text-white group-hover:translate-x-1 transition-transform truncate">{b.name}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="h-1.5 w-1.5 rounded-full bg-rose-400 animate-pulse" />
                                            <p className="text-[8px] font-black text-sky-100 uppercase tracking-widest">Wishes shared Today</p>
                                        </div>
                                    </div>
                                    <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all -translate-x-4 group-hover:translate-x-0">
                                        <FaBirthdayCake size={12} />
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

        </Layout>
    );
};

export default AdminDashboard;
