# Design System — Zone-Wise PPE Detection & Monitoring System

**Version:** 1.0  
**Date:** 2026-07-09  
**Status:** Approved — Single Source of Truth  
**Project:** PPE Detection & Monitoring System  
**Stack:** React 19 · Vite · TypeScript · Tailwind CSS · Recharts · Zustand · TanStack Query

---

> **Purpose of this document**  
> This design system specification is the authoritative reference for every visual, interaction, and structural decision in the frontend. No implementation decision that affects appearance, spacing, colour, typography, or component behaviour should be made without consulting this document first. If a scenario is not covered here, a design decision must be recorded here before it is implemented.

---

## 1. Design Philosophy

### 1.1 Goals

1. Provide a **unified visual language** that is consistent across all 20+ pages and 50+ component types.
2. Eliminate all ad-hoc visual decisions during implementation.
3. Enable **rapid, confident development** by removing ambiguity from every UI question.
4. Ensure the interface is **usable under fatigue** — safety officers and supervisors may monitor for 8-hour shifts.
5. Ensure **accessibility is structural**, not bolted on.

### 1.2 Core Principles

| # | Principle | Meaning |
|---|---|---|
| 1 | **Information first** | Data must never compete with chrome. UI elements exist to frame data, not to impress. |
| 2 | **Minimal cognitive load** | Every visual element must earn its place. Remove anything that does not aid comprehension or action. |
| 3 | **Status is always visible** | Any live system state (connection, compliance, alert level) must be visible without scrolling or navigating. |
| 4 | **One action per moment** | Each screen has a primary intent. Secondary actions are subordinate. |
| 5 | **Consistency over novelty** | Use established patterns. Never invent a new pattern when an existing one works. |
| 6 | **Accessible by default** | Keyboard navigation, screen readers, and colour-blind users are first-class concerns, not afterthoughts. |

### 1.3 Visual Language

The visual language is **dark industrial**. It draws from the aesthetic of professional monitoring dashboards used in air traffic control, SCADA systems, and network operations centres.

- **Dark base** — reduces eye strain during long sessions in control rooms.
- **Subdued chrome** — sidebar, header, and card borders are low-contrast so data stands out.
- **Semantic colour** — colour is used exclusively to communicate meaning (status, severity, compliance). It is never decorative.
- **Monospace for live data** — timestamps, IDs, fps, latency use monospace font to align numerals and aid scanning.
- **Proportional density** — information density scales with the nature of the page. Monitoring dashboards are dense; KPI summaries for plant management are spacious.

### 1.4 User Experience Goals

| User Type | Primary Need | Design Response |
|---|---|---|
| Safety Officer | Detect violations instantly | High-contrast status indicators, real-time feed at top of page, escalated alerts pinned to top |
| Site Supervisor | Zone-specific situational awareness | Zone filter always visible, assigned-zone scope enforced in all widgets |
| EHS Manager | Analyse trends and export data | Rich charts, sortable tables, export buttons on every report |
| Plant Management | Understand safety at a glance | Large KPI cards, plain language, no technical jargon, read-only interface |
| System Administrator | Configure and audit the system | Dense admin tables, inline editing, audit log always accessible |

### 1.5 Information Hierarchy

Information is presented in this order of visual prominence on every page:

1. **Critical status / active violations** (highest prominence — red, pulsing, top of page)
2. **Primary KPIs** (large type, KPI cards)
3. **Primary data table or chart**
4. **Secondary filters and controls**
5. **Navigation and chrome** (lowest prominence)

---

## 2. Color System

### 2.1 Design Token Definition

All colours are defined as CSS custom properties on `:root`. Tailwind consumes them via the theme extension. **No component file may use a hardcoded hex value or a raw Tailwind colour class (e.g., `text-red-400`).**

```css
:root {
  /* ── Backgrounds ─────────────────────────── */
  --color-bg:           #12151A;   /* Page / body background */
  --color-panel:        #1B1F27;   /* Sidebar, header, card surface */
  --color-panel-alt:    #20242D;   /* Alternate panel, input background, table header */
  --color-panel-hover:  #252A35;   /* Panel hover state */

  /* ── Borders ─────────────────────────────── */
  --color-border:       #262B34;   /* Primary border — card edges, dividers */
  --color-border-soft:  #21252D;   /* Subtle border — table rows, input outlines */
  --color-border-focus: #4A8FA3;   /* Focus ring — same as accent */

  /* ── Text ────────────────────────────────── */
  --color-text-primary:   #E8EAF0; /* Body text, headings, table cells */
  --color-text-secondary: #9BA3B8; /* Labels, descriptions, meta text */
  --color-text-muted:     #5C6480; /* Timestamps, placeholders, disabled text */
  --color-text-inverse:   #12151A; /* Text on light/filled backgrounds */

  /* ── Accent ──────────────────────────────── */
  --color-accent:         #4A8FA3; /* Primary interactive colour */
  --color-accent-hover:   #5AAEC4; /* Accent on hover */
  --color-accent-subtle:  rgba(74,143,163,0.12); /* Accent background tint (active nav, selected) */

  /* ── Status ──────────────────────────────── */
  --color-status-ok:      #4F9E7C; /* Online, compliant, healthy, resolved */
  --color-status-warn:    #D9A441; /* Warning, acknowledged, degraded, amber */
  --color-status-danger:  #C25450; /* Violation, offline, error, critical */
  --color-status-info:    #4A8FA3; /* Informational (same as accent) */

  /* ── Severity ────────────────────────────── */
  --color-severity-high:   #C25450; /* High severity PPE violation */
  --color-severity-medium: #D9A441; /* Medium severity */
  --color-severity-low:    #C9B84A; /* Low severity */
  --color-severity-info:   #4A8FA3; /* Informational */

  /* ── Alert Status ────────────────────────── */
  --color-alert-open:         #C25450; /* Open — outline red */
  --color-alert-acknowledged: #D9A441; /* Acknowledged — outline amber */
  --color-alert-escalated:    #C25450; /* Escalated — filled red (stronger than open) */
  --color-alert-resolved:     #4F9E7C; /* Resolved — outline green */

  /* ── Compliance ──────────────────────────── */
  --color-compliance-good:  #4F9E7C; /* ≥ 80% compliance */
  --color-compliance-warn:  #D9A441; /* 60–79% compliance */
  --color-compliance-bad:   #C25450; /* < 60% compliance */

  /* ── Analytics / Chart Palette ───────────── */
  --color-chart-1: #4A8FA3; /* Primary series — accent blue */
  --color-chart-2: #4F9E7C; /* Secondary series — green */
  --color-chart-3: #D9A441; /* Tertiary series — amber */
  --color-chart-4: #C25450; /* Quaternary series — red */
  --color-chart-5: #9B7EC8; /* Quinary series — violet */
  --color-chart-6: #C9B84A; /* Senary series — yellow */
  --color-chart-bg: rgba(74,143,163,0.08); /* Chart area fill */
  --color-chart-grid: #21252D; /* Axis grid lines */
  --color-chart-tick: #5C6480; /* Axis tick labels */
  --color-chart-tooltip-bg: #1B1F27;

  /* ── Typography ──────────────────────────── */
  --font-sans: 'IBM Plex Sans', system-ui, sans-serif;
  --font-mono: 'IBM Plex Mono', 'Fira Code', monospace;
}
```

### 2.2 Tailwind Token Mapping

```js
// tailwind.config.js — extend only, never override Tailwind base
colors: {
  bg:           'var(--color-bg)',
  panel:        'var(--color-panel)',
  'panel-alt':  'var(--color-panel-alt)',
  'panel-hover':'var(--color-panel-hover)',
  border:       'var(--color-border)',
  'border-soft':'var(--color-border-soft)',
  'border-focus':'var(--color-border-focus)',
  accent:       'var(--color-accent)',
  'accent-hover':'var(--color-accent-hover)',
  text: {
    primary:   'var(--color-text-primary)',
    secondary: 'var(--color-text-secondary)',
    muted:     'var(--color-text-muted)',
    inverse:   'var(--color-text-inverse)',
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
  alert: {
    open:         'var(--color-alert-open)',
    acknowledged: 'var(--color-alert-acknowledged)',
    escalated:    'var(--color-alert-escalated)',
    resolved:     'var(--color-alert-resolved)',
  },
  compliance: {
    good: 'var(--color-compliance-good)',
    warn: 'var(--color-compliance-warn)',
    bad:  'var(--color-compliance-bad)',
  },
  chart: {
    1: 'var(--color-chart-1)',
    2: 'var(--color-chart-2)',
    3: 'var(--color-chart-3)',
    4: 'var(--color-chart-4)',
    5: 'var(--color-chart-5)',
    6: 'var(--color-chart-6)',
  },
}
```

### 2.3 Color Usage Rules

| Token | Allowed Uses | Prohibited Uses |
|---|---|---|
| `bg` | Page body, full-bleed sections | Component surfaces, cards |
| `panel` | Sidebar, header, cards, dialogs, drawers | Page body, inputs |
| `panel-alt` | Table headers, input backgrounds, hover states, code blocks | Cards, sidebar |
| `accent` | Links, primary buttons, focus rings, active nav, selected states | Status indicators (use status tokens instead) |
| `status-ok` | Online badges, compliant workers, resolved alerts, positive KPIs | Any non-status purpose |
| `status-danger` | Violations, offline, errors, escalated alerts | Non-critical warnings |
| `status-warn` | Acknowledged alerts, degraded services, 60–79% compliance | Critical violations |
| `severity-high` | High-severity badge fill/text only | Background colours |
| `text-muted` | Timestamps, placeholders, secondary metadata | Primary labels, headings |
| `chart-1..6` | Recharts series colours only | Component colours, badges |

### 2.4 Background Layering Rules

Pages use a strict layering model to create visual depth without shadow overuse:

```
Layer 0: --color-bg            (page body)
Layer 1: --color-panel         (sidebar, header, cards, dialogs)
Layer 2: --color-panel-alt     (table header rows, input fields, secondary panels)
Layer 3: --color-panel-hover   (hover states on layer 1/2 surfaces)
```

> **Rule:** Never place a `panel` surface on a `panel-alt` background. Always go bg → panel → panel-alt.


---

## 3. Typography System

### 3.1 Font Stack

| Role | Font | Fallback |
|---|---|---|
| Body & UI | IBM Plex Sans | system-ui, sans-serif |
| Code, IDs, timestamps, metrics | IBM Plex Mono | Fira Code, monospace |

> **Rule:** Only these two fonts are used. No Google Fonts, no other typefaces. IBM Plex Sans must be loaded via `<link>` in `index.html` or via a local font file.

### 3.2 Type Scale

| Name | Token Class | Size | Weight | Line Height | Letter Spacing | Use |
|---|---|---|---|---|---|---|
| Display | `.type-display` | 2.25rem (36px) | 700 | 1.2 | -0.02em | KPI numbers, large metric values |
| H1 | `.text-3xl font-semibold` | 1.875rem (30px) | 600 | 1.25 | -0.01em | Page titles |
| H2 | `.text-2xl font-semibold` | 1.5rem (24px) | 600 | 1.3 | 0 | Section headings |
| H3 | `.text-xl font-semibold` | 1.25rem (20px) | 600 | 1.35 | 0 | Card headings, subsection titles |
| H4 | `.text-base font-semibold` | 1rem (16px) | 600 | 1.4 | 0 | Widget titles, panel labels |
| Body | `.text-sm` | 0.875rem (14px) | 400 | 1.6 | 0 | All body text, table cells, descriptions |
| Caption | `.text-xs` | 0.75rem (12px) | 400 | 1.5 | 0 | Metadata, timestamps, helper text |
| Small | `.text-[11px]` | 0.6875rem (11px) | 400 | 1.4 | 0.01em | Badge labels, notification timestamps |
| Label | `.text-xs font-medium` | 0.75rem (12px) | 500 | 1.4 | 0.04em | Form field labels, column headers |
| Table Header | `.text-xs font-medium tracking-wide` | 0.75rem (12px) | 500 | 1.4 | 0.06em | Table `<th>` only |
| Button | `.text-sm font-medium` | 0.875rem (14px) | 500 | 1 | 0 | All button text |
| Navigation | `.text-sm` | 0.875rem (14px) | 400 | 1 | 0 | Sidebar nav items |
| KPI Number | `.text-3xl font-bold font-mono` | 1.875rem (30px) | 700 | 1 | -0.02em | KPI card primary value |
| Mono Data | `.font-mono text-xs` | 0.75rem (12px) | 400 | 1.5 | 0 | Camera IDs, timestamps, fps values |
| Code | `.font-mono text-sm` | 0.875rem (14px) | 400 | 1.6 | 0 | RTSP URLs, API keys |

