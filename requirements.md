# Requirements — Zone-Wise PPE Detection & Monitoring System

**Version:** 1.4  
**Date:** 2026-07-09  
**Status:** Draft — awaiting approval

### Changelog
| Version | Change |
|---|---|
| 1.4 | Set Single View as default for Safety Officer landing page; Safety Officer home page displays single camera feed with camera selector, stats cards, and recent events panel |
| 1.3 | Split Live Monitoring into two pages: `/monitoring` (camera feeds + live side panels) and `/analytics` (compliance stats, zone cards, workers widget, camera status, Top Violating Zones); added Grid/Single view-mode toggle to US-MON-02; added US-MON-07 (Analytics Page); added US-MON-08 (View-Mode Toggle); Analytics added to navigation for same roles as Live Monitoring |
| 1.2 | Enhanced US-ALERT-05 with accountability columns (Acknowledged By/At, Resolved By/At); added Average Alert Response Time KPI card to US-REPORT-06; added US-MON-06 Top Violating Zones widget |
| 1.1 | Added zone-assignment to user management (US-ADMIN-01); added Escalated alert status (US-ALERT-01, US-ALERT-04, US-ADMIN-04); added dedicated worker-wise compliance report with export (US-REPORT-07); added session expiry / forced re-login (US-AUTH-01, US-AUTH-06, NFR-SEC) |
| 1.0 | Initial draft |

---

## 1. Overview

A web-based frontend for a Zone-Wise PPE Detection & Monitoring System. The system ingests real-time CCTV feeds from industrial zones, detects PPE compliance (helmet, vest, mask, safety shoes, gloves), tracks workers across zones, applies zone-specific compliance rules, and generates severity-tagged alerts. Five user roles with distinct permissions drive routing, navigation, and data visibility.

---

## 2. User Roles & Permissions

| Role | Code | Description |
|---|---|---|
| System Administrator | `admin` | Full access including all configuration, user management, and audit logs |
| Safety Officer | `safety_officer` | Live monitoring, real-time alerts, worker tracking — site-wide |
| Site Supervisor | `site_supervisor` | Live monitoring, real-time alerts — scoped to **assigned zones** only (zones assigned in user management) |
| EHS Manager | `ehs_manager` | Reports, analytics, alerts (read-only to live monitoring) |
| Plant Management | `plant_mgmt` | KPI summary, reports, analytics — read-only |

> **Zone scoping for Site Supervisor:** A Site Supervisor account has one or more zones explicitly assigned to it by an Administrator. All data views (monitoring, alerts, worker list) are automatically filtered to those assigned zones and cannot be widened by the user.

### 2.1 Landing Dashboards by Role

| Role | Landing Page After Login |
|---|---|
| `admin` | Admin Console → System Health |
| `safety_officer` | Live Monitoring Dashboard |
| `site_supervisor` | Live Monitoring Dashboard (zone-filtered) |
| `ehs_manager` | Reports & Analytics |
| `plant_mgmt` | KPI Summary |

### 2.2 Navigation Visibility by Role

| Page / Feature | admin | safety_officer | site_supervisor | ehs_manager | plant_mgmt |
|---|:---:|:---:|:---:|:---:|:---:|
| Live Monitoring | ✓ (read) | ✓ | ✓ | ✓ (read) | – |
| Analytics | ✓ (read) | ✓ | ✓ | ✓ (read) | – |
| Alerts & Violations | ✓ | ✓ | ✓ | ✓ (read) | – |
| Worker Tracking | ✓ | ✓ | ✓ | ✓ (read) | – |
| Reports & Analytics | ✓ | – | – | ✓ | ✓ |
| KPI Summary | ✓ | – | – | ✓ | ✓ |
| Admin Console | ✓ | – | – | – | – |
| User Profile | ✓ | ✓ | ✓ | ✓ | ✓ |

> **Rule:** Navigation items must be rendered only for permitted roles. Direct URL access to a forbidden page must redirect to an appropriate page (e.g., 403 or role-specific landing), not just hide the link.

---

## 3. Functional Requirements

### 3.1 Authentication & Access

#### US-AUTH-01 — Login
**As** any user,  
**I want to** log in with a username and password,  
**so that** I can access the system with my assigned permissions.

**Acceptance Criteria:**
- [ ] Login page renders at `/login` and is publicly accessible (no auth required).
- [ ] Form has username, password fields and a submit button.
- [ ] Invalid credentials show an inline error message ("Invalid username or password").
- [ ] Successful login stores the session/token **and a `tokenExpiresAt` timestamp (now + 8 hours)** in the Zustand auth store and persists both to `localStorage`.
- [ ] After login, user is redirected to their role-specific landing page.
- [ ] All non-`/login` routes redirect to `/login` if the user is not authenticated.
- [ ] Password field has a show/hide toggle.

