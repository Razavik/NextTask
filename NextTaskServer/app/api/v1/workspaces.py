from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
import os
import base64
import mimetypes
from datetime import datetime, timedelta
import secrets

from app.database.database import get_db
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember
from app.models.task import Task
from app.models.invite import EmailInvite
from app.api.v1.chat import manager, _avatar_to_base64 as _chat_avatar_to_base64
from app.schemas.workspace import (
    WorkspaceCreate, WorkspaceUpdate, WorkspaceResponse, WorkspacesResponse,
    WorkspaceMember as WorkspaceMemberSchema, WorkspaceUsersResponse,
    EmailInviteRequest, EmailInvitesResponse, InviteLinkRequest, InviteLinksResponse, ChangeRoleRequest
)
from app.core.security import get_current_active_user

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

def _get_user_role(workspace: Workspace, user: User, db: Session) -> str:
    if workspace.owner_id == user.id:
        return "owner"
    member = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace.id,
        WorkspaceMember.user_id == user.id
    ).first()
    return member.role if member else None

def to_workspace_response(workspace: Workspace, current_user: User, db: Session) -> WorkspaceResponse:
    role = _get_user_role(workspace, current_user, db)
    tasks_count = db.query(Task).filter(Task.workspace_id == workspace.id).count()
    users_count = db.query(WorkspaceMember).filter(WorkspaceMember.workspace_id == workspace.id).count()
    members = db.query(WorkspaceMember).filter(WorkspaceMember.workspace_id == workspace.id).all()
    
    return WorkspaceResponse(
        id=workspace.id,
        name=workspace.name,
        description=workspace.description,
        tasks_count=tasks_count,
        users_count=users_count,
        role=role,
        owner_id=workspace.owner_id,
        created_at=workspace.created_at,
        updated_at=workspace.updated_at,
        members=[to_workspace_member(m) for m in members]
    )

def to_workspace_member(member: WorkspaceMember) -> WorkspaceMemberSchema:
    return WorkspaceMemberSchema(
        id=member.user.id,
        name=member.user.name,
        email=member.user.email,
        role=member.role,
        joined_at=member.joined_at,
        avatar=_avatar_to_base64(member.user.avatar),
    )

