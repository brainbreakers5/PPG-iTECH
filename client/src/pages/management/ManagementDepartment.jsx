import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { FaBuilding, FaArrowRight, FaPrint } from 'react-icons/fa';
import { motion } from 'framer-motion';

const ManagementDepartment = () => {
    const [departments, setDepartments] = useState([]);
    const [allEmployees, setAllEmployees] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [deptRes, empRes] = await Promise.all([
                    api.get('/departments'),
                    api.get('/employees')
                ]);
                setDepartments(deptRes.data);
                setAllEmployees(empRes.data);
            } catch (error) {
                console.error("Error fetching data", error);
            }
        };
        fetchData();
    }, []);

    const handleViewStaff = (dept) => {
        navigate(`/management/departments/${dept.id}/staff`);
        window.dispatchEvent(new CustomEvent('closeSidebar'));
    };

    const handlePrint = () => {
        if (!departments || departments.length === 0) return;
        const printWindow = window.open('', '_blank', 'width=1200,height=800');
        if (!printWindow) return;
        const escHtml = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const roleColors = { hod: '#0891b2', staff: '#16a34a', admin: '#7c3aed', principal: '#2563eb' };

        let contentHtml = '';

        departments.forEach(dept => {
            const deptStaff = allEmployees.filter(emp => String(emp.department_id) === String(dept.id));
            if (deptStaff.length === 0) return;

            deptStaff.sort((a, b) => {
                if (a.role === 'hod' && b.role !== 'hod') return -1;
                if (a.role !== 'hod' && b.role === 'hod') return 1;
                return 0;
            });

            contentHtml += `
                <div style="margin-bottom: 30px; page-break-inside: avoid;">
                    <div style="background: #f8fafc; padding: 10px 15px; border-left: 4px solid #7c3aed; margin-bottom: 10px;">
                        <h2 style="margin: 0; color: #4c1d95; font-size: 14pt; font-weight: 900;">${escHtml(dept.name)} <span style="font-size: 10pt; color: #64748b; font-weight: bold;">(Code: ${escHtml(dept.code || '—')})</span></h2>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th style="width:50px; text-align:center;">Photo</th>
                                <th style="width:100px;">Emp ID</th>
                                <th>Name</th>
                                <th style="width:80px;">Role</th>
                                <th>Designation</th>
                                <th>Email</th>
                                <th style="width:110px;">Mobile</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${deptStaff.map((member, idx) => `
                                <tr style="${idx % 2 === 0 ? 'background:#fff;' : 'background:#f8fafc;'}">
                                    <td style="padding:8px 10px; text-align:center;">
                                        <img src="${escHtml(member.profile_pic || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&size=60&background=7c3aed&color=fff&bold=true`)}"
                                            style="width:36px;height:36px;border-radius:8px;object-fit:cover;" onerror="this.style.display='none'" />
                                    </td>
                                    <td style="padding:8px 10px; font-size:9pt; font-weight:900; color:#4c1d95;">${escHtml(member.emp_id)}</td>
                                    <td style="padding:8px 10px; font-size:9pt; font-weight:700; color:#1e293b;">${escHtml(member.name)}</td>
                                    <td style="padding:8px 10px;">
                                        <span style="background:${(roleColors[member.role] || '#475569')}22; color:${(roleColors[member.role] || '#475569')}; border:1px solid ${(roleColors[member.role] || '#475569')}44; padding:2px 6px; border-radius:10px; font-size:7.5pt; font-weight:900; text-transform:uppercase;">${escHtml(member.role)}</span>
                                    </td>
                                    <td style="padding:8px 10px; font-size:8.5pt; color:#334155;">${escHtml(member.designation || '—')}</td>
                                    <td style="padding:8px 10px; font-size:8pt; color:#475569;">${escHtml(member.email || '—')}</td>
                                    <td style="padding:8px 10px; font-size:8.5pt; color:#475569;">${escHtml(member.mobile || '—')}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        });

        if (!contentHtml) {
            contentHtml = '<p style="text-align:center; color:#64748b; font-style:italic; margin-top: 40px;">No personnel data available to print.</p>';
        }

        printWindow.document.write(`
            <!doctype html><html><head><meta charset="UTF-8">
            <title>Department Personnel Registry</title>
            <style>
                @page { size: landscape; margin: 1cm; }
                body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; margin: 0; padding: 10px; }
                .header { display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:20px; border-bottom:3px solid #7c3aed; padding-bottom:12px; }
                .header h1 { margin:0; color:#7c3aed; font-size:18pt; font-weight:900; } 
                .meta { font-size:9pt; color:#64748b; font-weight:bold; margin-top:5px; }
                .brand { font-weight:900; color:#7c3aed; font-size:11pt; text-align:right; } 
                .gen-date { font-size:8pt; color:#94a3b8; text-align:right; }
                table { width:100%; border-collapse:collapse; background: #fff; border: 1px solid #e2e8f0; } 
                thead tr { background:#7c3aed; }
                thead th { padding:10px; font-size:8pt; font-weight:900; color:#fff; text-transform:uppercase; letter-spacing:0.05em; text-align:left; border-right: 1px solid #6d28d9; }
                thead th:last-child { border-right: none; }
                tbody tr { border-bottom:1px solid #e2e8f0; }
                tbody td { border-right: 1px solid #e2e8f0; }
                tbody td:last-child { border-right: none; }
            </style></head><body>
            <div class="header">
                <div><h1>Institutional Personnel Registry</h1><p class="meta">Comprehensive Departmental Overview</p></div>
                <div><div class="brand">PPG EMP HUB</div><div class="gen-date">Generated: ${new Date().toLocaleString('en-GB')}</div></div>
            </div>
            ${contentHtml}
            </body></html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 500);
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
                        Department <span className="text-[#7C3AED]">Intelligence</span>
                    </h1>
                    <button
                        onClick={handlePrint}
                        className="p-4 bg-violet-600 text-white rounded-2xl shadow-lg shadow-violet-100 hover:bg-violet-700 transition-all flex items-center justify-center gap-2 group font-black uppercase tracking-widest text-[10px] shrink-0"
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
                                <div className="h-16 w-16 rounded-[24px] bg-gradient-to-br from-purple-50 to-purple-100/50 flex items-center justify-center text-[#7C3AED] shadow-inner group-hover:rotate-6 transition-transform">
                                    <FaBuilding size={28} />
                                </div>
                            </div>

                            <div className="mb-10 relative z-10">
                                <h2 className="text-2xl font-black text-gray-800 tracking-tight leading-tight mb-2 group-hover:text-purple-600 transition-colors uppercase">{dept.name}</h2>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">{dept.code || 'Unit'} • Operational Unit</p>
                            </div>

                            <button
                                onClick={() => handleViewStaff(dept)}
                                className="w-full flex items-center justify-between p-6 bg-gradient-to-r from-gray-50 to-white text-gray-800 rounded-[24px] font-black text-[10px] uppercase tracking-widest hover:translate-x-2 transition-all shadow-sm border border-gray-100 group/btn relative z-10"
                            >
                                View Personnel <div className="p-2 rounded-xl bg-purple-50 text-[#7C3AED] group-hover/btn:bg-[#7C3AED] group-hover/btn:text-white transition-all"><FaArrowRight size={10} /></div>
                            </button>

                            <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-purple-50/30 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        </motion.div>
                    ))}
                </div>
            </motion.div>
        </Layout>
    );
};

export default ManagementDepartment;
