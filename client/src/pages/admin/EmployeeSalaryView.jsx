import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '../../components/Layout';
import api from '../../utils/api';
import { FaArrowLeft } from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';

const toCurrency = (v) => Number(v || 0).toLocaleString('en-IN');

const EmployeeSalaryView = () => {
    const { empId } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTimeline = async () => {
            setLoading(true);
            try {
                const { data } = await api.get(`/salary/timeline?empId=${encodeURIComponent(empId || '')}`);
                setRows(Array.isArray(data) ? data : []);
            } catch (error) {
                console.error('Failed to fetch employee salary timeline:', error);
                setRows([]);
            } finally {
                setLoading(false);
            }
        };

        fetchTimeline();
    }, [empId]);

    return (
        <Layout>
            <div className="max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-3xl font-black text-gray-800">Employee Salary Page</h1>
                        <p className="text-sm text-gray-500">Employee ID: {empId}</p>
                    </div>
                    <button
                        onClick={() => navigate(`/${user.role}/payroll/history`)}
                        className="px-4 py-2 rounded-lg bg-sky-600 text-white text-sm font-bold flex items-center gap-2"
                    >
                        <FaArrowLeft /> Back
                    </button>
                </div>

                <div className="bg-white border rounded-xl overflow-x-auto">
                    <table className="w-full min-w-[900px]">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="p-3 text-left text-xs uppercase text-gray-500">Period</th>
                                <th className="p-3 text-right text-xs uppercase text-gray-500">With/Without</th>
                                <th className="p-3 text-right text-xs uppercase text-gray-500">Gross</th>
                                <th className="p-3 text-right text-xs uppercase text-gray-500">Deductions</th>
                                <th className="p-3 text-right text-xs uppercase text-gray-500">Net</th>
                                <th className="p-3 text-center text-xs uppercase text-gray-500">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!loading && rows.map((r) => (
                                <tr key={r.id} className="border-t">
                                    <td className="p-3 text-sm">{r.from_date || '-'} to {r.to_date || '-'}</td>
                                    <td className="p-3 text-right text-sm">{Number(r.total_present || r.with_pay_count || 0).toFixed(1)} / {Number(r.total_lop || r.without_pay_count || 0).toFixed(1)}</td>
                                    <td className="p-3 text-right text-sm font-semibold">Rs {toCurrency(r.gross_salary || r.monthly_salary || 0)}</td>
                                    <td className="p-3 text-right text-sm text-rose-600">Rs {toCurrency(r.deductions_applied || 0)}</td>
                                    <td className="p-3 text-right text-sm text-emerald-700 font-bold">Rs {toCurrency(r.calculated_salary || 0)}</td>
                                    <td className="p-3 text-center">
                                        <span className={`px-2 py-1 rounded text-xs font-semibold ${String(r.status).toLowerCase() === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                            {r.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}

                            {loading && (
                                <tr>
                                    <td colSpan={6} className="p-6 text-center text-gray-500">Loading...</td>
                                </tr>
                            )}

                            {!loading && rows.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-gray-400">No salary records found for this employee.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </Layout>
    );
};

export default EmployeeSalaryView;
