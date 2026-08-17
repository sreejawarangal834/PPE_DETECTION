"""
Append-only audit trail writes. `audit_log` itself enforces immutability at the DB level via
the `audit_log_no_update`/`audit_log_no_delete` RULEs from migrations/versions/0001 — no
application code path (this one included) can bypass that.

SCHEMA_DEEP_DIVE.md §2: audit logging must move server-side entirely. Every call site in
main.py is inside a request handler that already knows the authenticated user (or `None` for
unauthenticated actions like a failed login attempt) — never trust a client-supplied actor.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from db import get_pool

SERVICE = "ppe-compliance-backend"


async def write(
    action: str, entity_type: str, entity_id: str, user_id: str | UUID | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    pool = get_pool()
    uid: UUID | None = None
    if user_id is not None:
        uid = user_id if isinstance(user_id, UUID) else UUID(user_id)
    await pool.execute(
        """
        INSERT INTO audit_log (service, action, entity_type, entity_id, user_id, source_uc, metadata)
        VALUES ($1, $2, $3, $4, $5, 'uc3', $6)
        """,
        SERVICE, action, entity_type, str(entity_id), uid, metadata or {},
    )
