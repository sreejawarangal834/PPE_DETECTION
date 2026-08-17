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
        status_callback: Callable[[str], None] | None = None,
    ) -> None:
        self.url = url
        self.reconnect_delay = reconnect_delay
        self.max_reconnect_attempts = max_reconnect_attempts
        # Optional observability hook, e.g. persisting cameras.status
        # (online/reconnecting/offline) — see main.py's detect_rtsp_ws.
        # Fired from whatever thread is driving this generator (main.py
        # advances it via asyncio.to_thread), so callers that need to touch
        # asyncio/DB state from here must hand off thread-safely themselves
        # (see repositories/writer.py's submit_threadsafe).
        self.status_callback = status_callback
        # Left unset (0.0) until a connection succeeds — most RTSP servers
        # (especially phone apps) don't report a reliable FPS up front, so
        # frame_reader's PACE_TO_SOURCE_FPS in main.py falls back to
        # FALLBACK_FPS whenever this stays 0.
        self.fps: float = 0.0
        # Kept only for interface symmetry with FileVideoSource — a live
        # stream has no "loop" concept, so this is never invoked.
        self.on_loop: Callable[[], None] | None = None
        # Settable after construction (main.py wires this to the session's
        # `_stop` asyncio.Event right after creating it — same pattern as
        # `on_loop`). Without this, a client that disconnects while the
        # stream is unreachable can't actually stop this generator: the
        # whole reconnect-forever loop below runs inside ONE call to
        # next(frames()), so main.py's frame_reader never gets a chance to
        # notice `_stop` between iterations until a connection attempt
        # actually succeeds or fails in a way that yields/raises. Checking
        # this callable at each retry/read point closes that gap.
        self.should_stop: Callable[[], bool] | None = None

    def _wants_stop(self) -> bool:
        return self.should_stop is not None and self.should_stop()

    def _notify(self, status: str) -> None:
        if self.status_callback is not None:
            try:
                self.status_callback(status)
            except Exception:
                log.exception("RTSPSource status_callback raised for status=%s", status)

    def frames(self) -> Iterator[np.ndarray]:
        attempt = 0
        while True:
            if self._wants_stop():
                log.info("RTSP source stopping (should_stop) before reconnect attempt: %s", self.url)
                return
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
                self._notify("reconnecting")
                # Sleep in small slices so a client disconnect (should_stop)
                # is noticed within ~0.2s instead of waiting out the full
                # reconnect_delay — matters because this whole retry loop
                # runs inside a single next(frames()) call from main.py's
                # frame_reader, which otherwise has no chance to see `_stop`
                # until a connection attempt actually yields or raises.
                slept = 0.0
                while slept < self.reconnect_delay:
                    if self._wants_stop():
                        return
                    time.sleep(min(0.2, self.reconnect_delay - slept))
                    slept += 0.2
                continue

            self.fps = cap.get(cv2.CAP_PROP_FPS) or 0.0
            attempt = 0
            announced_online = False
            try:
                while True:
                    if self._wants_stop():
                        log.info("RTSP source stopping (should_stop) mid-stream: %s", self.url)
                        return
                    ret, frame = cap.read()
                    if not ret:
                        log.info("RTSP stream ended/dropped, reconnecting: %s", self.url)
                        self._notify("reconnecting")
                        break
                    if not announced_online:
                        # "online" means a frame actually arrived, not just
                        # that cap.isOpened() — a connected-but-silent stream
                        # (e.g. phone app backgrounded right after handshake)
                        # should not read as healthy.
                        self._notify("online")
                        announced_online = True
                    yield frame
            finally:
                cap.release()
            time.sleep(self.reconnect_delay)

    def cleanup(self) -> None:
        """No uploaded file backs a live stream — nothing to remove."""
        pass
