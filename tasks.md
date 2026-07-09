# Tasks — Zone-Wise PPE Detection & Monitoring System

**Version:** 1.4  
**Date:** 2026-07-09  
**Status:** Draft — awaiting approval  
**Tied to:** requirements.md v1.4 · design.md v1.4

---

## How to read this file

- Tasks are grouped by phase. Each phase must be complete before the next begins.
- Each task has a unique ID (`T-XXX`), a description, and a reference to the requirement(s) it satisfies.
- Subtasks are indented under their parent.
- Checkboxes track completion: `[ ]` = not started, `[x]` = done.

---

## Phase 1 — Project Foundation & Infrastructure

> Set up the full project scaffold, install dependencies, configure tooling, and establish the shared infrastructure every feature depends on. No feature pages yet.

### T-001 — Install dependencies
- [ ] Install `react-router-dom`, `@tanstack/react-query`, `zustand`, `recharts`, `xlsx`, `react-hot-toast`, `date-fns`
- [ ] Verify all packages resolve without peer-dependency conflicts
- **Refs:** design §1

### T-002 — Configure Tailwind theme tokens
- [ ] Replace `tailwind.config.js` content with the extended theme from design §2.2
- [ ] Add all CSS custom properties to `src/index.css` (colours, spacing, typography) per design §2.1
- [ ] Remove any hardcoded colour values from existing component files (`CameraView.tsx`, `DetectionFeed.tsx`, `Sidebar.tsx`)
- [ ] Verify Tailwind classes like `text-status-ok`, `bg-panel-alt`, `text-severity-high` resolve correctly
- **Refs:** design §2

### T-003 — Create `src/constants/` directory
- [ ] `roles.ts` — `UserRole` const object + `ROLE_LABELS` map
- [ ] `routes.ts` — `ROUTES` typed constant object (all app routes, including `ANALYTICS`)
- [ ] `permissions.ts` — `ROUTE_PERMISSIONS` map (including `ANALYTICS`) + `ROLE_LANDING` map
- [ ] `alertStatus.ts` — `AlertStatus` const + type
- [ ] `severity.ts` — `Severity` const + type
- [ ] `ppeTypes.ts` — `PPE_TYPES` array with id, label, color
- [ ] `app.ts` — `SESSION_TTL_MS`, `EXPIRY_CHECK_MS`, `WS_RECONNECT_MAX_MS`, `PAGE_SIZE_DEFAULT`, `PAGE_SIZE_AUDIT`, `TOP_ZONES_COUNT`, `NOTIFICATION_MAX`, `VIEW_MODE_DEFAULT` ('single'), `VIEW_MODE_STORAGE_KEY` ('monitoring_view_mode')
- **Refs:** design §4

### T-004 — Extend seed data
- [ ] Extend `src/data/mockData.ts` — add `acknowledgedBy`, `acknowledgedAt`, `resolvedBy`, `resolvedAt`, `createdAt` fields to `DetectionEvent`/`Alert` type; populate values for acknowledged/resolved/escalated seed entries
- [ ] Create `src/data/zones.ts` — 6 zones with `id`, `name`, `description`, `requiredPPE[]`, `svgCoordinates`, `active`
- [ ] Create `src/data/workers.ts` — 15 seed workers with `id`, `name`, `department`, `complianceRate`, `violations`, `currentZone`, `lastSeen`
- [ ] Create `src/data/reports.ts` — generate daily/weekly/monthly/worker-wise report data from seed workers
- [ ] Create `src/data/alertConfig.ts` — default `escalationDelayMs`, confidence thresholds per zone
- **Refs:** requirements §6, US-ALERT-05

### T-005 — Create `src/lib/` service singletons
- [ ] `lib/audit/auditLog.ts` — in-memory append-only log with `append(entry)` and `query(filters)` functions
- [ ] `lib/queryClient.ts` — TanStack Query `QueryClient` singleton with default stale times
- [ ] `lib/utils.ts` — `formatDate`, `formatDuration`, `formatComplianceRate`, `exportToCSV`, `generateExcelWorkbook`
- **Refs:** design §3

### T-006 — Create `src/api/` layer (all files, mock implementations)
- [ ] `api/authApi.ts` — `login()`, `logout()`, `forgotPassword()`, `resetPassword()`, `getProfile()`, `updateProfile()`
- [ ] `api/alertsApi.ts` — `getAlerts()`, `getAlertById()`, `acknowledgeAlert()`, `resolveAlert()`
- [ ] `api/workersApi.ts` — `getWorkers()`, `getWorkerById()`, `getWorkerZoneLog()`
- [ ] `api/camerasApi.ts` — `getCameras()`, `getCameraById()`, `createCamera()`, `updateCamera()`, `testCameraConnection()`
- [ ] `api/zonesApi.ts` — `getZones()`, `getZoneById()`, `createZone()`, `updateZone()`
- [ ] `api/reportsApi.ts` — `getDailyReport()`, `getWeeklyReport()`, `getMonthlyReport()`, `getWorkerComplianceReport()`, `getAdHocReport()`, `getKpiSummary()` (incl. avg response time)
- [ ] `api/adminApi.ts` — `getUsers()`, `createUser()`, `updateUser()`, `getAuditLog()`, `getSystemHealth()`, `getAlertConfig()`, `saveAlertConfig()`
- **Refs:** design §5


