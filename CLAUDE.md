# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository shape

This repo contains **three separate, only loosely-connected pieces** — do not assume changes in one affect the others:

1. **`app/`** — a minimal FastAPI service using an ONNX model (`model/best.onnx`) for single-image `/predict` inference, backed by SQLAlchemy (SQLite by default) and Prometheus metrics. This is what CI lints/tests and what `dockerfile` builds and deploys to Render.
2. **`backend/`** — a separate, more fully-featured FastAPI service using Ultralytics YOLO (`backend/models/best.pt`) with CUDA/MPS/CPU auto-detection, ByteTrack object tracking, a PPE compliance engine, and WebSocket video/webcam streaming. This is what the frontend actually talks to during local development (`vite.config.ts` proxies `/api` and `/ws` to `localhost:8000`). It has its own `requirements.txt`, its own venv, and is **not** covered by the root CI workflow.
3. **`src/`** — the React/TypeScript frontend (Vite). Most of its "backend" (auth, alerts, workers, zones, reports, cameras, admin) is a **mock in-memory API layer** under `src/api/*.ts` (simulated latency via `delay()`, no real HTTP calls). Only live video/webcam detection (`src/hooks/useDetectionSocket.ts`, `src/state/DetectionStore.tsx`) talks to a real backend, and that's `backend/`, not `app/`.

