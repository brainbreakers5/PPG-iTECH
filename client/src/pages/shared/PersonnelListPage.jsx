import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { FaUserTie, FaEye, FaCalendarAlt, FaIdBadge, FaEnvelope, FaPhone, FaBuilding, FaSuitcase, FaArrowLeft, FaUsers, FaSearch, FaFilter } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';

const PersonnelListPage = () => {
    const { role } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [personnel, setPersonnel] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filteredPersonnel, setFilteredPersonnel] = useState([]);

    useEffect(() => {
        const fetchPersonnel = async () => {
            try {
                const { data } = await api.get('/employees');
                const filtered = data.filter(e => (e.role || '').toLowerCase() === role.toLowerCase());
                setPersonnel(filtered);
                setFilteredPersonnel(filtered);
            } catch (error) {
                console.error("Error fetching personnel", error);
            } finally {
                setLoading(false);
            }
        };
        fetchPersonnel();
    }, [role]);

    useEffect(() => {
        const result = personnel.filter(p =>
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.emp_id.toLowerCase().includes(searchQuery.toLowerCase())
        );
        setFilteredPersonnel(result);
    }, [searchQuery, personnel]);

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
                        <h1 className="text-3xl font-black text-gray-800 tracking-tight">Institutional <span className="text-sky-600 uppercase">{role}</span> Registry</h1>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.4em] mt-2">Active Staff Directory</p>
                    </div>
                </div>

                <div className="relative group w-full md:w-80">
                    <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                        <FaSearch className="text-sky-300 group-focus-within:text-sky-500 transition-colors" />
                    </div>
                    <input
                        type="text"
                        placeholder={`Search ${role}...`}
                        className="w-full pl-14 pr-6 py-4 bg-white border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-sky-100 focus:border-sky-500 transition-all font-bold text-gray-700 text-sm shadow-xl shadow-sky-500/5 shadow-inner"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-40 gap-6">
                    <div className="h-16 w-16 border-4 border-sky-50 border-t-sky-600 rounded-full animate-spin shadow-xl"></div>
                    <p className="text-[10px] font-black text-sky-600 uppercase tracking-[0.3em] animate-pulse">Compiling Registry Data...</p>
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    <AnimatePresence mode="popLayout">
                        {filteredPersonnel.map((member, idx) => (
                            <motion.div
                                key={member.id}
                                layout
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ delay: idx * 0.03, duration: 0.3, ease: "circOut" }}
                                className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 hover:border-sky-200 hover:shadow-md transition-all flex flex-col md:flex-row items-center gap-6 group relative overflow-hidden"
                            >
                                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-sky-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                
                                {/* Photo */}
                                <div className="h-16 w-16 rounded-2xl overflow-hidden shrink-0 border border-gray-100 relative group-hover:scale-105 transition-transform">
                                    <img
                                        src={member.profile_pic || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&size=128&background=2563eb&color=fff&bold=true`}
                                        alt=""
                                        className="h-full w-full object-cover"
                                    />
                                </div>
                                
                                {/* Info */}
                                <div className="flex-1 text-center md:text-left">
                                    <h3 className="text-xl font-black text-gray-800 tracking-tight group-hover:text-sky-600 transition-colors">
                                        {member.name}
                                    </h3>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">
                                        {member.designation || member.role}
                                    </p>
                                </div>
                                
                                <div className="hidden md:block w-px h-10 bg-gray-100"></div>
                                
                                {/* EMP ID */}
                                <div className="text-center md:text-left shrink-0 min-w-[120px]">
                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 text-center md:text-left">EMP ID</p>
                                    <div className="flex items-center justify-center md:justify-start gap-1">
                                        <FaIdBadge className="text-sky-400" size={10} />
                                        <p className="text-sm font-black text-gray-700 font-mono bg-gray-50 px-3 py-1 rounded-lg inline-block border border-gray-200">
                                            {member.emp_id}
                                        </p>
                                    </div>
                                </div>
                                
                                <div className="hidden md:block w-px h-10 bg-gray-100"></div>
                                
                                {/* Department */}
                                <div className="text-center md:text-left shrink-0 min-w-[160px]">
                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 text-center md:text-left">Department</p>
                                    <p className="text-xs font-black text-gray-700 tracking-tight px-3 py-1">
                                        {member.department_name || "Institutional"}
                                    </p>
                                </div>
                                
                                <div className="hidden lg:block w-px h-10 bg-gray-100"></div>
                                
                                {/* Actions */}
                                <div className="flex items-center justify-center gap-3 shrink-0 mt-4 md:mt-0 w-full md:w-auto">
                                    <button
                                        onClick={() => {
                                            const rolePrefix = user?.role === 'admin' ? 'admin' :
                                                user?.role === 'principal' ? 'principal' :
                                                    user?.role === 'hod' ? 'hod' : 'staff';
                                            navigate(`/${rolePrefix}/profile/${member.emp_id}`);
                                            window.dispatchEvent(new CustomEvent('closeSidebar'));
                                        }}
                                        className="flex-1 md:flex-none h-10 px-4 md:px-0 md:w-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center hover:bg-sky-600 hover:text-white transition-all shadow-sm border border-sky-100 group/btn tooltip-trigger"
                                        title="View Profile"
                                    >
                                        <FaEye size={14} className="group-hover/btn:scale-110 transition-transform" />
                                        <span className="md:hidden ml-2 text-[10px] font-black uppercase tracking-widest">Profile</span>
                                    </button>
                                    {(user?.role !== 'staff' || member.emp_id === user?.emp_id) && (
                                        <button
                                            onClick={() => {
                                                if (user?.role === 'admin') {
                                                    navigate(`/admin/timetable/${member.emp_id}`);
                                                } else if (user?.role === 'principal') {
                                                    navigate(`/principal/timetable/${member.emp_id}`);
                                                } else if (user?.role === 'hod') {
                                                    navigate(`/hod/timetable/${member.emp_id}`);
                                                } else {
                                                    navigate(`/staff/timetables/${member.emp_id}`);
                                                }
                                                window.dispatchEvent(new CustomEvent('closeSidebar'));
                                            }}
                                            className="flex-1 md:flex-none h-10 px-4 md:px-0 md:w-10 rounded-xl bg-gray-900 text-white flex items-center justify-center hover:bg-black transition-all shadow-sm border border-gray-800 group/btn tooltip-trigger"
                                            title="View Schedule"
                                        >
                                            <FaCalendarAlt size={14} className="group-hover/btn:scale-110 transition-transform" />
                                            <span className="md:hidden ml-2 text-[10px] font-black uppercase tracking-widest">Schedule</span>
                                        </button>
                                    )}
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>

                    {filteredPersonnel.length === 0 && (
                        <div className="w-full py-40 bg-white/50 backdrop-blur-xl rounded-[40px] border-4 border-dashed border-gray-100 flex flex-col items-center justify-center text-center gap-8 group">
                            <div className="h-32 w-32 rounded-[50px] bg-gray-50 flex items-center justify-center text-gray-200 group-hover:scale-110 group-hover:rotate-6 transition-all duration-700 shadow-inner">
                                <FaUsers size={60} />
                            </div>
                            <div>
                                <h3 className="text-3xl font-black text-gray-800 tracking-tight">Personnel Vacancy Identified</h3>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mt-3 italic">No registry records match current identity criteria</p>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </Layout>
    );
};

export default PersonnelListPage;
