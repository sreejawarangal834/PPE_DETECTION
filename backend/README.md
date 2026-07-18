# PPE Detection Backend

FastAPI service that accepts an uploaded video, extracts frames, runs each
frame through the trained YOLO26m PPE-detection model, and streams per-frame
detections to the frontend over a WebSocket as they're produced (no polling,
no fixed frame rate — the browser renders whatever arrives).

## Setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Model weights

`models/best.pt` (44MB) is committed directly to this repo — it originated
from the `add-yolo26m-model` branch (Git LFS there), copied in here as a
regular file since it's under GitHub's 100MB per-file limit.

## Run

```bash
uvicorn main:app --reload --port 8000 --reload-exclude 'venv/*' --reload-exclude 'uploads/*'
```

The `--reload-exclude` flags matter: without them, `--reload` watches every
`.py` file under the working directory, including everything inside `venv/`.
Ultralytics/torch occasionally touch `.py` mtimes in site-packages (e.g. on
first use of a code path), which triggers a full server restart mid-session
and drops every active WebSocket — this looks like "the backend randomly
goes offline" from the frontend.

- `GET /api/model/info` — returns the model's class names (read from the
  checkpoint itself, not hardcoded).
- `POST /api/videos/upload` — multipart video upload, returns `{video_id}`.
- `WS /ws/detect/{video_id}` — streams `{type: "frame", frameIndex, jpeg,
  detections, severity, violations}` messages, then `{type: "done"}`.

## Architecture note

Frame delivery goes through a `FrameSource` interface
([frame_source.py](frame_source.py)) with one implementation today
(`FileVideoSource`, wrapping `cv2.VideoCapture` on the uploaded file). An
RTSP source would implement the same interface and plug into the same
`/ws/detect` handler without changing the detection loop.
