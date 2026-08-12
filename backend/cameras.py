"""
Camera slot store.

These are config slots, not physical RTSP connections — a factory camera is
physically fixed to one zone, so a slot just pins an id/name to a zone_id;
required PPE for anyone seen through that slot comes from zones.py via the
slot's zone_id. Uploaded videos and webcam sessions bind to one of these
slots at start time (see main.py) so the compliance engine knows which
zone's policy applies.

Seeded from the frontend's pre-existing mock cameras (src/data/mockData.ts).
"""

from __future__ import annotations

from typing import Any

import store
import zones as zones_module

_STORE = "cameras"

_SEED: list[dict[str, Any]] = [
    {"id": "CAM-01", "name": "Assembly Line — North", "zoneId": "z-assembly"},
    {"id": "CAM-02", "name": "Welding Bay", "zoneId": "z-welding"},
    {"id": "CAM-03", "name": "Storage — East Gate", "zoneId": "z-storage"},
    {"id": "CAM-04", "name": "Chemical Handling", "zoneId": "z-chemical"},
    {"id": "CAM-05", "name": "Loading Bay — Main", "zoneId": "z-loading"},
    {"id": "CAM-06", "name": "Maintenance Workshop", "zoneId": "z-maintenance"},
]


def list_cameras() -> list[dict[str, Any]]:
    return store.load(_STORE, seed=_SEED)


def get_camera(camera_id: str) -> dict[str, Any] | None:
    return next((c for c in list_cameras() if c["id"] == camera_id), None)


def create_camera(data: dict[str, Any]) -> dict[str, Any]:
    cameras = list_cameras()
    next_n = len(cameras) + 1
    camera_id = data.get("id") or f"CAM-{next_n:02d}"
    while any(c["id"] == camera_id for c in cameras):
        next_n += 1
        camera_id = f"CAM-{next_n:02d}"
    camera = {"id": camera_id, "name": data["name"], "zoneId": data["zoneId"]}
    if data.get("rtspUrl"):
        camera["rtspUrl"] = data["rtspUrl"]
    cameras.append(camera)
    store.save(_STORE, cameras)
    return camera


def update_camera(camera_id: str, data: dict[str, Any]) -> dict[str, Any] | None:
    cameras = list_cameras()
    for i, c in enumerate(cameras):
        if c["id"] == camera_id:
            cameras[i] = {**c, **data, "id": camera_id}
            store.save(_STORE, cameras)
            return cameras[i]
    return None


def delete_camera(camera_id: str) -> bool:
    cameras = list_cameras()
    remaining = [c for c in cameras if c["id"] != camera_id]
    if len(remaining) == len(cameras):
        return False
    store.save(_STORE, remaining)
    return True


def enrich(camera: dict[str, Any]) -> dict[str, Any]:
    """
    Fill in the frontend Camera type's display-only telemetry fields
    (src/types/index.ts) that this config-only slot has no real value for.
    `rtspUrl` is real when a slot was created/updated with one (see
    RTSPSource in frame_source.py, used via /ws/detect/rtsp) — the rest
    (status/fps/latency/etc.) stay simulated defaults, since there's no
    connection to report live health on until a session (uploaded video /
    webcam / RTSP) is actually bound to the slot, which the frontend already
    knows about client-side (DetectionStore) and renders in place of this
    idle-camera view when present.
    """
    zone = zones_module.get_zone(camera.get("zoneId"))
    return {
        "rtspUrl": "", "status": "offline", "fps": 0, "latencyMs": 0,
        "workersDetected": 0, "activeViolations": 0, "lastSeen": "—",
        **camera,
        "zoneName": zone["name"] if zone else "",
    }