#### US-AUTH-02 — Forgot / Reset Password
**As** a user who has forgotten their password,  
**I want to** request a password reset link,  
**so that** I can regain access to my account.

**Acceptance Criteria:**
- [ ] "Forgot password?" link on the login page navigates to `/forgot-password`.
- [ ] User enters their email address and submits.
- [ ] Success state shows: "If that address is registered, a reset link has been sent."
- [ ] `/reset-password?token=<token>` page accepts a token, shows new-password + confirm-password fields.
- [ ] Password strength indicator is shown on the reset form.
- [ ] After successful reset, user is redirected to `/login` with a success toast.
- [ ] Mock service simulates token validation and returns success/error.

#### US-AUTH-03 — Logout
**As** any authenticated user,  
**I want to** log out,  
**so that** my session is terminated and the next user cannot access my account.

**Acceptance Criteria:**
- [ ] Logout action is accessible from the user-profile menu and sidebar footer.
- [ ] On logout: auth store is cleared, `localStorage` is cleared, WebSocket connection is closed, and user is redirected to `/login`.

#### US-AUTH-04 — Route Guards
**As** the system,  
**I want to** enforce role-based access on every protected route,  
**so that** users cannot access pages beyond their permission level.

**Acceptance Criteria:**
- [ ] A `ProtectedRoute` wrapper checks authentication on every non-public route.
- [ ] A `RoleGuard` wrapper checks role permissions for role-restricted routes.
- [ ] Unauthenticated access to any protected route → redirect to `/login`.
- [ ] Authenticated access to a forbidden role route → redirect to the user's landing page with a toast: "You do not have permission to view that page."
- [ ] Guards are enforced at the router level, not just via UI hiding.

#### US-AUTH-05 — User Profile
**As** any authenticated user,  
**I want to** view and edit my profile and change my password,  
**so that** I can keep my account information current.

**Acceptance Criteria:**
- [ ] Profile page at `/profile` shows: display name, email, role badge, last login timestamp.
- [ ] User can edit display name and email (mock save with success toast).
- [ ] User can change password by entering current password + new password + confirm (mock validation).
- [ ] Role badge is read-only.

#### US-AUTH-06 — Session Expiry & Forced Re-Login
**As** the system,  
**I want to** expire user sessions after 8 hours of token age,  
**so that** unattended workstations are not left indefinitely authenticated.

**Acceptance Criteria:**
- [ ] The auth store records `tokenExpiresAt = loginTime + 8 hours` when a session is created.
- [ ] On every route navigation and on every app mount, the `ProtectedRoute` guard reads `tokenExpiresAt` from the auth store (falling back to `localStorage`) and compares it to `Date.now()`.
- [ ] If the token is expired: auth state is cleared, WebSocket is closed, user is redirected to `/login`, and a toast displays: "Your session has expired. Please log in again."
- [ ] A background interval (every 60 seconds) in the auth store also checks expiry so expiry is caught even when the user is idle on a page without navigating.
- [ ] The session timer resets on each successful login (not on page reload).
- [ ] Mock login service accepts a `rememberMe` option that is reserved for future use but does not extend token TTL in v1.0.

---

### 3.2 Admin Console (`admin` only)

#### US-ADMIN-01 — User Management
**As** a System Administrator,  
**I want to** manage user accounts,  
**so that** I can control who has access and at what permission level.

**Acceptance Criteria:**
- [ ] User list page at `/admin/users` shows: name, email, role, status (active/inactive), last login.
- [ ] Table supports search by name/email and filter by role and status.
- [ ] "Create User" opens a modal/drawer: name, email, role selector, temporary password.
- [ ] When role is set to `site_supervisor`, a **zone assignment multi-select** appears in the form listing all active zones; at least one zone must be selected before the form can be saved.
- [ ] "Edit User" opens same form pre-populated; role and zone assignments can be changed.
- [ ] Changing a `site_supervisor`'s zone assignments takes effect immediately — their filtered data views update on next login or page refresh.
- [ ] For all other roles, the zone assignment field is hidden.
- [ ] User list table shows an additional **"Assigned Zones"** column for `site_supervisor` rows, displaying zone name chips (up to 3 shown, "+ N more" for overflow).
- [ ] "Deactivate/Activate" toggles user status with a confirmation dialog.
- [ ] All mutations are written to the mock audit log.
- [ ] Empty state: "No users found. Create the first user to get started."

#### US-ADMIN-02 — Zone Configuration
**As** a System Administrator,  
**I want to** define industrial zones and their PPE requirements,  
**so that** compliance rules can be enforced per zone.

