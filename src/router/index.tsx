import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import AppLayout from '../layouts/AppLayout';
import AuthLayout from '../layouts/AuthLayout';
import ProtectedRoute from './ProtectedRoute';
import RoleGuard from './RoleGuard';
import LoadingSkeleton from '../components/ui/LoadingSkeleton';

function wrap(factory: () => Promise<{ default: React.ComponentType }>) {
  const Comp = lazy(factory);
  return (
    <Suspense fallback={<div className="p-8"><LoadingSkeleton variant="table" /></div>}>
      <Comp />
    </Suspense>
  );
}

const MON   = ['admin','safety_officer','site_supervisor','ehs_manager'] as const;
const RPT   = ['admin','ehs_manager','plant_mgmt'] as const;
const ADMIN = ['admin'] as const;

export const router = createBrowserRouter([
  // ── Public auth routes ──────────────────────────────────────────────────────
  {
    path: '/login',
    element: <AuthLayout>{wrap(() => import('../features/auth/LoginPage'))}</AuthLayout>,
  },
  {
    path: '/forgot-password',
    element: <AuthLayout>{wrap(() => import('../features/auth/ForgotPasswordPage'))}</AuthLayout>,
  },
  {
    path: '/reset-password',
    element: <AuthLayout>{wrap(() => import('../features/auth/ResetPasswordPage'))}</AuthLayout>,
  },

  // ── Protected app shell ────────────────────────────────────────────────────
  {
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/monitoring" replace /> },
      { path: '/',   element: <Navigate to="/monitoring" replace /> },

      { path: '/profile',   element: wrap(() => import('../features/auth/ProfilePage')) },
      { path: '/help',      element: wrap(() => import('../pages/HelpPage')) },
      { path: '/forbidden', element: wrap(() => import('../pages/ForbiddenPage')) },

      // Live monitoring
      {
        path: '/monitoring',
        element: <RoleGuard allowedRoles={[...MON]}>{wrap(() => import('../features/monitoring/MonitoringPage'))}</RoleGuard>,
      },

      // Analytics
      {
        path: '/analytics',
        element: <RoleGuard allowedRoles={[...MON]}>{wrap(() => import('../features/monitoring/AnalyticsPage'))}</RoleGuard>,
      },

      // Alerts
      {
        path: '/alerts',
        element: <RoleGuard allowedRoles={[...MON]}>{wrap(() => import('../features/alerts/AlertsPage'))}</RoleGuard>,
      },

      // Workers
      {
        path: '/workers',
        element: <RoleGuard allowedRoles={[...MON]}>{wrap(() => import('../features/workers/WorkerListPage'))}</RoleGuard>,
      },
      {
        path: '/workers/:workerId',
        element: <RoleGuard allowedRoles={[...MON]}>{wrap(() => import('../features/workers/WorkerProfilePage'))}</RoleGuard>,
      },

      // Reports
      {
        path: '/reports',
        element: <RoleGuard allowedRoles={[...RPT]}>{wrap(() => import('../features/reports/ReportsPage'))}</RoleGuard>,
      },
      {
        path: '/reports/analytics',
        element: <RoleGuard allowedRoles={[...RPT]}>{wrap(() => import('../features/reports/AdHocAnalytics'))}</RoleGuard>,
      },
      {
        path: '/kpi',
        element: <RoleGuard allowedRoles={[...RPT]}>{wrap(() => import('../features/reports/KpiSummaryPage'))}</RoleGuard>,
      },

      // Admin — nested under AdminLayout
      {
        path: '/admin',
        element: (
          <RoleGuard allowedRoles={[...ADMIN]}>
            {wrap(() => import('../features/admin/AdminLayout'))}
          </RoleGuard>
        ),
        children: [
          { index: true,          element: <Navigate to="/admin/users" replace /> },
          { path: 'users',        element: wrap(() => import('../features/admin/UserManagementPage'))  },
          { path: 'zones',        element: wrap(() => import('../features/admin/ZoneConfigPage'))      },
          { path: 'cameras',      element: wrap(() => import('../features/admin/CameraManagementPage'))},
          { path: 'alert-config', element: wrap(() => import('../features/admin/AlertConfigPage'))     },
          { path: 'audit-log',    element: wrap(() => import('../features/admin/AuditLogPage'))        },
        ],
      },
    ],
  },

  // ── 404 ────────────────────────────────────────────────────────────────────
  { path: '*', element: wrap(() => import('../pages/NotFoundPage')) },
]);
