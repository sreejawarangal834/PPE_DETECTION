"""
Single-writer queue that decouples compliance/status persistence from
wherever it's triggered from.

IMPLEMENTATION_PLAN.md §4.3 describes this as guarding against a call from
"the inference worker thread". That's not quite what the current remote
`main.py` does: `evaluate_compliance()` and the violation-recording call both
run as plain coroutine code **on the event loop** — inside `inference_worker`
(main.py's per-frame loop for uploaded video / RTSP) and inside
`detect_live_ws`'s receive loop. Only `_run_inference` itself (the actual
model.track()/predict() call) is offloaded via `asyncio.to_thread`. So the
real hazard here is different from what the plan describes, though the fix
is the same shape: `record_violation`'s old implementation did a **blocking
whole-file JSON rewrite directly on the event loop** (`store.save()`), which
already stalls every other concurrent session's WebSocket sends today. An
`await pool.acquire()`-per-violation call inline would trade that blocking
file I/O for blocking (or at least latency-adding) network I/O, still on the
hot per-frame path shared by every concurrent session on one event loop.

The fix is the same either way: never do the write inline. Queue it; drain it
from exactly one consumer task.

Two submission entry points are provided since call sites differ in which
thread they actually run on:

- `submit()` — for callers already running on the event loop (this is what
  main.py's inference_worker / detect_live_ws use). Manipulates the queue
  directly; asyncio.Queue is not thread-safe in general, but this is safe
  because the caller IS the event loop thread, so there's no cross-thread
  hazard to guard against here.
- `submit_threadsafe()` — for callers on a genuinely different OS thread, e.g.
  RTSPSource's reconnect-status callback, which fires from inside the
  `asyncio.to_thread(next, it, ...)` worker thread that drives frame_reader.
  Uses `loop.call_soon_threadsafe` to hand off safely.

Both are non-blocking and never raise on a full queue — they drop the OLDEST
queued event, matching the frame-queue backpressure policy elsewhere in this
codebase (main.py's infer_q/send_q), so a DB stall degrades to dropped
compliance events with a logged warning rather than ever stalling inference
or frame delivery.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any
from uuid import UUID

import asyncpg
import numpy as np

from config import DB_WRITE_QUEUE_SIZE
from notifications import notifier
from reid import resolver as reid_resolver
from repositories.cameras import get_camera_id, set_status as _set_camera_status
from repositories.persons import get_or_create_by_track_label
from repositories.zones import get_zone_id

log = logging.getLogger("ppe_backend.writer")

_queue: asyncio.Queue[dict[str, Any]] | None = None
_loop: asyncio.AbstractEventLoop | None = None


def init(loop: asyncio.AbstractEventLoop) -> None:
    global _queue, _loop
    _loop = loop
    _queue = asyncio.Queue(maxsize=DB_WRITE_QUEUE_SIZE)


def _put(event: dict[str, Any]) -> None:
    assert _queue is not None
    if _queue.full():
        try:
            _queue.get_nowait()
            log.warning("compliance write queue full — dropped oldest event")
        except asyncio.QueueEmpty:
            pass
    _queue.put_nowait(event)


def submit(event: dict[str, Any]) -> None:
    """Call from a coroutine already running on the event loop. Must never block."""
    if _queue is None:
        return
    _put(event)


def submit_threadsafe(event: dict[str, Any]) -> None:
    """Call from any OTHER thread (e.g. a callback fired inside asyncio.to_thread). Must never block."""
    if _loop is None or _queue is None:
        return
    _loop.call_soon_threadsafe(_put, event)


async def writer_task(pool: asyncpg.Pool) -> None:
    """Single consumer. A DB stall grows the queue (until it's full and starts
    dropping oldest-first), never stalls inference or frame delivery."""
    assert _queue is not None
    log.info("Compliance writer task started (queue size=%d)", _queue.maxsize)
    while True:
        event = await _queue.get()
        try:
            kind = event.get("kind")
            async with pool.acquire() as conn:
                if kind == "violation":
                    await _persist_violation(conn, event)
                elif kind == "camera_status":
                    await _set_camera_status(event["camera_code"], event["status"])
                elif kind == "reid_resolve":
                    await _persist_reid_resolve(conn, event)
                else:
                    log.warning("Unknown write-queue event kind: %r", kind)
        except Exception:
            log.exception("Compliance write failed for event kind=%s", event.get("kind"))


async def _persist_violation(conn: asyncpg.Connection, event: dict[str, Any]) -> None:
    """One newly-RAISED violation (a False->True transition in compliance.py's
    hysteresis, i.e. exactly one alert-worthy occurrence) -> one
    compliance_events row + one alerts row, transactionally.

    Person resolution: a track_segments row may already carry a Re-ID-resolved
    person_id (Phase 2 — see reid/resolver.py, which upgrades this via a
    separate "reid_resolve" event as soon as enough good crops accumulate).
    The upsert below preserves that with COALESCE(existing, placeholder) and
    RETURNS the actually-stored value, so a violation recorded before Re-ID
    resolves still gets attributed to the right person once it does, and one
    already resolved never gets silently overwritten by a fresh placeholder."""
    async with conn.transaction():
        camera_id = await get_camera_id(event.get("camera_code"), executor=conn)
        zone_id = await get_zone_id(event.get("zone_slug"), executor=conn)
        placeholder_person_id = await get_or_create_by_track_label(conn, event.get("track_id"))

        track_segment_id = None
        person_id = placeholder_person_id
        session_id: UUID | None = event.get("session_id")
        track_id = event.get("track_id")
        if session_id is not None and track_id is not None:
            ts_row = await conn.fetchrow(
                """
                INSERT INTO track_segments
                    (session_id, track_id, loop_index, person_id, first_frame_at, last_frame_at, frame_count)
                VALUES ($1, $2, $3, $4, now(), now(), 1)
                ON CONFLICT (session_id, loop_index, track_id) DO UPDATE
                    SET last_frame_at = now(),
                        frame_count = track_segments.frame_count + 1,
                        person_id = COALESCE(track_segments.person_id, EXCLUDED.person_id)
                RETURNING id, person_id
                """,
                session_id, track_id, event.get("loop_index", 0), placeholder_person_id,
            )
            track_segment_id = ts_row["id"]
            person_id = ts_row["person_id"] or placeholder_person_id

        severity = event.get("severity")
        alert_severity = severity if severity in ("low", "medium", "high", "critical") else "medium"
        confidence = event.get("confidence")

        event_id = await conn.fetchval(
            """
            INSERT INTO compliance_events
                (person_id, track_segment_id, camera_id, zone_id, ppe_type, state, confidence, started_at)
            VALUES ($1, $2, $3, $4, $5::ppe_type, 'violation', $6, now())
            RETURNING id
            """,
            person_id, track_segment_id, camera_id, zone_id, event["ppe_type"], confidence,
        )

        label = await conn.fetchval("SELECT label FROM persons WHERE id = $1", person_id) or "W-unknown"
        zone_name = event.get("zone_name") or "an unassigned zone"
        metadata = {
            "person_label": label,
            "zone_id": event.get("zone_slug"),
            "missing_ppe": [event["ppe_type"]],
            "track_id": track_id,
            "confidence": confidence,
        }

        alert_uuid = await conn.fetchval(
            """
            INSERT INTO alerts
                (alert_id, camera_id, source_uc, alert_type, severity, title, description,
                 source_event_id, status, metadata)
            VALUES (uuid_generate_v4(), $1, 'uc3', 'ppe_violation', $2, $3, $4, $5, 'pending', $6::jsonb)
            RETURNING id
            """,
            camera_id, alert_severity,
            f"PPE violation: missing {event['ppe_type']}",
            f"{label} missing {event['ppe_type']} in {zone_name}",
            event_id, metadata,
        )

        await conn.execute("UPDATE compliance_events SET alert_id = $1 WHERE id = $2", alert_uuid, event_id)

        # Phase 4: fire in-app WS + (severity/cooldown-gated) email, every attempt logged to
        # notification_log regardless of outcome. Never allowed to raise into this transaction
        # — see notifier.notify_violation's own docstring.
        await notifier.notify_violation(
            conn, alert_uuid, label, zone_name, event["ppe_type"], alert_severity,
            event.get("camera_code"), f"{label} missing {event['ppe_type']} in {zone_name}",
        )


async def _persist_reid_resolve(conn: asyncpg.Connection, event: dict[str, Any]) -> None:
    """Phase 2 (Re-ID): match/create a person for a track's aggregated embedding centroid
    and upgrade that track_segment's person_id from the Phase-1 placeholder to the resolved
    identity. See reid/resolver.py for the matching policy and why no advisory lock is needed
    here despite the TOCTOU concern SCHEMA_DEEP_DIVE.md §1.7 raises for a naive version of
    this (this IS the single serial writer that concern is about).

    Also backfills any compliance_events already recorded against this track_segment under
    the Phase-1 placeholder person before resolution completed (found via testing — resolution
    takes 3+ good samples, typically a couple of seconds, and any violation raised in that
    window would otherwise stay permanently attributed to a throwaway `W-<track_id>` person
    even after the real identity resolves, splitting one person's history across two rows).
    The placeholder person row itself is left in place (unreferenced, harmless) rather than
    deleted — deleting it would need the full merge/audit workflow (person_merge_log), which
    is a bigger piece of work than this one-track backfill warrants."""
    session_id: UUID = event["session_id"]
    track_id: int = event["track_id"]
    loop_index: int = event.get("loop_index", 0)
    centroid = np.asarray(event["embedding"], dtype=np.float32)

    camera_id = await get_camera_id(event.get("camera_code"), executor=conn)
    track_segment_id = await conn.fetchval(
        "SELECT id FROM track_segments WHERE session_id = $1 AND loop_index = $2 AND track_id = $3",
        session_id, loop_index, track_id,
    )
    async with conn.transaction():
        person_id = await reid_resolver.resolve_or_create(
            conn, str(session_id), track_id, centroid, event["quality"], camera_id, track_segment_id,
        )
        if person_id is None:
            return  # ambiguous — deliberately left unresolved, nothing to persist
        if track_segment_id is not None:
            await conn.execute("UPDATE track_segments SET person_id = $1 WHERE id = $2", person_id, track_segment_id)
            await conn.execute(
                "UPDATE compliance_events SET person_id = $1 WHERE track_segment_id = $2 AND person_id != $1",
                person_id, track_segment_id,
            )
        reid_resolver.mark_resolved((str(session_id), loop_index, track_id), str(person_id))
