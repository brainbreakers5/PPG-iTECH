import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import Splash from './pages/Splash';
import Login from './pages/Login';

// Principal Pages
import PrincipalDashboard from './pages/principal/Dashboard';
import PrincipalLeaves from './pages/principal/LeaveRequests';
import PrincipalDepartment from './pages/principal/Department';
import PrincipalCalendar from './pages/principal/Calendar';
import PrincipalAttendance from './pages/principal/AttendanceRecord';
import PrincipalConversation from './pages/principal/Conversation';
import PrincipalPurchase from './pages/principal/Purchase';
import InstitutionalCalendar from './pages/shared/InstitutionalCalendar';

// HOD Pages
import HODDepartment from './pages/hod/Department';
import HODTimetable from './pages/hod/Timetable';
import HODDashboard from './pages/hod/HODDashboard';

// Staff Pages
import StaffLeaveApply from './pages/staff/LeaveApply';
import StaffDashboard from './pages/staff/StaffDashboard';
import StaffTimetable from './pages/staff/StaffTimetable';

// Admin Pages
import EmployeeManagement from './pages/admin/EmployeeManagement';
import DepartmentManagement from './pages/admin/DepartmentManagement';
import SalaryManagement from './pages/admin/SalaryManagement';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminPurchase from './pages/admin/AdminPurchase';
import AdminCalendar from './pages/admin/AdminCalendar';
import LeaveLimitation from './pages/admin/LeaveLimitation';
import TimetableSetup from './pages/admin/TimetableSetup';

// Shared Pages
import ProfilePage from './pages/shared/ProfilePage';
import PersonnelListPage from './pages/shared/PersonnelListPage';
import DepartmentStaffPage from './pages/shared/DepartmentStaffPage';
import DetailedAttendancePage from './pages/shared/DetailedAttendancePage';
import EmployeeFormPage from './pages/admin/EmployeeFormPage';
import DepartmentFormPage from './pages/admin/DepartmentFormPage';
import PurchaseRequestPage from './pages/shared/PurchaseRequestPage';

// Management Pages
import ManagementDashboard from './pages/management/ManagementDashboard';
import ManagementDepartment from './pages/management/ManagementDepartment';
import ManagementSalary from './pages/management/ManagementSalary';

// Placeholder Dashboards
// const AdminDashboard = () => <div className="p-10">Admin Dashboard (Coming Soon)</div>;
// const StaffDashboard = () => <div className="p-10">Staff Dashboard (Coming Soon)</div>;

// Protected Route Wrapper
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" />;

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/login" />; // Or unauthorized page
  }

  return children;
};

// Management Route Wrapper (PIN-based access via sessionStorage)
const ManagementRoute = ({ children }) => {
  const hasAccess = sessionStorage.getItem('managementAccess') === 'true';
  if (!hasAccess) return <Navigate to="/login" />;
  return children;
};

