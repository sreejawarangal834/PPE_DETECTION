import { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  Monitor, AlertTriangle, HardHat, BarChart2, TrendingUp,
  Settings, User, LogOut, Shield, ChevronLeft, ChevronRight,
  Bell, ChevronDown, PieChart, BookOpen,
} from 'lucide-react';
import { useAuthStore } from '../lib/auth/authStore';
import { useWsStore } from '../lib/websocket/wsStore';
import { useNotificationStore } from '../lib/notifications/notificationStore';
import { useAlertStore, startAlertLiveFeed, stopAlertLiveFeed } from '../lib/alerts/alertStore';
import { ROUTE_PERMISSIONS } from '../constants/permissions';
import { ROUTES } from '../constants/routes';
import { ROLE_LABELS, ROLE_BADGE_COLOR } from '../constants/roles';
import { NOTIFICATION_MAX, APP_NAME } from '../constants/app';
import NotificationCenterDrawer from '../components/widgets/NotificationCenterDrawer';
import Tooltip from '../components/ui/Tooltip';

/* ── Nav sections ──────────────────────────────────────── */
import { type LucideIcon } from 'lucide-react';

interface NavItemDef { path: string; label: string; Icon: LucideIcon; }
interface NavSection  { label: string; items: NavItemDef[]; }

const NAV_SECTIONS: NavSection[] = [
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
    items: [{ path: ROUTES.ADMIN, label: 'Admin Console', Icon: Settings }],
  },
];

const SIDEBAR_KEY  = 'ppe_sidebar_collapsed';
const SIDEBAR_W_KEY = 'ppe_sidebar_width';
const MIN_W = 180;
const MAX_W = 380;
const DEF_W = 220;

/* ── WS Status Banner ──────────────────────────────────── */
function WsStatusBanner() {
  const status = useWsStore(s => s.status);
  if (status === 'connected') return (
    <div className="flex items-center gap-1.5" role="status" aria-live="polite">
      <span className="w-2 h-2 rounded-full bg-status-ok" />
      <span className="text-xs font-mono text-status-ok">Live</span>
    </div>
  );
  if (status === 'reconnecting') return (
    <div className="flex items-center gap-1.5" role="status" aria-live="polite">
      <span className="w-2 h-2 rounded-full bg-status-warn animate-pulse" />
      <svg className="w-3 h-3 text-status-warn animate-spin" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
      </svg>
      <span className="text-xs font-mono text-status-warn">Reconnecting…</span>
    </div>
  );
  return (
    <div className="flex items-center gap-1.5" role="status" aria-live="polite">
      <span className="w-2 h-2 rounded-full bg-status-danger" />
      <span className="text-xs font-mono text-status-danger">Disconnected</span>
      <button className="text-xs text-accent hover:underline ml-1">Retry</button>
    </div>
  );
}

