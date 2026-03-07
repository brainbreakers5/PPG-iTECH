import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import AttendanceHistory from '../../components/AttendanceHistory';
import { FaArrowLeft, FaIdBadge, FaCalendarAlt } from 'react-icons/fa';
import { motion } from 'framer-motion';

const DetailedAttendancePage = () => {
    const { empId, month, startDate: paramStart, endDate: paramEnd } = useParams();
    const navigate = useNavigate();

    // Support both month-based and range-based navigation
    const start = paramStart || (month ? `${month}-01` : null);
    const end = paramEnd || (month ? new Date(new Date(month).getFullYear(), new Date(month).getMonth() + 1, 0).toISOString().split('T')[0] : null);

    return (
        <Layout>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
                <div className="flex items-center gap-6">
                    <button
                        onClick={() => navigate(-1)}
                        className="h-14 w-14 rounded-2xl bg-white border border-gray-100 flex items-center justify-center text-gray-400 hover:text-sky-600 transition-all shadow-xl shadow-sky-500/5 hover:-translate-x-1 active:scale-90"
                    >
                        <FaArrowLeft size={18} />
                    </button>
                    <div>
                        <h1 className="text-3xl font-black text-gray-800 tracking-tight">
                            Detailed <span className="text-sky-600 uppercase">Attendance</span>
                        </h1>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.4em] mt-2 flex items-center gap-3">
                            <span className="flex items-center gap-1"><FaIdBadge className="text-sky-500" /> {empId}</span>
                            <span className="h-1 w-1 bg-gray-300 rounded-full"></span>
                            <span className="flex items-center gap-1">
                                <FaCalendarAlt className="text-sky-500" />
                                {start && end ? `${new Date(start).toLocaleDateString()} - ${new Date(end).toLocaleDateString()}` : 'Date Range'}
                            </span>
                        </p>
                    </div>
                </div>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-[40px] shadow-2xl shadow-sky-500/5 border border-white"
            >
                <div className="p-2 overflow-hidden">
                    <AttendanceHistory empId={empId} startDate={start} endDate={end} recentOnly={false} />
                </div>
            </motion.div>
        </Layout>
    );
};

export default DetailedAttendancePage;
