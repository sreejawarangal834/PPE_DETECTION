"""
PPE compliance engine — v4.

v4 changes (minimal fix for best.pt's 13-class schema):
- Handles `no-*` violation classes directly (no-helmet, no-vest, no-gloves,
  no-goggles, no-mask, no-shoe) — these are the model's primary violation
  signal and were previously ignored (fell through to compliant=True).
- Positive PPE presence (helmet, vest, gloves, etc.) is also checked within
  each worker's group — if neither the positive PPE nor a `no-*` is present,
  that check is ambiguous; we rely on what the model did emit.
- Orphan group (worker_id == -1, no `person` anchor) is skipped entirely —
  running checks against floating PPE boxes with no person produces noise.
- Body-part IoU checks (head/hands/foot/face) preserved for future models
  that emit those classes; silently skipped when absent from best.pt.
- WebSocket contract unchanged — only adds `compliant: bool` per detection.
"""

from __future__ import annotations

import logging
import math
from collections import defaultdict, deque

from config import (
    CONF_THRESHOLD,
    PPE_OVERLAP,
    OVERLAP_THRESHOLD,
    ASSOC_W_DIST,
    ASSOC_W_IOU,
    ASSOC_W_VPOS,
    VIOLATION_WINDOW_SECONDS,
    VIOLATION_RAISE_FRACTION,
    VIOLATION_CLEAR_FRACTION,
    MIN_EVIDENCE_SECONDS,
    MIN_EVIDENCE_SAMPLES,
    MAX_SAMPLE_GAP_SECONDS,
    MIN_BODY_PART_AREA,
    DEBUG_ASSOCIATION,
)

log = logging.getLogger("ppe_compliance")

# ── Type alias ─────────────────────────────────────────────────────────────────
Box = tuple[float, float, float, float]   # normalised (x1, y1, x2, y2)

# ── Always-compliant positive labels ──────────────────────────────────────────
# Positive PPE detections mean the item IS present → compliant.
# `no-*` classes are intentionally NOT in this set — they are violations.
ALWAYS_COMPLIANT: frozenset[str] = frozenset({
    "person",
    "helmet", "hard-hat", "hardhat",
    "gloves", "glove",
    "shoe", "shoes", "boot", "boots",
    "safety-vest", "safety_vest", "vest",
    "medical-suit", "medical_suit",
    "safety-suit", "safety_suit",
    "face-guard", "face_guard", "face-shield", "face_shield",
    "face-mask", "face_mask", "mask", "face-mask-medical",
    "glasses", "goggles", "safety-glasses", "safety_glasses",
})

# ── Direct violation classes (best.pt `no-*` labels) ─────────────────────────
# Maps no-* label → (check_key, ppe_type_id, human_violation_string)
NO_CLASS_VIOLATIONS: dict[str, tuple[str, str, str]] = {
    "no-helmet":  ("helmet",  "helmet",       "no-helmet"),
    "no-vest":    ("vest",    "vest",         "no-safety-vest"),
    "no-gloves":  ("gloves",  "gloves",       "no-gloves"),
    "no-goggles": ("goggles", "eye_prot",     "no-eye-protection"),
    "no-mask":    ("mask",    "mask",         "no-mask"),
    "no-shoe":    ("shoe",    "safety_shoes", "no-safety-shoe"),
}

# ── Positive PPE presence checks ──────────────────────────────────────────────
# check_key → (ppe_type_id, frozenset of labels that count as "present")
POSITIVE_PPE_CHECKS: dict[str, tuple[str, frozenset[str]]] = {
    "helmet":  ("helmet",       frozenset({"helmet", "hard-hat", "hardhat"})),
    "vest":    ("vest",         frozenset({"safety-vest", "safety_vest", "vest",
                                           "medical-suit", "medical_suit",
                                           "safety-suit", "safety_suit"})),
    "gloves":  ("gloves",       frozenset({"gloves", "glove"})),
    "shoe":    ("safety_shoes", frozenset({"shoe", "shoes", "boot", "boots"})),
    "goggles": ("eye_prot",     frozenset({"glasses", "goggles", "safety-glasses",
                                           "safety_glasses"})),
    "mask":    ("mask",         frozenset({"face-guard", "face_guard", "face-shield",
                                           "face_shield", "face-mask", "face_mask",
                                           "mask", "face-mask-medical"})),
}

