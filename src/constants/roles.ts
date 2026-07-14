export const UserRole = {
  ADMIN:           'admin',
  SAFETY_OFFICER:  'safety_officer',
  SITE_SUPERVISOR: 'site_supervisor',
  EHS_MANAGER:     'ehs_manager',
  PLANT_MGMT:      'plant_mgmt',
} as const;

export type UserRole = typeof UserRole[keyof typeof UserRole];

export const ROLE_LABELS: Record<UserRole, string> = {
  admin:           'System Administrator',
  safety_officer:  'Safety Officer',
  site_supervisor: 'Site Supervisor',
  ehs_manager:     'EHS Manager',
  plant_mgmt:      'Plant Management',
};

export const ROLE_BADGE_COLOR: Record<UserRole, string> = {
  admin:           'bg-severity-high/20 text-severity-high',
  safety_officer:  'bg-accent/20 text-accent',
  site_supervisor: 'bg-status-warn/20 text-status-warn',
  ehs_manager:     'bg-status-ok/20 text-status-ok',
  plant_mgmt:      'bg-status-info/20 text-status-info',
};
