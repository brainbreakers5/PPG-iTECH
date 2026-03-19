import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    MessageCircle, X, Send, HelpCircle, ArrowRight, Sparkles, 
    ChevronRight, BookOpen, Clock, Calendar, FileText, UserCircle,
    Mic, MicOff, Volume2, VolumeX, Languages
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const LANGUAGES = {
    en: { name: 'English', code: 'en-US' },
    ta: { name: 'தமிழ் (Tamil)', code: 'ta-IN' },
    hi: { name: 'हिन्दी (Hindi)', code: 'hi-IN' },
    ml: { name: 'മലയാളം (Malayalam)', code: 'ml-IN' }
};

const AI_KNOWLEDGE_BASE = {
    general: [
        { q: "How to use the hub?", a: "Navigate via the sidebar. Check your attendance summary on the dashboard and stay updated with live notifications.", link: "/dashboard" },
        { q: "Update my profile?", a: "Access 'Profile' to manage your personal details and professional avatar.", link: "/profile" },
        { q: "Institutional Calendar?", a: "View global academic events, holidays, and college schedules in the shared 'Calendar'.", link: "/calendar" }
    ],
    admin: [
        { q: "Manage Employees?", a: "Use the 'Employee Management' module to create, update, or archive staff records professionally.", link: "/admin/employees" },
        { q: "Biometric History?", a: "Monitor real-time biometric server connectivity and raw punch logs in the 'Biometric History' section.", link: "/admin/biometric-history" },
        { q: "Manage Departments?", a: "Assign staff, define roles, and manage academic structures in 'Department Management'.", link: "/admin/departments" },
        { q: "Leave Limitations?", a: "Define annual quotas and policy rules for various leave types in 'Leave Limits'.", link: "/admin/leave-limits" },
        { q: "Activity Logs?", a: "Audit system-wide security events and user actions in the 'Activity Logs' module.", link: "/admin/activity-logs" },
        { q: "Timetable Setup?", a: "Configure the master institutional timetable and session structures in 'Timetable Setup'.", link: "/admin/timetable-setup" },
        { q: "Staff Payroll?", a: "Generate and manage digital salary slips for all institutional employees in 'Payroll'.", link: "/admin/payroll" }
    ],
    staff: [
        { q: "Mark my attendance?", a: "Navigate to your dashboard and use the punch buttons to mark your daily entry or exit.", link: "/staff" },
        { q: "How to apply for leave?", a: "Submit your formal request through 'Leave Application', including alternative staff details.", link: "/staff/leaves" },
        { q: "View my salary slips?", a: "Securely access and download your professional payroll documents in the 'Payroll' section.", link: "/staff/payroll" },
        { q: "My Timetable?", a: "Check your assigned weekly lecture sessions and academic schedules in 'My Timetable'.", link: "/staff/timetables" },
        { q: "Purchase Items?", a: "Initiate procurement requests for necessary department resources in 'Purchase/Items'.", link: "/staff/items" }
    ],
    principal: [
        { q: "Institutional Dashboard?", a: "Obtain a live, college-wide overview of staff presence and institutional analytics.", link: "/principal" },
        { q: "Generate Reports?", a: "Filter and export comprehensive attendance and performance data in the 'Attendance Record' module.", link: "/principal/attendance" },
        { q: "Principal Leaves?", a: "Submit and track your own professional leave authorizations in the 'Leaves' section.", link: "/principal/leaves" },
        { q: "Conversation Hub?", a: "Engage in institutional topics and coordinate with departments in the 'Conversation' module.", link: "/principal/conversation" },
        { q: "Purchase Approvals?", a: "Review and authorize procurement requests from various departments in 'Purchase Management'.", link: "/principal/purchase" }
    ],
    hod: [
        { q: "Department Dashboard?", a: "Monitor real-time faculty attendance and department-specific performance metrics.", link: "/hod" },
        { q: "Map Timetable?", a: "Coordinate and assign faculty sessions effectively in the 'Timetable' module.", link: "/hod/timetable" },
        { q: "Faculty Leaves?", a: "Review and recommend leave requests for your department's staff in the 'Leaves' section.", link: "/hod/leaves" },
        { q: "Department Payroll?", a: "Monitor and verify the payroll status for all faculty in your department in 'Payroll'.", link: "/hod/payroll" }
    ],
    management: [
        { q: "Executive Analytics?", a: "Access bird's-eye summaries of institutional operations and financial performance.", link: "/management" },
        { q: "Audit Logs?", a: "Review comprehensive system-wide audit trails and biometric history for compliance.", link: "/management/biometric-history" },
        { q: "Financial Oversight?", a: "Monitor institutional payroll and salary distributions in the 'Management Salary' section.", link: "/management/payroll" },
        { q: "Departmental Summary?", a: "Review staff distribution and operational status across all college departments.", link: "/management/departments" }
    ]
};

