"""Unit tests for writer.py's _publish_events (events:ppe / events:compliance
Redis Streams publishing) — monkeypatches redis_client.get_client() so these
run without live Redis."""

from __future__ import annotations

import json
from uuid import uuid4

import pytest

import redis_client
from repositories import writer


class _FakeAsyncRedisClient:
    def __init__(self, raise_on_xadd: Exception | None = None):
        self.xadd_calls: list[tuple] = []
        self._raise = raise_on_xadd

    async def xadd(self, stream, fields, maxlen=None, approximate=False):
        if self._raise is not None:
            raise self._raise
        self.xadd_calls.append((stream, fields, maxlen, approximate))


async def test_publish_events_noop_when_redis_unavailable(monkeypatch):
    monkeypatch.setattr(redis_client, "_client", None)  # get_client() returns None
    # Must not raise even though no client is connected.
    await writer._publish_events(
        {"ppe_type": "helmet", "confidence": 0.9}, uuid4(), uuid4(), uuid4(), None, None, "medium",
    )


async def test_publish_events_writes_both_streams(monkeypatch):
    fake = _FakeAsyncRedisClient()
    monkeypatch.setattr(redis_client, "_client", fake)

    event_id, alert_uuid, person_id = uuid4(), uuid4(), uuid4()
    await writer._publish_events(
        {"ppe_type": "gloves", "confidence": 0.87, "track_id": 7},
        event_id, alert_uuid, person_id, None, None, "high",
    )

    streams = [call[0] for call in fake.xadd_calls]
    assert streams == ["events:ppe", "events:compliance"]


async def test_publish_events_payload_shape(monkeypatch):
    fake = _FakeAsyncRedisClient()
    monkeypatch.setattr(redis_client, "_client", fake)

    event_id, alert_uuid, person_id = uuid4(), uuid4(), uuid4()
    await writer._publish_events(
        {"ppe_type": "vest", "confidence": 0.75, "track_id": 3},
        event_id, alert_uuid, person_id, None, None, "critical",
    )

    ppe_stream, ppe_fields, ppe_maxlen, ppe_approx = fake.xadd_calls[0]
    compliance_stream, compliance_fields, _, _ = fake.xadd_calls[1]

    ppe_payload = json.loads(ppe_fields["data"])
    assert ppe_payload["event_id"] == str(event_id)
    assert ppe_payload["ppe_type"] == "vest"
    assert ppe_payload["confidence"] == 0.75
    assert ppe_payload["person_id"] == str(person_id)
    assert ppe_approx is True

    compliance_payload = json.loads(compliance_fields["data"])
    assert compliance_payload["alert_id"] == str(alert_uuid)
    assert compliance_payload["state"] == "violation"
    assert compliance_payload["severity"] == "critical"
    # compliance payload carries everything the ppe payload does, plus the extras
    assert compliance_payload["ppe_type"] == "vest"


async def test_publish_events_never_raises_on_redis_error(monkeypatch):
    fake = _FakeAsyncRedisClient(raise_on_xadd=ConnectionError("redis down"))
    monkeypatch.setattr(redis_client, "_client", fake)

    # Must swallow the error and log, not propagate — a Redis outage must
    # never break the compliance_events/alerts write it's mirroring.
    await writer._publish_events(
        {"ppe_type": "helmet", "confidence": 0.5}, uuid4(), uuid4(), uuid4(), None, None, "low",
    )
