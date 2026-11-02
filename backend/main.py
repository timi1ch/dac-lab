from core.application import app
from api import health, auth, resources
from db.connection import engine, Base

# Этот импорт ОБЯЗАТЕЛЕН, чтобы SQLAlchemy увидел твои модели и создал для них таблицы
import db.models

# Создаем таблицы в базе данных при старте
Base.metadata.create_all(bind=engine)

app.include_router(resources.router)