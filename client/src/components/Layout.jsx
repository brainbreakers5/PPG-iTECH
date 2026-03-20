import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import AiAssistant from './AiAssistant';
import { useAuth } from '../context/AuthContext';
import { AnimatePresence, motion } from 'framer-motion';

const Layout = ({ children }) => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isAiOpen, setIsAiOpen] = useState(() => localStorage.getItem('isAiOpen') === 'true');
    const { user, loading } = useAuth();
    const location = useLocation();

    const isManagement = location.pathname.startsWith('/management');
    const effectiveRole = isManagement ? 'management' : (user?.role || 'staff');

    useEffect(() => {
        const handleCloseSidebar = () => {
            setSidebarOpen(false);
            setIsAiOpen(false);
            window.dispatchEvent(new CustomEvent('AI_STATUS', { detail: { open: false } }));
        };
        const handleToggleAi = () => {
            setIsAiOpen(prev => {
                const newState = !prev;
                window.dispatchEvent(new CustomEvent('AI_STATUS', { detail: { open: newState } }));
                return newState;
            });
        };
        
        window.addEventListener('closeSidebar', handleCloseSidebar);
        window.addEventListener('TOGGLE_AI_ASSISTANT', handleToggleAi);
        
        // Initial sync of state
        window.dispatchEvent(new CustomEvent('AI_STATUS', { detail: { open: localStorage.getItem('isAiOpen') === 'true' } }));

        return () => {
            window.removeEventListener('closeSidebar', handleCloseSidebar);
            window.removeEventListener('TOGGLE_AI_ASSISTANT', handleToggleAi);
        };
    }, []);

    // Persist AI state
    useEffect(() => {
        localStorage.setItem('isAiOpen', isAiOpen);
        window.dispatchEvent(new CustomEvent('AI_STATUS', { detail: { open: isAiOpen } }));
    }, [isAiOpen]);

    // Scroll to top on route change
    useEffect(() => {
        const mainElement = document.querySelector('main');
        if (mainElement) {
            mainElement.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [location.pathname]);

    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    if (loading && !isManagement) return <div className="h-screen w-screen flex items-center justify-center bg-sky-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-sky-600"></div>
    </div>;

    return (
        <div className="flex flex-col h-screen bg-transparent overflow-hidden font-sans">
            {/* Full-width Top Header */}
            <Header
                toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                sidebarOpen={sidebarOpen}
            />

            <div className="flex flex-1 overflow-hidden relative">
                {/* Sidebar */}
                <Sidebar
                    userRole={effectiveRole}
                    isOpen={sidebarOpen}
                    onToggle={() => setSidebarOpen(!sidebarOpen)}
                    onClose={() => setSidebarOpen(false)}
                />

                {/* Backdrop for mobile */}
                {sidebarOpen && (
                    <div
                        className="fixed inset-0 bg-sky-900/20 backdrop-blur-sm lg:hidden z-30 transition-all duration-500"
                        onClick={() => setSidebarOpen(false)}
                        style={{ top: '73px' }}
                    />
                )}

                {/* Split Logic: 75% Content / 25% AI Assistant */}
                <div className="flex flex-1 overflow-hidden transition-all duration-500 ease-in-out ml-0 lg:ml-20">
                    <main 
                        className={`overflow-x-hidden ${sidebarOpen ? 'overflow-y-hidden lg:overflow-y-auto' : 'overflow-y-auto'} p-4 md:p-8 no-scrollbar scroll-smooth transition-all duration-500 ease-in-out ${
                            isAiOpen && window.innerWidth >= 1024 ? 'lg:w-3/4' : 'w-full'
                        }`}
                    >
                        <div className="max-w-7xl mx-auto space-y-6 animate-fade-in relative z-10">
                            {/* Dashboard Clock */}
                            {['/admin', '/principal', '/hod', '/staff', '/management'].includes(location.pathname) && (
                                <div className="no-print hidden md:flex absolute top-0 right-0 items-center gap-4 py-2 px-4 bg-white/50 backdrop-blur-sm rounded-2xl border border-white/50 shadow-sm transition-all hover:bg-white/80">
                                    <div className="text-right">
                                        <p className="text-[9px] font-black text-sky-600 uppercase tracking-widest leading-none mb-1">
                                            {now.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                                        </p>
                                        <p className="text-sm font-black text-gray-800 tracking-tight leading-none">
                                            {now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                                        </p>
                                    </div>
                                    <div className="h-8 w-8 bg-sky-50 rounded-xl flex items-center justify-center text-sky-500 shadow-inner">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                </div>
                            )}

                            {/* Print Branding */}
                            <div className="print-branding-header hidden print:block mb-8 border-b-4 border-black pb-4 text-black">
                                <div className="flex justify-between items-end">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-[0.3em]">Staff Management System</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-black text-blue-900" style={{ letterSpacing: '0.5px' }}>PPG EMP HUB</p>
                                        <p className="text-[9px] font-bold text-gray-500">{new Date().toLocaleString('en-GB')}</p>
                                    </div>
                                </div>
                                <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center text-[9px] font-bold uppercase tracking-widest">
                                    <span>Generated by: {isManagement ? 'Management' : user?.name}</span>
                                    <span>Role Authority: {effectiveRole}</span>
                                </div>
                            </div>

                            {children}
                        </div>
                    </main>

                    {/* Right-side AI Assistant (Desktop 25% / Mobile Overlay) */}
                    <AnimatePresence>
                        {isAiOpen && (
                            <motion.div
                                initial={window.innerWidth >= 1024 ? { x: '100%' } : { opacity: 0, y: 50 }}
                                animate={window.innerWidth >= 1024 ? { x: 0 } : { opacity: 1, y: 0 }}
                                exit={window.innerWidth >= 1024 ? { x: '100%' } : { opacity: 0, y: 50 }}
                                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                                className={`z-40 border-l border-gray-100 bg-white shadow-2xl overflow-hidden ${
                                    window.innerWidth >= 1024 
                                    ? 'static w-1/4 h-full' 
                                    : 'fixed bottom-4 right-4 w-[calc(100vw-32px)] h-[600px] rounded-[32px]'
                                }`}
                            >
                                <AiAssistant isSidebar={true} onClose={() => {
                                    setIsAiOpen(false);
                                    window.dispatchEvent(new CustomEvent('AI_STATUS', { detail: { open: false } }));
                                }} />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
};

export default Layout;
