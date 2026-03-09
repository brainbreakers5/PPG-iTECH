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
} from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';

const Sidebar = ({ userRole = 'staff', isOpen, onClose }) => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = () => {
    const isManagementMode = userRole === 'management';
    sessionStorage.removeItem('managementAccess');
    if (isManagementMode) {
      localStorage.removeItem('token');
      navigate('/login');
    } else {
      logout();
      navigate('/login');
    }
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
      { label: 'Calendar', path: '/admin/calendar', icon: <FaCalendarDay /> },
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
    ],
  };

  const currentMenuItems = menuItems[userRole] || menuItems.staff;

  const activeClass = "bg-white/70 text-sky-600 shadow-sm backdrop-blur-md transform scale-[1.02] transition-all duration-300 border border-white/50";
  const inactiveClass = "text-gray-500 hover:bg-white/40 hover:text-sky-600 transition-all duration-300";

  return (
    <div
      className={`fixed left-0 top-0 h-screen w-64 bg-white/60 backdrop-blur-2xl border-r border-white/50 shadow-2xl transform transition-all duration-300 ease-in-out z-40 flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
    >
      {/* Header */}
      <div className="p-6 border-b border-white/40 shrink-0">
        {/* User Role Portal */}
        <div className="mb-4 px-4 py-3 bg-gradient-to-r from-sky-50 to-blue-50 border border-sky-100 rounded-2xl shadow-sm">
          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Portal</p>
          <p className="text-sm font-black text-sky-600 uppercase tracking-wide">
            {userRole === 'hod' ? 'Head of Department' : userRole === 'admin' ? 'Administrator' : userRole === 'principal' ? 'Principal' : userRole === 'management' ? 'Management' : 'Staff Member'}
          </p>
        </div>
        
        {/* Close button with real-time clock */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <p className="text-[8px] font-black uppercase tracking-wider text-sky-600 flex items-center gap-1">
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {now.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })}
            </p>
            <p className="text-sm font-black text-gray-800 tracking-wide flex items-center gap-1">
              <svg className="w-3 h-3 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
            </p>
          </div>
          <button
            onClick={onClose}
            className="h-9 w-9 bg-white/50 text-sky-600 hover:bg-white hover:text-sky-800 rounded-xl flex items-center justify-center border border-white/50 shadow-sm transition-all active:scale-90"
            title="Close Menu"
          >
            <FaChevronLeft size={14} />
          </button>
        </div>
      </div>

      {/* Nav Items */}
      <div className="flex-1 overflow-y-auto no-scrollbar py-4">
        <nav className="px-4">
          <ul className="space-y-1">
            {currentMenuItems.map((item) => (
              <li key={item.label}>
                <NavLink
                  to={item.path}
                  end={item.path.split('/').length <= 2}
                  className={({ isActive }) =>
                    `flex items-center gap-4 px-5 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest ${isActive ? activeClass : inactiveClass}`
                  }
                  onClick={() => onClose()}
                >
                  {({ isActive }) => (
                    <>
                      <span className={`text-lg transition-colors ${isActive ? 'text-sky-600' : 'text-gray-400'}`}>{item.icon}</span>
                      <span>{item.label}</span>
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {/* Logout */}
      <div className="p-5 border-t border-white/40 shrink-0">
        <button
          onClick={handleLogout}
          className="w-full px-5 py-4 bg-white/50 text-rose-500 hover:bg-rose-600 hover:text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-3 group border border-white/50 shadow-sm"
        >
          <FaSignOutAlt className="group-hover:-translate-x-1 transition-transform" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
