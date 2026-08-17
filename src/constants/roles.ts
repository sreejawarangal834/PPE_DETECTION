// 4-tier role model (IMPLEMENTATION_PLAN.md §7.3), replacing the old 5-tier
// admin/safety_officer/site_supervisor/ehs_manager/plant_mgmt set. Old->new mapping (kept here
// for reference, not code — there is no live migration path since the old roles were never
// real accounts, just plaintext seed users in the now-deleted mock authApi.ts):
//   admin -> admin
//   ehs_manager, plant_mgmt -> manager
//   safety_officer, site_supervisor -> operator
//   (viewer is new — no 5-role predecessor)
export const UserRole = {
  ADMIN:    'admin',
  MANAGER:  'manager',
  OPERATOR: 'operator',
  VIEWER:   'viewer',
} as const;

export type UserRole = typeof UserRole[keyof typeof UserRole];

export const ROLE_LABELS: Record<UserRole, string> = {
  admin:    'Administrator',
  manager:  'Manager',
  operator: 'Operator',
  viewer:   'Viewer',
};

export const ROLE_BADGE_COLOR: Record<UserRole, string> = {
  admin:    'bg-severity-high/20 text-severity-high',
  manager:  'bg-status-info/20 text-status-info',
  operator: 'bg-accent/20 text-accent',
  viewer:   'bg-status-ok/20 text-status-ok',
};
