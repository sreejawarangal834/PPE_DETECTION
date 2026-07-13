"""
Backend configuration.

All values can be overridden via environment variables, e.g.:
    export PPE_CONF_THRESHOLD=0.40
    export PPE_FRAME_SKIP=2
    uvicorn main:app --reload
"""

from __future__ import annotations

import os


def _float(key: str, default: float) -> float:
    return float(os.environ.get(key, default))


def _int(key: str, default: int) -> int:
    return int(os.environ.get(key, default))


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
# 0  → infer every frame
# 1  → infer every 2nd frame (skip 1 between)
# 2  → infer every 3rd frame
FRAME_SKIP: int = _int("PPE_FRAME_SKIP", 0)
