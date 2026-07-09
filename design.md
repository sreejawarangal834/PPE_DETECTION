# Design — Zone-Wise PPE Detection & Monitoring System

**Version:** 1.4  
**Date:** 2026-07-09  
**Status:** Draft — awaiting approval  
**Tied to Requirements:** v1.4

### Changelog
| Version | Change |
|---|---|
| 1.4 | Split Live Monitoring into two pages: `/monitoring` (camera feeds + live side panels with Grid/Single view toggle, Single View as default for Safety Officer) and `/analytics` (compliance stats, zone cards, workers widget, camera status, Top Violating Zones); added ViewModeToggle component; added AnalyticsPage; updated routes and permissions |
| 1.1 | Added centralized theme/token system; added `api/` layer; added `constants/` directory; introduced reusable dashboard widgets; added Plant Layout/Zone Heatmap widget; added Incident Report component; expanded notifications to Notification Center/Drawer; role-specific dashboards composed from shared widgets |
| 1.0 | Initial draft |

---

## 1. Technology Stack

| Concern | Choice | Reason |
|---|---|---|
| Framework | React 19 + Vite 8 + TypeScript 6 | Already in project; fast HMR, strict types |
| Styling | Tailwind CSS 3 | Already configured; utility-first, design-token-friendly |
| Routing | React Router v7 | File-agnostic, nested routes, `loader`-free client SPA pattern |
| Server state | TanStack Query v5 | Cache management, loading/error states, query invalidation |
| Global state | Zustand v4 | Auth store, notification store, WS status — lightweight, no boilerplate |
| Real-time | Custom `MockWebSocketService` (browser `WebSocket`-shaped API) | Matches future production WS API; drop-in replacement |
| Charts | Recharts 2 | Declarative, composable, good TypeScript types |
| Excel export | SheetJS (`xlsx`) | Client-side `.xlsx` generation, no server needed |
| PDF export | `window.print()` + print CSS | Zero dependency for v1.0 |
| Linting | oxlint | Already configured |

**Packages to add** (none currently installed):

```
react-router-dom         # routing
@tanstack/react-query    # server state
zustand                  # global state
recharts                 # charts
xlsx                     # excel export
react-hot-toast          # toast notifications
date-fns                 # date formatting / arithmetic
```

---

## 2. Theme & Token System

All colours, spacing, and typography are defined as CSS custom properties in `src/index.css` and consumed via a Tailwind theme extension. **No hardcoded colour values appear in component files.**

### 2.1 CSS Custom Properties (`src/index.css`)

```css
:root {
  /* Backgrounds */
  --color-bg:           #0f1117;
  --color-panel:        #161a22;
  --color-panel-alt:    #1c2130;
  --color-border:       #2a3042;
  --color-border-soft:  #1f2535;

  /* Text */
  --color-text-primary:   #e8eaf0;
  --color-text-secondary: #9ba3b8;
  --color-text-muted:     #5c6480;

  /* Accent */
  --color-accent:         #4f8ef7;
  --color-accent-hover:   #6fa3fa;

  /* Status */
  --color-status-ok:      #4caf82;
  --color-status-warn:    #e0a43a;
  --color-status-danger:  #c95050;
  --color-status-info:    #4f8ef7;

  /* Severity */
  --color-severity-high:   #c95050;
  --color-severity-medium: #e0a43a;
  --color-severity-low:    #d4c84a;
  --color-severity-info:   #4f8ef7;

  /* Alert status */
  --color-alert-open:         #c95050;
  --color-alert-acknowledged: #e0a43a;
  --color-alert-escalated:    #c95050;   /* filled, not outline */
  --color-alert-resolved:     #4caf82;

  /* Spacing scale (rem) */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;

  /* Typography */
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
  --text-xs:   0.75rem;
  --text-sm:   0.875rem;
  --text-base: 1rem;
  --text-lg:   1.125rem;
  --text-xl:   1.25rem;
  --text-2xl:  1.5rem;
  --text-3xl:  1.875rem;
}
```

### 2.2 Tailwind Theme Extension (`tailwind.config.js`)

```js
theme: {
  extend: {
    colors: {
      bg:          'var(--color-bg)',
      panel:       'var(--color-panel)',
      'panel-alt': 'var(--color-panel-alt)',
      border:      'var(--color-border)',
      'border-soft':'var(--color-border-soft)',
      accent:      'var(--color-accent)',
      text: {
        primary:   'var(--color-text-primary)',
        secondary: 'var(--color-text-secondary)',
        muted:     'var(--color-text-muted)',
      },
      status: {
        ok:     'var(--color-status-ok)',
        warn:   'var(--color-status-warn)',
        danger: 'var(--color-status-danger)',
        info:   'var(--color-status-info)',
      },
      severity: {
        high:   'var(--color-severity-high)',
        medium: 'var(--color-severity-medium)',
        low:    'var(--color-severity-low)',
        info:   'var(--color-severity-info)',
      },
    },
    fontFamily: {
      sans: 'var(--font-sans)',
      mono: 'var(--font-mono)',
    },
  },
}
```

All component files reference semantic tokens (`text-status-ok`, `bg-panel-alt`, `text-severity-high`) — never raw colour values like `text-red-400`. This makes future theme changes a single-file edit.

---

## 3. Folder Structure

Organised by **feature**, not by component type. Shared infrastructure lives in `src/lib/`, `src/api/`, `src/constants/`, and `src/components/`.

