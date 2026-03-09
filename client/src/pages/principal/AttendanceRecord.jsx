import { useState, useEffect, useMemo } from 'react';
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
    const [endDate, setEndDate] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }));
    const [departmentId, setDepartmentId] = useState('');
    const [role, setRole] = useState('');
    const [summaryRecords, setSummaryRecords] = useState([]);
    const [detailedRecords, setDetailedRecords] = useState([]);
    const [biometricRecords, setBiometricRecords] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [viewMode, setViewMode] = useState('summary'); // 'summary', 'detailed', or 'biometric'
    const [selectedEmployee, setSelectedEmployee] = useState(null); // For summary view modal

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

    // Abbreviate status for attendance sheet cells
    const abbreviateStatus = (status) => {
        const map = {
            'Present': 'P', 'Absent': 'A', 'OD': 'OD', 'ML': 'ML',
            'CL': 'CL', 'Comp Leave': 'COMP', 'Holiday': 'H',
            'Leave': 'L', 'LOP': 'LOP'
        };
        return map[status] || status || '—';
    };

    const getStatusCellColor = (status) => {
        const colors = {
            'Present': 'text-emerald-700 bg-emerald-50',
            'Absent': 'text-rose-700 bg-rose-50',
            'OD': 'text-sky-700 bg-sky-50',
            'ML': 'text-amber-700 bg-amber-50',
            'CL': 'text-amber-700 bg-amber-50',
            'Comp Leave': 'text-violet-700 bg-violet-50',
            'Holiday': 'text-gray-500 bg-gray-100',
            'Leave': 'text-orange-700 bg-orange-50',
            'LOP': 'text-rose-700 bg-rose-50'
        };
        return colors[status] || 'text-gray-400';
    };

    // Group detailed records by employee for attendance sheet view
    const groupedByEmployee = useMemo(() => {
        const groups = {};
        detailedRecords.forEach(rec => {
            if (!groups[rec.emp_id]) {
                groups[rec.emp_id] = { emp_id: rec.emp_id, name: rec.name, role: rec.role, department_name: rec.department_name, records: {} };
            }
            const dateKey = String(rec.date).slice(0, 10);
            groups[rec.emp_id].records[dateKey] = rec;
        });
        return Object.values(groups);
    }, [detailedRecords]);

    // Sorted unique dates across all detailed records
    const uniqueDates = useMemo(() => {
        const dates = new Set();
        detailedRecords.forEach(rec => dates.add(String(rec.date).slice(0, 10)));
        return Array.from(dates).sort();
    }, [detailedRecords]);

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
        // Special print for detailed attendance sheet view
        if (viewMode === 'detailed') {
            if (groupedByEmployee.length === 0 || uniqueDates.length === 0) return;

            const printWindow = window.open('', '_blank', 'width=1200,height=800');
            if (!printWindow) return;

            const abbreviate = (status) => {
                const map = { 'Present': 'P', 'Absent': 'A', 'OD': 'OD', 'ML': 'ML', 'CL': 'CL', 'Comp Leave': 'COMP', 'Holiday': 'H', 'Leave': 'L', 'LOP': 'LOP' };
                return map[status] || status || '\u2014';
            };

            const statusColor = (status) => {
                const m = { 'Present': '#065f46', 'Absent': '#9f1239', 'OD': '#0369a1', 'ML': '#92400e', 'CL': '#92400e', 'Comp Leave': '#5b21b6', 'Holiday': '#6b7280', 'Leave': '#c2410c', 'LOP': '#9f1239' };
                return m[status] || '#6b7280';
            };

            const employeeSections = groupedByEmployee.map(emp => {
                const dateHeaders = uniqueDates.map(date => {
                    const d = new Date(date + 'T00:00:00+05:30');
                    return `<th style="border:1px dotted #9ca3af;padding:4px 2px;text-align:center;min-width:42px;font-size:8pt;background:#f3f4f6;">
                        <div style="font-weight:800;">${d.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', day: '2-digit' })}</div>
                        <div style="font-size:6pt;color:#9ca3af;text-transform:uppercase;">${d.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', weekday: 'short' })}</div>
                    </th>`;
                }).join('');

                const makeRow = (label, getValue, bgColor) => {
                    const cells = uniqueDates.map(date => {
                        const rec = emp.records[date];
                        const val = getValue(rec);
                        const color = label === 'Status' && rec ? statusColor(rec.status) : '#374151';
                        return `<td style="border:1px dotted #9ca3af;padding:3px 2px;text-align:center;font-size:8pt;color:${escapeHtml(color)};font-weight:${label === 'Status' || label === 'Total' ? '800' : '600'};">${escapeHtml(val)}</td>`;
                    }).join('');
                    return `<tr style="background:${bgColor};">
                        <td style="border:1px dotted #9ca3af;padding:4px 8px;font-size:8pt;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;color:#374151;background:${bgColor};white-space:nowrap;">${escapeHtml(label)}</td>
                        ${cells}
                    </tr>`;
                };

                return `
                    <div style="margin-bottom:24px;page-break-inside:avoid;">
                        <div style="background:#0369a1;color:white;padding:6px 12px;font-size:10pt;font-weight:800;border-radius:6px 6px 0 0;">
                            ${escapeHtml(emp.emp_id)} &mdash; ${escapeHtml(emp.name)}
                            ${emp.role ? `<span style="float:right;font-size:8pt;opacity:0.8;text-transform:uppercase;">${escapeHtml(emp.role)}</span>` : ''}
                        </div>
                        <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
                            <thead><tr>
                                <th style="border:1px dotted #9ca3af;padding:4px 8px;text-align:left;min-width:65px;font-size:8pt;background:#e5e7eb;font-weight:800;">Day &rarr;</th>
                                ${dateHeaders}
                            </tr></thead>
                            <tbody>
                                ${makeRow('Status', rec => rec ? abbreviate(rec.status) : '\u2014', '#ffffff')}
                                ${makeRow('InTime', rec => rec?.in_time || '\u2014', '#f9fafb')}
                                ${makeRow('OutTime', rec => rec?.out_time || '\u2014', '#ffffff')}
                                ${makeRow('Total', rec => rec ? calculateHours(rec.in_time, rec.out_time) : '\u2014', '#f0f9ff')}
                            </tbody>
                        </table>
                    </div>`;
            }).join('');

            printWindow.document.write(`<!doctype html><html><head><meta charset="UTF-8"><title>Detailed Attendance Sheet</title>
                <style>
                    @page { size: landscape; margin: 0.5cm; }
                    * { box-sizing: border-box; }
                    body { font-family: Arial, Helvetica, sans-serif; padding: 12px; color: #111827; margin: 0; font-size: 10pt; position: relative; }
                    h1 { margin: 0 0 6px; font-size: 14pt; font-weight: 800; color: #1e3a8a; }
                    .print-brand { position: absolute; top: 12px; right: 12px; text-align: right; }
                    .print-brand .app-name { font-size: 11pt; font-weight: 800; color: #1e3a8a; margin: 0; letter-spacing: 0.5px; }
                    .print-brand .print-time { font-size: 8pt; color: #6b7280; margin: 2px 0 0; }
                    .meta { margin-bottom: 14px; color: #6b7280; font-size: 9pt; border-bottom: 2px solid #e5e7eb; padding-bottom: 6px; }
                    @media print { body { padding: 0; } }
                </style></head><body>
                <div class="print-brand">
                    <p class="app-name">PPG iTech HUB</p>
                    <p class="print-time">${new Date().toLocaleString('en-GB')}</p>
                </div>
                <h1>Detailed Attendance Sheet</h1>
                <div class="meta">
                    Period: ${new Date(startDate).toLocaleDateString('en-GB')} to ${new Date(endDate).toLocaleDateString('en-GB')} |
                    Employees: ${groupedByEmployee.length}
                    ${departmentId ? ` | Department: ${departments.find(d => String(d.id) === String(departmentId))?.name || ''}` : ''}
                    ${role ? ` | Role: ${role.toUpperCase()}` : ''}
                </div>
                ${employeeSections}
            </body></html>`);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => printWindow.print(), 250);
            return;
        }

        let items, title, headings, getRowData;
        
        if (viewMode === 'summary') {
            items = summaryRecords;
            title = 'Attendance Summary Report';
            headings = ['#', 'Emp ID', 'Name', 'Role', 'Working Days', 'Holidays', 'Present', 'CL', 'ML', 'Comp', 'OD'];
            getRowData = (rec, idx) => [
                idx + 1,
                rec.emp_id ?? '',
                rec.name ?? '',
                rec.role ?? '',
                rec.total_working_days ?? 0,
                rec.total_holidays ?? 0,
                rec.total_present ?? 0,
                rec.total_cl ?? 0,
                rec.total_ml ?? 0,
                rec.total_comp ?? 0,
                rec.total_od ?? 0
            ];
        } else if (viewMode === 'detailed') {
            items = detailedRecords;
            title = 'Detailed Attendance Logs';
            headings = ['#', 'Date', 'Emp ID', 'Name', 'Status', 'In Time', 'Out Time', 'Hours'];
            getRowData = (log, idx) => [
                idx + 1,
                new Date(String(log.date).slice(0, 10) + 'T00:00:00+05:30').toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata' }),
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
                new Date(String(log.date).slice(0, 10) + 'T00:00:00+05:30').toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata' }),
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
                        position: relative;
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
                <div class="print-brand">
                    <p class="app-name">PPG iTech HUB</p>
                    <p class="print-time">${new Date().toLocaleString('en-GB')}</p>
                </div>
                <h1>${escapeHtml(title)}</h1>
                <div class="meta">
                    Period: ${new Date(startDate).toLocaleDateString('en-GB')} to ${new Date(endDate).toLocaleDateString('en-GB')} | 
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
                                        <th className="p-5 text-xs font-black uppercase tracking-widest bg-gray-50/50 text-center">CL</th>
                                        <th className="p-5 text-xs font-black uppercase tracking-widest bg-gray-50/50 text-center">ML</th>
                                        <th className="p-5 text-xs font-black uppercase tracking-widest bg-gray-50/50 text-center">Comp</th>
                                        <th className="p-5 text-xs font-black uppercase tracking-widest bg-gray-50/50 text-center">OD</th>
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
                                            <td className="p-5 text-sm font-black text-center text-amber-500">{rec.total_cl}</td>
                                            <td className="p-5 text-sm font-black text-center text-orange-500">{rec.total_ml}</td>
                                            <td className="p-5 text-sm font-black text-center text-violet-500">{rec.total_comp}</td>
                                            <td className="p-5 text-sm font-black text-center text-amber-500">{rec.total_od}</td>
                                            <td className="p-5 text-center no-print">
                                                <button
                                                    onClick={() => {
                                                        const empRecords = detailedRecords.filter(d => d.emp_id === rec.emp_id);
                                                        setSelectedEmployee({ emp_id: rec.emp_id, name: rec.name, role: rec.role, records: empRecords });
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
                        className="space-y-8"
                    >
                        {/* Legend */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-3 flex flex-wrap items-center gap-x-5 gap-y-2">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mr-1">Legend:</span>
                            {[
                                { code: 'P', label: 'Present', cls: 'text-emerald-700 bg-emerald-50' },
                                { code: 'A', label: 'Absent', cls: 'text-rose-700 bg-rose-50' },
                                { code: 'OD', label: 'On Duty', cls: 'text-sky-700 bg-sky-50' },
                                { code: 'ML', label: 'Medical Leave', cls: 'text-amber-700 bg-amber-50' },
                                { code: 'CL', label: 'Casual Leave', cls: 'text-amber-700 bg-amber-50' },
                                { code: 'COMP', label: 'Comp Leave', cls: 'text-violet-700 bg-violet-50' },
                                { code: 'H', label: 'Holiday', cls: 'text-gray-500 bg-gray-100' },
                                { code: 'LOP', label: 'Loss of Pay', cls: 'text-rose-700 bg-rose-50' },
                            ].map(item => (
                                <span key={item.code} className="flex items-center gap-1.5">
                                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-black ${item.cls}`}>{item.code}</span>
                                    <span className="text-[10px] text-gray-500">{item.label}</span>
                                </span>
                            ))}
                        </div>

                        {/* Employee Attendance Sheets */}
                        {groupedByEmployee.map((emp) => (
                            <motion.div
                                key={emp.emp_id}
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-white rounded-2xl shadow-lg shadow-sky-50/50 border border-gray-100 overflow-hidden print-section"
                            >
                                {/* Employee Header */}
                                <div className="bg-gradient-to-r from-sky-700 to-sky-600 text-white px-4 sm:px-6 py-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                                    <div className="h-9 w-9 rounded-xl bg-white/20 flex items-center justify-center text-sm font-black flex-shrink-0">
                                        {emp.name?.charAt(0) || '?'}
                                    </div>
                                    <span className="text-sm font-black tracking-wide">{emp.emp_id}</span>
                                    <span className="text-sky-200 hidden sm:inline">|</span>
                                    <span className="text-sm font-bold">{emp.name}</span>
                                    {emp.department_name && (
                                        <>
                                            <span className="text-sky-200 hidden sm:inline">|</span>
                                            <span className="text-xs text-sky-200 font-medium">{emp.department_name}</span>
                                        </>
                                    )}
                                    <span className="ml-auto px-2.5 py-0.5 bg-white/15 rounded-full text-[9px] font-black uppercase tracking-wider">
                                        {emp.role}
                                    </span>
                                </div>

                                {/* Attendance Sheet Table */}
                                <div className="overflow-x-auto attendance-sheet-scroll">
                                    <table className="w-full border-collapse" style={{ minWidth: `${80 + uniqueDates.length * 64}px` }}>
                                        <thead>
                                            <tr>
                                                <th className="sticky left-0 z-10 bg-gray-100 border border-dotted border-gray-300 px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-gray-500 text-left w-[80px] min-w-[80px]">
                                                    Day &rarr;
                                                </th>
                                                {uniqueDates.map(date => {
                                                    const d = new Date(date + 'T00:00:00+05:30');
                                                    const dayNum = d.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', day: '2-digit' });
                                                    const dayName = d.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', weekday: 'short' });
                                                    const isSunday = d.getDay() === 0;
                                                    return (
                                                        <th key={date} className={`border border-dotted border-gray-300 px-1 py-2 text-center min-w-[56px] w-[56px] ${isSunday ? 'bg-rose-50' : 'bg-gray-50'}`}>
                                                            <div className={`text-[11px] font-black ${isSunday ? 'text-rose-500' : 'text-gray-700'}`}>{dayNum}</div>
                                                            <div className={`text-[8px] font-bold uppercase ${isSunday ? 'text-rose-400' : 'text-gray-400'}`}>{dayName}</div>
                                                        </th>
                                                    );
                                                })}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {/* Status Row */}
                                            <tr>
                                                <td className="sticky left-0 z-10 bg-white border border-dotted border-gray-300 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-gray-600">
                                                    Status
                                                </td>
                                                {uniqueDates.map(date => {
                                                    const rec = emp.records[date];
                                                    return (
                                                        <td key={date} className="border border-dotted border-gray-300 px-0.5 py-1.5 text-center">
                                                            {rec ? (
                                                                <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-black leading-none ${getStatusCellColor(rec.status)}`}>
                                                                    {abbreviateStatus(rec.status)}
                                                                </span>
                                                            ) : (
                                                                <span className="text-gray-300 text-[10px]">&mdash;</span>
                                                            )}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                            {/* InTime Row */}
                                            <tr className="bg-gray-50/40">
                                                <td className="sticky left-0 z-10 bg-gray-50 border border-dotted border-gray-300 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-gray-600">
                                                    InTime
                                                </td>
                                                {uniqueDates.map(date => {
                                                    const rec = emp.records[date];
                                                    return (
                                                        <td key={date} className="border border-dotted border-gray-300 px-0.5 py-1.5 text-center text-[10px] font-semibold text-gray-600">
                                                            {rec?.in_time || <span className="text-gray-300">&mdash;</span>}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                            {/* OutTime Row */}
                                            <tr>
                                                <td className="sticky left-0 z-10 bg-white border border-dotted border-gray-300 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-gray-600">
                                                    OutTime
                                                </td>
                                                {uniqueDates.map(date => {
                                                    const rec = emp.records[date];
                                                    return (
                                                        <td key={date} className="border border-dotted border-gray-300 px-0.5 py-1.5 text-center text-[10px] font-semibold text-gray-600">
                                                            {rec?.out_time || <span className="text-gray-300">&mdash;</span>}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                            {/* Total Row */}
                                            <tr className="bg-sky-50/30">
                                                <td className="sticky left-0 z-10 bg-sky-50 border border-dotted border-gray-300 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-sky-700">
                                                    Total
                                                </td>
                                                {uniqueDates.map(date => {
                                                    const rec = emp.records[date];
                                                    return (
                                                        <td key={date} className="border border-dotted border-gray-300 px-0.5 py-1.5 text-center text-[10px] font-black text-sky-600">
                                                            {rec ? calculateHours(rec.in_time, rec.out_time) : <span className="text-gray-300">&mdash;</span>}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </motion.div>
                        ))}
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

            {/* Employee Detail Full Screen - Summary View Action */}
            <AnimatePresence>
                {selectedEmployee && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-white z-50 flex flex-col"
                    >
                        {/* Full Screen Header */}
                        <div className="px-6 md:px-10 py-5 border-b border-gray-100 bg-gradient-to-r from-sky-50 to-blue-50 flex items-center justify-between flex-shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-sky-500 to-sky-700 flex items-center justify-center text-white font-black text-lg shadow-lg">
                                    {selectedEmployee.name?.charAt(0) || '?'}
                                </div>
                                <div>
                                    <p className="text-xl font-black text-gray-800 tracking-tight">{selectedEmployee.name}</p>
                                    <div className="flex items-center gap-3 mt-0.5">
                                        <p className="text-[10px] font-black text-sky-500 uppercase tracking-widest">{selectedEmployee.emp_id}</p>
                                        {selectedEmployee.role && (
                                            <span className="px-2 py-0.5 bg-gray-100 rounded-full text-[9px] font-black text-gray-500 uppercase tracking-wider">{selectedEmployee.role}</span>
                                        )}
                                    </div>
                                </div>
                                <span className="ml-2 bg-sky-100 text-sky-700 px-4 py-1.5 rounded-xl text-xs font-black">
                                    {selectedEmployee.records.length} Records
                                </span>
                            </div>
                            <button
                                onClick={() => setSelectedEmployee(null)}
                                className="p-3 rounded-2xl bg-white hover:bg-rose-50 text-gray-400 hover:text-rose-500 transition-all border border-gray-200 shadow-sm"
                            >
                                <FaTimes size={18} />
                            </button>
                        </div>
                        {/* Full Screen Table */}
                        <div className="flex-1 overflow-auto px-6 md:px-10 py-6">
                            {selectedEmployee.records.length === 0 ? (
                                <div className="flex items-center justify-center h-full">
                                    <p className="text-gray-400 text-lg font-bold">No detailed records found for this employee in the selected date range.</p>
                                </div>
                            ) : (
                                <table className="min-w-full text-left">
                                    <thead className="sticky top-0 z-10">
                                        <tr className="bg-gray-50">
                                            <th className="px-5 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">#</th>
                                            <th className="px-5 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</th>
                                            <th className="px-5 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                                            <th className="px-5 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">In Time</th>
                                            <th className="px-5 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Out Time</th>
                                            <th className="px-5 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Total Hours</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {selectedEmployee.records.map((log, idx) => (
                                            <motion.tr
                                                key={log.id || idx}
                                                initial={{ opacity: 0, y: 5 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: idx * 0.02 }}
                                                className="hover:bg-sky-50/50 transition-colors"
                                            >
                                                <td className="px-5 py-4 text-sm font-black text-gray-400">{idx + 1}</td>
                                                <td className="px-5 py-4 text-sm font-bold text-gray-700">
                                                    {new Date(String(log.date).slice(0, 10) + 'T00:00:00+05:30').toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                                                </td>
                                                <td className="px-5 py-4">
                                                    <StatusBadge status={log.status} />
                                                </td>
                                                <td className="px-5 py-4 text-sm font-black text-gray-700 text-center">{log.in_time || '—'}</td>
                                                <td className="px-5 py-4 text-sm font-black text-gray-700 text-center">{log.out_time || '—'}</td>
                                                <td className="px-5 py-4 text-sm font-black text-sky-600 text-center">{calculateHours(log.in_time, log.out_time)}</td>
                                            </motion.tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            </div>
        </Layout>
    );
};

export default AttendanceRecord;