### 3.3 Typography Rules

1. **Page titles** (`H1`) use `text-text-primary`. Only one H1 per page.
2. **Section headings** (`H2`, `H3`) use `text-text-primary` or `text-text-secondary`.
3. **Body text** uses `text-text-secondary` for descriptions and metadata; `text-text-primary` for primary cell values.
4. **Timestamps and IDs** always use the mono font (`font-mono`) in `text-text-muted`.
5. **Labels** (form field labels, column headers) use `text-xs font-medium text-text-secondary`.
6. **Uppercase tracking** is used only for section micro-labels: `text-xs font-medium uppercase tracking-wide text-text-muted`.
7. **Never use `font-bold` on body text**. Bold is reserved for KPI numbers and display values.
8. **Never underline text** except for inline hyperlinks on hover.
9. **Truncation** (`truncate` class) is required on all text that may overflow its container.

---

## 4. Spacing System

### 4.1 Base Unit

The base unit is **4px**. All spacing values are multiples of 4px. The preferred rhythm is 8px (2 units).

### 4.2 Spacing Scale

| Token | Value | Tailwind Class | Primary Use |
|---|---|---|---|
| space-1 | 4px | `p-1`, `m-1`, `gap-1` | Icon padding, micro-gaps between inline elements |
| space-2 | 8px | `p-2`, `m-2`, `gap-2` | Badge padding, button icon gap, compact list item gap |
| space-3 | 12px | `p-3`, `m-3`, `gap-3` | Compact card padding, tag gap, inline form gap |
| space-4 | 16px | `p-4`, `m-4`, `gap-4` | Standard card padding, grid gap, form field gap |
| space-5 | 20px | `p-5`, `m-5`, `gap-5` | Dialog padding, section gap within a card |
| space-6 | 24px | `p-6`, `m-6`, `gap-6` | Page content padding, major section gap |
| space-8 | 32px | `p-8`, `m-8`, `gap-8` | Between major page sections (e.g., KPI strip to data table) |
| space-10 | 40px | `p-10`, `m-10`, `gap-10` | Large section separators (rarely used) |
| space-12 | 48px | `p-12`, `m-12`, `gap-12` | Auth page vertical centering, hero sections |
| space-16 | 64px | `p-16`, `m-16`, `gap-16` | Full-page empty state vertical padding |

### 4.3 Spacing Assignment Rules

| Context | Spacing |
|---|---|
| Page outer padding (all feature pages) | `p-6` (24px) |
| Card inner padding (standard) | `p-4` (16px) |
| Card inner padding (compact / dense) | `p-3` (12px) |
| Card inner padding (spacious / KPI) | `p-5` (20px) |
| Dialog padding | `p-5` (20px) horizontal, `p-4` (16px) vertical |
| Form field vertical gap | `gap-4` (16px) |
| Inline element gap (badge, icon + text) | `gap-1.5` or `gap-2` |
| Navigation item padding | `px-3 py-2.5` |
| Table cell padding | `px-4 py-3` (standard), `px-3 py-2` (compact) |
| Grid gap (zone/camera cards) | `gap-3` (12px) or `gap-4` (16px) |
| Section gap within a page | `space-y-6` (24px) |
| Major section gap | `space-y-8` (32px) |
| Header height | `h-14` (56px) |
| Sidebar width (expanded) | `w-60` (240px) |
| Sidebar width (collapsed) | `w-16` (64px) |

---

## 5. Border Radius

### 5.1 Radius Tokens

| Token | Value | Tailwind | Use |
|---|---|---|---|
| `radius-sm` | 4px | `rounded` | Badges, tags, chips |
| `radius-md` | 6px | `rounded-md` | Buttons, inputs, selects, table cells |
| `radius-lg` | 8px | `rounded-lg` | Cards, camera tiles, zone cards, dialogs |
| `radius-xl` | 12px | `rounded-xl` | Large cards, KPI cards, drawers, modals |
| `radius-full` | 9999px | `rounded-full` | Avatars, status dots, pill badges |

### 5.2 Radius Assignment Rules

| Component | Radius |
|---|---|
| Buttons | `rounded-md` (6px) |
| Inputs, Select | `rounded-md` (6px) |
| Badges | `rounded` (4px) |
| Pill / filter chips | `rounded-full` |
| Standard cards | `rounded-xl` (12px) |
| Camera tiles | `rounded-xl` (12px) |
| Zone cards | `rounded-xl` (12px) |
| KPI cards | `rounded-xl` (12px) |
| Dialogs | `rounded-xl` (12px) |
| Drawers | `rounded-none` on the wall side, `rounded-xl` on detached side |
| Notification items | `rounded-none` (flush in drawer list) |
| Tooltips | `rounded` (4px) |
| Table container | `rounded-lg` (8px) with `overflow-hidden` |
| Status indicator dots | `rounded-full` |
| Avatar | `rounded-full` |

---

## 6. Elevation

Elevation communicates z-axis depth. This project uses a **shadow-minimal** approach consistent with the dark industrial theme. Heavy drop shadows are avoided — borders and background colour contrast define elevation instead.

### 6.1 Elevation Levels

| Level | Usage | Tailwind | CSS |
|---|---|---|---|
| 0 — Flat | Page body, sidebar, header | (none) | — |
| 1 — Card | Standard cards, table containers, inputs | `shadow-none` + `border border-border-soft` | border-defined elevation |
| 2 — Floating | Dropdown menus, select options, autocomplete | `shadow-xl` | `box-shadow: 0 8px 32px rgba(0,0,0,0.4)` |
| 3 — Dialog | Modal dialogs | `shadow-2xl` | `box-shadow: 0 16px 48px rgba(0,0,0,0.6)` |
| 4 — Drawer | Side panels, notification drawer | `shadow-2xl` | Same as dialog |
| 5 — Toast | Toast notifications | `shadow-xl` | `box-shadow: 0 8px 24px rgba(0,0,0,0.5)` |

> **Rule:** Never add drop shadows to cards that sit on the page body. The border alone provides sufficient elevation. Drop shadows are reserved for elements that float above the document flow (dropdowns, dialogs, drawers).

### 6.2 Backdrop Overlay

Dialogs and drawers use a backdrop:
```
background: rgba(18, 21, 26, 0.75);
backdrop-filter: blur(4px);
```
Class: `bg-bg/75 backdrop-blur-sm`

---

## 7. Layout Rules

### 7.1 Application Shell

```
┌────────────────────────────────────────────────────────────┐
│  HEADER  h-14 (56px)  · bg-panel · border-b border-soft   │
├────────────┬───────────────────────────────────────────────┤
│            │                                               │
│  SIDEBAR   │             MAIN CONTENT                      │
│  w-60      │         p-6 · overflow-auto                   │
│ (or w-16)  │                                               │
│  bg-panel  │                                               │
│            │                                               │
└────────────┴───────────────────────────────────────────────┘
```

- **Total width**: 100vw (`w-screen`)
- **Total height**: 100vh (`h-screen`), no scrolling at the shell level
- **Sidebar**: `shrink-0`, never wraps
- **Main**: `flex-1 overflow-auto`

### 7.2 Breakpoints

| Name | Min Width | Tailwind Prefix | Behaviour |
|---|---|---|---|
| xs | 768px | `sm:` | Minimum supported; tables scroll horizontally |
| sm | 1024px | `lg:` | Laptop — some grids collapse from 4-col to 2-col |
| md | 1280px | `xl:` | Minimum recommended; all features fully usable |
| lg | 1440px | `2xl:` | Standard desktop; preferred design target |
| xl | 1600px | — | Wide desktop; add max-width on content containers |
| 2xl | 1920px | — | Control-room display; layout fills width |

### 7.3 Content Width Rules

| Context | Max Width |
|---|---|
| Auth pages (login, reset) | `max-w-md` (448px), centered |
| Profile / Help page | `max-w-2xl` (672px) |
| KPI Summary page | `max-w-5xl` (1024px) |
| Worker profile | `max-w-5xl` (1024px) |
| Standard data pages (alerts, workers, reports) | Full available width (no max-width) |
| Admin pages | Full available width |
| Monitoring dashboard | Full available width |
| Dialog | `max-w-lg` (512px) default; `max-w-xl` (576px) for complex forms |

### 7.4 Grid Rules

| Context | Columns at md (1280px) | Columns at lg (1440px) | Columns at xl (1920px) |
|---|---|---|---|
| Zone cards | 3 | 4 | 6 |
| Camera tiles | 2 | 3 | 4 |
| KPI cards | 2 | 4–5 | 5 |
| Admin stat cards | 2 | 3 | 4 |
| Report sections | 1 | 2 | 2 |
| Dashboard widgets row | 1 | 3 | 4 |

Grid gap is always `gap-3` (12px) for dense grids (cameras, zones) and `gap-4` (16px) for spacious grids (KPI cards, dashboard widgets).

### 7.5 Sidebar Behaviour

- **Expanded**: `w-60` (240px), shows icon + label
- **Collapsed**: `w-16` (64px), shows icon only, label hidden
- Collapse state persisted to `localStorage['ppe_sidebar_collapsed']`
- Transition: `transition-all duration-200`
- No overlay or modal sidebar — always persistent

### 7.6 Header Specification

- Height: `h-14` (56px), `shrink-0`
- Background: `bg-panel`
- Bottom border: `border-b border-border-soft`
- Contents (left to right): `flex-1` spacer · WS status banner · Notification bell (with badge) · Avatar + name/role
- No page title in header. Page title appears in the page content area.


---

## 8. Responsive Behaviour

### 8.1 General Rules

- The application is **desktop-first**. Minimum tested viewport: **1280px wide**.
- Layouts never break below 1024px but are not optimised for that size.
- No mobile-specific layouts are defined for v1.0.
- Horizontal scrolling is permitted only inside table containers (`overflow-x-auto`). Never allow horizontal scroll on the page body.

### 8.2 Responsive Behaviour by Component

#### Sidebar
- At all widths ≥ 1024px: full sidebar is visible. The sidebar does not collapse to a hamburger menu.
- Collapsed (`w-16`) state is a user preference, not a responsive breakpoint.

#### Header
- At all widths: same layout. Avatar name/role text hides below `lg:` (`hidden lg:block`).

#### Zone Cards Grid
- 1280px: 3 columns
- 1440px: 4 columns
- 1920px+: 6 columns (with `grid-cols-4` as default, override with container query or explicit class)

#### Camera Tiles Grid
- 1280px: 2 columns
- 1440px: 3 columns
- 1920px+: 4 columns

#### KPI Cards Strip
- 1280px: 2 columns
- 1440px: 4–5 columns (flex-wrap or explicit grid)
- Never exceed **5 KPI cards in a single row**

#### Dashboard Widgets (2-column panels)
- 1280px: stacked (1-column)
- 1440px: `grid-cols-3` — 2/3 + 1/3 split
- 1920px: same

#### Tables
- Tables always fill 100% of the available content width.
- Horizontal scroll (`overflow-x-auto`) applies to the table wrapper.
- Column widths are defined per table (see Section 13).
- At widths < 1280px, less-critical columns may hide (e.g., IP address in audit log).

#### Charts (Recharts)
- All charts use `<ResponsiveContainer width="100%" height={N}>`.
- Height is fixed per chart type (see Section 12).
- Charts never scroll; they resize fluidly.

#### Dialogs and Drawers
- Dialogs: `max-w-lg w-full`, centred, with overlay.
- Drawers: full viewport height, `w-[420px]` default. At < 1280px, drawers may be `w-[100vw]` but this is untested.

#### Forms
- Form fields stack vertically at all widths.
- Side-by-side fields (`grid-cols-2`) only in dialogs where space permits and fields are short.

---

## 9. Component Standards

This section defines the specification for every UI component. For each component, only the specified variants, states, and sizes are permitted.

---

### 9.1 Button

**Purpose:** Trigger an action.

**Variants:**

| Variant | Background | Text | Border | Use |
|---|---|---|---|---|
| `primary` | `bg-accent` | `text-white` | none | One per section; primary CTA |
| `secondary` | `bg-panel-alt` | `text-text-primary` | `border border-border` | Secondary actions, filters |
| `ghost` | transparent | `text-text-secondary` | none | Tertiary actions, pagination, icon buttons |
| `danger` | `bg-status-danger/20` | `text-status-danger` | `border border-status-danger/40` | Destructive actions (deactivate, delete) |

**Sizes:**

| Size | Padding | Font | Min Height |
|---|---|---|---|
| `sm` | `px-2.5 py-1.5` | `text-xs` | 28px |
| `md` (default) | `px-4 py-2` | `text-sm` | 36px |
| `lg` | `px-5 py-2.5` | `text-base` | 44px |

**States:**

