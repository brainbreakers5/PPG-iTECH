import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import api from '../../utils/api';
import { FaFileDownload, FaFilter, FaSearch, FaEye, FaTimes, FaCalendarAlt } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocket } from '../../context/SocketContext';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import AttendanceHistory from '../../components/AttendanceHistory';
import BiometricMonitor from '../../components/biometric/BiometricMonitor';

const AttendanceRecord = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    // Default to a range that includes the user's mock data (February)
    const [startDate, setStartDate] = useState('2026-02-01');
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [departmentId, setDepartmentId] = useState('');
    const [role, setRole] = useState('');
    const [summaryRecords, setSummaryRecords] = useState([]);
    const [detailedRecords, setDetailedRecords] = useState([]);
    const [biometricRecords, setBiometricRecords] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [viewMode, setViewMode] = useState('summary'); // 'summary', 'detailed', or 'biometric'

    // Helper function to expand leave type abbreviations in status
    const expandStatusName = (status) => {
        const statusMap = {
            'CL': 'Casual Leave (CL)',
            'ML': 'Medical Leave (ML)',
            'OD': 'On Duty (OD)',
            'LOP': 'Loss of Pay (LOP)',
            'Comp Leave': 'Compensatory Leave'
        };
        return statusMap[status] || status;
    };

    useEffect(() => {
        const fetchDepts = async () => {
            try {
                const { data } = await api.get('/departments');
                setDepartments(data);
            } catch (error) { console.error(error); }
        };
        fetchDepts();
    }, []);

    const socket = useSocket();

    const fetchAttendance = async () => {
        try {
            // Fetch Summary
            let summaryQuery = `/attendance/summary?startDate=${startDate}&endDate=${endDate}`;
            if (departmentId) summaryQuery += `&department_id=${departmentId}`;
            if (role) summaryQuery += `&role=${role}`;
            const { data: sData } = await api.get(summaryQuery);
            setSummaryRecords(sData);

            // Fetch Detailed
            let detailedQuery = `/attendance?startDate=${startDate}&endDate=${endDate}`;
            if (departmentId) detailedQuery += `&department_id=${departmentId}`;
            if (role) detailedQuery += `&role=${role}`;
            const { data: dData } = await api.get(detailedQuery);
            setDetailedRecords(dData);
        } catch (error) {
            console.error("Error fetching attendance", error);
        }
    };

    useEffect(() => {
        if (startDate && endDate) fetchAttendance();
    }, [startDate, endDate, departmentId, role]);

    useEffect(() => {
        if (!socket) return;

        const handleCalendarUpdate = () => {
            if (startDate && endDate) fetchAttendance();
        };

        socket.on('calendar_updated', handleCalendarUpdate);
        return () => {
            socket.off('calendar_updated', handleCalendarUpdate);
        };
    }, [socket, startDate, endDate, departmentId, role]);

    const calculateHours = (inTime, outTime) => {
        if (!inTime || !outTime) return '—';
        const start = new Date(`2000-01-01T${inTime}`);
        const end = new Date(`2000-01-01T${outTime}`);
        const diff = (end - start) / (1000 * 60 * 60);
        return diff > 0 ? `${diff.toFixed(1)} hrs` : '—';
    };

    const calculateBiometricHours = (intime, outtime) => {
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

        const worked = outMinutes >= inMinutes
            ? (outMinutes - inMinutes)
            : ((24 * 60) - inMinutes + outMinutes);

        const hours = Math.floor(worked / 60);
        const minutes = worked % 60;
        return `${hours}h ${String(minutes).padStart(2, '0')}m`;
    };

    const escapeHtml = (value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const handlePrint = () => {
        let items, title, headings, getRowData;
        
        if (viewMode === 'summary') {
            items = summaryRecords;
            title = 'Attendance Summary Report';
            headings = ['#', 'Emp ID', 'Name', 'Role', 'Working Days', 'Holidays', 'Present', 'Leave', 'OD', 'LOP'];
            getRowData = (rec, idx) => [
                idx + 1,
                rec.emp_id ?? '',
                rec.name ?? '',
                rec.role ?? '',
                rec.total_working_days ?? 0,
                rec.total_holidays ?? 0,
                rec.total_present ?? 0,
                rec.total_leave ?? 0,
                rec.total_od ?? 0,
                rec.total_lop ?? 0
            ];
        } else if (viewMode === 'detailed') {
            items = detailedRecords;
            title = 'Detailed Attendance Logs';
            headings = ['#', 'Date', 'Emp ID', 'Name', 'Status', 'In Time', 'Out Time', 'Hours'];
            getRowData = (log, idx) => [
                idx + 1,
                new Date(log.date).toLocaleDateString('en-GB'),
                log.emp_id ?? '',
                log.name ?? '',
                log.status ?? '',
                log.in_time ?? '—',
                log.out_time ?? '—',
                calculateHours(log.in_time, log.out_time)
            ];
        } else if (viewMode === 'biometric') {
            items = biometricRecords;
            title = 'Biometric Activity Report';
            headings = ['#', 'Employee Code', 'Name', 'Date', 'In Time', 'Out Time', 'Total Hours', 'Status'];
            getRowData = (log, idx) => [
                idx + 1,
                log.user_id ?? '',
                log.name ?? log.user_id ?? '',
                new Date(log.date).toLocaleDateString('en-GB'),
                log.intime ?? '--:--',
                log.outtime ?? '--:--',
                calculateBiometricHours(log.intime, log.outtime),
                log.outtime ? 'Completed' : 'Active'
            ];
        } else {
            return;
        }

        if (!items || items.length === 0) {
            return;
        }

        const printWindow = window.open('', '_blank', 'width=1200,height=800');
        if (!printWindow) {
            return;
        }

        // Calculate dynamic widths based on content
        const columnLengths = items.reduce((acc, item) => {
            const rowData = getRowData(item, 0);
            rowData.forEach((val, idx) => {
                const len = String(val).length;
                acc[idx] = Math.max(acc[idx] || 0, len);
            });
            return acc;
        }, {});

        // Determine orientation based on data size
        const useLandscape = items.length > 15 || Object.values(columnLengths).some(len => len > 25);

        const rowsHtml = items.map((item, idx) => {
            const rowData = getRowData(item, idx);
            return `
                <tr>
                    ${rowData.map((val, colIdx) => `<td class="col-${colIdx}">${escapeHtml(val)}</td>`).join('')}
                </tr>
            `;
        }).join('');

        // Generate column styles dynamically
        const colStyles = headings.map((heading, idx) => {
            if (idx === 0) return '.col-0 { width: 4%; text-align: center; }'; // Index column
            const maxLen = Math.max(columnLengths[idx] || 0, heading.length);
            let width;
            if (viewMode === 'summary') {
                width = idx <= 3 ? Math.min(maxLen * 1.5 + 8, 18) : 10; // EmpID, Name, Role wider
            } else if (viewMode === 'biometric') {
                width = idx <= 3 ? Math.min(maxLen * 1.5 + 8, 16) : 10; // User ID, Name, Date wider
            } else {
                width = idx <= 4 ? Math.min(maxLen * 1.5 + 8, 16) : 10; // Date, EmpID, Name, Status wider
            }
            return `.col-${idx} { width: ${width}%; }`;
        }).join('\n                    ');

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
                    
                    * {
                        box-sizing: border-box;
                    }
                    
                    body {
                        font-family: Arial, Helvetica, sans-serif;
                        padding: 12px;
                        color: #111827;
                        margin: 0;
                        font-size: 10pt;
                    }
                    
                    h1 {
                        margin: 0 0 6px;
                        font-size: 16pt;
                        font-weight: bold;
                        color: #1e3a8a;
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
                    
                    /* Dynamic column sizing */
                    ${colStyles}
                    
                    tr:nth-child(even) {
                        background: #f9fafb;
                    }
                    
                    tr:hover {
                        background: #f3f4f6;
                    }
                    
                    /* Page break control */
                    tr {
                        page-break-inside: avoid;
                    }
                    
                    thead {
                        display: table-header-group;
                    }
                    
                    /* Print-specific styles */
                    @media print {
                        body {
                            padding: 0;
                        }
                        
                        table {
                            page-break-after: auto;
                        }
                        
                        tr {
                            page-break-inside: avoid;
                            page-break-after: auto;
                        }
                        
                        thead {
                            display: table-header-group;
                        }
                    }
                </style>
            </head>
            <body>
                <h1>${escapeHtml(title)}</h1>
                <div class="meta">
                    Period: ${new Date(startDate).toLocaleDateString('en-GB')} to ${new Date(endDate).toLocaleDateString('en-GB')} | 
                    Printed: ${new Date().toLocaleString('en-GB')} | 
                    Records: ${items.length}
                    ${departmentId ? ` | Department: ${departments.find(d => d.id == departmentId)?.name || ''}` : ''}
                    ${role ? ` | Role: ${role.toUpperCase()}` : ''}
                </div>
                <table>
                    <thead>
                        <tr>
                            ${headings.map((h, idx) => `<th class="col-${idx}">${escapeHtml(h)}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
            </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 250);
    };

    const StatusBadge = ({ status }) => {
        const colors = {
            'Present': 'bg-emerald-50 text-emerald-600 border-emerald-100',
            'Absent': 'bg-rose-50 text-rose-600 border-rose-100',
            'OD': 'bg-sky-50 text-sky-600 border-sky-100',
            'Leave': 'bg-amber-50 text-amber-600 border-amber-100',
            'Comp Leave': 'bg-amber-50 text-amber-600 border-amber-100',
            'CL': 'bg-amber-50 text-amber-600 border-amber-100',
            'ML': 'bg-amber-50 text-amber-600 border-amber-100',
            'Holiday': 'bg-gray-50 text-gray-600 border-gray-100'
        };
        return (
            <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${colors[status] || 'bg-gray-50 text-gray-400 border-gray-100'}`}>
                {expandStatusName(status)}
            </span>
        );
    };

    return (
        <Layout>
            <div>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-800 tracking-tight">Attendance Records</h1>
                    <p className="text-gray-500 font-medium mt-1">View comprehensive attendance data for your institution.</p>
                </div>
                <div className="flex bg-gray-100 p-1 rounded-2xl no-print">
                    <button
                        onClick={() => setViewMode('summary')}
                        className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'summary' ? 'bg-white text-sky-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        Summary View
                    </button>
                    <button
                        onClick={() => setViewMode('detailed')}
                        className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'detailed' ? 'bg-white text-sky-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        Detailed Logs
                    </button>
                    <button
                        onClick={() => setViewMode('biometric')}
                        className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'biometric' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        Biometric Sync
                    </button>
                </div>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-6 md:p-8 rounded-[32px] shadow-xl shadow-sky-50/50 mb-10 border border-sky-50 no-print"
            >
                {viewMode === 'biometric' ? (
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-200">
                                <FaSearch size={18} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Live Date</p>
                                <p className="text-xl font-black text-gray-800">
                                    {new Date().toLocaleDateString('en-US', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                                </p>
                            </div>
                            <span className="ml-2 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border bg-emerald-50 text-emerald-600 border-emerald-100 flex items-center gap-1.5">
                                <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-ping" />
                                Live
                            </span>
                        </div>
                        <button
                            onClick={handlePrint}
                            className="p-4 bg-sky-600 text-white rounded-2xl shadow-lg shadow-sky-100 hover:bg-sky-700 transition-all flex items-center justify-center group"
                            title="Print Report"
                        >
                            <FaFileDownload className="group-hover:scale-110 transition-transform" />
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">From Date</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-sky-100 focus:border-sky-500 transition-all font-bold text-gray-700 text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">To Date</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-sky-100 focus:border-sky-500 transition-all font-bold text-gray-700 text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Department</label>
                            <select
                                value={departmentId}
                                onChange={(e) => setDepartmentId(e.target.value)}
                                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-sky-100 focus:border-sky-500 transition-all font-bold text-gray-700 text-sm appearance-none"
                            >
                                <option value="">All Departments</option>
                                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                        </div>
                        <div className="flex gap-4">
                            <select
                                value={role}
                                onChange={(e) => setRole(e.target.value)}
                                className="flex-1 p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-sky-100 focus:border-sky-500 transition-all font-bold text-gray-700 text-sm appearance-none"
                            >
                                <option value="">All Roles</option>
                                <option value="hod">HOD</option>
                                <option value="staff">Staff</option>
                            </select>
                            <button
                                onClick={fetchAttendance}
                                className="p-4 bg-white border border-gray-100 text-sky-600 rounded-2xl shadow-lg shadow-sky-100 hover:bg-sky-50 transition-all flex items-center justify-center group"
                                title="Refresh Data"
                            >
                                <FaFilter className="group-hover:rotate-180 transition-transform duration-500" />
                            </button>
                            <button
                                onClick={handlePrint}
                                className="p-4 bg-sky-600 text-white rounded-2xl shadow-lg shadow-sky-100 hover:bg-sky-700 transition-all flex items-center justify-center group"
                                title="Print Report"
                            >
                                <FaFileDownload className="group-hover:scale-110 transition-transform" />
                            </button>
                        </div>
                    </div>
                )}
            </motion.div>

            <AnimatePresence mode="wait">
                {viewMode === 'summary' ? (
                    <motion.div
                        key="summary"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="styled-table-container modern-card overflow-hidden"
                    >
                        {/* Live Date Display for Summary */}
                        <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-sky-50 to-blue-50">
                            <div className="flex items-center gap-3">
                                <FaCalendarAlt className="text-sky-600 text-lg" />
                                <div>
                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Live Date</p>
                                    <p className="text-sm font-black text-gray-800">
                                        {new Date().toLocaleDateString('en-US', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                                    </p>
                                </div>
                                <span className="ml-auto px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border bg-sky-50 text-sky-600 border-sky-100 flex items-center gap-1.5">
                                    <span className="h-1.5 w-1.5 bg-sky-500 rounded-full animate-ping" />
                                    Live
                                </span>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full styled-table text-left">
                                <thead>
                                    <tr>
                                        <th className="p-5 text-xs font-black uppercase tracking-widest bg-gray-50/50">Emp ID</th>
                                        <th className="p-5 text-xs font-black uppercase tracking-widest bg-gray-50/50">Name</th>
                                        <th className="p-5 text-xs font-black uppercase tracking-widest bg-gray-50/50">Role</th>
                                        <th className="p-5 text-xs font-black uppercase tracking-widest bg-gray-50/50 text-center">Working Days</th>
                                        <th className="p-5 text-xs font-black uppercase tracking-widest bg-gray-50/50 text-center">Holidays</th>
                                        <th className="p-5 text-xs font-black uppercase tracking-widest bg-gray-50/50 text-center">Present</th>
                                        <th className="p-5 text-xs font-black uppercase tracking-widest bg-gray-50/50 text-center">Leave</th>
                                        <th className="p-5 text-xs font-black uppercase tracking-widest bg-gray-50/50 text-center">OD</th>
                                        <th className="p-5 text-xs font-black uppercase tracking-widest bg-gray-50/50 text-center">LOP</th>
                                        <th className="p-5 text-xs font-black uppercase tracking-widest bg-gray-50/50 text-center no-print">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {summaryRecords.map((rec) => (
                                        <tr key={rec.emp_id} className="hover:bg-sky-50/50 transition-colors border-b border-gray-50 last:border-0 text-left">
                                            <td className="p-5 text-sm font-black text-sky-900 text-left">{rec.emp_id}</td>
                                            <td className="p-5 text-sm font-bold text-gray-700 text-left">{rec.name}</td>
                                            <td className="p-5 text-[10px] font-black uppercase text-gray-400 tracking-wider text-left">
                                                <span className="px-3 py-1 bg-gray-100 rounded-full">{rec.role}</span>
                                            </td>
                                            <td className="p-5 text-sm font-black text-center text-emerald-600">{rec.total_working_days}</td>
                                            <td className="p-5 text-sm font-black text-center text-rose-500">{rec.total_holidays}</td>
                                            <td className="p-5 text-sm font-black text-center text-sky-600">{rec.total_present}</td>
                                            <td className="p-5 text-sm font-black text-center text-rose-500">{rec.total_leave}</td>
                                            <td className="p-5 text-sm font-black text-center text-amber-500">{rec.total_od}</td>
                                            <td className="p-5 text-sm font-black text-center text-gray-400">{rec.total_lop}</td>
                                            <td className="p-5 text-center no-print text-left">
                                                <button
                                                    onClick={() => {
                                                        const rolePrefix = user?.role === 'admin' ? 'admin' :
                                                            user?.role === 'principal' ? 'principal' :
                                                                user?.role === 'hod' ? 'hod' : 'staff';
                                                        navigate(`/${rolePrefix}/attendance/${rec.emp_id}/${startDate}/${endDate}`);
                                                    }}
                                                    className="p-3 bg-gray-50 text-gray-400 hover:text-sky-600 hover:bg-sky-50 rounded-xl transition-all"
                                                    title="View Detailed Records"
                                                >
                                                    <FaEye size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>
                ) : viewMode === 'detailed' ? (
                    <motion.div
                        key="detailed"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                    >
                        {/* Live Date Display for Detailed */}
                        <div className="mb-6 p-6 bg-white rounded-[32px] border border-sky-50 shadow-lg">
                            <div className="flex items-center gap-3">
                                <FaCalendarAlt className="text-emerald-600 text-lg" />
                                <div>
                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Live Date</p>
                                    <p className="text-sm font-black text-gray-800">
                                        {new Date().toLocaleDateString('en-US', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                                    </p>
                                </div>
                                <span className="ml-auto px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border bg-emerald-50 text-emerald-600 border-emerald-100 flex items-center gap-1.5">
                                    <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-ping" />
                                    Live
                                </span>
                            </div>
                        </div>
                        <motion.div
                        key="cards"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                    >
                        {detailedRecords.map((log, idx) => (
                            <motion.div
                                key={log.id || idx}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: idx * 0.05 }}
                                className="bg-white p-6 rounded-[32px] border border-sky-50 shadow-xl shadow-sky-500/5 hover:border-sky-200 transition-all group"
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <p className="text-[11px] font-black text-gray-800 uppercase tracking-tighter">
                                            {new Date(log.date).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </p>
                                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">{log.name}</p>
                                    </div>
                                    <StatusBadge status={log.status} />
                                </div>
                                <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-2xl group-hover:bg-sky-50 transition-colors">
                                    <div className="text-center">
                                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">In Time</p>
                                        <p className="text-xs font-black text-gray-700">{log.in_time || '—'}</p>
                                    </div>
                                    <div className="text-center border-x border-gray-200">
                                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Out Time</p>
                                        <p className="text-xs font-black text-gray-700">{log.out_time || '—'}</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Total</p>
                                        <p className="text-xs font-black text-sky-600">{calculateHours(log.in_time, log.out_time)}</p>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </motion.div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="biometric"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                    >
                        <BiometricMonitor onDataChange={setBiometricRecords} />
                    </motion.div>
                )}
            </AnimatePresence>

            {((viewMode === 'summary' ? summaryRecords.length : detailedRecords.length) === 0) && (
                <div className="text-center py-20">
                    <div className="h-20 w-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
                        <FaSearch size={30} />
                    </div>
                    <p className="text-gray-400 font-bold italic">No records found for the selected date range.</p>
                </div>
            )}

            </div>
        </Layout>
    );
};

export default AttendanceRecord;

