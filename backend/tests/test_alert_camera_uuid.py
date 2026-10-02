from uuid import UUID, uuid4
import pytest
from repositories import camera_registry_client as crc
from repositories import writer


class _FakePool:
    def __init__(self):
        self.executed: list[tuple] = []

    async def fetchval(self, query, *args):
        if "zones" in query:
            return uuid4()
        return None

    async def execute(self, query, *args):
        self.executed.append((query, args))


@pytest.mark.asyncio
async def test_upsert_uses_platform_uuid_for_id():
    fake_pool = _FakePool()
    cam_uuid_str = "00000000-0000-0000-0000-000000000003"
    await crc._upsert(fake_pool, {"id": cam_uuid_str, "name": "Platform Cam"})

    assert len(fake_pool.executed) == 1
    query, args = fake_pool.executed[0]
    assert "INSERT INTO cameras (id, code, name, zone_id, rtsp_url)" in query
    assert args[0] == UUID(cam_uuid_str)
    assert args[1] == cam_uuid_str


class _FakePublisher:
    def __init__(self):
        self.published = []

    async def publish(self, alert_event):
        self.published.append(alert_event)


@pytest.mark.asyncio
async def test_alert_event_uses_camera_uuid_from_code(monkeypatch):
    pub = _FakePublisher()
    monkeypatch.setattr(writer, "get_alert_publisher", lambda: pub)

    local_db_uuid = uuid4()
    platform_uuid_str = "00000000-0000-0000-0000-000000000003"

    class FakeConn:
        def transaction(self):
            class Tx:
                async def __aenter__(self): pass
                async def __aexit__(self, *a): pass
            return Tx()

        async def fetchval(self, query, *args):
            if "SELECT label FROM persons" in query:
                return "W-100"
            return uuid4()

        async def fetchrow(self, query, *args):
            return {"id": uuid4(), "alert_id": uuid4(), "person_id": uuid4()}

        async def execute(self, query, *args):
            pass

    async def fake_get_cam_id(code, executor=None):
        return local_db_uuid

    async def fake_get_zone_id(slug, executor=None):
        return uuid4()

    async def fake_get_or_create(conn, tid):
        return uuid4()

    monkeypatch.setattr(writer, "get_camera_id", fake_get_cam_id)
    monkeypatch.setattr(writer, "get_zone_id", fake_get_zone_id)
    monkeypatch.setattr(writer, "get_or_create_by_track_label", fake_get_or_create)

    event = {
        "kind": "violation",
        "camera_code": platform_uuid_str,
        "zone_slug": "test-zone",
        "track_id": 1,
        "ppe_type": "helmet",
        "severity": "medium",
        "confidence": 0.9,
    }

    await writer._persist_violation(FakeConn(), event)

    assert len(pub.published) == 1
    alert_evt = pub.published[0]
    assert alert_evt.camera_id == UUID(platform_uuid_str)


@pytest.mark.asyncio
async def test_alert_event_falls_back_to_local_id_for_non_uuid(monkeypatch, caplog):
    pub = _FakePublisher()
    monkeypatch.setattr(writer, "get_alert_publisher", lambda: pub)

    local_db_uuid = uuid4()

    class FakeConn:
        def transaction(self):
            class Tx:
                async def __aenter__(self): pass
                async def __aexit__(self, *a): pass
            return Tx()

        async def fetchval(self, query, *args):
            if "SELECT label FROM persons" in query:
                return "W-100"
            return uuid4()

        async def fetchrow(self, query, *args):
            return {"id": uuid4(), "alert_id": uuid4(), "person_id": uuid4()}

        async def execute(self, query, *args):
            pass

    async def fake_get_cam_id(code, executor=None):
        return local_db_uuid

    async def fake_get_zone_id(slug, executor=None):
        return uuid4()

    async def fake_get_or_create(conn, tid):
        return uuid4()

    monkeypatch.setattr(writer, "get_camera_id", fake_get_cam_id)
    monkeypatch.setattr(writer, "get_zone_id", fake_get_zone_id)
    monkeypatch.setattr(writer, "get_or_create_by_track_label", fake_get_or_create)

    event = {
        "kind": "violation",
        "camera_code": "CAM-NON-UUID-99",
        "zone_slug": "test-zone",
        "track_id": 1,
        "ppe_type": "helmet",
        "severity": "medium",
        "confidence": 0.9,
    }

    with caplog.at_level("WARNING"):
        await writer._persist_violation(FakeConn(), event)

    assert len(pub.published) == 1
    alert_evt = pub.published[0]
    assert alert_evt.camera_id == local_db_uuid
    assert "Camera code 'CAM-NON-UUID-99' is not a valid UUID" in caplog.text
