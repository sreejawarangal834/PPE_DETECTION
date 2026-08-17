"""
Embedding -> stable person_id.

Two halves, deliberately split by where they run:

1. In-process, per-track aggregation (`accumulate`/`mark_resolved`/`forget_track`) — pure
   Python/numpy, no I/O, called directly from the inference path (main.py) once per
   quality-gated crop. Cheap enough to run inline; never touches the DB.
2. `resolve_or_create` — the actual gallery match/create, which needs the DB. This is only
   ever invoked from repositories/writer.py's single writer_task consumer (never directly from
   an inference call site), which has two consequences worth being explicit about:
   - It's already off the inference hot path (the queue absorbs the latency), consistent with
     every other DB write in this app.
   - It naturally closes the TOCTOU race SCHEMA_DEEP_DIVE.md §1.7 flags ("two concurrent
     sessions can both miss the gallery for the same person and both try to create a new
     person row"): because there is exactly ONE writer_task coroutine and it processes the
     queue strictly serially, two "create a new person" decisions can never execute
     concurrently regardless of how many detection sessions are producing reid_resolve events.
     An explicit `pg_advisory_xact_lock` would be redundant here, not incremental safety — it's
     only needed if this ever becomes multiple writer processes, which it deliberately isn't
     (see writer.py's docstring on why there's exactly one consumer).

Anti-fragmentation policy (SCHEMA_DEEP_DIVE.md §1.7): resolve at 3 good samples, re-verify at 8;
persist only the track's aggregated centroid, not every raw sample; require a similarity margin
over the next-best different person, not just an absolute threshold; never write to the gallery
on an ambiguous/below-threshold match (that's the actual drift mechanism); spatial exclusivity —
a person already bound to a different currently-alive track in the same session is skipped.

Honest risk (flagged, not silently patched over — see SCHEMA_DEEP_DIVE.md §1.7 and the final
report): OSNet is trained on street-pedestrian Re-ID; this domain is industrial PPE with
matching uniforms/helmets/hi-vis vests on what may be a single fixed camera. Cosine separation
between different workers in matching PPE may be materially worse than the datasets OSNet was
benchmarked on. The thresholds below are defaults to calibrate against real footage, not
evidence-based numbers yet — see the Phase 2 section of the final report.
"""

from __future__ import annotations

import logging
import os
import re
from dataclasses import dataclass, field
from typing import Any

import asyncpg
import numpy as np

log = logging.getLogger("ppe_backend.reid.resolver")

MATCH_THRESHOLD = float(os.environ.get("PPE_REID_MATCH_THRESHOLD", "0.75"))
MATCH_MARGIN = float(os.environ.get("PPE_REID_MATCH_MARGIN", "0.08"))
NEW_THRESHOLD = float(os.environ.get("PPE_REID_NEW_THRESHOLD", "0.60"))
ENROLLED_MATCH_THRESHOLD = float(os.environ.get("PPE_REID_ENROLLED_MATCH_THRESHOLD", "0.82"))

RESOLVE_AT_SAMPLES = 3
REVERIFY_AT_SAMPLES = 8
MAX_SAMPLES_PER_TRACK = 8
MIN_SECONDS_BETWEEN_SAMPLES = 1.0
GALLERY_CAP_PER_PERSON = 20

TrackKey = tuple[str, int, int]  # (session_id as str, loop_index, track_id)


@dataclass
class _TrackAgg:
    embeddings: list[tuple[np.ndarray, float]] = field(default_factory=list)
    last_sample_at: float = 0.0
    resolved_person_id: str | None = None
    reverified: bool = False


_tracks: dict[TrackKey, _TrackAgg] = {}
# Best-effort "who's currently bound to a live track in this session" map, for the spatial
# exclusivity rule. Approximate (not expired on track death) by design — see resolve_or_create.
_alive_bindings: dict[str, dict[int, str]] = {}  # session_id -> {track_id: person_id}


