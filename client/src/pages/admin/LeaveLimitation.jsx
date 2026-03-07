import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import api from '../../utils/api';
import Swal from 'sweetalert2';
import {
    FaEdit, FaSearch, FaCalendarAlt, FaCheckCircle,
    FaUserTie, FaBuilding, FaSave, FaTimes, FaClipboardList, FaPlus, FaTrash
} from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';

const LEAVE_TYPES = [
    { key: 'cl', label: 'CL', full: 'Casual Leave', color: 'blue' },
    { key: 'ml', label: 'ML', full: 'Medical Leave', color: 'rose' },
    { key: 'od', label: 'OD', full: 'On Duty', color: 'amber' },
    { key: 'comp', label: 'Comp Leave', full: 'Compensatory Leave', color: 'purple' },
    { key: 'lop', label: 'LOP', full: 'Loss of Pay', color: 'gray' },
];

const colorMap = {
    blue: { bg: 'bg-sky-50', text: 'text-sky-600', bar: 'bg-sky-500', border: 'border-sky-100' },
    rose: { bg: 'bg-rose-50', text: 'text-rose-600', bar: 'bg-rose-500', border: 'border-rose-100' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-600', bar: 'bg-amber-500', border: 'border-amber-100' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-600', bar: 'bg-purple-500', border: 'border-purple-100' },
    gray: { bg: 'bg-gray-50', text: 'text-gray-600', bar: 'bg-gray-400', border: 'border-gray-100' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', bar: 'bg-emerald-500', border: 'border-emerald-100' },
    indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', bar: 'bg-indigo-500', border: 'border-indigo-100' },
};

const LeaveLimitation = () => {
    const [staffData, setStaffData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [editingId, setEditingId] = useState(null);  // emp_id being edited
    const [editValues, setEditValues] = useState({});
    const [fromMonth, setFromMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM format
    const [toMonth, setToMonth] = useState(new Date().toISOString().slice(0, 7));
    const [customLeaveTypes, setCustomLeaveTypes] = useState([]);
    const [showAddLeaveType, setShowAddLeaveType] = useState(false);

    useEffect(() => {
        fetchLimits();
        loadCustomLeaveTypes();
    }, [fromMonth, toMonth]);

    const loadCustomLeaveTypes = () => {
        const saved = localStorage.getItem('customLeaveTypes');
        if (saved) {
            setCustomLeaveTypes(JSON.parse(saved));
        }
    };

    const saveCustomLeaveTypes = (types) => {
        localStorage.setItem('customLeaveTypes', JSON.stringify(types));
        setCustomLeaveTypes(types);
    };

    const fetchLimits = async () => {
        setLoading(true);
        try {
            const year = new Date(fromMonth).getFullYear();
            const { data } = await api.get(`/leave-limits?year=${year}`);
            
            // Filter data based on month range if additional date fields exist
            // For now, we show all data for the selected year
            // This can be enhanced when month-specific leave records are available
            setStaffData(data);
        } catch (error) {
            console.error('Failed to fetch limits', error);
        } finally {
            setLoading(false);
        }
    };

    const startEdit = (emp) => {
        setEditingId(emp.emp_id);
        setEditValues({
            cl_limit: emp.cl_limit ?? 12,
            ml_limit: emp.ml_limit ?? 12,
            od_limit: emp.od_limit ?? 10,
            comp_limit: emp.comp_limit ?? 6,
            lop_limit: emp.lop_limit ?? 30,
        });
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditValues({});
    };

    const saveEdit = async (emp_id) => {
        try {
            const year = new Date(fromMonth).getFullYear();
            await api.put(`/leave-limits/${emp_id}`, { year, ...editValues });
            Swal.fire({
                title: 'Limits Updated!',
                text: 'Leave limits have been saved successfully.',
                icon: 'success',
                timer: 1500,
                showConfirmButton: false,
            });
            setEditingId(null);
            fetchLimits();
        } catch (error) {
            Swal.fire({ title: 'Error', text: error.response?.data?.message || 'Failed to save.', icon: 'error' });
        }
    };

    const handleAddLeaveType = async () => {
        const { value: formValues } = await Swal.fire({
            title: 'Add Custom Leave Type',
            html: `
                <div style="display:grid; gap:16px; text-align:left; padding:10px;">
                    <div>
                        <label style="font-size:12px; font-weight:900; color:#6b7280; text-transform:uppercase; letter-spacing:0.1em; display:block; margin-bottom:8px;">Leave Type Name</label>
                        <input id="leave_name" type="text" placeholder="e.g., Paternity Leave" 
                            style="width:100%; padding:10px 14px; border:2px solid #e5e7eb; border-radius:12px; font-weight:600; font-size:14px; outline:none;">
                    </div>
                    <div>
                        <label style="font-size:12px; font-weight:900; color:#6b7280; text-transform:uppercase; letter-spacing:0.1em; display:block; margin-bottom:8px;">Short Code</label>
                        <input id="leave_code" type="text" placeholder="e.g., PL" maxlength="10"
                            style="width:100%; padding:10px 14px; border:2px solid #e5e7eb; border-radius:12px; font-weight:600; font-size:14px; outline:none;">
                    </div>
                    <div>
                        <label style="font-size:12px; font-weight:900; color:#6b7280; text-transform:uppercase; letter-spacing:0.1em; display:block; margin-bottom:8px;">Default Days</label>
                        <input id="leave_days" type="number" min="0" max="365" value="10"
                            style="width:100%; padding:10px 14px; border:2px solid #e5e7eb; border-radius:12px; font-weight:600; font-size:14px; outline:none;">
                    </div>
                    <div>
                        <label style="font-size:12px; font-weight:900; color:#6b7280; text-transform:uppercase; letter-spacing:0.1em; display:block; margin-bottom:8px;">Color</label>
                        <select id="leave_color" style="width:100%; padding:10px 14px; border:2px solid #e5e7eb; border-radius:12px; font-weight:600; font-size:14px; outline:none;">
                            <option value="blue">Blue</option>
                            <option value="rose">Rose</option>
                            <option value="amber">Amber</option>
                            <option value="purple">Purple</option>
                            <option value="gray">Gray</option>
                            <option value="emerald">Emerald</option>
                            <option value="indigo">Indigo</option>
                        </select>
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonColor: '#2563eb',
            confirmButtonText: 'Add Leave Type',
            focusConfirm: false,
            preConfirm: () => {
                const name = document.getElementById('leave_name')?.value;
                const code = document.getElementById('leave_code')?.value;
                const days = document.getElementById('leave_days')?.value;
                const color = document.getElementById('leave_color')?.value;
                
                if (!name || !code) {
                    Swal.showValidationMessage('Please fill in all required fields');
                    return false;
                }
                
                return { name, code, days: parseInt(days), color };
            }
        });

        if (formValues) {
            const newType = {
                key: formValues.code.toLowerCase().replace(/\s+/g, '_'),
                label: formValues.code.toUpperCase(),
                full: formValues.name,
                color: formValues.color,
                defaultDays: formValues.days,
                custom: true
            };
            
            const updatedTypes = [...customLeaveTypes, newType];
            saveCustomLeaveTypes(updatedTypes);
            
            Swal.fire({ 
                title: 'Success!', 
                text: 'Custom leave type added successfully.', 
                icon: 'success',
                confirmButtonColor: '#2563eb' 
            });
        }
    };

    const handleEditLeaveType = async (leaveType) => {
        const { value: formValues } = await Swal.fire({
            title: 'Edit Leave Type',
            html: `
                <div style="display:grid; gap:16px; text-align:left; padding:10px;">
                    <div>
                        <label style="font-size:12px; font-weight:900; color:#6b7280; text-transform:uppercase; letter-spacing:0.1em; display:block; margin-bottom:8px;">Leave Type Name</label>
                        <input id="leave_name" type="text" value="${leaveType.full}" 
                            style="width:100%; padding:10px 14px; border:2px solid #e5e7eb; border-radius:12px; font-weight:600; font-size:14px; outline:none;">
                    </div>
                    <div>
                        <label style="font-size:12px; font-weight:900; color:#6b7280; text-transform:uppercase; letter-spacing:0.1em; display:block; margin-bottom:8px;">Short Code</label>
                        <input id="leave_code" type="text" value="${leaveType.label}" maxlength="10"
                            style="width:100%; padding:10px 14px; border:2px solid #e5e7eb; border-radius:12px; font-weight:600; font-size:14px; outline:none;">
                    </div>
                    <div>
                        <label style="font-size:12px; font-weight:900; color:#6b7280; text-transform:uppercase; letter-spacing:0.1em; display:block; margin-bottom:8px;">Default Days</label>
                        <input id="leave_days" type="number" min="0" max="365" value="${leaveType.defaultDays}"
                            style="width:100%; padding:10px 14px; border:2px solid #e5e7eb; border-radius:12px; font-weight:600; font-size:14px; outline:none;">
                    </div>
                    <div>
                        <label style="font-size:12px; font-weight:900; color:#6b7280; text-transform:uppercase; letter-spacing:0.1em; display:block; margin-bottom:8px;">Color</label>
                        <select id="leave_color" style="width:100%; padding:10px 14px; border:2px solid #e5e7eb; border-radius:12px; font-weight:600; font-size:14px; outline:none;">
                            <option value="blue" ${leaveType.color === 'blue' ? 'selected' : ''}>Blue</option>
                            <option value="rose" ${leaveType.color === 'rose' ? 'selected' : ''}>Rose</option>
                            <option value="amber" ${leaveType.color === 'amber' ? 'selected' : ''}>Amber</option>
                            <option value="purple" ${leaveType.color === 'purple' ? 'selected' : ''}>Purple</option>
                            <option value="gray" ${leaveType.color === 'gray' ? 'selected' : ''}>Gray</option>
                            <option value="emerald" ${leaveType.color === 'emerald' ? 'selected' : ''}>Emerald</option>
                            <option value="indigo" ${leaveType.color === 'indigo' ? 'selected' : ''}>Indigo</option>
                        </select>
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonColor: '#2563eb',
            confirmButtonText: 'Update Leave Type',
            focusConfirm: false,
            preConfirm: () => {
                const name = document.getElementById('leave_name')?.value;
                const code = document.getElementById('leave_code')?.value;
                const days = document.getElementById('leave_days')?.value;
                const color = document.getElementById('leave_color')?.value;
                
                if (!name || !code) {
                    Swal.showValidationMessage('Please fill in all required fields');
                    return false;
                }
                
                return { name, code, days: parseInt(days), color };
            }
        });

        if (formValues) {
            const updatedType = {
                key: formValues.code.toLowerCase().replace(/\s+/g, '_'),
                label: formValues.code.toUpperCase(),
                full: formValues.name,
                color: formValues.color,
                defaultDays: formValues.days,
                custom: true
            };
            
            const updatedTypes = customLeaveTypes.map(t => 
                t.key === leaveType.key ? updatedType : t
            );
            saveCustomLeaveTypes(updatedTypes);
            
            Swal.fire({ 
                title: 'Success!', 
                text: 'Leave type updated successfully.', 
                icon: 'success',
                confirmButtonColor: '#2563eb' 
            });
        }
    };

    const handleDeleteLeaveType = async (leaveType) => {
        const result = await Swal.fire({
            title: 'Delete Leave Type?',
            text: `Are you sure you want to delete "${leaveType.full}"? This action cannot be undone.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'Yes, Delete',
            cancelButtonText: 'Cancel'
        });

        if (result.isConfirmed) {
            const updatedTypes = customLeaveTypes.filter(t => t.key !== leaveType.key);
            saveCustomLeaveTypes(updatedTypes);
            
            Swal.fire({ 
                title: 'Deleted!', 
                text: 'Leave type has been removed.', 
                icon: 'success',
                confirmButtonColor: '#2563eb' 
            });
        }
    };

    const handleBulkSet = async () => {
        const allTypes = [...LEAVE_TYPES, ...customLeaveTypes];
        const { value: formValues } = await Swal.fire({
            title: 'Set Default Limits for All Staff',
            html: `
                <div style="display:grid; gap:16px; text-align:left; padding:10px 0;">
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; padding:12px; background:#f8fafc; border-radius:12px; margin-bottom:8px;">
                        <div>
                            <label style="font-size:11px; font-weight:900; color:#64748b; text-transform:uppercase; letter-spacing:0.1em; display:block; margin-bottom:6px;">From Month</label>
                            <input id="bulk_from_month" type="month" value="${fromMonth}" 
                                style="width:100%; padding:8px 12px; border:2px solid #e5e7eb; border-radius:10px; font-weight:600; font-size:13px; outline:none;">
                        </div>
                        <div>
                            <label style="font-size:11px; font-weight:900; color:#64748b; text-transform:uppercase; letter-spacing:0.1em; display:block; margin-bottom:6px;">To Month</label>
                            <input id="bulk_to_month" type="month" value="${toMonth}" 
                                style="width:100%; padding:8px 12px; border:2px solid #e5e7eb; border-radius:10px; font-weight:600; font-size:13px; outline:none;">
                        </div>
                    </div>
                    <div style="border-top:2px solid #e5e7eb; padding-top:12px;">
                        ${allTypes.map(t => `
                            <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:10px;">
                                <label style="font-size:12px; font-weight:900; color:#6b7280; text-transform:uppercase; letter-spacing:0.1em; flex:1;">${t.full} (${t.label})</label>
                                <input id="bulk_${t.key}" type="number" min="0" max="365" value="${t.defaultDays || (t.key === 'lop' ? 30 : t.key === 'comp' ? 6 : t.key === 'od' ? 10 : 12)}"
                                    style="width:80px; padding:8px 12px; border:2px solid #e5e7eb; border-radius:12px; font-weight:700; font-size:14px; text-align:center; outline:none;">
                            </div>
                        `).join('')}
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonColor: '#2563eb',
            confirmButtonText: 'Apply to All',
            focusConfirm: false,
            width: '550px',
            preConfirm: () => {
                const values = {};
                allTypes.forEach(t => {
                    values[`${t.key}_limit`] = parseInt(document.getElementById(`bulk_${t.key}`)?.value) || 12;
                });
                values.fromMonth = document.getElementById('bulk_from_month')?.value;
                values.toMonth = document.getElementById('bulk_to_month')?.value;
                return values;
            }
        });

        if (formValues) {
            try {
                const year = new Date(formValues.fromMonth || fromMonth).getFullYear();
                Swal.fire({ title: 'Applying...', didOpen: () => Swal.showLoading() });
                await Promise.all(
                    staffData.map(emp => api.put(`/leave-limits/${emp.emp_id}`, { year, ...formValues }))
                );
                Swal.fire({ title: 'Done!', text: 'Limits updated for all staff.', icon: 'success', confirmButtonColor: '#2563eb' });
                fetchLimits();
            } catch {
                Swal.fire({ title: 'Error', text: 'Some updates failed.', icon: 'error' });
            }
        }
    };

    const filtered = staffData.filter(emp =>
        emp.name?.toLowerCase().includes(search.toLowerCase()) ||
        emp.department_name?.toLowerCase().includes(search.toLowerCase()) ||
        emp.designation?.toLowerCase().includes(search.toLowerCase())
    );

    const inputClass = "w-16 text-center border-2 border-gray-100 rounded-xl p-2 font-black text-sm focus:border-sky-500 focus:ring-4 focus:ring-sky-50 outline-none transition-all";

    return (
        <Layout>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
                    <div>
                        <h1 className="text-3xl font-black text-gray-800 tracking-tight">Leave Balances</h1>
                        <p className="text-gray-500 font-medium mt-1">Set per-employee leave limits and manage leave types.</p>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 w-full">
                        <div className="flex items-center gap-3">
                            {/* Month Range Selector */}
                            <div className="flex items-center gap-2 bg-white border border-sky-100 rounded-2xl px-4 py-2 shadow-lg shadow-sky-50/50">
                                <span className="text-xs font-black text-gray-500 uppercase tracking-widest">From</span>
                                <input
                                    type="month"
                                    value={fromMonth}
                                    onChange={e => setFromMonth(e.target.value)}
                                    className="bg-transparent font-black text-sm text-gray-700 outline-none"
                                />
                                <span className="text-gray-300">→</span>
                                <span className="text-xs font-black text-gray-500 uppercase tracking-widest">To</span>
                                <input
                                    type="month"
                                    value={toMonth}
                                    onChange={e => setToMonth(e.target.value)}
                                    className="bg-transparent font-black text-sm text-gray-700 outline-none"
                                />
                            </div>
                            
                            <button
                                onClick={handleAddLeaveType}
                                className="bg-purple-600 text-white px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-purple-100 hover:bg-purple-700 transition-all flex items-center gap-2 active:scale-95"
                            >
                                <FaPlus size={14} /> Add Leave Type
                            </button>
                        </div>
                        
                        {/* Bulk Set Button - Right Corner */}
                        <button
                            onClick={handleBulkSet}
                            className="bg-sky-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-sky-100 hover:bg-sky-700 transition-all flex items-center gap-2 active:scale-95"
                        >
                            <FaClipboardList size={14} /> Bulk Set
                        </button>
                    </div>
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-3 mb-8">
                    {LEAVE_TYPES.map(t => {
                        const c = colorMap[t.color];
                        return (
                            <div key={t.key} className={`flex items-center gap-2 px-4 py-2 ${c.bg} ${c.border} border rounded-2xl`}>
                                <div className={`h-2 w-2 rounded-full ${c.bar}`} />
                                <span className={`text-[10px] font-black uppercase tracking-widest ${c.text}`}>{t.full}</span>
                            </div>
                        );
                    })}
                    {customLeaveTypes.map(t => {
                        const c = colorMap[t.color] || colorMap.blue;
                        return (
                            <div key={t.key} className={`flex items-center gap-2 px-4 py-2 ${c.bg} ${c.border} border rounded-2xl relative`}>
                                <div className={`h-2 w-2 rounded-full ${c.bar}`} />
                                <span className={`text-[10px] font-black uppercase tracking-widest ${c.text}`}>{t.full}</span>
                                <div className="flex items-center gap-1 ml-2">
                                    <button
                                        onClick={() => handleEditLeaveType(t)}
                                        className="text-gray-400 hover:text-blue-600 transition-colors"
                                        title="Edit"
                                    >
                                        <FaEdit size={10} />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteLeaveType(t)}
                                        className="text-gray-400 hover:text-rose-600 transition-colors"
                                        title="Delete"
                                    >
                                        <FaTrash size={10} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Search */}
                <div className="relative mb-6 group">
                    <FaSearch className="absolute left-5 top-1/2 -translate-y-1/2 text-sky-300 group-focus-within:text-sky-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="Search by name, department, or designation..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-14 pr-6 py-4 bg-white border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-sky-100 focus:border-sky-500 transition-all font-bold text-gray-700 text-sm shadow-lg shadow-sky-50/30"
                    />
                </div>

                {/* Table Card */}
                <div className="modern-card !p-0 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left">
                            <thead>
                                <tr className="bg-sky-50/50 border-b border-sky-100">
                                    <th className="p-5 text-[10px] font-black text-gray-400 uppercase tracking-widest min-w-[220px]">Employee</th>
                                    {LEAVE_TYPES.map(t => (
                                        <th key={t.key} className="p-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center min-w-[120px]">
                                            {t.label}
                                            <div className="text-[8px] text-gray-300 normal-case font-bold tracking-normal mt-0.5">{t.full}</div>
                                        </th>
                                    ))}
                                    <th className="p-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center w-28">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-sky-50/80">
                                {loading ? (
                                    <tr>
                                        <td colSpan="7" className="p-16 text-center">
                                            <div className="flex items-center justify-center gap-3">
                                                <div className="h-2 w-2 bg-sky-600 rounded-full animate-bounce" />
                                                <div className="h-2 w-2 bg-sky-600 rounded-full animate-bounce delay-100" />
                                                <div className="h-2 w-2 bg-sky-600 rounded-full animate-bounce delay-200" />
                                            </div>
                                        </td>
                                    </tr>
                                ) : filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" className="p-16 text-center opacity-30">
                                            <FaUserTie size={40} className="mx-auto mb-3" />
                                            <p className="font-black text-sm">No staff found</p>
                                        </td>
                                    </tr>
                                ) : filtered.map((emp, idx) => {
                                    const isEditing = editingId === emp.emp_id;
                                    return (
                                        <motion.tr
                                            key={emp.emp_id}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ delay: idx * 0.02 }}
                                            className={`group transition-all ${isEditing ? 'bg-sky-50/40' : 'hover:bg-gray-50/50'}`}
                                        >
                                            {/* Employee Info */}
                                            <td className="p-5">
                                                <div>
                                                    <p className="text-sm font-black text-gray-800 tracking-tight">{emp.name}</p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-[9px] font-black text-sky-500 uppercase tracking-widest">{emp.designation || emp.role}</span>
                                                        {emp.department_name && (
                                                            <>
                                                                <span className="text-gray-200">•</span>
                                                                <span className="text-[9px] font-bold text-gray-400">{emp.department_name}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Leave Type Cells */}
                                            {LEAVE_TYPES.map(t => {
                                                const limitKey = `${t.key}_limit`;
                                                const takenKey = `${t.key}_taken`;
                                                const limit = isEditing ? editValues[limitKey] : (emp[limitKey] ?? '-');
                                                const taken = emp[takenKey] ?? 0;
                                                const pct = limit > 0 ? Math.min(100, Math.round((taken / limit) * 100)) : 0;
                                                const c = colorMap[t.color];
                                                const isOver = taken >= limit && limit > 0;

                                                return (
                                                    <td key={t.key} className="p-4 text-center">
                                                        {isEditing ? (
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                max="365"
                                                                value={editValues[limitKey] ?? ''}
                                                                onChange={e => setEditValues(prev => ({ ...prev, [limitKey]: parseInt(e.target.value) || 0 }))}
                                                                className={inputClass}
                                                            />
                                                        ) : (
                                                            <div className="flex flex-col items-center gap-2">
                                                                <div className="flex items-center gap-1">
                                                                    <span className={`text-sm font-black ${isOver ? 'text-rose-600' : 'text-gray-800'}`}>{taken}</span>
                                                                    <span className="text-gray-300 text-xs">/</span>
                                                                    <span className={`text-sm font-black ${c.text}`}>{limit}</span>
                                                                </div>
                                                                <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                                    <div
                                                                        className={`h-full rounded-full transition-all ${isOver ? 'bg-rose-500' : c.bar}`}
                                                                        style={{ width: `${pct}%` }}
                                                                    />
                                                                </div>
                                                                <span className={`text-[8px] font-black uppercase tracking-widest ${isOver ? 'text-rose-400' : 'text-gray-300'}`}>
                                                                    {isOver ? 'Exceeded' : `${pct}%`}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </td>
                                                );
                                            })}

                                            {/* Actions */}
                                            <td className="p-4 text-center">
                                                {isEditing ? (
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button
                                                            onClick={() => saveEdit(emp.emp_id)}
                                                            className="h-9 w-9 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-600 hover:text-white transition-all flex items-center justify-center active:scale-90"
                                                            title="Save"
                                                        >
                                                            <FaSave size={13} />
                                                        </button>
                                                        <button
                                                            onClick={cancelEdit}
                                                            className="h-9 w-9 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center active:scale-90"
                                                            title="Cancel"
                                                        >
                                                            <FaTimes size={13} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => startEdit(emp)}
                                                        className="h-9 w-9 bg-sky-50 text-sky-500 rounded-xl hover:bg-sky-600 hover:text-white transition-all flex items-center justify-center mx-auto opacity-0 group-hover:opacity-100 active:scale-90"
                                                        title="Edit Limits"
                                                    >
                                                        <FaEdit size={13} />
                                                    </button>
                                                )}
                                            </td>
                                        </motion.tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.3em] text-center mt-6">
                    {fromMonth} to {toMonth} · Leave Management · {filtered.length} employee{filtered.length !== 1 ? 's' : ''}
                </p>
            </motion.div>
        </Layout>
    );
};

export default LeaveLimitation;
