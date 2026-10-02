"""
Violation snapshot capture — a real JPEG crop around the violating person, written to
backend/snapshots/<date>/<event_id>.jpg (IMPLEMENTATION_PLAN.md §4.5's original convention).

Split in two, for the same non-blocking reason as everywhere else in this pipeline
(repositories/writer.py's own docstring, reid/embedder.py's crop-then-embed split):

- `crop_for_violation()` is a cheap, synchronous numpy slice — no encode, no I/O. Safe to call
  inline in the inference path (main.py), same cost class as the Re-ID crop already taken
  there for every quality-gated detection.
- `encode_and_save()` does the actual JPEG encode + disk write. That's CPU/IO-bound enough
  that it must never run inline on repositories/writer.py's single writer_task coroutine —
  that coroutine is the ONE consumer for every concurrent session's compliance writes, so
  blocking it on an encode+fwrite would stall every other pending write behind it, not just
  this one. Always call it via asyncio.to_thread.

Retention: every violation that gets a snapshot writes one more JPEG — crops (not full
frames) keep individual files small (~5-30KB typically at quality=85), but disk/bucket usage
is still unbounded without an expiry policy. Handled two ways, matching where each backend's
lifecycle management actually belongs:
  - MinIO: a server-side bucket lifecycle rule (`_apply_lifecycle_policy`, set once when the
    bucket is created/confirmed) expires objects under MINIO_OBJECT_PREFIX after
    config.SNAPSHOT_RETENTION_DAYS — MinIO/S3 enforce this natively, no application code needs
    to run for it to happen.
  - Local disk: no such native mechanism, so `cleanup_task()` (mirroring escalation.py's
    background-task shape) periodically deletes day-directories older than the same retention
    window. Started in main.py's lifespan.
"""

from __future__ import annotations

import asyncio
import io
import logging
import shutil
from datetime import datetime, timedelta, timezone
from pathlib import Path

import cv2
import numpy as np
from minio import Minio
from minio.commonconfig import ENABLED, Filter
from minio.error import S3Error
from minio.lifecycleconfig import Expiration, LifecycleConfig, Rule

from config import (
    MINIO_ACCESS_KEY, MINIO_BUCKET, MINIO_ENABLED, MINIO_ENDPOINT, MINIO_SECRET_KEY, MINIO_SECURE,
    SNAPSHOT_CLEANUP_INTERVAL_SECONDS, SNAPSHOT_RETENTION_DAYS,
)

log = logging.getLogger("ppe_backend.snapshots")

SNAPSHOT_DIR = Path(__file__).parent / "snapshots"

# Extra margin around the person's box so PPE right at the edge of the detection (a helmet
# brim, a glove at the frame boundary) isn't clipped out of the evidence crop.
CROP_PADDING_FRACTION = 0.15
JPEG_QUALITY = 85

# Object key convention (Platform Integration Strategy doc §8.3 — "platform
# storage contracts and object key conventions"): uc3/snapshots/<date>/<event_id>.jpg,
# mirroring SNAPSHOT_DIR's local-disk layout so relative_reference/resolve_reference
# need only a storage-backend prefix change, not a redesign.
MINIO_OBJECT_PREFIX = "uc3/alerts"

_minio_client: Minio | None = None


def _apply_lifecycle_policy(client: Minio) -> None:
    """Server-side expiration for everything under MINIO_OBJECT_PREFIX — set once
    (idempotent: re-applying the same rule on every startup updates or adds only UC3's
    rule without overwriting other services' lifecycle rules)."""
    try:
        existing_rules: list[Rule] = []
        try:
            cfg = client.get_bucket_lifecycle(MINIO_BUCKET)
            if cfg and hasattr(cfg, "rules") and cfg.rules:
                existing_rules = list(cfg.rules)
        except S3Error as err:
            if getattr(err, "code", None) not in ("NoSuchLifecycleConfiguration", "NoSuchLifecycle"):
                log.warning("Could not read existing MinIO lifecycle config (%s) — proceeding to set UC3 rule", err)
        except Exception as exc:
            log.warning("Could not read existing MinIO lifecycle config (%s) — proceeding to set UC3 rule", exc)

        our_rule_id = "uc3-snapshot-retention"
        our_rule = Rule(
            ENABLED,
            rule_filter=Filter(prefix=f"{MINIO_OBJECT_PREFIX}/"),
            rule_id=our_rule_id,
            expiration=Expiration(days=SNAPSHOT_RETENTION_DAYS),
        )

        merged_rules = [
            r for r in existing_rules
            if getattr(r, "rule_id", getattr(r, "id", None)) != our_rule_id
        ]
        merged_rules.append(our_rule)

        client.set_bucket_lifecycle(MINIO_BUCKET, LifecycleConfig(merged_rules))
        log.info("MinIO lifecycle policy applied: expire %s/* after %d day(s)",
                 MINIO_OBJECT_PREFIX, SNAPSHOT_RETENTION_DAYS)
    except S3Error:
        log.exception("Failed to apply MinIO bucket lifecycle policy (uploads still work, just won't auto-expire)")


def _get_minio_client() -> Minio:
    global _minio_client
    if _minio_client is None:
        client = Minio(
            MINIO_ENDPOINT, access_key=MINIO_ACCESS_KEY, secret_key=MINIO_SECRET_KEY, secure=MINIO_SECURE,
        )
        _apply_lifecycle_policy(client)
        _minio_client = client
    return _minio_client


def minio_object_key(alert_id: str, when: datetime | None = None) -> str:
    day = (when or datetime.now(timezone.utc)).strftime("%Y-%m-%d")
    return f"uc3/alerts/{day}/{alert_id}.jpg"



