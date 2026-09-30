"""
Motion detection — stage 2 of the person→motion→PPE presence cascade.

Runs after person_gate.detect_persons() finds candidate person-shaped boxes,
and before the heavy, custom-trained PPE model. Rejects candidates that never
actually move (mannequins, posters, reflections) — this is what makes it safe
to loosen person_gate's own recall (see config.py's PERSON_GATE_* defaults
and this module's own tests for the retail-CCTV finding that motivated it):
a looser person detector now only costs one extra cheap per-box motion check
per false positive, not one extra full PPE-model call.

Method default is simple consecutive-frame differencing ("diff"), not a
background subtractor (MOG2/KNN), despite MOG2/KNN being the more
sophisticated option: a background subtractor's whole design intent is to
adapt to, and stop flagging, anything that stays still — which is exactly
backwards here. A stationary, non-compliant worker at a station is one of
the most important cases for PPE compliance to keep checking, not a case to
silently stop checking. Simple diff only ever reports "changed since last
frame or not," which composes correctly with the grace window and force-run
safety valve below. "mog2"/"knn" remain available for sites with heavy
camera shake where diff alone is too noisy.

Long-timescale static-object presumption: the short force-run valve above
(MOTION_GATE_FORCE_INTERVAL_SECONDS, ~2s) exists so a real, momentarily-still
worker is never permanently ignored — but that same safety property means a
scene that is PURELY mannequins/fixtures never fully quiets down either, it
just gets force-checked every couple of seconds forever. `_TrackedRegion`
below adds a second, much longer timescale on top: if a specific candidate
box (matched across frames by IoU, since this gate runs before the real
tracker has assigned it an ID) has shown zero motion for
MOTION_STATIC_OBJECT_SECONDS — long enough that no real human, however
still, plausibly stays that motionless — it's presumed non-human and
excluded from the moving/grace/force-run decision entirely, except during a
periodic MOTION_STATIC_REVERIFY_SECONDS re-check (in case a real person
later stands exactly where a mannequin was, or the mannequin itself moves).
This is the piece that lets a genuinely all-mannequin scene actually go
quiet, rather than only ever being force-checked every couple of seconds.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from typing import Any

import cv2
import numpy as np

import config

log = logging.getLogger("ppe_backend.motion_gate")

Box = tuple[float, float, float, float]  # pixel-space x1, y1, x2, y2 — matches person_gate's convention


def _iou(a: Box, b: Box) -> float:
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    inter = max(0.0, ix2 - ix1) * max(0.0, iy2 - iy1)
    area_a = max(0.0, ax2 - ax1) * max(0.0, ay2 - ay1)
    area_b = max(0.0, bx2 - bx1) * max(0.0, by2 - by1)
    union = area_a + area_b - inter
    return inter / union if union > 0 else 0.0


@dataclass
class _TrackedRegion:
    """A candidate box followed across frames purely by IoU overlap — a
    lightweight, gate-local stand-in for real tracking (ByteTrack doesn't run
    until after this gate decides to let a frame through)."""

    box: Box
    still_since: float          # when this region was last seen moving (reset on any detected motion)
    last_seen: float            # when this region was last matched to a candidate box (for eviction)
    last_reverified_at: float   # when a confirmed-static region was last re-included for a check


@dataclass
class MotionState:
    """Per-session state — created once per session (main.py, alongside
    ghost_cache/worker_states) and threaded into _run_inference(). Only ever
    read/written synchronously from within that same session's closure, so
    (unlike face/sampling.py's FaceSampler or reid/resolver.py's per-track
    state, both of which must be reachable from a different coroutine) it
    needs no forget_session()/sweep machinery — it just falls out of scope
    when the session ends, same as ghost_cache/track_frame_counts today."""

    prev_gray: np.ndarray | None = None
    bg_subtractor: Any | None = None  # only used for "mog2"/"knn"
    frames_seen: int = 0
    last_motion_at: float = float("-inf")
    last_forced_run_at: float = float("-inf")
    static_regions: list[_TrackedRegion] = field(default_factory=list)
    # Pre-gate hand-off (frame_has_motion -> should_run_inference, same frame).
    # The diff mask advances prev_gray, so it must be computed exactly once per
    # frame and reused, never recomputed.
    cached_mask: np.ndarray | None = None
    cached_valid: bool = False
    last_pregate_forced_at: float = float("-inf")
    forced_pass: bool = False


def new_session_state() -> MotionState:
    # Both clocks start at session-creation time, not -inf: a brand-new
    # session hasn't gone MOTION_GATE_FORCE_INTERVAL_SECONDS without a check
    # yet, so the force valve shouldn't fire on its very first evaluation.
    now = time.monotonic()
    return MotionState(last_motion_at=now, last_forced_run_at=now, last_pregate_forced_at=now)


def _get_bg_subtractor():
    if config.MOTION_GATE_METHOD == "knn":
        return cv2.createBackgroundSubtractorKNN(
            history=config.MOTION_MOG2_HISTORY, detectShadows=config.MOTION_MOG2_DETECT_SHADOWS,
        )
    return cv2.createBackgroundSubtractorMOG2(
        history=config.MOTION_MOG2_HISTORY,
        varThreshold=config.MOTION_MOG2_VAR_THRESHOLD,
        detectShadows=config.MOTION_MOG2_DETECT_SHADOWS,
    )


def _compute_motion_mask(frame: np.ndarray, state: MotionState) -> np.ndarray | None:
    """Returns a full-frame uint8 0/255 motion mask, or None while warming up
    (not enough history yet — callers must treat this as fail-open, not as
    "no motion")."""
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    state.frames_seen += 1

    if config.MOTION_GATE_METHOD in ("mog2", "knn"):
        if state.bg_subtractor is None:
            state.bg_subtractor = _get_bg_subtractor()
        mask = state.bg_subtractor.apply(gray)
        # MOG2/KNN mark shadow pixels as 127 when detectShadows=True — treat
        # only confident foreground (255) as motion.
        mask = np.where(mask == 255, 255, 0).astype(np.uint8)
        if state.frames_seen < config.MOTION_WARMUP_FRAMES:
            return None
        return mask

    # "diff" (default)
    if state.prev_gray is None:
        state.prev_gray = gray
        return None
    diff = cv2.absdiff(gray, state.prev_gray)
    state.prev_gray = gray
    if state.frames_seen < config.MOTION_WARMUP_FRAMES:
        return None
    _, mask = cv2.threshold(diff, config.MOTION_DIFF_THRESHOLD, 255, cv2.THRESH_BINARY)
    return mask


def _box_motion_fraction(mask: np.ndarray, box: Box) -> float:
    h, w = mask.shape[:2]
    x1, y1, x2, y2 = box
    px1, py1 = max(0, int(x1)), max(0, int(y1))
    px2, py2 = min(w, int(x2)), min(h, int(y2))
    if px2 <= px1 or py2 <= py1:
        return 0.0
    crop = mask[py1:py2, px1:px2]
    area = crop.size
    if area == 0:
        return 0.0
    return cv2.countNonZero(crop) / area


def _update_static_regions(
    state: MotionState, mask: np.ndarray, candidate_boxes: list[Box], now: float,
) -> list[Box]:
    """Matches each candidate box to a tracked region (by IoU) and updates how
    long that region has been continuously still. Returns the subset of
    candidate_boxes that should still be fed into the moving/grace/force-run
    decision — a region confirmed static for MOTION_STATIC_OBJECT_SECONDS is
    presumed non-human (mannequin/poster/fixture) and dropped, except during
    its own periodic MOTION_STATIC_REVERIFY_SECONDS re-check."""
    matched_ids: set[int] = set()
    still_considered: list[Box] = []

    for box in candidate_boxes:
        moving = _box_motion_fraction(mask, box) >= config.MOTION_MIN_FRACTION

        region = None
        best_iou = config.MOTION_STATIC_IOU_MATCH_THRESHOLD
        for candidate_region in state.static_regions:
            iou = _iou(candidate_region.box, box)
            if iou >= best_iou:
                region, best_iou = candidate_region, iou

        if region is None:
            region = _TrackedRegion(box=box, still_since=now, last_seen=now, last_reverified_at=now)
            state.static_regions.append(region)
        else:
            region.box = box
            region.last_seen = now
        matched_ids.add(id(region))

        if moving:
            region.still_since = now
            still_considered.append(box)
            continue

        confirmed_static = (now - region.still_since) >= config.MOTION_STATIC_OBJECT_SECONDS
        if not confirmed_static:
            still_considered.append(box)  # still, but not proven still for long enough yet
            continue

        if now - region.last_reverified_at >= config.MOTION_STATIC_REVERIFY_SECONDS:
            region.last_reverified_at = now
            still_considered.append(box)  # periodic re-check of a presumed-static region
        # else: excluded this frame — presumed non-human, not due for re-check yet.

    # Evict regions no candidate matched for a while (object left frame, or the
    # detector stopped finding it) — bounds static_regions' size over a long session.
    state.static_regions = [
        r for r in state.static_regions
        if id(r) in matched_ids or (now - r.last_seen) < config.MOTION_STATIC_REGION_TTL_SECONDS
    ]

    return still_considered


def frame_has_motion(state: MotionState, frame: np.ndarray) -> bool:
    """Stage 1 of motion -> person -> PPE: cheap whole-frame check that runs
    BEFORE the person model. False means skip person + PPE for this frame.
    Fails open (True) on warmup and exceptions, and keeps the same safety
    valves as should_run_inference: a grace window after the last per-box
    motion, and an unconditional force-run every MOTION_GATE_FORCE_INTERVAL_SECONDS
    so a stationary worker is never dropped. Stashes the mask on `state` so the
    later per-box should_run_inference() reuses it instead of recomputing."""
    now = time.monotonic()
    state.cached_valid = False
    state.forced_pass = False
    try:
        mask = _compute_motion_mask(frame, state)
        state.cached_mask, state.cached_valid = mask, True
        if mask is None:
            return True  # warming up
        if cv2.countNonZero(mask) / mask.size >= config.MOTION_GLOBAL_MIN_FRACTION:
            return True
        if now - state.last_motion_at <= config.MOTION_GATE_GRACE_SECONDS:
            return True
        if now - state.last_pregate_forced_at >= config.MOTION_GATE_FORCE_INTERVAL_SECONDS:
            state.last_pregate_forced_at = now
            state.forced_pass = True
            return True
        return False
    except Exception:
        log.exception("motion_pregate_failed — defaulting to has_motion=True (fail open)")
        state.cached_mask, state.cached_valid = None, False
        return True


def should_run_inference(state: MotionState, frame: np.ndarray, candidate_boxes: list[Box]) -> bool:
    """Synchronous — called inline inside _run_inference (not via a separate
    asyncio.to_thread dispatch, since it's cheap enough not to warrant one and
    the whole point is to avoid an extra per-frame round trip). Fails open
    (True) on warmup, on any internal exception, and — deliberately — once
    every MOTION_GATE_FORCE_INTERVAL_SECONDS regardless of motion (see module
    docstring: a real, stationary non-compliant worker must never be
    silently filtered out forever)."""
    if not candidate_boxes:
        state.cached_valid = state.forced_pass = False
        return False

    now = time.monotonic()
    # Consume the pre-gate hand-off (if any) so it never leaks to a later frame.
    use_cached, cached = state.cached_valid, state.cached_mask
    forced = state.forced_pass
    state.cached_valid = state.forced_pass = False
    try:
        mask = cached if use_cached else _compute_motion_mask(frame, state)
        if mask is None:
            return True  # warming up — not enough history to judge yet

        effective_boxes = _update_static_regions(state, mask, candidate_boxes, now)
        if forced and effective_boxes:
            state.last_forced_run_at = now  # pre-gate's force-run: honour it end to end
            return True
        if not effective_boxes:
            return False  # every candidate is presumed non-human — nothing worth checking this frame

        any_moving = any(
            _box_motion_fraction(mask, box) >= config.MOTION_MIN_FRACTION for box in effective_boxes
        )
        if any_moving:
            state.last_motion_at = now
            state.last_forced_run_at = now
            return True

        if now - state.last_motion_at <= config.MOTION_GATE_GRACE_SECONDS:
            return True

        if now - state.last_forced_run_at >= config.MOTION_GATE_FORCE_INTERVAL_SECONDS:
            state.last_forced_run_at = now
            return True

        return False
    except Exception:
        log.exception("motion_gate_failed — defaulting to should_run_inference=True (fail open)")
        return True
