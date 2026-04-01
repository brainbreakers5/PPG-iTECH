import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import api from '../../utils/api';
import { FaCommentDots, FaSpinner, FaDownload } from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';

const badgeClass = (rating) => {
    const v = String(rating || '').toLowerCase();
    if (v === 'excellent') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    if (v === 'good') return 'bg-sky-50 text-sky-700 border-sky-100';
    return 'bg-amber-50 text-amber-700 border-amber-100';
};

const FeedbackInboxPage = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState([]);

    const exportCsv = () => {
        if (!rows.length) return;
        const esc = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`;
        const header = ['From Emp ID', 'From Name', 'Designation', 'Department', 'Rating', 'Message', 'Submitted At'];
        const body = rows.map((r) => [
            r.from_emp_id,
            r.from_name || '',
            r.designation || '',
            r.department_name || '',
            r.rating || '',
            r.message || '',
            r.created_at ? new Date(r.created_at).toLocaleString('en-GB') : ''
        ]);
        const csv = [header, ...body].map((line) => line.map(esc).join(',')).join('\n');
        const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `feedback-inbox-${String(user?.emp_id || 'receiver')}-${new Date().toLocaleDateString('en-CA')}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    useEffect(() => {
        const fetchInbox = async () => {
            setLoading(true);
            try {
                const { data } = await api.get('/feedback/inbox');
                setRows(Array.isArray(data) ? data : []);
            } catch (error) {
                console.error('Failed to load feedback inbox:', error);
                setRows([]);
            } finally {
                setLoading(false);
            }
        };

        fetchInbox();
    }, []);

    return (
        <Layout>
            <div className="max-w-7xl mx-auto">
                <div className="mb-8">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h1 className="text-3xl font-black text-gray-800 tracking-tight">Employee Feedback Inbox</h1>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mt-2">Visible only to employee 5001 and 5045</p>
                        </div>
                        <button
                            type="button"
                            onClick={exportCsv}
                            disabled={loading || rows.length === 0}
                            className="px-5 py-3 rounded-2xl bg-sky-600 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-sky-100 hover:bg-sky-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            <FaDownload /> Download
                        </button>
                    </div>
                </div>

                <div className="modern-card !p-0 overflow-hidden border-sky-100">
                    <div className="bg-sky-50/30 p-6 border-b border-sky-50">
                        <h2 className="text-lg font-black text-gray-800 uppercase tracking-widest">All Feedbacks</h2>
                    </div>

                    {loading ? (
                        <div className="p-20 text-center text-gray-500">
                            <div className="flex flex-col items-center gap-4">
                                <FaSpinner className="animate-spin text-sky-600" size={28} />
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-500">Loading feedbacks...</p>
                            </div>
                        </div>
                    ) : rows.length === 0 ? (
                        <div className="p-20 text-center text-gray-400">
                            <div className="flex flex-col items-center gap-4 opacity-70">
                                <FaCommentDots size={44} />
                                <p className="text-sm font-black text-gray-700">No feedbacks yet</p>
                            </div>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-gray-50/50">
                                    <tr>
                                        <th className="p-5 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-sky-50">From</th>
                                        <th className="p-5 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-sky-50">Department</th>
                                        <th className="p-5 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-sky-50">Rating</th>
                                        <th className="p-5 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-sky-50">Message</th>
                                        <th className="p-5 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-sky-50">Submitted</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((r) => (
                                        <tr key={r.id} className="border-b border-sky-50/40 hover:bg-sky-50/20">
                                            <td className="p-5">
                                                <div className="text-sm font-black text-gray-800">{r.from_name || r.from_emp_id}</div>
                                                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{r.from_emp_id} | {r.designation || r.submitted_by_role || '-'}</div>
                                            </td>
                                            <td className="p-5 text-sm font-bold text-gray-700">{r.department_name || '-'}</td>
                                            <td className="p-5">
                                                <span className={`inline-block px-3 py-1 rounded-xl border text-[10px] font-black uppercase tracking-widest ${badgeClass(r.rating)}`}>
                                                    {r.rating}
                                                </span>
                                            </td>
                                            <td className="p-5 text-sm text-gray-700 font-bold whitespace-pre-wrap">{r.message}</td>
                                            <td className="p-5 text-xs text-gray-500 font-bold whitespace-nowrap">{new Date(r.created_at).toLocaleString('en-GB')}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    );
};

export default FeedbackInboxPage;
