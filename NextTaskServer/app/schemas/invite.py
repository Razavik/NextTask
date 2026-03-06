from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class WorkspaceRef(BaseModel):
    id: int
    name: str

class UserRef(BaseModel):
    name: str
    email: str

class IncomingInvite(BaseModel):
    id: int
    token: str
    workspace: WorkspaceRef
    inviter: UserRef
    expires_at: Optional[datetime] = None
    status: str  # "pending" | "accepted" | "declined" | "expired"

class IncomingInvitesResponse(BaseModel):
    invites: List[IncomingInvite]

class EmailInvite(BaseModel):
    id: int
    email: str
    role: Optional[str] = None  # "owner" | "editor" | "reader"
    created_at: datetime
    expires_at: Optional[datetime] = None
    status: str  # "pending" | "revoked" | "expired" | "accepted"

class EmailInvitesResponse(BaseModel):
    invites: List[EmailInvite]

class InviteLinkItem(BaseModel):
    invite_token: Optional[str] = None
    token: str
    expires_at: Optional[datetime] = None
    times_used: int
    max_uses: Optional[int] = None

class InviteLinksResponse(BaseModel):
    links: List[InviteLinkItem]

# Legacy snake_case schema for frontend compatibility in invites list
class InviteLinkItemLegacy(BaseModel):
    invite_token: str
    expires_at: Optional[datetime] = None
    times_used: int
    max_uses: Optional[int] = None

class AcceptInviteRequest(BaseModel):
    token: str

class DeclineInviteRequest(BaseModel):
    token: str

class EmailInviteRequest(BaseModel):
    email: str
    role: Optional[str] = None  # "owner" | "editor" | "reader"

class InviteLinkRequest(BaseModel):
    max_uses: Optional[int] = None
    expires_hours: Optional[int] = None