**Acceptance Criteria:**
- [ ] Zone list page at `/admin/zones` shows: zone name, description, required PPE types (tags), number of cameras, active status.
- [ ] "Create Zone" form: name, description, required PPE checkboxes (Helmet, Vest, Mask, Safety Shoes, Gloves, Eye Protection), severity threshold configuration.
- [ ] "Edit Zone" updates existing zone.
- [ ] Deactivating a zone disables compliance checks for that zone.
- [ ] Required PPE types shown as colour-coded chips per zone row.
- [ ] All mutations logged to audit trail.

#### US-ADMIN-03 — Camera Management
**As** a System Administrator,  
**I want to** manage CCTV camera feeds,  
**so that** I can track which cameras are active and which zones they cover.

**Acceptance Criteria:**
- [ ] Camera list page at `/admin/cameras` shows: camera ID, name, RTSP URL (masked), assigned zone, status (online/offline/error), last seen timestamp.
- [ ] "Add Camera" form: name, RTSP URL, zone selector.
- [ ] "Edit Camera" updates name, RTSP URL, zone assignment.
- [ ] Status indicator is colour-coded: green = online, red = offline, amber = error.
- [ ] "Test Connection" button (mock) shows success/failure inline.
- [ ] All mutations logged to audit trail.

#### US-ADMIN-04 — Alert Severity & Threshold Configuration
**As** a System Administrator,  
**I want to** configure alert thresholds and severity mappings,  
**so that** the system generates alerts at the right sensitivity.

**Acceptance Criteria:**
- [ ] Settings page at `/admin/alert-config` shows current thresholds per zone and per PPE type.
- [ ] Editable fields: confidence threshold (0–1 slider), severity level per PPE-missing combination, escalation delay (minutes).
- [ ] Escalation delay defines the number of minutes an alert can remain in `open` or `acknowledged` status before it is automatically promoted to `escalated`.
- [ ] Save action writes to mock config store and logs to audit trail.
- [ ] Changes take effect immediately in mock WebSocket event generation.

#### US-ADMIN-05 — System Health
**As** a System Administrator,  
**I want to** see the health status of all system components,  
**so that** I can identify and resolve infrastructure issues.

**Acceptance Criteria:**
- [ ] System health page at `/admin/system-health` shows: per-camera status, backend service statuses (inference engine, database, WebSocket broker).
- [ ] Status indicators: online (green), degraded (amber), offline (red).
- [ ] Last heartbeat timestamp per component.
- [ ] Auto-refreshes every 30 seconds (mock).
- [ ] Alerts if any component has been offline > 5 minutes.

#### US-ADMIN-06 — Audit Log Viewer
**As** a System Administrator,  
**I want to** search and view a log of all configuration changes,  
**so that** I can audit who changed what and when.

**Acceptance Criteria:**
- [ ] Audit log page at `/admin/audit-log`.
- [ ] Columns: timestamp, actor (user), action type, entity (e.g. "User: john.doe"), description, IP address (mock).
- [ ] Filterable by actor, action type, date range.
- [ ] Searchable by description text.
- [ ] Paginated (50 rows per page).
- [ ] Export to CSV button (client-side generation).

---

### 3.3 Live Monitoring (`/monitoring`)

> **Scope change v1.3:** This page now contains **only** the camera feeds and the live side panels (alerts + workers). All compliance statistics, zone analytics, and the Top Violating Zones widget have moved to the new Analytics page (`/analytics`).

#### US-MON-01 — Live Camera Grid Page Shell
**As** a Safety Officer or Site Supervisor,  
**I want to** see live camera feeds from all zones with a view-mode toggle,  
**so that** I can monitor camera activity in the layout that suits my control-room context.

**Acceptance Criteria:**
- [ ] Page at `/monitoring`.
- [ ] Page header contains: page title "Live Monitoring", subtitle, and a **view-mode toggle** in the top-right (see US-MON-08).
- [ ] Main content area renders the camera grid (Grid View) or single camera view (Single View) based on the current toggle state.
- [ ] A right-side panel (collapsible or persistent at ≥ 1440px) shows the Live Alert Feed (`AlertFeedWidget`) and the Live Worker List.
- [ ] Site Supervisor sees only cameras in their assigned zones.

#### US-MON-02 — Live Camera Grid (Grid View)
**As** a Safety Officer,  
**I want to** see a live camera feed grid with detection overlays,  
**so that** I can visually confirm violations as they occur.

**Acceptance Criteria:**
- [ ] Grid View is the default view on first load and after a page refresh.
- [ ] Camera tiles arranged in a responsive grid (2 columns at 1280px, 3 at 1440px, 4 at 1920px).
- [ ] Each camera tile shows: camera ID, zone, LIVE/offline badge, FPS, latency, active violation count, simulated bounding-box overlays.
- [ ] Clicking a camera tile in Grid View switches to Single View with that camera pre-selected.
- [ ] Offline cameras display a grey "No Signal" placeholder with a `VideoOff` icon.
- [ ] Camera tiles update FPS and latency via WebSocket (`camera_metrics_update` events).

