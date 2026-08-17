"""
Backs `src/api/workersApi.ts`'s `getWorkers`/`getWorkerById`/`getWorkerZoneLog` (the
`features/workers/` pages — WorkerListPage/WorkerProfilePage), matching `src/types/index.ts`'s
`Worker`/`WorkerZoneLog` shapes field-for-field so those components don't need to change.

Not itself one of IMPLEMENTATION_PLAN.md §6.1's three named endpoints (those are
persons/search, persons/{id}/compliance, reports/workers) — this exists because those pages
were still calling a mock API layer, and de-mocking `reportsApi.ts` without also de-mocking
`workersApi.ts` would have left one real data source (`persons`/`compliance_events`) presented
through two different APIs, one real and one still fabricated.

`currentZoneId`/`currentZoneName` are derived from the person's most recent `track_segments`
row's session's camera's zone (a camera is pinned to one zone — see cameras.py) — "current"
here means "most recently seen in", not a live presence signal (there's no separate "worker
walked out of frame" event to know they've actually left).
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from db import get_pool

_WORKER_BASE_SQL = """
    SELECT
        p.id, p.label, p.name, p.department, p.last_seen_at,
        count(ce.id) FILTER (WHERE ce.state = 'violation') AS total_violations,
        count(DISTINCT ts.session_id) AS total_shifts,
        count(DISTINCT ts.session_id) FILTER (
            WHERE NOT EXISTS (
                SELECT 1 FROM compliance_events ce2
                WHERE ce2.track_segment_id = ts.id AND ce2.state = 'violation'
            )
        ) AS compliant_shifts,
        (
            SELECT z.slug FROM track_segments ts2
            JOIN detection_sessions ds2 ON ds2.id = ts2.session_id
            JOIN cameras c2 ON c2.id = ds2.camera_id
            JOIN zones z ON z.id = c2.zone_id
            WHERE ts2.person_id = p.id
            ORDER BY ts2.last_frame_at DESC LIMIT 1
        ) AS current_zone_slug,
        (
            SELECT z.name FROM track_segments ts2
            JOIN detection_sessions ds2 ON ds2.id = ts2.session_id
            JOIN cameras c2 ON c2.id = ds2.camera_id
            JOIN zones z ON z.id = c2.zone_id
            WHERE ts2.person_id = p.id
            ORDER BY ts2.last_frame_at DESC LIMIT 1
        ) AS current_zone_name,
        (
            SELECT array_agg(DISTINCT z.slug) FROM track_segments ts3
            JOIN detection_sessions ds3 ON ds3.id = ts3.session_id
            JOIN cameras c3 ON c3.id = ds3.camera_id
            JOIN zones z ON z.id = c3.zone_id
            WHERE ts3.person_id = p.id
        ) AS zones_visited
    FROM persons p
    LEFT JOIN track_segments ts ON ts.person_id = p.id
    LEFT JOIN compliance_events ce ON ce.track_segment_id = ts.id
    WHERE p.status = 'active'
