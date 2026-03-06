from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
from typing import Dict, Optional
import os
import base64
import mimetypes

from app.database.database import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserResponse, TokenPair, RefreshRequest
from app.core.security import (
    verify_password, get_password_hash, create_access_token, create_refresh_token,
    ACCESS_TOKEN_EXPIRE_MINUTES, get_current_active_user, verify_refresh_token
)

router = APIRouter()

UPLOAD_DIR = "uploads"


def _avatar_to_base64(avatar_value: Optional[str]) -> Optional[str]:
    if not avatar_value:
        return None
    if isinstance(avatar_value, str) and avatar_value.startswith("data:"):
        return avatar_value
    if isinstance(avatar_value, str) and avatar_value.startswith("/uploads/"):
        filename = avatar_value[len("/uploads/"):]
        file_path = os.path.join(UPLOAD_DIR, filename)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            mime, _ = mimetypes.guess_type(file_path)
            mime = mime or "image/jpeg"
            try:
                with open(file_path, "rb") as f:
                    data = f.read()
                b64 = base64.b64encode(data).decode("ascii")
                return f"data:{mime};base64,{b64}"
            except Exception:
                return avatar_value
    return avatar_value


@router.get("/users", response_model=list[UserResponse])
def list_users(search: Optional[str] = None, db: Session = Depends(get_db)):
    """Получить список пользователей, с поиском по email/имени."""
    query = db.query(User)
    if search:
        like = f"%{search}%"
        query = query.filter((User.email.ilike(like)) | (User.name.ilike(like)))
    users = query.order_by(User.name.asc().nulls_last(), User.email.asc()).all()
    return [
        UserResponse(
            id=u.id,
            email=u.email,
            name=u.name,
            position=u.position,
            avatar=_avatar_to_base64(u.avatar),
            is_active=u.is_active,
            created_at=u.created_at,
            updated_at=u.updated_at,
        )
        for u in users
    ]

@router.post("/register", response_model=UserResponse)
def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """Регистрация нового пользователя"""
    # Проверяем, существует ли пользователь с таким email
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Создаем нового пользователя
    hashed_password = get_password_hash(user_data.password)
    db_user = User(
        email=user_data.email,
        name=user_data.name,
        position=user_data.position,
        avatar=user_data.avatar,
        hashed_password=hashed_password
    )
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    return db_user

@router.post("/token", response_model=TokenPair)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """Аутентификация пользователя"""
    # OAuth2PasswordRequestForm использует поле username как email
    user = db.query(User).filter(User.email == form_data.username).first()
    
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    refresh_token = create_refresh_token(data={"sub": user.email})
    
    return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer"}

@router.get("/users/me", response_model=UserResponse)
def get_current_user_info(current_user: User = Depends(get_current_active_user)):
    """Получить информацию о текущем пользователе"""
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        position=current_user.position,
        avatar=_avatar_to_base64(current_user.avatar),
        is_active=current_user.is_active,
        created_at=current_user.created_at,
        updated_at=current_user.updated_at,
    )

@router.post("/refresh", response_model=TokenPair)
def refresh_token(payload: RefreshRequest, db: Session = Depends(get_db)):
    """Обновление access токена по refresh"""
    email = verify_refresh_token(payload.refresh_token)
    if not email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    user = db.query(User).filter(User.email == email).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid user")

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    new_access = create_access_token(data={"sub": user.email}, expires_delta=access_token_expires)
    # Можно ротировать refresh, но для простоты вернем старый
    return {"access_token": new_access, "refresh_token": payload.refresh_token, "token_type": "bearer"}
