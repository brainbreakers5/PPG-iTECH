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
    const [unpaidStatuses, setUnpaidStatuses] = useState(['Absent', 'LOP']);
    const [newStatus, setNewStatus] = useState('');
    const [isAddingPaid, setIsAddingPaid] = useState(true);
    const socket = useSocket();

    const handleAddStatus = (isPaid) => {
        if (!newStatus.trim()) return;
        const status = newStatus.trim();
        if (isPaid) {
            if (!paidStatuses.includes(status)) setPaidStatuses([...paidStatuses, status]);
        } else {
            if (!unpaidStatuses.includes(status)) setUnpaidStatuses([...unpaidStatuses, status]);
        }
        setNewStatus('');
    };

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
        const items = salaries.filter(s => activeRole === 'all' || (s.role || '').toLowerCase() === activeRole.toLowerCase());
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
                    <p class="print-time">${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</p>
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

    const handlePrintSlip = (s) => {
        const printWindow = window.open('', '_blank', 'width=800,height=600');
        if (!printWindow) return;

        const d = new Date(fromDate);
        const periodLabel = d.toLocaleString('default', { month: 'long', year: 'numeric' });

        printWindow.document.write(`
            <!doctype html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Salary Slip - ${escapeHtml(s.name)}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 40px; color: #333; line-height: 1.6; }
                    .header { text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; }
                    .header h1 { margin: 0; color: #1e3a8a; font-size: 24px; }
                    .header p { margin: 5px 0; color: #64748b; font-size: 14px; }
                    .slip-title { text-align: center; font-size: 18px; font-weight: bold; margin-bottom: 30px; text-decoration: underline; }
                    .grid { display: grid; grid-template-cols: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
                    .box { border: 1px solid #e2e8f0; padding: 15px; rounded: 8px; }
                    .label { font-weight: bold; color: #64748b; font-size: 12px; text-transform: uppercase; }
                    .value { font-size: 16px; font-weight: bold; margin-top: 5px; }
                    .table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    .table th, .table td { border: 1px solid #e2e8f0; padding: 12px; text-align: left; }
                    .table th { background: #f8fafc; color: #64748b; font-size: 12px; }
                    .total-row { background: #f1f5f9; font-weight: bold; }
                    .footer { margin-top: 50px; display: flex; justify-content: space-between; }
                    .sig { border-top: 1px solid #333; width: 200px; text-align: center; padding-top: 10px; font-size: 12px; }
                    @media print { body { padding: 0; } .no-print { display: none; } }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>PPG EDUCATION INSTITUTIONS</h1>
                    <p>Salary Management System - Pay Slip</p>
                </div>
                
                <div class="slip-title">SALARY SLIP FOR ${escapeHtml(periodLabel).toUpperCase()}</div>

                <div class="grid">
                    <div class="box">
                        <div class="label">Employee Name</div>
                        <div class="value">${escapeHtml(s.name)}</div>
                        <div class="label" style="margin-top:10px">Employee ID</div>
                        <div class="value">${escapeHtml(s.emp_id)}</div>
                    </div>
                    <div class="box">
                        <div class="label">Department</div>
                        <div class="value">${escapeHtml(s.department_name || 'N/A')}</div>
                        <div class="label" style="margin-top:10px">Designation</div>
                        <div class="value">${escapeHtml(s.role)}</div>
                    </div>
                </div>

                <table class="table">
                    <thead>
                        <tr>
                            <th>Description</th>
                            <th style="text-align:right">Details</th>
                            <th style="text-align:right">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Basic Monthly Salary</td>
                            <td style="text-align:right">-</td>
                            <td style="text-align:right">₹${Number(s.monthly_salary).toLocaleString()}</td>
                        </tr>
                        <tr>
                            <td>Attendance Details</td>
                            <td style="text-align:right">Paid Days: ${s.total_present} / ${new Date(s.year, s.month, 0).getDate()}</td>
                            <td style="text-align:right">-</td>
                        </tr>
                        <tr>
                            <td>Loss of Pay (LOP) Deduction</td>
                            <td style="text-align:right">${s.total_lop || 0} Days</td>
                            <td style="text-align:right; color:#e11d48">- ₹${(Number(s.monthly_salary) - Number(s.calculated_salary)).toLocaleString()}</td>
                        </tr>
                        <tr class="total-row">
                            <td colspan="2" style="text-align:right">NET PAYABLE AMOUNT</td>
                            <td style="text-align:right">₹${Number(s.calculated_salary).toLocaleString()}</td>
                        </tr>
                    </tbody>
                </table>

                <div class="footer">
                    <div class="sig">Employee Signature</div>
                    <div class="sig">Authorized Signatory</div>
                </div>

                <div style="text-align:center; margin-top:40px; font-size:10px; color:#94a3b8;" class="no-print">
                    Generated on ${new Date().toLocaleString()}
                </div>
            </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 500);
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

                {/* Period Selection (Moved to Top) */}
                <div className="bg-white p-8 rounded-[32px] shadow-xl shadow-sky-50/50 border border-sky-50 mb-10 no-print">
                    <div className="flex flex-col lg:flex-row gap-8 items-start lg:items-center">
                        <div className="flex flex-wrap items-center gap-6">
                            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-3">
                                <FaFilter className="text-sky-600" /> Select Period
                            </h2>
                            <div className="flex items-center gap-4">
                                <input
                                    type="date"
                                    value={fromDate}
                                    onChange={(e) => setFromDate(e.target.value)}
                                    className="p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-4 focus:ring-sky-100 focus:border-sky-500 transition-all font-black text-gray-700 text-[10px] uppercase shadow-inner"
                                />
                                <span className="text-gray-300 font-bold">to</span>
                                <input
                                    type="date"
                                    value={toDate}
                                    onChange={(e) => setToDate(e.target.value)}
                                    className="p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-4 focus:ring-sky-100 focus:border-sky-500 transition-all font-black text-gray-700 text-[10px] uppercase shadow-inner"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Role Tabs - Only for Admin */}
                {user.role === 'admin' && (
                    <div className="flex flex-wrap gap-4 mb-6 no-print">
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

                {/* Analytical Matrix (Now below Role Tabs) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10 no-print">
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        className="bg-white p-6 rounded-3xl shadow-lg shadow-sky-50/50 border border-sky-50 relative group overflow-hidden"
                    >
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="h-10 w-10 rounded-xl bg-sky-600 flex items-center justify-center text-white shadow-lg shadow-sky-100">
                                    <FaMoneyBillWave size={16} />
                                </div>
                                <div>
                                    <h3 className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Gross Total</h3>
                                    <p className="text-lg font-black text-gray-800 tracking-tighter">
                                        ₹{salaries
                                            .filter(s => activeRole === 'all' || (s.role || '').toLowerCase() === activeRole.toLowerCase())
                                            .reduce((acc, curr) => acc + Number(curr.calculated_salary || 0), 0)
                                            .toLocaleString()}
                                    </p>
                                </div>
                            </div>
                            <div className="text-[9px] font-bold text-sky-500 uppercase tracking-widest opacity-40 group-hover:opacity-100 transition-opacity">Total Salary</div>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        className="bg-white p-6 rounded-3xl shadow-lg shadow-sky-50/50 border border-sky-50 relative group overflow-hidden"
                    >
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="h-10 w-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-100">
                                    <FaWallet size={16} />
                                </div>
                                <div>
                                    <h3 className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Paid Amount</h3>
                                    <p className="text-lg font-black text-gray-800 tracking-tighter">
                                        ₹{salaries
                                            .filter(s => (activeRole === 'all' || (s.role || '').toLowerCase() === activeRole.toLowerCase()) && s.status === 'Paid')
                                            .reduce((acc, curr) => acc + parseFloat(curr.calculated_salary), 0).toLocaleString()}
                                    </p>
                                </div>
                            </div>
                            <div className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest opacity-40 group-hover:opacity-100 transition-opacity">Paid</div>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        className="bg-white p-6 rounded-3xl shadow-lg shadow-sky-50/50 border border-sky-50 relative group overflow-hidden"
                    >
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="h-10 w-10 rounded-xl bg-amber-400 flex items-center justify-center text-white shadow-lg shadow-amber-100">
                                    <FaClock size={16} />
                                </div>
                                <div>
                                    <h3 className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Pending Amount</h3>
                                    <p className="text-lg font-black text-gray-800 tracking-tighter">
                                        ₹{salaries
                                            .filter(s => (activeRole === 'all' || (s.role || '').toLowerCase() === activeRole.toLowerCase()) && s.status === 'Pending')
                                            .reduce((acc, curr) => acc + parseFloat(curr.calculated_salary), 0).toLocaleString()}
                                    </p>
                                </div>
                            </div>
                            <div className="text-[9px] font-bold text-amber-500 uppercase tracking-widest opacity-40 group-hover:opacity-100 transition-opacity">Unpaid</div>
                        </div>
                    </motion.div>
                </div>

                {/* Attendance Rules (Modified Concept) */}
                <div className="bg-white p-8 rounded-[32px] shadow-xl shadow-sky-50/50 border border-sky-50 mb-10 no-print">
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-10 gap-6">
                        <div>
                            <h2 className="text-xl font-black text-gray-800 tracking-tight">Attendance Configuration</h2>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Configure Payable vs Deduction statuses</p>
                        </div>
                        {user.role === 'admin' && (
                            <div className="flex items-center gap-3 bg-gray-50 p-2 rounded-2xl border border-gray-100">
                                <input 
                                    type="text" 
                                    placeholder="Add Custom Type..." 
                                    className="bg-transparent border-none outline-none px-4 py-2 text-[10px] font-black uppercase tracking-wider w-40"
                                    value={newStatus}
                                    onChange={(e) => setNewStatus(e.target.value)}
                                />
                                <div className="flex gap-1">
                                    <button 
                                        onClick={() => handleAddStatus(true)}
                                        className="bg-emerald-500 text-white p-2 rounded-xl border border-emerald-400 hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-100"
                                        title="Add to With Pay"
                                    >
                                        <FaCheckCircle size={14} />
                                    </button>
                                    <button 
                                        onClick={() => handleAddStatus(false)}
                                        className="bg-rose-500 text-white p-2 rounded-xl border border-rose-400 hover:bg-rose-600 transition-all shadow-lg shadow-rose-100"
                                        title="Add to Without Pay"
                                    >
                                        <FaClock size={14} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        {/* With Pay Section */}
                        <div className="bg-emerald-50/30 p-6 rounded-3xl border border-emerald-100">
                            <h3 className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                                <div className="h-6 w-6 bg-emerald-500 rounded-lg flex items-center justify-center text-white">1</div>
                                With Pay (Payable)
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {paidStatuses.map(status => (
                                    <div 
                                        key={status} 
                                        className="bg-white px-4 py-2 rounded-xl border border-emerald-100 text-[10px] font-black uppercase text-emerald-700 flex items-center gap-2 group shadow-sm"
                                    >
                                        <FaCheckCircle className="text-emerald-400" />
                                        {status}
                                        {user.role === 'admin' && (
                                            <button 
                                                onClick={() => setPaidStatuses(paidStatuses.filter(s => s !== status))}
                                                className="ml-2 text-emerald-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                                            >
                                                ×
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Without Pay Section */}
                        <div className="bg-rose-50/30 p-6 rounded-3xl border border-rose-100">
                            <h3 className="text-[10px] font-black text-rose-600 uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                                <div className="h-6 w-6 bg-rose-500 rounded-lg flex items-center justify-center text-white">2</div>
                                Without Pay (Deduction/LOP)
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {unpaidStatuses.map(status => (
                                    <div 
                                        key={status} 
                                        className="bg-white px-4 py-2 rounded-xl border border-rose-100 text-[10px] font-black uppercase text-rose-700 flex items-center gap-2 group shadow-sm"
                                    >
                                        <FaClock className="text-rose-400" />
                                        {status}
                                        {user.role === 'admin' && (
                                            <button 
                                                onClick={() => setUnpaidStatuses(unpaidStatuses.filter(s => s !== status))}
                                                className="ml-2 text-rose-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                                            >
                                                ×
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Table Section */}
                <div className="mb-12">
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
                                            .filter(s => activeRole === 'all' || (s.role || '').toLowerCase() === activeRole.toLowerCase())
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
                                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5">{s.department_name || 'N/A'}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-8">
                                                        <div className="flex flex-col items-center gap-3">
                                                            <div className="flex gap-4 text-[9px] font-black uppercase tracking-widest">
                                                                <span className="text-sky-500 bg-sky-50 px-2 py-1 rounded-md" title="Total Payable Days">PAID: {s.total_present}</span>
                                                                <span className="text-gray-400 bg-gray-50 px-2 py-1 rounded-md" title="Total Days in Month">MONTH: {new Date(s.year, s.month, 0).getDate()}</span>
                                                                <span className="text-rose-500 bg-rose-50 px-2 py-1 rounded-md" title="Loss of Pay Days">LOP: {s.total_lop || 0}</span>
                                                            </div>
                                                            <div className="w-40 bg-gray-100 h-1.5 rounded-full overflow-hidden shadow-inner p-px">
                                                                <motion.div
                                                                    initial={{ width: 0 }}
                                                                    animate={{ width: `${(s.total_present / new Date(s.year, s.month, 0).getDate()) * 100}%` }}
                                                                    className="bg-gradient-to-r from-sky-400 to-sky-600 h-full rounded-full shadow-[0_0_12px_rgba(59,130,246,0.3)]"
                                                                ></motion.div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-8 text-right font-black text-gray-800">
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-[9px] text-gray-300 line-through font-bold tracking-widest mb-1">₹{Number(s.monthly_salary || 0).toLocaleString()}</span>
                                                            <span className="text-lg text-sky-600 tracking-tighter font-black">₹{Number(s.calculated_salary || 0).toLocaleString()}</span>
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
                                                    <td className="p-8 text-right flex justify-end gap-2">
                                                        <button
                                                            onClick={() => handlePrintSlip(s)}
                                                            className="h-12 w-12 bg-sky-50 text-sky-600 rounded-2xl flex items-center justify-center hover:bg-sky-100 transition-all active:scale-90 shadow-sm border border-sky-100"
                                                            title="Print Salary Slip"
                                                        >
                                                            <FaFileAlt size={16} />
                                                        </button>
                                                        {user.role === 'admin' && s.status === 'Pending' && (
                                                            <button
                                                                onClick={() => handleStatusUpdate(s.id, 'Paid')}
                                                                className="inline-flex items-center gap-3 text-[9px] font-black uppercase tracking-[0.2em] text-white bg-emerald-600 px-6 py-3 rounded-2xl hover:bg-emerald-800 transition-all shadow-xl shadow-emerald-50 active:scale-95"
                                                            >
                                                                <FaCheckCircle /> Pay
                                                            </button>
                                                        )}
                                                    </td>
                                                </motion.tr>
                                            ))}
                                    </AnimatePresence>
                                    {salaries.filter(s => activeRole === 'all' || (s.role || '').toLowerCase() === activeRole.toLowerCase()).length === 0 && !loading && (
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
            </motion.div>
        </Layout>
    );
};

export default SalaryManagement;
