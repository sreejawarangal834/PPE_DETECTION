"""
Crops the estimated face region from the full frame using a normalized
(x1, y1, x2, y2) box, clamped to frame bounds.

Ported from Innovision-multiAnalytics' services/recognition/src/
face_crop.py (FaceCropper), adapted to this codebase's plain-tuple box
convention (compliance.py's Box = tuple[float, float, float, float])
instead of the reference's pydantic BoundingBox model.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

Box = tuple[float, float, float, float]


@dataclass
class CropResult:
    """The cropped region, plus the frame-pixel offset it was cut from.

    That offset is what lets a crop-local box (e.g. the face model's own
    detected bbox, in the crop's own pixel space starting at (0,0)) be
    mapped back onto the original frame later: frame_x = x1 + crop_local_x.
    Without carrying x1/y1 forward, that mapping isn't possible once
    crop() returns.
    """

    image: np.ndarray
    x1: int
    y1: int


class FaceCropper:
    def crop(self, frame: np.ndarray, box: Box) -> CropResult | None:
        """Crops from a BGR frame using a normalized (0..1) box. Returns
        None if the resulting crop would be degenerate or too small to be
        useful."""
        h, w = frame.shape[:2]
        bx1, by1, bx2, by2 = box

        x1 = max(0, min(int(bx1 * w), w - 1))
        y1 = max(0, min(int(by1 * h), h - 1))
        x2 = max(x1 + 1, min(int(bx2 * w), w))
        y2 = max(y1 + 1, min(int(by2 * h), h))

        if (x2 - x1) < 10 or (y2 - y1) < 10:
            return None

        crop = frame[y1:y2, x1:x2]
        if crop.size == 0:
            return None

        return CropResult(image=crop, x1=x1, y1=y1)
