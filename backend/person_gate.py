"""
Lightweight person-presence gate — runs before the main PPE model so a
frame with nobody in it never pays for a full model.track()/predict()
call (or, when PPE_FACE_DETECT_ENABLED, the face pipeline either).

Uses a small COCO-pretrained YOLO (PERSON_GATE_MODEL, default yolo11n.pt,
Ultralytics auto-downloads it on first use — consistent with every other
model weight in this repo being gitignored and fetched out-of-band, see
reid/osnet.py's docstring) at a reduced resolution, filtered to the COCO
`person` class only, tuned for high recall: a missed person wrongly skips
real PPE inference (worse), a false-positive gate pass just costs one
wasted full-inference call (cheap).

Thread-safety: unlike the SCRFD/ArcFace `onnxruntime.InferenceSession`
in face/model_loader.py (safe to share across threads — that's ONNX
Runtime's own concurrency model), a plain Ultralytics YOLO instance is
NOT safe to share across threads even without persist=True tracking:
`ultralytics/engine/model.py` lazily caches `self.predictor` directly on
the model instance on first `.predict()` call, unguarded, so concurrent
first-calls from multiple `asyncio.to_thread` workers can race on that
assignment. A threading.local()-cached instance per worker thread avoids
that race without serializing every session behind one shared lock.
"""

from __future__ import annotations

import logging
import threading

import numpy as np
from ultralytics import YOLO

import config

log = logging.getLogger("ppe_backend.person_gate")

_COCO_PERSON_CLASS = 0

Box = tuple[float, float, float, float]  # pixel-space x1, y1, x2, y2 — same convention as motion_gate.py

_thread_local = threading.local()


def _get_thread_model() -> YOLO:
    model = getattr(_thread_local, "model", None)
    if model is None:
        model = YOLO(config.PERSON_GATE_MODEL)
        warmup = np.zeros((config.PERSON_GATE_IMAGE_SIZE, config.PERSON_GATE_IMAGE_SIZE, 3), dtype=np.uint8)
        model.predict(warmup, classes=[_COCO_PERSON_CLASS], imgsz=config.PERSON_GATE_IMAGE_SIZE, verbose=False)
        _thread_local.model = model
        log.info("person_gate_model_loaded thread=%s model=%s", threading.get_ident(), config.PERSON_GATE_MODEL)
    return model


def detect_persons(frame: np.ndarray) -> list[Box] | None:
    """Synchronous — call via asyncio.to_thread, same as the main model's own
    inference call. Returns the candidate person boxes (pixel-space, in this
    frame's own coordinates) for the motion-detection stage to check.

    Tri-state return, deliberately not just a bool:
      None       -> the gate itself failed; caller must fail open (treat as
                    "a person might be here, don't skip").
      []         -> genuinely no person found.
      non-empty  -> candidate boxes for motion_gate.should_run_inference().
    """
    try:
        model = _get_thread_model()
        result = model.predict(
            frame,
            classes=[_COCO_PERSON_CLASS],
            conf=config.PERSON_GATE_CONF_THRESHOLD,
            imgsz=config.PERSON_GATE_IMAGE_SIZE,
            verbose=False,
        )[0]
        if result.boxes is None:
            return []
        return [tuple(box.xyxy[0].tolist()) for box in result.boxes]
    except Exception:
        log.exception("person_gate_failed — defaulting to detect_persons=None (fail open)")
        return None


def has_person(frame: np.ndarray) -> bool:
    """Convenience wrapper for callers that don't need the motion-detection
    stage (e.g. face_ready/tests) — True (never skip) on any internal
    failure, since a broken gate must never silently disable real PPE
    detection."""
    boxes = detect_persons(frame)
    return boxes is None or len(boxes) > 0
