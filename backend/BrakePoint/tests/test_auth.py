"""
Tests for authentication endpoints:
  POST /api/login/
  POST /api/signup/
  GET  /api/check-auth/
"""
import pytest


@pytest.mark.django_db
class TestLogin:
    URL = "/api/login/"

    def test_valid_credentials_returns_tokens(self, client, user):
        resp = client.post(self.URL, {"username": "testuser", "password": "testpass123"},
                           content_type="application/json")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert "access" in data
        assert "refresh" in data

    def test_wrong_password_returns_400(self, client, user):
        resp = client.post(self.URL, {"username": "testuser", "password": "wrongpass"},
                           content_type="application/json")
        assert resp.status_code == 400
        assert resp.json()["success"] is False

    def test_nonexistent_user_returns_400(self, client, db):
        resp = client.post(self.URL, {"username": "nobody", "password": "pass"},
                           content_type="application/json")
        assert resp.status_code == 400

    def test_empty_body_returns_400(self, client, db):
        resp = client.post(self.URL, {}, content_type="application/json")
        assert resp.status_code == 400

    def test_returned_user_matches(self, client, user):
        resp = client.post(self.URL, {"username": "testuser", "password": "testpass123"},
                           content_type="application/json")
        assert resp.json()["user"]["username"] == "testuser"


@pytest.mark.django_db
class TestSignup:
    URL = "/api/signup/"

    def test_valid_signup_succeeds(self, client, db):
        resp = client.post(self.URL,
                           {"username": "newuser", "email": "new@example.com", "password": "strongpass99"},
                           content_type="application/json")
        assert resp.status_code == 200
        assert resp.json()["success"] is True

    def test_duplicate_username_returns_400(self, client, user):
        resp = client.post(self.URL,
                           {"username": "testuser", "email": "dup@example.com", "password": "pass1234"},
                           content_type="application/json")
        assert resp.status_code == 400
        assert resp.json()["success"] is False

    def test_missing_username_returns_400(self, client, db):
        resp = client.post(self.URL, {"email": "x@example.com", "password": "pass1234"},
                           content_type="application/json")
        assert resp.status_code == 400

    def test_missing_password_returns_400(self, client, db):
        resp = client.post(self.URL, {"username": "newuser2", "email": "x@example.com"},
                           content_type="application/json")
        assert resp.status_code == 400


@pytest.mark.django_db
class TestCheckAuth:
    URL = "/api/check-auth/"

    def test_unauthenticated_returns_false(self, client, db):
        resp = client.get(self.URL)
        assert resp.status_code == 200
        assert resp.json()["authenticated"] is False

    def test_authenticated_returns_true(self, auth_client):
        resp = auth_client.get(self.URL)
        assert resp.status_code == 200
        assert resp.json()["authenticated"] is True
        assert resp.json()["user"]["username"] == "testuser"


@pytest.mark.django_db
class TestProtectedEndpoints:
    def test_cameras_endpoint_requires_auth(self, anon_client, db):
        resp = anon_client.get("/api/cameras/")
        assert resp.status_code == 401

    def test_cameras_endpoint_with_valid_token(self, auth_client):
        resp = auth_client.get("/api/cameras/")
        assert resp.status_code == 200