def crop_for_violation(frame: np.ndarray, box_norm: tuple[float, float, float, float] | None) -> np.ndarray:
    """box_norm is the violating person's [x1,y1,x2,y2] in 0..1 (as produced by
    _run_inference), or None to fall back to the full frame — the person detection matching
    this violation's track_id isn't always findable in the exact frame that raised it (the
    compliance engine's hysteresis means the raise decision can lag the most recent frame by
    design), so a full-frame fallback beats dropping the snapshot entirely."""
    if box_norm is None:
        return frame.copy()
    h, w = frame.shape[:2]
    x1, y1, x2, y2 = box_norm
    bw, bh = (x2 - x1) * w, (y2 - y1) * h
    px, py = bw * CROP_PADDING_FRACTION, bh * CROP_PADDING_FRACTION
    cx1 = max(int(x1 * w - px), 0)
    cy1 = max(int(y1 * h - py), 0)
    cx2 = min(int(x2 * w + px), w)
    cy2 = min(int(y2 * h + py), h)
    if cx2 <= cx1 or cy2 <= cy1:
        return frame.copy()
    return frame[cy1:cy2, cx1:cx2].copy()


def snapshot_path(event_id: str, when: datetime | None = None) -> Path:
    day = (when or datetime.now(timezone.utc)).strftime("%Y-%m-%d")
    return SNAPSHOT_DIR / day / f"{event_id}.jpg"


def relative_reference(path: Path) -> str:
    """What gets stored in compliance_events.frame_reference / alerts.frame_reference —
    relative to SNAPSHOT_DIR so the storage root can move without invalidating every row."""
    return str(path.relative_to(SNAPSHOT_DIR))


def resolve_reference(frame_reference: str) -> Path:
    return SNAPSHOT_DIR / frame_reference


def encode_and_save(crop_bgr: np.ndarray, path: Path, quality: int = JPEG_QUALITY) -> bool:
    """Synchronous — call via asyncio.to_thread, never inline on the writer task. Returns
    True on success; logs and returns False on any failure (a snapshot write failing must
    never take down the compliance_events/alerts write that triggered it)."""
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        ok, buf = cv2.imencode(".jpg", crop_bgr, [cv2.IMWRITE_JPEG_QUALITY, quality])
        if not ok:
            log.warning("cv2.imencode failed for snapshot %s", path)
            return False
        path.write_bytes(buf.tobytes())
        return True
    except Exception:
        log.exception("Failed to write snapshot %s", path)
        return False


def upload_to_minio(crop_bgr: np.ndarray, object_key: str, quality: int = JPEG_QUALITY) -> bool:
    """MinIO equivalent of encode_and_save — same "synchronous, call via
    asyncio.to_thread, never raise into the caller" contract. Only called when
    config.MINIO_ENABLED is True (see repositories/writer.py); encode_and_save's
    local-disk path stays the unconditional fallback so a MinIO outage or an
    unconfigured dev environment never breaks snapshot capture, just moves it
    back to local disk exactly as it worked before MinIO existed."""
    try:
        ok, buf = cv2.imencode(".jpg", crop_bgr, [cv2.IMWRITE_JPEG_QUALITY, quality])
        if not ok:
            log.warning("cv2.imencode failed for MinIO snapshot %s", object_key)
            return False
        data = buf.tobytes()
        client = _get_minio_client()
        client.put_object(
            MINIO_BUCKET, object_key, io.BytesIO(data), length=len(data), content_type="image/jpeg",
        )
        return True
    except S3Error:
        log.exception("MinIO upload failed for %s", object_key)
        return False
    except Exception:
        log.exception("Unexpected error uploading snapshot to MinIO: %s", object_key)
        return False


def _delete_expired_local_snapshots(retention_days: int) -> int:
    """Synchronous directory walk — call via asyncio.to_thread (see cleanup_task).
    SNAPSHOT_DIR's layout is flat day-directories (YYYY-MM-DD/*.jpg, see
    snapshot_path()), so this only needs to parse directory NAMES, never touch
    file mtimes. Returns the number of day-directories removed."""
    if not SNAPSHOT_DIR.is_dir():
        return 0
    cutoff = (datetime.now(timezone.utc) - timedelta(days=retention_days)).strftime("%Y-%m-%d")
    removed = 0
    for day_dir in SNAPSHOT_DIR.iterdir():
        if not day_dir.is_dir():
            continue
        # Directory names are strictly YYYY-MM-DD (snapshot_path()'s own format),
        # so lexical comparison is equivalent to date comparison — skip anything
        # that doesn't match rather than guessing at an unexpected entry.
        if len(day_dir.name) == 10 and day_dir.name < cutoff:
            try:
                shutil.rmtree(day_dir)
                removed += 1
            except Exception:
                log.exception("Failed to remove expired snapshot directory %s", day_dir)
    return removed


async def cleanup_task() -> None:
    """Periodic local-disk snapshot retention (see module docstring — MinIO's
    side of this is a server-side bucket lifecycle rule, not this task).
    Mirrors escalation.py's background-task shape: log, sleep, repeat — one
    failed cycle is logged and never kills the task."""
    log.info(
        "Snapshot cleanup task started (retention=%dd, interval=%ds)",
        SNAPSHOT_RETENTION_DAYS, SNAPSHOT_CLEANUP_INTERVAL_SECONDS,
    )
    while True:
        try:
            n = await asyncio.to_thread(_delete_expired_local_snapshots, SNAPSHOT_RETENTION_DAYS)
            if n:
                log.info("Snapshot cleanup: removed %d expired local snapshot director(y/ies)", n)
        except Exception:
            log.exception("Snapshot cleanup cycle failed")
        await asyncio.sleep(SNAPSHOT_CLEANUP_INTERVAL_SECONDS)