"""


def _row_to_worker(r: Any) -> dict[str, Any]:
    total_shifts = r["total_shifts"] or 0
    compliant_shifts = r["compliant_shifts"] or 0
    compliance_rate = round(100.0 * compliant_shifts / total_shifts, 1) if total_shifts else 100.0
    return {
        "id": r["label"],
        "name": r["name"] or r["label"],
        "department": r["department"] or "",
        "currentZoneId": r["current_zone_slug"],
        "currentZoneName": r["current_zone_name"],
        "lastSeen": r["last_seen_at"].isoformat() if r["last_seen_at"] else "",
        "complianceRate": compliance_rate,
        "totalViolations": r["total_violations"] or 0,
        # No live "still actively out of compliance right now" signal exists yet (that would
        # need to read compliance.py's in-memory worker_states, which is per-session and not
        # exposed outside the WebSocket handler) — 0 is honest, not a placeholder guess.
        "activeViolations": 0,
        "zonesVisited": list(r["zones_visited"] or []),
    }


async def list_workers(
    search: str | None = None, zone: str | None = None, compliance: str | None = None,
) -> list[dict[str, Any]]:
    pool = get_pool()
    clauses: list[str] = []
    params: list[Any] = []

    def _add(clause_tmpl: str, value: Any) -> None:
        params.append(value)
        clauses.append(clause_tmpl.format(n=len(params)))

    if search:
        _add("(p.label ILIKE ${n} OR p.name ILIKE ${n})", f"%{search}%")

    sql = _WORKER_BASE_SQL + "".join(f" AND {c}" for c in clauses) + " GROUP BY p.id ORDER BY p.label"
    rows = await pool.fetch(sql, *params)
    workers = [_row_to_worker(r) for r in rows]

    # zone/compliance filters are computed post-aggregation (current zone, compliance rate) —
    # pushing these into SQL would need the same derived subqueries duplicated into a WHERE/
    # HAVING clause; filtering the already-small aggregated result in Python here is a
    # deliberate, bounded exception, not the zone-scoping/RBAC case SCHEMA_DEEP_DIVE.md §3
    # warns against (that's about not leaking row-existence across a security boundary; this
    # is a UI convenience filter over data the caller already fully sees).
    if zone:
        workers = [w for w in workers if w["currentZoneId"] == zone]
    if compliance == "compliant":
        workers = [w for w in workers if w["complianceRate"] >= 80]
    elif compliance == "non_compliant":
        workers = [w for w in workers if w["complianceRate"] < 80]
    return workers


async def get_worker(label_or_id: str) -> dict[str, Any] | None:
    pool = get_pool()
    try:
        pid = UUID(label_or_id)
        sql = _WORKER_BASE_SQL + " AND p.id = $1 GROUP BY p.id"
    except (ValueError, AttributeError, TypeError):
        pid = label_or_id
        sql = _WORKER_BASE_SQL + " AND p.label = $1 GROUP BY p.id"
    row = await pool.fetchrow(sql, pid)
    return _row_to_worker(row) if row else None


async def get_worker_zone_log(
    label_or_id: str, zone: str | None = None, page: int = 1, page_size: int = 25,
) -> dict[str, Any]:
    pool = get_pool()
    worker = await get_worker(label_or_id)
    if worker is None:
        return {"data": [], "total": 0, "page": page, "pageSize": page_size}

    clauses = ["p.label = $1"]
    params: list[Any] = [worker["id"]]

    def _add(clause_tmpl: str, value: Any) -> None:
        params.append(value)
        clauses.append(clause_tmpl.format(n=len(params)))

    if zone:
        _add("z.slug = ${n}", zone)
    where_sql = " AND ".join(clauses)

    sql = f"""
        SELECT ts.id, z.slug AS zone_id, z.name AS zone_name,
               ts.first_frame_at, ts.last_frame_at, ds.ended_at,
               EXISTS (
                   SELECT 1 FROM compliance_events ce
                   WHERE ce.track_segment_id = ts.id AND ce.state = 'violation'
               ) AS had_violation
        FROM track_segments ts
        JOIN persons p ON p.id = ts.person_id
        JOIN detection_sessions ds ON ds.id = ts.session_id
        LEFT JOIN cameras c ON c.id = ds.camera_id
        LEFT JOIN zones z ON z.id = c.zone_id
        WHERE {where_sql}
        ORDER BY ts.first_frame_at DESC
    """
    rows = await pool.fetch(sql, *params)
    total = len(rows)
    offset = max(page - 1, 0) * page_size
    page_rows = rows[offset:offset + page_size]

    def _fmt(r: Any) -> dict[str, Any]:
        still_open = r["ended_at"] is None
        duration_s = ((r["last_frame_at"] - r["first_frame_at"]).total_seconds())
        return {
            "workerId": worker["id"],
            "zoneId": r["zone_id"] or "",
            "zoneName": r["zone_name"] or "",
            "entryTime": r["first_frame_at"].isoformat(),
            "exitTime": None if still_open else r["last_frame_at"].isoformat(),
            "duration": "In zone" if still_open else f"{int(duration_s // 60)}m",
            "complianceStatus": "non_compliant" if r["had_violation"] else "compliant",
        }

    return {"data": [_fmt(r) for r in page_rows], "total": total, "page": page, "pageSize": page_size}
