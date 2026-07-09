import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  Monitor, AlertTriangle, HardHat, BarChart2, TrendingUp,
  Settings, User, LogOut, Shield, ChevronLeft, ChevronRight,
  Bell, ChevronDown, PieChart, BookOpen,
} from 'lucide-react';
import { useAuthStore } from '../lib/auth/authStore';
import { useWsStore } from '../lib/websocket/wsStore';
import { useNotificationStore } from '../lib/notifications/notificationStore';
import { useAlertStore } from '../lib/alerts/alertStore';
import { useWebSocket } from '../lib/websocket/useWebSocket';
import { startEscalationInterval, stopEscalationInterval } from '../lib/alerts/alertStore';
import { ROUTE_PERMISSIONS } from '../constants/permissions';
import { ROUTES } from '../constants/routes';
import { ROLE_LABELS, ROLE_BADGE_COLOR } from '../constants/roles';
import { NOTIFICATION_MAX, APP_NAME } from '../constants/app';
import NotificationCenterDrawer from '../components/widgets/NotificationCenterDrawer';
import AlertPopup from '../components/widgets/AlertPopup';
import Tooltip from '../components/ui/Tooltip';

/* ── Nav sections with group labels ─────────────────────── */
const NAV_SECTIONS = [
  {
    label: 'Operations',
    items: [
      { path: ROUTES.MONITORING, label: 'Live Monitoring', Icon: Monitor      },
      { path: ROUTES.ANALYTICS,  label: 'Analytics',       Icon: PieChart     },
      { path: ROUTES.ALERTS,     label: 'Alerts',          Icon: AlertTriangle },
      { path: ROUTES.WORKERS,    label: 'Workers',         Icon: HardHat      },
    ],
  },
  {
    label: 'Insights',
    items: [
      { path: ROUTES.REPORTS, label: 'Reports',     Icon: BarChart2  },
      { path: ROUTES.KPI,     label: 'KPI Summary', Icon: TrendingUp },
    ],
  },
  {
    label: 'System',
    items: [
      { path: ROUTES.ADMIN, label: 'Admin Console', Icon: Settings },
    ],
  },
];

const SIDEBAR_KEY = 'ppe_sidebar_collapsed';

/* ── WS Status Banner ───────────────────────────────────── */
function WsStatusBanner() {
  const status = useWsStore(s => s.status);
  if (status === 'connected') return (
    <div className="flex items-center gap-1.5" role="status" aria-live="polite" aria-label="Live feed connected">
      <span className="w-2 h-2 rounded-full bg-status-ok" aria-hidden="true" />
      <span className="text-xs font-mono text-status-ok">Live</span>
    </div>
  );
  if (status === 'reconnecting') return (
    <div className="flex items-center gap-1.5" role="status" aria-live="polite" aria-label="Reconnecting">
      <span className="w-2 h-2 rounded-full bg-status-warn animate-pulse" aria-hidden="true" />
      <svg className="w-3 h-3 text-status-warn animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
      </svg>
      <span className="text-xs font-mono text-status-warn">Reconnecting…</span>
    </div>
  );
  return (
    <div className="flex items-center gap-1.5" role="status" aria-live="polite" aria-label="Disconnected">
      <span className="w-2 h-2 rounded-full bg-status-danger" aria-hidden="true" />
      <span className="text-xs font-mono text-status-danger">Disconnected</span>
      <button className="text-xs text-accent hover:underline ml-1">Retry</button>
    </div>
  );
}