#### US-MON-02B — Single Camera View (Single View)
**As** a Safety Officer,  
**I want to** focus on one camera feed in full detail,  
**so that** I can examine a specific violation or area closely.

**Acceptance Criteria:**
- [ ] **Single View is the default view for Safety Officer landing page** — when a Safety Officer logs in, they land on `/monitoring` in Single View mode with the first camera pre-selected.
- [ ] Single View is also activated by the view-mode toggle or by clicking a camera tile in Grid View.
- [ ] A camera selector (horizontal pill buttons: CAM-01, CAM-02, CAM-03, CAM-04) at the top of the feed area lets the user switch between cameras without leaving Single View.
- [ ] The active camera feed shows: full-size feed placeholder (fills available width), LIVE badge, FPS, latency, camera ID, simulated bounding boxes with PPE labels (e.g., "no_helmet 0.89").
- [ ] Below the feed: a stats strip with four stat cards — Zone, Workers Detected, Active Violations, Status.
- [ ] Right-side panel: "Recent Events" showing the last 8 alerts for that camera (from `alertStore`), with timestamp, severity badge (HIGH/MEDIUM/LOW), and missing PPE description (e.g., "Missing helmet, vest, gloves").
- [ ] Switching cameras updates all of the above without page reload.
- [ ] The content of Single View reuses the existing `CameraDetailPanel` logic (not a new component).
- [ ] The view-mode toggle (Single/Grid) is visible in the top-right and allows switching to Grid View if desired.

#### US-MON-08 — View-Mode Toggle
**As** a Safety Officer,  
**I want to** switch between a multi-camera grid and a single focused camera view,  
**so that** I can choose the right display density for my task.

**Acceptance Criteria:**
- [ ] Toggle renders in the page header, top-right, as two segmented buttons: "Grid View" and "Single View".
- [ ] Active selection: `bg-accent/15 text-accent` background tint; inactive: `text-text-muted hover:text-text-secondary`.
- [ ] **Default state is "Single View"** for Safety Officers — `sessionStorage['monitoring_view_mode']` defaults to `'single'` if not set.
- [ ] Toggle state is stored in `sessionStorage['monitoring_view_mode']` and restored on page reload within the same session.
- [ ] Toggle is keyboard-accessible (Tab + Enter/Space).
- [ ] Icons: Grid View uses a Lucide `LayoutGrid` icon (16px); Single View uses a Lucide `Monitor` icon (16px), both preceding their label text.

#### US-MON-04 — Live Worker List (on Monitoring page)
**As** a Safety Officer,  
**I want to** see which workers are currently in each zone and their compliance status,  
**so that** I can intervene when a worker is non-compliant.

**Acceptance Criteria:**
- [ ] Worker list rendered in the right-side panel of `/monitoring` — not a separate section.
- [ ] Shows: worker ID, name, current zone, compliance status indicator.
- [ ] List updates via WebSocket (`worker_update` events).
- [ ] Clicking a worker row navigates to that worker's profile.
- [ ] Non-compliant workers have a red left-border accent.

#### US-MON-05 — WebSocket Connection Status
**As** any user on a real-time page,  
**I want to** see the connection status of the live data feed,  
**so that** I know when data may be stale.

**Acceptance Criteria:**
- [ ] Persistent WS status indicator in the app header: Connected (green dot + "Live"), Reconnecting… (amber pulsing dot + spinner), Disconnected (red dot + "Retry" link).
- [ ] On disconnect: toast "Live feed disconnected — attempting to reconnect." (infinite duration).
- [ ] On reconnect: dismiss disconnect toast, show "Live feed restored." (4s).
- [ ] Mock WebSocket simulates random disconnection/reconnection every ~90 seconds.
- [ ] `role="status"` and `aria-live="polite"` on the indicator element.

---

### 3.3A Analytics Dashboard (`/analytics`)

> **New in v1.3.** This page receives all compliance statistics, zone analytics, workers widget, camera summary, and the Top Violating Zones widget that were previously part of the Live Monitoring page.

#### US-MON-07 — Analytics Dashboard Page
**As** a Safety Officer or Site Supervisor,  
**I want to** see a consolidated analytics view of real-time compliance data,  
**so that** I can monitor trends, identify problem zones, and assess worker status without being distracted by camera feeds.

