# Zone-Wise PPE Compliance Pipeline — Implementation Handoff

**Audience:** an implementing agent starting with no prior exploration context.
Everything in §1 was verified by inspection — **trust it and do not re-derive it.**
Read §0–§2 fully before writing any code.

---

## Context — why this work exists

The PPE detection dashboard has a strong detection core but is not yet a product:

- It persists to **flat JSON files** (`backend/store.py` rewrites whole arrays under a lock).
- Its entire admin/reports/workers API layer is **mocked in-memory** (`src/api/*.ts` + `delay()`).
- Auth is **client-side only**, with plaintext seed passwords in `src/api/authApi.ts`.
- "Worker identity" is a **per-session ByteTrack integer** that resets on every reconnect —
  `backend/alerts.py` admits this in its own docstring.

So compliance history cannot be attributed to a real person and no report can be trusted.

**Goal:** wire the real pipeline end to end — phone → RTSP → GPU inference → compliance engine →
Postgres → dashboard + alerts — on the schema defined by `innovision-platform`, plus stable person
identity (Re-ID), person-wise compliance reporting, email/in-app alerting, and real RBAC.

---

## §0. Orientation

### Connect to the build host

All work happens on the remote GPU box, **not** on the Mac.

```bash
sshpass -p "$REMOTE_PW" ssh -o ControlPath=/tmp/cm-innovision \
  innovision-limited@10.100.26.185
```

A persistent SSH control socket may already exist at `/tmp/cm-innovision`; if it's gone,
reconnect with `-o ControlMaster=auto -o ControlPath=/tmp/cm-innovision -o ControlPersist=1h`.
Credentials were supplied interactively — **never commit them to the repo.**

### Create the working branch

```bash
cd ~/usecase-3/dashboard
git checkout almost-done && git checkout -b feat/compliance-pipeline
```

### Read these first, on the remote

- `~/usecase-3/dashboard/CLAUDE.md` — **essential.** Explains the three-piece repo shape and
  documents non-obvious constraints. Re-read it before touching `backend/`.
- `~/usecase-3/CLAUDE.md` — the outer ML/training workspace.
- `~/usecase-3/dashboard/reference_platform_0001_platform_base.py` — a copy of the platform's
  `migrations/versions/0001_platform_base.py`, placed here for convenience (original lives on the
  Mac at `~/Downloads/innovision-platform/…`, not needed once this copy exists). The authoritative
  reference schema — read it in full before writing §4.1. Delete this copy once §4.1 is written
  and committed; it is reference material, not part of the app.

---

## §1. Verified ground truth

### 1.1 The build host (`10.100.26.185`)

| Fact | Value |
|---|---|
| GPU | NVIDIA RTX 5080, 16303 MiB, driver 595.84 |
| CPU / RAM | 24 cores / 61 GiB |
| torch | 2.13.0+cu130, `cuda.is_available() == True` |
| torchvision / cv2 / ultralytics | 0.28.0+cu130 / 5.0.0 / 8.4.100 |
| **Python** | **3.14.4 — the ONLY interpreter on the box** (`/usr/bin/python3.14`) |
| Docker | 29.1.3 + Compose 2.40.3, usable **without sudo** |
| Ports free | 5432, 6379, 9000, 8000, 5173, 1025, 8025 |
| Internet | PyPI / GitHub / Docker Hub / HuggingFace all reachable |
| Not installed | `psql`, `redis-cli`, `ffmpeg` binaries (use containers; cv2 has its own ffmpeg) |

Backend venv: `~/usecase-3/dashboard/backend/.venv` (Python 3.14.4, torch+CUDA working).

### 1.2 Repo state

- Authoritative branch: **`almost-done` @ `551f1e4`** — *"Add RTSP camera session support
  (backend + frontend), fix dialog focus bug and event-loop-blocking frame reader"* (Aug 12).
  Newest of all branches, already pushed to origin.
- `origin/main` has 2 commits **not** in `almost-done` (dockerfile/CI). Out of scope — note only.
- The Mac's `~/usecase-3/dashboard` is a **stale Aug-3 copy and not a git repo**. Ignore it
  except as a convenient place to read `innovision-platform` from.
- `~/dashboard-updates.bundle` holds only the older `dashboard-updates` branch (Jul 22), already
  contained in `almost-done`'s history. Ignore.

### 1.3 What ALREADY EXISTS — reuse, do not rebuild

**RTSP ingestion is already implemented.** This is the single most important thing to know.

- `backend/frame_source.py` — `FrameSource` Protocol; `FileVideoSource`; and **`RTSPSource`**,
  which reconnects internally on drop (wifi blip / phone screen lock / app backgrounded) and sets
  `CAP_PROP_BUFFERSIZE=1` so a network stall drops stale frames instead of falling behind.
- `backend/main.py:603` — **`WS /ws/detect/rtsp?url=…&camera_id=…`**, validates `rtsp://` prefix,
  session id `rtsp-<hex8>`. Registered **before** `/ws/detect/{video_id}` (line 635) because
  Starlette matches in registration order — preserve that ordering.
- `backend/config.py:50-57` — `PPE_RTSP_RECONNECT_DELAY_SECONDS` (2.0),
  `PPE_RTSP_MAX_RECONNECT_ATTEMPTS` (0 = retry forever).
