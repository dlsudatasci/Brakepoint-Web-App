"""
Tests for Camera management:
  GET/POST  /api/cameras/
  DELETE    /api/cameras/<pk>/
  POST      /api/cameras/<pk>/polygon/
  PATCH     /api/cameras/<pk>/assign-saved-location/
"""
import pytest


CAMERAS_URL = "/api/cameras/"


def camera_url(pk):
    return f"/api/cameras/{pk}/"


def polygon_url(pk):
    return f"/api/cameras/{pk}/polygon/"


def assign_url(camera_pk):
    return f"/api/cameras/{camera_pk}/assign-saved-location/"


# Create 
@pytest.mark.django_db
def test_create_camera_returns_201(auth_client):
    resp = auth_client.post(CAMERAS_URL, {"lat": 14.60, "lng": 120.99}, format="json")
    assert resp.status_code == 201
    data = resp.json()
    assert data["success"] is True
    assert "camera" in data


@pytest.mark.django_db
def test_create_camera_missing_lat_lng_returns_400(auth_client):
    resp = auth_client.post(CAMERAS_URL, {"name": "No coords"}, format="json")
    assert resp.status_code in (400, 422)


@pytest.mark.django_db
def test_create_camera_requires_auth(anon_client, db):
    resp = anon_client.post(CAMERAS_URL, {"lat": 14.60, "lng": 120.99}, format="json")
    assert resp.status_code == 401


# List 

@pytest.mark.django_db
def test_list_cameras_returns_only_own(auth_client, camera, second_user, db):
    from BrakePoint.models import Camera
    Camera.objects.create(user=second_user, name="Other", lat=14.60, lng=120.99)
    resp = auth_client.get(CAMERAS_URL)
    assert resp.status_code == 200
    ids = [c["id"] for c in resp.json()["cameras"]]
    assert camera.id in ids
    other_ids = list(Camera.objects.filter(user=second_user).values_list("id", flat=True))
    for oid in other_ids:
        assert oid not in ids


# Delete 

@pytest.mark.django_db
def test_delete_camera_returns_200(auth_client, camera):
    from BrakePoint.models import Camera
    resp = auth_client.delete(camera_url(camera.id))
    assert resp.status_code == 200
    assert not Camera.objects.filter(id=camera.id).exists()


@pytest.mark.django_db
def test_delete_camera_cascades_to_videos(auth_client, camera, completed_video):
    from BrakePoint.models import Video
    assert Video.objects.filter(camera=camera).exists()
    auth_client.delete(camera_url(camera.id))
    assert not Video.objects.filter(camera_id=camera.id).exists()


@pytest.mark.django_db
def test_delete_other_users_camera_returns_404(auth_client, second_user, db):
    from BrakePoint.models import Camera
    other_cam = Camera.objects.create(user=second_user, name="Other", lat=14.60, lng=120.99)
    resp = auth_client.delete(camera_url(other_cam.id))
    assert resp.status_code == 404


# Polygon 

POLYGON = [[120.985, 14.595], [120.990, 14.595], [120.990, 14.600], [120.985, 14.600]]


@pytest.mark.django_db
def test_set_camera_polygon(auth_client, camera):
    resp = auth_client.patch(polygon_url(camera.id), {"polygon": POLYGON}, format="json")
    assert resp.status_code == 200
    camera.refresh_from_db()
    assert camera.polygon == POLYGON


@pytest.mark.django_db
def test_clear_camera_polygon(auth_client, camera):
    camera.polygon = POLYGON
    camera.save()
    resp = auth_client.patch(polygon_url(camera.id), {"polygon": []}, format="json")
    assert resp.status_code == 200
    camera.refresh_from_db()
    assert camera.polygon == []


# Assign to saved location 

@pytest.mark.django_db
def test_assign_camera_to_saved_location(auth_client, camera, aoi_location):
    resp = auth_client.patch(assign_url(camera.id),
                             {"saved_location_id": aoi_location.id}, format="json")
    assert resp.status_code == 200
    camera.refresh_from_db()
    assert camera.saved_location_id == aoi_location.id


@pytest.mark.django_db
def test_unassign_camera_from_saved_location(auth_client, camera):
    resp = auth_client.patch(assign_url(camera.id),
                             {"saved_location_id": None}, format="json")
    assert resp.status_code == 200
    camera.refresh_from_db()
    assert camera.saved_location is None


# State management: saved location deletion 

@pytest.mark.django_db
def test_camera_saved_location_nullified_on_location_delete(auth_client, camera, sub_location):
    """
    Camera.saved_location uses on_delete=SET_NULL, so deleting the location
    must not delete the camera but must clear its saved_location FK.
    """
    from BrakePoint.models import Camera
    assert camera.saved_location_id == sub_location.id
    sub_location.delete()
    camera.refresh_from_db()
    assert Camera.objects.filter(id=camera.id).exists()
    assert camera.saved_location is None
