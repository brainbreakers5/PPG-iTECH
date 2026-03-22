import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import api from '../../utils/api';
import Swal from 'sweetalert2';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FaCheckCircle,
    FaClock,
    FaCog,
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

const fadeUp = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0 }
};

const staggerWrap = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: { staggerChildren: 0.06 }
    }
};

const SalaryManagement = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const canInstitutionWide = user?.role === 'admin' || user?.role === 'management';
    const isHistoryPage = /\/payroll\/history$/.test(location.pathname);
    const isPersonalView = !canInstitutionWide;
    const isAdmin = user?.role === 'admin';

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
        return { gross, net };
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
        if (!isPersonalView) return undefined;
        const intervalId = setInterval(() => {
            refreshRows();
        }, 30000);
        return () => clearInterval(intervalId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isPersonalView]);

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

    const openAttendanceConfig = () => {
        Swal.fire({
            title: 'Attendance Status Rules',
            html: `
                <div class="text-left text-sm">
                    <div class="mb-4">
                        <label class="block font-bold text-gray-600 mb-2">Statuses with Pay</label>
                        <input id="swal-paid" class="swal2-input" value="${paidStatuses.join(', ')}">
                    </div>
                    <div>
                        <label class="block font-bold text-gray-600 mb-2">Statuses without Pay (LOP)</label>
                        <input id="swal-unpaid" class="swal2-input" value="${unpaidStatuses.join(', ')}">
                    </div>
                    <p class="text-xs text-gray-500 mt-4">Enter comma-separated values. Changes will trigger a salary recalculation for the current period.</p>
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Save & Recalculate',
            preConfirm: () => {
                const paid = document.getElementById('swal-paid').value.split(',').map(s => s.trim()).filter(Boolean);
                const unpaid = document.getElementById('swal-unpaid').value.split(',').map(s => s.trim()).filter(Boolean);
                return { paid, unpaid };
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                const { paid, unpaid } = result.value;
                setPaidStatuses(paid);
                setUnpaidStatuses(unpaid);
                localStorage.setItem('salary_paid_statuses', JSON.stringify(paid));
                localStorage.setItem('salary_unpaid_statuses', JSON.stringify(unpaid));

                try {
                    if (canInstitutionWide && !isHistoryPage) {
                        await api.post('/salary/calculate', {
                            month: currentCycle.month,
                            year: currentCycle.year,
                            fromDate: currentCycle.fromDate,
                            toDate: currentCycle.toDate,
                            paidStatuses: paid,
                            unpaidStatuses: unpaid
                        });
                    }
                    await refreshRows();
                    Swal.fire('Saved!', 'Attendance rules updated and salaries recalculated.', 'success');
                } catch (error) {
                    console.error('Failed to save config:', error);
                    Swal.fire('Warning', 'Configuration saved locally. Recalculation failed.', 'warning');
                }
            }
        });
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
        <motion.div
            variants={fadeUp}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="modern-card p-6 border-sky-100 mb-6"
        >
            <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-xl bg-sky-500 flex items-center justify-center text-white shadow-lg shadow-sky-100">
                    <FaFilter size={14} />
                </div>
                <div>
                    <p className="text-sm font-black text-gray-800 tracking-tight">Salary Filters</p>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Role and department based records</p>
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
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 mt-4">Filtered records: {filteredRows.length}</p>
        </motion.div>
    );

    return (
        <Layout>
            <motion.div
                initial="hidden"
                animate="show"
                variants={staggerWrap}
                className="max-w-7xl mx-auto pb-4"
            >
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-black text-gray-800 tracking-tighter">
                            {isPersonalView ? (
                                <>My Salary <span className="text-sky-600">Details</span></>
                            ) : isHistoryPage ? (
                                <>Salary <span className="text-sky-600">History</span></>
                            ) : (
                                <>Salary <span className="text-sky-600">Management</span></>
                            )}
                        </h1>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mt-2">
                            {isPersonalView
                                ? 'All your past and current salary records are shown here.'
                                : isHistoryPage
                                    ? 'Select period by month and year using fixed cycle 26 to 25.'
                                    : 'Current live payroll period is fixed and not editable.'}
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-4">
                        {isAdmin && !isHistoryPage && (
                            <button
                                onClick={openAttendanceConfig}
                                className="bg-sky-600 text-white px-8 py-4 rounded-2xl shadow-xl shadow-sky-100 hover:bg-sky-700 transition-all active:scale-95 flex items-center font-black uppercase tracking-[0.2em] text-[10px]"
                            >
                                <FaCog className="mr-3 group-hover:-rotate-12 transition-transform" /> Rules
                            </button>
                        )}
                        {canInstitutionWide && (
                            <>
                                {!isHistoryPage && (
                                    <button
                                        onClick={() => navigate(`/${user.role}/payroll/history`)}
                                        className="bg-sky-600 text-white px-8 py-4 rounded-2xl shadow-xl shadow-sky-100 hover:bg-sky-700 transition-all active:scale-95 flex items-center font-black uppercase tracking-[0.2em] text-[10px]"
                                    >
                                        <FaHistory className="mr-3 group-hover:-rotate-12 transition-transform" /> History
                                    </button>
                                )}
                                {isHistoryPage && (
                                    <button
                                        onClick={() => navigate(`/${user.role}/payroll`)}
                                        className="bg-sky-600 text-white px-8 py-4 rounded-2xl shadow-xl shadow-sky-100 hover:bg-sky-700 transition-all active:scale-95 flex items-center font-black uppercase tracking-[0.2em] text-[10px]"
                                    >
                                        <FaSearch className="mr-3 group-hover:scale-110 transition-transform" /> Live
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {!isPersonalView && (
                    <motion.div variants={staggerWrap} className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <motion.div variants={fadeUp} transition={{ duration: 0.35 }} className="modern-card p-6 border-sky-50 shadow-xl shadow-sky-50/50 flex items-center gap-4 transition-all duration-300 hover:-translate-y-1 group">
                            <div className="h-12 w-12 rounded-xl bg-sky-500 flex items-center justify-center text-white shadow-lg shadow-sky-100 group-hover:scale-110 group-hover:-translate-y-1 transition-transform"><FaMoneyBillWave size={20} /></div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Gross Total</p>
                                <p className="text-xl font-black text-gray-800 tracking-tighter">Rs {toCurrency(summary.gross)}</p>
                            </div>
                        </motion.div>
                        <motion.div variants={fadeUp} transition={{ duration: 0.35 }} className="modern-card p-6 border-emerald-50 shadow-xl shadow-emerald-50/50 flex items-center gap-4 transition-all duration-300 hover:-translate-y-1 group">
                            <div className="h-12 w-12 rounded-xl bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-100 group-hover:scale-110 group-hover:-translate-y-1 transition-transform"><FaWallet size={20} /></div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Net Total</p>
                                <p className="text-xl font-black text-emerald-700 tracking-tighter">Rs {toCurrency(summary.net)}</p>
                            </div>
                        </motion.div>
                    </motion.div>
                )}

                {renderFilterControls}

                {canInstitutionWide && isHistoryPage && (
                    <motion.div
                        variants={fadeUp}
                        transition={{ duration: 0.35, ease: 'easeOut' }}
                        className="modern-card p-6 border-sky-100 mb-6 flex flex-wrap gap-3 items-center"
                    >
                        <button onClick={toggleSelectAll} className="bg-gray-100 text-gray-600 px-6 py-3 rounded-2xl hover:bg-gray-200 transition-all font-black uppercase tracking-[0.2em] text-[10px] active:scale-95">{selectedIds.length === filteredRows.length ? 'Clear Selection' : 'Select All'}</button>
                        <button onClick={() => handleBulkMark('Paid')} className="bg-sky-600 text-white px-6 py-3 rounded-2xl shadow-lg shadow-sky-100 hover:bg-sky-700 transition-all font-black uppercase tracking-[0.2em] text-[10px] active:scale-95 flex items-center gap-2"><FaCheckCircle /> Mark All Paid</button>
                        <button onClick={() => handleBulkMark('Pending')} className="bg-sky-600 text-white px-6 py-3 rounded-2xl shadow-lg shadow-sky-100 hover:bg-sky-700 transition-all font-black uppercase tracking-[0.2em] text-[10px] active:scale-95 flex items-center gap-2"><FaClock /> Mark All Unpaid</button>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 ml-auto bg-gray-50 px-4 py-2 rounded-xl">Selected: {selectedIds.length}</span>
                    </motion.div>
                )}

                <motion.div
                    variants={fadeUp}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                    className="modern-card !p-0 overflow-hidden border-sky-100"
                >
                    <div className="bg-sky-50/30 p-6 border-b border-sky-50 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-sky-500 flex items-center justify-center text-white shadow-lg shadow-sky-100">
                                <FaFileAlt size={18} />
                            </div>
                            <h2 className="text-lg font-black text-gray-800 uppercase tracking-widest">Salary Records</h2>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-3">
                            {!isPersonalView && !isHistoryPage && (
                                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
                                    <span>Payroll Period</span>
                                    <span className="px-3 py-2 rounded-xl bg-sky-50 text-sky-700 border border-sky-100 normal-case tracking-normal text-xs font-bold">{selectedCycle.fromDate} to {selectedCycle.toDate}</span>
                                </div>
                            )}
                            {isHistoryPage && (
                                <>
                                    <div className="flex items-center gap-2">
                                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Month</label>
                                        <select
                                            className="px-3 py-2 rounded-xl border border-gray-100 bg-gray-50 text-sm font-bold text-gray-700"
                                            value={selectedMonth}
                                            onChange={(e) => setSelectedMonth(Number(e.target.value))}
                                        >
                                            {Array.from({ length: 12 }).map((_, i) => (
                                                <option key={i + 1} value={i + 1}>{i + 1}</option>
                                            ))}
                                        </select>
                                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Year</label>
                                        <input
                                            type="number"
                                            className="px-3 py-2 rounded-xl border border-gray-100 bg-gray-50 w-24 text-sm font-bold text-gray-700"
                                            value={selectedYear}
                                            onChange={(e) => setSelectedYear(Number(e.target.value))}
                                        />
                                    </div>
                                    <button
                                        onClick={() => window.print()}
                                        className="bg-sky-600 text-white px-4 py-2 rounded-xl shadow-lg shadow-sky-100 hover:bg-sky-700 transition-all active:scale-95 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em]"
                                    >
                                        <FaFileAlt /> Print All
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-sky-50/30">
                                    {canInstitutionWide && isHistoryPage && <th className="p-6 w-12 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-sky-50"><div className="flex justify-center">Select</div></th>}
                                    {!isPersonalView && <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-sky-50">Employee</th>}
                                    {isPersonalView && <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-sky-50">Period</th>}
                                    <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-sky-50 text-right">With/Without Pay</th>
                                    <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-sky-50 text-right">Gross</th>
                                    <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-sky-50 text-right">Deductions</th>
                                    <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-sky-50 text-right">Net</th>
                                    <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-sky-50 text-center">Status</th>
                                    <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-sky-50 text-center">Actions</th>
                                </tr>
                            </thead>
                        <tbody>
                            <AnimatePresence mode="popLayout">
                                {!loading && filteredRows.map((r, idx) => (
                                <motion.tr
                                    key={r.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.98 }}
                                    transition={{ delay: idx * 0.03 }}
                                    className="hover:bg-sky-50/20 transition-all group border-b border-sky-50/10"
                                >
                                    {canInstitutionWide && isHistoryPage && (
                                        <td className="p-6">
                                            <div className="flex justify-center">
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 rounded border-sky-200 text-sky-600 focus:ring-sky-500 cursor-pointer"
                                                    checked={selectedIds.includes(r.id)}
                                                    onChange={() => setSelectedIds((prev) => prev.includes(r.id) ? prev.filter((x) => x !== r.id) : [...prev, r.id])}
                                                />
                                            </div>
                                        </td>
                                    )}
                                    {!isPersonalView && (
                                        <td className="p-6">
                                            <div>
                                                <p className="text-sm font-black text-gray-800 tracking-tight">{r.name}</p>
                                                <div className="flex flex-wrap gap-2 items-center mt-1">
                                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]"><span className="text-sky-500 font-black">{r.emp_id}</span></p>
                                                    {r.department_name && (
                                                        <>
                                                            <span className="h-1 w-1 bg-gray-300 rounded-full"></span>
                                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]"><span className="text-gray-600 font-black">{r.department_name}</span></p>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                    )}
                                    {isPersonalView && (
                                        <td className="p-6">
                                            <span className="text-sm font-bold text-gray-700 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100 whitespace-nowrap">{r.from_date || '-'} to {r.to_date || '-'}</span>
                                        </td>
                                    )}
                                    <td className="p-6 text-right">
                                        <div className="flex flex-col items-end gap-1">
                                            <span className="text-sm font-black text-emerald-600">{Number(r.total_present || r.with_pay_count || 0).toFixed(1)} <span className="text-[9px] text-gray-400 uppercase">Paid</span></span>
                                            <span className="text-sm font-black text-rose-600">{Number(r.total_lop || r.without_pay_count || 0).toFixed(1)} <span className="text-[9px] text-gray-400 uppercase">Unpaid</span></span>
                                        </div>
                                    </td>
                                    <td className="p-6 text-right">
                                        <span className="text-sm font-bold text-gray-700 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100 whitespace-nowrap">Rs {toCurrency(r.gross_salary || r.monthly_salary || 0)}</span>
                                    </td>
                                    <td className="p-6 text-right">
                                        <span className="text-sm font-bold text-rose-600 bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-100 whitespace-nowrap">Rs {toCurrency(r.deductions_applied || 0)}</span>
                                    </td>
                                    <td className="p-6 text-right">
                                        <span className="text-sm font-black text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 whitespace-nowrap">Rs {toCurrency(r.calculated_salary || 0)}</span>
                                    </td>
                                    <td className="p-6 text-center">
                                        {String(r.status).toLowerCase() === 'paid' ? (
                                            <span className="inline-block text-[9px] font-black uppercase tracking-[0.1em] px-4 py-1.5 rounded-xl border-2 shadow-sm bg-emerald-600 text-white border-emerald-600">Paid</span>
                                        ) : (
                                            <span className="inline-block text-[9px] font-black uppercase tracking-[0.1em] px-4 py-1.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 animate-pulse">Pending</span>
                                        )}
                                    </td>
                                    <td className="p-6">
                                        <div className="flex justify-center gap-2">
                                            {!isPersonalView && (
                                                <button
                                                    onClick={() => window.print()}
                                                    className="h-10 w-10 bg-sky-50 text-sky-600 rounded-xl hover:bg-sky-600 hover:text-white transition-all active:scale-95 group/btn"
                                                    title="Print"
                                                >
                                                    <FaFileAlt className="group-hover/btn:scale-125 transition-transform" />
                                                </button>
                                            )}
                                            {canInstitutionWide && (
                                                <button
                                                    onClick={() => navigate(`/${user.role}/payroll/employee/${encodeURIComponent(normalizeEmpId(r.emp_id))}`)}
                                                    className="h-10 w-10 bg-sky-50 text-sky-600 rounded-xl hover:bg-sky-600 hover:text-white transition-all active:scale-95 group/btn"
                                                    title="View employee salary page"
                                                >
                                                    <FaSearch className="group-hover/btn:scale-125 transition-transform" />
                                                </button>
                                            )}
                                            {isPersonalView && (
                                                <button
                                                    onClick={handleSubmitReport}
                                                    className="bg-sky-600 text-white px-8 py-4 rounded-2xl shadow-xl shadow-sky-100 hover:bg-sky-700 transition-all active:scale-95 text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2"
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
                                                        className="h-10 w-10 bg-sky-50 text-sky-600 rounded-xl hover:bg-sky-600 hover:text-white transition-all active:scale-95 group/btn"
                                                        title="Mark paid"
                                                    >
                                                        <FaCheckCircle className="group-hover/btn:scale-125 transition-transform" />
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
                                                        className="h-10 w-10 bg-sky-50 text-sky-600 rounded-xl hover:bg-sky-600 hover:text-white transition-all active:scale-95 group/btn"
                                                        title="Mark unpaid"
                                                    >
                                                        <FaTimesCircle className="group-hover/btn:scale-125 transition-transform" />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </motion.tr>
                            ))}
                            </AnimatePresence>

                            {loading && (
                                        <tr>
                                            <td colSpan={canInstitutionWide && isHistoryPage ? 8 : 7} className="p-32 text-center text-gray-500">
                                                <div className="flex flex-col items-center gap-4">
                                                    <div className="h-14 w-14 border-4 border-sky-100 border-t-sky-600 rounded-full animate-spin"></div>
                                                    <p className="text-[10px] font-black text-sky-500 uppercase tracking-[0.2em] mt-2">Loading payroll records...</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}

                                    {!loading && filteredRows.length === 0 && (
                                        <tr>
                                            <td colSpan={canInstitutionWide && isHistoryPage ? 8 : 7} className="p-32 text-center">
                                                <div className="flex flex-col items-center gap-6 opacity-20 grayscale">
                                                    <FaMoneyBillWave size={64} className="text-gray-400" />
                                                    <div>
                                                        <p className="text-xl font-black text-gray-800 tracking-tight">No Records</p>
                                                        <p className="text-sm font-bold uppercase tracking-[0.2em] text-gray-400 mt-1">No salary records found for this view.</p>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>

                <div className="mt-4 text-xs text-gray-500">
                    <FaMoneyBillWave className="inline mr-1" />
                    Period logic: fixed payroll cycle uses date range 26 to 25.
                </div>
            </motion.div>
        </Layout>
    );
};

export default SalaryManagement;
