import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import api from '../../utils/api';
import Swal from 'sweetalert2';
import { useAuth } from '../../context/AuthContext';
import {
    FaPaperPlane, FaUserFriends, FaHistory, FaCalendarCheck,
    FaClock, FaInfoCircle, FaCheckCircle, FaTimesCircle,
    FaHourglassHalf, FaPlusCircle, FaInbox, FaCheck,
    FaTimes, FaUserTag, FaCalendarAlt
} from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';

const LeaveApply = () => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('apply'); // 'apply', 'approvals', 'history'
    const [pendingApprovals, setPendingApprovals] = useState([]);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState([]);
    const [myLimits, setMyLimits] = useState(null);
    const [limitYear, setLimitYear] = useState(new Date().getFullYear());
    const [balanceLoading, setBalanceLoading] = useState(false);
    const [customLeaveTypes, setCustomLeaveTypes] = useState([]);

    const [formData, setFormData] = useState({
        leave_type: 'CL',
        from_date: '',
        to_date: '',
        days_count: 1,
        is_half_day: false,
        hours: '',
        subject: '',
        reason: '',
        replacements: [{ staff_id: '', periods: '' }]
    });
    const [activeReplacementIdx, setActiveReplacementIdx] = useState(null);
    const [staffList, setStaffList] = useState([]);
    const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
    const [staffSearch, setStaffSearch] = useState('');
    const [conflicts, setConflicts] = useState([]);

    // Helper function to get full leave type name
    const getLeaveTypeName = (type) => {
        const leaveTypes = {
            'CL': 'Casual Leave (CL)',
            'ML': 'Medical Leave (ML)',
            'OD': 'On Duty (OD)',
            'Comp Leave': 'Compensatory Leave',
            'LOP': 'Loss of Pay (LOP)'
        };
        
        // Check custom leave types
        const customType = customLeaveTypes.find(ct => ct.label === type || ct.key === type);
        if (customType) {
            return `${customType.full} (${customType.label})`;
        }
        
        return leaveTypes[type] || type;
    };

    useEffect(() => {
        // Load custom leave types from localStorage
        const saved = localStorage.getItem('customLeaveTypes');
        if (saved) {
            setCustomLeaveTypes(JSON.parse(saved));
        }
    }, []);

    const fetchConflicts = async () => {
        try {
            const { data } = await api.get(`/leaves/conflicts?from=${formData.from_date}&to=${formData.to_date}`);
            setConflicts(data);
        } catch { console.error("Fetch conflicts failed"); }
    };

    const fetchStaff = async () => {
        try {
            const { data } = await api.get('/employees');
            setStaffList(data);
        } catch { console.error("Fetch staff failed"); }
    };

    const fetchLeaves = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/leaves');
            // User's own applications
            setHistory(data.filter(l => l.emp_id === user.emp_id));
            // Requests waiting for user's approval
            setPendingApprovals(data.filter(l => l.my_approval_status === 'Pending'));
            setSelectedIds([]); // Reset selection
        } catch (error) {
            console.error("Error fetching leaves", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchMyLimits = async () => {
        setBalanceLoading(true);
        try {
            const { data } = await api.get(`/leave-limits/my?year=${limitYear}`);
            setMyLimits(data);
        } catch { console.error('Failed to fetch leave limits'); }
        finally { setBalanceLoading(false); }
    };

    useEffect(() => {
        fetchStaff();
        fetchLeaves();
    }, []);

    useEffect(() => {
        fetchMyLimits();
    }, [limitYear]);

    useEffect(() => {
        if (formData.from_date && formData.to_date) {
            fetchConflicts();
        }
    }, [formData.from_date, formData.to_date]);

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
            color: '#1e3a8a'
        });

        if (comments !== undefined) {
            try {
                await api.put(`/leaves/${id}/approve`, { status, comments });
                Swal.fire({
                    title: 'Updated',
                    text: 'Process complete.',
                    icon: 'success',
                    timer: 1500,
                    showConfirmButton: false
                });
                fetchLeaves();
            } catch {
                Swal.fire({ title: 'Error', text: 'Failed to update.', icon: 'error' });
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
            } catch {
                Swal.fire({
                    title: 'Bulk Action Failed',
                    text: 'Some updates might not have completed.',
                    icon: 'error',
                });
            }
        }
    };

    const toggleSelect = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === pendingApprovals.length && pendingApprovals.length > 0) {
            setSelectedIds([]);
        } else {
            setSelectedIds(pendingApprovals.map(l => l.id));
        }
    };

    const handleDelete = async (id) => {
        const result = await Swal.fire({
            title: 'Delete Leave Request?',
            text: "This action cannot be undone.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#1e3a8a',
            confirmButtonText: 'Yes, delete it!'
        });

        if (result.isConfirmed) {
            try {
                await api.delete(`/leaves/${id}`);
                Swal.fire({
                    title: 'Deleted!',
                    text: 'Your leave request has been removed.',
                    icon: 'success',
                    timer: 1500,
                    showConfirmButton: false
                });
                fetchLeaves();
            } catch (error) {
                Swal.fire({
                    title: 'Error',
                    text: error.response?.data?.message || 'Failed to delete.',
                    icon: 'error'
                });
            }
        }
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData({ ...formData, [name]: type === 'checkbox' ? checked : value });
    };

    const handleReplacementChange = (idx, field, value) => {
        const newReplacements = [...formData.replacements];
        newReplacements[idx][field] = value;
        setFormData({ ...formData, replacements: newReplacements });
    };

    const addReplacement = () => {
        setFormData({
            ...formData,
            replacements: [...formData.replacements, { staff_id: '', periods: '' }]
        });
    };

    const removeReplacement = (idx) => {
        if (formData.replacements.length === 1) return;
        const newReplacements = formData.replacements.filter((_, i) => i !== idx);
        setFormData({ ...formData, replacements: newReplacements });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/leaves', formData);
            Swal.fire({
                title: 'Application Sent',
                text: 'Your leave request has been submitted for approval.',
                icon: 'success',
                confirmButtonColor: '#2563eb'
            });
            fetchLeaves();
            setFormData({
                leave_type: 'CL', from_date: '', to_date: '', days_count: 1,
                is_half_day: false, hours: '', subject: '', reason: '',
                replacements: [{ staff_id: '', periods: '' }]
            });
        } catch (error) {
            Swal.fire({
                title: 'Error',
                text: error.response?.data?.message || 'Submission failed. Please try again.',
                icon: 'error',
                confirmButtonColor: '#2563eb'
            });
        }
    };

    const inputClass = "mt-2 block w-full bg-gray-50 border border-gray-100 rounded-2xl shadow-sm focus:ring-4 focus:ring-sky-100 focus:border-sky-500 p-4 outline-none transition-all font-bold text-gray-700 text-sm";
    const labelClass = "block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1";

    return (
        <Layout>
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-7xl mx-auto"
            >
                <div className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-black text-gray-800 tracking-tight">Leave Management</h1>
                        <p className="text-gray-500 font-medium mt-1">Unified portal for your leave requests and approvals.</p>
                    </div>
                </div>

                {/* Unified Tab Navigation */}
                <div className="flex gap-4 mb-10 overflow-x-auto pb-4 no-scrollbar">
                    {[
                        { id: 'apply', label: 'New Application', icon: <FaCalendarCheck /> },
                        { id: 'balance', label: 'Leave Balance', icon: <FaCalendarAlt /> },
                        { id: 'approvals', label: `Incoming Approvals (${pendingApprovals.length})`, icon: <FaInbox /> },
                        { id: 'history', label: 'My Leave History', icon: <FaHistory /> }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-3 px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shrink-0 ${activeTab === tab.id
                                ? 'bg-sky-600 text-white shadow-xl shadow-sky-100'
                                : 'bg-white text-gray-400 hover:bg-gray-50 border border-gray-100'
                                }`}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>

                <AnimatePresence mode="wait">
                    {activeTab === 'apply' && (
                        <motion.div
                            key="apply-tab"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="modern-card p-10 relative overflow-hidden"
                        >
                            <div className="absolute top-0 left-0 w-full h-2 bg-sky-600"></div>
                            <div className="flex items-center gap-4 mb-10">
                                <div className="h-12 w-12 rounded-2xl bg-sky-50 flex items-center justify-center text-sky-600 shadow-sm border border-sky-100/50">
                                    <FaCalendarCheck size={24} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-gray-800 tracking-tight">Apply for Leave</h2>
                                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Submit your leave request</p>
                                </div>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="group">
                                        <label className={labelClass}>Leave Type</label>
                                        <select name="leave_type" value={formData.leave_type} onChange={handleChange} className={inputClass}>
                                            <option value="CL">Casual Leave (CL)</option>
                                            <option value="ML">Medical Leave (ML)</option>
                                            <option value="OD">On Duty (OD)</option>
                                            <option value="Comp Leave">Compensatory Leave</option>
                                            <option value="LOP">Loss of Pay (LOP)</option>
                                            {customLeaveTypes.map(ct => (
                                                <option key={ct.key} value={ct.label}>{ct.full} ({ct.label})</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="flex items-center pt-8 px-2">
                                        <label className="flex items-center cursor-pointer group">
                                            <div className="relative">
                                                <input
                                                    type="checkbox"
                                                    name="is_half_day"
                                                    checked={formData.is_half_day}
                                                    onChange={handleChange}
                                                    className="sr-only"
                                                />
                                                <div className={`w-14 h-7 rounded-full transition-colors ${formData.is_half_day ? 'bg-sky-600' : 'bg-gray-200'}`}></div>
                                                <div className={`absolute left-1 top-1 bg-white w-5 h-5 rounded-full transition-transform ${formData.is_half_day ? 'translate-x-7' : ''} shadow-sm`}></div>
                                            </div>
                                            <span className="ml-4 text-xs font-black text-gray-700 uppercase tracking-widest">Half-Day</span>
                                        </label>
                                        {formData.is_half_day && (
                                            <motion.div
                                                initial={{ opacity: 0, x: 10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                className="ml-6 flex-1"
                                            >
                                                <input
                                                    name="hours"
                                                    placeholder="Hours (e.g. 4)"
                                                    value={formData.hours}
                                                    onChange={handleChange}
                                                    className={inputClass + " !py-2.5"}
                                                />
                                            </motion.div>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                    <div>
                                        <label className={labelClass}>From Date</label>
                                        <input type="date" name="from_date" value={formData.from_date} onChange={handleChange} required className={inputClass} />
                                    </div>
                                    <div>
                                        <label className={labelClass}>To Date</label>
                                        <input type="date" name="to_date" value={formData.to_date} onChange={handleChange} required className={inputClass} />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Total Days</label>
                                        <input type="number" name="days_count" value={formData.days_count} onChange={handleChange} min="0.5" step="0.5" className={inputClass} />
                                    </div>
                                </div>

                                <div className="bg-sky-50/50 p-8 rounded-[40px] border border-sky-100 relative overflow-hidden">
                                    <div className="flex items-center gap-4 mb-8">
                                        <div className="h-12 w-12 rounded-2xl bg-white flex items-center justify-center text-sky-600 shadow-sm border border-sky-100">
                                            <FaUserFriends size={22} />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-black text-gray-800 tracking-tight">Replacement Staff Matrix</h3>
                                            <p className="text-[10px] font-black text-sky-500 uppercase tracking-widest mt-1">Specify who covers which periods</p>
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        {formData.replacements.map((rep, idx) => (
                                            <motion.div
                                                key={idx}
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end bg-white/50 p-6 rounded-[32px] border border-white group/rep"
                                            >
                                                <div className="md:col-span-6">
                                                    <label className={labelClass}>Colleague</label>
                                                    <div className="mt-2">
                                                        {rep.staff_id ? (() => {
                                                            const member = staffList.find(s => s.emp_id === rep.staff_id);
                                                            return (
                                                                <div className="flex items-center gap-4 bg-white p-3 rounded-2xl border border-sky-50 shadow-sm relative group">
                                                                    <div className="h-12 w-12 rounded-xl overflow-hidden border border-gray-100 shrink-0">
                                                                        <img
                                                                            src={member?.profile_pic || `https://ui-avatars.com/api/?name=${encodeURIComponent(member?.name || 'User')}&background=3b82f6&color=fff&bold=true`}
                                                                            alt=""
                                                                            className="w-full h-full object-cover"
                                                                        />
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="text-sm font-black text-gray-800 tracking-tight truncate">{member?.name || 'Unknown Staff'}</p>
                                                                        <p className="text-[9px] font-black text-sky-500 uppercase tracking-widest truncate">{member?.designation || member?.role || 'Personnel'}</p>
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setActiveReplacementIdx(idx);
                                                                            setIsStaffModalOpen(true);
                                                                        }}
                                                                        className="h-10 px-4 bg-gray-50 text-gray-500 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-sky-600 hover:text-white transition-all border border-gray-100"
                                                                    >
                                                                        Change
                                                                    </button>
                                                                </div>
                                                            );
                                                        })() : (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setActiveReplacementIdx(idx);
                                                                    setIsStaffModalOpen(true);
                                                                }}
                                                                className="w-full h-[74px] border-2 border-dashed border-sky-100 rounded-2xl flex flex-col items-center justify-center gap-1 hover:border-sky-300 hover:bg-sky-50/30 transition-all text-sky-400 group"
                                                            >
                                                                <FaPlusCircle className="group-hover:scale-110 transition-transform" />
                                                                <span className="text-[9px] font-black uppercase tracking-widest">Select Replacement Staff</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="md:col-span-4">
                                                    <label className={labelClass}>Periods / Duties</label>
                                                    <input
                                                        placeholder="e.g. Periods 1, 2, 5"
                                                        value={rep.periods}
                                                        onChange={(e) => handleReplacementChange(idx, 'periods', e.target.value)}
                                                        required
                                                        className={inputClass + " !mt-2 !bg-white border-sky-50"}
                                                    />
                                                </div>
                                                <div className="md:col-span-2 flex justify-end">
                                                    <button
                                                        type="button"
                                                        onClick={() => removeReplacement(idx)}
                                                        className="h-10 w-10 md:h-[74px] md:w-full rounded-2xl bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center border border-rose-100/50 active:scale-90"
                                                        title="Remove Replacement"
                                                    >
                                                        <FaTimes size={14} />
                                                    </button>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>

                                    <button
                                        type="button"
                                        onClick={addReplacement}
                                        className="mt-8 flex items-center gap-3 px-8 py-4 bg-white border border-sky-100 text-sky-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-sky-50 transition-all shadow-sm active:scale-95 mx-auto"
                                    >
                                        <FaPlusCircle className="text-sky-500" />
                                        Add Another Replacement
                                    </button>
                                </div>

                                <div>
                                    <label className={labelClass}>Subject</label>
                                    <input name="subject" value={formData.subject} onChange={handleChange} placeholder="Brief subject of leave request" className={inputClass} required />
                                </div>

                                <div>
                                    <label className={labelClass}>Reason</label>
                                    <textarea name="reason" value={formData.reason} onChange={handleChange} required rows="4" className={inputClass} placeholder="Provide a reason for your leave..."></textarea>
                                </div>

                                {/* Leave Balance Indicator */}
                                {myLimits && (() => {
                                    const keyMap = { CL: 'cl', ML: 'ml', OD: 'od', 'Comp Leave': 'comp', LOP: 'lop' };
                                    const k = keyMap[formData.leave_type];
                                    if (!k) return null;
                                    const limit = myLimits[`${k}_limit`] ?? 0;
                                    const taken = myLimits[`${k}_taken`] ?? 0;
                                    const remaining = Math.max(0, limit - taken);
                                    const isExceeded = taken >= limit;
                                    const isWarning = remaining <= 2 && !isExceeded;
                                    return (
                                        <div className={`p-5 rounded-3xl border flex items-center justify-between ${isExceeded ? 'bg-rose-50 border-rose-200' : isWarning ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-100'}`}>
                                            <div className="flex items-center gap-3">
                                                {isExceeded ? <FaTimesCircle className="text-rose-500" size={18} /> : isWarning ? <FaHourglassHalf className="text-amber-500" size={18} /> : <FaCheckCircle className="text-emerald-500" size={18} />}
                                                <div>
                                                    <p className={`text-xs font-black uppercase tracking-widest ${isExceeded ? 'text-rose-700' : isWarning ? 'text-amber-700' : 'text-emerald-700'}`}>
                                                        {isExceeded ? 'Leave Limit Reached' : isWarning ? 'Low Balance Warning' : 'Leave Balance Available'}
                                                    </p>
                                                    <p className="text-[10px] text-gray-500 font-bold mt-0.5">
                                                        {getLeaveTypeName(formData.leave_type)} · {taken} taken of {limit} days · <span className="font-black">{remaining} days remaining</span>
                                                    </p>
                                                </div>
                                            </div>
                                            {isExceeded && (
                                                <span className="text-[9px] font-black text-rose-600 uppercase tracking-widest bg-rose-100 px-3 py-1.5 rounded-xl">Cannot Apply</span>
                                            )}
                                        </div>
                                    );
                                })()}

                                <button
                                    type="submit"
                                    disabled={myLimits && (() => {
                                        const keyMap = { CL: 'cl', ML: 'ml', OD: 'od', 'Comp Leave': 'comp', LOP: 'lop' };
                                        const k = keyMap[formData.leave_type];
                                        if (!k) return false;
                                        const limit = myLimits[`${k}_limit`] ?? 0;
                                        const taken = myLimits[`${k}_taken`] ?? 0;
                                        return taken >= limit;
                                    })()}
                                    className="w-full bg-sky-600 text-white font-black py-5 rounded-2xl shadow-xl shadow-sky-100 hover:bg-sky-700 transition-all flex items-center justify-center gap-3 uppercase tracking-[0.2em] text-xs active:scale-95 group disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
                                >
                                    <FaPaperPlane className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                                    Apply for Leave
                                </button>
                            </form>
                        </motion.div>
                    )}

                    {activeTab === 'approvals' && (
                        <motion.div
                            key="approvals-tab"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="modern-card !p-0 overflow-hidden"
                        >
                            <div className="bg-sky-50/30 p-8 border-b border-sky-50 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="h-12 w-12 rounded-2xl bg-sky-100 flex items-center justify-center text-sky-600 shadow-sm border border-sky-100">
                                        <FaInbox size={22} className={loading ? 'animate-spin' : ''} />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-black text-gray-800 tracking-tight uppercase">Pending for Me</h2>
                                        <p className="text-[10px] font-black text-sky-500 uppercase tracking-widest mt-1">Action required on these requests</p>
                                    </div>
                                </div>
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
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50/50">
                                            <th className="p-6 w-12 border-b border-sky-50">
                                                <div className="flex justify-center">
                                                    <input
                                                        type="checkbox"
                                                        className="w-4 h-4 rounded border-sky-200 text-sky-600 focus:ring-sky-500 cursor-pointer"
                                                        checked={selectedIds.length === pendingApprovals.length && pendingApprovals.length > 0}
                                                        onChange={toggleSelectAll}
                                                    />
                                                </div>
                                            </th>
                                            <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-sky-50">Employee</th>
                                            <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-sky-50">Details</th>
                                            <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-sky-50">Reason</th>
                                            <th className="p-6 text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-sky-50 text-center">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-sky-50/50">
                                        {pendingApprovals.map((leave) => (
                                            <tr key={leave.id} className={`transition-all group ${selectedIds.includes(leave.id) ? 'bg-sky-50/40' : 'hover:bg-sky-50/20'}`}>
                                                <td className="p-6">
                                                    <div className="flex justify-center">
                                                        <input
                                                            type="checkbox"
                                                            className="w-4 h-4 rounded border-sky-200 text-sky-600 focus:ring-sky-500 cursor-pointer"
                                                            checked={selectedIds.includes(leave.id)}
                                                            onChange={() => toggleSelect(leave.id)}
                                                        />
                                                    </div>
                                                </td>
                                                <td className="p-6">
                                                    <div className="flex items-center gap-4">
                                                        <div className="h-10 w-10 rounded-xl bg-sky-600 flex items-center justify-center text-white font-black text-sm shadow-lg group-hover:scale-110 transition-transform">
                                                            {leave.applicant_name?.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-black text-gray-800 tracking-tight">{leave.applicant_name}</p>
                                                            <p className="text-[9px] font-black text-sky-500 uppercase tracking-widest mt-0.5">{leave.department_name}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-6">
                                                    <div className="space-y-1">
                                                        <span className="inline-block px-2 py-0.5 bg-sky-100 text-sky-600 rounded-md text-[8px] font-black uppercase tracking-widest mb-1">{getLeaveTypeName(leave.leave_type)} • {leave.days_count} Days</span>
                                                        <div className="flex items-center gap-2 text-[9px] font-black text-gray-400 uppercase tracking-widest">
                                                            <FaCalendarCheck className="text-sky-200" />
                                                            {new Date(leave.from_date).toLocaleDateString()}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-6 max-w-xs">
                                                    <p className="text-sm font-black text-gray-800 tracking-tight truncate">{leave.subject || 'Leave Request'}</p>
                                                    <p className="text-[10px] text-gray-400 font-medium line-clamp-1 mt-1 leading-relaxed">{leave.reason}</p>
                                                </td>
                                                <td className="p-6">
                                                    <div className="flex justify-center gap-3">
                                                        <button onClick={() => handleAction(leave.id, 'Approved')} className="h-10 w-10 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-600 hover:text-white transition-all flex items-center justify-center group/btn active:scale-90 shadow-sm" title="Approve">
                                                            <FaCheck />
                                                        </button>
                                                        <button onClick={() => handleAction(leave.id, 'Rejected')} className="h-10 w-10 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-600 hover:text-white transition-all flex items-center justify-center group/btn active:scale-90 shadow-sm" title="Reject">
                                                            <FaTimes />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {pendingApprovals.length === 0 && (
                                            <tr>
                                                <td colSpan="5" className="p-20 text-center opacity-30">
                                                    <FaInbox size={48} className="mx-auto mb-4" />
                                                    <p className="text-lg font-black tracking-tight">All caught up!</p>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'history' && (
                        <motion.div
                            key="history-tab"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                        >
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                {history.length > 0 ? history.map((leave, idx) => (
                                    <motion.div
                                        key={leave.id}
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: idx * 0.05 }}
                                        className="modern-card group p-8 bg-white hover:border-sky-200 transition-all border border-gray-100"
                                    >
                                        <div className="flex justify-between items-start mb-6">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[10px] font-black text-sky-500 uppercase tracking-[0.2em]">{getLeaveTypeName(leave.leave_type)}</span>
                                                <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">{new Date(leave.created_at).toLocaleDateString()}</span>
                                            </div>
                                            <div className={`flex items-center gap-1.5 py-1 px-2.5 rounded-lg border ${leave.status === 'Approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                leave.status === 'Rejected' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                                                    'bg-amber-50 text-amber-600 border-amber-100'
                                                }`}>
                                                {leave.status === 'Approved' ? <FaCheckCircle size={10} /> :
                                                    leave.status === 'Rejected' ? <FaTimesCircle size={10} /> :
                                                        <FaHourglassHalf size={10} className="animate-spin-slow" />}
                                                <span className="text-[9px] font-black uppercase tracking-widest">{leave.status}</span>
                                            </div>
                                            {leave.status === 'Pending' && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDelete(leave.id);
                                                    }}
                                                    className="h-8 w-8 bg-rose-50 text-rose-500 rounded-lg hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center shrink-0 ml-2"
                                                    title="Delete Request"
                                                >
                                                    <FaTimes size={12} />
                                                </button>
                                            )}
                                        </div>

                                        <h4 className="text-lg font-black text-gray-800 tracking-tight group-hover:text-sky-600 transition-colors">{leave.subject || 'Leave Request'}</h4>
                                        <p className="text-xs text-gray-400 font-medium mt-2 line-clamp-2 leading-relaxed">{leave.reason}</p>

                                        <div className="mt-8 pt-6 border-t border-gray-50 flex items-center justify-between">
                                            <div className="flex items-center gap-2 text-[9px] font-black text-gray-400 uppercase tracking-widest">
                                                <FaClock size={10} className="text-sky-300" />
                                                {leave.days_count} days
                                            </div>
                                            <div className="flex items-center gap-2 text-[9px] font-black text-gray-400 uppercase tracking-widest">
                                                <FaCalendarCheck size={10} className="text-sky-200" />
                                                {new Date(leave.from_date).toLocaleDateString()}
                                            </div>
                                        </div>
                                    </motion.div>
                                )) : (
                                    <div className="col-span-full py-20 text-center opacity-20">
                                        <FaHistory size={48} className="mx-auto mb-4" />
                                        <p className="font-bold italic text-sm">No leave history found.</p>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                    {activeTab === 'balance' && (
                        <motion.div
                            key="balance-tab"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                        >
                            <div className="flex justify-between items-center mb-10 bg-white p-6 rounded-[32px] border border-sky-50/50 shadow-sm">
                                <div>
                                    <h2 className="text-xl font-black text-gray-800 tracking-tight">Balance Summary</h2>
                                    <p className="text-[10px] font-black text-sky-500 uppercase tracking-widest mt-1">Quota usage for {limitYear}</p>
                                </div>
                                <select
                                    value={limitYear}
                                    onChange={e => setLimitYear(parseInt(e.target.value))}
                                    className="bg-gray-50 border border-sky-50 rounded-2xl px-5 py-3 font-black text-xs text-gray-700 outline-none focus:ring-4 focus:ring-sky-100 transition-all"
                                >
                                    {[0, 1, 2].map(offset => {
                                        const y = new Date().getFullYear() - 1 + offset;
                                        return <option key={y} value={y}>{y}</option>;
                                    })}
                                </select>
                            </div>

                            {balanceLoading ? (
                                <div className="flex items-center justify-center py-20 gap-3">
                                    <div className="h-2 w-2 bg-sky-600 rounded-full animate-bounce" />
                                    <div className="h-2 w-2 bg-sky-600 rounded-full animate-bounce delay-100" />
                                    <div className="h-2 w-2 bg-sky-600 rounded-full animate-bounce delay-200" />
                                </div>
                            ) : myLimits ? (() => {
                                const LEAVE_TYPES = [
                                    { key: 'cl', label: 'CL', full: 'Casual Leave', color: 'blue', icon: '🏖️' },
                                    { key: 'ml', label: 'ML', full: 'Medical Leave', color: 'rose', icon: '🏥' },
                                    { key: 'od', label: 'OD', full: 'On Duty', color: 'amber', icon: '🏢' },
                                    { key: 'comp', label: 'Comp Leave', full: 'Compensatory Leave', color: 'purple', icon: '⏱️' },
                                    { key: 'lop', label: 'LOP', full: 'Loss of Pay', color: 'gray', icon: '💳' },
                                ];
                                const colorMap = {
                                    blue: { bg: 'bg-sky-50', text: 'text-sky-700', bar: 'bg-sky-500', border: 'border-sky-100' },
                                    rose: { bg: 'bg-rose-50', text: 'text-rose-700', bar: 'bg-rose-500', border: 'border-rose-100' },
                                    amber: { bg: 'bg-amber-50', text: 'text-amber-700', bar: 'bg-amber-500', border: 'border-amber-100' },
                                    purple: { bg: 'bg-purple-50', text: 'text-purple-700', bar: 'bg-purple-500', border: 'border-purple-100' },
                                    gray: { bg: 'bg-gray-50', text: 'text-gray-700', bar: 'bg-gray-400', border: 'border-gray-200' },
                                };
                                return (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                                        {LEAVE_TYPES.map((t, idx) => {
                                            const limit = myLimits[`${t.key}_limit`] ?? 0;
                                            const taken = myLimits[`${t.key}_taken`] ?? 0;
                                            const remaining = Math.max(0, limit - taken);
                                            const pct = limit > 0 ? Math.min(100, Math.round((taken / limit) * 100)) : 0;
                                            const c = colorMap[t.color];
                                            return (
                                                <motion.div
                                                    key={t.key}
                                                    initial={{ opacity: 0, scale: 0.95 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    transition={{ delay: idx * 0.05 }}
                                                    className={`modern-card p-6 border ${c.border} flex flex-col gap-4 relative overflow-hidden`}
                                                >
                                                    <div className="flex justify-between items-start">
                                                        <div className={`h-12 w-12 rounded-2xl ${c.bg} flex items-center justify-center text-xl shadow-sm border ${c.border}`}>{t.icon}</div>
                                                        <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${remaining > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                                            {remaining > 0 ? 'Available' : 'Finished'}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${c.text}`}>{t.label}</p>
                                                        <div className="flex items-end gap-1.5 mt-1">
                                                            <span className="text-3xl font-black text-gray-800 tracking-tighter">{remaining}</span>
                                                            <span className="text-[10px] font-bold text-gray-400 pb-1">/ {limit} d</span>
                                                        </div>
                                                    </div>
                                                    <div className="mt-2">
                                                        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                            <motion.div
                                                                initial={{ width: 0 }}
                                                                animate={{ width: `${pct}%` }}
                                                                className={`h-full ${pct >= 100 ? 'bg-rose-500' : pct >= 75 ? 'bg-amber-500' : c.bar}`}
                                                            />
                                                        </div>
                                                        <div className="flex justify-between mt-2">
                                                            <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">{taken} used</span>
                                                            <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">{pct}%</span>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            );
                                        })}
                                    </div>
                                );
                            })() : (
                                <div className="text-center py-20 opacity-30">
                                    <FaCalendarAlt size={48} className="mx-auto mb-4" />
                                    <p className="font-black">No leave data found for {limitYear}.</p>
                                </div>
                            )}

                            <div className="mt-10 p-5 bg-sky-50/50 rounded-3xl border border-sky-100 flex items-start gap-3">
                                <FaInfoCircle className="text-sky-400 shrink-0 mt-0.5" size={16} />
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-relaxed">
                                    Remaining balance represents your current eligibility. Applications exceeding these limits will be automatically rejected by the system.
                                </p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>

            {/* Staff Availability Full-Screen Overlay */}
            <AnimatePresence>
                {isStaffModalOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="fixed inset-0 z-[100] bg-white overflow-hidden flex flex-col h-screen"
                    >
                        <div className="p-8 md:p-12 border-b border-sky-50 flex flex-col md:flex-row justify-between items-start md:items-center shrink-0 bg-white shadow-sm gap-6">
                            <div>
                                <h2 className="text-3xl font-black text-gray-800 tracking-tight">Browse Personnel</h2>
                                <p className="text-[10px] font-black text-sky-500 uppercase tracking-widest mt-1">Select an available colleague as your replacement</p>
                            </div>
                            <div className="flex items-center gap-6 w-full md:w-auto">
                                <div className="relative group flex-1 md:w-80">
                                    <FaUserFriends className="absolute left-4 top-1/2 -translate-y-1/2 text-sky-300 group-focus-within:text-sky-500 transition-colors" />
                                    <input
                                        type="text"
                                        placeholder="Search name or role..."
                                        className="w-full pl-12 pr-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-sky-50 focus:border-sky-500 transition-all font-bold text-gray-700 text-xs"
                                        value={staffSearch}
                                        onChange={(e) => setStaffSearch(e.target.value)}
                                    />
                                </div>
                                <button
                                    onClick={() => setIsStaffModalOpen(false)}
                                    className="h-14 w-14 shrink-0 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all active:scale-90"
                                >
                                    <FaTimesCircle size={24} />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 md:p-12 custom-scrollbar bg-gray-50/20">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {staffList
                                    .filter(s => s.emp_id !== user.emp_id)
                                    .filter(s =>
                                        s.name.toLowerCase().includes(staffSearch.toLowerCase()) ||
                                        (s.designation || '').toLowerCase().includes(staffSearch.toLowerCase()) ||
                                        (s.department_name || '').toLowerCase().includes(staffSearch.toLowerCase())
                                    )
                                    .map((member, idx) => (
                                        <motion.div
                                            key={member.emp_id}
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ delay: idx * 0.02 }}
                                            onClick={() => {
                                                if (activeReplacementIdx !== null) {
                                                    handleReplacementChange(activeReplacementIdx, 'staff_id', member.emp_id);
                                                } else {
                                                    handleReplacementChange(0, 'staff_id', member.emp_id);
                                                }
                                                setIsStaffModalOpen(false);
                                            }}
                                            className={`flex items-center gap-4 px-6 py-3 rounded-2xl border-[3px] transition-all cursor-pointer group hover:scale-[1.02] active:scale-95 min-h-[70px] ${(activeReplacementIdx !== null ? formData.replacements[activeReplacementIdx]?.staff_id : '') === member.emp_id
                                                ? 'bg-sky-600 border-black shadow-lg'
                                                : 'bg-white border-black hover:bg-gray-50'
                                                }`}
                                        >
                                            <div className="h-10 w-10 rounded-xl overflow-hidden border-2 border-black shrink-0 shadow-sm transition-transform group-hover:rotate-3">
                                                <img
                                                    src={member.profile_pic || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=3b82f6&color=fff&bold=true`}
                                                    alt=""
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2">
                                                    <p className={`text-sm font-black tracking-tight truncate ${(activeReplacementIdx !== null ? formData.replacements[activeReplacementIdx]?.staff_id : '') === member.emp_id ? 'text-white' : 'text-gray-900'}`}>{member.name}</p>
                                                    {conflicts.includes(member.emp_id) && (
                                                        <span className="shrink-0 h-2 w-2 rounded-full bg-rose-500 animate-pulse border border-black/10"></span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <p className={`text-[9px] font-black uppercase tracking-widest truncate ${(activeReplacementIdx !== null ? formData.replacements[activeReplacementIdx]?.staff_id : '') === member.emp_id ? 'text-sky-100' : 'text-sky-600'}`}>{member.designation || member.role}</p>
                                                    <span className={`text-[8px] font-bold ${(activeReplacementIdx !== null ? formData.replacements[activeReplacementIdx]?.staff_id : '') === member.emp_id ? 'text-white/40' : 'text-gray-400'}`}>|</span>
                                                    <p className={`text-[8px] font-bold uppercase tracking-tighter truncate ${(activeReplacementIdx !== null ? formData.replacements[activeReplacementIdx]?.staff_id : '') === member.emp_id ? 'text-sky-200' : 'text-gray-500'}`}>{member.department_name || 'Personnel'}</p>
                                                </div>
                                            </div>

                                            {(activeReplacementIdx !== null ? formData.replacements[activeReplacementIdx]?.staff_id : '') === member.emp_id && (
                                                <div className="shrink-0 h-6 w-6 bg-white rounded-full flex items-center justify-center border-2 border-black">
                                                    <FaCheckCircle className="text-sky-600" size={14} />
                                                </div>
                                            )}
                                        </motion.div>
                                    ))}
                            </div>
                        </div>

                        <div className="p-10 bg-white border-t border-sky-50 flex justify-center shrink-0 shadow-inner">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] flex items-center gap-3">
                                <FaInfoCircle className="text-sky-300" />
                                Members with schedule overlaps are automatically highlighted for caution.
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </Layout>
    );
};

export default LeaveApply;