const AppContent = () => {
  const [showSplash, setShowSplash] = useState(true);

  if (showSplash) {
    return <Splash onFinish={() => setShowSplash(false)} />;
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route path="/admin/*" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <Routes>
            <Route path="/" element={<AdminDashboard />} />
            <Route path="employees" element={<EmployeeManagement />} />
            <Route path="employees/new" element={<EmployeeFormPage />} />
            <Route path="employees/edit/:id" element={<EmployeeFormPage />} />
            <Route path="departments" element={<DepartmentManagement />} />
            <Route path="departments/new" element={<DepartmentFormPage />} />
            <Route path="departments/edit/:id" element={<DepartmentFormPage />} />
            <Route path="departments/:id/staff" element={<DepartmentStaffPage />} />
            <Route path="payroll" element={<SalaryManagement />} />
            <Route path="purchase" element={<AdminPurchase />} />
            <Route path="purchase/new" element={<PurchaseRequestPage />} />
            <Route path="attendance" element={<PrincipalAttendance />} />
            <Route path="attendance/:empId/:month" element={<DetailedAttendancePage />} />
            <Route path="attendance/:empId/:startDate/:endDate" element={<DetailedAttendancePage />} />
            <Route path="calendar" element={<AdminCalendar />} />
            <Route path="timetable" element={<HODTimetable />} />
            <Route path="timetable/:empId" element={<HODTimetable />} />
            <Route path="leave-limits" element={<LeaveLimitation />} />
            <Route path="timetable-setup" element={<TimetableSetup />} />
            <Route path="profile/:id" element={<ProfilePage />} />
            <Route path="personnel/:role" element={<PersonnelListPage />} />
          </Routes>
        </ProtectedRoute>
      } />

      <Route path="/principal/*" element={
        <ProtectedRoute allowedRoles={['principal']}>
          <Routes>
            <Route path="/" element={<PrincipalDashboard />} />
            <Route path="leaves" element={<PrincipalLeaves />} />
            <Route path="payroll" element={<SalaryManagement />} />
            <Route path="department" element={<PrincipalDepartment />} />
            <Route path="departments/:id/staff" element={<DepartmentStaffPage rolePrefix="principal" />} />
            <Route path="calendar" element={<InstitutionalCalendar />} />
            <Route path="attendance" element={<PrincipalAttendance />} />
            <Route path="attendance/:empId/:month" element={<DetailedAttendancePage />} />
            <Route path="attendance/:empId/:startDate/:endDate" element={<DetailedAttendancePage />} />
            <Route path="conversation" element={<PrincipalConversation />} />
            <Route path="purchase" element={<PrincipalPurchase />} />
            <Route path="purchase/new" element={<PurchaseRequestPage />} />
            <Route path="timetable" element={<HODTimetable />} />
            <Route path="timetable/:empId" element={<HODTimetable />} />
            <Route path="profile/:id" element={<ProfilePage />} />
            <Route path="personnel/:role" element={<PersonnelListPage />} />
          </Routes>
        </ProtectedRoute>
      } />

      <Route path="/hod/*" element={
        <ProtectedRoute allowedRoles={['hod']}>
          <Routes>
            <Route path="/" element={<HODDashboard />} />
            <Route path="leaves" element={<StaffLeaveApply />} />
            <Route path="payroll" element={<SalaryManagement />} />
            <Route path="department" element={<HODDepartment />} />
            <Route path="timetable" element={<HODTimetable />} />
            <Route path="timetable/:empId" element={<HODTimetable />} />
            <Route path="attendance" element={<PrincipalAttendance />} />
            <Route path="attendance/:empId/:month" element={<DetailedAttendancePage />} />
            <Route path="attendance/:empId/:startDate/:endDate" element={<DetailedAttendancePage />} />
            <Route path="conversation" element={<PrincipalConversation />} />
            <Route path="purchase" element={<PrincipalPurchase />} />
            <Route path="purchase/new" element={<PurchaseRequestPage />} />
            <Route path="calendar" element={<InstitutionalCalendar />} />
            <Route path="profile/:id" element={<ProfilePage />} />
            <Route path="personnel/:role" element={<PersonnelListPage />} />
          </Routes>
        </ProtectedRoute>
      } />

      <Route path="/staff/*" element={
        <ProtectedRoute allowedRoles={['staff']}>
          <Routes>
            <Route path="/" element={<StaffDashboard />} />
            <Route path="leaves" element={<StaffLeaveApply />} />
            <Route path="payroll" element={<SalaryManagement />} />
            <Route path="items" element={<PrincipalPurchase />} />
            <Route path="purchase/new" element={<PurchaseRequestPage />} />
            <Route path="conversation" element={<PrincipalConversation />} />
            <Route path="timetables" element={<StaffTimetable />} />
            <Route path="timetables/:empId" element={<StaffTimetable />} />
            <Route path="calendar" element={<InstitutionalCalendar />} />
            <Route path="profile/:id" element={<ProfilePage />} />
          </Routes>
        </ProtectedRoute>
      } />

      <Route path="/management/*" element={
        <ManagementRoute>
          <Routes>
            <Route path="/" element={<ManagementDashboard />} />
            <Route path="departments" element={<ManagementDepartment />} />
            <Route path="departments/:id/staff" element={<DepartmentStaffPage rolePrefix="management" />} />
            <Route path="payroll" element={<ManagementSalary />} />
            <Route path="profile/:id" element={<ProfilePage />} />
          </Routes>
        </ManagementRoute>
      } />

      <Route path="/" element={<Navigate to="/login" />} />
    </Routes>
  );
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <SocketProvider>
          <AppContent />
        </SocketProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