### T-007 — Create Zustand stores
- [ ] `lib/auth/mockAuthService.ts` — in-memory user store with 5 seed users (per requirements §6.1), `login()` returns mock token with `expiresAt = now + SESSION_TTL_MS`, `assignedZones` on supervisor record
- [ ] `lib/auth/authStore.ts` — Zustand store with `user`, `token`, `tokenExpiresAt`, `login()`, `logout()`, `checkExpiry()`; persisted via `persist` middleware to `localStorage['ppe_auth']`; starts `setInterval(checkExpiry, EXPIRY_CHECK_MS)` on first hydration
- [ ] `lib/websocket/wsStore.ts` — Zustand `WsStatus` store
- [ ] `lib/alerts/mockAlertService.ts` — in-memory alert CRUD with seed data; `acknowledge()` writes `acknowledgedBy`/`acknowledgedAt`; `resolve()` writes `resolvedBy`/`resolvedAt`/`resolutionNotes`
- [ ] `lib/alerts/alertStore.ts` — Zustand store with `alerts[]`, `unreadCount`, `addAlert()`, `updateStatus()`, `markRead()`, `runEscalationCheck()` (reads `escalationDelayMs` from alert-config); starts 60-s escalation interval
- [ ] `lib/notifications/notificationStore.ts` — Zustand store per design §7.1 with `items[]`, `unreadCount`, `isDrawerOpen`, full action set
- **Refs:** design §7.1, US-AUTH-06, US-ALERT-04

### T-008 — Create MockWebSocketService
- [ ] `lib/websocket/mockWebSocketService.ts` — implements `IWebSocketService`; emits all 7 event types on random timer (2–4 s); simulates disconnect/reconnect every ~90 s; exponential back-off reconnect (max `WS_RECONNECT_MAX_MS`)
- [ ] `lib/websocket/useWebSocket.ts` — custom hook; mounts service; dispatches to stores; updates WS status in `wsStore`
- **Refs:** design §8

### T-009 — Create shared UI primitives (`src/components/ui/`)
- [ ] `Badge.tsx` — all variants using token classes per design §12.3
- [ ] `Button.tsx` — primary / secondary / ghost / icon-button variants; keyboard accessible
- [ ] `Card.tsx` — surface container with optional header/footer slots
- [ ] `Dialog.tsx` — modal with focus trap, ESC close, aria-modal
- [ ] `Drawer.tsx` — slide-in panel (configurable side), focus trap, ESC close
- [ ] `EmptyState.tsx` — icon + heading + message + optional action button
- [ ] `ErrorBoundary.tsx` — React error boundary with fallback UI
- [ ] `Input.tsx` — text, password (show/hide toggle), error state, aria-describedby
- [ ] `LoadingSkeleton.tsx` — shimmer variants: `table`, `card`, `chart`, `kpi`
- [ ] `MultiSelect.tsx` — chip-based multi-value select with search
- [ ] `Select.tsx` — single-value select dropdown
- [ ] `Slider.tsx` — accessible range slider with value label
- [ ] `Spinner.tsx` — animated loading indicator
- [ ] `DataTable.tsx` — generic sortable + paginated table per design §12.2; uses `EmptyState` and `LoadingSkeleton` internally
- [ ] `DateRangePicker.tsx` — start/end date inputs with validation
- [ ] `Toast.tsx` — thin wrapper over `react-hot-toast`; exports `toast.success`, `toast.error`, `toast.info`
- [ ] `Tooltip.tsx` — hover tooltip with keyboard support
- **Refs:** design §12

### T-010 — Create layouts
- [ ] `layouts/AuthLayout.tsx` — centered card (max-w-md) on dark bg
- [ ] `layouts/PrintLayout.tsx` — print-only wrapper; hides sidebar/header; shows report header (site, generated by/at, filters)
- [ ] `layouts/AppLayout.tsx` — sidebar (240 px → 64 px collapsible) + header (logo, WS status, bell, avatar) + `<Outlet />`; mounts `useWebSocket()` once; renders `NotificationCenterDrawer`; "Analytics" nav item appears below "Live Monitoring" for permitted roles (admin, safety_officer, site_supervisor, ehs_manager)
- **Refs:** design §13

