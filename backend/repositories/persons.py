"""
Person identity repository.

Phase 1 has no Re-ID yet (Phase 2) — tracks are labelled `W-<track_id>`
exactly like the old `alerts.py::_worker_label()` did, just persisted as a
real `persons` row instead of a synthesized string. Phase 2's resolver will
replace `get_or_create_by_track_label` with real embedding-based matching;
everything downstream (compliance_events.person_id, reports) already points
at `persons.id`, so that swap doesn't touch the tables built here.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

import asyncpg

from db import get_pool

LEGACY_SENTINEL_LABEL = "W-LEGACY"


async def get_or_create_by_track_label(conn: asyncpg.Connection, track_id: int | None) -> UUID:
    """Session-scoped label, not a real cross-session identity (pre-Re-ID
    behaviour, matches the old alerts.py::_worker_label docstring)."""
    label = f"W-{track_id}" if track_id is not None and track_id >= 0 else "W-unknown"
    row = await conn.fetchrow("SELECT id FROM persons WHERE label = $1", label)
    if row:
        await conn.execute("UPDATE persons SET last_seen_at = now() WHERE id = $1", row["id"])
        return row["id"]
    return await conn.fetchval(
        """
        INSERT INTO persons (label, source, status, first_seen_at, last_seen_at)
        VALUES ($1, 'auto_discovered', 'active', now(), now())
        RETURNING id
        """,
        label,
    )


async def get_or_create_legacy_sentinel(conn: asyncpg.Connection) -> UUID:
    """One inactive sentinel person that all pre-Re-ID JSON history attaches
    to (see scripts/import_json_stores.py and SCHEMA_DEEP_DIVE.md §4) — the
    legacy `workerId` values (`W-19`, ...) are per-session tracker labels with
    no cross-session meaning, so importing one `persons` row per distinct
    label would fabricate identities that never existed and would pollute
    every person-wise report with fake people."""
    row = await conn.fetchrow("SELECT id FROM persons WHERE label = $1", LEGACY_SENTINEL_LABEL)
    if row:
        return row["id"]
    return await conn.fetchval(
        """
        INSERT INTO persons (label, name, source, status, first_seen_at, last_seen_at)
        VALUES ($1, 'Unattributed (pre-Re-ID import)', 'legacy_import', 'inactive', now(), now())
        RETURNING id
        """,
        LEGACY_SENTINEL_LABEL,
    )


async def search(query: str | None = None, limit: int = 20) -> list[dict[str, Any]]:
    """Typeahead for the Phase 3 person picker — excludes merged/legacy rows."""
    pool = get_pool()
    if query:
        rows = await pool.fetch(
            """
            SELECT id, label, name, department FROM persons
            WHERE status = 'active' AND (label ILIKE $1 OR name ILIKE $1)
            ORDER BY label LIMIT $2
            """,
            f"%{query}%", limit,
        )
    else:
        rows = await pool.fetch(
            "SELECT id, label, name, department FROM persons WHERE status = 'active' ORDER BY label LIMIT $1",
            limit,
        )
    return [
        {"id": str(r["id"]), "label": r["label"], "name": r["name"], "department": r["department"]}
        for r in rows
    ]
