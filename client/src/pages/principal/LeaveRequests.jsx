import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import api from '../../utils/api';
import Swal from 'sweetalert2';
import { FaCheck, FaTimes, FaComment, FaCalendarDay, FaUserTag, FaClock, FaCheckCircle, FaTimesCircle, FaHourglassHalf, FaInfoCircle } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';

import { useAuth } from '../../context/AuthContext';

const LeaveRequests = () => {
    const { user } = useAuth();
    const [leaves, setLeaves] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState([]);
    const navigate = useNavigate();

    // Helper function to get full leave type name
    const getLeaveTypeName = (type) => {
        const leaveTypes = {
            'CL': 'Casual Leave (CL)',
            'ML': 'Medical Leave (ML)',
            'OD': 'On Duty (OD)',
            'Comp Leave': 'Compensatory Leave',
            'LOP': 'Loss of Pay (LOP)'
        };
        return leaveTypes[type] || type;
    };

    useEffect(() => {
        fetchLeaves();
    }, []);

    const fetchLeaves = async () => {
        try {
            const { data } = await api.get('/leaves');
            setLeaves(data);
            setLoading(false);
            setSelectedIds([]); // Clear selection on refresh
        } catch (error) {
            console.error("Error fetching leaves", error);
            setLoading(false);
        }
    };

    const handleAction = async (id, status) => {
        const { value: comments } = await Swal.fire({
            title: `${status === 'Approved' ? 'Approve' : 'Reject'} Leave?`,
            input: 'textarea',
            inputLabel: 'Comments (Optional)',
            inputPlaceholder: 'Enter your message to the employee...',
            showCancelButton: true,
            confirmButtonColor: status === 'Approved' ? '#059669' : '#ef4444',
            confirmButtonText: `Yes, ${status}`,
            background: '#fff',
            color: '#1e3a8a',
            customClass: {
                popup: 'swal-modern-popup'
            }
        });

        if (comments !== undefined) {
            try {
                await api.put(`/leaves/${id}/approve`, { status, comments });
                Swal.fire({
                    title: 'Leave Updated',
                    text: 'The decision has been saved and the employee notified.',
                    icon: 'success',
                    confirmButtonColor: '#2563eb'
                });
                fetchLeaves();
            } catch (error) {
                Swal.fire({
                    title: 'Sync Error',
                    text: error.response?.data?.message || 'Failed to update ledger.',
                    icon: 'error',
                    confirmButtonColor: '#2563eb'
                });
            }
        }
    };

    const handleBulkAction = async (status) => {
        if (selectedIds.length === 0) return;

        const { value: comments } = await Swal.fire({
            title: `${status === 'Approved' ? 'Approve' : 'Reject'} ${selectedIds.length} Requests?`,
            input: 'textarea',
            inputLabel: 'Comments (Optional)',
            inputPlaceholder: 'This comment will apply to all selected requests...',
            showCancelButton: true,
            confirmButtonColor: status === 'Approved' ? '#059669' : '#ef4444',
            confirmButtonText: `Yes, ${status} All`,
            background: '#fff',
        });

        if (comments !== undefined) {
            try {
                Swal.fire({
                    title: 'Processing...',
                    didOpen: () => Swal.showLoading()
                });

                await Promise.all(selectedIds.map(id => api.put(`/leaves/${id}/approve`, { status, comments })));

                Swal.fire({
                    title: 'Bulk Process Complete',
                    text: `Successfully processed ${selectedIds.length} requests.`,
                    icon: 'success',
                    confirmButtonColor: '#2563eb'
                });
                fetchLeaves();
            } catch (error) {
                Swal.fire({
                    title: 'Bulk Action Failed',
                    text: 'Some requests might not have been updated.',
                    icon: 'error',
                    confirmButtonColor: '#2563eb'
                });
            }
        }
    };

    const toggleSelect = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === pendingLeaves.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(pendingLeaves.map(l => l.id));
        }
    };

    const pendingLeaves = leaves.filter(l => l.my_approval_status === 'Pending');
    const processedLeaves = leaves.filter(l => l.my_approval_status && l.my_approval_status !== 'Pending');

    return (
        <Layout>
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-7xl mx-auto"
            >
                <div className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-black text-gray-800 tracking-tight">Leave Requests</h1>
                        <p className="text-gray-500 font-medium mt-1">Review and process employee leave requests.</p>
                    </div>
                </div>

                <div className="modern-card !p-0 overflow-hidden border-sky-100 mb-12">
                    <div className="bg-sky-50/30 p-6 border-b border-sky-50 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-sky-100 flex items-center justify-center text-sky-600 shadow-sm border border-sky-100">
                                <FaHourglassHalf size={18} className={loading ? 'animate-spin' : ''} />
                            </div>
                            <h2 className="text-lg font-black text-gray-800 uppercase tracking-widest">Pending Requests</h2>
                        </div>
                        <div className="flex items-center gap-4">
                            {selectedIds.length > 0 && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="flex items-center gap-2 bg-white border border-sky-100 p-1 rounded-xl shadow-sm"
                                >
                                    <button
                                        onClick={() => handleBulkAction('Approved')}
                                        className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all active:scale-95"
                                    >
                                        Approve Selected ({selectedIds.length})
                                    </button>
                                    <button
                                        onClick={() => handleBulkAction('Rejected')}
                                        className="px-4 py-2 bg-rose-50 text-rose-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all active:scale-95"
                                    >
                                        Reject Selected
                                    </button>
                                </motion.div>
                            )}
                            <span className="bg-sky-600 text-white px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg shadow-sky-100">
                                {pendingLeaves.length} Requests
                            </span>
                        </div>
                    </div>

                    {loading ? (
                        <div className="p-20 text-center flex flex-col items-center gap-4">
                            <div className="h-12 w-12 border-4 border-sky-100 border-t-sky-600 rounded-full animate-spin"></div>
                            <p className="text-[10px] font-black text-sky-500 uppercase tracking-[0.2em]">Synchronizing Requests...</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50/50">
                                        <th className="p-5 w-12 border-b border-sky-50">
                                            <div className="flex justify-center">
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 rounded border-sky-200 text-sky-600 focus:ring-sky-500 cursor-pointer"
                                                    checked={selectedIds.length === pendingLeaves.length && pendingLeaves.length > 0}
                                                    onChange={toggleSelectAll}
                                                />
                                            </div>
                                        </th>
                                        <th className="p-5 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-sky-50">Employee</th>
                                        <th className="p-5 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-sky-50">Leave Details</th>
                                        <th className="p-5 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-sky-50">Reason</th>
                                        <th className="p-5 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-sky-50">Role</th>
                                        <th className="p-5 text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-sky-50 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-sky-50/50">
                                    <AnimatePresence>
                                        {pendingLeaves.map((leave, idx) => (
                                            <motion.tr
                                                key={leave.id}
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0, x: -20 }}
                                                transition={{ delay: idx * 0.05 }}
                                                className={`transition-all group ${selectedIds.includes(leave.id) ? 'bg-sky-50/40' : 'hover:bg-sky-50/20'}`}
                                            >
                                                <td className="p-5">
                                                    <div className="flex justify-center">
                                                        <input
                                                            type="checkbox"
                                                            className="w-4 h-4 rounded border-sky-200 text-sky-600 focus:ring-sky-500 cursor-pointer"
                                                            checked={selectedIds.includes(leave.id)}
                                                            onChange={() => toggleSelect(leave.id)}
                                                        />
                                                    </div>
                                                </td>
                                                <td className="p-5">
                                                    <div
                                                        className="flex items-center gap-4 cursor-pointer group/profile"
                                                        onClick={() => {
                                                            const rolePrefix = user?.role === 'admin' ? 'admin' :
                                                                user?.role === 'principal' ? 'principal' :
                                                                    user?.role === 'hod' ? 'hod' : 'staff';
                                                            navigate(`/${rolePrefix}/profile/${leave.applicant_id || leave.emp_id}`);
                                                            window.dispatchEvent(new CustomEvent('closeSidebar'));
                                                        }}
                                                    >
                                                        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-sky-500 to-sky-700 flex items-center justify-center text-white font-black text-lg shadow-lg group-hover/profile:scale-110 transition-transform">
                                                            {leave.applicant_name?.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-black text-gray-800 tracking-tight group-hover/profile:text-sky-600 transition-colors">{leave.applicant_name}</p>
                                                            <p className="text-[10px] font-black text-sky-500 uppercase tracking-widest mt-0.5">{leave.department_name}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-5">
                                                    <div className="space-y-1.5">
                                                        <span className="inline-block px-2 py-0.5 bg-sky-100 text-sky-600 rounded-md text-[8px] font-black uppercase tracking-widest mb-1">{getLeaveTypeName(leave.leave_type)} • {leave.days_count} Days</span>
                                                        <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                                            <FaCalendarDay className="text-sky-200" />
                                                            {new Date(leave.from_date).toLocaleDateString('en-US', { day: '2-digit', month: 'short' })} - {new Date(leave.to_date).toLocaleDateString('en-US', { day: '2-digit', month: 'short' })}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-5 max-w-xs">
                                                    <p className="text-sm font-black text-gray-800 tracking-tight truncate">{leave.subject || 'Leave Request'}</p>
                                                    <p className="text-xs text-gray-400 font-medium line-clamp-2 mt-1 leading-relaxed">{leave.reason}</p>
                                                </td>
                                                <td className="p-5">
                                                    <div className="flex flex-col gap-2">
                                                        <div className="flex items-center gap-2">
                                                            <div className="h-6 w-6 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400 border border-gray-100">
                                                                <FaUserTag size={10} />
                                                            </div>
                                                            <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">
                                                                {leave.my_approver_type}
                                                            </span>
                                                        </div>
                                                        {leave.approval_notes && (
                                                            <div className="px-2 py-1 bg-sky-50 text-sky-600 rounded-md text-[8px] font-black uppercase tracking-tight border border-sky-100">
                                                                {leave.approval_notes}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-5">
                                                    <div className="flex justify-center gap-3">
                                                        <button
                                                            onClick={() => handleAction(leave.id, 'Approved')}
                                                            className="h-10 w-10 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-600 hover:text-white transition-all shadow-sm flex items-center justify-center group/btn active:scale-90"
                                                            title="Authorize"
                                                        >
                                                            <FaCheck className="group-hover/btn:scale-125 transition-transform" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleAction(leave.id, 'Rejected')}
                                                            className="h-10 w-10 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-600 hover:text-white transition-all shadow-sm flex items-center justify-center group/btn active:scale-90"
                                                            title="Decline"
                                                        >
                                                            <FaTimes className="group-hover/btn:scale-125 transition-transform" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </motion.tr>
                                        ))}
                                    </AnimatePresence>
                                    {pendingLeaves.length === 0 && !loading && (
                                        <tr>
                                            <td colSpan="5" className="p-24 text-center">
                                                <div className="flex flex-col items-center gap-6 opacity-20">
                                                    <div className="h-20 w-20 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                                        <FaCheckCircle size={48} />
                                                    </div>
                                                    <div>
                                                        <p className="text-lg font-black text-gray-800 tracking-tight">No Pending Requests</p>
                                                        <p className="text-sm font-bold uppercase tracking-widest text-gray-500 mt-1">All leave requests have been processed.</p>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Recently Processed Section */}
                <div className="mt-16">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="h-1 w-12 bg-sky-600 rounded-full"></div>
                        <h3 className="text-xl font-black text-gray-800 tracking-tight uppercase tracking-[0.1em]">Recent Decisions</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {processedLeaves.slice(0, 6).map((leave, idx) => (
                            <motion.div
                                key={leave.id}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: idx * 0.05 }}
                                onClick={() => {
                                    const rolePrefix = user?.role === 'admin' ? 'admin' :
                                        user?.role === 'principal' ? 'principal' :
                                            user?.role === 'hod' ? 'hod' : 'staff';
                                    navigate(`/${rolePrefix}/profile/${leave.applicant_id || leave.emp_id}`);
                                    window.dispatchEvent(new CustomEvent('closeSidebar'));
                                }}
                                className="modern-card group border-sky-50 hover:border-sky-200 cursor-pointer"
                            >
                                <div className="flex justify-between items-start mb-6">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[10px] font-black text-sky-500 uppercase tracking-[0.2em]">{getLeaveTypeName(leave.leave_type)}</span>
                                        <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">{new Date(leave.updated_at).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                    </div>
                                    <div className={`flex items-center gap-1.5 py-1 px-3 rounded-lg border ${leave.my_approval_status === 'Approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'
                                        }`}>
                                        {leave.my_approval_status === 'Approved' ? <FaCheckCircle size={10} /> : <FaTimesCircle size={10} />}
                                        <span className="text-[9px] font-black uppercase tracking-widest">{leave.my_approval_status}</span>
                                    </div>
                                </div>
                                <h4 className="text-base font-black text-gray-800 tracking-tight group-hover:text-sky-600 transition-colors">{leave.applicant_name}</h4>
                                <p className="text-xs text-gray-400 font-medium mt-2 line-clamp-1 italic italic underline-offset-4 mb-4">"{leave.subject || 'Standard Leave Request'}"</p>

                                <div className="pt-4 border-t border-gray-50 flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-[9px] font-black text-gray-400 uppercase tracking-widest">
                                        <FaClock size={10} className="text-sky-300" />
                                        {leave.days_count} days
                                    </div>
                                    <div className="flex items-center gap-1 text-[9px] font-black text-sky-600 uppercase tracking-widest">
                                        <FaInfoCircle size={10} /> Processed
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </motion.div>
        </Layout>
    );
};

export default LeaveRequests;