**Acceptance Criteria:**
- [ ] Page at `/analytics`.
- [ ] Accessible to the same roles as `/monitoring`: `admin`, `safety_officer`, `site_supervisor`, `ehs_manager`.
- [ ] Site Supervisor sees data scoped to their assigned zones only (same scoping rule as monitoring).
- [ ] Page renders the following widgets, all receiving WebSocket-driven updates:
  1. **Compliance Stats row** — Compliance Gauge + Violations-per-Zone bar chart + Violations-last-60-min area chart (existing `ComplianceStats` component).
  2. **Worker Status widget** — donut + legend (existing `WorkerStatusWidget`).
  3. **Camera Status widget** — camera chip grid (existing `CameraStatusWidget`).
  4. **Top Violating Zones widget** — ranked list + time window selector (existing `TopViolatingZonesWidget`). Clicking a zone name filters the zone compliance cards below.
  5. **Zone Compliance cards** — responsive grid of `ZoneCard` components with live compliance %, progress bar, worker count, violation badge (existing `ZoneGrid`).
- [ ] "Analytics" sidebar nav item appears immediately below "Live Monitoring" in the sidebar for all permitted roles.
- [ ] Clicking a zone card or a zone row in Top Violating Zones applies a zone filter to the zone cards grid — this filter is local to the page and can be cleared.
- [ ] Page header: title "Analytics", subtitle "Live compliance statistics and zone health".
- [ ] All widgets show loading skeletons on first load.
- [ ] All widgets show empty states when no data is available.

#### US-MON-06 — Top Violating Zones *(moved to Analytics page)*
**As** a Safety Officer,  
**I want to** quickly identify the zones generating the highest number of violations,  
**so that** I can prioritize inspections and corrective actions.

**Acceptance Criteria:**
- [ ] Widget is rendered on the **Analytics page** (`/analytics`), not on `/monitoring`. *(Changed from v1.2)*
- [ ] Widget shows the top five zones ranked by number of violations during the selected time window.
- [ ] Default time window: Last Hour. User can change to Last 4 Hours, Last 8 Hours, or Today using a dropdown.
- [ ] Each zone row displays: Zone Name, Violation Count.
- [ ] Widget updates automatically via WebSocket.
- [ ] Clicking a zone row filters the Zone Compliance cards grid on the Analytics page to that zone.
- [ ] Site Supervisors only see their assigned zones.
- [ ] Empty state: "No violations detected in the selected time period."
- [ ] Widget is built using the reusable `TopViolatingZonesWidget` component.

#### US-MON-03 — Real-Time Compliance Statistics *(moved to Analytics page)*
**As** a Safety Officer,  
**I want to** see live compliance statistics,  
**so that** I can track compliance rates as they change.

**Acceptance Criteria:**
- [ ] Compliance gauge, violations-per-zone bar chart, and violations-last-60-min area chart rendered on the **Analytics page** (`/analytics`). *(Changed from v1.2)*
- [ ] All charts update via WebSocket without page refresh and without visible flicker.

---

### 3.4 Alerts & Violations

#### US-ALERT-01 — Real-Time Alert Feed
**As** a Safety Officer or Site Supervisor,  
**I want to** see new alerts appear in real time,  
**so that** I can respond immediately to violations.

**Acceptance Criteria:**
- [ ] Alert feed page at `/alerts`.
- [ ] New alerts prepend to the list without a page refresh (WebSocket-driven).
- [ ] Each alert row: ID, timestamp, zone, worker ID, missing PPE item(s), severity badge (colour-coded), status badge.
- [ ] Severity colour coding: High = red, Medium = amber, Low = yellow, Info = blue.
- [ ] Status colour coding: Open = red outline, Acknowledged = amber outline, **Escalated = solid red with white text**, Resolved = green outline.
- [ ] New unread alerts are highlighted briefly (3-second fade) when they appear.
- [ ] The alert status field supports five values: `open`, `acknowledged`, `escalated`, `resolved`.

#### US-ALERT-02 — Alert Filters
**As** a Safety Officer,  
**I want to** filter the alert feed,  
**so that** I can focus on the most critical alerts.

**Acceptance Criteria:**
- [ ] Filter panel: severity (multi-select), zone (multi-select), status (open / acknowledged / **escalated** / resolved), date range.
- [ ] Filters apply instantly (client-side on mock data, server-side query params in production).
- [ ] Active filters shown as dismissible chips above the table.
- [ ] "Clear all filters" button.

#### US-ALERT-03 — Alert Detail View
**As** a Safety Officer,  
**I want to** see full detail for an alert,  
**so that** I can understand the context of the violation.

**Acceptance Criteria:**
- [ ] Clicking an alert row opens a detail panel/modal.
- [ ] Detail shows: alert ID, timestamp, camera ID, zone, worker ID, snapshot image (mock placeholder), list of missing PPE items, confidence scores per item, severity, current status, resolution history.
- [ ] If the alert status is `escalated`, a banner is displayed: "⚠ Escalated — this alert exceeded the configured response time and requires immediate attention."
- [ ] "Acknowledge" and "Resolve" buttons visible if alert is `open` or `escalated`.

