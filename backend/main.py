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
from fastapi import FastAPI, File, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO

from compliance import evaluate_compliance
from frame_source import FileVideoSource
from config import (
    CONF_THRESHOLD, IOU_THRESHOLD, IMAGE_SIZE,
    JPEG_QUALITY, MAX_SEND_WIDTH,
    INFER_QUEUE_SIZE, SEND_QUEUE_SIZE, FRAME_SKIP,
)

# ─── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("ppe_backend")

# ─── CUDA / device setup ──────────────────────────────────────────────────────
_cuda_available = torch.cuda.is_available()
_device: int | str  = 0 if _cuda_available else "cpu"
_fp16:   bool       = _cuda_available

# ─── Paths ────────────────────────────────────────────────────────────────────
BASE_DIR   = Path(__file__).parent
MODEL_PATH = BASE_DIR / "models" / "best.pt"
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# ─── Load model ───────────────────────────────────────────────────────────────
log.info("──────────────────────────────────────────")
log.info("  YOLO26 Backend  — Inference Configuration")
log.info("──────────────────────────────────────────")
log.info("  Model Path   : %s", MODEL_PATH)
log.info("  CUDA Available: %s", _cuda_available)
log.info("  Device        : %s", "GPU (cuda:0)" if _cuda_available else "CPU")
log.info("  FP16 Enabled  : %s", _fp16)
log.info("  Conf Threshold: %.2f", CONF_THRESHOLD)
log.info("  IoU  Threshold: %.2f", IOU_THRESHOLD)
log.info("  Image Size    : %d", IMAGE_SIZE)
log.info("  JPEG Quality  : %d", JPEG_QUALITY)
log.info("  Frame Skip    : %d (process 1 in %d)", FRAME_SKIP, FRAME_SKIP + 1)
log.info("──────────────────────────────────────────")

model = YOLO(str(MODEL_PATH))
# Warm-up: run a blank inference so the first real frame is not slow
_warmup = np.zeros((IMAGE_SIZE, IMAGE_SIZE, 3), dtype=np.uint8)
model.predict(
    _warmup,
    conf=CONF_THRESHOLD,
    iou=IOU_THRESHOLD,
    imgsz=IMAGE_SIZE,
    device=_device,
    half=_fp16,
    verbose=False,
)
log.info("Model warm-up complete. Classes: %s", list(model.names.values())[:10])

# ─── FastAPI app ──────────────────────────────────────────────────────────────
app = FastAPI(title="PPE Detection Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
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


def _run_inference(frame: np.ndarray) -> list[dict]:
    """
    Synchronous inference — called via asyncio.to_thread so it
    doesn't block the event loop.
    """
    results = model.predict(
        frame,
        conf=CONF_THRESHOLD,
        iou=IOU_THRESHOLD,
        imgsz=IMAGE_SIZE,
        device=_device,
        half=_fp16,
        verbose=False,
    )
    result = results[0]
    h, w   = frame.shape[:2]
    detections: list[dict] = []
    for box in result.boxes:
        x1, y1, x2, y2 = box.xyxy[0].tolist()
        conf   = float(box.conf[0])
        cls_id = int(box.cls[0])
        detections.append({
            "label": model.names[cls_id],
            "conf":  conf,
            # Normalized 0..1 — frontend scales to canvas dimensions
            "box": [x1 / w, y1 / h, x2 / w, y2 / h],
        })
    return detections


# ─── API endpoints (unchanged contracts) ─────────────────────────────────────

@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "model":  MODEL_PATH.name,
        "device": "cuda" if _cuda_available else "cpu",
        "fp16":   _fp16,
    }


@app.get("/api/model/info")
async def model_info():
    return {"classes": model.names}


@app.post("/api/videos/upload")
async def upload_video(file: UploadFile = File(...)):
    if not file.filename:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="No filename provided")

    video_id = uuid4().hex
    suffix   = Path(file.filename).suffix or ".mp4"
    dest     = UPLOAD_DIR / f"{video_id}{suffix}"

    try:
        with dest.open("wb") as out:
            shutil.copyfileobj(file.file, out)
    except Exception as exc:
        log.error("Failed to save upload: %s", exc)
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail="Failed to save video")

    log.info("Uploaded %s → %s (%d bytes)", file.filename, dest.name, dest.stat().st_size)
    return {"video_id": video_id}


