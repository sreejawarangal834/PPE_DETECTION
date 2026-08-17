"""
Users/sessions repository — backs Phase 4 auth (login/refresh/logout, zone-scoping).

Zone-scoping for `operator` reads from the `user_zones` junction table added in
migrations/versions/0002 (SCHEMA_DEEP_DIVE.md §2 — NOT `users.camera_ids`, which the platform
schema provides but which conflates camera-scoping with the frontend's actual zone-scoping
concept and can't be FK-checked the way a proper junction table can).
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

import asyncpg

from db import get_pool


async def get_by_email(email: str) -> dict[str, Any] | None:
    pool = get_pool()
    row = await pool.fetchrow(
        "SELECT id, name, email, password_hash, role FROM users WHERE lower(email) = lower($1)", email,
    )
    return dict(row) if row else None


async def get_by_id(user_id: str) -> dict[str, Any] | None:
    pool = get_pool()
    try:
        uid = UUID(user_id)
    except (ValueError, AttributeError, TypeError):
        return None
    row = await pool.fetchrow("SELECT id, name, email, role FROM users WHERE id = $1", uid)
    return dict(row) if row else None


async def get_zone_slugs(user_id: str) -> list[str]:
    pool = get_pool()
    rows = await pool.fetch(
        "SELECT z.slug FROM user_zones uz JOIN zones z ON z.id = uz.zone_id WHERE uz.user_id = $1",
        UUID(user_id) if isinstance(user_id, str) else user_id,
    )
    return [r["slug"] for r in rows]


async def set_zone_slugs(user_id: str, zone_slugs: list[str]) -> None:
    """Admin-driven zone assignment (used by UserManagementPage) — replaces the full set."""
    pool = get_pool()
    uid = UUID(user_id)
    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute("DELETE FROM user_zones WHERE user_id = $1", uid)
            if zone_slugs:
                zone_ids = [r["id"] for r in await conn.fetch("SELECT id FROM zones WHERE slug = ANY($1::text[])", zone_slugs)]
                for zid in zone_ids:
                    await conn.execute(
                        "INSERT INTO user_zones (user_id, zone_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", uid, zid,
                    )


async def create_session(user_id: str, refresh_token_hash: str, ttl_seconds: int) -> UUID:
    pool = get_pool()
    return await pool.fetchval(
        """
        INSERT INTO sessions (user_id, refresh_token_hash, expires_at)
        VALUES ($1, $2, now() + $3 * interval '1 second')
        RETURNING id
        """,
        UUID(user_id) if isinstance(user_id, str) else user_id, refresh_token_hash, ttl_seconds,
    )


async def find_session_by_hash(token_hash: str) -> dict[str, Any] | None:
    pool = get_pool()
    row = await pool.fetchrow(
        "SELECT id, user_id, revoked_at, expires_at, replaced_by_id FROM sessions WHERE refresh_token_hash = $1",
        token_hash,
    )
    return dict(row) if row else None


async def revoke_session(session_id: UUID, replaced_by: UUID | None = None) -> None:
    pool = get_pool()
    await pool.execute("UPDATE sessions SET revoked_at = now(), replaced_by_id = $2 WHERE id = $1", session_id, replaced_by)


async def revoke_all_sessions_for_user(user_id: UUID) -> None:
    """Refresh-token reuse detection (SCHEMA_DEEP_DIVE.md §2): a revoked token presented again
    means the token was stolen — nuke the whole session chain for that user, not just the one
    token, and let the legitimate user re-authenticate."""
    pool = get_pool()
    await pool.execute("UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL", user_id)


def session_expired(session: dict[str, Any]) -> bool:
    expires_at: datetime = session["expires_at"]
    return datetime.now(timezone.utc) >= expires_at


async def list_users() -> list[dict[str, Any]]:
    pool = get_pool()
    rows = await pool.fetch(
        """
        SELECT u.id, u.name, u.email, u.role, u.created_at,
               array_agg(z.slug) FILTER (WHERE z.slug IS NOT NULL) AS zone_slugs
        FROM users u
        LEFT JOIN user_zones uz ON uz.user_id = u.id
        LEFT JOIN zones z ON z.id = uz.zone_id
        GROUP BY u.id ORDER BY u.name
        """
    )
    return [
        {
            "id": str(r["id"]), "name": r["name"], "email": r["email"], "role": r["role"],
            "createdAt": r["created_at"].isoformat(), "assignedZones": list(r["zone_slugs"] or []),
        }
        for r in rows
    ]


async def create_user(name: str, email: str, password_hash: str, role: str, zone_slugs: list[str] | None = None) -> dict[str, Any]:
    pool = get_pool()
    user_id = await pool.fetchval(
        "INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4::operator_role) RETURNING id",
        name, email, password_hash, role,
    )
    if zone_slugs:
        await set_zone_slugs(str(user_id), zone_slugs)
    return {"id": str(user_id), "name": name, "email": email, "role": role, "assignedZones": zone_slugs or []}


async def update_user(user_id: str, name: str | None, role: str | None, zone_slugs: list[str] | None) -> dict[str, Any] | None:
    pool = get_pool()
    uid = UUID(user_id)
    existing = await pool.fetchrow("SELECT id, name, role FROM users WHERE id = $1", uid)
    if existing is None:
        return None
    await pool.execute(
        "UPDATE users SET name = $2, role = COALESCE($3::operator_role, role), updated_at = now() WHERE id = $1",
        uid, name or existing["name"], role,
    )
    if zone_slugs is not None:
        await set_zone_slugs(user_id, zone_slugs)
    row = await pool.fetchrow("SELECT id, name, email, role FROM users WHERE id = $1", uid)
    return {
        "id": str(row["id"]), "name": row["name"], "email": row["email"], "role": row["role"],
        "assignedZones": await get_zone_slugs(user_id),
    }