- Frontend: `src/features/monitoring/RtspConnectDialog.tsx`, `CameraSlotPicker.tsx`.

**Compliance engine** — `backend/compliance.py` (24KB). Duration-weighted sliding-window
violation raise/clear (`VIOLATION_WINDOW_SECONDS`, `RAISE_FRACTION`/`CLEAR_FRACTION`), hybrid
distance/IoU/vertical-position body-part→PPE association (`ASSOC_W_DIST/IOU/VPOS`), per-PPE
adaptive IoU thresholds, per-zone required-PPE filtering. **Keep the algorithm.** Only change
where its raise/clear events get written.

**Other load-bearing existing behaviour:**
- Per-session YOLO instances via `_new_model()` — required because `model.track(persist=True)`
  keeps ByteTrack state on the predictor; sharing one model corrupts tracker IDs across sessions.
- Producer→queue→consumer pipeline (`frame_reader → infer_q → inference_worker → send_q →
  ws_sender`) with **oldest-drop** backpressure; `_run_inference` offloaded via
  `asyncio.to_thread`.
- `_strip_internal()` removes `_track_id` before sending detections to the frontend.
- Ghost-box rendering continuity for brief detection dropout.
- `backend/models/best.pt` — trained YOLO26m PPE model, 42MB, already in place.

**Existing backend endpoints** (`backend/main.py`): `GET /api/health`, `GET /api/model/info`,
`POST /api/videos/upload`, `DELETE /api/videos/{id}`, CRUD on `/api/zones` and `/api/cameras`,
`GET /api/alerts`, `POST /api/alerts/{id}/acknowledge`, `POST /api/alerts/{id}/resolve`,
`WS /ws/detect/live`, `WS /ws/detect/rtsp`, `WS /ws/detect/{video_id}`.

**Frontend shells to EXTEND, not create:**
- `src/features/reports/` — `ReportsPage.tsx` (tab bar: Daily/Weekly/Monthly/**By Worker**/Ad-Hoc),
  `WorkerComplianceReport.tsx` (already has zone + department `MultiSelect`s, compliance-threshold
  `Input`, date range), `AdHocAnalytics.tsx` (already has PPE-type + severity + date-range +
  groupBy filters — **copy its option lists**), `DailyReport.tsx`, `KpiSummaryPage.tsx`.
- `src/features/workers/` — `WorkerListPage.tsx`, `WorkerProfilePage.tsx`,
  `ComplianceHistoryChart.tsx`, `ZoneEntryExitLog.tsx`.
- `src/components/ui/` — `MultiSelect.tsx`, `Input.tsx`, `PageShell.tsx`, `LoadingSkeleton.tsx`.
- Route guards: `src/router/ProtectedRoute.tsx`, `RoleGuard.tsx`,
  `src/constants/permissions.ts` (`ROUTE_PERMISSIONS`, `ROLE_LANDING`, `canAccess`).
- `xlsx`, `recharts`, `date-fns`, `zustand`, `@tanstack/react-query` are already dependencies.

Existing API signatures to preserve while replacing their mock bodies:
```ts
getWorkers(filters?: { search?, zone?, compliance? }): Promise<Worker[]>
getWorkerById(id): Promise<Worker>
getWorkerZoneLog(...): Promise<WorkerZoneLog[]>
getWorkerComplianceReport(filters?: { zones?, departments?, thresholdBelow?, page?, pageSize? })
    : Promise<{ data: WorkerComplianceRow[]; total: number }>
getAdHocReport(filters: { zones?, dateRange?, ppeTypes?, severity?, groupBy? })
getDailyReport(date) / getWeeklyReport(weekStart) / getMonthlyReport(month) / getKpiSummary()
```

### 1.4 Current JSON persistence (to be replaced)

`backend/store.py` — `load(name, seed)` / `save(name, data)` over `backend/data/{name}.json`,
guarded by a `threading.Lock`, rewritten wholesale on every mutation.

Current record shapes (**camelCase**, JS-style — the frontend depends on these):

```jsonc
// zones.json    (6 seeded: z-assembly, z-welding, z-chemical, z-storage, z-loading, z-maintenance)
{ "id": "z-assembly", "name": "Assembly Line", "description": "...",
  "requiredPpe": ["helmet","vest","gloves","safety_shoes"], "active": true }

// cameras.json  (6 seeded: CAM-01…CAM-06, each pinned to a zoneId; optional rtspUrl)
{ "id": "CAM-01", "name": "Assembly Line — North", "zoneId": "z-assembly" }

// alerts.json   (~4770 lines of REAL history on the remote — must not be lost)
{ "id": "ALT-<hex10>", "createdAt": 1723459200000 /* epoch ms */, "timestamp": "14:03:22",
  "cameraId": "CAM-01", "zoneId": "z-assembly", "zoneName": "Assembly Line",
  "workerId": "W-3", "workerName": "W-3", "missingPpe": ["helmet"],
  "confidence": 0.87, "severity": "high", "status": "open" }
```

PPE vocabulary in use: `helmet`, `vest`, `gloves`, `safety_shoes`, `mask`, `eye_prot`.

`backend/alerts.py` — `record_violation(camera_id, zone_id, zone_name, worker_id, ppe_type,
severity, confidence)`, `list_alerts(severities, zones, statuses, search)`, `get_alert`,
`acknowledge(id, actor)`, `resolve(id, actor, notes)`, and `_worker_label()` which synthesises
`W-<track_id>`. **Called from `backend/main.py:556` and `backend/main.py:787`.**