const AiAssistant = () => {
    const { user } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { type: 'ai', text: `Greetings ${user?.name || 'User'}. I am your professional PPG iTech Assistant. You can interact with me using voice or text. Please utilize the "Quick Action" chips above to explore features, or say "Go to..." to navigate directly. How may I facilitate your operations today?`, time: new Date() }
    ]);
    const [input, setInput] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(true);
    const [lang, setLang] = useState('en');
    const scrollRef = useRef(null);
    const recognitionRef = useRef(null);

    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = false;
            recognitionRef.current.interimResults = false;
            recognitionRef.current.lang = LANGUAGES[lang].code;

            recognitionRef.current.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                setInput(transcript);
                setIsListening(false);
                handleSend(transcript);
            };

            recognitionRef.current.onerror = () => setIsListening(false);
            recognitionRef.current.onend = () => setIsListening(false);
        }
    }, [lang]);

    const speak = (text) => {
        if (!isSpeaking || !window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = LANGUAGES[lang].code;
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
        const genSugg = AI_KNOWLEDGE_BASE.general;
        // Shuffle or pick relevant suggestions to keep it dynamic and instructive
        setSuggestions([...roleSugg, ...genSugg].slice(0, 5));
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
            const allKnowledge = [...AI_KNOWLEDGE_BASE.general, ...(AI_KNOWLEDGE_BASE[role] || [])];
            
            // Refined Operational Intent Detection
            const navIntents = ["go to", "open", "take me to", "navigate to", "show me", "move to"];
            let targetMatch = null;
            let isAutoNav = false;

            // Check if it's a direct click from suggestions (exact match)
            targetMatch = allKnowledge.find(k => k.q.toLowerCase().replace(/[?.,!]/g, "") === cleanText);

            if (!targetMatch) {
                // Check if it contains a navigation intent
                for (const intent of navIntents) {
                    if (cleanText.includes(intent)) {
                        const query = cleanText.replace(intent, "").trim();
                        targetMatch = allKnowledge.find(k => 
                            query.length > 3 && (
                                k.q.toLowerCase().includes(query) || 
                                query.includes(k.q.split("?")[0].toLowerCase())
                            )
                        );
                        if (targetMatch) isAutoNav = true;
                    }
                }
            }

            // General keyword matching if still no match
            if (!targetMatch) {
                targetMatch = allKnowledge.find(k => 
                    cleanText.includes(k.q.toLowerCase().replace(/[?.,!]/g, "")) || 
                    k.q.toLowerCase().replace(/[?.,!]/g, "").includes(cleanText)
                );
            }

            let reply = "I apologize, but I couldn't find a specific module for that. Please try asking about 'Attendance', 'Leaves', or 'Profile'. You can also click the quick action chips for guidance.";
            let actionLink = null;

            if (targetMatch) {
                reply = targetMatch.a;
                actionLink = targetMatch.link;
                
                // If it's a critical action or the user used a nav intent, suggest moving
                if (isAutoNav || cleanText.match(/go to|open|navigate|take me|move to/)) {
                    reply = `Process recognized. Navigating you to the ${targetMatch.q.replace("?", "")} module now. Please wait...`;
                    setTimeout(() => {
                        navigate(actionLink);
                        setIsOpen(false);
                    }, 1500);
                } else {
                    reply += " Would you like me to take you there? You can click the 'Access Module' button below.";
                }
            }

            setMessages(prev => [...prev, { 
                type: 'ai', 
                text: reply, 
                link: actionLink,
                time: new Date() 
            }]);
            speak(reply);
        }, 800);
    };

    if (!user) return null;

    return (
        <div className="fixed z-[10000]" style={{ bottom: '20px', right: '20px' }}>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        drag
                        dragConstraints={{ left: -window.innerWidth + 400, right: 0, top: -window.innerHeight + 650, bottom: 0 }}
                        initial={{ opacity: 0, scale: 0.8, y: 50 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, y: 50 }}
                        className="mb-4 w-[380px] h-[650px] bg-white rounded-[40px] shadow-[0_40px_80px_rgba(0,0,0,0.15)] flex flex-col overflow-hidden border border-sky-100 cursor-grab active:cursor-grabbing backdrop-blur-3xl"
                    >
                        {/* Header */}
                        <div className="bg-gradient-to-br from-slate-900 via-sky-900 to-sky-800 p-8 flex flex-col gap-4 relative">
                            {/* Close Button Fixed Top Right of Box */}
                            <button 
                                onClick={() => setIsOpen(false)}
                                className="absolute top-6 right-6 p-2.5 bg-white/10 hover:bg-white/20 rounded-2xl transition-all text-white border border-white/10"
                            >
                                <X size={20} />
                            </button>

                            <div className="flex items-center gap-4">
                                <div className="h-14 w-14 bg-white/10 backdrop-blur-2xl rounded-3xl flex items-center justify-center border border-white/20 shadow-2xl">
                                    <Sparkles className="text-sky-300 h-7 w-7 animate-pulse" />
                                </div>
                                <div className="flex flex-col">
                                    <h3 className="text-white font-black text-lg tracking-tight leading-none mb-1">PPG iTech Hub</h3>
                                    <span className="text-sky-300 text-[10px] font-black uppercase tracking-[0.25em] opacity-90 flex items-center gap-2">
                                        <div className="h-1.5 w-1.5 bg-emerald-400 rounded-full animate-ping" /> Global Operations AI
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => setIsSpeaking(!isSpeaking)}
                                        className={`p-2.5 rounded-2xl transition-all ${isSpeaking ? 'bg-white/10 text-white border border-white/20' : 'bg-black/30 text-white/30 border border-white/5'}`}
                                    >
                                        {isSpeaking ? <Volume2 size={20} /> : <VolumeX size={20} />}
                                    </button>
                                    <div className="relative group">
                                        <button className="px-4 py-2.5 bg-white/10 rounded-2xl text-white border border-white/20 text-[10px] font-bold flex items-center gap-2">
                                            <Languages size={18} /> {LANGUAGES[lang].name}
                                        </button>
                                        <div className="absolute top-full left-0 mt-3 bg-slate-900 rounded-2xl shadow-2xl py-3 hidden group-hover:block z-50 border border-white/10 w-48">
                                            {Object.entries(LANGUAGES).map(([key, value]) => (
                                                <button
                                                    key={key}
                                                    onClick={() => setLang(key)}
                                                    className={`w-full px-6 py-2.5 text-[11px] font-black uppercase text-left hover:bg-white/5 transition-colors ${lang === key ? 'text-sky-400' : 'text-slate-400'}`}
                                                >
                                                    {value.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Chat Body */}
                        <div 
                            ref={scrollRef}
                            className="flex-1 overflow-y-auto p-8 space-y-6 bg-slate-50/50 scroll-smooth"
                        >
                            {/* Role-Based Quick Suggestions */}
                            {suggestions.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-4">
                                    {suggestions.map((s, i) => (
                                        <button
                                            key={i}
                                            onClick={() => handleSend(s.q)}
                                            className="px-4 py-2 bg-white border border-sky-100 rounded-2xl text-[11px] font-black text-sky-800 hover:bg-sky-50 hover:border-sky-300 transition-all shadow-sm flex items-center gap-2 group whitespace-nowrap"
                                        >
                                            <Sparkles size={14} className="text-sky-400 group-hover:animate-spin" />
                                            {s.q}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {messages.map((m, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`flex ${m.type === 'ai' ? 'justify-start' : 'justify-end'}`}
                                >
                                    <div className={`max-w-[88%] p-5 rounded-3xl text-[14px] font-bold leading-relaxed shadow-xl border ${
                                        m.type === 'ai' 
                                            ? 'bg-white text-slate-700 rounded-tl-none border-slate-100 shadow-slate-200/50' 
                                            : 'bg-gradient-to-br from-sky-700 to-sky-600 text-white rounded-tr-none shadow-sky-200 border-sky-400/20'
                                    }`}>
                                        {m.text}
                                        {m.link && !m.text.includes("Navigat") && (
                                            <button 
                                                onClick={() => { navigate(m.link); setIsOpen(false); }}
                                                className="mt-5 flex items-center justify-between gap-2 text-sky-700 bg-sky-50 hover:bg-sky-100 px-5 py-4 rounded-3xl text-[12px] w-full font-black border border-sky-100 transition-all group"
                                            >
                                                Access Module <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                            </button>
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                        </div>

                        {/* Professional UI Input Area */}
                        <div className="p-8 bg-white border-t border-slate-100">
                            <form 
                                onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                                className="flex items-center gap-4"
                            >
                                <button
                                    type="button"
                                    onClick={toggleListening}
                                    className={`h-14 w-14 rounded-2xl transition-all shadow-2xl flex items-center justify-center ${
                                        isListening 
                                            ? 'bg-rose-500 text-white animate-pulse shadow-rose-200' 
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 shadow-slate-100'
                                    }`}
                                >
                                    {isListening ? <MicOff size={24} /> : <Mic size={24} />}
                                </button>
                                <div className="flex-1 flex items-center bg-slate-100 p-2 rounded-3xl border-2 border-transparent focus-within:border-sky-500/30 transition-all">
                                    <input 
                                        type="text"
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        placeholder={isListening ? "Processing Voice..." : "Ask your professional query..."}
                                        className="flex-1 bg-transparent border-none outline-none px-6 text-[14px] font-bold text-slate-700 placeholder:text-slate-400"
                                    />
                                    <button 
                                        type="submit"
                                        className="bg-slate-900 h-12 w-12 rounded-2xl text-white shadow-2xl hover:bg-black transition-all flex items-center justify-center"
                                    >
                                        <Send size={20} />
                                    </button>
                                </div>
                            </form>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="flex justify-end pr-2">
                <motion.button
                    whileHover={{ scale: 1.1, rotate: 10 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setIsOpen(!isOpen)}
                    className={`h-20 w-20 rounded-[32px] flex items-center justify-center shadow-[0_20px_60px_rgba(14,165,233,0.4)] transition-all duration-700 border-[6px] border-white ${
                        isOpen ? 'bg-slate-900 text-sky-400 scale-0' : 'bg-gradient-to-br from-sky-700 to-sky-600 text-white animate-bounce-slow'
                    }`}
                >
                    <Sparkles size={32} />
                </motion.button>
            </div>
            
            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes bounce-slow {
                    0%, 100% { transform: translateY(0) rotate(0); }
                    50% { transform: translateY(-20px) rotate(8deg); }
                }
                .animate-bounce-slow {
                    animation: bounce-slow 5s infinite ease-in-out;
            `}} />
        </div>
    );
};


export default AiAssistant;
