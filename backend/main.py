"""
PPE Detection Backend — optimized inference pipeline.

Changes over the original (API contracts unchanged):
- CUDA auto-detection with FP16 on GPU, CPU fallback
- Configurable CONF/IOU/IMAGE_SIZE thresholds
- Async producer→queue→consumer pipeline
  (inference never waits for WebSocket transmission)
- Frame resize before inference and before JPEG encode
- Configurable frame-skip (infer every N frames)
- Structured startup logging
- Graceful queue overflow, decode-failure, and disconnect handling
- Per-session FPS / inference-time / dropped-frame statistics
"""

from __future__ import annotations

import asyncio
import base64
import logging
import shutil
import time
from pathlib import Path
from typing import Optional
from uuid import uuid4

import cv2
import numpy as np
import torch
from fastapi import FastAPI, File, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO

from compliance import evaluate_compliance, new_session_state, _iou, Box
from frame_source import FileVideoSource
from config import (
    CONF_THRESHOLD, IOU_THRESHOLD, IMAGE_SIZE,
    JPEG_QUALITY, MAX_SEND_WIDTH,
    INFER_QUEUE_SIZE, SEND_QUEUE_SIZE, FRAME_SKIP,
    OVERLAP_THRESHOLD, LOOP_VIDEO,
    PACE_TO_SOURCE_FPS, FALLBACK_FPS,
    GHOST_GRACE_SECONDS, GHOST_SUPPRESS_IOU,
)

# ─── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("ppe_backend")

# ─── Device setup — CUDA, then Apple Silicon MPS, then CPU fallback ───────────
_cuda_available = torch.cuda.is_available()
_mps_available   = torch.backends.mps.is_available()

if _cuda_available:
    _device: int | str = 0
    _fp16:   bool       = True
elif _mps_available:
    _device = "mps"
    _fp16   = False  # MPS half-precision coverage is inconsistent across ops; fp32 stays correct
else:
    _device = "cpu"
    _fp16   = False

# ─── Paths ────────────────────────────────────────────────────────────────────
BASE_DIR   = Path(__file__).parent
MODEL_PATH = BASE_DIR / "models" / "best.pt"
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
TRACKER_CONFIG_PATH = BASE_DIR / "tracker_config.yaml"

# ─── Load model ───────────────────────────────────────────────────────────────
log.info("──────────────────────────────────────────")
log.info("  YOLO26 Backend  — Inference Configuration")
log.info("──────────────────────────────────────────")
log.info("  Model Path   : %s", MODEL_PATH)
log.info("  CUDA Available: %s", _cuda_available)
log.info("  MPS  Available: %s", _mps_available)
log.info("  Device        : %s", {0: "GPU (cuda:0)", "mps": "Apple Silicon GPU (mps)", "cpu": "CPU"}[_device])
log.info("  FP16 Enabled  : %s", _fp16)
log.info("  Conf Threshold: %.2f", CONF_THRESHOLD)
log.info("  IoU  Threshold: %.2f", IOU_THRESHOLD)
log.info("  Overlap Thresh: %.2f", OVERLAP_THRESHOLD)
log.info("  Image Size    : %d", IMAGE_SIZE)
log.info("  JPEG Quality  : %d", JPEG_QUALITY)
log.info("  Frame Skip    : %d (process 1 in %d)", FRAME_SKIP, FRAME_SKIP + 1)
log.info("──────────────────────────────────────────")

def _new_model() -> YOLO:
    """
    Create and warm up a fresh, session-isolated model instance.

    Every concurrent session (video upload or webcam) gets its own YOLO
    instance rather than sharing one global model. Ultralytics' persistent
    tracker (model.track(persist=True)) keeps ByteTrack state on the
    model/predictor object itself — two sessions sharing one model would
    silently corrupt each other's tracker IDs (and therefore the compliance
    engine's per-worker temporal state) the moment they run concurrently.
    """
    m = YOLO(str(MODEL_PATH))
    warmup = np.zeros((IMAGE_SIZE, IMAGE_SIZE, 3), dtype=np.uint8)
    m.predict(
        warmup,
        conf=CONF_THRESHOLD,
        iou=IOU_THRESHOLD,
        imgsz=IMAGE_SIZE,
        device=_device,
        half=_fp16,
        verbose=False,
    )
    return m


