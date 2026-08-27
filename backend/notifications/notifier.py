"""
Notification delivery — a small channel abstraction (in-app WS broadcast, SMTP email), with
every attempt (sent/skipped/failed) recorded in `notification_log` regardless of outcome, per
IMPLEMENTATION_PLAN.md §7.1.

Called from repositories/writer.py right after a violation's alert row is committed — takes
the same already-open `conn` for the notification_log write (avoids checking out a second pool
connection from inside what's often still a transaction) and does the actual network I/O
(SMTP, WS send) as ordinary awaits outside any transaction.

Honest scope note: there is no per-user notification-preference/subscription model in this
schema (no "email me for zone X" table) — email goes to one configured team inbox
(`PPE_NOTIFY_EMAIL_TO`), not routed per assigned zone/user. `notification_log.user_id` is left
NULL accordingly (a team-wide send, not a to-a-specific-user one). Building real per-user
routing is a reasonable follow-up, not attempted here.
"""

from __future__ import annotations

import logging
import time
from email.message import EmailMessage
from typing import Any
from uuid import UUID

import aiosmtplib
import asyncpg

from config import (
    NOTIFY_EMAIL_TO, SMTP_FROM, SMTP_HOST, SMTP_PASSWORD, SMTP_PORT, SMTP_USE_TLS, SMTP_USERNAME,
)

log = logging.getLogger("ppe_backend.notifications")

# Severity routing (IMPLEMENTATION_PLAN.md §7.1) — email is reserved for the severities that
# actually warrant paging someone; low/medium stay in-app only.
_EMAIL_SEVERITIES = {"high", "critical"}

# Per-(person, ppe_type) cooldown so a flapping violation (raise/clear/raise/clear as someone
# hovers at the hysteresis boundary) can't mail-bomb a supervisor. In-process only — resets on
# restart, which is an acceptable tradeoff for a cooldown whose entire purpose is rate-limiting
# within one running process's lifetime, not a durability guarantee.
_email_cooldown: dict[tuple[str, str], float] = {}
EMAIL_COOLDOWN_SECONDS = 300.0

_ws_clients: set[Any] = set()


def register_ws_client(ws: Any) -> None:
    _ws_clients.add(ws)


def unregister_ws_client(ws: Any) -> None:
    _ws_clients.discard(ws)


async def broadcast_event(payload: dict[str, Any]) -> int:
    """Public entry point for other modules (e.g. escalation.py) that need to push a WS event
    but aren't recording a notification_log row for it (escalation.py logs to audit_log
    instead — an escalation is a status change to an existing alert, not a new delivery
    attempt)."""
    return await _broadcast_inapp(payload)


async def _broadcast_inapp(payload: dict[str, Any]) -> int:
    dead = []
    sent = 0
    for ws in list(_ws_clients):
        try:
            await ws.send_json(payload)
            sent += 1
        except Exception:
            dead.append(ws)
    for ws in dead:
        _ws_clients.discard(ws)
    return sent


async def _log_attempt(
    conn: asyncpg.Connection, alert_id: UUID, channel: str, status: str, error: str | None = None,
) -> None:
    await conn.execute(
        "INSERT INTO notification_log (alert_id, channel, status, error) VALUES ($1, $2, $3, $4)",
        alert_id, channel, status, error,
    )


async def send_plain_email(to: str, subject: str, body: str) -> None:
    """Public, generic send — used for anything that isn't a violation alert (password
    reset, etc.), where the recipient is a specific user, not the fixed team inbox."""
    msg = EmailMessage()
    msg["From"] = SMTP_FROM
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)
    await aiosmtplib.send(
        msg, hostname=SMTP_HOST, port=SMTP_PORT,
        username=SMTP_USERNAME, password=SMTP_PASSWORD, start_tls=SMTP_USE_TLS,
    )


async def _send_email(subject: str, body: str) -> None:
    msg = EmailMessage()
    msg["From"] = SMTP_FROM
    msg["To"] = NOTIFY_EMAIL_TO
    msg["Subject"] = subject
    msg.set_content(body)
    # start_tls=True is STARTTLS (port 587, what Gmail needs) — a plaintext connection that
    # upgrades to TLS, distinct from use_tls=True (implicit TLS on port 465). MailHog (the dev
    # default) speaks plaintext with no auth, so both stay off unless explicitly configured.
    await aiosmtplib.send(
        msg, hostname=SMTP_HOST, port=SMTP_PORT,
        username=SMTP_USERNAME, password=SMTP_PASSWORD,
        start_tls=SMTP_USE_TLS,
    )


async def notify_violation(
    conn: asyncpg.Connection, alert_id: UUID, person_label: str, zone_name: str,
    ppe_type: str, severity: str, camera_code: str | None, description: str,
) -> None:
    """Fire in-app + (severity-gated, cooldown-gated) email for one newly-created alert row.
    Never raises — a notification failure must not roll back or block the compliance write
    that triggered it; every outcome (including a skip) is still logged."""
    payload = {
        "type": "alert_new", "alertId": str(alert_id), "personLabel": person_label,
        "zoneName": zone_name, "ppeType": ppe_type, "severity": severity,
        "cameraCode": camera_code, "description": description,
    }

    try:
        sent = await _broadcast_inapp(payload)
        await _log_attempt(conn, alert_id, "inapp", "sent" if sent else "skipped_no_clients")
    except Exception as exc:
        log.exception("In-app broadcast failed for alert %s", alert_id)
        await _log_attempt(conn, alert_id, "inapp", "failed", str(exc))

    if severity not in _EMAIL_SEVERITIES:
        return

    key = (person_label, ppe_type)
    now = time.monotonic()
    if now - _email_cooldown.get(key, 0.0) < EMAIL_COOLDOWN_SECONDS:
        await _log_attempt(conn, alert_id, "email", "skipped_cooldown")
        return

    try:
        await _send_email(
            f"[{severity.upper()}] PPE violation — {person_label} missing {ppe_type} in {zone_name}",
            description,
        )
        _email_cooldown[key] = now
        await _log_attempt(conn, alert_id, "email", "sent")
    except Exception as exc:
        log.exception("Email send failed for alert %s", alert_id)
        await _log_attempt(conn, alert_id, "email", "failed", str(exc))
