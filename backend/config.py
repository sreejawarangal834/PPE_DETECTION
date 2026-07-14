"""
Backend configuration — all values overridable via environment variables.

    export PPE_CONF_THRESHOLD=0.40
    export PPE_VIOLATION_FRAMES=3
    uvicorn main:app --reload
"""

from __future__ import annotations

import os


def _float(key: str, default: float) -> float:
    return float(os.environ.get(key, default))


def _int(key: str, default: int) -> int:
    return int(os.environ.get(key, default))


def _bool(key: str, default: bool) -> bool:
    v = os.environ.get(key)
    if v is None:
        return default
    return v.lower() in ("1", "true", "yes")


# ── Inference ──────────────────────────────────────────────────────────────────
CONF_THRESHOLD: float = _float("PPE_CONF_THRESHOLD", 0.35)
IOU_THRESHOLD:  float = _float("PPE_IOU_THRESHOLD",  0.45)
IMAGE_SIZE:     int   = _int("PPE_IMAGE_SIZE",        960)

# ── Streaming ──────────────────────────────────────────────────────────────────
JPEG_QUALITY:   int = _int("PPE_JPEG_QUALITY",   75)
MAX_SEND_WIDTH: int = _int("PPE_MAX_SEND_WIDTH", 960)

# ── Pipeline queues ────────────────────────────────────────────────────────────
INFER_QUEUE_SIZE: int = _int("PPE_INFER_QUEUE_SIZE", 8)
SEND_QUEUE_SIZE:  int = _int("PPE_SEND_QUEUE_SIZE",  4)

# ── Frame skip ─────────────────────────────────────────────────────────────────
FRAME_SKIP: int = _int("PPE_FRAME_SKIP", 0)

# ── Compliance — global overlap threshold (legacy / fallback) ─────────────────
OVERLAP_THRESHOLD: float = _float("PPE_OVERLAP_THRESHOLD", 0.10)

# ── Compliance — adaptive per-PPE overlap thresholds (Req 4) ──────────────────
# Small PPE items have a lower required IoU because they often only partially
# overlap the body part even when correctly worn.
PPE_OVERLAP: dict[str, float] = {
    "helmet":       _float("PPE_OV_HELMET",       0.05),
    "hard-hat":     _float("PPE_OV_HARDHAT",      0.05),
    "hardhat":      _float("PPE_OV_HARDHAT",      0.05),
    "gloves":       _float("PPE_OV_GLOVES",       0.05),
    "glove":        _float("PPE_OV_GLOVES",       0.05),
    "boots":        _float("PPE_OV_BOOTS",        0.05),
    "boot":         _float("PPE_OV_BOOTS",        0.05),
    "shoes":        _float("PPE_OV_SHOES",        0.05),
    "glasses":      _float("PPE_OV_GLASSES",      0.03),
    "goggles":      _float("PPE_OV_GLASSES",      0.03),
    "safety-glasses": _float("PPE_OV_GLASSES",    0.03),
    "mask":         _float("PPE_OV_MASK",         0.08),
    "face-mask":    _float("PPE_OV_MASK",         0.08),
    "face_mask":    _float("PPE_OV_MASK",         0.08),
    "face-guard":   _float("PPE_OV_FACE_GUARD",   0.08),
    "face_guard":   _float("PPE_OV_FACE_GUARD",   0.08),
    "face-shield":  _float("PPE_OV_FACE_GUARD",   0.08),
    "face_shield":  _float("PPE_OV_FACE_GUARD",   0.08),
    "safety-vest":  _float("PPE_OV_VEST",         0.15),
    "safety_vest":  _float("PPE_OV_VEST",         0.15),
    "vest":         _float("PPE_OV_VEST",         0.15),
    "medical-suit": _float("PPE_OV_SUIT",         0.15),
    "medical_suit": _float("PPE_OV_SUIT",         0.15),
    "safety-suit":  _float("PPE_OV_SUIT",         0.15),
    "safety_suit":  _float("PPE_OV_SUIT",         0.15),
}

# ── Hybrid association weights (Req 1) ─────────────────────────────────────────
# score = W_DIST*norm_dist + W_IOU*iou + W_VPOS*vertical_position
ASSOC_W_DIST: float = _float("PPE_ASSOC_W_DIST", 0.50)
ASSOC_W_IOU:  float = _float("PPE_ASSOC_W_IOU",  0.30)
ASSOC_W_VPOS: float = _float("PPE_ASSOC_W_VPOS", 0.20)

# ── Temporal smoothing (Req 3) ─────────────────────────────────────────────────
# Frames a body part must be missing PPE before raising a violation
VIOLATION_FRAMES: int = _int("PPE_VIOLATION_FRAMES", 5)
# Frames PPE must be present before clearing a previously raised violation
CLEAR_FRAMES:     int = _int("PPE_CLEAR_FRAMES",     3)

# ── False-positive filters (Req 6) ────────────────────────────────────────────
# Body-part detections smaller than this fraction of frame area are ignored
MIN_BODY_PART_AREA: float = _float("PPE_MIN_BODY_PART_AREA", 0.001)

# ── Debug (Req 7) ──────────────────────────────────────────────────────────────
DEBUG_ASSOCIATION: bool = _bool("PPE_DEBUG_ASSOCIATION", False)