| State | Style |
|---|---|
| Default | As defined in variant table |
| Hover | `primary` → `bg-accent-hover`; `secondary` → `bg-panel-hover`; `ghost` → `bg-panel-alt` |
| Focus | `ring-2 ring-accent ring-offset-1 ring-offset-bg` |
| Loading | Show `Spinner` (16px) in place of left icon; `opacity-75`; `cursor-not-allowed` |
| Disabled | `opacity-50 cursor-not-allowed pointer-events-none` |

**Rules:**
- Never show two `primary` buttons in the same visible section.
- Buttons always have a visible label. Icon-only buttons must have `aria-label`.
- Loading state disables the button automatically.
- Border radius: `rounded-md`.

---

### 9.2 Card

**Purpose:** Group related content on a surface.

**Anatomy:**
```
┌─────────────────────────────────┐  ← rounded-xl, border border-border-soft
│  [Optional Header] px-4 py-3   │  ← text-xs text-text-muted font-medium, border-b
│  Content  p-4                  │
│  [Optional Footer] px-4 py-3   │  ← text-xs text-text-muted, border-t
└─────────────────────────────────┘
```

**Variants:**

| Variant | Background | Border | Use |
|---|---|---|---|
| Default | `bg-panel` | `border-border-soft` | Standard widget / section container |
| Elevated | `bg-panel` | `border-border` | Alert cards, dialog containers |
| Subtle | `bg-panel-alt` | `border-border-soft` | Nested panels, stat boxes within cards |
| Danger | `bg-status-danger/8` | `border-status-danger/30` | Critical alert card, error container |
| Warn | `bg-status-warn/8` | `border-status-warn/30` | Warning context |

**Rules:**
- All cards use `rounded-xl overflow-hidden`.
- Header and footer use `text-xs text-text-muted font-medium uppercase tracking-wide`.
- `padding={false}` skips the default `p-4` on content for tables or lists.

---

### 9.3 Badge

**Purpose:** Communicate a discrete categorical status at a glance.

**Base style:** `inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium`

**Variants (filled/tinted):**

| Variant | Background | Text | Border |
|---|---|---|---|
| `high` | `bg-severity-high/20` | `text-severity-high` | none |
| `medium` | `bg-severity-medium/20` | `text-severity-medium` | none |
| `low` | `bg-severity-low/20` | `text-severity-low` | none |
| `info` | `bg-status-info/20` | `text-status-info` | none |
| `escalated` | `bg-alert-escalated` | `text-white font-bold` | none — **solid filled, high visual weight** |
| `online` | `bg-status-ok/20` | `text-status-ok` | none |
| `offline` | `bg-status-danger/20` | `text-status-danger` | none |
| `degraded` | `bg-status-warn/20` | `text-status-warn` | none |
| `active` | `bg-status-ok/20` | `text-status-ok` | none |
| `inactive` | `bg-status-danger/20` | `text-status-danger` | none |
| `compliant` | `bg-compliance-good/20` | `text-compliance-good` | none |
| `non_compliant` | `bg-compliance-bad/20` | `text-compliance-bad` | none |
| `partial` | `bg-compliance-warn/20` | `text-compliance-warn` | none |

**Variants (outline):**

| Variant | Background | Text | Border |
|---|---|---|---|
| `open` | transparent | `text-alert-open` | `border border-alert-open` |
| `acknowledged` | transparent | `text-alert-acknowledged` | `border border-alert-acknowledged` |
| `resolved` | transparent | `text-alert-resolved` | `border border-alert-resolved` |

**Rules:**
- Every badge includes a `<span className="sr-only">` with the variant label for screen readers.
- Colour is always paired with text — badges never communicate by colour alone.
- Use `rounded` (4px), never `rounded-full` (pill) unless it is a filter chip.
- Maximum width: fit-content. Never stretch a badge.

---

### 9.4 Input

**Purpose:** Accept single-line text input.

**Base style:** `w-full bg-panel-alt border rounded-md px-3 py-2 text-sm text-text-primary placeholder:text-text-muted transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent`

**States:**

| State | Border | Ring |
|---|---|---|
| Default | `border-border` | none |
| Focus | `border-accent` | `ring-2 ring-accent` |
| Error | `border-status-danger` | none |
| Disabled | `border-border opacity-50 cursor-not-allowed` | none |

**Anatomy:**
- Label: `text-xs font-medium text-text-secondary` above the input
- Error message: `text-xs text-status-danger` below, `role="alert"` attribute
- Hint text: `text-xs text-text-muted` below (only if no error)
- Left icon: `absolute left-3 top-1/2 -translate-y-1/2 text-text-muted`, input gets `pl-9`
- Password toggle: `absolute right-3 top-1/2 -translate-y-1/2`, eye icon, `aria-label` required

**Rules:**
- All inputs use `id` + `htmlFor` label association.
- Error messages use `aria-describedby` referencing the error element `id`.
- Input `aria-invalid="true"` when in error state.

---

### 9.5 Textarea

Same as Input but `resize-none` (never allow user resize). Min height `rows={3}` (3 lines). Max visible height before scroll: `max-h-48`.

---

### 9.6 Select

**Base style:** identical to Input but `<select>` element. System default chevron replaced by Tailwind `appearance-none` + custom SVG chevron via `bg-[url(...)]` or sibling element.

---

### 9.7 MultiSelect

**Purpose:** Select zero or more values from a list.

**Closed state:** looks identical to Input — `min-h-[36px] flex flex-wrap gap-1 items-center bg-panel-alt border rounded-md px-2 py-1 cursor-pointer`

**Selected chips:** `bg-accent/20 text-accent text-xs px-2 py-0.5 rounded-full` with `×` dismiss button

**Dropdown:** `absolute z-50 mt-1 max-h-52 overflow-y-auto bg-panel border border-border rounded-md shadow-xl`

**Option item:** `flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-panel-alt`

**Checkbox in option:** 14×14px, `rounded border border-border`; checked: `bg-accent border-accent`; checkmark SVG in white

**Rules:**
- `role="combobox"`, `aria-expanded`, `aria-haspopup="listbox"` on trigger
- List: `role="listbox" aria-multiselectable="true"`
- Items: `role="option" aria-selected`
- Keyboard: Enter/Space toggle, Escape closes, Tab moves out

---

### 9.8 Checkbox

`w-4 h-4 rounded border border-border bg-panel-alt accent-accent cursor-pointer`  
Label: `text-sm text-text-secondary`, `flex items-center gap-2 cursor-pointer`

---

### 9.9 Slider