### T-011 — Create router
- [ ] `router/RoleGuard.tsx` — reads `ROUTE_PERMISSIONS`, redirects to role landing + toast on forbidden access
- [ ] `router/ProtectedRoute.tsx` — calls `authStore.checkExpiry()`; redirects to `/login` on expired/absent token
- [ ] `router/index.tsx` — full route tree per design §6.1 (including `/analytics`); all routes wrapped in correct guards; lazy-loaded feature pages via `React.lazy`
- [ ] Update `src/App.tsx` — wrap app in `QueryClientProvider`, `Toaster`, `RouterProvider`
- **Refs:** design §6

---

## Phase 2 — Authentication

### T-012 — Login page
- [ ] `features/auth/LoginPage.tsx` — username + password fields, show/hide toggle, inline error message, submit redirects to `ROLE_LANDING[user.role]`
- [ ] Calls `authApi.login()` → writes to `authStore`
- [ ] Loading state on submit button
- [ ] "Forgot password?" link to `/forgot-password`
- **Refs:** US-AUTH-01

### T-013 — Forgot / Reset password pages
- [ ] `features/auth/ForgotPasswordPage.tsx` — email field, success message, calls `authApi.forgotPassword()` (mock)
- [ ] `features/auth/ResetPasswordPage.tsx` — reads `?token=` param, new password + confirm fields, password strength indicator, calls `authApi.resetPassword()`, redirects to `/login` with success toast
- **Refs:** US-AUTH-02

### T-014 — User profile page
- [ ] `features/auth/ProfilePage.tsx` — display name, email (editable), role badge (read-only), last login timestamp
- [ ] Change password section: current password + new + confirm, mock validation
- [ ] Save with success toast; calls `authApi.updateProfile()`
- **Refs:** US-AUTH-05

### T-015 — Session expiry & logout
- [ ] Verify `authStore` 60-s interval calls `checkExpiry()` and redirects + shows toast on expiry
- [ ] Verify `ProtectedRoute` calls `checkExpiry()` on every mount/navigation
- [ ] Logout action: clears store + localStorage + disconnects WS + clears query cache + navigates `/login`
- [ ] Logout accessible from sidebar footer and header avatar menu
- **Refs:** US-AUTH-03, US-AUTH-06, NFR-SEC

---

## Phase 3 — Shared Widgets & Notification Center

### T-016 — KPICard widget
- [ ] `components/widgets/KPICard.tsx` — value display, trend indicator (up/down arrow + delta %), optional sparkline (Recharts `LineChart` minimal), loading skeleton, `isLoading` prop
- **Refs:** US-REPORT-06, design §10.1

### T-017 — ComplianceGauge widget
- [ ] `components/widgets/ComplianceGauge.tsx` — Recharts `RadialBarChart`; green ≥ 80%, amber 60–79%, red < 60%; animated on value change; shows numeric % in centre
- **Refs:** design §10.1

### T-018 — TopViolatingZonesWidget (moved to Analytics page)
- [ ] `components/widgets/TopViolatingZonesWidget.tsx` — time window dropdown (Last Hour / Last 4h / Last 8h / Today), ranked list of up to 5 zones with violation count bar, `onZoneClick` callback filters ZoneGrid, `assignedZones` filter prop, updates on `top_zones_update` WS event, empty state; rendered on AnalyticsPage
- **Refs:** US-MON-06, US-MON-07, design §10.1

### T-019 — AlertFeedWidget (moved to Monitoring page side panel)
- [ ] `components/widgets/AlertFeedWidget.tsx` — compact embeddable list of last N alerts (prop-configurable); severity + status badges; click opens `AlertDetailPanel`; "View all →" link; rendered in right-side panel of MonitoringPage
- **Refs:** design §10.1

### T-020 — WorkerStatusWidget (moved to Analytics page)
- [ ] `components/widgets/WorkerStatusWidget.tsx` — summary counts (Total / Compliant / Non-Compliant / Unknown) + Recharts `PieChart`; updates via WS `worker_update` events; `assignedZones` filter prop; rendered on AnalyticsPage
- **Refs:** design §10.1

### T-021 — CameraStatusWidget (moved to Analytics page)
- [ ] `components/widgets/CameraStatusWidget.tsx` — grid of camera status dots (online/offline/error) from `useQuery(['cameras'])`; click navigates to monitoring filtered to that camera; rendered on AnalyticsPage
- **Refs:** design §10.1

### T-022 — PlantLayoutWidget
- [ ] Create `public/plant-layout.svg` — placeholder SVG with 6 labelled zone areas, each with `data-zone-id` attribute
- [ ] `components/widgets/PlantLayoutWidget.tsx` — renders SVG, colours zones by compliance level using token CSS vars, click fires `onZoneClick`, `aria-label` per zone, `readonly` prop disables click
- **Refs:** design §10.1, US-MON-06