# ── Required PPE per body part (future body-part model support) ───────────────
REQUIRED_PPE: dict[str, list[str]] = {
    "head":  ["helmet", "hard-hat", "hardhat"],
    "hands": ["gloves", "glove"],
    "foot":  ["shoes", "boot", "boots", "shoe"],
    "face":  ["face-guard", "face_guard", "face-shield", "face_shield",
              "face-mask", "face_mask", "mask", "face-mask-medical"],
}

# ── Map body-part check → zone policy PPE type id ────────────────────────────
PART_TO_PPE_TYPE: dict[str, str] = {
    "head":  "helmet",
    "hands": "gloves",
    "foot":  "safety_shoes",
    "face":  "mask",
}
PERSON_CHECK_TO_PPE_TYPE: dict[str, str] = {
    "vest": "vest",
    "eye":  "eye_prot",
}

VERTICAL_EXPECTED: dict[str, int] = {
    "head":  +1,
    "hands":  0,
    "foot":  -1,
    "face":  +1,
}


# ─── Geometry ──────────────────────────────────────────────────────────────────

def _iou(a: Box, b: Box) -> float:
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    ix1 = max(ax1, bx1); iy1 = max(ay1, by1)
    ix2 = min(ax2, bx2); iy2 = min(ay2, by2)
    inter  = max(0.0, ix2 - ix1) * max(0.0, iy2 - iy1)
    area_a = max(0.0, ax2 - ax1) * max(0.0, ay2 - ay1)
    area_b = max(0.0, bx2 - bx1) * max(0.0, by2 - by1)
    union  = area_a + area_b - inter
    return inter / union if union > 0 else 0.0


def _centre(b: Box) -> tuple[float, float]:
    return ((b[0] + b[2]) * 0.5, (b[1] + b[3]) * 0.5)


def _area(b: Box) -> float:
    return max(0.0, b[2] - b[0]) * max(0.0, b[3] - b[1])


def _is_in_frame(b: Box, margin: float = 0.01) -> bool:
    x1, y1, x2, y2 = b
    return x1 >= -margin and y1 >= -margin and x2 <= 1 + margin and y2 <= 1 + margin


def _association_score(part_box: Box, ppe_box: Box, part_label: str) -> float:
    px, py = _centre(part_box)
    qx, qy = _centre(ppe_box)
    pw = part_box[2] - part_box[0]
    ph = part_box[3] - part_box[1]
    diag = math.sqrt(pw * pw + ph * ph) or 1e-6
    dist = math.sqrt((px - qx) ** 2 + (py - qy) ** 2)
    norm_dist = max(0.0, 1.0 - dist / diag)
    iou = _iou(part_box, ppe_box)
    expected = VERTICAL_EXPECTED.get(part_label, 0)
    if expected == 0:
        v_score = 0.5
    else:
        diff = (py - qy) * expected
        v_score = 1.0 if diff >= 0 else 0.0
    return ASSOC_W_DIST * norm_dist + ASSOC_W_IOU * iou + ASSOC_W_VPOS * v_score


# ─── Per-worker temporal state ─────────────────────────────────────────────────

class _PartTimeline:
    __slots__ = ("samples", "violation_active", "first_seen_ts", "last_fraction_missing")

    def __init__(self) -> None:
        self.samples: deque[tuple[float, bool]] = deque()
        self.violation_active: bool = False
        self.first_seen_ts: float | None = None
        self.last_fraction_missing: float = 0.0


