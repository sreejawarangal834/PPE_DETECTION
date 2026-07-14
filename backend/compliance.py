"""
PPE compliance engine — v3.

Improvements over v2:
1. Hybrid spatial association: 0.50*norm_dist + 0.30*IoU + 0.20*vertical_position
2. Per-tracked-worker PPE association (tracker IDs never sent to frontend)
3. Temporal smoothing — hysteresis prevents single-frame false violations
4. Adaptive per-PPE overlap thresholds
5. Smarter body-part coverage rules (ignore invisible parts, both-hand logic)
6. False-positive filters (min area, confidence, out-of-frame PPE)
7. Optional DEBUG_ASSOCIATION logging

WebSocket contract unchanged — only adds `compliant: bool` to each detection.
"""

from __future__ import annotations

import logging
import math
from collections import defaultdict

from config import (
    CONF_THRESHOLD,
    PPE_OVERLAP,
    OVERLAP_THRESHOLD,
    ASSOC_W_DIST,
    ASSOC_W_IOU,
    ASSOC_W_VPOS,
    VIOLATION_FRAMES,
    CLEAR_FRAMES,
    MIN_BODY_PART_AREA,
    DEBUG_ASSOCIATION,
)

log = logging.getLogger("ppe_compliance")

# ── Type alias ─────────────────────────────────────────────────────────────────
Box = tuple[float, float, float, float]   # normalised (x1, y1, x2, y2)

# ── Always-compliant labels ────────────────────────────────────────────────────
# PPE items are inherently compliant; person is evaluated at body-part level.
ALWAYS_COMPLIANT: frozenset[str] = frozenset({
    "person",
    "helmet", "hard-hat", "hardhat",
    "gloves", "glove",
    "shoes", "boot", "boots",
    "safety-vest", "safety_vest", "vest",
    "medical-suit", "medical_suit",
    "safety-suit", "safety_suit",
    "face-guard", "face_guard", "face-shield", "face_shield",
    "face-mask", "face_mask", "mask",
    "glasses", "goggles", "safety-glasses", "safety_glasses",
})

# ── Required PPE per body part ─────────────────────────────────────────────────
REQUIRED_PPE: dict[str, list[str]] = {
    "head":  ["helmet", "hard-hat", "hardhat"],
    "hands": ["gloves", "glove"],
    "foot":  ["shoes", "boot", "boots"],
    "face":  ["face-guard", "face_guard", "face-shield", "face_shield",
              "face-mask", "face_mask", "mask"],
}

