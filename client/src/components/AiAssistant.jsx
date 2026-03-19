import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    X, Send, ArrowRight, Sparkles, 
    Mic, MicOff, Volume2, VolumeX, Search
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const AI_KNOWLEDGE_BASE = {
    staff: [
        { q: "Notification", a: "Access your notifications.", link: "/staff/notifications" },
        { q: "Profile", a: "View your profile.", link: "/staff/profile" },
        { q: "Logout", a: "Logging out...", action: 'logout' },
        { q: "Dashboard", a: "Returning to dashboard.", link: "/staff" },
        { q: "Your Personal Attendance", a: "Viewing personal attendance.", link: "/staff" },
        { q: "Recent Attendance History", a: "Checking attendance history.", link: "/staff" },
        { q: "Leave Management", a: "Opening leave management.", link: "/staff/leaves" },
        { q: "Leave Apply", a: "Opening leave application.", link: "/staff/leaves" },
        { q: "Permission Letter", a: "Opening permissions.", link: "/staff/leaves" },
        { q: "Comp Leave", a: "Viewing comp leave.", link: "/staff/leaves" },
        { q: "Leave Balance", a: "Checking leave balance.", link: "/staff/leaves" },
        { q: "Incoming Approvals", a: "Checking approvals.", link: "/staff" },
        { q: "My Leave History", a: "Viewing leave history.", link: "/staff/leaves" },
        { q: "Salary Details", a: "Opening salary details.", link: "/staff/payroll" },
        { q: "My Timetable", a: "Opening your timetable.", link: "/staff/timetables" },
        { q: "Staff Timetable", a: "Viewing institutional timetable.", link: "/staff/timetables" },
        { q: "Conversation", a: "Opening conversation hub.", link: "/staff/conversation" },
        { q: "Purchase Requests", a: "Opening purchase requests.", link: "/staff/items" },
        { q: "Academic Calendar", a: "Opening academic calendar.", link: "/staff/calendar" }
    ],
    hod: [
        { q: "Notification", a: "Accessing notifications.", link: "/hod/notifications" },
        { q: "Profile", a: "Opening profile.", link: "/hod/profile" },
        { q: "Logout", a: "Logging out...", action: 'logout' },
        { q: "Dashboard", a: "Returning to dashboard.", link: "/hod" },
        { q: "Your Personal Attendance", a: "Viewing personal attendance.", link: "/hod" },
        { q: "Recent Attendance History", a: "Checking attendance history.", link: "/hod" },
        { q: "Leave Management", a: "Opening leave management.", link: "/hod/leaves" },
        { q: "Leave Apply", a: "Opening leave apply.", link: "/hod/leaves" },
        { q: "Permission Letter", a: "Opening permissions.", link: "/hod/leaves" },
        { q: "Comp Leave", a: "Viewing comp leave.", link: "/hod/leaves" },
        { q: "Leave Balance", a: "Checking leave balance.", link: "/hod/leaves" },
        { q: "Incoming Approvals", a: "Opening incoming approvals.", link: "/hod/leaves" },
        { q: "My Leave History", a: "Viewing leave history.", link: "/hod/leaves" },
        { q: "Salary Details", a: "Opening salary details.", link: "/hod/payroll" },
        { q: "My Timetable", a: "Opening your timetable.", link: "/hod/timetable" },
        { q: "Staff Timetable", a: "Viewing staff timetable.", link: "/hod/timetable" },
        { q: "Conversation", a: "Opening conversation hub.", link: "/hod/conversation" },
        { q: "Purchase Requests", a: "Opening purchase requests.", link: "/hod/items" },
        { q: "Academic Calendar", a: "Opening academic calendar.", link: "/hod/calendar" },
        { q: "Attendance Records", a: "Opening attendance records.", link: "/hod/attendance" },
        { q: "Summary View", a: "Opening summary view.", link: "/hod/attendance" },
        { q: "Details Logs", a: "Opening details logs.", link: "/hod/attendance" },
        { q: "Biometric Sync", a: "Opening biometric sync.", link: "/hod/attendance" },
        { q: "HODs Attendance Core", a: "Opening HOD attendance core.", link: "/hod/attendance" },
        { q: "Staff Attendance Core", a: "Opening staff attendance core.", link: "/hod/attendance" },
        { q: "Department Staff", a: "Opening department staff.", link: "/hod/department" }
    ],
    principal: [
        { q: "Notification", a: "Opening notifications.", link: "/principal/notifications" },
        { q: "Profile", a: "Opening profile.", link: "/principal/profile" },
        { q: "Logout", a: "Logging out...", action: 'logout' },
        { q: "Dashboard", a: "Returning to dashboard.", link: "/principal" },
        { q: "Your Personal Attendance", a: "Viewing personal attendance.", link: "/principal" },
        { q: "Recent Attendance History", a: "Checking history.", link: "/principal" },
        { q: "HODs Attendance Core", a: "Opening HOD attendance core.", link: "/principal/attendance" },
        { q: "Staff Attendance Core", a: "Opening staff attendance core.", link: "/principal/attendance" },
        { q: "Attendance Records", a: "Opening attendance records.", link: "/principal/attendance" },
        { q: "Summary View", a: "Opening summary view.", link: "/principal/attendance" },
        { q: "Biometric Sync", a: "Opening biometric sync.", link: "/principal/attendance" },
        { q: "Conversation", a: "Opening conversation.", link: "/principal/conversation" },
        { q: "Purchase Requests", a: "Opening purchase requests.", link: "/principal/purchase" },
        { q: "Departments", a: "Opening departments.", link: "/principal/departments" },
        { q: "Academic Calendar", a: "Opening academic calendar.", link: "/principal/calendar" },
        { q: "Leave Requests", a: "Opening leave requests.", link: "/principal/leaves" },
        { q: "Permission Requests", a: "Opening permission requests.", link: "/principal/leaves" },
        { q: "Detail Logs", a: "Opening detail logs.", link: "/principal/attendance" }
    ],
    admin: [
        { q: "Notification", a: "Opening notifications.", link: "/admin/notifications" },
        { q: "Logout", a: "Logging out...", action: 'logout' },
        { q: "Employee Management", a: "Opening employee management.", link: "/admin/employees" },
        { q: "Add New Employee", a: "Opening add employee.", link: "/admin/employees/new" },
        { q: "Departments", a: "Opening departments.", link: "/admin/departments" },
        { q: "Salary Management", a: "Opening salary management.", link: "/admin/payroll" },
        { q: "Attendance Records", a: "Opening attendance records.", link: "/admin/attendance" },
        { q: "Summary View", a: "Opening summary view.", link: "/admin/attendance" },
        { q: "Details Logs", a: "Opening details logs.", link: "/admin/attendance" },
        { q: "Biometric Sync", a: "Opening biometric sync.", link: "/admin/biometric-history" },
        { q: "Leave Balance", a: "Opening leave balance.", link: "/admin/leave-limits" },
        { q: "Timetable Setup", a: "Opening timetable setup.", link: "/admin/timetable-setup" },
        { q: "Security Log", a: "Opening security log.", link: "/admin/activity-logs" },
        { q: "Academic Calendar", a: "Opening academic calendar.", link: "/admin/calendar" },
        { q: "Purchase Requests", a: "Opening purchase requests.", link: "/admin/purchase" },
        { q: "Profile", a: "Opening profile.", link: "/admin/profile" },
        { q: "Principal Attendance Core", a: "Opening principal attendance.", link: "/admin/attendance" },
        { q: "HODs Attendance Core", a: "Opening HOD attendance.", link: "/admin/attendance" },
        { q: "Staff Attendance Core", a: "Opening staff attendance.", link: "/admin/attendance" }
    ],
    management: [
        { q: "Profile", a: "Opening profile.", link: "/management/profile" },
        { q: "Logout", a: "Logging out...", action: 'logout' },
        { q: "Dashboard", a: "Opening dashboard.", link: "/management" },
        { q: "Attendance Records", a: "Opening attendance records.", link: "/management/biometric-history" },
        { q: "Principal Attendance Core", a: "Opening principal attendance.", link: "/management/attendance" },
        { q: "HODs Attendance Core", a: "Opening HOD attendance.", link: "/management/attendance" },
        { q: "Staff Attendance Core", a: "Opening staff attendance.", link: "/management/attendance" },
        { q: "Academic Calendar", a: "Opening academic calendar.", link: "/management/calendar" },
        { q: "Summary View", a: "Opening summary view.", link: "/management/attendance" },
        { q: "Details Logs", a: "Opening details logs.", link: "/management/attendance" },
        { q: "Departments", a: "Opening departments.", link: "/management/departments" },
        { q: "Biometric Sync", a: "Opening biometric sync.", link: "/management/biometric-history" }
    ]
};