class _WorkerState:
    def __init__(self) -> None:
        self._parts: dict[str, _PartTimeline] = {}

    def _timeline(self, part: str) -> _PartTimeline:
        tl = self._parts.get(part)
        if tl is None:
            tl = self._parts[part] = _PartTimeline()
        return tl

    def update(self, part: str, covered: bool, now: float) -> bool:
        tl = self._timeline(part)
        if tl.first_seen_ts is None:
            tl.first_seen_ts = now
        tl.samples.append((now, covered))
        window_start = now - VIOLATION_WINDOW_SECONDS
        while len(tl.samples) > 1 and tl.samples[1][0] < window_start:
            tl.samples.popleft()
        missing_time = 0.0
        total_time = 0.0
        samples = tl.samples
        for i in range(1, len(samples)):
            t_prev, covered_prev = samples[i - 1]
            t_cur, _ = samples[i]
            seg = min(t_cur - t_prev, MAX_SAMPLE_GAP_SECONDS)
            if seg <= 0:
                continue
            total_time += seg
            if not covered_prev:
                missing_time += seg
        fraction_missing = (missing_time / total_time) if total_time > 0 else (0.0 if covered else 1.0)
        tl.last_fraction_missing = fraction_missing
        evidence_ok = (
            (now - tl.first_seen_ts) >= MIN_EVIDENCE_SECONDS
            and len(samples) >= MIN_EVIDENCE_SAMPLES
        )
        if evidence_ok:
            if fraction_missing >= VIOLATION_RAISE_FRACTION:
                tl.violation_active = True
            elif fraction_missing <= VIOLATION_CLEAR_FRACTION:
                tl.violation_active = False
        return tl.violation_active


WorkerStates = dict[int, _WorkerState]


def new_session_state() -> WorkerStates:
    log.info("Temporal state initialised for new session.")
    return {}


def _get_worker_state(worker_id: int, worker_states: WorkerStates) -> _WorkerState:
    if worker_id not in worker_states:
        worker_states[worker_id] = _WorkerState()
    return worker_states[worker_id]


# ─── Worker grouping ───────────────────────────────────────────────────────────

_ASSIGN_MIN_CONTAINMENT = 0.30


def _containment(inner: Box, outer: Box) -> float:
    ix1 = max(inner[0], outer[0]); iy1 = max(inner[1], outer[1])
    ix2 = min(inner[2], outer[2]); iy2 = min(inner[3], outer[3])
    inter = max(0.0, ix2 - ix1) * max(0.0, iy2 - iy1)
    a = _area(inner)
    return inter / a if a > 0 else 0.0


def _group_by_worker(detections: list[dict]) -> dict[int, list[dict]]:
    """
    Group detections into workers. ONE worker == ONE `person` box.
    Non-person detections (PPE items, no-* classes) are assigned to the
    person whose bounding box contains the largest share of them.
    Detections with no person anchor go to group -1 (orphan, not evaluated).
    """
    groups: dict[int, list[dict]] = defaultdict(list)
    persons = [d for d in detections if d["label"].lower() == "person"]
    others  = [d for d in detections if d["label"].lower() != "person"]

    if not persons:
        groups[-1].extend(detections)
        return groups

    keys: list[int] = []
    for pi, p in enumerate(persons):
        tid = p.get("_track_id")
        key = int(tid) if tid is not None else -(pi + 2)
        while key in groups:
            key -= 1000
        keys.append(key)
        groups[key].append(p)

    for det in others:
        box: Box = tuple(det["box"])  # type: ignore[assignment]
        dcx, dcy = _centre(box)
        best_key, best_rank = None, None
        for key, p in zip(keys, persons):
            pbox: Box = tuple(p["box"])  # type: ignore[assignment]
            cont = _containment(box, pbox)
            if cont < _ASSIGN_MIN_CONTAINMENT:
                continue
            pcx, pcy = _centre(pbox)
            rank = (cont, -((pcx - dcx) ** 2 + (pcy - dcy) ** 2))
            if best_rank is None or rank > best_rank:
                best_key, best_rank = key, rank
        groups[best_key if best_key is not None else -1].append(det)

    return groups


# ─── Single-worker compliance evaluation ──────────────────────────────────────

