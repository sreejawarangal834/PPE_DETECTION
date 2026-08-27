# UC3 Schema Deep-Dive — Corrections & Refinements to IMPLEMENTATION_PLAN.md

**Status: this document SUPERSEDES parts of IMPLEMENTATION_PLAN.md.** It was produced by a
second, deeper design pass over the same codebase, after the plan was already being executed.
Where it conflicts with the plan, **this document wins** — especially §0 (a factual correction)
and the schema in §1, which is materially more complete than the plan's §4.2.

If you are past Phase 1 already, read §0 immediately and check whether your `ComplianceWriter`
matches reality. If you haven't started Phase 1 yet, read this whole document before writing the
persistence layer.

---

## §0. CRITICAL CORRECTION to the plan's threading model

The plan's §4.3 states: *"`record_violation()` is called synchronously from inside the inference
worker thread (`main.py:556`, `main.py:787`, reached via `asyncio.to_thread`)."*

**This is verified WRONG on the Mac snapshot** (and must be re-verified against the actual remote
`main.py`, since the remote is ahead with RTSP changes the Mac copy lacks — read the real file
before trusting either version).

The truth on the Mac snapshot: only `_run_inference` is offloaded via `asyncio.to_thread`.
`evaluate_compliance()` and the `alerts.record_violation()` call both run **on the event loop**
— inside the `inference_worker` coroutine (compliance/alert-writing loop) and inside the
`/ws/detect/live` receive loop. So the actual problem is not a cross-thread call — it's that
`record_violation` does a **blocking whole-file JSON rewrite directly on the event loop**, which
already stalls every other concurrent session's WebSocket sends today, even before any DB is
involved.

**Action required:** before finalizing `writer.py`, `grep -n "asyncio.to_thread\|record_violation\|evaluate_compliance"` in the REMOTE `backend/main.py` and confirm which coroutine/thread actually calls into compliance evaluation and the violation writer. Design `ComplianceWriter.submit()` to be non-blocking and safe to call from **wherever it's actually invoked** — if it turns out to be the event loop (as verified above), `submit()` must still never block (no `await`, no lock contention), same requirement, different reason. Keep both entry points available: a plain `submit()` for event-loop callers and `submit_threadsafe()` (using `loop.call_soon_threadsafe`) for if/when compliance evaluation is later moved into a thread — cheap to support both, and it removes this ambiguity as a future landmine.

---

## §1. Schema refinements over the plan's §4.2

The plan's schema is a reasonable first cut. This section's version is more complete — same
overall shape (same 8ish new tables), but with real gap fixes. **Use this version.**

### 1.1 Additional/refined enums
- `person_status` (`active`, `inactive`, `merged`) — needed for the merge workflow (§1.6).
- `embedding_source` (`enrollment`, `track_aggregate`, `track_probe`, `manual`) — distinguishes
  a person's onboarding photos from auto-sampled track crops; matters for eviction policy (§1.5).
- `session_kind` (`upload`, `webcam`, `rtsp`) — the plan's `detection_sessions.source_kind` was a
  free VARCHAR; make it this enum instead.
- `report_status`: use **VARCHAR + CHECK constraint**, not a Postgres ENUM — job-lifecycle states
  (`pending/running/ready/failed/expired`) churn during implementation, and a CHECK is one
  `ALTER TABLE` away from editable vs. `ALTER TYPE ... ADD VALUE` friction.

### 1.2 `zones` — use `slug` not `id` as the human key
Give `zones.id` a real `uuid_generate_v4()` PK (for FK consistency with everything else) and add
`zones.slug VARCHAR(64) UNIQUE NOT NULL` carrying the existing `z-assembly` string. Same pattern
already agreed for `cameras.code` in the plan — apply it symmetrically to zones too, the plan's
§4.2 only did it for cameras. Add `zones.layout JSONB` for the frontend's `svgCoordinates`
(`{x,y,w,h}`) if `PlantLayoutWidget`-style rendering is in scope.

