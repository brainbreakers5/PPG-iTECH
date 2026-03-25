import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import api from '../../utils/api';
import Swal from 'sweetalert2';
import { runPrintWindow } from '../../utils/printUtils';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FaCheckCircle,
    FaClock,
    FaCog,
    FaEnvelope,
    FaFileAlt,
    FaFilter,
    FaHistory,
    FaMoneyBillWave,
    FaPaperPlane,
    FaRedoAlt,
    FaSearch,
    FaTimesCircle,
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
const getTodayIso = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const normalizeEmpId = (v) => String(v || '').trim().toLowerCase();
const normalizeDateOnly = (v) => {
    if (!v) return '';
    const raw = String(v);
    return raw.includes('T') ? raw.slice(0, 10) : raw;
};
const getWorkingDaysFromRange = (fromDate, toDate) => {
    if (!fromDate || !toDate) return 0;
    const from = new Date(fromDate);
    const to = new Date(toDate);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) return 0;

    let workingDays = 0;
    const cursor = new Date(from);
    while (cursor <= to) {
        const day = cursor.getDay();
        if (day !== 0 && day !== 6) workingDays += 1;
        cursor.setDate(cursor.getDate() + 1);
    }
    return workingDays;
};
const parseDeductionItems = (raw) => {
    if (!raw) return [];
    try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!Array.isArray(parsed)) return [];
        return parsed
            .map((item) => {
                const label = String(item?.type || item?.name || item?.label || 'Deduction').trim();
                const amount = Number(item?.amount ?? item?.value ?? item?.deductionAmount ?? item?.deduction_amount ?? 0) || 0;
                return { label, amount };
            })
            .filter((item) => item.label && item.amount > 0);
    } catch {
        return [];
    }
};

const getMonthlyPfAmountFromLabel = (label, fallbackAmount) => {
    const safeLabel = String(label || '');
    const safeFallbackAmount = Number(fallbackAmount || 0) || 0;

    // New format: PF Basic: X, PF Deduction % Per Month: Y%
    const basicMatch = safeLabel.match(/pf\s*basic\s*:\s*(\d+(?:\.\d+)?)/i);
    const monthlyRateMatch = safeLabel.match(/pf\s*deduction\s*%\s*per\s*month\s*:\s*(\d+(?:\.\d+)?)\s*%/i);
    if (basicMatch && monthlyRateMatch) {
        const basic = Number(basicMatch[1] || 0);
        const monthlyRate = Number(monthlyRateMatch[1] || 0);
        if (Number.isFinite(basic) && Number.isFinite(monthlyRate) && basic > 0 && monthlyRate >= 0) {
            return (basic * monthlyRate) / 100;
        }
    }

    // Legacy format fallback: PF Basic with percentage in label.
    const legacyBasicMatch = safeLabel.match(/pf\s*basic\s*[:=]?\s*(\d+(?:\.\d+)?)/i);
    const anyPercentMatch = safeLabel.match(/(\d+(?:\.\d+)?)\s*%/);
    if (legacyBasicMatch && anyPercentMatch) {
        const basic = Number(legacyBasicMatch[1] || 0);
        const rate = Number(anyPercentMatch[1] || 0);
        if (Number.isFinite(basic) && Number.isFinite(rate) && basic > 0 && rate >= 0) {
            return (basic * rate) / 100;
        }
    }

    return safeFallbackAmount;
};

