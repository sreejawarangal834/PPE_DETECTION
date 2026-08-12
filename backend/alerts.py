"""
Alert persistence — turns compliance.py's per-worker violation raise events
into durable rows the frontend can list/acknowledge/resolve, matching the
frontend's existing `Alert` shape (src/types/index.ts) field-for-field so
the frontend's mock API layer can be pointed at these endpoints unchanged.

Detections/violations still stream over the per-frame WebSocket payload as
before (see main.py) — this is additive persistence, not a replacement.
"""

from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

import store

_STORE = "alerts"

# There is no worker-identity system yet (no face/Re-ID) — tracker IDs are
# per-session and not stable across sessions, so "worker" here is just a
# readable label for the tracker ID, not a real employee identity.
def _worker_label(worker_id: int) -> tuple[str, str]:
    ident = f"W-{worker_id}" if worker_id >= 0 else "W-unknown"
    return ident, ident


def list_alerts(
    severities: list[str] | None = None,
    zones: list[str] | None = None,
    statuses: list[str] | None = None,
    search: str | None = None,
) -> list[dict[str, Any]]:
    alerts = store.load(_STORE, seed=[])
    data = sorted(alerts, key=lambda a: a["createdAt"], reverse=True)
    if severities:
        data = [a for a in data if a["severity"] in severities]
    if zones:
        data = [a for a in data if a["zoneId"] in zones]
    if statuses:
        data = [a for a in data if a["status"] in statuses]
    if search:
        q = search.lower()
        data = [
            a for a in data
            if q in a["workerId"].lower()
            or q in a["workerName"].lower()
            or q in a["zoneName"].lower()
        ]
    return data


def get_alert(alert_id: str) -> dict[str, Any] | None:
    return next((a for a in store.load(_STORE, seed=[]) if a["id"] == alert_id), None)


def record_violation(
    camera_id: str,
    zone_id: str | None,
    zone_name: str,
    worker_id: int,
    ppe_type: str,
    severity: str,
    confidence: float,
) -> dict[str, Any]:
    """Create and persist one Alert for a newly-raised violation."""
    worker_ident, worker_name = _worker_label(worker_id)
    now = datetime.now(timezone.utc)
    alert = {
        "id": f"ALT-{uuid4().hex[:10]}",
        "createdAt": int(time.time() * 1000),
        "timestamp": now.strftime("%H:%M:%S"),
        "cameraId": camera_id,
        "zoneId": zone_id or "",
        "zoneName": zone_name,
        "workerId": worker_ident,
        "workerName": worker_name,
        "missingPpe": [ppe_type],
        "confidence": round(min(max(confidence, 0.0), 1.0), 2),
        "severity": severity,
        "status": "open",
    }
    alerts = store.load(_STORE, seed=[])
    alerts.append(alert)
    store.save(_STORE, alerts)
    return alert


def acknowledge(alert_id: str, actor: str) -> dict[str, Any] | None:
    alerts = store.load(_STORE, seed=[])
    for i, a in enumerate(alerts):
        if a["id"] == alert_id:
            alerts[i] = {
                **a, "status": "acknowledged",
                "acknowledgedBy": actor,
                "acknowledgedAt": datetime.now(timezone.utc).isoformat(),
            }
            store.save(_STORE, alerts)
            return alerts[i]
    return None


def resolve(alert_id: str, actor: str, notes: str) -> dict[str, Any] | None:
    alerts = store.load(_STORE, seed=[])
    for i, a in enumerate(alerts):
        if a["id"] == alert_id:
            alerts[i] = {
                **a, "status": "resolved",
                "resolvedBy": actor,
                "resolvedAt": datetime.now(timezone.utc).isoformat(),
                "resolutionNotes": notes,
            }
            store.save(_STORE, alerts)
            return alerts[i]
    return None
