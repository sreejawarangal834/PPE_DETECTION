"""
PPE compliance rules.

The model detects body parts (head, hands, foot, person, ...) and PPE items
(helmet, gloves, shoes, safety-vest, ...) as separate classes rather than
"no-helmet"-style violation labels. A violation is a required body part
detected in a frame with no overlapping protective item.

This is a heuristic (IoU overlap, not a calibrated safety-certified rule
engine) intended for the live dashboard, not a compliance-audit tool.
"""

from __future__ import annotations

Box = tuple[float, float, float, float]

REQUIRED_PPE: dict[str, list[str]] = {
    "head": ["helmet"],
    "hands": ["gloves"],
    "foot": ["shoes"],
}

OVERLAP_THRESHOLD = 0.1


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


def evaluate_compliance(detections: list[dict]) -> tuple[str, list[str]]:
    by_label: dict[str, list[Box]] = {}
    for d in detections:
        by_label.setdefault(d["label"], []).append(tuple(d["box"]))

    violations: list[str] = []

    for part, protectors in REQUIRED_PPE.items():
        part_boxes = by_label.get(part, [])
        if not part_boxes:
            continue
        protector_boxes = [b for p in protectors for b in by_label.get(p, [])]
        for part_box in part_boxes:
            covered = any(_iou(part_box, pb) > OVERLAP_THRESHOLD for pb in protector_boxes)
            if not covered:
                violations.append(f"no-{part}-protection")

    if "person" in by_label and "safety-vest" not in by_label:
        violations.append("no-safety-vest")

    if not violations:
        severity = "ok"
    elif len(violations) == 1:
        severity = "medium"
    else:
        severity = "high"

    return severity, violations
