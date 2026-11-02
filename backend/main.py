from core.application import app
from api import health, auth, resources

app.include_router(resources.router)