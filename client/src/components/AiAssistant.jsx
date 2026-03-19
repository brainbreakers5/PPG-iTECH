import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    MessageCircle, X, Send, HelpCircle, ArrowRight, Sparkles, 
    ChevronRight, BookOpen, Clock, Calendar, FileText, UserCircle 
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const AI_KNOWLEDGE_BASE = {
    general: [
        { q: "How to use the hub?", a: "Welcome! Navigate using the sidebar. Check your attendance on the main dashboard and stay alert for push notifications.", link: "/dashboard" },
        { q: "Update my profile?", a: "Go to 'Profile' to change your avatar and view your personal details.", link: "/profile" }
    ],
    admin: [
        { q: "Manage Employees?", a: "Go to 'Employee Management' to add or edit staff members.", link: "/admin/employees" },
        { q: "Approve Leaves?", a: "Check 'Leave Approvals' in your dashboard for pending staff requests.", link: "/admin/approvals" },
        { q: "Check Biometrics?", a: "View 'Biometric Sync' stats to ensure server connectivity.", link: "/admin/biometric" },
        { q: "System Settings?", a: "Use 'Settings' to configure VAPID keys and company info.", link: "/admin/settings" }
    ],
    staff: [
        { q: "Mark my attendance?", a: "Go to 'Attendance' and click the 'Mark Entry' button for today.", link: "/staff/attendance" },
        { q: "Apply for leave?", a: "Use the 'Leave Application' form to submit requests to your HOD.", link: "/staff/leave-apply" },
        { q: "My Salary Slips?", a: "View generated slips in the 'Payroll' section.", link: "/staff/payroll" },
        { q: "Attendance History?", a: "Check 'Biometric History' for your previous punch logs.", link: "/staff/biometric-history" }
    ],
    principal: [
        { q: "Overall Stats?", a: "Your dashboard shows the total count of Present/Absent staff across the college.", link: "/principal" },
        { q: "View All Reports?", a: "Go to 'Reports' for detailed department-wise attendance downloads.", link: "/principal/reports" },
        { q: "Principal Leaves?", a: "Apply for leave in the 'Leaves' section.", link: "/principal/leaves" }
    ],
    hod: [
        { q: "My Department?", a: "Check 'Department Management' to see staff in your department.", link: "/hod/department" },
        { q: "Manage Timetable?", a: "Go to 'Timetable' to assign sessions for your faculty.", link: "/hod/timetable" },
        { q: "Dept Attendance?", a: "View 'Attendance' to monitor your staff presence.", link: "/hod/attendance" }
    ],
    management: [
        { q: "Management Dashboard?", a: "Get a bird's eye view of all college activities on your dashboard.", link: "/management" },
        { q: "College Reports?", a: "Access high-level analytics in the 'Reports' section.", link: "/management/reports" },
        { q: "Institutional Calendar?", a: "Check 'Calendar' for holidays and academic schedules.", link: "/management/calendar" }
    ]
};

const PAGE_CONTEXTS = {
    '/attendance': "You are viewing Attendance records. Ensure your biometric punch is synced properly.",
    '/leave-apply': "In Leave Application, select your dates and replacement staff correctly.",
    '/dashboard': "Home Dashboard. Check your summary and quick stats here.",
    '/admin/employees': "Employee Management. You can search or add new staff from here.",
    '/principal/reports': "Principal Reporting. Filter by date to download CSV/PDF reports.",
    '/management/calendar': "Institutional Calendar. View all upcoming events and vacations."
};

