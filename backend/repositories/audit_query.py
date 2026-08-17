"""
Read side of the audit trail — backs `AuditLogPage.tsx` (via `adminApi.ts::getAuditLog`) with
the real, DB-enforced-immutable `audit_log` table instead of the client-side mock array
`src/lib/audit/auditLog.ts` used to serve (SCHEMA_DEEP_DIVE.md §2: "a client can fabricate or
skip [audit logging] — all audit writes must originate in backend endpoint handlers").
"""

from __future__ import annotations

from typing import Any

from db import get_pool


async def query(
    actor_search: str | None = None, action_type: str | None = None, search: str | None = None,
    page: int = 1, page_size: int = 50,
) -> dict[str, Any]:
    pool = get_pool()
    clauses: list[str] = []
    params: list[Any] = []

    def _add(clause_tmpl: str, value: Any) -> None:
        params.append(value)
        clauses.append(clause_tmpl.format(n=len(params)))

    if action_type:
        _add("a.action = ${n}", action_type)
    if search:
        _add("(a.entity_type ILIKE ${n} OR a.entity_id ILIKE ${n} OR a.metadata::text ILIKE ${n})", f"%{search}%")
    if actor_search:
        _add("u.name ILIKE ${n}", f"%{actor_search}%")
    where_sql = ("WHERE " + " AND ".join(clauses)) if clauses else ""

    total = await pool.fetchval(f"SELECT count(*) FROM audit_log a LEFT JOIN users u ON u.id = a.user_id {where_sql}", *params)
    offset = max(page - 1, 0) * page_size
    rows = await pool.fetch(
        f"""
        SELECT a.id, a.action, a.entity_type, a.entity_id, a.metadata, a.timestamp,
               COALESCE(u.name, u.email, 'system') AS actor
        FROM audit_log a LEFT JOIN users u ON u.id = a.user_id
        {where_sql}
        ORDER BY a.timestamp DESC
        LIMIT ${len(params) + 1} OFFSET ${len(params) + 2}
        """,
        *params, page_size, offset,
    )
    data = [
        {
            "id": str(r["id"]), "timestamp": r["timestamp"].isoformat(), "actor": r["actor"],
            "actionType": r["action"], "entity": f"{r['entity_type']}: {r['entity_id']}",
            "description": (r["metadata"] or {}).get("description", r["action"].replace("_", " ").title()),
            "ipAddress": "—",  # not captured yet — no request middleware records client IP
        }
        for r in rows
    ]
    return {"data": data, "total": total, "page": page, "pageSize": page_size}
