import itertools
import json
import logging

import pytest
from sqlalchemy import select


def test_registration(client):
    data = {"login": "alice", "password": "Demo#Pass123"}
    response = client.post("/api/register", json=data)
    assert response.status_code == 201
    assert response.json()["username"] == "alice"
    from backend.db.connection import SessionLocal, User, verify_password
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.login == "alice"))
        assert user.created_at is not None
        assert user.password_hash.startswith("$argon2id$")
        assert verify_password(data["password"], user.password_hash)
    assert data["password"] not in response.text


def test_duplicate_login(client):
    data = {"login": "alice", "password": "Demo#Pass123"}
    assert client.post("/api/register", json=data).status_code == 201
    response = client.post("/api/register", json=data)
    assert response.status_code == 409
    assert response.json()["detail"]


def test_weak_password(client):
    response = client.post("/api/register", json={"login": "alice", "password": "weak"})
    assert response.status_code == 422
    assert response.json()["detail"]


def test_salt_and_configured_parameters(client):
    from argon2 import extract_parameters, Type
    from backend.core.config import ARGON2_TIME_COST, ARGON2_MEMORY_COST, ARGON2_PARALLELISM
    from backend.db.connection import SessionLocal, User

    for name in ("first", "second"):
        assert client.post("/api/register", json={"login": name, "password": "Same#Pass123"}).status_code == 201
    with SessionLocal() as db:
        users = db.scalars(select(User).order_by(User.id)).all()
        assert users[0].password_hash != users[1].password_hash
        parameters = extract_parameters(users[0].password_hash)
        assert parameters.type == Type.ID
        assert parameters.time_cost == ARGON2_TIME_COST
        assert parameters.memory_cost == ARGON2_MEMORY_COST
        assert parameters.parallelism == ARGON2_PARALLELISM


@pytest.mark.parametrize("login", ["ab", "a" * 33, "bad login", "имя", "alice\n"])
def test_invalid_login(client, login):
    assert client.post("/api/register", json={"login": login, "password": "Demo#Pass123"}).status_code == 422


def create_resource(client, accounts):
    response = client.post("/api/resources", headers=accounts["owner"], json={"title": "Report", "content": "Secret"})
    assert response.status_code == 201
    return response.json()["id"]


def grant(client, accounts, resource_id, **flags):
    response = client.put(f"/api/resources/{resource_id}/permissions", headers=accounts["owner"], json={"login": "reader", **flags})
    assert response.status_code == 200


def test_allowed_access(client, accounts):
    resource_id = create_resource(client, accounts)
    grant(client, accounts, resource_id, can_read=True)
    response = client.get(f"/api/resources/{resource_id}", headers=accounts["reader"])
    assert response.status_code == 200
    assert response.json()["content"] == "Secret"


def test_denied_access(client, accounts):
    resource_id = create_resource(client, accounts)
    response = client.get(f"/api/resources/{resource_id}", headers=accounts["stranger"])
    assert response.status_code == 403
    assert "Secret" not in response.text


@pytest.mark.parametrize("read,update,delete", list(itertools.product((False, True), repeat=3)))
def test_independent_permissions(client, accounts, read, update, delete):
    resource_id = create_resource(client, accounts)
    grant(client, accounts, resource_id, can_read=read, can_update=update, can_delete=delete)
    url = f"/api/resources/{resource_id}"
    assert client.get(url, headers=accounts["reader"]).status_code == (200 if read else 403)
    assert client.put(url, headers=accounts["reader"], json={"content": "Changed"}).status_code == (200 if update else 403)
    assert client.delete(url, headers=accounts["reader"]).status_code == (200 if delete else 403)


def test_only_owner_can_grant(client, accounts):
    resource_id = create_resource(client, accounts)
    grant(client, accounts, resource_id, can_read=True, can_update=True, can_delete=True)
    response = client.put(f"/api/resources/{resource_id}/permissions", headers=accounts["reader"], json={"login": "stranger", "can_read": True})
    assert response.status_code == 403


def test_revoke(client, accounts):
    resource_id = create_resource(client, accounts)
    grant(client, accounts, resource_id, can_read=True)
    grant(client, accounts, resource_id)
    assert client.get(f"/api/resources/{resource_id}", headers=accounts["reader"]).status_code == 403


def test_logout_revokes_token(client, accounts):
    assert client.post("/api/logout", headers=accounts["owner"]).status_code == 200
    assert client.get("/api/resources", headers=accounts["owner"]).status_code == 401


def test_log_events_do_not_contain_password(client, caplog):
    data = {"login": "alice", "password": "DoNotLog#123"}
    with caplog.at_level(logging.INFO, logger="backend"):
        assert client.post("/api/register", json=data).status_code == 201
        assert client.post("/api/register", json=data).status_code == 409
        assert client.post("/api/register", json={"login": "other", "password": "weak"}).status_code == 422
    events = {record.getMessage() for record in caplog.records}
    assert {"registration_success", "registration_duplicate", "registration_validation_failed"} <= events
    assert data["password"] not in caplog.text
    from backend.core.logging import JsonFormatter
    for record in caplog.records:
        if record.name == "backend":
            entry = json.loads(JsonFormatter().format(record))
            assert entry["level"] in ("INFO", "ERROR")


def test_validation_does_not_echo_input(client):
    response = client.post("/api/register", json={"password": "DoNotReturn#123"})
    assert response.status_code == 422
    assert "DoNotReturn#123" not in response.text
    assert "input" not in response.text


def test_unexpected_error_is_logged_without_secrets(client, monkeypatch, caplog):
    from backend.api import auth

    password = "SecretError#123"

    def fail_hash(_):
        raise RuntimeError(password)

    monkeypatch.setattr(auth, "hash_password", fail_hash)
    with caplog.at_level(logging.INFO, logger="backend"):
        response = client.post("/api/register", json={"login": "alice", "password": password})
    assert response.status_code == 500
    assert password not in response.text
    assert password not in caplog.text
    assert any(record.levelno == logging.ERROR and record.getMessage() == "request_failed" for record in caplog.records)