def _centroid(samples: list[tuple[np.ndarray, float]]) -> np.ndarray:
    vecs = np.stack([e for e, _ in samples])
    weights = np.array([max(q, 1e-6) for _, q in samples], dtype=np.float32)
    weights = weights / weights.sum()
    c = (vecs * weights[:, None]).sum(axis=0)
    norm = np.linalg.norm(c)
    return (c / norm) if norm > 0 else c


def accumulate(key: TrackKey, now: float, embedding: np.ndarray, quality: float) -> tuple[bool, np.ndarray | None, bool]:
    """Call once per quality-gated crop. Returns (should_resolve, centroid, is_reverify)."""
    agg = _tracks.setdefault(key, _TrackAgg())
    if now - agg.last_sample_at < MIN_SECONDS_BETWEEN_SAMPLES:
        return False, None, False
    if len(agg.embeddings) >= MAX_SAMPLES_PER_TRACK:
        return False, None, False
    agg.last_sample_at = now
    agg.embeddings.append((embedding, quality))
    n = len(agg.embeddings)
    if n == RESOLVE_AT_SAMPLES and agg.resolved_person_id is None:
        return True, _centroid(agg.embeddings), False
    if n == REVERIFY_AT_SAMPLES and not agg.reverified:
        agg.reverified = True
        return True, _centroid(agg.embeddings), True
    return False, None, False


def mark_resolved(key: TrackKey, person_id: str) -> None:
    agg = _tracks.get(key)
    if agg is not None:
        agg.resolved_person_id = person_id
    _alive_bindings.setdefault(key[0], {})[key[2]] = person_id


def forget_track(key: TrackKey) -> None:
    _tracks.pop(key, None)


def forget_session(session_id: str) -> None:
    _alive_bindings.pop(session_id, None)
    for k in [k for k in _tracks if k[0] == session_id]:
        _tracks.pop(k, None)


def _vector_literal(vec: np.ndarray) -> str:
    return "[" + ",".join(f"{v:.6f}" for v in vec.tolist()) + "]"


async def _next_label(conn: asyncpg.Connection) -> str:
    row = await conn.fetchval(
        r"SELECT max((regexp_match(label, '^W-(\d{4,})$'))[1]::int) FROM persons WHERE source = 'auto_discovered'"
    )
    return f"W-{(row or 0) + 1:04d}"


async def _add_embedding(
    conn: asyncpg.Connection, person_id: Any, embedding: np.ndarray, quality: float,
    camera_id: Any, track_segment_id: Any, is_centroid: bool,
) -> None:
    literal = _vector_literal(embedding)
    count = await conn.fetchval("SELECT count(*) FROM person_embeddings WHERE person_id = $1", person_id)
    if count >= GALLERY_CAP_PER_PERSON:
        # Evict the lowest-quality non-enrollment row to make room (SCHEMA_DEEP_DIVE.md §1.5)
        # — never evict a person's onboarding photos.
        await conn.execute(
            """
            DELETE FROM person_embeddings WHERE id = (
                SELECT id FROM person_embeddings
                WHERE person_id = $1 AND source != 'enrollment'
                ORDER BY quality ASC LIMIT 1
            )
            """,
            person_id,
        )
    await conn.execute(
        """
        INSERT INTO person_embeddings (person_id, embedding, quality, source, is_centroid, camera_id, track_segment_id, captured_at)
        VALUES ($1, $2::vector, $3, 'track_aggregate', $4, $5, $6, now())
        """,
        person_id, literal, quality, is_centroid, camera_id, track_segment_id,
    )
    # Fast-path centroid on the person row itself (SCHEMA_DEEP_DIVE.md §1.3): a plain average
    # of that person's current gallery (pgvector's built-in `avg(vector)` aggregate, available
    # since pgvector 0.7 — confirmed working against this box's 0.8.6 install), recomputed
    # after every insert/evict so it never drifts out of sync with the gallery it summarises.
    # Not quality-weighted (a deliberate simplification over a true running weighted mean,
    # which would need vector-scalar arithmetic this pgvector version's SQL syntax makes
    # needlessly fragile to hand-roll) — lets identity resolution try one indexed row before
    # falling through to the full gallery scan.
    await conn.execute(
        """
        UPDATE persons SET
            centroid_embedding = (SELECT avg(embedding) FROM person_embeddings WHERE person_id = $1),
            embedding_count = embedding_count + 1,
            last_seen_at = now()
        WHERE id = $1
        """,
        person_id,
    )


