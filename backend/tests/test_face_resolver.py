"""Unit tests for face/resolver.py's 3-tier identity tagging (enrolled /
visitor / unknown) — hermetic: the DB connection is a fake that returns
canned KNN rows, no live Postgres needed."""

from __future__ import annotations

from uuid import uuid4

import numpy as np
import pytest

from face import resolver as face_resolver
from reid import resolver as reid_resolver


class _FakeConn:
    def __init__(self, knn_rows):
        self._knn_rows = knn_rows
        self.executed: list[tuple] = []

    async def fetch(self, query, *args):
        return self._knn_rows

    async def execute(self, query, *args):
        self.executed.append((query, args))


def _row(person_id, score):
    return {"person_id": person_id, "score": score, "source": "auto_discovered"}


@pytest.fixture(autouse=True)
def _clean_alive_bindings():
    reid_resolver._alive_bindings.clear()
    yield
    reid_resolver._alive_bindings.clear()


async def _resolve(conn, track_id=1, session_id="sess-1", **overrides):
    kwargs = dict(
        enrolled_threshold=0.75, visitor_threshold=0.60, match_margin=0.08,
    )
    kwargs.update(overrides)
    embedding = np.random.rand(512).astype(np.float32)
    return await face_resolver.resolve(
        conn, session_id, track_id, embedding, quality=0.8,
        camera_id=None, track_segment_id=None, refined_face_bbox=None, **kwargs,
    )


async def test_resolve_tags_enrolled_above_high_threshold():
    person_id = uuid4()
    conn = _FakeConn([_row(person_id, 0.90)])

    resolved_id, tag, similarity = await _resolve(conn)

    assert resolved_id == person_id
    assert tag == "enrolled"
    assert similarity == 0.90


async def test_resolve_tags_visitor_between_thresholds():
    person_id = uuid4()
    conn = _FakeConn([_row(person_id, 0.65)])

    resolved_id, tag, _similarity = await _resolve(conn)

    assert resolved_id == person_id
    assert tag == "visitor"


async def test_resolve_tags_unknown_below_visitor_threshold():
    person_id = uuid4()
    conn = _FakeConn([_row(person_id, 0.40)])

    resolved_id, tag, _similarity = await _resolve(conn)

    assert resolved_id is None
    assert tag == "unknown"


async def test_resolve_tags_unknown_when_margin_insufficient():
    p1, p2 = uuid4(), uuid4()
    conn = _FakeConn([_row(p1, 0.80), _row(p2, 0.78)])  # margin 0.02 < required 0.08

    resolved_id, tag, _similarity = await _resolve(conn)

    assert resolved_id is None
    assert tag == "unknown"


async def test_resolve_excludes_person_bound_to_a_different_alive_track():
    """Spatial exclusivity, shared with body Re-ID: a person already bound to
    a DIFFERENT currently-alive track in this session must never be handed
    to a second track, even with a high score."""
    person_id = uuid4()
    reid_resolver._alive_bindings["sess-1"] = {2: str(person_id)}  # bound to track 2
    conn = _FakeConn([_row(person_id, 0.90)])

    resolved_id, tag, _similarity = await _resolve(conn, track_id=1)  # a different track

    assert resolved_id is None
    assert tag == "unknown"


async def test_resolve_always_logs_the_embedding_even_when_unknown():
    conn = _FakeConn([])

    await _resolve(conn)

    assert len(conn.executed) == 1
    assert "INSERT INTO face_embeddings" in conn.executed[0][0]
