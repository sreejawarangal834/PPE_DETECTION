import os
from unittest.mock import MagicMock
import httpx
import pytest
import respx

# Mock YOLO before main imports and initializes _names_model
import ultralytics
ultralytics.YOLO = MagicMock()

import main


@pytest.fixture(autouse=True)
def _reset_env(monkeypatch):
    monkeypatch.delenv("PPE_PLATFORM_CAMERA_IDS", raising=False)
    monkeypatch.setattr(main, "CAMERA_REGISTRY_URL", "http://fake-registry.local")
    monkeypatch.setattr(main, "CAMERA_REGISTRY_API_KEY", None)
    yield


@respx.mock
async def test_resolve_headless_camera_ids_list_shape(monkeypatch, caplog):
    route = respx.get("http://fake-registry.local/cameras/by-uc/uc3").mock(
        return_value=httpx.Response(200, json=[{"id": "cam-list-1"}, "cam-list-2"])
    )
    with caplog.at_level("INFO"):
        cams = await main._resolve_headless_camera_ids()

    assert cams == ["cam-list-1", "cam-list-2"]
    assert "Resolved headless camera IDs from registry" in caplog.text


@respx.mock
async def test_resolve_headless_camera_ids_dict_shape(monkeypatch, caplog):
    monkeypatch.setattr(main, "CAMERA_REGISTRY_API_KEY", "test-token")
    route = respx.get("http://fake-registry.local/cameras/by-uc/uc3").mock(
        return_value=httpx.Response(200, json={
            "uc_id": "uc3",
            "camera_ids": ["00000000-0000-0000-0000-000000000003", "cam-dict-2"]
        })
    )
    with caplog.at_level("INFO"):
        cams = await main._resolve_headless_camera_ids()

    assert cams == ["00000000-0000-0000-0000-000000000003", "cam-dict-2"]
    assert route.calls.last.request.headers["Authorization"] == "Bearer test-token"
    assert "Resolved headless camera IDs from registry" in caplog.text


async def test_resolve_headless_camera_ids_env_override(monkeypatch, caplog):
    monkeypatch.setenv("PPE_PLATFORM_CAMERA_IDS", "cam-env-1, cam-env-2")
    with caplog.at_level("INFO"):
        cams = await main._resolve_headless_camera_ids()

    assert cams == ["cam-env-1", "cam-env-2"]
    assert "Resolved headless camera IDs from PPE_PLATFORM_CAMERA_IDS" in caplog.text