### 1.5 The reference schema (`innovision-platform`)

Location: `~/Downloads/innovision-platform` **on the Mac**. Postgres 16 + pgvector; schema lives
entirely in `migrations/versions/0001_platform_base.py` as raw Alembic calls — **there is no ORM
model layer**. Its `migrations/env.py` imports `shared.database.base`, which **does not exist** —
so that repo's Alembic cannot run as-is. This is why we do not depend on it at runtime.

- Extensions: `uuid-ossp`, `vector`
- Enums: `camera_status`(online/offline/reconnecting/disabled),
  `alert_severity`(low/medium/high/critical),
  `alert_status`(pending/acknowledged/in_progress/resolved/closed),
  `incident_status`(active/acknowledged/in_progress/resolved/closed),
  `operator_role`(superadmin/admin/operator/viewer), `source_uc`(uc1/uc2/uc3/uc4)
- Tables: `cameras`, `users`, `sessions`, `alerts`, `incidents`, `incident_timeline`,
  `audit_log` (append-only, enforced by Postgres RULEs blocking UPDATE/DELETE), `notification_log`
- **`uc3` in `source_uc` IS this PPE compliance use case.**
- Useful pattern to mirror: `services/alert_management/src/persistence.py` uses **asyncpg + raw
  SQL** (no ORM).

### 1.6 Verified blocker: Re-ID libraries vs Python 3.14

- `boxmot` declares `requires_python <3.14,>=3.10` → **cannot install.**
- `torchreid` 0.2.5 is last classified for Python 3.9 → will not build cleanly.
- Only Python 3.14 exists on the box, and no other interpreter is available.

**Therefore: vendor OSNet's architecture** as a self-contained torch module (pure
torch/torchvision, both working) and load pretrained MSMT17 weights. Confirmed-reachable weight
sources: HuggingFace mirrors `anriha/osnet_x0_25_msmt17`, `paulosantiago/osnet_x0_25_msmt17`,
`kadirnar/osnet_x1_0_imagenet`; and boxmot's GitHub **release assets** (download the `.pt`
without installing the package). No incompatible package gets installed.

---

## §2. Locked decisions — do not revisit

| Decision | Choice | Consequence |
|---|---|---|
| Build host | Remote `10.100.26.185` | GPU inference; Mac is not used |
| Base branch | `almost-done` | RTSP already present |
| Sequencing | **Thin end-to-end slice first** | Phase 1 must be demoable before Phase 2 starts |
| Person identity | **OSNet Re-ID**, not EfficientNet | See §5.1 for the reasoning |
| Chatbot / RAG | **Dropped entirely** | Replaced by structured person lookup (§6) |
| Tenancy | Single tenant | No `organizations`, no `org_id` |
| Roles | 4 tiers: `admin`/`manager`/`operator`/`viewer` | No `superadmin`; 5→4 rework in §7 |
| Schema home | Alembic in `dashboard/backend/` | Platform repo = reference only, never a dependency |
| Alert channels | In-app WebSocket + email SMTP | MailHog in dev; no SMS, no webhooks |

---

## §3. Phase 0 — Infrastructure

Create `backend/docker-compose.yml`:

```yaml
services:
  postgres:
    image: pgvector/pgvector:pg16        # same image the platform standardises on
    environment:
      POSTGRES_DB: ppe_compliance
      POSTGRES_USER: ppe
      POSTGRES_PASSWORD: ppe
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ppe -d ppe_compliance"]
      interval: 5s
      retries: 10
  mailhog:
    image: mailhog/mailhog               # SMTP :1025, web UI :8025
    ports: ["1025:1025", "8025:8025"]
volumes: { pgdata: }
```

**Redis and MinIO are deliberately excluded.** The platform uses them for cross-service Redis
Streams and frame storage; this is one service writing directly to Postgres. Snapshot JPEGs go to
a local `backend/snapshots/` directory referenced by a `frame_reference` string, so swapping in
MinIO later is a provider change, not a schema change.

Add to `backend/requirements.txt`: `asyncpg`, `alembic`, `sqlalchemy` (Alembic needs it even
though we use raw SQL), `argon2-cffi`, `pyjwt`, `aiosmtplib`, `pydantic-settings`.
`psql` is absent — use `docker compose exec postgres psql -U ppe -d ppe_compliance`.

DB URL from env (`backend/config.py`): `PPE_DATABASE_URL`, default
`postgresql://ppe:ppe@localhost:5432/ppe_compliance`.

---

## §4. Phase 1 — End-to-end slice: phone RTSP → Postgres

**Definition of done:** point a phone at the dashboard, see the live feed with boxes, and every
violation lands in Postgres and shows as an alert in the UI. Nothing else changes.

### 4.1 `backend/migrations/versions/0001_platform_base.py`

Copy **verbatim** from the platform repo (all 8 tables, all enums, all indexes, and the
`audit_log` immutability RULEs). Two deliberate deviations, both documented in the docstring:

1. `operator_role` becomes `('admin','manager','operator','viewer')` — no `superadmin`.
2. Drop the seed user with the placeholder hash
   `'$2b$12$placeholder_hash_change_in_production'`; seed real argon2 hashes instead.

