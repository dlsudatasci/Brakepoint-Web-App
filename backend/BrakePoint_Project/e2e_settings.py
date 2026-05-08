"""
E2E-specific Django settings.
Inherits from test_settings but uses a file-based SQLite database
so that multiple processes (migrate, shell, runserver) share the same DB.
"""
from BrakePoint_Project.test_settings import *  # noqa: F401, F403

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": "/tmp/brakepoint_e2e.db",
    }
}
