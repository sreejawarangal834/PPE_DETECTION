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
from typing import Iterator, Protocol

import cv2
import numpy as np


class FrameSource(Protocol):
    def frames(self) -> Iterator[np.ndarray]: ...


class FileVideoSource:
    def __init__(self, path: Path) -> None:
        self.path = path

    def frames(self) -> Iterator[np.ndarray]:
        cap = cv2.VideoCapture(str(self.path))
        if not cap.isOpened():
            raise RuntimeError(f"Could not open video: {self.path}")
        try:
            while True:
                ret, frame = cap.read()
                if not ret:
                    break
                yield frame
        finally:
            cap.release()
