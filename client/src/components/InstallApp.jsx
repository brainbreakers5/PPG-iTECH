import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    X, Send, ArrowRight, Sparkles, 
    Mic, MicOff, Volume2, VolumeX, Search, HelpCircle, User, CheckCircle, Info
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
        { q: "Leave Apply", a: "Opening leave application.", link: "/staff/leaves", hash: "apply" },
        { q: "Permission Letter", a: "Opening permissions.", link: "/staff/leaves", hash: "permission" },
        { q: "Comp Leave", a: "Viewing comp leave.", link: "/staff/leaves", hash: "compoff" },
        { q: "Leave Balance", a: "Checking leave balance.", link: "/staff/leaves", hash: "balance" },
        { q: "Incoming Approvals", a: "Checking approvals.", link: "/staff/leaves", hash: "approvals" },
        { q: "My Leave History", a: "Viewing leave history.", link: "/staff/leaves", hash: "history" },
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
        { q: "Leave Apply", a: "Opening leave apply.", link: "/hod/leaves", hash: "apply" },
        { q: "Permission Letter", a: "Opening permissions.", link: "/hod/leaves", hash: "permission" },
        { q: "Comp Leave", a: "Viewing comp leave.", link: "/hod/leaves", hash: "compoff" },
        { q: "Leave Balance", a: "Checking leave balance.", link: "/hod/leaves", hash: "balance" },
        { q: "Incoming Approvals", a: "Opening incoming approvals.", link: "/hod/leaves", hash: "approvals" },
        { q: "My Leave History", a: "Viewing leave history.", link: "/hod/leaves", hash: "history" },
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

    // Initial greeting update
    useEffect(() => {
        if (messages.length === 0 && user) {
            setMessages([
                { type: 'ai', text: `Hello ${user.name}, I am your AI assistant. Tell me what you need, let's make it happen.`, time: new Date() }
            ]);
        }
    }, [user, messages.length]);

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
            
            // ANALYZE AGAINST INSTITUTIONAL KNOWLEDGE
            const exactMatch = allowedKIs.find(k => {
                const qText = k.q.toLowerCase().replace(/[?.,!]/g, "");
                return cleanText === qText || (isClick && cleanText.includes(qText));
            });

            if (exactMatch) {
                if (isClick) {
                    let actionLink = exactMatch.link;
                    // Dynamic Profile Path
                    if (exactMatch.q.toLowerCase() === 'profile' && !actionLink.includes(user.emp_id) && role !== 'management') {
                        actionLink = `/${role}/profile/${user.emp_id}`;
                    }

                    if (exactMatch.action === 'logout') {
                        setMessages(prev => [...prev, { type: 'ai', text: "Logging out safely...", time: new Date() }]);
                        setTimeout(() => { logout(); navigate('/login'); }, 1000);
                        return;
                    }

                    // PERFORM INSTANT REDIRECT
                    setMessages(prev => [...prev, { type: 'ai', text: `Directing you to ${exactMatch.q}...`, time: new Date() }]);
                    
                    // Special behavior for Leave Apply: Include Step by Step explanation
                    if (exactMatch.q.toLowerCase() === 'leave apply') {
                        const leaveSteps = `To apply for leave, follow these steps:
1. Select the **Leave Type** (e.g., Casual Leave).
2. Use the **Date Picker** to choose your intended dates.
3. Configure the **Day Type** (Full or Half Day).
4. Assign an **Alternative Staff** and specify the periods they will cover.
5. Click **"Confirm & Add This Date"**.
6. Finally, enter your **Reason** and click **"Submit Application"**.`;
                        
                        setMessages(prev => [...prev, { type: 'ai', text: leaveSteps, time: new Date() }]);
                        speak("I've guided you to the leave application page. Please follow the steps provided.");
                    }

                    setTimeout(() => { 
                        // Use window API to force hash if already on route
                        if (exactMatch.hash) {
                           window.location.hash = `#${exactMatch.hash}`;
                        } else {
                           window.location.hash = "";
                        }
                        navigate(actionLink); 
                        // DONT HIDE AI on click - as requested
                    }, 10);
                    return;
                } else {
                    const reply = `I found a direct tool for you: "${exactMatch.q}". Tap below to open it.`;
                    setMessages(prev => [...prev, { type: 'ai', text: reply, related: [exactMatch], time: new Date() }]);
                    speak(reply);
                    return;
                }
            }

            // CHECK FOR RELATED OPTIONS
            const relatedMatches = allowedKIs.filter(k => {
                const qText = k.q.toLowerCase().replace(/[?.,!]/g, "");
                return qText.includes(cleanText) || cleanText.includes(qText);
            });

            if (relatedMatches.length > 0 && !isClick) {
                const reply = `I found some relevant modules on the hub for you:`;
                setMessages(prev => [...prev, { type: 'ai', text: reply, related: relatedMatches, time: new Date() }]);
                speak(reply);
            } else {
                // ADVANCED AI RESEARCHER PERSONA FALLBACK
                const loadingMsg = { type: 'ai', text: "Analyzing query as Senior Researcher...", time: new Date(), isLoading: true };
                setMessages(prev => [...prev, loadingMsg]);
                
                setTimeout(() => {
                    setMessages(prev => prev.filter(m => !m.isLoading));
                    
                    // Simulated Structured Research Response
                    const structuredResponse = {
                        summary: `I've analyzed your query regarding "${text}" using advanced reasoning and documentation benchmarks.`,
                        detailed: `Based on standard software engineering principles and organizational management practices, your request falls into the category of general information. While the PPG HUB provides specific modules for Profile, Leaves, and Attendance, for queries like this, I recommend adhering to established industry best practices.`,
                        steps: [
                            "Identify the core objective of your search.",
                            "Consult the relevant department lead if this pertains to institutional policy.",
                            "Utilize the Profile or Dashboard modules for system-related data."
                        ],
                        examples: [
                            "Querying 'Leave Balance' returns real-time database quotas.",
                            "Searching 'Attendance History' provides audit-ready logs."
                        ],
                        conclusion: "In conclusion, stick to institutional tools for hub tasks, or consult research engines for abstract technical concepts. I am here to optimize your workflow within this hub."
                    };

                    const responseText = `
**Summary**
${structuredResponse.summary}

**Detailed Explanation**
${structuredResponse.detailed}

**Steps**
${structuredResponse.steps.map(s => `• ${s}`).join('\n')}

**Examples**
${structuredResponse.examples.map(e => `• ${e}`).join('\n')}

**Conclusion**
${structuredResponse.conclusion}
`;
                    setMessages(prev => [...prev, { type: 'ai', text: responseText, time: new Date(), isRich: true }]);
                    speak("I've prepared a detailed research analysis for you.");
                }, 1500);
            }
        }, 600);
    };

    return (
        <div className="flex flex-col h-full w-full bg-white relative">
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
                        {onClose && (
                            <button 
                                onClick={onClose}
                                className="p-2 hover:bg-white/10 rounded-xl transition-all text-white border border-transparent hover:border-white/10"
                                title="Close Assistant"
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
                className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/50 scroll-smooth no-scrollbar"
            >
                {messages.map((m, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={`flex ${m.type === 'ai' ? 'justify-start' : 'justify-end'}`}
                    >
                        <div className={`max-w-[95%] p-4 rounded-3xl text-[11px] font-bold leading-relaxed shadow-sm border ${
                            m.type === 'ai' 
                                ? 'bg-white text-slate-700 rounded-tl-none border-slate-200' 
                                : 'bg-gradient-to-br from-sky-800 to-sky-700 text-white rounded-tr-none'
                        }`}>
                            {m.isLoading ? (
                                <div className="flex items-center gap-1.5 py-1">
                                    <div className="h-1.5 w-1.5 bg-sky-400 rounded-full animate-bounce" />
                                    <div className="h-1.5 w-1.5 bg-sky-400 rounded-full animate-bounce [animation-delay:-.3s]" />
                                    <div className="h-1.5 w-1.5 bg-sky-400 rounded-full animate-bounce [animation-delay:-.5s]" />
                                </div>
                            ) : (
                                <div className={`space-y-3 ${m.isRich ? 'prose prose-sm prose-slate' : ''}`}>
                                    {m.text.split('\n').map((line, idx) => (
                                        <p key={idx}>{line}</p>
                                    ))}
                                </div>
                            )}
                            
                            {m.related && m.related.length > 0 && (
                                <div className="mt-4 flex flex-col gap-2">
                                    <p className="text-[10px] text-sky-600 uppercase tracking-widest mb-1 ml-1 opacity-70">Direct Shortcut</p>
                                    {m.related.map((r, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => handleSend(r.q, true)}
                                            className="flex items-center justify-between gap-3 text-white bg-sky-600 hover:bg-sky-700 px-4 py-3 rounded-2xl text-[11px] w-full font-black border border-sky-500 transition-all group shadow-md"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="h-6 w-6 rounded-lg bg-white/20 flex items-center justify-center">
                                                    <Info size={12} />
                                                </div>
                                                {r.q}
                                            </div>
                                            <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Input Area */}
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
                                ? 'bg-rose-500 text-white animate-pulse' 
                                : 'bg-slate-50 text-slate-500 border-slate-100'
                        }`}
                    >
                        {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                    </button>
                    <div className="flex-1 flex items-center bg-slate-50 p-1.5 rounded-xl border border-slate-100 focus-within:border-sky-500/30 transition-all shadow-inner group">
                        <input 
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Consult Assistant..."
                            className="flex-1 bg-transparent border-none outline-none px-2 text-[10px] font-bold text-slate-700"
                        />
                        <button 
                            type="submit"
                            className="bg-sky-600 h-8 w-8 rounded-lg text-white shadow-lg flex items-center justify-center hover:bg-sky-700 transition-all group-focus-within:rotate-[360deg] duration-700"
                        >
                            <Send size={14} />
                        </button>
                    </div>
                </form>
            </div>
            
            {/* Footer */}
            <div className="px-5 pb-4 bg-white flex justify-center">
                 <div className="flex items-center gap-2 text-[8px] font-black text-gray-400 uppercase tracking-widest border-t border-gray-50 pt-3 w-full justify-center">
                     <CheckCircle size={10} className="text-emerald-500" /> Powered by ZORVIAN TECHNOLOGIES
                 </div>
            </div>
        </div>
    );
};

export default AiAssistant;