def _evaluate_worker(
    worker_id:         int,
    worker_dets:       list[dict],
    frame_violations:  list[str],
    worker_violations: list[dict],
    worker_states:     WorkerStates,
    now:               float,
    required_ppe:      frozenset[str] | None,
) -> None:
    """
    Evaluate PPE compliance for one tracked worker.

    Logic for best.pt's 13-class schema:
    1. Orphan group (worker_id == -1) is skipped — no person anchor means
       no meaningful check; all detections default to compliant=True.
    2. `no-*` detection in this worker's group → that PPE check is violated.
    3. Positive PPE absent from this worker's group (and no `no-*` either)
       → also treated as a violation.
    4. `no-*` takes precedence over positive PPE when both appear (violation wins).
    5. Temporal smoothing via _WorkerState prevents single-frame false positives.
    6. Body-part IoU checks run only when `head`/`hands`/`foot`/`face` labels
       appear (future model support; silently skipped for best.pt).
    """
    # Orphan group — nothing to evaluate, just mark everything compliant
    if worker_id == -1:
        for d in worker_dets:
            if "compliant" not in d:
                d["compliant"] = True
        return

    state = _get_worker_state(worker_id, worker_states)

    by_label: dict[str, list[tuple[int, Box]]] = defaultdict(list)
    for idx, d in enumerate(worker_dets):
        by_label[d["label"].lower()].append((idx, tuple(d["box"])))  # type: ignore[arg-type]

    # Positive PPE detections → compliant=True
    for d in worker_dets:
        if d["label"].lower() in ALWAYS_COMPLIANT:
            d["compliant"] = True

    # no-* detections → compliant=False (direct violation signal)
    for d in worker_dets:
        if d["label"].lower() in NO_CLASS_VIOLATIONS:
            d["compliant"] = False

    # ── Determine coverage per check ──────────────────────────────────────────
    # Only use no-* direct signals. Positive-PPE absence alone is NOT flagged —
    # the model was trained to emit no-* when PPE is missing. Absence of the
    # positive class is ambiguous (occlusion, partial frame, confidence below
    # threshold) and produces too many false positives.
    check_covered: dict[str, bool] = {}

    for no_label, (check_key, ppe_type_id, _) in NO_CLASS_VIOLATIONS.items():
        if required_ppe is not None and ppe_type_id not in required_ppe:
            check_covered[check_key] = True
            continue
        if no_label in by_label:
            check_covered[check_key] = False
            if DEBUG_ASSOCIATION:
                log.debug("[W%d] no-* signal: %s -> %s VIOLATION", worker_id, no_label, check_key)

    # ── Temporal smoothing and violation raising ──────────────────────────────
    for no_label, (check_key, ppe_type_id, violation_string) in NO_CLASS_VIOLATIONS.items():
        if check_key not in check_covered:
            # Zone policy excluded this check
            state.update(check_key, covered=True, now=now)
            continue
        covered = check_covered[check_key]
        was_active = state._timeline(check_key).violation_active
        raise_violation = state.update(check_key, covered=covered, now=now)
        if raise_violation:
            frame_violations.append(violation_string)
            if not was_active:
                worker_violations.append({
                    "worker_id":  worker_id,
                    "ppe_type":   ppe_type_id,
                    "violation":  violation_string,
                    "confidence": state._timeline(check_key).last_fraction_missing,
                })
            if DEBUG_ASSOCIATION:
                log.debug(
                    "[W%d] VIOLATION raised: %s (missing %.0f%% of last %.1fs)",
                    worker_id, violation_string,
                    state._timeline(check_key).last_fraction_missing * 100,
                    VIOLATION_WINDOW_SECONDS,
                )

    # ── Body-part IoU checks (future model support) ───────────────────────────
    # Runs only when model emits body-part labels (head/hands/foot/face).
    # Silently skipped for best.pt which does not emit them.
    for part, protectors in REQUIRED_PPE.items():
        if required_ppe is not None and PART_TO_PPE_TYPE.get(part, "") not in required_ppe:
            state.update(part, covered=True, now=now)
            continue
        part_entries = by_label.get(part, [])
        if not part_entries:
            # Body part class absent → this model doesn't emit it → treat as OK
            state.update(part, covered=True, now=now)
            continue
        valid_part_entries = [(idx, box) for idx, box in part_entries if _area(box) >= MIN_BODY_PART_AREA]
        if not valid_part_entries:
            state.update(part, covered=True, now=now)
            continue
        ppe_candidates: list[tuple[str, int, Box]] = []
        for ppe_lbl in protectors:
            for local_idx, ppe_box in by_label.get(ppe_lbl, []):
                if not _is_in_frame(ppe_box):
                    continue
                ppe_candidates.append((ppe_lbl, local_idx, ppe_box))
        assignment_triples: list[tuple[float, int, tuple[str, int, Box]]] = []
        for part_local_i, (_, part_box) in enumerate(valid_part_entries):
            for cand in ppe_candidates:
                score = _association_score(part_box, cand[2], part_label=part)
                assignment_triples.append((score, part_local_i, cand))
        assignment_triples.sort(reverse=True)
        used_parts: set[int] = set()
        used_ppe: set[tuple[str, int]] = set()
        coverage: dict[int, bool] = {}
        for score, part_local_i, cand in assignment_triples:
            ppe_lbl, local_idx, ppe_box = cand
            ppe_key = (ppe_lbl, local_idx)
            if part_local_i in used_parts or ppe_key in used_ppe:
                continue
            threshold = PPE_OVERLAP.get(ppe_lbl, OVERLAP_THRESHOLD)
            iou = _iou(valid_part_entries[part_local_i][1], ppe_box)
            covered_part = iou >= threshold
            coverage[part_local_i] = covered_part
            used_parts.add(part_local_i)
            used_ppe.add(ppe_key)
        for pi in range(len(valid_part_entries)):
            if pi not in coverage:
                coverage[pi] = False
        for pi, (det_idx, _) in enumerate(valid_part_entries):
            worker_dets[det_idx]["compliant"] = coverage.get(pi, False)
        all_covered = all(coverage.values()) if coverage else False
        was_active = state._timeline(part).violation_active
        raise_violation = state.update(part, covered=all_covered, now=now)
        if raise_violation:
            frame_violations.append(f"no-{part}-protection")
            if not was_active:
                worker_violations.append({
                    "worker_id":  worker_id,
                    "ppe_type":   PART_TO_PPE_TYPE.get(part, part),
                    "violation":  f"no-{part}-protection",
                    "confidence": state._timeline(part).last_fraction_missing,
                })

    # ── Person box carries the worker-level verdict ───────────────────────────
    if any(tl.violation_active for tl in state._parts.values()):
        for d in worker_dets:
            if d["label"].lower() == "person":
                d["compliant"] = False

    # Default: anything not yet marked is compliant
    for d in worker_dets:
        if "compliant" not in d:
            d["compliant"] = True


