"""
Controls which frames trigger a real face-model call, and expires
per-track state for tracks that have gone stale.

Ported from Innovision-multiAnalytics' services/recognition/src/
sampling.py (RecognitionSampler) — this IS the "identify once per track,
not every frame" policy the identity-persistence discussion converged
on: recognize on a track's first appearance, periodically thereafter as
re-confirmation, and whenever a meaningfully better-quality crop turns
up. Keyed by (session_id, track_id) rather than the reference's
(camera_id, track_id), since a session — not a persistent camera
identity — is this codebase's per-stream scope (main.py's per-session
model isolation, track IDs reset per session/loop).

There is no "track ended" signal from ByteTrack, so state is aged out by
a periodic sweep instead of retained forever — same reasoning as
reid/resolver.py's own per-track aggregation state.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field

log = logging.getLogger("ppe_backend.face.sampling")


@dataclass
class _TrackSampleState:
    last_sampled_frame_seq: int = 0
    last_quality_score: float = 0.0
    last_seen_monotonic: float = field(default_factory=time.monotonic)


class FaceSampler:
    """
    Three triggers to run the face model:
      1. New track      — always sample on first appearance.
      2. Every Nth frame — periodic confirmation.
      3. Quality jump    — a meaningfully better crop became available.
    """

    def __init__(
        self,
        sample_rate: int = 10,
        quality_improvement_threshold: float = 0.2,
        stale_ttl_seconds: float = 120.0,
    ) -> None:
        self.sample_rate = sample_rate
        self.quality_improvement_threshold = quality_improvement_threshold
        self.stale_ttl_seconds = stale_ttl_seconds
        self._states: dict[str, _TrackSampleState] = {}

    def should_sample(self, session_id: str, track_id: int, frame_seq: int, quality_score: float) -> bool:
        key = f"{session_id}:{track_id}"
        now = time.monotonic()

        state = self._states.get(key)
        if state is None:
            self._states[key] = _TrackSampleState(
                last_sampled_frame_seq=frame_seq, last_quality_score=quality_score, last_seen_monotonic=now,
            )
            log.debug("face_sampling_new_track session=%s track=%d", session_id, track_id)
            return True

        state.last_seen_monotonic = now

        if frame_seq - state.last_sampled_frame_seq >= self.sample_rate:
            state.last_sampled_frame_seq = frame_seq
            state.last_quality_score = quality_score
            return True

        delta = quality_score - state.last_quality_score
        if delta >= self.quality_improvement_threshold:
            log.debug("face_sampling_quality_improvement delta=%.2f track=%d", delta, track_id)
            state.last_sampled_frame_seq = frame_seq
            state.last_quality_score = quality_score
            return True

        return False

    def forget_track(self, session_id: str, track_id: int) -> None:
        self._states.pop(f"{session_id}:{track_id}", None)

    def forget_session(self, session_id: str) -> None:
        prefix = f"{session_id}:"
        for key in [k for k in self._states if k.startswith(prefix)]:
            del self._states[key]

    def sweep_stale(self) -> int:
        """Drops any track state not touched within stale_ttl_seconds.
        Called periodically by a background task. Returns count evicted."""
        now = time.monotonic()
        stale_keys = [
            key for key, state in self._states.items()
            if now - state.last_seen_monotonic > self.stale_ttl_seconds
        ]
        for key in stale_keys:
            del self._states[key]
        if stale_keys:
            log.info("face_sampler_swept_stale_tracks count=%d", len(stale_keys))
        return len(stale_keys)

    @property
    def active_tracks(self) -> int:
        return len(self._states)


_sampler: FaceSampler | None = None


def get_sampler() -> FaceSampler:
    global _sampler
    if _sampler is None:
        import config
        _sampler = FaceSampler(
            sample_rate=config.FACE_SAMPLE_RATE,
            quality_improvement_threshold=config.FACE_QUALITY_IMPROVEMENT_THRESHOLD,
            stale_ttl_seconds=config.FACE_STALE_TRACK_TTL_SECONDS,
        )
    return _sampler