```
src/
├── main.tsx                         # entry point
├── App.tsx                          # router root + providers
├── index.css                        # CSS custom properties (design tokens) + Tailwind directives
│
├── constants/                       # application-wide constants (no logic)
│   ├── roles.ts                     # UserRole enum + role metadata
│   ├── routes.ts                    # ROUTES object (typed path constants)
│   ├── permissions.ts               # ROLE_PERMISSIONS map (role → allowed routes[])
│   ├── alertStatus.ts               # AlertStatus enum + display metadata
│   ├── severity.ts                  # Severity enum + display metadata
│   ├── ppeTypes.ts                  # PPE_TYPES array + labels + colours
│   └── app.ts                       # misc (SESSION_TTL_MS, PAGE_SIZE, WS_RECONNECT_MAX_MS…)
│
├── api/                             # API layer — mock now, real backend later
│   ├── authApi.ts                   # login(), logout(), resetPassword(), getProfile()
│   ├── alertsApi.ts                 # getAlerts(), getAlertById(), acknowledgeAlert(), resolveAlert()
│   ├── workersApi.ts                # getWorkers(), getWorkerById(), getZoneLog()
│   ├── camerasApi.ts                # getCameras(), createCamera(), updateCamera()
│   ├── zonesApi.ts                  # getZones(), createZone(), updateZone()
│   ├── reportsApi.ts                # getDailyReport(), getWeeklyReport(), getMonthlyReport(), getWorkerReport(), getAdHocReport()
│   └── adminApi.ts                  # getUsers(), createUser(), updateUser(), getAuditLog(), getSystemHealth(), getAlertConfig(), saveAlertConfig()
│
├── lib/                             # pure utilities and service singletons
│   ├── auth/
│   │   ├── authStore.ts             # Zustand auth store (token, user, expiry, logout)
│   │   └── mockAuthService.ts       # in-memory login / reset / seed users
│   ├── websocket/
│   │   ├── mockWebSocketService.ts  # fake WS emitting timed events
│   │   ├── useWebSocket.ts          # hook — mounts WS, dispatches to stores
│   │   └── wsStore.ts               # Zustand WS connection status store
│   ├── alerts/
│   │   ├── alertStore.ts            # Zustand alert store + escalation interval
│   │   └── mockAlertService.ts      # seed data + CRUD helpers
│   ├── notifications/
│   │   └── notificationStore.ts     # Zustand notification center store
│   ├── audit/
│   │   └── auditLog.ts              # in-memory append-only audit log
│   ├── queryClient.ts               # TanStack Query client singleton
│   └── utils.ts                     # date format, export helpers, formatDuration
│
├── data/                            # static seed data
│   ├── mockData.ts                  # cameras, detectionEvents (extended)
│   ├── zones.ts                     # zone seed data with requiredPPE
│   ├── workers.ts                   # worker seed data
│   ├── reports.ts                   # generated report seed data
│   └── alertConfig.ts               # default escalation thresholds
│
├── components/
│   ├── ui/                          # low-level primitives
│   │   ├── Badge.tsx                # severity / status / camera badges
│   │   ├── Button.tsx               # primary / secondary / ghost / icon
│   │   ├── Card.tsx                 # surface container
│   │   ├── DataTable.tsx            # generic sortable/paginated table
│   │   ├── DateRangePicker.tsx      # date range input
│   │   ├── Dialog.tsx               # modal wrapper (focus-trapped)
│   │   ├── Drawer.tsx               # slide-in panel (focus-trapped)
│   │   ├── EmptyState.tsx           # empty list illustration + message
│   │   ├── ErrorBoundary.tsx        # React error boundary
│   │   ├── Input.tsx                # text / password inputs
│   │   ├── LoadingSkeleton.tsx      # shimmer placeholder (variants: table, card, chart, kpi)
│   │   ├── MultiSelect.tsx          # multi-value select dropdown
│   │   ├── Select.tsx               # single select dropdown
│   │   ├── Slider.tsx               # range slider (threshold config)
│   │   ├── Spinner.tsx              # loading spinner
│   │   ├── Toast.tsx                # react-hot-toast wrapper
│   │   └── Tooltip.tsx
│   │
│   └── widgets/                     # reusable dashboard widgets (composed from ui/)
│       ├── KPICard.tsx              # metric + trend indicator + sparkline slot
│       ├── ComplianceGauge.tsx      # radial gauge chart (Recharts RadialBarChart)
│       ├── TopViolatingZonesWidget.tsx  # ranked zone list + time window selector
│       ├── AlertFeedWidget.tsx      # compact real-time alert list (embeddable)
│       ├── WorkerStatusWidget.tsx   # live worker compliance summary
│       ├── CameraStatusWidget.tsx   # camera online/offline summary grid
│       ├── PlantLayoutWidget.tsx    # zone heatmap / plant floor plan overlay
│       ├── IncidentReportWidget.tsx # generates downloadable incident report from alert
│       └── ViewModeToggle.tsx       # Grid/Single view toggle for monitoring page
│
├── layouts/
│   ├── AppLayout.tsx                # sidebar + header + notification bell + WS status
│   ├── AuthLayout.tsx               # centered card layout for login/reset
│   └── PrintLayout.tsx              # print-only layout for PDF export
│
├── features/
│   ├── auth/
│   │   ├── LoginPage.tsx
│   │   ├── ForgotPasswordPage.tsx
│   │   ├── ResetPasswordPage.tsx
│   │   └── ProfilePage.tsx
│   │
│   ├── dashboards/                  # role-specific landing dashboards (composed from widgets)
│   │   ├── SafetyOfficerDashboard.tsx    # /monitoring — full site view
│   │   ├── SiteSupervisorDashboard.tsx   # /monitoring — zone-scoped view
│   │   ├── EhsManagerDashboard.tsx       # /reports — reports landing
│   │   └── PlantManagementDashboard.tsx  # /kpi — KPI summary
│   │
│   ├── monitoring/
│   │   ├── MonitoringPage.tsx       # page shell — renders camera grid/single view + side panels
│   │   ├── AnalyticsPage.tsx        # page shell — renders compliance stats, zone cards, widgets
│   │   ├── ZoneGrid.tsx             # zone compliance card grid
│   │   ├── ZoneCard.tsx             # single zone card (live updates)
│   │   ├── CameraGrid.tsx           # camera tile grid
│   │   ├── CameraCard.tsx           # single camera tile + overlay canvas
│   │   ├── CameraDetailPanel.tsx    # expanded camera view (reused for Single View)
│   │   ├── ComplianceStats.tsx      # gauge + mini bar/line charts
│   │   └── LiveWorkerList.tsx       # real-time worker compliance list
│   │
│   ├── alerts/
│   │   ├── AlertsPage.tsx           # page shell + filter bar
│   │   ├── AlertTable.tsx           # real-time alert feed table
│   │   ├── AlertRow.tsx             # single row with new-alert fade
│   │   ├── AlertDetailPanel.tsx     # side panel / modal
│   │   ├── AlertFilters.tsx         # filter chips + filter form
│   │   ├── AcknowledgeDialog.tsx
│   │   └── ResolveDialog.tsx
│   │
│   ├── workers/
│   │   ├── WorkerListPage.tsx
│   │   ├── WorkerProfilePage.tsx
│   │   ├── ComplianceHistoryChart.tsx
│   │   └── ZoneEntryExitLog.tsx
│   │
│   ├── reports/
│   │   ├── ReportsPage.tsx             # tab shell (Daily / Weekly / Monthly / By Worker / Ad-Hoc)
│   │   ├── DailyReport.tsx
│   │   ├── WeeklyReport.tsx
│   │   ├── MonthlyReport.tsx
│   │   ├── WorkerComplianceReport.tsx  # US-REPORT-07
│   │   ├── AdHocAnalytics.tsx
│   │   └── KpiSummaryPage.tsx          # uses PlantManagementDashboard + KPICard widgets
│   │
│   └── admin/
│       ├── AdminLayout.tsx          # admin sub-nav
│       ├── UserManagementPage.tsx
│       ├── UserFormModal.tsx        # create / edit + zone assignment
│       ├── ZoneConfigPage.tsx
│       ├── ZoneFormModal.tsx
│       ├── CameraManagementPage.tsx
│       ├── CameraFormModal.tsx
│       ├── AlertConfigPage.tsx
│       ├── SystemHealthPage.tsx
│       └── AuditLogPage.tsx
│
├── router/
│   ├── index.tsx                    # route tree definition
│   ├── ProtectedRoute.tsx           # auth + session-expiry guard
│   └── RoleGuard.tsx                # role-permission guard
│
└── pages/
    ├── NotFoundPage.tsx             # 404
    ├── ForbiddenPage.tsx            # 403
    └── HelpPage.tsx                 # in-app help
```

