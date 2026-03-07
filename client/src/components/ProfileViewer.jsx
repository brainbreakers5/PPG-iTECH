import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes, FaCheckCircle, FaIdBadge, FaBuilding, FaPhone, FaEnvelope, FaUser, FaCalendarAlt, FaVenusMars, FaTint, FaGlobe, FaHandsHelping, FaWhatsapp, FaMapMarkerAlt, FaUsers, FaHeart, FaBriefcase, FaMoneyBillWave, FaUniversity, FaCreditCard, FaLock, FaUserCircle, FaSuitcase, FaCamera, FaEdit, FaSave } from 'react-icons/fa';
import api from '../utils/api';
import Swal from 'sweetalert2';
import { useAuth } from '../context/AuthContext';

const InfoRow = ({ icon, label, value }) => (
    <div className="flex items-center gap-4 p-4 rounded-3xl bg-gray-50/50 hover:bg-white transition-all border border-transparent hover:border-gray-100 group">
        <div className="h-10 w-10 rounded-2xl bg-white shadow-sm flex items-center justify-center text-sky-600 group-hover:rotate-12 transition-transform">
            {icon}
        </div>
        <div className="flex-1 min-w-0">
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">{label}</p>
            <p className="text-sm font-black text-gray-800 tracking-tight truncate">{value || 'Not Specified'}</p>
        </div>
    </div>
);

const SectionHeader = ({ title }) => (
    <h4 className="text-[10px] font-black text-sky-600 uppercase tracking-[0.3em] mb-4 mt-8 first:mt-0 flex items-center gap-3">
        {title} <div className="h-[1px] flex-1 bg-sky-100" />
    </h4>
);

