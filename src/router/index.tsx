import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import AppLayout from '../components/layout/AppLayout';
import RoleGuard from './RoleGuard';

// Lazy-load all pages for code splitting
const LoginPage = lazy(() => import('../pages/LoginPage'));
const DashboardPage = lazy(() => import('../pages/DashboardPage'));
const AlertsPage = lazy(() => import('../pages/AlertsPage'));
const MarketConfigPage = lazy(() => import('../pages/MarketConfigPage'));
const UsersPage = lazy(() => import('../pages/UsersPage'));
const AdminPage = lazy(() => import('../pages/AdminPage'));
const NotFoundPage = lazy(() => import('../pages/NotFoundPage'));

function PageLoader() {
  return (
    <Box display="flex" justifyContent="center" alignItems="center" minHeight="40vh">
      <CircularProgress />
    </Box>
  );
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
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
                  <Suspense fallback={<PageLoader />}>
                    <DashboardPage />
                  </Suspense>
                </RoleGuard>
              }
            />
            <Route
              path="/alerts"
              element={
                <RoleGuard allowedRoles={['AlertHandler', 'AlertHandler_supervisor', 'admin']}>
                  <Suspense fallback={<PageLoader />}>
                    <AlertsPage />
                  </Suspense>
                </RoleGuard>
              }
            />
            <Route
              path="/markets"
              element={
                <RoleGuard allowedRoles={['admin']}>
                  <Suspense fallback={<PageLoader />}>
                    <MarketConfigPage />
                  </Suspense>
                </RoleGuard>
              }
            />
            <Route
              path="/users"
              element={
                <RoleGuard allowedRoles={['AlertHandler_supervisor', 'admin']}>
                  <Suspense fallback={<PageLoader />}>
                    <UsersPage />
                  </Suspense>
                </RoleGuard>
              }
            />
            <Route
              path="/admin"
              element={
                <RoleGuard allowedRoles={['admin']}>
                  <Suspense fallback={<PageLoader />}>
                    <AdminPage />
                  </Suspense>
                </RoleGuard>
              }
            />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