Add one column the platform lacks: **`cameras.code VARCHAR(50) UNIQUE NOT NULL`**. The platform's
`cameras.id` is a UUID, but the frontend and all existing data use human ids (`CAM-01`). Keep the
UUID PK for FK integrity and let `code` carry the human id; the API exposes `code` as `id`.

### 4.2 `backend/migrations/versions/0002_uc3_compliance.py`

New enums: `ppe_type` (`helmet`,`vest`,`gloves`,`safety_shoes`,`mask`,`eye_prot`),
`compliance_state` (`compliant`,`violation`,`partial`),
`person_source` (`enrolled`,`auto_discovered`).

| Table | Columns (essentials) |
|---|---|
| `zones` | `id` VARCHAR(64) PK (keeps `z-assembly`), `name`, `description`, `required_ppe ppe_type[] NOT NULL DEFAULT '{}'`, `active bool DEFAULT true`, `created_at`, `updated_at` |
| `persons` | `id` UUID PK, `label` VARCHAR(64) UNIQUE NOT NULL (`W-0001`), `employee_id` VARCHAR(64) UNIQUE NULL, `name` NULL, `department` NULL, `source person_source NOT NULL DEFAULT 'auto_discovered'`, `first_seen_at`, `last_seen_at`, `active bool DEFAULT true` |
| `person_embeddings` | `id` UUID PK, `person_id` FK→persons CASCADE, `embedding vector(512) NOT NULL`, `quality real NOT NULL`, `camera_id` FK→cameras SET NULL, `track_segment_id` FK→track_segments SET NULL, `captured_at` TIMESTAMPTZ |
| `detection_sessions` | `id` UUID PK, `camera_id` FK→cameras SET NULL, `source_kind` VARCHAR(16) (`rtsp`/`upload`/`webcam`), `source_url` VARCHAR(1024) NULL, `started_at`, `ended_at` NULL, `frames_processed` INT DEFAULT 0 |
| `track_segments` | `id` UUID PK, `session_id` FK→detection_sessions CASCADE, `track_id` INT NOT NULL, `person_id` FK→persons SET NULL (set on Re-ID resolve), `first_frame_at`, `last_frame_at`, `frame_count` INT DEFAULT 0. UNIQUE `(session_id, track_id)` |
| `compliance_events` | `id` UUID PK, `person_id` FK→persons SET NULL, `track_segment_id` FK→track_segments SET NULL, `camera_id` FK→cameras SET NULL, `zone_id` FK→zones SET NULL, `ppe_type ppe_type NOT NULL`, `state compliance_state NOT NULL`, `confidence real`, `started_at` NOT NULL, `ended_at` NULL, `duration_seconds` real NULL, `alert_id` FK→alerts SET NULL, `frame_reference` VARCHAR(512) NULL |
| `person_daily_compliance` | PK `(person_id, day, zone_id)`, `violation_count` INT, `compliant_seconds` real, `violation_seconds` real, `compliance_rate` real. Rollup refreshed when an event closes |
| `compliance_reports` | `id` UUID PK, `kind` VARCHAR(32), `params JSONB`, `generated_by` FK→users SET NULL, `file_reference` VARCHAR(512), `created_at` |

Extra column on `users` (needed for operator zone-scoping — see §7):
`zone_ids VARCHAR(64)[] NOT NULL DEFAULT '{}'`.

Indexes, driven by the §6 report queries:
```
compliance_events (person_id, started_at DESC)
compliance_events (zone_id,   started_at DESC)
compliance_events (ppe_type,  started_at DESC)
compliance_events (state,     started_at DESC)
track_segments (person_id)
person_embeddings USING hnsw (embedding vector_cosine_ops)
```
**HNSW over IVFFlat**: IVFFlat needs training data to build useful lists, and this gallery starts
empty and grows continuously. HNSW needs no training step and gives better recall/latency here.

**`alerts` is used UNMODIFIED.** For UC3: `source_uc='uc3'`, `alert_type='ppe_violation'`,
`source_event_id` = the `compliance_events.id`, and `metadata` JSONB carries the PPE specifics:
```json
{ "person_label": "W-0007", "zone_id": "z-welding", "missing_ppe": ["helmet"],
  "track_id": 3, "confidence": 0.87 }
```
This matches how the platform's own uc3 stub shapes its payloads. Do not add columns to `alerts`.

### 4.3 Persistence layer — replacing `store.py`

Use **asyncpg + raw SQL**, mirroring the platform's `persistence.py`, so both codebases stay
idiomatically consistent and no ORM mapping layer has to be maintained.

```
backend/db.py                      # asyncpg.create_pool(), opened in FastAPI lifespan
backend/repositories/
    zones.py  cameras.py  alerts.py  persons.py  compliance.py  users.py
```

Keep existing function names (`list_zones`, `get_camera`, `record_violation`, …) so call sites
barely change. Each repository owns a `row_to_api()` translating **snake_case DB → camelCase API**
(`zone_id`→`zoneId`, `missing_ppe`→`missingPpe`, `created_at`→`createdAt` as **epoch ms**).
`src/types/index.ts` must not change.

#### The sharp edge — DB writes from the inference thread

`record_violation()` is called **synchronously from inside the inference worker thread**
(`main.py:556`, `main.py:787`, reached via `asyncio.to_thread`). Opening a DB connection there
would block inference and touch the pool from the wrong event loop.

