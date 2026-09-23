"""Unit tests for RedisFrameSource (frame_source.py) — hermetic, no live Redis
required. `redis_sync.from_url` is monkeypatched to a fake client so these
exercise the actual decode/should_stop/status-callback logic without needing
Docker up, unlike the manual verification this session ran against the real
container."""

from __future__ import annotations

import cv2
import numpy as np

import frame_source


class _FakeSyncRedis:
    """Minimal stand-in for redis.Redis covering only what RedisFrameSource calls."""

    def __init__(self, items: list[bytes] | None = None, empty_calls_first: int = 0):
        self._items = list(items or [])
        self._empty_calls_remaining = empty_calls_first
        self.closed = False
        self.call_count = 0

    def brpop(self, keys, timeout):
        self.call_count += 1
        if self._empty_calls_remaining > 0:
            self._empty_calls_remaining -= 1
            return None  # timed out, list empty — matches real redis-py's BRPOP return
        if self._items:
            return keys[0], self._items.pop(0)
        return None

    def close(self):
        self.closed = True


def _jpeg_bytes(color=(10, 20, 30)) -> bytes:
    frame = np.full((16, 16, 3), color, dtype=np.uint8)
    ok, buf = cv2.imencode(".jpg", frame)
    assert ok
    return buf.tobytes()


def test_frames_decodes_pushed_frame(monkeypatch):
    fake = _FakeSyncRedis(items=[_jpeg_bytes()])
    monkeypatch.setattr(frame_source.redis_sync, "from_url", lambda *a, **k: fake)

    src = frame_source.RedisFrameSource("CAM-01", "redis://ignored/0")
    gen = src.frames()
    frame = next(gen)

    assert frame.shape == (16, 16, 3)
    assert frame.dtype == np.uint8


def test_frames_skips_empty_brpop_then_yields(monkeypatch):
    # First two brpop calls return None (empty list / timeout), third returns a frame —
    # frames() must loop past the empty reads rather than yielding None or raising.
    fake = _FakeSyncRedis(items=[_jpeg_bytes()], empty_calls_first=2)
    monkeypatch.setattr(frame_source.redis_sync, "from_url", lambda *a, **k: fake)

    src = frame_source.RedisFrameSource("CAM-01", "redis://ignored/0", block_timeout_seconds=0.01)
    frame = next(src.frames())

    assert frame is not None
    assert fake.call_count == 3


def test_frames_stops_when_should_stop_is_set(monkeypatch):
    fake = _FakeSyncRedis(items=[])
    monkeypatch.setattr(frame_source.redis_sync, "from_url", lambda *a, **k: fake)

    src = frame_source.RedisFrameSource("CAM-01", "redis://ignored/0", block_timeout_seconds=0.01)
    src.should_stop = lambda: True
    gen = src.frames()

    # A generator that returns immediately raises StopIteration on first next().
    import pytest
    with pytest.raises(StopIteration):
        next(gen)


def test_frames_calls_status_callback_online_once(monkeypatch):
    fake = _FakeSyncRedis(items=[_jpeg_bytes(), _jpeg_bytes()])
    monkeypatch.setattr(frame_source.redis_sync, "from_url", lambda *a, **k: fake)

    statuses: list[str] = []
    src = frame_source.RedisFrameSource("CAM-01", "redis://ignored/0", status_callback=statuses.append)
    gen = src.frames()
    next(gen)
    next(gen)

    assert statuses == ["online"]  # only announced once, not per-frame


def test_cleanup_closes_client(monkeypatch):
    fake = _FakeSyncRedis()
    monkeypatch.setattr(frame_source.redis_sync, "from_url", lambda *a, **k: fake)

    src = frame_source.RedisFrameSource("CAM-01", "redis://ignored/0")
    src.cleanup()

    assert fake.closed is True


def test_redis_error_triggers_reconnecting_status_and_retries(monkeypatch):
    import redis as redis_sync_module

    call_count = {"n": 0}

    class _FlakyRedis(_FakeSyncRedis):
        def brpop(self, keys, timeout):
            call_count["n"] += 1
            if call_count["n"] == 1:
                raise redis_sync_module.ConnectionError("boom")
            return super().brpop(keys, timeout)

    fake = _FlakyRedis(items=[_jpeg_bytes()])
    monkeypatch.setattr(frame_source.redis_sync, "from_url", lambda *a, **k: fake)
    monkeypatch.setattr(frame_source.time, "sleep", lambda _s: None)  # don't actually wait in tests

    statuses: list[str] = []
    src = frame_source.RedisFrameSource("CAM-01", "redis://ignored/0", status_callback=statuses.append)
    frame = next(src.frames())

    assert frame is not None
    assert "reconnecting" in statuses
    assert call_count["n"] >= 2