---

## 4. Constants Directory

All magic strings and enum-like values are centralised in `src/constants/` so components never hard-code role codes, route strings, or status values.

### `roles.ts`
```typescript
export const UserRole = {
  ADMIN:            'admin',
  SAFETY_OFFICER:   'safety_officer',
  SITE_SUPERVISOR:  'site_supervisor',
  EHS_MANAGER:      'ehs_manager',
  PLANT_MGMT:       'plant_mgmt',
} as const;
export type UserRole = typeof UserRole[keyof typeof UserRole];

export const ROLE_LABELS: Record<UserRole, string> = {
  admin:           'System Administrator',
  safety_officer:  'Safety Officer',
  site_supervisor: 'Site Supervisor',
  ehs_manager:     'EHS Manager',
  plant_mgmt:      'Plant Management',
};
```

### `routes.ts`
```typescript
export const ROUTES = {
  LOGIN:           '/login',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD:  '/reset-password',
  MONITORING:      '/monitoring',
  ANALYTICS:       '/analytics',
  ALERTS:          '/alerts',
  WORKERS:         '/workers',
  WORKER_PROFILE:  (id: string) => `/workers/${id}`,
  REPORTS:         '/reports',
  REPORTS_ANALYTICS: '/reports/analytics',
  KPI:             '/kpi',
  PROFILE:         '/profile',
  ADMIN:           '/admin',
  ADMIN_USERS:     '/admin/users',
  ADMIN_ZONES:     '/admin/zones',
  ADMIN_CAMERAS:   '/admin/cameras',
  ADMIN_ALERT_CONFIG: '/admin/alert-config',
  ADMIN_SYSTEM_HEALTH: '/admin/system-health',
  ADMIN_AUDIT_LOG: '/admin/audit-log',
  FORBIDDEN:       '/forbidden',
  HELP:            '/help',
} as const;
```

### `permissions.ts`
```typescript
// Maps each route to the roles that may access it.
// Used by RoleGuard and nav rendering — single source of truth.
export const ROUTE_PERMISSIONS: Record<string, UserRole[]> = {
  [ROUTES.MONITORING]:      ['admin','safety_officer','site_supervisor','ehs_manager'],
  [ROUTES.ANALYTICS]:       ['admin','safety_officer','site_supervisor','ehs_manager'],
  [ROUTES.ALERTS]:          ['admin','safety_officer','site_supervisor','ehs_manager'],
  [ROUTES.WORKERS]:         ['admin','safety_officer','site_supervisor','ehs_manager'],
  [ROUTES.REPORTS]:         ['admin','ehs_manager','plant_mgmt'],
  [ROUTES.KPI]:             ['admin','ehs_manager','plant_mgmt'],
  [ROUTES.ADMIN]:           ['admin'],
  // …all admin sub-routes also map to ['admin']
};

export const ROLE_LANDING: Record<UserRole, string> = {
  admin:           ROUTES.ADMIN_SYSTEM_HEALTH,
  safety_officer:  ROUTES.MONITORING,
  site_supervisor: ROUTES.MONITORING,
  ehs_manager:     ROUTES.REPORTS,
  plant_mgmt:      ROUTES.KPI,
};
```

