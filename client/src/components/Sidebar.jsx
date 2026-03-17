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
      className={`fixed left-0 top-0 h-screen w-20 bg-white/60 backdrop-blur-2xl border-r border-white/50 shadow-2xl z-40 flex flex-col overflow-hidden transition-transform duration-300 ease-in-out lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
    >
      {/* Header */}
      <div className="p-4 border-b border-white/40 shrink-0">
        {/* User Role Portal */}
        <div className="flex flex-col items-center justify-center bg-gradient-to-br from-sky-50 to-blue-50 border border-sky-100 rounded-xl shadow-sm py-2">
          <div className="h-1.5 w-1.5 rounded-full bg-sky-600 animate-pulse mb-1" />
          <p className="text-[7.5px] font-black text-sky-600 uppercase tracking-tighter text-center leading-none">
            {userRole.substring(0, 5)}
          </p>
        </div>
        
        {/* Close button with real-time clock */}
        <div className="flex flex-col items-center gap-2">
           <button
              onClick={onClose}
              className="lg:hidden h-8 w-8 bg-white/50 text-sky-600 hover:bg-white hover:text-sky-800 rounded-lg flex items-center justify-center border border-white/50 shadow-sm transition-all active:scale-90"
              title="Close Menu"
            >
              <FaChevronLeft size={12} />
            </button>
            <div className="scale-[0.8] origin-center -ml-0.5">
              <LiveStatus />
            </div>
        </div>
      </div>

      {/* Nav Items */}
      <div className="flex-1 overflow-y-auto no-scrollbar py-2 px-1">
        <nav>
          <ul className="space-y-3">
            {currentMenuItems.map((item) => (
              <li key={item.label}>
                <NavLink
                  to={item.path}
                  end={item.path.split('/').length <= 2}
                  className={({ isActive }) =>
                    `flex flex-col items-center justify-center py-2 rounded-xl transition-all duration-300 ${isActive ? activeClass : inactiveClass}`
                  }
                  onClick={() => onClose()}
                >
                  {({ isActive }) => (
                    <>
                      <span className={`text-xl mb-1 transition-colors ${isActive ? 'text-sky-600' : 'text-gray-400'}`}>{item.icon}</span>
                      <span className="text-[7px] font-bold uppercase tracking-tighter text-center leading-[1.1] px-1 line-clamp-2">
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
      <div className="p-2 border-t border-white/40 shrink-0">
        <button
          onClick={handleLogout}
          className="w-full flex flex-col items-center justify-center py-2 bg-white/50 text-rose-500 hover:bg-rose-600 hover:text-white rounded-xl transition-all duration-300 border border-white/50 shadow-sm"
          title="Logout"
        >
          <FaSignOutAlt className="text-lg mb-1" />
          <span className="text-[7px] font-black uppercase">Out</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
