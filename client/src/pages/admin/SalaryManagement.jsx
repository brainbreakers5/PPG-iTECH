import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import api from '../../utils/api';
import Swal from 'sweetalert2';
import { useAuth } from '../../context/AuthContext';
import {
    FaCheckCircle,
    FaClock,
    FaEnvelope,
    FaExclamationCircle,
    FaFileAlt,
    FaHistory,
    FaMoneyBillWave,
    FaPaperPlane,
    FaSearch,
    FaTimesCircle
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
        return rows.filter((r) => activeRole === 'all' || String(r.role || '').toLowerCase() === activeRole);
    }, [rows, activeRole]);

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

    const renderRoleTabs = canInstitutionWide && (
        <div className="flex flex-wrap gap-2 mb-4">
            {['all', 'principal', 'hod', 'staff', 'management'].map((r) => (
                <button
                    key={r}
                    onClick={() => setActiveRole(r)}
                    className={`px-3 py-2 rounded-lg text-xs font-bold uppercase ${activeRole === r ? 'bg-sky-600 text-white' : 'bg-white text-gray-500 border'}`}
                >
                    {r}
                </button>
            ))}
        </div>
    );

    return (
        <Layout>
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                    <div>
                        <h1 className="text-3xl font-black text-gray-800">
                            {isPersonalView ? 'My Salary Details' : isHistoryPage ? 'Salary History' : 'Salary Management'}
                        </h1>
                        <p className="text-xs text-gray-500 mt-1">
                            {isPersonalView
                                ? 'All your past and current salary records are shown here.'
                                : isHistoryPage
                                    ? 'Select period by month/year (fixed date cycle 26 to 25).'
                                    : 'Current live payroll period is fixed and not editable.'}
                        </p>
                    </div>

                    {canInstitutionWide && (
                        <div className="flex flex-wrap gap-2">
                            {!isHistoryPage && (
                                <>
                                    <button
                                        onClick={() => navigate(`/${user.role}/payroll/history`)}
                                        className="px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-bold flex items-center gap-2"
                                    >
                                        <FaHistory /> History Page
                                    </button>
                                    <button
                                        onClick={() => navigate(`/${user.role}/payroll/reports`)}
                                        className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold flex items-center gap-2"
                                    >
                                        <FaEnvelope /> Reports Page
                                    </button>
                                </>
                            )}
                            {isHistoryPage && (
                                <button
                                    onClick={() => navigate(`/${user.role}/payroll`)}
                                    className="px-4 py-2 rounded-lg bg-sky-600 text-white text-sm font-bold flex items-center gap-2"
                                >
                                    <FaSearch /> Live Management
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {!isPersonalView && (
                    <div className="bg-white rounded-xl border p-4 mb-4 flex flex-wrap items-center gap-3">
                        {!isHistoryPage && (
                            <>
                                <span className="text-xs font-bold text-gray-500 uppercase">Fixed Period</span>
                                <span className="px-3 py-2 rounded-lg bg-gray-100 text-sm font-semibold">{selectedCycle.fromDate}</span>
                                <span className="text-gray-400">to</span>
                                <span className="px-3 py-2 rounded-lg bg-gray-100 text-sm font-semibold">{selectedCycle.toDate}</span>
                            </>
                        )}

                        {isHistoryPage && (
                            <>
                                <label className="text-xs font-bold text-gray-500 uppercase">Month</label>
                                <select
                                    className="px-3 py-2 rounded-lg border"
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
                                    className="px-3 py-2 rounded-lg border w-28"
                                    value={selectedYear}
                                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                                />
                                <span className="text-xs text-gray-500">Cycle: {selectedCycle.fromDate} to {selectedCycle.toDate}</span>
                            </>
                        )}
                    </div>
                )}

                {!isPersonalView && !isHistoryPage && (
                    <div className="bg-white rounded-xl border p-4 mb-4">
                        <div className="flex flex-wrap gap-2 items-center mb-3">
                            <h2 className="text-sm font-bold text-gray-700">Attendance Status Rules</h2>
                            <button onClick={saveAttendanceConfig} className="px-3 py-2 rounded bg-sky-600 text-white text-xs font-bold">Save</button>
                        </div>
                        <div className="flex flex-wrap gap-2 items-center mb-3">
                            <input
                                value={newStatus}
                                onChange={(e) => setNewStatus(e.target.value)}
                                placeholder="Add status"
                                className="px-3 py-2 rounded border text-sm"
                            />
                            <button onClick={() => handleAddStatus(true)} className="px-3 py-2 rounded bg-emerald-600 text-white text-xs font-bold">Add With Pay</button>
                            <button onClick={() => handleAddStatus(false)} className="px-3 py-2 rounded bg-rose-600 text-white text-xs font-bold">Add Without Pay</button>
                        </div>
                        <div className="text-xs text-gray-600">
                            <p><b>With Pay:</b> {paidStatuses.join(', ')}</p>
                            <p><b>Without Pay:</b> {unpaidStatuses.join(', ')}</p>
                        </div>
                    </div>
                )}

                {isPersonalView && (
                    <div className="bg-white rounded-xl border p-4 mb-4 text-xs text-gray-600">
                        <p><b>Admin With Pay statuses:</b> {paidStatuses.join(', ')}</p>
                        <p><b>Admin Without Pay statuses:</b> {unpaidStatuses.join(', ')}</p>
                    </div>
                )}

                {renderRoleTabs}

                {canInstitutionWide && isHistoryPage && (
                    <div className="bg-white rounded-xl border p-3 mb-4 flex flex-wrap gap-2 items-center">
                        <button onClick={toggleSelectAll} className="px-3 py-2 rounded bg-gray-100 text-xs font-bold">{selectedIds.length === filteredRows.length ? 'Clear Selection' : 'Select All'}</button>
                        <button onClick={() => handleBulkMark('Paid')} className="px-3 py-2 rounded bg-emerald-600 text-white text-xs font-bold flex items-center gap-1"><FaCheckCircle /> Mark All Paid</button>
                        <button onClick={() => handleBulkMark('Pending')} className="px-3 py-2 rounded bg-amber-500 text-white text-xs font-bold flex items-center gap-1"><FaClock /> Mark All Unpaid</button>
                        <span className="text-xs text-gray-500">Selected: {selectedIds.length}</span>
                    </div>
                )}

                <div className="bg-white rounded-xl border overflow-x-auto">
                    <table className="w-full min-w-[1100px]">
                        <thead className="bg-gray-50">
                            <tr>
                                {canInstitutionWide && isHistoryPage && <th className="p-3 text-left text-xs">Select</th>}
                                <th className="p-3 text-left text-xs uppercase text-gray-500">Employee</th>
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
                                <tr key={r.id} className="border-t">
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
                                        <div className="font-semibold text-sm text-gray-800">{r.name}</div>
                                        <div className="text-xs text-gray-500">{r.emp_id} {r.department_name ? `| ${r.department_name}` : ''}</div>
                                    </td>
                                    <td className="p-3 text-sm text-gray-700">{r.from_date || '-'} to {r.to_date || '-'}</td>
                                    <td className="p-3 text-right text-sm text-gray-700">{Number(r.total_present || r.with_pay_count || 0).toFixed(1)} / {Number(r.total_lop || r.without_pay_count || 0).toFixed(1)}</td>
                                    <td className="p-3 text-right font-semibold">Rs {toCurrency(r.gross_salary || r.monthly_salary || 0)}</td>
                                    <td className="p-3 text-right text-rose-600">Rs {toCurrency(r.deductions_applied || 0)}</td>
                                    <td className="p-3 text-right text-emerald-700 font-bold">Rs {toCurrency(r.calculated_salary || 0)}</td>
                                    <td className="p-3 text-center">
                                        {String(r.status).toLowerCase() === 'paid' ? (
                                            <span className="px-2 py-1 rounded bg-emerald-100 text-emerald-700 text-xs font-semibold">Paid</span>
                                        ) : (
                                            <span className="px-2 py-1 rounded bg-amber-100 text-amber-700 text-xs font-semibold">Pending</span>
                                        )}
                                    </td>
                                    <td className="p-3 text-right">
                                        <div className="flex justify-end gap-2">
                                            {!isPersonalView && (
                                                <button
                                                    onClick={() => window.print()}
                                                    className="px-2 py-1 rounded bg-sky-50 text-sky-700 text-xs font-semibold"
                                                    title="Print"
                                                >
                                                    <FaFileAlt />
                                                </button>
                                            )}
                                            {canInstitutionWide && (
                                                <button
                                                    onClick={() => navigate(`/${user.role}/payroll/employee/${encodeURIComponent(normalizeEmpId(r.emp_id))}`)}
                                                    className="px-2 py-1 rounded bg-indigo-50 text-indigo-700 text-xs font-semibold"
                                                    title="View employee salary page"
                                                >
                                                    <FaSearch />
                                                </button>
                                            )}
                                            {isPersonalView && (
                                                <button
                                                    onClick={handleSubmitReport}
                                                    className="px-2 py-1 rounded bg-amber-50 text-amber-700 text-xs font-semibold flex items-center gap-1"
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
                                                        className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 text-xs font-semibold"
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
                                                        className="px-2 py-1 rounded bg-amber-50 text-amber-700 text-xs font-semibold"
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
