"""
Zone policy store — per-zone required PPE.

Seeded from the frontend's pre-existing mock zones (src/data/zones.ts) so
backend and frontend agree on IDs/names/policy out of the box instead of
diverging the moment the real API is wired in.
"""

from __future__ import annotations

from typing import Any

import store

_STORE = "zones"

_SEED: list[dict[str, Any]] = [
    {"id": "z-assembly", "name": "Assembly Line",
     "description": "Main production assembly line — north wing",
     "requiredPpe": ["helmet", "vest", "gloves", "safety_shoes"], "active": True},
    {"id": "z-welding", "name": "Welding Zone",
     "description": "Hot work area — welding and cutting operations",
     "requiredPpe": ["helmet", "vest", "gloves", "eye_prot", "safety_shoes"], "active": True},
    {"id": "z-chemical", "name": "Chemical Zone",
     "description": "Chemical handling and storage — east section",
     "requiredPpe": ["helmet", "vest", "gloves", "mask", "eye_prot", "safety_shoes"], "active": True},
    {"id": "z-storage", "name": "Storage Area",
     "description": "Raw material and finished goods storage",
     "requiredPpe": ["helmet", "vest", "safety_shoes"], "active": True},
    {"id": "z-loading", "name": "Loading Bay",
     "description": "Inbound and outbound logistics dock",
     "requiredPpe": ["helmet", "vest", "safety_shoes"], "active": True},
    {"id": "z-maintenance", "name": "Maintenance Workshop",
     "description": "Equipment repair and maintenance area",
     "requiredPpe": ["helmet", "vest", "gloves", "safety_shoes"], "active": True},
]


def list_zones() -> list[dict[str, Any]]:
    return store.load(_STORE, seed=_SEED)


def get_zone(zone_id: str) -> dict[str, Any] | None:
    return next((z for z in list_zones() if z["id"] == zone_id), None)


def create_zone(data: dict[str, Any]) -> dict[str, Any]:
    zones = list_zones()
    zone_id = data.get("id") or f"z-{data['name'].lower().replace(' ', '-')}"
    if any(z["id"] == zone_id for z in zones):
        raise ValueError(f"Zone {zone_id} already exists")
    zone = {
        "id": zone_id,
        "name": data["name"],
        "description": data.get("description", ""),
        "requiredPpe": data.get("requiredPpe", []),
        "active": data.get("active", True),
    }
    zones.append(zone)
    store.save(_STORE, zones)
    return zone


def update_zone(zone_id: str, data: dict[str, Any]) -> dict[str, Any] | None:
    zones = list_zones()
    for i, z in enumerate(zones):
        if z["id"] == zone_id:
            zones[i] = {**z, **data, "id": zone_id}
            store.save(_STORE, zones)
            return zones[i]
    return None


def delete_zone(zone_id: str) -> bool:
    zones = list_zones()
    remaining = [z for z in zones if z["id"] != zone_id]
    if len(remaining) == len(zones):
        return False
    store.save(_STORE, remaining)
    return True


def required_ppe_for_zone(zone_id: str | None) -> frozenset[str] | None:
    """
    None means "no zone assigned" — the compliance engine should not filter
    anything (back-compat: sessions started without picking a camera/zone
    behave exactly as before this feature existed).
    """
    if zone_id is None:
        return None
    zone = get_zone(zone_id)
    if zone is None:
        return None
    return frozenset(zone.get("requiredPpe", []))
