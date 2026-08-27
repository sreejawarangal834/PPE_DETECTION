"""
Backend configuration — all values overridable via environment variables.

    export PPE_CONF_THRESHOLD=0.40
    export PPE_VIOLATION_WINDOW_SECONDS=2.0
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
IMAGE_SIZE:     int   = _int("PPE_IMAGE_SIZE",        640)

# ── Streaming ──────────────────────────────────────────────────────────────────
JPEG_QUALITY:   int = _int("PPE_JPEG_QUALITY",   75)
MAX_SEND_WIDTH: int = _int("PPE_MAX_SEND_WIDTH", 960)

# ── Pipeline queues ────────────────────────────────────────────────────────────
INFER_QUEUE_SIZE: int = _int("PPE_INFER_QUEUE_SIZE", 8)
SEND_QUEUE_SIZE:  int = _int("PPE_SEND_QUEUE_SIZE",  4)

# ── Frame skip ─────────────────────────────────────────────────────────────────
FRAME_SKIP: int = _int("PPE_FRAME_SKIP", 0)

# ── Uploaded-video playback ────────────────────────────────────────────────────
LOOP_VIDEO: bool = _bool("PPE_LOOP_VIDEO", True)
PACE_TO_SOURCE_FPS: bool = _bool("PPE_PACE_TO_SOURCE_FPS", True)
FALLBACK_FPS: float = _float("PPE_FALLBACK_FPS", 25.0)

# ── RTSP live sources (phone/IP cameras) ───────────────────────────────────────
# Seconds to wait before retrying a dropped/failed RTSP connection — phone
# RTSP-server apps commonly drop the stream on screen lock or app switch.
RTSP_RECONNECT_DELAY_SECONDS: float = _float("PPE_RTSP_RECONNECT_DELAY_SECONDS", 2.0)
# 0 = retry forever (the session only ends when the client disconnects the
# WebSocket or DELETE's it — matches "a camera should keep trying").
_rtsp_max_attempts = _int("PPE_RTSP_MAX_RECONNECT_ATTEMPTS", 0)
RTSP_MAX_RECONNECT_ATTEMPTS: int | None = _rtsp_max_attempts or None

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

# ── Temporal smoothing (Req 3) — duration-based, not frame-count-based ────────
# Real-time window (seconds) of recent history used to judge sustained
# non-compliance, so the decision doesn't depend on how many frames were
# actually inferred (FRAME_SKIP, GPU load, and queue drops all vary that).
VIOLATION_WINDOW_SECONDS: float = _float("PPE_VIOLATION_WINDOW_SECONDS", 3.0)
# Fraction of the window's time that must be "missing" to RAISE a violation.
VIOLATION_RAISE_FRACTION: float = _float("PPE_VIOLATION_RAISE_FRACTION", 0.6)
# Fraction of the window's time that must be "missing" (or below) to CLEAR
# an already-raised violation. Must stay below VIOLATION_RAISE_FRACTION —
# the gap between the two is a Schmitt-trigger band that stops chattering.
VIOLATION_CLEAR_FRACTION: float = _float("PPE_VIOLATION_CLEAR_FRACTION", 0.3)
# Minimum real seconds of observation for a given worker+part before ANY
# raise/clear decision is allowed — guards cold starts / sparse sampling.
MIN_EVIDENCE_SECONDS: float = _float("PPE_MIN_EVIDENCE_SECONDS", 1.0)
# Minimum sample count for a given worker+part before ANY raise/clear
# decision is allowed (secondary guard alongside MIN_EVIDENCE_SECONDS).
MIN_EVIDENCE_SAMPLES: int = _int("PPE_MIN_EVIDENCE_SAMPLES", 2)
# Cap on any single inter-sample gap's contribution to the window's time
# integral, so one stall/drop/pause can't dominate or instantly flip state.
MAX_SAMPLE_GAP_SECONDS: float = _float("PPE_MAX_SAMPLE_GAP_SECONDS", 2.0)

# ── Ghost boxes — rendering/identity continuity through brief detection loss ──
# How long (seconds) a track's last-known box keeps rendering after it stops
# being really detected, before its ghost cache entry expires. Purely a
# rendering-continuity knob — never fed into compliance evidence. Matches
# MAX_SAMPLE_GAP_SECONDS's default so compliance's gap-bridging and the UI's
# gap-bridging tell a consistent story.
GHOST_GRACE_SECONDS: float = _float("PPE_GHOST_GRACE_SECONDS", 2.0)
# Ghosting is scoped to person-class detections only (see _apply_ghost_boxes).
# If a REAL person detection this frame overlaps a ghost's cached box by at
# least this much IoU, the person is visibly present — suppress the ghost
# instead of rendering a stale box alongside a fresh one for the same person
# (can happen when ByteTrack reassigns a new tracker ID mid-stream).
GHOST_SUPPRESS_IOU: float = _float("PPE_GHOST_SUPPRESS_IOU", 0.3)

# ── False-positive filters (Req 6) ────────────────────────────────────────────
# Body-part detections smaller than this fraction of frame area are ignored
MIN_BODY_PART_AREA: float = _float("PPE_MIN_BODY_PART_AREA", 0.001)

# ── Debug (Req 7) ──────────────────────────────────────────────────────────────
DEBUG_ASSOCIATION: bool = _bool("PPE_DEBUG_ASSOCIATION", False)

# ── Postgres persistence (compliance pipeline) ─────────────────────────────────
DATABASE_URL: str = os.environ.get(
    "PPE_DATABASE_URL", "postgresql://ppe:ppe@localhost:5432/ppe_compliance",
)
# Bounded queue between the request/inference event-loop callers and the single
# DB writer task (see repositories/writer.py) — sized generously since a DB
# stall should degrade to dropped events, not backpressure on inference.
DB_WRITE_QUEUE_SIZE: int = _int("PPE_DB_WRITE_QUEUE_SIZE", 2000)

# ── Auth (Phase 4) ──────────────────────────────────────────────────────────────
JWT_SECRET: str = os.environ.get("PPE_JWT_SECRET", "dev-only-insecure-secret-change-me")
JWT_ACCESS_TTL_SECONDS: int = _int("PPE_JWT_ACCESS_TTL_SECONDS", 15 * 60)
JWT_REFRESH_TTL_SECONDS: int = _int("PPE_JWT_REFRESH_TTL_SECONDS", 7 * 24 * 3600)
ADMIN_BOOTSTRAP_EMAIL: str = os.environ.get("PPE_ADMIN_BOOTSTRAP_EMAIL", "admin@innovision.com")
ADMIN_BOOTSTRAP_PASSWORD: str | None = os.environ.get("PPE_ADMIN_BOOTSTRAP_PASSWORD")

# ── SMTP (Phase 4) ───────────────────────────────────────────────────────────────
# Defaults target MailHog (no auth, no TLS). Real delivery (e.g. Gmail) needs
# PPE_SMTP_HOST=smtp.gmail.com, PPE_SMTP_PORT=587, PPE_SMTP_USE_TLS=true, plus a
# username + an app password (not the account password — Gmail requires 2FA +
# an app-specific password from myaccount.google.com/apppasswords).
SMTP_HOST: str = os.environ.get("PPE_SMTP_HOST", "localhost")
SMTP_PORT: int = _int("PPE_SMTP_PORT", 1025)
SMTP_FROM: str = os.environ.get("PPE_SMTP_FROM", "alerts@ppe-compliance.local")
SMTP_USERNAME: str | None = os.environ.get("PPE_SMTP_USERNAME")
SMTP_PASSWORD: str | None = os.environ.get("PPE_SMTP_PASSWORD")
SMTP_USE_TLS: bool = _bool("PPE_SMTP_USE_TLS", False)
# The docstring in notifications/notifier.py already documented this as
# env-configurable; the code just never read the env var. Fixed here.
NOTIFY_EMAIL_TO: str = os.environ.get("PPE_NOTIFY_EMAIL_TO", "safety-team@ppe-compliance.local")

# ── Password reset (fake-frontend audit — replaces the dead-end Forgot/Reset password forms) ──
PASSWORD_RESET_TTL_SECONDS: int = _int("PPE_PASSWORD_RESET_TTL_SECONDS", 30 * 60)
FRONTEND_BASE_URL: str = os.environ.get("PPE_FRONTEND_BASE_URL", "http://localhost:5173")
