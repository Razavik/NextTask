from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from .user import UserResponse

class WorkspaceRoleEnum:
    OWNER = "owner"
    EDITOR = "editor"
    READER = "reader"

WORKSPACE_ROLES = [WorkspaceRoleEnum.OWNER, WorkspaceRoleEnum.EDITOR, WorkspaceRoleEnum.READER]

class WorkspaceMember(BaseModel):
    id: int
    name: str
    email: str
    role: str  # 'owner' | 'editor' | 'reader'
    joined_at: Optional[datetime] = None
    avatar: Optional[str] = None

class WorkspaceBase(BaseModel):
    name: str
    description: Optional[str] = None

class WorkspaceCreate(WorkspaceBase):
    pass

class WorkspaceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class WorkspaceResponse(WorkspaceBase):
    id: int
    tasks_count: int
    users_count: int
    role: str  # роль текущего пользователя
    owner_id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    members: List[WorkspaceMember] = []

class WorkspacesResponse(BaseModel):
    workspaces: List[WorkspaceResponse]

class WorkspaceUsersResponse(BaseModel):
    users: List[WorkspaceMember]

class EmailInviteRequest(BaseModel):
    email: str
    role: Optional[str] = None  # 'owner' | 'editor' | 'reader'

class EmailInviteResponse(BaseModel):
    id: int
    email: str
    role: Optional[str] = None
    created_at: datetime
    expires_at: Optional[datetime] = None
    status: str  # 'pending' | 'revoked' | 'expired' | 'accepted'

class EmailInvitesResponse(BaseModel):
    invites: List[EmailInviteResponse]

class InviteLinkRequest(BaseModel):
    max_uses: Optional[int] = None
    expires_hours: Optional[int] = None

class InviteLinkResponse(BaseModel):
    invite_token: str
    expires_at: Optional[datetime] = None
    times_used: int
    max_uses: Optional[int] = None

class InviteLinksResponse(BaseModel):
    links: List[InviteLinkResponse]

class ChangeRoleRequest(BaseModel):
    role: str  # 'owner' | 'editor' | 'reader'