/* ── Single nav item ────────────────────────────────────── */
function NavItem({ path, label, Icon, collapsed, alertCount }: {
  path: string; label: string; Icon: React.ElementType;
  collapsed: boolean; alertCount?: number;
}) {
  if (collapsed) return (
    <Tooltip content={label}>
      <NavLink to={path}
        className={({ isActive }) =>
          `relative flex items-center justify-center w-10 h-10 mx-auto rounded-xl transition-all duration-200
           ${isActive
             ? 'bg-gradient-to-br from-accent/30 to-accent/10 text-accent shadow-inner border border-accent/20'
             : 'text-text-muted hover:bg-panel-hover hover:text-text-primary'}`
        }>
        <Icon className="w-[18px] h-[18px]" aria-hidden="true" />
        <span className="sr-only">{label}</span>
        {alertCount && alertCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-status-danger text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {alertCount > 9 ? '9+' : alertCount}
          </span>
        )}
      </NavLink>
    </Tooltip>
  );

  return (
    <NavLink to={path}
      className={({ isActive }) =>
        `relative flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-300 group
         ${isActive
           ? 'bg-gradient-to-r from-accent/20 to-accent/5 text-accent border border-accent/15 shadow-lg shadow-accent/10'
           : 'text-text-secondary hover:bg-panel-hover hover:text-text-primary hover:border-accent/20 border border-transparent'}`}>
      {({ isActive }) => (
        <>
          {/* Icon with subtle glow on active */}
          <span className={`shrink-0 transition-all duration-300 group-hover:scale-110 ${isActive ? 'drop-shadow-[0_0_8px_rgba(74,143,163,0.7)]' : ''}`}>
            <Icon className="w-[18px] h-[18px]" aria-hidden="true" />
          </span>
          <span className="truncate font-semibold">{label}</span>
          {/* Active left-accent line */}
          {isActive && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-accent rounded-r-full shadow-lg shadow-accent/50" aria-hidden="true" />
          )}
          {/* Alert count badge */}
          {alertCount && alertCount > 0 && (
            <span className="ml-auto shrink-0 min-w-[22px] h-6 bg-status-danger text-white text-[11px] font-bold rounded-full flex items-center justify-center px-1.5 shadow-lg shadow-status-danger/30 animate-pulse">
              {alertCount > 99 ? '99+' : alertCount}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

/* ── Main Layout ────────────────────────────────────────── */
export default function AppLayout() {
  const { user, logout }  = useAuthStore();
  const openDrawer        = useNotificationStore(s => s.openDrawer);
  const unreadCount       = useNotificationStore(s => s.unreadCount);
  const activeAlertCount  = useAlertStore(s => s.alerts.filter(a => a.status === 'open' || a.status === 'escalated').length);
  const navigate          = useNavigate();
  const location          = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(SIDEBAR_KEY) === 'true'; } catch { return false; }
  });

  function toggleSidebar() {
    setCollapsed(v => {
      const next = !v;
      try { localStorage.setItem(SIDEBAR_KEY, String(next)); } catch { /* noop */ }
      return next;
    });
  }

  useWebSocket();
  useEffect(() => { startEscalationInterval(() => {}); return () => stopEscalationInterval(); }, []);

  useEffect(() => {
    if (!profileOpen) return;
    const h = (e: MouseEvent) => {
      if (!(e.target as Element).closest('[data-profile-menu]')) setProfileOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [profileOpen]);

  function handleLogout() { setLogoutConfirmOpen(true); }
  
  function confirmLogout() {
    logout();
    navigate(ROUTES.LOGIN);
    setLogoutConfirmOpen(false);
  }

  const allowedRoutes = new Set(
    user ? NAV_SECTIONS.flatMap(s => s.items).filter(item => {
      const perms = ROUTE_PERMISSIONS[item.path];
      return !perms || perms.includes(user.role);
    }).map(i => i.path) : []
  );

  const badge    = Math.min(unreadCount, NOTIFICATION_MAX);
  const initials = user?.name?.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase() ?? '?';

  // Compute current page label for header breadcrumb
  const currentRoute = NAV_SECTIONS.flatMap(s => s.items).find(i => location.pathname.startsWith(i.path));

  return (
    <div className="h-screen w-screen flex bg-bg text-text-primary overflow-hidden">

      {/* ── Sidebar ─────────────────────────────────────── */}
      <aside
        className={`${collapsed ? 'w-[72px]' : 'w-[220px]'} shrink-0 flex flex-col transition-all duration-250 no-print`}
        style={{ background: 'linear-gradient(180deg, #1B1F27 0%, #161a20 100%)', borderRight: '1px solid #21252D' }}
        aria-label="Main navigation"
      >
        {/* Logo row */}
        <div className={`h-14 flex items-center shrink-0 px-4 ${collapsed ? 'justify-center' : 'justify-between'}`}
          style={{ borderBottom: '1px solid #21252D' }}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-accent/30 to-accent/10 flex items-center justify-center shrink-0 border border-accent/20">
              <Shield className="w-4 h-4 text-accent" aria-hidden="true" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="text-sm font-bold text-text-primary truncate leading-tight">{APP_NAME}</p>
                <p className="text-[10px] text-text-muted leading-tight truncate">Monitoring System</p>
              </div>
            )}
          </div>
          {!collapsed && (
            <button onClick={toggleSidebar} aria-label="Collapse sidebar"
              className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-panel-hover transition-colors shrink-0">
              <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
          {collapsed && (
            <button onClick={toggleSidebar} aria-label="Expand sidebar"
              className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-panel border border-border rounded-full flex items-center justify-center text-text-muted hover:text-accent hover:border-accent/50 transition-colors shadow-lg z-10">
              <ChevronRight className="w-3 h-3" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Nav sections */}
        <nav className="flex-1 overflow-y-auto py-3" aria-label="Site navigation">
          {NAV_SECTIONS.map(section => {
            const visibleItems = section.items.filter(i => allowedRoutes.has(i.path));
            if (visibleItems.length === 0) return null;
            return (
              <div key={section.label} className={`mb-1 ${collapsed ? 'px-2' : 'px-3'}`}>
                {/* Section label — hidden when collapsed */}
                {!collapsed && (
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted/60 px-3 py-1.5 mb-0.5">
                    {section.label}
                  </p>
                )}
                {collapsed && <div className="w-8 h-px bg-border-soft mx-auto my-2" aria-hidden="true" />}
                <div className={`flex flex-col ${collapsed ? 'items-center gap-1' : 'gap-0.5'}`}>
                  {visibleItems.map(({ path, label, Icon }) => (
                    <NavItem
                      key={path} path={path} label={label} Icon={Icon}
                      collapsed={collapsed}
                      alertCount={path === ROUTES.ALERTS ? activeAlertCount : undefined}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Sidebar footer */}
        <div className={`py-3 ${collapsed ? 'px-2' : 'px-3'}`} style={{ borderTop: '1px solid #21252D' }}>
          {/* User info block — expanded only */}
          {!collapsed && user && (
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-panel-alt border border-border-soft mb-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent/30 to-accent/10 flex items-center justify-center text-sm font-bold text-accent shrink-0 border border-accent/20">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-text-primary truncate">{user.name}</p>
                <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded font-medium mt-0.5 ${ROLE_BADGE_COLOR[user.role]}`}>
                  {ROLE_LABELS[user.role]}
                </span>
              </div>
            </div>
          )}

          {/* Profile & Logout */}
          {collapsed ? (
            <>
              <Tooltip content="Profile">
                <NavLink to={ROUTES.PROFILE}
                  className={({ isActive }) =>
                    `flex items-center justify-center w-10 h-10 mx-auto rounded-xl transition-all duration-200
                     ${isActive ? 'bg-accent/20 text-accent border border-accent/20' : 'text-text-muted hover:bg-panel-hover hover:text-text-primary'}`}>
                  <User className="w-[18px] h-[18px]" aria-hidden="true" />
                  <span className="sr-only">Profile</span>
                </NavLink>
              </Tooltip>
              <Tooltip content="Logout">
                <button onClick={handleLogout} aria-label="Logout"
                  className="flex items-center justify-center w-10 h-10 mx-auto rounded-xl mt-1 text-text-muted hover:bg-status-danger/15 hover:text-status-danger transition-all duration-200">
                  <LogOut className="w-[18px] h-[18px]" aria-hidden="true" />
                </button>
              </Tooltip>
            </>
          ) : (
            <div className="flex flex-col gap-0.5">
              <NavLink to={ROUTES.PROFILE}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200
                   ${isActive ? 'bg-accent/15 text-accent border border-accent/15' : 'text-text-secondary hover:bg-panel-hover hover:text-text-primary'}`}>
                <User className="w-[18px] h-[18px] shrink-0" aria-hidden="true" />
                <span className="font-medium">Profile</span>
              </NavLink>
              <NavLink to={ROUTES.HELP}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200
                   ${isActive ? 'bg-accent/15 text-accent border border-accent/15' : 'text-text-secondary hover:bg-panel-hover hover:text-text-primary'}`}>
                <BookOpen className="w-[18px] h-[18px] shrink-0" aria-hidden="true" />
                <span className="font-medium">Help</span>
              </NavLink>
              <button onClick={handleLogout} aria-label="Logout"
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-text-secondary hover:bg-status-danger/10 hover:text-status-danger transition-all duration-200 mt-0.5">
                <LogOut className="w-[18px] h-[18px] shrink-0" aria-hidden="true" />
                <span className="font-medium">Logout</span>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <header className="h-14 shrink-0 bg-panel border-b border-border-soft flex items-center px-6 gap-4 no-print">
          {/* Breadcrumb */}
          {currentRoute && (
            <div className="flex items-center gap-2 text-text-muted mr-2">
              <currentRoute.Icon className="w-4 h-4" aria-hidden="true" />
              <span className="text-sm text-text-secondary font-medium">{currentRoute.label}</span>
            </div>
          )}
          <div className="flex-1" />
          <WsStatusBanner />
          <div className="w-px h-5 bg-border-soft" aria-hidden="true" />

          {/* Notification bell */}
          <Tooltip content="Notifications">
            <button onClick={openDrawer}
              aria-label={`Notifications — ${badge} unread`}
              className="relative p-2 rounded-md text-text-muted hover:text-text-primary hover:bg-panel-hover transition-colors duration-200">
              <Bell className="w-5 h-5" aria-hidden="true" />
              {badge > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-status-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </button>
          </Tooltip>

          {/* Avatar dropdown */}
          <div className="relative" data-profile-menu>
            <button onClick={() => setProfileOpen(v => !v)} aria-label="User menu"
              aria-expanded={profileOpen} aria-haspopup="menu"
              className="flex items-center gap-2.5 pl-2 pr-1 py-1.5 rounded-md hover:bg-panel-hover transition-colors duration-200">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent/30 to-accent/10 border border-accent/20 flex items-center justify-center text-sm font-bold text-accent select-none">
                {initials}
              </div>
              <div className="text-left hidden lg:block leading-tight">
                <p className="text-sm font-medium text-text-primary">{user?.name}</p>
                <p className="text-xs text-text-muted">{user ? ROLE_LABELS[user.role] : ''}</p>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-text-muted transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>

            {profileOpen && (
              <div role="menu"
                className="absolute right-0 top-[calc(100%+6px)] bg-panel border border-border rounded-xl shadow-2xl py-1.5 z-50 min-w-[180px]">
                <div className="px-4 py-2.5 border-b border-border-soft mb-1">
                  <p className="text-sm font-semibold text-text-primary">{user?.name}</p>
                  <p className="text-xs text-text-muted">{user ? ROLE_LABELS[user.role] : ''}</p>
                </div>
                <NavLink to={ROUTES.PROFILE} role="menuitem" onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-sm text-text-secondary hover:bg-panel-hover hover:text-text-primary transition-colors">
                  <User className="w-4 h-4" aria-hidden="true" /> My Profile
                </NavLink>
                <NavLink to={ROUTES.HELP} role="menuitem" onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-sm text-text-secondary hover:bg-panel-hover hover:text-text-primary transition-colors">
                  <BookOpen className="w-4 h-4" aria-hidden="true" /> Help
                </NavLink>
                <div className="my-1 mx-3 h-px bg-border-soft" role="separator" />
                <button role="menuitem" onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-status-danger hover:bg-panel-hover transition-colors">
                  <LogOut className="w-4 h-4" aria-hidden="true" /> Logout
                </button>
              </div>
            )}
          </div>
        </header>

        <main id="main-content" className="flex-1 overflow-auto bg-bg">
          <Outlet />
        </main>
      </div>

      <NotificationCenterDrawer />
      <AlertPopup />
      
      {/* Logout Confirmation Dialog */}
      {logoutConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="bg-[#1B1F27] border border-[#21252D] rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold text-[#E8EAF0] mb-2">Confirm Logout</h3>
            <p className="text-base text-[#9BA3B8] mb-6">Are you sure you want to log out? You will need to sign in again to access the system.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setLogoutConfirmOpen(false)}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-[#9BA3B8] bg-[#20242D] hover:bg-[#252A35] border border-[#262B34] transition-all duration-200"
              >
                Cancel
              </button>
              <button
                onClick={confirmLogout}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-status-danger hover:bg-status-danger/90 shadow-lg shadow-status-danger/20 transition-all duration-200"
              >
                Yes, Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
