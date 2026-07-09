"""
Contract tests for GET /api/landing-objects/.
"""

import pytest


LANDING_OBJECTS_URL = "/api/landing-objects/"


@pytest.mark.django_db
def test_landing_objects_requires_auth(anon_client, db):
    resp = anon_client.get(LANDING_OBJECTS_URL)
    assert resp.status_code == 401


@pytest.mark.django_db
def test_landing_objects_contract_and_relationships(
    auth_client,
    aoi_location,
    sub_location,
    camera,
    completed_video,
):
    resp = auth_client.get(LANDING_OBJECTS_URL)
    assert resp.status_code == 200

    data = resp.json()
    assert data["success"] is True

    assert isinstance(data["aois"], list)
    assert isinstance(data["subareas"], list)
    assert isinstance(data["cameras"], list)
    assert isinstance(data["videos"], list)

    aoi = next((item for item in data["aois"] if item["id"] == aoi_location.id), None)
    assert aoi is not None
    assert "subarea_ids" in aoi
    assert "subarea_count" in aoi
    assert "camera_count" in aoi
    assert "adb" in aoi
    assert sub_location.id in aoi["subarea_ids"]

    subarea = next((item for item in data["subareas"] if item["id"] == sub_location.id), None)
    assert subarea is not None
    assert "camera_ids" in subarea
    assert "camera_count" in subarea
    assert "vehicle_breakdown" in subarea
    assert camera.id in subarea["camera_ids"]

    camera_item = next((item for item in data["cameras"] if item["id"] == camera.id), None)
    assert camera_item is not None
    assert "video_ids" in camera_item
    assert "video_count" in camera_item
    assert completed_video.id in camera_item["video_ids"]
    assert camera_item["video_count"] >= 1

    video_item = next((item for item in data["videos"] if item["id"] == completed_video.id), None)
    assert video_item is not None
    assert video_item["camera"] == camera.id
