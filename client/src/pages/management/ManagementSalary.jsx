import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import api from '../../utils/api';
import { FaFilter, FaFileAlt, FaClock, FaMoneyBillWave, FaShieldAlt, FaChartLine, FaWallet, FaCheckCircle } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';

const ManagementSalary = () => {
    const [salaries, setSalaries] = useState([]);
    const now = new Date();
    const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    const [fromDate, setFromDate] = useState(firstDay);
    const [toDate, setToDate] = useState(lastDay);
    const [loading, setLoading] = useState(true);
    const [activeRole, setActiveRole] = useState('all');

    useEffect(() => {
        fetchSalaries();
    }, [fromDate, toDate]);

    const fetchSalaries = async () => {
        setLoading(true);
        try {
            const d = new Date(fromDate);
            const m = d.getMonth() + 1;
            const y = d.getFullYear();
            const { data } = await api.get(`/salary?month=${m}&year=${y}`);
            setSalaries(data);
            setLoading(false);
        } catch (error) {
            console.error(error);
            setLoading(false);
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
        const headings = ['#', 'Name', 'Department', 'Role', 'Present', 'Monthly Salary', 'Computed Pay', 'Status'];
        const useLandscape = items.length > 15;

        const rowsHtml = items.map((s, idx) => `
            <tr>
                <td style="text-align:center">${idx + 1}</td>
                <td>${escapeHtml(s.name)}</td>
                <td>${escapeHtml(s.department_name)}</td>
                <td>${escapeHtml(s.role)}</td>
                <td style="text-align:center">${s.total_present ?? 0}</td>
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
                    @page { size: ${useLandscape ? 'landscape' : 'portrait'}; margin: 0.5cm; }
                    * { box-sizing: border-box; }
                    body { font-family: Arial, Helvetica, sans-serif; padding: 12px; color: #111827; margin: 0; font-size: 10pt; position: relative; }
                    h1 { margin: 0 0 6px; font-size: 16pt; font-weight: bold; color: #1e3a8a; }
                    .print-brand { position: absolute; top: 12px; right: 12px; text-align: right; }
                    .print-brand .app-name { font-size: 11pt; font-weight: 800; color: #1e3a8a; margin: 0; letter-spacing: 0.5px; }
                    .print-brand .print-time { font-size: 8pt; color: #6b7280; margin: 2px 0 0; }
                    .meta { margin-bottom: 12px; color: #6b7280; font-size: 9pt; border-bottom: 2px solid #e5e7eb; padding-bottom: 6px; }
                    table { width: 100%; border-collapse: collapse; table-layout: auto; }
                    th, td { border: 1px solid #9ca3af; padding: 6px 8px; font-size: 9pt; text-align: left; vertical-align: top; word-wrap: break-word; }
                    th { background: #e5e7eb; font-weight: 700; text-transform: uppercase; font-size: 8pt; letter-spacing: 0.3px; color: #374151; }
                    tr:nth-child(even) { background: #f9fafb; }
                    tr { page-break-inside: avoid; }
                    thead { display: table-header-group; }
                    .summary { margin-top: 16px; display: flex; gap: 24px; font-size: 10pt; font-weight: 700; }
                    .summary span { color: #6b7280; font-weight: 400; }
                    @media print { body { padding: 0; } }
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
                        <tr>${headings.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr>
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
                        <h1 className="text-4xl font-black text-gray-800 tracking-tighter">Salary <span className="text-[#7C3AED]">Overview</span></h1>
                    </div>

                </div>

                {/* Role Tabs */}
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
                                ? 'bg-purple-600 text-white shadow-xl shadow-purple-200 ring-4 ring-purple-50'
                                : 'bg-white text-gray-400 hover:bg-gray-50 border border-purple-50'
                                }`}
                        >
                            <span className={`${activeRole === tab.id ? 'text-white' : 'text-purple-500'}`}>
                                {tab.icon}
                            </span>
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Filters & Table Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 mb-12">
                    {/* Period Selector Sidebar */}
                    <div className="lg:col-span-3">
                        <div className="bg-white p-10 rounded-[40px] shadow-xl shadow-purple-50/50 border border-purple-50 sticky top-6">
                            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-8 flex items-center gap-3">
                                <FaFilter className="text-purple-600" /> Select Period
                            </h2>
                            <div className="space-y-8">
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 ml-1">From Date</label>
                                    <input
                                        type="date"
                                        value={fromDate}
                                        onChange={(e) => setFromDate(e.target.value)}
                                        className="w-full p-5 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-500 transition-all font-black text-gray-700 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 ml-1">To Date</label>
                                    <input
                                        type="date"
                                        value={toDate}
                                        onChange={(e) => setToDate(e.target.value)}
                                        className="w-full p-5 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-500 transition-all font-black text-gray-700 text-sm"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Master Ledger Table */}
                    <div className="lg:col-span-9">
                        <div className="bg-white rounded-[40px] shadow-2xl shadow-purple-50/50 border border-purple-50 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="bg-gray-50/50 border-b border-gray-100">
                                            <th className="p-8 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 text-left">Employee</th>
                                            <th className="p-8 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 text-center">Attendance</th>
                                            <th className="p-8 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 text-right">Computed Pay</th>
                                            <th className="p-8 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 text-center">Status</th>
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
                                                        className="hover:bg-purple-50/30 transition-all group"
                                                    >
                                                        <td className="p-8">
                                                            <div className="flex items-center gap-5">
                                                                <div className="h-14 w-14 rounded-[20px] bg-gradient-to-br from-purple-50 to-white border border-purple-50 flex items-center justify-center text-purple-600 font-black text-lg shadow-sm group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 overflow-hidden">
                                                                    <img src={s.profile_pic || `https://ui-avatars.com/api/?name=${encodeURIComponent(s.name || '?')}&size=100&background=9333ea&color=fff&bold=true`} alt="" className="h-full w-full object-cover" />
                                                                </div>
                                                                <div>
                                                                    <p className="text-sm font-black text-gray-800 tracking-tight group-hover:text-purple-600 transition-colors">{s.name}</p>
                                                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5">{s.department_name || 'N/A'}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="p-8">
                                                            <div className="flex flex-col items-center gap-3">
                                                                <div className="flex gap-4 text-[9px] font-black uppercase tracking-widest">
                                                                    <span className="text-purple-500 bg-purple-50 px-2 py-1 rounded-md" title="Total Payable Days">PAID: {s.total_present}</span>
                                                                    <span className="text-gray-400 bg-gray-50 px-2 py-1 rounded-md" title="Total Days in Month">MONTH: {new Date(s.year, s.month, 0).getDate()}</span>
                                                                    <span className="text-rose-500 bg-rose-50 px-2 py-1 rounded-md" title="Loss of Pay Days">LOP: {s.total_lop || 0}</span>
                                                                </div>
                                                                <div className="w-32 bg-gray-100 h-1.5 rounded-full overflow-hidden shadow-inner p-px">
                                                                    <motion.div
                                                                        initial={{ width: 0 }}
                                                                        animate={{ width: `${(s.total_present / new Date(s.year, s.month, 0).getDate()) * 100}%` }}
                                                                        className="bg-gradient-to-r from-purple-400 to-purple-600 h-full rounded-full shadow-[0_0_12px_rgba(124,58,237,0.3)]"
                                                                    ></motion.div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="p-8 text-right font-black text-gray-800">
                                                            <div className="flex flex-col items-end">
                                                                <span className="text-[9px] text-gray-300 line-through font-bold tracking-widest mb-1">₹{Number(s.monthly_salary || 0).toLocaleString()}</span>
                                                                <span className="text-lg text-purple-600 tracking-tighter font-black">₹{Number(s.calculated_salary || 0).toLocaleString()}</span>
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
                                                    </motion.tr>
                                                ))}
                                        </AnimatePresence>
                                        {salaries.filter(s => activeRole === 'all' || (s.role || '').toLowerCase() === activeRole.toLowerCase()).length === 0 && !loading && (
                                            <tr>
                                                <td colSpan="4" className="p-32 text-center">
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
                        className="bg-white p-10 rounded-[40px] shadow-2xl shadow-purple-50/50 border-t-8 border-purple-600 relative group overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 w-48 h-48 bg-purple-50 rounded-full -mr-24 -mt-24 opacity-30 group-hover:scale-125 transition-transform duration-700"></div>
                        <div className="flex items-center justify-between mb-12 relative z-10">
                            <div>
                                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Gross Total</h3>
                                <p className="text-[10px] font-bold text-purple-500 mt-2 uppercase tracking-widest flex items-center gap-2">
                                    <FaChartLine size={10} /> Total Salary
                                </p>
                            </div>
                            <div className="h-14 w-14 rounded-2xl bg-purple-600 flex items-center justify-center text-white shadow-xl shadow-purple-200 group-hover:rotate-6 transition-transform">
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
                        className="bg-white p-10 rounded-[40px] shadow-2xl shadow-purple-50/50 border-t-8 border-emerald-500 relative group overflow-hidden"
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
                        className="bg-white p-10 rounded-[40px] shadow-2xl shadow-purple-50/50 border-t-8 border-amber-400 relative group overflow-hidden"
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

export default ManagementSalary;