Solution — a bounded queue drained by exactly one writer task:

```python
# backend/repositories/writer.py
_queue: asyncio.Queue | None = None
_loop:  asyncio.AbstractEventLoop | None = None

def submit(event: dict) -> None:
    """Called from the INFERENCE THREAD. Must never block."""
    if _loop is None or _queue is None:
        return
    def _put() -> None:
        if _queue.full():
            _queue.get_nowait()          # drop OLDEST, matching the frame-queue policy
            log.warning("compliance write queue full — dropped oldest event")
        _queue.put_nowait(event)
    _loop.call_soon_threadsafe(_put)

async def writer_task(pool) -> None:
    """Single consumer. Batches writes; a DB stall grows the queue, never stalls inference."""
    while True:
        event = await _queue.get()
        try:
            async with pool.acquire() as conn:
                await _persist(conn, event)   # compliance_events + alerts + notify
        except Exception:
            log.exception("compliance write failed")
```

Start `writer_task` in the FastAPI `lifespan`, recording `_loop = asyncio.get_running_loop()`.
Inference stays non-blocking; a DB stall degrades to dropped events with a warning rather than
dropping frames.

### 4.4 Data migration — `backend/scripts/import_json_stores.py`

One-shot, **idempotent**, keyed on existing string ids. Imports
`backend/data/{zones,cameras,alerts}.json` into the new tables. Keep the JSON files as backup;
do not delete them.

Field mapping for `alerts.json` → `alerts` (+ a synthetic `compliance_events` row per alert):

| JSON | Column | Note |
|---|---|---|
| `id` (`ALT-…`) | `metadata->>'legacy_id'` | `alerts.id`/`alert_id` are UUIDs; mint new ones |
| `createdAt` (epoch ms) | `created_at` | `to_timestamp(ms/1000.0)` |
| `cameraId` (`CAM-01`) | `camera_id` | resolve via `cameras.code` |
| `zoneId`, `missingPpe`, `workerId`, `confidence` | `metadata` JSONB | plus `zone_id` on the event row |
| `severity` | `severity` | already matches `alert_severity` |
| **`status: "open"`** | **`status: 'pending'`** | **enum mismatch — must translate** |
| `acknowledgedBy`/`resolvedBy` (names) | `metadata` | they are strings, not user UUIDs |

Legacy `workerId` values are `W-<track_id>` from sessions that no longer exist — import them as
**inactive `persons` rows with `source='auto_discovered'`** so history stays attributable, and
never merge them into Re-ID-resolved identities.

### 4.5 Wire up the RTSP path

The endpoint exists; what's new is persistence and status feedback.

- On session start, insert a `detection_sessions` row; on end, set `ended_at`/`frames_processed`.
- Drive **`cameras.status`** from `RTSPSource`'s existing reconnect loop:
  `online` on first successful frame, `reconnecting` while retrying, `offline` on session end.
  The `camera_status` enum already exists but **nothing currently writes it** — which is why
  `cameras.enrich()` in `backend/cameras.py` hardcodes `status: "offline"`. Remove those
  hardcoded placeholders as real values become available.
- Save a snapshot JPEG per raised violation to `backend/snapshots/<date>/<event_id>.jpg` and store
  the path in `compliance_events.frame_reference` (+ `alerts.frame_reference`, with
  `frame_provider` left NULL until MinIO exists).

### 4.6 Phase 1 verification

```bash
cd ~/usecase-3/dashboard/backend
docker compose up -d
alembic upgrade head
docker compose exec postgres psql -U ppe -d ppe_compliance -c '\dt'      # ~16 tables
docker compose exec postgres psql -U ppe -d ppe_compliance -c 'SELECT extname FROM pg_extension;'
alembic downgrade base && alembic upgrade head                            # reversible
python scripts/import_json_stores.py                                      # history imported
```

Run backend and frontend (the `--reload-exclude` flags are **load-bearing**, see `CLAUDE.md`:
without them Ultralytics/torch touch `.py` mtimes in site-packages and trigger a restart that
drops every live WebSocket):

```bash
cd backend && .venv/bin/uvicorn main:app --reload --port 8000 \
  --reload-exclude '.venv/*' --reload-exclude 'uploads/*' --reload-exclude 'snapshots/*'
cd .. && npm run dev
```

Phone RTSP server on the same 10.100.26.x network (Android **IP Webcam** →
`rtsp://<phone-ip>:8080/h264_ulaw.sdp`, or Larix Broadcaster). Register a camera with that URL,
connect via the existing `RtspConnectDialog`, then confirm:

1. Live frames with bounding boxes render in the browser.
2. `SELECT count(*) FROM compliance_events;` rises while a violation persists.
3. A matching `alerts` row exists with `source_uc='uc3'` and populated `metadata`.
4. The alert appears in the UI alerts list (served from Postgres, not JSON).
5. **Background the phone app** → `cameras.status` becomes `reconnecting`, then recovers. This is
   the failure path that matters most for a phone camera.
6. `backend/data/*.json` are no longer being written.

---

## §5. Phase 2 — Stable person identity (Re-ID)

### 5.1 Why OSNet and not EfficientNet

The original request asked whether EfficientNet can hold person identity. It can be *made* to,
but off the shelf it is the wrong tool, and this determines whether reports are trustworthy:

