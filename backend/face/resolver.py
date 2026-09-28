"""
Face embedding -> global person_id.

Reuses the SAME `persons` identity table body Re-ID already established
(reid/resolver.py) rather than a second parallel identity table — a
person recognized by face and a person recognized by body converge on
one global ID when they're the same human. Only the matching/tagging
logic is new here.

The per-track "is this worth resolving right now" decision lives in
face/sampling.py (this module only ever runs once that has already said
yes). The actual DB write always happens off the inference hot path, from
repositories/writer.py's single writer_task consumer — same reasoning
and the same TOCTOU-is-a-non-issue argument as reid/resolver.py's module
docstring (there is exactly one serial writer, so two concurrent
"create a new person" decisions can never race).

Deliberate difference from reid/resolver.py: a below-threshold face does
NOT auto-create a new person. Adapted from Innovision-multiAnalytics'
recognition service (services/recognition/src/consumer.py), which treats
"unknown" as a real, honest outcome rather than silently minting a global
identity from every stranger's face glimpse — enrollment is a deliberate
action, not an automatic side effect of a low-confidence sighting. This
also keeps the `identity_tag` column meaningful for reporting: 'unknown'
genuinely means "we could not attribute this to anyone."

`_alive_bindings` / `mark_resolved` / `_vector_literal` are reused
directly from reid/resolver.py: a track's identity binding is
modality-agnostic, so body and face resolution share the same
bookkeeping and can never assign the same currently-alive track to two
different people.
"""

from __future__ import annotations

import json
import logging
from typing import Any

import asyncpg
import numpy as np

from reid.resolver import _alive_bindings, _vector_literal, mark_resolved

log = logging.getLogger("ppe_backend.face.resolver")


async def resolve(
    conn: asyncpg.Connection,
    session_id: str,
    track_id: int,
    embedding: np.ndarray,
    quality: float,
    camera_id: Any,
    track_segment_id: Any,
    refined_face_bbox: dict | None,
    enrolled_threshold: float,
    visitor_threshold: float,
    match_margin: float,
) -> tuple[Any | None, str, float]:
    """
    One face-resolution attempt. Returns (person_id_or_None, identity_tag,
    similarity).

    identity_tag is one of:
      'enrolled' — matched a source='enrolled' person at/above enrolled_threshold.
      'visitor'  — matched some existing person, but only at/above visitor_threshold.
      'unknown'  — no usable match (see module docstring for why this does
                   not create a new person row).
    """
    literal = _vector_literal(embedding)
    rows = await conn.fetch(
        """
        WITH knn AS (
            SELECT fe.person_id, 1 - (fe.embedding <=> $1::vector) AS similarity
            FROM face_embeddings fe
            WHERE fe.person_id IS NOT NULL
            ORDER BY fe.embedding <=> $1::vector
            LIMIT 20
        ),
        ranked AS (
            SELECT k.person_id, k.similarity, p.source,
                   row_number() OVER (PARTITION BY k.person_id ORDER BY k.similarity DESC) AS rn
            FROM knn k JOIN persons p ON p.id = k.person_id
            WHERE p.status = 'active'
        )
        SELECT person_id, avg(similarity) FILTER (WHERE rn <= 3) AS score, min(source) AS source
        FROM ranked GROUP BY person_id ORDER BY score DESC LIMIT 5
        """,
        literal,
    )
    all_candidates = [(r["person_id"], float(r["score"]), r["source"]) for r in rows if r["score"] is not None]

    # Spatial exclusivity, shared with body Re-ID (see module docstring): a
    # person already bound to a DIFFERENT currently-alive track in this
    # session is not a usable candidate, regardless of score.
    bindings = _alive_bindings.get(session_id, {})
    candidates = [
        (pid, score, source) for pid, score, source in all_candidates
        if not any(tid != track_id and p == str(pid) for tid, p in bindings.items())
    ]

    person_id: Any | None = None
    identity_tag = "unknown"
    similarity = candidates[0][1] if candidates else 0.0

    if candidates:
        pid, score, _source = candidates[0]
        second = candidates[1][1] if len(candidates) > 1 else None
        margin_ok = second is None or (score - second) >= match_margin
        if margin_ok and score >= enrolled_threshold:
            person_id, identity_tag, similarity = pid, "enrolled", score
        elif margin_ok and score >= visitor_threshold:
            person_id, identity_tag, similarity = pid, "visitor", score

    await _add_embedding(conn, person_id, embedding, quality, camera_id, track_segment_id, refined_face_bbox)

    if person_id is not None:
        mark_resolved((session_id, 0, track_id), str(person_id))
        log.info(
            "face_resolved session=%s track=%s person=%s tag=%s similarity=%.3f",
            session_id, track_id, person_id, identity_tag, similarity,
        )
    else:
        log.info("face_unresolved session=%s track=%s best_similarity=%.3f", session_id, track_id, similarity)

    return person_id, identity_tag, similarity


async def _add_embedding(
    conn: asyncpg.Connection,
    person_id: Any | None,
    embedding: np.ndarray,
    quality: float,
    camera_id: Any,
    track_segment_id: Any,
    refined_face_bbox: dict | None,
) -> None:
    """Always logs the attempt, including unknown (person_id NULL)
    matches — matches the reference's own reasoning for a nullable FK: a
    growing log of unmatched sightings is useful for later enrollment
    review, even though this increment doesn't build that admin flow.
    Excluded from the KNN search above (WHERE person_id IS NOT NULL) so
    two different unmatched strangers can never spuriously match each
    other into a shared identity."""
    literal = _vector_literal(embedding)
    refined_json = json.dumps(refined_face_bbox) if refined_face_bbox is not None else None
    await conn.execute(
        """
        INSERT INTO face_embeddings
            (person_id, embedding, quality, is_enrollment, source_camera_id, track_segment_id, refined_face_bbox)
        VALUES ($1, $2::vector, $3, false, $4, $5, $6::jsonb)
        """,
        person_id, literal, quality, camera_id, track_segment_id, refined_json,
    )