### T-023 — IncidentReportWidget
- [ ] `components/widgets/IncidentReportWidget.tsx` — "Generate Incident Report" button; renders hidden `PrintLayout` div with full report content; calls `window.print()`
- [ ] Report includes: alert ID, incident datetime, zone, camera, worker ID, missing PPE, snapshot placeholder, acknowledgement details, resolution details, escalation flag, generated-by/at
- **Refs:** design §10.1

### T-024 — Notification Center Drawer
- [ ] `lib/notifications/notificationStore.ts` verified complete (T-007)
- [ ] `components/widgets/NotificationCenterDrawer.tsx` (or `features/notifications/`) — `Drawer` 400 px right, filter tabs (All / Alerts / Escalated / System), notification items with icon + badge + "View →" link, "Mark all read", "Load older", `aria-label="Notification Center"`
- [ ] Bell icon in `AppLayout` header wired to `notificationStore.openDrawer()`; badge shows `unreadCount` capped at `NOTIFICATION_MAX`
- **Refs:** design §11, US-ALERT-06

### T-025 — WsStatusBanner
- [ ] `components/ui/WsStatusBanner.tsx` — reads `wsStore.status`; three visual states; manual retry button on disconnected; `role="status"` `aria-live="polite"`
- [ ] Integrate into `AppLayout` header
- **Refs:** US-MON-05, NFR-RT-03


---

## Phase 4 — Live Monitoring

### T-026 — Role-specific dashboards scaffold (superseded by T-026A/B)
- [ ] ~~`features/dashboards/SafetyOfficerDashboard.tsx` — widget layout per design §10.2; site-wide data; no zone filter applied~~
- [ ] ~~`features/dashboards/SiteSupervisorDashboard.tsx` — same widget layout; all widgets receive `assignedZones={user.assignedZones}` from `authStore`; zone filter cannot be cleared~~
- [ ] ~~`features/monitoring/MonitoringPage.tsx` — renders `SafetyOfficerDashboard` or `SiteSupervisorDashboard` based on `user.role`; admin/ehs_manager see `SafetyOfficerDashboard` read-only~~
- **Refs:** ~~US-MON-01, design §10.2~~ (superseded by v1.4 split)

### T-026A — ViewModeToggle widget
- [ ] `components/widgets/ViewModeToggle.tsx` — segmented button toggle (Grid View / Single View) with LayoutGrid and Monitor icons
- [ ] Active state: `bg-accent/15 text-accent`; inactive: `text-text-muted hover:text-text-secondary`
- [ ] Reads from `sessionStorage[VIEW_MODE_STORAGE_KEY]` on mount; defaults to `VIEW_MODE_DEFAULT` ('single')
- [ ] Writes to `sessionStorage` on change; calls `onViewModeChange` callback
- [ ] Keyboard accessible (Tab + Enter/Space)
- **Refs:** US-MON-08, design §10.1

### T-026B — Monitoring page (camera feeds + side panels)
- [ ] `features/monitoring/MonitoringPage.tsx` — page shell with ViewModeToggle in header; renders CameraGrid (Grid View) or CameraDetailPanel (Single View) based on toggle state
- [ ] Right-side panel: AlertFeedWidget + LiveWorkerList
- [ ] Site Supervisor: all data filtered to `user.assignedZones`
- [ ] Default view mode: 'single' for Safety Officer landing (reads from sessionStorage, falls back to VIEW_MODE_DEFAULT)
- **Refs:** US-MON-01, US-MON-02, US-MON-02B, US-MON-08, design §10.2

### T-026C — Analytics page (compliance stats + widgets)
- [ ] `features/monitoring/AnalyticsPage.tsx` — page shell; renders ComplianceStats, WorkerStatusWidget, CameraStatusWidget, TopViolatingZonesWidget, ZoneGrid
- [ ] Row 1: ComplianceStats (ComplianceGauge + bar chart + area chart)
- [ ] Row 2: WorkerStatusWidget | CameraStatusWidget | TopViolatingZonesWidget (lg:col-span-2)
- [ ] Row 3: ZoneGrid (responsive grid of ZoneCard components)
- [ ] Site Supervisor: all widgets receive `assignedZones={user.assignedZones}` filter
- [ ] TopViolatingZonesWidget `onZoneClick` filters ZoneGrid to selected zone
- **Refs:** US-MON-07, US-MON-06, US-MON-03, design §10.2

### T-027 — Zone grid & zone cards (moved to Analytics page)
- [ ] `features/monitoring/ZoneCard.tsx` — zone name, compliance %, worker count, active violations, highest severity badge; red pulsing border if high-severity violation active; updates on `zone_compliance_update` WS event; click fires zone filter
- [ ] `features/monitoring/ZoneGrid.tsx` — responsive grid of `ZoneCard`; filtered by selected zone if one is active (from TopViolatingZonesWidget click); `LoadingSkeleton variant="card"` while loading; rendered on AnalyticsPage
- **Refs:** US-MON-01, US-MON-07

