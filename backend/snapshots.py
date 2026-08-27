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

Honest gap (flagged, not silently left as a surprise): there is no retention/cleanup here.
Every violation that gets a snapshot writes one more JPEG that stays on disk forever. Crops
(not full frames) keep individual files small (~5-30KB typically at quality=85), but disk
usage is still unbounded over the lifetime of a real deployment. A real follow-up would be a
periodic task deleting snapshots older than N days (mirroring escalation.py's shape — a
background asyncio task started in main.py's lifespan) or capping total directory size;
neither is built here.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from pathlib import Path

import cv2
import numpy as np

log = logging.getLogger("ppe_backend.snapshots")

SNAPSHOT_DIR = Path(__file__).parent / "snapshots"

# Extra margin around the person's box so PPE right at the edge of the detection (a helmet
# brim, a glove at the frame boundary) isn't clipped out of the evidence crop.
CROP_PADDING_FRACTION = 0.15
JPEG_QUALITY = 85


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
