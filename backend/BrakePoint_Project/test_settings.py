"""
Test-specific Django settings.
Inherits everything from the production settings and overrides only what
needs to change for a fast, isolated test run.
"""
from BrakePoint_Project.settings import *  # noqa: F401, F403

# Use an in-memory SQLite database — fast and isolated.
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}

# Skip password strength validators (speeds up user fixture creation).
AUTH_PASSWORD_VALIDATORS = []

# No real emails in tests.
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"

# A deterministic secret key so JWT signing is stable.
SECRET_KEY = "test-secret-key-do-not-use-in-production"

# Silence Django logging during tests.
LOGGING = {}