/* ── Nav Item ──────────────────────────────────────────── */
function NavItem({ path, label, Icon, collapsed, alertCount }: {
  path: string; label: string; Icon: React.ElementType;
  collapsed: boolean; alertCount?: number;
}) {
  const base = 'transition-all duration-200 relative';
  if (collapsed) return (
    <Tooltip content={label}>
      <NavLink to={path} className={({ isActive }) =>
        `${base} flex items-center justify-center w-10 h-10 mx-auto rounded-xl
         ${isActive
           ? 'bg-accent/20 text-accent border border-accent/30 shadow-sm shadow-accent/20'
           : 'text-text-muted hover:bg-panel-hover hover:text-text-primary'}`}>
        <Icon className="w-[18px] h-[18px]" aria-hidden="true" />
        <span className="sr-only">{label}</span>
        {!!alertCount && alertCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-status-danger text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {alertCount > 9 ? '9+' : alertCount}
          </span>
        )}
      </NavLink>
    </Tooltip>
  );

  return (
    <NavLink to={path} className={({ isActive }) =>
      `${base} flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
       ${isActive
         ? 'bg-accent/15 text-accent border border-accent/20 shadow-sm'
         : 'text-text-secondary hover:bg-panel-hover hover:text-text-primary border border-transparent'}`}>
      {({ isActive }) => (
        <>
          {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-accent rounded-r-full" />}
          <Icon className={`w-[18px] h-[18px] shrink-0 ${isActive ? 'drop-shadow-[0_0_5px_rgba(156,74,79,0.5)]' : ''}`} aria-hidden="true" />
          <span className="truncate">{label}</span>
          {!!alertCount && alertCount > 0 && (
            <span className="ml-auto shrink-0 min-w-[20px] h-5 bg-status-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1.5">
              {alertCount > 99 ? '99+' : alertCount}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

/* ── Logout Confirmation Dialog ────────────────────────── */
function LogoutDialog({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-bg/80 backdrop-blur-sm"
      role="dialog" aria-modal="true" aria-labelledby="logout-title">
      <div className="bg-panel border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-status-danger/15 flex items-center justify-center">
            <LogOut className="w-5 h-5 text-status-danger" aria-hidden="true" />
          </div>
          <h3 id="logout-title" className="text-lg font-bold text-text-primary">Sign out?</h3>
        </div>
        <p className="text-sm text-text-secondary mb-6 leading-relaxed">
          You'll be signed out of PPE Monitor and will need to sign in again to access the system.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-text-secondary bg-panel-alt border border-border hover:bg-panel-hover transition-all duration-200">
            Cancel
          </button>
          <button onClick={onConfirm}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-status-danger hover:bg-status-danger/85 shadow-lg shadow-status-danger/20 transition-all duration-200">
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Layout ───────────────────────────────────────── */
export default function AppLayout() {
  const { user, logout }  = useAuthStore();
  const openDrawer        = useNotificationStore(s => s.openDrawer);
  const unreadCount       = useNotificationStore(s => s.unreadCount);
  const activeAlertCount  = useAlertStore(s =>
    s.alerts.filter(a => a.status === 'open' || a.status === 'escalated').length
  );
  const navigate          = useNavigate();
  const location          = useLocation();

  const [profileOpen, setProfileOpen]       = useState(false);
  const [logoutOpen,  setLogoutOpen]        = useState(false);

  // Sidebar collapse
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(SIDEBAR_KEY) === 'true'; } catch { return false; }
  });

  // Sidebar resizable width
  const [sidebarW, setSidebarW] = useState<number>(() => {
    try { return parseInt(localStorage.getItem(SIDEBAR_W_KEY) ?? String(DEF_W), 10); } catch { return DEF_W; }
  });
  const isResizing = useRef(false);

  function toggleSidebar() {
    setCollapsed(v => {
      const next = !v;
      try { localStorage.setItem(SIDEBAR_KEY, String(next)); } catch { /* noop */ }
      return next;
    });
  }

  // Resize drag handlers
  function onResizeStart(e: React.MouseEvent) {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    function onMove(ev: MouseEvent) {
      if (!isResizing.current) return;
      const w = Math.min(MAX_W, Math.max(MIN_W, ev.clientX));
      setSidebarW(w);
      try { localStorage.setItem(SIDEBAR_W_KEY, String(w)); } catch { /* noop */ }
    }
    function onUp() {
      isResizing.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  // Escalation moved server-side (backend/escalation.py) — this listens for the
  // alert_new / alert_escalated events it (and repositories/writer.py) broadcast over the
  // real /ws/alerts socket (src/lib/alerts/alertStore.ts), retiring both the old 5s
  // GET /api/alerts poll and the fabricated mockWebSocketService.ts stream entirely.
  useEffect(() => { startAlertLiveFeed(); return () => stopAlertLiveFeed(); }, []);

  // Close profile on outside click
  useEffect(() => {
    if (!profileOpen) return;
    const h = (e: MouseEvent) => {
      if (!(e.target as Element).closest('[data-profile-menu]')) setProfileOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [profileOpen]);

  function confirmLogout() { logout(); navigate(ROUTES.LOGIN); }

  const allowedPaths = new Set<string>(
    user
      ? (NAV_SECTIONS as NavSection[]).flatMap(s => s.items)
          .filter(i => { const p = ROUTE_PERMISSIONS[i.path]; return !p || p.includes(user.role); })
          .map(i => i.path)
      : []
  );

  const badge    = Math.min(unreadCount, NOTIFICATION_MAX);
  const initials = user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() ?? '?';
  const currentRoute: NavItemDef | undefined = (NAV_SECTIONS as NavSection[])
    .flatMap(s => s.items)
    .find(i => location.pathname.startsWith(i.path));

  /* ── effective sidebar width ─────────────────────────── */
  const effectiveW = collapsed ? 72 : sidebarW;

  return (
    /* ROOT — fixed h-screen, flex-row, no overflow at root */
    <div className="h-screen w-screen flex flex-row overflow-hidden bg-bg text-text-primary">

      {/* ═══════════════════════════════════════════════════
          SIDEBAR
      ══════════════════════════════════════════════════════ */}
      <aside
        style={{
          width: `${effectiveW}px`,
          minWidth: `${effectiveW}px`,
          maxWidth: `${effectiveW}px`,
          background: 'linear-gradient(180deg,var(--color-panel) 0%,var(--color-bg) 100%)',
          borderRight: '1px solid var(--color-border-soft)',
          transition: collapsed ? 'width 0.2s ease, min-width 0.2s ease, max-width 0.2s ease' : 'none',
        }}
        className="flex flex-col shrink-0 relative no-print"
        aria-label="Main navigation"
      >
        {/* Logo row */}
        <div
          className={`h-14 shrink-0 flex items-center px-4 ${collapsed ? 'justify-center' : 'justify-between'}`}
          style={{ borderBottom: '1px solid var(--color-border-soft)' }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-accent/40 to-accent/10 border border-accent/25 flex items-center justify-center shrink-0">
              <Shield className="w-4 h-4 text-accent" aria-hidden="true" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="text-sm font-bold text-text-primary truncate leading-tight">{APP_NAME}</p>
                <p className="text-[10px] text-text-muted truncate leading-tight">Monitoring System</p>
              </div>
            )}
          </div>
          <button
            onClick={toggleSidebar}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-panel-hover transition-colors shrink-0"
          >
            {collapsed
              ? <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
              : <ChevronLeft  className="w-3.5 h-3.5" aria-hidden="true" />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3" aria-label="Site navigation">
          {NAV_SECTIONS.map(section => {
            const visible = section.items.filter(i => allowedPaths.has(i.path));
            if (!visible.length) return null;
            return (
              <div key={section.label} className={`mb-2 ${collapsed ? 'px-2' : 'px-3'}`}>
                {!collapsed && (
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted/50 px-3 py-1 mb-0.5 select-none">
                    {section.label}
                  </p>
                )}
                {collapsed && <div className="w-8 h-px bg-border-soft mx-auto my-2" aria-hidden="true" />}
                <div className={`flex flex-col ${collapsed ? 'items-center gap-1' : 'gap-0.5'}`}>
                  {visible.map(({ path, label, Icon }) => (
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

        {/* Footer — User card only, always at bottom */}
        <div
          className={`shrink-0 ${collapsed ? 'px-2 py-3' : 'px-3 py-3'}`}
          style={{ borderTop: '1px solid var(--color-border-soft)' }}
        >
          {/* Expanded: full user card */}
          {!collapsed && user && (
            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-panel-alt border border-border-soft">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent/30 to-accent/10 border border-accent/20 flex items-center justify-center text-sm font-bold text-accent shrink-0 select-none">
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

          {/* Collapsed: avatar icon only */}
          {collapsed && user && (
            <Tooltip content={`${user.name} · ${ROLE_LABELS[user.role]}`}>
              <div className="w-10 h-10 mx-auto rounded-xl bg-gradient-to-br from-accent/30 to-accent/10 border border-accent/20 flex items-center justify-center text-sm font-bold text-accent select-none cursor-default">
                {initials}
              </div>
            </Tooltip>
          )}
        </div>

        {/* Resize handle — only when expanded */}
        {!collapsed && (
          <div
            onMouseDown={onResizeStart}
            title="Drag to resize sidebar"
            className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize group z-20"
            aria-hidden="true"
          >
            <div className="absolute inset-y-0 right-0 w-1 bg-transparent group-hover:bg-accent/40 transition-colors duration-150" />
          </div>
        )}
      </aside>

      {/* ═══════════════════════════════════════════════════
          MAIN COLUMN  (header + scrollable content)
      ══════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Header — fixed 56px */}
        <header className="h-14 shrink-0 bg-panel border-b border-border-soft flex items-center px-6 gap-4 no-print z-10">
          {/* Current-page breadcrumb */}
          {currentRoute && (() => {
            const RouteIcon = currentRoute.Icon;
            return (
              <div className="flex items-center gap-2 text-text-muted">
                <RouteIcon className="w-4 h-4" aria-hidden="true" />
                <span className="text-sm font-medium text-text-secondary">{currentRoute.label}</span>
              </div>
            );
          })()}
          <div className="flex-1" />

          <WsStatusBanner />
          <div className="w-px h-5 bg-border-soft" aria-hidden="true" />

          {/* Bell */}
          <Tooltip content="Notifications">
            <button onClick={openDrawer}
              aria-label={`Notifications — ${badge} unread`}
              className="relative p-2 rounded-md text-text-muted hover:text-text-primary hover:bg-panel-hover transition-colors">
              <Bell className="w-5 h-5" aria-hidden="true" />
              {badge > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-status-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </button>
          </Tooltip>

          {/* Avatar */}
          <div className="relative" data-profile-menu>
            <button onClick={() => setProfileOpen(v => !v)}
              aria-label="User menu" aria-expanded={profileOpen} aria-haspopup="menu"
              className="flex items-center gap-2.5 pl-2 pr-1 py-1.5 rounded-md hover:bg-panel-hover transition-colors">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent/40 to-accent/10 border border-accent/25 flex items-center justify-center text-sm font-bold text-accent select-none">
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
                  <User className="w-4 h-4" /> My Profile
                </NavLink>
                <NavLink to={ROUTES.HELP} role="menuitem" onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-sm text-text-secondary hover:bg-panel-hover hover:text-text-primary transition-colors">
                  <BookOpen className="w-4 h-4" /> Help
                </NavLink>
                <div className="my-1 mx-3 h-px bg-border-soft" role="separator" />
                <button role="menuitem" onClick={() => { setProfileOpen(false); setLogoutOpen(true); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-status-danger hover:bg-panel-hover transition-colors">
                  <LogOut className="w-4 h-4" /> Logout
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main id="main-content" className="flex-1 overflow-hidden bg-bg">
          <Outlet />
        </main>
      </div>

      {/* ── Portals ─────────────────────────────────────── */}
      <NotificationCenterDrawer />

      {/* Logout confirmation */}
      {logoutOpen && (
        <LogoutDialog onConfirm={confirmLogout} onCancel={() => setLogoutOpen(false)} />
      )}
    </div>
  );
}