- EfficientNet ships **ImageNet classification** weights. Its features answer "what kind of object
  is this", and are trained to be *invariant* to exactly what Re-ID depends on — clothing colour,
  texture, body proportion. Two different workers in matching hi-vis PPE land close together,
  which is the dominant failure mode on a PPE site.
- Re-ID models train with **metric learning** (triplet/ArcFace) on identity-labelled data
  (Market-1501, MSMT17) so same-person crops pull together and different-person crops push apart.
  A different objective, not just a different backbone.
- Benchmark gap: ImageNet-feature baselines ≈ 40–55% Rank-1; metric-learned OSNet ≈ 85–95%.
  At 50%, every second identity assignment is wrong and per-person compliance becomes noise.
- OSNet is also **smaller** (~2.2M params vs EfficientNet-B0's ~5.3M) and purpose-built with
  omni-scale feature fusion for person crops.

EfficientNet-B0 with an ArcFace head fine-tuned on MSMT17 would be competitive — but costs a
training run to reach where OSNet is already pretrained. Not worth it here.

### 5.2 Implementation

```
backend/reid/osnet.py       # vendored architecture, pure torch/torchvision
backend/reid/embedder.py    # crop → 512-d L2-normalised embedding, batched, on GPU
backend/reid/resolver.py    # embedding → stable person_id
backend/reid/weights/       # downloaded .pt (gitignore it — do not commit 
```

Do **not** `pip install torchreid` or `boxmot` (§1.6). Fetch MSMT17 weights from a HuggingFace
mirror or a boxmot GitHub release asset, and record the exact source URL + SHA in a comment.

### 5.3 Identity resolution flow

1. ByteTrack yields a `track_id` per session → create/lookup a `track_segments` row.
2. **Embed selectively, not every frame.** Only when the crop is large enough, detection
   confidence is high, and the box is not clipped by the frame edge; at most every Nth frame per
   track. Embedding cost scales with people×fps, and low-quality crops are the main cause of
   identity drift.
3. Aggregate per track: running mean of L2-normalised embeddings weighted by crop quality. Decide
   identity once the track has enough good samples, then cache it for the segment.
4. Match against the gallery:
   ```sql
   SELECT person_id, 1 - (embedding <=> $1::vector) AS similarity
   FROM person_embeddings
   ORDER BY embedding <=> $1::vector
   LIMIT 5;
   ```
   Above threshold → assign that `person_id`, write the embedding into the gallery (cap per
   person, evict lowest quality). Below → create a new `auto_discovered` person with the next
   `W-nnnn` label.
   **Start near cosine 0.75 and calibrate against real footage** — log near-miss similarities so
   the final threshold is evidence-based, not a guess.
5. **Cold start:** an empty gallery means every track creates a person. Expected, not a bug.
6. **Anti-fragmentation:** require N consistent samples before minting a new identity, and treat
   the tracker's own continuity as the strong prior *within* a session. Re-ID only stitches
   *across* gaps and sessions — it must never override a live tracker association.

Re-ID runs in the same worker thread as inference, after detection, on the GPU — off the event
loop. Per-session model isolation (§1.3) still applies.

Then: `alerts.py::_worker_label()` stops synthesising `W-<track_id>` and reads the resolved person;
`persons` rows back the existing `features/workers/` pages, making Worker profiles real.

### 5.4 Phase 2 verification

With two people in frame: one person leaving and re-entering keeps **one** `person_id`; two
different people get **two**. Inspect `track_segments.person_id` assignments, log the similarity
distribution to calibrate. Confirm inference FPS has not regressed materially
(`GET /api/model/info` + `nvidia-smi`).

---

## §6. Phase 3 — Person-wise compliance reporting (replaces the chatbot)

Extend the existing **"By Worker"** tab; do not add a new page.

### 6.1 Backend endpoints

- `GET /api/persons?search=` — typeahead for the person picker.
- `GET /api/persons/{id}/compliance?from&to&zone_ids&ppe_types&severity` — violation history,
  per-zone breakdown, per-PPE breakdown, compliance-rate trend.
- `GET /api/reports/workers?…` — the paginated table `getWorkerComplianceReport` already expects.

All plain indexed SQL over `compliance_events` (+ `person_daily_compliance` for trend series).
Exact numbers, not retrieved approximations — precisely why dropping RAG is right for this.

```sql
-- Per-zone breakdown: "where is this person non-compliant?"
SELECT z.id AS zone_id, z.name AS zone_name,
       count(*) FILTER (WHERE ce.state = 'violation')          AS violations,
       coalesce(sum(ce.duration_seconds) FILTER (WHERE ce.state='violation'), 0) AS violation_seconds
FROM compliance_events ce
JOIN zones z ON z.id = ce.zone_id
WHERE ce.person_id = $1
  AND ce.started_at >= $2 AND ce.started_at < $3
  AND ($4::text[]     IS NULL OR ce.zone_id  = ANY($4))
  AND ($5::ppe_type[] IS NULL OR ce.ppe_type = ANY($5))
GROUP BY z.id, z.name
ORDER BY violations DESC;
-- uses compliance_events (person_id, started_at DESC)

-- Per-PPE breakdown: "what do they keep missing?"
SELECT ce.ppe_type, count(*) AS violations, max(ce.started_at) AS last_seen
FROM compliance_events ce
WHERE ce.person_id = $1 AND ce.state = 'violation'
  AND ce.started_at >= $2 AND ce.started_at < $3
GROUP BY ce.ppe_type ORDER BY violations DESC;

-- Compliance rate over time (trend series)
SELECT day, sum(violation_count) AS violations,
       CASE WHEN sum(compliant_seconds + violation_seconds) = 0 THEN NULL
            ELSE sum(compliant_seconds) / sum(compliant_seconds + violation_seconds) * 100
       END AS compliance_rate
FROM person_daily_compliance
WHERE person_id = $1 AND day BETWEEN $2 AND $3
GROUP BY day ORDER BY day;
```

`EXPLAIN ANALYZE` each of these and confirm index usage, not sequential scans.

### 6.2 Frontend

In `WorkerComplianceReport.tsx`, above the existing table, add:

- a **person search/select** subfield (typeahead against `/api/persons`);
- **PPE-type** and **severity** `MultiSelect`s — reuse the option lists already in
  `AdHocAnalytics.tsx` — alongside the existing zone/department/threshold/date-range filters;
- when a person is selected, a detail panel showing: violations timeline, **per-zone breakdown**
  ("where"), **per-PPE breakdown** ("what"), compliance-rate trend (`recharts`, as
  `ComplianceHistoryChart.tsx` already does), and CSV/XLSX export (`xlsx` already a dependency).

Replace the mock bodies of `src/api/reportsApi.ts` and `workersApi.ts` with real `fetch` calls,
**keeping the exported signatures and return types identical** so no component needs rewriting.

---

## §7. Phase 4 — Alert delivery + real auth/RBAC

### 7.1 Notification delivery

`backend/notifications/` with a channel abstraction; **every attempt** recorded in
`notification_log` (`channel`, `status`, `error`, `sent_at`).

- **In-app:** `WS /ws/alerts` broadcast so alerts arrive live. This also lets
  `src/lib/alerts/alertStore.ts` stop polling `GET /api/alerts` every 5s.
- **Email:** `aiosmtplib` against MailHog in dev (inspect at `http://10.100.26.185:8025`);
  host/port/credentials from env so production is config-only. Severity-based routing plus a
  **per-(person, ppe_type) cooldown** so a flapping violation cannot mail-bomb a supervisor.
- **Move escalation server-side.** `alertStore.ts` currently escalates on a client-side
  `setInterval`, so escalation only happens while a browser tab is open. Replace with a backend
  background task using the existing per-zone delays from `src/data/alertConfig.ts`.

### 7.2 Auth

`backend/auth/`:

- **argon2** password hashing (`argon2-cffi`). **Delete the plaintext seed users** in
  `src/api/authApi.ts` (`admin/admin123`, `officer/officer123`, `supervisor/super123`,
  `ehs/ehs123`, `manager/mgmt123`).
- `POST /api/auth/login` → short-lived JWT access token + refresh token whose **hash** goes in the
  existing `sessions` table (`refresh_token_hash`, `expires_at`, `revoked_at` — the platform
  schema already anticipates exactly this pattern). Plus `/refresh`, `/logout`, `/me`.
- FastAPI dependency `require_role(*roles)` enforced on **every mutating route**. The frontend
  guard is UX, not security — an operator hitting an admin endpoint directly must get a 403 from
  the backend.
- **Zone scoping for `operator`:** the platform's `users.camera_ids` UUID array scopes cameras,
  but the frontend scopes by *zone* (`assignedZones` in `MonitoringPage.tsx`). Use the
  `users.zone_ids` column added in §4.2 and derive camera visibility from it, so one mechanism
  drives both instead of two competing ones.
- Write `audit_log` rows for logins, config changes, and alert acknowledge/resolve. The table and
  its immutability RULEs already exist, and `features/admin/AuditLogPage.tsx` is waiting for data.

### 7.3 Role rework (5 → 4)

`src/constants/roles.ts` becomes `admin`/`manager`/`operator`/`viewer` (with `ROLE_LABELS` and
`ROLE_BADGE_COLOR` updated). `src/constants/permissions.ts` maps them onto the existing route
groups, which already split along these lines:

| Route group | admin | manager | operator | viewer |
|---|---|---|---|---|
| Monitoring · Analytics · Alerts · Workers | ✓ | read | ✓ | read |
| Reports · Reports-Analytics · KPI | ✓ | ✓ | — | read |
| Admin (users · zones · cameras · alert-config · audit) | ✓ | — | — | — |

`ROLE_LANDING`: `admin`→`/admin/users`, `manager`→`/reports`, `operator`→`/monitoring`,
`viewer`→`/monitoring`.

Old→new mapping: `admin`→`admin`; `ehs_manager`,`plant_mgmt`→`manager`;
`safety_officer`,`site_supervisor`→`operator`. The 4 role dashboards in
`src/features/dashboards/` (EhsManager/PlantManagement/SafetyOfficer/SiteSupervisor) collapse to
manager/operator views — **keep the components**, just remap which role renders which.

### 7.4 Phase 4 verification

Log in as each of the 4 roles; confirm allowed/forbidden routes. Confirm a **backend 403** (not
merely a hidden nav item) for an operator calling an admin endpoint. Confirm a violation email
lands in MailHog at `:8025` and a `notification_log` row records it. Confirm login and
acknowledge write `audit_log` rows, and that `UPDATE`/`DELETE` on `audit_log` are silently
refused by the RULEs.

---

## §8. Repo-wide checks

```bash
python backend/check_backend.py   # AST sanity check: expected fns still exist in main/compliance
npm run lint                      # oxlint
npm run build                     # tsc -b && vite build
```

There is **no pytest suite for `backend/`** and no frontend test runner. CI
(`.github/workflows/ci.yml`) exercises only the unrelated `app/` ONNX service — **a green
pipeline says nothing about this work.** Verification is the manual end-to-end runs above.

---

## §9. Gotchas — read before debugging

1. **`--reload-exclude` is mandatory** on uvicorn (`.venv/*`, `uploads/*`, `snapshots/*`).
   Without it, torch/Ultralytics touching site-packages mtimes restarts the server and drops
   every live WebSocket mid-session.
2. **Never open a DB connection from the inference thread.** Use the §4.3 queue. This is the most
   likely source of a subtle event-loop stall or pool misuse.
3. **Route registration order:** `/ws/detect/live` and `/ws/detect/rtsp` must stay registered
   **before** `/ws/detect/{video_id}`, or Starlette's in-order matching swallows `"live"`/`"rtsp"`
   as a `video_id`.
4. **Do not share one YOLO model across sessions.** `model.track(persist=True)` keeps ByteTrack
   state on the predictor; sharing corrupts tracker IDs and therefore per-person compliance.
5. **`alerts.status` enum mismatch:** JSON history uses `"open"`, the platform enum uses
   `pending`. Translate in the import script and at the API edge.
6. **`cameras.id` becomes a UUID** with the human id moving to `code`. This touches every place
   `CAM-01` is assumed — seeds, camera pickers, alert payloads.
7. **Python 3.14 blocks `boxmot` and `torchreid`** (verified). Vendor OSNet instead. If the weight
   mirrors turn out unusable, fall back to training an ArcFace head — *not* to raw ImageNet
   features, which would defeat the purpose (§5.1).
8. **The Re-ID threshold is data-dependent.** Workers in identical PPE are the hard case.
   Calibrate on real footage; don't ship the first value that seems to work.
9. **Phone RTSP is flaky by nature** (screen lock, wifi roaming, backgrounding). The reconnect
   loop already exists; the `cameras.status` write path and UI feedback are what's new.
10. **VRAM contention:** YOLO26m + OSNet + several concurrent sessions on 16GB. Measure with
    multiple streams before claiming capacity.
11. **Only `backend/` is in scope.** `app/` (ONNX + SQLAlchemy/SQLite) is a separate service —
    don't "fix" it or merge the two.
12. **`innovision-platform` is reference only.** Its Alembic `env.py` imports a non-existent
    `shared.database.base`; never make it a runtime dependency.

---

## §10. Task checklist

**Phase 0 — Infra**
- [ ] Branch `feat/compliance-pipeline` off `almost-done`
- [ ] `backend/docker-compose.yml` (pgvector/pg16 + mailhog); `docker compose up -d`
- [ ] Extend `backend/requirements.txt`; add `PPE_DATABASE_URL` to `config.py`

**Phase 1 — End-to-end slice**
- [ ] `0001_platform_base.py` (verbatim + 4-role enum + `cameras.code`)
- [ ] `0002_uc3_compliance.py` (8 new tables, 3 enums, `users.zone_ids`, HNSW index)
- [ ] `db.py` pool + lifespan; `repositories/*`; `row_to_api()` camelCase translation
- [ ] `repositories/writer.py` threadsafe queue + writer task
- [ ] Port `alerts.py`/`cameras.py`/`zones.py` off `store.py`
- [ ] `scripts/import_json_stores.py` (idempotent; `open`→`pending`)
- [ ] `detection_sessions` rows; drive `cameras.status`; snapshot JPEGs
- [ ] **Verify with a real phone stream (§4.6), including the reconnect path**

**Phase 2 — Re-ID**
- [ ] Vendor `reid/osnet.py`; fetch MSMT17 weights (record URL + SHA; gitignore weights)
- [ ] `reid/embedder.py` (selective, quality-gated, batched)
- [ ] `reid/resolver.py` (pgvector match, gallery growth, anti-fragmentation)
- [ ] Wire `track_segments.person_id`; replace `_worker_label()`
- [ ] Calibrate threshold on real footage; confirm no material FPS regression

**Phase 3 — Reports**
- [ ] `/api/persons`, `/api/persons/{id}/compliance`, `/api/reports/workers`
- [ ] Person search + PPE/severity filters + detail panel in `WorkerComplianceReport.tsx`
- [ ] De-mock `reportsApi.ts` / `workersApi.ts` (signatures unchanged)
- [ ] `EXPLAIN ANALYZE` the report queries

**Phase 4 — Alerts + auth**
- [ ] `notifications/` channels + `notification_log`; `WS /ws/alerts`; retire the 5s poll
- [ ] SMTP via MailHog; severity routing + cooldown; server-side escalation
- [ ] `auth/` argon2 + JWT + `sessions`; `require_role`; delete plaintext seed users
- [ ] Roles 5→4 across `roles.ts`/`permissions.ts`/dashboards; `audit_log` writes
- [ ] Verify all 4 roles, backend 403s, MailHog delivery, audit immutability
