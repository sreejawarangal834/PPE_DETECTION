"""
Alert read/ack/resolve repository — Postgres-backed replacement for the old
`alerts.py` JSON store. New violation writes go through repositories/writer.py
(the hot per-frame path); this module only serves the HTTP endpoints
(list/get/acknowledge/resolve), which are fine to `await` the pool directly
since they're not on the per-frame path.

Field mapping mirrors src/types/index.ts's `Alert` shape exactly (see
IMPLEMENTATION_PLAN.md §4.3 — row_to_api translates snake_case DB columns to
the camelCase shape the frontend already expects, unchanged).
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

import asyncpg

from db import get_pool


def _parse_uuid(value: str) -> UUID | None:
    try:
        return UUID(value)
    except (ValueError, AttributeError, TypeError):
        return None

# Gotcha #5 (IMPLEMENTATION_PLAN.md §9): JSON history used "open"; the
# platform's alert_status enum uses "pending". Translate at the API edge both
# ways so the frontend's AlertStatus type never has to learn a 5th value.
_STATUS_DB_TO_API = {
    "pending": "open",
    "acknowledged": "acknowledged",
    "in_progress": "acknowledged",
    "resolved": "resolved",
    "closed": "resolved",
}
_STATUS_API_TO_DB = {"open": "pending", "acknowledged": "acknowledged", "resolved": "resolved"}

_SELECT = """
    SELECT a.id, a.created_at, a.severity, a.status, a.metadata,
           a.acknowledged_by, a.acknowledged_at, a.resolved_by, a.resolved_at,
           c.code AS camera_code, z.slug AS zone_slug, z.name AS zone_name,
           ua.name AS acknowledged_by_name, ur.name AS resolved_by_name
    FROM alerts a
    LEFT JOIN cameras c ON c.id = a.camera_id
    LEFT JOIN zones z ON z.slug = a.metadata->>'zone_id'
    LEFT JOIN users ua ON ua.id = a.acknowledged_by
    LEFT JOIN users ur ON ur.id = a.resolved_by
    WHERE a.source_uc = 'uc3'
"""


def _row_to_api(row: asyncpg.Record) -> dict[str, Any]:
    meta = row["metadata"] or {}
    created_at: datetime = row["created_at"]
    label = meta.get("person_label", "W-unknown")
    return {
        "id": str(row["id"]),
        "createdAt": int(created_at.timestamp() * 1000),
        "timestamp": created_at.astimezone(timezone.utc).strftime("%H:%M:%S"),
        "cameraId": row["camera_code"] or "unassigned",
        "zoneId": row["zone_slug"] or meta.get("zone_id") or "",
        "zoneName": row["zone_name"] or "",
        "workerId": label,
        "workerName": label,
        "missingPpe": meta.get("missing_ppe", []),
        "confidence": round(float(meta.get("confidence") or 0.0), 2),
        "severity": row["severity"],
        "status": _STATUS_DB_TO_API.get(row["status"], row["status"]),
        **({"acknowledgedBy": row["acknowledged_by_name"]} if row["acknowledged_by_name"] else {}),
        **({"acknowledgedAt": row["acknowledged_at"].isoformat()} if row["acknowledged_at"] else {}),
        **({"resolvedBy": row["resolved_by_name"]} if row["resolved_by_name"] else {}),
        **({"resolvedAt": row["resolved_at"].isoformat()} if row["resolved_at"] else {}),
    }


async def list_alerts(
    severities: list[str] | None = None,
    zones: list[str] | None = None,
    statuses: list[str] | None = None,
    search: str | None = None,
) -> list[dict[str, Any]]:
    pool = get_pool()
    clauses: list[str] = []
    params: list[Any] = []

    def _add(clause: str, value: Any) -> None:
        params.append(value)
        clauses.append(clause.format(n=len(params)))

    if severities:
        _add("a.severity = ANY(${n}::alert_severity[])", severities)
    if zones:
        _add("a.metadata->>'zone_id' = ANY(${n}::text[])", zones)
    if statuses:
        db_statuses = [_STATUS_API_TO_DB.get(s, s) for s in statuses]
        _add("a.status = ANY(${n}::alert_status[])", db_statuses)
    if search:
        _add("(a.metadata->>'person_label' ILIKE ${n} OR COALESCE(z.name,'') ILIKE ${n})", f"%{search}%")

    sql = _SELECT + ("".join(f" AND {c}" for c in clauses)) + " ORDER BY a.created_at DESC"
    rows = await pool.fetch(sql, *params)
    return [_row_to_api(r) for r in rows]


async def get_alert(alert_id: str) -> dict[str, Any] | None:
    uid = _parse_uuid(alert_id)
    if uid is None:
        return None
    pool = get_pool()
    row = await pool.fetchrow(_SELECT + " AND a.id = $1", uid)
    return _row_to_api(row) if row else None


async def acknowledge(alert_id: str, actor_user_id: str | None, actor_name: str) -> dict[str, Any] | None:
    uid = _parse_uuid(alert_id)
    if uid is None:
        return None
    pool = get_pool()
    result = await pool.execute(
        """
        UPDATE alerts SET status='acknowledged', acknowledged_at=now(), acknowledged_by=$2
        WHERE id=$1
        """,
        uid, _parse_uuid(actor_user_id) if actor_user_id else None,
    )
    if result.split(" ")[-1] == "0":
        return None
    row = await get_alert(alert_id)
    if row is not None and actor_user_id is None:
        row["acknowledgedBy"] = actor_name  # no real user session yet (pre-Phase-4 auth)
    return row


async def resolve(alert_id: str, actor_user_id: str | None, actor_name: str, notes: str) -> dict[str, Any] | None:
    uid = _parse_uuid(alert_id)
    if uid is None:
        return None
    pool = get_pool()
    result = await pool.execute(
        """
        UPDATE alerts SET status='resolved', resolved_at=now(), resolved_by=$2,
               metadata = metadata || jsonb_build_object('resolution_notes', $3::text)
        WHERE id=$1
        """,
        uid, _parse_uuid(actor_user_id) if actor_user_id else None, notes,
    )
    if result.split(" ")[-1] == "0":
        return None
    row = await get_alert(alert_id)
    if row is not None:
        row["resolutionNotes"] = notes
        if actor_user_id is None:
            row["resolvedBy"] = actor_name
    return row
