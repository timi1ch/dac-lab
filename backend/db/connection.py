import hashlib
import hmac
import os
from argon2 import PasswordHasher, Type
from argon2.exceptions import InvalidHashError, VerificationError

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, create_engine, func
from sqlalchemy.engine import URL
from sqlalchemy.orm import declarative_base, sessionmaker

from backend.core.config import ARGON2_MEMORY_COST, ARGON2_PARALLELISM, ARGON2_TIME_COST, SECRET_KEY

DATABASE_URL = os.getenv("DATABASE_URL") or URL.create(
    "postgresql+psycopg2",
    username=os.getenv("POSTGRES_USER", "postgres"),
    password=os.getenv("POSTGRES_PASSWORD", "change_me"),
    host=os.getenv("POSTGRES_HOST", "127.0.0.1"),
    port=int(os.getenv("POSTGRES_PORT", "5432")),
    database=os.getenv("POSTGRES_DB", "lab4"),
).render_as_string(hide_password=False)

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    login = Column(String(32), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class UserSession(Base):
    __tablename__ = "user_sessions"

    token_hash = Column(String(64), primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)


def hashed(value: str) -> str:
    # Быстрый хеш используется для случайных токенов и проверки старых паролей.
    return hashlib.sha256(value.encode()).hexdigest()


password_hasher = PasswordHasher(
    time_cost=ARGON2_TIME_COST, memory_cost=ARGON2_MEMORY_COST,
    parallelism=ARGON2_PARALLELISM, type=Type.ID,
)


def token_hash(token: str) -> str:
    return hmac.new(SECRET_KEY.encode(), token.encode(), hashlib.sha256).hexdigest()


def hash_password(password: str) -> str:
    return password_hasher.hash(password)


def verify_password(password: str, stored: str) -> bool:
    if stored.startswith("$argon2id$"):
        try:
            return password_hasher.verify(stored, password)
        except (VerificationError, InvalidHashError):
            return False
    # Совместимость с аккаунтами, созданными до перехода на Argon2id.
    if stored.startswith("scrypt$"):
        try:
            _, salt, expected = stored.split("$")
            actual = hashlib.scrypt(
                password.encode(), salt=bytes.fromhex(salt),
                n=2**17, r=8, p=1, maxmem=256*1024*1024,
            ).hex()
            return hmac.compare_digest(actual, expected)
        except (ValueError, TypeError):
            return False
    return hmac.compare_digest(hashed(password), stored)


def get_db():
    with SessionLocal() as db:
        yield db