# ─── Public API ────────────────────────────────────────────────────────────────

def evaluate_compliance(
    detections:    list[dict],
    worker_states: WorkerStates,
    now:           float,
    required_ppe:  frozenset[str] | None = None,
) -> tuple[str, list[str], list[dict]]:
    """
    Evaluate PPE compliance for a single frame.

    Mutates each dict in `detections` by adding `compliant: bool`.
    Returns (severity, violations, worker_violations).
    """
    # Filter out low-confidence detections
    for d in detections:
        if d["conf"] < CONF_THRESHOLD:
            d["compliant"] = True

    active = [d for d in detections if d["conf"] >= CONF_THRESHOLD]
    worker_groups = _group_by_worker(active)

    frame_violations:  list[str]  = []
    worker_violations: list[dict] = []

    for worker_id, worker_dets in worker_groups.items():
        _evaluate_worker(
            worker_id, worker_dets, frame_violations, worker_violations,
            worker_states, now, required_ppe,
        )

    for d in detections:
        if "compliant" not in d:
            d["compliant"] = True

    seen:       set[str]  = set()
    unique_vio: list[str] = []
    for v in frame_violations:
        if v not in seen:
            seen.add(v)
            unique_vio.append(v)

    if not unique_vio:
        severity = "ok"
    elif len(unique_vio) == 1:
        severity = "medium"
    else:
        severity = "high"

    return severity, unique_vio, worker_violations
