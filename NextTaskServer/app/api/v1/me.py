from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from app.database.database import get_db
from app.models.user import User
from app.schemas.invite import IncomingInvite, IncomingInvitesResponse
from app.schemas.user import UserResponse
from app.core.security import get_current_active_user
from app.api.v1.invites import get_my_invites as invites_get_my_invites

router = APIRouter()

@router.get("/invites", response_model=IncomingInvitesResponse)
def get_my_invites(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить входящие приглашения пользователя"""
    return invites_get_my_invites(current_user, db)

@router.get("/profile", response_model=UserResponse)
def get_my_profile(
    current_user: User = Depends(get_current_active_user)
):
    """Получить профиль текущего пользователя"""
    return current_user
