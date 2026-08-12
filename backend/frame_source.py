"""
Frame source abstraction.

The detection loop in main.py only depends on this interface, not on where
frames come from. FileVideoSource (uploaded video files) and RTSPSource
(live RTSP streams — IP cameras, or a phone running an RTSP-server app)
both implement the same `frames()` generator and plug into the same
WebSocket handler unchanged.

The read loop itself mirrors the frameextraction branch's
extract_frames.py (cv2.VideoCapture, read until ret is False), except frames
are handed off in-memory for inference instead of being written to disk.
"""

from __future__ import annotations

import logging
import time
from pathlib import Path
from typing import Callable, Iterator, Protocol

import cv2
import numpy as np

log = logging.getLogger("ppe_backend.frame_source")


class FrameSource(Protocol):
    def frames(self) -> Iterator[np.ndarray]: ...
    def cleanup(self) -> None: ...


class FileVideoSource:
    def __init__(
        self,
        path: Path,
        loop: bool = True,
        on_loop: Callable[[], None] | None = None,
    ) -> None:
        self.path = path
        self.loop = loop
        self.on_loop = on_loop
        # Read (and re-read on every loop reopen) from the capture itself —
        # frame_reader in main.py paces playback to whatever this reports.
        self.fps: float = 0.0

    def frames(self) -> Iterator[np.ndarray]:
        first = True
        while True:
            cap = cv2.VideoCapture(str(self.path))
            if not cap.isOpened():
                raise RuntimeError(f"Could not open video: {self.path}")
            self.fps = cap.get(cv2.CAP_PROP_FPS) or 0.0
            try:
                while True:
                    ret, frame = cap.read()
                    if not ret:
                        break
                    yield frame
            finally:
                cap.release()
            if not self.loop:
                break
            # Reopening (rather than seeking to frame 0) sidesteps codecs/VFR
            # files that mishandle CAP_PROP_POS_FRAMES — reopen cost is
            # negligible next to per-frame inference time.
            if not first and self.on_loop:
                self.on_loop()
            first = False

    def cleanup(self) -> None:
        """Remove the uploaded file backing this session once it ends."""
        self.path.unlink(missing_ok=True)


class RTSPSource:
    """
    Live RTSP stream — an IP camera, or a phone running an RTSP-server app
    (e.g. "IP Webcam" on Android, "RTSP Camera Server" on iOS) on the same
    network.

    Unlike an uploaded file, an RTSP stream has no natural end: a dropped
    connection (wifi blip, phone screen lock, app backgrounded) should be
    retried rather than treated as EOF, so `frames()` reconnects internally
    instead of returning control to the caller.
    """

    def __init__(
        self,
        url: str,
        reconnect_delay: float = 2.0,
        max_reconnect_attempts: int | None = None,
    ) -> None:
        self.url = url
        self.reconnect_delay = reconnect_delay
        self.max_reconnect_attempts = max_reconnect_attempts
        # Left unset (0.0) until a connection succeeds — most RTSP servers
        # (especially phone apps) don't report a reliable FPS up front, so
        # frame_reader's PACE_TO_SOURCE_FPS in main.py falls back to
        # FALLBACK_FPS whenever this stays 0.
        self.fps: float = 0.0
        # Kept only for interface symmetry with FileVideoSource — a live
        # stream has no "loop" concept, so this is never invoked.
        self.on_loop: Callable[[], None] | None = None

    def frames(self) -> Iterator[np.ndarray]:
        attempt = 0
        while True:
            cap = cv2.VideoCapture(self.url, cv2.CAP_FFMPEG)
            # Keep OpenCV's internal buffer to a single frame so a network
            # stall drops stale frames instead of queuing them — a live feed
            # should show "now", not slowly fall behind.
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            if not cap.isOpened():
                cap.release()
                attempt += 1
                if (
                    self.max_reconnect_attempts is not None
                    and attempt > self.max_reconnect_attempts
                ):
                    raise RuntimeError(
                        f"Could not open RTSP stream after {attempt} attempts: {self.url}"
                    )
                log.warning(
                    "RTSP connect failed (attempt %d), retrying in %.1fs: %s",
                    attempt, self.reconnect_delay, self.url,
                )
                time.sleep(self.reconnect_delay)
                continue

            self.fps = cap.get(cv2.CAP_PROP_FPS) or 0.0
            attempt = 0
            try:
                while True:
                    ret, frame = cap.read()
                    if not ret:
                        log.info("RTSP stream ended/dropped, reconnecting: %s", self.url)
                        break
                    yield frame
            finally:
                cap.release()
            time.sleep(self.reconnect_delay)

    def cleanup(self) -> None:
        """No uploaded file backs a live stream — nothing to remove."""
        pass
