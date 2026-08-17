"""
Camera slot repository — Postgres-backed replacement for the old `cameras.py`
JSON store (see IMPLEMENTATION_PLAN.md §4.3). `cameras.id` is a UUID PK; the
human id the frontend/existing JSON data use (`CAM-01`) lives in
`cameras.code` and is exposed to the API as `id`.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

import asyncpg

from db import get_pool

_SEED: list[dict[str, Any]] = [
    {"id": "CAM-01", "name": "Assembly Line — North", "zoneId": "z-assembly"},
    {"id": "CAM-02", "name": "Welding Bay", "zoneId": "z-welding"},
    {"id": "CAM-03", "name": "Storage — East Gate", "zoneId": "z-storage"},
    {"id": "CAM-04", "name": "Chemical Handling", "zoneId": "z-chemical"},
    {"id": "CAM-05", "name": "Loading Bay — Main", "zoneId": "z-loading"},
    {"id": "CAM-06", "name": "Maintenance Workshop", "zoneId": "z-maintenance"},
]

# DB camera_status -> frontend Camera['status'] (src/types/index.ts only has
# online/offline/error — 'reconnecting'/'disabled' collapse to the closest
# frontend-understood value so existing components don't need a new state).
_STATUS_TO_API = {
    "online": "online",
    "offline": "offline",
    "reconnecting": "offline",
    "disabled": "error",
}


def _row_to_api(row: asyncpg.Record) -> dict[str, Any]:
    return {
        "id": row["code"],
        "name": row["name"],
        "rtspUrl": row["rtsp_url"] or "",
        "zoneId": row["zone_slug"] or "",
        "zoneName": row["zone_name"] or "",
        "status": _STATUS_TO_API.get(row["status"], "offline"),
        "fps": row["fps"] or 0,
        # Live, high-churn telemetry (latency, workers detected, active
        # violations, last-seen) is intentionally NOT persisted to Postgres —
        # it belongs to in-process session state, same as the original
        # cameras.enrich() docstring explains, just now backed by a real
        # `status` value instead of a hardcoded placeholder.
        "latencyMs": 0,
        "workersDetected": 0,
        "activeViolations": 0,
        "lastSeen": "—",
    }


_LIST_SQL = """
    SELECT c.code, c.name, c.rtsp_url, c.status, c.fps,
           z.slug AS zone_slug, z.name AS zone_name
    FROM cameras c
    LEFT JOIN zones z ON z.id = c.zone_id
"""


async def list_cameras() -> list[dict[str, Any]]:
    pool = get_pool()
    rows = await pool.fetch(_LIST_SQL + " ORDER BY c.code")
    return [_row_to_api(r) for r in rows]


async def get_camera(code: str) -> dict[str, Any] | None:
    pool = get_pool()
    row = await pool.fetchrow(_LIST_SQL + " WHERE c.code = $1", code)
    return _row_to_api(row) if row else None


async def get_camera_id(code: str | None, executor: Any = None) -> UUID | None:
    """Resolve a camera code to its UUID PK — used by writer.py / other repos.

    `executor` accepts either the pool or an already-open connection
    (asyncpg's Pool and Connection share the same fetch* interface) so callers
    inside a transaction can reuse their own connection instead of checking
    out a second one from the pool for a single lookup."""
    if not code or code == "unassigned":
        return None
    return await (executor or get_pool()).fetchval("SELECT id FROM cameras WHERE code = $1", code)


async def create_camera(data: dict[str, Any]) -> dict[str, Any]:
    pool = get_pool()
    existing = await pool.fetchval("SELECT count(*) FROM cameras")
    next_n = existing + 1
    code = data.get("id")
    if not code:
        code = f"CAM-{next_n:02d}"
        while await pool.fetchval("SELECT 1 FROM cameras WHERE code=$1", code):
            next_n += 1
            code = f"CAM-{next_n:02d}"
    zone_id = await pool.fetchval("SELECT id FROM zones WHERE slug=$1", data.get("zoneId"))
    row = await pool.fetchrow(
        """
        INSERT INTO cameras (code, name, zone_id, rtsp_url)
        VALUES ($1, $2, $3, $4)
        RETURNING id
        """,
        code, data["name"], zone_id, data.get("rtspUrl"),
    )
    return await get_camera(code)  # type: ignore[return-value]


async def update_camera(code: str, data: dict[str, Any]) -> dict[str, Any] | None:
    pool = get_pool()
    existing = await get_camera(code)
    if existing is None:
        return None
    merged = {**existing, **data}
    zone_id = await pool.fetchval("SELECT id FROM zones WHERE slug=$1", merged.get("zoneId"))
    await pool.execute(
        """
        UPDATE cameras SET name=$2, zone_id=$3, rtsp_url=$4, updated_at=now()
        WHERE code=$1
        """,
        code, merged["name"], zone_id, merged.get("rtspUrl") or None,
    )
    return await get_camera(code)


async def delete_camera(code: str) -> bool:
    pool = get_pool()
    result = await pool.execute("DELETE FROM cameras WHERE code = $1", code)
    return result.split(" ")[-1] != "0"


async def set_status(code: str, status: str) -> None:
    """Drive `cameras.status` from RTSPSource's reconnect loop (§4.5). Only a
    genuine state transition writes a row — no per-frame polling."""
    pool = get_pool()
    await pool.execute(
        "UPDATE cameras SET status=$2::camera_status, updated_at=now() WHERE code=$1", code, status
    )


def enrich(camera: dict[str, Any]) -> dict[str, Any]:
    """Kept for call-site compatibility with the old cameras.py — `get_camera`/
    `list_cameras` already return fully-enriched dicts now, so this is a no-op
    passthrough rather than the old JSON-store version's placeholder-filling."""
    return camera
