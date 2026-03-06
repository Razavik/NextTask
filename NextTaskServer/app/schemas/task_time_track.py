from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from .user import UserResponse

class TaskTimeTrackBase(BaseModel):
    time_spent: int = Field(gt=0, description="Затраченное время в секундах")
    comment: Optional[str] = None

class TaskTimeTrackCreate(TaskTimeTrackBase):
    pass

class TaskTimeTrackResponse(TaskTimeTrackBase):
    id: int
    task_id: int
    user_id: int
    created_at: datetime
    
    # We will expand this manually in the API handler
    # to avoid circular dependency issues right now
    user: Optional[UserResponse] = None

    class Config:
        from_attributes = True
