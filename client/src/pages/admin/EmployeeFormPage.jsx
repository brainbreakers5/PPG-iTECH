import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FaArrowLeft, FaSave, FaUser, FaUniversity, FaMapMarkerAlt, FaUsers, FaLock, FaCertificate, FaPlus, FaTrash, FaMinusCircle } from 'react-icons/fa';
import Layout from '../../components/Layout';
import api from '../../utils/api';
import Swal from 'sweetalert2';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';

const inputClass = "w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-sky-100 focus:border-sky-500 transition-all font-bold text-gray-700 text-sm disabled:opacity-70 disabled:bg-gray-100/60 disabled:cursor-not-allowed disabled:text-gray-500 disabled:border-gray-50";
const labelClass = "block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1";

const FormSection = ({ title, icon, children }) => (
    <div className="mb-12 border-b border-gray-50 pb-12 last:border-0 last:pb-0">
        <div className="flex items-center gap-4 mb-8">
            <div className="h-10 w-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                {icon}
            </div>
            <h3 className="text-xl font-black text-gray-800 tracking-tight uppercase">{title}</h3>
        </div>
        {children}
    </div>
);

const EmployeeFormPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin' || user?.role === 'management';

    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(true);

    const defaultData = {
        emp_id: '', emp_code: '', name: '', role: 'staff', department_id: '', designation: '',
        email: '', mobile: '', profile_pic: '', dob: '', doj: '', gender: 'Male',
        blood_group: '', religion: '', nationality: 'Indian', caste: '', community: '', whatsapp: '',
        aadhar: '', pan: '',
        account_no: '', bank_name: '', branch: '', ifsc: '', pin_code: '', pf_number: '', uan_number: '',
        permanent_address: '', communication_address: '',
        father_name: '', mother_name: '', marital_status: 'Single',
        monthly_salary: '', experience: '',
        pin: '', confirm_pin: ''
    };

    const [formData, setFormData] = useState(defaultData);
    const [certificates, setCertificates] = useState([]);
    const [existingCerts, setExistingCerts] = useState([]);
    const [deductions, setDeductions] = useState([]); // [{ type, amount }]

    useEffect(() => {
        fetchDepartments();
        if (id) {
            fetchEmployee();
            fetchCertificates();
        } else {
            setLoading(false);
        }
    }, [id]);

    const fetchDepartments = async () => {
        try {
            const { data } = await api.get('/departments');
            setDepartments(data);
        } catch (error) { console.error(error); }
    };

    const fetchCertificates = async () => {
        try {
            const { data } = await api.get(`/certificates/${id}`);
            setExistingCerts(data);
        } catch (error) { console.error(error); }
    };

    const fetchEmployee = async () => {
        try {
            const { data } = await api.get(`/employees/${id}?lookup=id`);
            setFormData({ ...data, confirm_pin: data.pin });
            // Load existing deductions if stored
            if (data.deductions) {
                const loadedDeductions = typeof data.deductions === 'string' 
                    ? JSON.parse(data.deductions) 
                    : data.deductions;
                setDeductions(Array.isArray(loadedDeductions) ? loadedDeductions : []);
            }
            setLoading(false);
        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'Failed to fetch employee details', 'error');
            navigate('/admin/employees');
        }
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                return Swal.fire({
                    title: 'File Too Large',
                    text: 'Please select an image smaller than 5MB.',
                    icon: 'warning',
                    confirmButtonColor: '#2563eb'
                });
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData({ ...formData, profile_pic: reader.result });
            };
            reader.readAsDataURL(file);
        }
    };

    const addCertRow = () => {
        setCertificates([...certificates, { certificate_name: '', file_name: '', file_type: '', file_data: '' }]);
    };

    const removeCertRow = (index) => {
        setCertificates(certificates.filter((_, i) => i !== index));
    };

    const handleCertNameChange = (index, value) => {
        const updated = [...certificates];
        updated[index].certificate_name = value;
        setCertificates(updated);
    };

    const handleCertFileChange = (index, e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) {
            return Swal.fire({ title: 'File Too Large', text: 'Please select a file smaller than 10MB.', icon: 'warning', confirmButtonColor: '#2563eb' });
        }
        const reader = new FileReader();
        reader.onloadend = () => {
            const updated = [...certificates];
            updated[index].file_data = reader.result;
            updated[index].file_name = file.name;
            updated[index].file_type = file.type;
            setCertificates(updated);
        };
        reader.readAsDataURL(file);
    };

    const deleteExistingCert = async (certId) => {
        const confirm = await Swal.fire({ title: 'Delete Certificate?', text: 'This action cannot be undone.', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Delete' });
        if (!confirm.isConfirmed) return;
        try {
            await api.delete(`/certificates/${certId}`);
            setExistingCerts(existingCerts.filter(c => c.id !== certId));
            Swal.fire({ title: 'Deleted', icon: 'success', timer: 1200, showConfirmButton: false });
        } catch (error) {
            Swal.fire('Error', 'Failed to delete certificate', 'error');
        }
    };


    // ─── Deduction Handlers ─────────────────────────────────────────────
    const DEDUCTION_PRESETS = ['PF (Provident Fund)', 'ESI', 'Income Tax (TDS)', 'Professional Tax', 'Loan Recovery', 'Other'];

    const addDeduction = () => {
        setDeductions(prev => [...prev, { type: '', amount: '' }]);
    };
    const removeDeduction = (i) => setDeductions(prev => prev.filter((_, idx) => idx !== i));
    const updateDeduction = (i, field, val) => {
        setDeductions(prev => prev.map((d, idx) => idx === i ? { ...d, [field]: val } : d));
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();

        if (!id && formData.pin !== formData.confirm_pin) {
            return Swal.fire({
                title: 'PIN Mismatch',
                text: 'Security identifiers do not synchronize. Please verify.',
                icon: 'error',
                confirmButtonColor: '#2563eb'
            });
        }

        try {
            let userId = formData.id;
            const payload = {
                ...formData,
                deductions: JSON.stringify(deductions.filter(d => d.type && Number(d.amount) > 0))
            };

            if (id) {
                await api.put(`/employees/${formData.id}`, payload);

                // Automatically notify the employee about the update
                try {
                    const { data: conv } = await api.post('/conversations', {
                        title: `Profile Update Notification`,
                        target_role: 'individual',
                        target_user_ids: [formData.emp_id]
                    });

                    await api.post(`/conversations/${conv.id}/messages`, {
                        content: `Hello ${formData.name}, your employee record has been updated by the Administrator. Please check your profile for changes.`
                    });
                } catch (msgErr) {
                    console.error("Auto-notification failed:", msgErr);
                }

                Swal.fire({
                    title: 'Saved',
                    text: 'Employee record has been updated and notification sent.',
                    icon: 'success',
                    timer: 1500,
                    showConfirmButton: false
                });
            } else {
                await api.post('/employees', payload);
                // Fetch newly created employee to get userId for certificate uploads
                try {
                    const { data: newEmp } = await api.get(`/employees/${formData.emp_id}?lookup=emp_id`);
                    userId = newEmp.id;
                } catch (_) {}
                Swal.fire({
                    title: 'Added',
                    text: 'New employee has been added successfully.',
                    icon: 'success',
                    timer: 1500,
                    showConfirmButton: false
                });
            }


            // Upload new certificates
            if (userId && certificates.length > 0) {
                const validCerts = certificates.filter(c => c.certificate_name && c.file_data);
                for (const cert of validCerts) {
                    try {
                        await api.post(`/certificates/${userId}`, cert);
                    } catch (certErr) {
                        console.error('Certificate upload failed:', certErr);
                    }
                }
            }

            navigate('/admin/employees');
        } catch (error) {
            Swal.fire({
                title: 'Operational Failure',
                text: error.response?.data?.message || 'Action failed',
                icon: 'error',
                confirmButtonColor: '#2563eb'
            });
        }
    };

    if (loading) return (
        <Layout>
            <div className="flex h-screen items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-sky-600"></div>
            </div>
        </Layout>
    );

    return (
        <Layout>
            <div className="max-w-5xl mx-auto pb-20">
                {/* Header */}
                <div className="mb-10 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <button
                            onClick={() => navigate('/admin/employees')}
                            className="h-14 w-14 rounded-2xl bg-white border border-gray-100 flex items-center justify-center text-gray-400 hover:bg-rose-50 hover:text-rose-500 transition-all shadow-sm active:scale-90"
                        >
                            <FaArrowLeft size={20} />
                        </button>
                        <div>
                            <h2 className="text-4xl font-black text-gray-800 tracking-tight">
                                {id ? 'Edit Employee Record' : 'Create New Employee'}
                            </h2>
                            <p className="text-[10px] font-black text-sky-500 uppercase tracking-[0.2em] mt-1 italic">
                                Institutional Matrix Integration
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-[40px] shadow-2xl border border-black/50 overflow-hidden transition-all duration-300 hover:scale-[1.01]">
                    <form onSubmit={handleSubmit} className="p-12">
                        <FormSection title="Personal Information" icon={<FaUser />}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="md:col-span-2 flex items-center gap-10 bg-sky-50/30 p-8 rounded-[32px] border border-sky-50 shadow-inner mb-4">
                                    <div className="relative group">
                                        <div className="w-32 h-32 rounded-[40px] border-4 border-white overflow-hidden bg-white shadow-2xl ring-4 ring-sky-50/50 group-hover:scale-105 transition-transform duration-500">
                                            <img src={formData.profile_pic || `https://ui-avatars.com/api/?name=${formData.name || 'User'}&background=3b82f6&color=fff&bold=true`} alt="Profile" className="w-full h-full object-cover" />
                                        </div>
                                        <div className="absolute -bottom-2 -right-2 h-10 w-10 bg-sky-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-sky-200">
                                            <FaUser size={16} />
                                        </div>
                                    </div>
                                    <div className="flex-1">
                                        <label className={labelClass}>Upload Profile Picture</label>
                                        <div className="relative group/input">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleFileChange}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
                                                disabled={!isAdmin}
                                            />
                                            <div className={inputClass + " flex items-center justify-between group-hover/input:border-sky-400 group-hover/input:ring-4 group-hover/input:ring-sky-50 transition-all"}>
                                                <span className="text-gray-400 font-medium truncate">
                                                    {formData.profile_pic ? 'Image selected (Click to change)' : 'Click to browse system photos...'}
                                                </span>
                                                <div className="h-6 w-6 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center text-[10px] font-black uppercase">
                                                    Pick
                                                </div>
                                            </div>
                                        </div>
                                        <p className="mt-2 text-[9px] font-bold text-gray-400 uppercase tracking-widest ml-1">Supports JPEG, PNG • Max 5MB</p>
                                    </div>
                                </div>
                                <div>
                                    <label className={labelClass}>Employee Name</label>
                                    <input name="name" value={formData.name || ''} onChange={handleChange} className={inputClass} required disabled={!isAdmin} />
                                </div>
                                <div>
                                    <label className={labelClass}>Employee ID (Unique)</label>
                                    <input name="emp_id" value={formData.emp_id || ''} onChange={handleChange} className={inputClass} required disabled={!!id || !isAdmin} />
                                </div>

                                <div>
                                    <label className={labelClass}>User Role</label>
                                    <select name="role" value={formData.role || 'staff'} onChange={handleChange} className={inputClass} disabled={!isAdmin}>
                                        <option value="staff">Staff</option>
                                        <option value="hod">HOD</option>
                                        <option value="principal">Principal</option>
                                        <option value="admin">Admin</option>
                                    </select>
                                </div>
                                <div>
                                    <label className={labelClass}>Department</label>
                                    <select name="department_id" value={formData.department_id || ''} onChange={handleChange} className={inputClass} disabled={!isAdmin}>
                                        <option value="">Select Department</option>
                                        {departments.map(d => (
                                            <option key={d.id} value={d.id}>
                                                {d.name} {d.code ? `(${d.code})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className={labelClass}>Designation</label>
                                    <input name="designation" value={formData.designation || ''} onChange={handleChange} className={inputClass} disabled={!isAdmin} />
                                </div>
                                <div>
                                    <label className={labelClass}>Email Address</label>
                                    <input name="email" type="email" value={formData.email || ''} onChange={handleChange} className={inputClass} disabled={!isAdmin} />
                                </div>
                                <div>
                                    <label className={labelClass}>Mobile Number</label>
                                    <input name="mobile" value={formData.mobile || ''} onChange={handleChange} className={inputClass} disabled={!isAdmin} />
                                </div>
                                <div>
                                    <label className={labelClass}>WhatsApp Number</label>
                                    <input name="whatsapp" value={formData.whatsapp || ''} onChange={handleChange} className={inputClass} disabled={!isAdmin} />
                                </div>
                                <div>
                                    <label className={labelClass}>Date of Birth</label>
                                    <input name="dob" type="date" value={formData.dob || ''} onChange={handleChange} className={inputClass} disabled={!isAdmin} />
                                </div>
                                <div>
                                    <label className={labelClass}>Gender</label>
                                    <select name="gender" value={formData.gender || 'Male'} onChange={handleChange} className={inputClass} disabled={!isAdmin}>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                                <div>
                                    <label className={labelClass}>Blood Group</label>
                                    <input name="blood_group" value={formData.blood_group || ''} onChange={handleChange} className={inputClass} disabled={!isAdmin} />
                                </div>
                                <div>
                                    <label className={labelClass}>Religion</label>
                                    <input name="religion" value={formData.religion || ''} onChange={handleChange} className={inputClass} disabled={!isAdmin} />
                                </div>
                                <div>
                                    <label className={labelClass}>Caste</label>
                                    <input name="caste" value={formData.caste || ''} onChange={handleChange} className={inputClass} disabled={!isAdmin} />
                                </div>
                                <div>
                                    <label className={labelClass}>Community</label>
                                    <input name="community" value={formData.community || ''} onChange={handleChange} className={inputClass} disabled={!isAdmin} />
                                </div>
                            </div>
                        </FormSection>

                        <FormSection title="Government Identifiers" icon={<FaMapMarkerAlt />}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div>
                                    <label className={labelClass}>Aadhar Card Number</label>
                                    <input name="aadhar" value={formData.aadhar || ''} onChange={handleChange} className={inputClass} disabled={!isAdmin} />
                                </div>
                                <div>
                                    <label className={labelClass}>PAN Card Number</label>
                                    <input name="pan" value={formData.pan || ''} onChange={handleChange} className={inputClass} disabled={!isAdmin} />
                                </div>
                                <div className="md:col-span-2">
                                    <label className={labelClass}>Permanent Address</label>
                                    <textarea name="permanent_address" value={formData.permanent_address || ''} onChange={handleChange} className={inputClass + " h-32 pt-4 resize-none"} disabled={!isAdmin} />
                                </div>
                                <div className="md:col-span-2">
                                    <label className={labelClass}>Communication Address</label>
                                    <textarea name="communication_address" value={formData.communication_address || ''} onChange={handleChange} className={inputClass + " h-32 pt-4 resize-none"} disabled={!isAdmin} />
                                </div>
                                <div>
                                    <label className={labelClass}>PIN Code</label>
                                    <input name="pin_code" value={formData.pin_code || ''} onChange={handleChange} className={inputClass} disabled={!isAdmin} />
                                </div>
                                <div>
                                    <label className={labelClass}>Nationality</label>
                                    <input name="nationality" value={formData.nationality || 'Indian'} onChange={handleChange} className={inputClass} disabled={!isAdmin} />
                                </div>
                            </div>
                        </FormSection>

                        <FormSection title="Bank & Salary Details" icon={<FaUniversity />}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div>
                                    <label className={labelClass}>Bank Name</label>
                                    <input name="bank_name" value={formData.bank_name || ''} onChange={handleChange} className={inputClass} disabled={!isAdmin} />
                                </div>
                                <div>
                                    <label className={labelClass}>Account Number</label>
                                    <input name="account_no" value={formData.account_no || ''} onChange={handleChange} className={inputClass} disabled={!isAdmin} />
                                </div>
                                <div>
                                    <label className={labelClass}>Branch Name</label>
                                    <input name="branch" value={formData.branch || ''} onChange={handleChange} className={inputClass} disabled={!isAdmin} />
                                </div>
                                <div>
                                    <label className={labelClass}>IFSC Code</label>
                                    <input name="ifsc" value={formData.ifsc || ''} onChange={handleChange} className={inputClass} disabled={!isAdmin} />
                                </div>
                                <div>
                                    <label className={labelClass}>PF Number</label>
                                    <input name="pf_number" value={formData.pf_number || ''} onChange={handleChange} className={inputClass} disabled={!isAdmin} />
                                </div>
                                <div>
                                    <label className={labelClass}>UAN Number</label>
                                    <input name="uan_number" value={formData.uan_number || ''} onChange={handleChange} className={inputClass} disabled={!isAdmin} />
                                </div>
                                <div className="md:col-span-2 h-px bg-gray-100 my-4"></div>
                                <div>
                                    <label className={labelClass}>Date of Joining</label>
                                    <input name="doj" type="date" value={formData.doj || ''} onChange={handleChange} className={inputClass} disabled={!isAdmin} />
                                </div>
                                <div>
                                    <label className={labelClass}>Monthly Salary</label>
                                    <input name="monthly_salary" type="number" value={formData.monthly_salary || ''} onChange={handleChange} className={inputClass} disabled={!isAdmin} />
                                </div>
                                <div className="md:col-span-2">
                                    <label className={labelClass}>Experience Description</label>
                                    <input name="experience" value={formData.experience || ''} onChange={handleChange} className={inputClass} disabled={!isAdmin} />
                                </div>
                            </div>
                        </FormSection>

                        {/* ─── Deductions Section ─── */}
                        <FormSection title="Salary Deductions" icon={<FaMinusCircle />}>
                            <div className="mb-4 bg-amber-50 border border-amber-100 rounded-2xl p-4">
                                <p className="text-xs text-amber-700 font-bold leading-relaxed">
                                    ⚠️ Deductions entered here are fixed monthly deductions (e.g. PF, ESI, Loan). They will be automatically subtracted from the employee's net salary during payroll calculation.
                                </p>
                            </div>

                            <div className="space-y-4">
                                {deductions.map((d, i) => (
                                    <div key={i} className="flex items-center gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100 relative">
                                        {/* Type */}
                                        <div className="flex-1">
                                            <label className={labelClass}>Deduction Type</label>
                                            <select
                                                value={DEDUCTION_PRESETS.includes(d.type) ? d.type : 'Other'}
                                                onChange={(e) => updateDeduction(i, 'type', e.target.value === 'Other' ? '' : e.target.value)}
                                                className={inputClass}
                                                disabled={!isAdmin}
                                            >
                                                <option value="">Select type...</option>
                                                {DEDUCTION_PRESETS.map(p => <option key={p} value={p}>{p}</option>)}
                                            </select>
                                            {(!DEDUCTION_PRESETS.includes(d.type) || d.type === '') && (
                                                <input
                                                    className={inputClass + " mt-2"}
                                                    placeholder="Or type custom deduction name..."
                                                    value={d.type}
                                                    onChange={(e) => updateDeduction(i, 'type', e.target.value)}
                                                    disabled={!isAdmin}
                                                />
                                            )}
                                        </div>
                                        {/* Amount */}
                                        <div className="w-40">
                                            <label className={labelClass}>Amount (₹/month)</label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={d.amount}
                                                onChange={(e) => updateDeduction(i, 'amount', e.target.value)}
                                                className={inputClass}
                                                placeholder="e.g. 1800"
                                                disabled={!isAdmin}
                                            />
                                        </div>
                                        {/* Remove */}
                                        {isAdmin && (
                                            <button
                                                type="button"
                                                onClick={() => removeDeduction(i)}
                                                className="mt-5 h-10 w-10 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center hover:bg-rose-100 transition-colors shrink-0"
                                            >
                                                <FaTrash size={12} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {isAdmin && (
                                <button
                                    type="button"
                                    onClick={addDeduction}
                                    className="mt-6 px-6 py-3 bg-rose-50 text-rose-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 transition-colors flex items-center gap-2"
                                >
                                    <FaPlus size={10} /> Add Deduction
                                </button>
                            )}

                            {deductions.length > 0 && (
                                <div className="mt-6 bg-sky-50 border border-sky-100 rounded-2xl p-4 flex items-center justify-between">
                                    <span className="text-[10px] font-black text-sky-600 uppercase tracking-widest">Total Monthly Deductions</span>
                                    <span className="text-lg font-black text-sky-700">
                                        ₹{deductions.reduce((acc, d) => acc + (Number(d.amount) || 0), 0).toLocaleString()}
                                    </span>
                                </div>
                            )}
                        </FormSection>

                        <FormSection title="Family Relations" icon={<FaUsers />}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div>
                                    <label className={labelClass}>Father's Name</label>
                                    <input name="father_name" value={formData.father_name || ''} onChange={handleChange} className={inputClass} disabled={!isAdmin} />
                                </div>
                                <div>
                                    <label className={labelClass}>Mother's Name</label>
                                    <input name="mother_name" value={formData.mother_name || ''} onChange={handleChange} className={inputClass} disabled={!isAdmin} />
                                </div>
                                <div>
                                    <label className={labelClass}>Marital Status</label>
                                    <select name="marital_status" value={formData.marital_status || 'Single'} onChange={handleChange} className={inputClass} disabled={!isAdmin}>
                                        <option value="Single">Single</option>
                                        <option value="Married">Married</option>
                                        <option value="Divorced">Divorced</option>
                                    </select>
                                </div>
                            </div>
                        </FormSection>

                        <FormSection title="Certificates" icon={<FaCertificate />}>
                            {/* Existing Certificates (edit mode) */}
                            {existingCerts.length > 0 && (
                                <div className="mb-8">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 ml-1">Uploaded Certificates</p>
                                    <div className="space-y-3">
                                        {existingCerts.map((cert) => (
                                            <div key={cert.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                                                        <FaCertificate />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-black text-gray-800">{cert.certificate_name}</p>
                                                        <p className="text-[10px] font-bold text-gray-400">{cert.file_name}</p>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => deleteExistingCert(cert.id)}
                                                    className="h-9 w-9 rounded-xl bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100 transition-colors"
                                                >
                                                    <FaTrash size={12} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* New Certificate Rows */}
                            <div className="space-y-6">
                                {certificates.map((cert, index) => (
                                    <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-gray-50/50 rounded-2xl border border-gray-100 relative">
                                        <button
                                            type="button"
                                            onClick={() => removeCertRow(index)}
                                            className="absolute top-4 right-4 h-8 w-8 rounded-lg bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100 transition-colors"
                                        >
                                            <FaTrash size={10} />
                                        </button>
                                        <div>
                                            <label className={labelClass}>Certificate Name</label>
                                            <input
                                                value={cert.certificate_name}
                                                onChange={(e) => handleCertNameChange(index, e.target.value)}
                                                className={inputClass}
                                                placeholder="e.g. B.Ed Certificate, SSLC Marksheet"
                                            />
                                        </div>
                                        <div>
                                            <label className={labelClass}>Upload File</label>
                                            <input
                                                type="file"
                                                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                                onChange={(e) => handleCertFileChange(index, e)}
                                                className={inputClass + " file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-[10px] file:font-black file:bg-sky-50 file:text-sky-600 file:uppercase file:tracking-widest hover:file:bg-sky-100"}
                                            />
                                            {cert.file_name && (
                                                <p className="mt-2 text-[10px] font-bold text-green-600">✓ {cert.file_name}</p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <button
                                type="button"
                                onClick={addCertRow}
                                className="mt-6 px-6 py-3 bg-sky-50 text-sky-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-sky-100 transition-colors flex items-center gap-2"
                            >
                                <FaPlus size={10} /> Add Certificate
                            </button>
                        </FormSection>

                        <FormSection title="Account Security" icon={<FaLock />}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="md:col-span-2 bg-amber-50 p-8 rounded-[32px] border border-amber-100 mb-4">
                                    <p className="text-xs text-amber-800 font-bold leading-relaxed flex items-center gap-4">
                                        <div className="h-10 w-10 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
                                            <FaLock className="text-amber-600" />
                                        </div>
                                        Security PIN is required for account integrity.
                                    </p>
                                </div>
                                <div>
                                    <label className={labelClass}>{id ? 'Reset Security PIN' : 'Set Security PIN'}</label>
                                    <input name="pin" type="password" value={formData.pin || ''} onChange={handleChange} className={inputClass + " tracking-[0.5em] text-center font-black"} placeholder="••••••" />
                                </div>
                                <div>
                                    <label className={labelClass}>Confirm Security PIN</label>
                                    <input name="confirm_pin" type="password" value={formData.confirm_pin || ''} onChange={handleChange} className={inputClass + " tracking-[0.5em] text-center font-black"} placeholder="••••••" />
                                </div>
                            </div>
                        </FormSection>

                        <div className="mt-12 pt-8 border-t border-gray-50 flex justify-end gap-6">
                            <button
                                type="button"
                                onClick={() => navigate('/admin/employees')}
                                className="px-10 py-5 bg-white border border-gray-200 text-gray-500 rounded-2xl hover:bg-gray-50 transition-all font-black uppercase tracking-widest text-[10px] active:scale-95"
                            >
                                Discard
                            </button>
                            <button
                                type="submit"
                                className="px-12 py-5 bg-sky-600 text-white rounded-2xl shadow-2xl shadow-sky-100 hover:bg-sky-800 transition-all flex items-center gap-3 font-black uppercase tracking-widest text-[10px] active:scale-95 group"
                            >
                                <FaSave className="group-hover:scale-110 transition-transform" /> {id ? 'Synchronize Record' : 'Commit to Database'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </Layout>
    );
};

export default EmployeeFormPage;
