from __future__ import annotations

import asyncio
import base64
import logging
import shutil
from pathlib import Path
from uuid import uuid4

import cv2
from fastapi import FastAPI, File, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO

from compliance import evaluate_compliance
from frame_source import FileVideoSource

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("ppe_backend")

BASE_DIR = Path(__file__).parent
MODEL_PATH = BASE_DIR / "models" / "best.pt"
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

app = FastAPI(title="PPE Detection Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

log.info("Loading model from %s", MODEL_PATH)
model = YOLO(str(MODEL_PATH))
log.info("Model loaded. Classes: %s", model.names)


@app.get("/api/model/info")
async def model_info():
    return {"classes": model.names}


@app.post("/api/videos/upload")
async def upload_video(file: UploadFile = File(...)):
    video_id = uuid4().hex
    suffix = Path(file.filename).suffix or ".mp4"
    dest = UPLOAD_DIR / f"{video_id}{suffix}"
    with dest.open("wb") as out:
        shutil.copyfileobj(file.file, out)
    return {"video_id": video_id}


def _find_upload(video_id: str) -> Path | None:
    matches = list(UPLOAD_DIR.glob(f"{video_id}.*"))
    return matches[0] if matches else None


@app.websocket("/ws/detect/{video_id}")
async def detect_ws(websocket: WebSocket, video_id: str):
    await websocket.accept()

    video_path = _find_upload(video_id)
    if video_path is None:
        await websocket.send_json({"type": "error", "message": f"Unknown video_id: {video_id}"})
        await websocket.close()
        return

    source = FileVideoSource(video_path)

    try:
        frame_idx = 0
        for frame in source.frames():
            results = await asyncio.to_thread(model.predict, frame, verbose=False)
            result = results[0]
            h, w = frame.shape[:2]

            detections = []
            for box in result.boxes:
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                conf = float(box.conf[0])
                cls_id = int(box.cls[0])
                detections.append(
                    {
                        "label": model.names[cls_id],
                        "conf": conf,
                        # normalized 0..1 so the frontend can scale to any canvas size
                        "box": [x1 / w, y1 / h, x2 / w, y2 / h],
                    }
                )

            severity, violations = evaluate_compliance(detections)

            ok, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
            if not ok:
                continue

            await websocket.send_json(
                {
                    "type": "frame",
                    "frameIndex": frame_idx,
                    "jpeg": base64.b64encode(buf).decode("ascii"),
                    "detections": detections,
                    "severity": severity,
                    "violations": violations,
                }
            )
            frame_idx += 1

        await websocket.send_json({"type": "done"})

    except WebSocketDisconnect:
        log.info("Client disconnected from %s", video_id)
    except Exception as exc:  # surface pipeline failures to the client instead of a silent drop
        log.exception("Detection pipeline failed for %s", video_id)
        try:
            await websocket.send_json({"type": "error", "message": str(exc)})
        except Exception:
            pass
    finally:
        try:
            await websocket.close()
        except Exception:
            pass
