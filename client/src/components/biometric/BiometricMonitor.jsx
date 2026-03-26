import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FaFingerprint, FaClock, FaIdBadge, FaCalendarDay, FaSync } from 'react-icons/fa';
import api from '../../utils/api';
import { formatTo12Hr } from '../../utils/timeFormatter';

const BiometricMonitor = ({ empId, onDataChange }) => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState(null);

    const calculateHoursForEmployee = (intime, outtime) => {
        if (!intime || !outtime) return '—';
        
        const parseTime = (timeValue) => {
            const parsed = String(timeValue).trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
            if (!parsed) return null;
            const hours = Number(parsed[1]);
            const minutes = Number(parsed[2]);
            if (Number.isNaN(hours) || Number.isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
                return null;
            }
            return (hours * 60) + minutes;
        };

        const inMinutes = parseTime(intime);
        const outMinutes = parseTime(outtime);
        
        if (inMinutes === null || outMinutes === null) return '—';

        // If out time is earlier than in time, assume overnight shift.
        const worked = outMinutes >= inMinutes
            ? (outMinutes - inMinutes)
            : ((24 * 60) - inMinutes + outMinutes);

        const hours = Math.floor(worked / 60);
        const minutes = worked % 60;
        return `${hours}h ${String(minutes).padStart(2, '0')}m`;
    };

    const fetchData = async () => {
        try {
            setLoading(true);
            const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
            const query = empId
                ? `/biometric/data?emp_id=${empId}&date=${today}`
                : `/biometric/data?date=${today}`;
            const [dataRes, statsRes] = await Promise.all([
                api.get(query),
                api.get('/biometric/stats')
            ]);
            setLogs(dataRes.data);
            setStats(statsRes.data);
            
            // Notify parent component of data change
            if (onDataChange) {
                onDataChange(dataRes.data);
            }
        } catch (error) {
            console.error('Error fetching biometric data', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // Set up an interval for polling if socket is not enough
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, [empId]);

    if (loading && logs.length === 0) return (
        <div className="py-10 flex justify-center">
            <div className="h-8 w-8 border-4 border-sky-100 border-t-sky-600 rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Stats Overview */}
            {/* Stats Overview removed per request */}

            {/* Logs Table */}
            <div className="bg-white rounded-[40px] shadow-2xl shadow-sky-500/5 border border-sky-50 overflow-hidden">
                <div className="p-8 border-b border-gray-50">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-2xl bg-sky-600 text-white flex items-center justify-center shadow-lg shadow-sky-200">
                                <FaFingerprint size={20} />
                            </div>
                            <div>
                                <h2 className="text-lg font-black text-gray-800 tracking-tight">Biometric Activity</h2>
                                <p className="text-[11px] text-gray-500 tracking-wide">
                                    total today users: {Number(stats?.total_users ?? logs.length)}
                                </p>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Real-time device synchronization</p>
                            </div>
                        </div>
                        <button
                            onClick={fetchData}
                            className="h-10 w-10 rounded-xl bg-gray-50 text-gray-400 hover:text-sky-600 hover:bg-sky-50 transition-all flex items-center justify-center"
                            title="Refresh"
                        >
                            <FaSync className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                    {/* Live Date Display removed per request */}
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50">
                                <th className="px-8 py-5 text-[9px] font-black text-gray-400 uppercase tracking-widest">User Details</th>
                                <th className="px-8 py-5 text-[9px] font-black text-gray-400 uppercase tracking-widest">Date</th>
                                <th className="px-8 py-5 text-[9px] font-black text-gray-400 uppercase tracking-widest">In Time</th>
                                <th className="px-8 py-5 text-[9px] font-black text-gray-400 uppercase tracking-widest">Out Time</th>
                                <th className="px-8 py-5 text-[9px] font-black text-gray-400 uppercase tracking-widest">Total Hours</th>
                                <th className="px-8 py-5 text-[9px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {logs.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-8 py-12 text-center text-gray-400 text-[10px] font-bold uppercase tracking-widest italic">
                                        No biometric data found.
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log, idx) => (
                                    <motion.tr
                                        key={log.id}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                        className="hover:bg-sky-50/30 transition-colors"
                                    >
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-3">
                                                <div className="h-9 w-9 rounded-xl bg-gray-100 flex items-center justify-center text-sky-600">
                                                    <FaIdBadge />
                                                </div>
                                                <div>
                                                    <p className="text-[11px] font-black text-gray-700">{log.name || log.user_id}</p>
                                                    <p className="text-[9px] font-bold text-gray-400 uppercase">{log.user_id}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-2">
                                                <FaCalendarDay className="text-gray-300 text-[10px]" />
                                                <span className="text-[11px] font-black text-gray-600">
                                                    {new Date(String(log.date).slice(0, 10) + 'T00:00:00+05:30').toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' })}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-2">
                                                <FaClock className="text-emerald-500 text-[10px]" />
                                                <span className="text-[11px] font-black text-gray-700">{formatTo12Hr(log.intime) || '--:--'}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-2">
                                                <FaClock className="text-rose-500 text-[10px]" />
                                                <span className="text-[11px] font-black text-gray-700">{formatTo12Hr(log.outtime) || '--:--'}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-2">
                                                <FaClock className="text-sky-600 text-[10px]" />
                                                <span className="text-[11px] font-black text-sky-700">
                                                    {calculateHoursForEmployee(log.intime, log.outtime)}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${log.outtime ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-sky-50 text-sky-600 border-sky-100'
                                                }`}>
                                                {log.outtime ? 'Completed' : 'Active'}
                                            </span>
                                        </td>
                                    </motion.tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default BiometricMonitor;
