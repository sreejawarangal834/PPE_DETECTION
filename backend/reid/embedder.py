"""
Crop -> 512-d L2-normalised OSNet embedding, batched, on GPU.

Runs in the same worker thread as inference, after detection (see main.py's
_run_inference / the per-track embedding call sites) — off the event loop,
same as the YOLO forward pass itself. One OSNet instance is shared across all
sessions (unlike the per-session YOLO models — see main.py's `_new_model`
docstring): OSNet carries no persistent per-track state, so sharing it is
safe and avoids reloading ~3MB of weights per session.
"""

from __future__ import annotations

import logging
from pathlib import Path

import cv2
import numpy as np
import torch
import torch.nn.functional as F

from reid.osnet import load_osnet_x0_25_msmt17

log = logging.getLogger("ppe_backend.reid.embedder")

WEIGHTS_PATH = Path(__file__).parent / "weights" / "osnet_x0_25_msmt17.pt"
INPUT_SIZE = (128, 256)  # (width, height) — standard Re-ID crop aspect ratio
_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)

# ── Extraction quality gates (SCHEMA_DEEP_DIVE.md §1.7) ──────────────────────
# Require ALL of these before a crop is even worth embedding — low-quality
# crops are the dominant cause of identity drift, not the matching threshold.
MIN_TRACK_AGE_FRAMES = 5          # filters ByteTrack one-frame ghosts
MIN_DETECTION_CONF = 0.60
MIN_BOX_HEIGHT_FRACTION = 0.15    # below ~15% of frame height, OSNet's 256px input upsamples noise
MIN_ASPECT_RATIO = 1.5            # height/width — a standing person, not a clipped torso
MAX_ASPECT_RATIO = 4.0
EDGE_MARGIN = 0.01                # reject boxes touching the frame edge (likely clipped)


class OsnetEmbedder:
    def __init__(self, device: str | torch.device = "cpu") -> None:
        if not WEIGHTS_PATH.exists():
            raise FileNotFoundError(
                f"OSNet weights not found at {WEIGHTS_PATH}. Download them from the URL in "
                f"reid/osnet.py's module docstring (backend/reid/weights/ is gitignored)."
            )
        self.device = device
        self.model = load_osnet_x0_25_msmt17(str(WEIGHTS_PATH), device=device)
        log.info("OSNet embedder loaded on %s (%s)", device, WEIGHTS_PATH.name)

    def crop_quality_gate(
        self,
        box_norm: tuple[float, float, float, float],
        det_conf: float,
        track_age_frames: int,
    ) -> tuple[bool, float]:
        """Returns (passes, quality) — quality is a 0..1 composite score used both as the
        gate's own confidence signal and later as the embedding's `quality` column (weights
        aggregation and eviction ordering — SCHEMA_DEEP_DIVE.md §1.5)."""
        if track_age_frames < MIN_TRACK_AGE_FRAMES or det_conf < MIN_DETECTION_CONF:
            return False, 0.0
        x1, y1, x2, y2 = box_norm
        w, h = x2 - x1, y2 - y1
        if w <= 0 or h <= 0:
            return False, 0.0
        if h < MIN_BOX_HEIGHT_FRACTION:
            return False, 0.0
        aspect = h / w
        if not (MIN_ASPECT_RATIO <= aspect <= MAX_ASPECT_RATIO):
            return False, 0.0
        if x1 < EDGE_MARGIN or y1 < EDGE_MARGIN or x2 > 1 - EDGE_MARGIN or y2 > 1 - EDGE_MARGIN:
            return False, 0.0
        # Composite quality: confidence × box-size factor (bigger crops carry more
        # texture detail, capped at 1.0 once "big enough") × aspect-closeness-to-ideal.
        size_factor = min(h / 0.5, 1.0)
        aspect_factor = 1.0 - min(abs(aspect - 2.5) / 2.5, 1.0)
        quality = float(det_conf) * size_factor * (0.5 + 0.5 * aspect_factor)
        return True, max(0.0, min(quality, 1.0))

    def sharpness(self, crop_bgr: np.ndarray) -> float:
        """Laplacian-variance blur/motion-blur gate input (SCHEMA_DEEP_DIVE.md §1.5)."""
        if crop_bgr.size == 0:
            return 0.0
        gray = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2GRAY)
        return float(cv2.Laplacian(gray, cv2.CV_64F).var())

    def _preprocess(self, crop_bgr: np.ndarray) -> torch.Tensor:
        rgb = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2RGB)
        resized = cv2.resize(rgb, INPUT_SIZE, interpolation=cv2.INTER_LINEAR)
        normed = (resized.astype(np.float32) / 255.0 - _MEAN) / _STD
        chw = np.transpose(normed, (2, 0, 1))
        return torch.from_numpy(chw)

    @torch.no_grad()
    def embed_batch(self, crops_bgr: list[np.ndarray]) -> np.ndarray:
        """crops -> (N, 512) L2-normalised float32 embeddings. Batched so multiple
        people-per-frame cost one forward pass, not one per person."""
        if not crops_bgr:
            return np.zeros((0, 512), dtype=np.float32)
        batch = torch.stack([self._preprocess(c) for c in crops_bgr]).to(self.device)
        out = self.model(batch)
        out = F.normalize(out, p=2, dim=1)  # cosine similarity == dot product downstream
        return out.cpu().numpy().astype(np.float32)

    def embed_one(self, crop_bgr: np.ndarray) -> np.ndarray:
        return self.embed_batch([crop_bgr])[0]


_embedder: OsnetEmbedder | None = None


def get_embedder(device: str | torch.device = "cpu") -> OsnetEmbedder:
    global _embedder
    if _embedder is None:
        _embedder = OsnetEmbedder(device=device)
    return _embedder
