import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    X, Send, ArrowRight, Sparkles, 
    Mic, MicOff, Volume2, VolumeX, Search, HelpCircle, ExternalLink
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
        { q: "Leave Apply", a: "Opening leave application.", link: "/staff/leaves#apply" },
        { q: "Permission Letter", a: "Opening permissions.", link: "/staff/leaves#permission" },
        { q: "Comp Leave", a: "Viewing comp leave.", link: "/staff/leaves#compoff" },
        { q: "Leave Balance", a: "Checking leave balance.", link: "/staff/leaves#balance" },
        { q: "Incoming Approvals", a: "Checking approvals.", link: "/staff/leaves#approvals" },
        { q: "My Leave History", a: "Viewing leave history.", link: "/staff/leaves#history" },
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
        { q: "Leave Apply", a: "Opening leave apply.", link: "/hod/leaves#apply" },
        { q: "Permission Letter", a: "Opening permissions.", link: "/hod/leaves#permission" },
        { q: "Comp Leave", a: "Viewing comp leave.", link: "/hod/leaves#compoff" },
        { q: "Leave Balance", a: "Checking leave balance.", link: "/hod/leaves#balance" },
        { q: "Incoming Approvals", a: "Opening incoming approvals.", link: "/hod/leaves#approvals" },
        { q: "My Leave History", a: "Viewing leave history.", link: "/hod/leaves#history" },
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
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(true);
    const scrollRef = useRef(null);
    const recognitionRef = useRef(null);

    // Initial greeting update
    useEffect(() => {
        if (isOpen && messages.length === 0 && user) {
            setMessages([
                { type: 'ai', text: `Hello ${user.name}, I am your AI assistant. Tell me what you need, let's make it happen.`, time: new Date() }
            ]);
        }
    }, [isOpen, user, messages.length]);

    // Listener for Header Trigger
    useEffect(() => {
        const toggleHandler = () => setIsOpen(prev => !prev);
        window.addEventListener('TOGGLE_AI_ASSISTANT', toggleHandler);
        return () => window.removeEventListener('TOGGLE_AI_ASSISTANT', toggleHandler);
    }, []);

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
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async (text = input, isClick = false) => {
        const cleanText = text.trim().toLowerCase().replace(/[?.,!]/g, "");
        if (!cleanText) return;
        
        if (!isClick) {
            setMessages(prev => [...prev, { type: 'user', text, time: new Date() }]);
        }
        setInput('');

        setTimeout(async () => {
            const role = user?.role?.toLowerCase() || 'staff';
            const allowedKIs = AI_KNOWLEDGE_BASE[role] || [];
            
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

            const relatedMatches = allowedKIs.filter(k => {
                const qText = k.q.toLowerCase().replace(/[?.,!]/g, "");
                return cleanText === qText || qText.includes(cleanText) || cleanText.includes(qText);
            });

            if (relatedMatches.length > 0) {
                const reply = `I found some institutional options related to "${text}". Please choose one:`;
                setMessages(prev => [...prev, { type: 'ai', text: reply, related: relatedMatches, time: new Date() }]);
                speak(reply);
            } else {
                // GENERAL KNOWLEDGE FALLBACK (Simulated External Search)
                const loadingMsg = { type: 'ai', text: "Searching knowledge base...", time: new Date(), isLoading: true };
                setMessages(prev => [...prev, loadingMsg]);
                
                // In a real app we'd call an LLM API here. 
                // For this demo, we'll use a friendly general response.
                setTimeout(() => {
                    setMessages(prev => prev.filter(m => !m.isLoading));
                    const reply = `I couldn't find a direct link for "${text}" within the app, but as your AI assistant, I can help! If you're looking for external info, I recommend checking Google or specialized tools like Gemini/Claude. For app-specific tasks, try asking about your Profile or Leaves.`;
                    setMessages(prev => [...prev, { type: 'ai', text: reply, time: new Date(), isExternal: true }]);
                    speak(reply);
                }, 1500);
            }
        }, 600);
    };

    if (!user || location.pathname === '/login' || location.pathname === '/') return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
                    <motion.div 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        exit={{ opacity: 0 }}
                        onClick={() => setIsOpen(false)}
                        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 30 }}
                        animate={{ 
                            opacity: 1, 
                            scale: 1, 
                            y: 0,
                            width: window.innerWidth < 640 ? '100%' : '380px',
                            height: '650px',
                        }}
                        exit={{ opacity: 0, scale: 0.9, y: 30 }}
                        className="bg-white rounded-[32px] shadow-[0_30px_90px_rgba(0,0,0,0.3)] flex flex-col overflow-hidden border border-sky-100 relative z-[10001]"
                    >
                        {/* Header */}
                        <div className="bg-gradient-to-br from-slate-900 via-sky-900 to-sky-800 p-6 flex flex-col gap-3 relative">
                            <button 
                                onClick={() => setIsOpen(false)}
                                className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all text-white border border-white/10"
                            >
                                <X size={18} />
                            </button>

                            <div className="flex items-center gap-4">
                                <div className="h-11 w-11 bg-white/10 backdrop-blur-2xl rounded-2xl flex items-center justify-center border border-white/20 shadow-xl">
                                    <Sparkles className="text-sky-300 h-6 w-6" />
                                </div>
                                <div className="flex flex-col">
                                    <h3 className="text-white font-black text-sm tracking-tight leading-none mb-1 uppercase tracking-widest">PPG EMP HUB</h3>
                                    <span className="text-sky-300 text-[9px] font-black uppercase tracking-[0.3em] opacity-90 flex items-center gap-2">
                                        <div className="h-1.5 w-1.5 bg-emerald-400 rounded-full animate-ping" /> AI ASSISTANT
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <button 
                                    onClick={() => setIsSpeaking(!isSpeaking)}
                                    className={`p-2 rounded-xl transition-all ${isSpeaking ? 'bg-white/10 text-white border border-white/20' : 'bg-black/30 text-white/40'}`}
                                >
                                    {isSpeaking ? <Volume2 size={16} /> : <VolumeX size={16} />}
                                </button>
                            </div>
                        </div>

                        {/* Chat Body */}
                        <div 
                            ref={scrollRef}
                            className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/50 scroll-smooth"
                        >
                            {messages.map((m, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, x: m.type === 'ai' ? -10 : 10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className={`flex ${m.type === 'ai' ? 'justify-start' : 'justify-end'}`}
                                >
                                    <div className={`max-w-[90%] p-4 rounded-3xl text-[12px] font-bold leading-relaxed shadow-sm border ${
                                        m.type === 'ai' 
                                            ? 'bg-white text-slate-700 rounded-tl-none border-slate-100' 
                                            : 'bg-gradient-to-br from-sky-800 to-sky-700 text-white rounded-tr-none'
                                    }`}>
                                        {m.isLoading ? (
                                            <div className="flex items-center gap-2 py-1">
                                                <div className="h-2 w-2 bg-sky-400 rounded-full animate-bounce" />
                                                <div className="h-2 w-2 bg-sky-400 rounded-full animate-bounce [animation-delay:-.3s]" />
                                                <div className="h-2 w-2 bg-sky-400 rounded-full animate-bounce [animation-delay:-.5s]" />
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                <p>{m.text}</p>
                                                {m.isExternal && (
                                                    <div className="flex gap-2 mt-2">
                                                        <a 
                                                            href={`https://www.google.com/search?q=${encodeURIComponent(messages[i-1]?.text || '')}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center gap-2 bg-slate-100 px-3 py-2 rounded-xl text-sky-600 hover:bg-sky-50 transition-all border border-slate-200"
                                                        >
                                                            <Search size={14} /> Search Web
                                                        </a>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        
                                        {m.related && m.related.length > 0 && (
                                            <div className="mt-4 flex flex-col gap-2">
                                                {m.related.map((r, idx) => (
                                                    <button
                                                        key={idx}
                                                        onClick={() => handleSend(r.q, true)}
                                                        className="flex items-center justify-between gap-3 text-sky-700 bg-sky-50 hover:bg-white px-4 py-3 rounded-2xl text-[11px] w-full font-black border border-sky-100 transition-all group"
                                                    >
                                                        {r.q} <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                        </div>

                        {/* Input Area */}
                        <div className="p-6 bg-white border-t border-slate-100">
                            <form 
                                onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                                className="flex items-center gap-4"
                            >
                                <button
                                    type="button"
                                    onClick={toggleListening}
                                    className={`h-11 w-11 rounded-2xl transition-all shadow-sm flex items-center justify-center border ${
                                        isListening 
                                            ? 'bg-rose-500 text-white animate-pulse' 
                                            : 'bg-slate-50 text-slate-500 border-slate-100'
                                    }`}
                                >
                                    {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                                </button>
                                <div className="flex-1 flex items-center bg-slate-50 p-2 rounded-2xl border border-slate-100 focus-within:border-sky-500/30 transition-all shadow-inner">
                                    <input 
                                        type="text"
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        placeholder="Ask anything..."
                                        className="flex-1 bg-transparent border-none outline-none px-3 text-[12px] font-bold text-slate-700"
                                    />
                                    <button 
                                        type="submit"
                                        className="bg-slate-900 h-9 w-9 rounded-xl text-white shadow-lg flex items-center justify-center hover:bg-black transition-all"
                                    >
                                        <Search size={16} />
                                    </button>
                                </div>
                            </form>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default AiAssistant;
