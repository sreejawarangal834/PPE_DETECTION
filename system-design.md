# Dark UI Design System
### A reusable design specification for React + TypeScript + Tailwind CSS projects

---

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [Typography Tokens](#2-typography-tokens)
3. [Color Tokens](#3-color-tokens)
4. [Spacing System](#4-spacing-system)
5. [Border Radius](#5-border-radius)
6. [Shadow & Glow System](#6-shadow--glow-system)
7. [Layout Principles](#7-layout-principles)
8. [Responsive Behavior](#8-responsive-behavior)
9. [Component Rules — Buttons](#9-component-rules--buttons)
10. [Component Rules — Cards](#10-component-rules--cards)
11. [Component Rules — Forms & Inputs](#11-component-rules--forms--inputs)
12. [Component Rules — Tables](#12-component-rules--tables)
13. [Component Rules — Modals & Dialogs](#13-component-rules--modals--dialogs)
14. [Component Rules — Navigation](#14-component-rules--navigation)
15. [Component Rules — Badges & Status Chips](#15-component-rules--badges--status-chips)
16. [Dashboard Widget Design](#16-dashboard-widget-design)
17. [Notification Design](#17-notification-design)
18. [Animation Guidelines](#18-animation-guidelines)
19. [Loading & Empty States](#19-loading--empty-states)
20. [Accessibility Rules](#20-accessibility-rules)
21. [Tailwind Configuration](#21-tailwind-configuration)

---

## 1. Design Philosophy

This system is **dark mode only**. It is designed for internal tools, dashboards, and data-heavy applications where users spend extended time.

### Core Principles

| Principle | Implementation |
|---|---|
| **Depth through darkness** | Background layers darken as you go deeper: page → surface → input → code |
| **Glow instead of shadow** | Interactive elements use colored `box-shadow` glow on hover, not flat shadows |
| **Framer Motion for all entrances** | Every piece of content animates in — no instant renders |
| **Two accent families** | Primary blue for navigation/admin, primary indigo for content/data actions |
| **Glassmorphism sparingly** | `backdrop-blur` + semi-transparent bg used only on overlays and auth cards |


---

## 2. Typography Tokens

### Font Family
No custom font import required. Use Tailwind's default `font-sans` (system-ui / Inter stack).

```js
// tailwind.config.js — only add if you want a specific font
fontFamily: {
  sans: ['Inter', 'system-ui', 'sans-serif'],
}
```

### Type Scale

| Token | Tailwind Class | Size | Usage |
|---|---|---|---|
| `text-display` | `text-3xl` | 30px | Page titles |
| `text-heading-1` | `text-2xl` | 24px | Dashboard section titles, modal headings |
| `text-heading-2` | `text-xl` | 20px | Card section headings, panel headings |
| `text-heading-3` | `text-lg` | 18px | Card sub-titles, modal sub-headings |
| `text-body` | `text-base` | 16px | Body copy, sidebar nav |
| `text-body-sm` | `text-sm` | 14px | Secondary body, table cells, labels |
| `text-caption` | `text-xs` | 12px | Timestamps, badge text, table headers |

### Font Weights

| Token | Tailwind Class | Usage |
|---|---|---|
| `font-regular` | `font-normal` | Body copy |
| `font-medium` | `font-medium` | Nav links, labels, secondary UI |
| `font-semibold` | `font-semibold` | Card/section headings (`text-xl`) |
| `font-bold` | `font-bold` | Page titles, card titles, stat values |

### Heading Hierarchy in Practice

```tsx
// H1 — Page title
<h1 className="text-3xl font-bold text-white">Page Title</h1>

// H2 — Section or dashboard sub-title  
<h2 className="text-2xl font-bold text-white">Section Title</h2>

// H3 — Card heading with icon
<h3 className="text-xl font-semibold text-white flex items-center">
  <Icon className="h-5 w-5 mr-2 text-blue-400" />
  Card Title
</h3>

// H4 — Modal sub-heading
<h4 className="text-lg font-semibold text-gray-300">Sub Heading</h4>

// Label
<label className="block text-sm font-medium text-gray-300 mb-2">Field Label</label>

// Caption / timestamp
<span className="text-xs text-gray-500">2 hours ago</span>
```

### Gradient Text
Use sparingly — page hero headings and auth screens only.

```tsx
<h1 className="bg-gradient-to-r from-blue-400 to-cyan-400 text-transparent bg-clip-text font-bold">
  Heading
</h1>
```


---

## 3. Color Tokens

### Background Layers

| Token | Tailwind Class | Hex | Usage |
|---|---|---|---|
| `bg-page` | `bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900` | — | Root page background |
| `bg-surface-1` | `bg-gray-800` | `#1f2937` | Cards, panels, sidebars |
| `bg-surface-1-muted` | `bg-gray-800/50` | `#1f293780` | Semi-transparent cards |
| `bg-surface-2` | `bg-gray-700` | `#374151` | Icon containers, input backgrounds |
| `bg-surface-deep` | `bg-gray-900` | `#111827` | Modals, deep nested surfaces |
| `bg-surface-glass` | `bg-slate-900/70 backdrop-blur-xl` | — | Auth cards, overlays |
| `bg-surface-panel` | `bg-slate-900` | `#0f172a` | Slide panels |
| `bg-sidebar` | `radial-gradient(circle at 50% 30%, #1e293b 0%, #0f172a 100%)` | — | Sidebar background (inline style) |

### Border Colors

| Token | Tailwind Class | Usage |
|---|---|---|
| `border-default` | `border-gray-700` | All card and panel borders |
| `border-subtle` | `border-gray-600` | Input fields, inner dividers |
| `border-active` | `border-blue-400` | Focused nav items, active states |
| `border-panel` | `border-slate-700` | Slide panel, notification items |
| `border-auth` | `border-blue-500/30` | Auth card default → `border-blue-400` on hover |

### Text Colors

| Token | Tailwind Class | Usage |
|---|---|---|
| `text-primary` | `text-white` | Main content, headings |
| `text-secondary` | `text-gray-300` | Supporting text, nav items |
| `text-muted` | `text-gray-400` | Placeholders, meta info |
| `text-faint` | `text-gray-500` | Timestamps, read notifications |
| `text-accent-blue` | `text-blue-400` | Section icons, links |
| `text-accent-indigo` | `text-indigo-400` | Content/data accent |
| `text-accent-cyan` | `text-cyan-400` | Gradient text pairings only |
| `text-success` | `text-green-400` | Success states, verified |
| `text-warning` | `text-orange-500` | Warnings, unverified |
| `text-danger` | `text-red-400` / `text-red-500` | Errors, delete, unavailable |
| `text-info` | `text-blue-400` | Info states |
| `text-highlight-purple` | `text-purple-400` | Analytics/stats data |
| `text-highlight-yellow` | `text-yellow-400` | Starred/featured items |

### Accent / Brand Colors

| Name | Tailwind | Hex | Role |
|---|---|---|---|
| Primary | `blue-600` | `#2563eb` | Navbar, admin buttons, focus rings |
| Primary hover | `blue-700` | `#1d4ed8` | Primary button hover |
| Secondary | `indigo-600` | `#4f46e5` | Content actions, data interactions |
| Secondary hover | `indigo-700` | `#4338ca` | Secondary button hover |
| Cyan | `cyan-400` | `#22d3ee` | Gradient text pairings only |
| Success | `green-500/600` | `#22c55e` | Available, verified, success |
| Danger | `red-500/600` | `#ef4444` | Unavailable, error, delete |
| Warning | `orange-600` | `#ea580c` | Collect, warn, overdue |
| Star | `yellow-400` | `#facc15` | Featured/pinned items |
| Analytics | `purple-400` | `#c084fc` | Stats highlights |

### Semantic Status Colors

```tsx
// Available / success state chip
"bg-indigo-500/20 text-indigo-300 border-indigo-400/40"

// Unavailable / error state chip  
"bg-red-500/20 text-red-300 border-red-400/40"

// Read notification
"bg-slate-800/50 border-slate-700 border-l-green-500"

// Unread notification
"bg-slate-800 border-slate-600 border-l-blue-500"

// Error banner
"bg-red-900/20 border-red-500/30"  // subtle
"bg-red-900/50 border-red-500"     // prominent
```

### Role Badge Colors

```tsx
const roleBadgeColor = {
  admin:    'bg-red-500',
  manager:  'bg-purple-500',
  operator: 'bg-blue-500',
  staff:    'bg-green-500',
  viewer:   'bg-indigo-500',
  default:  'bg-gray-500',
}
```


---

## 4. Spacing System

### Base Unit
All spacing is based on Tailwind's default 4px grid (1 unit = 4px).

### Page-Level Spacing

| Context | Class | Value |
|---|---|---|
| Page padding (desktop) | `p-6` | 24px |
| Page padding (mobile) | `p-4` | 16px |
| Page padding (sidebar open) | `p-4 lg:p-6` | responsive |
| Page padding (sidebar closed) | `p-4 lg:p-8 xl:px-12` | responsive |
| Max content width | `max-w-7xl mx-auto` | 1280px centered |

### Section Spacing

| Context | Class |
|---|---|
| After page header | `mb-8` |
| Between major sections | `mb-6` or `mb-8` |
| After filter/control bar | `mb-6` |
| Between list items | `space-y-3` or `space-y-4` |
| Between form fields | `space-y-4` or `space-y-6` |
| Table row dividers | `divide-y divide-gray-700` |

### Component Internal Spacing

| Component | Padding |
|---|---|
| Standard card | `p-6` |
| Compact card / content card | `p-5` |
| Modal | `p-6` |
| Table cell | `px-6 py-4` |
| Table header cell | `px-6 py-4` |
| Notification item | `p-4` |
| Sidebar nav item | `p-3` |
| Icon container box | `p-3` |
| Button (standard) | `px-4 py-2` |
| Button (large/confirm) | `px-4 py-3` or `px-6 py-2` |
| Input field | `px-4 py-2` or `px-3 py-2` (compact) |
| Badge / chip | `px-2 py-1` (sm) · `px-2.5 py-0.5` (xs) |

### Grid Gap

| Layout | Class |
|---|---|
| Card grids | `gap-6` |
| Form field groups | `gap-4` or `gap-6` |
| Inline icon + text | `gap-2` or `space-x-2` |
| Button groups | `gap-3` |
| Filter controls | `gap-4` |


---

## 5. Border Radius

One of the most opinionated parts of this system. Rounder = friendlier; use the scale below consistently.

| Token | Tailwind | Usage |
|---|---|---|
| `radius-full` | `rounded-full` | Avatars, badges, dot indicators, nav active pill |
| `radius-card` | `rounded-2xl` | Primary cards, sidebar, GlowingCard, key cards |
| `radius-card-sm` | `rounded-xl` | Secondary cards, modals, table containers, panels |
| `radius-element` | `rounded-lg` | Buttons, inputs, selects, dropdowns, icon boxes |
| `radius-sm` | `rounded` | Checkboxes, small utility elements |

**Rule**: Cards use `rounded-2xl`. Everything inside them (buttons, inputs, badges) uses `rounded-lg` or smaller. Never use `rounded-3xl` or above.

---

## 6. Shadow & Glow System

Flat shadows are avoided. This system uses **colored glow** as the primary depth/interactivity signal.

### Glow Values

| Token | Value | Usage |
|---|---|---|
| `glow-blue-sm` | `shadow-[0_0_15px_rgba(59,130,246,0.4)]` | Dashboard cards hover |
| `glow-blue-md` | `shadow-[0_0_15px_rgba(59,130,246,0.5)]` | Sidebar nav hover |
| `glow-blue-lg` | `shadow-[0_0_25px_rgba(59,130,246,0.6)]` | Auth card hover |
| `glow-blue-nav` | `shadow-[0_0_15px_rgba(59,130,246,0.7)]` | Sidebar nav active |
| `glow-indigo-sm` | `shadow-[0_0_15px_rgba(99,102,241,0.5)]` | Search bar hover |
| `glow-indigo-md` | `shadow-[0_0_20px_rgba(99,102,241,0.5)]` | Content card hover |
| `glow-avatar` | `drop-shadow-[0_0_15px_rgba(59,130,246,0.6)]` | Avatar / profile picture |

### Application Rules

```tsx
// Card hover glow — add to className string:
"hover:shadow-[0_0_15px_rgba(59,130,246,0.4)] transition-all"

// Content card hover glow (indigo accent):
"hover:shadow-[0_0_20px_rgba(99,102,241,0.5)] hover:border-indigo-500 transition-all duration-500"

// Sidebar nav active:
"shadow-[0_0_15px_rgba(59,130,246,0.7)] border-blue-400"

// Auth card hover:
"hover:shadow-[0_0_25px_rgba(59,130,246,0.6)] hover:border-blue-400 transition-all duration-500"

// Framer Motion variant (GlowingCard):
whileHover={{ scale: 1.03, boxShadow: "0 0 20px rgba(59, 130, 246, 0.6)" }}
```

### Standard Shadows (non-glow)
```
Slide panel:     shadow-2xl
Sidebar:         shadow-lg
Logo / image:    shadow-md
```


---

## 7. Layout Principles

### Application Shell

```
┌──────────────────────────────────────────────────┐
│  NAVBAR  (sticky top, h-16, z-50)               │
├─────────────┬────────────────────────────────────┤
│             │                                    │
│   SIDEBAR   │         MAIN CONTENT               │
│  (w-64 lg)  │    (flex-1, overflow-auto)         │
│  (w-52 mob) │                                    │
│             │                                    │
└─────────────┴────────────────────────────────────┘
```

```tsx
// Shell wrapper
<div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 relative overflow-hidden">
  <Navbar />                          {/* sticky top-0 z-50 */}
  <div className="flex h-[calc(100vh-4rem)] relative z-10">
    <Sidebar />                       {/* collapsible */}
    <main className="flex-1 overflow-auto">
      <Outlet />
    </main>
  </div>
</div>
```

### Mobile Shell (Security / Operator role)

Mobile-first roles use a bottom navigation bar instead of a sidebar:

```
┌──────────────────────────────────────┐
│  HEADER  (p-4, border-b)             │
├──────────────────────────────────────┤
│                                      │
│         OUTLET CONTENT               │
│         (flex-1 overflow)            │
│                                      │
├──────────────────────────────────────┤
│  BOTTOM NAV  (fixed bottom, z-40)    │
└──────────────────────────────────────┘
```

### Grid Layouts

| Layout | Classes |
|---|---|
| Stats row (4-col) | `grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-6` |
| Analytics (3-col) | `grid grid-cols-1 lg:grid-cols-3 gap-6` |
| Content pair | `grid grid-cols-1 lg:grid-cols-2 gap-6` |
| Profile (1+2) | `grid grid-cols-1 lg:grid-cols-3 gap-6` |
| Admin actions (4-col) | `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4` |
| Form 2-col | `grid grid-cols-1 md:grid-cols-2 gap-4` |
| Mini stats | `grid grid-cols-2 md:grid-cols-4 gap-4` |

### Content Max Width
```tsx
// All admin/data pages:
<div className="max-w-7xl mx-auto">

// Auth / narrow forms:
<div className="max-w-md w-full mx-auto">
```
---

## 8. Responsive Behavior

### Breakpoints (Tailwind defaults)

| Prefix | Min Width | Context |
|---|---|---|
| *(none)* | 0px | Mobile first |
| `sm:` | 640px | Landscape phones |
| `md:` | 768px | Tablets, filter bars go horizontal |
| `lg:` | 1024px | Desktop, sidebar appears, grids expand |
| `xl:` | 1280px | Wide desktop, extended page padding |

### Sidebar Behavior

```
Mobile (< lg):   Fixed overlay, slides in from left, z-50
                 Backdrop overlay (bg-black opacity-50) z-40
                 Closes on nav click
                 Closes when breakpoint enters mobile range

Desktop (≥ lg):  Relative positioned, part of flex row
                 Width: w-64
                 Scroll locked on body when mobile sidebar is open
```

### Navigation Patterns by Role

| Role | Desktop | Mobile |
|---|---|---|
| Admin | Sidebar (full) | Sidebar (overlay) |
| Manager | Sidebar (full) | Sidebar (overlay) |
| Operator / Security | Sidebar optional | Bottom Navigation |
| End user / Faculty | Sidebar optional | Bottom Navigation |

### Typography Responsive Rules
```tsx
// Sidebar nav label — smaller on mobile:
<span className="font-medium text-sm lg:text-base">{label}</span>

// Page padding responsive:
className={`space-y-6 ${sidebarOpen ? "p-4 lg:p-6" : "p-4 lg:p-8 xl:px-12"}`}
```

### Grid Collapse Rules
- 4-col stats → 2-col on mobile: `grid-cols-2 md:grid-cols-2 lg:grid-cols-4`
- 3-col analytics → 1-col on mobile: `grid-cols-1 lg:grid-cols-3`
- 2-col content → 1-col on mobile: `grid-cols-1 lg:grid-cols-2`
- Filter bars → stack vertically on mobile: `flex-col sm:flex-row`

### Scrollbar

Add `.scrollbar-hide` to any container that should scroll without showing a scrollbar:

```css
/* index.css */
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
```


---

## 9. Component Rules — Buttons

### Hierarchy

Use exactly one primary button per section. All other actions are secondary or ghost.

### Primary (Blue)
```tsx
// Standard
<button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">
  Action
</button>

// With icon
<button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
  <Icon className="h-5 w-5" />
  Action
</button>

// Full width
<button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg font-medium transition-colors">
  Action
</button>
```

### Primary Alternate (Indigo — content actions)
```tsx
<button className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2">
  <Icon className="w-4 h-4" />
  Action
</button>
```

### Secondary / Cancel (dark)
```tsx
<button className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors">
  Cancel
</button>
```

### Secondary / Cancel (light modal)
```tsx
<button className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-3 px-4 rounded-lg font-medium transition-colors">
  Cancel
</button>
```

### Danger / Destructive
```tsx
<button className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">
  Delete
</button>
```

### Success / Confirm
```tsx
<button className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-lg font-medium transition-colors">
  Confirm
</button>
```

### Warning / Caution
```tsx
<button className="flex-1 bg-orange-600 hover:bg-orange-700 text-white py-2 px-4 rounded-lg font-medium transition-colors">
  Proceed
</button>
```

### Ghost / Icon-only (toolbar)
```tsx
<button className="p-2 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 transition-colors duration-200">
  <Icon size={24} />
</button>
```

### Disabled State
```tsx
// Add to any button:
"disabled:opacity-50 disabled:cursor-not-allowed"

// Disabled primary:
"disabled:bg-blue-600/50 disabled:cursor-not-allowed"
```

### Loading State (inline)
```tsx
{isLoading ? (
  <>
    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
    <span>Loading...</span>
  </>
) : (
  <>
    <Icon className="w-4 h-4" />
    <span>Label</span>
  </>
)}
```

### Large Action Tiles (dashboard quick-actions)
```tsx
<button className="flex items-center justify-center p-4 bg-gray-700 hover:bg-blue-600 rounded-lg transition-colors">
  <Icon className="h-5 w-5 mr-2 text-blue-400" />
  <span className="text-white font-medium">Action Label</span>
</button>
// Hover color variants: hover:bg-indigo-600, hover:bg-green-600, hover:bg-purple-600
```


---

## 10. Component Rules — Cards

### Card Variants

#### Standard Dashboard Card
Use for stats, analytics panels, and content sections.
```tsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.5, delay: index * 0.1 }}
  className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 hover:shadow-[0_0_15px_rgba(59,130,246,0.4)] transition-all"
>
  {children}
</motion.div>
```

#### Content / Data Card
Use for item cards (resources, entities, data records).
```tsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  className="bg-gray-800 border border-gray-700 rounded-2xl p-5
    transition-all duration-500
    hover:shadow-[0_0_20px_rgba(99,102,241,0.5)] hover:border-indigo-500"
>
  {children}
</motion.div>
```

#### Selectable / Clickable Card
Use for category cards, filter cards, any card the user clicks to select.
```tsx
<motion.div
  whileHover={{ scale: 1.02 }}
  whileTap={{ scale: 0.98 }}
  onClick={onClick}
  className={`
    bg-gray-800 border border-gray-700 rounded-2xl p-5 cursor-pointer
    transition-all duration-500
    hover:shadow-[0_0_20px_rgba(99,102,241,0.5)] hover:border-indigo-500
    ${isSelected ? "ring-2 ring-indigo-500 shadow-lg bg-gray-700" : ""}
  `}
>
  {children}
</motion.div>
```

#### GlowingCard (reusable wrapper)
```tsx
// components/ui/GlowingCard.tsx
import { motion } from "framer-motion";

export const GlowingCard = ({ children, className = "" }) => (
  <motion.div
    whileHover={{ scale: 1.03, boxShadow: "0 0 20px rgba(59, 130, 246, 0.6)" }}
    className={`bg-gray-800 rounded-2xl shadow-md border border-gray-700 transition-all duration-300 ${className}`}
  >
    {children}
  </motion.div>
);
```

#### Auth / Landing Card (glassmorphism)
```tsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.6 }}
  className="max-w-md w-full bg-slate-900/70 backdrop-blur-xl rounded-2xl
    border border-blue-500/30 p-6
    transition-all duration-500
    hover:shadow-[0_0_25px_rgba(59,130,246,0.6)] hover:border-blue-400"
>
  {children}
</motion.div>
```

#### Profile / Info Card
```tsx
<div className="bg-gray-900/60 backdrop-blur-xl rounded-2xl p-6 border border-gray-700">
  {children}
</div>
```

### Card Section Heading Pattern
```tsx
<h3 className="text-xl font-semibold text-white mb-4 flex items-center">
  <Icon className="h-5 w-5 mr-2 text-blue-400" />
  Section Title
</h3>
```

### Stat Card Pattern
```tsx
<div className="flex items-center justify-between">
  <div>
    <p className="text-gray-400 text-sm font-medium">{label}</p>
    <p className={`text-2xl font-bold mt-1 ${valueColor}`}>{value}</p>
    <p className="text-gray-500 text-sm mt-1">{subtext}</p>
  </div>
  <div className="p-3 rounded-lg bg-gray-700">
    <Icon className={`h-6 w-6 ${valueColor}`} />
  </div>
</div>
```

### Read-only Info Row (profile fields)
```tsx
<div>
  <p className="text-sm font-medium text-gray-300 mb-1">Field Name</p>
  <p className="text-white bg-gray-800/50 p-3 rounded-lg border border-gray-700">
    {value}
  </p>
</div>
```


---

## 11. Component Rules — Forms & Inputs

### Text Input (standard)
```tsx
<input
  className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg
    text-white placeholder-gray-400
    focus:outline-none focus:ring-2 focus:ring-blue-500
    transition-colors"
/>
```

### Text Input (with left icon)
```tsx
<div className="relative">
  <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
  <input
    className="w-full pl-10 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg
      text-white placeholder-gray-400
      focus:outline-none focus:border-blue-500
      transition-colors"
  />
</div>
```

### Search Input (indigo accent, group hover glow)
```tsx
<div className="relative group">
  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400 w-5 h-5
    transition-colors duration-300 group-hover:text-indigo-300" />
  <input
    className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-10 pr-4 py-3
      text-white placeholder-gray-400
      focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
      transition-all duration-500
      group-hover:shadow-[0_0_15px_rgba(99,102,241,0.5)]"
  />
</div>
```

### Input — Error State
```tsx
<input
  className="w-full px-4 py-2 bg-gray-800 rounded-lg text-white
    border border-red-500
    focus:outline-none focus:ring-2 focus:ring-red-500"
/>
<p className="text-red-400 text-sm mt-1">{errorMessage}</p>
```

### Select
```tsx
<select
  className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg
    text-white
    focus:outline-none focus:ring-2 focus:ring-blue-500"
>
  <option value="">Select option</option>
</select>
```

### Textarea
```tsx
<textarea
  rows={3}
  className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg
    text-white placeholder-gray-400
    focus:outline-none focus:ring-2 focus:ring-blue-500"
/>
```

### Checkbox
```tsx
<div className="flex items-center gap-2">
  <input
    type="checkbox"
    id="field"
    className="w-4 h-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500"
  />
  <label htmlFor="field" className="text-sm text-gray-300">
    Label text
  </label>
</div>
```

### Form Label
```tsx
<label className="block text-sm font-medium text-gray-300 mb-2">
  Field Label <span className="text-red-400">*</span>
</label>
```

### Validation Error
```tsx
<p className="text-red-400 text-sm mt-1">{error}</p>
```

### Form Section Rules
- Wrap every field in a `<div>` with `space-y-4` on the parent
- Labels always above inputs, never floating
- Required fields marked with `*` in `text-red-400`
- Error messages appear directly below the field they belong to
- Cancel / submit buttons at the bottom, right-aligned: `flex justify-end space-x-3 pt-4`
- Submit = `bg-blue-600`, Cancel = `bg-gray-600 hover:bg-gray-700`


---

## 12. Component Rules — Tables

### Table Container
```tsx
<div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
  <div className="overflow-x-auto">
    <table className="w-full">
      ...
    </table>
  </div>
</div>
```

### Table Head
```tsx
<thead className="bg-gray-700">
  <tr>
    <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
      Column
    </th>
  </tr>
</thead>
```

### Table Body
```tsx
<tbody className="divide-y divide-gray-700">
  <tr className="hover:bg-gray-700/50 transition-colors">
    <td className="px-6 py-4 whitespace-nowrap">
      <span className="text-sm font-medium text-white">Primary value</span>
      <span className="text-sm text-gray-400">Secondary value</span>
    </td>
  </tr>
</tbody>
```

### Table Icon + Text Cell
```tsx
<td className="px-6 py-4">
  <div className="flex items-center gap-3">
    <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
      <Icon className="w-5 h-5 text-white" />
    </div>
    <div>
      <div className="font-medium text-white">{primaryText}</div>
      <div className="text-sm text-gray-400">{secondaryText}</div>
    </div>
  </div>
</td>
```

### Table Status Cell
```tsx
<td className="px-6 py-4">
  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
    isActive
      ? "bg-green-900/50 text-green-400 border border-green-700"
      : "bg-red-900/50 text-red-400 border border-red-700"
  }`}>
    {isActive ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
    {isActive ? "Active" : "Inactive"}
  </span>
</td>
```

### Table Action Cell (icon buttons)
```tsx
<td className="px-6 py-4">
  <div className="flex items-center space-x-2">
    <button className="text-blue-400 hover:text-blue-300 p-1 rounded transition-colors">
      <Edit className="h-4 w-4" />
    </button>
    <button className="text-red-400 hover:text-red-300 p-1 rounded transition-colors">
      <Trash2 className="h-4 w-4" />
    </button>
  </div>
</td>
```

### Table Action Cell (overflow menu)
```tsx
<td className="px-6 py-4 relative">
  <button
    onClick={() => setShowMenu(!showMenu)}
    className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-600 transition-colors"
  >
    <MoreVertical className="w-4 h-4" />
  </button>
  {showMenu && (
    <div className="absolute right-0 top-full mt-1 bg-gray-700 rounded-lg shadow-lg border border-gray-600 z-10 min-w-[120px]">
      <button className="w-full px-4 py-2 text-left text-gray-300 hover:text-white hover:bg-gray-600 flex items-center gap-2 transition-colors">
        <Edit className="w-4 h-4" /> Edit
      </button>
      <button className="w-full px-4 py-2 text-left text-red-400 hover:text-red-300 hover:bg-gray-600 flex items-center gap-2 transition-colors">
        <Trash2 className="w-4 h-4" /> Delete
      </button>
    </div>
  )}
</td>
```

### Pagination Bar
```tsx
<div className="px-6 py-4 border-t border-gray-700 flex items-center justify-between">
  <span className="text-sm text-gray-400">Page {current} of {total}</span>
  <div className="flex space-x-2">
    <button
      onClick={prevPage}
      disabled={current === 1}
      className="px-4 py-2 bg-gray-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600 transition-colors"
    >
      Previous
    </button>
    <button
      onClick={nextPage}
      disabled={current === total}
      className="px-4 py-2 bg-gray-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600 transition-colors"
    >
      Next
    </button>
  </div>
</div>
```

### Table Filter Bar
Place above the table container, same card background:
```tsx
<div className="bg-gray-800 rounded-xl p-6 mb-6 border border-gray-700">
  <div className="flex flex-col sm:flex-row gap-4">
    {/* search input */}
    {/* filter selects */}
    {/* primary action button */}
  </div>
</div>
```


---

## 13. Component Rules — Modals & Dialogs

### Two Modal Families

| Family | Background | Use When |
|---|---|---|
| **Dark modal** | `bg-gray-900` / `bg-gray-800` | Admin actions, forms, confirmations within the dashboard |
| **Light modal** | `bg-white` | User-facing confirmations, QR display, success states shown to end users |

Never mix families on the same page. Match the modal style to the user's context.

### Backdrop
```tsx
// Standard
<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">

// Heavy (admin / destructive)
<div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
// or bg-black bg-opacity-75 for explicit opacity syntax
```

### Modal Entrance Animation
```tsx
// Always wrap modal content in motion.div:
<motion.div
  initial={{ opacity: 0, scale: 0.9 }}
  animate={{ opacity: 1, scale: 1 }}
  exit={{ opacity: 0, scale: 0.9 }}    // only when using AnimatePresence
  className="..."
>
```

### Dark Modal — Form
```tsx
<motion.div
  initial={{ opacity: 0, scale: 0.9 }}
  animate={{ opacity: 1, scale: 1 }}
  className="bg-gray-900 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-700"
>
  {/* Header */}
  <div className="flex items-center justify-between mb-6">
    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
      <Icon className="w-6 h-6" />
      Modal Title
    </h2>
    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
      <X className="w-6 h-6" />
    </button>
  </div>
  {/* Form body */}
  <form className="space-y-4">
    ...
    <div className="flex gap-3 pt-4">
      <button type="button" onClick={onClose}
        className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors">
        Cancel
      </button>
      <button type="submit"
        className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
        Submit
      </button>
    </div>
  </form>
</motion.div>
```

### Dark Modal — Confirmation / Destructive
```tsx
<motion.div
  initial={{ opacity: 0, scale: 0.9 }}
  animate={{ opacity: 1, scale: 1 }}
  className="bg-gray-900 rounded-xl p-6 max-w-md w-full border border-gray-700"
>
  <div className="text-center">
    <div className="w-12 h-12 bg-red-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
      <Trash2 className="w-6 h-6 text-red-400" />
    </div>
    <h3 className="text-xl font-bold text-white mb-2">Confirm Delete</h3>
    <p className="text-gray-400 mb-6">This action cannot be undone.</p>
    <div className="flex gap-3">
      <button onClick={onClose}
        className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors">
        Cancel
      </button>
      <button onClick={onConfirm}
        className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors">
        Delete
      </button>
    </div>
  </div>
</motion.div>
```

### Light Modal — User Confirmation
```tsx
<motion.div
  initial={{ opacity: 0, scale: 0.9 }}
  animate={{ opacity: 1, scale: 1 }}
  className="bg-white rounded-xl p-6 max-w-sm w-full"
>
  <div className="text-center">
    <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
    <h3 className="text-2xl font-bold text-gray-900 mb-2">Confirm Action</h3>
    <div className="bg-gray-50 rounded-lg p-4 mb-6">
      <p className="text-gray-600 text-sm">{details}</p>
    </div>
    <div className="flex gap-3">
      <button onClick={onCancel}
        className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-3 px-4 rounded-lg font-medium transition-colors">
        Cancel
      </button>
      <button onClick={onConfirm}
        className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-lg font-medium transition-colors">
        Confirm
      </button>
    </div>
  </div>
</motion.div>
```

### Success State inside Modal
```tsx
<motion.div
  initial={{ scale: 0 }}
  animate={{ scale: 1 }}
  transition={{ type: "spring", stiffness: 200, damping: 15 }}
  className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 rounded-2xl p-6 mb-4 shadow-lg"
>
  <motion.div
    initial={{ scale: 0 }}
    animate={{ scale: 1 }}
    transition={{ delay: 0.2, type: "spring", stiffness: 300 }}
    className="text-6xl mb-3 text-center"
  >✅</motion.div>
  <motion.p
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.3 }}
    className="text-green-700 font-bold text-2xl mb-2 text-center"
  >
    Success!
  </motion.p>
  <motion.p
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ delay: 0.4 }}
    className="text-green-600 text-base text-center"
  >
    Your action was completed.
  </motion.p>
</motion.div>
```

### Slide Panel (right-to-left drawer)
```tsx
<AnimatePresence>
  {isOpen && (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />
      {/* Panel */}
      <motion.div
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="fixed right-0 top-0 h-screen w-full max-w-md bg-slate-900 shadow-2xl z-50 flex flex-col"
      >
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-xl font-semibold text-white">Panel Title</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </motion.div>
    </>
  )}
</AnimatePresence>
```


---

## 14. Component Rules — Navigation

### Navbar

```tsx
<motion.nav
  initial={{ y: -100 }}
  animate={{ y: 0 }}
  className="bg-gray-900 bg-opacity-95 backdrop-filter backdrop-blur-lg border-b border-gray-800 px-4 py-3 sticky top-0 z-50"
>
  <div className="flex items-center justify-between">
    {/* Left — hamburger + brand */}
    <div className="flex items-center space-x-4">
      <button
        onClick={toggleSidebar}
        className="p-2 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 transition-colors duration-200"
      >
        {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
      </button>
      <div className="flex items-center space-x-2">
        <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-white shadow-md">
          <img src="/logo.png" alt="Logo" className="w-7 h-7 object-contain" />
        </div>
        <h1 className="text-xl font-bold text-white">App Name</h1>
      </div>
    </div>
    {/* Right — notifications + user */}
    <div className="flex items-center space-x-4">
      <NotificationBell />
      <UserDropdown />
    </div>
  </div>
</motion.nav>
```

### Sidebar

```tsx
// Nav link styling:
<NavLink
  to={path}
  className={({ isActive }) =>
    `flex items-center space-x-3 p-3 rounded-2xl transition-all duration-300 border border-gray-700 text-gray-300
    ${isActive
      ? "text-white border-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.7)]"
      : "hover:text-white hover:border-blue-400 hover:shadow-[0_0_15px_rgba(59,130,246,0.5)]"
    }`
  }
>
  <Icon size={20} />
  <span className="font-medium text-sm lg:text-base">{label}</span>
</NavLink>
```

Sidebar item stagger entrance:
```tsx
<motion.li
  initial={{ opacity: 0, x: -20 }}
  animate={{ opacity: 1, x: 0 }}
  transition={{ delay: index * 0.08 }}
>
```

### User Dropdown
```tsx
<div className="absolute right-0 mt-2 w-48 bg-gray-800 rounded-lg shadow-lg border border-gray-700 z-50
  transition-all duration-200"
  style={{ opacity: isOpen ? 1 : 0, visibility: isOpen ? 'visible' : 'hidden' }}
>
  <div className="p-3 border-b border-gray-700">
    <p className="text-sm font-medium text-white">{name}</p>
    <p className="text-xs text-gray-400">{email}</p>
  </div>
  <div className="p-2">
    <button className="flex items-center space-x-2 w-full p-2 text-left text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors duration-200">
      <LogOut size={16} />
      <span className="text-sm">Logout</span>
    </button>
  </div>
</div>
```

### Bottom Navigation (mobile roles)
```tsx
<div className="fixed bottom-0 left-0 right-0 bg-white/10 backdrop-blur-md border-t border-white/20 z-40">
  <div className="flex items-center justify-center gap-6 py-2 px-4 max-w-md mx-auto">
    {tabs.map((tab) => (
      <button
        key={tab.id}
        onClick={() => onTabChange(tab.id)}
        className={`flex flex-col items-center justify-center p-3 rounded-xl transition-all duration-200 min-w-0 flex-1 ${
          activeTab === tab.id
            ? "bg-white/20 text-white"
            : "text-gray-400 hover:text-white hover:bg-white/10"
        }`}
      >
        <div className="relative">
          {tab.icon}
          {tab.badge > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {tab.badge}
            </span>
          )}
        </div>
        <span className="text-xs font-medium mt-1 truncate">{tab.label}</span>
        {activeTab === tab.id && (
          <motion.div
            layoutId="activeTab"
            className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full"
          />
        )}
      </button>
    ))}
  </div>
</div>
```


---

## 15. Component Rules — Badges & Status Chips

### Status Chip (bordered pill)
```tsx
// Available / positive
<span className="px-2 py-1 rounded-full text-xs font-medium border flex items-center gap-1
  bg-indigo-500/20 text-indigo-300 border-indigo-400/40">
  <CheckCircle className="w-4 h-4" />
  Active
</span>

// Unavailable / negative
<span className="px-2 py-1 rounded-full text-xs font-medium border flex items-center gap-1
  bg-red-500/20 text-red-300 border-red-400/40">
  <Clock className="w-4 h-4" />
  Inactive
</span>
```

### Role Badge (solid pill, table)
```tsx
<span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white ${roleBadgeColor}`}>
  {role}
</span>
```

### Table Status Badge (icon + label)
```tsx
// Green variant
<span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium
  bg-green-900/50 text-green-400 border border-green-700">
  <CheckCircle className="w-3 h-3" /> Available
</span>

// Red variant
<span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium
  bg-red-900/50 text-red-400 border border-red-700">
  <XCircle className="w-3 h-3" /> Unavailable
</span>
```

### Notification Count Badge
```tsx
// On bell icon:
<span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold
  rounded-full h-5 w-5 flex items-center justify-center min-w-[20px]">
  {count > 99 ? "99+" : count}
</span>

// On bottom nav tab:
<span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs
  rounded-full w-5 h-5 flex items-center justify-center">
  {badge}
</span>
```

### Unread Indicator Dot
```tsx
<div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2" />
```

### Count Chip (card header)
```tsx
<span className="text-sm font-medium px-2 py-1 rounded-full border flex items-center gap-1
  bg-gray-700/40 text-gray-300 border-gray-600/40">
  {count} items
</span>
```

---

## 16. Dashboard Widget Design

### Page Header
```tsx
<motion.div
  initial={{ opacity: 0, y: -20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.5 }}
  className="mb-8 flex items-center space-x-4"
>
  <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
    <Icon className="text-white h-6 w-6" />
  </div>
  <div>
    <h1 className="text-3xl font-bold text-white">Dashboard Title</h1>
    <p className="text-gray-400 text-sm">Welcome back, {user?.name}</p>
  </div>
</motion.div>
```

### Stats Row
```tsx
<div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
  {stats.map((stat, index) => (
    <motion.div
      key={stat.label}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="bg-gray-800/50 rounded-xl p-6 border border-gray-700
        hover:shadow-[0_0_15px_rgba(59,130,246,0.4)] transition-all"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-400 text-sm font-medium">{stat.label}</p>
          <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
          <p className="text-gray-500 text-sm mt-1">{stat.subtext}</p>
        </div>
        <div className="p-3 rounded-lg bg-gray-700">
          <stat.icon className={`h-6 w-6 ${stat.color}`} />
        </div>
      </div>
    </motion.div>
  ))}
</div>
```

### Analytics Panel
```tsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.5, delay: 0.5 }}
  className="bg-gray-800/50 rounded-xl p-6 border border-gray-700"
>
  <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
    <TrendingUp className="h-5 w-5 mr-2 text-purple-400" />
    Analytics Title
  </h3>
  {loading ? (
    <div className="flex items-center justify-center py-8">
      <div className="w-6 h-6 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
    </div>
  ) : (
    <div className="space-y-4">
      <div className="text-center">
        <div className="text-3xl font-bold text-purple-400">{primaryValue}</div>
        <div className="text-sm text-gray-400">Metric Label</div>
      </div>
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="flex justify-between items-center">
            <span className="text-gray-300 text-sm">{row.label}</span>
            <span className="text-purple-400 font-medium">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  )}
</motion.div>
```

### Distribution / Legend Widget
```tsx
<div className="space-y-4">
  {items.map((item) => (
    <div key={item.label} className="flex items-center justify-between">
      <div className="flex items-center">
        <div className={`w-3 h-3 rounded-full ${item.color} mr-3`} />
        <span className="text-gray-300">{item.label}</span>
      </div>
      <span className="text-white font-semibold">{item.count}</span>
    </div>
  ))}
</div>
```

### Avatar List Row (recent items)
```tsx
<div className="flex items-center justify-between py-2">
  <div className="flex items-center">
    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center mr-3">
      <span className="text-white text-sm font-semibold">
        {name.charAt(0).toUpperCase()}
      </span>
    </div>
    <div>
      <p className="text-white text-sm font-medium">{name}</p>
      <p className="text-gray-400 text-xs">{subtitle}</p>
    </div>
  </div>
  <StatusIcon />
</div>
```


---

## 17. Notification Design

### Architecture Overview

The notification system has three surfaces:
1. **Bell icon** — in the navbar, shows unread count with pulse badge
2. **Slide panel** — right-to-left drawer, shows last 5 notifications
3. **Full-page view** — `/notifications` route, shows all with read/unread toggle

### Notification Bell

```tsx
// components/notifications/NotificationBell.tsx
const NotificationBell = () => {
  const { unreadCount, fetchNotifications, initializeSocket, disconnectSocket } = useNotificationStore();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    fetchNotifications();
    initializeSocket();
    const poll = setInterval(fetchNotifications, 30000); // polling fallback
    return () => { clearInterval(poll); disconnectSocket(); };
  }, []);

  return (
    <>
      <motion.button
        onClick={() => setIsOpen(true)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="relative p-2 text-gray-400 hover:text-white transition-colors duration-200
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
          focus:ring-offset-gray-800 rounded-lg"
      >
        <Bell className="h-6 w-6" />

        {/* Count badge */}
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold
                rounded-full h-5 w-5 flex items-center justify-center min-w-[20px]"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pulse ring */}
        {unreadCount > 0 && (
          <motion.div
            className="absolute -top-1 -right-1 bg-red-500 rounded-full h-5 w-5 pointer-events-none"
            animate={{ scale: [1, 1.2, 1], opacity: [0.7, 0.3, 0.7] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
      </motion.button>

      <NotificationSlidePanel isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
};
```

### Notification Slide Panel

```tsx
// Slide in from right with spring physics
<motion.div
  initial={{ x: "100%" }}
  animate={{ x: 0 }}
  exit={{ x: "100%" }}
  transition={{ type: "spring", damping: 25, stiffness: 200 }}
  className="fixed right-0 top-0 h-screen w-full max-w-md bg-slate-900 shadow-2xl z-50 flex flex-col"
>
  {/* Header */}
  <div className="flex items-center justify-between p-6 border-b border-slate-700">
    <h2 className="text-xl font-semibold text-white">Notifications</h2>
    <button onClick={onClose} className="p-2 text-gray-400 hover:text-white transition-colors">
      <X className="h-6 w-6" />
    </button>
  </div>

  {/* Error banner */}
  {error && (
    <div className="p-4 bg-red-900/20 border-b border-red-500/30">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-red-400" />
        <span className="text-red-300 text-sm">{error}</span>
      </div>
    </div>
  )}

  {/* List */}
  <div className="flex-1 overflow-y-auto min-h-0">
    {loading ? (
      <div className="h-full flex items-center justify-center flex-col">
        <RefreshCw className="h-6 w-6 animate-spin text-blue-400 mb-2" />
        <p className="text-gray-400 text-sm">Loading notifications...</p>
      </div>
    ) : notifications.length === 0 ? (
      <div className="h-full flex items-center justify-center flex-col">
        <Bell className="h-16 w-16 text-gray-600 mb-4" />
        <h3 className="text-xl font-medium text-gray-300 mb-2">No notifications</h3>
        <p className="text-gray-400">You're all caught up!</p>
      </div>
    ) : (
      <div className="p-4 space-y-3 pb-6">
        {notifications.slice(0, 5).map((n, index) => (
          <NotificationItem key={n._id} notification={n} index={index} onRead={markAsRead} />
        ))}
        {notifications.length > 5 && (
          <button
            onClick={onViewAll}
            className="w-full py-2 px-4 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            See More ({notifications.length - 5} more)
          </button>
        )}
      </div>
    )}
  </div>
</motion.div>
```

### Notification Item

```tsx
// Read state:    bg-slate-800/50  border-slate-700  text-gray-300 / text-gray-400
// Unread state:  bg-slate-800     border-slate-600  text-white    / text-gray-300

<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: index * 0.05 }}
  onClick={() => !notification.read && markAsRead(notification._id)}
  className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 ${
    notification.read
      ? "bg-slate-800/50 border-slate-700 hover:bg-slate-800"
      : "bg-slate-800 border-slate-600 hover:bg-slate-700"
  }`}
>
  <div className="flex items-start gap-3">
    {/* Icon */}
    <div className="flex-shrink-0 mt-0.5">
      {getNotificationIcon(notification.title)}   {/* AlertTriangle | CheckCircle | Info */}
    </div>

    {/* Content */}
    <div className="flex-1 min-w-0">
      <h4 className={`font-medium mb-1 ${notification.read ? "text-gray-300" : "text-white"}`}>
        {notification.title}
      </h4>
      <p className={`text-sm mb-2 ${notification.read ? "text-gray-400" : "text-gray-300"}`}>
        {notification.message}
      </p>
      <div className="text-xs text-gray-500">
        {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
      </div>
    </div>

    {/* Unread dot */}
    {!notification.read && (
      <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2" />
    )}
  </div>
</motion.div>
```

### Icon Selection Logic
```tsx
const getNotificationIcon = (title: string) => {
  const t = title.toLowerCase();
  if (t.includes("reminder") || t.includes("overdue"))
    return <AlertTriangle className="h-5 w-5 text-orange-400" />;
  if (t.includes("returned") || t.includes("success"))
    return <CheckCircle className="h-5 w-5 text-green-400" />;
  if (t.includes("alert") || t.includes("unreturned") || t.includes("error"))
    return <AlertTriangle className="h-5 w-5 text-red-400" />;
  return <Info className="h-5 w-5 text-blue-400" />;
};
```

### Full-Page Notifications List

Left border color codes read/unread state:

```tsx
// Unread — blue left border, blue icon
"border-l-4 border-l-blue-500 bg-blue-900/10"

// Read — green left border, green icon
"border-l-4 border-l-green-500 bg-green-900/10"
```

Row structure:
```tsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, x: -100 }}
  transition={{ delay: index * 0.02 }}
  className={`p-4 hover:bg-gray-700/30 transition-colors border-l-4 cursor-pointer ${colorClass}`}
>
  <div className="flex items-start gap-4">
    <div className="flex-shrink-0 mt-1">{icon}</div>
    <div className="flex-1 min-w-0">
      <h3 className={`text-sm font-medium ${notification.read ? "text-gray-300" : "text-white"}`}>
        {notification.title}
      </h3>
      <p className={`text-sm mb-3 ${notification.read ? "text-gray-400" : "text-gray-300"}`}>
        {notification.message}
      </p>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
          </div>
          <span className="capitalize">{notification.type?.replace("_", " ")}</span>
        </div>
        {/* Toggle read/unread icon button */}
        <button className="p-1 text-gray-500 hover:text-gray-300 transition-colors">
          {notification.read ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  </div>
</motion.div>
```

### Real-time Socket Integration Pattern

```tsx
// In notificationStore (Zustand):
initializeSocket: () => {
  socketService.connect();
  socketService.on("notification", (data) => {
    const notification = {
      _id: data.id,
      title: data.title,
      message: data.message,
      createdAt: data.createdAt,
      read: data.isRead || false,
      type: data.type || "general",
      priority: data.priority || "medium",
    };
    get().addNotification(notification);   // prepends to list, increments unreadCount
  });
},
disconnectSocket: () => {
  socketService.off("notification");
},
```

Initialize in every dashboard that should receive real-time notifications:
```tsx
useEffect(() => {
  initializeSocket();
  return () => disconnectSocket();
}, []);
```


---