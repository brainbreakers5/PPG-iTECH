import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import api from '../utils/api';
import { LogIn, User, Lock, Cpu, Database, Shield, Globe, Activity, Cloud } from 'lucide-react';
import { motion } from 'framer-motion';

const FloatingIcon = ({ icon: Icon, delay, x, y, size = 32 }) => (
    <motion.div
        initial={{ opacity: 0, scale: 0 }}
        animate={{
            opacity: [0.1, 0.4, 0.1],
            translateX: [0, 20, -20, 0],
            translateY: [0, -40, 20, 0],
            rotate: [0, 15, -15, 0],
            scale: [1, 1.1, 1]
        }}
        transition={{
            duration: 8,
            repeat: Infinity,
            delay: delay,
            ease: "easeInOut"
        }}
        className="absolute pointer-events-none z-0"
        style={{ left: `${x}%`, top: `${y}%`, color: 'rgba(14, 165, 233, 0.25)' }}
    >
        <Icon size={size} strokeWidth={1.5} />
    </motion.div>
);

const Login = () => {
    const [empId, setEmpId] = useState('');
    const [pin, setPin] = useState('');
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState('id'); // 'id' or 'pin'
    const [userName, setUserName] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();
    const [userRole, setUserRole] = useState('');
    const [expectedPinLength, setExpectedPinLength] = useState(4); // Default to 4

    const handleCheckId = async (e) => {
        if (e) e.preventDefault();
        if (!empId.trim()) return;

        setLoading(true);
        try {
            const { data } = await api.post('/auth/check-id', { emp_id: empId.trim() });
            if (data.exists) {
                setUserName(data.name);
                setUserRole(data.role || '');
                setStep('pin');
                setExpectedPinLength(data.pin_length || 4);
            }
        } catch (error) {
            console.error('❌ Check ID error:', error);
            Swal.fire({
                icon: 'error',
                title: 'Invalid ID',
                text: error.response?.data?.message || 'Employee ID not found',
                confirmButtonColor: '#2563eb'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        if (!pin.trim()) return;

        // Validation for length
        if (expectedPinLength === '4or6') {
            if (pin.length !== 4 && pin.length !== 6) return;
        } else if (pin.length < expectedPinLength) {
            return;
        }

        setLoading(true);
        try {
            console.log('🔐 Attempting login with:', { emp_id: empId, pin: '***', role: userRole });
            const data = await login(empId.trim(), pin.trim(), userRole);
            console.log('✅ Login successful:', data);
            
            // Show success message
            Swal.fire({
                icon: 'success',
                title: 'Welcome!',
                text: `Logged in as ${data.role}`,
                timer: 1000,
                showConfirmButton: false,
                background: '#fff',
                color: '#1e3a8a',
                allowOutsideClick: false,
                allowEscapeKey: false
            });
            
            // Navigate after a brief delay to let the dialog show
            setTimeout(() => {
                console.log('🔄 Navigating based on role:', data.role);
                const routes = {
                    'admin': '/admin',
                    'principal': '/principal',
                    'hod': '/hod',
                    'staff': '/staff'
                };
                const route = routes[data.role] || '/';
                console.log('📍 Navigating to:', route);
                navigate(route, { replace: true });
                setLoading(false);
                // Clear form
                setEmpId('');
                setPin('');
            }, 600);
            
        } catch (error) {
            console.error('❌ Login error:', error);
            setLoading(false);
            
            let errorMessage = 'Invalid credentials';
            if (error.response?.status === 401) {
                errorMessage = 'Invalid Security PIN';
            } else if (error.response?.data?.message) {
                errorMessage = error.response.data.message;
            }
            
            Swal.fire({
                icon: 'error',
                title: 'Login Failed',
                text: errorMessage,
                confirmButtonColor: '#2563eb'
            });
            // Reset pin on failure
            setPin('');
        }
    };

    // Auto-submit pin when it reaches the expected length
    const handlePinChange = (e) => {
        const val = e.target.value;
        const onlyNums = val.replace(/[^0-9]/g, '');
        setPin(onlyNums);
        
        if (expectedPinLength === '4or6') {
             if (onlyNums.length === 4 || onlyNums.length === 6) {
                 // But wait... if they are typing 6, and I trigger at 4...
                 // I should only trigger at 4 if it works? No, that's impossible.
                 // The user specified "wait the pin 4digit or 6digit after automatically login".
                 // This implies that if it's 4, it should login. If it's 6, it should login.
                 // One way to do this is to call handleSubmit at 4, if it fails, don't show error, 
                 // and keep waiting for 6.
                 if (onlyNums.length === 4) {
                     // Attempt silent login
                     silentLogin(onlyNums);
                 } else if (onlyNums.length === 6) {
                     handleSubmit();
                 }
             }
        } else if (onlyNums.length === Number(expectedPinLength)) {
            handleSubmit();
        }
    };

    const silentLogin = async (p) => {
        try {
            await login(empId.trim(), p.trim(), userRole);
            // If it succeeds, call regular handleSubmit (it will show success etc)
            handleSubmit();
        } catch (err) {
            // Silently fail at 4 digits if it's not the right PIN
            // This allows the user to continue typing if their PIN is 6 digits
            console.log('Silent login failed at 4 digits, waiting for more if any...');
        }
    };

    return (
        <div
            className="min-h-screen w-full flex items-center justify-center p-4 relative overflow-hidden"
        >
            {/* Full-screen background image */}
            <div
                className="absolute inset-0 w-full h-full"
                style={{
                    backgroundImage: 'url(/ppg-bg.jpg)',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                }}
            />
            {/* Dark overlay for readability */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />

            {/* Technology Floating Icons Background */}
            <FloatingIcon icon={Cpu} delay={0} x={10} y={15} size={40} />
            <FloatingIcon icon={Database} delay={2} x={85} y={10} size={36} />
            <FloatingIcon icon={Shield} delay={4} x={12} y={80} size={32} />
            <FloatingIcon icon={Globe} delay={1} x={78} y={85} size={44} />
            <FloatingIcon icon={Activity} delay={3} x={50} y={5} size={32} />
            <FloatingIcon icon={Cloud} delay={5} x={42} y={90} size={44} />
            <FloatingIcon icon={Cpu} delay={1.5} x={90} y={55} size={28} />
            <FloatingIcon icon={Database} delay={3.5} x={5} y={50} size={36} />
            <FloatingIcon icon={Shield} delay={2.5} x={70} y={40} size={30} />
            <FloatingIcon icon={Cloud} delay={4.5} x={25} y={35} size={38} />

            {/* Login form */}
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="relative z-10 w-full max-w-md px-8 py-10 rounded-3xl"
                style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.18)' }}
            >
                {/* Logo + Branding */}
                <div className="text-center mb-10">
                    <motion.div
                        whileHover={{ rotate: 5, scale: 1.05 }}
                        transition={{ type: 'spring', stiffness: 300 }}
                        className="w-[88px] h-[88px] mx-auto mb-6 flex items-center justify-center drop-shadow-xl"
                    >
                        <img src="/ppg-logo.png" alt="PPG Institute of Technology" className="w-full h-full object-contain" />
                    </motion.div>

                    <h1 className="text-3xl font-black text-white tracking-tight leading-tight">
                        PPG <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #60a5fa, #22d3ee)' }}>iTech - HUB</span>
                    </h1>
                    <p className="text-[7.5px] font-black text-sky-200 uppercase tracking-[0.35em] mt-2 whitespace-normal text-center max-w-[240px] mx-auto">
                        Enterprise & Attendance Management System
                    </p>
                </div>

                {/* Divider */}
                <div className="flex items-center gap-3 mb-8">
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                    <span className="text-[9px] font-black text-sky-300 uppercase tracking-widest">
                        {step === 'id' ? 'Employee Verification' : 'Security Access'}
                    </span>
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                </div>

                {/* Form */}
                <form onSubmit={step === 'id' ? handleCheckId : handleSubmit} className="space-y-5">
                    
                    {step === 'id' ? (
                        <motion.div 
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="space-y-1.5"
                        >
                            <label className="text-[10px] font-black text-sky-200 uppercase tracking-widest block">
                                Employee ID
                            </label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <User
                                        size={16}
                                        className="text-gray-300 group-focus-within:text-blue-500 transition-colors duration-200"
                                    />
                                </div>
                                <input
                                    type="text"
                                    value={empId}
                                    onChange={(e) => setEmpId(e.target.value)}
                                    placeholder="Enter your Employee ID"
                                    required
                                    autoFocus
                                    className="w-full pl-11 pr-5 py-[14px] rounded-xl text-sm font-semibold text-gray-700 outline-none transition-all duration-200 placeholder:text-gray-300 placeholder:font-normal"
                                    style={{ background: 'rgba(255,255,255,0.7)', border: '1.5px solid #e2e8f0' }}
                                />
                            </div>
                            <p className="text-[9px] text-sky-300/70 italic text-center mt-2">Press Enter to continue</p>
                        </motion.div>
                    ) : (
                        <motion.div 
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="space-y-4"
                        >
                            <div className="text-center">
                                <p className="text-white/60 text-[10px] uppercase tracking-widest font-bold mb-1">Welcome back,</p>
                                <p className="text-white text-lg font-black">{userName}</p>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-sky-200 uppercase tracking-widest block">
                                    Security PIN
                                </label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Lock
                                            size={16}
                                            className="text-gray-300 group-focus-within:text-blue-500 transition-colors duration-200"
                                        />
                                    </div>
                                    <input
                                        type="password"
                                        value={pin}
                                        onChange={handlePinChange}
                                        placeholder={`Enter ${expectedPinLength === '4or6' ? '4/6' : expectedPinLength}-digit PIN`}
                                        required
                                        autoFocus
                                        maxLength={6}
                                        className="w-full pl-11 pr-5 py-[14px] rounded-xl text-sm font-semibold text-gray-700 outline-none transition-all duration-200 placeholder:text-gray-300 placeholder:font-normal text-center tracking-[1em]"
                                        style={{ background: 'rgba(255,255,255,0.7)', border: '1.5px solid #e2e8f0' }}
                                    />
                                </div>
                            </div>

                            <button 
                                type="button" 
                                onClick={() => { setStep('id'); setPin(''); }}
                                className="w-full text-[9px] font-black text-sky-400 hover:text-sky-300 uppercase tracking-widest"
                            >
                                Not you? Use another ID
                            </button>
                        </motion.div>
                    )}

                    {loading && (
                        <div className="flex justify-center pt-2">
                            <span className="h-5 w-5 border-2 border-sky-400/30 border-t-sky-400 rounded-full animate-spin" />
                        </div>
                    )}
                </form>

                {/* Management Access */}
                <div className="mt-8 text-center">
                    <div className="h-px w-12 bg-white/20 mx-auto mb-4" />
                    <motion.button
                        type="button"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                            Swal.fire({
                                title: 'Management Access',
                                input: 'password',
                                inputLabel: 'Enter Management PIN',
                                inputPlaceholder: 'Enter PIN',
                                inputAttributes: { autocapitalize: 'off', autocorrect: 'off' },
                                showCancelButton: true,
                                confirmButtonText: 'Enter',
                                confirmButtonColor: '#7c3aed',
                                cancelButtonColor: '#64748b',
                                background: '#fff',
                                customClass: {
                                    popup: 'rounded-3xl',
                                    title: 'font-black text-gray-800 tracking-tight',
                                    input: 'rounded-xl'
                                },
                                showLoaderOnConfirm: true,
                                preConfirm: async (value) => {
                                    if (!value) {
                                        Swal.showValidationMessage('Please enter a PIN');
                                        return false;
                                    }
                                    try {
                                        const { data } = await api.post('/auth/management-login', { pin: String(value) });
                                        return data;
                                    } catch (err) {
                                        Swal.showValidationMessage(
                                            err.response?.data?.message || 'Connection failed. Is the server running?'
                                        );
                                        return false;
                                    }
                                },
                                allowOutsideClick: () => !Swal.isLoading()
                            }).then((result) => {
                                if (result.isConfirmed && result.value) {
                                    localStorage.setItem('token', result.value.token);
                                    localStorage.setItem('managementAccess', 'true');
                                    sessionStorage.setItem('managementAccess', 'true');
                                    Swal.fire({
                                        icon: 'success',
                                        title: 'Welcome!',
                                        text: 'Management access granted',
                                        timer: 1500,
                                        showConfirmButton: false,
                                        background: '#fff',
                                        color: '#1e3a8a'
                                    });
                                    navigate('/management');
                                }
                            });
                        }}
                        className="text-[10px] font-black text-orange-400/60 hover:text-orange-400 transition-colors uppercase tracking-[0.3em] cursor-pointer"
                    >
                        MANAGEMENT
                    </motion.button>
                </div>

                {/* Footer */}
                <div className="mt-6 text-center">
                    <a
                        href="https://zorvian-agency.vercel.app"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[9px] font-black text-white/30 hover:text-sky-300/50 transition-colors uppercase tracking-widest whitespace-nowrap"
                    >
                        Developed By ZORVIAN TECHNOLOGIES
                    </a>
                </div>
            </motion.div>
        </div>
    );
};

export default Login;
