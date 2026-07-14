import { NavLink, Outlet } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';

// System Health removed per requirements — start directly with Users
const TABS = [
  { path: ROUTES.ADMIN_USERS,        label: 'Users'        },
  { path: ROUTES.ADMIN_ZONES,        label: 'Zones'        },
  { path: ROUTES.ADMIN_CAMERAS,      label: 'Cameras'      },
  { path: ROUTES.ADMIN_ALERT_CONFIG, label: 'Alert Config' },
  { path: ROUTES.ADMIN_AUDIT_LOG,    label: 'Audit Log'    },
];

export default function AdminLayout() {
  return (
    <div className="flex flex-col h-full">

      {/* Page title + tab nav — combined into one bar */}
      <div className="shrink-0 bg-panel border-b border-border-soft">

        {/* Main heading */}
        <div className="px-6 pt-5 pb-0">
          <h1 className="text-3xl font-bold text-text-primary tracking-tight leading-none">
            Admin Console
          </h1>
          <p className="text-sm text-text-muted mt-1.5 mb-0">
            Manage users, zones, cameras, alert thresholds, and audit logs
          </p>
        </div>

        {/* Section tabs — start at left edge of content, no redundant label */}
        <div className="flex items-center gap-0 px-6 mt-4">
          {TABS.map(t => (
            <NavLink
              key={t.path}
              to={t.path}
              className={({ isActive }) =>
                `px-4 py-3 text-base font-semibold transition-all duration-200 border-b-2 -mb-px whitespace-nowrap
                 ${isActive
                   ? 'border-accent text-accent'
                   : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border'}`
              }
            >
              {t.label}
            </NavLink>
          ))}
        </div>
      </div>

      {/* Page content — scrollable */}
      <div className="flex-1 overflow-auto bg-bg">
        <Outlet />
      </div>
    </div>
  );
}
