<div align="center">

# Res2Share

**A full-stack demonstration of discretionary access control.**

Create an account, own a resource, and decide who can read, update, or delete it.
Every access decision is enforced by the backend.

[Quick start](#quick-start) · [Access model](#access-model) · [API](#api-reference) · [Testing](#testing) · [Configuration](#configuration)

**React · TypeScript · FastAPI · PostgreSQL · SQLAlchemy · Alembic · Docker Compose**

</div>

---

## Overview

Res2Share implements an ownership-based permission model. A resource belongs to its creator, and its owner can grant individual permissions to other registered users. Receiving access does not grant the ability to delegate it.

The project includes registration, session-based authentication, resource management, a permissions editor, and an interactive scenario that demonstrates both allowed and denied requests.

### Features

- **Account registration:** validated credentials, unique logins, and explicit error responses.
- **Argon2id password hashing:** random salts and configurable resource costs.
- **Authenticated sessions:** opaque bearer tokens, a 24-hour lifetime, and server-side logout.
- **Resource ownership:** owners retain full control over their resources.
- **Independent permissions:** read, update, and delete access can be granted or revoked separately.
- **Backend authorization:** direct API requests are subject to the same checks as frontend actions.
- **PostgreSQL migrations:** schema changes are managed through Alembic.
- **Structured logging:** application events are emitted as JSON without request bodies or credentials.
- **HTTP tests:** pytest exercises registration and access control against a separate PostgreSQL database.

## Contents

- [Quick start](#quick-start)
- [Access model](#access-model)
- [Architecture](#architecture)
- [Local development](#local-development)
- [Configuration](#configuration)
- [API reference](#api-reference)
- [Try the API](#try-the-api)
- [Testing](#testing)
- [Database and migrations](#database-and-migrations)
- [Logs and operations](#logs-and-operations)
- [Security: what is implemented](#security-what-is-implemented)
- [Troubleshooting](#troubleshooting)

## Quick start

### Prerequisites

- Docker Engine or Docker Desktop with Docker Compose v2.
- Access to Docker Hub, PyPI, and the npm registry for the initial build.
- Available host ports `5173`, `8000`, and `5432` with the default configuration.

### Start the application

Clone the repository and enter its directory:

```bash
git clone https://github.com/timi1ch/res2share-lab.git
cd res2share-lab
```

Create your local configuration if it does not already exist:

```bash
test -f .env || cp .env.example .env
```

Set `POSTGRES_PASSWORD` and `SECRET_KEY` in `.env`. Keep the local `DATABASE_URL` consistent with your PostgreSQL credentials. To generate a secret key using Docker:

```bash
docker run --rm python:3.13-slim python -c 'import secrets; print(secrets.token_hex(32))'
```

Build and start the stack:

```bash
docker compose up --build -d
```

Compose starts PostgreSQL, waits for its health check, applies database migrations, and starts the API and frontend in separate containers.

| Service | Default address |
| --- | --- |
| Web application | http://localhost:5173 |
| API documentation | http://localhost:8000/docs |
| OpenAPI schema | http://localhost:8000/openapi.json |
| API health endpoint | http://localhost:8000/api/health |
| PostgreSQL on the host | `127.0.0.1:5432` |

Check the services:

```bash
docker compose ps -a
```

Open **Demo scenario** in the web application to create three demonstration accounts and exercise the permission model. The interface currently uses Engilsh labels.

Stop the application:

```bash
docker compose down
```

Database records are stored in the `postgres_data` named volume and survive normal container recreation and `docker compose down`.

## Access model

Each resource has one owner. Permissions are stored for a specific `(user_id, resource_id)` pair in `resource_permissions`.

| Action | Owner | User with the corresponding permission | User without that permission |
| --- | --- | --- | --- |
| Read a resource | Allowed | Requires `can_read` | `403 Forbidden` |
| Update a resource | Allowed | Requires `can_update` | `403 Forbidden` |
| Delete a resource | Allowed | Requires `can_delete` | `403 Forbidden` |
| View or modify the access list | Allowed | Forbidden | Forbidden |

Permissions are independent: permission to update or delete does not imply permission to read. The resource list contains resources owned by the current user or explicitly available for reading.

Only the owner can assign permissions. Sending all three flags as `false` revokes the recipient's access. The resource owner cannot be changed through the resource update endpoint.

## Architecture

```mermaid
flowchart LR
    Browser[Browser] --> Frontend[React / Vite]
    Frontend -->|/api proxy| Backend[FastAPI]
    Backend -->|SQLAlchemy| Database[(PostgreSQL)]
    Migrations[Alembic migrations] --> Database
```

The default Compose stack has three services: `frontend`, `backend`, and `db`. Test services are enabled separately through the `test` profile.

```text
.
├── backend/
│   ├── api/                 # Authentication, resources, and health endpoints
│   ├── core/                # FastAPI application, configuration, and logging
│   ├── db/                  # ORM models, session management, and resource queries
│   ├── schemas/             # Request validation with Pydantic
│   ├── tests/               # pytest HTTP and access-control tests
│   ├── main.py              # Application entry point
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/pages/           # Registration, login, resources, and demonstration
│   ├── src/api.ts           # HTTP client and browser session storage
│   ├── Dockerfile
│   └── package.json
├── alembic/                 # Migration environment and revisions
├── alembic.ini
├── compose.yaml
└── .env.example
```

All backend imports use the `backend.*` namespace. Run backend and migration commands from the repository root.

## Local development

Use this setup when running the application against an existing PostgreSQL instance without application containers.

### Backend

Use Python 3.13, matching the backend image, and an existing PostgreSQL database. The Compose database image uses PostgreSQL 17.

```bash
python3 -m venv backend/.venv
source backend/.venv/bin/activate
python -m pip install -r backend/requirements.txt

test -f .env || cp .env.example .env
```

Set `DATABASE_URL` in `.env` to your existing database, then run:

```bash
alembic upgrade head
python -m backend.main
```

For automatic reload with the default port:

```bash
uvicorn backend.main:app --reload --port 8000
```

### Frontend

Use Node.js 20, matching the frontend image. In a separate terminal:

```bash
cd frontend
npm ci
npm run dev
```

Vite forwards `/api` requests to `http://127.0.0.1:8000` by default. For another backend address:

```bash
BACKEND_URL=http://127.0.0.1:9000 npm run dev
```

Check TypeScript and build frontend assets:

```bash
npm run build
```

## Configuration

`.env` is local and ignored by Git. `.env.example` documents the supported application settings. Existing environment variables take precedence over `.env`.

| Variable | Default | Purpose |
| --- | --- | --- |
| `POSTGRES_USER` | `postgres` | PostgreSQL role. |
| `POSTGRES_PASSWORD` | `change_me` | PostgreSQL password; replace for your environment. |
| `POSTGRES_DB` | `lab4` | Application database name. |
| `POSTGRES_HOST` | `127.0.0.1` locally | Host used when deriving a database URL; Compose sets it to `db`. |
| `POSTGRES_PORT` | `5432` | Port used when deriving a database URL. |
| `DATABASE_URL` | Derived from `POSTGRES_*` if unset or empty | Explicit SQLAlchemy connection URL. The example file supplies a local URL. |
| `DOCKER_DATABASE_URL` | Empty | Optional connection URL passed to the backend container instead of its derived address. |
| `HASH_SCHEME` | `argon2` | The supported password-hashing scheme. |
| `ARGON2_TIME_COST` | `2` | Argon2id time cost. |
| `ARGON2_MEMORY_COST` | `65536` | Argon2id memory cost in KiB. |
| `ARGON2_PARALLELISM` | `2` | Argon2id parallelism. |
| `SECRET_KEY` | Development placeholder in Compose | HMAC key used for session-token fingerprints. Set a persistent random value. |
| `APP_ENV` | `development` | Environment name included in the startup log event. |
| `PORT` | `8000` | Backend listening port. Compose also updates its port mapping and frontend proxy. |
| `BACKEND_URL` | `http://127.0.0.1:8000` locally | Vite proxy destination; Compose sets the internal backend address. |
| `TEST_DATABASE_URL` | Set by the test service | Connection URL for a dedicated PostgreSQL test database. |

For local development, the example URL is:

```dotenv
DATABASE_URL=postgresql+psycopg2://postgres:change_me@127.0.0.1:5432/lab4
```

Compose builds the backend's database address from `POSTGRES_*`; it does not pass the local `DATABASE_URL` into the container. Use `DOCKER_DATABASE_URL` to override that connection explicitly.

PostgreSQL initialization variables apply when its data directory is first created. Changing a password in `.env` does not change the password of an existing database role.

## API reference

Registration, login, and health checks are public. All other endpoints require:

```http
Authorization: Bearer <access_token>
```

| Method | Endpoint | Description | Success |
| --- | --- | --- | --- |
| `GET` | `/api/health` | Check API responsiveness. | `200` |
| `POST` | `/api/register` | Register with `login` and `password`. | `201` |
| `POST` | `/api/login` | Authenticate and receive an access token. | `200` |
| `POST` | `/api/logout` | Revoke the current session. | `200` |
| `GET` | `/api/resources` | List resources readable by the current user. | `200` |
| `POST` | `/api/resources` | Create a resource with `title` and optional `content`. | `201` |
| `GET` | `/api/resources/{id}` | Read a resource. | `200` |
| `PUT` | `/api/resources/{id}` | Update the supplied `title` and/or `content`. | `200` |
| `DELETE` | `/api/resources/{id}` | Delete a resource. | `200` |
| `GET` | `/api/resources/{id}/permissions` | List grants; owner only. | `200` |
| `PUT` | `/api/resources/{id}/permissions` | Set a user's permission flags; owner only. | `200` |

### Validation and errors

- **Login:** 3–32 characters; Latin letters, digits, `.`, `_`, and `-`.
- **Password:** at least 8 characters, including an uppercase letter, a lowercase letter, a digit, and a special character.
- **Resource title:** 1–200 characters.

| Status | Meaning |
| --- | --- |
| `400` | Invalid operation, such as assigning permissions to the owner. |
| `401` | Missing, invalid, expired, or revoked session. |
| `403` | The authenticated user lacks the required permission. |
| `404` | Resource or permission recipient not found. |
| `409` | Login already registered. |
| `422` | Request validation failed. |
| `500` | Unexpected server error; the response contains a generic message. |

Error responses use `detail`, which is either a message or a list of field-validation errors. The frontend displays both formats. Response messages currently use Russian text.

## Try the API

This example uses Bash, `curl`, and Python 3 for JSON extraction. Run it against a started stack with the default backend port. Use fresh account names if these names already exist.

### 1. Register three users

```bash
API=http://localhost:8000/api

for login in owner reader stranger; do
  curl -sS "$API/register" \
    -H 'Content-Type: application/json' \
    -d "{\"login\":\"$login\",\"password\":\"Demo#Pass123\"}"
  printf '\n'
done
```

### 2. Sign in

```bash
login_token() {
  curl -fsS "$API/login" \
    -H 'Content-Type: application/json' \
    -d "{\"login\":\"$1\",\"password\":\"Demo#Pass123\"}" \
    | python3 -c 'import json, sys; print(json.load(sys.stdin)["access_token"])'
}

OWNER_TOKEN=$(login_token owner)
READER_TOKEN=$(login_token reader)
STRANGER_TOKEN=$(login_token stranger)
```

### 3. Create a resource and grant read access

```bash
RESOURCE_ID=$(curl -fsS "$API/resources" \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"title":"Quarterly report","content":"Confidential report content"}' \
  | python3 -c 'import json, sys; print(json.load(sys.stdin)["id"])')

curl -i -X PUT "$API/resources/$RESOURCE_ID/permissions" \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"login":"reader","can_read":true,"can_update":false,"can_delete":false}'
```

### 4. Verify allowed and denied access

```bash
# 200: the reader has read access.
curl -i "$API/resources/$RESOURCE_ID" \
  -H "Authorization: Bearer $READER_TOKEN"

# 403: the stranger has no access.
curl -i "$API/resources/$RESOURCE_ID" \
  -H "Authorization: Bearer $STRANGER_TOKEN"

# 403: read access does not permit updates.
curl -i -X PUT "$API/resources/$RESOURCE_ID" \
  -H "Authorization: Bearer $READER_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"content":"An unauthorized update"}'
```

### 5. Revoke access

```bash
curl -i -X PUT "$API/resources/$RESOURCE_ID/permissions" \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"login":"reader","can_read":false,"can_update":false,"can_delete":false}'

# 403: the previous grant has been revoked.
curl -i "$API/resources/$RESOURCE_ID" \
  -H "Authorization: Bearer $READER_TOKEN"
```

## Testing

### Containerized PostgreSQL tests

```bash
docker compose --profile test run --build --rm tests
```

The test profile starts `test-db` separately from the application database. Tests apply Alembic migrations, check the resulting schema against the ORM models, and exercise the API through `TestClient`.

Coverage includes:

- Successful registration, duplicate logins, weak passwords, and invalid logins.
- Argon2id hashes, random salts, and configured hashing parameters.
- Allowed and denied resource access.
- All eight combinations of read, update, and delete permissions.
- Owner-only permission assignment and permission revocation.
- Session revocation on logout.
- Structured log events and omission of secrets from logs and error responses.

Stop the test database when finished:

```bash
docker compose --profile test stop test-db
```

The `test-db` service uses temporary in-memory storage. Running tests alone does not start the main application services.

### Local pytest

Install the backend requirements and create a separate PostgreSQL database whose name ends in `_test`. Then set its connection URL and run:

```bash
export TEST_DATABASE_URL='postgresql+psycopg2://postgres:your_password@127.0.0.1:5432/lab4_test'
python -m pytest -q backend/tests
```

The test fixtures reject non-PostgreSQL connections and database names without the `_test` suffix. They truncate the application tables in the selected test database before each test.

## Database and migrations

Schema changes are applied through Alembic. Importing the application does not create tables.

```bash
# Inspect the current revision and check model/schema consistency.
docker compose exec backend alembic current
docker compose exec backend alembic check
```

For development on the host:

```bash
alembic revision --autogenerate -m "Describe the schema change"
# Review the generated upgrade() and downgrade() functions.
alembic upgrade head
```

The initial revision can recognize existing application tables with the expected columns. Revision `0002` aligns user fields and expands password-hash storage. Its downgrade is deliberately blocked to avoid reducing hash storage to an incompatible length.

### Open psql

Inside the database container:

```bash
docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Useful read-only queries:

```sql
\dt
\d users

SELECT id, login, created_at FROM users;
SELECT id, title, owner_id FROM resources;
SELECT * FROM resource_permissions;
SELECT * FROM alembic_version;

\q
```

From the host, with the example credentials:

```bash
psql -h 127.0.0.1 -p 5432 -U postgres -d lab4
```

Compose publishes PostgreSQL only on the host loopback address.

## Logs and operations

```bash
# Container state, including services that exited.
docker compose ps -a

# Follow application logs.
docker compose logs -f backend

# Recent PostgreSQL logs.
docker compose logs --tail=100 db

# Rebuild after source or dependency changes.
docker compose up --build -d
```

Application log records use this structure:

```json
{
  "timestamp": "2026-11-03T12:00:00+00:00",
  "level": "INFO",
  "event": "registration_success",
  "path": "/api/register",
  "status": 201,
  "user_id": 1
}
```

Registration emits `registration_success`, `registration_duplicate`, and `registration_validation_failed`. Request validation and unexpected failures emit error events. Uvicorn and Alembic also produce their own operational logs.

## Security: what is implemented

- **Passwords:** Argon2id with a random salt per hash. Password verification accepts only Argon2id hashes. Hashes are refreshed on successful login when configured parameters change.
- **Sessions:** cryptographically random opaque tokens. PostgreSQL stores HMAC-SHA256 token fingerprints rather than the original tokens. Tokens expire after 24 hours; logout removes the current session.
- **Authorization:** ownership and individual permission flags are checked by the API before resource operations. Permission recipients cannot delegate access.
- **Input handling:** Pydantic validates request bodies, and SQLAlchemy constructs parameterized queries. Resource requests cannot supply arbitrary ownership fields.
- **Logging:** application events omit request bodies, passwords, password hashes, and session tokens. Validation responses omit raw input values.
- **Configuration:** local secrets are excluded from Git and Docker build contexts. Keep `SECRET_KEY` stable to preserve session-token verification across restarts; changing it invalidates existing sessions.

This repository is an educational application. Its Compose frontend runs the Vite development server; the stack does not configure HTTPS termination or registration/login rate limiting.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| `ECONNREFUSED` from the Vite proxy | Inspect `docker compose ps -a` and backend logs. In containers, the proxy must target the `backend` service. |
| `Connection refused` from host `psql` | Confirm that `db` is running and `127.0.0.1:5432:5432` is published. |
| PostgreSQL password authentication fails | Use the password originally set for the existing volume; editing `.env` does not modify database roles. |
| Docker cannot fetch a base image | Check connectivity to Docker Hub from the Docker daemon. The application has not been built at that stage. |
| Only `test-db` is running | Start the application with `docker compose up --build -d`; the test profile is separate. |
| Port `5432` is already allocated | Stop the conflicting listener or change the host-side database port in `compose.yaml`. |
| Protected requests return `401` | Sign in again and send the returned bearer token. Check token expiry and whether `SECRET_KEY` changed. |
| Tests reject a connection URL | Use a dedicated PostgreSQL database ending in `_test`, or run the Compose test profile. |
