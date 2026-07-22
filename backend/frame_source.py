"""
Frame source abstraction.

The detection loop in main.py only depends on this interface, not on where
frames come from. FileVideoSource (uploaded video files) is the only
implementation today; a future RTSPSource(url) implementing the same
`frames()` generator would plug into the same WebSocket handler unchanged.

The read loop itself mirrors the frameextraction branch's
extract_frames.py (cv2.VideoCapture, read until ret is False), except frames
are handed off in-memory for inference instead of being written to disk.
"""

from __future__ import annotations

from pathlib import Path
from typing import Callable, Iterator, Protocol

import cv2
import numpy as np


class FrameSource(Protocol):
    def frames(self) -> Iterator[np.ndarray]: ...


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