@router.get("/", response_model=List[WorkspaceResponse])
def get_workspaces(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить список рабочих пространств пользователя"""
    # Получаем рабочие пространства, где пользователь является владельцем или участником
    owned_workspaces = db.query(Workspace).filter(Workspace.owner_id == current_user.id).all()
    
    member_workspaces = db.query(Workspace).join(WorkspaceMember).filter(
        WorkspaceMember.user_id == current_user.id
    ).all()
    
    # Объединяем и удаляем дубликаты
    all_workspaces = list({w.id: w for w in owned_workspaces + member_workspaces}.values())
    return [to_workspace_response(w, current_user, db) for w in all_workspaces]

@router.get("/{workspace_id}", response_model=WorkspaceResponse)
def get_workspace(
    workspace_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить конкретное рабочее пространство"""
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    # Проверяем, имеет ли пользователь доступ к рабочему пространству
    if workspace.owner_id != current_user.id:
        membership = db.query(WorkspaceMember).filter(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == current_user.id
        ).first()
        if not membership:
            raise HTTPException(status_code=403, detail="Access denied")
    
    return to_workspace_response(workspace, current_user, db)

@router.post("/", response_model=WorkspaceResponse)
def create_workspace(
    workspace_data: WorkspaceCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Создать новое рабочее пространство"""
    workspace = Workspace(
        name=workspace_data.name,
        description=workspace_data.description,
        owner_id=current_user.id
    )
    
    db.add(workspace)
    db.commit()
    db.refresh(workspace)
    
    # Добавляем владельца как участника с ролью owner
    member = WorkspaceMember(
        workspace_id=workspace.id,
        user_id=current_user.id,
        role="owner"
    )
    db.add(member)
    db.commit()
    
    return to_workspace_response(workspace, current_user, db)

@router.put("/{workspace_id}", response_model=WorkspaceResponse)
def update_workspace(
    workspace_id: int,
    workspace_data: WorkspaceUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Обновить рабочее пространство"""
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    # Только владелец может обновлять рабочее пространство
    if workspace.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only owner can update workspace")
    
    for field, value in workspace_data.model_dump(exclude_unset=True).items():
        setattr(workspace, field, value)
    
    db.commit()
    db.refresh(workspace)
    return to_workspace_response(workspace, current_user, db)

@router.delete("/{workspace_id}")
def delete_workspace(
    workspace_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Удалить рабочее пространство"""
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    # Только владелец может удалять рабочее пространство
    if workspace.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only owner can delete workspace")
    
    db.delete(workspace)
    db.commit()
    return {"message": "Workspace deleted successfully"}

@router.get("/{workspace_id}/members", response_model=List[WorkspaceMemberSchema])
def get_workspace_members(
    workspace_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить участников рабочего пространства"""
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    # Проверяем доступ
    if workspace.owner_id != current_user.id:
        membership = db.query(WorkspaceMember).filter(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == current_user.id
        ).first()
        if not membership:
            raise HTTPException(status_code=403, detail="Access denied")
    
    members = db.query(WorkspaceMember).filter(WorkspaceMember.workspace_id == workspace_id).all()
    return [to_workspace_member(m) for m in members]

@router.post("/{workspace_id}/email-invites")
def invite_user(
    workspace_id: int,
    invite_data: EmailInviteRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Пригласить пользователя по email"""
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    # Только владелец может приглашать пользователей
    if workspace.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only owner can invite users")

    email = invite_data.email.strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")

    if email == current_user.email.lower():
        raise HTTPException(status_code=400, detail="Нельзя пригласить самого себя")

    invited_user = db.query(User).filter(User.email == email).first()
    if not invited_user:
        raise HTTPException(status_code=404, detail="Пользователь с таким email не найден")

    existing_member = db.query(User).join(WorkspaceMember, WorkspaceMember.user_id == User.id).filter(
        WorkspaceMember.workspace_id == workspace_id,
        User.email == email
    ).first()
    if existing_member:
        raise HTTPException(status_code=400, detail="Пользователь уже состоит в этом пространстве")

    existing_pending_invite = db.query(EmailInvite).filter(
        EmailInvite.workspace_id == workspace_id,
        EmailInvite.email == email,
        EmailInvite.status == "pending"
    ).first()
    if existing_pending_invite:
        raise HTTPException(status_code=400, detail="Приглашение этому пользователю уже отправлено")

    email_invite = EmailInvite(
        workspace_id=workspace_id,
        email=email,
        role=invite_data.role or "reader",
        status="pending",
        token=secrets.token_urlsafe(32),
        expires_at=datetime.utcnow() + timedelta(days=7),
        sent_at=datetime.utcnow(),
    )

    db.add(email_invite)
    db.commit()

    payload = {
        "type": "workspace_invited",
        "invite": {
            "id": email_invite.id,
            "token": email_invite.token,
            "workspace": {
                "id": workspace.id,
                "name": workspace.name,
            },
            "inviter": {
                "name": current_user.name or current_user.email,
                "email": current_user.email,
                "avatar": _chat_avatar_to_base64(current_user.avatar),
            },
            "expires_at": email_invite.expires_at.isoformat() if email_invite.expires_at else None,
            "status": email_invite.status,
        },
    }
    try:
        import asyncio
        asyncio.run(manager.send_personal_message(payload, invited_user.id))
    except Exception:
        pass

    return {"message": "Email invitation sent successfully"}

@router.patch("/{workspace_id}/members/{user_id}/role")
def change_user_role(
    workspace_id: int,
    user_id: int,
    role_data: dict,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Изменить роль пользователя в рабочем пространстве"""
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    # Только владелец может изменять роли
    if workspace.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only owner can change roles")
    
    membership = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.user_id == user_id
    ).first()
    
    if not membership:
        raise HTTPException(status_code=404, detail="User not found in workspace")
    
    # Нельзя изменить роль владельца
    if membership.role == "owner":
        raise HTTPException(status_code=403, detail="Cannot change owner role")
    
    membership.role = role_data.get("role", membership.role)
    db.commit()
    
    return {"message": "User role updated successfully"}

@router.delete("/{workspace_id}/members/{user_id}")
def remove_user(
    workspace_id: int,
    user_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Удалить пользователя из рабочего пространства"""
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    # Только владелец может удалять пользователей
    if workspace.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only owner can remove users")
    
    membership = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.user_id == user_id
    ).first()
    
    if not membership:
        raise HTTPException(status_code=404, detail="User not found in workspace")
    
    # Нельзя удалить владельца
    if membership.role == "owner":
        raise HTTPException(status_code=403, detail="Cannot remove owner")

    removed_user_id = membership.user_id
    
    db.delete(membership)
    db.commit()

    payload = {
        "type": "workspace_member_removed",
        "workspace": {
            "id": workspace.id,
            "name": workspace.name,
        },
    }
    try:
        import asyncio
        asyncio.run(manager.send_personal_message(payload, removed_user_id))
    except Exception:
        pass
    
    return {"message": "User removed from workspace successfully"}
