"""
Client for the platform's Camera Registry Service (Platform Integration
Strategy doc §9.2) — NOT the registry service itself. Per the doc's own
boundaries (§3.2, §9), the registry is a platform-team-owned shared service
("platform-wide source of truth for camera information"); UC3's job is only
to consume it, not build it.

No such service is deployed anywhere in this workspace yet, so by default
(`PPE_CAMERA_REGISTRY_URL` unset) `sync_cameras()` is a no-op and
`repositories/cameras.py`'s hardcoded `_SEED` list keeps being the source of
truth exactly as before — this module makes that swap-in-a-real-registry-
later path exist without changing today's behavior at all.

When the URL IS set, cameras are upserted into the local `cameras` table
(still needed for the FK joins compliance_events/alerts/zones already
depend on — same "use-case-owned tables alongside platform tables" pattern
the `alerts` table already uses via its `source_uc` column) rather than
replacing local storage with a remote call on every read, so the hot path
(list_cameras/get_camera in repositories/cameras.py) is unaffected.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

import httpx

from config import (
    CAMERA_REGISTRY_API_KEY, CAMERA_REGISTRY_SYNC_INTERVAL_SECONDS, CAMERA_REGISTRY_URL,
)
from db import get_pool

log = logging.getLogger("ppe_backend.camera_registry_client")

# Bounded retry with backoff on the registry call itself — a real platform
# service can be transiently unavailable (deploy, restart, blip) without that
# meaning "this registry doesn't exist, give up until next scheduled sync".
_FETCH_RETRY_ATTEMPTS = 3
_FETCH_RETRY_BASE_SECONDS = 1.0


async def _upsert(pool, cam: dict[str, Any]) -> None:
    """Same upsert shape as repositories/cameras.py's create_camera/update_camera —
    matched by `code` (the registry's camera id), zone resolved by slug."""
    code = cam.get("id") or cam.get("code")
    if not code:
        log.warning("Camera registry entry missing id/code, skipping: %r", cam)
        return
    zone_slug = cam.get("zoneId") or cam.get("zone_id")
    zone_id = await pool.fetchval("SELECT id FROM zones WHERE slug=$1", zone_slug) if zone_slug else None
    await pool.execute(
        """
        INSERT INTO cameras (code, name, zone_id, rtsp_url)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (code) DO UPDATE
            SET name = EXCLUDED.name,
                zone_id = COALESCE(EXCLUDED.zone_id, cameras.zone_id),
                rtsp_url = COALESCE(EXCLUDED.rtsp_url, cameras.rtsp_url),
                updated_at = now()
        """,
        code, cam.get("name", code), zone_id, cam.get("rtspUrl") or cam.get("rtsp_url"),
    )


async def _fetch_cameras() -> list[dict[str, Any]] | None:
    """GET {CAMERA_REGISTRY_URL}/cameras with bearer auth (when configured) and
    bounded retry/backoff. Returns None (not raises) once retries are
    exhausted — callers treat that as "sync failed, try again next cycle"."""
    headers = {"Authorization": f"Bearer {CAMERA_REGISTRY_API_KEY}"} if CAMERA_REGISTRY_API_KEY else {}
    url = f"{CAMERA_REGISTRY_URL.rstrip('/')}/cameras"
    for attempt in range(1, _FETCH_RETRY_ATTEMPTS + 1):
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(url, headers=headers)
                resp.raise_for_status()
                return resp.json()
        except Exception:
            if attempt == _FETCH_RETRY_ATTEMPTS:
                log.exception("Camera registry fetch failed after %d attempt(s) (%s)", attempt, url)
                return None
            delay = _FETCH_RETRY_BASE_SECONDS * (2 ** (attempt - 1))
            log.warning("Camera registry fetch attempt %d/%d failed (%s) — retrying in %.1fs",
                        attempt, _FETCH_RETRY_ATTEMPTS, url, delay)
            await asyncio.sleep(delay)
    return None  # unreachable, satisfies type checkers


async def sync_cameras() -> int:
    """Fetch the registry's camera list and upsert into the local `cameras`
    table. Returns the number synced (0 when the registry is unconfigured or
    unreachable — never raises, since a missing/down registry must not take
    down UC3's own camera list, which is what §3.2's "each use case owns its
    internal service communication" is for)."""
    if not CAMERA_REGISTRY_URL:
        log.info("PPE_CAMERA_REGISTRY_URL not set — skipping camera registry sync, using local cameras table")
        return 0

    entries = await _fetch_cameras()
    if entries is None:
        log.warning("Camera registry sync failed (%s) — keeping existing local cameras table", CAMERA_REGISTRY_URL)
        return 0

    pool = get_pool()
    n = 0
    for cam in entries:
        try:
            await _upsert(pool, cam)
            n += 1
        except Exception:
            log.exception("Failed to upsert camera from registry: %r", cam)
    log.info("Camera registry sync: %d camera(s) synced from %s", n, CAMERA_REGISTRY_URL)
    return n


async def registry_sync_task() -> None:
    """Periodic re-sync (Platform Integration Strategy doc §9.2 — cameras
    added/edited/removed in the platform registry should reach UC3 without a
    manual admin trigger or a full backend restart on every change). Mirrors
    escalation.py's background-task shape: log, sleep, repeat — one failed
    cycle is logged and never kills the task. Not started at all when the
    registry is unconfigured (see main.py's lifespan) rather than looping
    doing nothing."""
    log.info("Camera registry sync task started (interval=%ds)", CAMERA_REGISTRY_SYNC_INTERVAL_SECONDS)
    while True:
        await asyncio.sleep(CAMERA_REGISTRY_SYNC_INTERVAL_SECONDS)
        try:
            await sync_cameras()
        except Exception:
            log.exception("Periodic camera registry sync failed")
