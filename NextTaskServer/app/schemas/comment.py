from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class CommentAuthor(BaseModel):
    id: int
    name: Optional[str] = None
    email: str
    avatar: Optional[str] = None

class CommentBase(BaseModel):
    content: str

class CommentCreate(CommentBase):
    pass

class CommentUpdate(BaseModel):
    content: str

class CommentResponse(CommentBase):
    id: int
    author_id: int
    author: Optional[CommentAuthor] = None
    task_id: int
    created_at: Optional[datetime] = None

class CommentsResponse(BaseModel):
    comments: List[CommentResponse]

class CommentsCountResponse(BaseModel):
    count: int

class CommentsQuery(BaseModel):
    limit: Optional[int] = 50
    offset: Optional[int] = 0
    order: Optional[str] = "desc"
