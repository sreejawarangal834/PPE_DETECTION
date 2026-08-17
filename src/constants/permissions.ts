import type { UserRole } from './roles';
import { ROUTES } from './routes';

// Route-level access (IMPLEMENTATION_PLAN.md §7.3). "read" in the plan's table means the
// route itself is reachable — manager/viewer can VIEW Monitoring/Analytics/Alerts/Workers,
// they just can't acknowledge/resolve alerts once there (see CAPABILITIES below, and
// SCHEMA_DEEP_DIVE.md §2's point that permissions aren't a clean rank hierarchy across the 4
// roles: operator can acknowledge/resolve alerts, manager — which outranks operator on
// Reports — cannot). This route-level map is UX only; backend/auth/dependencies.py's
// require_role() on each mutating endpoint is the actual security boundary.
export const ROUTE_PERMISSIONS: Record<string, UserRole[]> = {
  [ROUTES.MONITORING]:          ['admin', 'manager', 'operator', 'viewer'],
  [ROUTES.ANALYTICS]:           ['admin', 'manager', 'operator', 'viewer'],
  [ROUTES.ALERTS]:              ['admin', 'manager', 'operator', 'viewer'],
  [ROUTES.WORKERS]:             ['admin', 'manager', 'operator', 'viewer'],
  [ROUTES.REPORTS]:             ['admin', 'manager', 'viewer'],
  [ROUTES.REPORTS_ANALYTICS]:   ['admin', 'manager', 'viewer'],
  [ROUTES.KPI]:                 ['admin', 'manager', 'viewer'],
  [ROUTES.ADMIN]:               ['admin'],
  [ROUTES.ADMIN_USERS]:         ['admin'],
  [ROUTES.ADMIN_ZONES]:         ['admin'],
  [ROUTES.ADMIN_CAMERAS]:       ['admin'],
  [ROUTES.ADMIN_ALERT_CONFIG]:  ['admin'],
  [ROUTES.ADMIN_AUDIT_LOG]:     ['admin'],
};

export const ROLE_LANDING: Record<UserRole, string> = {
  admin:    ROUTES.ADMIN_USERS,
  manager:  ROUTES.REPORTS,
  operator: ROUTES.MONITORING,
  viewer:   ROUTES.MONITORING,
};

export function canAccess(role: UserRole, path: string): boolean {
  const allowed = ROUTE_PERMISSIONS[path];
  if (!allowed) return true; // public or profile routes
  return allowed.includes(role);
}

// In-page capability checks (SCHEMA_DEEP_DIVE.md §2 — "not a clean hierarchy... use an
// explicit capability-set map per role"). The server independently re-checks every one of
// these via require_role() (backend/main.py) — this map only drives what the UI shows/hides;
// it grants nothing by itself.
export const CAPABILITIES = {
  acknowledgeAlerts: ['admin', 'operator'],
  resolveAlerts:      ['admin', 'operator'],
  manageAdmin:        ['admin'],
} as const satisfies Record<string, UserRole[]>;

export function hasCapability(role: UserRole, capability: keyof typeof CAPABILITIES): boolean {
  return (CAPABILITIES[capability] as readonly UserRole[]).includes(role);
}