### 1.3 `persons` — add a fast-path centroid column
Add `persons.centroid_embedding vector(512)` and `persons.embedding_count INT` directly on the
person row, maintained as a running quality-weighted mean (see §1.7). This lets identity
resolution try **one row** (`persons.centroid_embedding`, HNSW-indexed) before falling through to
the full `person_embeddings` gallery scan — at a few hundred persons this is the difference
between a sub-millisecond first check and always scanning the full gallery table.

Also add `persons.merged_into_id UUID REFERENCES persons(id) ON DELETE SET NULL` — required for
the merge/de-fragmentation workflow (§1.6), which must exist from day one, not as a follow-up.

### 1.4 `track_segments` — add `loop_index`, fixes a real bug
**This matters and is easy to miss.** `PPE_LOOP_VIDEO` defaults to `True`, and looping an
uploaded video resets ByteTrack's tracker state, so `track_id` values (1, 2, 3…) **recur** on
every loop iteration. If `track_segments` has `UNIQUE (session_id, track_id)` as the plan
specifies, **the second loop of any demo video throws a unique-violation** on the first track
insert. Fix: add `track_segments.loop_index INTEGER NOT NULL DEFAULT 0` (incremented by the app
on each detected loop restart) and change the unique constraint to
`UNIQUE (session_id, loop_index, track_id)`. Verify this is exercised by testing with a short
looping video, not just a single-pass phone stream.

### 1.5 `person_embeddings` — add quality/eviction columns
Add `quality FLOAT` (a composite score: detection confidence × box-size factor × sharpness,
normalized 0–1, see §1.7), `is_centroid BOOLEAN DEFAULT false` (marks the per-track aggregate
representative vs. a raw probe), and index `(person_id, quality)` for eviction ordering. Cap
gallery size per person (recommend 20) and evict the lowest `quality × novelty` entry on overflow
— never evict `source = 'enrollment'` rows. Add `sharpness FLOAT` (Laplacian variance) as a
capture-quality gate input.

### 1.6 New table: `person_merge_log` — build the merge workflow from day one
```sql
CREATE TABLE person_merge_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_person_id UUID NOT NULL,         -- no FK: the source row is gone after merge
  target_person_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  performed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  embeddings_moved INTEGER NOT NULL DEFAULT 0,
  events_moved INTEGER NOT NULL DEFAULT 0,
  reason TEXT,
  snapshot JSONB NOT NULL DEFAULT '{}',   -- enough to undo
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```
**Why this can't be a "later" feature:** an empty Re-ID gallery means every early distinct-looking
track becomes a new person — person counts *will* overcount on day one, by design (see §1.7 cold
start). The only remedy is an admin merge action, and it needs to exist before real users start
looking at inflated person counts, not after.

### 1.7 Re-ID identity-resolution algorithm — concrete refinements over the plan's §5.3

The plan's flow (embed selectively, aggregate per track, match via pgvector, threshold-gate) is
correct in outline. Tighten it with these specifics:

**Extraction gate** — require ALL of: track survived ≥5 frames (filters ByteTrack one-frame
ghosts), detection confidence ≥0.60, box height ≥15% of frame height (below ~100px OSNet's
256×128 input is upsampling noise), aspect ratio in [1.5, 4.0] (a full standing person, not a
clipped torso), not touching the frame edge (reuse the existing in-frame check from
`compliance.py` if one exists — check for an `_is_in_frame`-style helper before writing a new
one), and a sharpness threshold (rejects motion blur). Rate-limit to ~1 embedding/track/second,
capped at ~8 samples per track.

**Aggregation**: L2-normalize every embedding at extraction (so cosine similarity = dot product
and the mean stays geometrically meaningful). Keep a per-track running quality-weighted sum in
memory. **Resolve identity at 3 good samples; re-verify at 8** — resolving on a single sample is
how fragmentation starts. Persist only the track's aggregated centroid (`is_centroid=true`) plus
at most the 1-2 highest-quality raw probes — writing all 8 raw vectors bloats the gallery with
near-duplicates and actively *hurts* nearest-neighbor recall.

