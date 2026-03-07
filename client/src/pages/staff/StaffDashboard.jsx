import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { motion } from 'framer-motion';
import { useSocket } from '../../context/SocketContext';
import { FaUserCheck, FaUserTimes, FaBus, FaFileAlt, FaCalendarDay, FaIdBadge, FaEnvelope, FaPhone } from 'react-icons/fa';
import AttendanceHistory from '../../components/AttendanceHistory';

const StaffDashboard = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const socket = useSocket();
    const [myStats, setMyStats] = useState({ present: 0, absent: 0, leave: 0, od: 0, lop: 0 });
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [now, setNow] = useState(new Date());

    // Update time every second
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const fetchData = useCallback(async () => {
        if (!user) return;
        try {
            const month = new Date().toISOString().slice(0, 7); // "YYYY-MM"
            const { data: records } = await api.get(`/attendance?month=${month}`);

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

            const { data: profileData } = await api.get('/auth/profile');
            setProfile(profileData);
        } catch (error) {
            console.error('Staff dashboard error', error);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 15000);
        return () => clearInterval(interval);
    }, [fetchData]);

    useEffect(() => {
        if (!socket) return;
        socket.on('attendance_updated', fetchData);
        return () => socket.off('attendance_updated', fetchData);
    }, [socket, fetchData]);

    const stats = [
        { label: 'Present', value: myStats.present, icon: <FaUserCheck />, colorClass: 'text-sky-600', bgClass: 'bg-sky-50', borderClass: 'border-sky-100', gradientClass: 'from-sky-500 to-sky-700' },
        { label: 'Absent', value: myStats.absent, icon: <FaUserTimes />, colorClass: 'text-rose-600', bgClass: 'bg-rose-50', borderClass: 'border-rose-100', gradientClass: 'from-rose-500 to-rose-700' },
        { label: 'On Duty', value: myStats.od, icon: <FaBus />, colorClass: 'text-emerald-600', bgClass: 'bg-emerald-50', borderClass: 'border-emerald-100', gradientClass: 'from-emerald-500 to-emerald-700' },
        { label: 'LOP Count', value: myStats.lop, icon: <FaFileAlt />, colorClass: 'text-purple-600', bgClass: 'bg-purple-50', borderClass: 'border-purple-100', gradientClass: 'from-purple-500 to-purple-700' },
    ];

    const currentMonth = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

    return (
        <Layout>
            {/* Header */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-4xl font-black text-gray-800 tracking-tighter">
                            My <span className="text-[#4A90E2]">Dashboard</span>
                        </h1>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mt-2">
                            {currentMonth} · Personal Attendance Record
                        </p>
                    </div>

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
                </div>
            </motion.div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-32 gap-4">
                    <div className="h-12 w-12 border-4 border-sky-100 border-t-sky-600 rounded-full animate-spin" />
                    <p className="text-[10px] font-black text-sky-500 uppercase tracking-widest">Loading attendance...</p>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                        {stats.map((stat, idx) => (
                            <motion.div
                                key={stat.label}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.08 }}
                                whileHover={{ y: -6, scale: 1.03 }}
                                className="bg-white rounded-[32px] shadow-lg shadow-sky-50/50 border border-sky-50 p-8 group relative overflow-hidden flex flex-col items-center text-center"
                            >
                                <div className={`absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r ${stat.gradientClass}`} />
                                <div className={`h-14 w-14 rounded-[20px] ${stat.bgClass} ${stat.colorClass} flex items-center justify-center text-xl shadow-sm mb-5 group-hover:rotate-6 transition-transform duration-500`}>
                                    {stat.icon}
                                </div>
                                <span className="text-4xl font-black text-gray-800 tracking-tighter mb-2 leading-none">
                                    {stat.value}
                                </span>
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                                    {stat.label}
                                </span>
                                <div className="absolute -bottom-8 -right-8 w-24 h-24 bg-gray-50 rounded-full blur-2xl opacity-60" />
                            </motion.div>
                        ))}
                    </div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="bg-white rounded-[40px] shadow-xl shadow-sky-50/50 border border-sky-50 p-10"
                    >
                        <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mb-8">
                            Personal Information
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                            {[
                                { icon: <FaIdBadge />, label: 'Employee ID', value: user?.emp_id || '—' },
                                { icon: <FaEnvelope />, label: 'Email', value: profile?.email || user?.email || '—' },
                                { icon: <FaPhone />, label: 'Mobile', value: profile?.mobile || user?.mobile || '—' },
                            ].map(item => (
                                <div key={item.label} className="flex items-center gap-4 p-5 rounded-2xl bg-gray-50 border border-gray-100 hover:bg-white hover:border-sky-100 hover:shadow-sm transition-all">
                                    <div className="h-10 w-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center text-sm flex-shrink-0 shadow-sm">
                                        {item.icon}
                                    </div>
                                    <div className="overflow-hidden">
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{item.label}</p>
                                        <p className="text-sm font-black text-gray-800 mt-0.5 truncate">{item.value}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>

                    {/* Quick Action Grid Removed */}
                </>
            )}
            <AttendanceHistory empId={user?.emp_id} />
        </Layout>
    );
};

export default StaffDashboard;