def _release_model(model: YOLO) -> None:
    """Drop a session's model and free its accelerator memory promptly."""
    del model
    if _device == "mps":
        try:
            torch.mps.empty_cache()
        except Exception:
            pass
    elif _device == 0:
        try:
            torch.cuda.empty_cache()
        except Exception:
            pass


# One shared, inference-idle model — used only for class-name metadata
# (/api/model/info). Never used for prediction, so it can't race with the
# per-session models each WebSocket connection creates for itself.
_names_model = _new_model()
log.info("Model loaded. Classes: %s", list(_names_model.names.values())[:10])

# ─── FastAPI app ──────────────────────────────────────────────────────────────
app = FastAPI(title="PPE Detection Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Helper utilities ─────────────────────────────────────────────────────────

def _resize_keep_aspect(frame: np.ndarray, max_width: int) -> np.ndarray:
    """Resize frame so width ≤ max_width, preserving aspect ratio."""
    h, w = frame.shape[:2]
    if w <= max_width:
        return frame
    scale = max_width / w
    new_w = max_width
    new_h = int(h * scale)
    return cv2.resize(frame, (new_w, new_h), interpolation=cv2.INTER_AREA)


def _encode_jpeg(frame: np.ndarray, quality: int = JPEG_QUALITY) -> Optional[bytes]:
    ok, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, quality])
    return bytes(buf) if ok else None


def _strip_internal(detections: list[dict]) -> list[dict]:
    """Strip internal-only fields (e.g. _track_id) before sending detections to the frontend."""
    return [
        {k: v for k, v in d.items() if not k.startswith("_")}
        for d in detections
    ]


GhostCache = dict[int, dict]


def _new_ghost_cache() -> GhostCache:
    """Call once per session (parallel to new_session_state()) for a fresh, isolated ghost cache."""
    return {}


def _apply_ghost_boxes(detections: list[dict], ghost_cache: GhostCache, now: float) -> list[dict]:
    """
    Rendering/identity-continuity layer ONLY — must run AFTER evaluate_compliance()
    and BEFORE _strip_internal(). Ghost output must never be fed back into
    evaluate_compliance(); a synthesized box is not real evidence.

    When a tracked PERSON produces zero detections for a stretch (e.g. poor
    lighting), this keeps their last-known box rendering for up to
    GHOST_GRACE_SECONDS instead of it vanishing instantly, so their tracker
    ID also has a chance to be re-associated by ByteTrack when they reappear
    rather than silently starting a brand-new (empty) compliance history.

    Scoped to `label == "person"` only — every detected class gets its own
    _track_id (helmet, gloves, vest, ...), and ghosting each independently
    would flicker a disembodied PPE-item box any time its own track blips,
    even while the wearer is plainly, continuously visible. Only the
    person's own box persists through a gap.

    Also suppressed if a REAL person detection this frame already overlaps
    the ghost's cached position (IoU >= GHOST_SUPPRESS_IOU) — that means the
    person is visibly present, just possibly under a new tracker ID after a
    ByteTrack ID switch, so there's no gap to bridge and no ghost should render.
    """
    seen_ids: set[int] = set()
    real_person_boxes: list[Box] = []
    for d in detections:
        tid = d.get("_track_id")
        if tid is not None:
            seen_ids.add(tid)
        if d["label"] != "person":
            continue
        real_person_boxes.append(tuple(d["box"]))
        if tid is not None:
            ghost_cache[tid] = {
                "label":     d["label"],
                "conf":      d["conf"],
                "box":       d["box"],
                "compliant": d.get("compliant", True),
                "last_seen": now,
            }

    ghosts: list[dict] = []
    expired: list[int] = []
    for tid, cached in ghost_cache.items():
        if tid in seen_ids:
            continue  # a real detection covered this track id this frame
        if now - cached["last_seen"] > GHOST_GRACE_SECONDS:
            expired.append(tid)
            continue
        cached_box: Box = tuple(cached["box"])
        if any(_iou(cached_box, rb) >= GHOST_SUPPRESS_IOU for rb in real_person_boxes):
            continue  # person is visibly present (likely under a new id) — no ghost needed
        ghosts.append({
            "label":     cached["label"],
            "conf":      cached["conf"],
            "box":       cached["box"],
            "compliant": cached["compliant"],
            "ghost":     True,   # not underscore-prefixed -> survives _strip_internal
            "_track_id": tid,    # internal-only, stripped like every other detection
        })
    for tid in expired:
        del ghost_cache[tid]

    return detections + ghosts