### T-028 — Camera grid & camera cards
- [ ] `features/monitoring/CameraCard.tsx` — camera ID, zone, live/offline badge, FPS, latency, violation count; animated bounding-box SVG overlay on placeholder feed; "No Signal" state for offline cameras; click switches to Single View with that camera pre-selected
- [ ] `features/monitoring/CameraGrid.tsx` — grid filtered by selected zone; updates on `camera_metrics_update` WS event; `LoadingSkeleton variant="card"`
- [ ] `features/monitoring/CameraDetailPanel.tsx` — expanded single camera view with camera selector (horizontal pill buttons), full feed with LIVE badge/FPS/latency/bounding boxes, stats cards (Zone, Workers Detected, Active Violations, Status), and "Recent Events" panel (last 8 alerts from alertStore with severity badges)
- **Refs:** US-MON-02, US-MON-02B

### T-029 — Compliance statistics panel (moved to Analytics page)
- [ ] `features/monitoring/ComplianceStats.tsx` — `ComplianceGauge` + Recharts `BarChart` (violations per zone) + Recharts `LineChart` (violations last 60 min, rolling window); all update on WS events without flicker; rendered on AnalyticsPage
- **Refs:** US-MON-03, US-MON-07

### T-030 — Live worker list (moved to Monitoring page side panel)
- [ ] `features/monitoring/LiveWorkerList.tsx` — worker ID, name, current zone, compliance status, missing PPE chips; amber/red row highlight for non-compliant; click navigates to `/workers/:id`; updates on `worker_update` WS event; `EmptyState` if none detected; rendered in right-side panel of MonitoringPage
- **Refs:** US-MON-04

---

## Phase 5 — Alerts & Violations

### T-031 — Alerts page shell & real-time feed
- [ ] `features/alerts/AlertsPage.tsx` — page shell; renders `AlertFilters` + `AlertTable`
- [ ] `features/alerts/AlertTable.tsx` — reads from `alertStore.alerts`; prepends new alerts (with 3-s highlight fade on new rows); `escalated` rows pinned to top; click opens `AlertDetailPanel`
- [ ] `features/alerts/AlertRow.tsx` — severity badge + status badge (all 4 statuses incl. `escalated`); new-alert fade animation via CSS transition
- **Refs:** US-ALERT-01

### T-032 — Alert filters
- [ ] `features/alerts/AlertFilters.tsx` — severity multi-select, zone multi-select, status multi-select (incl. `escalated`), date range picker; active filters as dismissible chips; "Clear all" button
- [ ] Client-side filter applied to `alertStore.alerts` before render
- **Refs:** US-ALERT-02

### T-033 — Alert detail panel
- [ ] `features/alerts/AlertDetailPanel.tsx` — slide-in drawer; alert ID, datetime, camera, zone, worker, snapshot placeholder, missing PPE list with confidence values, severity badge, status badge, resolution history timeline
- [ ] `escalated` banner: "⚠ Escalated — this alert exceeded the configured response time and requires immediate attention."
- [ ] "Acknowledge" and "Resolve" buttons visible when status is `open` or `escalated`
- [ ] "Generate Incident Report" button → renders `IncidentReportWidget`
- **Refs:** US-ALERT-03

### T-034 — Acknowledge & Resolve workflow
- [ ] `features/alerts/AcknowledgeDialog.tsx` — confirm dialog; calls `alertsApi.acknowledgeAlert(id, actorName)`; writes `acknowledgedBy` + `acknowledgedAt` via mock service; updates `alertStore`; logs to audit trail
- [ ] `features/alerts/ResolveDialog.tsx` — resolution notes field (required, min 10 chars); calls `alertsApi.resolveAlert()`; writes `resolvedBy` + `resolvedAt` + notes; updates `alertStore`; logs to audit trail
- [ ] Resolved alerts: hide Acknowledge/Resolve buttons; status badge updates immediately
- **Refs:** US-ALERT-04

### T-035 — Alert history with accountability columns
- [ ] Alert history view: filter panel with "include resolved" toggle + date range + full-text search; paginated 25/page
- [ ] Table columns: ID · Timestamp · Zone · Worker ID · Missing PPE · Severity · Status · **Acknowledged By** · **Acknowledged At** · **Resolved By** · **Resolved At**
- [ ] Column search covers all text including accountability fields
- [ ] "Export CSV" — includes all columns; uses `exportToCSV` from `lib/utils.ts`
- [ ] "Export PDF" — `window.print()` via `PrintLayout`; includes filter criteria in report header
- **Refs:** US-ALERT-05

---

## Phase 6 — Worker Tracking

