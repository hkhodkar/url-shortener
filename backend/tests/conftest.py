import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app

BASE_URL = "http://sho.rt"


def make_client(seed: bool) -> TestClient:
    settings = Settings(database_url="sqlite://", short_base_url=BASE_URL, seed_demo_data=seed)
    return TestClient(create_app(settings), follow_redirects=False)


@pytest.fixture
def client():
    with make_client(seed=False) as test_client:
        yield test_client


@pytest.fixture
def seeded_client():
    with make_client(seed=True) as test_client:
        yield test_client


@pytest.fixture
def make_link(client):
    def _make(**payload):
        payload.setdefault("target_url", "https://example.com/some/long/path")
        response = client.post("/api/links", json=payload)
        assert response.status_code == 201, response.text
        return response.json()

    return _make
