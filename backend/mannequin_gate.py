"""
Mannequin exclusion — stage between the motion pre-gate and the PPE model.

Chain: frame motion -> person+mannequin detector (this module) -> [drop mannequins] -> PPE model.

A dedicated 2-class detector (person, mannequin; trained by build_person_mannequin.py +
`yolo detect train`) replaces the COCO-only person gate, because COCO has no mannequin class and
labels mannequins as `person`. Its output does three things:
  1. persons            -> candidate boxes for the per-box motion gate (unchanged contract)
  2. no persons at all  -> frame skipped entirely (PPE never runs on a mannequin-only scene)
  3. mannequin boxes    -> painted out of the frame handed to the PPE model, and any PPE detection
                           whose centre still falls inside one is dropped afterwards, so a
                           mannequin can never be tracked, scored or raise a violation.

A mannequin box that a detected person substantially overlaps is NOT painted (a worker standing
in front of / holding a mannequin must not be blanked). Everything fails open: any error, or a
missing model file, falls back to the COCO person gate with no masking.

This is a probabilistic filter, bounded by the detector's accuracy — not a guarantee.
"""

from __future__ import annotations

import logging
import threading
from pathlib import Path

import numpy as np
from ultralytics import YOLO

import config

log = logging.getLogger("ppe_backend.mannequin_gate")

Box = tuple[float, float, float, float]  # pixel-space x1, y1, x2, y2
_thread_local = threading.local()


def enabled() -> bool:
    return bool(config.PERSON_MANNEQUIN_MODEL) and Path(config.PERSON_MANNEQUIN_MODEL).is_file()


def _get_thread_model() -> YOLO:
    model = getattr(_thread_local, "model", None)
    if model is None:
        model = YOLO(config.PERSON_MANNEQUIN_MODEL)
        names = {str(v).lower(): int(k) for k, v in model.names.items()}
        if "person" not in names or "mannequin" not in names:
            raise RuntimeError(f"{config.PERSON_MANNEQUIN_MODEL} must have 'person' and 'mannequin' classes, got {model.names}")
        _thread_local.names = names
        model.predict(np.zeros((config.PERSON_GATE_IMAGE_SIZE,) * 2 + (3,), dtype=np.uint8),
                      imgsz=config.PERSON_GATE_IMAGE_SIZE, verbose=False)
        _thread_local.model = model
        log.info("mannequin_gate_model_loaded thread=%s model=%s", threading.get_ident(), config.PERSON_MANNEQUIN_MODEL)
    return model


def _iou(a: Box, b: Box) -> float:
    ix1, iy1, ix2, iy2 = max(a[0], b[0]), max(a[1], b[1]), min(a[2], b[2]), min(a[3], b[3])
    inter = max(0.0, ix2 - ix1) * max(0.0, iy2 - iy1)
    union = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter
    return inter / union if union > 0 else 0.0


def _covered_fraction(inner: Box, outer: Box) -> float:
    """Fraction of `inner`'s area lying inside `outer`."""
    ix1, iy1, ix2, iy2 = max(inner[0], outer[0]), max(inner[1], outer[1]), min(inner[2], outer[2]), min(inner[3], outer[3])
    inter = max(0.0, ix2 - ix1) * max(0.0, iy2 - iy1)
    area = (inner[2] - inner[0]) * (inner[3] - inner[1])
    return inter / area if area > 0 else 0.0


def resolve(persons: list[tuple[Box, float]], mannequins: list[tuple[Box, float]]) -> tuple[list[Box], list[Box]]:
    """Same object detected as both classes (IoU >= config.MANNEQUIN_CLASS_CONFLICT_IOU) -> keep
    the higher-confidence label only."""
    keep_p = [True] * len(persons)
    keep_m = [True] * len(mannequins)
    for i, (pb, pc) in enumerate(persons):
        for j, (mb, mc) in enumerate(mannequins):
            if _iou(pb, mb) >= config.MANNEQUIN_CLASS_CONFLICT_IOU:
                if pc >= mc:
                    keep_m[j] = False
                else:
                    keep_p[i] = False
    return ([b for (b, _), k in zip(persons, keep_p) if k], [b for (b, _), k in zip(mannequins, keep_m) if k])


def detect(frame: np.ndarray) -> tuple[list[Box], list[Box]] | None:
    """(person_boxes, mannequin_boxes), or None if the gate itself failed (caller must fail open)."""
    try:
        model = _get_thread_model()
        names = _thread_local.names
        r = model.predict(frame, conf=config.PERSON_GATE_CONF_THRESHOLD, imgsz=config.PERSON_GATE_IMAGE_SIZE,
                          verbose=False)[0]
        persons, mannequins = [], []
        if r.boxes is not None:
            for b in r.boxes:
                box, conf, cls = tuple(b.xyxy[0].tolist()), float(b.conf[0]), int(b.cls[0])
                if cls == names["person"]:
                    persons.append((box, conf))
                elif cls == names["mannequin"] and conf >= config.MANNEQUIN_CONF_THRESHOLD:
                    mannequins.append((box, conf))
        return resolve(persons, mannequins)
    except Exception:
        log.exception("mannequin_gate_failed — falling back (fail open)")
        return None


def exclusion_regions(mannequins: list[Box], persons: list[Box]) -> list[Box]:
    """Mannequin boxes safe to paint out: those NOT substantially covered by a real person's box."""
    return [m for m in mannequins
            if not any(_covered_fraction(m, p) >= config.MANNEQUIN_PERSON_OVERLAP for p in persons)]


def mask_regions(frame: np.ndarray, regions: list[Box]) -> np.ndarray:
    """Copy of `frame` with each region filled with the frame's mean colour (neutral, so it doesn't
    look like an object to the PPE model). Returns `frame` itself when there is nothing to mask."""
    if not regions:
        return frame
    out = frame.copy()
    fill = tuple(int(v) for v in frame.reshape(-1, frame.shape[-1]).mean(axis=0))
    h, w = frame.shape[:2]
    pad = config.MANNEQUIN_MASK_PAD_PX
    for x1, y1, x2, y2 in regions:
        out[max(0, int(y1) - pad):min(h, int(y2) + pad), max(0, int(x1) - pad):min(w, int(x2) + pad)] = fill
    return out


def drop_in_regions(detections: list[dict], regions: list[Box], frame_w: int, frame_h: int) -> list[dict]:
    """Remove PPE detections (normalised 0..1 boxes) whose centre is inside a mannequin region."""
    if not regions:
        return detections
    px = [(x1 / frame_w, y1 / frame_h, x2 / frame_w, y2 / frame_h) for x1, y1, x2, y2 in regions]
    kept = []
    for d in detections:
        bx1, by1, bx2, by2 = d["box"]
        cx, cy = (bx1 + bx2) / 2, (by1 + by2) / 2
        if not any(x1 <= cx <= x2 and y1 <= cy <= y2 for x1, y1, x2, y2 in px):
            kept.append(d)
    return kept
