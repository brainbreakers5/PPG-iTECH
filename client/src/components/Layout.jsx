import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useAuth } from '../context/AuthContext';

const Layout = ({ children }) => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { user, loading } = useAuth();
    const location = useLocation();

    const isManagement = location.pathname.startsWith('/management');
    const effectiveRole = isManagement ? 'management' : (user?.role || 'staff');

    useEffect(() => {
        const handleCloseSidebar = () => setSidebarOpen(false);
        window.addEventListener('closeSidebar', handleCloseSidebar);
        return () => window.removeEventListener('closeSidebar', handleCloseSidebar);
    }, []);

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
        <div className="flex h-screen bg-transparent overflow-hidden font-sans">
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
                />
            )}

            <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-500 ease-in-out ml-0 lg:ml-20`}>
                <Header
                    toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                    sidebarOpen={sidebarOpen}
                />

                <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-8 no-scrollbar scroll-smooth">
                    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in relative z-10">
                        {/* Real-time Dashboard Clock - Top Right (Only on Dashboards) */}
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
                        {/* Print-Only Branding Header */}
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
            </div>
        </div>
    );
};

export default Layout;
