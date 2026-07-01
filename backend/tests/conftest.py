"""Test setup: isolate the DB in a temp dir BEFORE the app is imported."""

import os
import tempfile

# Must be set before app.config reads DATA_DIR (conftest loads before tests).
os.environ.setdefault("DATA_DIR", tempfile.mkdtemp(prefix="pc_test_"))
os.environ.setdefault("GEMINI_API_KEY", "")  # keep AI disabled in tests

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


@pytest.fixture(scope="session")
def client():
    from app.main import app

    with TestClient(app) as c:  # lifespan runs init_db() + seed()
        yield c
