import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  FaTachometerAlt,
  FaUsers,
  FaMoneyBillWave,
  FaBuilding,
  FaCalendarCheck,
  FaClipboardList,
  FaUserGraduate,
  FaSignOutAlt,
  FaComments,
  FaShoppingBag,
  FaCalendarDay,
  FaChevronLeft,
  FaClipboardCheck,
  FaCalendarAlt,
  FaShieldAlt,
  FaBell,
  FaFingerprint,
} from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import LiveStatus from './LiveStatus';

const Sidebar = ({ userRole = 'staff', isOpen, onClose }) => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = () => {
    // Clear ALL auth storage regardless of role
    sessionStorage.removeItem('managementAccess');
    localStorage.removeItem('managementAccess');
    localStorage.removeItem('token');
    localStorage.removeItem('lastRole');
    logout(); // also clears AuthContext user state
    navigate('/login');
  };

  const menuItems = {
    admin: [
      { label: 'Dashboard', path: '/admin', icon: <FaTachometerAlt /> },
      { label: 'Employee Management', path: '/admin/employees', icon: <FaUsers /> },
      { label: 'Department Management', path: '/admin/departments', icon: <FaBuilding /> },
      { label: 'Salary Management', path: '/admin/payroll', icon: <FaMoneyBillWave /> },
      { label: 'Attendance Records', path: '/admin/attendance', icon: <FaCalendarCheck /> },
      { label: 'Leave Balances', path: '/admin/leave-limits', icon: <FaClipboardCheck /> },
      { label: 'Timetable Setup', path: '/admin/timetable-setup', icon: <FaCalendarAlt /> },
      { label: 'Security Logs', path: '/admin/activity-logs', icon: <FaShieldAlt /> },
      { label: 'Calendar', path: '/admin/calendar', icon: <FaCalendarDay /> },
      { label: 'Biometric History', path: '/admin/biometric-history', icon: <FaFingerprint /> },
      { label: 'Purchase Requests', path: '/admin/purchase', icon: <FaShoppingBag /> },
    ],
    principal: [
      { label: 'Dashboard', path: '/principal', icon: <FaTachometerAlt /> },
      { label: 'Attendance Records', path: '/principal/attendance', icon: <FaCalendarCheck /> },
      { label: 'Departments', path: '/principal/department', icon: <FaBuilding /> },
      { label: 'Leave Requests', path: '/principal/leaves', icon: <FaClipboardList /> },
      { label: 'Salary Overview', path: '/principal/payroll', icon: <FaMoneyBillWave /> },
      { label: 'Conversation', path: '/principal/conversation', icon: <FaComments /> },
      { label: 'Purchase Requests', path: '/principal/purchase', icon: <FaShoppingBag /> },
      { label: 'Academic Calendar', path: '/principal/calendar', icon: <FaCalendarDay /> },
    ],
    hod: [
      { label: 'Dashboard', path: '/hod', icon: <FaTachometerAlt /> },
      { label: 'Leave Management', path: '/hod/leaves', icon: <FaClipboardList /> },
      { label: 'Salary Details', path: '/hod/payroll', icon: <FaMoneyBillWave /> },
      { label: 'Department Staff', path: '/hod/department', icon: <FaBuilding /> },
      { label: 'Timetable', path: '/hod/timetable', icon: <FaCalendarDay /> },
      { label: 'Attendance Record', path: '/hod/attendance', icon: <FaUserGraduate /> },
      { label: 'Conversation', path: '/hod/conversation', icon: <FaComments /> },
      { label: 'Purchase Requests', path: '/hod/purchase', icon: <FaShoppingBag /> },
      { label: 'Academic Calendar', path: '/hod/calendar', icon: <FaCalendarDay /> },
    ],
    staff: [
      { label: 'Dashboard', path: '/staff', icon: <FaTachometerAlt /> },
      { label: 'Leave Management', path: '/staff/leaves', icon: <FaClipboardList /> },
      { label: 'Salary Details', path: '/staff/payroll', icon: <FaMoneyBillWave /> },
      { label: 'Timetable', path: '/staff/timetables', icon: <FaCalendarCheck /> },
      { label: 'Conversation', path: '/staff/conversation', icon: <FaComments /> },
      { label: 'Purchase Requests', path: '/staff/items', icon: <FaShoppingBag /> },
      { label: 'Academic Calendar', path: '/staff/calendar', icon: <FaCalendarDay /> },
    ],
    management: [
      { label: 'Dashboard', path: '/management', icon: <FaTachometerAlt /> },
      { label: 'Departments', path: '/management/departments', icon: <FaBuilding /> },
      { label: 'Salary Overview', path: '/management/payroll', icon: <FaMoneyBillWave /> },
      { label: 'Attendance Records', path: '/management/attendance', icon: <FaCalendarCheck /> },
    ],
  };

  const currentMenuItems = menuItems[userRole] || menuItems.staff;

  const activeClass = "bg-white/70 text-sky-600 shadow-sm backdrop-blur-md transform scale-[1.02] transition-all duration-300 border border-white/50";
  const inactiveClass = "text-gray-500 hover:bg-white/40 hover:text-sky-600 transition-all duration-300";

  const roleName = userRole === 'hod' ? 'Head of Department' : userRole === 'admin' ? 'Administrator' : userRole === 'principal' ? 'Principal' : userRole === 'management' ? 'Management' : 'Staff Member';

  return (
    <div
      className={`fixed left-0 top-0 h-screen w-20 lg:hover:w-72 bg-white/60 backdrop-blur-2xl border-r border-white/50 shadow-2xl transform transition-all duration-500 ease-in-out z-40 flex flex-col group overflow-hidden ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
    >
      {/* Header */}
      <div className="p-4 border-b border-white/40 shrink-0">
        {/* User Role Portal */}
        <div className="mb-4 h-12 flex items-center bg-gradient-to-r from-sky-50 to-blue-50 border border-sky-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="min-w-[80px] flex items-center justify-center text-sky-600 shrink-0">
             <div className="h-2 w-2 rounded-full bg-sky-600 animate-pulse" />
          </div>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap pb-1">
            <p className="text-[7px] font-black text-gray-400 uppercase tracking-widest leading-none mb-0.5">Portal</p>
            <p className="text-[10px] font-bold text-sky-600 uppercase tracking-tight truncate w-48">
              {roleName}
            </p>
          </div>
        </div>
        
        {/* Close button with real-time clock */}
        <div className="flex items-center gap-4 overflow-hidden h-10">
          <div className="min-w-[80px] flex justify-center shrink-0">
             <button
                onClick={onClose}
                className="lg:hidden h-9 w-9 bg-white/50 text-sky-600 hover:bg-white hover:text-sky-800 rounded-xl flex items-center justify-center border border-white/50 shadow-sm transition-all active:scale-90"
                title="Close Menu"
              >
                <FaChevronLeft size={14} />
              </button>
              {/* On desktop narrow, maybe show a small icon or just the LiveStatus when expanded */}
          </div>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <LiveStatus />
          </div>
        </div>
      </div>

      {/* Nav Items */}
      <div className="flex-1 overflow-y-auto no-scrollbar py-4 px-2">
        <nav>
          <ul className="space-y-2">
            {currentMenuItems.map((item) => (
              <li key={item.label}>
                <NavLink
                  to={item.path}
                  end={item.path.split('/').length <= 2}
                  className={({ isActive }) =>
                    `flex items-center h-12 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all duration-300 overflow-hidden ${isActive ? activeClass : inactiveClass}`
                  }
                  onClick={() => onClose()}
                >
                  {({ isActive }) => (
                    <>
                      <div className="min-w-[80px] flex items-center justify-center text-lg shrink-0">
                         <span className={`transition-colors ${isActive ? 'text-sky-600' : 'text-gray-400'}`}>{item.icon}</span>
                      </div>
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
                        {item.label}
                      </span>
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {/* Logout */}
      <div className="p-4 border-t border-white/40 shrink-0">
        <button
          onClick={handleLogout}
          className="w-full h-12 bg-white/50 text-rose-500 hover:bg-rose-600 hover:text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all duration-300 flex items-center overflow-hidden group/logout border border-white/50 shadow-sm"
        >
          <div className="min-w-[80px] flex items-center justify-center shrink-0">
            <FaSignOutAlt className="group-hover/logout:-translate-x-1 transition-transform" />
          </div>
          <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
            Logout Dashboard
          </span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