**Track:** `h-1.5 rounded-full bg-border`  
**Thumb:** browser native, `accent-accent`  
**Value label:** right-aligned, `text-sm font-mono text-accent`  
**Label:** `text-sm text-text-secondary font-medium`  
Uses `<input type="range">` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`

---

### 9.10 Dialog

**Overlay:** `fixed inset-0 z-50 bg-bg/75 backdrop-blur-sm`  
**Container:** `relative bg-panel border border-border rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col`  
**Header:** `flex items-center justify-between px-5 py-4 border-b border-border-soft shrink-0`; title `text-base font-semibold text-text-primary`  
**Body:** `overflow-y-auto px-5 py-4 flex-1`  
**Footer:** `px-5 py-4 border-t border-border-soft flex justify-end gap-2 shrink-0`  

**Behaviour:**
- Opens on centre of viewport
- `role="dialog"` `aria-modal="true"` `aria-labelledby="dialog-title"`
- ESC closes
- Click on overlay closes
- Focus trapped inside; first focusable element receives focus on open
- Focus returns to trigger on close

---

### 9.11 Drawer

**Container:** `fixed inset-y-0 right-0 z-50 bg-panel border-l border-border flex flex-col h-full shadow-2xl`  
Default width: `w-[420px]`  
**Transition:** `transition-transform duration-300`; open: `translate-x-0`; closed: `translate-x-full`  
**Overlay:** same as Dialog  
**Header:** `flex items-center justify-between px-5 py-4 border-b border-border-soft shrink-0`  
**Body:** `flex-1 overflow-y-auto`  

Same focus trap, ESC close, and `aria-dialog` rules as Dialog.

---

### 9.12 Tooltip

**Trigger:** wrapping `<span>`, hover + focus show tooltip  
**Bubble:** `absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-panel border border-border rounded text-xs text-text-secondary whitespace-nowrap z-50 shadow-lg`  
`role="tooltip"` on the bubble  
**Rules:** Tooltip text must be concise (< 60 characters). Never use a tooltip to convey information that is not available elsewhere.

---

### 9.13 Toast

Positioned: `top-right`  
**Base style:**  
```
background: var(--color-panel)
color: var(--color-text-primary)
border: 1px solid var(--color-border)
border-radius: 8px
font-size: 14px
box-shadow: 0 8px 24px rgba(0,0,0,0.5)
```

**Variants:** success (green icon), error (red icon), info (blue icon). No warning variant — use info.  
**Duration:** 4 seconds default; `Infinity` for critical disconnect toasts (with manual dismiss).  
**Placement:** top-right, `z-[9999]`  
**Rules:** Never show more than 3 toasts simultaneously. Dismiss oldest if queue exceeds 3.

---

### 9.14 DataTable

See Section 13 for full table specification.

---

### 9.15 Pagination

`flex items-center gap-1 text-xs text-text-muted`  
Buttons: `ghost` variant, `sm` size  
Count display: `Page {n} / {total}` (plain text, not a button)  
Rules: Show pagination only when `totalPages > 1`. Always show first/last page jump buttons on tables with > 5 pages.

---

### 9.16 Tabs

**Tab bar:** `flex border-b border-border-soft`  
**Tab item:** `px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px`  
**Active:** `border-accent text-accent`  
**Inactive:** `border-transparent text-text-muted hover:text-text-secondary`  
**Rules:** No more than 6 tabs per tab bar. Tabs above content; never below. URL-synced state where feasible.

---

### 9.17 Filter Bar

The filter bar appears between the page header and the main data view.  
**Container:** `bg-panel border border-border-soft rounded-xl p-4 space-y-3`  
**Inputs row:** `grid grid-cols-1 md:grid-cols-4 gap-3` (adjust column count per page)  
**Active filter chips row:** `flex flex-wrap gap-1.5 mt-2`  
**Filter chip:** `bg-accent/15 text-accent text-xs px-2 py-0.5 rounded-full flex items-center gap-1` with `×` button  
**Clear all:** ghost button, `sm` size, right-aligned

---

### 9.18 Loading Skeleton

**Base shimmer class:**
```css
.shimmer {
  background: linear-gradient(90deg, var(--color-panel) 25%, var(--color-panel-alt) 50%, var(--color-panel) 75%);
  background-size: 800px 100%;
  animation: shimmer 1.4s infinite linear;
}
```

**Variants:**

| Variant | Appearance | Use |
|---|---|---|
| `table` | Full-width shimmer rows (h-12 each) | Any DataTable loading |
| `card` | Grid of shimmer blocks (h-40) | Zone/camera card grids |
| `chart` | Single shimmer block (h-64) | Any Recharts container |
| `kpi` | Row of narrow shimmer blocks (h-28) | KPI card strip |
| `line` | Single narrow shimmer line (h-4) | Inline text loading |

**Rules:** Every component backed by async data must show a skeleton on first load. `aria-busy="true"` on skeleton containers.

---

### 9.19 Spinner

`w-{size} h-{size} animate-spin text-accent`  
Sizes: `w-4 h-4` (sm), `w-6 h-6` (md), `w-8 h-8` (lg)  
Always include `aria-label="Loading"`.

---

### 9.20 Empty State

**Container:** `flex flex-col items-center justify-center py-16 px-6 text-center`  
**Icon:** 40×40px, `text-text-muted opacity-60`  
**Heading:** `text-lg font-medium text-text-secondary mb-1`  
**Message:** `text-sm text-text-muted max-w-sm`  
**Action button** (optional): `secondary sm` button below message, `mt-4`

**Standard empty state messages** (use these verbatim):

| Context | Heading | Message |
|---|---|---|
| User list | "No users found" | "Create the first user to get started." |
| Zone list | "No zones configured" | "Create a zone to get started." |
| Camera list | "No cameras configured" | "No cameras configured yet — add one to get started." |
| Alert list | "No alerts match the current filters" | "Try adjusting your filter criteria." |
| Worker list | "No workers currently detected" | (no message) |
| Report table | "No data found" | "No data found for the selected period and filters." |
| Notification drawer | "No notifications" | (no message) |
| Top violating zones | "No violations detected" | "No violations detected in the selected time period." |

---

### 9.21 Error State

For component-level errors (inside `ErrorBoundary`):  
**Container:** `flex flex-col items-center justify-center p-8 text-center`  
**Text:** `text-sm text-status-danger font-medium` for heading; `text-xs text-text-muted` for detail  
**Retry link:** `text-sm text-accent hover:underline`  

For page-level errors: use the dedicated 403 / 404 pages.

---

### 9.22 Section Header (PageHeader)

**Container:** `mb-6` or as first item in `space-y-6`  
**Title:** `text-2xl font-semibold text-text-primary` (H2 equivalent for page content)  
**Subtitle:** `text-sm text-text-muted mt-1`  
**Action area:** right-aligned flex container for buttons  

```
┌──────────────────────────────────────────────────────┐
│  [Title]                          [Action Button(s)]  │
│  [Subtitle text]                                      │
└──────────────────────────────────────────────────────┘
```

**Rules:** Exactly one Section Header per page. Title is the page name. Never put navigation or filters in the Section Header.


---

### 9.23 KPI Card

**Purpose:** Display a single high-level metric prominently.

**Anatomy:**
```
+-----------------------------------------+
� TITLE (text-xs uppercase tracking-wide) �
� VALUE (text-3xl font-bold)  TREND ?/?  �
� ??_?_??? sparkline (optional, h-10)    �
+-----------------------------------------+
```

- Container: `bg-panel border border-border-soft rounded-xl p-5 flex flex-col gap-3`
- Title: `text-xs text-text-muted font-medium uppercase tracking-wide`
- Value: `text-3xl font-bold text-text-primary`
- Trend indicator: `text-sm font-medium` � green if positive direction, red if negative
- Sparkline: `<ResponsiveContainer width="100%" height={40}>` � no axes, no dots, stroke `var(--color-accent)`
- Loading: `LoadingSkeleton variant="kpi"`

**Rules:**
- Maximum 5 KPI cards per row.
- Value must always be a string (pre-formatted before passing as prop).
- Trend direction and positivity are orthogonal: up can be bad (violations increasing).
- Sparkline is optional; show only when 7+ data points are available.

---

### 9.24 Camera Card

**Purpose:** Represent a single CCTV camera feed tile in the monitoring grid.

**Container:** `bg-panel border border-border-soft rounded-xl overflow-hidden hover:border-border transition-colors`

**Feed area (top):** `relative h-36`
- Online: diagonal-stripe SVG background; LIVE badge; fps/latency badge; bounding box overlays
- Offline: `bg-panel-alt`; centred camera icon (opacity-30); "No Signal" text

**LIVE badge:** `absolute top-2 left-2 flex items-center gap-1 text-xs text-status-ok bg-bg/70 px-1.5 py-0.5 rounded font-mono`

**Metrics badge:** `absolute top-2 right-2 text-xs text-text-muted bg-bg/70 px-1.5 py-0.5 rounded font-mono`

**Footer (bottom):** `p-3`
- Camera name: `text-sm font-medium text-text-primary truncate`
- Zone name: `text-xs text-text-muted`
- Violation count (if > 0): `text-xs text-status-danger font-medium`

**Bounding box overlay:** `absolute border-2 rounded-sm` � violation boxes `border-status-danger`, worker boxes `border-accent`

**States:** default, hover (border lightens), selected (border-accent + ring-1)

---

### 9.25 Zone Card

**Purpose:** Show real-time compliance status for a single industrial zone.

**Container:** `bg-panel border rounded-xl p-4 text-left transition-all flex flex-col gap-2 cursor-pointer`
- Default border: `border-border-soft`
- Selected: `border-accent ring-1 ring-accent`
- High violation active: `pulse-danger` animation class added

**Contents:**
- Row 1: Zone name (`text-sm font-semibold text-text-primary`) + violation badge (right-aligned)
- Row 2: Compliance % � `text-2xl font-bold` in compliance colour
- Row 3: Progress bar � `h-1 bg-panel-alt rounded-full` with filled portion in compliance colour
- Row 4: Worker count � `text-xs text-text-muted`

**Compliance colour rule:**
- = 80%: `text-compliance-good` / `bg-compliance-good`
- 60�79%: `text-compliance-warn` / `bg-compliance-warn`
- < 60%: `text-compliance-bad` / `bg-compliance-bad`

---

### 9.26 Alert Card / Alert Row

**Purpose:** Represent a single alert in the real-time feed.

**Row layout (in table):**
- Escalated rows: `border-l-2 border-l-alert-escalated` left accent + `bg-status-danger/5` tint
- New alert rows: `new-row-fade` animation class (3-second highlight fade)
- Hover: `hover:bg-panel-alt`

**Key visual rule:** `escalated` status badge is the only solid-filled status badge. All others are outline or tint. This makes escalated alerts instantly distinguishable in a busy feed.

---

### 9.27 Worker Card / Worker Row

**Purpose:** Represent a detected worker's compliance status.

**In LiveWorkerList:** `flex items-center gap-3 px-4 py-3 hover:bg-panel-alt`
- Non-compliant workers: `border-l-2 border-status-danger` left accent
- Avatar: 32�32px circle, `bg-panel-alt`, single initial letter in `text-accent`
- Name + ID in separate lines
- Compliance badge right-aligned

---

### 9.28 Notification Card (in Notification Center)

**Purpose:** Single notification item in the Notification Center Drawer.

**Container:** `flex items-start gap-3 px-4 py-3 border-b border-border-soft hover:bg-panel-alt`
- Unread: `bg-accent/5` tint
- Unread dot: `w-2 h-2 rounded-full bg-accent shrink-0 mt-1.5`

**Type icon:** 24px emoji or Lucide icon � Bell (alert_new), AlertTriangle (escalated), Server (system), Info (info)

**Contents:**
- Title: `text-sm font-medium text-text-primary` � clickable link
- Body: `text-xs text-text-secondary mt-0.5`
- Timestamp: `text-xs text-text-muted mt-1`
- "View ?" link: `text-xs text-accent hover:underline mt-1`
- Dismiss button: `text-text-muted hover:text-text-primary text-xs`

---

### 9.29 Chart Container

**Purpose:** Standardised wrapper for all Recharts charts.

**Container:** `bg-panel border border-border-soft rounded-xl p-4`
**Title:** `text-xs text-text-muted font-medium uppercase tracking-wide mb-3`
**Chart area:** `<ResponsiveContainer width="100%" height={HEIGHT}>`

Standard heights: BarChart 180px, LineChart 180px, AreaChart 200px, PieChart/DonutChart 160px, GaugeChart 120px (half-circle)

---

## 10. Status System

Every status in the application maps to exactly one visual style. No new status styles may be created without updating this section.

### 10.1 Alert Status Badges

| Status | Style Type | Background | Text | Border | Weight |
|---|---|---|---|---|---|
| `open` | Outline | transparent | `text-alert-open` | `border border-alert-open` | normal |
| `acknowledged` | Outline | transparent | `text-alert-acknowledged` | `border border-alert-acknowledged` | normal |
| `escalated` | **Solid filled** | `bg-alert-escalated` | `text-white` | none | **bold � highest visual weight** |
| `resolved` | Outline | transparent | `text-alert-resolved` | `border border-alert-resolved` | normal |

### 10.2 Severity Badges

| Severity | Background | Text |
|---|---|---|
| `high` | `bg-severity-high/20` | `text-severity-high` |
| `medium` | `bg-severity-medium/20` | `text-severity-medium` |
| `low` | `bg-severity-low/20` | `text-severity-low` |
| `info` | `bg-status-info/20` | `text-status-info` |

### 10.3 Camera / Service Status Badges

| Status | Background | Text |
|---|---|---|
| `online` | `bg-status-ok/20` | `text-status-ok` |
| `offline` | `bg-status-danger/20` | `text-status-danger` |
| `error` | `bg-status-warn/20` | `text-status-warn` |
| `degraded` | `bg-status-warn/20` | `text-status-warn` |
| `unknown` | `bg-panel-alt` | `text-text-muted` |

### 10.4 System Health Status

| Status | Colour | Dot class |
|---|---|---|
| `healthy` / `online` | `var(--color-status-ok)` | `bg-status-ok` |
| `degraded` | `var(--color-status-warn)` | `bg-status-warn animate-pulse` |
| `critical` / `offline` | `var(--color-status-danger)` | `bg-status-danger` |

### 10.5 Compliance Status

| Status | Colour rule | Badge classes |
|---|---|---|
| `compliant` (= 80%) | Green | `bg-compliance-good/20 text-compliance-good` |
| `partial` (60�79%) | Amber | `bg-compliance-warn/20 text-compliance-warn` |
| `non_compliant` (< 60%) | Red | `bg-compliance-bad/20 text-compliance-bad` |

### 10.6 User / Record Status

| Status | Background | Text |
|---|---|---|
| `active` | `bg-status-ok/20` | `text-status-ok` |
| `inactive` | `bg-status-danger/20` | `text-status-danger` |

### 10.7 Status Rules

1. Status is always communicated by **both colour and text label** � never colour alone.
2. Every status badge includes a `<span className="sr-only">` with the plain-text status name.
3. `escalated` is the only status that uses a solid filled background � this is intentional to give it highest visual weight in a busy feed.
4. Status dot indicators (e.g., WS status banner, system health list) use `w-2 h-2 rounded-full` coloured circles.
5. The WS status banner adds `animate-pulse` to the dot when `reconnecting`.

---

## 11. Navigation System

### 11.1 Sidebar

**Structure:**
```
+--------------------------------+
� [Logo / App Name]  [Collapse]  �  h-[57px], border-b border-border-soft
+--------------------------------�
� ?  Live Monitoring             �  Nav items
� ?  Alerts                      �
� ??  Workers                     �
� ??  Reports                     �
� ??  KPI Summary                 �
� ?  Admin Console               �
�                                �
�   (flex-1 spacer)              �
+--------------------------------�
� ??  Profile                     �  Footer nav
� ?  Logout                      �
+--------------------------------+
```

**Nav item � expanded:** `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm`
**Nav item � collapsed:** icon only, same padding, tooltip on hover showing label
**Active state:** `bg-accent/15 text-accent`
**Inactive state:** `text-text-secondary hover:bg-panel-alt hover:text-text-primary`
**Icon:** 18�18px, `text-base shrink-0`, `aria-hidden="true"`

**Role filtering:** Nav items are rendered only for the current user's permitted routes (sourced from `ROUTE_PERMISSIONS`). Items the user cannot access are not rendered � not hidden.

**Collapsed state:**
- Width: `w-16` (64px)
- App name text hidden
- Nav labels hidden
- Icons centred
- Collapse toggle: chevron icon, `aria-label` toggling between "Expand sidebar" and "Collapse sidebar"
- State persisted to `localStorage['ppe_sidebar_collapsed']`

### 11.2 Header

**Layout:** `h-14 bg-panel border-b border-border-soft flex items-center px-6 gap-4`

**Contents (left ? right):**
1. `flex-1` spacer (pushes everything to the right)
2. **WS Status Banner** � dot + label, `role="status"` `aria-live="polite"`
3. **Notification Bell** � `<button aria-label="Notifications � N unread">` with SVG bell icon + unread count badge
4. **Avatar + name dropdown** � `<button aria-label="User menu" aria-expanded aria-haspopup="menu">`

**Notification badge:** `absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-status-danger text-white text-[10px] font-bold rounded-full` � visible only when `unreadCount > 0`; capped at 99+

**Avatar dropdown menu:** `absolute right-0 top-10 bg-panel border border-border rounded-lg shadow-xl py-1 z-50 min-w-[160px]`
Items: "My Profile" ? `/profile`, "Help" ? `/help`, "Logout" (red text)

### 11.3 Active Navigation State

- Active route: detected via `NavLink` `isActive`
- Active item receives `bg-accent/15 text-accent`
- Active item does NOT have an additional left border or underline � background tint is sufficient
- Only one item is active at a time

### 11.4 WS Status Banner (in Header)

Three visual states � always visible in the header:

| State | Dot | Label | Extra |
|---|---|---|---|
| `connected` | `bg-status-ok` solid | "Live" `text-status-ok` | � |
| `reconnecting` | `bg-status-warn animate-pulse` | "Reconnecting�" `text-status-warn` | Spinner 16px |
| `disconnected` | `bg-status-danger` solid | "Disconnected" `text-status-danger` | "Retry" link button |

`role="status"` `aria-live="polite"` on the container � screen readers announce state changes.

### 11.5 Icon Standards

See Section 21 for full icon specification.
Navigation icons in the sidebar use 18�18px (`w-[18px] h-[18px]`).

---

## 12. Charts & Data Visualization

All charts use **Recharts**. No other charting library is permitted.

### 12.1 Global Chart Rules

1. All charts use `<ResponsiveContainer width="100%" height={N}>` � never a fixed pixel width.
2. Chart containers always include the section title above the chart (see �9.29).
3. Chart colours must use the chart palette tokens (`var(--color-chart-1)` � `var(--color-chart-6)`). Never use raw hex values or status/severity tokens in charts.
4. Tooltips use the standard tooltip style (see �12.9).
5. All charts show a `LoadingSkeleton variant="chart"` when data is loading.
6. All charts show an `EmptyState` when data is empty.
7. Chart text (axis ticks, labels) uses `text-text-muted` (via `fill: var(--color-chart-tick)`).

### 12.2 Bar Chart

**Use:** Violations per zone, compliance comparison, PPE category breakdown  
**Component:** `<BarChart>`  
**Height:** 180px  
**Bar fill:** `var(--color-chart-1)` for single series; `var(--color-chart-1..6)` for multi-series  
**Bar radius:** `radius={[3, 3, 0, 0]}` (top corners only)  
**Grid:** `<CartesianGrid strokeDasharray="2 4" stroke="var(--color-chart-grid)" vertical={false} />`  
**XAxis:** `tick={{ fill: 'var(--color-chart-tick)', fontSize: 10 }}` `axisLine={false}` `tickLine={false}`  
**YAxis:** `tick={{ fill: 'var(--color-chart-tick)', fontSize: 10 }}` `axisLine={false}` `tickLine={false}` `width={30}`  
**Compliance bar chart exception:** Bars coloured individually by value using `<Cell>` � green/amber/red per compliance threshold.

### 12.3 Line Chart

**Use:** Compliance trend over time, violation timeline  
**Component:** `<LineChart>`  
**Height:** 180px  
**Line:** `stroke="var(--color-chart-1)"` `strokeWidth={2}` `dot={false}` `type="monotone"`  
**Grid:** same as bar chart  
**Axes:** same as bar chart  
**Reference line (target):** `<ReferenceLine y={80} stroke="var(--color-status-ok)" strokeDasharray="4 2" strokeOpacity={0.5} />`

### 12.4 Area Chart

**Use:** Compliance trend with fill emphasis  
**Component:** `<AreaChart>`  
**Height:** 200px  
**Stroke:** `var(--color-chart-1)` `strokeWidth={2}`  
**Fill:** `var(--color-chart-bg)` (subtle tint, never opaque)  
**Gradient:** Use `<defs><linearGradient>` � top: `var(--color-chart-1)` at `opacity="0.3"`, bottom: `opacity="0"`

### 12.5 Pie Chart

**Use:** PPE category violation breakdown (categorical, not compliance %)  
**Component:** `<PieChart>`  
**Height:** 160px  
**Stroke:** `strokeWidth={0}` (no sector borders)  
**Colours:** `var(--color-chart-1)` through `var(--color-chart-6)` in sequence  
**Label:** No labels on the chart itself � use a separate legend list beside the chart

### 12.6 Donut Chart

**Use:** Worker compliance status breakdown  
**Component:** `<PieChart>` with `<Pie innerRadius={28} outerRadius={50}>`  
**Centre text:** Absolute-positioned `<div>` showing total count � `text-xl font-bold text-text-primary`  
**Height:** 160px

### 12.7 Gauge (Radial) Chart

**Use:** Overall site compliance percentage  
**Component:** `<RadialBarChart cx="50%" cy="100%" innerRadius="70%" outerRadius="100%" startAngle={180} endAngle={0}>`  
**Height:** 96px (half-height container to clip to semicircle)  
**Bar fill:** Compliance colour (green/amber/red via threshold rule)  
**Background:** `<RadialBar background={{ fill: 'var(--color-panel-alt)' }}>`  
**Centre value:** Absolute-positioned `text-2xl font-bold` in the compliance colour

### 12.8 Trend Indicators (KPI Cards)

**Up arrow (worse):** ? in `text-status-danger` when `positive=false && direction="up"`  
**Up arrow (better):** ? in `text-status-ok` when `positive=true && direction="up"`  
**Down arrow (better):** ? in `text-status-ok` when `positive=true && direction="down"`  
**Down arrow (worse):** ? in `text-status-danger` when `positive=false && direction="down"`  
**Neutral:** ? in `text-text-muted`  
Delta value: shown immediately after the arrow in the same colour, `text-sm font-medium`

### 12.9 Tooltip Style

All chart tooltips use:
```js
contentStyle: {
  background: 'var(--color-chart-tooltip-bg)',
  border: '1px solid var(--color-border)',
  borderRadius: '6px',
  fontSize: '11px',
  color: 'var(--color-text-primary)',
}
```
No `itemStyle` override � inherits `contentStyle` text colour.  
`cursor={{ stroke: 'var(--color-border)', strokeWidth: 1 }}` on bar/line charts.

### 12.10 Legends

Legends appear as a **separate list** beside or below the chart � never inside the Recharts `<Legend>` component.  
**Legend item:** `flex items-center gap-2 text-xs text-text-secondary`  
**Legend dot:** `w-2 h-2 rounded-sm shrink-0` (square, not round) in the series colour

### 12.11 Axes

- X and Y axis labels: `text-xs text-text-muted` (never bold)
- Axis lines: hidden (`axisLine={false}`)
- Tick lines: hidden (`tickLine={false}`)
- YAxis width: `30` for single-digit values, `40` for three-digit values
- XAxis interval: `"preserveStartEnd"` for time series; auto for category axes

### 12.12 Grid Lines

```jsx
<CartesianGrid
  strokeDasharray="2 4"
  stroke="var(--color-chart-grid)"
  vertical={false}