const getDetailedDeductionBreakdown = (raw) => {
    const details = {
        employPf: 0,
        salaryAdvance: 0,
        hostelFoodFees: 0,
        busFees: 0,
        lwf: 0,
        tds: 0,
        other: 0,
        otherLabel: ''
    };

    const items = parseDeductionItems(raw);
    items.forEach((item) => {
        const label = String(item.label || '').toLowerCase();
        const amount = Number(item.amount || 0);
        if (!amount) return;

        if (label.includes('pf')) {
            details.employPf += getMonthlyPfAmountFromLabel(item.label, amount);
            return;
        }
        if (label.includes('salary advance') || label.includes('advance')) {
            details.salaryAdvance += amount;
            return;
        }
        if (label.includes('hostel') || label.includes('food')) {
            details.hostelFoodFees += amount;
            return;
        }
        if (label.includes('bus')) {
            details.busFees += amount;
            return;
        }
        if (label.includes('lwf')) {
            details.lwf += amount;
            return;
        }
        if (label.includes('tds')) {
            details.tds += amount;
            return;
        }

        details.other += amount;
        if (!details.otherLabel) {
            const parsedOtherName = String(item.label || '').split(':').slice(1).join(':').trim();
            details.otherLabel = parsedOtherName;
        }
    });

    return details;
};
const getDeductionBreakdownText = (raw) => {
    const details = getDetailedDeductionBreakdown(raw);
    const lines = [];
    if (details.employPf > 0) lines.push(`Employ PF=${toCurrency(details.employPf)}`);
    if (details.salaryAdvance > 0) lines.push(`Salary Advance=${toCurrency(details.salaryAdvance)}`);
    if (details.hostelFoodFees > 0) lines.push(`Hostel/Food=${toCurrency(details.hostelFoodFees)}`);
    if (details.busFees > 0) lines.push(`Bus Fees=${toCurrency(details.busFees)}`);
    if (details.lwf > 0) lines.push(`LWF=${toCurrency(details.lwf)}`);
    if (details.tds > 0) lines.push(`TDS=${toCurrency(details.tds)}`);
    if (details.other > 0) {
        const otherLabel = details.otherLabel ? `Other (${details.otherLabel})` : 'Other';
        lines.push(`${otherLabel}=${toCurrency(details.other)}`);
    }
    return lines.join(', ');
};
const formatGeneratedAt = () => {
    const now = new Date();
    return `${now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} ${now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
};
const escapeHtml = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const getEarnedSalary = (row) => {
    const gross = Number(row?.gross_salary || row?.monthly_salary || 0);
    const totalDays = Number(row?.total_days_in_period || 0);
    const payableDays = Number(row?.with_pay_count ?? row?.total_present ?? 0);
    if (!Number.isFinite(gross) || gross <= 0) return 0;
    if (!Number.isFinite(totalDays) || totalDays <= 0) return gross;
    const normalizedPayable = Math.max(0, Math.min(totalDays, payableDays));
    return (gross / totalDays) * normalizedPayable;
};

const BASIC_SALARY_PERCENT = 55.2;
const PERFORMANCE_PERCENT = 36.8;
const CONVEYANCE_PERCENT = 8;

const getSalaryConceptSplit = (amount) => {
    const safeAmount = Number(amount || 0);
    if (!Number.isFinite(safeAmount) || safeAmount <= 0) {
        return { basicSalary: 0, performance: 0, conveyance: 0 };
    }

    // Use paise-level math to keep split totals accurate after rounding.
    const amountInPaise = Math.round(safeAmount * 100);
    const basicInPaise = Math.round((amountInPaise * BASIC_SALARY_PERCENT) / 100);
    const performanceInPaise = Math.round((amountInPaise * PERFORMANCE_PERCENT) / 100);
    const conveyanceInPaise = amountInPaise - basicInPaise - performanceInPaise;

    return {
        basicSalary: basicInPaise / 100,
        performance: performanceInPaise / 100,
        conveyance: conveyanceInPaise / 100
    };
};

const getEarnedSalaryConceptSplit = (earnedSalary) => getSalaryConceptSplit(earnedSalary);

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
    const [liveDaily, setLiveDaily] = useState(null);
    const [loading, setLoading] = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);
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
    const refreshOnReturnRef = useRef(true);
    const autoRefreshInFlightRef = useRef(false);

    const filteredRows = useMemo(() => {
        return rows.filter((r) => {
            const roleValue = String(r.role || '').toLowerCase();
            const roleMatch = activeRole === 'all' || roleValue === activeRole;
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

    const cycleWorkingDays = useMemo(() => {
        return getWorkingDaysFromRange(selectedCycle.fromDate, selectedCycle.toDate);
    }, [selectedCycle]);

    const livePersonalOverview = useMemo(() => {
        if (!isPersonalView || !rows.length) return null;

        const currentCycleRecord = rows.find((r) => (
            normalizeDateOnly(r.from_date) === normalizeDateOnly(selectedCycle.fromDate)
            && normalizeDateOnly(r.to_date) === normalizeDateOnly(selectedCycle.toDate)
        ));
        const liveRow = currentCycleRecord || rows[0];
        if (!liveRow) return null;

        return {
            gross: Number(liveRow.gross_salary || liveRow.monthly_salary || 0),
            deductions: Number(liveRow.deductions_applied || 0),
            net: Number(liveRow.calculated_salary || 0),
            paidDays: Number(liveRow.total_present || liveRow.with_pay_count || 0),
            unpaidDays: Number(liveRow.total_lop || liveRow.without_pay_count || 0),
            workingDays: Number(liveRow.total_days_in_period || 0) || cycleWorkingDays,
            fromDate: liveRow.from_date || selectedCycle.fromDate,
            toDate: liveRow.to_date || selectedCycle.toDate,
            deductionBreakdown: getDeductionBreakdownText(liveRow.deductions)
        };
    }, [isPersonalView, rows, selectedCycle, cycleWorkingDays]);

    const liveDailyOverview = useMemo(() => {
        if (!isPersonalView || !liveDaily) return null;
        const todayIso = getTodayIso();
        const todayRow = Array.isArray(liveDaily.breakdown)
            ? liveDaily.breakdown.find((d) => normalizeDateOnly(d?.date) === todayIso)
            : null;

        return {
            dailyRate: Number(liveDaily.daily_rate || 0),
            earnedToDate: Number(liveDaily.total_gross || 0),
            todayEarned: Number(todayRow?.net_earned || todayRow?.gross_earned || 0),
            todayStatus: String(todayRow?.status || 'N/A')
        };
    }, [isPersonalView, liveDaily]);

    const refreshRows = async () => {
        setLoading(true);
        try {
            if (isPersonalView) {
                const [{ data: currentCycleRows }, dailyRes] = await Promise.all([
                    api.get(`/salary?month=${currentCycle.month}&year=${currentCycle.year}&fromDate=${currentCycle.fromDate}&toDate=${currentCycle.toDate}`),
                    user?.emp_id
                        ? api.get(`/salary/daily?emp_id=${encodeURIComponent(user.emp_id)}&fromDate=${currentCycle.fromDate}&toDate=${currentCycle.toDate}`)
                            .catch(() => ({ data: null }))
                        : Promise.resolve({ data: null })
                ]);

                const currentRows = Array.isArray(currentCycleRows) ? currentCycleRows : [];
                const myCurrent = currentRows.find((r) => normalizeEmpId(r.emp_id) === normalizeEmpId(user?.emp_id));
                setRows(myCurrent ? [myCurrent] : []);
                setLiveDaily(dailyRes?.data || null);
                setHasLoaded(true);
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
            setLiveDaily(null);
            setHasLoaded(true);
        } catch (error) {
            console.error('Failed to fetch salaries:', error);
            setRows([]);
            setLiveDaily(null);
        } finally {
            setLoading(false);
        }
    };

    const handleRefreshRows = async () => {
        if (canInstitutionWide && !isHistoryPage && !isPersonalView) {
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
                console.error('Manual calculate failed:', error?.response?.data || error.message);
            }
        }
        await refreshRows();
    };

    useEffect(() => {
        let mounted = true;

        const triggerAutoRefreshOnce = async () => {
            if (!mounted || autoRefreshInFlightRef.current || !refreshOnReturnRef.current) return;
            autoRefreshInFlightRef.current = true;
            refreshOnReturnRef.current = false;
            try {
                // One-time fast refresh when user lands/returns to this page.
                await refreshRows();
            } finally {
                autoRefreshInFlightRef.current = false;
            }
        };

        const markRefreshNeeded = () => {
            refreshOnReturnRef.current = true;
        };

        const onVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                markRefreshNeeded();
                return;
            }
            triggerAutoRefreshOnce();
        };

        // Route switch to any payroll page should refresh once automatically.
        markRefreshNeeded();
        triggerAutoRefreshOnce();

        document.addEventListener('visibilitychange', onVisibilityChange);

        return () => {
            mounted = false;
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.pathname]);

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
            title: 'Attendance Status Calculations',
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
                    <p class="text-xs text-sky-600 mt-2 font-semibold">Salary Concept: Basic Salary (55.2% of Earned Salary), Performance (36.8% of Earned Salary), Conveyance (8% of Earned Salary).</p>
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
                    await handleRefreshRows();
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

    const printPaymentSlip = async (row) => {
        const gross = Number(row.gross_salary || row.monthly_salary || 0);
        const grossConcept = getSalaryConceptSplit(gross);
        const earnedSalary = getEarnedSalary(row);
        const salaryConcept = getEarnedSalaryConceptSplit(earnedSalary);
        const deduction = Number(row.deductions_applied || 0);
        const net = Number(row.calculated_salary || 0);
        const withPay = Number(row.total_present || row.with_pay_count || 0).toFixed(1);
        const withoutPay = Number(row.total_lop || row.without_pay_count || 0).toFixed(1);
        const breakdown = getDetailedDeductionBreakdown(row.deductions);
        const deductionRows = [
            { label: 'Employ PF', amount: breakdown.employPf },
            { label: 'Salary Advance', amount: breakdown.salaryAdvance },
            { label: 'Hostel and Food Fees', amount: breakdown.hostelFoodFees },
            { label: 'Bus Fees', amount: breakdown.busFees },
            { label: 'LWF', amount: breakdown.lwf },
            { label: 'TDS', amount: breakdown.tds },
            {
                label: breakdown.otherLabel ? `Other (${breakdown.otherLabel})` : 'Other',
                amount: breakdown.other
            }
        ].filter((item) => Number(item.amount || 0) > 0);
        const deductionRowsHtml = deductionRows.length
            ? deductionRows.map((item) => `<tr><td>${escapeHtml(item.label)}</td><td class="right">${toCurrency(item.amount)}</td></tr>`).join('')
            : '<tr><td>Deductions</td><td class="right">0</td></tr>';
        const generatedAt = formatGeneratedAt();

        const html = `
            <html>
                <head>
                    <title>Payment Slip - ${escapeHtml(row.name)}</title>
                    <style>
                        @page { size: A4; margin: 10mm; }
                        * { box-sizing: border-box; }
                        body { font-family: Arial, sans-serif; margin: 0; color: #0f172a; }
                        .slip {
                            border: 2px solid #dbeafe;
                            border-radius: 16px;
                            padding: 18px;
                            background: linear-gradient(180deg, #f8fbff 0%, #ffffff 100%);
                        }
                        .page-head {
                            display: flex;
                            justify-content: space-between;
                            align-items: flex-start;
                            margin-bottom: 12px;
                        }
                        .head-center {
                            text-align: center;
                            font-size: 18px;
                            font-weight: 900;
                            letter-spacing: 0.05em;
                            color: #0f172a;
                            flex: 1;
                        }
                        .brand-right {
                            text-align: right;
                            font-size: 10px;
                            font-weight: 700;
                            color: #334155;
                            line-height: 1.4;
                            min-width: 190px;
                        }
                        .head {
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            gap: 12px;
                            border-bottom: 1px dashed #bfdbfe;
                            padding-bottom: 12px;
                            margin-bottom: 14px;
                        }
                        .title { font-weight: 900; letter-spacing: 0.04em; font-size: 24px; margin: 0; }
                        .meta { font-size: 12px; color: #475569; margin-top: 4px; }
                        .chip { font-size: 11px; font-weight: 700; background: #e0f2fe; color: #0369a1; padding: 6px 10px; border-radius: 999px; border: 1px solid #bae6fd; }
                        .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-bottom: 12px; }
                        .box { border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px; background: #fff; }
                        .lbl { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.12em; font-weight: 700; }
                        .val { font-size: 14px; font-weight: 800; margin-top: 4px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
                        th, td { border: 1px solid #e2e8f0; padding: 10px; font-size: 12px; text-align: left; }
                        th { background: #eff6ff; text-transform: uppercase; letter-spacing: 0.08em; font-size: 10px; }
                        .right { text-align: right; }
                        .footer { margin-top: 12px; font-size: 10px; color: #64748b; }
                    </style>
                </head>
                <body>
                    <div class="slip">
                        <div class="page-head">
                            <div></div>
                            <div class="head-center">PPG MANAGEMENT SALARY</div>
                            <div class="brand-right">
                                <div>PPG EMP HUB</div>
                                <div>Generated: ${escapeHtml(generatedAt)}</div>
                                <div>Payroll Payment Slip</div>
                            </div>
                        </div>
                        <div class="head">
                            <div>
                                <p class="title">Payment Slip</p>
                                <p class="meta">${escapeHtml(row.from_date || selectedCycle.fromDate)} to ${escapeHtml(row.to_date || selectedCycle.toDate)}</p>
                            </div>
                            <span class="chip">${escapeHtml(String(row.status || 'Pending'))}</span>
                        </div>

                        <div class="grid">
                            <div class="box"><div class="lbl">Employee</div><div class="val">${escapeHtml(row.name)}</div></div>
                            <div class="box"><div class="lbl">Employee ID</div><div class="val">${escapeHtml(row.emp_id)}</div></div>
                            <div class="box"><div class="lbl">Department</div><div class="val">${escapeHtml(row.department_name || '-')}</div></div>
                            <div class="box"><div class="lbl">Role</div><div class="val">${escapeHtml(row.role || '-')}</div></div>
                        </div>

                        <table>
                            <thead>
                                <tr>
                                    <th>Description</th>
                                    <th class="right">Amount (Rs)</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr><td>With Pay / Without Pay Days</td><td class="right">${withPay} / ${withoutPay}</td></tr>
                                <tr><td>Gross Salary (Basic + Performance + Conveyance)</td><td class="right">${toCurrency(gross)}</td></tr>
                                <tr><td>Gross Basic Salary (55.2%)</td><td class="right">${toCurrency(grossConcept.basicSalary)}</td></tr>
                                <tr><td>Gross Performance (36.8%)</td><td class="right">${toCurrency(grossConcept.performance)}</td></tr>
                                <tr><td>Gross Conveyance (8%)</td><td class="right">${toCurrency(grossConcept.conveyance)}</td></tr>
                                <tr><td>Earned Salary</td><td class="right">${toCurrency(earnedSalary)}</td></tr>
                                <tr><td>Basic Salary (55.2% of Earned)</td><td class="right">${toCurrency(salaryConcept.basicSalary)}</td></tr>
                                <tr><td>Performance (36.8% of Earned)</td><td class="right">${toCurrency(salaryConcept.performance)}</td></tr>
                                <tr><td>Conveyance (8% of Earned)</td><td class="right">${toCurrency(salaryConcept.conveyance)}</td></tr>
                                ${deductionRowsHtml}
                                <tr><td>Total Deductions</td><td class="right">${toCurrency(deduction)}</td></tr>
                                <tr><td>Net Salary</td><td class="right">${toCurrency(net)}</td></tr>
                            </tbody>
                        </table>

                        <p class="footer">Generated from Salary Records.</p>
                    </div>
                </body>
            </html>
        `;

        await runPrintWindow({
            title: `Payment Slip - ${row.name}`,
            html,
            windowFeatures: 'width=900,height=900',
            delay: 250,
            modeLabel: 'the payment slip'
        });
    };

    const printAllHistoryRows = async () => {
        const generatedAt = formatGeneratedAt();

        const bodyRows = filteredRows.map((r, index) => `
            ${(() => {
                const detail = getDetailedDeductionBreakdown(r.deductions);
                const monthlyFixed = Number(r.monthly_salary || r.gross_salary || 0);
                const grossSalary = Number(r.gross_salary || r.monthly_salary || 0);
                const earnedSalary = getEarnedSalary(r);
                const salaryConcept = getEarnedSalaryConceptSplit(earnedSalary);
                const totalDeductions = Number(r.deductions_applied || 0);
                const netSalary = Number(r.calculated_salary || 0);
                const otherLabel = detail.otherLabel ? `Other (${detail.otherLabel})` : 'Other';
                return `
            <tr>
                <td>${index + 1}</td>
                <td>${escapeHtml(r.name)}</td>
                <td>${escapeHtml(r.emp_id)}</td>
                <td>${escapeHtml(r.department_name || '-')}</td>
                <td class="right">${toCurrency(monthlyFixed)}</td>
                <td class="right">${toCurrency(grossSalary)}</td>
                <td class="right">${toCurrency(earnedSalary)}</td>
                <td class="right">${toCurrency(salaryConcept.basicSalary)}</td>
                <td class="right">${toCurrency(salaryConcept.performance)}</td>
                <td class="right">${toCurrency(salaryConcept.conveyance)}</td>
                <td class="right">${toCurrency(detail.employPf)}</td>
                <td class="right">${toCurrency(detail.salaryAdvance)}</td>
                <td class="right">${toCurrency(detail.hostelFoodFees)}</td>
                <td class="right">${toCurrency(detail.busFees)}</td>
                <td class="right">${toCurrency(detail.lwf)}</td>
                <td class="right">${toCurrency(detail.tds)}</td>
                <td class="right" title="${escapeHtml(otherLabel)}">${toCurrency(detail.other)}</td>
                <td class="right">${toCurrency(totalDeductions)}</td>
                <td class="right">${toCurrency(netSalary)}</td>
                <td>${escapeHtml(String(r.status || 'Pending'))}</td>
            </tr>
                `;
            })()}
        `).join('');

        const html = `
            <html>
                <head>
                    <title>Salary History - All Employees</title>
                    <style>
                        @page { size: A4 portrait; margin: 8mm; }
                        * { box-sizing: border-box; }
                        body { font-family: Arial, sans-serif; margin: 0; color: #111827; }
                        .wrap { width: 100%; }
                        .head { margin-bottom: 10px; }
                        .title { margin: 0; font-size: 20px; font-weight: 900; letter-spacing: 0.03em; }
                        .sub { margin-top: 4px; font-size: 11px; color: #4b5563; }
                        .brand-right { text-align: right; font-size: 10px; font-weight: 700; color: #334155; line-height: 1.4; margin-bottom: 8px; }
                        table { width: 100%; border-collapse: collapse; }
                        thead { display: table-header-group; }
                        tr { page-break-inside: avoid; }
                        th, td { border: 1px solid #dbeafe; padding: 7px; font-size: 10px; vertical-align: top; }
                        th { background: #eff6ff; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 800; }
                        .right { text-align: right; }
                    </style>
                </head>
                <body>
                    <div class="wrap">
                        <div class="brand-right">
                            <div>PPG EMP HUB</div>
                            <div>Generated: ${escapeHtml(generatedAt)}</div>
                            <div>Salary History Records</div>
                        </div>
                        <div class="head">
                            <p class="title">Salary History Records</p>
                            <p class="sub">Cycle: ${escapeHtml(selectedCycle.fromDate)} to ${escapeHtml(selectedCycle.toDate)} | Total Employees: ${filteredRows.length}</p>
                        </div>
                        <table>
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Employee</th>
                                    <th>Emp ID</th>
                                    <th>Department</th>
                                    <th class="right">Monthly Salary (Fixed)</th>
                                    <th class="right">Gross Salary (Basic + Performance + Conveyance)</th>
                                    <th class="right">Earned Salary</th>
                                    <th class="right">Basic Salary (55.2%)</th>
                                    <th class="right">Performance (36.8%)</th>
                                    <th class="right">Conveyance (8%)</th>
                                    <th class="right">Employ PF</th>
                                    <th class="right">Salary Advance</th>
                                    <th class="right">Hostel/Food Fees</th>
                                    <th class="right">Bus Fees</th>
                                    <th class="right">LWF</th>
                                    <th class="right">TDS</th>
                                    <th class="right">Other</th>
                                    <th class="right">Total Deductions</th>
                                    <th class="right">Net Salary</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>${bodyRows}</tbody>
                        </table>
                    </div>
                </body>
            </html>
        `;

        await runPrintWindow({
            title: 'Salary History - All Employees',
            html,
            windowFeatures: 'width=1100,height=900',
            delay: 250,
            modeLabel: 'the salary history report'
        });
    };

    const reportCurrentSalaryRows = async () => {
        if (!filteredRows.length) {
            Swal.fire('No Data', 'No salary records available for this report.', 'info');
            return;
        }

        const generatedAt = formatGeneratedAt();
        const bodyRows = filteredRows.map((r, index) => `
            ${(() => {
                const detail = getDetailedDeductionBreakdown(r.deductions);
                const otherLabel = detail.otherLabel ? `Other (${detail.otherLabel})` : 'Other';
                const earnedSalary = getEarnedSalary(r);
                const salaryConcept = getEarnedSalaryConceptSplit(earnedSalary);
                return `
            <tr>
                <td>${index + 1}</td>
                <td>${escapeHtml(r.name)}</td>
                <td>${escapeHtml(r.emp_id)}</td>
                <td>${escapeHtml(r.department_name || '-')}</td>
                <td class="right">${toCurrency(r.monthly_salary || r.gross_salary || 0)}</td>
                <td class="right">${toCurrency(r.gross_salary || r.monthly_salary || 0)}</td>
                <td class="right">${toCurrency(earnedSalary)}</td>
                <td class="right">${toCurrency(salaryConcept.basicSalary)}</td>
                <td class="right">${toCurrency(salaryConcept.performance)}</td>
                <td class="right">${toCurrency(salaryConcept.conveyance)}</td>
                <td class="right">${toCurrency(detail.employPf)}</td>
                <td class="right">${toCurrency(detail.salaryAdvance)}</td>
                <td class="right">${toCurrency(detail.hostelFoodFees)}</td>
                <td class="right">${toCurrency(detail.busFees)}</td>
                <td class="right">${toCurrency(detail.lwf)}</td>
                <td class="right">${toCurrency(detail.tds)}</td>
                <td class="right" title="${escapeHtml(otherLabel)}">${toCurrency(detail.other)}</td>
                <td class="right">${toCurrency(r.deductions_applied || 0)}</td>
                <td class="right">${toCurrency(r.calculated_salary || 0)}</td>
                <td>${escapeHtml(String(r.status || 'Pending'))}</td>
            </tr>
                `;
            })()}
        `).join('');

        const html = `
            <html>
                <head>
                    <title>Salary Records Report</title>
                    <style>
                        @page { size: A4 landscape; margin: 8mm; }
                        * { box-sizing: border-box; }
                        body { font-family: Arial, sans-serif; margin: 0; color: #111827; }
                        .wrap { width: 100%; }
                        .head { margin-bottom: 10px; }
                        .title { margin: 0; font-size: 20px; font-weight: 900; letter-spacing: 0.03em; }
                        .sub { margin-top: 4px; font-size: 11px; color: #4b5563; }
                        .brand-right { text-align: right; font-size: 10px; font-weight: 700; color: #334155; line-height: 1.4; margin-bottom: 8px; }
                        table { width: 100%; border-collapse: collapse; }
                        thead { display: table-header-group; }
                        tr { page-break-inside: avoid; }
                        th, td { border: 1px solid #dbeafe; padding: 7px; font-size: 10px; vertical-align: top; }
                        th { background: #eff6ff; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 800; }
                        .right { text-align: right; }
                    </style>
                </head>
                <body>
                    <div class="wrap">
                        <div class="brand-right">
                            <div>PPG EMP HUB</div>
                            <div>Generated: ${escapeHtml(generatedAt)}</div>
                            <div>Salary Records</div>
                        </div>
                        <div class="head">
                            <p class="title">Salary Records Report</p>
                            <p class="sub">Cycle: ${escapeHtml(selectedCycle.fromDate)} to ${escapeHtml(selectedCycle.toDate)} | Total Employees: ${filteredRows.length}</p>
                        </div>
                        <table>
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Employee</th>
                                    <th>Emp ID</th>
                                    <th>Department</th>
                                    <th class="right">Monthly Salary (Fixed)</th>
                                    <th class="right">Gross Salary (Basic + Performance + Conveyance)</th>
                                    <th class="right">Earned Salary</th>
                                    <th class="right">Basic Salary (55.2%)</th>
                                    <th class="right">Performance (36.8%)</th>
                                    <th class="right">Conveyance (8%)</th>
                                    <th class="right">Employ PF</th>
                                    <th class="right">Salary Advance</th>
                                    <th class="right">Hostel/Food Fees</th>
                                    <th class="right">Bus Fees</th>
                                    <th class="right">LWF</th>
                                    <th class="right">TDS</th>
                                    <th class="right">Other</th>
                                    <th class="right">Total Deductions</th>
                                    <th class="right">Net Salary</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>${bodyRows}</tbody>
                        </table>
                    </div>
                </body>
            </html>
        `;

        await runPrintWindow({
            title: 'Salary Records Report',
            html,
            windowFeatures: 'width=1200,height=900',
            delay: 250,
            modeLabel: 'the salary records report'
        });
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
        await handleRefreshRows();

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

    useEffect(() => {
        if (!isHistoryPage) {
            setSelectedIds([]);
        }
    }, [isHistoryPage]);

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
                                ? 'Your own salary for the exact current payroll month is shown here with live updates.'
                                : isHistoryPage
                                    ? 'Select period by month and year using fixed cycle 26 to 25.'
                                    : 'Current live payroll period is fixed and not editable.'}
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-4">
                        <button
                            onClick={handleRefreshRows}
                            className="bg-white text-sky-600 border border-sky-200 px-8 py-4 rounded-2xl shadow-xl shadow-sky-50 hover:bg-sky-50 transition-all active:scale-95 flex items-center font-black uppercase tracking-[0.2em] text-[10px]"
                            title="Refresh salary records"
                        >
                            <FaRedoAlt className={`mr-3 transition-transform ${loading ? 'animate-spin' : ''}`} /> Refresh
                        </button>
                        {isAdmin && !isHistoryPage && (
                            <button
                                onClick={openAttendanceConfig}
                                className="bg-sky-600 text-white px-8 py-4 rounded-2xl shadow-xl shadow-sky-100 hover:bg-sky-700 transition-all active:scale-95 flex items-center font-black uppercase tracking-[0.2em] text-[10px]"
                            >
                                <FaCog className="mr-3 group-hover:-rotate-12 transition-transform" /> Calculations
                            </button>
                        )}
                        {canInstitutionWide && (
                            <>
                                {!isHistoryPage && (
                                    <>
                                        <button
                                            onClick={reportCurrentSalaryRows}
                                            className="bg-sky-600 text-white px-8 py-4 rounded-2xl shadow-xl shadow-sky-100 hover:bg-sky-700 transition-all active:scale-95 flex items-center font-black uppercase tracking-[0.2em] text-[10px]"
                                        >
                                            <FaFileAlt className="mr-3 group-hover:scale-110 transition-transform" /> Report
                                        </button>
                                        <button
                                            onClick={() => navigate(`/${user.role}/payroll/history`)}
                                            className="bg-sky-600 text-white px-8 py-4 rounded-2xl shadow-xl shadow-sky-100 hover:bg-sky-700 transition-all active:scale-95 flex items-center font-black uppercase tracking-[0.2em] text-[10px]"
                                        >
                                            <FaHistory className="mr-3 group-hover:-rotate-12 transition-transform" /> History
                                        </button>
                                        <button
                                            onClick={() => navigate(`/${user.role}/payroll/reports`)}
                                            className="bg-sky-600 text-white px-8 py-4 rounded-2xl shadow-xl shadow-sky-100 hover:bg-sky-700 transition-all active:scale-95 flex items-center font-black uppercase tracking-[0.2em] text-[10px]"
                                        >
                                            <FaEnvelope className="mr-3 group-hover:scale-110 transition-transform" /> Reports
                                        </button>
                                    </>
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

                {isPersonalView && livePersonalOverview && (
                    <motion.div variants={staggerWrap} className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
                        <motion.div variants={fadeUp} transition={{ duration: 0.35 }} className="modern-card p-5 border-sky-50">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Live Gross</p>
                            <p className="mt-2 text-xl font-black text-gray-800 tracking-tighter">Rs {toCurrency(livePersonalOverview.gross)}</p>
                            <p className="text-[10px] font-bold text-gray-400 mt-2">{livePersonalOverview.fromDate} to {livePersonalOverview.toDate}</p>
                        </motion.div>
                        <motion.div variants={fadeUp} transition={{ duration: 0.35 }} className="modern-card p-5 border-rose-50">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Live Deductions</p>
                            <p className="mt-2 text-xl font-black text-rose-700 tracking-tighter">Rs {toCurrency(livePersonalOverview.deductions)}</p>
                            {livePersonalOverview.deductionBreakdown && (
                                <p className="text-[10px] font-bold text-rose-500 mt-2 uppercase tracking-[0.08em]">{livePersonalOverview.deductionBreakdown}</p>
                            )}
                        </motion.div>
                        <motion.div variants={fadeUp} transition={{ duration: 0.35 }} className="modern-card p-5 border-emerald-50">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Live Net Salary</p>
                            <p className="mt-2 text-xl font-black text-emerald-700 tracking-tighter">Rs {toCurrency(livePersonalOverview.net)}</p>
                            <p className="text-[10px] font-bold text-gray-400 mt-2">Paid {livePersonalOverview.paidDays.toFixed(1)} | Unpaid {livePersonalOverview.unpaidDays.toFixed(1)}</p>
                        </motion.div>
                        <motion.div variants={fadeUp} transition={{ duration: 0.35 }} className="modern-card p-5 border-indigo-50">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Total Working Days</p>
                            <p className="mt-2 text-xl font-black text-indigo-700 tracking-tighter">{livePersonalOverview.workingDays}</p>
                            <p className="text-[10px] font-bold text-gray-400 mt-2">Selected calendar period</p>
                        </motion.div>
                        <motion.div variants={fadeUp} transition={{ duration: 0.35 }} className="modern-card p-5 border-amber-50">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Live Daily Salary</p>
                            <p className="mt-2 text-xl font-black text-amber-700 tracking-tighter">Rs {toCurrency(liveDailyOverview?.dailyRate || 0)}</p>
                            <p className="text-[10px] font-bold text-gray-400 mt-2">Today's earned: Rs {toCurrency(liveDailyOverview?.todayEarned || 0)} ({liveDailyOverview?.todayStatus || 'N/A'})</p>
                        </motion.div>
                    </motion.div>
                )}

                {isPersonalView && liveDailyOverview && (
                    <motion.div
                        variants={fadeUp}
                        transition={{ duration: 0.35 }}
                        className="modern-card p-4 border-amber-100 mb-6"
                    >
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Live Earned So Far In Current Cycle</p>
                        <p className="mt-1 text-lg font-black text-amber-700 tracking-tight">Rs {toCurrency(liveDailyOverview.earnedToDate)}</p>
                    </motion.div>
                )}

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
                                    <span className="px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 normal-case tracking-normal text-xs font-bold">Total Working Days: {cycleWorkingDays}</span>
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
                                        onClick={printAllHistoryRows}
                                        className="bg-sky-600 text-white px-4 py-2 rounded-xl shadow-lg shadow-sky-100 hover:bg-sky-700 transition-all active:scale-95 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em]"
                                    >
                                        <FaFileAlt /> Report All
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                    <div className="px-4 pb-2 md:hidden">
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-gray-400">Swipe left and right to view all salary columns</p>
                    </div>
                    <div className="overflow-x-auto -mx-2 px-2 md:mx-0 md:px-0">
                        <table className="min-w-max w-full text-left border-collapse whitespace-nowrap">
                            <thead>
                                <tr className="bg-sky-50/30">
                                    {canInstitutionWide && isHistoryPage && <th className="p-3 md:p-6 w-12 text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-sky-50 whitespace-nowrap"><div className="flex justify-center">Select</div></th>}
                                    {!isPersonalView && <th className="p-3 md:p-6 text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-sky-50 whitespace-nowrap">Employee</th>}
                                    {isPersonalView && <th className="p-3 md:p-6 text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-sky-50 whitespace-nowrap">Period</th>}
                                    <th className="p-3 md:p-6 text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-sky-50 text-right whitespace-nowrap">With/Without Pay</th>
                                    <th className="p-3 md:p-6 text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-sky-50 text-right whitespace-nowrap">Gross Salary (Basic + Performance + Conveyance)</th>
                                    <th className="p-3 md:p-6 text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-sky-50 text-right whitespace-nowrap">Earned Salary</th>
                                    <th className="p-3 md:p-6 text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-sky-50 text-right whitespace-nowrap">Basic Salary (55.2%)</th>
                                    <th className="p-3 md:p-6 text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-sky-50 text-right whitespace-nowrap">Performance (36.8%)</th>
                                    <th className="p-3 md:p-6 text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-sky-50 text-right whitespace-nowrap">Conveyance (8%)</th>
                                    <th className="p-3 md:p-6 text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-sky-50 text-right whitespace-nowrap">Deductions</th>
                                    <th className="p-3 md:p-6 text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-sky-50 text-right whitespace-nowrap">Net Salary</th>
                                    <th className="p-3 md:p-6 text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-sky-50 text-center whitespace-nowrap">Status</th>
                                    <th className="p-3 md:p-6 text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-sky-50 text-center whitespace-nowrap">Actions</th>
                                </tr>
                            </thead>
                        <tbody>
                            <AnimatePresence mode="popLayout">
                                {!loading && filteredRows.map((r, idx) => {
                                const grossSalary = Number(r.gross_salary || r.monthly_salary || 0);
                                const grossConcept = getSalaryConceptSplit(grossSalary);
                                const earnedSalary = getEarnedSalary(r);
                                const salaryConcept = getEarnedSalaryConceptSplit(earnedSalary);
                                return (
                                <motion.tr
                                    key={r.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.98 }}
                                    transition={{ delay: idx * 0.03 }}
                                    className="hover:bg-sky-50/20 transition-all group border-b border-sky-50/10"
                                >
                                    {canInstitutionWide && isHistoryPage && (
                                        <td className="p-3 md:p-6">
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
                                        <td className="p-3 md:p-6 whitespace-nowrap">
                                            <div className="flex items-center gap-3">
                                                <img
                                                    src={r.profile_pic || r.profile_picture_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(r.name || '?')}&background=0ea5e9&color=fff&bold=true`}
                                                    alt={r.name}
                                                    className="h-8 w-8 md:h-10 md:w-10 rounded-xl object-cover border border-sky-100 shadow-sm"
                                                />
                                                <p className="text-xs md:text-sm font-black text-gray-800 tracking-tight">{r.name} <span className="text-[9px] md:text-[10px] text-sky-500 ml-2">{r.emp_id}</span>{r.department_name ? <span className="text-[9px] md:text-[10px] text-gray-500 ml-2">{r.department_name}</span> : null}</p>
                                            </div>
                                        </td>
                                    )}
                                    {isPersonalView && (
                                        <td className="p-3 md:p-6 whitespace-nowrap">
                                            <span className="text-xs md:text-sm font-bold text-gray-700 bg-gray-50 px-2.5 md:px-3 py-1.5 rounded-lg border border-gray-100 whitespace-nowrap">{r.from_date || '-'} to {r.to_date || '-'}</span>
                                        </td>
                                    )}
                                    <td className="p-3 md:p-6 text-right whitespace-nowrap">
                                        <span className="text-xs md:text-sm font-black text-gray-700">{Number(r.total_present || r.with_pay_count || 0).toFixed(1)} Paid / {Number(r.total_lop || r.without_pay_count || 0).toFixed(1)} Unpaid</span>
                                    </td>
                                    <td className="p-3 md:p-6 text-right whitespace-nowrap" title={`Basic ${toCurrency(grossConcept.basicSalary)} + Performance ${toCurrency(grossConcept.performance)} + Conveyance ${toCurrency(grossConcept.conveyance)}`}>
                                        <span className="text-xs md:text-sm font-bold text-gray-700 bg-gray-50 px-2.5 md:px-3 py-1.5 rounded-lg border border-gray-100 whitespace-nowrap">Rs {toCurrency(r.gross_salary || r.monthly_salary || 0)} (B+P+C)</span>
                                    </td>
                                    <td className="p-3 md:p-6 text-right whitespace-nowrap">
                                        <span className="text-xs md:text-sm font-black text-indigo-700 bg-indigo-50 px-2.5 md:px-3 py-1.5 rounded-lg border border-indigo-100 whitespace-nowrap">Rs {toCurrency(earnedSalary)}</span>
                                    </td>
                                    <td className="p-3 md:p-6 text-right whitespace-nowrap">
                                        <span className="text-xs md:text-sm font-black text-cyan-700 bg-cyan-50 px-2.5 md:px-3 py-1.5 rounded-lg border border-cyan-100 whitespace-nowrap">Rs {toCurrency(salaryConcept.basicSalary)}</span>
                                    </td>
                                    <td className="p-3 md:p-6 text-right whitespace-nowrap">
                                        <span className="text-xs md:text-sm font-black text-violet-700 bg-violet-50 px-2.5 md:px-3 py-1.5 rounded-lg border border-violet-100 whitespace-nowrap">Rs {toCurrency(salaryConcept.performance)}</span>
                                    </td>
                                    <td className="p-3 md:p-6 text-right whitespace-nowrap">
                                        <span className="text-xs md:text-sm font-black text-amber-700 bg-amber-50 px-2.5 md:px-3 py-1.5 rounded-lg border border-amber-100 whitespace-nowrap">Rs {toCurrency(salaryConcept.conveyance)}</span>
                                    </td>
                                    <td className="p-3 md:p-6 text-right whitespace-nowrap" title={getDeductionBreakdownText(r.deductions) || ''}>
                                        <span className="text-xs md:text-sm font-bold text-rose-600 bg-rose-50 px-2.5 md:px-3 py-1.5 rounded-lg border border-rose-100 whitespace-nowrap">Rs {toCurrency(r.deductions_applied || 0)}</span>
                                    </td>
                                    <td className="p-3 md:p-6 text-right whitespace-nowrap">
                                        <span className="text-xs md:text-sm font-black text-emerald-700 bg-emerald-50 px-2.5 md:px-3 py-1.5 rounded-lg border border-emerald-100 whitespace-nowrap">Rs {toCurrency(r.calculated_salary || 0)}</span>
                                    </td>
                                    <td className="p-3 md:p-6 text-center whitespace-nowrap">
                                        {String(r.status).toLowerCase() === 'paid' ? (
                                            <span className="inline-block text-[8px] md:text-[9px] font-black uppercase tracking-[0.1em] px-3 md:px-4 py-1.5 rounded-xl border-2 shadow-sm bg-emerald-600 text-white border-emerald-600">Paid</span>
                                        ) : (
                                            <span className="inline-block text-[8px] md:text-[9px] font-black uppercase tracking-[0.1em] px-3 md:px-4 py-1.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 animate-pulse">Pending</span>
                                        )}
                                    </td>
                                    <td className="p-3 md:p-6 whitespace-nowrap">
                                        <div className="flex justify-center gap-2">
                                            {!isPersonalView && (
                                                <button
                                                    onClick={() => printPaymentSlip(r)}
                                                    className="h-8 w-8 md:h-10 md:w-10 bg-sky-50 text-sky-600 rounded-xl hover:bg-sky-600 hover:text-white transition-all active:scale-95 group/btn"
                                                    title="Payslip"
                                                >
                                                    <FaFileAlt className="group-hover/btn:scale-125 transition-transform" />
                                                </button>
                                            )}
                                            {isPersonalView && (
                                                <button
                                                    onClick={() => printPaymentSlip(r)}
                                                    className="h-8 w-8 md:h-10 md:w-10 bg-sky-50 text-sky-600 rounded-xl hover:bg-sky-600 hover:text-white transition-all active:scale-95 group/btn"
                                                    title="Payslip"
                                                >
                                                    <FaFileAlt className="group-hover/btn:scale-125 transition-transform" />
                                                </button>
                                            )}
                                            {canInstitutionWide && isHistoryPage && (
                                                <button
                                                    onClick={() => navigate(`/${user.role}/payroll/employee/${encodeURIComponent(normalizeEmpId(r.emp_id))}`)}
                                                    className="h-8 w-8 md:h-10 md:w-10 bg-sky-50 text-sky-600 rounded-xl hover:bg-sky-600 hover:text-white transition-all active:scale-95 group/btn"
                                                    title="View employee salary page"
                                                >
                                                    <FaSearch className="group-hover/btn:scale-125 transition-transform" />
                                                </button>
                                            )}
                                            {isPersonalView && (
                                                <button
                                                    onClick={handleSubmitReport}
                                                    className="bg-sky-600 text-white px-4 md:px-8 py-2.5 md:py-4 rounded-2xl shadow-xl shadow-sky-100 hover:bg-sky-700 transition-all active:scale-95 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2"
                                                    title="Report issue"
                                                >
                                                    <FaPaperPlane /> Report
                                                </button>
                                            )}
                                            {canInstitutionWide && isHistoryPage && (
                                                <>
                                                    <button
                                                        disabled={String(r.id).startsWith('history_')}
                                                        onClick={async () => {
                                                            try {
                                                                await updateStatus(r, 'Paid');
                                                                await handleRefreshRows();
                                                                Swal.fire('Success', 'Marked as paid.', 'success');
                                                            } catch (error) {
                                                                console.error(error);
                                                                Swal.fire('Error', error?.response?.data?.message || 'Failed to mark paid.', 'error');
                                                            }
                                                        }}
                                                        className="h-8 w-8 md:h-10 md:w-10 bg-sky-50 text-sky-600 rounded-xl hover:bg-sky-600 hover:text-white transition-all active:scale-95 group/btn disabled:opacity-40 disabled:cursor-not-allowed"
                                                        title="Mark paid"
                                                    >
                                                        <FaCheckCircle className="group-hover/btn:scale-125 transition-transform" />
                                                    </button>
                                                    <button
                                                        onClick={async () => {
                                                            try {
                                                                await updateStatus(r, 'Pending');
                                                                await handleRefreshRows();
                                                                Swal.fire('Success', 'Marked as unpaid.', 'success');
                                                            } catch (error) {
                                                                console.error(error);
                                                                Swal.fire('Error', error?.response?.data?.message || 'Failed to mark unpaid.', 'error');
                                                            }
                                                        }}
                                                        className="h-8 w-8 md:h-10 md:w-10 bg-sky-50 text-sky-600 rounded-xl hover:bg-sky-600 hover:text-white transition-all active:scale-95 group/btn"
                                                        title="Mark unpaid"
                                                    >
                                                        <FaTimesCircle className="group-hover/btn:scale-125 transition-transform" />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </motion.tr>
                                );
                            })}
                            </AnimatePresence>

                            {loading && (
                                        <tr>
                                            <td colSpan={canInstitutionWide && isHistoryPage ? 12 : 11} className="p-16 md:p-32 text-center text-gray-500">
                                                <div className="flex flex-col items-center gap-4">
                                                    <div className="h-14 w-14 border-4 border-sky-100 border-t-sky-600 rounded-full animate-spin"></div>
                                                    <p className="text-[10px] font-black text-sky-500 uppercase tracking-[0.2em] mt-2">Loading payroll records...</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}

                                    {!loading && filteredRows.length === 0 && (
                                        <tr>
                                            <td colSpan={canInstitutionWide && isHistoryPage ? 12 : 11} className="p-16 md:p-32 text-center">
                                                <div className="flex flex-col items-center gap-6 opacity-20 grayscale">
                                                    <FaMoneyBillWave size={64} className="text-gray-400" />
                                                    <div>
                                                        <p className="text-xl font-black text-gray-800 tracking-tight">No Records</p>
                                                        <p className="text-sm font-bold uppercase tracking-[0.2em] text-gray-400 mt-1">{hasLoaded ? 'No salary records found for this view.' : 'Click refresh to load salary records.'}</p>
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
