"""Unit tests for camera_registry_client.py — respx mocks the registry HTTP
calls (auth header, retry/backoff) and a fake asyncpg-pool-like object
captures the upsert SQL, so these run without a live registry or Postgres."""

from __future__ import annotations

import httpx
import pytest
import respx

from repositories import camera_registry_client as crc


class _FakePool:
    """Records fetchval/execute calls; fetchval returns a canned zone id for
    any SELECT id FROM zones query, None otherwise — enough for _upsert()."""

    def __init__(self):
        self.executed: list[tuple] = []

    async def fetchval(self, query, *args):
        if "zones" in query:
            return "zone-uuid-123"
        return None

    async def execute(self, query, *args):
        self.executed.append((query, args))


@pytest.fixture(autouse=True)
def _configure_registry(monkeypatch):
    monkeypatch.setattr(crc, "CAMERA_REGISTRY_URL", "http://fake-registry.local")
    monkeypatch.setattr(crc, "CAMERA_REGISTRY_API_KEY", None)
    monkeypatch.setattr(crc, "_FETCH_RETRY_BASE_SECONDS", 0.01)
    yield


async def test_sync_cameras_noop_when_url_unset(monkeypatch):
    monkeypatch.setattr(crc, "CAMERA_REGISTRY_URL", None)
    n = await crc.sync_cameras()
    assert n == 0


@respx.mock
async def test_sync_cameras_upserts_each_entry(monkeypatch):
    respx.get("http://fake-registry.local/cameras").mock(
        return_value=httpx.Response(200, json=[
            {"id": "CAM-X1", "name": "Gate 1", "zoneId": "z-assembly"},
            {"id": "CAM-X2", "name": "Gate 2", "zoneId": "z-loading"},
        ])
    )
    fake_pool = _FakePool()
    monkeypatch.setattr(crc, "get_pool", lambda: fake_pool)

    n = await crc.sync_cameras()

    assert n == 2
    assert len(fake_pool.executed) == 2
    codes = [args[0] for _query, args in fake_pool.executed]
    assert codes == ["CAM-X1", "CAM-X2"]


@respx.mock
async def test_sync_cameras_sends_bearer_token_when_configured(monkeypatch):
    monkeypatch.setattr(crc, "CAMERA_REGISTRY_API_KEY", "secret-token")
    route = respx.get("http://fake-registry.local/cameras").mock(
        return_value=httpx.Response(200, json=[])
    )
    monkeypatch.setattr(crc, "get_pool", lambda: _FakePool())

    await crc.sync_cameras()

    assert route.calls.last.request.headers["Authorization"] == "Bearer secret-token"


@respx.mock
async def test_sync_cameras_omits_auth_header_when_unconfigured(monkeypatch):
    route = respx.get("http://fake-registry.local/cameras").mock(
        return_value=httpx.Response(200, json=[])
    )
    monkeypatch.setattr(crc, "get_pool", lambda: _FakePool())

    await crc.sync_cameras()

    assert "Authorization" not in route.calls.last.request.headers


@respx.mock
async def test_sync_cameras_retries_on_transient_failure_then_succeeds(monkeypatch):
    route = respx.get("http://fake-registry.local/cameras").mock(
        side_effect=[
            httpx.Response(503),
            httpx.Response(503),
            httpx.Response(200, json=[{"id": "CAM-RETRY", "name": "Retried Cam"}]),
        ]
    )
    monkeypatch.setattr(crc, "get_pool", lambda: _FakePool())

    n = await crc.sync_cameras()

    assert n == 1
    assert route.call_count == 3


@respx.mock
async def test_sync_cameras_gives_up_after_max_retries(monkeypatch):
    respx.get("http://fake-registry.local/cameras").mock(return_value=httpx.Response(500))
    monkeypatch.setattr(crc, "get_pool", lambda: _FakePool())

    n = await crc.sync_cameras()  # must not raise

    assert n == 0


@respx.mock
async def test_sync_cameras_skips_entry_missing_code(monkeypatch):
    respx.get("http://fake-registry.local/cameras").mock(
        return_value=httpx.Response(200, json=[{"name": "No ID Camera"}])
    )
    fake_pool = _FakePool()
    monkeypatch.setattr(crc, "get_pool", lambda: fake_pool)

    n = await crc.sync_cameras()

    assert n == 1  # loop counts it as "processed" — _upsert itself no-ops on missing code
    assert fake_pool.executed == []  # but no SQL was actually run
