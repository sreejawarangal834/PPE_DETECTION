"""
asyncpg connection pool — opened once in FastAPI's lifespan (see main.py) and
shared by every repository module.

Kept deliberately tiny: no ORM, no session objects, just a pool that
repositories acquire connections from for the lifetime of a single query or
transaction (see IMPLEMENTATION_PLAN.md §4.3 — asyncpg + raw SQL, mirroring
the platform's own `services/alert_management/src/persistence.py`).
"""

from __future__ import annotations

import json
import logging

import asyncpg

from config import DATABASE_URL

log = logging.getLogger("ppe_backend.db")

_pool: asyncpg.Pool | None = None


async def _init_connection(conn: asyncpg.Connection) -> None:
    # asyncpg leaves json/jsonb as raw text by default — every repository's
    # row_to_api() expects `row["metadata"]` etc. to already be a dict, so
    # decode/encode automatically on every connection in the pool instead of
    # json.loads()-ing at every call site.
    await conn.set_type_codec(
        "jsonb", encoder=json.dumps, decoder=json.loads, schema="pg_catalog", format="text",
    )
    await conn.set_type_codec(
        "json", encoder=json.dumps, decoder=json.loads, schema="pg_catalog", format="text",
    )


async def connect() -> asyncpg.Pool:
    global _pool
    if _pool is not None:
        return _pool
    # Pin the session timezone to UTC on every connection in the pool so
    # `now()` / `timestamptz` arithmetic means the same thing regardless of
    # what timezone the host OS or an interactive psql session happens to be
    # in (see SCHEMA_DEEP_DIVE.md §5.1).
    _pool = await asyncpg.create_pool(
        DATABASE_URL,
        min_size=2,
        max_size=10,
        server_settings={"timezone": "UTC"},
        init=_init_connection,
    )
    log.info("Postgres pool connected (%s)", DATABASE_URL.split("@")[-1])
    return _pool


async def disconnect() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None
        log.info("Postgres pool closed")


def get_pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError("DB pool not initialized — did the FastAPI lifespan run?")
    return _pool