#### US-ALERT-04 — Acknowledge & Resolve Workflow
**As** a Safety Officer,  
**I want to** acknowledge and resolve alerts,  
**so that** the team can track which violations have been acted on.

**Acceptance Criteria:**
- [ ] "Acknowledge" sets status → `acknowledged`, records acknowledger name and timestamp.
- [ ] "Resolve" opens a small form: resolution notes (required, min 10 chars), sets status → `resolved`.
- [ ] Status badge updates immediately in the list and detail view.
- [ ] Resolved alerts cannot be re-opened (UI hides those buttons).
- [ ] **Escalation logic:** A background interval (every 60 seconds) in the alert store checks all `open` and `acknowledged` alerts. If `Date.now() - alert.createdAt > escalationDelayMs` (read from the admin alert-config store), the alert status is automatically promoted to `escalated`.
- [ ] When an alert is promoted to `escalated`, a WebSocket event is emitted (mock) and the global notification bell count increments.
- [ ] `escalated` alerts are sorted to the top of the alert feed by default.
- [ ] All status changes (including auto-escalation) logged to mock audit trail.

#### US-ALERT-05 — Alert History
**As** an EHS Manager,  
**I want to** search historical alerts with full accountability information,  
**so that** I can investigate past incidents and support safety audits.

**Acceptance Criteria:**
- [ ] Alert history accessible via filter (include resolved = on).
- [ ] Date range picker (default: last 7 days).
- [ ] Full-text search on alert description / worker ID.
- [ ] Alert history table includes the following accountability columns:
  - **Acknowledged By** — display name of the user who acknowledged the alert (blank if not yet acknowledged).
  - **Acknowledged At** — timestamp of acknowledgement (blank if not yet acknowledged).
  - **Resolved By** — display name of the user who resolved the alert (blank if not yet resolved).
  - **Resolved At** — timestamp of resolution (blank if not yet resolved).
- [ ] All four accountability columns are searchable (full-text search covers their values).
- [ ] All four accountability columns are included in CSV export and PDF export.
- [ ] Mock seed data includes populated values for these fields on all `acknowledged`, `escalated`, and `resolved` alerts.
- [ ] Results paginated (25 per page).
- [ ] Export filtered results to CSV (including accountability columns).
- [ ] Export to PDF includes accountability columns in the printed table.

#### US-ALERT-06 — Global Notification Bell
**As** any authenticated user,  
**I want to** see a notification counter in the header,  
**so that** I'm aware of new unread alerts regardless of which page I'm on.

**Acceptance Criteria:**
- [ ] Bell icon in the global header shows unread alert count badge (capped at 99+).
- [ ] Clicking the bell opens a dropdown showing the 5 most recent unread alerts.
- [ ] "View all alerts" link in dropdown navigates to `/alerts`.
- [ ] Marking an alert as acknowledged removes it from the unread count.
- [ ] Count updates via WebSocket.

---

### 3.5 Worker Tracking

#### US-WORKER-01 — Worker Profile
**As** a Safety Officer,  
**I want to** view a worker's compliance history,  
**so that** I can identify habitual non-compliance.

**Acceptance Criteria:**
- [ ] Worker profile page at `/workers/:workerId`.
- [ ] Shows: worker ID, name, department, photo placeholder, total violations (all time), compliance rate (last 30 days), zones visited.
- [ ] Compliance history chart (line chart, last 30 days).
- [ ] List of recent violations (last 10) with links to alert detail.

#### US-WORKER-02 — Zone Entry/Exit Log
**As** a Safety Officer,  
**I want to** see a chronological log of a worker's zone movements,  
**so that** I can track where they were at any point in time.

**Acceptance Criteria:**
- [ ] Zone log section on worker profile page.
- [ ] Table: entry time, exit time, zone, duration, compliance status during visit.
- [ ] Filterable by zone and date range.
- [ ] Paginated (25 per page).

#### US-WORKER-03 — Worker List
**As** a Safety Officer,  
**I want to** browse all currently detected workers,  
**so that** I can quickly find a specific worker.

**Acceptance Criteria:**
- [ ] Worker list page at `/workers`.
- [ ] Table: worker ID, name, current zone (or "Not detected"), last seen, compliance rate, active violations.
- [ ] Search by worker ID or name.
- [ ] Filter by zone and compliance status.
- [ ] Clicking a row navigates to worker profile.

---

### 3.6 Reports & Analytics

#### US-REPORT-01 — Daily Compliance Report
**As** an EHS Manager,  
**I want to** view a daily compliance summary,  
**so that** I can report on PPE adherence for the day.

**Acceptance Criteria:**
- [ ] Reports page at `/reports`.
- [ ] Daily report tab: date picker (default: today), overall compliance %, total workers, total violations, zone-wise breakdown bar chart.
- [ ] Shift-wise compliance breakdown (morning, afternoon, night).