const AiAssistant = () => {
    const { user } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { type: 'ai', text: `Hi ${user?.name || 'User'}! I'm here to guide you through PPG iTech. What's on your mind?`, time: new Date() }
    ]);
    const [input, setInput] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const scrollRef = useRef(null);

    useEffect(() => {
        const role = user?.role?.toLowerCase() || 'staff';
        const roleSugg = AI_KNOWLEDGE_BASE[role] || [];
        const genSugg = AI_KNOWLEDGE_BASE.general;
        setSuggestions([...roleSugg, ...genSugg].slice(0, 4));

        const path = location.pathname;
        const pageMsg = PAGE_CONTEXTS[path];
        if (pageMsg && isOpen) {
            const lastMsg = messages[messages.length - 1];
            if (!lastMsg.isContext || lastMsg.text !== pageMsg) {
                setMessages(prev => [...prev, {
                    type: 'ai',
                    text: `💡 Quick Tip: ${pageMsg}`,
                    time: new Date(),
                    isContext: true
                }]);
            }
        }
    }, [location.pathname, user?.role, isOpen]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = (text = input) => {
        if (!text.trim()) return;
        setMessages(prev => [...prev, { type: 'user', text, time: new Date() }]);
        setInput('');

        setTimeout(() => {
            const role = user?.role?.toLowerCase() || 'staff';
            const allKnowledge = [...AI_KNOWLEDGE_BASE.general, ...(AI_KNOWLEDGE_BASE[role] || [])];
            const match = allKnowledge.find(k => 
                text.toLowerCase().includes(k.q.toLowerCase()) || 
                k.q.toLowerCase().includes(text.toLowerCase())
            );

            setMessages(prev => [...prev, { 
                type: 'ai', 
                text: match ? match.a : "Interesting question! For more details, please check your sidebar menu or ask me another specific question.", 
                link: match ? match.link : null,
                time: new Date() 
            }]);
        }, 800);
    };

    if (!user) return null;

    return (
        <div className="fixed z-[10000]" style={{ bottom: '20px', right: '20px' }}>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        drag
                        dragConstraints={{ left: -window.innerWidth + 400, right: 0, top: -window.innerHeight + 550, bottom: 0 }}
                        initial={{ opacity: 0, scale: 0.8, y: 50 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, y: 50 }}
                        className="mb-4 w-[350px] max-h-[550px] bg-white rounded-[32px] shadow-[0_30px_60px_rgba(14,165,233,0.25)] flex flex-col overflow-hidden border border-sky-100 cursor-grab active:cursor-grabbing"
                    >
                        {/* Header - No Close Button as requested */}
                        <div className="bg-gradient-to-br from-sky-600 to-sky-500 p-6 flex flex-col gap-1">
                            <div className="flex items-center gap-3">
                                <div className="h-12 w-12 bg-white/20 backdrop-blur-xl rounded-2xl flex items-center justify-center border border-white/20 shadow-inner">
                                    <Sparkles className="text-white h-6 w-6 animate-pulse" />
                                </div>
                                <div className="flex flex-col">
                                    <h3 className="text-white font-black text-base tracking-tight leading-none mb-1">PPG iTech Assistant</h3>
                                    <span className="text-sky-100 text-[9px] font-black uppercase tracking-[0.2em] opacity-80">Online & Ready</span>
                                </div>
                            </div>
                            <p className="text-white/60 text-[8px] font-bold uppercase tracking-widest mt-2 px-1">
                                Reachable & Movable • Drag me anywhere
                            </p>
                        </div>

                        {/* Chat Body */}
                        <div 
                            ref={scrollRef}
                            className="flex-1 overflow-y-auto p-6 space-y-5 bg-gradient-to-b from-sky-50/50 to-white scroll-smooth"
                            style={{ minHeight: '300px' }}
                        >
                            {messages.map((m, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, x: m.type === 'ai' ? -10 : 10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className={`flex ${m.type === 'ai' ? 'justify-start' : 'justify-end'}`}
                                >
                                    <div className={`max-w-[85%] p-4 rounded-2xl text-[13px] font-bold leading-relaxed shadow-sm ${
                                        m.type === 'ai' 
                                            ? 'bg-white text-gray-700 rounded-tl-none border border-sky-100' 
                                            : 'bg-gradient-to-r from-sky-600 to-sky-500 text-white rounded-tr-none shadow-lg shadow-sky-200'
                                    }`}>
                                        {m.text}
                                        {m.link && (
                                            <button 
                                                onClick={() => { navigate(m.link); setIsOpen(false); }}
                                                className="mt-4 flex items-center justify-between gap-2 text-sky-600 bg-sky-50 hover:bg-sky-100 px-4 py-3 rounded-2xl text-[11px] w-full font-black border border-sky-100 transition-all group"
                                            >
                                                Go to Page <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                                            </button>
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                        </div>

                        {/* Suggestions */}
                        {suggestions.length > 0 && (
                            <div className="px-6 py-4 bg-white border-t border-sky-50">
                                <p className="text-[10px] font-black text-sky-400 uppercase tracking-[0.15em] mb-3 flex items-center gap-2">
                                    <HelpCircle size={14} className="opacity-50" /> Suggested for {user?.role || 'User'}
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {suggestions.map((s, i) => (
                                        <button
                                            key={i}
                                            onClick={() => handleSend(s.q)}
                                            className="text-[11px] font-bold text-sky-600 bg-sky-50/50 px-4 py-2 rounded-xl hover:bg-sky-600 hover:text-white border border-sky-100 transition-all shadow-sm active:scale-95"
                                        >
                                            {s.q}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Footer / Input */}
                        <div className="p-6 bg-white border-t border-sky-50">
                            <form 
                                onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                                className="flex items-center gap-2 bg-sky-100/30 p-2 rounded-3xl border border-sky-100 focus-within:border-sky-300 focus-within:ring-4 focus-within:ring-sky-100/50 transition-all"
                            >
                                <input 
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder="Type your question..."
                                    className="flex-1 bg-transparent border-none outline-none px-4 text-[13px] font-bold text-gray-700 placeholder:text-gray-400"
                                />
                                <button 
                                    type="submit"
                                    className="bg-sky-600 p-3 rounded-2xl text-white shadow-lg shadow-sky-200 hover:bg-sky-700 hover:-translate-y-0.5 active:translate-y-0 transition-all"
                                >
                                    <Send size={18} />
                                </button>
                            </form>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Float Button Toggle */}
            <div className="flex justify-end pr-2">
                <motion.button
                    whileHover={{ scale: 1.1, rotate: 10 }}
                    whileTap={{ scale: 0.9, rotate: -10 }}
                    onClick={() => setIsOpen(!isOpen)}
                    className={`h-16 w-16 rounded-[24px] flex items-center justify-center shadow-2xl transition-all duration-500 border-4 border-white ${
                        isOpen ? 'bg-sky-100 text-sky-600' : 'bg-sky-600 text-white animate-bounce-slow'
                    }`}
                    style={{ 
                        boxShadow: isOpen 
                            ? '0 20px 50px rgba(0,0,0,0.1)' 
                            : '0 20px 40px rgba(14, 165, 233, 0.5)' 
                    }}
                >
                    {isOpen ? <X size={28} /> : <MessageCircle size={28} />}
                </motion.button>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes bounce-slow {
                    0%, 100% { transform: translateY(0) rotate(0); }
                    50% { transform: translateY(-15px) rotate(5deg); }
                }
                .animate-bounce-slow {
                    animation: bounce-slow 4s infinite ease-in-out;
                }
            `}} />
        </div>
    );
};

export default AiAssistant;
