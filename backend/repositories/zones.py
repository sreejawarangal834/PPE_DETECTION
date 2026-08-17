"""
Zone policy repository — Postgres-backed replacement for the old `zones.py`
JSON store. Keeps the same public function names/shapes (see
IMPLEMENTATION_PLAN.md §4.3) so call sites barely change beyond adding
`await`.

`zones.id` is a real UUID PK (see migrations/versions/0002_uc3_compliance.py);
the human string the frontend/existing data use (`z-assembly`) lives in
`zones.slug` and is exposed to the API/frontend as `id`, mirroring the
`cameras.code` -> `id` pattern.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

import asyncpg

from db import get_pool

_SEED: list[dict[str, Any]] = [
    {"id": "z-assembly", "name": "Assembly Line",
     "description": "Main production assembly line — north wing",
     "requiredPpe": ["helmet", "vest", "gloves", "safety_shoes"], "active": True},
    {"id": "z-welding", "name": "Welding Zone",
     "description": "Hot work area — welding and cutting operations",
     "requiredPpe": ["helmet", "vest", "gloves", "eye_prot", "safety_shoes"], "active": True},
    {"id": "z-chemical", "name": "Chemical Zone",
     "description": "Chemical handling and storage — east section",
     "requiredPpe": ["helmet", "vest", "gloves", "mask", "eye_prot", "safety_shoes"], "active": True},
    {"id": "z-storage", "name": "Storage Area",
     "description": "Raw material and finished goods storage",
     "requiredPpe": ["helmet", "vest", "safety_shoes"], "active": True},
    {"id": "z-loading", "name": "Loading Bay",
     "description": "Inbound and outbound logistics dock",
     "requiredPpe": ["helmet", "vest", "safety_shoes"], "active": True},
    {"id": "z-maintenance", "name": "Maintenance Workshop",
     "description": "Equipment repair and maintenance area",
     "requiredPpe": ["helmet", "vest", "gloves", "safety_shoes"], "active": True},
]


def _row_to_api(row: asyncpg.Record, camera_count: int = 0) -> dict[str, Any]:
    return {
        "id": row["slug"],
        "name": row["name"],
        "description": row["description"] or "",
        "requiredPpe": list(row["required_ppe"] or []),
        "cameraCount": camera_count,
        "active": row["active"],
    }


async def list_zones() -> list[dict[str, Any]]:
    pool = get_pool()
    rows = await pool.fetch(
        """
        SELECT z.*, count(c.id) AS camera_count
        FROM zones z
        LEFT JOIN cameras c ON c.zone_id = z.id
        GROUP BY z.id
        ORDER BY z.name
        """
    )
    return [_row_to_api(r, r["camera_count"]) for r in rows]


async def get_zone(slug: str) -> dict[str, Any] | None:
    pool = get_pool()
    row = await pool.fetchrow(
        """
        SELECT z.*, count(c.id) AS camera_count
        FROM zones z
        LEFT JOIN cameras c ON c.zone_id = z.id
        WHERE z.slug = $1
        GROUP BY z.id
        """,
        slug,
    )
    return _row_to_api(row, row["camera_count"]) if row else None


async def get_zone_id(slug: str | None, executor: Any = None) -> UUID | None:
    """Resolve a zone slug to its UUID PK — used by other repositories/writer.py.
    `executor` may be the pool or an open connection (see cameras.get_camera_id)."""
    if slug is None:
        return None
    return await (executor or get_pool()).fetchval("SELECT id FROM zones WHERE slug = $1", slug)


async def create_zone(data: dict[str, Any]) -> dict[str, Any]:
    pool = get_pool()
    slug = data.get("id") or f"z-{data['name'].lower().replace(' ', '-')}"
    existing = await pool.fetchval("SELECT 1 FROM zones WHERE slug = $1", slug)
    if existing:
        raise ValueError(f"Zone {slug} already exists")
    row = await pool.fetchrow(
        """
        INSERT INTO zones (slug, name, description, required_ppe, active)
        VALUES ($1, $2, $3, $4::ppe_type[], $5)
        RETURNING *, 0 AS camera_count
        """,
        slug, data["name"], data.get("description", ""),
        data.get("requiredPpe", []), data.get("active", True),
    )
    return _row_to_api(row, 0)


async def update_zone(slug: str, data: dict[str, Any]) -> dict[str, Any] | None:
    pool = get_pool()
    existing = await get_zone(slug)
    if existing is None:
        return None
    merged = {**existing, **data, "id": slug}
    row = await pool.fetchrow(
        """
        UPDATE zones SET name=$2, description=$3, required_ppe=$4::ppe_type[],
               active=$5, updated_at=now()
        WHERE slug=$1
        RETURNING *
        """,
        slug, merged["name"], merged.get("description", ""),
        merged.get("requiredPpe", []), merged.get("active", True),
    )
    cam_count = await pool.fetchval(
        "SELECT count(*) FROM cameras WHERE zone_id = (SELECT id FROM zones WHERE slug=$1)", slug
    )
    return _row_to_api(row, cam_count)


async def delete_zone(slug: str) -> bool:
    pool = get_pool()
    result = await pool.execute("DELETE FROM zones WHERE slug = $1", slug)
    return result.endswith(" 1")


async def required_ppe_for_zone(slug: str | None) -> frozenset[str] | None:
    """None means "no zone assigned" — compliance should not filter anything
    (back-compat with sessions started without a camera/zone picked)."""
    if slug is None:
        return None
    zone = await get_zone(slug)
    if zone is None:
        return None
    return frozenset(zone.get("requiredPpe", []))
