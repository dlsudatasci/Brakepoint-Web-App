"""
Tests for Video management:
  POST   /api/upload_and_process/
  PATCH  /api/videos/<pk>/
  DELETE /api/videos/<pk>/
  GET    /api/videos/<pk>/progress/
"""
import pytest
from django.core.files.uploadedfile import SimpleUploadedFile


UPLOAD_URL = "/api/upload_and_process/"


def video_url(pk):
    return f"/api/videos/{pk}/"


def progress_url(pk):
    return f"/api/videos/{pk}/progress/"


CALLBACK_URL = "/api/model-results-callback/"


def _fake_video(name="clip.mp4", size_bytes=1024):
    """Return a SimpleUploadedFile that looks like a small video."""
    content = b"\x00" * size_bytes
    return SimpleUploadedFile(name, content, content_type="video/mp4")


# Upload validation 

@pytest.mark.django_db
def test_upload_without_file_returns_400(auth_client, camera):
    resp = auth_client.post(UPLOAD_URL, {"camera_id": camera.id}, format="multipart")
    assert resp.status_code == 400
    assert "No video file" in resp.json()["error"]


@pytest.mark.django_db
def test_upload_without_camera_id_returns_400(auth_client, db):
    resp = auth_client.post(UPLOAD_URL, {"file": _fake_video()}, format="multipart")
    assert resp.status_code == 400
    assert "Camera ID" in resp.json()["error"]


@pytest.mark.django_db
def test_upload_invalid_camera_returns_404(auth_client, db):
    resp = auth_client.post(UPLOAD_URL,
                            {"file": _fake_video(), "camera_id": 999999},
                            format="multipart")
    assert resp.status_code == 404


@pytest.mark.django_db
def test_upload_invalid_format_returns_400(auth_client, camera):
    bad_file = SimpleUploadedFile("document.txt", b"not a video", content_type="text/plain")
    resp = auth_client.post(UPLOAD_URL,
                            {"file": bad_file, "camera_id": camera.id},
                            format="multipart")
    assert resp.status_code == 400
    assert "Invalid file format" in resp.json()["error"]


@pytest.mark.django_db
def test_upload_oversized_file_returns_400(auth_client, camera, mocker):
    mocker.patch('BrakePoint.views.MAX_VIDEO_SIZE_MB', 0)  # any file is too large
    big_file = SimpleUploadedFile("clip.mp4", b"\x00" * 10, content_type="video/mp4")
    resp = auth_client.post(UPLOAD_URL,
                            {"file": big_file, "camera_id": camera.id},
                            format="multipart")
    assert resp.status_code == 400
    assert "too large" in resp.json()["error"].lower()


@pytest.mark.django_db
def test_upload_valid_file_returns_201(auth_client, camera):
    """
    A valid upload should immediately return 201 with processing_status='processing'.
    The actual ML detection runs in a background thread and is not awaited here.
    """
    resp = auth_client.post(UPLOAD_URL,
                            {"file": _fake_video(), "camera_id": camera.id},
                            format="multipart")
    assert resp.status_code == 201
    data = resp.json()
    assert data["success"] is True
    assert data["processing_status"] == "processing"
    assert "video_id" in data


@pytest.mark.django_db
def test_upload_requires_auth(anon_client, camera):
    resp = anon_client.post(UPLOAD_URL,
                            {"file": _fake_video(), "camera_id": camera.id},
                            format="multipart")
    assert resp.status_code == 401


@pytest.mark.django_db
def test_upload_uses_remote_pipeline_when_enabled(auth_client, camera, monkeypatch, mocker):
    monkeypatch.setenv("MODEL_SERVICE_ENABLED", "true")
    monkeypatch.setenv("MODEL_SERVICE_SUBMIT_URL", "http://model-service.local/api/v1/jobs")
    monkeypatch.setenv("MODEL_SERVICE_SHARED_TOKEN", "shared-token")
    monkeypatch.setenv("MODEL_SERVICE_CALLBACK_TOKEN", "callback-token")
    monkeypatch.setenv("MODEL_CALLBACK_BASE_URL", "http://django.internal:8000")

    mock_response = mocker.Mock()
    mock_response.ok = True
    mock_response.json.return_value = {"message": "accepted"}
    post_mock = mocker.patch("BrakePoint.views.requests.post", return_value=mock_response)

    resp = auth_client.post(
        UPLOAD_URL,
        {"file": _fake_video(), "camera_id": camera.id, "use_sign_detection": "true"},
        format="multipart",
    )

    assert resp.status_code == 201
    data = resp.json()
    assert data["success"] is True
    assert data["processing_status"] == "processing"

    called = post_mock.call_args
    assert called is not None
    assert called.kwargs["headers"]["Authorization"] == "Bearer shared-token"
    assert called.kwargs["data"]["callback_url"] == "http://django.internal:8000/api/model-results-callback/"
    assert called.kwargs["data"]["callback_token"] == "callback-token"


