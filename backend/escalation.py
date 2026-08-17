"""
Server-side alert escalation (IMPLEMENTATION_PLAN.md §7.1).

Previously `src/lib/alerts/alertStore.ts` ran this on a client-side `setInterval` —
escalation only happened while some browser tab with the app open was still running.
`escalation_task()` below runs on the backend instead, so it happens regardless of whether
anyone has a tab open.

`alerts` is used unmodified (Phase 1 locked decision — see migrations/versions/0001) and its
`alert_status` enum has no `escalated` value, so escalation is NOT a status transition here.
It's recorded as `metadata.escalated_at` (a timestamp) layered on top of whatever status the
alert already has (`pending` or `acknowledged`) — which is exactly what the frontend's `Alert`
type already expects (`escalatedAt?: string` next to, not instead of, `status`).

Honest scope note: per-zone escalation delays are configured in
`src/data/alertConfig.ts::DEFAULT_ALERT_CONFIG`, but that file is a frontend-only mutable
in-memory array with no backend persistence at all (`saveAlertConfig()` just mutates a local
JS variable) — there is no `alert_config` table in either migration, and building one wasn't
in scope for this pass. The dict below mirrors those same defaults server-side so escalation
timing matches what the Admin > Alert Config page displays today, but editing that page
currently does NOT change backend escalation behavior — flagging this rather than silently
pretending the two are wired together.
"""

from __future__ import annotations

import asyncio
import datetime as _dt
import logging

import asyncpg

from db import get_pool
from notifications import notifier
from repositories import audit

log = logging.getLogger("ppe_backend.escalation")

# Mirrors src/data/alertConfig.ts::DEFAULT_ALERT_CONFIG's escalationDelayMinutes, by zone slug.
ESCALATION_DELAY_MINUTES: dict[str, int] = {
    "z-assembly": 10, "z-welding": 5, "z-chemical": 5,
    "z-storage": 15, "z-loading": 15, "z-maintenance": 10,
}
DEFAULT_ESCALATION_DELAY_MINUTES = 10
CHECK_INTERVAL_SECONDS = 30


async def _escalate_due_alerts(pool: asyncpg.Pool) -> int:
    rows = await pool.fetch(
        """
        SELECT a.id, a.metadata, a.created_at, z.slug AS zone_slug
        FROM alerts a
        LEFT JOIN zones z ON z.slug = a.metadata->>'zone_id'
        WHERE a.status IN ('pending', 'acknowledged')
          AND a.source_uc = 'uc3'
          AND (a.metadata->>'escalated_at') IS NULL
        """
    )
    escalated = 0
    for r in rows:
        delay_minutes = ESCALATION_DELAY_MINUTES.get(r["zone_slug"], DEFAULT_ESCALATION_DELAY_MINUTES)
        age = _dt.datetime.now(_dt.timezone.utc) - r["created_at"]
        if age.total_seconds() < delay_minutes * 60:
            continue

        async with pool.acquire() as conn:
            escalated_at = _dt.datetime.now(_dt.timezone.utc).isoformat()
            await conn.execute(
                "UPDATE alerts SET metadata = metadata || jsonb_build_object('escalated_at', $2::text) WHERE id = $1",
                r["id"], escalated_at,
            )
            await audit.write("alert_escalate", "alert", str(r["id"]), metadata={"reason": "response_time_exceeded"})
            meta = r["metadata"]
            await notifier.broadcast_event({
                "type": "alert_escalated", "alertId": str(r["id"]),
                "personLabel": meta.get("person_label"), "zoneId": r["zone_slug"],
            })
        escalated += 1
    return escalated


async def escalation_task() -> None:
    log.info("Escalation task started (check interval=%ds)", CHECK_INTERVAL_SECONDS)
    pool = get_pool()
    while True:
        try:
            n = await _escalate_due_alerts(pool)
            if n:
                log.info("Escalated %d alert(s) past their zone's response-time threshold", n)
        except Exception:
            log.exception("Escalation check failed")
        await asyncio.sleep(CHECK_INTERVAL_SECONDS)
