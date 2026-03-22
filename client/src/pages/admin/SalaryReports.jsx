import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import api from '../../utils/api';
import Swal from 'sweetalert2';
import { FaEnvelopeOpenText, FaReply, FaSearch } from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const SalaryReports = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchReports = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/salary/reports');
            setReports(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Failed to fetch salary reports:', error);
            setReports([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReports();
    }, []);

    const replyToReport = async (report) => {
        const { value } = await Swal.fire({
            title: `Reply to ${report.employee_name || report.emp_id}`,
            input: 'textarea',
            inputPlaceholder: 'Type admin reply...',
            inputValue: report.admin_reply || '',
            showCancelButton: true,
            confirmButtonText: 'Send Reply',
            preConfirm: (v) => {
                const text = String(v || '').trim();
                if (!text) {
                    Swal.showValidationMessage('Reply is required');
                    return null;
                }
                return text;
            }
        });

        if (!value) return;

        try {
            await api.put(`/salary/reports/${report.id}/reply`, { reply: value });
            await fetchReports();
            Swal.fire('Replied', 'Report reply sent successfully.', 'success');
        } catch (error) {
            console.error('Failed to reply report:', error);
            Swal.fire('Error', error?.response?.data?.message || 'Reply failed.', 'error');
        }
    };

    return (
        <Layout>
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                    <div>
                        <h1 className="text-3xl font-black text-gray-800">Salary Reports</h1>
                        <p className="text-sm text-gray-500">Employees can submit salary issues here. Admin can reply directly.</p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => navigate(`/${user.role}/payroll`)}
                            className="px-4 py-2 rounded-lg bg-sky-600 text-white text-sm font-bold"
                        >
                            Back to Payroll
                        </button>
                    </div>
                </div>

                <div className="bg-white rounded-xl border overflow-x-auto">
                    <table className="w-full min-w-[980px]">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="p-3 text-left text-xs uppercase text-gray-500">Employee</th>
                                <th className="p-3 text-left text-xs uppercase text-gray-500">Type</th>
                                <th className="p-3 text-left text-xs uppercase text-gray-500">Reason</th>
                                <th className="p-3 text-left text-xs uppercase text-gray-500">Status</th>
                                <th className="p-3 text-left text-xs uppercase text-gray-500">Admin Reply</th>
                                <th className="p-3 text-right text-xs uppercase text-gray-500">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!loading && reports.map((r) => (
                                <tr key={r.id} className="border-t align-top">
                                    <td className="p-3">
                                        <div className="font-semibold text-sm text-gray-800">{r.employee_name || r.emp_id}</div>
                                        <div className="text-xs text-gray-500">{r.emp_id} {r.department_name ? `| ${r.department_name}` : ''}</div>
                                    </td>
                                    <td className="p-3 text-sm">{r.report_type}</td>
                                    <td className="p-3 text-sm text-gray-700 whitespace-pre-wrap">{r.reason}</td>
                                    <td className="p-3">
                                        <span className={`px-2 py-1 rounded text-xs font-semibold ${String(r.status).toLowerCase() === 'replied' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                            {r.status}
                                        </span>
                                    </td>
                                    <td className="p-3 text-sm text-gray-700 whitespace-pre-wrap">{r.admin_reply || '-'}</td>
                                    <td className="p-3">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => replyToReport(r)}
                                                className="px-3 py-2 rounded bg-indigo-600 text-white text-xs font-bold flex items-center gap-1"
                                            >
                                                <FaReply /> Reply
                                            </button>
                                            <button
                                                onClick={() => navigate(`/${user.role}/payroll/employee/${encodeURIComponent(r.emp_id)}`)}
                                                className="px-3 py-2 rounded bg-sky-50 text-sky-700 text-xs font-bold flex items-center gap-1"
                                            >
                                                <FaSearch /> View Salary
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}

                            {loading && (
                                <tr>
                                    <td colSpan={6} className="p-6 text-center text-gray-500">Loading reports...</td>
                                </tr>
                            )}

                            {!loading && reports.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-gray-400">
                                        <FaEnvelopeOpenText className="inline mr-2" />
                                        No salary reports found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </Layout>
    );
};

export default SalaryReports;
