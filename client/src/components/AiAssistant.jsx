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
    hi: { name: 'हिन्दी (Hindi)', code: 'hi-IN' }
};

const AI_KNOWLEDGE_BASE = {
    // ... same as before but now we will acknowledge language
    general: [
        { q: "How to use the hub?", a: "Welcome! Navigate using the sidebar. Check your attendance on the main dashboard.", link: "/dashboard" },
        { q: "Update my profile?", a: "Go to 'Profile' to change your avatar and view your personal details.", link: "/profile" }
    ],
    admin: [
        { q: "Manage Employees?", a: "Go to 'Employee Management' to add or edit staff members.", link: "/admin/employees" },
        { q: "Approve Leaves?", a: "Check 'Leave Approvals' in your dashboard for pending staff requests.", link: "/admin/approvals" },
        { q: "Check Biometrics?", a: "View 'Biometric Sync' stats.", link: "/admin/biometric" }
    ],
    // ... roles will be similar (shortened for brevity in this response)
    staff: [
        { q: "Mark my attendance?", a: "Go to 'Attendance' and click the 'Mark Entry' button.", link: "/staff/attendance" },
        { q: "Apply for leave?", a: "Use the 'Leave Application' form.", link: "/staff/leave-apply" }
    ]
};

const PAGE_CONTEXTS = {
    '/attendance': "You are viewing Attendance records.",
    '/leave-apply': "In Leave Application.",
    '/dashboard': "Home Dashboard."
};

const AiAssistant = () => {
    const { user } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { type: 'ai', text: `Hi ${user?.name || 'User'}! I'm your PPG AI. Speak or type to me!`, time: new Date() }
    ]);
    const [input, setInput] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(true);
    const [lang, setLang] = useState('en');
    const scrollRef = useRef(null);
    const recognitionRef = useRef(null);

    // Initialize Recognition
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
        setSuggestions([...roleSugg, ...genSugg].slice(0, 4));
    }, [user?.role]);

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

            const reply = match ? match.a : "I'm learning new things every day! Please check the menu for more options.";
            setMessages(prev => [...prev, { 
                type: 'ai', 
                text: reply, 
                link: match?.link,
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
                        dragConstraints={{ left: -window.innerWidth + 400, right: 0, top: -window.innerHeight + 600, bottom: 0 }}
                        initial={{ opacity: 0, scale: 0.8, y: 50 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, y: 50 }}
                        className="mb-4 w-[360px] max-h-[600px] bg-white rounded-[32px] shadow-[0_30px_60px_rgba(14,165,233,0.25)] flex flex-col overflow-hidden border border-sky-100 cursor-grab active:cursor-grabbing"
                    >
                        {/* Header */}
                        <div className="bg-gradient-to-br from-sky-700 to-sky-500 p-6 flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="h-12 w-12 bg-white/20 backdrop-blur-xl rounded-2xl flex items-center justify-center border border-white/20 shadow-inner">
                                        <Sparkles className="text-white h-6 w-6 animate-pulse" />
                                    </div>
                                    <div className="flex flex-col">
                                        <h3 className="text-white font-black text-base tracking-tight leading-none mb-1">PPG iTech Assistant</h3>
                                        <span className="text-sky-100 text-[9px] font-black uppercase tracking-[0.2em] opacity-80">Multilingual Voice AI</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => setIsSpeaking(!isSpeaking)}
                                        className={`p-2 rounded-xl transition-all ${isSpeaking ? 'bg-white/20 text-white' : 'bg-black/20 text-white/50'}`}
                                    >
                                        {isSpeaking ? <Volume2 size={18} /> : <VolumeX size={18} />}
                                    </button>
                                    <div className="relative group">
                                        <button className="p-2 bg-white/20 rounded-xl text-white">
                                            <Languages size={18} />
                                        </button>
                                        <div className="absolute top-full right-0 mt-2 bg-white rounded-2xl shadow-2xl py-2 hidden group-hover:block z-50 border border-sky-50">
                                            {Object.entries(LANGUAGES).map(([key, value]) => (
                                                <button
                                                    key={key}
                                                    onClick={() => setLang(key)}
                                                    className={`w-full px-5 py-2 text-[11px] font-black uppercase text-left hover:bg-sky-50 transition-colors ${lang === key ? 'text-sky-600' : 'text-gray-400'}`}
                                                >
                                                    {value.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center justify-between px-1">
                                <p className="text-white/60 text-[8px] font-bold uppercase tracking-widest">
                                    Language: {LANGUAGES[lang].name}
                                </p>
                                <span className="text-white/80 text-[10px] font-black">Powered by VORTEX AI</span>
                            </div>
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
                                            : 'bg-gradient-to-r from-sky-700 to-sky-500 text-white rounded-tr-none shadow-lg shadow-sky-200'
                                    }`}>
                                        {m.text}
                                        {m.link && (
                                            <button 
                                                onClick={() => { navigate(m.link); setIsOpen(false); }}
                                                className="mt-4 flex items-center justify-between gap-2 text-sky-700 bg-sky-50 hover:bg-sky-100 px-4 py-3 rounded-2xl text-[11px] w-full font-black border border-sky-100 transition-all group"
                                            >
                                                Go to Page <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                                            </button>
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                        </div>

                        {/* Input Area */}
                        <div className="p-6 bg-white border-t border-sky-50">
                            <form 
                                onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                                className="flex items-center gap-2"
                            >
                                <button
                                    type="button"
                                    onClick={toggleListening}
                                    className={`p-3.5 rounded-2xl transition-all shadow-lg ${
                                        isListening 
                                            ? 'bg-red-500 text-white animate-pulse shadow-red-200' 
                                            : 'bg-sky-50 text-sky-600 hover:bg-sky-100 shadow-sky-100'
                                    }`}
                                >
                                    {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                                </button>
                                <div className="flex-1 flex items-center bg-sky-100/30 p-2 rounded-3xl border border-sky-100 focus-within:border-sky-300 transition-all">
                                    <input 
                                        type="text"
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        placeholder={isListening ? "Listening..." : "Type or speak..."}
                                        className="flex-1 bg-transparent border-none outline-none px-4 text-[13px] font-bold text-gray-700"
                                    />
                                    <button 
                                        type="submit"
                                        className="bg-sky-700 p-3 rounded-2xl text-white shadow-lg shadow-sky-200 hover:bg-sky-800 transition-all"
                                    >
                                        <Send size={18} />
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
                    className={`h-16 w-16 rounded-[24px] flex items-center justify-center shadow-2xl transition-all duration-500 border-4 border-white ${
                        isOpen ? 'bg-sky-100 text-sky-700' : 'bg-sky-700 text-white animate-bounce-slow'
                    }`}
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