### T-036 — Worker list page
- [ ] `features/workers/WorkerListPage.tsx` — `DataTable` with worker ID, name, current zone ("Not detected" fallback), last seen, compliance rate, active violations; search by ID/name; filter by zone + compliance status; click navigates to profile; `EmptyState`
- **Refs:** US-WORKER-03

### T-037 — Worker profile page
- [ ] `features/workers/WorkerProfilePage.tsx` — worker ID, name, department, photo placeholder, total violations (all time), compliance rate (last 30 days), zones visited chips
- [ ] `features/workers/ComplianceHistoryChart.tsx` — Recharts `LineChart` (30 days); `LoadingSkeleton variant="chart"` while loading
- [ ] Recent violations list: last 10 with severity badge, datetime, zone, link to alert detail
- **Refs:** US-WORKER-01

### T-038 — Zone entry/exit log
- [ ] `features/workers/ZoneEntryExitLog.tsx` — table on profile page: entry time, exit time, zone, duration, compliance status during visit; filter by zone + date range; paginated 25/page
- **Refs:** US-WORKER-02

---

## Phase 7 — Reports & Analytics

### T-039 — Reports page shell & tab routing
- [ ] `features/reports/ReportsPage.tsx` — tab bar (Daily / Weekly / Monthly / By Worker / Ad-Hoc); each tab lazy-loaded; URL-driven tab state (`/reports?tab=daily`)
- **Refs:** design §14.1

### T-040 — Daily report
- [ ] `features/reports/DailyReport.tsx` — date picker (default today); KPI strip (overall compliance %, total workers, total violations); Recharts `BarChart` zone breakdown; shift-wise table (morning/afternoon/night); export buttons (Excel + PDF)
- [ ] Calls `reportsApi.getDailyReport(date)`
- **Refs:** US-REPORT-01

### T-041 — Weekly & monthly reports
- [ ] `features/reports/WeeklyReport.tsx` — week selector; Recharts `LineChart` (7-day trend); top-violating zones list; top-violating workers list; export buttons
- [ ] `features/reports/MonthlyReport.tsx` — month selector; Recharts `LineChart` (30-day trend); same breakdowns; export buttons
- **Refs:** US-REPORT-02

### T-042 — Zone-wise & category-wise statistics
- [ ] Zone-wise bar chart (sortable by compliance rate asc/desc) embedded in daily/weekly/monthly reports
- [ ] `features/reports/` — PPE category donut chart (Recharts `PieChart`); proportion of violations per PPE type; shift-wise breakdown table
- **Refs:** US-REPORT-03

### T-043 — Worker-wise compliance report (US-REPORT-07)
- [ ] `features/reports/WorkerComplianceReport.tsx` — date range picker (default current month); filters: zone multi-select, department multi-select, compliance rate threshold input
- [ ] `DataTable` with 9 columns (Worker ID, Name, Department, Total Shifts, Compliant Shifts, Violation Count, Compliance Rate %, Most Frequent Violation, Last Violation Date); sortable; paginated 25/page
- [ ] Row highlighting per design §14.2 using token classes
- [ ] Click row → navigate to `/workers/:workerId`
- [ ] "Export to Excel" — exports full filtered dataset via SheetJS; includes filter metadata in row 1
- [ ] "Export to PDF" — `window.print()` via `PrintLayout`
- [ ] `EmptyState` when no data matches filters
- **Refs:** US-REPORT-07

### T-044 — Ad-hoc analytics
- [ ] `features/reports/AdHocAnalytics.tsx` — filter panel (zone multi-select, date range, PPE type multi-select, severity); "Apply" button runs query via `reportsApi.getAdHocReport()`; auto-selects chart type per design §14.4; data table below chart; `EmptyState` and `LoadingSkeleton`
- **Refs:** US-REPORT-04

### T-045 — KPI summary page
- [ ] `features/reports/KpiSummaryPage.tsx` — renders `PlantManagementDashboard`
- [ ] Five `KPICard` widgets: Overall Compliance Rate, Total Active Violations, Zones at Risk, Workers Tracked Today, **Average Alert Response Time** (value + trend vs previous period)
- [ ] `PlantLayoutWidget` (read-only)
- [ ] Compliance spark line (no axes)
- [ ] Plain-language written summary section (generated from report data, no AI/model jargon)
- [ ] Calls `reportsApi.getKpiSummary()`
- **Refs:** US-REPORT-06

### T-046 — Export utilities
- [ ] Verify `lib/utils.ts` `exportToCSV(data, filename)` — generates CSV client-side using SheetJS; triggers download
- [ ] Verify `lib/utils.ts` `generateExcelWorkbook(sheets, filename)` — generates `.xlsx` with metadata row 1
- [ ] Verify `PrintLayout` + print CSS correctly hides all chrome and shows only report container on `window.print()`
- **Refs:** US-REPORT-05, US-REPORT-07, US-ALERT-05


---

## Phase 8 — Admin Console

