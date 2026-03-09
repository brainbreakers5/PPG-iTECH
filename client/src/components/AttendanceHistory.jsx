import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { FaCalendarAlt, FaClock, FaHistory, FaCheckCircle, FaTimesCircle, FaBus } from 'react-icons/fa';
import api from '../utils/api';
import { useSocket } from '../context/SocketContext';

const AttendanceHistory = ({ empId, month: propMonth, startDate, endDate, recentOnly = true }) => {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const socket = useSocket();

    const fetchAttendance = useCallback(async () => {
        try {
            let query = `/attendance?emp_id=${empId}`;

            if (recentOnly) {
                query += `&onlyUploaded=true&recent=true&limit=10`;
            } else if (startDate && endDate) {
                query += `&onlyUploaded=true&startDate=${startDate}&endDate=${endDate}`;
            } else {
                const selectedMonth = propMonth || new Date().toISOString().slice(0, 7);
                query += `&onlyUploaded=true&month=${selectedMonth}`;
            }

            const { data } = await api.get(query);
            // API already returns newest first for uploaded-only mode.
            setRecords(data || []);
        } catch (error) {
            console.error('Error fetching attendance history', error);
        } finally {
            setLoading(false);
        }
    }, [empId, propMonth, startDate, endDate, recentOnly]);

    useEffect(() => {
        fetchAttendance();
    }, [fetchAttendance]);

    useEffect(() => {
        if (!socket) return;
        socket.on('attendance_updated', fetchAttendance);
        return () => socket.off('attendance_updated', fetchAttendance);
    }, [socket, fetchAttendance]);

    const calculateHours = (inTime, outTime) => {
        if (!inTime || !outTime) return '—';
        const start = new Date(`2000-01-01T${inTime}`);
        const end = new Date(`2000-01-01T${outTime}`);
        const diff = (end - start) / (1000 * 60 * 60);
        return diff > 0 ? `${diff.toFixed(1)} hrs` : '—';
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'Present': return <FaCheckCircle className="text-emerald-500" />;
            case 'Absent': return <FaTimesCircle className="text-rose-500" />;
            case 'OD': return <FaBus className="text-sky-500" />;
            default: return <FaCalendarAlt className="text-amber-500" />;
        }
    };

    if (loading) return (
        <div className="py-10 flex justify-center">
            <div className="h-8 w-8 border-4 border-sky-100 border-t-sky-600 rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="mt-12 bg-white rounded-[40px] shadow-xl shadow-sky-50/50 border border-sky-50 overflow-hidden">
            <div className="p-8 border-b border-gray-50 bg-gray-50/30">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-lg shadow-sky-200">
                            <FaHistory />
                        </div>
                        <div>
                            <h2 className="text-sm font-black text-gray-800 uppercase tracking-widest">Recent Attendance History</h2>
                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                                {recentOnly
                                    ? 'Showing latest 10 uploaded records'
                                    : (startDate && endDate
                                        ? `Records from ${startDate} to ${endDate}`
                                        : `Showing uploaded records for ${propMonth || 'this month'}`)}  
                            </p>
                        </div>
                    </div>
                </div>
                {/* Live Date Display */}
                <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-sky-50 to-blue-50 rounded-2xl border border-sky-100">
                    <div className="flex items-center gap-2">
                        <FaCalendarAlt className="text-sky-600 text-sm" />
                        <div>
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Live Date</p>
                            <p className="text-sm font-black text-gray-800">
                                {new Date().toLocaleDateString('en-US', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                            </p>
                        </div>
                    </div>
                    <span className="ml-auto px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border bg-sky-50 text-sky-600 border-sky-100 flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 bg-sky-500 rounded-full animate-ping" />
                        Live
                    </span>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50/50">
                            <th className="px-8 py-5 text-[9px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50">Date</th>
                            <th className="px-8 py-5 text-[9px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50">Status</th>
                            <th className="px-8 py-5 text-[9px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50">In Time</th>
                            <th className="px-8 py-5 text-[9px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50">Out Time</th>
                            <th className="px-8 py-5 text-[9px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50">Work Hours</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {records.length === 0 ? (
                            <tr>
                                <td colSpan="5" className="px-8 py-12 text-center text-gray-400 text-[10px] font-bold uppercase tracking-widest italic">
                                    No uploaded attendance records found.
                                </td>
                            </tr>
                        ) : (
                            records.map((record, idx) => (
                                <motion.tr
                                    key={record.id || idx}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                    className="hover:bg-sky-50/30 transition-colors group"
                                >
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-lg bg-gray-50 text-gray-400 flex items-center justify-center text-xs group-hover:bg-white transition-colors border border-gray-100">
                                                <FaCalendarAlt />
                                            </div>
                                            <span className="text-[11px] font-black text-gray-700 tracking-tight">
                                                {new Date(String(record.date).slice(0, 10) + 'T00:00:00+05:30').toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' })}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-2">
                                            {getStatusIcon(record.status)}
                                            <span className={`text-[9px] font-black uppercase tracking-widest ${record.status === 'Present' ? 'text-emerald-600' :
                                                record.status === 'Absent' ? 'text-rose-500' :
                                                    record.status === 'OD' ? 'text-sky-600' : 'text-amber-500'
                                                }`}>
                                                {record.status}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-2">
                                            <FaClock className="text-gray-300 text-[10px]" />
                                            <span className="text-[11px] font-black text-gray-600">{record.in_time || '—'}</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-2">
                                            <FaClock className="text-gray-300 text-[10px]" />
                                            <span className="text-[11px] font-black text-gray-600">{record.out_time || '—'}</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${record.in_time && record.out_time
                                            ? 'bg-sky-50 text-sky-600 border-sky-100'
                                            : 'bg-gray-50 text-gray-400 border-gray-100'
                                            }`}>
                                            {calculateHours(record.in_time, record.out_time)}
                                        </span>
                                    </td>
                                </motion.tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AttendanceHistory;
