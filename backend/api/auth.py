import re
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from db.connection import get_db
from db.models import User
from core.security import get_password_hash, verify_password, create_access_token
from schemas.auth import UserAuth, Token
from core.application import app

# Регулярки по ТЗ
login_pattern = r"^[a-zA-Z0-9._-]{3,32}$"
# Минимум 8 символов, заглавная, строчная, цифра и спецсимвол (!@#$%^&* и т.д.)
password_pattern = r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/?]).{8,}$"

@app.post("/api/register")
def register(user_data: UserAuth, db: Session = Depends(get_db)):
    if not re.match(login_pattern, user_data.login):
        raise HTTPException(status_code=422, detail="Логин: от 3 до 32 символов, буквы, цифры, ., _, -")
    
    if not re.match(password_pattern, user_data.password):
        raise HTTPException(status_code=422, detail="Пароль: мин. 8 символов, заглавная, строчная, цифра и спецсимвол")

    if db.query(User).filter(User.login == user_data.login).first():
        raise HTTPException(status_code=409, detail="Пользователь с таким логином уже существует")
    
    new_user = User(login=user_data.login, password_hash=get_password_hash(user_data.password))
    db.add(new_user)
    db.commit()
    return {"message": "Пользователь успешно создан"}

@app.post("/api/login", response_model=Token)
def login(credentials: UserAuth, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.login == credentials.login).first()
    if not user or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Неверный логин или пароль")
    
    access_token = create_access_token(data={"sub": str(user.id)})
    return {"access_token": access_token, "token_type": "bearer"}