#### US-REPORT-02 — Weekly & Monthly Reports
**As** an EHS Manager,  
**I want to** view weekly and monthly compliance trends,  
**so that** I can identify patterns over time.

**Acceptance Criteria:**
- [ ] Weekly tab: week selector, compliance trend line chart (7 days), top-violating zones, top-violating workers.
- [ ] Monthly tab: month selector, compliance trend line chart (30 days), same breakdowns.

#### US-REPORT-03 — Zone-Wise & Category-Wise Statistics
**As** an EHS Manager,  
**I want to** see statistics broken down by zone and PPE category,  
**so that** I can understand which areas and equipment have the most issues.

**Acceptance Criteria:**
- [ ] Zone-wise compliance bar chart (all zones, sortable).
- [ ] PPE category breakdown: pie or donut chart showing proportion of violations per PPE type.
- [ ] Shift-wise breakdown table.

#### US-REPORT-04 — Ad-Hoc Analytics Query
**As** an EHS Manager,  
**I want to** query compliance data by any combination of filters,  
**so that** I can answer ad-hoc questions without waiting for a scheduled report.

**Acceptance Criteria:**
- [ ] Ad-hoc query page at `/reports/analytics`.
- [ ] Filter panel: zone (multi-select), date range, PPE type (multi-select), severity.
- [ ] Results shown as both a chart (line or bar, auto-selected by data shape) and a data table.
- [ ] "Apply" runs the query against mock data and re-renders chart + table.

#### US-REPORT-05 — Export
**As** an EHS Manager,  
**I want to** export reports to PDF and Excel,  
**so that** I can share them with stakeholders who don't have system access.

**Acceptance Criteria:**
- [ ] Export buttons on daily, weekly, and monthly report pages.
- [ ] PDF export: renders the current view into a printable layout using `window.print()` or a PDF library.
- [ ] Excel export: generates a `.xlsx` file client-side using a library (e.g., SheetJS).
- [ ] Export includes the active filter state in the report header.

#### US-REPORT-06 — KPI Summary (Plant Management)
**As** a Plant Manager,  
**I want to** see a simple, visual KPI summary,  
**so that** I can understand overall site safety without needing to interpret technical data.

**Acceptance Criteria:**
- [ ] KPI summary page at `/kpi`.
- [ ] Large KPI cards (each using the reusable `KPICard` widget):
  - Overall Compliance Rate
  - Total Active Violations
  - Zones at Risk
  - Workers Tracked Today
  - **Average Alert Response Time** — defined as the mean duration between alert creation and first acknowledgement across all alerts in the current reporting period. Displayed in human-readable format (e.g., "3m 42s"). Shows "—" if no acknowledged alerts exist in the period.
- [ ] The Average Alert Response Time card includes a simple trend indicator: an up-arrow (worse — response time increased) or down-arrow (better — response time decreased) with a percentage delta compared to the previous equivalent period (e.g., previous day or previous week depending on the selected time window). No trend arrow if no prior-period data is available.
- [ ] Simple compliance trend spark line (no axis labels — just the trend shape).
- [ ] Written summary section: plain-language interpretation (e.g., "Assembly Line compliance is below target this week.").
- [ ] No model/AI jargon — avoid terms like "inference", "confidence score", "bounding box".
- [ ] Read-only, no action buttons.

#### US-REPORT-07 — Worker-Wise Compliance Report
**As** an EHS Manager,  
**I want to** see a dedicated report table of compliance statistics per worker,  
**so that** I can identify habitual non-compliant individuals and export the data for HR or safety reviews.

**Acceptance Criteria:**
- [ ] Worker-wise report accessible as a tab on the `/reports` page (label: "By Worker").
- [ ] Table columns: Worker ID, Worker Name, Department, Total Shifts (in period), Compliant Shifts, Violation Count, Compliance Rate (%), Most Frequent Violation (PPE type), Last Violation Date.
- [ ] Date range picker (default: current month) filters the table data.
- [ ] Additional filters: zone (multi-select), department (multi-select), compliance rate threshold (e.g., show workers below X%).
- [ ] Table is sortable by any column (click column header).
- [ ] Rows with compliance rate below 70% are highlighted in amber; below 50% in red.
- [ ] "Export to Excel" button exports the full filtered dataset (not just the visible page) as `.xlsx` using SheetJS.
- [ ] "Export to PDF" button generates a printable report with the active filter criteria in the header.
- [ ] Clicking a worker row navigates to `/workers/:workerId` (worker profile page).
- [ ] Paginated: 25 rows per page with page controls.
- [ ] Empty state: "No worker data found for the selected period and filters."

---

## 4. Non-Functional Requirements

