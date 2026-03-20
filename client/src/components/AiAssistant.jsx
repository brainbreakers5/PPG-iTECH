import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    X, Send, ArrowRight, Sparkles, 
    Mic, MicOff, Volume2, VolumeX, User
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

const AI_KNOWLEDGE_BASE = {
    staff: [
        { q: "Notification", link: "/staff/notifications" },
        { q: "Profile", link: "/staff/profile" },
        { q: "Logout", action: 'logout' },
        { q: "Dashboard", link: "/staff" },
        { q: "Your Personal Attendance", link: "/staff", hash: "personal-attendance" },
        { q: "Recent Attendance History", link: "/staff", hash: "attendance-history" },
        { q: "Leave Management", link: "/staff/leaves", hash: "history" },
        { q: "Leave Apply", link: "/staff/leaves", hash: "apply" },
        { q: "Permission Letter", link: "/staff/leaves", hash: "permission" },
        { q: "Comp Leave", link: "/staff/leaves", hash: "compoff" },
        { q: "Leave Balance", link: "/staff/leaves", hash: "balance" },
        { q: "Incoming Approvals", link: "/staff/leaves", hash: "approvals" },
        { q: "My Leave History", link: "/staff/leaves", hash: "history" },
        { q: "Salary Details", link: "/staff/payroll" },
        { q: "My Timetable", link: "/staff/timetables" },
        { q: "Staff Timetable", link: "/staff/timetables", hash: "all" },
        { q: "Conversation", link: "/staff/conversation" },
        { q: "Purchase Requests", link: "/staff/items" },
        { q: "Academic Calendar", link: "/staff/calendar" }
    ],
    hod: [
        { q: "Notification", link: "/hod/notifications" },
        { q: "Profile", link: "/hod/profile" },
        { q: "Logout", action: 'logout' },
        { q: "Dashboard", link: "/hod" },
        { q: "Your Personal Attendance", link: "/hod", hash: "personal-attendance" },
        { q: "Recent Attendance History", link: "/hod", hash: "attendance-history" },
        { q: "Leave Management", link: "/hod/leaves", hash: "history" },
        { q: "Leave Apply", link: "/hod/leaves", hash: "apply" },
        { q: "Permission Letter", link: "/hod/leaves", hash: "permission" },
        { q: "Comp Leave", link: "/hod/leaves", hash: "compoff" },
        { q: "Leave Balance", link: "/hod/leaves", hash: "balance" },
        { q: "Incoming Approvals", link: "/hod/leaves", hash: "approvals" },
        { q: "My Leave History", link: "/hod/leaves", hash: "history" },
        { q: "Salary Details", link: "/hod/payroll" },
        { q: "My Timetable", link: "/hod/timetable" },
        { q: "Staff Timetable", link: "/hod/timetable" },
        { q: "Conversation", link: "/hod/conversation" },
        { q: "Purchase Requests", link: "/hod/purchase" },
        { q: "Academic Calendar", link: "/hod/calendar" },
        { q: "Attendance Records", link: "/hod/attendance" },
        { q: "Summary View", link: "/hod/attendance", hash: "summary" },
        { q: "Details Logs", link: "/hod/biometric-history" },
        { q: "Biometric Sync", link: "/hod/attendance", hash: "sync" },
        { q: "HODs Attendance Core", link: "/hod/attendance" },
        { q: "Staff Attendance Core", link: "/hod/attendance" },
        { q: "Department Staff", link: "/hod/department" }
    ],
    principal: [
        { q: "Notification", link: "/principal/notifications" },
        { q: "Profile", link: "/principal/profile" },
        { q: "Logout", action: 'logout' },
        { q: "Dashboard", link: "/principal" },
        { q: "Your Personal Attendance", link: "/principal" },
        { q: "Recent Attendance History", link: "/principal" },
        { q: "HODs Attendance Core", link: "/principal/attendance" },
        { q: "Staff Attendance Core", link: "/principal/attendance" },
        { q: "Attendance Records", link: "/principal/attendance" },
        { q: "Summary View", link: "/principal/attendance", hash: "summary" },
        { q: "Biometric Sync", link: "/principal/attendance", hash: "sync" },
        { q: "Conversation", link: "/principal/conversation" },
        { q: "Purchase Requests", link: "/principal/purchase" },
        { q: "Departments", link: "/principal/department" },
        { q: "Academic Calendar", link: "/principal/calendar" },
        { q: "Leave Requests", link: "/principal/leaves" },
        { q: "Permission Requests", link: "/principal/leaves", hash: "permission" },
        { q: "Detail Logs", link: "/principal/biometric-history" }
    ],
    admin: [
        { q: "Notification", link: "/admin/notifications" },
        { q: "Logout", action: 'logout' },
        { q: "Employee Management", link: "/admin/employees" },
        { q: "Add New Employee", link: "/admin/employees/new" },
        { q: "Departments", link: "/admin/departments" },
        { q: "Salary Management", link: "/admin/payroll" },
        { q: "Attendance Records", link: "/admin/attendance" },
        { q: "Summary View", link: "/admin/attendance", hash: "summary" },
        { q: "Details Logs", link: "/admin/biometric-history" },
        { q: "Biometric Sync", link: "/admin/attendance", hash: "sync" },
        { q: "Leave Balance", link: "/admin/leave-limits" },
        { q: "Timetable Setup", link: "/admin/timetable-setup" },
        { q: "Security Log", link: "/admin/activity-logs" },
        { q: "Academic Calendar", link: "/admin/calendar" },
        { q: "Purchase Requests", link: "/admin/purchase" },
        { q: "Profile", link: "/admin/profile" },
        { q: "Principal Attendance Core", link: "/admin/attendance" },
        { q: "HODs Attendance Core", link: "/admin/attendance" },
        { q: "Staff Attendance Core", link: "/admin/attendance" }
    ],
    management: [
        { q: "Profile", link: "/management/profile" },
        { q: "Logout", action: 'logout' },
        { q: "Dashboard", link: "/management" },
        { q: "Attendance Records", link: "/management/attendance" },
        { q: "Principal Attendance Core", link: "/management/attendance" },
        { q: "HODs Attendance Core", link: "/management/attendance" },
        { q: "Staff Attendance Core", link: "/management/attendance" },
        { q: "Academic Calendar", link: "/management/calendar" },
        { q: "Summary View", link: "/management/attendance", hash: "summary" },
        { q: "Details Logs", link: "/management/attendance" },
        { q: "Departments", link: "/management/departments" },
        { q: "Biometric Sync", link: "/management/attendance", hash: "sync" }
    ]
};

