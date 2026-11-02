import re
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from core.application import app
from db.connection import User, UserSession, get_db, hashed
from schemas.auth import UserAuth


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
                UserSession.token_hash == hashed(credentials.credentials),
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
        raise HTTPException (
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Пароль не соответствует требованиям"
        )

    if db.scalar(select(User).where(User.login == user_data.login)) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Пользователь с таким именем уже существует" 
        ) 
    
    user = User(login=user_data.login, password_hash=hashed(user_data.password))
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        if db.scalar(select(User).where(User.login == user_data.login)) is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Пользователь с таким именем уже существует",
            ) from None
        raise

    return {
        "message": "Пользователь успешно создан", 
        "username": user_data.login
    }


@app.post("/api/login")
def login(credentials: UserAuth, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.login == credentials.login))
    if not user or user.password_hash != hashed(credentials.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный логин или пароль"
        )

    token = secrets.token_urlsafe(32)
    db.add(UserSession(
        token_hash=hashed(token),
        user_id=user.id,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
    ))
    db.commit()

    return {
        "message": "Вход успешно выполнен",
        "token_type": "bearer",
        "access_token": token,
    }

