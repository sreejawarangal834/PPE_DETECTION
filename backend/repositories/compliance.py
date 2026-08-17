"""
Detection-session / track-segment lifecycle.

Session start/end is called directly (awaited) from `_run_detection_session`
in main.py — that's a plain coroutine on the event loop, not the synchronous
inference path, so there's no need to route it through the write-queue in
writer.py. Only per-frame, per-violation writes (which run at inference
cadence, many times a second, across every concurrent session sharing one
event loop) go through that queue.
"""

from __future__ import annotations

from uuid import UUID

from db import get_pool
from repositories.cameras import get_camera_id


async def start_session(camera_code: str | None, source_kind: str, source_url: str | None) -> UUID:
    pool = get_pool()
    camera_id = await get_camera_id(camera_code)
    return await pool.fetchval(
        """
        INSERT INTO detection_sessions (camera_id, source_kind, source_url, started_at)
        VALUES ($1, $2::session_kind, $3, now())
        RETURNING id
        """,
        camera_id, source_kind, source_url,
    )


async def end_session(session_id: UUID | None, frames_processed: int) -> None:
    if session_id is None:
        return
    pool = get_pool()
    await pool.execute(
        "UPDATE detection_sessions SET ended_at = now(), frames_processed = $2 WHERE id = $1",
        session_id, frames_processed,
    )
