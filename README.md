# SafeGuard AI — Live Detection Console

A focused live-footage and detection-pipeline console for the Zone-Wise PPE
Detection system. Built with React, TypeScript, Tailwind CSS, and Vite.

## Design direction: Midnight Slate

Deep navy-black base with a muted cyan accent, IBM Plex Sans/Mono typography,
and hairline borders instead of shadows or gradients. Mock data only — no
backend wired up yet.

## Screens

- **Camera view** — single-feed focus with live detection overlays and a
  per-camera event sidebar
- **Detection feed** — timestamped, filterable log of detection events
- **System health** — pipeline status, resource usage, and processing stats

## Running locally

```bash
npm install
npm run dev
```

Then open the printed local URL (usually http://localhost:5173).

## Build for production

```bash
npm run build
npm run preview
```

## Structure

```
src/
  components/
    Sidebar.tsx        Navigation
    CameraView.tsx      Single camera focus screen
    DetectionFeed.tsx   Detection event log
    SystemHealth.tsx    Pipeline + resource monitoring
  data/
    mockData.ts         Mock cameras, events, and system stats
  App.tsx
  main.tsx
  index.css             Global styles + Tailwind directives
tailwind.config.js      Midnight Slate color tokens
```

Swap the contents of `src/data/mockData.ts` for live API calls once the
backend is ready — component props and shapes are already typed to match.
