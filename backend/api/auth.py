import re
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.core.application import app
from backend.db.connection import User, UserSession, get_db, token_hash, hash_password, verify_password, password_hasher
from backend.core.logging import logger
from backend.schemas.auth import UserAuth


bearer = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
):
    user = None
    if credentials is not None:
        user = db.scalar(
            select(User)
            .join(UserSession, UserSession.user_id == User.id)
            .where(
                UserSession.token_hash == token_hash(credentials.credentials),
                UserSession.expires_at > datetime.now(timezone.utc),
            )
        )
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Войдите в систему повторно",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


@app.post("/api/register", status_code=status.HTTP_201_CREATED)
def register(user_data: UserAuth, db: Session = Depends(get_db)):
    login_pattern = r"^[a-zA-Z0-9._-]{3,32}$"
    if not re.fullmatch(login_pattern, user_data.login):
        logger.error("registration_validation_failed", extra={"path": "/api/register", "status": 422})
        raise HTTPException (
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Некорректный логин"
        )

    password = user_data.password
    if not (
        len(password) >= 8
        and any(character.islower() for character in password)
        and any(character.isupper() for character in password)
        and any(character in "0123456789" for character in password)
        and any(character in "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~" for character in password)
    ):
        logger.error("registration_validation_failed", extra={"path": "/api/register", "status": 422})
        raise HTTPException (
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Пароль не соответствует требованиям"
        )

    if db.scalar(select(User).where(User.login == user_data.login)) is not None:
        logger.info("registration_duplicate", extra={"path": "/api/register", "status": 409})
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Пользователь с таким именем уже существует" 
        ) 
    
    user = User(login=user_data.login, password_hash=hash_password(user_data.password))
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        if db.scalar(select(User).where(User.login == user_data.login)) is not None:
            logger.info("registration_duplicate", extra={"path": "/api/register", "status": 409})
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Пользователь с таким именем уже существует",
            ) from None
        raise

    logger.info("registration_success", extra={"path": "/api/register", "status": 201, "user_id": user.id})
    return {
        "message": "Пользователь успешно создан", 
        "username": user_data.login
    }


@app.post("/api/login")
def login(credentials: UserAuth, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.login == credentials.login))
    if not user or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный логин или пароль"
        )

    if password_hasher.check_needs_rehash(user.password_hash):
        user.password_hash = hash_password(credentials.password)

    token = secrets.token_urlsafe(32)
    db.add(UserSession(
        token_hash=token_hash(token),
        user_id=user.id,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
    ))
    db.commit()

    return {
        "message": "Вход успешно выполнен",
        "token_type": "bearer",
        "access_token": token,
    }


@app.post("/api/logout")
def logout(
    user: User = Depends(get_current_user),
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db),
):
    session = db.get(UserSession, token_hash(credentials.credentials))
    if session is not None:
        db.delete(session)
    db.commit()
    return {"message": "Вы вышли из системы"}