When asked to "run the backend" or "the API," clarify/confirm which of `app/` or `backend/` is meant — they have different endpoints, different models, and different dependencies (`app/` has no `ultralytics`/`torch`; `backend/` doesn't use ONNX or SQLAlchemy).

## Commands

### Frontend (`src/`, root-level Vite project)

```bash
npm install
npm run dev       # Vite dev server on :5173, proxies /api and /ws to :8000
npm run build      # tsc -b && vite build
npm run lint       # oxlint (config: .oxlintrc.json)
npm run preview
```

There is no frontend test runner configured (no vitest/jest).

### `backend/` (full YOLO pipeline — what the frontend talks to locally)

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000 --reload-exclude 'venv/*' --reload-exclude 'uploads/*'
```

The `--reload-exclude` flags are required, not cosmetic: without them, `--reload` watches every `.py` file under the working directory including `venv/`. Ultralytics/torch touch `.py` mtimes in site-packages on first use of some code paths, triggering a full server restart mid-session that drops every active WebSocket.

`backend/check_backend.py` is a lightweight AST-based sanity check (not pytest) that verifies expected functions exist in `main.py`/`compliance.py` — run with `python check_backend.py` from inside `backend/`.

Runtime behavior (thresholds, queue sizes, frame skip, etc.) is entirely controlled by environment variables read in `backend/config.py`, e.g.:

```bash
export PPE_CONF_THRESHOLD=0.40
export PPE_VIOLATION_WINDOW_SECONDS=2.0
```

### `app/` (ONNX service — what CI and Docker build)

```bash
pip install -r requirements.txt        # root requirements.txt
pytest tests/ -v                        # single test: pytest tests/test_api.py::test_health -v
flake8 app/ --max-line-length=120
uvicorn app.main:app --reload           # or: docker build -t ppe-detection . && docker run -p 8000:8000 ppe-detection
```

`conftest.py` + `pytest.ini` (`pythonpath = .`) exist so `tests/test_api.py` can `import app.main` from the repo root.

### CI (`.github/workflows/ci.yml`)

Only exercises `app/` + `tests/`: installs root `requirements.txt`, runs `flake8 app/`, runs `pytest tests/ -v`, then does a Docker build of the root `dockerfile` and (on `main`) triggers a Render deploy. It does **not** touch `backend/` or the frontend.

## Architecture notes

### `backend/` detection pipeline

- **Frame source abstraction** (`backend/frame_source.py`): the WebSocket handlers depend only on a `FrameSource` protocol (`.frames()` generator). `FileVideoSource` (wrapping `cv2.VideoCapture`) is the only implementation; a future RTSP source would plug into the same handler unchanged.
- **Two streaming endpoints** in `backend/main.py`: `/ws/detect/live` (browser pushes webcam JPEGs, frame-by-frame, server replies with detections only — no jpeg round-trip) and `/ws/detect/{video_id}` (server reads an uploaded video and streams back frames + jpegs). `/ws/detect/live` **must** stay registered before `/ws/detect/{video_id}` since Starlette matches routes in registration order and the parameterized route would otherwise swallow `"live"` as a `video_id`.
- **Per-session model isolation**: every WebSocket session creates its own `YOLO` instance via `_new_model()` rather than sharing a global one, because `model.track(persist=True)` keeps ByteTrack state on the model/predictor object — sharing one model across concurrent sessions would corrupt tracker IDs (and therefore per-worker compliance state) across sessions.
- **Producer→queue→consumer pipeline** for uploaded videos (`_run_detection_session`): `frame_reader` → `infer_q` → `inference_worker` → `send_q` → `ws_sender`, run concurrently via `asyncio.gather`. Both queues drop the *oldest* item on overflow (not the newest) so playback tracks roughly where the video currently is instead of stalling. `_run_inference` is synchronous and offloaded via `asyncio.to_thread` so inference never blocks the event loop.
- **Compliance engine** (`backend/compliance.py`): groups detections by tracker ID (falling back to nearest-person association if tracking is unavailable), then per worker computes a hybrid association score (`ASSOC_W_DIST/IOU/VPOS`, configured in `config.py`) to match body parts (`head`/`hands`/`foot`/`face`) to required PPE, with per-PPE adaptive IoU thresholds. Violations use a duration-weighted sliding time window (`VIOLATION_WINDOW_SECONDS`, `VIOLATION_RAISE_FRACTION`/`VIOLATION_CLEAR_FRACTION`) rather than a frame-count hysteresis, so the raise/clear decision stays anchored to real elapsed time — and tolerant of an occasional missed detection — regardless of frame skip, inference speed, or dropped/bursty frames. Tracker IDs (`_track_id`) are internal-only and stripped before sending detections to the frontend (`_strip_internal`).

### Frontend structure (`src/`)

- **Routing** (`src/router/index.tsx`): `react-router-dom` v7 `createBrowserRouter`, every route lazy-loaded via a `wrap()` helper. Route access is gated two ways: `ProtectedRoute` (must be authenticated, checks token expiry) wraps the whole app shell, and `RoleGuard` (per-route `allowedRoles`) gates individual routes/route groups. Role → default landing page mapping lives in `src/constants/permissions.ts` (`ROLE_LANDING`).
- **Auth** (`src/lib/auth/authStore.ts`): zustand store persisted to storage (`persist` middleware, key `ppe_auth`), with an internal `setInterval` that periodically checks token expiry and redirects to `/login` via a navigate function injected from outside the store (`setNavigate`). `src/api/authApi.ts` is a mock — hardcoded seed users, in-memory mutation, artificial `delay()`.
- **Mock API layer** (`src/api/*.ts`): every domain (admin, alerts, cameras, reports, workers, zones) follows the same pattern as `authApi.ts` — in-memory arrays seeded from `src/data/*`, mutated directly, wrapped in `delay()` to simulate network latency. There is no real HTTP client for these; if asked to "hook up the real API," this whole layer is what would need replacing.
- **Live detection state** (`src/state/DetectionStore.tsx`): a React context (not zustand) holding all concurrently-running detection sessions (uploaded videos or webcam), keyed by session id. Exposes a merged `liveCamera` view (worst-case severity pooled across sessions) for widgets that don't need per-session detail. Mounted once at the app root in `App.tsx`.
- **Canvas rendering** (`src/components/detection/LiveFeedSurface.tsx`): shared bounding-box canvas logic used by both single-camera and multi-session grid views, so it isn't duplicated. Handles devicePixelRatio scaling for HiDPI displays; detection boxes arrive normalized (0..1) and are scaled to container pixels here.
- **WebSocket infra** (`src/lib/websocket/`): `mockWebSocketService.ts` and `useWebSocket.ts`/`wsStore.ts` simulate a generic real-time event stream (used for things like live alerts) separately from the actual detection WebSocket connections that `useDetectionSocket`/`DetectionStore` manage directly.
- **Styling**: Tailwind (`tailwind.config.js`), with custom color tokens like `severity-high`, `status-warn`, `status-ok`, `status-info`, `accent` used throughout for role badges, severity indicators, etc.
