from unittest.mock import MagicMock
import pytest

import ultralytics
ultralytics.YOLO = MagicMock()

import main
from repositories import cameras, zones


@pytest.mark.asyncio
async def test_headless_session_zone_policy_resolution(monkeypatch):
    canned_cam = {
        "id": "00000000-0000-0000-0000-000000000003",
        "name": "Platform Cam",
        "zoneId": "construction-site",
    }
    canned_zone = {
        "id": "construction-site",
        "name": "Construction site",
        "requiredPpe": ["helmet", "vest", "gloves", "safety_shoes"],
    }

    async def fake_get_camera(cid):
        if cid == "00000000-0000-0000-0000-000000000003":
            return canned_cam
        return None

    async def fake_get_zone(slug):
        if slug == "construction-site":
            return canned_zone
        return None

    monkeypatch.setattr(cameras, "get_camera", fake_get_camera)
    monkeypatch.setattr(zones, "get_zone", fake_get_zone)

    req_ppe = await zones.required_ppe_for_zone("construction-site")
    assert req_ppe == frozenset({"helmet", "vest", "gloves", "safety_shoes"})
    assert "mask" not in req_ppe
    assert "eye_prot" not in req_ppe
