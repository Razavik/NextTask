from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
from datetime import datetime

class NotificationSettings(BaseModel):
    emailNotifications: bool = True
    pushNotifications: bool = False

class HotkeySettings(BaseModel):
    openSettings: str = "Ctrl+Shift+/"
    openProfile: str = "Ctrl+Shift+P"
    openPlanning: str = "Ctrl+Shift+L"
    openChat: str = "Ctrl+Shift+C"

class UserSettings(BaseModel):
    theme: Optional[str] = None
    notifications: NotificationSettings = NotificationSettings()
    hotkeys: HotkeySettings = HotkeySettings()

class UserBase(BaseModel):
    email: EmailStr
    name: Optional[str] = None
    position: Optional[str] = None
    avatar: Optional[str] = None

    @field_validator('name', mode='before')
    @classmethod
    def normalize_name(cls, v):
        return "" if v is None else v

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    name: Optional[str] = None
    position: Optional[str] = None
    avatar: Optional[str] = None

class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

class ProfileResponse(UserBase):
    id: int
    created_at: Optional[datetime] = None
    settings: Optional[UserSettings] = None

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    position: Optional[str] = None
    settings: Optional[UserSettings] = None

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str

class RefreshRequest(BaseModel):
    refresh_token: str