**Matching query** — over-fetch then filter, don't filter inside the ANN scan:
```sql
-- session-level tuning: SET LOCAL hnsw.ef_search = 40;  (raise toward 100 for higher recall)
WITH knn AS (
    SELECT pe.person_id, 1 - (pe.embedding <=> $1::vector) AS similarity
    FROM person_embeddings pe
    ORDER BY pe.embedding <=> $1::vector
    LIMIT 20                              -- over-fetch; a WHERE on persons.status
),                                        -- can't be pushed into the HNSW scan itself
ranked AS (
    SELECT k.person_id, k.similarity,
           row_number() OVER (PARTITION BY k.person_id ORDER BY k.similarity DESC) AS rn
    FROM knn k JOIN persons p ON p.id = k.person_id
    WHERE p.status = 'active'
)
SELECT person_id,
       avg(similarity) FILTER (WHERE rn <= 3) AS score,  -- mean of top-3, not max-1:
       count(*) AS hits                                   -- far more robust to one lucky
FROM ranked GROUP BY person_id ORDER BY score DESC LIMIT 5; -- near-duplicate
```

**Thresholds** (OSNet cosine similarity, calibrate on real footage, put all in config as env vars):
- `score ≥ 0.75` AND `margin ≥ 0.08` over the next-best *different* person → **match**
- `score < 0.60` OR empty gallery → **create new person**
- `0.60–0.75`, or margin fails → **ambiguous**: keep sampling up to the cap, then leave
  `person_id NULL` and surface in an admin review queue rather than guessing
- **Spatial exclusivity**: if the best-match person is already bound to a different track that's
  currently alive in the same session, skip to the next candidate or create new — one human
  cannot be two simultaneous boxes on one camera. This is the single highest-value
  anti-mis-merge rule available.

**Cold start**: empty gallery → every qualifying track becomes person #1, #2, etc. Expected, not
a bug — this is why §1.6's merge workflow must exist immediately.

**TOCTOU race — needs an explicit fix**: two concurrent sessions can both miss the gallery for
the same real person and both try to create a new person row. Wrap match-then-create in
`SELECT pg_advisory_xact_lock(hashtext('reid_person_create'))` inside the transaction. Creation
is rare enough that this costs nothing, and skipping it means silent gallery fragmentation under
concurrency — precisely when it's hardest to notice.

**Drift prevention**: never write to the gallery on an ambiguous or below-threshold match (this
is the actual drift mechanism — one wrong match pulls the centroid toward the wrong person,
making the next wrong match easier). Never let auto-discovered Re-ID matches overwrite an
`identity_source='enrolled'` person — require a stricter threshold (~0.82) for those. Log every
match/create/ambiguous decision with the top-5 candidate scores (to an audit table or structured
log) — without this, threshold tuning later is pure guesswork.

**Honest risk to flag in your final report, not silently patch over**: OSNet is trained on
street-pedestrian re-id and this domain is industrial PPE — identical uniforms, helmets occluding
heads, high-vis vests flattening color cues, likely a single fixed camera. Cosine separation
between different workers in matching PPE may be poor. If your calibration testing shows bad
separation, **say so explicitly** rather than shipping a threshold that "sort of works" — this
was flagged as the single biggest product risk in the deeper design review, and enrolled-photo
identity (onboarding front/side/back crops) is the fallback path to recommend if auto-discovery
proves too unreliable in practice.

### 1.8 Index list (add to the plan's list)
```
person_embeddings USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)
persons           USING hnsw (centroid_embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)
person_embeddings (person_id, quality)             -- eviction ordering
track_segments    (person_id)
zones             (slug)
cameras           (code)
```
**Guard the pgvector version before creating HNSW indexes** — HNSW requires pgvector ≥ 0.5.0.
Check `SELECT extversion FROM pg_extension WHERE extname='vector'` and fail the migration loudly
if it's older, rather than getting a cryptic `op class "vector_cosine_ops" does not exist` error.

---

## §2. Auth refinements over the plan's §7.2

- **Use argon2id, not bcrypt.** `argon2-cffi`, `PasswordHasher(time_cost=3, memory_cost=65536,
  parallelism=4)`. Reasoning: bcrypt silently truncates input at 72 bytes (a real footgun), and
  the common Python bcrypt-wrapping libraries have had maintenance/compatibility issues with
  newer bcrypt versions. Argon2's encoded hash format fits comfortably in the existing
  `password_hash VARCHAR(255)` column. **Important cost tradeoff**: argon2 verification takes
  ~50-100ms of CPU — run every `hash()`/`verify()` call via `asyncio.to_thread` or a login request
  will stall the event loop and every other connected WebSocket session with it.
