import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    X, Send, ArrowRight, Sparkles, 
    Mic, MicOff, Volume2, VolumeX, Search, HelpCircle, User, CheckCircle2,
    AlertCircle, BookOpen, Layers, Terminal, Info, ChevronRight, Settings
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * PPG EMP HUB - ADVANCED AI ASSISTANT KNOWLEDGE BASE
 * Structured for "How To", "Error", and "General" responses.
 */
const AI_SYSTEM_KNOWLEDGE = {
    staff: {
        roleName: "Staff Member",
        modules: [
            { id: 'leave', name: "Leave Management", path: "/staff/leaves", menu: "Leave Apply Tab" },
            { id: 'payroll', name: "Salary Details", path: "/staff/payroll", menu: "Salary Dashboard" },
            { id: 'timetable', name: "My Timetable", path: "/staff/timetables", menu: "Timetable View" },
            { id: 'conversation', name: "Conversation Hub", path: "/staff/conversation", menu: "Message Center" },
            { id: 'profile', name: "My Profile", path: "/staff/profile", menu: "Profile View" }
        ],
        howTo: [
            { 
                q: "Apply for Leave", 
                module: "Leave Management",
                menu: "Leave Apply Tab",
                option: "Apply New",
                fields: [
                    "Leave Type → Select CL, ML, OD, etc.",
                    "Dates → Select From and To dates",
                    "Alternative Staff → Assign a duty alternate",
                    "Reason → Enter valid justification"
                ],
                steps: [
                    "Navigate to /staff/leaves",
                    "Select the 'Apply' tab from the top menu",
                    "Choose your desired leave type from the dropdown",
                    "Pick your dates and assign an alternative staff member",
                    "Click 'Submit Application' for HOD review"
                ],
                link: "/staff/leaves",
                hash: "apply"
            },
            {
                q: "Check Salary",
                module: "Payroll",
                menu: "Salary Details",
                steps: [
                    "Go to the Salary Details module",
                    "Select the month and year you wish to view",
                    "Click on 'View Payslip' to see detailed breakdown",
                    "You can download the PDF for your records"
                ],
                link: "/staff/payroll"
            }
        ],
        errors: [
            {
                q: "Cannot see salary",
                reasons: ["Payroll not yet processed for current month", "Network connectivity issue", "Browser cache conflict"],
                solution: "Wait for the 5th of the month or contact the Accounts department if the error persists."
            }
        ]
    },
    hod: {
        roleName: "Head of Department (HOD)",
        modules: [
            { id: 'approval', name: "Leave Approvals", path: "/hod/leaves", hash: "approvals" },
            { id: 'dept_staff', name: "Department Staff", path: "/hod/department" },
            { id: 'attendance', name: "Attendance Records", path: "/hod/attendance" }
        ],
        howTo: [
            {
                q: "Approve Staff Leave",
                module: "Leave Management",
                menu: "Incoming Approvals",
                steps: [
                    "Go to Leave Management module",
                    "Click on the 'Approvals' tab",
                    "Review the applicant's details and alternative staff assignment",
                    "Click 'Approve' to forward to Principal or 'Reject' with reason"
                ],
                link: "/hod/leaves",
                hash: "approvals"
            }
        ]
    },
    principal: {
        roleName: "Principal",
        modules: [
            { id: 'leaves', name: "Leave Requests", path: "/principal/leaves" },
            { id: 'purchases', name: "Purchase Requests", path: "/principal/purchase" },
            { id: 'departments', name: "Departments Overview", path: "/principal/department" }
        ],
        howTo: [
            {
                q: "Approve Purchase Request",
                module: "Purchase Management",
                menu: "Purchases",
                steps: [
                    "Navigate to the Purchase Requests module",
                    "Locate the pending request in the list",
                    "Review the items, estimated cost, and department justification",
                    "Click 'Approve' to finalize for Admin/Management"
                ],
                link: "/principal/purchase"
            }
        ]
    },
    admin: {
        roleName: "System Administrator",
        modules: [
            { id: 'employees', name: "Employee Management", path: "/admin/employees" },
            { id: 'depts', name: "Department Setup", path: "/admin/departments" },
            { id: 'payroll', name: "Salary Management", path: "/admin/payroll" }
        ],
        howTo: [
            {
                q: "Add New Employee",
                module: "Employee Management",
                menu: "Employee List",
                option: "Create New",
                fields: [
                    "Emp ID → Unique identifier",
                    "Name → Full name of staff",
                    "Role/Dept → Assign to correct department",
                    "Access Level → Admin, HOD, or Staff"
                ],
                steps: [
                    "Go to Employee Management module",
                    "Click the 'New Employee' button",
                    "Fill all required personal and institutional fields",
                    "Set initial password and click 'Save'"
                ],
                link: "/admin/employees/new"
            }
        ]
    },
    management: {
        roleName: "Management/Trustee",
        modules: [
            { id: 'dashboard', name: "Management Dashboard", path: "/management" },
            { id: 'dept_overview', name: "Department Statistics", path: "/management/departments" }
        ]
    }
};