const ProfileViewer = ({ user, onClose }) => {
    const { login } = useAuth();
    const [isEditing, setIsEditing] = useState(false);
    const [picUrl, setPicUrl] = useState(user?.profile_pic || '');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setPicUrl(user?.profile_pic || '');
    }, [user?.profile_pic]);

    if (!user) return null;

    const handleUpdate = async () => {
        if (!picUrl) return;
        setLoading(true);
        try {
            const { data } = await api.put('/auth/profile-pic', { profile_pic: picUrl });
            const storedToken = localStorage.getItem('token');
            const updatedUser = { ...user, profile_pic: data.user.profile_pic, token: storedToken };
            localStorage.setItem('user', JSON.stringify(updatedUser));

            Swal.fire({
                icon: 'success',
                title: 'Updated!',
                text: 'Profile picture has been updated.',
                timer: 1500,
                showConfirmButton: false
            });
            setIsEditing(false);
            window.location.reload();
        } catch (error) {
            console.error(error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Failed to update profile picture.'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-7xl mx-auto">
            <motion.div
                initial={{ opacity: 0, scale: 0.98, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-white rounded-[40px] shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[70vh] border border-sky-50"
            >
                {/* Left Sidebar - Photo & Key Info */}
                <div className="md:w-1/3 bg-white border-r border-gray-100 flex flex-col items-center p-10 text-center relative shrink-0">
                    <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-br from-sky-600 to-indigo-700 opacity-5" />
                    <div className="relative mb-8 pt-4">
                        <div className="h-40 w-40 rounded-[50px] bg-white p-2 shadow-2xl ring-1 ring-sky-100 group hover:rotate-2 transition-transform duration-700 relative overflow-hidden text-center">
                            <img
                                src={picUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&size=200&background=2563eb&color=fff&bold=true`}
                                alt=""
                                className="h-full w-full rounded-[38px] object-cover bg-gray-50 mx-auto"
                            />
                            {user.role === 'admin' && (
                                <button
                                    onClick={() => setIsEditing(!isEditing)}
                                    className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                                >
                                    <FaCamera size={24} />
                                </button>
                            )}
                        </div>
                        <div className="absolute -bottom-3 -right-3 h-12 w-12 bg-white rounded-2xl shadow-xl flex items-center justify-center text-sky-600 border border-sky-50">
                            <FaCheckCircle size={20} />
                        </div>
                    </div>

                    {isEditing && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="w-full px-4 mb-4"
                        >
                            <input
                                type="text"
                                value={picUrl}
                                onChange={(e) => setPicUrl(e.target.value)}
                                placeholder="Paste Image URL here..."
                                className="w-full p-3 rounded-xl bg-gray-50 border border-gray-100 text-[10px] font-bold outline-none focus:ring-2 focus:ring-sky-100"
                            />
                            <div className="flex gap-2 mt-2">
                                <button
                                    onClick={handleUpdate}
                                    disabled={loading}
                                    className="flex-1 py-2 bg-sky-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-sky-700 disabled:opacity-50"
                                >
                                    {loading ? 'Saving...' : 'Save'}
                                </button>
                                <button
                                    onClick={() => { setIsEditing(false); setPicUrl(user.profile_pic); }}
                                    className="flex-1 py-2 bg-gray-100 text-gray-500 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-gray-200"
                                >
                                    Cancel
                                </button>
                            </div>
                        </motion.div>
                    )}

                    <h2 className="text-3xl font-black text-gray-800 tracking-tighter leading-tight break-words px-4">
                        {user.name}
                    </h2>
                    <div className="mt-4 px-6 py-2 rounded-full bg-sky-50 border border-sky-100 text-sky-600 text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-2">
                        <FaIdBadge /> {user.emp_id}
                    </div>
                    <p className="mt-4 text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">{user.designation || user.role}</p>

                    <div className="w-full mt-10 pt-10 border-t border-gray-50 space-y-4">
                        <div className="flex items-center justify-between text-[10px] font-black text-gray-400 uppercase tracking-widest">
                            <span>Verified Profile</span>
                            <span className="text-sky-500 italic">2026 Season</span>
                        </div>
                        <div className="h-1.5 w-full bg-gray-50 rounded-full overflow-hidden">
                            <div className="h-full bg-sky-600 w-full" />
                        </div>
                    </div>
                </div>

                {/* Right Content - Full Stats */}
                <div className="flex-1 flex flex-col bg-gray-50/20">
                    <div className="p-8 border-b border-gray-100 bg-white flex justify-between items-center">
                        <div>
                            <h3 className="text-xl font-black text-gray-800 tracking-tight">Employee Profile</h3>
                            <p className="text-[10px] font-black text-sky-500 uppercase tracking-[0.3em] mt-1">Official Personnel Data</p>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-8 md:p-10 custom-scrollbar">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                            {/* Core Data */}
                            <div className="col-span-full">
                                <SectionHeader title="Employee Information" />
                            </div>
                            <InfoRow icon={<FaIdBadge />} label="Employee ID" value={user.emp_id} />
                            <InfoRow icon={<FaLock />} label="Employee Code" value={user.emp_code} />
                            <InfoRow icon={<FaUser />} label="Full Name" value={user.name} />
                            <InfoRow icon={<FaEnvelope />} label="Email Address" value={user.email} />
                            <InfoRow icon={<FaBuilding />} label="Department" value={user.department_name} />
                            <InfoRow icon={<FaBriefcase />} label="Designation" value={user.designation || user.role} />

                            {/* Personal Data */}
                            <div className="col-span-full">
                                <SectionHeader title="Personal Information" />
                            </div>
                            <InfoRow icon={<FaCalendarAlt />} label="Date of Birth" value={user.dob} />
                            <InfoRow icon={<FaVenusMars />} label="Gender" value={user.gender} />
                            <InfoRow icon={<FaPhone />} label="Mobile Number" value={user.mobile} />
                            <InfoRow icon={<FaWhatsapp />} label="WhatsApp" value={user.whatsapp} />
                            <InfoRow icon={<FaTint />} label="Blood Group" value={user.blood_group} />
                            <InfoRow icon={<FaGlobe />} label="Nationality" value={user.nationality} />
                            <InfoRow icon={<FaHandsHelping />} label="Religion" value={user.religion} />
                            <InfoRow icon={<FaUsers />} label="Community / Caste" value={`${user.community || ''} ${user.caste ? `(${user.caste})` : ''}`} />

                            {/* Family & Marital */}
                            <div className="col-span-full">
                                <SectionHeader title="Family & Social" />
                            </div>
                            <InfoRow icon={<FaUser />} label="Father's Name" value={user.father_name} />
                            <InfoRow icon={<FaUser />} label="Mother's Name" value={user.mother_name} />
                            <InfoRow icon={<FaHeart />} label="Marital Status" value={user.marital_status} />

                            {/* Career & Financial */}
                            <div className="col-span-full">
                                <SectionHeader title="Career & Financials" />
                            </div>
                            <InfoRow icon={<FaCalendarAlt />} label="Date of Joining" value={user.doj} />
                            <InfoRow icon={<FaSuitcase />} label="Experience" value={user.experience} />
                            <InfoRow icon={<FaMoneyBillWave />} label="Monthly Salary" value={user.monthly_salary ? `₹${parseFloat(user.monthly_salary).toLocaleString()}` : 'N/A'} />
                            <InfoRow icon={<FaUniversity />} label="Bank Name" value={user.bank_name} />
                            <InfoRow icon={<FaCreditCard />} label="Account Number" value={user.account_no} />
                            <InfoRow icon={<FaUniversity />} label="Branch / IFSC" value={`${user.branch || ''} ${user.ifsc ? `(${user.ifsc})` : ''}`} />
                            <InfoRow icon={<FaIdBadge />} label="Aadhar Card" value={user.aadhar} />
                            <InfoRow icon={<FaIdBadge />} label="PAN Number" value={user.pan} />
                            <InfoRow icon={<FaUserCircle />} label="PF / UAN" value={`${user.pf_number || ''} ${user.uan_number ? `/ ${user.uan_number}` : ''}`} />

                            {/* Address */}
                            <div className="col-span-full">
                                <SectionHeader title="Location Details" />
                            </div>
                            <div className="col-span-full space-y-4">
                                <div className="p-4 rounded-3xl bg-gray-50/50 border border-transparent">
                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none mb-3 flex items-center gap-2">
                                        <FaMapMarkerAlt size={10} className="text-sky-500" /> Communication Address
                                    </p>
                                    <p className="text-xs font-bold text-gray-700 leading-relaxed uppercase">{user.communication_address || 'Not Provided'}</p>
                                </div>
                                <div className="p-4 rounded-3xl bg-gray-50/50 border border-transparent">
                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none mb-3 flex items-center gap-2">
                                        <FaMapMarkerAlt size={10} className="text-indigo-500" /> Permanent Address
                                    </p>
                                    <p className="text-xs font-bold text-gray-700 leading-relaxed uppercase">{user.permanent_address || 'Not Provided'}</p>
                                </div>
                                <div className="flex justify-start">
                                    <div className="px-4 py-2 bg-gray-100 rounded-xl text-[9px] font-black text-gray-400 tracking-widest uppercase">
                                        Pin Code: {user.pin_code || 'N/A'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default ProfileViewer;
