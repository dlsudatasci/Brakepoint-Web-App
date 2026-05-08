"""
Production settings — imported on the server.
Set DJANGO_SETTINGS_MODULE=BrakePoint_Project.production_settings
in the server's .env or systemd unit file.
"""

from .settings import *  # noqa: F401, F403

DEBUG = False

# Enforce SECRET_KEY from env — never fall back to the insecure default
import os as _os
SECRET_KEY = _os.environ["SECRET_KEY"]

# The server IP and any domain name you add later
ALLOWED_HOSTS = [
    "103.231.240.148",
    _os.getenv("ALLOWED_HOST", ""),
]

# Collected static files root (run collectstatic during deploy)
STATIC_ROOT = str(BASE_DIR / "staticfiles")  # noqa: F405

# Security headers — safe to enable once you add HTTPS
# SECURE_SSL_REDIRECT = True
# SESSION_COOKIE_SECURE = True
# CSRF_COOKIE_SECURE = True
# SECURE_HSTS_SECONDS = 31536000
