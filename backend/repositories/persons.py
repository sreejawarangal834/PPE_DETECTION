"""
Person identity repository.

Phase 1 has no Re-ID yet (Phase 2) — tracks are labelled `W-<track_id>`
exactly like the old `alerts.py::_worker_label()` did, just persisted as a
real `persons` row instead of a synthesized string. Phase 2's resolver will
replace `get_or_create_by_track_label` with real embedding-based matching;
everything downstream (compliance_events.person_id, reports) already points
at `persons.id`, so that swap doesn't touch the tables built here.

Phase 3 adds `get_compliance_detail` for the per-person report (§6.1). Every
query below builds its WHERE clause by appending predicates only for filters
actually supplied (SCHEMA_DEEP_DIVE.md §3), instead of the plan's
`($n IS NULL OR ...)` pattern — the latter forces Postgres to plan one
generic query that has to work for every possible combination of
NULL/non-NULL filters rather than a plan tailored to what was actually
asked, which shows up as a real cost once the tables aren't tiny.

Honest scope note (documented rather than silently glossed over): true
"compliance-rate over time" (SCHEMA_DEEP_DIVE.md §6.1's trend query, driven
by `person_daily_compliance.compliant_seconds/violation_seconds`) needs a
"violation CLEARED" write that closes out `compliance_events.ended_at` /
`duration_seconds` — Phase 1/2 only ever write the RAISE side of a violation
(`compliance.py`'s hysteresis knows when a violation clears, but nothing
currently persists that transition; see writer.py — a "clear" event kind
would be the natural extension). Until that exists, `person_daily_compliance`
stays empty and any duration-weighted rate computed from it would be
fabricated, not measured. The trend below is therefore a real, defensible
substitute — a violation-COUNT trend per day, computed live from
`compliance_events.started_at` — not a duration-weighted rate. Wiring the
clear-event write and a nightly rollup into `person_daily_compliance` is the
concrete follow-up for a true rate trend.
"""

from __future__ import annotations

from datetime import date, datetime
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


async def get_person(person_id: str) -> dict[str, Any] | None:
    try:
        pid = UUID(person_id)
    except (ValueError, AttributeError, TypeError):
        return None
    pool = get_pool()
    row = await pool.fetchrow(
        "SELECT id, label, name, department, source, status FROM persons WHERE id = $1", pid,
    )
    if row is None:
        return None
    return {
        "id": str(row["id"]), "label": row["label"], "name": row["name"],
        "department": row["department"], "source": row["source"], "status": row["status"],
    }


async def get_compliance_detail(
    person_id: str,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    zone_ids: list[str] | None = None,   # zone SLUGS (frontend/API vocabulary, e.g. "z-assembly")
    ppe_types: list[str] | None = None,
    severities: list[str] | None = None,
) -> dict[str, Any] | None:
    """Violation timeline + per-zone breakdown + per-PPE breakdown + a violation-count trend
    for one person, all filtered by the same date range / zone / ppe-type / severity — see the
    module docstring for why the trend is count-based rather than a duration-weighted rate."""
    pool = get_pool()
    pid = await _parse_person_uuid(person_id)
    if pid is None:
        return None
    person = await get_person(person_id)
    if person is None:
        return None

    zone_uuids: list[UUID] | None = None
    if zone_ids:
        zone_uuids = [r["id"] for r in await pool.fetch("SELECT id FROM zones WHERE slug = ANY($1::text[])", zone_ids)]

    # ── Dynamic WHERE clause (SCHEMA_DEEP_DIVE.md §3) ─────────────────────────
    clauses = ["ce.person_id = $1", "ce.state = 'violation'"]
    params: list[Any] = [pid]

    def _add(clause_tmpl: str, value: Any) -> None:
        params.append(value)
        clauses.append(clause_tmpl.format(n=len(params)))

    if date_from is not None:
        _add("ce.started_at >= ${n}", date_from)
    if date_to is not None:
        _add("ce.started_at < ${n}", date_to)
    if zone_uuids:
        _add("ce.zone_id = ANY(${n}::uuid[])", zone_uuids)
    if ppe_types:
        _add("ce.ppe_type = ANY(${n}::ppe_type[])", ppe_types)
    if severities:
        _add("a.severity = ANY(${n}::alert_severity[])", severities)

    where_sql = " AND ".join(clauses)

    # Per-zone breakdown — "where is this person non-compliant?"
    per_zone = await pool.fetch(
        f"""
        SELECT z.slug AS zone_id, z.name AS zone_name, count(*) AS violations
        FROM compliance_events ce
        LEFT JOIN alerts a ON a.id = ce.alert_id
        JOIN zones z ON z.id = ce.zone_id
        WHERE {where_sql}
        GROUP BY z.slug, z.name
        ORDER BY violations DESC
        """,
        *params,
    )

    # Per-PPE breakdown — "what do they keep missing?"
    per_ppe = await pool.fetch(
        f"""
        SELECT ce.ppe_type, count(*) AS violations, max(ce.started_at) AS last_seen
        FROM compliance_events ce
        LEFT JOIN alerts a ON a.id = ce.alert_id
        WHERE {where_sql}
        GROUP BY ce.ppe_type
        ORDER BY violations DESC
        """,
        *params,
    )

    # Violation-count trend (see module docstring — NOT a duration-weighted rate)
    trend = await pool.fetch(
        f"""
        SELECT date_trunc('day', ce.started_at)::date AS day, count(*) AS violations
        FROM compliance_events ce
        LEFT JOIN alerts a ON a.id = ce.alert_id
        WHERE {where_sql}
        GROUP BY day
        ORDER BY day
        """,
        *params,
    )

    # Timeline (most-recent-first, capped — this is a detail panel, not an export)
    timeline = await pool.fetch(
        f"""
        SELECT ce.id, ce.ppe_type, ce.confidence, ce.started_at,
               z.slug AS zone_id, z.name AS zone_name, c.code AS camera_code,
               a.severity, a.status AS alert_status
        FROM compliance_events ce
        LEFT JOIN alerts a ON a.id = ce.alert_id
        LEFT JOIN zones z ON z.id = ce.zone_id
        LEFT JOIN cameras c ON c.id = ce.camera_id
        WHERE {where_sql}
        ORDER BY ce.started_at DESC
        LIMIT 200
        """,
        *params,
    )

    return {
        "person": person,
        "perZone": [
            {"zoneId": r["zone_id"], "zoneName": r["zone_name"], "violations": r["violations"]} for r in per_zone
        ],
        "perPpe": [
            {"ppeType": r["ppe_type"], "violations": r["violations"],
             "lastSeen": r["last_seen"].isoformat() if r["last_seen"] else None}
            for r in per_ppe
        ],
        "trend": [
            {"day": r["day"].isoformat() if isinstance(r["day"], date) else r["day"], "violations": r["violations"]}
            for r in trend
        ],
        "timeline": [
            {
                "id": str(r["id"]), "ppeType": r["ppe_type"],
                "confidence": round(float(r["confidence"]), 2) if r["confidence"] is not None else None,
                "startedAt": r["started_at"].isoformat(),
                "zoneId": r["zone_id"], "zoneName": r["zone_name"], "cameraCode": r["camera_code"],
                "severity": r["severity"], "alertStatus": r["alert_status"],
            }
            for r in timeline
        ],
    }


async def _parse_person_uuid(person_id: str) -> UUID | None:
    try:
        return UUID(person_id)
    except (ValueError, AttributeError, TypeError):
        return None