- **The seed password hash in the platform's `0001` migration is not a valid hash of anything**
  (it's literally the string `'$2b$12$placeholder_hash_change_in_production'`) — `verify()` will
  raise an exception on it, not return False. Overwrite it with a real argon2 hash of an
  `ADMIN_BOOTSTRAP_PASSWORD` env var in your seed migration/script, and fail startup if that env
  var is unset rather than shipping a broken or guessable default.
- **Refresh token rotation with reuse detection** — beyond just storing a hash in `sessions`:
  rotate the refresh token on every use (new row, mark the old `revoked_at` + `replaced_by_id`
  pointing at the new one), and if an already-revoked token hash is ever presented again, treat
  it as theft — revoke the user's entire session chain immediately and log it. This needs one
  extra nullable `sessions.replaced_by_id UUID` self-referencing column beyond what the platform
  schema has.
- **Zone-scoping for `operator`: don't repurpose `users.camera_ids`.** The platform's
  `users.camera_ids UUID[]` scopes by camera, but the frontend's actual domain concept is
  zone-scoping (`assignedZones`). Reusing/repurposing the array column conflates two different
  scoping mechanisms and an array column can't be FK-checked (a deleted zone leaves a dangling
  id silently). Add a proper junction table instead:
  ```sql
  CREATE TABLE user_zones (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    zone_id UUID NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, zone_id)
  );
  CREATE INDEX idx_user_zones_zone ON user_zones (zone_id);
  ```
  This also answers "which users are scoped to this zone" (needed for notification fan-out)
  cheaply, which an array column cannot without an unnest scan. Leave `users.camera_ids` at its
  default empty array and don't build logic on it.
- **Push zone-scoping into SQL, never filter in Python after the query runs** — post-filtering in
  application code breaks pagination totals and can leak row-count information about zones a user
  shouldn't know exist. Every list/report query should take an optional zone-id list parameter
  and append the filter in SQL.
- **Permissions are not a clean hierarchy across the 4 roles** — `manager` gets reports/KPI access
  that `operator` doesn't, while `operator` gets alert acknowledge/resolve that `manager` doesn't.
  A simple rank comparison (`role >= required_role`) is the wrong model. Use an explicit
  capability-set map per role instead (mirror whatever `src/constants/permissions.ts` already
  defines — that file is the de facto spec for who can do what).
- **The frontend's route guards enforce nothing server-side.** Every mutating endpoint AND the
  WebSocket handshake (`/ws/detect/*`) must independently re-check permissions before accepting
  the connection — don't rely on the frontend having hidden a button.
- **Audit logging must move server-side entirely.** If the current codebase has any client-side
  audit-log writing (check `src/lib/audit/` if it exists), that's not usable for real compliance
  audit trails — a client can fabricate or skip it. All audit writes must originate in backend
  endpoint handlers, never be trusted from the client.

---

## §3. Report-query refinement: build WHERE clauses dynamically

The plan's §6.1 SQL examples use the pattern:
```sql
AND ($4::text[] IS NULL OR ce.zone_id = ANY($4))
```
**This is fine functionally but is a real performance trap**: it makes the predicate
non-sargable, so Postgres builds one generic query plan that must work for every possible
combination of NULL/non-NULL filters, rather than a plan tailored to the filters actually
supplied. At small data volumes you won't notice; at real production volumes you will get one
mediocre plan instead of several excellent ones.

**Fix**: build the WHERE clause dynamically in the repository/query-building code, appending each
filter predicate only when that filter is actually supplied by the caller, rather than encoding
"is this filter active" as a runtime SQL condition. This is exactly the kind of thing that's
awkward with an ORM and easy with hand-written SQL assembly — one more point in favor of the
plan's asyncpg-raw-SQL choice, not a reason to abandon it.

Also: for the compliance-rate-over-time trend query, use a **date spine via `generate_series`**
left-joined to the daily rollup table, so days with zero observation show up as an explicit `NULL`
compliance rate (a gap in the chart) rather than being silently missing from the result set or
(worse) computed as 100% due to `0/0` mishandling.

