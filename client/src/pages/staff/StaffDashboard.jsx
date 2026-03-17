import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import Layout from '../../components/Layout';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { FaUserTie, FaEye, FaCalendarAlt, FaIdBadge, FaEnvelope, FaPhone, FaBuilding, FaSuitcase, FaArrowLeft, FaUsers, FaSearch, FaFilter, FaPrint } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';

const DepartmentStaffPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const isManagement = location.pathname.startsWith('/management');
    const effectiveRole = isManagement ? 'management' : (user?.role || 'staff');
    const [personnel, setPersonnel] = useState([]);
    const [department, setDepartment] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filteredPersonnel, setFilteredPersonnel] = useState([]);

    useEffect(() => {
        const fetchDepartmentData = async () => {
            try {
                const { data: deptData } = await api.get('/departments');
                const currDept = deptData.find(d => String(d.id) === String(id));
                setDepartment(currDept);

                const { data } = await api.get('/employees');
                const filtered = data
                    .filter(e => String(e.department_id) === String(id))
                    .sort((a, b) => {
                        if (a.role === 'hod' && b.role !== 'hod') return -1;
                        if (a.role !== 'hod' && b.role === 'hod') return 1;
                        return 0;
                    });
                setPersonnel(filtered);
                setFilteredPersonnel(filtered);
            } catch (error) {
                console.error("Error fetching department staff", error);
            } finally {
                setLoading(false);
            }
        };
        fetchDepartmentData();
    }, [id]);

    useEffect(() => {
        const result = personnel.filter(p =>
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.emp_id.toLowerCase().includes(searchQuery.toLowerCase())
        );
        setFilteredPersonnel(result);
    }, [searchQuery, personnel]);

    const handlePrint = () => {
        if (!filteredPersonnel || filteredPersonnel.length === 0) return;

        const printWindow = window.open('', '_blank', 'width=1200,height=800');
        if (!printWindow) return;

        const escHtml = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const roleColors = { hod: '#0891b2', staff: '#16a34a', admin: '#7c3aed', principal: '#2563eb' };

        const rowsHtml = filteredPersonnel.map((member, idx) => `
            <tr style="${idx % 2 === 0 ? 'background:#fff;' : 'background:#f8fafc;'} border-bottom:1px solid #f1f5f9;">
                <td style="padding:10px 12px; text-align:center;">
                    <img src="${escHtml(member.profile_pic || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&size=60&background=2563eb&color=fff&bold=true`)}"
                         style="width:40px;height:40px;border-radius:10px;object-fit:cover;" onerror="this.style.display='none'" />
                </td>
                <td style="padding:10px 12px; font-size:9pt; font-weight:900; color:#1e3a8a;">${escHtml(member.emp_id)}</td>
                <td style="padding:10px 12px; font-size:9pt; font-weight:700; color:#1e293b;">${escHtml(member.name)}</td>
                <td style="padding:10px 12px;">
                    <span style="background:${(roleColors[member.role] || '#475569')}22; color:${roleColors[member.role] || '#475569'}; border:1px solid ${(roleColors[member.role] || '#475569')}44; padding:2px 8px; border-radius:12px; font-size:8pt; font-weight:900; text-transform:uppercase; letter-spacing:0.05em;">${escHtml(member.role)}</span>
                </td>
                <td style="padding:10px 12px; font-size:9pt; color:#334155;">${escHtml(member.designation || '—')}</td>
                <td style="padding:10px 12px; font-size:8.5pt; color:#475569;">${escHtml(member.email || '—')}</td>
                <td style="padding:10px 12px; font-size:9pt; color:#475569;">${escHtml(member.mobile || '—')}</td>
            </tr>
        `).join('');

        printWindow.document.write(`
            <!doctype html><html><head><meta charset="UTF-8">
            <title>${escHtml(department?.name || 'Department')} — Staff & HOD Report</title>
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
                    <h1>${escHtml(department?.name || 'Department')} — Staff & HOD Registry</h1>
                    <p class="meta">Department Code: ${escHtml(department?.code || '—')} &nbsp;|&nbsp; Total Personnel: ${filteredPersonnel.length}</p>
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
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
                <div className="flex items-center gap-6">
                    <button
                        onClick={() => navigate(-1)}
                        className="h-14 w-14 rounded-2xl bg-white border border-gray-100 flex items-center justify-center text-gray-400 hover:bg-white hover:text-sky-600 transition-all shadow-xl shadow-sky-500/5 hover:-translate-x-1 active:scale-90"
                    >
                        <FaArrowLeft size={18} />
                    </button>
                    <div>
                        <h1 className="text-3xl font-black text-gray-800 tracking-tight">
                            {department?.name || 'Institutional Unit'} <span className="text-sky-600 uppercase">Registry</span>
                        </h1>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.4em] mt-2">Departmental Personnel Matrix for Code: {department?.code || '...'}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative group flex-1 md:w-80">
                        <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                            <FaSearch className="text-sky-300 group-focus-within:text-sky-500 transition-colors" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search personnel..."
                            className="w-full pl-14 pr-6 py-4 bg-white border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-sky-100 focus:border-sky-500 transition-all font-bold text-gray-700 text-sm shadow-xl shadow-sky-500/5 shadow-inner"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={handlePrint}
                        className="p-4 bg-sky-600 text-white rounded-2xl shadow-lg shadow-sky-100 hover:bg-sky-700 transition-all flex items-center justify-center gap-2 group font-black uppercase tracking-widest text-[10px] shrink-0"
                        title="Print Department Staff Report"
                    >
                        <FaPrint className="group-hover:scale-110 transition-transform" />
                        <span className="hidden sm:inline">Print</span>
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-40 gap-6">
                    <div className="h-16 w-16 border-4 border-sky-50 border-t-sky-600 rounded-full animate-spin shadow-xl"></div>
                    <p className="text-[10px] font-black text-sky-600 uppercase tracking-[0.3em] animate-pulse">Compiling Department Ledger...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    <AnimatePresence mode="popLayout">
                        {filteredPersonnel.map((member, idx) => (
                            <motion.div
                                key={member.id}
                                layout
                                initial={{ opacity: 0, y: 30, scale: 0.9 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                transition={{ delay: idx * 0.05, duration: 0.4, ease: "circOut" }}
                                className="bg-white rounded-[40px] shadow-2xl shadow-sky-500/5 border border-white hover:border-sky-100 transition-all group overflow-hidden flex flex-col items-center p-8 text-center relative"
                            >
                                <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-br from-sky-600 to-indigo-700 opacity-5" />
                                <div className="relative mt-4 mb-8">
                                    <div className="h-32 w-32 rounded-[45px] bg-white p-2 shadow-2xl border border-gray-100 group-hover:rotate-3 transition-transform duration-500 relative overflow-hidden">
                                        <img
                                            src={member.profile_pic || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&size=128&background=2563eb&color=fff&bold=true`}
                                            alt=""
                                            className="h-full w-full rounded-[38px] object-cover"
                                        />
                                    </div>
                                    <div className="absolute -bottom-2 -right-2 h-10 w-10 bg-sky-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-sky-200 border-4 border-white group-hover:scale-110 transition-transform">
                                        <FaUserTie size={16} />
                                    </div>
                                </div>

                                <h3 className="text-2xl font-black text-gray-800 tracking-tighter leading-tight group-hover:text-sky-600 transition-colors">
                                    {member.name}
                                </h3>
                                <div className="mt-4 flex items-center gap-3">
                                    <span className={`px-4 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${member.role === 'hod'
                                        ? 'bg-amber-50 text-amber-600 border-amber-100'
                                        : 'bg-sky-50 text-sky-600 border-sky-100'
                                        }`}>
                                        <FaIdBadge /> {member.emp_id} · {member.role}
                                    </span>
                                </div>
                                <p className="mt-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">{member.designation || member.role}</p>

                                <div className="mt-8 grid grid-cols-2 gap-4 w-full">
                                    <button
                                        onClick={() => {
                                            const rolePrefix = isManagement ? 'management' :
                                                user.role === 'admin' ? 'admin' :
                                                user.role === 'principal' ? 'principal' :
                                                    user.role === 'hod' ? 'hod' : 'staff';
                                            navigate(`/${rolePrefix}/profile/${member.emp_id}`);
                                            window.dispatchEvent(new CustomEvent('closeSidebar'));
                                        }}
                                        className="py-4 bg-white border border-gray-100 text-gray-500 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-sky-600 hover:text-white hover:border-sky-600 transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2"
                                    >
                                        <FaEye size={12} /> Profile
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (isManagement) {
                                                navigate(-1);
                                            } else if (user.role === 'admin') {
                                                navigate(`/admin/timetable/${member.emp_id}`);
                                            } else if (user.role === 'principal') {
                                                navigate(`/principal/timetable/${member.emp_id}`);
                                            } else if (user.role === 'hod') {
                                                navigate(`/hod/timetable/${member.emp_id}`);
                                            } else {
                                                navigate(`/staff/timetables/${member.emp_id}`);
                                            }
                                            window.dispatchEvent(new CustomEvent('closeSidebar'));
                                        }}
                                        className="py-4 bg-gray-900 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-black transition-all shadow-xl shadow-gray-200 active:scale-95 flex items-center justify-center gap-2"
                                    >
                                        <FaCalendarAlt size={12} /> Schedule
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>

                    {filteredPersonnel.length === 0 && (
                        <div className="col-span-full py-40 bg-white/50 backdrop-blur-xl rounded-[60px] border-4 border-dashed border-gray-100 flex flex-col items-center justify-center text-center gap-8 group">
                            <div className="h-32 w-32 rounded-[50px] bg-gray-50 flex items-center justify-center text-gray-200 group-hover:scale-110 group-hover:rotate-6 transition-all duration-700 shadow-inner">
                                <FaUsers size={60} />
                            </div>
                            <div>
                                <h3 className="text-3xl font-black text-gray-800 tracking-tight">No Personnel Found</h3>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mt-3 italic">No registry records match current department identification</p>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </Layout>
    );
};

export default DepartmentStaffPage;