### `alertStatus.ts`
```typescript
export const AlertStatus = {
  OPEN:         'open',
  ACKNOWLEDGED: 'acknowledged',
  ESCALATED:    'escalated',
  RESOLVED:     'resolved',
} as const;
export type AlertStatus = typeof AlertStatus[keyof typeof AlertStatus];
```

### `severity.ts`
```typescript
export const Severity = {
  HIGH:   'high',
  MEDIUM: 'medium',
  LOW:    'low',
  INFO:   'info',
} as const;
export type Severity = typeof Severity[keyof typeof Severity];
```

### `ppeTypes.ts`
```typescript
export const PPE_TYPES = [
  { id: 'helmet',       label: 'Helmet',         color: 'var(--color-severity-high)'   },
  { id: 'vest',         label: 'Safety Vest',     color: 'var(--color-severity-medium)' },
  { id: 'mask',         label: 'Mask',            color: 'var(--color-status-info)'     },
  { id: 'safety_shoes', label: 'Safety Shoes',    color: 'var(--color-status-ok)'       },
  { id: 'gloves',       label: 'Gloves',          color: 'var(--color-severity-low)'    },
  { id: 'eye_prot',     label: 'Eye Protection',  color: 'var(--color-accent)'          },
] as const;
```

### `app.ts`
```typescript
export const SESSION_TTL_MS       = 8 * 60 * 60 * 1000;  // 8 hours
export const EXPIRY_CHECK_MS      = 60 * 1_000;           // 60 seconds
export const WS_RECONNECT_MAX_MS  = 30 * 1_000;           // 30 seconds
export const PAGE_SIZE_DEFAULT    = 25;
export const PAGE_SIZE_AUDIT      = 50;
export const TOP_ZONES_COUNT      = 5;
export const NOTIFICATION_MAX     = 99;
export const VIEW_MODE_DEFAULT    = 'single';             // default for Safety Officer landing
export const VIEW_MODE_STORAGE_KEY = 'monitoring_view_mode';
```

---

## 5. API Layer

Every data operation goes through `src/api/`. Each file exports typed async functions that call mock services now. Swapping to a real API means replacing only the function bodies — all call sites remain unchanged.

### Pattern

```typescript
// src/api/alertsApi.ts
import type { Alert, AlertFilters, PagedResult } from '../types';
import { mockAlertService } from '../lib/alerts/mockAlertService';

export async function getAlerts(filters: AlertFilters): Promise<PagedResult<Alert>> {
  return mockAlertService.query(filters);
}

export async function acknowledgeAlert(id: string, actorName: string): Promise<Alert> {
  return mockAlertService.acknowledge(id, actorName);
}

export async function resolveAlert(id: string, actorName: string, notes: string): Promise<Alert> {
  return mockAlertService.resolve(id, actorName, notes);
}
```

### Files and Responsibilities

| File | Exported Functions |
|---|---|
| `authApi.ts` | `login()`, `logout()`, `forgotPassword()`, `resetPassword()`, `getProfile()`, `updateProfile()` |
| `alertsApi.ts` | `getAlerts()`, `getAlertById()`, `acknowledgeAlert()`, `resolveAlert()` |
| `workersApi.ts` | `getWorkers()`, `getWorkerById()`, `getWorkerZoneLog()` |
| `camerasApi.ts` | `getCameras()`, `getCameraById()`, `createCamera()`, `updateCamera()`, `testCameraConnection()` |
| `zonesApi.ts` | `getZones()`, `getZoneById()`, `createZone()`, `updateZone()` |
| `reportsApi.ts` | `getDailyReport()`, `getWeeklyReport()`, `getMonthlyReport()`, `getWorkerComplianceReport()`, `getAdHocReport()`, `getKpiSummary()` |
| `adminApi.ts` | `getUsers()`, `createUser()`, `updateUser()`, `getAuditLog()`, `getSystemHealth()`, `getAlertConfig()`, `saveAlertConfig()` |

TanStack Query `useQuery` / `useMutation` hooks call these API functions, never mock services directly.

---

### 3.1 Route Tree

```
/login                          public
/forgot-password                public
/reset-password                 public
/                               → redirect to role landing (ProtectedRoute)
/monitoring                     ProtectedRoute → RoleGuard([admin, safety_officer, site_supervisor, ehs_manager])
/alerts                         ProtectedRoute → RoleGuard([admin, safety_officer, site_supervisor, ehs_manager])
/workers                        ProtectedRoute → RoleGuard([admin, safety_officer, site_supervisor, ehs_manager])
/workers/:workerId              ProtectedRoute → RoleGuard([admin, safety_officer, site_supervisor, ehs_manager])
/reports                        ProtectedRoute → RoleGuard([admin, ehs_manager, plant_mgmt])
/reports/analytics              ProtectedRoute → RoleGuard([admin, ehs_manager, plant_mgmt])
/kpi                            ProtectedRoute → RoleGuard([admin, ehs_manager, plant_mgmt])
/profile                        ProtectedRoute (all roles)
/admin                          ProtectedRoute → RoleGuard([admin]) → redirect /admin/system-health
/admin/users                    ProtectedRoute → RoleGuard([admin])
/admin/zones                    ProtectedRoute → RoleGuard([admin])
/admin/cameras                  ProtectedRoute → RoleGuard([admin])
/admin/alert-config             ProtectedRoute → RoleGuard([admin])
/admin/system-health            ProtectedRoute → RoleGuard([admin])
/admin/audit-log                ProtectedRoute → RoleGuard([admin])
/forbidden                      public (rendered inside AppLayout if authenticated)
*                               NotFoundPage
```