/>
```
Horizontal grid lines only. No vertical grid lines. Dash pattern `2 4` (2px dash, 4px gap).

---

## 13. Tables

### 13.1 Table Structure

```
+------------------------------------------------------+  ? rounded-lg border border-border-soft overflow-hidden
�  TH  TH  TH  TH  TH  TH                             �  ? bg-panel-alt, text-xs text-text-muted tracking-wide
+------------------------------------------------------�
�  TD  TD  TD  TD  TD  TD                              �  ? border-t border-border-soft
�  TD  TD  TD  TD  TD  TD                              �
�  TD  TD  TD  TD  TD  TD                              �
+------------------------------------------------------+
```

**Table wrapper:** `overflow-x-auto rounded-lg border border-border-soft`  
**`<table>`:** `w-full text-sm border-collapse`  
**`<thead>`:** `bg-panel-alt`  
**`<th>`:** `px-4 py-3 font-medium text-left text-xs text-text-muted tracking-wide whitespace-nowrap`  
**`<tbody><tr>`:** `border-t border-border-soft transition-colors`  
**`<td>`:** `px-4 py-3 text-text-secondary`  

### 13.2 Column Padding

| Density | TH / TD padding |
|---|---|
| Standard (default) | `px-4 py-3` |
| Compact (audit log, dense tables) | `px-3 py-2` |

### 13.3 Sortable Columns

- Sortable headers: `cursor-pointer select-none hover:text-text-secondary`
- Sort indicator: `text-accent` arrow appended inline � ? for ascending, ? for descending
- Only one column sorted at a time

### 13.4 Interactive Rows (clickable)

- `cursor-pointer hover:bg-panel-alt`
- `role="button"` or wrapping `<button>` (never `onClick` alone without keyboard support)
- `tabIndex={0}` + `onKeyDown` handling Enter/Space

### 13.5 Row Highlighting (compliance tables)

| Rule | Classes |
|---|---|
| Compliance < 50% | `bg-status-danger/5 border-l-2 border-l-status-danger` |
| Compliance 50�69% | `bg-status-warn/5 border-l-2 border-l-status-warn` |
| Escalated alert row | `bg-status-danger/5 border-l-2 border-l-alert-escalated` |
| New alert row (3s fade) | `new-row-fade` animation class |

### 13.6 Empty State in Tables

If zero rows: render `<EmptyState>` inside a single `<tr><td colSpan={N}>`. Never show a table with zero rows and no empty state.

### 13.7 Pagination

Pagination bar: `flex items-center justify-between text-xs text-text-muted` below the table border  
Left side: `{from}�{to} of {total}`  
Right side: First, Prev, Page N/Total, Next, Last buttons � all `ghost sm`  
Shown only when `totalPages > 1`

### 13.8 Column Widths

Columns with predictable content use explicit widths:

| Column Type | Width |
|---|---|
| ID / code | `w-24` or `w-32` (font-mono) |
| Timestamp | `whitespace-nowrap` |
| Status badge | `w-28` |
| Severity badge | `w-24` |
| Actions column | `w-32` right-aligned |
| Name / description | `flex-1` (take remaining space) |

### 13.9 Sticky Header

For tables that can scroll vertically: `<thead>` with `sticky top-0 z-10 bg-panel-alt`.  
This applies to: Audit Log, Alert History, large Worker tables.

### 13.10 Search & Filter Bar

Appears above the table. See �9.17 for Filter Bar specification.  
Search input: `w-56` minimum, `w-64` preferred.  
Filter dropdowns: `w-40` to `w-48` depending on options.

---

## 14. Forms

### 14.1 Form Layout

- All form fields stack **vertically** with `space-y-4` (16px gap).
- Horizontal two-column layouts (`grid grid-cols-2 gap-3`) are permitted only inside dialogs where both fields are short (< 30 characters expected input).
- Full-width inputs are the default: `w-full`.

### 14.2 Field Anatomy

```
[Label text]              ? text-xs font-medium text-text-secondary, mb-1
[Input / Select / etc.]   ? full-width, standard input style
[Error message]           ? text-xs text-status-danger, mt-1, role="alert"
[Hint text]               ? text-xs text-text-muted, mt-1 (only if no error)
```

### 14.3 Required Field Indicator

Required fields: append `*` to the label in `text-status-danger`:  
`<label>Field Name <span className="text-status-danger" aria-hidden="true">*</span></label>`  
The surrounding form must include a legend: `* Required fields`.

### 14.4 Validation Rules

- Validate on blur (not on every keystroke).
- Show error immediately after the first failed submit attempt.
- Clear error on next valid input.
- Error messages are concise and specific: "At least one zone must be assigned", not "Invalid input".
- Minimum lengths: password = 8 chars, resolution notes = 10 chars.

### 14.5 Password Fields

- Always include a show/hide toggle button (`aria-label` toggling "Show password" / "Hide password").
- Eye icon: Lucide `Eye` / `EyeOff` (16�16px).
- Strength indicator (reset password page only): 4-segment bar below the input.
  - Segment colours: 1 active = `bg-status-danger`, 2 = `bg-status-warn`, 3 = `bg-status-warn`, 4 = `bg-status-ok`
  - Label: `text-xs` in the segment's colour: "Weak", "Fair", "Good", "Strong"

### 14.6 Form Submission

- Submit button: `primary md`, full-width (`w-full justify-center`) in auth pages, right-aligned in dialogs.
- Loading state: `loading={true}` on the submit button while the async operation is in progress.
- Success: toast notification + close dialog / redirect.
- Error: inline error message below the form (for network/API errors, not field validation).

### 14.7 Select (Zone Assignment MultiSelect)

The zone assignment `MultiSelect` in the User Form:
- Appears **only when role === `site_supervisor`**
- Required (min 1 selection) � show error if submitted without selection
- Placeholder: "Select assigned zones�"
- All active zones shown as options

### 14.8 Checkbox Groups (PPE Type Selection)

In Zone Config form:
- Each PPE type rendered as a toggle pill button: `px-2.5 py-1 rounded-full text-xs font-medium border`
- Selected: `bg-accent/20 text-accent border-accent`
- Unselected: `border-border text-text-muted hover:border-accent/50`
- Not a standard `<input type="checkbox">` � uses button toggle pattern for visual consistency

---

## 15. Notifications

### 15.1 Toast Notifications

**Placement:** Top-right corner, `z-[9999]`  
**Duration:** 4 seconds (success, info); `Infinity` (disconnect toast � manual dismiss only)  
**Max simultaneous:** 3. If a 4th toast fires, dismiss the oldest.

**Types and icons:**

| Type | Icon | Border accent |
|---|---|---|
| Success | ? green | left border `status-ok` |
| Error | ? red | left border `status-danger` |
| Info | ? blue | left border `status-info` |

**Standard toast messages (use these verbatim):**

| Event | Message |
|---|---|
| Login success | � (silent, redirect) |
| Login failure | "Invalid username or password" (inline, not toast) |
| Session expired | "Your session has expired. Please log in again." (error toast) |
| WS disconnect | "Live feed disconnected � attempting to reconnect." (error, infinite) |
| WS reconnect | "Live feed restored." (success) |
| Profile saved | "Profile updated." |
| Password changed | "Password changed successfully." |
| User created | "User created." |
| User updated | "User updated." |
| Zone created | "Zone created." |
| Camera added | "Camera added." |
| Alert acknowledged | "Alert acknowledged." |
| Alert resolved | "Alert resolved." |
| Config saved | "Alert configuration saved." |
| Forbidden route | "You do not have permission to view that page." (error) |

### 15.2 Notification Center Drawer

**Width:** `w-[420px]`  
**Position:** fixed, right side, full viewport height  
**Sections:**
1. Header: "Notifications" title + unread count + "Mark all read" ghost button
2. Filter tabs: All / Alerts / Escalated / System � same tab style as Section 9.16
3. Scrollable item list
4. No footer / load-more button in v1.0

**Unread badge on bell icon:** red circle `bg-status-danger text-white text-[10px] font-bold rounded-full`, capped at 99+

**Priority order in drawer:** Escalated first, then by timestamp (newest first).

### 15.3 Notification Item Types

| Type | Icon | Priority |
|---|---|---|
| `alert_escalated` | AlertTriangle (Lucide 20px) | 1 � show at top |
| `alert_new` | Bell (Lucide 20px) | 2 |
| `system_health` | Server (Lucide 20px) | 3 |
| `info` | Info (Lucide 20px) | 4 |

---

## 16. Loading States

Every data-backed component must display a loading state on first render. Loading states use the shimmer skeleton pattern (see �9.18).

### 16.1 Per-Component Loading Behaviour

| Component | Loading Pattern |
|---|---|
| DataTable | `LoadingSkeleton variant="table" rows={8}` replaces the table |
| Zone card grid | `LoadingSkeleton variant="card" count={6}` |
| Camera tile grid | `LoadingSkeleton variant="card" count={6}` |
| KPI card strip | `LoadingSkeleton variant="kpi" count={5}` |
| Any Recharts chart | `LoadingSkeleton variant="chart"` |
| Worker profile header | `LoadingSkeleton variant="line"` �4 |
| Dialog form | Individual field skeletons � `LoadingSkeleton variant="line"` |
| Alert detail panel | Skeleton for snapshot + `LoadingSkeleton variant="table" rows={4}` |

### 16.2 Skeleton Animation

- Shimmer animation: 1.4s linear infinite
- Direction: left-to-right
- The shimmer gradient uses `panel` ? `panel-alt` ? `panel` to remain on-brand
- `aria-busy="true"` on skeleton container; `aria-label="Loading data"` on skeleton wrapper

### 16.3 Camera Feed Loading

The camera feed placeholder (no actual RTSP stream) uses a diagonal stripe background:
```css
background: repeating-linear-gradient(
  115deg,
  var(--color-panel-alt) 0px, var(--color-panel-alt) 2px,
  var(--color-bg) 2px, var(--color-bg) 4px
);
```
This is not a skeleton � it represents the static "simulated feed" state and is always visible for online cameras.

---

## 17. Empty States

### 17.1 Empty State Anatomy

```
         [Icon � 40�40px, text-text-muted opacity-60]
         [Heading � text-lg font-medium text-text-secondary]
         [Message � text-sm text-text-muted max-w-sm, centred]
         [Action button � secondary sm, mt-4] (optional)
