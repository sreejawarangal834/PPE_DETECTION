"""Unit tests for redis_client.py's connect() retry/backoff — monkeypatches
redis.asyncio.from_url so these run without a live Redis and without actually
sleeping through the real backoff delays."""

from __future__ import annotations

import pytest

import redis_client


class _FakeAsyncRedis:
    def __init__(self, fail_times: int = 0):
        self._fail_times = fail_times
        self.ping_calls = 0
        self.closed = False

    async def ping(self):
        self.ping_calls += 1
        if self.ping_calls <= self._fail_times:
            raise ConnectionError("not ready yet")
        return True

    async def aclose(self):
        self.closed = True


@pytest.fixture(autouse=True)
def _reset_client_singleton(monkeypatch):
    redis_client._client = None
    # Real (but short) backoff delays would add real seconds per retry test —
    # scale them down by patching the module constant rather than globally
    # monkeypatching asyncio.sleep (which would leak into pytest-asyncio's own
    # event-loop machinery for the duration of the test).
    monkeypatch.setattr(redis_client, "_CONNECT_RETRY_BASE_SECONDS", 0.01)
    yield
    redis_client._client = None


async def test_connect_succeeds_first_try(monkeypatch):
    fake = _FakeAsyncRedis(fail_times=0)
    monkeypatch.setattr(redis_client.aioredis, "from_url", lambda *a, **k: fake)

    client = await redis_client.connect()

    assert client is fake
    assert fake.ping_calls == 1


async def test_connect_retries_then_succeeds(monkeypatch):
    fake = _FakeAsyncRedis(fail_times=2)  # fails twice, succeeds on 3rd ping
    monkeypatch.setattr(redis_client.aioredis, "from_url", lambda *a, **k: fake)

    client = await redis_client.connect()

    assert client is fake
    assert fake.ping_calls == 3


async def test_connect_gives_up_after_max_attempts_but_returns_client(monkeypatch):
    fake = _FakeAsyncRedis(fail_times=999)  # never succeeds
    monkeypatch.setattr(redis_client.aioredis, "from_url", lambda *a, **k: fake)

    client = await redis_client.connect()  # must not raise — non-fatal by design

    assert client is fake
    assert fake.ping_calls == redis_client._CONNECT_RETRY_ATTEMPTS


async def test_connect_is_idempotent(monkeypatch):
    fake = _FakeAsyncRedis(fail_times=0)
    call_count = {"n": 0}

    def _from_url(*a, **k):
        call_count["n"] += 1
        return fake

    monkeypatch.setattr(redis_client.aioredis, "from_url", _from_url)

    first = await redis_client.connect()
    second = await redis_client.connect()

    assert first is second
    assert call_count["n"] == 1  # from_url only called once, not per connect() call


async def test_disconnect_closes_and_clears_client(monkeypatch):
    fake = _FakeAsyncRedis(fail_times=0)
    monkeypatch.setattr(redis_client.aioredis, "from_url", lambda *a, **k: fake)
    await redis_client.connect()

    await redis_client.disconnect()

    assert fake.closed is True
    assert redis_client.get_client() is None


def test_get_client_before_connect_returns_none():
    assert redis_client.get_client() is None