### T-047 — Admin layout & sub-nav
- [ ] `features/admin/AdminLayout.tsx` — secondary horizontal tab bar (System Health | Users | Zones | Cameras | Alert Config | Audit Log); rendered inside `AppLayout` for all `/admin/*` routes
- **Refs:** design §13.2

### T-048 — User management page
- [ ] `features/admin/UserManagementPage.tsx` — `DataTable` (name, email, role badge, status badge, last login, assigned zones column for `site_supervisor` rows); search by name/email; filter by role + status; `EmptyState`
- [ ] `features/admin/UserFormModal.tsx` — create/edit modal: name, email, role selector, temporary password (create only); zone assignment `MultiSelect` appears only when role = `site_supervisor` (required, min 1 zone); validation
- [ ] "Deactivate/Activate" confirmation dialog; calls `adminApi.updateUser()`
- [ ] All mutations append to `auditLog`
- **Refs:** US-ADMIN-01

### T-049 — Zone configuration page
- [ ] `features/admin/ZoneConfigPage.tsx` — `DataTable` (name, description, required PPE chips, camera count, active status); `EmptyState`
- [ ] `features/admin/ZoneFormModal.tsx` — name, description, PPE checkboxes (all 6 types), severity threshold configuration; active toggle
- [ ] All mutations append to `auditLog`
- **Refs:** US-ADMIN-02

### T-050 — Camera management page
- [ ] `features/admin/CameraManagementPage.tsx` — `DataTable` (camera ID, name, RTSP URL masked, zone, status badge, last seen); `EmptyState`
- [ ] `features/admin/CameraFormModal.tsx` — name, RTSP URL, zone selector; "Test Connection" button (mock: 1-s delay then success/failure inline)
- [ ] All mutations append to `auditLog`
- **Refs:** US-ADMIN-03

### T-051 — Alert severity & threshold configuration
- [ ] `features/admin/AlertConfigPage.tsx` — per-zone + per-PPE-type threshold table; `Slider` for confidence threshold (0–1); severity selector per PPE-missing combination; escalation delay input (minutes)
- [ ] Save writes to mock config store (used by `alertStore.runEscalationCheck()`); appends to `auditLog`
- **Refs:** US-ADMIN-04

### T-052 — System health page
- [ ] `features/admin/SystemHealthPage.tsx` — per-camera status cards + backend service status cards (inference engine, database, WS broker); status badges (online/degraded/offline); last heartbeat timestamp; auto-refresh every 30 s via `useQuery` `refetchInterval`; alert banner if any component offline > 5 min
- [ ] Updates also driven by `system_health_update` WS event → `queryClient.invalidateQueries(['admin', 'system-health'])`
- **Refs:** US-ADMIN-05

### T-053 — Audit log viewer
- [ ] `features/admin/AuditLogPage.tsx` — `DataTable` (timestamp, actor, action type, entity, description, IP address); filter by actor, action type, date range; full-text search by description; paginated 50/page; "Export CSV" button
- [ ] Audit log fed by `auditLog.query(filters)` via `adminApi.getAuditLog()`
- **Refs:** US-ADMIN-06

---

## Phase 9 — Supporting Pages & Polish

### T-054 — 404 and 403 pages
- [ ] `pages/NotFoundPage.tsx` — friendly message, illustration, "Go to dashboard" link
- [ ] `pages/ForbiddenPage.tsx` — "You don't have permission to view this page." message, role + back link
- **Refs:** requirements §5

### T-055 — In-app help page
- [ ] `pages/HelpPage.tsx` — static page explaining each dashboard section in plain language (no jargon); sections per role
- **Refs:** requirements §5

### T-056 — Navigation polish
- [ ] Sidebar nav items rendered only for permitted roles (reads `ROUTE_PERMISSIONS`)
- [ ] Active route highlighted in sidebar
- [ ] Sidebar collapse/expand toggle; persists to `localStorage`
- [ ] Header avatar dropdown: "My Profile", "Help", "Logout"
- **Refs:** requirements §2.2, design §13.1

### T-057 — Loading & error states audit
- [ ] Verify every `useQuery` call has a `LoadingSkeleton` for loading state and `EmptyState` for empty data
- [ ] Verify every page is wrapped in `ErrorBoundary`
- [ ] Verify every form shows inline validation errors
- **Refs:** NFR-REL

### T-058 — Accessibility audit
- [ ] All icon-only buttons have `aria-label`
- [ ] All status badges have `<span className="sr-only">` text
- [ ] `Dialog` and `Drawer` trap focus correctly
- [ ] All interactive table rows are keyboard-navigable (Enter/Space)
- [ ] `WsStatusBanner` has `role="status"` and `aria-live="polite"`
- [ ] Notification Center Drawer has `role="dialog"` and `aria-label="Notification Center"`
- [ ] Plant layout zones have descriptive `aria-label`
- [ ] Verify colour contrast of all token values against `--color-bg` meets WCAG 2.1 AA
- **Refs:** NFR-A11Y