### 3.2 Role Landing Redirects

Implemented in `ProtectedRoute` after successful auth check:

```
admin           → /admin/system-health
safety_officer  → /monitoring
site_supervisor → /monitoring
ehs_manager     → /reports
plant_mgmt      → /kpi
```

### 3.3 Guard Logic

```
ProtectedRoute
  ├── if no token → redirect /login
  ├── if tokenExpiresAt < Date.now() → clear auth, redirect /login + toast
  └── render children

RoleGuard(allowedRoles)
  ├── if user.role in allowedRoles → render children
  └── else → redirect to user's landing page + toast "You do not have permission…"
```

---

## 6. Routing

### 6.1 Route Tree

```
/login                          public
/forgot-password                public
/reset-password                 public
/                               → redirect to role landing (ProtectedRoute)
/monitoring                     ProtectedRoute → RoleGuard([admin, safety_officer, site_supervisor, ehs_manager])
/analytics                      ProtectedRoute → RoleGuard([admin, safety_officer, site_supervisor, ehs_manager])
/alerts                         ProtectedRoute → RoleGuard([admin, safety_officer, site_supervisor, ehs_manager])
/workers                        ProtectedRoute → RoleGuard([admin, safety_officer, site_supervisor, ehs_manager])
/workers/:workerId              ProtectedRoute → RoleGuard([admin, safety_officer, site_supervisor, ehs_manager])
/reports                        ProtectedRoute → RoleGuard([admin, ehs_manager, plant_mgmt])
/reports/analytics              ProtectedRoute → RoleGuard([admin, ehs_manager, plant_mgmt])
/kpi                            ProtectedRoute → RoleGuard([admin, ehs_manager, plant_mgmt])
/profile                        ProtectedRoute (all roles)
/admin                          ProtectedRoute → RoleGuard([admin]) → redirect /admin/system-health
/admin/users                    ProtectedRoute → RoleGuard([admin])
/admin/zones                    ProtectedRoute → RoleGuard([admin])
/admin/cameras                  ProtectedRoute → RoleGuard([admin])
/admin/alert-config             ProtectedRoute → RoleGuard([admin])
/admin/system-health            ProtectedRoute → RoleGuard([admin])
/admin/audit-log                ProtectedRoute → RoleGuard([admin])
/forbidden                      public
*                               NotFoundPage
```

### 6.2 Role Landing Redirects

Driven by `ROLE_LANDING` in `src/constants/permissions.ts`:

```
admin           → /admin/system-health
safety_officer  → /monitoring
site_supervisor → /monitoring
ehs_manager     → /reports
plant_mgmt      → /kpi
```

### 6.3 Guard Logic

```
ProtectedRoute
  ├── if no token → redirect /login
  ├── if tokenExpiresAt < Date.now() → clear auth, redirect /login + toast
  └── render children

RoleGuard(allowedRoles)
  ├── if user.role in allowedRoles → render children
  └── else → redirect to user's landing page + toast
```

Allowed roles sourced from `ROUTE_PERMISSIONS` in `src/constants/permissions.ts` — guards never hard-code role arrays inline.

---

## 7. State Management

### 7.1 Zustand Stores

#### `authStore`
```typescript
interface AuthState {
  user: AuthUser | null;          // { id, name, email, role, assignedZones? }
  token: string | null;
  tokenExpiresAt: number | null;  // unix ms
  login: (credentials) => Promise<void>;
  logout: () => void;
  checkExpiry: () => boolean;     // returns true if expired, calls logout()
}
```

- Persisted to `localStorage` via Zustand `persist` middleware.
- `checkExpiry()` called by `ProtectedRoute` on mount/navigation and by a `setInterval` (60 s) started inside the store.
- `logout()` clears store + localStorage + calls `wsStore.disconnect()` + `queryClient.clear()`.

#### `wsStore`

```typescript
type WsStatus = 'connected' | 'reconnecting' | 'disconnected';

interface WsState {
  status: WsStatus;
  setStatus: (s: WsStatus) => void;
  disconnect: () => void;
}
```

#### `alertStore`

```typescript
interface AlertState {
  alerts: Alert[];                      // live-updated from WS
  unreadCount: number;
  addAlert: (a: Alert) => void;
  updateStatus: (id, status, meta?) => void;
  markRead: (id: string) => void;
  clearUnread: () => void;
  runEscalationCheck: () => void;       // called by 60-s interval
}
```

`Alert.status` type: `'open' | 'acknowledged' | 'escalated' | 'resolved'`

#### `notificationStore`

```typescript
interface NotificationItem {
  id: string;
  type: 'alert_new' | 'alert_escalated' | 'system_health' | 'info';
  title: string;
  body: string;
  timestamp: number;
  read: boolean;
  linkTo?: string;
}

interface NotificationState {
  items: NotificationItem[];
  unreadCount: number;
  isDrawerOpen: boolean;
  addItem: (n: Omit<NotificationItem, 'id' | 'read'>) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  dismissItem: (id: string) => void;
  openDrawer: () => void;
  closeDrawer: () => void;
}
```

### 7.2 TanStack Query Usage

TanStack Query manages all async data fetching via `src/api/` functions:

