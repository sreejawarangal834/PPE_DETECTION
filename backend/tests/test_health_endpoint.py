from unittest.mock import AsyncMock, MagicMock
import pytest
from fastapi.testclient import TestClient

import db
import redis_client

# Mock YOLO before importing main
import ultralytics
ultralytics.YOLO = MagicMock()

import main


@pytest.fixture
def client():
    return TestClient(main.app)


def test_health_ok(monkeypatch, client):
    fake_pool = MagicMock()
    fake_pool.fetchval = AsyncMock(return_value=1)
    monkeypatch.setattr(db, "get_pool", lambda: fake_pool)

    fake_redis = MagicMock()
    fake_redis.ping = AsyncMock(return_value=True)
    monkeypatch.setattr(redis_client, "get_client", lambda: fake_redis)

    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["service"] == "uc3"
    assert "model" in data
    assert "device" in data
    assert "fp16" in data
    assert data["checks"] == {"postgres": "ok", "redis": "ok"}

    res_api = client.get("/api/health")
    assert res_api.status_code == 200
    assert res_api.json() == data


def test_health_503_on_postgres_failure(monkeypatch, client):
    fake_pool = MagicMock()
    fake_pool.fetchval = AsyncMock(side_effect=RuntimeError("db connection failed"))
    monkeypatch.setattr(db, "get_pool", lambda: fake_pool)

    fake_redis = MagicMock()
    fake_redis.ping = AsyncMock(return_value=True)
    monkeypatch.setattr(redis_client, "get_client", lambda: fake_redis)

    res = client.get("/health")
    assert res.status_code == 503
    data = res.json()
    assert data["status"] == "error"
    assert data["service"] == "uc3"
    assert data["checks"] == {"postgres": "error", "redis": "ok"}


def test_health_503_on_redis_failure(monkeypatch, client):
    fake_pool = MagicMock()
    fake_pool.fetchval = AsyncMock(return_value=1)
    monkeypatch.setattr(db, "get_pool", lambda: fake_pool)

    fake_redis = MagicMock()
    fake_redis.ping = AsyncMock(side_effect=RuntimeError("redis down"))
    monkeypatch.setattr(redis_client, "get_client", lambda: fake_redis)

    res = client.get("/health")
    assert res.status_code == 503
    data = res.json()
    assert data["status"] == "error"
    assert data["service"] == "uc3"
    assert data["checks"] == {"postgres": "ok", "redis": "error"}
