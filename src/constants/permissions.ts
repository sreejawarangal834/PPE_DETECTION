import type { UserRole } from './roles';
import { ROUTES } from './routes';

export const ROUTE_PERMISSIONS: Record<string, UserRole[]> = {
  [ROUTES.MONITORING]:          ['admin', 'safety_officer', 'site_supervisor', 'ehs_manager'],
  [ROUTES.ANALYTICS]:           ['admin', 'safety_officer', 'site_supervisor', 'ehs_manager'],
  [ROUTES.ALERTS]:              ['admin', 'safety_officer', 'site_supervisor', 'ehs_manager'],
  [ROUTES.WORKERS]:             ['admin', 'safety_officer', 'site_supervisor', 'ehs_manager'],
  [ROUTES.REPORTS]:             ['admin', 'ehs_manager', 'plant_mgmt'],
  [ROUTES.REPORTS_ANALYTICS]:   ['admin', 'ehs_manager', 'plant_mgmt'],
  [ROUTES.KPI]:                 ['admin', 'ehs_manager', 'plant_mgmt'],
  [ROUTES.ADMIN]:               ['admin'],
  [ROUTES.ADMIN_USERS]:         ['admin'],
  [ROUTES.ADMIN_ZONES]:         ['admin'],
  [ROUTES.ADMIN_CAMERAS]:       ['admin'],
  [ROUTES.ADMIN_ALERT_CONFIG]:  ['admin'],
  [ROUTES.ADMIN_SYSTEM_HEALTH]: ['admin'],
  [ROUTES.ADMIN_AUDIT_LOG]:     ['admin'],
};

export const ROLE_LANDING: Record<UserRole, string> = {
  admin:           ROUTES.ADMIN_SYSTEM_HEALTH,
  safety_officer:  ROUTES.MONITORING,
  site_supervisor: ROUTES.MONITORING,
  ehs_manager:     ROUTES.REPORTS,
  plant_mgmt:      ROUTES.KPI,
};

export function canAccess(role: UserRole, path: string): boolean {
  const allowed = ROUTE_PERMISSIONS[path];
  if (!allowed) return true; // public or profile routes
  return allowed.includes(role);
}
