import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Send, ArrowRight, Sparkles,
    Mic, MicOff, Volume2, VolumeX
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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
        { q: "Conversation", a: "Opening conversation hub.", link: "/hod/conversation" },
        { q: "Purchase Requests", a: "Opening purchase requests.", link: "/hod/items" },
        { q: "HODs Attendance Core", a: "Opening HOD attendance core.", link: "/hod/attendance" },
        { q: "Staff Attendance Core", a: "Opening staff attendance core.", link: "/hod/attendance" },
        { q: "Academic Calendar", a: "Opening academic calendar.", link: "/hod/calendar" },
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
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { type: 'ai', text: `Welcome. Please select from the available options.`, time: new Date() }
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

    const handleSend = (text = input) => {
        const cleanText = text.trim().toLowerCase().replace(/[?.,!]/g, "");
        if (!cleanText) return;

        setMessages(prev => [...prev, { type: 'user', text, time: new Date() }]);
        setInput('');

        setTimeout(() => {
            const role = user?.role?.toLowerCase() || 'staff';
            const allowedKIs = AI_KNOWLEDGE_BASE[role] || [];

            // STRICT RULE: ONLY ANSWER OPTIONS FROM THE LIST
            // AND KEYWORD MATCHING
            const match = allowedKIs.find(k => {
                const qText = k.q.toLowerCase().replace(/^\d+\.\s*/, "").replace(/[?.,!]/g, "");
                return cleanText === qText || cleanText.includes(qText) || qText.includes(cleanText);
            });

            let reply = "Please select from the available options.";
            let actionLink = null;
            let actionType = null;

            if (match) {
                reply = match.a;
                actionLink = match.link;
                actionType = match.action;

                if (actionType === 'logout') {
                    reply = "Logging out...";
                    setTimeout(() => {
                        logout();
                        navigate('/login');
                        setIsOpen(false);
                    }, 1000);
                } else if (actionLink) {
                    reply += " Navigating you now.";
                    setTimeout(() => {
                        navigate(actionLink);
                        setIsOpen(false);
                    }, 1500);
                }
            }

            setMessages(prev => [...prev, { type: 'ai', text: reply, link: actionLink, time: new Date() }]);
            speak(reply);
        }, 800);
    };

    if (!user) return null;

    return (
        <div className="fixed bottom-10 right-10 z-[10000] no-print">
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 100 }}
                        animate={{
                            opacity: 1,
                            scale: 1,
                            y: 0,
                            width: 'calc(100vw - 300px)',
                            height: 'calc(100vh - 120px)',
                            position: 'fixed',
                            top: '80px',
                            right: '20px'
                        }}
                        exit={{ opacity: 0, scale: 0.95, y: 100 }}
                        className="bg-white rounded-[40px] shadow-[0_50px_100px_rgba(0,0,0,0.3)] flex flex-col overflow-hidden border border-sky-100 backdrop-blur-3xl z-[10001]"
                    >
                        {/* Header */}
                        <div className="bg-gradient-to-br from-slate-900 via-sky-900 to-sky-800 p-10 flex flex-col gap-4 relative">
                            <button
                                onClick={() => setIsOpen(false)}
                                className="absolute top-10 right-10 p-3 bg-white/10 hover:bg-white/20 rounded-2xl transition-all text-white border border-white/10 shadow-xl"
                            >
                                <X size={24} />
                            </button>

                            <div className="flex items-center gap-6">
                                <div className="h-16 w-16 bg-white/10 backdrop-blur-2xl rounded-3xl flex items-center justify-center border border-white/20 shadow-2xl">
                                    <Sparkles className="text-sky-300 h-8 w-8 animate-pulse" />
                                </div>
                                <div className="flex flex-col">
                                    <h3 className="text-white font-black text-2xl tracking-tight leading-none mb-1">PPG iTech Hub</h3>
                                    <span className="text-sky-300 text-[11px] font-black uppercase tracking-[0.4em] opacity-90 flex items-center gap-2">
                                        <div className="h-1.5 w-1.5 bg-emerald-400 rounded-full animate-ping" /> Powered by ZORVIAN TECHNOLOGIES
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 mt-2">
                                <button
                                    onClick={() => setIsSpeaking(!isSpeaking)}
                                    className={`p-3 rounded-2xl transition-all ${isSpeaking ? 'bg-white/10 text-white border border-white/20' : 'bg-black/30 text-white/30 border border-white/5'}`}
                                >
                                    {isSpeaking ? <Volume2 size={24} /> : <VolumeX size={24} />}
                                </button>
                            </div>
                        </div>

                        {/* Chat Body */}
                        <div
                            ref={scrollRef}
                            className="flex-1 overflow-y-auto p-12 space-y-8 bg-slate-50/50 scroll-smooth"
                        >
                            {/* Suggestions */}
                            <div className="flex flex-wrap gap-3 mb-10">
                                {suggestions.map((s, i) => (
                                    <button
                                        key={i}
                                        onClick={() => handleSend(s.q)}
                                        className="px-6 py-3 bg-white border-2 border-sky-100 rounded-[24px] text-[14px] font-black text-sky-800 hover:bg-sky-50 hover:border-sky-400 transition-all shadow-md flex items-center gap-3 group whitespace-nowrap"
                                    >
                                        <Sparkles size={16} className="text-sky-400 group-hover:rotate-45" />
                                        {s.q}
                                    </button>
                                ))}
                            </div>

                            {messages.map((m, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`flex ${m.type === 'ai' ? 'justify-start' : 'justify-end'}`}
                                >
                                    <div className={`max-w-[80%] p-8 rounded-[36px] text-[16px] font-black leading-relaxed shadow-2xl border-2 ${m.type === 'ai'
                                        ? 'bg-white text-slate-800 rounded-tl-none border-slate-100'
                                        : 'bg-gradient-to-br from-sky-800 to-sky-700 text-white rounded-tr-none border-sky-600/20'
                                        }`}>
                                        {m.text}
                                        {m.link && !m.text.includes("Navigat") && (
                                            <button
                                                onClick={() => { navigate(m.link); setIsOpen(false); }}
                                                className="mt-6 flex items-center justify-between gap-4 text-sky-800 bg-sky-50 hover:bg-white px-8 py-5 rounded-[24px] text-[14px] w-full font-black border-2 border-sky-100 transition-all group"
                                            >
                                                Access Module <ArrowRight size={20} className="group-hover:translate-x-2 transition-transform" />
                                            </button>
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                        </div>

                        {/* Input Area */}
                        <div className="p-10 bg-white border-t-2 border-slate-100">
                            <form
                                onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                                className="flex items-center gap-8"
                            >
                                <button
                                    type="button"
                                    onClick={toggleListening}
                                    className={`h-20 w-20 rounded-[28px] transition-all shadow-2xl flex items-center justify-center border-2 ${isListening
                                        ? 'bg-rose-500 text-white animate-pulse border-rose-300'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-200'
                                        }`}
                                >
                                    {isListening ? <MicOff size={32} /> : <Mic size={32} />}
                                </button>
                                <div className="flex-1 flex items-center bg-slate-100 p-4 rounded-[32px] border-2 border-transparent focus-within:border-sky-500/30 transition-all shadow-inner">
                                    <input
                                        type="text"
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        placeholder="Type an option name..."
                                        className="flex-1 bg-transparent border-none outline-none px-6 text-[18px] font-black text-slate-700 placeholder:text-slate-400"
                                    />
                                    <button
                                        type="submit"
                                        className="bg-slate-900 h-16 w-16 rounded-[24px] text-white shadow-2xl hover:bg-black transition-all flex items-center justify-center active:scale-90"
                                    >
                                        <Send size={28} />
                                    </button>
                                </div>
                            </form>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="flex justify-end p-4">
                <motion.button
                    whileHover={{ scale: 1.1, rotate: 15 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setIsOpen(!isOpen)}
                    className={`h-24 w-24 rounded-[36px] flex items-center justify-center shadow-[0_25px_70px_rgba(14,165,233,0.5)] transition-all duration-700 border-[8px] border-white ${isOpen ? 'bg-slate-900 text-sky-400 scale-0' : 'bg-gradient-to-br from-sky-800 to-sky-700 text-white animate-bounce-slow'
                        }`}
                >
                    <Sparkles size={40} />
                </motion.button>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes bounce-slow {
                    0%, 100% { transform: translateY(0) rotate(0); }
                    50% { transform: translateY(-30px) rotate(5deg); }
                }
                .animate-bounce-slow {
                    animation: bounce-slow 4s ease-in-out infinite;
                }
            `}} />
        </div>
    );
};

export default AiAssistant;
