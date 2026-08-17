"""
One-shot, idempotent import of the legacy JSON stores (backend/data/*.json)
into Postgres — see IMPLEMENTATION_PLAN.md §4.4.

Run AFTER `alembic upgrade head`:

    cd backend && .venv/bin/python scripts/import_json_stores.py

Safe to re-run: zones/cameras are upserted by their natural key (slug/code);
alerts are matched by `metadata->>'legacy_id'` and skipped if already present.
The original JSON files under backend/data/ are left untouched (kept as a
backup), matching the plan's explicit instruction not to delete them.

Legacy identity handling (per SCHEMA_DEEP_DIVE.md §4): the JSON history's
`workerId` values (`W-19`, `W-211`, ...) are per-session ByteTrack labels with
no cross-session meaning whatsoever (alerts.py's own `_worker_label` docstring
says as much) — they are NOT imported as distinct `persons` rows, which would
fabricate identities that never existed and would permanently pollute every
person-wise compliance report with fake people. Instead every imported event
attaches to exactly one inactive sentinel person (`W-LEGACY`), with the
original per-alert label preserved in `metadata.legacy_worker_id` so the raw
history isn't destroyed, just not misrepresented as tracked individuals.
"""

from __future__ import annotations

import asyncio
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import asyncpg

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))  # backend/ on path

from config import DATABASE_URL  # noqa: E402
from repositories.persons import get_or_create_legacy_sentinel  # noqa: E402

DATA_DIR = Path(__file__).resolve().parents[1] / "data"

# Gotcha (IMPLEMENTATION_PLAN.md §9 / §4.4): JSON history uses "open"; the
# platform's alert_status enum uses "pending". Every other JSON status value
# happens to already match an enum value 1:1.
_STATUS_JSON_TO_DB = {"open": "pending", "acknowledged": "acknowledged", "resolved": "resolved"}


async def import_zones(conn: asyncpg.Connection) -> int:
    path = DATA_DIR / "zones.json"
    if not path.exists():
        print(f"  (skip) {path} not found")
        return 0
    zones = json.loads(path.read_text())
    for z in zones:
        await conn.execute(
            """
            INSERT INTO zones (slug, name, description, required_ppe, active)
            VALUES ($1, $2, $3, $4::ppe_type[], $5)
            ON CONFLICT (slug) DO UPDATE SET
                name = EXCLUDED.name, description = EXCLUDED.description,
                required_ppe = EXCLUDED.required_ppe, active = EXCLUDED.active,
                updated_at = now()
            """,
            z["id"], z["name"], z.get("description", ""), z.get("requiredPpe", []), z.get("active", True),
        )
    return len(zones)


async def import_cameras(conn: asyncpg.Connection) -> int:
    path = DATA_DIR / "cameras.json"
    if not path.exists():
        print(f"  (skip) {path} not found")
        return 0
    cameras = json.loads(path.read_text())
    for c in cameras:
        zone_id = await conn.fetchval("SELECT id FROM zones WHERE slug = $1", c.get("zoneId"))
        await conn.execute(
            """
            INSERT INTO cameras (code, name, zone_id, rtsp_url)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (code) DO UPDATE SET
                name = EXCLUDED.name, zone_id = EXCLUDED.zone_id,
                rtsp_url = COALESCE(cameras.rtsp_url, EXCLUDED.rtsp_url),
                updated_at = now()
            """,
            c["id"], c["name"], zone_id, c.get("rtspUrl"),
        )
    return len(cameras)


async def import_alerts(conn: asyncpg.Connection) -> tuple[int, int]:
    path = DATA_DIR / "alerts.json"
    if not path.exists():
        print(f"  (skip) {path} not found")
        return 0, 0
    alerts = json.loads(path.read_text())
    sentinel_id = await get_or_create_legacy_sentinel(conn)

    imported = skipped = 0
    for a in alerts:
        legacy_id = a["id"]
        already = await conn.fetchval(
            "SELECT 1 FROM alerts WHERE metadata->>'legacy_id' = $1", legacy_id
        )
        if already:
            skipped += 1
            continue

        camera_id = await conn.fetchval("SELECT id FROM cameras WHERE code = $1", a.get("cameraId"))
        zone_id = await conn.fetchval("SELECT id FROM zones WHERE slug = $1", a.get("zoneId") or None)
        created_at = datetime.fromtimestamp(a["createdAt"] / 1000.0, tz=timezone.utc)
        missing_ppe = a.get("missingPpe") or ["helmet"]
        status_db = _STATUS_JSON_TO_DB.get(a["status"], "pending")

        metadata = {
            "legacy_id": legacy_id,
            "legacy_worker_id": a.get("workerId"),
            "zone_id": a.get("zoneId"),
            "person_label": "W-LEGACY",
            "missing_ppe": missing_ppe,
            "confidence": a.get("confidence"),
        }
        # Strings, not user UUIDs (per §4.4) — the platform's acknowledged_by/
        # resolved_by columns are FKs to `users`, which these legacy names
        # aren't, so they're preserved in metadata instead of the FK columns.
        if a.get("acknowledgedBy"):
            metadata["legacy_acknowledged_by"] = a["acknowledgedBy"]
        if a.get("resolvedBy"):
            metadata["legacy_resolved_by"] = a["resolvedBy"]
        if a.get("resolutionNotes"):
            metadata["legacy_resolution_notes"] = a["resolutionNotes"]

        async with conn.transaction():
            event_id = await conn.fetchval(
                """
                INSERT INTO compliance_events
                    (person_id, camera_id, zone_id, ppe_type, state, confidence, started_at)
                VALUES ($1, $2, $3, $4::ppe_type, 'violation', $5, $6)
                RETURNING id
                """,
                sentinel_id, camera_id, zone_id, missing_ppe[0], a.get("confidence"), created_at,
            )
            alert_uuid = await conn.fetchval(
                """
                INSERT INTO alerts
                    (alert_id, camera_id, source_uc, alert_type, severity, title, description,
                     source_event_id, status, metadata, created_at)
                VALUES (uuid_generate_v4(), $1, 'uc3', 'ppe_violation', $2, $3, $4, $5,
                        $6::alert_status, $7::jsonb, $8)
                RETURNING id
                """,
                camera_id, a["severity"],
                f"PPE violation: missing {', '.join(missing_ppe)}",
                f"Imported from legacy JSON history (id={legacy_id})",
                event_id, status_db, json.dumps(metadata), created_at,
            )
            await conn.execute("UPDATE compliance_events SET alert_id = $1 WHERE id = $2", alert_uuid, event_id)
        imported += 1

    return imported, skipped


async def main() -> None:
    conn = await asyncpg.connect(DATABASE_URL, server_settings={"timezone": "UTC"})
    try:
        print("Importing zones...")
        n_zones = await import_zones(conn)
        print(f"  {n_zones} zones upserted")

        print("Importing cameras...")
        n_cams = await import_cameras(conn)
        print(f"  {n_cams} cameras upserted")

        print("Importing alerts (-> compliance_events + alerts, sentinel person W-LEGACY)...")
        n_imported, n_skipped = await import_alerts(conn)
        print(f"  {n_imported} imported, {n_skipped} already present (skipped)")

        print("Done.")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
