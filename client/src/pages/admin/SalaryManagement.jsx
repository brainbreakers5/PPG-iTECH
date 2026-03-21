import { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/Layout';
import api from '../../utils/api';
import Swal from 'sweetalert2';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { FaCalculator, FaCheckCircle, FaTimesCircle, FaFilter, FaFileAlt, FaClock, FaMoneyBillWave, FaArrowRight, FaShieldAlt, FaChartLine, FaWallet, FaBullhorn, FaCheckSquare, FaSquare } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';

const SalaryManagement = () => {
    const { user } = useAuth();
    const [salaries, setSalaries] = useState([]);
    const [allEmployees, setAllEmployees] = useState([]);
    const [dailyBreakdown, setDailyBreakdown] = useState(null);
    const [loadingBreakdown, setLoadingBreakdown] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]); // for bulk mark paid
    const now = new Date();
    const socket = useSocket();

    // Fetch all employees
    useEffect(() => {
        const isAdmin = user.role === 'admin' || user.role === 'management';
        if (isAdmin) {
            api.get('/employees').then(res => setAllEmployees(res.data)).catch(e => console.error(e));
        }
    }, [user.role]);

    const getDefaultDates = () => {
        const d = new Date();
        const year = d.getFullYear();
        const month = d.getMonth(); // 0-indexed

        // FROM: 26th of past month
        let pastMonth = month; // 0-indexed
        let pastYear = year;
        if (pastMonth === 0) {
            pastMonth = 12; // 1-indexed Dec
            pastYear--;
        }
        const fromDateStr = `${pastYear}-${String(pastMonth).padStart(2, '0')}-26`;

        // TO: 25th of current month
        const toDateStr = `${year}-${String(month + 1).padStart(2, '0')}-25`;

        return { from: fromDateStr, to: toDateStr };
    };

    const { from: defaultFrom, to: defaultTo } = getDefaultDates();
    const [fromDate, setFromDate] = useState(defaultFrom);
    const [toDate, setToDate] = useState(defaultTo);
    const [loading, setLoading] = useState(true);
    const [isCalculating, setIsCalculating] = useState(false);
    const [isHistoryMode, setIsHistoryMode] = useState(false);
    const [activeRole, setActiveRole] = useState('all');
    const [paidStatuses, setPaidStatuses] = useState(() => {
        const saved = localStorage.getItem('salary_paid_statuses');
        return saved ? JSON.parse(saved) : ['Present', 'CL', 'ML', 'Comp Leave', 'OD', 'Holiday'];
    });
    const [unpaidStatuses, setUnpaidStatuses] = useState(() => {
        const saved = localStorage.getItem('salary_unpaid_statuses');
        return saved ? JSON.parse(saved) : ['Absent', 'LOP'];
    });
    const [newStatus, setNewStatus] = useState('');

    const saveAttendanceConfig = () => {
        localStorage.setItem('salary_paid_statuses', JSON.stringify(paidStatuses));
        localStorage.setItem('salary_unpaid_statuses', JSON.stringify(unpaidStatuses));
        Swal.fire({
            title: 'Settings Saved',
            text: 'Attendance configuration has been updated and saved.',
            icon: 'success',
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000
        });
        // Trigger re-calculation if needed    
    };

    useEffect(() => {
        const d = new Date(toDate); // Month is defined by the end date
        const month = d.getMonth() + 1;
        const year = d.getFullYear();
        
        // Auto-calculate on period change, config change, or attendance updates
        const silentCalculate = async () => {
            if (user.role !== 'admin' && user.role !== 'management') return; 
            try {
                // Send explicit range to handle cases like single day or custom windows
                await api.post('/salary/calculate', { 
                    month, 
                    year, 
                    paidStatuses,
                    unpaidStatuses,
                    fromDate,
                    toDate
                });
                fetchSalaries();
            } catch (error) {
                fetchSalaries();
            }
        };

        const timer = setTimeout(silentCalculate, 800);
        
        // Sockets for sudden updates on punch
        if (socket) {
            socket.on('attendance_updated', silentCalculate);
            socket.on('punch_in', silentCalculate);
            socket.on('punch_out', silentCalculate);
        }

        return () => {
            clearTimeout(timer);
            if (socket) {
                socket.off('attendance_updated', silentCalculate);
                socket.off('punch_in', silentCalculate);
                socket.off('punch_out', silentCalculate);
            }
        };
    }, [fromDate, toDate, paidStatuses, unpaidStatuses, user.role, socket]);

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
        if (!socket) return;
        const handler = () => fetchSalaries();
        socket.on('salary_published', handler);
        socket.on('salary_calculated', handler); // Also refresh on background calc
        return () => {
            socket.off('salary_published', handler);
            socket.off('salary_calculated', handler);
        };
    }, [socket, fromDate, toDate]);

    // Fetch daily breakdown for a specific employee
    const fetchDailyBreakdown = async (emp) => {
        setLoadingBreakdown(true);
        setDailyBreakdown({ emp, data: null });
        try {
            const { data } = await api.get(`/salary/daily`, {
                params: {
                    emp_id: emp.emp_id,
                    fromDate,
                    toDate,
                    paidStatuses: JSON.stringify(paidStatuses)
                }
            });
            setDailyBreakdown({ emp, data });
        } catch (err) {
            console.error('Daily breakdown fetch failed:', err);
            setDailyBreakdown({ emp, data: null });
        } finally {
            setLoadingBreakdown(false);
        }
    };

    const fetchSalaries = async () => {
        setLoading(true);
        try {
            const d = new Date(toDate); // Target month is defined by the end date
            const m = d.getMonth() + 1;
            const y = d.getFullYear();
            const { data } = await api.get(`/salary?month=${m}&year=${y}&fromDate=${fromDate}&toDate=${toDate}`);
            
            const isAdmin = user.role === 'admin' || user.role === 'management';
            if (!isAdmin) {
                setSalaries(data.filter(s => s.emp_id === user.emp_id));
            } else {
                setSalaries(data);
            }
            setLoading(false);
        } catch (error) {
            console.error("Fetch Salaries Error:", error);
            setLoading(false);
        }
    };

    const getMergedSalaries = () => {
        const isAdmin = user.role === 'admin' || user.role === 'management';
        if (!isAdmin) return salaries;

        const dForContext = new Date(toDate); // Uses toDate to ensure arrays align
        const currentM = dForContext.getMonth() + 1;
        const currentY = dForContext.getFullYear();

        return allEmployees.map(emp => {
            const calc = salaries.find(s => s.emp_id === emp.emp_id);
            // Use the salary record's monthly_salary first (it's joined fresh from users table in /salary API)
            // Then fallback to allEmployees monthly_salary (now also included after backend fix)
            const grossPay = parseFloat(calc?.monthly_salary) || parseFloat(emp.monthly_salary) || parseFloat(emp.base_salary) || 0;

            if (calc) {
                return {
                    ...calc,
                    monthly_salary: grossPay
                };
            }
            return {
                ...emp,
                id: `temp_${emp.emp_id}`,
                monthly_salary: grossPay,
                calculated_salary: 0,
                total_present: 0,
                total_lop: 0,
                status: 'Uncalculated',
                month: currentM,
                year: currentY
            };
        });
    };

    const handlePublishAndPay = async () => {
        const d = new Date(fromDate);
        const month = d.getMonth() + 1;
        const year = d.getFullYear();

        const result = await Swal.fire({
            title: 'Publish & Pay All?',
            text: `This will calculate the final amounts for ${String(month).padStart(2, '0')}/${year} and publish the salary slips to all employees.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#0ea5e9',
            confirmButtonText: 'Proceed',
            cancelButtonColor: '#64748b',
        });

        if (result.isConfirmed) {
            setIsCalculating(true);
            try {
                // Step 1: Calculate
                console.log("Starting calculation for:", month, year);
                await api.post('/salary/calculate', { month, year, paidStatuses, unpaidStatuses, fromDate, toDate });
                
                // Step 2: Publish
                console.log("Starting publish for:", month, year);
                const { data } = await api.post('/salary/publish', { month, year });
                
                Swal.fire({
                    title: 'Action Successful',
                    text: `${data.count} salary slips have been published and marked as PAID.`,
                    icon: 'success',
                    confirmButtonColor: '#0ea5e9',
                    customClass: {
                        popup: 'rounded-[32px]',
                        container: 'z-[10000]'
                    }
                });
                fetchSalaries();
            } catch (error) {
                console.error("Publish & Pay Failed:", error.response?.data || error.message);
                Swal.fire({
                    title: 'Action Failed',
                    text: error.response?.data?.message || 'There was an error during the publish & pay process. Please ensure all data is calculated correctly.',
                    icon: 'error',
                    confirmButtonColor: '#e11d48',
                    customClass: {
                        popup: 'rounded-[32px]',
                        container: 'z-[10000]'
                    }
                });
            } finally {
                setIsCalculating(false);
            }
        }
    };

    // ─── Bulk Mark Paid ─────────────────────────────────────────────────
    const handleBulkMarkPaid = async () => {
        const unpaidSelected = getMergedSalaries().filter(
            s => selectedIds.includes(s.id) && s.status !== 'Paid'
        );
        if (unpaidSelected.length === 0) {
            return Swal.fire('Nothing to pay', 'All selected employees are already marked as Paid.', 'info');
        }
        const result = await Swal.fire({
            title: `Mark ${unpaidSelected.length} Employee(s) as Paid?`,
            text: `Period: ${fromDate} – ${toDate}`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#10b981',
            confirmButtonText: `Yes, Mark All Paid`,
            cancelButtonColor: '#64748b',
            customClass: { popup: 'rounded-[32px]', container: 'z-[10000]' }
        });
        if (!result.isConfirmed) return;
        try {
            for (const s of unpaidSelected) {
                await api.put(`/salary/${s.id}/status`, { status: 'Paid' });
                await api.post('/salary/notify-paid', {
                    emp_id: s.emp_id, name: s.name, email: s.email,
                    fromDate, toDate, amount: s.calculated_salary
                });
            }
            setSelectedIds([]);
            fetchSalaries();
            Swal.fire({ title: 'All Paid!', text: `${unpaidSelected.length} employees marked as Paid.`, icon: 'success', timer: 2000, showConfirmButton: false, customClass: { popup: 'rounded-[32px]', container: 'z-[10000]' } });
        } catch (err) {
            console.error(err);
            Swal.fire('Error', 'Some payments could not be processed.', 'error');
        }
    };

    const toggleSelectId = (id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    const toggleSelectAll = () => {
        const visible = getMergedSalaries().filter(s => {
            const roleMatch = activeRole === 'all' || (s.role||'').toLowerCase() === activeRole.toLowerCase();
            return roleMatch && s.status !== 'Paid';
        });
        if (selectedIds.length === visible.length) setSelectedIds([]);
        else setSelectedIds(visible.map(s => s.id));
    };

    const handleMarkPaid = async (s) => {
        const result = await Swal.fire({
            title: `Mark ${s.name} as Paid?`,
            text: `This will mark the salary for ${fromDate} – ${toDate} as Paid and notify the employee via email.`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#10b981',
            confirmButtonText: 'Yes, Mark Paid',
            cancelButtonColor: '#64748b',
            customClass: { popup: 'rounded-[32px]', container: 'z-[10000]' }
        });
        if (!result.isConfirmed) return;
        try {
            await api.put(`/salary/${s.id}/status`, { status: 'Paid' });
            // Send email notification to employee
            await api.post('/salary/notify-paid', {
                emp_id: s.emp_id,
                name: s.name,
                email: s.email,
                fromDate,
                toDate,
                amount: s.calculated_salary
            });
            fetchSalaries();
            Swal.fire({
                title: 'Marked as Paid',
                text: `${s.name}'s salary has been marked as Paid and a notification email has been sent.`,
                icon: 'success',
                timer: 2500,
                showConfirmButton: false,
                customClass: { popup: 'rounded-[32px]', container: 'z-[10000]' }
            });
        } catch (error) {
            console.error('Mark Paid Error:', error);
            Swal.fire('Error', error.response?.data?.message || 'Failed to mark as paid.', 'error');
        }
    };

    const handleMarkUnpaid = async (s) => {
        const result = await Swal.fire({
            title: `Revert to Unpaid?`,
            text: `This will revert ${s.name}'s salary for this period back to a pending state.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#f59e0b',
            confirmButtonText: 'Yes, Revert'
        });
        if (!result.isConfirmed) return;
        try {
            await api.put(`/salary/${s.id}/status`, { status: 'Pending' });
            fetchSalaries();
        } catch (error) {
            Swal.fire('Error', 'Failed to revert status.', 'error');
        }
    };

    const handleStatusUpdate = async (id, status) => {
        try {
            await api.put(`/salary/${id}/status`, { status });
            fetchSalaries();
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
                        <h1 className="text-4xl font-black text-gray-800 tracking-tighter">
                            {isHistoryMode ? 'Salary History' : 'Salary Management'}
                        </h1>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-2">
                            {isHistoryMode ? 'Viewing published payroll records' : 'Manage employee payroll & attendance rules'}
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
                        <button
                            onClick={() => setIsHistoryMode(!isHistoryMode)}
                            className={`flex-1 md:flex-none px-8 py-5 rounded-2xl shadow-xl transition-all font-black uppercase tracking-[0.2em] text-[10px] flex items-center justify-center border no-print ${
                                isHistoryMode 
                                ? 'bg-amber-500 text-white border-amber-400 shadow-amber-100' 
                                : 'bg-white text-gray-500 border-sky-50 shadow-sky-50/50 hover:bg-gray-50'
                            }`}
                        >
                            <FaClock className={`mr-3 ${isHistoryMode ? 'text-white' : 'text-amber-400'}`} /> 
                            {isHistoryMode ? 'Live Management' : 'Salary History'}
                        </button>
                        {user.role === 'admin' && !isHistoryMode && (
                            <button
                                onClick={handlePrint}
                                className="flex-1 md:flex-none bg-white text-gray-500 px-8 py-5 rounded-2xl shadow-xl shadow-sky-50/50 hover:bg-gray-50 transition-all font-black uppercase tracking-[0.2em] text-[10px] flex items-center justify-center border border-sky-50 no-print"
                            >
                                <FaFileAlt className="mr-3 text-sky-400" /> Print
                            </button>
                        )}
                    </div>
                </div>

                {/* Role Tabs and Period Selection Combined */}
                <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-6 mb-10 no-print">
                    {/* Role Selection (Cards Style) */}
                    <div className="flex flex-wrap gap-3">
                        {user.role === 'admin' && [
                            { id: 'all', label: 'All Personnel', icon: <FaChartLine /> },
                            { id: 'principal', label: 'Principal', icon: <FaShieldAlt /> },
                            { id: 'hod', label: 'HODs', icon: <FaShieldAlt /> },
                            { id: 'staff', label: 'Staff members', icon: <FaFileAlt /> }
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveRole(tab.id)}
                                className={`flex items-center gap-3 px-6 py-4 rounded-2xl font-black uppercase tracking-[0.15em] text-[10px] transition-all border ${activeRole === tab.id
                                    ? 'bg-sky-600 text-white shadow-xl shadow-sky-200 border-sky-500 scale-105 z-10'
                                    : 'bg-white text-gray-400 hover:bg-gray-50 border-sky-50 shadow-sm'
                                    }`}
                            >
                                <span className={`${activeRole === tab.id ? 'text-white' : 'text-sky-500'}`}>
                                    {tab.icon}
                                </span>
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Period Select (Right Corner) */}
                    <div className="bg-white p-4 lg:p-2 rounded-[24px] shadow-lg shadow-sky-50/50 border border-sky-50 flex items-center gap-4">
                        <div className="h-10 w-10 rounded-[18px] bg-sky-50 flex items-center justify-center text-sky-600">
                            <FaFilter size={14} />
                        </div>
                        <div className="flex items-center gap-2 pr-4">
                            <input
                                type="date"
                                value={fromDate}
                                onChange={(e) => setFromDate(e.target.value)}
                                className="p-2.5 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-4 focus:ring-sky-100 focus:border-sky-500 transition-all font-black text-gray-700 text-[10px] uppercase shadow-inner"
                            />
                            <span className="text-gray-300 font-bold px-1">/</span>
                            <input
                                type="date"
                                value={toDate}
                                onChange={(e) => setToDate(e.target.value)}
                                className="p-2.5 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-4 focus:ring-sky-100 focus:border-sky-500 transition-all font-black text-gray-700 text-[10px] uppercase shadow-inner"
                            />
                        </div>
                    </div>
                </div>

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
                                        ₹{getMergedSalaries()
                                            .filter(s => activeRole === 'all' || (s.role || '').toLowerCase() === activeRole.toLowerCase())
                                            .reduce((acc, curr) => acc + Number(curr.monthly_salary || 0), 0)
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
                                        ₹{getMergedSalaries()
                                            .filter(s => (activeRole === 'all' || (s.role || '').toLowerCase() === activeRole.toLowerCase()) && s.status === 'Paid')
                                            .reduce((acc, curr) => acc + parseFloat(curr.calculated_salary || 0), 0).toLocaleString()}
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
                                        ₹{getMergedSalaries()
                                            .filter(s => (activeRole === 'all' || (s.role || '').toLowerCase() === activeRole.toLowerCase()) && (s.status === 'Pending' || s.status === 'Uncalculated'))
                                            .reduce((acc, curr) => acc + parseFloat(curr.calculated_salary || 0), 0).toLocaleString()}
                                    </p>
                                </div>
                            </div>
                            <div className="text-[9px] font-bold text-amber-500 uppercase tracking-widest opacity-40 group-hover:opacity-100 transition-opacity">Unpaid</div>
                        </div>
                    </motion.div>
                </div>

                {/* Attendance Rules (Row-wise Layout) */}
                <div className="bg-white p-8 rounded-[32px] shadow-xl shadow-sky-50/50 border border-sky-50 mb-10 no-print">
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-6">
                        <div className="flex items-center gap-6">
                            <div className="hidden lg:block">
                                <h2 className="text-xl font-black text-gray-800 tracking-tight">Attendance Configuration</h2>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Configure Payable vs Deduction statuses · Row-wise</p>
                            </div>
                            {user.role === 'admin' && (
                                <button
                                    onClick={saveAttendanceConfig}
                                    className="bg-sky-600 text-white px-6 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-sky-700 transition-all shadow-lg shadow-sky-100 flex items-center gap-2 no-print"
                                >
                                    <FaCheckCircle size={10} /> Save Configuration
                                </button>
                            )}
                        </div>
                        {user.role === 'admin' && (
                            <div className="flex items-center gap-3 bg-gray-50 p-2 rounded-2xl border border-gray-100 shadow-inner">
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
                                        <FaTimesCircle size={14} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ROW-WISE: With Pay on top, Without Pay below */}
                    <div className="flex flex-col gap-6">
                        {/* Row 1 – With Pay (Payable) */}
                        <div className="bg-emerald-50/30 p-5 rounded-3xl border border-emerald-100">
                            <h3 className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-4 flex items-center gap-3">
                                <div className="h-6 w-6 bg-emerald-500 rounded-lg flex items-center justify-center text-white text-xs">✓</div>
                                With Pay (Payable)
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {paidStatuses.map(status => (
                                    <div key={status} className="bg-white px-4 py-2 rounded-xl border border-emerald-100 text-[10px] font-black uppercase text-emerald-700 flex items-center gap-2 group shadow-sm">
                                        <FaCheckCircle className="text-emerald-400" size={10} />
                                        {status}
                                        {user.role === 'admin' && (
                                            <button onClick={() => setPaidStatuses(paidStatuses.filter(s => s !== status))} className="ml-1 text-emerald-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100">×</button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Row 2 – Without Pay (Deduction) */}
                        <div className="bg-rose-50/30 p-5 rounded-3xl border border-rose-100">
                            <h3 className="text-[10px] font-black text-rose-600 uppercase tracking-[0.2em] mb-4 flex items-center gap-3">
                                <div className="h-6 w-6 bg-rose-500 rounded-lg flex items-center justify-center text-white text-xs">✗</div>
                                Without Pay (Deduction)
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {unpaidStatuses.map(status => (
                                    <div key={status} className="bg-white px-4 py-2 rounded-xl border border-rose-100 text-[10px] font-black uppercase text-rose-700 flex items-center gap-2 group shadow-sm">
                                        <FaTimesCircle className="text-rose-400" size={10} />
                                        {status}
                                        {user.role === 'admin' && (
                                            <button onClick={() => setUnpaidStatuses(unpaidStatuses.filter(s => s !== status))} className="ml-1 text-rose-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100">×</button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Table Section */}
                <div className="mb-12">
                    {/* Bulk Action Bar */}
                    {user.role === 'admin' && !isHistoryMode && (
                        <div className="flex items-center justify-between mb-4 px-2">
                            <div className="flex items-center gap-3">
                                <button onClick={toggleSelectAll} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-sky-600 transition-colors">
                                    {selectedIds.length > 0 ? <FaCheckSquare className="text-sky-600" size={16} /> : <FaSquare className="text-gray-300" size={16} />}
                                    {selectedIds.length > 0 ? `${selectedIds.length} Selected` : 'Select All Unpaid'}
                                </button>
                                {selectedIds.length > 0 && (
                                    <button
                                        onClick={handleBulkMarkPaid}
                                        className="flex items-center gap-2 bg-emerald-600 text-white text-[9px] font-black uppercase tracking-widest px-5 py-2.5 rounded-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 active:scale-95"
                                    >
                                        <FaCheckCircle size={12} /> Mark All Paid ({selectedIds.length})
                                    </button>
                                )}
                            </div>
                            <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">
                                {getMergedSalaries().filter(s => s.status !== 'Paid').length} Unpaid Remaining
                            </span>
                        </div>
                    )}
                    <div className="bg-white rounded-[40px] shadow-2xl shadow-sky-50/50 border border-sky-50 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-gray-50/50 border-b border-gray-100">
                                        {user.role === 'admin' && !isHistoryMode && <th className="p-4 pl-8 w-10"></th>}
                                        <th className="p-8 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 text-left">Employee</th>
                                        <th className="p-8 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 text-center">Attendance</th>
                                        <th className="p-8 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 text-right">Gross Pay</th>
                                        <th className="p-8 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 text-right">Net Salary</th>
                                        <th className="p-8 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 text-center">Status</th>
                                        <th className="p-8 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50/50">
                                    <AnimatePresence mode="popLayout">
                                        { getMergedSalaries()
                                            .filter(s => {
                                                const roleMatch = activeRole === 'all' || (s.role || '').toLowerCase() === activeRole.toLowerCase();
                                                const historyMatch = isHistoryMode ? s.status === 'Paid' : true;
                                                return roleMatch && historyMatch;
                                            })
                                            .map((s, idx) => (
                                                <motion.tr
                                                    key={s.id}
                                                    initial={{ opacity: 0, x: 20 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    exit={{ opacity: 0, x: -20 }}
                                                    transition={{ delay: idx * 0.03 }}
                                                    className={`hover:bg-sky-50/30 transition-all group ${selectedIds.includes(s.id) ? 'bg-emerald-50/30' : ''}`}
                                                >
                                                    {/* Checkbox column – admin only */}
                                                    {user.role === 'admin' && !isHistoryMode && (
                                                        <td className="p-4 pl-8">
                                                            {s.status !== 'Paid' && (
                                                                <button onClick={() => toggleSelectId(s.id)} className="text-gray-300 hover:text-emerald-500 transition-colors">
                                                                    {selectedIds.includes(s.id)
                                                                        ? <FaCheckSquare className="text-emerald-500" size={18} />
                                                                        : <FaSquare size={18} />}
                                                                </button>
                                                            )}
                                                        </td>
                                                    )}
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
                                                            <div className="flex gap-2 flex-wrap text-[9px] font-black uppercase tracking-widest justify-center">
                                                                <span className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100" title="With Pay Days">
                                                                    ✓ {Number(s.total_present || 0).toFixed(1)}
                                                                </span>
                                                                <span className="text-gray-400 bg-gray-50 px-2 py-1 rounded-md" title="Period Days">
                                                                    DAYS: {(() => { const d1=new Date(fromDate); const d2=new Date(toDate); return Math.round((d2-d1)/(1000*60*60*24))+1; })()}
                                                                </span>
                                                                <span className="text-rose-500 bg-rose-50 px-2 py-1 rounded-md border border-rose-100" title="Without Pay Days">
                                                                    ✗ {Number(s.total_lop || 0).toFixed(1)}
                                                                </span>
                                                            </div>
                                                            <div className="flex gap-2 text-[8px] font-bold text-gray-400 tracking-widest">
                                                                <span>WITH PAY</span>
                                                                <span>·</span>
                                                                <span>WITHOUT PAY</span>
                                                            </div>
                                                            <div className="w-40 bg-gray-100 h-1.5 rounded-full overflow-hidden shadow-inner p-px">
                                                                <motion.div
                                                                initial={{ width: 0 }}
                                                                animate={{ width: `${Math.min(100, (s.total_present / (Math.round((new Date(toDate)-new Date(fromDate))/(1000*60*60*24))+1)) * 100)}%` }}
                                                                className="bg-gradient-to-r from-emerald-400 to-emerald-600 h-full rounded-full"
                                                            ></motion.div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-8 text-right font-black text-gray-800">
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-lg text-gray-800 tracking-tighter font-black">₹{Number(s.monthly_salary || 0).toLocaleString()}</span>
                                                            <span className="text-[9px] text-gray-400 font-bold tracking-widest mt-1">Monthly Salary</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-8 text-right font-black">
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-lg text-emerald-600 tracking-tighter font-black">₹{Number(s.calculated_salary || 0).toLocaleString()}</span>
                                                            {(Number(s.monthly_salary || 0) > Number(s.calculated_salary || 0)) && (
                                                                <span className="text-[9px] text-rose-400 font-bold tracking-widest mt-1">
                                                                    - ₹{(Number(s.monthly_salary || 0) - Number(s.calculated_salary || 0)).toLocaleString()} DEDUCTED
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="p-8 text-center">
                                                        {s.status === 'Paid' ? (
                                                            <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase px-4 py-2 rounded-2xl tracking-widest border bg-emerald-50 text-emerald-600 border-emerald-100">
                                                                <FaCheckCircle size={10} /> Paid
                                                            </span>
                                                        ) : s.status === 'Uncalculated' ? (
                                                            <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase px-4 py-2 rounded-2xl tracking-widest border bg-gray-50 text-gray-400 border-gray-100">
                                                                <FaTimesCircle size={10} /> Unpaid
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase px-4 py-2 rounded-2xl tracking-widest border bg-amber-50 text-amber-600 border-amber-100 animate-pulse">
                                                                <FaTimesCircle size={10} /> Unpaid
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="p-8 text-right flex justify-end gap-2">
                                                        <button
                                                            onClick={() => handlePrintSlip(s)}
                                                            className="h-12 w-12 bg-sky-50 text-sky-600 rounded-2xl flex items-center justify-center hover:bg-sky-100 transition-all active:scale-90 shadow-sm border border-sky-100"
                                                            title="Print Salary Slip"
                                                        >
                                                            <FaFileAlt size={16} />
                                                        </button>
                                                        {user.role === 'admin' && s.status === 'Paid' && (
                                                            <button
                                                                onClick={() => handleMarkUnpaid(s)}
                                                                className="inline-flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.1em] text-amber-600 bg-amber-50 border border-amber-200 px-4 py-2 rounded-xl hover:bg-amber-100 transition-all shadow-sm active:scale-95"
                                                                title="Edit: Revert to Unpaid"
                                                            >
                                                                Edit
                                                            </button>
                                                        )}
                                                    </td>
                                                </motion.tr>
                                            ))}
                                    </AnimatePresence>
                                    {getMergedSalaries().filter(s => {
                                        const roleMatch = activeRole === 'all' || (s.role || '').toLowerCase() === activeRole.toLowerCase();
                                        const historyMatch = isHistoryMode ? s.status === 'Paid' : true;
                                        return roleMatch && historyMatch;
                                    }).length === 0 && !loading && (
                                        <tr>
                                            <td colSpan="5" className="p-32 text-center">
                                                <div className="flex flex-col items-center gap-6 text-gray-300">
                                                    <div className="h-24 w-24 rounded-[40px] bg-gray-50 flex items-center justify-center border border-gray-100">
                                                        <FaMoneyBillWave size={40} className="opacity-20 translate-y-2" />
                                                    </div>
                                                    <div>
                                                        <p className="font-black text-gray-400 uppercase tracking-[0.3em] text-xs">No Records Found</p>
                                                        <p className="text-[10px] font-bold text-gray-400 mt-2 italic">
                                                            {isHistoryMode 
                                                                ? "No published results found for this selection." 
                                                                : `No salary details displayed for ${activeRole === 'all' ? 'any personnel' : activeRole} in this period.`}
                                                        </p>
                                                        {activeRole !== 'all' && (
                                                            <button 
                                                                onClick={() => setActiveRole('all')}
                                                                className="mt-6 text-[9px] font-black uppercase tracking-widest text-sky-600 hover:text-sky-800 transition-colors"
                                                            >
                                                                View All Role Salary Details
                                                            </button>
                                                        )}
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

            {/* Daily Breakdown Modal */}
            <AnimatePresence>
                {dailyBreakdown && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
                        onClick={() => setDailyBreakdown(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 40 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 40 }}
                            onClick={e => e.stopPropagation()}
                            className="bg-white rounded-[32px] shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col"
                        >
                            {/* Modal Header */}
                            <div className="p-8 border-b border-gray-50 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="h-12 w-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                                        <FaChartLine size={18} />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-black text-gray-800 tracking-tight">{dailyBreakdown.emp.name}</h2>
                                        <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-0.5">Day-Wise Salary Breakdown · {fromDate} → {toDate}</p>
                                    </div>
                                </div>
                                <button onClick={() => setDailyBreakdown(null)} className="h-10 w-10 rounded-2xl bg-gray-100 text-gray-500 flex items-center justify-center hover:bg-rose-50 hover:text-rose-500 transition-all text-lg font-black">×</button>
                            </div>

                            {/* Modal Body */}
                            <div className="flex-1 overflow-y-auto p-8">
                                {loadingBreakdown ? (
                                    <div className="flex items-center justify-center h-40"><div className="animate-spin h-8 w-8 rounded-full border-2 border-indigo-500 border-t-transparent"></div></div>
                                ) : dailyBreakdown.data ? (
                                    <>
                                        {/* Summary Cards */}
                                        <div className="grid grid-cols-3 gap-4 mb-8">
                                            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Base Salary</p>
                                                <p className="text-lg font-black text-gray-800">₹{Number(dailyBreakdown.data.base_salary).toLocaleString()}</p>
                                            </div>
                                            <div className="bg-sky-50 p-4 rounded-2xl border border-sky-100">
                                                <p className="text-[9px] font-black text-sky-500 uppercase tracking-widest">Daily Rate</p>
                                                <p className="text-lg font-black text-sky-700">₹{Number(dailyBreakdown.data.daily_rate).toLocaleString()}</p>
                                            </div>
                                            <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                                                <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Total Earned</p>
                                                <p className="text-lg font-black text-emerald-700">₹{Number(dailyBreakdown.data.total_gross).toLocaleString()}</p>
                                            </div>
                                        </div>

                                        {/* Day Table */}
                                        {dailyBreakdown.data.breakdown.length > 0 ? (
                                            <div className="overflow-x-auto rounded-2xl border border-gray-100">
                                                <table className="w-full">
                                                    <thead>
                                                        <tr className="bg-gray-50 border-b border-gray-100">
                                                            <th className="p-4 text-[9px] font-black text-gray-400 uppercase tracking-widest text-left">Date</th>
                                                            <th className="p-4 text-[9px] font-black text-gray-400 uppercase tracking-widest text-center">Status</th>
                                                            <th className="p-4 text-[9px] font-black text-gray-400 uppercase tracking-widest text-center">Punch In</th>
                                                            <th className="p-4 text-[9px] font-black text-gray-400 uppercase tracking-widest text-center">Punch Out</th>
                                                            <th className="p-4 text-[9px] font-black text-gray-400 uppercase tracking-widest text-right">Gross Earned</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-50">
                                                        {dailyBreakdown.data.breakdown.map((day, i) => (
                                                            <tr key={i} className={`${day.day_factor > 0 ? 'bg-emerald-50/30' : 'bg-rose-50/20'}`}>
                                                                <td className="p-4 text-xs font-bold text-gray-700">{new Date(day.date).toLocaleDateString('en-IN', { weekday:'short', day:'2-digit', month:'short' })}</td>
                                                                <td className="p-4 text-center">
                                                                    <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-xl tracking-widest ${
                                                                        day.day_factor >= 1 ? 'bg-emerald-100 text-emerald-700'
                                                                        : day.day_factor === 0.5 ? 'bg-amber-100 text-amber-700'
                                                                        : 'bg-rose-100 text-rose-700'
                                                                    }`}>{day.status}{day.day_factor === 0.5 ? ' (Half)' : ''}</span>
                                                                </td>
                                                                <td className="p-4 text-center text-xs text-gray-500 font-bold">{day.punch_in || '—'}</td>
                                                                <td className="p-4 text-center text-xs text-gray-500 font-bold">{day.punch_out || '—'}</td>
                                                                <td className="p-4 text-right font-black text-emerald-600">₹{Number(day.gross_earned).toLocaleString()}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                    <tfoot>
                                                        <tr className="bg-gray-50 border-t-2 border-gray-200">
                                                            <td colSpan="4" className="p-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Total Earned ({dailyBreakdown.data.days_recorded} Days Recorded)</td>
                                                            <td className="p-4 text-right font-black text-lg text-emerald-700">₹{Number(dailyBreakdown.data.total_gross).toLocaleString()}</td>
                                                        </tr>
                                                    </tfoot>
                                                </table>
                                            </div>
                                        ) : (
                                            <div className="text-center py-16 text-gray-400">
                                                <FaMoneyBillWave size={32} className="mx-auto mb-4 opacity-20" />
                                                <p className="font-black text-sm uppercase tracking-widest">No Attendance Records in This Period</p>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="text-center py-16 text-gray-400">
                                        <p className="font-black text-sm">Could not load breakdown.</p>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </Layout>
    );
};

export default SalaryManagement;