| Query Key | Data | Stale Time |
|---|---|---|
| `['cameras']` | Camera list | 30 s |
| `['zones']` | Zone list | 60 s |
| `['workers']` | Worker list | 30 s |
| `['worker', id]` | Worker profile | 30 s |
| `['alerts', filters]` | Alert history (paginated) | 10 s |
| `['reports', 'daily', date]` | Daily report | 5 min |
| `['reports', 'weekly', week]` | Weekly report | 5 min |
| `['reports', 'monthly', month]` | Monthly report | 5 min |
| `['reports', 'workers', filters]` | Worker compliance report | 5 min |
| `['reports', 'kpi']` | KPI summary (incl. avg response time) | 5 min |
| `['admin', 'users']` | User list | 60 s |
| `['admin', 'audit-log', filters]` | Audit log paginated | 10 s |
| `['admin', 'system-health']` | Service health | 30 s |
| `['admin', 'alert-config']` | Threshold config | 60 s |

Real-time data (zone compliance, live worker list, camera metrics) is managed **directly in Zustand** (via WebSocket events) — not via TanStack Query, because the update frequency is sub-second and TanStack Query's polling model is unsuitable.

---

## 8. WebSocket / Real-Time Architecture

### 8.1 MockWebSocketService

Located at `src/lib/websocket/mockWebSocketService.ts`. Exposes the same interface as a real `WebSocket`:

```typescript
interface IWebSocketService {
  connect(): void;
  disconnect(): void;
  onMessage(handler: (event: WsEvent) => void): void;
  onStatusChange(handler: (status: WsStatus) => void): void;
}
```

**Event types emitted by the mock:**

```typescript
type WsEventType =
  | 'zone_compliance_update'   // { zoneId, compliancePercent, workerCount, violations }
  | 'camera_metrics_update'    // { cameraId, fps, latencyMs, workerCount, violations }
  | 'alert_new'                // Alert object
  | 'alert_status_change'      // { alertId, status, meta }
  | 'worker_update'            // { workerId, zone, complianceStatus, missingPpe }
  | 'system_health_update'     // { serviceId, status, lastHeartbeat }
  | 'top_zones_update'         // { window: string, zones: { zoneId, violations }[] }
```

**Connection lifecycle (mock):**
1. `connect()` starts a `setInterval` emitting random events every 2–4 s.
2. Every ~90 s, the mock randomly disconnects for 5 s then reconnects (to test the reconnection indicator).
3. Reconnection uses exponential back-off capped at 30 s (`WS_RECONNECT_MAX_MS` from `constants/app.ts`).

### 8.2 WS Integration Hook

`useWebSocket()` in `src/lib/websocket/useWebSocket.ts` mounts once at `AppLayout` level:

```
useWebSocket()
  └── onMessage(event)
        ├── zone_compliance_update  → zoneStore local state
        ├── top_zones_update        → topZonesStore local state  
        ├── alert_new               → alertStore.addAlert() + notificationStore.addItem()
        ├── alert_status_change     → alertStore.updateStatus()
        ├── worker_update           → workerLiveStore
        └── system_health_update   → invalidate ['admin', 'system-health'] query
```

### 8.3 Connection Status Indicator

`WsStatusBanner` component rendered inside `AppLayout` header — always visible. Three states:

- **Connected** — small green dot + "Live" text (unobtrusive)
- **Reconnecting…** — amber dot + spinner + "Reconnecting…"
- **Disconnected** — red dot + "Live feed disconnected" + manual retry button

---

## 9. Authentication & Session

### 9.1 Token Model (Mock)

```typescript
interface MockToken {
  userId: string;
  issuedAt: number;       // Date.now()
  expiresAt: number;      // issuedAt + SESSION_TTL_MS (8 hours)
}
```

Stored as JSON in `localStorage['ppe_auth']` via Zustand persist.

### 9.2 Session Expiry Flow

```
App mounts
  └── authStore rehydrates from localStorage
        ├── token present AND expiresAt > now  → authenticated, start expiry interval
        └── token expired or absent            → call logout(), redirect /login

ProtectedRoute renders
  └── authStore.checkExpiry()
        ├── not expired → render children
        └── expired     → logout() + navigate('/login') + toast("Session expired")

authStore interval (every EXPIRY_CHECK_MS = 60 s)
  └── checkExpiry()
        └── if expired → logout() + navigate (via router ref)
```

### 9.3 Zone Scoping (Site Supervisor)

`AuthUser.assignedZones: string[]` is set at login from the mock user record.

- `MonitoringPage`, `AlertsPage`, `WorkerListPage`: read `user.assignedZones` from `authStore` and apply as a filter before rendering. This filter cannot be removed by the user.
- Admin user management form writes `assignedZones` to the mock user record; changes are available on the supervisor's next login.

---

## 10. Dashboard Widget System

All role-specific dashboards are **composed from reusable widgets** in `src/components/widgets/`. No dashboard duplicates logic.

### 10.1 Widget Catalogue

#### `KPICard`
```typescript
interface KPICardProps {
  title: string;
  value: string;
  trend?: { direction: 'up'|'down'|'neutral'; delta: string; positive: boolean; };
  sparklineData?: number[];
  icon?: ReactNode;
  isLoading?: boolean;
}
```
KPIs: Overall Compliance Rate · Total Active Violations · Zones at Risk · Workers Tracked Today · **Average Alert Response Time** (mean creation→acknowledgement time, displayed as "3m 42s").

#### `ComplianceGauge`
Recharts `RadialBarChart` showing compliance % as filled arc. Colour: green (≥ 80%) → amber (60–79%) → red (< 60%).

