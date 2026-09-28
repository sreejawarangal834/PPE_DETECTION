"""
Face-region estimation — NOT a face detector.

Estimates the likely face region as the top portion of a person's
bounding box, purely from geometry (no model call). Used to decide
whether a track's box is even worth cropping and running the real face
model on (face/model_loader.py) — the same role reid/embedder.py's
crop_quality_gate() plays for body Re-ID, just cheaper still, since this
runs before any crop is even taken.

Ported from Innovision-multiAnalytics' (github.com/RakshitChaturvedi/
Innovision-multiAnalytics, develop branch) services/detection/src/
face_estimator.py. Its default face_region_ratio=0.35 independently
matches the value this codebase's own occlusion investigation converged
on for the same purpose — kept as-is rather than re-tuned.
"""

from __future__ import annotations

from dataclasses import dataclass

Box = tuple[float, float, float, float]  # normalized (x1, y1, x2, y2), matches compliance.py's Box


@dataclass
class FaceEstimate:
    box: Box
    has_face: bool


class FaceEstimator:
    def __init__(self, face_region_ratio: float = 0.35, min_area: float = 0.001) -> None:
        self.face_region_ratio = face_region_ratio
        self.min_area = min_area

    def estimate(self, person_box: Box) -> FaceEstimate:
        """person_box: normalized (x1, y1, x2, y2) for a tracked person."""
        x1, y1, x2, y2 = person_box
        face_bottom = y1 + (y2 - y1) * self.face_region_ratio
        face_box = (x1, y1, x2, face_bottom)
        area = max(0.0, x2 - x1) * max(0.0, face_bottom - y1)
        return FaceEstimate(box=face_box, has_face=area > self.min_area)
