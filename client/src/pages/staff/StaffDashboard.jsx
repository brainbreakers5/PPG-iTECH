import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { motion } from 'framer-motion';
import { useSocket } from '../../context/SocketContext';
import { FaUserCheck, FaUserTimes, FaBus, FaFileAlt, FaCalendarDay, FaCalendarAlt, FaStar, FaEye } from 'react-icons/fa';
import AttendanceHistory from '../../components/AttendanceHistory';

const StaffDashboard = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const socket = useSocket();
    const [myStats, setMyStats] = useState({ present: 0, absent: 0, od: 0, cl: 0, ml: 0, comp_leave: 0 });
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [monthStats, setMonthStats] = useState({ workingDays: 0, holidays: 0, specialEvents: 0 });

    const fetchData = useCallback(async () => {
        if (!user) return;
        try {
            const month = new Date().toISOString().slice(0, 7); // "YYYY-MM"
            const { data: records } = await api.get(`/attendance?month=${month}`);

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

            const { data: profileData } = await api.get('/auth/profile');
            setProfile(profileData);
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
        { label: 'On Duty', value: myStats.od, icon: <FaEye />, colorClass: 'text-emerald-600', bgClass: 'bg-emerald-50', borderClass: 'border-emerald-100', gradientClass: 'from-emerald-500 to-emerald-700' },
        { label: 'Casual Leave', value: myStats.cl, icon: <FaCalendarDay />, colorClass: 'text-amber-600', bgClass: 'bg-amber-50', borderClass: 'border-amber-100', gradientClass: 'from-amber-500 to-amber-700' },
        { label: 'Medical Leave', value: myStats.ml, icon: <FaFileAlt />, colorClass: 'text-purple-600', bgClass: 'bg-purple-50', borderClass: 'border-purple-100', gradientClass: 'from-purple-500 to-purple-700' },
        { label: 'Comp Leave', value: myStats.comp_leave, icon: <FaStar />, colorClass: 'text-indigo-600', bgClass: 'bg-indigo-50', borderClass: 'border-indigo-100', gradientClass: 'from-indigo-500 to-indigo-700' },
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
                </div>
            </motion.div>

            {/* Monthly Summary Bar */}
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

            {loading ? (
                <div className="flex flex-col items-center justify-center py-32 gap-4">
                    <div className="h-12 w-12 border-4 border-sky-100 border-t-sky-600 rounded-full animate-spin" />
                    <p className="text-[10px] font-black text-sky-500 uppercase tracking-widest">Loading attendance...</p>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
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

                    {/* Quick Action Grid Removed */}
                </>
            )}
            <AttendanceHistory empId={user?.emp_id} />
        </Layout>
    );
};

export default StaffDashboard;
