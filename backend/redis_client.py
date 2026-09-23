"""
Shared Redis client — opened once in FastAPI's lifespan (see main.py) and
reused everywhere a Redis connection is needed, mirroring db.py's
connect()/disconnect()/get_pool() shape for the asyncpg pool.

Backs three platform-integration pieces, all against the same Redis instance:
  - frames:{camera_id} lists — RedisFrameSource (frame_source.py) consumes them.
  - events:ppe / events:compliance streams — published from
    repositories/writer.py after a compliance_events/alerts row commits.
  - (future) any other UC3-internal Redis usage.
"""

from __future__ import annotations

import asyncio
import logging

import redis.asyncio as aioredis

from config import REDIS_URL

log = logging.getLogger("ppe_backend.redis_client")

_client: aioredis.Redis | None = None

# Bounded retry with exponential backoff at startup — a Redis container that's
# still coming up (e.g. `docker compose up` racing the backend) shouldn't
# permanently disable Redis-backed features for the rest of the process just
# because it wasn't ready on the very first ping. Still non-fatal: after these
# attempts are exhausted, connect() returns the (unreachable) client anyway and
# every caller already tolerates get_client() being unusable (ping failing on
# first real use logs the same way this does).
_CONNECT_RETRY_ATTEMPTS = 4
_CONNECT_RETRY_BASE_SECONDS = 1.0


async def connect() -> aioredis.Redis:
    global _client
    if _client is not None:
        return _client
    client = aioredis.from_url(REDIS_URL, decode_responses=False)
    for attempt in range(1, _CONNECT_RETRY_ATTEMPTS + 1):
        try:
            await client.ping()
            log.info("Redis connected (%s)", REDIS_URL)
            break
        except Exception:
            if attempt == _CONNECT_RETRY_ATTEMPTS:
                # Non-fatal even after exhausting retries: frame/event
                # publishing degrades to logged no-ops (see writer.py,
                # frame_source.py) rather than taking the whole backend down
                # just because Redis isn't running in this dev environment.
                log.warning(
                    "Redis not reachable after %d attempt(s) (%s) — Redis-backed "
                    "features will no-op until it is",
                    attempt, REDIS_URL,
                )
                break
            delay = _CONNECT_RETRY_BASE_SECONDS * (2 ** (attempt - 1))
            log.warning("Redis connect attempt %d/%d failed (%s) — retrying in %.1fs",
                        attempt, _CONNECT_RETRY_ATTEMPTS, REDIS_URL, delay)
            await asyncio.sleep(delay)
    _client = client
    return _client


async def disconnect() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None
        log.info("Redis client closed")


def get_client() -> aioredis.Redis | None:
    """Never raises — callers must treat a None client as "Redis unavailable,
    degrade gracefully", not a fatal error (see module docstring)."""
    return _client