def _put_sentinel(queue: "asyncio.Queue") -> None:
    """
    Push a None shutdown-sentinel without ever blocking.

    A blocking `await queue.put(None)` deadlocks the whole pipeline if the
    queue is already full and its consumer has already exited (e.g. the
    client disconnected mid-stream, ws_sender stopped draining send_q, but
    inference_worker is still finishing its backlog and then needs to signal
    shutdown into a full queue nobody's reading from anymore). Drop the
    oldest item to make room instead — the pipeline is shutting down, so
    what was queued no longer matters.
    """
    try:
        queue.put_nowait(None)
    except asyncio.QueueFull:
        try:
            queue.get_nowait()
        except asyncio.QueueEmpty:
            pass
        try:
            queue.put_nowait(None)
        except asyncio.QueueFull:
            pass


def _run_inference(frame: np.ndarray, model: YOLO) -> list[dict]:
    """
    Synchronous tracking + inference — called via asyncio.to_thread.

    `model` is this session's own isolated YOLO instance (see _new_model) —
    persistent ByteTrack state lives on it safely since no other session
    ever touches the same instance.
    Tracker IDs are collected internally but NOT sent to the frontend
    (contract unchanged — only `compliant` is new in each detection).
    """
    common_kwargs = dict(
        conf=CONF_THRESHOLD,
        iou=IOU_THRESHOLD,
        imgsz=IMAGE_SIZE,
        device=_device,
        half=_fp16,
        verbose=False,
    )

    try:
        # model.track() with persist=True maintains object IDs across frames
        results = model.track(
            frame,
            persist=True,
            tracker=str(TRACKER_CONFIG_PATH),   # ByteTrack — reduces flicker
            **common_kwargs,
        )
    except Exception as track_exc:
        # Graceful fallback: if tracker isn't available, use predict
        log.debug("model.track() failed (%s), falling back to predict", track_exc)
        results = model.predict(frame, **common_kwargs)

    result = results[0]
    h, w   = frame.shape[:2]
    detections: list[dict] = []
    for box in result.boxes:
        x1, y1, x2, y2 = box.xyxy[0].tolist()
        conf   = float(box.conf[0])
        cls_id = int(box.cls[0])
        # Extract tracker ID if available (model.track sets box.id)
        track_id: int | None = None
        if hasattr(box, "id") and box.id is not None:
            try:
                track_id = int(box.id[0])
            except (TypeError, IndexError):
                track_id = None
        detections.append({
            "label":      model.names[cls_id],
            "conf":       conf,
            # Normalised 0..1 — frontend scales to canvas dimensions
            "box":        [x1 / w, y1 / h, x2 / w, y2 / h],
            # Internal tracker ID — used by compliance engine, NOT sent to frontend
            "_track_id":  track_id,
        })
    return detections


# ─── API endpoints (unchanged contracts) ─────────────────────────────────────

@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "model":  MODEL_PATH.name,
        "device": "cuda" if _cuda_available else ("mps" if _mps_available else "cpu"),
        "fp16":   _fp16,
    }


@app.get("/api/model/info")
async def model_info():
    return {"classes": _names_model.names}


