"""
Dev-only stand-in for the platform's Ingestion Layer.

The Platform Integration Strategy doc (§5) makes frame ingestion a shared
platform service: it opens camera connections, extracts frames, and publishes
them to `frames:{camera_id}` Redis lists (§5.5) for any analytics service to
consume. That Ingestion Layer doesn't exist anywhere in this workspace — it's
platform-team-owned, out of scope for UC3 to build (see the implementation
plan's Context section).

This script exists ONLY so RedisFrameSource (../frame_source.py) and the
/ws/detect/redis endpoint (../main.py) can be exercised end-to-end locally,
by playing the Ingestion Layer's role: open a video file or RTSP URL (same
cv2.VideoCapture pattern frame_source.py already uses) and LPUSH JPEG-encoded
frames onto `frames:{camera_id}`. Delete this once a real Ingestion Layer is
deployed — RedisFrameSource itself needs no changes when that happens, since
it only depends on the `frames:{camera_id}` contract, not on who publishes to it.

Usage:
    cd dashboard/backend
    python scripts/publish_frames_to_redis.py --source path/to/video.mp4 --camera-id CAM-01
    python scripts/publish_frames_to_redis.py --source rtsp://192.168.1.42:8080/h264.sdp --camera-id CAM-02
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

import cv2
import redis

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))  # backend/ on path

from config import FRAMES_STREAM_MAXLEN, REDIS_URL  # noqa: E402

JPEG_QUALITY = 80


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, help="Video file path or rtsp:// URL")
    parser.add_argument("--camera-id", required=True, help="Camera id to publish under (frames:{camera_id})")
    parser.add_argument("--fps-cap", type=float, default=15.0, help="Max publish rate (default 15 fps)")
    parser.add_argument("--loop", action="store_true", help="Reopen and replay when the source ends (video files only)")
    args = parser.parse_args()

    key = f"frames:{args.camera_id}"
    client = redis.from_url(REDIS_URL, decode_responses=False)
    client.ping()
    print(f"Publishing '{args.source}' to Redis list '{key}' (maxlen={FRAMES_STREAM_MAXLEN}, fps_cap={args.fps_cap})")

    min_interval = 1.0 / args.fps_cap if args.fps_cap > 0 else 0.0
    n = 0
    while True:
        cap = cv2.VideoCapture(args.source)
        if not cap.isOpened():
            raise RuntimeError(f"Could not open source: {args.source}")
        try:
            while True:
                t0 = time.monotonic()
                ret, frame = cap.read()
                if not ret:
                    break
                ok, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])
                if not ok:
                    continue
                # LPUSH + LTRIM keeps the list a small, capped, FIFO-via-BRPOP
                # buffer — the platform Ingestion Layer's real publisher would
                # do the equivalent; RedisFrameSource just BRPOPs the tail.
                client.lpush(key, buf.tobytes())
                client.ltrim(key, 0, FRAMES_STREAM_MAXLEN - 1)
                n += 1
                if n % 50 == 0:
                    print(f"  published {n} frames to {key}")
                elapsed = time.monotonic() - t0
                if elapsed < min_interval:
                    time.sleep(min_interval - elapsed)
        finally:
            cap.release()
        if not args.loop:
            break
        print(f"Source ended, looping ({args.source})")

    print(f"Done — {n} frames published to {key}")


if __name__ == "__main__":
    main()
