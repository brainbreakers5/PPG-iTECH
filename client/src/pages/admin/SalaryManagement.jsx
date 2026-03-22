import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import api from '../../utils/api';
import Swal from 'sweetalert2';
import { useAuth } from '../../context/AuthContext';
import {
    FaBuilding,
    FaCheckCircle,
    FaClock,
    FaEnvelope,
    FaExclamationCircle,
    FaFileAlt,
    FaFilter,
    FaHistory,
    FaMoneyBillWave,
    FaPaperPlane,
    FaSearch,
    FaTimesCircle,
    FaUserTie,
    FaWallet
} from 'react-icons/fa';

const formatIso = (d) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

const getCurrentPayrollCycle = () => {
    const now = new Date();
    const day = now.getDate();
    const anchorMonth = day >= 26 ? now.getMonth() : now.getMonth() - 1;
    const anchorYear = day >= 26 ? now.getFullYear() : new Date(now.getFullYear(), now.getMonth() - 1, 1).getFullYear();

    const from = new Date(anchorYear, anchorMonth, 26);
    const to = new Date(anchorYear, anchorMonth + 1, 25);

    return {
        fromDate: formatIso(from),
        toDate: formatIso(to),
        month: to.getMonth() + 1,
        year: to.getFullYear()
    };
};

const getCycleByMonthYear = (month, year) => {
    const safeMonth = Number(month) || 1;
    const safeYear = Number(year) || new Date().getFullYear();
    const to = new Date(safeYear, safeMonth - 1, 25);
    const from = new Date(safeYear, safeMonth - 2, 26);

    return {
        fromDate: formatIso(from),
        toDate: formatIso(to),
        month: safeMonth,
        year: safeYear
    };
};

const toCurrency = (v) => Number(v || 0).toLocaleString('en-IN');
const normalizeEmpId = (v) => String(v || '').trim();