@app.post("/api/videos/upload")
async def upload_video(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    video_id = uuid4().hex
    suffix   = Path(file.filename).suffix or ".mp4"
    dest     = UPLOAD_DIR / f"{video_id}{suffix}"

    try:
        with dest.open("wb") as out:
            shutil.copyfileobj(file.file, out)
    except Exception as exc:
        log.error("Failed to save upload: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to save video")

    log.info("Uploaded %s → %s (%d bytes)", file.filename, dest.name, dest.stat().st_size)
    return {"video_id": video_id}


def _find_upload(video_id: str) -> Path | None:
    matches = list(UPLOAD_DIR.glob(f"{video_id}.*"))
    return matches[0] if matches else None


# ─── Detection WebSocket ──────────────────────────────────────────────────────
# NOTE: /ws/detect/live must be registered before /ws/detect/{video_id} —
# Starlette matches routes in registration order, and the parameterized route
# would otherwise swallow "live" as a video_id and 404 it.

@app.websocket("/ws/detect/live")
async def detect_live_ws(websocket: WebSocket):
    """
    Browser-pushed camera frames — the client owns the webcam (getUserMedia)
    and sends one JPEG per message; we decode, infer, and reply with
    detections only (the client already has the frame on-screen).
    """
    await websocket.accept()
    session_id = f"live-{uuid4().hex[:8]}"
    log.info("[%s] WebSocket connected (browser-pushed frames)", session_id)

    # Isolated model + compliance state — safe to run alongside any number
    # of other concurrent video/webcam sessions (see _new_model docstring).
    model = await asyncio.to_thread(_new_model)
    worker_states = new_session_state()
    ghost_cache   = _new_ghost_cache()
    frame_idx = 0
    closed = False
    session_start = time.monotonic()
    infer_times: list[float] = []

    try:
        while True:
            data = await websocket.receive_bytes()
            arr = np.frombuffer(data, dtype=np.uint8)
            frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            if frame is None:
                continue

            resized = _resize_keep_aspect(frame, IMAGE_SIZE)
            t0 = time.monotonic()
            detections = await asyncio.to_thread(_run_inference, resized, model)
            infer_times.append((time.monotonic() - t0) * 1000)
            now = time.monotonic()
            severity, violations = evaluate_compliance(detections, worker_states, now)
            detections = _apply_ghost_boxes(detections, ghost_cache, now)
            public_detections = _strip_internal(detections)

            try:
                await websocket.send_json({
                    "type":       "frame",
                    "frameIndex": frame_idx,
                    "detections": public_detections,
                    "severity":   severity,
                    "violations": violations,
                })
            except (WebSocketDisconnect, RuntimeError):
                # Client disconnected while this frame was mid-inference —
                # the socket may already be closed; stop quietly.
                closed = True
                break
            frame_idx += 1
    except WebSocketDisconnect:
        log.info("[%s] WebSocket disconnected", session_id)
    except Exception as exc:
        log.exception("[%s] Live pipeline error: %s", session_id, exc)
        try:
            await websocket.send_json({"type": "error", "message": str(exc)})
        except Exception:
            pass
    finally:
        if not closed:
            try:
                await websocket.close()
            except Exception:
                pass
        _release_model(model)

        elapsed   = max(time.monotonic() - session_start, 0.001)
        avg_fps   = frame_idx / elapsed
        avg_infer = sum(infer_times) / len(infer_times) if infer_times else 0.0
        log.info(
            "[%s] Session complete — frames=%d  avg_fps=%.1f  avg_infer=%.1fms",
            session_id, frame_idx, avg_fps, avg_infer,
        )


@app.websocket("/ws/detect/{video_id}")
async def detect_ws(websocket: WebSocket, video_id: str):
    await websocket.accept()
    log.info("[%s] WebSocket connected", video_id)

    video_path = _find_upload(video_id)
    if video_path is None:
        await websocket.send_json({"type": "error", "message": f"Unknown video_id: {video_id}"})
        await websocket.close()
        return

    await _run_detection_session(
        websocket, video_id, FileVideoSource(video_path, loop=LOOP_VIDEO)
    )


async def _run_detection_session(websocket: WebSocket, session_id: str, source: FileVideoSource) -> None:
    # ── Per-session statistics ──────────────────────────────────────
    stats = {
        "frames_read":     0,
        "frames_inferred": 0,
        "frames_sent":     0,
        "frames_dropped":  0,
        "infer_times":     [],
        "session_start":   time.monotonic(),
    }

    # ── Isolated model + compliance state for this session ───────────
    # Safe to run alongside any number of other concurrent sessions —
    # see _new_model()'s docstring for why sharing one model is unsafe.
    model = await asyncio.to_thread(_new_model)
    worker_states = new_session_state()
    ghost_cache   = _new_ghost_cache()

    # Reset ByteTrack + compliance hysteresis state at each loop restart so a
    # track ID alive near the end of the video can't silently merge with a new
    # detection at the replayed start. `predictor = None` forces Ultralytics to
    # rebuild just the predictor/tracker on the next .track() call — no weight
    # reload, unlike _new_model(). A lingering ghost box must not carry across
    # the loop seam either, so its cache resets here too.
    def _on_loop_restart() -> None:
        nonlocal worker_states, ghost_cache
        model.predictor = None
        worker_states = new_session_state()
        ghost_cache   = _new_ghost_cache()
    source.on_loop = _on_loop_restart

    # ── Two queues decouple the three pipeline stages ───────────────
    #  reader  ──[infer_q]──▶  inference worker  ──[send_q]──▶  sender
    infer_q: asyncio.Queue = asyncio.Queue(maxsize=INFER_QUEUE_SIZE)
    send_q:  asyncio.Queue = asyncio.Queue(maxsize=SEND_QUEUE_SIZE)
    _stop   = asyncio.Event()

    # ── Stage 1: Frame reader (puts into infer_q) ────────────────────
    async def frame_reader() -> None:
        try:
            raw_idx = 0
            next_frame_time = time.monotonic()
            for frame in source.frames():
                if _stop.is_set():
                    break
                stats["frames_read"] += 1

                # Pace decode to the source video's real FPS so playback speed
                # matches the recording instead of running as fast as
                # decode+inference allow. This `await` doubles as the
                # per-frame event-loop yield — `for frame in source.frames()`
                # never awaits internally (cv2.VideoCapture.read() is a
                # blocking C call), so without it the reader would monopolize
                # the event loop for the whole video's decode time, starving
                # the inference worker, the WebSocket sender, every other
                # concurrent session, and even unrelated requests like
                # /api/health. asyncio.sleep always yields once even with a
                # 0/negative delay, so this holds whether or not pacing (the
                # `if` below) is enabled.
                if PACE_TO_SOURCE_FPS:
                    fps = source.fps if source.fps and source.fps > 0 else FALLBACK_FPS
                    frame_interval = 1.0 / fps
                    await asyncio.sleep(max(0.0, next_frame_time - time.monotonic()))
                    next_frame_time = max(time.monotonic(), next_frame_time) + frame_interval
                else:
                    await asyncio.sleep(0)

                # Frame-skip: only infer every (FRAME_SKIP+1)-th frame
                if FRAME_SKIP > 0 and (raw_idx % (FRAME_SKIP + 1) != 0):
                    raw_idx += 1
                    continue
                raw_idx += 1
                # Resize for inference
                resized = _resize_keep_aspect(frame, IMAGE_SIZE)
                try:
                    infer_q.put_nowait((stats["frames_inferred"], resized))
                except asyncio.QueueFull:
                    # Queue is full because inference can't keep up with
                    # decode speed — drop the OLDEST queued frame instead of
                    # the new one, so the inference worker tracks roughly
                    # where the video currently is instead of getting stuck
                    # replaying only the first few seconds while the reader
                    # silently races ahead to EOF in the background.
                    try:
                        infer_q.get_nowait()
                    except asyncio.QueueEmpty:
                        pass
                    infer_q.put_nowait((stats["frames_inferred"], resized))
                    stats["frames_dropped"] += 1
                    log.debug("[%s] infer_q full — dropped oldest queued frame", session_id)
        except Exception as exc:
            log.error("[%s] Frame reader error: %s", session_id, exc)
        finally:
            # Sentinel to signal inference worker to stop
            _put_sentinel(infer_q)

    # ── Stage 2: Inference worker (CPU/GPU thread, puts into send_q) ─
    async def inference_worker() -> None:
        while not _stop.is_set():
            item = await infer_q.get()
            if item is None:                        # sentinel from reader
                break
            frame_idx, frame = item
            try:
                t0 = time.monotonic()
                detections = await asyncio.to_thread(_run_inference, frame, model)
                infer_ms = (time.monotonic() - t0) * 1000
                stats["infer_times"].append(infer_ms)
                stats["frames_inferred"] += 1

                now = time.monotonic()
                severity, violations = evaluate_compliance(detections, worker_states, now)
                detections = _apply_ghost_boxes(detections, ghost_cache, now)
                public_detections = _strip_internal(detections)

                # Resize for WebSocket transmission (may differ from inference size)
                send_frame = _resize_keep_aspect(frame, MAX_SEND_WIDTH)
                jpeg_bytes  = _encode_jpeg(send_frame, JPEG_QUALITY)
                if jpeg_bytes is None:
                    log.warning("[%s] JPEG encode failed for frame %d", session_id, frame_idx)
                    continue

                payload = {
                    "type":       "frame",
                    "frameIndex": frame_idx,
                    "jpeg":       base64.b64encode(jpeg_bytes).decode("ascii"),
                    "detections": public_detections,
                    "severity":   severity,
                    "violations": violations,
                }
                try:
                    send_q.put_nowait(payload)
                except asyncio.QueueFull:
                    stats["frames_dropped"] += 1
                    log.debug("[%s] send_q full — frame dropped", session_id)

            except Exception as exc:
                log.exception("[%s] Inference error on frame %d: %s", session_id, frame_idx, exc)
        # Sentinel to signal sender to stop
        _put_sentinel(send_q)

    # ── Stage 3: WebSocket sender (async, reads from send_q) ─────────
    async def ws_sender() -> None:
        while not _stop.is_set():
            item = await send_q.get()
            if item is None:                        # sentinel from inference worker
                break
            try:
                await websocket.send_json(item)
                stats["frames_sent"] += 1
            except (WebSocketDisconnect, RuntimeError):
                log.info("[%s] Client disconnected during send", session_id)
                _stop.set()
                break
            except Exception as exc:
                log.error("[%s] Send error: %s", session_id, exc)
                _stop.set()
                break

    # ── Run all three stages concurrently ────────────────────────────
    try:
        await asyncio.gather(
            frame_reader(),
            inference_worker(),
            ws_sender(),
        )
        # Stream finished cleanly — notify client
        if not _stop.is_set():
            try:
                await websocket.send_json({"type": "done"})
            except Exception:
                pass

    except WebSocketDisconnect:
        log.info("[%s] WebSocket disconnected", session_id)
        _stop.set()
    except Exception as exc:
        log.exception("[%s] Pipeline error: %s", session_id, exc)
        _stop.set()
        try:
            await websocket.send_json({"type": "error", "message": str(exc)})
        except Exception:
            pass
    finally:
        _stop.set()
        try:
            await websocket.close()
        except Exception:
            pass
        _release_model(model)
        try:
            source.path.unlink(missing_ok=True)
        except Exception as exc:
            log.warning("[%s] Failed to delete uploaded file %s: %s", session_id, source.path, exc)

        # ── Session statistics ─────────────────────────────────────
        elapsed   = max(time.monotonic() - stats["session_start"], 0.001)
        avg_fps   = stats["frames_sent"] / elapsed
        avg_infer = (
            sum(stats["infer_times"]) / len(stats["infer_times"])
            if stats["infer_times"] else 0.0
        )
        q_util = (
            stats["frames_inferred"] / max(stats["frames_read"], 1) * 100
        )
        log.info(
            "[%s] Session complete — "
            "read=%d  inferred=%d  sent=%d  dropped=%d  "
            "avg_fps=%.1f  avg_infer=%.1fms  q_util=%.0f%%  "
            "frame_skip=%s",
            session_id,
            stats["frames_read"],
            stats["frames_inferred"],
            stats["frames_sent"],
            stats["frames_dropped"],
            avg_fps,
            avg_infer,
            q_util,
            f"1/{FRAME_SKIP+1}" if FRAME_SKIP > 0 else "off",
        )