```

Container: `flex flex-col items-center justify-center py-16 px-6 text-center`

### 17.2 Icon Guidance

Use Lucide icons for empty state illustrations:
- No items / no data: `Inbox` (24px)
- No cameras: `Camera` (24px)
- No alerts: `BellOff` (24px)
- No workers: `Users` (24px)
- No zones: `Map` (24px)
- No notifications: `Bell` (24px)
- Error / forbidden: `ShieldOff` (24px)
- Connection lost: `WifiOff` (24px)

The icon is not a primary illustration. It is a visual anchor at 40�40px, `opacity-60`, `text-text-muted`.

### 17.3 Standard Empty State Copy

See �9.20 for the complete table of required empty state text per context. Use this text verbatim.

### 17.4 Empty State Actions

Actions are optional. Use only when there is a direct action the user can take:

| Context | Action Button Label | Action |
|---|---|---|
| No cameras | "Add Camera" | Opens Create Camera modal |
| No zones | "Create Zone" | Opens Create Zone modal |
| No users | "Create User" | Opens Create User modal |
| No alerts match filters | "Clear filters" | Resets all filters |
| All others | � | No action button |

---

## 18. Accessibility

### 18.1 Standard: WCAG 2.1 AA

The application must meet WCAG 2.1 Level AA. The following rules are mandatory, not aspirational.

### 18.2 Colour Contrast

All text must meet minimum contrast ratios against its background:

| Pair | Minimum Ratio | Status |
|---|---|---|
| `text-text-primary` (#E8EAF0) on `bg` (#12151A) | = 7.5:1 | AAA |
| `text-text-secondary` (#9BA3B8) on `bg` (#12151A) | = 5.2:1 | AA |
| `text-text-muted` (#5C6480) on `bg` (#12151A) | = 3.1:1 | **Fail on bg � use only for non-essential text** |
| `text-accent` (#4A8FA3) on `panel` (#1B1F27) | = 4.8:1 | AA |
| `text-status-ok` (#4F9E7C) on `panel` (#1B1F27) | = 4.5:1 | AA |
| `text-status-danger` (#C25450) on `panel` (#1B1F27) | = 4.6:1 | AA |
| `text-white` on `bg-alert-escalated` (#C25450) | = 4.6:1 | AA |

> **Rule:** `text-text-muted` may only be used for timestamps, placeholders, and decorative labels � never for informational content that the user must read.

### 18.3 Keyboard Navigation

| Element | Keyboard behaviour |
|---|---|
| All interactive elements | Reachable via Tab |
| Buttons | Activated with Enter or Space |
| Links | Activated with Enter |
| Select / MultiSelect dropdown | Opened with Enter/Space; options via arrow keys; Escape closes |
| Dialog | Escape closes; Tab cycles inside; focus returns to trigger on close |
| Drawer | Same as Dialog |
| Table rows (clickable) | `tabIndex={0}`, Enter/Space activates |
| Sidebar nav items | Standard link keyboard behaviour |
| Tabs | Arrow keys to move between tabs (roving tabindex) |

### 18.4 Focus Visibility

- Focus ring: `ring-2 ring-accent ring-offset-1 ring-offset-bg` � always visible
- Never suppress the default focus ring without providing a visible custom equivalent
- Focus rings must be visible on all interactive elements including buttons, links, inputs, and custom controls

### 18.5 ARIA Requirements

| Element | Required attributes |
|---|---|
| Icon-only buttons | `aria-label` |
| Status badges | `<span className="sr-only">` with plain text status name |
| WS status banner | `role="status"` `aria-live="polite"` |
| Dialog | `role="dialog"` `aria-modal="true"` `aria-labelledby` |
| Drawer / Notification Center | `role="dialog"` `aria-label` |
| Notification bell | `aria-label="Notifications � N unread"` |
| Avatar menu button | `aria-label="User menu"` `aria-expanded` `aria-haspopup="menu"` |
| Avatar menu items | `role="menuitem"` |
| MultiSelect trigger | `role="combobox"` `aria-expanded` `aria-haspopup="listbox"` |
| MultiSelect list | `role="listbox"` `aria-multiselectable="true"` |
| MultiSelect items | `role="option"` `aria-selected` |
| Table with clickable rows | `role="button"` on `<tr>` or inner `<button>` |
| Sortable table headers | `aria-sort="ascending"` / `"descending"` / `"none"` |
| Loading skeletons | `aria-busy="true"` `aria-label="Loading data"` |
| Error messages | `role="alert"` |
| Form field errors | `aria-describedby` referencing error element id |
| Invalid inputs | `aria-invalid="true"` |
| Plant layout zone areas | `role="button"` `aria-label="{zoneName} � {compliance}% compliant"` |
| Sidebar collapse toggle | `aria-label` toggling "Expand sidebar" / "Collapse sidebar" |

### 18.6 Reduced Motion

Respect `prefers-reduced-motion`. When reduced motion is active:
- Disable all CSS animations (`animation: none`)
- Remove transitions on shimmer skeletons
- Remove zone card pulse animation
- Chart animations disabled (Recharts `isAnimationActive={false}`)

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### 18.7 Touch Target Size

Minimum interactive target size: **44�44px** (WCAG 2.5.5).
- Buttons: `min-h-[44px]` on large; `min-h-[36px]` on medium; `min-h-[28px]` on small (acceptable in dense table contexts)
- Icon buttons: at least `p-2` padding to reach 36px; prefer `p-2.5` for primary header icons

### 18.8 Screen Reader Considerations

- Page titles: unique `<title>` tag per page updated via React Router
- Landmark regions: `<aside>` (sidebar), `<header>`, `<main>`, `<nav aria-label>`
- Skip link: `<a href="#main-content" className="sr-only focus:not-sr-only">` as first element in DOM
- Decorative icons: `aria-hidden="true"` on all icon elements

---

## 19. Motion Guidelines

### 19.1 Principles

1. Motion serves communication � it must always carry meaning (state change, direction, focus).
2. Motion must never delay information. Animations that hide or delay data are prohibited.
3. All durations are short. This is a monitoring application, not a marketing page.
4. Use `ease-out` for things entering the screen; `ease-in` for things leaving.

### 19.2 Duration Scale

| Token | Duration | Use |
|---|---|---|
| `duration-fast` | 100ms | Hover colour changes, focus rings, badge tints |
| `duration-normal` | 200ms | Sidebar collapse, button state changes, card hover |
| `duration-slow` | 300ms | Drawer slide, Dialog enter/exit |
| `duration-chart` | 400ms | Chart initial render animation (Recharts default) |

Tailwind classes: `duration-100`, `duration-200`, `duration-300`.

### 19.3 Hover Animation

- Colour transitions: `transition-colors duration-100`
- Border colour change: `transition-colors duration-200`
- Background change on cards/rows: `transition-colors duration-200`
- No scale transforms on hover for data components. Scale is reserved for marketing components.
- Exception: Collapse/expand toggle icon: `transition-transform duration-200 rotate-180`

### 19.4 Card Animation

- Zone card, Camera card: `transition-all duration-200` on border colour only
- No entrance animation for cards loaded from data � they appear instantly
- Zone card pulsing (high violation): `animation: pulse-border 1.8s ease-in-out infinite`

```css
@keyframes pulse-border {
  0%, 100% { box-shadow: 0 0 0 0 rgba(194, 84, 80, 0.6); }
  50%       { box-shadow: 0 0 0 6px rgba(194, 84, 80, 0); }
}
```

### 19.5 Drawer Animation

- Entry: `translate-x-0`, `transition-transform duration-300 ease-out`
- Exit: `translate-x-full`, `transition-transform duration-300 ease-in`
- Overlay: `opacity-0` ? `opacity-100`, `transition-opacity duration-200`

### 19.6 Dialog Animation

- Dialogs appear instantly (no slide or scale). The overlay fades in: `transition-opacity duration-200`.
- Rationale: In a monitoring context, dialog content must be visible immediately.

### 19.7 Toast Animation

Managed by `react-hot-toast` default: slide in from top-right, 200ms. No custom override needed.

### 19.8 New Alert Row Fade

When a new alert row arrives in the feed:
```css
@keyframes fade-highlight {
  0%   { background-color: rgba(74, 143, 163, 0.18); }
  100% { background-color: transparent; }
}
.new-row-fade { animation: fade-highlight 3s ease-out forwards; }
```
The row is highlighted in a subtle accent tint for 3 seconds, then fades to transparent.

### 19.9 Loading Shimmer Animation

```css
@keyframes shimmer {
  0%   { background-position: -400px 0; }
  100% { background-position:  400px 0; }
}
.shimmer {
  background: linear-gradient(90deg,
    var(--color-panel) 25%,
    var(--color-panel-alt) 50%,
    var(--color-panel) 75%);
  background-size: 800px 100%;
  animation: shimmer 1.4s infinite linear;
}
```

### 19.10 Chart Animation

Recharts default animation duration: 400ms. Use default. Do not set `isAnimationActive={false}` unless reduced motion is active (see �18.6).

### 19.11 Page Transition

No page transition animation. Pages render immediately on navigation. React Router renders the new route component synchronously; React Suspense shows the skeleton during lazy load.

### 19.12 Compliance Progress Bar

Zone card compliance bar: `transition-all duration-700` on the width property.  
This gives a smooth update when live data arrives from WebSocket.

---

## 20. Page Design Standards

This section defines the exact layout, component composition, and visual hierarchy for every page in the application. No additional design decisions are required during implementation.

### 20.1 Login Page (`/login`)

**Layout:** `AuthLayout` � full-page centered card  
**Content (top ? bottom):**
1. Logo + App name (above card)
2. Card: title "Sign in" (H2), subtitle "PPE Detection & Monitoring System" (caption)
3. Username input
4. Password input (show/hide toggle)
5. Error message area (hidden until submit failure)
6. Primary button "Sign in" full-width
7. "Forgot your password?" link, right-aligned or centred below button
8. Demo credentials panel (dev only � `bg-panel-alt border border-border-soft rounded-lg p-3`)

**Loading:** Button enters loading state on submit. No page-level skeleton.  
**Empty states:** N/A  
**Responsive:** Single column at all widths. Card: `max-w-md w-full`.

---

### 20.2 Monitoring Dashboard (`/monitoring`)

**Layout:** `AppLayout` � full width, `p-6`

**Role: Safety Officer / Admin (full site):**
```
[Page section gap: space-y-6]
[ComplianceStats � 3-column grid: Gauge | BarChart zones | LineChart timeline]
[Row: WorkerStatusWidget (1) | CameraStatusWidget (1) | TopViolatingZonesWidget (2)]
[ZoneGrid � responsive grid of ZoneCards]
[Row: CameraGrid (2/3) | AlertFeedWidget + LiveWorkerList (1/3)]
```

**Role: Site Supervisor (zone-scoped):**
Same layout. All widgets receive `assignedZones` prop. Scope indicator banner at top.

**Empty states:**
- Zone grid: EmptyState if no zones configured
- Camera grid: EmptyState per zone filter
- Live worker list: EmptyState "No workers currently detected"
- Top violating zones: EmptyState "No violations detected in the selected time period."

**Loading:** Skeleton per widget. Charts show `LoadingSkeleton variant="chart"`.

---

### 20.3 Alerts & Violations (`/alerts`)

**Layout:** `AppLayout`, `p-6`, `space-y-4`

```
[SectionHeader: "Alerts & Violations" | subtitle | no action button]
[AlertFilters � filter bar with 4 inputs + active chips]
[AlertTable � full-width table with pagination]
[AlertDetailPanel � Drawer (right, 480px), rendered conditionally]
```

**Table columns (11):** ID � Time � Zone � Worker � Missing PPE � Severity � Status � Ack By � Ack At � Resolved By � Resolved At

**Escalated rows:** Left red border + red tint background. Pinned to top by default sort.

**Empty state:** "No alerts match the current filters" with "Clear filters" action.

**Loading:** `LoadingSkeleton variant="table" rows={8}` on first load.

---

### 20.4 Workers List (`/workers`)

**Layout:** `AppLayout`, `p-6`, `space-y-4`

```
[SectionHeader: "Workers"]
[Filter bar: Search (w-56) | Zone select (w-44) | Compliance select (w-48)]
[DataTable � 7 columns]
```

**Table columns:** Worker ID � Name � Department � Current Zone � Last Seen � Compliance % � Active Violations

**Row click:** Navigate to `/workers/:workerId`

**Compliance % column:** Coloured text � green/amber/red per threshold.

---

### 20.5 Worker Profile (`/workers/:workerId`)

**Layout:** `AppLayout`, `p-6`, `max-w-5xl`, `space-y-6`

```
[Back link: ? Back to workers]
[Header card: Avatar (w-16 h-16 circle) | Name, ID, dept | Badges | Stats grid]
[ComplianceHistoryChart � LineChart 30 days, h-160, reference line at 80%]
[Recent violations card � list of last 10 with badges + zone + timestamp]
[ZoneEntryExitLog � DataTable below]
```

**Loading:** Skeleton on profile card and chart while `useQuery` resolves.

---

### 20.6 Reports Page (`/reports`)

**Layout:** `AppLayout`, `p-6`, `space-y-5`

```
[SectionHeader: "Reports & Analytics"]
[Tab bar: Daily | Weekly | Monthly | By Worker | Ad-Hoc]
[Tab content � lazy loaded]
```

**Daily tab:** Date picker + 3 KPI cards + BarChart (zone compliance) + shift breakdown table + export buttons

**Weekly tab:** Week selector + LineChart 7-day + top violating zones list + summary card + export buttons

**Monthly tab:** Month selector + LineChart 30-day + PPE pie chart + summary + export buttons

**By Worker tab:** Date range + zone/dept/threshold filters + DataTable (9 cols) + export buttons. Row highlighting per compliance.

**Ad-Hoc tab:** Filter panel (zone/date/PPE/severity) + Apply button + chart (auto-selected) + results table

---

### 20.7 KPI Summary (`/kpi`)

**Layout:** `AppLayout`, `p-6`, `max-w-5xl`, `space-y-6`

```
[SectionHeader: "Safety Summary" subtitle "Site-wide safety performance � today"]
[KPI strip: 5 � KPICard in grid-cols-5]
  1. Overall Compliance (sparkline)
  2. Active Violations (trend)
  3. Areas of Concern (neutral label, not "Zones at Risk")
  4. Workers on Site Today
  5. Avg Alert Response Time (trend � down = good)
