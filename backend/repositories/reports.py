"""
The paginated `GET /api/reports/workers` table (IMPLEMENTATION_PLAN.md §6.1) — backs the
existing `getWorkerComplianceReport()` contract in src/api/reportsApi.ts unchanged.

Honest scope note: there is no "shift" concept anywhere in this schema (no shift-roster
table, no shift-boundary config) — the frontend's `WorkerComplianceRow.totalShifts` /
`compliantShifts` predates any real data model. Rather than fabricate shift boundaries, this
repository treats one `detection_sessions` row a person appears in (via `track_segments`) as
one countable "shift": `totalShifts` = distinct sessions the person was tracked in,
`compliantShifts` = distinct sessions in which that person had zero violations. This is real,
derived from actual tracked presence, not invented — but it is a substitution for a genuine
shift concept, not an implementation of one; documented here so it isn't mistaken for the
real thing later.
"""

from __future__ import annotations

from typing import Any

import asyncpg

from db import get_pool


async def get_worker_compliance_rows(
    zones: list[str] | None = None,          # zone slugs
    departments: list[str] | None = None,
    threshold_below: float | None = None,
    page: int = 1,
    page_size: int = 25,
) -> dict[str, Any]:
    pool = get_pool()

    zone_uuids: list[Any] | None = None
    if zones:
        zone_uuids = [r["id"] for r in await pool.fetch("SELECT id FROM zones WHERE slug = ANY($1::text[])", zones)]

    # ── Dynamic WHERE (SCHEMA_DEEP_DIVE.md §3) — only append a predicate for a filter that
    # was actually supplied, so Postgres can plan around what's really being asked instead of
    # one generic plan that has to cover every NULL/non-NULL combination.
    clauses = ["p.status = 'active'"]
    params: list[Any] = []

    def _add(clause_tmpl: str, value: Any) -> None:
        params.append(value)
        clauses.append(clause_tmpl.format(n=len(params)))

    if departments:
        _add("p.department = ANY(${n}::text[])", departments)
    if zone_uuids:
        _add(
            "EXISTS (SELECT 1 FROM compliance_events cez "
            "JOIN track_segments tsz ON tsz.id = cez.track_segment_id "
            "WHERE tsz.person_id = p.id AND cez.zone_id = ANY(${n}::uuid[]))",
            zone_uuids,
        )
    where_sql = " AND ".join(clauses)

    agg_sql = f"""
        WITH agg AS (
            SELECT
                p.id, p.label, p.name, p.department,
                count(DISTINCT ts.session_id) AS total_shifts,
                count(DISTINCT ts.session_id) FILTER (
                    WHERE NOT EXISTS (
                        SELECT 1 FROM compliance_events ce2
                        WHERE ce2.track_segment_id = ts.id AND ce2.state = 'violation'
                    )
                ) AS compliant_shifts,
                count(ce.id) FILTER (WHERE ce.state = 'violation') AS violation_count,
                max(ce.started_at) FILTER (WHERE ce.state = 'violation') AS last_violation_at,
                (
                    SELECT ce3.ppe_type FROM compliance_events ce3
                    JOIN track_segments ts3 ON ts3.id = ce3.track_segment_id
                    WHERE ts3.person_id = p.id AND ce3.state = 'violation'
                    GROUP BY ce3.ppe_type ORDER BY count(*) DESC LIMIT 1
                ) AS top_ppe
            FROM persons p
            JOIN track_segments ts ON ts.person_id = p.id
            LEFT JOIN compliance_events ce ON ce.track_segment_id = ts.id
            WHERE {where_sql}
            GROUP BY p.id
        ),
        rated AS (
            SELECT *,
                CASE WHEN total_shifts = 0 THEN NULL
                     ELSE round(100.0 * compliant_shifts / total_shifts, 1)
                END AS compliance_rate
            FROM agg
        )
        SELECT * FROM rated
        WHERE ($__threshold::float IS NULL OR (total_shifts > 0 AND compliance_rate < $__threshold::float))
    """
    # threshold_below is intentionally the one exception to "no ($n IS NULL OR ...)" — unlike
    # the zone/department/date filters above (which are set-membership predicates Postgres can
    # index/plan around directly), this one is a post-aggregation HAVING-style condition on a
    # value that only exists after GROUP BY, so there's no sargable index-friendly alternative
    # to express "optionally filter on a computed ratio" — the non-sargable-plan cost this
    # pattern normally risks doesn't apply here since the input to the filter is already a
    # fully aggregated, per-person row set, not a raw table scan.
    threshold_param_idx = len(params) + 1
    agg_sql = agg_sql.replace("$__threshold", f"${threshold_param_idx}")
    params_with_threshold = params + [threshold_below]

    count_row = await pool.fetchrow(f"SELECT count(*) AS total FROM ({agg_sql}) t", *params_with_threshold)
    total = count_row["total"]

    offset = max(page - 1, 0) * page_size
    rows = await pool.fetch(
        agg_sql + " ORDER BY compliance_rate ASC NULLS LAST, violation_count DESC LIMIT $%d OFFSET $%d"
        % (threshold_param_idx + 1, threshold_param_idx + 2),
        *params_with_threshold, page_size, offset,
    )

    data = [
        {
            "workerId": r["label"],
            "workerName": r["name"] or r["label"],
            "department": r["department"] or "",
            "totalShifts": r["total_shifts"],
            "compliantShifts": r["compliant_shifts"],
            "violationCount": r["violation_count"] or 0,
            "complianceRate": float(r["compliance_rate"]) if r["compliance_rate"] is not None else 0.0,
            "mostFrequentViolation": r["top_ppe"] or "",
            "lastViolationDate": r["last_violation_at"].isoformat() if r["last_violation_at"] else "",
        }
        for r in rows
    ]
    return {"data": data, "total": total}
