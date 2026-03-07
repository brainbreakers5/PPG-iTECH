import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import api from '../../utils/api';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { FaTrash, FaPlus, FaLayerGroup, FaBuilding, FaProjectDiagram, FaArrowRight, FaPen } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';

const DepartmentManagement = () => {
    const [departments, setDepartments] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        fetchDepartments();
    }, []);

    const fetchDepartments = async () => {
        try {
            const { data } = await api.get('/departments');
            setDepartments(data);
        } catch (error) { console.error(error); }
    };

    const handleViewStaff = (dept) => {
        navigate(`/admin/departments/${dept.id}/staff`);
        window.dispatchEvent(new CustomEvent('closeSidebar'));
    };

    const handleDelete = async (id) => {
        Swal.fire({
            title: 'Delete Department?',
            text: "This will remove the department and affect the staff assigned to it.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            confirmButtonText: 'Yes, Delete',
            cancelButtonColor: '#64748b',
            background: '#fff',
            customClass: {
                popup: 'rounded-[40px]',
                title: 'font-black text-gray-800 tracking-tight'
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await api.delete(`/departments/${id}`);
                    fetchDepartments();
                    Swal.fire({
                        title: 'Department Deleted',
                        text: 'The department has been removed.',
                        icon: 'success',
                        confirmButtonColor: '#2563eb'
                    });
                } catch (error) {
                    Swal.fire({
                        title: 'Error',
                        text: 'Failed to delete department. It might have staff assigned.',
                        icon: 'error',
                        confirmButtonColor: '#2563eb'
                    });
                }
            }
        });
    };

    const handleAction = (dept = null) => {
        if (dept) {
            navigate(`/admin/departments/edit/${dept.id}`);
        } else {
            navigate('/admin/departments/new');
        }
        window.dispatchEvent(new CustomEvent('closeSidebar'));
    };

    return (
        <Layout>
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-7xl mx-auto"
            >
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
                    <div>
                        <h1 className="text-4xl font-black text-gray-800 tracking-tighter">Departments</h1>
                        <p className="text-gray-500 font-medium mt-1 uppercase tracking-widest text-[10px]">Manage company departments and organization structure.</p>
                    </div>
                    <button
                        onClick={() => handleAction()}
                        className="bg-sky-600 text-white px-10 py-5 rounded-2xl shadow-xl shadow-sky-100 hover:bg-sky-800 transition-all font-black uppercase tracking-[0.2em] text-[10px] flex items-center gap-4 active:scale-95 group"
                    >
                        <FaPlus className="group-hover:rotate-90 transition-transform duration-500" />
                        Add Department
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                    <AnimatePresence mode="popLayout">
                        {departments.map((dept, idx) => (
                            <motion.div
                                key={dept.id}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                transition={{ delay: idx * 0.05 }}
                                className="group bg-white p-10 rounded-[40px] shadow-xl shadow-sky-50/50 border border-transparent hover:border-sky-100 hover:shadow-2xl transition-all duration-500 relative overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 w-48 h-48 bg-sky-50 rounded-full -mr-24 -mt-24 opacity-30 group-hover:scale-125 transition-transform duration-700"></div>

                                <div className="flex justify-between items-start relative z-10 mb-8">
                                    <div className="h-16 w-16 rounded-[24px] bg-gradient-to-br from-sky-500 to-sky-700 flex items-center justify-center text-white shadow-lg shadow-sky-200 group-hover:rotate-6 transition-transform">
                                        <FaLayerGroup size={24} />
                                    </div>
                                    <div className="flex gap-2 relative z-10">
                                        <button
                                            onClick={() => handleAction(dept)}
                                            className="h-10 w-10 bg-sky-50 text-sky-600 rounded-xl flex items-center justify-center hover:bg-sky-600 hover:text-white transition-all active:scale-90"
                                            title="Edit Department"
                                        >
                                            <FaPen size={14} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(dept.id)}
                                            className="h-10 w-10 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all active:scale-90"
                                            title="Purge Node"
                                        >
                                            <FaTrash size={14} />
                                        </button>
                                    </div>
                                </div>

                                <div className="relative z-10 space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Active Department</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <h3 className="text-2xl font-black text-gray-800 tracking-tight group-hover:text-sky-600 transition-colors">{dept.name}</h3>
                                        {dept.code && (
                                            <span className="px-2 py-1 bg-sky-50 border border-sky-100 rounded-lg text-[9px] font-black text-sky-600 tracking-widest">{dept.code}</span>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-6 pt-4 border-t border-gray-50">
                                        <div className="flex items-center gap-2 text-gray-400">
                                            <span className="px-2 py-1 bg-gray-50 border border-gray-100 rounded-lg text-[9px] font-black text-gray-600 tracking-widest">{dept.code || 'NO-CODE'}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-gray-400">
                                            <FaBuilding size={10} />
                                            <span className="text-[9px] font-bold uppercase tracking-widest">Division</span>
                                        </div>
                                        <button
                                            onClick={() => handleViewStaff(dept)}
                                            className="ml-auto text-sky-600 hover:text-sky-800 text-[10px] font-black uppercase tracking-widest hover:underline"
                                        >
                                            View Staff & HODs
                                        </button>
                                    </div>
                                </div>

                                <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-sky-500 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-500"></div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>

            </motion.div>
        </Layout>
    );
};

export default DepartmentManagement;

