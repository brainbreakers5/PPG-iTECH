import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { FaBuilding, FaUserTie, FaUsers, FaArrowRight, FaTimes, FaIdBadge, FaPhone, FaEnvelope, FaArrowLeft, FaSuitcase, FaCalendarAlt, FaUserCheck, FaUserTimes, FaPrint } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';

const Department = () => {
    const [departments, setDepartments] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchDepts = async () => {
            try {
                const { data } = await api.get('/departments');
                setDepartments(data);
            } catch (error) {
                console.error("Error fetching departments", error);
            }
        };
        fetchDepts();
    }, []);

    const handleViewStaff = (dept) => {
        navigate(`/principal/departments/${dept.id}/staff`);
        window.dispatchEvent(new CustomEvent('closeSidebar'));
    };

    const handlePrint = () => {
        if (!departments || departments.length === 0) return;
        const printWindow = window.open('', '_blank', 'width=1200,height=800');
        if (!printWindow) return;
        const escHtml = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const rowsHtml = departments.map((dept, idx) => `
            <tr style="${idx % 2 === 0 ? 'background:#fff;' : 'background:#f8fafc;'}">
                <td style="padding:10px 14px; font-size:10pt; font-weight:900; color:#1e3a8a;">${escHtml(dept.name)}</td>
                <td style="padding:10px 14px; font-size:9pt; color:#475569; font-weight:700;">${escHtml(dept.code || '—')}</td>
            </tr>
        `).join('');
        printWindow.document.write(`
            <!doctype html><html><head><meta charset="UTF-8">
            <title>Department Intelligence Report</title>
            <style>
                @page { size: portrait; margin: 1cm; }
                body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; margin: 0; padding: 10px; }
                .header { display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:20px; border-bottom:3px solid #1e3a8a; padding-bottom:12px; }
                .header h1 { margin:0; color:#1e3a8a; font-size:18pt; font-weight:900; } .meta { font-size:9pt; color:#64748b; font-weight:bold; margin-top:5px; }
                .brand { font-weight:900; color:#1e3a8a; font-size:11pt; text-align:right; } .gen-date { font-size:8pt; color:#94a3b8; text-align:right; }
                table { width:100%; border-collapse:collapse; } thead tr { background:#1e3a8a; }
                thead th { padding:10px 14px; font-size:8pt; font-weight:900; color:#fff; text-transform:uppercase; letter-spacing:0.08em; text-align:left; }
                tbody tr { border-bottom:1px solid #f1f5f9; }
            </style></head><body>
            <div class="header">
                <div><h1>Department Intelligence Report</h1><p class="meta">Total Departments: ${departments.length}</p></div>
                <div><div class="brand">PPG EMP HUB</div><div class="gen-date">Generated: ${new Date().toLocaleString('en-GB')}</div></div>
            </div>
            <table><thead><tr><th>Department Name</th><th>Code</th></tr></thead><tbody>${rowsHtml}</tbody></table>
            </body></html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 250);
    };

    return (
        <Layout>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
            >
                <div className="mb-12 flex items-start justify-between">
                    <h1 className="text-4xl font-black text-gray-800 tracking-tighter">
                        Department <span className="text-[#4A90E2]">Intelligence</span>
                    </h1>
                    <button
                        onClick={handlePrint}
                        className="p-4 bg-sky-600 text-white rounded-2xl shadow-lg shadow-sky-100 hover:bg-sky-700 transition-all flex items-center justify-center gap-2 group font-black uppercase tracking-widest text-[10px] shrink-0"
                        title="Print Department Report"
                    >
                        <FaPrint className="group-hover:scale-110 transition-transform" />
                        <span className="hidden sm:inline">Print</span>
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {departments.map((dept, idx) => (
                        <motion.div
                            key={dept.id}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: idx * 0.1 }}
                            whileHover={{ y: -5, scale: 1.02 }}
                            className="modern-card p-10 bg-white/70 backdrop-blur-xl border border-white/50 group relative overflow-hidden"
                        >
                            <div className="flex justify-between items-start mb-8 relative z-10">
                                <div className="h-16 w-16 rounded-[24px] bg-gradient-to-br from-sky-50 to-sky-100/50 flex items-center justify-center text-[#4A90E2] shadow-inner group-hover:rotate-6 transition-transform">
                                    <FaBuilding size={28} />
                                </div>
                            </div>


                            <div className="mb-10 relative z-10">
                                <h2 className="text-2xl font-black text-gray-800 tracking-tight leading-tight mb-2 group-hover:text-sky-600 transition-colors uppercase">{dept.name}</h2>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">{dept.code || 'Unit'} • Operational Unit</p>
                            </div>

                            <button
                                onClick={() => handleViewStaff(dept)}
                                className="w-full flex items-center justify-between p-6 bg-gradient-to-r from-gray-50 to-white text-gray-800 rounded-[24px] font-black text-[10px] uppercase tracking-widest hover:translate-x-2 transition-all shadow-sm border border-gray-100 group/btn relative z-10"
                            >
                                View Personnel <div className="p-2 rounded-xl bg-sky-50 text-[#4A90E2] group-hover/btn:bg-[#4A90E2] group-hover/btn:text-white transition-all"><FaArrowRight size={10} /></div>
                            </button>

                            {/* Background Decor */}
                            <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-sky-50/30 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        </motion.div>
                    ))}
                </div>
            </motion.div>
        </Layout>
    );
};

export default Department;