const SalaryManagement = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const canInstitutionWide = user?.role === 'admin' || user?.role === 'management';
    const isHistoryPage = /\/payroll\/history$/.test(location.pathname);
    const isPersonalView = !canInstitutionWide;

    const currentCycle = useMemo(() => getCurrentPayrollCycle(), []);
    const [selectedMonth, setSelectedMonth] = useState(currentCycle.month);
    const [selectedYear, setSelectedYear] = useState(currentCycle.year);

    const selectedCycle = useMemo(() => {
        if (isHistoryPage) return getCycleByMonthYear(selectedMonth, selectedYear);
        return currentCycle;
    }, [isHistoryPage, selectedMonth, selectedYear, currentCycle]);

    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState([]);
    const [activeRole, setActiveRole] = useState('all');
    const [activeDepartment, setActiveDepartment] = useState('all');
    const [departments, setDepartments] = useState([]);

    const [paidStatuses, setPaidStatuses] = useState(() => {
        const saved = localStorage.getItem('salary_paid_statuses');
        return saved ? JSON.parse(saved) : ['Present', 'CL', 'ML', 'Comp Leave', 'OD', 'Holiday'];
    });
    const [unpaidStatuses, setUnpaidStatuses] = useState(() => {
        const saved = localStorage.getItem('salary_unpaid_statuses');
        return saved ? JSON.parse(saved) : ['Absent', 'LOP'];
    });

    const [newStatus, setNewStatus] = useState('');

    const filteredRows = useMemo(() => {
        return rows.filter((r) => {
            const roleMatch = activeRole === 'all' || String(r.role || '').toLowerCase() === activeRole;
            const deptMatch = activeDepartment === 'all' || String(r.department_name || '').toLowerCase() === activeDepartment;
            return roleMatch && deptMatch;
        });
    }, [rows, activeRole, activeDepartment]);

    const departmentOptions = useMemo(() => {
        const fromRows = rows
            .map((r) => String(r.department_name || '').trim())
            .filter(Boolean);
        const fromMaster = departments
            .map((d) => String(d.name || '').trim())
            .filter(Boolean);
        return Array.from(new Set([...fromMaster, ...fromRows]));
    }, [rows, departments]);

    const summary = useMemo(() => {
        const gross = filteredRows.reduce((acc, row) => acc + Number(row.gross_salary || row.monthly_salary || 0), 0);
        const net = filteredRows.reduce((acc, row) => acc + Number(row.calculated_salary || 0), 0);
        const paidCount = filteredRows.filter((row) => String(row.status || '').toLowerCase() === 'paid').length;
        const pendingCount = filteredRows.length - paidCount;
        return { gross, net, paidCount, pendingCount };
    }, [filteredRows]);

    const refreshRows = async () => {
        setLoading(true);
        try {
            if (isPersonalView) {
                const { data } = await api.get('/salary/timeline');
                setRows(Array.isArray(data) ? data : []);
                setLoading(false);
                return;
            }

            const params = new URLSearchParams();
            params.set('month', String(selectedCycle.month));
            params.set('year', String(selectedCycle.year));
            params.set('fromDate', selectedCycle.fromDate);
            params.set('toDate', selectedCycle.toDate);
            params.set('paidStatuses', JSON.stringify(paidStatuses));
            params.set('unpaidStatuses', JSON.stringify(unpaidStatuses));

            const { data } = await api.get(`/salary?${params.toString()}`);
            setRows(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Failed to fetch salaries:', error);
            setRows([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const autoCalculateCurrent = async () => {
            if (!canInstitutionWide || isHistoryPage) return;
            try {
                await api.post('/salary/calculate', {
                    month: currentCycle.month,
                    year: currentCycle.year,
                    fromDate: currentCycle.fromDate,
                    toDate: currentCycle.toDate,
                    paidStatuses,
                    unpaidStatuses
                });
            } catch (error) {
                console.error('Auto-calculate failed:', error?.response?.data || error.message);
            }
        };

        autoCalculateCurrent().finally(refreshRows);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isHistoryPage, canInstitutionWide]);

    useEffect(() => {
        refreshRows();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedMonth, selectedYear, isHistoryPage, isPersonalView]);

    useEffect(() => {
        const fetchDepartments = async () => {
            if (!canInstitutionWide) return;
            try {
                const { data } = await api.get('/departments');
                setDepartments(Array.isArray(data) ? data : []);
            } catch (error) {
                console.error('Failed to fetch departments:', error);
                setDepartments([]);
            }
        };
        fetchDepartments();
    }, [canInstitutionWide]);

    const saveAttendanceConfig = async () => {
        localStorage.setItem('salary_paid_statuses', JSON.stringify(paidStatuses));
        localStorage.setItem('salary_unpaid_statuses', JSON.stringify(unpaidStatuses));

        try {
            if (canInstitutionWide && !isHistoryPage) {
                await api.post('/salary/calculate', {
                    month: currentCycle.month,
                    year: currentCycle.year,
                    fromDate: currentCycle.fromDate,
                    toDate: currentCycle.toDate,
                    paidStatuses,
                    unpaidStatuses
                });
            }
            await refreshRows();
            Swal.fire('Saved', 'Attendance status rules updated.', 'success');
        } catch (error) {
            console.error('Failed to save config:', error);
            Swal.fire('Warning', 'Configuration saved locally. Recalculation failed.', 'warning');
        }
    };

    const handleAddStatus = (isPaid) => {
        const value = newStatus.trim();
        if (!value) return;

        if (isPaid) {
            if (!paidStatuses.includes(value)) setPaidStatuses((prev) => [...prev, value]);
        } else {
            if (!unpaidStatuses.includes(value)) setUnpaidStatuses((prev) => [...prev, value]);
        }

        setNewStatus('');
    };

    const updateStatus = async (row, nextStatus) => {
        if (String(row.id).startsWith('history_')) {
            Swal.fire('Not allowed', 'Archived history entries cannot be changed.', 'info');
            return;
        }

        if (nextStatus === 'Pending' && row.status === 'Paid') {
            Swal.fire('Not allowed', 'Paid salary records are immutable.', 'info');
            return;
        }

        await api.put(`/salary/${row.id}/status`, { status: nextStatus });

        if (nextStatus === 'Paid') {
            const viewUrl = `${window.location.origin}/${String(row.role || 'staff').toLowerCase()}/payroll`;
            await api.post('/salary/notify-paid', {
                emp_id: row.emp_id,
                name: row.name,
                email: row.email,
                fromDate: selectedCycle.fromDate,
                toDate: selectedCycle.toDate,
                amount: row.calculated_salary,
                viewUrl
            });
        }
    };

    const handleBulkMark = async (status) => {
        const chosen = filteredRows.filter((r) => selectedIds.includes(r.id));
        if (!chosen.length) {
            Swal.fire('No selection', 'Select one or more records first.', 'info');
            return;
        }

        const result = await Swal.fire({
            title: `Mark ${chosen.length} records as ${status}?`,
            text: `${selectedCycle.fromDate} to ${selectedCycle.toDate}`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Confirm'
        });
        if (!result.isConfirmed) return;

        const settled = await Promise.allSettled(
            chosen.map(async (r) => {
                await updateStatus(r, status);
            })
        );

        const failed = settled.filter((s) => s.status === 'rejected').length;
        setSelectedIds([]);
        await refreshRows();

        if (failed > 0) {
            Swal.fire('Partial Success', `${chosen.length - failed} updated, ${failed} failed.`, 'warning');
        } else {
            Swal.fire('Success', `${chosen.length} records updated.`, 'success');
        }
    };

    const handleSubmitReport = async () => {
        const { value } = await Swal.fire({
            title: 'Submit Salary Report',
            html: `
                <select id="salary-report-type" class="swal2-input">
                    <option value="Salary Credit Delay">Salary Credit Delay</option>
                    <option value="Pay Mismatch">Pay Mismatch</option>
                    <option value="Attendance Mismatch">Attendance Mismatch</option>
                    <option value="Deduction Clarification">Deduction Clarification</option>
                    <option value="Other">Other</option>
                </select>
                <textarea id="salary-report-reason" class="swal2-textarea" placeholder="Enter reason"></textarea>
            `,
            focusConfirm: false,
            preConfirm: () => {
                const reportType = document.getElementById('salary-report-type')?.value || 'Other';
                const reason = document.getElementById('salary-report-reason')?.value?.trim() || '';
                if (!reason) {
                    Swal.showValidationMessage('Reason is required');
                    return null;
                }
                return { reportType, reason };
            },
            showCancelButton: true,
            confirmButtonText: 'Submit'
        });

        if (!value) return;

        try {
            await api.post('/salary/reports', value);
            Swal.fire('Submitted', 'Your report has been sent to admin.', 'success');
        } catch (error) {
            console.error('Failed to submit report:', error);
            Swal.fire('Error', error?.response?.data?.message || 'Report submission failed.', 'error');
        }
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === filteredRows.length) {
            setSelectedIds([]);
            return;
        }
        setSelectedIds(filteredRows.map((r) => r.id));
    };

    const renderFilterControls = canInstitutionWide && (
        <div className="bg-white p-6 rounded-[32px] shadow-xl shadow-sky-50/70 border border-sky-50 mb-6">
            <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center">
                    <FaFilter size={14} />
                </div>
                <div>
                    <p className="text-sm font-black text-gray-800 tracking-tight">Salary Filters</p>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Role and department based records</p>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2">Select Role</label>
                    <select
                        value={activeRole}
                        onChange={(e) => setActiveRole(e.target.value)}
                        className="w-full px-4 py-3 rounded-2xl bg-gray-50 border border-gray-100 text-sm font-bold text-gray-700 outline-none focus:ring-4 focus:ring-sky-100"
                    >
                        <option value="all">All Roles</option>
                        <option value="principal">Principal</option>
                        <option value="hod">HOD</option>
                        <option value="staff">Staff</option>
                        <option value="management">Management</option>
                    </select>
                </div>
                <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2">Select Department</label>
                    <select
                        value={activeDepartment}
                        onChange={(e) => setActiveDepartment(e.target.value)}
                        className="w-full px-4 py-3 rounded-2xl bg-gray-50 border border-gray-100 text-sm font-bold text-gray-700 outline-none focus:ring-4 focus:ring-sky-100"
                    >
                        <option value="all">All Departments</option>
                        {departmentOptions.map((name) => (
                            <option key={name} value={name.toLowerCase()}>{name}</option>
                        ))}
                    </select>
                </div>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mt-4">Filtered records: {filteredRows.length}</p>
        </div>
    );

    return (
        <Layout>
            <div className="max-w-7xl mx-auto pb-4">
                <div className="mb-8 rounded-[36px] border border-sky-100 bg-gradient-to-r from-sky-50 via-white to-cyan-50 p-6 md:p-8 shadow-xl shadow-sky-50/80">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                            <h1 className="text-3xl md:text-4xl font-black text-gray-800 tracking-tight">
                                {isPersonalView ? 'My Salary Details' : isHistoryPage ? 'Salary History' : 'Salary Management'}
                            </h1>
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mt-2">
                                {isPersonalView
                                    ? 'All your past and current salary records are shown here.'
                                    : isHistoryPage
                                        ? 'Select period by month and year using fixed cycle 26 to 25.'
                                        : 'Current live payroll period is fixed and not editable.'}
                            </p>
                        </div>

                        {canInstitutionWide && (
                            <div className="flex flex-wrap gap-2">
                                {!isHistoryPage && (
                                    <>
                                        <button
                                            onClick={() => navigate(`/${user.role}/payroll/history`)}
                                            className="px-4 py-2.5 rounded-2xl bg-amber-500 text-white text-[11px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-amber-100"
                                        >
                                            <FaHistory /> History Page
                                        </button>
                                        <button
                                            onClick={() => navigate(`/${user.role}/payroll/reports`)}
                                            className="px-4 py-2.5 rounded-2xl bg-indigo-600 text-white text-[11px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-indigo-100"
                                        >
                                            <FaEnvelope /> Reports Page
                                        </button>
                                    </>
                                )}
                                {isHistoryPage && (
                                    <button
                                        onClick={() => navigate(`/${user.role}/payroll`)}
                                        className="px-4 py-2.5 rounded-2xl bg-sky-600 text-white text-[11px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-sky-100"
                                    >
                                        <FaSearch /> Live Management
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white rounded-3xl border border-sky-50 shadow-lg shadow-sky-50/70 p-5">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center"><FaMoneyBillWave /></div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Gross Total</p>
                                <p className="text-lg font-black text-gray-800">Rs {toCurrency(summary.gross)}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-3xl border border-sky-50 shadow-lg shadow-sky-50/70 p-5">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center"><FaWallet /></div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Net Total</p>
                                <p className="text-lg font-black text-emerald-700">Rs {toCurrency(summary.net)}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-3xl border border-sky-50 shadow-lg shadow-sky-50/70 p-5">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center"><FaUserTie /></div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Paid Records</p>
                                <p className="text-lg font-black text-gray-800">{summary.paidCount}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-3xl border border-sky-50 shadow-lg shadow-sky-50/70 p-5">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center"><FaBuilding /></div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Pending Records</p>
                                <p className="text-lg font-black text-gray-800">{summary.pendingCount}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Payroll Period</p>
                    </div>
                </div>

                {!isPersonalView && (
                    <div className="bg-white p-6 rounded-[32px] shadow-xl shadow-sky-50/70 border border-sky-50 mb-6 flex flex-wrap items-center gap-3">
                        {!isHistoryPage && (
                            <>
                                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Fixed Period</span>
                                <span className="px-4 py-2.5 rounded-2xl bg-sky-50 text-sm font-black text-sky-700 border border-sky-100">{selectedCycle.fromDate}</span>
                                <span className="text-gray-300 font-black">to</span>
                                <span className="px-4 py-2.5 rounded-2xl bg-sky-50 text-sm font-black text-sky-700 border border-sky-100">{selectedCycle.toDate}</span>
                            </>
                        )}

                        {isHistoryPage && (
                            <>
                                <label className="text-xs font-bold text-gray-500 uppercase">Month</label>
                                <select
                                    className="px-4 py-2.5 rounded-2xl border border-gray-100 bg-gray-50"
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                                >
                                    {Array.from({ length: 12 }).map((_, i) => (
                                        <option key={i + 1} value={i + 1}>{i + 1}</option>
                                    ))}
                                </select>
                                <label className="text-xs font-bold text-gray-500 uppercase">Year</label>
                                <input
                                    type="number"
                                    className="px-4 py-2.5 rounded-2xl border border-gray-100 bg-gray-50 w-28"
                                    value={selectedYear}
                                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                                />
                                <span className="text-xs text-gray-500">Cycle: {selectedCycle.fromDate} to {selectedCycle.toDate}</span>
                            </>
                        )}
                    </div>
                )}

                {!isPersonalView && !isHistoryPage && (
                    <div className="bg-white p-6 rounded-[32px] shadow-xl shadow-sky-50/70 border border-sky-50 mb-6">
                        <div className="flex flex-wrap gap-2 items-center mb-3">
                            <h2 className="text-sm font-bold text-gray-700">Attendance Status Rules</h2>
                            <button onClick={saveAttendanceConfig} className="px-3 py-2 rounded bg-sky-600 text-white text-xs font-bold">Save</button>
                        </div>
                        <div className="flex flex-wrap gap-2 items-center mb-3">
                            <input
                                value={newStatus}
                                onChange={(e) => setNewStatus(e.target.value)}
                                placeholder="Add status"
                                className="px-3 py-2 rounded-2xl border border-gray-100 bg-gray-50 text-sm"
                            />
                            <button onClick={() => handleAddStatus(true)} className="px-3 py-2 rounded-2xl bg-emerald-600 text-white text-xs font-bold">Add With Pay</button>
                            <button onClick={() => handleAddStatus(false)} className="px-3 py-2 rounded-2xl bg-rose-600 text-white text-xs font-bold">Add Without Pay</button>
                        </div>
                        <div className="text-xs text-gray-600">
                            <p><b>With Pay:</b> {paidStatuses.join(', ')}</p>
                            <p><b>Without Pay:</b> {unpaidStatuses.join(', ')}</p>
                        </div>
                    </div>
                )}

                {isPersonalView && (
                    <div className="bg-white p-5 rounded-[28px] shadow-xl shadow-sky-50/70 border border-sky-50 mb-6 text-xs text-gray-600">
                        <p><b>Admin With Pay statuses:</b> {paidStatuses.join(', ')}</p>
                        <p><b>Admin Without Pay statuses:</b> {unpaidStatuses.join(', ')}</p>
                    </div>
                )}

                {renderFilterControls}

                {canInstitutionWide && isHistoryPage && (
                    <div className="bg-white p-4 rounded-[28px] shadow-xl shadow-sky-50/70 border border-sky-50 mb-6 flex flex-wrap gap-2 items-center">
                        <button onClick={toggleSelectAll} className="px-3 py-2 rounded-2xl bg-gray-100 text-xs font-bold">{selectedIds.length === filteredRows.length ? 'Clear Selection' : 'Select All'}</button>
                        <button onClick={() => handleBulkMark('Paid')} className="px-3 py-2 rounded-2xl bg-emerald-600 text-white text-xs font-bold flex items-center gap-1"><FaCheckCircle /> Mark All Paid</button>
                        <button onClick={() => handleBulkMark('Pending')} className="px-3 py-2 rounded-2xl bg-amber-500 text-white text-xs font-bold flex items-center gap-1"><FaClock /> Mark All Unpaid</button>
                        <span className="text-xs text-gray-500">Selected: {selectedIds.length}</span>
                    </div>
                )}

                <div className="bg-white rounded-[36px] shadow-2xl shadow-sky-50/80 border border-sky-50 overflow-x-auto">
                    <table className="w-full min-w-[1100px]">
                        <thead className="bg-gray-50/80 border-b border-gray-100">
                            <tr>
                                {canInstitutionWide && isHistoryPage && <th className="p-3 text-left text-xs">Select</th>}
                                <th className="p-3 text-left text-xs uppercase tracking-widest text-gray-500">Employee</th>
                                <th className="p-3 text-left text-xs uppercase text-gray-500">Period</th>
                                <th className="p-3 text-right text-xs uppercase text-gray-500">With/Without Pay</th>
                                <th className="p-3 text-right text-xs uppercase text-gray-500">Gross</th>
                                <th className="p-3 text-right text-xs uppercase text-gray-500">Deductions</th>
                                <th className="p-3 text-right text-xs uppercase text-gray-500">Net</th>
                                <th className="p-3 text-center text-xs uppercase text-gray-500">Status</th>
                                <th className="p-3 text-right text-xs uppercase text-gray-500">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!loading && filteredRows.map((r) => (
                                <tr key={r.id} className="border-t border-gray-50 hover:bg-sky-50/40 transition-colors">
                                    {canInstitutionWide && isHistoryPage && (
                                        <td className="p-3">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.includes(r.id)}
                                                onChange={() => setSelectedIds((prev) => prev.includes(r.id) ? prev.filter((x) => x !== r.id) : [...prev, r.id])}
                                            />
                                        </td>
                                    )}
                                    <td className="p-3">
                                        <div className="font-black text-sm text-gray-800">{r.name}</div>
                                        <div className="text-xs text-gray-500">{r.emp_id} {r.department_name ? `| ${r.department_name}` : ''}</div>
                                    </td>
                                    <td className="p-3 text-sm text-gray-700">{r.from_date || '-'} to {r.to_date || '-'}</td>
                                    <td className="p-3 text-right text-sm text-gray-700">{Number(r.total_present || r.with_pay_count || 0).toFixed(1)} / {Number(r.total_lop || r.without_pay_count || 0).toFixed(1)}</td>
                                    <td className="p-3 text-right font-semibold">Rs {toCurrency(r.gross_salary || r.monthly_salary || 0)}</td>
                                    <td className="p-3 text-right text-rose-600">Rs {toCurrency(r.deductions_applied || 0)}</td>
                                    <td className="p-3 text-right text-emerald-700 font-bold">Rs {toCurrency(r.calculated_salary || 0)}</td>
                                    <td className="p-3 text-center">
                                        {String(r.status).toLowerCase() === 'paid' ? (
                                            <span className="px-3 py-1.5 rounded-2xl bg-emerald-100 text-emerald-700 text-xs font-black uppercase tracking-wider">Paid</span>
                                        ) : (
                                            <span className="px-3 py-1.5 rounded-2xl bg-amber-100 text-amber-700 text-xs font-black uppercase tracking-wider">Pending</span>
                                        )}
                                    </td>
                                    <td className="p-3 text-right">
                                        <div className="flex justify-end gap-2">
                                            {!isPersonalView && (
                                                <button
                                                    onClick={() => window.print()}
                                                    className="px-2.5 py-1.5 rounded-2xl bg-sky-50 text-sky-700 text-xs font-black"
                                                    title="Print"
                                                >
                                                    <FaFileAlt />
                                                </button>
                                            )}
                                            {canInstitutionWide && (
                                                <button
                                                    onClick={() => navigate(`/${user.role}/payroll/employee/${encodeURIComponent(normalizeEmpId(r.emp_id))}`)}
                                                    className="px-2.5 py-1.5 rounded-2xl bg-indigo-50 text-indigo-700 text-xs font-black"
                                                    title="View employee salary page"
                                                >
                                                    <FaSearch />
                                                </button>
                                            )}
                                            {isPersonalView && (
                                                <button
                                                    onClick={handleSubmitReport}
                                                    className="px-2.5 py-1.5 rounded-2xl bg-amber-50 text-amber-700 text-xs font-black flex items-center gap-1"
                                                    title="Report issue"
                                                >
                                                    <FaPaperPlane /> Report
                                                </button>
                                            )}
                                            {canInstitutionWide && isHistoryPage && (
                                                <>
                                                    <button
                                                        onClick={async () => {
                                                            try {
                                                                await updateStatus(r, 'Paid');
                                                                await refreshRows();
                                                                Swal.fire('Success', 'Marked as paid.', 'success');
                                                            } catch (error) {
                                                                console.error(error);
                                                                Swal.fire('Error', error?.response?.data?.message || 'Failed to mark paid.', 'error');
                                                            }
                                                        }}
                                                        className="px-2.5 py-1.5 rounded-2xl bg-emerald-50 text-emerald-700 text-xs font-black"
                                                        title="Mark paid"
                                                    >
                                                        <FaCheckCircle />
                                                    </button>
                                                    <button
                                                        onClick={async () => {
                                                            try {
                                                                await updateStatus(r, 'Pending');
                                                                await refreshRows();
                                                                Swal.fire('Success', 'Marked as unpaid.', 'success');
                                                            } catch (error) {
                                                                console.error(error);
                                                                Swal.fire('Error', error?.response?.data?.message || 'Failed to mark unpaid.', 'error');
                                                            }
                                                        }}
                                                        className="px-2.5 py-1.5 rounded-2xl bg-amber-50 text-amber-700 text-xs font-black"
                                                        title="Mark unpaid"
                                                    >
                                                        <FaTimesCircle />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}

                            {loading && (
                                <tr>
                                    <td colSpan={canInstitutionWide && isHistoryPage ? 9 : 8} className="p-6 text-center text-gray-500">Loading...</td>
                                </tr>
                            )}

                            {!loading && filteredRows.length === 0 && (
                                <tr>
                                    <td colSpan={canInstitutionWide && isHistoryPage ? 9 : 8} className="p-8 text-center text-gray-400">
                                        <div className="flex flex-col items-center gap-2">
                                            <FaExclamationCircle className="text-xl" />
                                            <span>No salary records found for this view.</span>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="mt-4 text-xs text-gray-500">
                    <FaMoneyBillWave className="inline mr-1" />
                    Period logic: fixed payroll cycle uses date range 26 to 25.
                </div>
            </div>
        </Layout>
    );
};

export default SalaryManagement;