const AiAssistant = ({ isSidebar, onClose }) => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(true);
    const scrollRef = useRef(null);
    const recognitionRef = useRef(null);

    const userRole = useMemo(() => user?.role?.toLowerCase() || 'staff', [user]);
    const roleData = useMemo(() => AI_SYSTEM_KNOWLEDGE[userRole] || AI_SYSTEM_KNOWLEDGE.staff, [userRole]);

    // Initial greeting following User Information Rules
    useEffect(() => {
        if (messages.length === 0 && user) {
            setMessages([
                { 
                    type: 'ai', 
                    text: `Hello ${user.name}, I am your PPG EMP HUB Assistant. I've analyzed your role as **${roleData.roleName}** and I'm ready to help you with ${roleData.modules[0]?.name || 'the system'} today. How can I assist you?`, 
                    time: new Date() 
                }
            ]);
        }
    }, [user, messages.length, roleData, userRole]);

    // Speech Recognition Setup
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
        if (isListening) recognitionRef.current?.stop();
        else {
            setIsListening(true);
            recognitionRef.current?.start();
        }
    };

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [messages]);

    /**
     * CORE INTELLIGENCE: ANALYZE INTENT AND PROVIDE STRUCTURED SOLUTIONS
     */
    const handleSend = async (text = input, isClick = false) => {
        const cleanText = text.trim().toLowerCase().replace(/[?.,!]/g, "");
        if (!cleanText) return;
        
        if (!isClick) {
            setMessages(prev => [...prev, { type: 'user', text, time: new Date() }]);
        }
        setInput('');

        // 1. Analyze user's intent (How to, Error, General)
        const isHowTo = cleanText.includes("how") || cleanText.includes("where") || cleanText.includes("apply") || cleanText.includes("check") || cleanText.includes("set");
        const isError = cleanText.includes("error") || cleanText.includes("not working") || cleanText.includes("failed") || cleanText.includes("unable") || cleanText.includes("cannot");
        
        // 2. Identification of Module
        const currentPath = location.pathname;
        const currentModule = roleData.modules.find(m => currentPath.includes(m.path))?.name || "current module";

        setTimeout(async () => {
            // Find Match in Knowledge Base
            const howToMatch = roleData.howTo?.find(h => 
                cleanText.includes(h.q.toLowerCase()) || 
                cleanText.includes(h.module.toLowerCase()) ||
                (isClick && h.q.toLowerCase().includes(cleanText))
            );

            const errorMatch = roleData.errors?.find(e => 
                cleanText.includes(e.q.toLowerCase())
            );

            // Response Logic
            if (howToMatch) {
                if (isClick && howToMatch.link) {
                    setMessages(prev => [...prev, { type: 'ai', text: `Step 1: Navigating to ${howToMatch.module}...`, time: new Date() }]);
                    setTimeout(() => {
                        const target = `${howToMatch.link}${howToMatch.hash ? '#' + howToMatch.hash : ''}`;
                        navigate(target);
                    }, 800);
                    return;
                }

                // Format: HOW TO DO SOMETHING
                const reply = `I can help you with that. Here is the step-by-step guide for **${howToMatch.q}**:`;
                setMessages(prev => [...prev, { 
                    type: 'ai', 
                    text: reply, 
                    howTo: howToMatch,
                    time: new Date() 
                }]);
                speak(reply);
            } else if (errorMatch || (isError && !howToMatch)) {
                // Format: ERROR
                const match = errorMatch || { q: text, reasons: ["System synchronization delay", "Insufficient permissions for this action"], solution: "Please try reloading the page or contact the Administrator." };
                const reply = `I've analyzed the issue regarding "${match.q}". Here are the possible reasons and solutions:`;
                setMessages(prev => [...prev, { 
                    type: 'ai', 
                    text: reply, 
                    error: match, 
                    time: new Date() 
                }]);
                speak(reply);
            } else if (cleanText.includes("where am i") || cleanText.includes("this page")) {
                const reply = `You are currently in the **${currentModule}** module of the PPG EMP HUB. My analysis shows you have access to: ${roleData.modules.map(m => m.name).join(', ')}.`;
                setMessages(prev => [...prev, { type: 'ai', text: reply, time: new Date() }]);
                speak(reply);
            } else if (cleanText.includes("logout")) {
                setMessages(prev => [...prev, { type: 'ai', text: "Logging out of your session...", time: new Date() }]);
                setTimeout(() => { logout(); navigate('/login'); }, 1000);
            } else {
                // FALLBACK LOGIC BASED ON USER RULES
                const loadingMsg = { type: 'ai', text: "Analyzing system state...", time: new Date(), isLoading: true };
                setMessages(prev => [...prev, loadingMsg]);

                setTimeout(() => {
                    setMessages(prev => prev.filter(m => !m.isLoading));
                    
                    let reply = "";
                    if (cleanText.length < 5) {
                        reply = "Which module are you referring to? Please provide more details so I can guide you effectively.";
                    } else if (cleanText.includes("feature xyz") || cleanText.includes("unavailable")) {
                        reply = "This feature is not available in this module. You may contact the administrator.";
                    } else {
                        reply = `Based on the current module (**${currentModule}**), here is the best possible solution: You can explore the ${roleData.modules[0]?.name} or check your Profile for recent updates. If you need a specific guide, try asking "How do I apply for leave?".`;
                    }
                    
                    setMessages(prev => [...prev, { type: 'ai', text: reply, time: new Date() }]);
                    speak(reply);
                }, 1000);
            }
        }, 600);
    };

    return (
        <div className="flex flex-col h-full w-full bg-white relative overflow-hidden">
            {/* Header - Premium Design */}
            <div className="bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0d9488] p-6 flex flex-col gap-2 shrink-0 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-10 opacity-10 rotate-12">
                    <Sparkles className="h-24 w-24 text-white" />
                </div>
                
                <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-3">
                        <motion.div 
                            animate={{ rotate: [0, 10, -10, 0] }}
                            transition={{ repeat: Infinity, duration: 5 }}
                            className="h-12 w-12 bg-white/10 backdrop-blur-2xl rounded-[18px] flex items-center justify-center border border-white/20 shadow-2xl ring-1 ring-white/10"
                        >
                            <Sparkles className="text-teal-400 h-6 w-6" />
                        </motion.div>
                        <div className="flex flex-col">
                            <h3 className="text-white font-black text-sm tracking-tighter leading-none mb-1">PPG ASSISTANT</h3>
                            <div className="flex items-center gap-2">
                                <div className="h-1.5 w-1.5 bg-teal-400 rounded-full animate-pulse shadow-[0_0_10px_#2dd4bf]" />
                                <span className="text-teal-400 text-[8px] font-black uppercase tracking-[0.2em] opacity-90">
                                    System Expert • Online
                                </span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setIsSpeaking(!isSpeaking)}
                            className={`p-2.5 rounded-2xl transition-all duration-300 ${isSpeaking ? 'bg-white/10 text-white border border-white/20 ring-1 ring-white/10' : 'bg-black/30 text-white/40'}`}
                        >
                            {isSpeaking ? <Volume2 size={16} /> : <VolumeX size={16} />}
                        </button>
                        {onClose && (
                            <button 
                                onClick={onClose}
                                className="p-2.5 hover:bg-white/10 rounded-2xl transition-all text-white border border-transparent hover:border-white/10 active:scale-90"
                            >
                                <X size={18} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Chat Body */}
            <div 
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-5 space-y-6 bg-slate-50/30 scroll-smooth no-scrollbar"
            >
                {messages.map((m, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 15, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        className={`flex ${m.type === 'ai' ? 'justify-start' : 'justify-end'} group`}
                    >
                        <div className={`max-w-[95%] p-4 rounded-[28px] text-[11px] font-bold leading-relaxed shadow-sm border transition-all ${
                            m.type === 'ai' 
                                ? 'bg-white text-slate-700 rounded-tl-none border-slate-100' 
                                : 'bg-gradient-to-br from-[#0f172a] to-[#1e293b] text-white rounded-tr-none'
                        }`}>
                            <div className="space-y-4">
                                <p className={m.type === 'ai' ? 'text-slate-600' : 'text-slate-100'}>{m.text}</p>
                                
                                {/* HOW TO FORMAT */}
                                {m.howTo && (
                                    <div className="space-y-4 mt-2">
                                        <div className="p-4 bg-teal-50/50 rounded-3xl border border-teal-100/50 ring-1 ring-white/50 space-y-3">
                                            <div className="flex items-center gap-2 text-teal-700">
                                                <Layers size={14} className="animate-pulse" />
                                                <span className="uppercase tracking-widest text-[9px] font-black">Module: {m.howTo.module}</span>
                                            </div>
                                            
                                            {m.howTo.fields && (
                                                <div className="space-y-1.5 border-l-2 border-teal-200 pl-3">
                                                    <p className="text-[9px] text-teal-900/60 uppercase font-black mb-1">Required Fields:</p>
                                                    {m.howTo.fields.map((f, idx) => (
                                                        <div key={idx} className="flex items-center gap-2 text-[10px] text-teal-800">
                                                            <div className="h-1 w-1 bg-teal-400 rounded-full" />
                                                            {f}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            <div className="space-y-2.5">
                                                {m.howTo.steps.map((step, sIdx) => (
                                                    <div key={sIdx} className="flex items-start gap-3">
                                                        <div className="h-5 w-5 rounded-lg bg-teal-100 flex items-center justify-center text-teal-700 shrink-0 text-[9px] font-black">
                                                            {sIdx + 1}
                                                        </div>
                                                        <p className="text-[10px] text-teal-900 leading-tight pt-0.5">{step}</p>
                                                    </div>
                                                ))}
                                            </div>

                                            <button
                                                onClick={() => handleSend(m.howTo.q, true)}
                                                className="w-full mt-2 py-2.5 bg-teal-600 text-white rounded-2xl flex items-center justify-center gap-2 hover:bg-teal-700 transition-all shadow-lg shadow-teal-600/20 active:scale-95"
                                            >
                                                <ChevronRight size={14} /> Open {m.howTo.module}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* ERROR FORMAT */}
                                {m.error && (
                                    <div className="space-y-4 mt-2 animate-in fade-in slide-in-from-bottom-2">
                                        <div className="p-4 bg-rose-50/50 rounded-3xl border border-rose-100 ring-1 ring-white/50 space-y-4">
                                            <div className="flex items-center gap-2 text-rose-600">
                                                <AlertCircle size={14} />
                                                <span className="uppercase tracking-widest text-[9px] font-black">Possible Reasons</span>
                                            </div>
                                            <ul className="space-y-1.5">
                                                {m.error.reasons.map((r, idx) => (
                                                    <li key={idx} className="flex items-center gap-2 text-[10px] text-rose-800">
                                                        <div className="h-1 w-1 bg-rose-400 rounded-full" />
                                                        {r}
                                                    </li>
                                                ))}
                                            </ul>
                                            <div className="pt-3 border-t border-rose-100">
                                                <div className="flex items-center gap-2 text-rose-600 mb-2">
                                                    <CheckCircle2 size={14} />
                                                    <span className="uppercase tracking-widest text-[9px] font-black">Solution</span>
                                                </div>
                                                <p className="text-[10px] text-rose-900 leading-relaxed font-bold bg-white/50 p-3 rounded-2xl border border-rose-50">{m.error.solution}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Input Area */}
            <div className="p-5 bg-white border-t border-slate-100 shrink-0 relative z-20">
                <form 
                    onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                    className="flex items-center gap-3"
                >
                    <button
                        type="button"
                        onClick={toggleListening}
                        className={`h-11 w-11 rounded-2xl transition-all duration-300 shadow-sm flex items-center justify-center border ring-offset-2 ${
                            isListening 
                                ? 'bg-rose-500 text-white animate-pulse border-rose-400 ring-4 ring-rose-500/20' 
                                : 'bg-slate-50 text-slate-500 border-slate-100 hover:bg-slate-100 active:scale-90 shadow-inner'
                        }`}
                    >
                        {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                    </button>
                    <div className="flex-1 flex items-center bg-slate-50 p-2 rounded-2xl border border-slate-100 focus-within:border-teal-500/30 focus-within:bg-white focus-within:ring-4 focus-within:ring-teal-500/5 transition-all duration-300 shadow-inner group">
                        <input 
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Ask me how to do something or report an error"
                            className="flex-1 bg-transparent border-none outline-none px-3 text-[11px] font-bold text-slate-700 placeholder:text-slate-400"
                        />
                        <button 
                            type="submit"
                            className="bg-teal-600 h-9 w-9 rounded-xl text-white shadow-lg shadow-teal-600/30 flex items-center justify-center hover:bg-teal-700 transition-all active:scale-90 group-hover:rotate-12"
                        >
                            <Send size={16} />
                        </button>
                    </div>
                </form>
            </div>
            
            <div className="px-5 pb-4 bg-white flex justify-center border-t border-slate-50/50 pt-2">
                 <div className="flex items-center gap-2 text-[8px] font-black text-slate-300 uppercase tracking-[0.3em] w-full justify-center">
                     <Terminal size={10} className="text-teal-500/30" /> POWERED BY ZORVIAN HUB INTELLIGENCE
                 </div>
            </div>
        </div>
    );
};

export default AiAssistant;
