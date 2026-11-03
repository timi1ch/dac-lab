from backend.core.application import app
from backend.api import health, auth, resource


if __name__ == "__main__":
    import uvicorn
    from backend.core.config import PORT
    uvicorn.run("backend.main:app", host="0.0.0.0", port=PORT)