async def resolve_or_create(
    conn: asyncpg.Connection, session_id: str, track_id: int, centroid: np.ndarray, quality: float,
    camera_id: Any, track_segment_id: Any,
) -> Any:
    """The actual gallery match/create — see module docstring for why this is safe to call
    without an explicit advisory lock despite the TOCTOU concern SCHEMA_DEEP_DIVE.md §1.7
    raises for a naively-concurrent version of this function."""
    literal = _vector_literal(centroid)
    rows = await conn.fetch(
        """
        WITH knn AS (
            SELECT pe.person_id, 1 - (pe.embedding <=> $1::vector) AS similarity
            FROM person_embeddings pe
            ORDER BY pe.embedding <=> $1::vector
            LIMIT 20
        ),
        ranked AS (
            SELECT k.person_id, k.similarity, p.source,
                   row_number() OVER (PARTITION BY k.person_id ORDER BY k.similarity DESC) AS rn
            FROM knn k JOIN persons p ON p.id = k.person_id
            WHERE p.status = 'active'
        )
        SELECT person_id, avg(similarity) FILTER (WHERE rn <= 3) AS score,
               count(*) AS hits, min(source) AS any_enrolled
        FROM ranked GROUP BY person_id ORDER BY score DESC LIMIT 5
        """,
        literal,
    )
    all_candidates = [(r["person_id"], float(r["score"]), r["any_enrolled"]) for r in rows if r["score"] is not None]

    # Spatial exclusivity FIRST (SCHEMA_DEEP_DIVE.md §1.7's single highest-value anti-mis-merge
    # rule): a person already bound to a different currently-alive track in this session is
    # not a usable candidate at all — not "ambiguous", genuinely not eligible — so it must be
    # filtered out before the match/ambiguous/create decision, not just skipped-then-fallen-
    # back-to using the raw (still-excluded) top score, which would wrongly leave an
    # excluded-but-high-scoring track unresolved instead of correctly minting a new person.
    bindings = _alive_bindings.get(session_id, {})
    candidates = [
        (pid, score, source) for pid, score, source in all_candidates
        if not any(tid != track_id and p == str(pid) for tid, p in bindings.items())
    ]

    if candidates:
        pid, score, source = candidates[0]
        threshold = ENROLLED_MATCH_THRESHOLD if source == "enrolled" else MATCH_THRESHOLD
        second = candidates[1][1] if len(candidates) > 1 else None
        margin_ok = second is None or (score - second) >= MATCH_MARGIN
        if score >= threshold and margin_ok:
            log.info(
                "Re-ID matched existing person %s for session=%s track=%s (score=%.3f, margin=%s)",
                pid, session_id, track_id, score,
                f"{score - second:.3f}" if second is not None else "n/a",
            )
            await _add_embedding(conn, pid, centroid, quality, camera_id, track_segment_id, is_centroid=False)
            return pid
        if score >= NEW_THRESHOLD:
            # Ambiguous — per SCHEMA_DEEP_DIVE.md §1.7, leave unresolved and never write to the
            # gallery here (that's the actual drift mechanism: one wrong match pulls a
            # centroid toward the wrong person, making the next wrong match easier).
            log.info(
                "Re-ID ambiguous for session=%s track=%s: top usable score=%.3f margin_ok=%s",
                session_id, track_id, score, margin_ok,
            )
            return None

    label = await _next_label(conn)
    new_id = await conn.fetchval(
        """
        INSERT INTO persons (label, source, status, first_seen_at, last_seen_at)
        VALUES ($1, 'auto_discovered', 'active', now(), now())
        RETURNING id
        """,
        label,
    )
    await _add_embedding(conn, new_id, centroid, quality, camera_id, track_segment_id, is_centroid=True)
    log.info("Re-ID created new person %s (%s) for session=%s track=%s", new_id, label, session_id, track_id)
    return new_id