### T-059 — Responsive layout verification
- [ ] Test all pages at 1280 px viewport width (minimum)
- [ ] Test all pages at 1920 × 1080 (control-room display)
- [ ] Sidebar collapse works at both widths
- [ ] Camera grid and zone grid reflow correctly
- **Refs:** NFR-RESP

---

## Phase 10 — Integration & Final Verification

### T-060 — End-to-end role-based access verification
- [ ] Log in as each of the 5 seed users in turn
- [ ] Verify landing page is correct for each role
- [ ] Verify sidebar shows only permitted nav items per `ROUTE_PERMISSIONS`
- [ ] Verify direct URL access to forbidden routes redirects to landing page with toast
- [ ] Verify `site_supervisor` sees only Assembly Line + Welding Zone data across monitoring, alerts, and worker list
- **Refs:** US-AUTH-04, NFR-RBAC

### T-061 — Session expiry end-to-end
- [ ] Manually set `tokenExpiresAt` to a past timestamp in `localStorage` and reload — verify redirect to `/login` with "Session expired" toast
- [ ] Verify auth store interval fires expiry after simulated 60-s tick
- [ ] Verify logout clears all state (query cache, WS, localStorage)
- **Refs:** US-AUTH-06, NFR-SEC

### T-062 — WebSocket integration verification
- [ ] Verify zone compliance cards update on `zone_compliance_update` events
- [ ] Verify new alerts prepend to feed on `alert_new` events
- [ ] Verify escalation: create an `open` alert, wait for interval, verify badge changes to `escalated` and notification center receives item
- [ ] Verify `TopViolatingZonesWidget` updates on `top_zones_update` events
- [ ] Verify disconnect → reconnect cycle shows correct `WsStatusBanner` states and toast notifications
- **Refs:** US-MON-05, US-ALERT-04, US-MON-06

### T-063 — Export verification
- [ ] Verify "Export CSV" on alert history includes all accountability columns
- [ ] Verify "Export to Excel" on worker compliance report exports full filtered dataset (not just current page)
- [ ] Verify "Export PDF" via `window.print()` shows only report content (no sidebar/header)
- [ ] Verify "Generate Incident Report" from alert detail produces correct print output
- **Refs:** US-ALERT-05, US-REPORT-05, US-REPORT-07

### T-064 — Audit trail verification
- [ ] Create a user → verify audit log entry
- [ ] Edit a zone → verify audit log entry
- [ ] Acknowledge an alert → verify audit log entry
- [ ] Auto-escalate an alert → verify audit log entry
- [ ] Save alert config → verify audit log entry
- **Refs:** NFR-RBAC-03

### T-065 — Final build & lint check
- [ ] `npm run lint` passes with zero errors
- [ ] `npm run build` compiles without TypeScript errors
- [ ] No `console.error` or `console.warn` in browser DevTools during normal navigation
- [ ] Bundle size reviewed — no unexpectedly large chunks
- **Refs:** general

---

## Dependency Map

```
Phase 1 (Foundation)
  └── Phase 2 (Auth)
        └── Phase 3 (Widgets) ──────────────────────────┐
              └── Phase 4 (Monitoring)                   │
              └── Phase 5 (Alerts)                       │
              └── Phase 6 (Workers)                      │
              └── Phase 7 (Reports) ────────────────────>│
              └── Phase 8 (Admin)                        │
                    └── Phase 9 (Polish) ────────────────┘
                          └── Phase 10 (Verification)
```

Phases 4–8 can be worked in parallel once Phases 1–3 are complete.

---

## Task Count Summary

| Phase | Tasks | Subtasks (approx.) |
|---|---|---|
| 1 — Foundation | T-001 → T-011 | 11 tasks, ~65 subtasks |
| 2 — Authentication | T-012 → T-015 | 4 tasks, ~18 subtasks |
| 3 — Widgets | T-016 → T-025 | 10 tasks, ~28 subtasks |
| 4 — Monitoring | T-026 → T-030 | 7 tasks (T-026 superseded, T-026A/B/C added), ~22 subtasks |
| 5 — Alerts | T-031 → T-035 | 5 tasks, ~22 subtasks |
| 6 — Workers | T-036 → T-038 | 3 tasks, ~10 subtasks |
| 7 — Reports | T-039 → T-046 | 8 tasks, ~32 subtasks |
| 8 — Admin | T-047 → T-053 | 7 tasks, ~28 subtasks |
| 9 — Polish | T-054 → T-059 | 6 tasks, ~24 subtasks |
| 10 — Verification | T-060 → T-065 | 6 tasks, ~24 subtasks |
| **Total** | **67 tasks** | **~273 subtasks** |
