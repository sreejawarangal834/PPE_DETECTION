# Handoff: PPE Analytics Dashboard

## Overview
The Analytics dashboard for the Zone-Wise PPE Detection & Monitoring System — the consolidated compliance-statistics view (`/analytics`) described in the attached `requirements.md` (US-MON-07) and `design.md`. Shows overall compliance gauge, violations-per-zone and violations-last-60-min charts, worker/camera status summaries, top violating zones, and a zone compliance card grid, inside the app's sidebar+header shell.

## About the Design Files
The file in this bundle (`PPE Analytics Dashboard.dc.html`) is a **design reference built in HTML** — a prototype showing intended look, layout, and behavior, not production code to copy directly. The task is to recreate this design in the target codebase's existing environment (per `design.md`: React 19 + Vite + TypeScript + Tailwind CSS + Zustand + TanStack Query + Recharts), following that codebase's established component patterns — not to ship the HTML as-is. Charts in the prototype are hand-built with inline SVG/CSS as visual stand-ins; in the real app they must be implemented with Recharts per `design-system.md` §12.

## Fidelity
**High-fidelity.** Colors, spacing, typography, and component layout are final. Recreate pixel-perfectly using the target stack's component library and the token system already defined in `design-system.md` — do not introduce new colors or spacing values.

## Screens / Views
**Analytics Dashboard** (`/analytics`)
- **Purpose:** Safety Officer / Site Supervisor / Admin / EHS Manager view of live compliance stats, without camera feeds (those live on `/monitoring`).
- **Layout:** Full-height flex row — fixed 240px sidebar + main column (header 56px + scrollable content, `padding:24px`).
  - Row 1: 3-column grid (`1fr 1.4fr 1.4fr`) — Compliance Gauge card, Violations-per-Zone bar chart card, Violations-last-60-min area/line chart card. `gap:16px`.
  - Row 2: 3-column grid (`1fr 1fr 2fr`) — Worker Status (donut+legend), Camera Status (4×2 dot grid), Top Violating Zones (ranked bars + time-window select).
  - Row 3: Zone Compliance grid, 4 columns, `gap:12px` — one card per zone.

### Components
- **Sidebar** (240px, bg `#1D1A16`, right border `#322D26`): logo lockup (28px rounded-6 mark + wordmark), 7 nav items (icon 18px + label, active = `background: rgba(156,74,79,0.16); color:#9C4A4F`, inactive = `color:#A8A296`), footer Profile/Logout links.
- **Header** (56px, bg `#1D1A16`, bottom border `#282420`): right-aligned WS status dot+label ("Live", green `#4F9E7C`), notification bell (18px, red `#C25450` count badge), avatar (32px circle) + name/role.
- **Cards:** bg `#1D1A16`, border `1px solid #282420`, `border-radius:12px`, `padding:16px`. Card eyebrow label: `font-size:11px; color:#6E685D; text-transform:uppercase; letter-spacing:0.06em`.
- **Compliance Gauge:** SVG half-donut, track `#24211C`, fill color by threshold (see Design Tokens), center `%` value `font-size:26px; font-weight:700` in IBM Plex Mono.
- **Bar chart:** flex row of bars, height % of tallest value, radius `3px 3px 0 0`, color by severity (green/amber/red by violation count).
- **Area/line chart:** SVG polyline + gradient-fill polygon, stroke `#9C4A4F` 2px, horizontal dashed gridlines `#282420`.
- **Worker Status donut:** CSS `conic-gradient` ring (88px, 12px inset hole), legend rows (8px square dot + label + count, IBM Plex Mono for counts).
- **Camera Status grid:** 4×2 grid of square tiles (bg `#24211C`, border `#322D26`), 8px status dot (green/amber/red) + camera ID in mono.
- **Top Violating Zones:** zone name (fixed 120px) + horizontal bar (`background:#24211C` track, `#C25450` fill by relative violation count) + count in mono.
- **Zone Compliance card:** name + violation-count badge (top row), large `%` value colored by threshold, 4px progress bar, worker count caption. Cards below 60% compliance get a pulsing red border-glow (`pulseBorder` keyframes, 1.8s).

## Interactions & Behavior
- Sidebar nav items and zone/camera/top-zone rows show hover states (background/opacity shifts) — no click handlers wired in the prototype; in the real app, clicking a zone/top-zone row should filter the Zone Compliance grid (per `requirements.md` US-MON-06/07), and clicking a camera or zone card should navigate to the Monitoring page for that entity.
- All chart/widget data in this prototype is static sample data — in production it must update live via the `MockWebSocketService` events described in `design.md` §8 (`zone_compliance_update`, `camera_metrics_update`, `worker_update`, `top_zones_update`).
- Zone cards under 60% compliance pulse a red glow continuously (`prefers-reduced-motion` should disable this per `design-system.md` §18.6).

## State Management
Per `design.md`: zone compliance, camera status, and worker list are Zustand-managed real-time state (WS-driven), not TanStack Query. This dashboard has no local component state beyond derived/computed display values (colors, bar widths, gauge angle) from that data — see `design-system.md` §7 for the full store shapes (`alertStore`, `wsStore`, zone/worker live stores).

## Design Tokens
**Colors** (formal warm-graphite theme — replaces the original cyan/blue "Midnight Slate" direction to avoid a generic blue tech look):
| Token | Hex |
|---|---|
| bg | `#15130F` |
| panel | `#1D1A16` |
| panel-alt | `#24211C` |
| panel-hover | `#2B2620` |
| border | `#322D26` |
| border-soft | `#282420` |
| text-primary | `#EDEAE2` |
| text-secondary | `#A8A296` |
| text-muted | `#6E685D` |
| accent (primary) | `#9C4A4F` (muted wine/burgundy) |
| accent-hover | `#B15D62` |
| status-ok | `#4F9E7C` |
| status-warn | `#D9A441` |
| status-danger | `#C25450` |

Compliance threshold rule (unchanged from `design-system.md`): ≥80% → ok green, 60–79% → warn amber, <60% → danger red.

**Typography:** IBM Plex Sans (UI text), IBM Plex Mono (IDs, timestamps, numeric/metric values) — per `design-system.md` §3.

**Spacing / radius:** 4px base grid; cards `rounded-xl` (12px), tiles/badges 4–8px — per `design-system.md` §4–5.

## Assets
None — all icons are Unicode glyphs / CSS shapes (no icon library wired up in the prototype; swap for Lucide icons per `design-system.md` in production, e.g. `LayoutGrid`, `Bell`, `Camera`).

## Files
- `PPE Analytics Dashboard.dc.html` — the full prototype (single self-contained file: layout, styles, and sample-data logic all inline).
- Refer back to the original `design.md`, `design-system.md`, `requirements.md`, `system-design.md`, and `tasks.md` (provided separately in the project) for full application scope beyond this one screen — this dashboard is one page of a much larger 20+ page application.
