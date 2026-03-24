import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import RoleGuard from './RoleGuard';
import LoginPage from '../pages/LoginPage';
import DashboardPage from '../pages/DashboardPage';
import AlertsPage from '../pages/AlertsPage';
import MarketConfigPage from '../pages/MarketConfigPage';
import UsersPage from '../pages/UsersPage';
import AdminPage from '../pages/AdminPage';
import NotFoundPage from '../pages/NotFoundPage';

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          element={
            <RoleGuard allowedRoles={['AlertHandler', 'AlertHandler_supervisor', 'admin']}>
              <AppLayout />
            </RoleGuard>
          }
        >
          <Route
            path="/"
            element={
              <RoleGuard allowedRoles={['AlertHandler', 'AlertHandler_supervisor', 'admin']}>
                <DashboardPage />
              </RoleGuard>
            }
          />
          <Route
            path="/alerts"
            element={
              <RoleGuard allowedRoles={['AlertHandler', 'AlertHandler_supervisor', 'admin']}>
                <AlertsPage />
              </RoleGuard>
            }
          />
          <Route
            path="/markets"
            element={
              <RoleGuard allowedRoles={['admin']}>
                <MarketConfigPage />
              </RoleGuard>
            }
          />
          <Route
            path="/users"
            element={
              <RoleGuard allowedRoles={['AlertHandler_supervisor', 'admin']}>
                <UsersPage />
              </RoleGuard>
            }
          />
          <Route
            path="/admin"
            element={
              <RoleGuard allowedRoles={['admin']}>
                <AdminPage />
              </RoleGuard>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
