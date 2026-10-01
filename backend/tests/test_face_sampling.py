"""Unit tests for face/sampling.py's FaceSampler — the "identify once per
track, not every frame" cadence policy (new track / periodic / quality-jump).
Pure logic, no model or DB involved."""

from __future__ import annotations

import time as time_module

from face.sampling import FaceSampler


def _sampler(**overrides):
    defaults = dict(sample_rate=10, quality_improvement_threshold=0.2, stale_ttl_seconds=120.0)
    defaults.update(overrides)
    return FaceSampler(**defaults)


def test_new_track_always_samples():
    sampler = _sampler()
    assert sampler.should_sample("sess", 1, frame_seq=0, quality_score=0.5) is True


def test_frame_gap_below_sample_rate_does_not_resample():
    sampler = _sampler()
    sampler.should_sample("sess", 1, frame_seq=0, quality_score=0.5)
    assert sampler.should_sample("sess", 1, frame_seq=5, quality_score=0.5) is False


def test_frame_gap_at_or_above_sample_rate_resamples():
    sampler = _sampler()
    sampler.should_sample("sess", 1, frame_seq=0, quality_score=0.5)
    assert sampler.should_sample("sess", 1, frame_seq=10, quality_score=0.5) is True


def test_quality_jump_triggers_resample_before_sample_rate_elapses():
    sampler = _sampler()
    sampler.should_sample("sess", 1, frame_seq=0, quality_score=0.5)
    assert sampler.should_sample("sess", 1, frame_seq=3, quality_score=0.75) is True


def test_small_quality_change_does_not_resample():
    sampler = _sampler()
    sampler.should_sample("sess", 1, frame_seq=0, quality_score=0.5)
    assert sampler.should_sample("sess", 1, frame_seq=3, quality_score=0.55) is False


def test_different_tracks_are_independent():
    sampler = _sampler()
    sampler.should_sample("sess", 1, frame_seq=0, quality_score=0.5)
    assert sampler.should_sample("sess", 2, frame_seq=1, quality_score=0.5) is True


def test_forget_session_clears_only_that_sessions_tracks():
    sampler = _sampler()
    sampler.should_sample("sess-a", 1, frame_seq=0, quality_score=0.5)
    sampler.should_sample("sess-b", 1, frame_seq=0, quality_score=0.5)

    sampler.forget_session("sess-a")

    assert sampler.active_tracks == 1
    # sess-a's track state is gone, so it's treated as new again.
    assert sampler.should_sample("sess-a", 1, frame_seq=1, quality_score=0.5) is True


def test_sweep_stale_evicts_only_state_past_the_ttl(monkeypatch):
    fake_now = [1000.0]
    monkeypatch.setattr(time_module, "monotonic", lambda: fake_now[0])

    sampler = _sampler(stale_ttl_seconds=5.0)
    sampler.should_sample("sess", 1, frame_seq=0, quality_score=0.5)
    fake_now[0] += 10.0  # exceeds stale_ttl_seconds

    evicted = sampler.sweep_stale()

    assert evicted == 1
    assert sampler.active_tracks == 0