const AiAssistant = ({ isSidebar, onClose, userRole }) => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [messages, setMessages] = useState(() => {
        const saved = localStorage.getItem('ai_chat_history');
        return saved ? JSON.parse(saved) : [];
    });
    const [input, setInput] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(true);
    const scrollRef = useRef(null);
    const inputRef = useRef(null);
    const recognitionRef = useRef(null);

    const role = (userRole || user?.role || 'staff').toLowerCase();
    const allowedKIs = AI_KNOWLEDGE_BASE[role] || [];

    // Greeting: Role-specific initial message
    useEffect(() => {
        if (messages.length === 0 && user) {
            let initialText = `Hello ${user.name}, I am your AI Assistant. Type a keyword (like 'attendance', 'leave', 'timetable') to see available options.`;
            let related = [];

            if (role === 'management') {
                initialText = `Hello ${user.name}, I am your Management AI Assistant. How can I help you manage the portal today?`;
                // For management, show "required" default questions ONLY
                related = allowedKIs.filter(k => 
                    ["Dashboard", "Attendance Records", "Departments", "Academic Calendar", "Profile"].includes(k.q)
                );
            } else if (role === 'principal') {
                initialText = `Hello ${user.name}, I am your Principal AI Assistant. You can manage 'leaves', 'permissions', and 'attendance' here.`;
            }

            const initialMessage = [
                { 
                    type: 'ai', 
                    text: initialText, 
                    related: related, // Only management gets default buttons for now as per "default questions only set by management"
                    time: new Date() 
                }
            ];
            setMessages(initialMessage);
            localStorage.setItem('ai_chat_history', JSON.stringify(initialMessage));
        }
    }, [user, messages.length, role, allowedKIs]);

    // Persist messages to localStorage
    useEffect(() => {
        if (messages.length > 0) {
            localStorage.setItem('ai_chat_history', JSON.stringify(messages));
        }
    }, [messages]);

    // Focus input on mount
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
        }
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
        const lowerText = text.trim().toLowerCase();
        const wantsPrint = lowerText.includes('report') || lowerText.includes('print');
        // Clean text for matching: remove report/print words
        const cleanText = lowerText.replace(/report|print/g, "").trim().replace(/[?.,!]/g, "");
        
        if (!cleanText && !wantsPrint) return;
        
        if (!isClick) {
            setMessages(prev => [...prev, { type: 'user', text, time: new Date() }]);
        }
        setInput('');

        setTimeout(async () => {
            // Check direct match or keyword match
            const exactMatch = allowedKIs.find(k => k.q.toLowerCase().replace(/[?.,!]/g, "") === cleanText) || 
                               allowedKIs.find(k => k.q.toLowerCase().includes(cleanText) && cleanText.length > 3);

            if (exactMatch) {
                let actionLink = exactMatch.link;
                if (exactMatch.q.toLowerCase() === 'profile' && !actionLink.includes(user.emp_id) && role !== 'management') {
                    actionLink = `/${role}/profile/${user.emp_id}`;
                }
                
                if (exactMatch.action === 'logout') {
                    setMessages(prev => [...prev, { type: 'ai', text: "Logging out safely...", time: new Date() }]);
                    setTimeout(() => { logout(); navigate('/login'); }, 1000);
                    return;
                }

                const responseText = wantsPrint 
                    ? `Generating ${exactMatch.q} report...` 
                    : `Switching to ${exactMatch.q}...`;

                setMessages(prev => [...prev, { 
                    type: 'ai', 
                    text: responseText, 
                    time: new Date() 
                }]);
                
                setTimeout(() => { 
                    const hashPart = exactMatch.hash ? `#${exactMatch.hash}` : '';
                    if (location.pathname === actionLink) {
                        window.location.hash = (exactMatch.hash || '');
                        window.dispatchEvent(new Event('hashchange'));
                        if (wantsPrint) window.print();
                    } else {
                        navigate(`${actionLink}${hashPart}`, { state: { autoPrint: wantsPrint } });
                    }
                }, 400);
                return;
            }

            // Keyword Filter: Find all that contain the search term
            const filtered = allowedKIs.filter(k => 
                k.q.toLowerCase().includes(cleanText) || 
                cleanText.includes(k.q.toLowerCase().split(" ")[0])
            );

            if (filtered.length > 0) {
                const reply = wantsPrint 
                    ? `Which report would you like to print?`
                    : `I found ${filtered.length} relevant options based on your keyword:`;
                setMessages(prev => [...prev, { 
                    type: 'ai', 
                    text: reply, 
                    related: filtered, 
                    time: new Date() 
                }]);
                speak(reply);
            } else {
                const reply = "I couldn't find matches for that. Try a specific keyword like 'attendance' or 'profile'.";
                setMessages(prev => [...prev, { 
                    type: 'ai', 
                    text: reply, 
                    related: cleanText === "all" ? allowedKIs : [], 
                    time: new Date() 
                }]);
                speak(reply);
            }
        }, 600);
    };

    return (
        <div className="flex flex-col h-full w-full bg-white relative no-print">
            {/* Header */}
            <div className="bg-gradient-to-br from-slate-900 via-sky-900 to-sky-800 p-6 flex flex-col gap-2 shrink-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-white/10 backdrop-blur-2xl rounded-2xl flex items-center justify-center border border-white/20 shadow-xl">
                            <Sparkles className="text-sky-300 h-5 w-5" />
                        </div>
                        <div className="flex flex-col">
                            <h3 className="text-white font-black text-xs tracking-tight leading-none mb-1 uppercase">PPG EMP HUB</h3>
                            <span className="text-sky-300 text-[8px] font-black uppercase tracking-[0.2em] opacity-90 flex items-center gap-1.5">
                                <div className="h-1 w-1 bg-emerald-400 rounded-full animate-pulse" /> ZORVIAN AI ASSISTANT
                            </span>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setIsSpeaking(!isSpeaking)}
                            className={`p-2 rounded-xl transition-all ${isSpeaking ? 'bg-white/10 text-white border border-white/20' : 'bg-black/30 text-white/40'}`}
                        >
                            {isSpeaking ? <Volume2 size={16} /> : <VolumeX size={16} />}
                        </button>
                        {/* Persistent Close: Only user can click to close */}
                        {onClose && (
                            <button 
                                onClick={onClose}
                                className="p-2 hover:bg-white/10 rounded-xl transition-all text-white border border-transparent hover:border-white/10"
                            >
                                <X size={18} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Chat Content */}
            <div 
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/50 scroll-smooth no-scrollbar"
            >
                {messages.map((m, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex ${m.type === 'ai' ? 'justify-start' : 'justify-end'}`}
                    >
                        <div className={`max-w-[95%] p-4 rounded-3xl text-[11px] font-bold leading-relaxed shadow-sm border ${
                            m.type === 'ai' 
                                ? 'bg-white text-slate-700 rounded-tl-none border-slate-100' 
                                : 'bg-gradient-to-br from-sky-800 to-sky-700 text-white rounded-tr-none'
                        }`}>
                            <div className="space-y-3">
                                <p>{m.text}</p>
                            </div>
                            
                            {m.related && m.related.length > 0 && (
                                <div className="mt-4 flex flex-col gap-2">
                                    <div className="grid grid-cols-1 gap-1.5 max-h-[350px] overflow-y-auto pr-1 no-scrollbar">
                                        {m.related.map((r, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => handleSend(r.q, true)}
                                                className="flex items-center justify-between gap-3 text-sky-700 bg-sky-50/80 hover:bg-white px-3 py-3 rounded-2xl text-[10px] w-full font-black border border-sky-100 transition-all group shadow-sm active:scale-[0.98]"
                                            >
                                                {r.q} <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* User Input Area */}
            <div className="p-5 bg-white border-t border-slate-100 shrink-0">
                <form 
                    onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                    className="flex items-center gap-3"
                >
                    <button
                        type="button"
                        onClick={toggleListening}
                        className={`h-9 w-9 rounded-xl transition-all shadow-sm flex items-center justify-center border ${
                            isListening 
                                ? 'bg-rose-500 text-white animate-pulse border-rose-400' 
                                : 'bg-slate-50 text-slate-500 border-slate-100'
                        }`}
                    >
                        {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                    </button>
                    <div className="flex-1 flex items-center bg-slate-50 p-1.5 rounded-xl border border-slate-100 focus-within:border-sky-500/30 transition-all shadow-inner">
                        <input 
                            ref={inputRef}
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Try searching 'attendance'..."
                            className="flex-1 bg-transparent border-none outline-none px-2 text-[10px] font-bold text-slate-700"
                        />
                        <button 
                            type="submit"
                            className="bg-sky-600 h-8 w-8 rounded-lg text-white shadow-lg flex items-center justify-center hover:bg-sky-700 transition-all"
                        >
                            <Send size={14} />
                        </button>
                    </div>
                </form>
            </div>
            
            <div className="px-5 pb-4 bg-white flex justify-center">
                 <div className="flex items-center gap-2 text-[8px] font-black text-gray-300 uppercase tracking-widest border-t border-gray-50 pt-3 w-full justify-center">
                     <User size={10} /> Powered by ZORVIAN TECHNOLOGIES
                 </div>
            </div>
        </div>
    );
};

export default AiAssistant;