def _find_upload(video_id: str) -> Path | None:
    matches = list(UPLOAD_DIR.glob(f"{video_id}.*"))
    return matches[0] if matches else None


# ─── Detection WebSocket ──────────────────────────────────────────────────────

@app.websocket("/ws/detect/{video_id}")
async def detect_ws(websocket: WebSocket, video_id: str):
    await websocket.accept()
    log.info("[%s] WebSocket connected", video_id)

    video_path = _find_upload(video_id)
    if video_path is None:
        await websocket.send_json({"type": "error", "message": f"Unknown video_id: {video_id}"})
        await websocket.close()
        return

    # ── Per-session statistics ──────────────────────────────────────
    stats = {
        "frames_read":     0,
        "frames_inferred": 0,
        "frames_sent":     0,
        "frames_dropped":  0,
        "infer_times":     [],      # list of seconds
        "session_start":   time.monotonic(),
    }

    # ── Two queues decouple the three pipeline stages ───────────────
    #  reader  ──[infer_q]──▶  inference worker  ──[send_q]──▶  sender
    infer_q: asyncio.Queue = asyncio.Queue(maxsize=INFER_QUEUE_SIZE)
    send_q:  asyncio.Queue = asyncio.Queue(maxsize=SEND_QUEUE_SIZE)
    _stop   = asyncio.Event()

    # ── Stage 1: Frame reader (runs in thread, puts into infer_q) ───
    async def frame_reader() -> None:
        try:
            source = FileVideoSource(video_path)
            raw_idx = 0
            for frame in source.frames():
                if _stop.is_set():
                    break
                stats["frames_read"] += 1
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
                    stats["frames_dropped"] += 1
                    log.debug("[%s] infer_q full — frame dropped", video_id)
        except Exception as exc:
            log.error("[%s] Frame reader error: %s", video_id, exc)
        finally:
            # Sentinel to signal inference worker to stop
            await infer_q.put(None)

    # ── Stage 2: Inference worker (CPU/GPU thread, puts into send_q) ─
    async def inference_worker() -> None:
        while not _stop.is_set():
            item = await infer_q.get()
            if item is None:                        # sentinel from reader
                break
            frame_idx, frame = item
            try:
                t0 = time.monotonic()
                detections = await asyncio.to_thread(_run_inference, frame)
                infer_ms = (time.monotonic() - t0) * 1000
                stats["infer_times"].append(infer_ms)
                stats["frames_inferred"] += 1

                severity, violations = evaluate_compliance(detections)

                # Resize for WebSocket transmission (may differ from inference size)
                send_frame = _resize_keep_aspect(frame, MAX_SEND_WIDTH)
                jpeg_bytes  = _encode_jpeg(send_frame, JPEG_QUALITY)
                if jpeg_bytes is None:
                    log.warning("[%s] JPEG encode failed for frame %d", video_id, frame_idx)
                    continue

                payload = {
                    "type":       "frame",
                    "frameIndex": frame_idx,
                    "jpeg":       base64.b64encode(jpeg_bytes).decode("ascii"),
                    "detections": detections,
                    "severity":   severity,
                    "violations": violations,
                }
                try:
                    send_q.put_nowait(payload)
                except asyncio.QueueFull:
                    stats["frames_dropped"] += 1
                    log.debug("[%s] send_q full — frame dropped", video_id)

            except Exception as exc:
                log.exception("[%s] Inference error on frame %d: %s", video_id, frame_idx, exc)
        # Sentinel to signal sender to stop
        await send_q.put(None)

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
                log.info("[%s] Client disconnected during send", video_id)
                _stop.set()
                break
            except Exception as exc:
                log.error("[%s] Send error: %s", video_id, exc)
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
        log.info("[%s] WebSocket disconnected", video_id)
        _stop.set()
    except Exception as exc:
        log.exception("[%s] Pipeline error: %s", video_id, exc)
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
            video_id,
            stats["frames_read"],
            stats["frames_inferred"],
            stats["frames_sent"],
            stats["frames_dropped"],
            avg_fps,
            avg_infer,
            q_util,
            f"1/{FRAME_SKIP+1}" if FRAME_SKIP > 0 else "off",
        )