### 4.1 Real-Time Communication
- NFR-RT-01: Live monitoring and alert pages must receive data via WebSocket (or SSE). Polling is not acceptable.
- NFR-RT-02: WebSocket client must implement exponential back-off reconnection (max 30 s).
- NFR-RT-03: A visible connection status indicator must appear on all real-time pages.

### 4.2 Role-Based Access Control
- NFR-RBAC-01: Every protected route must verify authentication at the router level before rendering.
- NFR-RBAC-02: Every role-restricted route must verify role at the router level; UI-only hiding is insufficient.
- NFR-RBAC-03: Audit log entries must be generated for all admin mutations.

### 4.3 Security
- NFR-SEC-01: Session token TTL is 8 hours from login time. Expired sessions must force re-login.
- NFR-SEC-02: `ProtectedRoute` must check `tokenExpiresAt` on every mount and navigation event.
- NFR-SEC-03: A background interval (60-second tick) in the auth store must also enforce expiry for idle sessions.
- NFR-SEC-04: On session expiry, all cached query data (TanStack Query), auth store state, and WebSocket connections must be cleared before redirect.
- NFR-SEC-05: `tokenExpiresAt` stored in `localStorage` must be validated on app startup to prevent stale sessions surviving a browser restart.

### 4.4 Performance
- NFR-PERF-01: Initial page load (LCP) should be under 2.5 s on a standard connection.
- NFR-PERF-02: Real-time UI updates must not cause visible layout flicker.
- NFR-PERF-03: Charts must handle up to 1 000 data points without freezing.

### 4.5 Accessibility
- NFR-A11Y-01: All interactive elements must be keyboard navigable.
- NFR-A11Y-02: Colour must not be the only means of conveying status (pair with icons/text).
- NFR-A11Y-03: WCAG 2.1 AA colour contrast ratios must be met.
- NFR-A11Y-04: ARIA labels on icon-only buttons and status indicators.

### 4.6 Responsiveness
- NFR-RESP-01: Layout must be usable on a 1 080p desktop monitor and a 1 920 × 1 080 control-room display.
- NFR-RESP-02: Minimum tested viewport: 1 280 px wide.

### 4.7 Reliability
- NFR-REL-01: Empty states must be provided for every list, table, and chart (no blank screens).
- NFR-REL-02: Loading skeletons must be shown for every data-backed component.
- NFR-REL-03: Error boundaries must prevent a single component crash from bringing down the whole page.

---

## 5. Supporting Pages

| Page | Route | Notes |
|---|---|---|
| 404 Not Found | `*` | Friendly message, link back to dashboard |
| Forbidden (403) | `/forbidden` | Shown when role guard blocks access |
| Analytics Dashboard | `/analytics` | Same permitted roles as `/monitoring`; composed entirely from existing widgets |
| In-App Help | `/help` | Static page describing each dashboard section |

---

## 6. Mock Data & Services

Since no backend is available during frontend development, the following must be mocked:

| Service | Mock Strategy |
|---|---|
| Authentication API | In-memory mock with 5 seed users (one per role); issues a mock JWT-like token with `expiresAt = now + 8h` |
| Session expiry | Auth store background interval checks `tokenExpiresAt` every 60 s; `ProtectedRoute` checks on every mount/navigation |
| Camera & zone data | Static seed data in `src/data/` |
| Alert data | Static seed + WebSocket simulation; seed includes alerts in all five statuses (`open`, `acknowledged`, `escalated`, `resolved`); `acknowledged` and `resolved` alerts include populated `acknowledgedBy`, `acknowledgedAt`, `resolvedBy`, `resolvedAt` fields |
| Alert escalation | Alert store background interval (60 s) checks `open`/`acknowledged` alerts against `escalationDelayMs` from alert-config store |
| Worker data | Static seed data |
| WebSocket | `MockWebSocketService` emitting randomised events on a timer |
| Audit log | In-memory append-only log updated by admin mutations |
| Report data | Generated from seed data on the fly |
| PDF export | `window.print()` with a print stylesheet |
| Excel export | SheetJS (`xlsx` package) |

### 6.1 Seed Users

| Username | Password | Role | Assigned Zones (site_supervisor only) |
|---|---|---|---|
| `admin` | `admin123` | System Administrator | — |
| `officer` | `officer123` | Safety Officer | — |
| `supervisor` | `super123` | Site Supervisor | Assembly Line, Welding Zone |
| `ehs` | `ehs123` | EHS Manager | — |
| `manager` | `mgmt123` | Plant Management | — |

---

## 7. Out of Scope (v1.0)

- Actual RTSP/video stream rendering (replaced by animated placeholder)
- Backend API integration (all data mocked)
- Mobile/tablet layouts (< 1 280 px)
- Push notifications (browser notifications API)
- Internationalisation / multi-language support
- Dark/light theme toggle (single dark industrial theme)