#### `TopViolatingZonesWidget`
```typescript
interface TopViolatingZonesWidgetProps {
  onZoneClick: (zoneId: string) => void;
  assignedZones?: string[];
}
```
Time window dropdown: Last Hour / Last 4 Hours / Last 8 Hours / Today. Ranked list of up to 5 zones with violation bar. Updates via `top_zones_update` WS event. Empty state: "No violations detected in the selected time period."

#### `AlertFeedWidget`
Compact embeddable alert list showing last N alerts (configurable). Used on Safety Officer and Site Supervisor dashboards.

#### `WorkerStatusWidget`
Summary counts: Total Detected · Compliant · Non-Compliant · Unknown. Pie chart. Updates via WebSocket.

#### `CameraStatusWidget`
Grid of camera status indicators (online/offline/error). Click navigates to monitoring view for that camera.

#### `PlantLayoutWidget`
Zone heatmap over SVG plant floor plan placeholder (`public/plant-layout.svg`). Zone colours: green (≥ 80%), amber (60–79%), red (< 60% or escalated alert). Click a zone → filter monitoring dashboard. Zone-to-coordinate mapping in `data/zones.ts`.

#### `IncidentReportWidget`
Triggered from `AlertDetailPanel` via "Generate Incident Report" button. Renders a `PrintLayout`-wrapped report and calls `window.print()`.

Report contents: site name, generated by/at, alert ID, incident date/time, zone, camera ID, worker ID, missing PPE items, snapshot placeholder, acknowledgement details, resolution details, escalation flag.

```typescript
interface IncidentReportWidgetProps {
  alert: Alert;
  triggerLabel?: string;
}
```

#### `ViewModeToggle`
Segmented button toggle for Grid View vs Single View on the monitoring page. Persists state to `sessionStorage['monitoring_view_mode']` with default `'single'` for Safety Officers.

```typescript
interface ViewModeToggleProps {
  viewMode: 'grid' | 'single';
  onViewModeChange: (mode: 'grid' | 'single') => void;
}
```
- Renders as two buttons: "Grid View" (LayoutGrid icon) and "Single View" (Monitor icon)
- Active state: `bg-accent/15 text-accent`
- Inactive state: `text-text-muted hover:text-text-secondary`
- Keyboard accessible (Tab + Enter/Space)
- Reads from/writes to `sessionStorage` for session persistence

### 10.2 Role-Specific Dashboards

Each dashboard in `src/features/dashboards/` composes widgets — no per-dashboard data logic.

**`SafetyOfficerDashboard`** (`/monitoring`):
```
Header: Page title + ViewModeToggle (Grid/Single)
Main Content:
  - Grid View: CameraGrid (responsive grid of camera tiles)
  - Single View: CameraDetailPanel (full camera feed with camera selector, stats cards, recent events)
Right Panel: AlertFeedWidget + LiveWorkerList
```

**`SiteSupervisorDashboard`** (`/monitoring`, zone-scoped):
Same layout as Safety Officer, all widgets filtered to `user.assignedZones`.

**`AnalyticsPage`** (`/analytics`):
```
Row 1: ComplianceStats (ComplianceGauge + bar chart + area chart)
Row 2: WorkerStatusWidget | CameraStatusWidget | TopViolatingZonesWidget (lg:col-span-2)
Row 3: ZoneGrid (responsive grid of ZoneCard components)
```
All widgets receive WebSocket updates. Site Supervisors see data scoped to `user.assignedZones`.

**`EhsManagerDashboard`** (`/reports`):
```
Row 1: KPICard ×4
Row 2: DailyReport tab (default active)
```

**`PlantManagementDashboard`** (`/kpi`):
```
Row 1: KPICard ×5 (incl. Avg Response Time)
Row 2: PlantLayoutWidget (read-only heatmap)
Row 3: Spark line + plain-language written summary
```

`MonitoringPage.tsx` reads `user.role` and renders the appropriate dashboard component with view-mode toggle.

---

## 11. Notification Center

The bell icon opens a full **Notification Center Drawer** (400 px, right-side), not a simple dropdown.

### 11.1 Drawer Layout

```
┌─────────────────────────────────────────┐
│  Notifications         [Mark all read] [×] │
├─────────────────────────────────────────┤
│  [All] [Alerts] [Escalated] [System]       │
├─────────────────────────────────────────┤
│  ● HIGH — No helmet · Assembly Line        │
│    Worker W-042 · 2 min ago                │
│    [View Alert →]                          │
├─────────────────────────────────────────┤
│  ● ESCALATED — No vest · Welding Zone      │
│    Worker W-019 · 14 min ago               │
│    [View Alert →]                          │
├─────────────────────────────────────────┤
│  [Load older notifications]                │
└─────────────────────────────────────────┘
```

### 11.2 Notification Item Types

| Type | Trigger | Icon |
|---|---|---|
| `alert_new` | New WS alert | Bell |
| `alert_escalated` | Alert promoted to escalated | Warning triangle |
| `system_health` | System component offline | Server |
| `info` | Other system message | Info circle |

Bell badge shows `notificationStore.unreadCount` (capped at `NOTIFICATION_MAX = 99`). Clicking a notification item marks it read, navigates to `linkTo`, and closes the drawer.

---

## 12. Component Patterns

### 12.1 Page Shell Pattern

```tsx
<AppLayout>
  <PageHeader title="..." subtitle="..." actions={...} />
  <FilterBar />
  <ErrorBoundary>
    <Suspense fallback={<LoadingSkeleton variant="table" />}>
      <PageContent />
    </Suspense>
  </ErrorBoundary>
</AppLayout>
```

### 12.2 Data Table Pattern

