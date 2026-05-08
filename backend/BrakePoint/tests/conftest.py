"""Shared pytest fixtures for BrakePoint tests."""
import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from BrakePoint.models import SavedLocation, Camera, Video


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------

@pytest.fixture
def user(db):
    return User.objects.create_user(
        username="testuser",
        email="test@example.com",
        password="testpass123",
    )


@pytest.fixture
def second_user(db):
    return User.objects.create_user(
        username="otheruser",
        email="other@example.com",
        password="otherpass123",
    )


@pytest.fixture
def auth_client(user):
    """APIClient pre-loaded with a valid JWT Bearer token for *user*."""
    client = APIClient()
    refresh = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(refresh.access_token)}")
    return client


@pytest.fixture
def anon_client():
    return APIClient()


# ---------------------------------------------------------------------------
# Domain objects
# ---------------------------------------------------------------------------

_AOI_RING = [
    [120.98, 14.59],
    [121.00, 14.59],
    [121.00, 14.61],
    [120.98, 14.61],
]

_VALID_SUB_RING = [
    [120.985, 14.595],
    [120.995, 14.595],
    [120.995, 14.605],
    [120.985, 14.605],
]


@pytest.fixture
def aoi_location(user, db):
    return SavedLocation.objects.create(
        user=user,
        name="Test AOI",
        lat=14.60,
        lng=120.99,
        geometry=_AOI_RING,
        bounds=[[120.98, 14.59], [121.00, 14.61]],
        location_type="aoi",
    )


@pytest.fixture
def sub_location(user, aoi_location, db):
    return SavedLocation.objects.create(
        user=user,
        name="Test Sub-area",
        lat=14.60,
        lng=120.99,
        geometry=_VALID_SUB_RING,
        location_type="sub_area",
        parent_id=aoi_location.id,
    )


@pytest.fixture
def camera(user, sub_location, db):
    return Camera.objects.create(
        user=user,
        saved_location=sub_location,
        name="Test Camera",
        lat=14.60,
        lng=120.99,
    )


@pytest.fixture
def completed_video(camera, db):
    """A video that has finished processing with known detection counts."""
    return Video.objects.create(
        camera=camera,
        filename="clip_a.mp4",
        processing_status="completed",
        vehicles=20,
        speeding_count=5,
        swerving_count=3,
        abrupt_stopping_count=2,
        vehicle_breakdown={"Car": 15, "Motorcycle": 5},
    )


@pytest.fixture
def processing_video(camera, db):
    """A video still being processed — should not appear in totals."""
    return Video.objects.create(
        camera=camera,
        filename="clip_b.mp4",
        processing_status="processing",
        vehicles=0,
        speeding_count=0,
        swerving_count=0,
        abrupt_stopping_count=0,
    )
