from core.application import app
from api import health, auth, resource
from db.connection import Base, engine


# Все модели загружены: создаём отсутствующие таблицы в настроенной базе.
Base.metadata.create_all(bind=engine)
