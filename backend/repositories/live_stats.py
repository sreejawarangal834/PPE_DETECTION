"""
Real, live-computed replacement for src/lib/websocket/mockWebSocketService.ts's fabricated
zone_compliance_update / top_zones_update event streams — see Task 2 of the fake-frontend
audit. Backs GET /api/analytics/live-stats.

Honest metric definition (documented, not hidden): there is still no "violation CLEARED"
write anywhere in this pipeline (same gap already disclosed in repositories/persons.py's and
repositories/reports.py's docstrings), so a true duration-weighted "% of time compliant" can't
be computed from compliance_events alone. `compliancePercent` below reuses the exact same
proxy repositories/reports.py already established and disclosed: one detection_sessions row a
person was tracked in, within a zone, counts as one "session"; a zone's compliance% is the
share of that zone's sessions (in the requested window) with zero violations. Real, derived
from actual tracked presence — not a duration rate, and not fabricated.
"""

from __future__ import annotations

from datetime import timedelta
from typing import Any

from db import get_pool

_ZONE_STATS_SQL = """
    SELECT
        z.id, z.slug, z.name,
        count(DISTINCT ts.id) AS total_sessions,
        count(DISTINCT ts.id) FILTER (
            WHERE NOT EXISTS (
                SELECT 1 FROM compliance_events ce2
                WHERE ce2.track_segment_id = ts.id AND ce2.state = 'violation'
            )
        ) AS compliant_sessions,
        count(ce.id) FILTER (WHERE ce.state = 'violation') AS violations,
        count(DISTINCT ts.person_id) AS workers_seen
    FROM zones z
    LEFT JOIN cameras c ON c.zone_id = z.id
    LEFT JOIN detection_sessions ds ON ds.camera_id = c.id AND ds.started_at >= now() - $1::int * interval '1 minute'
    LEFT JOIN track_segments ts ON ts.session_id = ds.id
    LEFT JOIN compliance_events ce ON ce.track_segment_id = ts.id
    WHERE z.active
    GROUP BY z.id, z.slug, z.name
    ORDER BY violations DESC
"""


async def get_zone_stats(window_minutes: int = 60) -> list[dict[str, Any]]:
    pool = get_pool()
    rows = await pool.fetch(_ZONE_STATS_SQL, window_minutes)
    out = []
    for r in rows:
        total = r["total_sessions"] or 0
        compliant = r["compliant_sessions"] or 0
        compliance_percent = round(100.0 * compliant / total, 0) if total else None
        out.append({
            "zoneId": r["slug"],
            "zoneName": r["name"],
            "compliancePercent": compliance_percent,
            "violations": r["violations"] or 0,
            "workersSeen": r["workers_seen"] or 0,
        })
    return out


async def get_overall_compliance(window_minutes: int = 240) -> int | None:
    """Site-wide equivalent of get_zone_stats's per-zone number, same proxy definition."""
    pool = get_pool()
    row = await pool.fetchrow(
        """
        SELECT
            count(DISTINCT ts.id) AS total_sessions,
            count(DISTINCT ts.id) FILTER (
                WHERE NOT EXISTS (
                    SELECT 1 FROM compliance_events ce2
                    WHERE ce2.track_segment_id = ts.id AND ce2.state = 'violation'
                )
            ) AS compliant_sessions
        FROM detection_sessions ds
        JOIN track_segments ts ON ts.session_id = ds.id
        WHERE ds.started_at >= now() - $1::int * interval '1 minute'
        """,
        window_minutes,
    )
    total = row["total_sessions"] or 0
    if not total:
        return None
    return round(100.0 * (row["compliant_sessions"] or 0) / total)


async def get_violation_timeline(window_minutes: int = 60, bucket_minutes: int = 5) -> list[dict[str, Any]]:
    """Site-wide violation count per time bucket over the trailing window — real counts from
    compliance_events, not Math.random()."""
    pool = get_pool()
    rows = await pool.fetch(
        """
        SELECT date_bin($2::interval, started_at, TIMESTAMPTZ '2000-01-01') AS bucket,
               count(*) AS violations
        FROM compliance_events
        WHERE state = 'violation' AND started_at >= now() - $1::interval
        GROUP BY bucket ORDER BY bucket
        """,
        timedelta(minutes=window_minutes), timedelta(minutes=bucket_minutes),
    )
    return [{"t": r["bucket"].strftime("%H:%M"), "violations": r["violations"]} for r in rows]