# ── Expected vertical relationship: PPE should be [above|below|overlap] part ──
# +1 = PPE centre should be above (lower y) the part centre
# -1 = PPE centre should be below (higher y) the part centre
#  0 = no constraint
VERTICAL_EXPECTED: dict[str, int] = {
    "head":  +1,   # helmet above head
    "hands":  0,   # gloves beside/overlap hands
    "foot":  -1,   # boots below foot
    "face":  +1,   # mask/glasses above or at face level
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
    """Return False if the box is mostly outside the 0..1 frame."""
    x1, y1, x2, y2 = b
    return x1 >= -margin and y1 >= -margin and x2 <= 1 + margin and y2 <= 1 + margin


# ─── Hybrid association score (Req 1) ──────────────────────────────────────────

def _association_score(
    part_box: Box,
    ppe_box:  Box,
    part_label: str,
) -> float:
    """
    Hybrid score:  W_DIST*norm_dist + W_IOU*iou + W_VPOS*vertical_ok

    norm_dist  : 1 - (centre_distance / part_diagonal), clamped 0..1
    iou        : standard IoU
    vertical_ok: 1.0 if PPE is on the expected side, 0.5 if neutral, 0.0 if wrong
    """
    px, py = _centre(part_box)
    qx, qy = _centre(ppe_box)

    # Normalise centre distance by part box diagonal
    pw = part_box[2] - part_box[0]
    ph = part_box[3] - part_box[1]
    diag = math.sqrt(pw * pw + ph * ph) or 1e-6
    dist = math.sqrt((px - qx) ** 2 + (py - qy) ** 2)
    norm_dist = max(0.0, 1.0 - dist / diag)

    iou = _iou(part_box, ppe_box)

    # Vertical position score
    expected = VERTICAL_EXPECTED.get(part_label, 0)
    if expected == 0:
        v_score = 0.5
    else:
        # positive expected → PPE should have lower y (higher on screen)
        diff = (py - qy) * expected   # positive when geometry is correct
        v_score = 1.0 if diff >= 0 else 0.0

    score = (
        ASSOC_W_DIST * norm_dist +
        ASSOC_W_IOU  * iou       +
        ASSOC_W_VPOS * v_score
    )
    return score


# ─── Per-worker temporal state ─────────────────────────────────────────────────

class _WorkerState:
    """Tracks consecutive missing/present counts for each body part per worker."""

    def __init__(self) -> None:
        # part_label → consecutive frames missing PPE
        self.missing_count:  dict[str, int] = defaultdict(int)
        # part_label → consecutive frames PPE present
        self.present_count:  dict[str, int] = defaultdict(int)
        # part_label → whether violation is currently "active" (latched)
        self.violation_active: dict[str, bool] = defaultdict(bool)

    def update(self, part: str, covered: bool) -> bool:
        """
        Update state for one body part; return True if violation should be raised.

        Hysteresis:
        - Raise violation only after VIOLATION_FRAMES consecutive missing frames.
        - Clear violation only after CLEAR_FRAMES consecutive present frames.
        """
        if covered:
            self.missing_count[part] = 0
            self.present_count[part] += 1
            if self.present_count[part] >= CLEAR_FRAMES:
                self.violation_active[part] = False
        else:
            self.present_count[part] = 0
            self.missing_count[part] += 1
            if self.missing_count[part] >= VIOLATION_FRAMES:
                self.violation_active[part] = True

        return self.violation_active[part]


# ─── Module-level worker-state registry ────────────────────────────────────────
# Keyed by tracker_id (int) or -1 for fallback (no tracking).
# Populated by evaluate_compliance(); reset by reset_session_state().
_worker_states: dict[int, _WorkerState] = {}


def reset_session_state() -> None:
    """Call once per WebSocket session to clear temporal state."""
    _worker_states.clear()
    log.info("Temporal state reset for new session.")


def _get_worker_state(worker_id: int) -> _WorkerState:
    if worker_id not in _worker_states:
        _worker_states[worker_id] = _WorkerState()
    return _worker_states[worker_id]


# ─── Worker grouping ───────────────────────────────────────────────────────────

def _group_by_worker(detections: list[dict]) -> dict[int, list[dict]]:
    """
    Group detections by tracker ID.

    If tracker IDs are present (det["_track_id"] is not None), use them.
    Otherwise fall back to nearest-person association:
      - person detections form the workers
      - each non-person detection is assigned to the nearest person by centre distance
    """
    has_ids = any(d.get("_track_id") is not None for d in detections)

    groups: dict[int, list[dict]] = defaultdict(list)

    if has_ids:
        for d in detections:
            tid = d.get("_track_id")
            if tid is None:
                # Assign untracked detections to worker group -1
                groups[-1].append(d)
            else:
                groups[int(tid)].append(d)
        return groups

    # Fallback: nearest-person association
    persons = [d for d in detections if d["label"].lower() == "person"]
    non_persons = [d for d in detections if d["label"].lower() != "person"]

    if not persons:
        # No person detected — everything goes into group -1
        groups[-1].extend(detections)
        return groups

    for pi, p in enumerate(persons):
        groups[pi].append(p)

    for det in non_persons:
        dc = _centre(tuple(det["box"]))  # type: ignore[arg-type]
        best_pi = min(
            range(len(persons)),
            key=lambda i: (
                (_centre(tuple(persons[i]["box"]))[0] - dc[0]) ** 2 +  # type: ignore[arg-type]
                (_centre(tuple(persons[i]["box"]))[1] - dc[1]) ** 2    # type: ignore[arg-type]
            ),
        )
        groups[best_pi].append(det)

    return groups


# ─── Single-worker compliance evaluation ──────────────────────────────────────

def _evaluate_worker(
    worker_id:    int,
    worker_dets:  list[dict],
    frame_violations: list[str],
) -> None:
    """
    Evaluate PPE compliance for a single tracked worker.

    Mutates:
    - Each detection in worker_dets gets `compliant: bool`
    - Appends to frame_violations if temporal threshold is met
    """
    state = _get_worker_state(worker_id)

    by_label: dict[str, list[tuple[int, Box]]] = defaultdict(list)
    for idx, d in enumerate(worker_dets):
        by_label[d["label"].lower()].append((idx, tuple(d["box"])))  # type: ignore[arg-type]

    # Mark always-compliant labels
    for d in worker_dets:
        if d["label"].lower() in ALWAYS_COMPLIANT:
            d["compliant"] = True

    # Track which PPE det-indices are already claimed (no double-match)
    claimed_global: set[tuple[str, int]] = set()   # (ppe_label, local_idx)

    for part, protectors in REQUIRED_PPE.items():
        part_entries = by_label.get(part, [])
        if not part_entries:
            # Body part not visible — do NOT raise a violation (Req 5)
            state.update(part, covered=True)  # treat invisible as OK
            continue

        # Filter out tiny body-part detections (Req 6)
        valid_part_entries = [
            (idx, box) for idx, box in part_entries
            if _area(box) >= MIN_BODY_PART_AREA
        ]
        if not valid_part_entries:
            state.update(part, covered=True)
            continue

        # Collect unclaimed PPE candidates for this part
        ppe_candidates: list[tuple[str, int, Box]] = []  # (ppe_label, local_idx, box)
        for ppe_lbl in protectors:
            for local_idx, ppe_box in by_label.get(ppe_lbl, []):
                if (ppe_lbl, local_idx) in claimed_global:
                    continue
                # Reject PPE detections outside the frame (Req 6)
                if not _is_in_frame(ppe_box):
                    continue
                ppe_candidates.append((ppe_lbl, local_idx, ppe_box))

        # For each body-part instance find the best PPE via hybrid score
        # Greedy: highest score first, one PPE per part instance
        assignment_triples: list[tuple[float, int, tuple[str, int, Box]]] = []
        for part_local_i, (_, part_box) in enumerate(valid_part_entries):
            for cand in ppe_candidates:
                _, _, ppe_box = cand
                ppe_lbl_for_threshold = cand[0]
                threshold = PPE_OVERLAP.get(ppe_lbl_for_threshold, OVERLAP_THRESHOLD)
                score = _association_score(part_box, ppe_box, part_label=part)
                assignment_triples.append((score, part_local_i, cand))

        assignment_triples.sort(reverse=True)

        used_parts:  set[int]              = set()
        used_ppe:    set[tuple[str, int]]  = set()
        coverage:    dict[int, bool]       = {}    # part_local_i → covered

        for score, part_local_i, cand in assignment_triples:
            ppe_lbl, local_idx, ppe_box = cand
            ppe_key = (ppe_lbl, local_idx)
            if part_local_i in used_parts or ppe_key in used_ppe:
                continue
            threshold = PPE_OVERLAP.get(ppe_lbl, OVERLAP_THRESHOLD)
            # Use hybrid score but also require minimum IoU
            iou = _iou(valid_part_entries[part_local_i][1], ppe_box)
            covered = iou >= threshold
            coverage[part_local_i] = covered
            used_parts.add(part_local_i)
            used_ppe.add(ppe_key)
            if covered:
                claimed_global.add(ppe_key)

            if DEBUG_ASSOCIATION:
                log.debug(
                    "[W%d] part=%s ppe=%s score=%.3f iou=%.3f threshold=%.3f covered=%s",
                    worker_id, part, ppe_lbl, score, iou, threshold, covered,
                )

        # Mark parts without any PPE candidate as uncovered
        for pi in range(len(valid_part_entries)):
            if pi not in coverage:
                coverage[pi] = False

        # Special rule for hands: if only ONE hand visible, ONE glove is enough (Req 5)
        if part == "hands" and len(valid_part_entries) == 1:
            # single-hand scenario — any glove assignment counts
            pass   # coverage already set correctly above

        # Overall: part is covered if ALL instances are covered
        all_covered = all(coverage.values()) if coverage else False

        if DEBUG_ASSOCIATION and not all_covered:
            log.debug("[W%d] VIOLATION candidate: part=%s coverage=%s", worker_id, part, coverage)

        # Set `compliant` on body-part detections
        for pi, (det_idx, _) in enumerate(valid_part_entries):
            worker_dets[det_idx]["compliant"] = coverage.get(pi, False)

        # Temporal update
        raise_violation = state.update(part, covered=all_covered)
        if raise_violation:
            frame_violations.append(f"no-{part}-protection")
            if DEBUG_ASSOCIATION:
                log.debug(
                    "[W%d] VIOLATION raised: no-%s-protection (missing %d/%d frames)",
                    worker_id, part,
                    state.missing_count[part], VIOLATION_FRAMES,
                )

    # Person-level vest / eye checks (Req 5 — only if person is detected)
    if "person" in by_label:
        has_vest = any(
            lbl in by_label
            for lbl in ("safety-vest", "safety_vest", "vest",
                        "medical-suit", "medical_suit",
                        "safety-suit", "safety_suit")
        )
        has_eye = any(
            lbl in by_label
            for lbl in ("glasses", "goggles", "safety-glasses", "safety_glasses",
                        "face-guard", "face_guard")
        )
        if not has_vest:
            # Also apply temporal smoothing to vest
            if state.update("vest", covered=False):
                frame_violations.append("no-safety-vest")
        else:
            state.update("vest", covered=True)

        if not has_eye:
            if state.update("eye", covered=False):
                frame_violations.append("no-eye-protection")
        else:
            state.update("eye", covered=True)

    # Default compliant=True for any detection not yet marked
    for d in worker_dets:
        if "compliant" not in d:
            d["compliant"] = True


# ─── Public API ────────────────────────────────────────────────────────────────

def evaluate_compliance(detections: list[dict]) -> tuple[str, list[str]]:
    """
    Evaluate PPE compliance for a single frame.

    Mutates each dict in `detections` by adding ``compliant: bool``.
    Returns (severity, violations) — same contract as v1/v2.

    severity:   "ok" | "medium" | "high"
    violations: list of human-readable violation strings
    """
    # Filter out low-confidence detections (Req 6)
    for d in detections:
        if d["conf"] < CONF_THRESHOLD:
            d["compliant"] = True   # too uncertain — mark safe, skip association

    active = [d for d in detections if d["conf"] >= CONF_THRESHOLD]

    # Group by tracked worker
    worker_groups = _group_by_worker(active)

    frame_violations: list[str] = []

    for worker_id, worker_dets in worker_groups.items():
        _evaluate_worker(worker_id, worker_dets, frame_violations)

    # Default for any detection still without compliant key
    for d in detections:
        if "compliant" not in d:
            d["compliant"] = True

    # Deduplicate violations (multiple workers can produce same violation type)
    seen:       set[str] = set()
    unique_vio: list[str] = []
    for v in frame_violations:
        if v not in seen:
            seen.add(v)
            unique_vio.append(v)

    # Severity (unchanged from v1)
    if not unique_vio:
        severity = "ok"
    elif len(unique_vio) == 1:
        severity = "medium"
    else:
        severity = "high"

    return severity, unique_vio