[PlantLayoutWidget � read-only heatmap]
[Summary card: plain-language text, no jargon]
```

**Rules:** Read-only. No action buttons. No technical terms. "Inference", "confidence score", "bounding box" are prohibited.

---

### 20.8 Admin � System Health (`/admin/system-health`)

**Layout:** `AdminLayout` (sub-nav tabs) + `p-6`, `space-y-6`

```
[SectionHeader: "System Health"]
[Services grid: 3-col, each a Card with name + Badge + lastHeartbeat]
[Cameras table: ID | Name | Status Badge | Last Seen]
[Alert banner (conditional): "One or more components have been offline for more than 5 minutes."]
```

Auto-refreshes every 30s.

---

### 20.9 Admin � User Management (`/admin/users`)

**Layout:** `AdminLayout` + `p-6`, `space-y-4`

```
[SectionHeader: "User Management" | "Create User" primary button]
[Filter bar: search (w-56) | role select (w-44) | status select (w-36)]
[DataTable: Name | Email | Role Badge | Status Badge | Last Login | Assigned Zones | Actions]
[UserFormModal � Dialog, conditional]
[Confirm deactivate � Dialog, conditional]
```

---

### 20.10 Admin � Zone Configuration (`/admin/zones`)

**Layout:** `AdminLayout` + `p-6`, `space-y-4`

```
[SectionHeader: "Zone Configuration" | "Create Zone" button]
[DataTable: Name | Description | Required PPE (chips) | Cameras | Status | Actions]
[ZoneFormModal � Dialog, conditional]
```

---

### 20.11 Admin � Camera Management (`/admin/cameras`)

**Layout:** `AdminLayout` + `p-6`, `space-y-4`

```
[SectionHeader: "Camera Management" | "Add Camera" button]
[DataTable: Camera ID | Name | RTSP URL (masked) | Zone | Status Badge | Last Seen | Actions]
[CameraFormModal � Dialog with Test Connection inline feedback]
```

---

### 20.12 Admin � Alert Config (`/admin/alert-config`)

**Layout:** `AdminLayout` + `p-6`, `space-y-5`

```
[SectionHeader: "Alert Severity & Thresholds" | "Save Changes" primary button]
[Per-zone config cards: zone name heading | confidence Slider | escalation delay input]
```

One card per zone (6 zones). `space-y-4`.

---

### 20.13 Admin � Audit Log (`/admin/audit-log`)

**Layout:** `AdminLayout` + `p-6`, `space-y-4`

```
[SectionHeader: "Audit Log" | "Export CSV" secondary button]
[Filter bar: search description (w-64) | actor filter (w-44)]
[DataTable (sticky header): Timestamp | Actor | Action | Entity | Description | IP]
[Pagination]
```

Page size: 50 rows (larger than default).

---

### 20.14 Profile Page (`/profile`)

**Layout:** `AppLayout` (standard), `p-6`, `max-w-2xl`, `space-y-8`

```
[SectionHeader: "My Profile" subtitle "Manage your account details and password."]
[Account card: Avatar circle | Name | Email | Role badge (read-only) | Last login]
  [Edit form inside card: Name input | Email input | Role (read-only display) | Save button]
[Password card: Current password | New password | Confirm | Update button]
```

Role badge: read-only, uses `ROLE_BADGE_COLOR` mapping (see roles constant).

---

### 20.15 Help Page (`/help`)

**Layout:** `AppLayout`, `p-6`, `max-w-3xl`, `space-y-5`

```
[SectionHeader: "Help & Guide" subtitle "A quick guide to each section."]
[Card per section: title (H4) | plain text explanation]
```

8 sections: Live Monitoring, Alerts, Workers, Reports, KPI Summary, Admin Console, Notifications, Connection Status.

No action buttons. No external links. Plain language only.

---

### 20.16 Forbidden Page (`/forbidden`)

**Layout:** Standalone centered, full viewport  
```
[Large "403" � text-7xl font-bold text-border]
[Heading: "Access denied" � text-2xl]
[Body: "You don't have permission to view this page."]
[Role indicator: "Your role: {roleName}" � text-xs text-text-muted]
[Button: "Go to my dashboard" � secondary md]
```

---

### 20.17 Not Found Page (`*`)

**Layout:** Same as Forbidden  
```
[Large "404" � text-7xl font-bold text-border]
[Heading: "Page not found" � text-2xl]
[Body: "The page you're looking for doesn't exist or has been moved."]
[Button: "Back to dashboard" � secondary md]
```

---

## 21. Icons

### 21.1 Icon Library

**The only permitted icon library is Lucide React.**  
Package: `lucide-react`  
Do not import from any other icon library. Do not use emoji as functional icons (emoji may only be used as sidebar navigation decorators in the sidebar � and only until Lucide icons are assigned to every nav item).

### 21.2 Icon Sizes

| Size Token | Pixels | Tailwind | Use |
|---|---|---|---|
| xs | 12px | `w-3 h-3` | Inline indicator dots, micro icons |
| sm | 16px | `w-4 h-4` | Button icons, badge prefix icons, input icons |
| md (default) | 20px | `w-5 h-5` | Header icons (bell, avatar), notification type icons |
| lg | 24px | `w-6 h-6` | Empty state icons, section icons |
| xl | 32px | `w-8 h-8` | Large state indicators (404, 403 illustrative icons) |

### 21.3 Icon Usage Rules

1. All icon-only interactive elements (icon buttons with no visible label) must have `aria-label`.
2. All icons within labels or buttons must have `aria-hidden="true"` � the surrounding element provides the accessible name.
3. Icons are always `currentColor` stroke (Lucide default). Never override fill colour with a raw hex.
4. Icon stroke width: `strokeWidth={1.8}` for md/lg sizes; `strokeWidth={2}` for sm sizes. Do not use default `strokeWidth={2}` for large icons � it looks too heavy.
5. Icons must not be used as the sole means of conveying status � always pair with a text label or `sr-only` text.

### 21.4 Standard Icon Assignments

| Context | Lucide Icon | Size |
|---|---|---|
| Notifications bell | `Bell` | md (20px) |
| Logout | `LogOut` | sm (16px) |
| Profile / user | `User` | sm (16px) |
| Settings / admin | `Settings` | sm (16px) |
| Alert / violation | `AlertTriangle` | md (20px) |
| Camera | `Camera` | sm�md |
| Zone / map | `Map` | sm |
| Worker | `HardHat` | sm |
| Report / chart | `BarChart2` | sm |
| KPI | `TrendingUp` | sm |
| Help | `HelpCircle` | sm |
| Search | `Search` | sm (16px) � inside search input |
| Close / dismiss | `X` | sm (16px) |
| Chevron down | `ChevronDown` | sm |
| Chevron right | `ChevronRight` | sm |
| Check / resolve | `CheckCircle` | md |
| Eye / show | `Eye` | sm |
| Eye off / hide | `EyeOff` | sm |
| Server / service | `Server` | md |
| Info | `Info` | md |
| Sort ascending | `ArrowUp` | xs |
| Sort descending | `ArrowDown` | xs |
| Export / download | `Download` | sm |
| Edit | `Pencil` | sm |
| Delete / deactivate | `Trash2` | sm |
| Filter | `Filter` | sm |
| Calendar / date | `Calendar` | sm |
| Wifi off | `WifiOff` | md � empty state, disconnected |
| Wifi | `Wifi` | sm � WS connected indicator |
| Shield | `Shield` | lg � app logo mark |
| Shield off | `ShieldOff` | lg � forbidden page |
| Inbox | `Inbox` | lg � generic empty state |

### 21.5 Do Not Mix

Never import from `react-icons`, `@heroicons/react`, `@mui/icons-material`, FontAwesome, or any other icon library. If a required icon does not exist in Lucide, use the closest available Lucide icon and document the substitution here.

---

## 22. Design Constraints

This section defines what developers and AI assistants **must never do** when implementing the frontend. These are hard rules, not guidelines.

### 22.1 Colour Constraints

| # | Rule |
|---|---|
| C-01 | **Never use a hardcoded hex value** in any component file (`.tsx`, `.ts`, `.css`). All colours must reference a CSS custom property via a Tailwind token class. |
| C-02 | **Never use raw Tailwind colour classes** (e.g., `text-red-400`, `bg-blue-600`, `border-gray-300`). Use only the semantic token classes defined in �2.2. |
| C-03 | **Never use a status colour decoratively.** `text-status-danger` is for danger states only. Using it for a heading because "it looks nice" is prohibited. |
| C-04 | **Never invent a new colour.** If the required colour does not exist in the token system, add it to �2.1 first and update `index.css` and `tailwind.config.js`. Then use the new token. |
| C-05 | **Never override chart colours** per-component. Always use `var(--color-chart-1)` through `var(--color-chart-6)` in sequence. |

### 22.2 Spacing Constraints

| # | Rule |
|---|---|
| S-01 | **Never hardcode pixel values in `className`** (e.g., `style={{ marginTop: '17px' }}`). All spacing must use the 4px grid via Tailwind spacing classes. |
| S-02 | **Never use `m-auto` or `mx-auto` on page sections** inside the main content area. Use the grid and flexbox system. |
| S-03 | **Never invent arbitrary spacing.** The nearest 4px multiple from the scale in �4.2 must be used. |

### 22.3 Typography Constraints

| # | Rule |
|---|---|
| T-01 | **Never use `font-bold` on body text.** Bold weight is reserved for KPI card values and the Display type. |
| T-02 | **Never use uppercase text** on anything other than section micro-labels (`text-xs uppercase tracking-wide text-text-muted`). |
| T-03 | **Never use a font size not in the type scale** (�3.2). `text-[13px]` or `text-[15px]` are prohibited. |
| T-04 | **Never use more than one `H1` per page.** The SectionHeader provides the page's H1 equivalent. |
| T-05 | **Never use `text-text-muted` for content the user must read.** It is for decorative or supplementary text only. |
| T-06 | **Never underline text** except anchor links on hover. |

### 22.4 Component Constraints

| # | Rule |
|---|---|
| CO-01 | **Never create a page-specific component** if a reusable component already covers the use case. Check `src/components/ui/` and `src/components/widgets/` first. |
| CO-02 | **Never invent a new button variant.** Only `primary`, `secondary`, `ghost`, and `danger` exist. |
| CO-03 | **Never invent a new card style.** Use the Card component with appropriate props. |
| CO-04 | **Never show two `primary` buttons** in the same visible page section. |
| CO-05 | **Never exceed five KPI cards in a single row.** |
| CO-06 | **Never render a table without an empty state.** Every DataTable must have `emptyHeading` and `emptyMessage` props. |
| CO-07 | **Never render async-backed content without a loading skeleton.** Every `useQuery` must show a skeleton while `isLoading` is true. |
| CO-08 | **Never hard-code navigation items.** Use `ROUTE_PERMISSIONS` to compute visible routes. |
| CO-09 | **Never add an action button to the KPI Summary page.** It is read-only by design. |
| CO-10 | **Never use technical AI/ML jargon on the KPI page or Plant Management views.** No "inference", "confidence score", "bounding box", "model", or "detection pipeline". |

### 22.5 Layout Constraints

| # | Rule |
|---|---|
| L-01 | **Never allow horizontal scroll at the page level.** `overflow-x-hidden` on the root if needed. Horizontal scroll is only permitted inside table wrappers. |
| L-02 | **Never place a `panel` card directly on a `panel` background.** Use `bg` ? `panel` ? `panel-alt` layering (�2.4). |
| L-03 | **Never add a drop shadow to standard cards.** Borders define elevation for non-floating elements. |
| L-04 | **Never put the page title in the header.** The header contains only WS status, bell, and avatar. Page titles go inside the page content area. |
| L-05 | **Never place navigation filters or action buttons in the SectionHeader.** Filters go in a FilterBar below the header; actions go right-aligned in the header row only if they are the primary CTA for the page. |

### 22.6 Accessibility Constraints

| # | Rule |
|---|---|
| A-01 | **Never suppress the focus ring** with `outline-none` without providing a visible custom alternative. |
| A-02 | **Never communicate status by colour alone.** Always pair with text or a `sr-only` label. |
| A-03 | **Never use a `<div onClick>` for interactive elements.** Use `<button>` or `<a>`. |
| A-04 | **Never omit `aria-label` on icon-only buttons.** |

### 22.7 Data & Content Constraints

| # | Rule |
|---|---|
| D-01 | **Never display raw API field names** (e.g., `complianceRate`, `zoneId`) in the UI. Always use human-readable labels from the constants. |
| D-02 | **Never show RTSP URLs in plain text.** Always mask: display `rtsp://***`. |
| D-03 | **Never display confidence scores or model output labels** on the KPI Summary or Plant Management pages. |

