"""
Loads the InsightFace model pack (SCRFD detector + 5-point alignment +
ArcFace embedding) used for face detection & recognition.

Adopted directly from Innovision-multiAnalytics' services/recognition/
src/model_loader.py rather than vendoring SCRFD by hand: verified on this
box (Python 3.14, CPU) that `insightface` installs and runs cleanly, and
running detection+embedding together in one call means wiring in
recognition is a zero-extra-cost extension later (the embedding is
already computed, just unused until face/resolver.py reads it) instead
of a second model swap.

Unlike the per-session main PPE model (_new_model() in main.py), this
pack carries no persistent per-track state — a single shared instance
across every concurrent session is safe, same reasoning as
reid/embedder.py's OsnetEmbedder being shared across sessions.
"""

from __future__ import annotations

import logging

from typing import TYPE_CHECKING

import config

# insightface is imported lazily (inside preload) so that a missing/broken
# install can never stop the backend from starting. Face detection is off by
# default (PPE_FACE_DETECT_ENABLED=false); main.py already catches a failed
# preload and disables the feature instead of crashing.
if TYPE_CHECKING:  # pragma: no cover - type hints only
    from insightface.app import FaceAnalysis
    from insightface.app.common import Face

log = logging.getLogger("ppe_backend.face.model_loader")


class FaceModelLoader:
    def __init__(self) -> None:
        self._app: "FaceAnalysis | None" = None

    def preload(self, use_gpu: bool = False) -> None:
        """Loads the configured pack. Blocks until complete. Idempotent."""
        if self._app is not None:
            return
        from insightface.app import FaceAnalysis  # lazy: see module header
        providers = ["CUDAExecutionProvider", "CPUExecutionProvider"] if use_gpu else ["CPUExecutionProvider"]
        app = FaceAnalysis(name=config.FACE_MODEL_PACK, providers=providers)
        app.prepare(ctx_id=0 if use_gpu else -1, det_size=(640, 640))
        self._app = app
        log.info("face_model_loaded pack=%s gpu=%s", config.FACE_MODEL_PACK, use_gpu)

    def detect_best_face(self, face_crop) -> "Face | None":
        """
        Runs the full SCRFD + ArcFace pipeline ONCE on a face crop and
        returns the highest-confidence Face — bbox, 5-point landmarks,
        pose, det_score, AND the 512-d embedding are all attached to the
        object InsightFace hands back from a single app.get() call.

        Blocking (CPU/GPU-bound). Callers should invoke it via
        asyncio.to_thread so it doesn't stall the event loop.
        """
        if self._app is None:
            raise RuntimeError("FaceModelLoader.preload() was not called.")
        faces = self._app.get(face_crop)
        if not faces:
            return None
        return max(faces, key=lambda f: f.det_score)


_loader: FaceModelLoader | None = None


def get_face_model(use_gpu: bool = False) -> FaceModelLoader:
    global _loader
    if _loader is None:
        _loader = FaceModelLoader()
        _loader.preload(use_gpu)
    return _loader


def extract_embedding(face: "Face"):
    """Unit-normalized 512-d ArcFace embedding already sitting on `face` —
    no model call happens here, app.get() computed it. Ported from
    Innovision-multiAnalytics' embedding_extractor.py."""
    import numpy as np

    if face.embedding is None:
        return None
    embedding = face.embedding.astype(np.float32)
    norm = np.linalg.norm(embedding)
    if norm == 0:
        return None
    return embedding / norm
