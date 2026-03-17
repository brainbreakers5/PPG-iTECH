import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FaBell, FaBirthdayCake, FaTimes, FaCheckCircle, FaExclamationCircle, FaInfoCircle, FaUser, FaBuilding, FaFileAlt, FaCalendarCheck } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import api from '../utils/api';

const Header = ({ toggleSidebar, sidebarOpen }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const isManagement = location.pathname.startsWith('/management');
    const effectiveRole = isManagement ? 'management' : (user?.role || 'staff');
    const [isBirthday, setIsBirthday] = useState(false);
    const [isDismissed, setIsDismissed] = useState(sessionStorage.getItem('bday_dismissed') === 'true');
    const [notifications, setNotifications] = useState([]);
    const [showNotifs, setShowNotifs] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const notifRef = useRef(null);
    const [currentTime, setCurrentTime] = useState(new Date());

    // Update current time every minute to refresh timestamps
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    // Search functionality
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [showSearchResults, setShowSearchResults] = useState(false);
    const [employees, setEmployees] = useState([]);
    const [departments, setDepartments] = useState([]);
    const searchRef = useRef(null);

    const socket = useSocket();

    // Define menu items for all roles
    const menuItems = {
        admin: [
            { label: 'Dashboard', path: '/admin' },
            { label: 'Employee Management', path: '/admin/employees' },
            { label: 'Department Management', path: '/admin/departments' },
            { label: 'Salary Management', path: '/admin/payroll' },
            { label: 'Attendance Records', path: '/admin/attendance' },
            { label: 'Leave Balances', path: '/admin/leave-limits' },
            { label: 'Timetable Setup', path: '/admin/timetable-setup' },
            { label: 'Calendar', path: '/admin/calendar' },
            { label: 'Purchase Requests', path: '/admin/purchase' },
        ],
        principal: [
            { label: 'Dashboard', path: '/principal' },
            { label: 'Attendance Records', path: '/principal/attendance' },
            { label: 'Departments', path: '/principal/department' },
            { label: 'Leave Requests', path: '/principal/leaves' },
            { label: 'Leave History', path: '/principal/leave-history' },
            { label: 'Salary Overview', path: '/principal/payroll' },
            { label: 'Conversation', path: '/principal/conversation' },
            { label: 'Purchase Requests', path: '/principal/purchase' },
            { label: 'Academic Calendar', path: '/principal/calendar' },
        ],
        hod: [
            { label: 'Dashboard', path: '/hod' },
            { label: 'Leave Balance', path: '/hod/leaves' },
            { label: 'Department Staff', path: '/hod/department' },
            { label: 'Timetable', path: '/hod/timetable' },
            { label: 'Attendance Record', path: '/hod/attendance' },
            { label: 'Conversation', path: '/hod/conversation' },
            { label: 'Purchase Requests', path: '/hod/purchase' },
            { label: 'Academic Calendar', path: '/hod/calendar' },
        ],
        staff: [
            { label: 'Dashboard', path: '/staff' },
            { label: 'Leave Balance', path: '/staff/leaves' },
            { label: 'Salary Details', path: '/staff/payroll' },
            { label: 'Timetable', path: '/staff/timetables' },
            { label: 'Messages', path: '/staff/conversation' },
            { label: 'Purchase Requests', path: '/staff/items' },
            { label: 'Academic Calendar', path: '/staff/calendar' },
        ],
        management: [
            { label: 'Dashboard', path: '/management' },
            { label: 'Departments', path: '/management/departments' },
            { label: 'Salary Overview', path: '/management/payroll' },
        ],
    };

    useEffect(() => {
        // Fetch employees and departments for search
        const fetchSearchData = async () => {
            try {
                const [empRes, deptRes] = await Promise.all([
                    api.get('/employees'),
                    api.get('/departments')
                ]);
                setEmployees(empRes.data || []);
                setDepartments(deptRes.data || []);
            } catch (error) {
                console.error('Failed to fetch search data:', error);
            }
        };
        fetchSearchData();
    }, []);

    useEffect(() => {
        if (user?.dob) {
            const today = new Date();
            const dob = new Date(user.dob);
            if (today.getDate() === dob.getDate() && today.getMonth() === dob.getMonth()) {
                setIsBirthday(true);
            }
        }

        fetchNotifications();
        // Auto-refresh every 10 seconds like dashboard for real-time updates
        const interval = setInterval(fetchNotifications, 10000);
        return () => clearInterval(interval);
    }, []);

    // Real-time socket listeners for instant notifications
    useEffect(() => {
        if (!socket) return;

        // Listen for all notifications - instant updates
        socket.on('notification_received', (newNotif) => {
            console.log('Real-time notification received:', newNotif);
            setNotifications(prev => {
                // Check if notification already exists to avoid duplicates
                const exists = prev.some(n => n.id === newNotif.id);
                return exists ? prev : [newNotif, ...prev];
            });
            setUnreadCount(prev => prev + 1);
        });

        // Listen for biometric punch specifically
        socket.on('biometric_punch', (data) => {
            console.log('Real-time punch received:', data);
            // Capture client's current LOCAL time
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const seconds = String(now.getSeconds()).padStart(2, '0');
            const localTimestamp = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;

            const newNotif = {
                id: Date.now(),
                message: `${data.name} punched ${data.type} at ${data.time}`,
                type: 'system',
                created_at: localTimestamp,
                is_read: false,
                metadata: null
            };
            setNotifications(prev => [newNotif, ...prev]);
            setUnreadCount(prev => prev + 1);
        });

        return () => {
            socket.off('notification_received');
            socket.off('biometric_punch');
        };
    }, [socket]);

    // Handle click outside for dropdowns
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (notifRef.current && !notifRef.current.contains(e.target)) {
                setShowNotifs(false);
            }
            if (searchRef.current && !searchRef.current.contains(e.target)) {
                setShowSearchResults(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Search handler
    const performSearch = (query) => {
        setSearchQuery(query);
        if (!query.trim()) {
            setSearchResults([]);
            setShowSearchResults(false);
            return;
        }

        const results = [];
        const lowerQuery = query.toLowerCase();

        // Search employees by ID or name
        const matchedEmployees = employees.filter(emp =>
            emp.name.toLowerCase().includes(lowerQuery) ||
            emp.emp_id.toLowerCase().includes(lowerQuery)
        ).slice(0, 5);

        matchedEmployees.forEach(emp => {
            results.push({
                type: 'employee',
                id: emp.id,
                emp_id: emp.emp_id,
                label: emp.name,
                sublabel: `ID: ${emp.emp_id} • ${emp.designation || emp.role}`,
                icon: <FaUser />,
                path: `/${effectiveRole}/personnel/${emp.role}` // Navigate to personnel list page
            });
        });

        // Search departments by name
        const matchedDepartments = departments.filter(dept =>
            dept.name.toLowerCase().includes(lowerQuery) ||
            (dept.code && dept.code.toLowerCase().includes(lowerQuery))
        ).slice(0, 5);

        matchedDepartments.forEach(dept => {
            results.push({
                type: 'department',
                id: dept.id,
                label: dept.name,
                sublabel: `Code: ${dept.code || 'N/A'}`,
                icon: <FaBuilding />,
                path: `/${effectiveRole}/department/${dept.id}`
            });
        });

        // Search menu pages
        const currentMenuItems = menuItems[effectiveRole] || [];
        const matchedPages = currentMenuItems.filter(item =>
            item.label.toLowerCase().includes(lowerQuery)
        ).slice(0, 5);

        matchedPages.forEach(page => {
            results.push({
                type: 'page',
                label: page.label,
                sublabel: 'Navigate to page',
                icon: <FaFileAlt />,
                path: page.path
            });
        });

        setSearchResults(results);
        setShowSearchResults(results.length > 0);
    };

    const handleSearchResultClick = (result) => {
        navigate(result.path);
        setSearchQuery('');
        setSearchResults([]);
        setShowSearchResults(false);
        window.dispatchEvent(new CustomEvent('closeSidebar'));
    };

    const fetchNotifications = async () => {
        try {
            const { data } = await api.get('/notifications');
            setNotifications(data);
            setUnreadCount(data.filter(n => !n.is_read).length);
        } catch (error) { console.error(error); }
    };

    const markAllRead = async () => {
        try {
            await api.put('/notifications/read-all');
            fetchNotifications();
        } catch (error) { console.error(error); }
    };

    const markRead = async (id) => {
        try {
            await api.put(`/notifications/${id}/read`);
            fetchNotifications();
        } catch (error) { console.error(error); }
    };

    const handleNotificationClick = (notification) => {
        markRead(notification.id);
        setShowNotifs(false);

        const role = effectiveRole;
        // metadata might be a string or object depending on how it's returned
        const metadata = typeof notification.metadata === 'string' ? JSON.parse(notification.metadata) : (notification.metadata || {});

        switch (notification.type) {
            case 'leave':
                if (metadata.isStatusUpdate) {
                    if (role === 'principal') {
                        navigate('/principal/leave-history');
                    } else if (['hod', 'staff'].includes(role)) {
                        navigate(`/${role}/leaves#history`);
                    } else {
                        navigate(`/${role}/profile/${user.emp_id}`);
                    }
                } else {
                    // For leaves/permissions, different roles have different "incoming" pages
                    if (role === 'principal') {
                        navigate('/principal/leaves');
                    } else if (role === 'hod') {
                        navigate('/hod/leaves#approvals');
                    } else if (role === 'staff') {
                        navigate('/staff/leaves#approvals');
                    }
                }
                break;
            case 'permission':
                if (metadata.isStatusUpdate) {
                    if (role === 'principal') {
                        // Principal might view permission history in leave-history or a dedicated page if it exists
                        // Based on App.jsx, there's no principal/permission-history, so leave-history or leaves page
                        navigate('/principal/leave-history');
                    } else if (['hod', 'staff'].includes(role)) {
                        navigate(`/${role}/leaves#permission`); // Permission tab shows "My Permission Requests"
                    } else {
                        navigate(`/${role}/profile/${user.emp_id}`);
                    }
                } else {
                    if (role === 'principal') {
                        navigate('/principal/leaves');
                    } else if (role === 'hod') {
                        navigate('/hod/leaves#permission');
                    } else if (role === 'staff') {
                        navigate('/staff/leaves#permission');
                    }
                }
                break;
            case 'purchase':
                if (role === 'admin') {
                    navigate('/admin/purchase');
                } else if (role === 'principal') {
                    navigate('/principal/purchase');
                } else if (role === 'hod') {
                    navigate('/hod/purchase');
                } else {
                    navigate('/staff/items');
                }
                break;
            case 'conversation':
                if (role !== 'admin') {
                    navigate(`/${role}/conversation`);
                }
                break;
            case 'birthday':
                if (metadata && metadata.emp_id) {
                    navigate(`/${role}/profile/${metadata.emp_id}`);
                }
                break;
            default:
                // No navigation for system/biometric
                break;
        }
    };

    const formatNotificationTime = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr; // fallback

        const now = currentTime;
        const isToday = date.toDateString() === now.toDateString();
        
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const isYesterday = date.toDateString() === yesterday.toDateString();
        
        const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

        if (isToday) return `Today at ${time}`;
        if (isYesterday) return `Yesterday at ${time}`;
        
        const stringDate = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        return `${stringDate} at ${time}`;
    };

    const getNotificationTitle = (type) => {
        switch (type) {
            case 'leave':
                return 'Leave Notification';
            case 'permission':
                return 'Permission Notification';
            case 'purchase':
                return 'Purchase Request';
            case 'conversation':
                return 'Message Notification';
            case 'birthday':
                return 'Birthday Alert';
            default:
                return 'System Notification';
        }
    };

    return (
        <div className="flex flex-col w-full relative z-40">
            {isBirthday && !isDismissed && user && (
                <div className="bg-gradient-to-r from-pink-400 to-purple-500 text-white px-6 py-2.5 text-center animate-pulse-banner flex items-center justify-between relative shadow-xl rounded-b-xl mx-4 mt-2">
                    <div className="flex-1 flex items-center justify-center gap-3">
                        <FaBirthdayCake className="text-xl animate-bounce" />
                        <span className="font-bold uppercase tracking-wider text-sm">
                            Happy Birthday, {user.name}!🎉Wishing you a year filled with success, happiness, and great achievements.

                            With warm wishes,
                            PPG Family 🎀!
                        </span>
                    </div>
                    <button
                        onClick={() => { setIsDismissed(true); sessionStorage.setItem('bday_dismissed', 'true'); }}
                        className="p-1 hover:bg-white/20 rounded-full transition-colors"
                    >
                        <FaTimes />
                    </button>
                </div>
            )}

            <header className="header flex items-center justify-between px-6 py-4 bg-white/70 backdrop-blur-xl border-b border-white/50 no-print sticky top-0 transition-all shadow-sm">
                <div className="flex items-center gap-3">
                    {!sidebarOpen && (
                        <button
                            onClick={toggleSidebar}
                            className="flex items-center justify-center h-10 w-10 rounded-xl bg-sky-50 text-sky-600 hover:bg-sky-100 border border-sky-100 hover:border-sky-200 transition-all duration-200 active:scale-90 focus:outline-none no-print group"
                            title="Open Menu"
                        >
                            <div className="relative w-5 h-4 flex flex-col justify-between overflow-hidden text-sky-600">
                                <span className="block h-0.5 w-full bg-current rounded-full transition-all duration-300" />
                                <span className="block h-0.5 w-full bg-current rounded-full transition-all duration-300" />
                                <span className="block h-0.5 w-full bg-current rounded-full transition-all duration-300" />
                            </div>
                        </button>
                    )}
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl overflow-hidden shadow-md ring-2 ring-white">
                            <img src="/ppg-logo.png" alt="PPG Institute of Technology" className="w-full h-full object-cover" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-gray-800 tracking-tight">
                                PPG <span className="text-sky-600 ">iTech HUB</span>
                            </h2>
                        </div>
                    </div>
                </div>

                <div className="flex items-center space-x-3">
                    {/* Search Bar with Results */}
                    <div className="hidden lg:block relative" ref={searchRef}>
                        <div className="flex items-center bg-gray-50 border border-gray-100 px-4 py-2 rounded-xl focus-within:bg-white focus-within:ring-4 focus-within:ring-sky-100 focus-within:border-sky-200 transition-all w-64 group">
                            <svg className="w-4 h-4 text-gray-400 group-focus-within:text-sky-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                            <input
                                type="text"
                                placeholder="Quick Search..."
                                className="bg-transparent border-none outline-none ml-3 text-xs font-bold text-gray-700 w-full placeholder:text-gray-400"
                                value={searchQuery}
                                onChange={(e) => performSearch(e.target.value)}
                                onFocus={() => searchQuery && setShowSearchResults(true)}
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => {
                                        setSearchQuery('');
                                        setSearchResults([]);
                                        setShowSearchResults(false);
                                    }}
                                    className="ml-2 text-gray-400 hover:text-gray-600"
                                >
                                    <FaTimes size={12} />
                                </button>
                            )}
                        </div>

                        {/* Search Results Dropdown */}
                        {showSearchResults && searchResults.length > 0 && (
                            <div className="absolute top-full mt-2 w-96 bg-white/95 backdrop-blur-xl rounded-[24px] shadow-2xl border border-gray-100 overflow-hidden animate-slide-up ring-1 ring-black/5 z-50">
                                <div className="p-4 border-b border-gray-50">
                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Search Results</p>
                                </div>
                                <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                                    {searchResults.map((result, idx) => (
                                        <button
                                            key={`${result.type}-${idx}`}
                                            onClick={() => handleSearchResultClick(result)}
                                            className="w-full p-4 hover:bg-sky-50/50 transition-all border-b border-gray-50/50 flex items-start gap-4 text-left group"
                                        >
                                            <div className="mt-1 text-sky-500 group-hover:text-sky-600 transition-colors">
                                                {result.icon}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[11px] font-black text-gray-800 leading-tight truncate group-hover:text-sky-600 transition-colors">
                                                    {result.label}
                                                </p>
                                                <p className="text-[9px] text-gray-500 leading-relaxed mt-1 uppercase tracking-wider">
                                                    {result.sublabel}
                                                </p>
                                                <div className={`inline-block mt-1.5 px-2 py-0.5 rounded-md text-[7px] font-black uppercase tracking-widest ${result.type === 'employee' ? 'bg-blue-50 text-blue-600' :
                                                    result.type === 'department' ? 'bg-emerald-50 text-emerald-600' :
                                                        'bg-purple-50 text-purple-600'
                                                    }`}>
                                                    {result.type}
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="relative" ref={notifRef}>
                        <button
                            onClick={() => setShowNotifs(!showNotifs)}
                            className="text-gray-400 hover:text-sky-600 transition-all relative p-2.5 rounded-xl hover:bg-sky-50 shadow-sm border border-transparent hover:border-sky-100"
                        >
                            <FaBell className="text-lg" />
                            {unreadCount > 0 && (
                                <span className="absolute top-2 right-2 flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                                </span>
                            )}
                        </button>

                        {/* Notification Dropdown */}
                        {showNotifs && (
                            <div className="absolute right-0 mt-4 w-80 bg-white/95 backdrop-blur-xl rounded-[32px] shadow-2xl border border-gray-100 overflow-hidden animate-slide-up ring-1 ring-black/5">
                                <div className="p-6 border-b border-gray-50 flex justify-between items-center">
                                    <h3 className="font-black text-gray-800 text-xs uppercase tracking-widest">Notifications</h3>
                                    <button onClick={markAllRead} className="text-[9px] font-black text-sky-600 hover:text-sky-800 uppercase tracking-widest transition-colors">Clear All</button>
                                </div>
                                <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                                    {notifications.length > 0 ? (
                                        notifications.map(n => (
                                            <div
                                                key={n.id}
                                                onClick={() => handleNotificationClick(n)}
                                                className={`p-5 hover:bg-sky-50/30 cursor-pointer transition-all border-b border-gray-50/50 flex items-start gap-4 ${!n.is_read ? 'bg-sky-50/10' : ''}`}
                                            >
                                                <div className="mt-1">
                                                    {n.type === 'leave' ? <FaCalendarCheck className="text-sky-500" size={14} /> :
                                                        n.type === 'permission' ? <FaFileAlt className="text-teal-500" size={14} /> :
                                                            n.type === 'purchase' ? <FaBuilding className="text-purple-500" size={14} /> :
                                                                n.type === 'birthday' ? <FaBirthdayCake className="text-pink-500" size={14} /> :
                                                                    n.type === 'conversation' ? <FaInfoCircle className="text-blue-500" size={14} /> :
                                                                        <FaInfoCircle className="text-sky-500" size={14} />}
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-[11px] font-black text-gray-800 leading-tight">{getNotificationTitle(n.type)}</p>
                                                    <p className="text-[10px] text-gray-500 leading-relaxed mt-1">{n.message}</p>
                                                    <p className="text-[8px] font-black text-gray-400 mt-2 uppercase tracking-tighter">
                                                        {formatNotificationTime(n.created_at)}
                                                    </p>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="py-12 text-center">
                                            <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest italic">All clear</p>
                                        </div>
                                    )}
                                </div>
                                <div className="p-4 bg-gray-50/50 border-t border-gray-50 text-center">
                                    <button 
                                        onClick={() => {
                                            navigate(`/${effectiveRole}/notifications`);
                                            setShowNotifs(false);
                                        }}
                                        className="text-[10px] font-black text-sky-600 hover:text-sky-800 uppercase tracking-widest transition-colors flex items-center justify-center gap-2 mx-auto"
                                    >
                                        View All Notifications
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7"></path></svg>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div
                        className="flex items-center space-x-3 cursor-pointer hover:bg-gray-50 transition-all px-2 py-1 rounded-2xl group"
                        onClick={() => {
                            if (isManagement) return;
                            navigate(`/${effectiveRole}/profile/${user.emp_id}`);
                            window.dispatchEvent(new CustomEvent('closeSidebar'));
                        }}
                    >
                        <div className="hidden md:text-right md:block">
                            <p className="text-xs font-black text-gray-800 tracking-tight transition-colors uppercase tracking-widest text-[10px] group-hover:text-sky-600">{isManagement ? 'Management' : user?.name}</p>
                            <p className="text-[8px] text-sky-600 font-black uppercase tracking-[0.2em] mt-0.5">{isManagement ? 'Management Portal' : (user?.designation || user?.role)}</p>
                        </div>
                        <div className="relative">
                            <div className="absolute -inset-1 bg-gradient-to-tr from-sky-200 to-white rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                            {isManagement ? (
                                <div className="relative w-11 h-11 rounded-2xl border-2 border-white shadow-xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-white font-black text-lg">M</div>
                            ) : (
                                <img
                                    src={user?.profile_pic || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'U')}&background=ffffff&color=0EA5E9`}
                                    alt="Profile"
                                    className="relative w-11 h-11 rounded-2xl border-2 border-white shadow-xl group-hover:scale-105 transition-all object-cover"
                                />
                            )}
                        </div>
                    </div>
                </div>
            </header>
        </div>
    );
};

export default Header;
