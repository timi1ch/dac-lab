import os
import secrets
from pathlib import Path


env_file = Path(__file__).resolve().parents[2] / ".env"
if env_file.is_file():
    from dotenv import load_dotenv
    load_dotenv(env_file)

HASH_SCHEME = os.getenv("HASH_SCHEME", "argon2")
if HASH_SCHEME != "argon2":
    raise ValueError("HASH_SCHEME должен быть argon2")

ARGON2_TIME_COST = int(os.getenv("ARGON2_TIME_COST", "2"))
ARGON2_MEMORY_COST = int(os.getenv("ARGON2_MEMORY_COST", "65536"))
ARGON2_PARALLELISM = int(os.getenv("ARGON2_PARALLELISM", "2"))
if min(ARGON2_TIME_COST, ARGON2_PARALLELISM) < 1 or ARGON2_MEMORY_COST < 8 * ARGON2_PARALLELISM:
    raise ValueError("Некорректные параметры Argon2id")

APP_ENV = os.getenv("APP_ENV", "development")
PORT = int(os.getenv("PORT", "8000"))
if not 1 <= PORT <= 65535:
    raise ValueError("PORT должен быть от 1 до 65535")
SECRET_KEY = os.getenv("SECRET_KEY") or secrets.token_hex(32)
