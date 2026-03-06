from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import secrets
import uuid
from typing import List, Optional

from app.database.database import get_db
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember
from app.models.invite import Invite, EmailInvite
from app.schemas.invite import (
    WorkspaceRef, UserRef, IncomingInvite, IncomingInvitesResponse,
    EmailInvite as EmailInviteSchema, EmailInvitesResponse, InviteLinkItemLegacy, InviteLinksResponse,
    AcceptInviteRequest, DeclineInviteRequest, EmailInviteRequest, InviteLinkRequest
)
from app.core.security import get_current_active_user
from app.api.v1.chat import manager

router = APIRouter()


def _notify_workspace_invite_status_changed(owner_id: int, workspace_id: int, workspace_name: str, invite_id: int, email: str, status_value: str):
    payload = {
        "type": "workspace_invite_status_changed",
        "invite": {
            "id": invite_id,
            "email": email,
            "workspace": {
                "id": workspace_id,
                "name": workspace_name,
            },
            "status": status_value,
        },
    }
    try:
        import asyncio
        asyncio.run(manager.send_personal_message(payload, owner_id))
    except Exception:
        pass

def generate_invite_token() -> str:
    """Генерирует уникальный токен приглашения"""
    return secrets.token_urlsafe(32)

@router.post("/workspaces/{workspace_id}/invites")
def create_workspace_invite(
    workspace_id: int,
    expires_hours: int = Query(24, ge=1, le=168),  # от 1 часа до 7 дней
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Создать приглашение по ссылке для рабочего пространства"""
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    # Только владелец может создавать приглашения
    if workspace.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only owner can create invites")
    
    # Генерируем токен и создаем приглашение
    token = generate_invite_token()
    expires_at = datetime.utcnow() + timedelta(hours=expires_hours)
    
    invite = Invite(
        token=token,
        workspace_id=workspace_id,
        inviter_id=current_user.id,
        role="reader",  # роль по умолчанию
        expires_at=expires_at
    )
    
    db.add(invite)
    db.commit()
    db.refresh(invite)
    
    return {
        "invite_url": f"http://localhost:5173/invite/{token}",
        "invite_token": token,
        "workspace_id": workspace_id,
        "expires_at": expires_at.isoformat()
    }

@router.get("/workspaces/{workspace_id}/invites", response_model=List[InviteLinkItemLegacy])
def get_workspace_invites(
    workspace_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить список приглашений рабочего пространства"""
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    # Только владелец может просматривать приглашения
    if workspace.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only owner can view invites")
    
    invites = db.query(Invite).filter(
        Invite.workspace_id == workspace_id,
        Invite.status == "pending"
    ).all()
    
    def to_invite_link_item(invite: Invite) -> InviteLinkItemLegacy:
        return InviteLinkItemLegacy(
            invite_token=invite.token,
            expires_at=invite.expires_at,
            times_used=getattr(invite, "times_used", 0),
            max_uses=getattr(invite, "max_uses", None)
        )
    
    return [to_invite_link_item(inv) for inv in invites]

@router.delete("/revoke/{token}")
def revoke_invite(
    token: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Отозвать приглашение"""
    invite = db.query(Invite).filter(Invite.token == token).first()
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    
    # Только владелец рабочего пространства может отозвать приглашение
    workspace = db.query(Workspace).filter(Workspace.id == invite.workspace_id).first()
    if workspace.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only workspace owner can revoke invite")
    
    invite.status = "expired"
    db.commit()
    
    return {"message": "Invite revoked successfully"}

@router.delete("/{invite_id}")
def revoke_invite_by_id(
    invite_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Отозвать приглашение по id"""
    invite = db.query(Invite).filter(Invite.id == invite_id).first()
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    workspace = db.query(Workspace).filter(Workspace.id == invite.workspace_id).first()
    if workspace.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only workspace owner can revoke invite")
    invite.status = "expired"
    db.commit()
    return {"message": "Invite revoked successfully"}

@router.post("/join/{token}")
def accept_invite(
    token: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Принять приглашение"""
    invite = db.query(Invite).filter(
        Invite.token == token,
        Invite.status == "pending"
    ).first()

    email_invite = None
    if not invite:
        email_invite = db.query(EmailInvite).filter(
            EmailInvite.token == token,
            EmailInvite.status == "pending"
        ).first()
        if not email_invite:
            raise HTTPException(status_code=404, detail="Invite not found or expired")
        if email_invite.email != current_user.email:
            raise HTTPException(status_code=403, detail="This invite is not for you")

        if email_invite.expires_at < datetime.utcnow():
            email_invite.status = "expired"
            db.commit()
            raise HTTPException(status_code=400, detail="Invite has expired")

        existing_membership = db.query(WorkspaceMember).filter(
            WorkspaceMember.workspace_id == email_invite.workspace_id,
            WorkspaceMember.user_id == current_user.id
        ).first()

        if existing_membership:
            raise HTTPException(status_code=400, detail="User is already a member of this workspace")

        member = WorkspaceMember(
            workspace_id=email_invite.workspace_id,
            user_id=current_user.id,
            role=email_invite.role
        )

        db.add(member)
        email_invite.status = "accepted"
        email_invite.accepted_at = datetime.utcnow()
        db.commit()

        workspace = db.query(Workspace).filter(Workspace.id == email_invite.workspace_id).first()
        if workspace:
            _notify_workspace_invite_status_changed(
                workspace.owner_id,
                workspace.id,
                workspace.name,
                email_invite.id,
                email_invite.email,
                email_invite.status,
            )

        return {"workspace_id": email_invite.workspace_id}
    
    if invite.expires_at < datetime.utcnow():
        invite.status = "expired"
        db.commit()
        raise HTTPException(status_code=400, detail="Invite has expired")
    
    # Проверяем, не является ли пользователь уже участником
    existing_membership = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == invite.workspace_id,
        WorkspaceMember.user_id == current_user.id
    ).first()
    
    if existing_membership:
        raise HTTPException(status_code=400, detail="User is already a member of this workspace")
    
    # Добавляем пользователя в рабочее пространство
    member = WorkspaceMember(
        workspace_id=invite.workspace_id,
        user_id=current_user.id,
        role=invite.role
    )
    
    db.add(member)
    
    # Обновляем статус приглашения
    invite.status = "accepted"
    invite.invitee_id = current_user.id
    invite.accepted_at = datetime.utcnow()
    
    db.commit()
    
    return {"workspace_id": invite.workspace_id}

@router.get("/validate/{token}")
def validate_invite(
    token: str,
    db: Session = Depends(get_db)
):
    """Валидировать приглашение"""
    invite = db.query(Invite).filter(Invite.token == token).first()
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")

    # Истёк ли срок действия
    is_expired = invite.expires_at is not None and invite.expires_at < datetime.utcnow()
    if invite.status != "pending" or is_expired:
        # Возвращаем 400 с detail содержащим 'expired' для фронта
        raise HTTPException(status_code=400, detail="Invite expired or not active")

    workspace = db.query(Workspace).filter(Workspace.id == invite.workspace_id).first()
    inviter = db.query(User).filter(User.id == invite.inviter_id).first()

    owner = db.query(User).filter(User.id == workspace.owner_id).first() if workspace else None

    return {
        "workspace": {
            "id": workspace.id,
            "name": workspace.name,
            "description": getattr(workspace, "description", None),
            "tasks_count": 0,
            "users_count": 0,
            "owner": {
                "name": owner.name if owner and owner.name else (owner.email if owner else ""),
                "email": owner.email if owner else ""
            }
        },
        "inviter": {
            "name": inviter.name or inviter.email,
            "email": inviter.email
        },
        "expires_at": invite.expires_at
    }

@router.get("/me/invites", response_model=IncomingInvitesResponse)
def get_my_invites(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить входящие приглашения текущего пользователя"""
    # Ищем email-приглашения для пользователя
    email_invites = db.query(EmailInvite).filter(
        EmailInvite.email == current_user.email,
        EmailInvite.status == "pending"
    ).all()
    
    result = []
    for email_invite in email_invites:
        workspace = db.query(Workspace).filter(Workspace.id == email_invite.workspace_id).first()
        if not workspace:
            continue

        owner = db.query(User).filter(User.id == workspace.owner_id).first()

        result.append(IncomingInvite(
            id=email_invite.id,
            token=email_invite.token,
            workspace=WorkspaceRef(
                id=workspace.id,
                name=workspace.name,
            ),
            inviter=UserRef(
                name=(owner.name if owner and owner.name else (owner.email if owner else "Владелец пространства")),
                email=(owner.email if owner else ""),
            ),
            expires_at=email_invite.expires_at,
            status=email_invite.status,
        ))
    
    return IncomingInvitesResponse(invites=result)

@router.post("/invites/{invite_id}/decline")
def decline_invite(
    invite_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Отклонить приглашение"""
    email_invite = db.query(EmailInvite).filter(EmailInvite.id == invite_id).first()
    
    if not email_invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    
    if email_invite.email != current_user.email:
        raise HTTPException(status_code=403, detail="This invite is not for you")
    
    email_invite.status = "declined"
    db.commit()

    workspace = db.query(Workspace).filter(Workspace.id == email_invite.workspace_id).first()
    if workspace:
        _notify_workspace_invite_status_changed(
            workspace.owner_id,
            workspace.id,
            workspace.name,
            email_invite.id,
            email_invite.email,
            email_invite.status,
        )
    
    return {"message": "Invite declined successfully"}

@router.delete("/email-invites/{invite_id}")
def revoke_email_invite(
    invite_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Отозвать email-приглашение"""
    email_invite = db.query(EmailInvite).filter(EmailInvite.id == invite_id).first()
    if not email_invite:
        raise HTTPException(status_code=404, detail="Invite not found")

    workspace = db.query(Workspace).filter(Workspace.id == email_invite.workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    if workspace.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only owner can revoke email invites")

    invited_user = db.query(User).filter(User.email == email_invite.email).first()
    email_invite.status = "revoked"
    db.commit()

    if invited_user:
        payload = {
            "type": "workspace_invite_revoked",
            "invite": {
                "id": email_invite.id,
                "token": email_invite.token,
                "workspace": {
                    "id": workspace.id,
                    "name": workspace.name,
                },
                "status": email_invite.status,
            },
        }
        try:
            import asyncio
            asyncio.run(manager.send_personal_message(payload, invited_user.id))
        except Exception:
            pass

    return {"message": "Email invite revoked successfully"}

@router.get("/workspaces/{workspace_id}/email-invites", response_model=EmailInvitesResponse)
def get_workspace_email_invites(
    workspace_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить email-приглашения рабочего пространства"""
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    # Только владелец может просматривать email-приглашения
    if workspace.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only owner can view email invites")
    
    email_invites = db.query(EmailInvite).filter(
        EmailInvite.workspace_id == workspace_id
    ).all()
    
    def to_email_invite_schema(email_invite: EmailInvite) -> EmailInviteSchema:
        return EmailInviteSchema(
            id=email_invite.id,
            email=email_invite.email,
            role=email_invite.role,
            created_at=email_invite.created_at,
            expires_at=email_invite.expires_at,
            status=email_invite.status
        )
    
    return EmailInvitesResponse(invites=[to_email_invite_schema(inv) for inv in email_invites])