```typescript
interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  isLoading?: boolean;
  emptyState?: ReactNode;
  pageSize?: number;        // default: PAGE_SIZE_DEFAULT (25)
  onRowClick?: (row: T) => void;
  sortable?: boolean;
}
```

### 12.3 Badge Component — Token-Based Colours

| Variant | Token classes |
|---|---|
| `high` | `bg-severity-high/20 text-severity-high` |
| `medium` | `bg-severity-medium/20 text-severity-medium` |
| `escalated` | `bg-alert-escalated text-white font-bold` |
| `resolved` | `border border-status-ok text-status-ok` |
| `online` | `bg-status-ok/20 text-status-ok` |
| `offline` | `bg-status-danger/20 text-status-danger` |

All other variants follow the same token pattern — no raw Tailwind colour classes.

### 12.4 Empty States

`EmptyState` used in every list/table/chart with a context-specific message. See requirements for specific strings per page.

### 12.5 Loading Skeletons

`LoadingSkeleton` variants: `table` · `card` · `chart` · `kpi`.

---

## 13. Layouts

### 13.1 AppLayout

```
┌────────────────────────────────────────────────────┐
│  Logo | WS status | [Bell + badge] | Avatar         │
├──────────┬─────────────────────────────────────────┤
│ Sidebar  │           <Outlet />                    │
│ 240 px   │        (role dashboard / page)          │
│ →64 px   │                                         │
│          │  - Live Monitoring                      │
│          │  - Analytics (new, below Monitoring)    │
│          │  - Alerts & Violations                  │
│          │  - Worker Tracking                      │
│          │  - Reports & Analytics                  │
│          │  - KPI Summary                          │
│          │  - Admin Console                        │
└──────────┴─────────────────────────────────────────┘
                              ┌──────────────────────┐
                              │  Notification Drawer  │
                              │  (400 px, right)      │
                              └──────────────────────┘
```

**Sidebar Navigation:**
- "Analytics" nav item appears immediately below "Live Monitoring" for roles: admin, safety_officer, site_supervisor, ehs_manager
- Nav items are conditionally rendered based on `ROUTE_PERMISSIONS`

### 13.2 AuthLayout / PrintLayout / Admin Sub-Layout

Same as v1.0 design — see folder structure for context.

---

## 14. Reports & Export

### 14.1 Report Tabs

```
[Daily] [Weekly] [Monthly] [By Worker] [Ad-Hoc]
```

Each tab is lazy-loaded.

### 14.2 Worker Compliance Report (US-REPORT-07)

Row highlighting uses design tokens:
- `< 50%` → `bg-status-danger/10 border-l-2 border-status-danger`
- `50–70%` → `bg-status-warn/10 border-l-2 border-status-warn`

### 14.3 Alert History Export (US-ALERT-05)

Includes accountability columns: Acknowledged By · Acknowledged At · Resolved By · Resolved At — in both CSV and PDF exports.

### 14.4 Ad-Hoc Chart Auto-Selection

```
dateRangeDays > 7, groupBy = 'date'   → LineChart
dateRangeDays ≤ 7, groupBy = 'date'   → BarChart
groupBy = 'zone' | 'ppe'              → horizontal BarChart
groupBy = 'worker'                    → BarChart (top 20)
```

---

## 15. Alert Escalation Architecture

Two triggers:
1. **Alert store interval** (60 s) — `alertStore.runEscalationCheck()` promotes eligible `open`/`acknowledged` alerts.
2. **MockWebSocketService** — emits `alert_status_change { status: 'escalated' }`.

Escalation side effects: `notificationStore.addItem()` (type `alert_escalated`) · `alertStore.unreadCount++` · re-sort to feed top · `auditLog.append()`.

---

## 16. Accessibility

- Icon-only buttons: `aria-label` + `title`.
- Status badges: `<span className="sr-only">` alongside colour.
- `Dialog` / `Drawer` / Notification Center: focus trap, restore on close.
- All tokens meet WCAG 2.1 AA against `--color-bg`.
- Interactive table rows: `role="button"`, Enter/Space handled.
- WS status indicator: `role="status"` `aria-live="polite"`.
- Notification Center Drawer: `role="dialog"` `aria-label="Notification Center"`.
- Plant Layout zones: `role="button"` `aria-label="{zone} — {pct}% compliant"`.

---

## 17. Key Design Decisions

| Decision | Rationale |
|---|---|
| Centralised CSS token system | Single-file theme edits; WCAG auditable in one place; no raw colours in components |
| `src/api/` layer | Identical call sites in dev and production; only function bodies change at backend integration |
| `src/constants/` for enums/routes/permissions | Eliminates magic strings; `ROUTE_PERMISSIONS` is single source of truth for guards and nav |
| Reusable widgets composed into role dashboards | Fix bugs once; add a new role with widget composition, not a new page |
| `PlantLayoutWidget` SVG placeholder | Real floor plans drop in as SVG without widget code changes |
| `IncidentReportWidget` via `window.print()` | Zero new dependency; upgradeable to `react-pdf` post-MVP |
| Notification Center Drawer | Industrial alert volume is too high for a small dropdown; drawer gives scan-and-act UX |
| Role dashboards from shared widgets | New role = new widget composition, not new implementation |
| Zustand for auth + alerts + WS + notifications | High-frequency global state; Context API causes excessive re-renders |
| TanStack Query for REST-style fetches | Cache lifecycle + easy mock→API swap via `src/api/` |
| Single WS connection at AppLayout | No duplicate streams on navigation |
| `escalated` as distinct status (not severity) | Process state and detection property are orthogonal |
| Session expiry: route-level + background interval | Route check misses idle; interval catches idle; both required |