---

## 23. Implementation Rules

### 23.1 How to Build a New Page

Every new page must follow this checklist before any code is written:

1. **Identify the page in �20.** If it is listed, follow its specification exactly.
2. **Check �22** for any constraints that apply to this page.
3. **Use `AppLayout` or `AuthLayout`** � never build a custom shell.
4. **Use `SectionHeader`** as the first element inside the page content.
5. **Compose from existing widgets and UI components.** Never write page-specific JSX that duplicates an existing component.
6. **Add `ErrorBoundary`** around every section that fetches data.
7. **Add loading skeletons** for every `useQuery` call.
8. **Add empty states** for every list, table, and chart.
9. **Verify ARIA** requirements from �18.5 are met.
10. **Verify spacing** uses only values from �4.2.

### 23.2 How to Use Reusable Components

Priority order when building UI:

1. `src/components/ui/` � atomic primitives (Button, Input, Badge, etc.)
2. `src/components/widgets/` � composed dashboard widgets (KPICard, AlertFeedWidget, etc.)
3. Feature-level components in `src/features/{feature}/` � for page-specific compositions
4. **Never** create a new standalone component if an existing one can be configured via props

When a new variant of an existing component is needed, **add it to the component via a new prop** � do not duplicate the component.

### 23.3 How to Add a New Design Token

If a new colour, spacing value, or typography size is genuinely required:

1. **Stop.** Verify it cannot be satisfied by an existing token.
2. If truly new: add the CSS custom property to `src/index.css` under the appropriate group.
3. Add the Tailwind token mapping in `tailwind.config.js`.
4. Add the new token to the relevant table in this design-system.md (�2, �3, or �4).
5. Document which component or context uses it and why.
6. **Never** add a token that is specific to a single component. Tokens are system-wide by definition.

### 23.4 How to Handle Future Design Changes

All visual changes flow through design tokens, not through component edits:

1. **Colour change:** Update `--color-{token}` in `src/index.css`. The change propagates everywhere that token is used.
2. **Typography change:** Update the relevant size/weight in `src/index.css` and document in �3.
3. **Spacing change:** Update the component's Tailwind class, referencing only scale values from �4.2.
4. **Component behaviour change:** Update the component file AND update the specification in �9.
5. **New page layout:** Add a new subsection to �20 before writing the component.

### 23.5 Naming Conventions

| Resource | Convention | Example |
|---|---|---|
| React component files | PascalCase | `AlertDetailPanel.tsx` |
| Utility / hook files | camelCase | `useWebSocket.ts`, `auditLog.ts` |
| API files | camelCase + `Api` suffix | `alertsApi.ts` |
| Store files | camelCase + `Store` suffix | `alertStore.ts` |
| Constant files | camelCase, plural noun | `roles.ts`, `ppeTypes.ts` |
| CSS custom properties | `--color-{semantic-name}` | `--color-status-danger` |
| Tailwind token classes | kebab-case semantic | `text-status-danger`, `bg-panel-alt` |
| Component props | camelCase | `isLoading`, `onZoneClick`, `assignedZones` |
| TypeScript interfaces | PascalCase + descriptive noun | `AlertFilterState`, `WorkerComplianceRow` |
| Query keys | array of strings, kebab-consistent | `['admin', 'audit-log', filters]` |

### 23.6 Component Props Guidelines

- Use `boolean` props for state variants: `isLoading`, `disabled`, `readonly`
- Use discriminated union types for variant props: `variant: 'primary' | 'secondary' | 'ghost' | 'danger'`
- Callback props: prefix with `on` � `onClick`, `onClose`, `onZoneClick`, `onUpdate`
- Size props: use the size union type: `size: 'sm' | 'md' | 'lg'`
- Never use `style={{}}` inline styles except where Recharts requires it (chart colour values)

### 23.7 Design Token Usage in Component Files

```tsx
// ? CORRECT � use Tailwind token classes
<div className="bg-panel border border-border-soft rounded-xl p-4">
  <p className="text-sm text-text-secondary">...</p>
</div>

// ? WRONG � hardcoded hex
<div style={{ background: '#1B1F27', border: '1px solid #21252D' }}>
  <p style={{ color: '#9BA3B8', fontSize: '14px' }}>...</p>
</div>

// ? WRONG � raw Tailwind colour class
<div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
  <p className="text-sm text-gray-400">...</p>
</div>
```

### 23.8 Recharts Colour Usage

Recharts components receive colours as prop strings � they cannot use Tailwind classes.  
Always use CSS variable references:

```tsx
// ? CORRECT
<Bar dataKey="violations" fill="var(--color-chart-1)" />
<Line stroke="var(--color-chart-2)" />

// ? WRONG
<Bar dataKey="violations" fill="#4A8FA3" />
<Line stroke="#4F9E7C" />
```

### 23.9 Accessibility Implementation Checklist

Before submitting any new component or page for review:

- [ ] All interactive elements reachable by keyboard (Tab, Enter, Space)
- [ ] Focus ring visible on all focused elements
- [ ] All icon-only buttons have `aria-label`
- [ ] All status badges have `<span className="sr-only">` text
- [ ] All form inputs have associated `<label>` via `htmlFor`
- [ ] All form error messages have `role="alert"`
- [ ] Dialog/Drawer: focus trapped, ESC closes, `role="dialog"` present
- [ ] No `onClick` without keyboard equivalent on non-button elements
- [ ] `aria-busy="true"` on loading skeletons
- [ ] `aria-live="polite"` on dynamic status regions

### 23.10 Performance Guidelines

1. Every feature page is lazy-loaded via `React.lazy` + `Suspense`.
2. TanStack Query stale times are defined in `lib/queryClient.ts` � never override `staleTime` inline per component unless there is a documented reason.
3. `useWebSocket` is mounted exactly once, in `AppLayout`. Never mount it in a feature component.
4. The alert escalation interval (`startEscalationInterval`) is started exactly once, in `AppLayout`'s `useEffect`. Never start it elsewhere.
5. Charts use `<ResponsiveContainer>` � never a fixed pixel width.
6. Images (if any) use `loading="lazy"` and have explicit `width` and `height` attributes.

---

## Appendix A: Quick Reference Card

### Colours (most common)

| What | Class |
|---|---|
| Page bg | `bg-bg` |
| Card/panel bg | `bg-panel` |
| Input/table header bg | `bg-panel-alt` |
| Card border | `border border-border-soft` |
| Primary text | `text-text-primary` |
| Secondary text | `text-text-secondary` |
| Muted text | `text-text-muted` |
| Accent / links | `text-accent` |
| Success / online | `text-status-ok` |
| Warning / ack | `text-status-warn` |
| Danger / violation | `text-status-danger` |
| High severity | `text-severity-high` |
| Medium severity | `text-severity-medium` |

### Spacing (most common)

| What | Class |
|---|---|
| Page padding | `p-6` |
| Card padding | `p-4` |
| Card gap | `gap-4` |
| Section gap | `space-y-6` |
| Form field gap | `space-y-4` |
| Table cell | `px-4 py-3` |
| Nav item | `px-3 py-2.5` |

### Radius (most common)

| What | Class |
|---|---|
| Buttons, inputs | `rounded-md` |
| Cards, dialogs | `rounded-xl` |
| Badges | `rounded` |
| Chips, pills | `rounded-full` |
| Status dots | `rounded-full` |

### Typography (most common)

| What | Class |
|---|---|
| Page title | `text-2xl font-semibold text-text-primary` |
| Card title | `text-sm font-semibold text-text-secondary` |
| Section micro-label | `text-xs font-medium uppercase tracking-wide text-text-muted` |
| Body text | `text-sm text-text-secondary` |
| Timestamp / ID | `text-xs font-mono text-text-muted` |
| KPI value | `text-3xl font-bold text-text-primary` |
| Form label | `text-xs font-medium text-text-secondary` |
| Badge text | `text-xs font-medium` |

---

*End of Design System � Zone-Wise PPE Detection & Monitoring System v1.0*