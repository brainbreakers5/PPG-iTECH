import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import api from '../../utils/api';
import { FaUserTie, FaEye, FaCalendarAlt, FaIdBadge, FaEnvelope, FaPhone, FaBuilding, FaSuitcase, FaPrint } from 'react-icons/fa';
import { motion } from 'framer-motion';

const Department = () => {
    const navigate = useNavigate();
    const [staff, setStaff] = useState([]);
    const [deptInfo, setDeptInfo] = useState(null);

    useEffect(() => {
        const fetchStaff = async () => {
            try {
                const { data } = await api.get('/employees'); // Backend filters by HOD's dept
                const sorted = data.sort((a, b) => {
                    if (a.role === 'hod' && b.role !== 'hod') return -1;
                    if (a.role !== 'hod' && b.role === 'hod') return 1;
                    return 0;
                });
                setStaff(sorted);
            } catch (error) {
                console.error("Error fetching staff", error);
            }
        };
        const fetchDept = async () => {
            try {
                const { data } = await api.get('/departments');
                if (data.length > 0) setDeptInfo(data[0]);
            } catch (e) { /* ignore */ }
        };
        fetchStaff();
        fetchDept();
    }, []);

    const handlePrint = () => {
        if (!staff || staff.length === 0) return;

        const printWindow = window.open('', '_blank', 'width=1200,height=800');
        if (!printWindow) return;

        const escHtml = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const roleColors = { hod: '#0891b2', staff: '#16a34a', admin: '#7c3aed', principal: '#2563eb' };

        const rowsHtml = staff.map((member, idx) => `
            <tr style="${idx % 2 === 0 ? 'background:#fff;' : 'background:#f8fafc;'}">
                <td style="padding:10px 12px; text-align:center;">
                    <img src="${escHtml(member.profile_pic || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&size=60&background=2563eb&color=fff&bold=true`)}"
                         style="width:40px;height:40px;border-radius:10px;object-fit:cover;" onerror="this.style.display='none'" />
                </td>
                <td style="padding:10px 12px; font-size:9pt; font-weight:900; color:#1e3a8a;">${escHtml(member.emp_id)}</td>
                <td style="padding:10px 12px; font-size:9pt; font-weight:700; color:#1e293b;">${escHtml(member.name)}</td>
                <td style="padding:10px 12px;">
                    <span style="background:${(roleColors[member.role] || '#475569')}22; color:${(roleColors[member.role] || '#475569')}; border:1px solid ${(roleColors[member.role] || '#475569')}44; padding:2px 8px; border-radius:12px; font-size:8pt; font-weight:900; text-transform:uppercase;">${escHtml(member.role)}</span>
                </td>
                <td style="padding:10px 12px; font-size:9pt; color:#334155;">${escHtml(member.designation || '—')}</td>
                <td style="padding:10px 12px; font-size:8.5pt; color:#475569;">${escHtml(member.email || '—')}</td>
                <td style="padding:10px 12px; font-size:9pt; color:#475569;">${escHtml(member.mobile || '—')}</td>
            </tr>
        `).join('');

        printWindow.document.write(`
            <!doctype html><html><head><meta charset="UTF-8">
            <title>Departmental Matrix Report</title>
            <style>
                @page { size: landscape; margin: 0.7cm; }
                body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; margin: 0; padding: 10px; }
                .header { display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:20px; border-bottom:3px solid #1e3a8a; padding-bottom:12px; }
                .header h1 { margin:0; color:#1e3a8a; font-size:18pt; font-weight:900; letter-spacing:-0.5px; }
                .meta { font-size:9pt; color:#64748b; font-weight:bold; margin-top:5px; }
                .brand { font-weight:900; color:#1e3a8a; font-size:11pt; text-align:right; }
                .gen-date { font-size:8pt; color:#94a3b8; text-align:right; }
                table { width:100%; border-collapse:collapse; }
                thead tr { background:#1e3a8a; }
                thead th { padding:10px 12px; font-size:8pt; font-weight:900; color:#fff; text-transform:uppercase; letter-spacing:0.08em; text-align:left; }
                tbody tr { border-bottom:1px solid #f1f5f9; }
            </style></head><body>
            <div class="header">
                <div>
                    <h1>Departmental Matrix — ${escHtml(deptInfo?.name || 'Department')}</h1>
                    <p class="meta">Department Code: ${escHtml(deptInfo?.code || '—')} &nbsp;|&nbsp; Total Personnel: ${staff.length}</p>
                </div>
                <div>
                    <div class="brand">PPG EMP HUB</div>
                    <div class="gen-date">Generated: ${new Date().toLocaleString('en-GB')}</div>
                </div>
            </div>
            <table>
                <thead><tr>
                    <th style="width:56px;">Photo</th>
                    <th>Emp ID</th><th>Name</th><th>Role</th><th>Designation</th><th>Email</th><th>Mobile</th>
                </tr></thead>
                <tbody>${rowsHtml}</tbody>
            </table>
            </body></html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 250);
    };

    return (
        <Layout>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-800 tracking-tight">Departmental Matrix</h1>
                    <div className="flex items-center gap-3 mt-1">
                        {deptInfo?.code && (
                            <span className="px-2 py-1 bg-sky-50 border border-sky-100 rounded-lg text-[9px] font-black text-sky-600 tracking-widest">{deptInfo.code}</span>
                        )}
                    </div>
                </div>
                <button
                    onClick={handlePrint}
                    className="p-4 bg-sky-600 text-white rounded-2xl shadow-lg shadow-sky-100 hover:bg-sky-700 transition-all flex items-center justify-center gap-2 group font-black uppercase tracking-widest text-[10px]"
                    title="Print Department Report"
                >
                    <FaPrint className="group-hover:scale-110 transition-transform" />
                    <span className="hidden sm:inline">Print</span>
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {staff.map((member, idx) => (
                    <motion.div
                        key={member.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="modern-card group relative overflow-hidden"
                    >
                        <div className="absolute top-0 left-0 w-full h-2 bg-sky-600"></div>
                        <div className="flex flex-col items-center p-2">
                            <div className="relative mb-6">
                                <div className="h-24 w-24 rounded-3xl overflow-hidden border-4 border-white shadow-xl group-hover:scale-105 transition-transform">
                                    <img
                                        src={member.profile_pic || `https://ui-avatars.com/api/?name=${member.name}&background=3b82f6&color=fff&bold=true`}
                                        alt={member.name}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <div className="absolute -bottom-2 -right-2 h-8 w-8 bg-sky-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                                    <FaUserTie size={14} />
                                </div>
                            </div>

                            <div className="text-center w-full">
                                <h3 className="text-xl font-black text-gray-800 tracking-tight">{member.name}</h3>
                                <p className="text-[10px] font-black text-sky-500 uppercase tracking-widest mt-1 mb-4">{member.designation}</p>

                                <div className="space-y-3 mb-6 bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                                    <div className="flex items-center gap-3 text-gray-500 text-xs">
                                        <FaIdBadge className="text-sky-400" />
                                        <span className="font-bold">{member.emp_id}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-gray-500 text-xs text-left truncate">
                                        <FaEnvelope className="text-sky-400" />
                                        <span className="font-medium truncate">{member.email}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-gray-500 text-xs">
                                        <FaPhone className="text-sky-400" />
                                        <span className="font-medium">{member.mobile}</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => {
                                            navigate(`/hod/profile/${member.emp_id}`);
                                            window.dispatchEvent(new CustomEvent('closeSidebar'));
                                        }}
                                        className="flex items-center justify-center gap-2 py-3 px-4 bg-sky-50 text-sky-600 rounded-xl font-black uppercase tracking-widest text-[9px] hover:bg-sky-600 hover:text-white transition-all shadow-sm"
                                    >
                                        <FaEye size={12} /> View Profile
                                    </button>
                                    <button
                                        onClick={() => {
                                            navigate(`/hod/timetable/${member.emp_id}`);
                                            window.dispatchEvent(new CustomEvent('closeSidebar'));
                                        }}
                                        className="flex items-center justify-center gap-2 py-3 px-4 bg-gray-100 text-gray-600 rounded-xl font-black uppercase tracking-widest text-[9px] hover:bg-gray-800 hover:text-white transition-all shadow-sm"
                                    >
                                        <FaCalendarAlt size={12} /> Timetable
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                ))}

                {staff.length === 0 && (
                    <div className="col-span-full text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200 shadow-sm">
                        <div className="flex flex-col items-center gap-4 text-gray-300">
                            <FaUserTie size={48} className="opacity-20" />
                            <p className="font-bold italic">No staff found in your department.</p>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default Department;
