"""
Tests for SavedLocation (AOI + sub-area) management:
  GET/POST /api/saved-locations/
  GET/PATCH/DELETE /api/saved-locations/<id>/
"""
import pytest


LIST_URL = "/api/saved-locations/"


def detail_url(pk):
    return f"/api/saved-locations/{pk}/"


# AOI ring used as the parent in sub-area tests 

AOI_RING = [
    [120.98, 14.59],
    [121.00, 14.59],
    [121.00, 14.61],
    [120.98, 14.61],
]

VALID_SUB_RING = [
    [120.985, 14.595],
    [120.995, 14.595],
    [120.995, 14.605],
    [120.985, 14.605],
]

OUTSIDE_SUB_RING = [
    [120.970, 14.595],
    [120.990, 14.595],
    [120.990, 14.605],
    [120.970, 14.605],
]

BOWTIE_RING = [
    [120.985, 14.595],
    [120.995, 14.605],
    [120.995, 14.595],
    [120.985, 14.605],
]

DEGENERATE_RING = [
    [120.985, 14.600],
    [120.990, 14.600],
    [120.995, 14.600],
]

INVALID_COORD_RING = [
    [999.00, 14.59],
    [121.00, 14.59],
    [121.00, 14.61],
    [120.98, 14.61],
]


# Helpers 

def _post_aoi(auth_client, ring=None):
    body = {
        "name": "My AOI",
        "lat": 14.60,
        "lng": 120.99,
        "location_type": "aoi",
    }
    if ring is not None:
        body["geometry"] = ring
    return auth_client.post(LIST_URL, body, format="json")


def _post_sub(auth_client, parent_id, ring):
    return auth_client.post(LIST_URL, {
        "name": "My Sub",
        "lat": 14.60,
        "lng": 120.99,
        "location_type": "sub_area",
        "parent_id": parent_id,
        "geometry": ring,
    }, format="json")


# Create tests 

@pytest.mark.django_db
def test_create_aoi_returns_201(auth_client):
    resp = _post_aoi(auth_client, ring=AOI_RING)
    assert resp.status_code == 201
    data = resp.json()
    assert data["success"] is True
    assert data["saved_location"]["location_type"] == "aoi"


@pytest.mark.django_db
def test_create_subarea_valid_geometry_returns_201(auth_client, aoi_location):
    resp = _post_sub(auth_client, aoi_location.id, VALID_SUB_RING)
    assert resp.status_code == 201
    assert resp.json()["success"] is True


@pytest.mark.django_db
def test_create_subarea_vertex_outside_aoi_returns_400(auth_client, aoi_location):
    resp = _post_sub(auth_client, aoi_location.id, OUTSIDE_SUB_RING)
    assert resp.status_code == 400
    assert "main AOI" in resp.json()["error"]


@pytest.mark.django_db
def test_create_subarea_self_intersecting_returns_400(auth_client, aoi_location):
    resp = _post_sub(auth_client, aoi_location.id, BOWTIE_RING)
    assert resp.status_code == 400
    assert "self-intersecting" in resp.json()["error"]


@pytest.mark.django_db
def test_create_subarea_degenerate_polygon_returns_400(auth_client, aoi_location):
    resp = _post_sub(auth_client, aoi_location.id, DEGENERATE_RING)
    assert resp.status_code == 400
    assert "degenerate" in resp.json()["error"].lower()


@pytest.mark.django_db
def test_create_location_invalid_coordinate_returns_400(auth_client, aoi_location):
    resp = _post_sub(auth_client, aoi_location.id, INVALID_COORD_RING)
    assert resp.status_code == 400
    assert "out of range" in resp.json()["error"].lower()


@pytest.mark.django_db
def test_create_subarea_invalid_parent_returns_404(auth_client, db):
    resp = auth_client.post(LIST_URL, {
        "name": "Orphan",
        "lat": 14.60,
        "lng": 120.99,
        "location_type": "sub_area",
        "parent_id": 999999,
        "geometry": VALID_SUB_RING,
    }, format="json")
    assert resp.status_code == 404


@pytest.mark.django_db
def test_create_requires_lat_lng(auth_client, db):
    resp = auth_client.post(LIST_URL, {"name": "No coords"}, format="json")
    assert resp.status_code == 400


# List / filter tests 

@pytest.mark.django_db
def test_list_returns_only_own_locations(auth_client, second_user, aoi_location, db):
    from BrakePoint.models import SavedLocation
    SavedLocation.objects.create(user=second_user, name="Other", lat=14.60, lng=120.99)
    resp = auth_client.get(LIST_URL)
    ids = [loc["id"] for loc in resp.json()["saved_locations"]]
    assert aoi_location.id in ids
    other_ids = list(SavedLocation.objects.filter(user=second_user).values_list("id", flat=True))
    for oid in other_ids:
        assert oid not in ids


@pytest.mark.django_db
def test_filter_by_parent_id(auth_client, aoi_location, sub_location):
    resp = auth_client.get(LIST_URL, {"parent_id": aoi_location.id})
    data = resp.json()["saved_locations"]
    assert len(data) == 1
    assert data[0]["id"] == sub_location.id


@pytest.mark.django_db
def test_filter_by_type_aoi(auth_client, aoi_location, sub_location):
    resp = auth_client.get(LIST_URL, {"type": "aoi"})
    ids = [loc["id"] for loc in resp.json()["saved_locations"]]
    assert aoi_location.id in ids
    assert sub_location.id not in ids


# Update tests 

@pytest.mark.django_db
def test_update_subarea_name(auth_client, sub_location):
    resp = auth_client.patch(detail_url(sub_location.id), {"name": "Renamed"}, format="json")
    assert resp.status_code == 200
    sub_location.refresh_from_db()
    assert sub_location.name == "Renamed"


# Delete / cascade tests 

@pytest.mark.django_db
def test_delete_aoi_also_deletes_sub_areas(auth_client, aoi_location, sub_location):
    from BrakePoint.models import SavedLocation
    assert SavedLocation.objects.filter(id=sub_location.id).exists()
    resp = auth_client.delete(detail_url(aoi_location.id))
    assert resp.status_code == 200
    assert not SavedLocation.objects.filter(id=sub_location.id).exists()


@pytest.mark.django_db
def test_delete_location_returns_success(auth_client, aoi_location):
    resp = auth_client.delete(detail_url(aoi_location.id))
    assert resp.status_code == 200
    assert resp.json()["success"] is True


@pytest.mark.django_db
def test_cannot_access_other_users_location(auth_client, second_user, db):
    from BrakePoint.models import SavedLocation
    other_loc = SavedLocation.objects.create(user=second_user, name="Private", lat=14.60, lng=120.99)
    resp = auth_client.get(detail_url(other_loc.id))
    assert resp.status_code == 404
