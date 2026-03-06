from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
import os
import uuid
from typing import Optional
import base64
from pydantic import BaseModel
import mimetypes

from app.database.database import get_db
from app.models.user import User
from app.schemas.user import ProfileResponse, ProfileUpdate, PasswordChange
from app.core.security import get_current_active_user

router = APIRouter()

# Для загрузки аватаров (в продакшене использовать S3 или другое хранилище)
UPLOAD_DIR = "uploads"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

def _avatar_to_base64(avatar_value: Optional[str]) -> Optional[str]:
    if not avatar_value:
        return None
    # Уже base64 data URL
    if isinstance(avatar_value, str) and avatar_value.startswith("data:"):
        return avatar_value
    # Если это URL вида /uploads/<file>
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

def to_profile_response(user: User) -> ProfileResponse:
    return ProfileResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        position=user.position,
        avatar=_avatar_to_base64(user.avatar),
        created_at=user.created_at,
    )

@router.get("/me", response_model=ProfileResponse)
def get_profile(
    current_user: User = Depends(get_current_active_user)
):
    """Получить профиль текущего пользователя"""
    return to_profile_response(current_user)

@router.put("/me", response_model=ProfileResponse)
def update_profile(
    profile_data: ProfileUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Обновить профиль текущего пользователя"""
    update_data = profile_data.model_dump(exclude_unset=True)
    
    for field, value in update_data.items():
        setattr(current_user, field, value)
    
    db.commit()
    db.refresh(current_user)
    return to_profile_response(current_user)

@router.post("/avatar", response_model=ProfileResponse)
def upload_avatar(
    file: UploadFile = File(None),
    avatar: UploadFile = File(None),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Загрузить аватар пользователя"""
    upload = file or avatar
    if upload is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing file"
        )
    if not upload.content_type or not upload.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an image"
        )
    
    # Генерируем уникальное имя файла
    file_extension = upload.filename.split(".")[-1] if "." in upload.filename else "jpg"
    unique_filename = f"{uuid.uuid4()}.{file_extension}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    
    # Сохраняем файл
    try:
        with open(file_path, "wb") as buffer:
            content = upload.file.read()
            buffer.write(content)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not save file"
        )
    
    # Обновляем URL аватара в базе данных
    # В реальном приложении здесь должен быть полный URL к файлу
    avatar_url = f"/uploads/{unique_filename}"
    current_user.avatar = avatar_url
    
    db.commit()
    db.refresh(current_user)
    return to_profile_response(current_user)

class AvatarBase64(BaseModel):
    data: str
    filename: Optional[str] = None
    contentType: Optional[str] = None

@router.post("/avatar/base64", response_model=ProfileResponse)
def upload_avatar_base64(
    payload: AvatarBase64,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    raw = payload.data
    content_type = payload.contentType
    if raw.startswith("data:") and ";base64," in raw:
        header, b64data = raw.split(",", 1)
        if header.startswith("data:"):
            ct = header[5:].split(";", 1)[0]
            content_type = content_type or ct
    else:
        b64data = raw
    try:
        binary = base64.b64decode(b64data)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid base64 data")
    ext = "jpg"
    if payload.filename and "." in payload.filename:
        ext = payload.filename.rsplit(".", 1)[1]
    elif content_type in ("image/png",):
        ext = "png"
    elif content_type in ("image/jpeg", "image/jpg"):
        ext = "jpg"
    unique_filename = f"{uuid.uuid4()}.{ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    try:
        with open(file_path, "wb") as f:
            f.write(binary)
    except Exception:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not save file")
    avatar_url = f"/uploads/{unique_filename}"
    current_user.avatar = avatar_url
    db.commit()
    db.refresh(current_user)
    return to_profile_response(current_user)

@router.post("/change-password")
def change_password(
    password_data: PasswordChange,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Изменить пароль пользователя"""
    from app.core.security import verify_password, get_password_hash
    
    # Проверяем текущий пароль
    if not verify_password(password_data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )
    
    # Устанавливаем новый пароль
    current_user.hashed_password = get_password_hash(password_data.new_password)
    db.commit()
    
    return {"message": "Password changed successfully"}
