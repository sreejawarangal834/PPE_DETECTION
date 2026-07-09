import { NavLink, Outlet } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import { Shield } from 'lucide-react';

const TABS = [
  { path: ROUTES.ADMIN_SYSTEM_HEALTH, label: 'System Health' },
  { path: ROUTES.ADMIN_USERS,         label: 'Users'         },
  { path: ROUTES.ADMIN_ZONES,         label: 'Zones'         },
  { path: ROUTES.ADMIN_CAMERAS,       label: 'Cameras'       },
  { path: ROUTES.ADMIN_ALERT_CONFIG,  label: 'Alert Config'  },
  { path: ROUTES.ADMIN_AUDIT_LOG,     label: 'Audit Log'     },
];

export default function AdminLayout() {
  return (
    <div className="flex flex-col h-full">
      {/* Admin sub-nav */}
      <div className="flex items-center gap-1 px-6 border-b border-border-soft bg-panel shrink-0">
        <div className="flex items-center gap-2 mr-4 py-3">
          <Shield className="w-4 h-4 text-text-muted" aria-hidden="true" />
          <span className="text-xs font-medium uppercase tracking-wide text-text-muted">Admin Console</span>
        </div>
        {TABS.map(t => (
          <NavLink key={t.path} to={t.path}
            className={({ isActive }) =>
              `px-3 py-3 text-sm font-medium transition-colors border-b-2 -mb-px
               ${isActive
                 ? 'border-accent text-accent'
                 : 'border-transparent text-text-muted hover:text-text-secondary hover:border-border'}`}>
            {t.label}
          </NavLink>
        ))}
      </div>
      <div className="flex-1 overflow-auto bg-bg">
        <Outlet />
      </div>
    </div>
  );
}
