"""
extract_frames.py

Extracts frames from the Construction Activity Recognition video dataset
(Kaggle: ehsaanali/construction-activity-recognition-dataset) at a fixed
frame interval, preserving the activity/video folder structure.

Usage:
    python extract_frames.py --frame-interval 10 --output-dir ./data/frames

Environment variables (set in a .env file, see .env.example):
    KAGGLE_USERNAME       Kaggle username
    KAGGLE_KEY            Kaggle API key
    (kagglehub will pick these up automatically if present, or you can
    place a kaggle.json in ~/.kaggle/ instead)
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from dataclasses import dataclass
from pathlib import Path

import cv2

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    # dotenv is optional; env vars can also be set directly in the shell/CI
    pass

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("frame_extraction")

DATASET_SLUG = "ehsaanali/construction-activity-recognition-dataset"


@dataclass
class ExtractionStats:
    videos_processed: int = 0
    videos_failed: int = 0
    frames_saved: int = 0


def download_dataset() -> Path:
    """Download (or reuse cached) dataset via kagglehub and return its root path."""
    import kagglehub

    log.info("Resolving dataset: %s", DATASET_SLUG)
    raw_path = Path(kagglehub.dataset_download(DATASET_SLUG))
    log.info("Dataset available at: %s", raw_path)

    # The dataset nests everything under a subfolder with a matching name.
    nested = raw_path / "Construction Activity Recognition dataset"
    return nested if nested.exists() else raw_path


def extract_frames_from_video(
    video_path: Path,
    out_dir: Path,
    frame_interval: int,
) -> int:
    """Extract every Nth frame from a single video. Returns number of frames saved."""
    out_dir.mkdir(parents=True, exist_ok=True)

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        log.warning("Could not open video: %s", video_path.name)
        return 0

    frame_idx = 0
    saved = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if frame_idx % frame_interval == 0:
            out_file = out_dir / f"frame_{frame_idx:05d}.jpg"
            cv2.imwrite(str(out_file), frame)
            saved += 1

        frame_idx += 1

    cap.release()
    return saved


def run_pipeline(dataset_path: Path, output_dir: Path, frame_interval: int) -> ExtractionStats:
    stats = ExtractionStats()
    output_dir.mkdir(parents=True, exist_ok=True)

    activity_folders = sorted(p for p in dataset_path.iterdir() if p.is_dir())
    if not activity_folders:
        log.error("No activity folders found under %s", dataset_path)
        return stats

    for activity_folder in activity_folders:
        video_files = list(activity_folder.glob("*.mp4"))
        log.info("Activity '%s': %d video(s)", activity_folder.name, len(video_files))

        for video_file in video_files:
            stats.videos_processed += 1
            out_dir = output_dir / activity_folder.name / video_file.stem

            saved = extract_frames_from_video(video_file, out_dir, frame_interval)
            if saved == 0:
                stats.videos_failed += 1
            else:
                stats.frames_saved += saved
            log.info("  %s -> %d frames", video_file.name, saved)

    return stats


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Extract frames from construction activity videos.")
    parser.add_argument(
        "--frame-interval",
        type=int,
        default=10,
        help="Save every Nth frame (default: 10).",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("./data/frames"),
        help="Directory to write extracted frames to (default: ./data/frames).",
    )
    parser.add_argument(
        "--dataset-path",
        type=Path,
        default=None,
        help="Skip kagglehub download and use an existing local dataset path instead.",
    )
    return parser.parse_args(argv)


def main() -> None:
    args = parse_args()

    if args.frame_interval < 1:
        log.error("--frame-interval must be >= 1")
        sys.exit(1)

    dataset_path = args.dataset_path or download_dataset()
    if not dataset_path.exists():
        log.error("Dataset path does not exist: %s", dataset_path)
        sys.exit(1)

    stats = run_pipeline(dataset_path, args.output_dir, args.frame_interval)

    log.info("========== DONE ==========")
    log.info("Videos processed: %d", stats.videos_processed)
    log.info("Videos failed:    %d", stats.videos_failed)
    log.info("Frames saved:     %d", stats.frames_saved)
    log.info("Output directory: %s", args.output_dir)


if __name__ == "__main__":
    main()
