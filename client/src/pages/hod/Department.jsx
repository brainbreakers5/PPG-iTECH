import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import api from '../../utils/api';
import { FaUserTie, FaEye, FaCalendarAlt, FaIdBadge, FaEnvelope, FaPhone, FaBuilding, FaSuitcase } from 'react-icons/fa';
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
                // HOD's data is only from their own dept, so get first result that matches staff
                if (data.length > 0) setDeptInfo(data[0]);
            } catch (e) { /* ignore */ }
        };
        fetchStaff();
        fetchDept();
    }, []);

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