---

## §4. Data-migration refinement: the honest identity decision for legacy workers

The plan's §4.4 correctly identifies that legacy `workerId` values like `"W-19"` are
per-session ByteTrack labels with no cross-session meaning (the existing `alerts.py` code
comment says as much). **Do not create a distinct `persons` row per distinct legacy label** —
that fabricates identities that never existed and permanently pollutes every person-wise report
with fake people.

**Correct approach**: create exactly **one sentinel person** (e.g. `code='W-LEGACY'`,
`display_name='Unattributed (pre-Re-ID)'`, `identity_source='legacy_import'`,
`status='inactive'`), attach ALL imported historical events to that one sentinel, and preserve
each event's original label in a JSONB evidence/metadata field
(e.g. `evidence->>'legacy_worker_id'`) so the raw history isn't destroyed, just not
misrepresented as distinct tracked individuals. Filter `status != 'active'` persons out of the
Reports person-search picker so the sentinel doesn't show up as a selectable "person" while its
event history still counts toward site-wide/zone-wide totals.

Exception: if there's known seed/demo data elsewhere in the frontend with specific named workers
matching some of these legacy labels (check `src/data/` for anything like a workers/employees
seed file), those specific labels can reasonably get real `persons` rows using that seed data,
since that's deliberately-authored demo data rather than fabricated history.

---

## §5. Miscellaneous sharp edges worth knowing about

1. **Timezone handling**: pin the DB connection pool's session timezone to UTC explicitly
   (`server_settings={"TimeZone": "UTC"}` in asyncpg, or equivalent), and compute any "day" or
   "shift" bucketing values in application code at write time using an explicit configured site
   timezone — never do `timestamp_column::date` in a report query and assume it means what you
   think, because that cast uses whatever timezone the *querying* session happens to have, which
   can silently differ between the app's connection pool, a `psql` session, and Alembic's
   connection.
2. **CHECK constraints on time ordering** — add `CHECK (ended_at IS NULL OR ended_at >= started_at)`
   to any interval-shaped table (compliance events, presence records, track segments). Mixing a
   monotonic clock (if the compliance engine uses `time.monotonic()` internally for duration
   math) with wall-clock timestamps (needed for storage) is an easy way to accidentally produce
   negative durations that silently corrupt every average — a CHECK constraint turns that into a
   loud, immediate error instead of a quietly wrong KPI months later.
3. **Don't persist high-churn camera telemetry to Postgres.** If there's existing in-process logic
   serving live values like current latency, current worker count, "last seen" timestamp, etc.
   directly from application/session state (check for something like a `cameras.enrich()` or
   similar function before building anything new) — keep that pattern for anything that updates
   every frame. Only persist genuinely durable state (like online/offline/reconnecting status)
   to the database, and even that should be throttled (e.g. once per 10 seconds) rather than
   written on every status check, or you'll generate thousands of UPDATEs/second against a
   tiny table.
4. **Case-sensitive email uniqueness is a real bug waiting to happen** — if the platform's base
   `users.email UNIQUE` constraint is case-sensitive (verify), add a functional unique index on
   `lower(email)` as well, and make sure both the signup/seed path and the login lookup path
   lowercase consistently — otherwise `Admin@x.com` and `admin@x.com` can both exist as separate
   accounts, and/or login can fail to find an account that clearly "exists."

---

## What to do with this document

1. Read §0 first and verify the actual threading model against the real remote `main.py` before
   finalizing anything about the write-queue design.
2. If you've already written `0002_uc3_compliance.py`, diff it against §1's refinements
   (especially §1.4's `loop_index` fix — that one will cause a real, reproducible bug with looped
   video sources if missed) and amend before moving past Phase 1.
3. Incorporate §2 into Phase 4's auth work when you get there.
4. Incorporate §3's dynamic-WHERE-clause guidance into Phase 3's report queries.
5. Incorporate §4 into the JSON→Postgres import script regardless of what phase you're in.
6. Keep the rest of the original IMPLEMENTATION_PLAN.md as-is — this document only refines,
   it doesn't replace the overall plan structure, phase sequencing, or locked decisions.
