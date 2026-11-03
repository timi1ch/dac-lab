import os
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import text
from sqlalchemy.engine import make_url


@pytest.fixture(scope="session")
def application():
    database_url = os.getenv("TEST_DATABASE_URL")
    if not database_url:
        pytest.fail("Задайте TEST_DATABASE_URL для отдельной PostgreSQL-базы *_test или запустите тесты через Compose")
    url = make_url(database_url)
    if url.get_backend_name() != "postgresql" or not (url.database or "").endswith("_test"):
        pytest.fail("Для тестов разрешена только отдельная PostgreSQL-база с именем *_test")
    os.environ["DATABASE_URL"] = database_url
    os.environ.setdefault("SECRET_KEY", "test-only-secret-key")

    from backend.main import app
    from backend.db.connection import engine

    config = Config(str(Path(__file__).resolve().parents[2] / "alembic.ini"))
    command.upgrade(config, "head")
    # Проверяем, что после миграций схема совпадает с ORM-моделями.
    command.check(config)
    yield app
    engine.dispose()


@pytest.fixture()
def client(application):
    from fastapi.testclient import TestClient
    from backend.db.connection import engine

    with engine.begin() as connection:
        connection.execute(text(
            "TRUNCATE resource_permissions, resources, user_sessions, users RESTART IDENTITY CASCADE"
        ))
    with TestClient(application) as test_client:
        yield test_client


@pytest.fixture()
def accounts(client):
    tokens = {}
    for login in ("owner", "reader", "stranger"):
        data = {"login": login, "password": "Demo#Pass123"}
        assert client.post("/api/register", json=data).status_code == 201
        response = client.post("/api/login", json=data)
        assert response.status_code == 200
        tokens[login] = {"Authorization": f"Bearer {response.json()['access_token']}"}
    return tokens
