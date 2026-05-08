"""
Tests for the dashboard summary endpoint and metrics accuracy:
  GET /api/dashboard-summary/
"""
import pytest
from django.utils import timezone
from datetime import date, timedelta


SUMMARY_URL = "/api/dashboard-summary/"


# Totals accuracy 

@pytest.mark.django_db
def test_totals_sum_completed_videos_only(auth_client, completed_video, processing_video):
    """Only completed videos must contribute to totals."""
    resp = auth_client.get(SUMMARY_URL)
    assert resp.status_code == 200
    totals = resp.json()["totals"]
    assert totals["vehicles"] == 20
    assert totals["speeding"] == 5
    assert totals["swerving"] == 3
    assert totals["abrupt_stopping"] == 2
    assert totals["adb"] == 10   


@pytest.mark.django_db
def test_totals_zero_when_no_completed_videos(auth_client, processing_video):
    resp = auth_client.get(SUMMARY_URL)
    totals = resp.json()["totals"]
    assert totals["vehicles"] == 0
    assert totals["adb"] == 0


@pytest.mark.django_db
def test_totals_accumulate_across_multiple_videos(auth_client, camera, db):
    from BrakePoint.models import Video
    for i in range(3):
        Video.objects.create(
            camera=camera,
            filename=f"clip_{i}.mp4",
            processing_status="completed",
            vehicles=10,
            speeding_count=2,
            swerving_count=1,
            abrupt_stopping_count=1,
        )
    resp = auth_client.get(SUMMARY_URL)
    totals = resp.json()["totals"]
    assert totals["vehicles"] == 30
    assert totals["speeding"] == 6
    assert totals["adb"] == 12   


@pytest.mark.django_db
def test_totals_excludes_other_users_videos(auth_client, second_user, db):
    from BrakePoint.models import Camera, Video
    other_cam = Camera.objects.create(user=second_user, name="Cam", lat=14.60, lng=120.99)
    Video.objects.create(camera=other_cam, filename="other.mp4",
                         processing_status="completed", vehicles=999)
    resp = auth_client.get(SUMMARY_URL)
    assert resp.json()["totals"]["vehicles"] == 0


# Date range filter

@pytest.mark.django_db
def test_date_range_start_filter(auth_client, camera, db):
    from BrakePoint.models import Video
    today = date.today()
    yesterday = today - timedelta(days=1)

    old = Video.objects.create(
        camera=camera, filename="old.mp4",
        processing_status="completed", vehicles=5,
        speeding_count=1, swerving_count=1, abrupt_stopping_count=0,
    )
    Video.objects.filter(id=old.id).update(uploaded_at=timezone.now() - timedelta(days=5))

    new = Video.objects.create(
        camera=camera, filename="new.mp4",
        processing_status="completed", vehicles=10,
        speeding_count=2, swerving_count=0, abrupt_stopping_count=0,
    )

    resp = auth_client.get(SUMMARY_URL, {"start": str(today)})
    assert resp.json()["totals"]["vehicles"] == 10


@pytest.mark.django_db
def test_date_range_end_filter(auth_client, camera, db):
    from BrakePoint.models import Video
    today = date.today()
    three_days_ago = today - timedelta(days=3)

    old = Video.objects.create(
        camera=camera, filename="old.mp4",
        processing_status="completed", vehicles=5,
        speeding_count=0, swerving_count=0, abrupt_stopping_count=0,
    )
    Video.objects.filter(id=old.id).update(uploaded_at=timezone.now() - timedelta(days=5))

    resp = auth_client.get(SUMMARY_URL, {"end": str(three_days_ago)})
    assert resp.json()["totals"]["vehicles"] == 5


# Sub-area breakdown 

@pytest.mark.django_db
def test_sub_area_metrics_aggregate_camera_videos(auth_client, completed_video, sub_location):
    """
    Dashboard summary must list the sub_location and correctly attribute
    the completed_video's counts to it.
    """
    resp = auth_client.get(SUMMARY_URL)
    assert resp.status_code == 200
    sub_areas = resp.json()["sub_areas"]
    match = next((s for s in sub_areas if s["id"] == sub_location.id), None)
    assert match is not None, "sub_location not found in sub_areas"
    assert match["vehicles"] == completed_video.vehicles
    assert match["speeding"] == completed_video.speeding_count
    assert match["adb"] == (
        completed_video.speeding_count
        + completed_video.swerving_count
        + completed_video.abrupt_stopping_count
    )


@pytest.mark.django_db
def test_summary_requires_auth(anon_client, db):
    resp = anon_client.get(SUMMARY_URL)
    assert resp.status_code == 401
