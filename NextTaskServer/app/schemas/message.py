from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime

class MessageAuthor(BaseModel):
    id: int
    name: Optional[str] = None
    email: str
    avatar: Optional[str] = None

class MessageBase(BaseModel):
    id: int
    content: str
    is_edited: bool = False
    created_at: str
    updated_at: Optional[str] = None
    attachments: Optional[List[str]] = None
    reply_to_id: Optional[int] = None
    is_pinned: bool = False

class RepliedMessageRef(MessageBase):
    sender: Optional[MessageAuthor] = None

class Message(MessageBase):
    sender_id: int
    receiver_id: Optional[int] = None
    chat_id: Optional[int] = None
    is_read: int
    sender: Optional[MessageAuthor] = None
    receiver: Optional[MessageAuthor] = None
    replied_message: Optional[RepliedMessageRef] = None

class MessageCreate(BaseModel):
    receiver_id: Optional[int] = None
    chat_id: Optional[int] = None
    content: str
    attachments: Optional[List[str]] = None
    reply_to_id: Optional[int] = None

class MessageUpdate(BaseModel):
    content: Optional[str] = None
    attachments: Optional[List[str]] = None
    is_pinned: Optional[bool] = None

class ChatMemberSchema(BaseModel):
    id: int
    user_id: int
    chat_id: int
    joined_at: datetime
    user: Optional[MessageAuthor] = None

class ChatSchema(BaseModel):
    id: int
    name: Optional[str] = None
    is_group: bool = False
    created_at: datetime
    members: List[ChatMemberSchema] = []

class UnreadCountResponse(BaseModel):
    count: int

class RecentChatItem(BaseModel):
    id: str
    type: str  # "personal" | "group"
    user_id: Optional[int] = None
    chat_id: Optional[int] = None
    name: str
    avatar: Optional[str] = None
    last_activity_at: Optional[datetime] = None
    workspace_id: Optional[int] = None

class RecentChatsResponse(BaseModel):
    chats: List[RecentChatItem]
from pydantic import BaseModel
from typing import List, Optional

class ChatCreateRequest(BaseModel):
    name: str
    user_ids: List[int]

class ChatUpdateRequest(BaseModel):
    name: str

class ChatAddMembersRequest(BaseModel):
    user_ids: List[int]



