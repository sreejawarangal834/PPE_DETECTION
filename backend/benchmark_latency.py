"""
Baseline inference-latency benchmark for the uploaded-video/RTSP pipeline.

Run BEFORE tuning PPE_FRAME_SKIP (config.py) so the skip interval is picked
from measured numbers instead of a guess:

    cd dashboard/backend
    source .venv/bin/activate
    python benchmark_latency.py                       # auto device, default sample video
    python benchmark_latency.py --num-frames 300 --device cpu

Mirrors the real per-frame path used by main.py's inference_worker
(main.py:1311-1376): resize to IMAGE_SIZE (_resize_keep_aspect,
main.py:276-284) then model.track(..., tracker=TRACKER_CONFIG_PATH) with the
same fallback to model.predict() as `_run_inference` (main.py:408-462) — but
implemented standalone here so it doesn't require importing all of main.py's
app/db/auth wiring just to time the model.
"""

from __future__ import annotations

import argparse
import statistics
import time
from pathlib import Path

import cv2
import numpy as np
import torch
from ultralytics import YOLO

from config import CONF_THRESHOLD, IOU_THRESHOLD, IMAGE_SIZE

BASE_DIR = Path(__file__).parent
MODEL_PATH = BASE_DIR / "models" / "best.pt"
TRACKER_CONFIG_PATH = BASE_DIR / "tracker_config.yaml"
UPLOAD_DIR = BASE_DIR / "uploads"


def _resize_keep_aspect(frame: np.ndarray, max_width: int) -> np.ndarray:
    h, w = frame.shape[:2]
    if w <= max_width:
        return frame
    scale = max_width / w
    return cv2.resize(frame, (max_width, int(h * scale)), interpolation=cv2.INTER_AREA)


def _default_video() -> Path:
    candidates = sorted(UPLOAD_DIR.glob("*.mp4"))
    if not candidates:
        raise SystemExit(f"No sample video found under {UPLOAD_DIR} — pass --video explicitly.")
    return candidates[0]


def _pick_device(requested: str) -> tuple[int | str, bool]:
    """Returns (device, fp16) matching main.py's auto-detection (main.py:78-90)."""
    if requested == "cpu":
        return "cpu", False
    if requested == "cuda":
        if not torch.cuda.is_available():
            raise SystemExit("--device cuda requested but CUDA is not available.")
        return 0, True
    if torch.cuda.is_available():
        return 0, True
    if torch.backends.mps.is_available():
        return "mps", False
    return "cpu", False


def _percentile(values: list[float], pct: float) -> float:
    return float(np.percentile(values, pct))


def _run_inference(frame: np.ndarray, model: YOLO, device, fp16: bool) -> tuple[float, float]:
    """Returns (inference_ms, postprocess_ms) for one frame, mirroring main.py:427-461."""
    common_kwargs = dict(
        conf=CONF_THRESHOLD, iou=IOU_THRESHOLD, imgsz=IMAGE_SIZE,
        device=device, half=fp16, verbose=False,
    )
    t0 = time.perf_counter()
    try:
        results = model.track(frame, persist=True, tracker=str(TRACKER_CONFIG_PATH), **common_kwargs)
    except Exception:
        results = model.predict(frame, **common_kwargs)
    infer_ms = (time.perf_counter() - t0) * 1000

    t1 = time.perf_counter()
    result = results[0]
    h, w = frame.shape[:2]
    for box in result.boxes:
        x1, y1, x2, y2 = box.xyxy[0].tolist()
        _ = (x1 / w, y1 / h, x2 / w, y2 / h)
        _ = float(box.conf[0])
        _ = int(box.cls[0])
    postprocess_ms = (time.perf_counter() - t1) * 1000
    return infer_ms, postprocess_ms


def benchmark(video_path: Path, num_frames: int, warmup: int, device_arg: str) -> dict[str, list[float]]:
    device, fp16 = _pick_device(device_arg)
    device_label = {0: "cuda", "mps": "mps", "cpu": "cpu"}[device]
    print(f"\n=== Benchmarking on device={device_label} (fp16={fp16}) ===")

    model = YOLO(str(MODEL_PATH))
    warmup_frame = np.zeros((IMAGE_SIZE, IMAGE_SIZE, 3), dtype=np.uint8)
    model.predict(warmup_frame, conf=CONF_THRESHOLD, iou=IOU_THRESHOLD, imgsz=IMAGE_SIZE,
                  device=device, half=fp16, verbose=False)

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise SystemExit(f"Could not open video: {video_path}")

    stages = {"preprocess": [], "inference": [], "postprocess": [], "total": []}
    frame_count = 0
    try:
        while frame_count < warmup + num_frames:
            ret, frame = cap.read()
            if not ret:
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                ret, frame = cap.read()
                if not ret:
                    break

            t_total0 = time.perf_counter()
            t_pre0 = time.perf_counter()
            resized = _resize_keep_aspect(frame, IMAGE_SIZE)
            pre_ms = (time.perf_counter() - t_pre0) * 1000

            infer_ms, post_ms = _run_inference(resized, model, device, fp16)
            total_ms = (time.perf_counter() - t_total0) * 1000

            frame_count += 1
            if frame_count <= warmup:
                continue
            stages["preprocess"].append(pre_ms)
            stages["inference"].append(infer_ms)
            stages["postprocess"].append(post_ms)
            stages["total"].append(total_ms)
    finally:
        cap.release()

    return stages


def format_table(stages: dict[str, list[float]], device_label: str) -> str:
    lines = [
        f"### Device: {device_label}",
        "",
        "| stage | mean_ms | median_ms | p95_ms | max_ms |",
        "|---|---|---|---|---|",
    ]
    for stage, values in stages.items():
        if not values:
            continue
        lines.append(
            f"| {stage} | {statistics.mean(values):.2f} | {statistics.median(values):.2f} | "
            f"{_percentile(values, 95):.2f} | {max(values):.2f} |"
        )
    total = stages["total"]
    if total:
        fps = 1000.0 / statistics.mean(total)
        lines.append("")
        lines.append(f"Frames measured: {len(total)} — mean end-to-end FPS: **{fps:.2f}**")
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--video", type=Path, default=None, help="Sample video (default: first file under uploads/)")
    parser.add_argument("--num-frames", type=int, default=200, help="Frames to measure (after warmup)")
    parser.add_argument("--warmup", type=int, default=10, help="Frames to discard before measuring")
    parser.add_argument("--device", choices=["auto", "cpu", "cuda"], default="auto")
    parser.add_argument("--also-cpu", action="store_true",
                         help="If --device auto resolves to cuda/mps, also run a CPU pass for comparison")
    parser.add_argument("--output", type=Path, default=BASE_DIR / "benchmark_results.md")
    args = parser.parse_args()

    video_path = args.video or _default_video()
    print(f"Sample video: {video_path}")

    sections = []
    stages = benchmark(video_path, args.num_frames, args.warmup, args.device)
    device_label = {0: "cuda", "mps": "mps", "cpu": "cpu"}[_pick_device(args.device)[0]]
    print(format_table(stages, device_label))
    sections.append(format_table(stages, device_label))

    if args.also_cpu and device_label != "cpu":
        cpu_stages = benchmark(video_path, args.num_frames, args.warmup, "cpu")
        print(format_table(cpu_stages, "cpu"))
        sections.append(format_table(cpu_stages, "cpu"))

    report = "# Inference latency benchmark\n\n" + f"Sample video: `{video_path.name}`\n\n" + "\n\n".join(sections) + "\n"
    args.output.write_text(report)
    print(f"\nSaved report to {args.output}")


if __name__ == "__main__":
    main()
