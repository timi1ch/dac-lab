import hashlib
import os

from sqlalchemy import (
    Column, DateTime, ForeignKey, Integer, String, create_engine, func,
)
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg2://postgres:passwd@127.0.0.1:5432/app",
)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    login = Column(String(32), unique=True, index=True, nullable=False)
    password_hash = Column(String(64), nullable=False)
    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now(),
    )


class UserSession(Base):
    __tablename__ = "user_sessions"

    # sha256-hex -> ровно 64 символа, поэтому String(64) вместо безразмерного String.
    token_hash = Column(String(64), primary_key=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    expires_at = Column(DateTime(timezone=True), nullable=False)


def hashed(password: str) -> str:
    """Детерминированный хэш (совместим с текущим backend).

    ВАЖНО: для продакшена по ТЗ нужен Argon2id/bcrypt — см. README.
    Здесь sha256 сохраняется, т.к. используется в `token_hash = hashed(token)`
    и в сравнении пароля `user.password_hash != hashed(password)`.
    """
    return hashlib.sha256(password.encode()).hexdigest()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()