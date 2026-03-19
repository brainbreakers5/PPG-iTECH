import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import api from '../../utils/api';
import Swal from 'sweetalert2';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { FaCalculator, FaCheckCircle, FaFilter, FaFileAlt, FaClock, FaMoneyBillWave, FaArrowRight, FaShieldAlt, FaChartLine, FaWallet, FaBullhorn } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';

const SalaryManagement = () => {
    const { user } = useAuth();
    const [salaries, setSalaries] = useState([]);
    const now = new Date();
    const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    const [fromDate, setFromDate] = useState(firstDay);
    const [toDate, setToDate] = useState(lastDay);
    const [loading, setLoading] = useState(true);
    const [isCalculating, setIsCalculating] = useState(false);
    const [activeRole, setActiveRole] = useState('all');
    const [paidStatuses, setPaidStatuses] = useState(['Present', 'CL', 'ML', 'Comp Leave', 'OD', 'Holiday']);
    const socket = useSocket();

    const attendanceOptions = ['Present', 'OD', 'CL', 'ML', 'Comp Leave', 'Holiday', 'Absent', 'LOP'];

    useEffect(() => {
        fetchSalaries();
    }, [fromDate, toDate]);

    useEffect(() => {
        if (!socket) return;
        const handler = () => fetchSalaries();
        socket.on('salary_published', handler);
        return () => socket.off('salary_published', handler);
    }, [socket, fromDate, toDate]);

    const fetchSalaries = async () => {
        setLoading(true);
        try {
            const d = new Date(fromDate);
            const m = d.getMonth() + 1;
            const y = d.getFullYear();
            const { data } = await api.get(`/salary?month=${m}&year=${y}`);
            // Staff, HOD, and Principal should only see their own salary
            if (user.role === 'staff' || user.role === 'hod' || user.role === 'principal') {
                setSalaries(data.filter(s => s.emp_id === user.emp_id));
            } else {
                setSalaries(data);
            }
            setLoading(false);
        } catch (error) {
            console.error(error);
            setLoading(false);
        }
    };

    const handleCalculate = async () => {
        const d = new Date(fromDate);
        const month = d.getMonth() + 1;
        const year = d.getFullYear();

        const result = await Swal.fire({
            title: 'Calculate Salaries?',
            text: `Calculate payroll for: ${String(month).padStart(2, '0')}/${year}. This will process attendance records and calculate net pay.`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#2563eb',
            confirmButtonText: 'Start Calculation',
            cancelButtonColor: '#64748b',
            background: '#fff',
            customClass: {
                popup: 'rounded-[40px]',
                title: 'font-black text-gray-800 tracking-tight'
            }
        });

        if (result.isConfirmed) {
            setIsCalculating(true);
            try {
                await api.post('/salary/calculate', { month, year, paidStatuses });
                Swal.fire({
                    title: 'Calculation Complete',
                    text: 'Payroll has been successfully calculated.',
                    icon: 'success',
                    confirmButtonColor: '#2563eb'
                });
                fetchSalaries();
            } catch (error) {
                Swal.fire({
                    title: 'Calculation Failed',
                    text: 'There was an error calculating salaries.',
                    icon: 'error',
                    confirmButtonColor: '#2563eb'
                });
            } finally {
                setIsCalculating(false);
            }
        }
    };

    const handlePublish = async () => {
        const d = new Date(fromDate);
        const month = d.getMonth() + 1;
        const year = d.getFullYear();
        const pendingCount = salaries.filter(s => s.status === 'Pending').length;

        if (pendingCount === 0) {
            Swal.fire({ title: 'No Pending Salaries', text: 'All salaries have already been published.', icon: 'info', confirmButtonColor: '#2563eb' });
            return;
        }

        const result = await Swal.fire({
            title: 'Publish All Salaries?',
            text: `This will mark ${pendingCount} pending salary records as Paid for ${String(month).padStart(2, '0')}/${year} and notify all employees.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#059669',
            confirmButtonText: 'Publish Now',
            cancelButtonColor: '#64748b',
        });

        if (result.isConfirmed) {
            try {
                const { data } = await api.post('/salary/publish', { month, year });
                Swal.fire({ title: 'Published!', text: `${data.count} salary records have been published to all employees.`, icon: 'success', confirmButtonColor: '#2563eb' });
                fetchSalaries();
            } catch (error) {
                Swal.fire({ title: 'Publish Failed', text: 'There was an error publishing salaries.', icon: 'error', confirmButtonColor: '#2563eb' });
            }
        }
    };

    const handleStatusUpdate = async (id, status) => {
        try {
            await api.put(`/salary/${id}/status`, { status });
            fetchSalaries();
            Swal.fire({
                title: 'Status Updated',
                text: `Salary record has been marked as ${status.toUpperCase()}.`,
                icon: 'success',
                confirmButtonColor: '#2563eb'
            });
        } catch (error) {
            console.error(error);
        }
    };

    const escapeHtml = (value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const handlePrint = () => {
        const items = salaries.filter(s => activeRole === 'all' || s.role === activeRole);
        if (!items || items.length === 0) return;

        const printWindow = window.open('', '_blank', 'width=1200,height=800');
        if (!printWindow) return;

        const title = 'Salary Report';
        const headings = ['#', 'Name', 'Department', 'Role', 'Paid Days', 'LOP', 'Monthly Salary', 'Computed Pay', 'Status'];

        const useLandscape = items.length > 15;

        const rowsHtml = items.map((s, idx) => `
            <tr>
                <td style="text-align:center">${idx + 1}</td>
                <td>${escapeHtml(s.name)}</td>
                <td>${escapeHtml(s.department_name)}</td>
                <td>${escapeHtml(s.role)}</td>
                <td style="text-align:center">${s.total_present ?? 0}</td>
                <td style="text-align:center">${s.total_lop ?? 0}</td>
                <td style="text-align:right">&#8377;${Number(s.monthly_salary ?? 0).toLocaleString()}</td>
                <td style="text-align:right">&#8377;${Number(s.calculated_salary ?? 0).toLocaleString()}</td>
                <td>${escapeHtml(s.status)}</td>
            </tr>
        `).join('');

        const totalGross = items.reduce((acc, s) => acc + parseFloat(s.calculated_salary || 0), 0);
        const totalPaid = items.filter(s => s.status === 'Paid').reduce((acc, s) => acc + parseFloat(s.calculated_salary || 0), 0);
        const totalPending = items.filter(s => s.status === 'Pending').reduce((acc, s) => acc + parseFloat(s.calculated_salary || 0), 0);

        const d = new Date(fromDate);
        const periodLabel = d.toLocaleString('default', { month: 'long', year: 'numeric' });

        printWindow.document.write(`
            <!doctype html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>${escapeHtml(title)}</title>
                <style>
                    @page {
                        size: ${useLandscape ? 'landscape' : 'portrait'};
                        margin: 0.5cm;
                    }
                    * { box-sizing: border-box; }
                    body {
                        font-family: Arial, Helvetica, sans-serif;
                        padding: 12px;
                        color: #111827;
                        margin: 0;
                        font-size: 10pt;
                        position: relative;
                    }
                    h1 {
                        margin: 0 0 6px;
                        font-size: 16pt;
                        font-weight: bold;
                        color: #1e3a8a;
                    }
                    .print-brand {
                        position: absolute;
                        top: 12px;
                        right: 12px;
                        text-align: right;
                    }
                    .print-brand .app-name {
                        font-size: 11pt;
                        font-weight: 800;
                        color: #1e3a8a;
                        margin: 0;
                        letter-spacing: 0.5px;
                    }
                    .print-brand .print-time {
                        font-size: 8pt;
                        color: #6b7280;
                        margin: 2px 0 0;
                    }
                    .meta {
                        margin-bottom: 12px;
                        color: #6b7280;
                        font-size: 9pt;
                        border-bottom: 2px solid #e5e7eb;
                        padding-bottom: 6px;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        table-layout: auto;
                    }
                    th, td {
                        border: 1px solid #9ca3af;
                        padding: 6px 8px;
                        font-size: 9pt;
                        text-align: left;
                        vertical-align: top;
                        word-wrap: break-word;
                        overflow-wrap: break-word;
                    }
                    th {
                        background: #e5e7eb;
                        font-weight: 700;
                        text-transform: uppercase;
                        font-size: 8pt;
                        letter-spacing: 0.3px;
                        color: #374151;
                        position: sticky;
                        top: 0;
                    }
                    tr:nth-child(even) { background: #f9fafb; }
                    tr { page-break-inside: avoid; }
                    thead { display: table-header-group; }
                    .summary {
                        margin-top: 16px;
                        display: flex;
                        gap: 24px;
                        font-size: 10pt;
                        font-weight: 700;
                    }
                    .summary span { color: #6b7280; font-weight: 400; }
                    @media print {
                        body { padding: 0; }
                        table { page-break-after: auto; }
                        tr { page-break-inside: avoid; page-break-after: auto; }
                        thead { display: table-header-group; }
                    }
                </style>
            </head>
            <body>
                <div class="print-brand">
                    <p class="app-name">PPG EMP HUB</p>
                    <p class="print-time">${new Date().toLocaleString('en-GB')}</p>
                </div>
                <h1>${escapeHtml(title)}</h1>
                <div class="meta">
                    Period: ${escapeHtml(periodLabel)}${activeRole !== 'all' ? ` | Role: ${escapeHtml(activeRole.toUpperCase())}` : ''} |
                    Records: ${items.length}
                </div>
                <table>
                    <thead>
                        <tr>
                            ${headings.map(h => `<th>${escapeHtml(h)}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
                <div class="summary">
                    <div><span>Gross Total:</span> &#8377;${totalGross.toLocaleString()}</div>
                    <div><span>Paid:</span> &#8377;${totalPaid.toLocaleString()}</div>
                    <div><span>Pending:</span> &#8377;${totalPending.toLocaleString()}</div>
                </div>
            </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 250);
    };

    return (
        <Layout>
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-7xl mx-auto"
            >
                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-8">
                    <div>
                        <h1 className="text-4xl font-black text-gray-800 tracking-tighter">Salary Management</h1>
                    </div>
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        {user.role === 'admin' && (
                            <button
                                onClick={handlePrint}
                                className="flex-1 md:flex-none bg-white text-gray-500 px-8 py-5 rounded-2xl shadow-xl shadow-sky-50/50 hover:bg-gray-50 transition-all font-black uppercase tracking-[0.2em] text-[10px] flex items-center justify-center border border-sky-50 no-print"
                            >
                                <FaFileAlt className="mr-3 text-sky-400" /> Print
                            </button>
                        )}
                        {user.role === 'admin' && (
                            <button
                                onClick={handleCalculate}
                                disabled={isCalculating}
                                className={`flex-1 md:flex-none bg-sky-600 text-white px-10 py-5 rounded-2xl shadow-xl shadow-sky-200 hover:bg-sky-800 transition-all flex items-center justify-center font-black uppercase tracking-[0.2em] text-[10px] relative overflow-hidden group ${isCalculating ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <motion.div
                                    className="absolute inset-0 bg-white/20 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"
                                    animate={isCalculating ? { x: ["-100%", "100%"] } : {}}
                                    transition={isCalculating ? { repeat: Infinity, duration: 1.5, ease: "linear" } : {}}
                                />
                                <FaCalculator className={`mr-3 ${isCalculating ? 'animate-spin' : 'group-hover:rotate-12 transition-transform'}`} />
                                {isCalculating ? 'Calculating...' : 'Calculate All Salaries'}
                            </button>
                        )}
                        {user.role === 'admin' && salaries.some(s => s.status === 'Pending') && (
                            <button
                                onClick={handlePublish}
                                className="flex-1 md:flex-none bg-emerald-600 text-white px-10 py-5 rounded-2xl shadow-xl shadow-emerald-200 hover:bg-emerald-800 transition-all flex items-center justify-center font-black uppercase tracking-[0.2em] text-[10px] group"
                            >
                                <FaBullhorn className="mr-3 group-hover:scale-125 transition-transform" />
                                Publish All
                            </button>
                        )}
                    </div>
                </div>

                {/* Role Tabs - Only for Admin */}
                {user.role === 'admin' && (
                    <div className="flex flex-wrap gap-4 mb-10 no-print">
                        {[
                            { id: 'all', label: 'All Personnel', icon: <FaChartLine /> },
                            { id: 'principal', label: 'Principal', icon: <FaShieldAlt /> },
                            { id: 'hod', label: 'HODs', icon: <FaShieldAlt /> },
                            { id: 'staff', label: 'Staff members', icon: <FaFileAlt /> }
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveRole(tab.id)}
                                className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] transition-all ${activeRole === tab.id
                                    ? 'bg-sky-600 text-white shadow-xl shadow-sky-200 ring-4 ring-sky-50'
                                    : 'bg-white text-gray-400 hover:bg-gray-50 border border-sky-50'
                                    }`}
                            >
                                <span className={`${activeRole === tab.id ? 'text-white' : 'text-sky-500'}`}>
                                    {tab.icon}
                                </span>
                                {tab.label}
                            </button>
                        ))}
                    </div>
                )}

                {/* Filters & Table Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 mb-12">
                    {/* Period Selector Sidebar */}
                    <div className="lg:col-span-3">
                        <div className="bg-white p-10 rounded-[40px] shadow-xl shadow-sky-50/50 border border-sky-50 sticky top-6">
                            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-8 flex items-center gap-3">
                                <FaFilter className="text-sky-600" /> Select Period
                            </h2>
                            <div className="space-y-8">
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 ml-1">From Date</label>
                                    <input
                                        type="date"
                                        value={fromDate}
                                        onChange={(e) => setFromDate(e.target.value)}
                                        className="w-full p-5 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-sky-100 focus:border-sky-500 transition-all font-black text-gray-700 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 ml-1">To Date</label>
                                    <input
                                        type="date"
                                        value={toDate}
                                        onChange={(e) => setToDate(e.target.value)}
                                        className="w-full p-5 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-sky-100 focus:border-sky-500 transition-all font-black text-gray-700 text-sm"
                                    />
                                </div>
                            </div>

                            {/* Attendance Rules Section */}
                            <div className="mt-12 pt-10 border-t border-gray-100">
                                <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-8 flex items-center gap-3">
                                    <FaCheckCircle className="text-emerald-500" /> Paid Attendance
                                </h2>
                                <div className="grid grid-cols-1 gap-3">
                                    {attendanceOptions.map(status => (
                                        <label
                                            key={status}
                                            className={`flex items-center gap-4 p-4 rounded-2xl transition-all border ${user.role === 'admin' ? 'cursor-pointer' : 'cursor-default opacity-75'} ${paidStatuses.includes(status)
                                                ? 'bg-sky-50 border-sky-100 text-sky-700'
                                                : 'bg-gray-50 border-gray-100 text-gray-400' + (user.role === 'admin' ? ' hover:bg-gray-100' : '')
                                                }`}
                                        >
                                            <input
                                                type="checkbox"
                                                className="hidden"
                                                checked={paidStatuses.includes(status)}
                                                disabled={user.role !== 'admin'}
                                                onChange={(e) => {
                                                    if (user.role !== 'admin') return;
                                                    if (e.target.checked) {
                                                        setPaidStatuses([...paidStatuses, status]);
                                                    } else {
                                                        setPaidStatuses(paidStatuses.filter(s => s !== status));
                                                    }
                                                }}
                                            />
                                            <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${paidStatuses.includes(status)
                                                ? 'bg-sky-600 border-sky-600 text-white'
                                                : 'border-gray-300 bg-white'
                                                }`}>
                                                {paidStatuses.includes(status) && <FaCheckCircle size={10} />}
                                            </div>
                                            <span className="text-[10px] font-black uppercase tracking-widest">{status}</span>
                                        </label>
                                    ))}
                                </div>
                                <p className="text-[9px] font-bold text-gray-400 uppercase mt-6 leading-relaxed bg-amber-50 p-4 rounded-xl border border-amber-100 italic">
                                    {user.role === 'admin'
                                        ? 'Selected statuses will count as 100% paid days.'
                                        : 'Only admin can modify paid attendance rules. View only.'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Master Ledger Table */}
                    <div className="lg:col-span-9">
                        <div className="bg-white rounded-[40px] shadow-2xl shadow-sky-50/50 border border-sky-50 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="bg-gray-50/50 border-b border-gray-100">
                                            <th className="p-8 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 text-left">Employee</th>
                                            <th className="p-8 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 text-center">Attendance</th>
                                            <th className="p-8 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 text-right">Computed Pay</th>
                                            <th className="p-8 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 text-center">Status</th>
                                            <th className="p-8 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50/50">
                                        <AnimatePresence mode="popLayout">
                                            {salaries
                                                .filter(s => activeRole === 'all' || s.role === activeRole)
                                                .map((s, idx) => (
                                                    <motion.tr
                                                        key={s.id}
                                                        initial={{ opacity: 0, x: 20 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        exit={{ opacity: 0, x: -20 }}
                                                        transition={{ delay: idx * 0.03 }}
                                                        className="hover:bg-sky-50/30 transition-all group"
                                                    >
                                                        <td className="p-8">
                                                            <div className="flex items-center gap-5">
                                                                <div className="h-14 w-14 rounded-[20px] bg-gradient-to-br from-sky-50 to-white border border-sky-50 flex items-center justify-center text-sky-600 font-black text-lg shadow-sm group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 overflow-hidden">
                                                                    <img src={s.profile_pic || `https://ui-avatars.com/api/?name=${encodeURIComponent(s.name || '?')}&size=100&background=0ea5e9&color=fff&bold=true`} alt="" className="h-full w-full object-cover" />
                                                                </div>
                                                                <div>
                                                                    <p className="text-sm font-black text-gray-800 tracking-tight group-hover:text-sky-600 transition-colors">{s.name}</p>
                                                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5">{s.department_name}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="p-8">
                                                            <div className="flex flex-col items-center gap-3">
                                                                <div className="flex gap-4 text-[9px] font-black uppercase tracking-widest">
                                                                    <span className="text-sky-500 bg-sky-50 px-2 py-1 rounded-md">PAID DAYS: {s.total_present}</span>
                                                                    <span className="text-rose-500 bg-rose-50 px-2 py-1 rounded-md">LOP: {s.total_lop || 0}</span>
                                                                </div>
                                                                <div className="w-32 bg-gray-100 h-1.5 rounded-full overflow-hidden shadow-inner p-px">
                                                                    <motion.div
                                                                        initial={{ width: 0 }}
                                                                        animate={{ width: `${(s.total_present / 30) * 100}%` }}
                                                                        className="bg-gradient-to-r from-sky-400 to-sky-600 h-full rounded-full shadow-[0_0_12px_rgba(59,130,246,0.3)]"
                                                                    ></motion.div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="p-8 text-right font-black text-gray-800">
                                                            <div className="flex flex-col items-end">
                                                                <span className="text-[9px] text-gray-300 line-through font-bold tracking-widest mb-1">₹{s.monthly_salary}</span>
                                                                <span className="text-lg text-sky-600 tracking-tighter font-black">₹{s.calculated_salary.toLocaleString()}</span>
                                                            </div>
                                                        </td>
                                                        <td className="p-8 text-center">
                                                            <span className={`text-[9px] font-black uppercase px-4 py-2 rounded-2xl tracking-widest border ${s.status === 'Paid'
                                                                ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                                                : 'bg-amber-50 text-amber-600 border-amber-100 animate-pulse'
                                                                }`}>
                                                                {s.status}
                                                            </span>
                                                        </td>
                                                        <td className="p-8 text-right">
                                                            {user.role === 'admin' && s.status === 'Pending' ? (
                                                                <button
                                                                    onClick={() => handleStatusUpdate(s.id, 'Paid')}
                                                                    className="inline-flex items-center gap-3 text-[9px] font-black uppercase tracking-[0.2em] text-white bg-sky-600 px-6 py-3 rounded-2xl hover:bg-sky-800 transition-all shadow-xl shadow-sky-100 group active:scale-95"
                                                                >
                                                                    <FaCheckCircle className="group-hover:scale-125 transition-transform" /> Mark Paid
                                                                </button>
                                                            ) : (
                                                                <button className="h-12 w-12 bg-gray-50 text-gray-400 rounded-2xl flex items-center justify-center hover:bg-sky-50 hover:text-sky-600 transition-all active:scale-90 shadow-sm border border-gray-100">
                                                                    <FaFileAlt size={16} title="View Detailed Breakdown" />
                                                                </button>
                                                            )}
                                                        </td>
                                                    </motion.tr>
                                                ))}
                                        </AnimatePresence>
                                        {salaries.filter(s => activeRole === 'all' || s.role === activeRole).length === 0 && !loading && (
                                            <tr>
                                                <td colSpan="5" className="p-32 text-center">
                                                    <div className="flex flex-col items-center gap-6 text-gray-300">
                                                        <div className="h-24 w-24 rounded-[40px] bg-gray-50 flex items-center justify-center border border-gray-100">
                                                            <FaMoneyBillWave size={40} className="opacity-20 translate-y-2" />
                                                        </div>
                                                        <div>
                                                            <p className="font-black text-gray-400 uppercase tracking-[0.3em] text-xs">No Records Found</p>
                                                            <p className="text-[10px] font-bold text-gray-400 mt-2 italic">No salary data available for this role.</p>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Analytical Matrix */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-10 pb-16">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-white p-10 rounded-[40px] shadow-2xl shadow-sky-50/50 border-t-8 border-sky-600 relative group overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 w-48 h-48 bg-sky-50 rounded-full -mr-24 -mt-24 opacity-30 group-hover:scale-125 transition-transform duration-700"></div>
                        <div className="flex items-center justify-between mb-12 relative z-10">
                            <div>
                                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Gross Total</h3>
                                <p className="text-[10px] font-bold text-sky-500 mt-2 uppercase tracking-widest flex items-center gap-2">
                                    <FaChartLine size={10} /> Total Salary
                                </p>
                            </div>
                            <div className="h-14 w-14 rounded-2xl bg-sky-600 flex items-center justify-center text-white shadow-xl shadow-sky-200 group-hover:rotate-6 transition-transform">
                                <FaMoneyBillWave size={22} />
                            </div>
                        </div>
                        <h3 className="text-4xl font-black text-gray-800 tracking-tighter relative z-10">
                            ₹{salaries
                                .filter(s => activeRole === 'all' || s.role === activeRole)
                                .reduce((acc, curr) => acc + parseFloat(curr.calculated_salary), 0).toLocaleString()}
                        </h3>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="bg-white p-10 rounded-[40px] shadow-2xl shadow-sky-50/50 border-t-8 border-emerald-500 relative group overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-50 rounded-full -mr-24 -mt-24 opacity-30 group-hover:scale-125 transition-transform duration-700"></div>
                        <div className="flex items-center justify-between mb-12 relative z-10">
                            <div>
                                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Paid Amount</h3>
                                <p className="text-[10px] font-bold text-emerald-500 mt-2 uppercase tracking-widest flex items-center gap-2">
                                    <FaCheckCircle size={10} /> Paid
                                </p>
                            </div>
                            <div className="h-14 w-14 rounded-2xl bg-emerald-500 flex items-center justify-center text-white shadow-xl shadow-emerald-100 group-hover:rotate-6 transition-transform">
                                <FaWallet size={22} />
                            </div>
                        </div>
                        <h3 className="text-4xl font-black text-gray-800 tracking-tighter relative z-10">
                            ₹{salaries
                                .filter(s => (activeRole === 'all' || s.role === activeRole) && s.status === 'Paid')
                                .reduce((acc, curr) => acc + parseFloat(curr.calculated_salary), 0).toLocaleString()}
                        </h3>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="bg-white p-10 rounded-[40px] shadow-2xl shadow-sky-50/50 border-t-8 border-amber-400 relative group overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 w-48 h-48 bg-amber-50 rounded-full -mr-24 -mt-24 opacity-30 group-hover:scale-125 transition-transform duration-700"></div>
                        <div className="flex items-center justify-between mb-12 relative z-10">
                            <div>
                                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Pending Amount</h3>
                                <p className="text-[10px] font-bold text-amber-500 mt-2 uppercase tracking-widest flex items-center gap-2">
                                    <FaClock size={10} /> Unpaid
                                </p>
                            </div>
                            <div className="h-14 w-14 rounded-2xl bg-amber-400 flex items-center justify-center text-white shadow-xl shadow-amber-100 group-hover:rotate-6 transition-transform">
                                <FaShieldAlt size={22} />
                            </div>
                        </div>
                        <h3 className="text-4xl font-black text-gray-800 tracking-tighter relative z-10">
                            ₹{salaries
                                .filter(s => (activeRole === 'all' || s.role === activeRole) && s.status === 'Pending')
                                .reduce((acc, curr) => acc + parseFloat(curr.calculated_salary), 0).toLocaleString()}
                        </h3>
                    </motion.div>
                </div>
            </motion.div>
        </Layout>
    );
};

export default SalaryManagement;