@pytest.mark.django_db
def test_model_results_callback_updates_video(anon_client, processing_video, monkeypatch):
    monkeypatch.setenv("MODEL_SERVICE_CALLBACK_TOKEN", "cb-secret")

    payload = {
        "video_id": processing_video.id,
        "status": "completed",
        "vehicles": 12,
        "speeding_count": 2,
        "swerving_count": 1,
        "abrupt_stopping_count": 3,
        "vehicle_breakdown": {"Car": 10, "Truck": 2},
        "meter_per_pixel": 0.52,
        "yolo_progress": 100,
    }
    resp = anon_client.post(
        CALLBACK_URL,
        payload,
        format="json",
        HTTP_X_MODEL_SERVICE_TOKEN="cb-secret",
    )

    assert resp.status_code == 200
    processing_video.refresh_from_db()
    assert processing_video.processing_status == "completed"
    assert processing_video.vehicles == 12
    assert processing_video.speeding_count == 2
    assert processing_video.vehicle_breakdown["Car"] == 10


@pytest.mark.django_db
def test_model_results_callback_rejects_invalid_token(anon_client, processing_video, monkeypatch):
    monkeypatch.setenv("MODEL_SERVICE_CALLBACK_TOKEN", "cb-secret")

    resp = anon_client.post(
        CALLBACK_URL,
        {"video_id": processing_video.id, "status": "completed"},
        format="json",
        HTTP_X_MODEL_SERVICE_TOKEN="wrong-token",
    )
    assert resp.status_code == 401


# PATCH (rename / calibration edit) 

@pytest.mark.django_db
def test_rename_video(auth_client, completed_video):
    resp = auth_client.patch(video_url(completed_video.id),
                             {"filename": "renamed_clip.mp4"}, format="json")
    assert resp.status_code == 200
    completed_video.refresh_from_db()
    assert completed_video.filename == "renamed_clip.mp4"


@pytest.mark.django_db
def test_update_calibration_settings(auth_client, completed_video):
    pts = [[10, 20], [30, 40]]
    resp = auth_client.patch(video_url(completed_video.id),
                             {"calibration_points": pts, "reference_distance_meters": 15.0},
                             format="json")
    assert resp.status_code == 200
    completed_video.refresh_from_db()
    assert completed_video.calibration_points == pts
    assert completed_video.reference_distance_meters == 15.0


@pytest.mark.django_db
def test_patch_with_no_fields_returns_400(auth_client, completed_video):
    resp = auth_client.patch(video_url(completed_video.id), {}, format="json")
    assert resp.status_code == 400


@pytest.mark.django_db
def test_patch_other_users_video_returns_404(auth_client, second_user, db):
    from BrakePoint.models import Camera, Video
    other_cam = Camera.objects.create(user=second_user, name="Cam", lat=14.60, lng=120.99)
    other_vid = Video.objects.create(camera=other_cam, filename="x.mp4",
                                     processing_status="completed")
    resp = auth_client.patch(video_url(other_vid.id), {"filename": "y.mp4"}, format="json")
    assert resp.status_code == 404


# DELETE 

@pytest.mark.django_db
def test_delete_video(auth_client, completed_video):
    from BrakePoint.models import Video
    resp = auth_client.delete(video_url(completed_video.id))
    assert resp.status_code == 200
    assert not Video.objects.filter(id=completed_video.id).exists()


@pytest.mark.django_db
def test_delete_other_users_video_returns_404(auth_client, second_user, db):
    from BrakePoint.models import Camera, Video
    other_cam = Camera.objects.create(user=second_user, name="Cam", lat=14.60, lng=120.99)
    other_vid = Video.objects.create(camera=other_cam, filename="x.mp4",
                                     processing_status="completed")
    resp = auth_client.delete(video_url(other_vid.id))
    assert resp.status_code == 404


# Progress endpoint 

@pytest.mark.django_db
def test_progress_returns_correct_shape(auth_client, processing_video):
    resp = auth_client.get(progress_url(processing_video.id))
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert "processing_status" in data
    assert "yolo_progress" in data


@pytest.mark.django_db
def test_progress_reflects_failed_status(auth_client, camera, db):
    from BrakePoint.models import Video
    failed = Video.objects.create(camera=camera, filename="bad.mp4",
                                  processing_status="failed")
    resp = auth_client.get(progress_url(failed.id))
    assert resp.status_code == 200
    assert resp.json()["processing_status"] == "failed"


@pytest.mark.django_db
def test_progress_returns_404_for_unknown_video(auth_client, db):
    resp = auth_client.get(progress_url(999999))
    assert resp.status_code == 404