const AiAssistant = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { type: 'ai', text: `Greetings. I have analyzed your access level. How can I help you navigate today?`, time: new Date() }
    ]);
    const [input, setInput] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(true);
    const scrollRef = useRef(null);
    const recognitionRef = useRef(null);

    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = false;
            recognitionRef.current.interimResults = false;
            recognitionRef.current.lang = 'en-US';

            recognitionRef.current.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                setInput(transcript);
                setIsListening(false);
                handleSend(transcript);
            };

            recognitionRef.current.onerror = () => setIsListening(false);
            recognitionRef.current.onend = () => setIsListening(false);
        }
    }, []);

    const speak = (text) => {
        if (!isSpeaking || !window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        window.speechSynthesis.speak(utterance);
    };

    const toggleListening = () => {
        if (isListening) {
            recognitionRef.current?.stop();
        } else {
            setIsListening(true);
            recognitionRef.current?.start();
        }
    };

    useEffect(() => {
        const role = user?.role?.toLowerCase() || 'staff';
        const roleSugg = AI_KNOWLEDGE_BASE[role] || [];
        setSuggestions(roleSugg);
    }, [user?.role]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = (text = input, isClick = false) => {
        const cleanText = text.trim().toLowerCase().replace(/[?.,!]/g, "");
        if (!cleanText) return;
        
        if (!isClick) {
            setMessages(prev => [...prev, { type: 'user', text, time: new Date() }]);
        }
        setInput('');

        setTimeout(() => {
            const role = user?.role?.toLowerCase() || 'staff';
            const allowedKIs = AI_KNOWLEDGE_BASE[role] || [];
            
            // IF CLICK: NAVIGATE IMMEDIATELY
            if (isClick) {
                const exactMatch = allowedKIs.find(k => k.q.toLowerCase() === cleanText);
                if (exactMatch) {
                    let actionLink = exactMatch.link;
                    if (exactMatch.q.toLowerCase() === 'profile' && !actionLink.includes(user.emp_id) && role !== 'management') {
                        actionLink = `/${role}/profile/${user.emp_id}`;
                    }

                    if (exactMatch.action === 'logout') {
                        setMessages(prev => [...prev, { type: 'ai', text: "Logging out...", time: new Date() }]);
                        setTimeout(() => { logout(); navigate('/login'); setIsOpen(false); }, 1000);
                        return;
                    }

                    setMessages(prev => [...prev, { type: 'ai', text: `Navigating to ${exactMatch.q}...`, time: new Date() }]);
                    setTimeout(() => { navigate(actionLink); setIsOpen(false); }, 800);
                    return;
                }
            }

            // IF TYPED/SPOKEN: ANALYZE AND PROVIDE RELATED QUESTIONS
            const relatedMatches = allowedKIs.filter(k => {
                const qText = k.q.toLowerCase().replace(/[?.,!]/g, "");
                return cleanText === qText || qText.includes(cleanText) || cleanText.includes(qText);
            });

            let reply = "I analyzed your query but couldn't find a direct match. Please select from the available options.";
            let options = [];

            if (relatedMatches.length > 0) {
                reply = `I found ${relatedMatches.length} related option(s). Please click on the one you'd like to open:`;
                options = relatedMatches;
            }

            setMessages(prev => [...prev, { 
                type: 'ai', 
                text: reply, 
                related: options,
                time: new Date() 
            }]);
            speak(reply);
        }, 600);
    };

    // STRICT LOGIN DISPLAY
    // Only display after login AND not on login page
    if (!user || location.pathname === '/login' || location.pathname === '/') return null;

    return (
        <div className="fixed bottom-4 right-4 z-[10000] no-print">
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 30 }}
                        animate={{ 
                            opacity: 1, 
                            scale: 1, 
                            y: 0,
                            // Reduced overall size
                            width: window.innerWidth < 640 ? 'calc(100vw - 32px)' : '340px',
                            height: window.innerWidth < 640 ? 'calc(100vh - 120px)' : '580px',
                            position: 'fixed',
                            bottom: '80px',
                            right: '20px'
                        }}
                        exit={{ opacity: 0, scale: 0.9, y: 30 }}
                        className="bg-white rounded-[28px] shadow-[0_20px_50px_rgba(0,0,0,0.2)] flex flex-col overflow-hidden border border-sky-100 backdrop-blur-3xl z-[10001]"
                    >
                        {/* Header */}
                        <div className="bg-gradient-to-br from-slate-900 via-sky-900 to-sky-800 p-5 flex flex-col gap-2 relative">
                            <button 
                                onClick={() => setIsOpen(false)}
                                className="absolute top-5 right-5 p-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-all text-white border border-white/10"
                            >
                                <X size={16} />
                            </button>

                            <div className="flex items-center gap-3">
                                <div className="h-9 w-9 bg-white/10 backdrop-blur-2xl rounded-xl flex items-center justify-center border border-white/20 shadow-lg">
                                    <Sparkles className="text-sky-300 h-5 w-5" />
                                </div>
                                <div className="flex flex-col">
                                    <h3 className="text-white font-black text-[13px] tracking-tight leading-none mb-1 uppercase">PPG EMP HUB</h3>
                                    <span className="text-sky-300 text-[8px] font-black uppercase tracking-[0.2em] opacity-90 flex items-center gap-1.5">
                                        <div className="h-1 w-1 bg-emerald-400 rounded-full animate-pulse" /> ZORVIAN AI
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 mt-1">
                                <button 
                                    onClick={() => setIsSpeaking(!isSpeaking)}
                                    className={`p-1.5 rounded-lg transition-all ${isSpeaking ? 'bg-white/10 text-white border border-white/20' : 'bg-black/30 text-white/40'}`}
                                >
                                    {isSpeaking ? <Volume2 size={14} /> : <VolumeX size={14} />}
                                </button>
                            </div>
                        </div>

                        {/* Chat Body */}
                        <div 
                            ref={scrollRef}
                            className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50 scroll-smooth"
                        >
                            {/* Static Suggestions */}
                            <div className="flex flex-wrap gap-1.5 mb-2">
                                {suggestions.map((s, i) => (
                                    <button
                                        key={i}
                                        onClick={() => handleSend(s.q, true)}
                                        className="px-3 py-1.5 bg-white border border-sky-100 rounded-lg text-[10px] font-bold text-sky-800 hover:bg-sky-50 shadow-sm transition-all"
                                    >
                                        {s.q}
                                    </button>
                                ))}
                            </div>

                            {messages.map((m, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, scale: 0.98 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className={`flex ${m.type === 'ai' ? 'justify-start' : 'justify-end'}`}
                                >
                                    <div className={`max-w-[85%] p-3.5 rounded-2xl text-[11px] font-bold leading-relaxed shadow-sm border ${
                                        m.type === 'ai' 
                                            ? 'bg-white text-slate-700 rounded-tl-none border-slate-100' 
                                            : 'bg-gradient-to-br from-sky-800 to-sky-700 text-white rounded-tr-none'
                                    }`}>
                                        {m.text}
                                        
                                        {/* Dynamic Related Questions from Analysis */}
                                        {m.related && m.related.length > 0 && (
                                            <div className="mt-3 flex flex-col gap-2">
                                                {m.related.map((r, idx) => (
                                                    <button
                                                        key={idx}
                                                        onClick={() => handleSend(r.q, true)}
                                                        className="flex items-center justify-between gap-3 text-sky-700 bg-sky-50 hover:bg-white px-3 py-2.5 rounded-xl text-[10px] w-full font-black border border-sky-100 transition-all group"
                                                    >
                                                        {r.q} <ArrowRight size={12} className="group-hover:translate-x-1" />
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                        </div>

                        {/* Input Area */}
                        <div className="p-4 bg-white border-t border-slate-100">
                            <form 
                                onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                                className="flex items-center gap-3"
                            >
                                <button
                                    type="button"
                                    onClick={toggleListening}
                                    className={`h-9 w-9 rounded-xl transition-all shadow-sm flex items-center justify-center border ${
                                        isListening 
                                            ? 'bg-rose-500 text-white' 
                                            : 'bg-slate-50 text-slate-500 border-slate-100'
                                    }`}
                                >
                                    {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                                </button>
                                <div className="flex-1 flex items-center bg-slate-50 p-1.5 rounded-xl border border-slate-100 focus-within:border-sky-500/30 transition-all">
                                    <input 
                                        type="text"
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        placeholder="Analyze query..."
                                        className="flex-1 bg-transparent border-none outline-none px-2 text-[11px] font-bold text-slate-700"
                                    />
                                    <button 
                                        type="submit"
                                        className="bg-slate-900 h-8 w-8 rounded-lg text-white shadow-md flex items-center justify-center"
                                    >
                                        <Search size={14} />
                                    </button>
                                </div>
                            </form>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="flex justify-end pr-1">
                <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setIsOpen(!isOpen)}
                    className={`h-14 w-14 rounded-2xl flex items-center justify-center shadow-xl transition-all duration-300 border-[3px] border-white ${
                        isOpen ? 'bg-slate-900 text-sky-400 scale-0' : 'bg-gradient-to-br from-sky-800 to-sky-700 text-white'
                    }`}
                >
                    <Sparkles size={24} />
                </motion.button>
            </div>
        </div>
    );
};

export default AiAssistant;
